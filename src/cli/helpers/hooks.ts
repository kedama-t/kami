import type { HookEvent, HookContext } from "../../types/hook.ts";
import type { Scope } from "../../types/scope.ts";
import type { ArticleMeta } from "../../types/article.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";
import {
  executeHooks,
  buildArticleHookContext,
} from "../../core/hook.ts";
import {
  getScopeRoot,
  getScopePaths,
  findLocalRoot,
  getGlobalRoot,
  globalScopeExists,
} from "../../core/scope.ts";

/** Get scope roots for hook execution (local first, then global) */
export async function getHookScopeRoots(): Promise<
  Array<{ scope: string; root: string }>
> {
  const roots: Array<{ scope: string; root: string }> = [];
  const localRoot = await findLocalRoot();
  if (localRoot) {
    roots.push({ scope: "local", root: localRoot });
  }
  if (await globalScopeExists()) {
    roots.push({ scope: "global", root: getGlobalRoot() });
  }
  return roots;
}

/** Run pre-hook for an article event. Throws KamiError if blocked. */
export async function runPreHook(
  event: HookEvent,
  scope: Scope,
  meta: ArticleMeta,
): Promise<void> {
  const scopeRoots = await getHookScopeRoots();
  if (scopeRoots.length === 0) return;

  const root = await getScopeRoot(scope);
  const paths = getScopePaths(root);
  const ctx = buildArticleHookContext(event, scope, paths.vault, {
    slug: meta.slug,
    title: meta.title,
    filePath: meta.filePath,
    folder: meta.folder,
    tags: meta.tags,
  });

  const result = await executeHooks(event, ctx, scopeRoots);
  if (result.blocked) {
    throw new KamiError(
      result.messages.join("; ") || "Operation blocked by hook",
      "HOOK_BLOCKED",
      EXIT_CODES.HOOK_BLOCKED,
    );
  }
  for (const msg of result.messages) {
    console.error(msg);
  }
}

/** Run post-hook for an article event. Warnings only, never throws. */
export async function runPostHook(
  event: HookEvent,
  scope: Scope,
  meta: ArticleMeta,
): Promise<void> {
  const scopeRoots = await getHookScopeRoots();
  if (scopeRoots.length === 0) return;

  const root = await getScopeRoot(scope);
  const paths = getScopePaths(root);
  const ctx = buildArticleHookContext(event, scope, paths.vault, {
    slug: meta.slug,
    title: meta.title,
    filePath: meta.filePath,
    folder: meta.folder,
    tags: meta.tags,
  });

  const result = await executeHooks(event, ctx, scopeRoots);
  for (const msg of result.messages) {
    console.error(msg);
  }
}
