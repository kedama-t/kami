import { defineCommand } from "citty";
import { createArticle } from "../../core/article.ts";
import { upsertInIndex } from "../../core/index-manager.ts";
import { getScopeRoot } from "../../core/scope.ts";
import type { Scope } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";
import { readBody } from "../helpers/input.ts";

export default defineCommand({
  meta: {
    name: "create",
    description: "Create a new article",
  },
  args: {
    title: {
      type: "positional",
      description: "Article title",
      required: true,
    },
    folder: {
      type: "string",
      alias: "f",
      description: "Target folder within vault",
    },
    tag: {
      type: "string",
      alias: "t",
      description: "Tags (can be specified multiple times)",
    },
    template: {
      type: "string",
      alias: "T",
      default: "note",
      description: "Template name",
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Target scope (local or global)",
    },
    slug: {
      type: "string",
      description: "Explicit slug (auto-generated from title if omitted)",
    },
    body: {
      type: "string",
      alias: "b",
      description: "Body source: file path or '-' for stdin",
    },
    draft: {
      type: "boolean",
      default: false,
      description: "Create as draft",
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
      // Parse tags: citty gives a single string for one --tag, need to handle multiple
      const tags = args.tag
        ? Array.isArray(args.tag)
          ? args.tag
          : [args.tag]
        : undefined;

      // Read body if specified
      let body: string | undefined;
      if (args.body) {
        body = await readBody(args.body);
      }

      const result = await createArticle(args.title, {
        folder: args.folder,
        tags,
        template: args.template,
        scope: args.scope as Scope | undefined,
        slug: args.slug,
        body,
        draft: args.draft,
      });

      // Update index
      const root = await getScopeRoot(result.scope);
      await upsertInIndex(root, result.meta);

      if (args.quiet) return;

      if (args.json) {
        console.log(
          jsonSuccess({
            slug: result.meta.slug,
            title: result.meta.title,
            scope: result.scope,
            folder: result.meta.folder,
            file_path: result.meta.filePath,
            tags: result.meta.tags,
            created: result.meta.created,
          }),
        );
      } else {
        const display = result.meta.folder
          ? `${result.meta.folder}/${result.meta.slug}`
          : result.meta.slug;
        console.log(`Created: ${display} (${result.scope})`);
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
