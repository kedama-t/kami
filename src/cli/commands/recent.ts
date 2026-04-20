import { defineCommand } from "citty";
import { queryIndex, parseWhereClauses } from "../../core/index-manager.ts";
import { resolveScope } from "../../core/scope.ts";
import type { Scope, ScopeOption } from "../../types/scope.ts";
import type { ArticleMeta } from "../../types/article.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";

const DURATION_RE = /^(\d+)([smhd])$/;

/** Parse "1h" / "30m" / "2d" / "45s" into milliseconds. */
export function parseDuration(input: string): number {
  const match = DURATION_RE.exec(input.trim());
  if (!match) {
    throw new KamiError(
      `Invalid --since duration: "${input}" (expected e.g. 30m, 2h, 1d)`,
      "VALIDATION_ERROR",
      EXIT_CODES.GENERAL_ERROR,
    );
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit]!;
}

export default defineCommand({
  meta: {
    name: "recent",
    description: "Show articles updated within a recent time window",
  },
  args: {
    since: {
      type: "string",
      default: "1d",
      description: "Time window: 30m, 2h, 7d, etc.",
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
      default: "50",
      description: "Max number of results",
    },
    where: {
      type: "string",
      alias: "w",
      description:
        "Filter by frontmatter field: key=value or key!=value (multi: AND)",
    },
    json: {
      type: "boolean",
      alias: "j",
      default: false,
      description: "Output as JSON",
    },
  },
  async run({ args }) {
    try {
      const sinceMs = parseDuration(args.since);
      const cutoff = Date.now() - sinceMs;
      const limit = parseInt(args.limit, 10);
      const where = parseWhereClauses(args.where);

      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as ScopeOption,
        "read",
      );

      const allArticles: Array<ArticleMeta & { scope: Scope }> = [];
      for (const scope of scopes) {
        const root = scope === "local" ? localRoot! : globalRoot;
        const { articles } = await queryIndex(root, {
          sort: "updated",
          order: "desc",
          limit: 10_000,
          where,
        });
        for (const a of articles) {
          if (Date.parse(a.updated) >= cutoff) {
            allArticles.push({ ...a, scope });
          }
        }
      }

      allArticles.sort((a, b) => b.updated.localeCompare(a.updated));
      const sliced = allArticles.slice(0, limit);

      if (args.json) {
        console.log(
          jsonSuccess({
            since: args.since,
            cutoff: new Date(cutoff).toISOString(),
            articles: sliced.map((a) => ({
              slug: a.slug,
              title: a.title,
              scope: a.scope,
              folder: a.folder,
              tags: a.tags,
              updated: a.updated,
            })),
            total: allArticles.length,
            limit,
          }),
        );
        return;
      }

      if (sliced.length === 0) {
        console.log(`No articles updated within ${args.since}.`);
        return;
      }

      console.log(
        ` ${"SCOPE".padEnd(8)} ${"SLUG".padEnd(28)} ${"TITLE".padEnd(36)} UPDATED`,
      );
      for (const a of sliced) {
        console.log(
          ` ${a.scope.padEnd(8)} ${a.slug.padEnd(28)} ${a.title.padEnd(36)} ${a.updated.slice(0, 19).replace("T", " ")}`,
        );
      }
      console.log(` (${allArticles.length} within ${args.since})`);
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
