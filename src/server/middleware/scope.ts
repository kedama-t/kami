import { createMiddleware } from "hono/factory";
import type { Scope } from "../../types/scope.ts";
import { resolveScope } from "../../core/scope.ts";

export type ScopeVariables = {
  scopes: Scope[];
  localRoot: string | null;
  globalRoot: string;
};

/**
 * リクエストごとにスコープ情報を Hono コンテキストに注入する。
 */
export const scopeMiddleware = createMiddleware<{
  Variables: ScopeVariables;
}>(async (c, next) => {
  const { scopes, localRoot, globalRoot } = await resolveScope("all", "read");
  c.set("scopes", scopes);
  c.set("localRoot", localRoot);
  c.set("globalRoot", globalRoot);
  await next();
});
