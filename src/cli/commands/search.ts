import { defineCommand } from "citty";
import { search } from "../../core/search.ts";
import { resolveScope } from "../../core/scope.ts";
import type { ScopeOption } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "search",
    description: "Full-text search across articles",
  },
  args: {
    query: {
      type: "positional",
      description: "Search query",
      required: true,
    },
    tag: {
      type: "string",
      alias: "t",
      description: "Filter by tag",
    },
    folder: {
      type: "string",
      alias: "f",
      description: "Filter by folder",
    },
    scope: {
      type: "string",
      alias: "s",
      default: "all",
      description: "Scope: local, global, or all",
    },
    limit: {
      type: "string",
      alias: "n",
      default: "20",
      description: "Max number of results",
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

      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as ScopeOption,
        "read",
      );

      const scopeEntries = scopes.map((s) => ({
        scope: s,
        root: s === "local" ? localRoot! : globalRoot,
      }));

      const result = await search(args.query, {
        scopes: scopeEntries,
        tags,
        folder: args.folder,
        limit,
      });

      if (args.quiet) return;

      if (args.json) {
        console.log(
          jsonSuccess({
            results: result.results.map((r) => ({
              slug: r.slug,
              title: r.title,
              scope: r.scope,
              folder: r.folder,
              score: r.score,
              matches: r.matches,
              tags: r.tags,
            })),
            total: result.total,
            query: result.query,
          }),
        );
        return;
      }

      // Text output
      if (result.results.length === 0) {
        console.log("No results found.");
        return;
      }

      console.log(
        ` ${"SCOPE".padEnd(8)} ${"SLUG".padEnd(24)} ${"TITLE".padEnd(32)} SCORE`,
      );

      for (const r of result.results) {
        console.log(
          ` ${r.scope.padEnd(8)} ${r.slug.padEnd(24)} ${r.title.padEnd(32)} ${r.score}`,
        );
      }

      console.log(` (${result.total} results)`);
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
