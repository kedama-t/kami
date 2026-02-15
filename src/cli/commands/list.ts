import { defineCommand } from "citty";
import { queryIndex } from "../../core/index-manager.ts";
import {
  resolveScope,
  getScopeRoot,
  getScopePaths,
} from "../../core/scope.ts";
import type { Scope, ScopeOption } from "../../types/scope.ts";
import type { ArticleMeta } from "../../types/article.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "list",
    description: "List articles",
  },
  args: {
    folder: {
      type: "string",
      alias: "f",
      description: "Filter by folder",
    },
    tag: {
      type: "string",
      alias: "t",
      description: "Filter by tag (multiple: AND)",
    },
    sort: {
      type: "string",
      default: "updated",
      description: "Sort field: created, updated, title",
    },
    order: {
      type: "string",
      default: "desc",
      description: "Sort order: asc or desc",
    },
    limit: {
      type: "string",
      alias: "n",
      default: "20",
      description: "Max number of results",
    },
    offset: {
      type: "string",
      default: "0",
      description: "Skip first N results",
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Scope: local, global, or all",
    },
    draft: {
      type: "boolean",
      description: "Filter by draft status",
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
      const tags = args.tag
        ? Array.isArray(args.tag)
          ? args.tag
          : [args.tag]
        : undefined;

      const limit = parseInt(args.limit, 10);
      const offset = parseInt(args.offset, 10);

      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as ScopeOption | undefined,
        "read",
      );

      // Collect results from all relevant scopes
      const allArticles: Array<ArticleMeta & { scope: Scope }> = [];
      let grandTotal = 0;

      for (const scope of scopes) {
        const root = scope === "local" ? localRoot! : globalRoot;
        const { articles, total } = await queryIndex(root, {
          folder: args.folder,
          tags,
          sort: args.sort as "created" | "updated" | "title",
          order: args.order as "asc" | "desc",
          limit,
          offset,
          draft: args.draft,
        });

        for (const a of articles) {
          allArticles.push({ ...a, scope });
        }
        grandTotal += total;
      }

      if (args.quiet) return;

      if (args.json) {
        console.log(
          jsonSuccess({
            articles: allArticles.map((a) => ({
              slug: a.slug,
              title: a.title,
              scope: a.scope,
              folder: a.folder,
              tags: a.tags,
              created: a.created,
              updated: a.updated,
              draft: a.draft ?? false,
            })),
            total: grandTotal,
            limit,
            offset,
          }),
        );
        return;
      }

      // Text table output
      if (allArticles.length === 0) {
        console.log("No articles found.");
        return;
      }

      // Header
      console.log(
        ` ${"SCOPE".padEnd(8)} ${"FOLDER".padEnd(12)} ${"SLUG".padEnd(24)} ${"TITLE".padEnd(32)} UPDATED`,
      );

      for (const a of allArticles) {
        const date = a.updated.slice(0, 10);
        console.log(
          ` ${a.scope.padEnd(8)} ${(a.folder || "-").padEnd(12)} ${a.slug.padEnd(24)} ${a.title.padEnd(32)} ${date}`,
        );
      }

      console.log(` (${grandTotal} articles)`);
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
