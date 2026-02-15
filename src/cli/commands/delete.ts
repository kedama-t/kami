import { defineCommand } from "citty";
import { deleteArticle, resolveSlug } from "../../core/article.ts";
import { removeFromIndex } from "../../core/index-manager.ts";
import { getScopeRoot } from "../../core/scope.ts";
import type { Scope } from "../../types/scope.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "delete",
    description: "Delete an article",
  },
  args: {
    slug: {
      type: "positional",
      description: "Article identifier",
      required: true,
    },
    force: {
      type: "boolean",
      alias: "F",
      default: false,
      description: "Skip confirmation prompt",
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
      // In JSON mode, --force is required
      if (args.json && !args.force) {
        throw new KamiError(
          "--force is required in JSON mode",
          "VALIDATION_ERROR",
          EXIT_CODES.GENERAL_ERROR,
        );
      }

      // Resolve first to show info
      const resolved = await resolveSlug(
        args.slug,
        args.scope as Scope | undefined,
      );

      // Confirmation prompt (unless --force)
      if (!args.force) {
        const display = resolved.meta.folder
          ? `${resolved.meta.folder}/${resolved.meta.slug}`
          : resolved.meta.slug;
        process.stdout.write(
          `Delete ${display} (${resolved.scope})? [y/N] `,
        );

        const reader = Bun.stdin.stream().getReader();
        const { value } = await reader.read();
        reader.releaseLock();
        const answer = value
          ? Buffer.from(value).toString("utf-8").trim().toLowerCase()
          : "";

        if (answer !== "y" && answer !== "yes") {
          console.log("Cancelled.");
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }

      const { meta, scope } = await deleteArticle(
        args.slug,
        args.scope as Scope | undefined,
      );

      // Remove from index
      const root = await getScopeRoot(scope);
      await removeFromIndex(root, meta.slug);

      if (args.quiet) return;

      if (args.json) {
        console.log(
          jsonSuccess({
            slug: meta.slug,
            title: meta.title,
            scope,
            file_path: meta.filePath,
          }),
        );
      } else {
        const display = meta.folder
          ? `${meta.folder}/${meta.slug}`
          : meta.slug;
        console.log(`Deleted: ${display} (${scope})`);
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
