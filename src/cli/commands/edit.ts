import { defineCommand } from "citty";
import { updateArticle, resolveSlug } from "../../core/article.ts";
import { upsertInIndex } from "../../core/index-manager.ts";
import { getScopeRoot } from "../../core/scope.ts";
import type { Scope } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";
import { readBody } from "../helpers/input.ts";
import { runPreHook, runPostHook } from "../helpers/hooks.ts";

export default defineCommand({
  meta: {
    name: "edit",
    description: "Update an article's metadata or body",
  },
  args: {
    slug: {
      type: "positional",
      description: "Article identifier",
      required: true,
    },
    title: {
      type: "string",
      description: "New title",
    },
    "add-tag": {
      type: "string",
      description: "Add a tag",
    },
    "remove-tag": {
      type: "string",
      description: "Remove a tag",
    },
    body: {
      type: "string",
      alias: "b",
      description: "Replace body (file path or '-' for stdin)",
    },
    append: {
      type: "string",
      alias: "a",
      description: "Append to body (file path or '-' for stdin)",
    },
    draft: {
      type: "boolean",
      description: "Set draft status",
    },
    "add-alias": {
      type: "string",
      description: "Add an alias",
    },
    "remove-alias": {
      type: "string",
      description: "Remove an alias",
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
    quiet: {
      type: "boolean",
      alias: "q",
      default: false,
      description: "Suppress output",
    },
  },
  async run({ args }) {
    try {
      const addTags = args["add-tag"]
        ? Array.isArray(args["add-tag"])
          ? args["add-tag"]
          : [args["add-tag"]]
        : undefined;
      const removeTags = args["remove-tag"]
        ? Array.isArray(args["remove-tag"])
          ? args["remove-tag"]
          : [args["remove-tag"]]
        : undefined;

      // Read body/append content if file path or stdin
      let bodyContent: string | undefined;
      let appendContent: string | undefined;
      if (args.body) {
        bodyContent = await readBody(args.body);
      }
      if (args.append) {
        appendContent = await readBody(args.append);
      }

      // Resolve slug and run pre-update hook
      const resolved = await resolveSlug(
        args.slug,
        args.scope as Scope | undefined,
      );
      await runPreHook("article:pre-update", resolved.scope, resolved.meta);

      const result = await updateArticle(args.slug, {
        title: args.title,
        addTags,
        removeTags,
        body: bodyContent,
        append: appendContent,
        draft: args.draft,
        addAlias: args["add-alias"],
        removeAlias: args["remove-alias"],
        scope: args.scope as Scope | undefined,
      });

      // Update index
      const root = await getScopeRoot(result.scope);
      await upsertInIndex(root, result.meta);

      // Run post-update hook
      await runPostHook("article:post-update", result.scope, result.meta);

      if (args.quiet) return;

      if (args.json) {
        console.log(
          jsonSuccess({
            slug: result.meta.slug,
            title: result.meta.title,
            scope: result.scope,
            file_path: result.meta.filePath,
            updated: result.meta.updated,
          }),
        );
      } else {
        const display = result.meta.folder
          ? `${result.meta.folder}/${result.meta.slug}`
          : result.meta.slug;
        console.log(`Updated: ${display} (${result.scope})`);
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
