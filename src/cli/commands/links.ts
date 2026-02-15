import { defineCommand } from "citty";
import { resolveSlug } from "../../core/article.ts";
import { getForwardLinks } from "../../core/linker.ts";
import { getScopeRoot } from "../../core/scope.ts";
import { loadIndex } from "../../core/index-manager.ts";
import type { Scope } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "links",
    description: "Show forward links from an article",
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
      const links = await getForwardLinks(root, resolved.meta.slug);

      // Try to resolve link targets for display
      const enriched = await Promise.all(
        links.map(async (link) => {
          // Try to find in index to get title
          let title: string | null = null;
          let exists = false;

          // Determine which scope root to look in
          const targetScope = (link.scope as Scope) ?? resolved.scope;
          try {
            const targetRoot = await getScopeRoot(targetScope);
            const index = await loadIndex(targetRoot);
            if (index.articles[link.slug]) {
              title = index.articles[link.slug]!.title;
              exists = true;
            }
          } catch {
            // Scope doesn't exist
          }

          return {
            slug: link.slug,
            scope: link.scope ?? resolved.scope,
            title,
            exists,
          };
        }),
      );

      if (args.json) {
        console.log(
          jsonSuccess({
            slug: resolved.meta.slug,
            scope: resolved.scope,
            links: enriched,
          }),
        );
        return;
      }

      // Text output
      console.log(
        `Links from '${resolved.meta.slug}' (${resolved.scope}):`,
      );
      if (enriched.length === 0) {
        console.log("  (no links)");
        return;
      }
      for (const link of enriched) {
        const icon = link.exists ? "→" : "✗";
        const titleDisplay = link.title ?? "(not found)";
        const scopeDisplay =
          link.scope !== resolved.scope ? `${link.scope}:` : "";
        console.log(
          `  ${icon} ${scopeDisplay}${link.slug.padEnd(30)} ${titleDisplay}`,
        );
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
