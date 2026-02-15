import { defineCommand } from "citty";
import { resolveSlug } from "../../core/article.ts";
import { getBacklinks } from "../../core/linker.ts";
import { getScopeRoot } from "../../core/scope.ts";
import { loadIndex } from "../../core/index-manager.ts";
import type { Scope } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "backlinks",
    description: "Show backlinks to an article",
  },
  args: {
    slug: {
      type: "positional",
      description: "Article identifier",
      required: true,
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Target scope",
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
      const resolved = await resolveSlug(
        args.slug,
        args.scope as Scope | undefined,
      );
      const root = await getScopeRoot(resolved.scope);
      const backlinks = await getBacklinks(root, resolved.meta.slug);

      // Enrich with titles
      const enriched = await Promise.all(
        backlinks.map(async (bl) => {
          let title: string | null = null;
          try {
            const blRoot = await getScopeRoot(bl.scope as Scope);
            const index = await loadIndex(blRoot);
            if (index.articles[bl.slug]) {
              title = index.articles[bl.slug]!.title;
            }
          } catch {
            // Scope doesn't exist
          }
          return {
            slug: bl.slug,
            scope: bl.scope,
            title,
          };
        }),
      );

      if (args.json) {
        console.log(
          jsonSuccess({
            slug: resolved.meta.slug,
            scope: resolved.scope,
            backlinks: enriched,
          }),
        );
        return;
      }

      // Text output
      console.log(
        `Backlinks to '${resolved.meta.slug}' (${resolved.scope}):`,
      );
      if (enriched.length === 0) {
        console.log("  (no backlinks)");
        return;
      }
      for (const bl of enriched) {
        const titleDisplay = bl.title ?? "(unknown)";
        console.log(
          `  ← ${bl.slug.padEnd(30)} (${bl.scope})  ${titleDisplay}`,
        );
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
