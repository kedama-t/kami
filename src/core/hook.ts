import type {
  HookConfig,
  HookEvent,
  HookContext,
  HookMatcherGroup,
  HookResponse,
} from "../types/hook.ts";
import { EMPTY_HOOK_CONFIG } from "../types/hook.ts";
import { KamiError, EXIT_CODES } from "../types/result.ts";
import { LocalStorage } from "../storage/local.ts";
import { getScopePaths } from "./scope.ts";

const storage = new LocalStorage();

/** Result of running hooks for an event */
export interface HookResult {
  blocked: boolean;
  messages: string[];
}

/** Load hooks config from a scope */
async function loadHooksFromScope(scopeRoot: string): Promise<HookConfig> {
  const paths = getScopePaths(scopeRoot);
  try {
    const raw = await storage.readFile(paths.hooksFile);
    return JSON.parse(raw);
  } catch {
    return EMPTY_HOOK_CONFIG;
  }
}

/** Expand ${variable} placeholders in a command string */
export function expandVariables(
  command: string,
  context: HookContext,
): string {
  return command.replace(/\$\{(\w+)\}/g, (_, key: string) => {
    const val = (context as Record<string, unknown>)[key];
    if (val === undefined || val === null) return "";
    if (Array.isArray(val)) return val.join(",");
    return String(val);
  });
}

/** Check if a matcher regex matches the target string */
function matchesFilter(
  matcher: string | undefined,
  target: string,
): boolean {
  if (!matcher) return true; // no matcher = match all
  try {
    return new RegExp(matcher).test(target);
  } catch {
    return false; // invalid regex = no match
  }
}

/** Get the match target for an event */
function getMatchTarget(context: HookContext): string {
  if (context.event.startsWith("article:")) {
    return context.folder ?? "";
  }
  if (context.event.startsWith("build:")) {
    return context.scope;
  }
  return "";
}

/** Execute hooks for a given event across scopes */
export async function executeHooks(
  event: HookEvent,
  context: HookContext,
  scopeRoots: Array<{ scope: string; root: string }>,
): Promise<HookResult> {
  // Recursion guard
  if (process.env.KAMI_HOOK === "1") {
    return { blocked: false, messages: [] };
  }

  const isPreHook = event.includes("pre-");
  const messages: string[] = [];
  const matchTarget = getMatchTarget(context);

  // Execute local hooks first, then global
  for (const { root } of scopeRoots) {
    const config = await loadHooksFromScope(root);
    const groups = config.hooks[event];
    if (!groups) continue;

    for (const group of groups) {
      if (!matchesFilter(group.matcher, matchTarget)) continue;

      for (const handler of group.hooks) {
        if (handler.type !== "command") continue;

        const expandedCmd = expandVariables(handler.command, context);
        const timeout = (handler.timeout ?? 30) * 1000;

        try {
          const result = await runHookCommand(expandedCmd, context, timeout);

          if (result.exitCode === 2 && isPreHook) {
            // Block the operation
            const errMsg = result.stderr || "Hook blocked the operation";
            return { blocked: true, messages: [...messages, errMsg] };
          }

          if (result.exitCode === 0 && result.stdout) {
            // Parse stdout JSON
            try {
              const response: HookResponse = JSON.parse(result.stdout);
              if (response.message) messages.push(response.message);
              if (response.continue === false && isPreHook) {
                return {
                  blocked: true,
                  messages: [...messages, response.message ?? "Hook declined to continue"],
                };
              }
            } catch {
              // stdout is not JSON, ignore
            }
          }

          if (result.exitCode !== 0 && result.exitCode !== 2) {
            // Non-blocking warning
            messages.push(
              `Hook warning (exit ${result.exitCode}): ${result.stderr || expandedCmd}`,
            );
          }
        } catch (err) {
          messages.push(
            `Hook error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  return { blocked: false, messages };
}

/** Run a single hook command */
async function runHookCommand(
  command: string,
  context: HookContext,
  timeout: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const contextJson = JSON.stringify(context);

  const proc = Bun.spawn(["sh", "-c", command], {
    stdin: new Blob([contextJson]),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      KAMI_HOOK: "1",
    },
  });

  // Timeout handling
  const timer = setTimeout(() => {
    proc.kill();
  }, timeout);

  try {
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
  } finally {
    clearTimeout(timer);
  }
}

/** Build a HookContext for article events */
export function buildArticleHookContext(
  event: HookEvent,
  scope: string,
  vaultPath: string,
  article: {
    slug: string;
    title: string;
    filePath: string;
    folder: string;
    tags: string[];
  },
): HookContext {
  return {
    event,
    timestamp: new Date().toISOString(),
    scope,
    vault_path: vaultPath,
    slug: article.slug,
    title: article.title,
    file_path: article.filePath,
    folder: article.folder,
    tags: article.tags,
  };
}
