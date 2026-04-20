import { defineCommand } from "citty";
import { readArticle } from "../../core/article.ts";
import { search, tokenize } from "../../core/search.ts";
import { resolveScope } from "../../core/scope.ts";
import type { Scope, ScopeOption } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

/** Build a query string from an article's title, tags, and top body terms. */
export function buildSimilarityQuery(
  title: string,
  tags: string[],
  body: string,
  topN = 8,
): string {
  // Title and tags weighted by repetition
  const parts = [title, title, ...tags, ...tags];

  // Top-N body terms by frequency (excludes very short tokens)
  const counts = new Map<string, number>();
  for (const token of tokenize(body)) {
    if (token.length < 2) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const topTerms = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term]) => term);

  return [...parts, ...topTerms].filter(Boolean).join(" ");
}

export default defineCommand({
  meta: {
    name: "similar",
    description:
      "Find articles similar to a given slug (title + tags + top terms)",
  },
  args: {
    slug: {
      type: "positional",
      description: "Source article slug",
      required: true,
    },
    scope: {
      type: "string",
      alias: "s",
      default: "all",
      description: "Scope to search in: local, global, or all",
    },
    limit: {
      type: "string",
      alias: "n",
      default: "10",
      description: "Max number of similar articles to return",
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
      const article = await readArticle(args.slug);
      const query = buildSimilarityQuery(
        article.meta.title,
        article.meta.tags,
        article.body,
      );
      const limit = parseInt(args.limit, 10);

      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as ScopeOption,
        "read",
      );
      const scopeEntries = scopes.map((s) => ({
        scope: s as Scope,
        root: s === "local" ? localRoot! : globalRoot,
      }));

      const result = await search(query, {
        scopes: scopeEntries,
        // Over-fetch to leave room after self-exclusion
        limit: limit + 5,
      });

      const filtered = result.results.filter(
        (r) => !(r.slug === article.meta.slug && r.scope === article.scope),
      );
      const sliced = filtered.slice(0, limit);

      if (args.json) {
        console.log(
          jsonSuccess({
            source: { slug: article.meta.slug, scope: article.scope },
            results: sliced.map((r) => ({
              slug: r.slug,
              title: r.title,
              scope: r.scope,
              folder: r.folder,
              score: r.score,
              tags: r.tags,
            })),
            total: filtered.length,
          }),
        );
        return;
      }

      if (sliced.length === 0) {
        console.log(`No similar articles found for ${args.slug}.`);
        return;
      }
      console.log(
        ` ${"SCOPE".padEnd(8)} ${"SLUG".padEnd(28)} ${"TITLE".padEnd(36)} SCORE`,
      );
      for (const r of sliced) {
        console.log(
          ` ${r.scope.padEnd(8)} ${r.slug.padEnd(28)} ${r.title.padEnd(36)} ${r.score}`,
        );
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
