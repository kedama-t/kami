import { defineCommand } from "citty";
import { readArticle, resolveSlug } from "../../core/article.ts";
import type { Scope } from "../../types/scope.ts";
import { serializeFrontmatter } from "../../core/frontmatter.ts";
import { parseWikiLinks, buildExcerpt } from "../../core/linker.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

interface ExpandedLink {
  slug: string;
  scope: Scope | null;
  display_text?: string;
  resolved: boolean;
  title?: string;
  excerpt?: string;
}

async function expandLinks(
  body: string,
  fromScope: Scope,
  cwd?: string,
): Promise<ExpandedLink[]> {
  const parsed = parseWikiLinks(body);
  const seen = new Set<string>();
  const out: ExpandedLink[] = [];
  for (const link of parsed) {
    const dedupeKey = `${link.scope ?? ""}:${link.slug}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const requestedScope = (link.scope === "local" || link.scope === "global"
      ? link.scope
      : undefined) as Scope | undefined;

    try {
      const resolved = await resolveSlug(
        link.slug,
        requestedScope ?? fromScope,
        cwd,
      );
      const article = await readArticle(link.slug, resolved.scope, cwd);
      out.push({
        slug: link.slug,
        scope: resolved.scope,
        display_text: link.displayText ?? undefined,
        resolved: true,
        title: article.meta.title,
        excerpt: buildExcerpt(article.body),
      });
    } catch {
      out.push({
        slug: link.slug,
        scope: null,
        display_text: link.displayText ?? undefined,
        resolved: false,
      });
    }
  }
  return out;
}

export default defineCommand({
  meta: {
    name: "read",
    description: "Read an article and output to stdout",
  },
  args: {
    slug: {
      type: "positional",
      description: "Article identifier (slug, folder/slug, or title)",
      required: true,
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Target scope (local or global)",
    },
    "meta-only": {
      type: "boolean",
      alias: "m",
      default: false,
      description: "Output frontmatter only (no body)",
    },
    "body-only": {
      type: "boolean",
      default: false,
      description: "Output body only (no frontmatter)",
    },
    "expand-links": {
      type: "boolean",
      default: false,
      description:
        "Include excerpts of linked articles (resolves [[wiki-links]])",
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
      const article = await readArticle(
        args.slug,
        args.scope as Scope | undefined,
      );

      const expanded = args["expand-links"]
        ? await expandLinks(article.body, article.scope)
        : null;

      if (args.json) {
        // Surface the full parsed frontmatter (incl. custom keys), with
        // explicit defaults for known optional fields for output stability.
        const fmOut: Record<string, unknown> = {
          ...article.frontmatter,
          aliases: article.frontmatter.aliases ?? [],
          draft: article.frontmatter.draft ?? false,
        };
        const payload: Record<string, unknown> = {
          slug: article.meta.slug,
          title: article.meta.title,
          scope: article.scope,
          folder: article.meta.folder,
          file_path: article.meta.filePath,
          frontmatter: fmOut,
          body: article.body,
        };
        if (expanded !== null) payload.links = expanded;
        console.log(jsonSuccess(payload));
        return;
      }

      if (args["meta-only"]) {
        // Output YAML frontmatter fields only
        const lines = [
          `title: ${article.meta.title}`,
          `tags: [${article.meta.tags.join(", ")}]`,
          `created: ${article.meta.created}`,
          `updated: ${article.meta.updated}`,
        ];
        if (article.meta.template) lines.push(`template: ${article.meta.template}`);
        if (article.meta.aliases && article.meta.aliases.length > 0)
          lines.push(`aliases: [${article.meta.aliases.join(", ")}]`);
        lines.push(`draft: ${article.meta.draft ?? false}`);
        console.log(lines.join("\n"));
        return;
      }

      if (args["body-only"]) {
        console.log(article.body);
        return;
      }

      // Default: full markdown with frontmatter (preserves custom keys)
      const rendered = serializeFrontmatter(article.frontmatter, article.body).trim();
      if (expanded !== null && expanded.length > 0) {
        const lines = ["", "## Linked"];
        for (const link of expanded) {
          if (link.resolved) {
            lines.push(`- [[${link.slug}]] — ${link.title}`);
            if (link.excerpt) lines.push(`  ${link.excerpt}`);
          } else {
            lines.push(`- [[${link.slug}]] (unresolved)`);
          }
        }
        console.log(`${rendered}\n${lines.join("\n")}`);
      } else {
        console.log(rendered);
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
