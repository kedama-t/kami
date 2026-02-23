import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type {
  Scope,
  ScopeOption,
  ScopePaths,
  OperationType,
} from "../types/scope.ts";
import type { KamiConfig } from "../types/config.ts";
import { DEFAULT_CONFIG } from "../types/config.ts";
import { EMPTY_HOOK_CONFIG } from "../types/hook.ts";
import { KamiError, EXIT_CODES } from "../types/result.ts";
import { LocalStorage } from "../storage/local.ts";

const storage = new LocalStorage();

const KAMI_DIR = ".kami";

/** Get the global scope root path (~/.kami) */
export function getGlobalRoot(): string {
  return join(homedir(), KAMI_DIR);
}

/**
 * Module-level active vault directory for the global scope.
 * Initialized lazily by initGlobalVaultPath(). null = not yet initialized.
 */
let _globalVaultDir: string | null = null;
let _vaultInitialized = false;

/** Load the global config from ~/.kami/config.json */
export async function loadGlobalConfig(): Promise<KamiConfig> {
  const configPath = join(getGlobalRoot(), "config.json");
  try {
    const content = await storage.readFile(configPath);
    return JSON.parse(content) as KamiConfig;
  } catch {
    return {};
  }
}

/** Save the global config to ~/.kami/config.json */
export async function saveGlobalConfig(config: KamiConfig): Promise<void> {
  const root = getGlobalRoot();
  await storage.mkdir(root);
  const configPath = join(root, "config.json");
  await storage.writeFile(configPath, JSON.stringify(config, null, 2));
}

/** Initialize the active vault directory from config (called once per process) */
async function initGlobalVaultPath(): Promise<void> {
  if (_vaultInitialized) return;
  _vaultInitialized = true;
  const config = await loadGlobalConfig();
  if (config.activeVault && config.vaults?.[config.activeVault]) {
    _globalVaultDir = config.vaults[config.activeVault]!;
  } else {
    _globalVaultDir = join(getGlobalRoot(), "vault");
  }
}

/** Get paths for a given scope root */
export function getScopePaths(root: string): ScopePaths {
  const isGlobal = resolve(root) === resolve(getGlobalRoot());
  return {
    root,
    vault: (isGlobal && _globalVaultDir) ? _globalVaultDir : join(root, "vault"),
    templates: join(root, "templates"),
    indexFile: join(root, "index.json"),
    linksFile: join(root, "links.json"),
    configFile: join(root, "config.json"),
    hooksFile: join(root, "hooks.json"),
  };
}

/** Check if the global scope exists */
export async function globalScopeExists(): Promise<boolean> {
  return storage.exists(getGlobalRoot());
}

/** Find local scope by looking for .kami/ in cwd or ancestors */
export async function findLocalRoot(cwd?: string): Promise<string | null> {
  let dir = cwd ?? process.cwd();
  const root = "/";

  while (true) {
    const candidate = join(dir, KAMI_DIR);
    if (await storage.exists(candidate)) {
      return candidate;
    }
    const parent = join(dir, "..");
    if (parent === dir || dir === root) {
      return null;
    }
    dir = parent;
  }
}

/** Resolve scope based on request and operation type */
export async function resolveScope(
  requested?: ScopeOption,
  operation: OperationType = "read",
  cwd?: string,
): Promise<{ scopes: Scope[]; localRoot: string | null; globalRoot: string }> {
  await initGlobalVaultPath();
  const globalRoot = getGlobalRoot();
  const localRoot = await findLocalRoot(cwd);

  if (requested === "all") {
    const scopes: Scope[] = [];
    if (localRoot) scopes.push("local");
    if (await globalScopeExists()) scopes.push("global");
    return { scopes, localRoot, globalRoot };
  }

  if (requested === "local") {
    if (!localRoot) {
      throw new KamiError(
        "Local scope not found. Run 'kami init' to initialize.",
        "SCOPE_NOT_FOUND",
        EXIT_CODES.GENERAL_ERROR,
      );
    }
    return { scopes: ["local"], localRoot, globalRoot };
  }

  if (requested === "global") {
    return { scopes: ["global"], localRoot, globalRoot };
  }

  // Auto-resolve
  if (operation === "write") {
    const scope: Scope = localRoot ? "local" : "global";
    return { scopes: [scope], localRoot, globalRoot };
  }

  // Read: local-first if local exists
  if (localRoot) {
    return { scopes: ["local", "global"], localRoot, globalRoot };
  }
  return { scopes: ["global"], localRoot, globalRoot };
}

/** Get the root path for a specific scope */
export async function getScopeRoot(
  scope: Scope,
  cwd?: string,
): Promise<string> {
  if (scope === "global") {
    return getGlobalRoot();
  }
  const localRoot = await findLocalRoot(cwd);
  if (!localRoot) {
    throw new KamiError(
      "Local scope not found. Run 'kami init' to initialize.",
      "SCOPE_NOT_FOUND",
      EXIT_CODES.GENERAL_ERROR,
    );
  }
  return localRoot;
}

/** Initialize a local scope in the given directory */
export async function initLocalScope(cwd?: string): Promise<string> {
  const dir = cwd ?? process.cwd();
  const root = join(dir, KAMI_DIR);
  const paths = getScopePaths(root);

  await storage.mkdir(paths.vault);
  await storage.mkdir(paths.templates);

  const emptyIndex = JSON.stringify({ articles: {} }, null, 2);
  const emptyLinks = JSON.stringify({ forward: {}, backlinks: {} }, null, 2);
  const defaultConfig = JSON.stringify(
    { build: { outDir: "./.kami/dist" } } satisfies KamiConfig,
    null,
    2,
  );
  const defaultHooks = JSON.stringify(EMPTY_HOOK_CONFIG, null, 2);

  await Promise.all([
    storage.writeFile(paths.indexFile, emptyIndex),
    storage.writeFile(paths.linksFile, emptyLinks),
    storage.writeFile(paths.configFile, defaultConfig),
    storage.writeFile(paths.hooksFile, defaultHooks),
  ]);

  return root;
}

/** Ensure the global scope exists, creating it if needed */
export async function ensureGlobalScope(): Promise<string> {
  const root = getGlobalRoot();
  if (await storage.exists(root)) {
    return root;
  }

  const paths = getScopePaths(root);
  await storage.mkdir(paths.vault);
  await storage.mkdir(paths.templates);

  const emptyIndex = JSON.stringify({ articles: {} }, null, 2);
  const emptyLinks = JSON.stringify({ forward: {}, backlinks: {} }, null, 2);
  const defaultConfig = JSON.stringify(DEFAULT_CONFIG, null, 2);
  const defaultHooks = JSON.stringify(EMPTY_HOOK_CONFIG, null, 2);

  await Promise.all([
    storage.writeFile(paths.indexFile, emptyIndex),
    storage.writeFile(paths.linksFile, emptyLinks),
    storage.writeFile(paths.configFile, defaultConfig),
    storage.writeFile(paths.hooksFile, defaultHooks),
  ]);

  // Copy built-in templates
  const builtinDir = join(import.meta.dir, "..", "..", "templates");
  const builtinTemplates = await storage.listFiles(builtinDir, "*.md");
  for (const tpl of builtinTemplates) {
    const name = tpl.split("/").pop()!;
    const content = await storage.readFile(tpl);
    await storage.writeFile(join(paths.templates, name), content);
  }

  return root;
}
