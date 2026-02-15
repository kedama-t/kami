import { defineCommand } from "citty";
import { readArticle } from "../../core/article.ts";
import type { Scope } from "../../types/scope.ts";
import { serializeFrontmatter } from "../../core/frontmatter.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

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

      if (args.json) {
        console.log(
          jsonSuccess({
            slug: article.meta.slug,
            title: article.meta.title,
            scope: article.scope,
            folder: article.meta.folder,
            file_path: article.meta.filePath,
            frontmatter: {
              title: article.meta.title,
              tags: article.meta.tags,
              created: article.meta.created,
              updated: article.meta.updated,
              template: article.meta.template,
              aliases: article.meta.aliases ?? [],
              draft: article.meta.draft ?? false,
            },
            body: article.body,
          }),
        );
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

      // Default: full markdown with frontmatter
      const fm = {
        title: article.meta.title,
        tags: article.meta.tags,
        created: article.meta.created,
        updated: article.meta.updated,
        template: article.meta.template,
        aliases: article.meta.aliases,
        draft: article.meta.draft,
      };
      console.log(serializeFrontmatter(fm, article.body).trim());
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
