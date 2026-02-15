import { defineCommand } from "citty";
import { rebuildIndex } from "../../core/index-manager.ts";
import { rebuildLinkGraph } from "../../core/linker.ts";
import { resolveScope } from "../../core/scope.ts";
import type { ScopeOption, Scope } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "reindex",
    description: "Rebuild article index and link graph",
  },
  args: {
    scope: {
      type: "string",
      alias: "s",
      default: "all",
      description: "Scope: local, global, or all",
    },
    json: {
      type: "boolean",
      alias: "j",
      default: false,
      description: "Output as JSON",
    },
    quiet: {
      type: "boolean",
      alias: "q",
      default: false,
      description: "Suppress output",
    },
  },
  async run({ args }) {
    try {
      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as ScopeOption,
        "read",
      );

      const results: Array<{
        scope: Scope;
        articleCount: number;
        linkCount: number;
      }> = [];

      for (const s of scopes) {
        const root = s === "local" ? localRoot! : globalRoot;
        const index = await rebuildIndex(root);
        const articleCount = Object.keys(index.articles).length;
        const { linkCount } = await rebuildLinkGraph(root, s);
        results.push({ scope: s, articleCount, linkCount });
      }

      if (args.quiet) return;

      if (args.json) {
        console.log(
          jsonSuccess({
            scopes: results.map((r) => ({
              scope: r.scope,
              articles: r.articleCount,
              links: r.linkCount,
            })),
          }),
        );
      } else {
        for (const r of results) {
          console.log(
            `Reindexed ${r.scope}: ${r.articleCount} articles, ${r.linkCount} links`,
          );
        }
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
