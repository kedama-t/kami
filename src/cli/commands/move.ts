import { defineCommand } from "citty";
import { join, dirname } from "node:path";
import { mkdir, rename } from "node:fs/promises";
import { resolveSlug } from "../../core/article.ts";
import {
  loadIndex,
  saveIndex,
  upsertInIndex,
  removeFromIndex,
} from "../../core/index-manager.ts";
import { getScopePaths, getScopeRoot } from "../../core/scope.ts";
import { LocalStorage } from "../../storage/local.ts";
import type { Scope } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";

const storage = new LocalStorage();

export default defineCommand({
  meta: {
    name: "move",
    description: "Move an article to a different folder within its scope",
  },
  args: {
    slug: {
      type: "positional",
      description: "Source article slug",
      required: true,
    },
    folder: {
      type: "positional",
      description: "Destination folder (relative to vault root, '' for root)",
      required: true,
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Source scope (local or global)",
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
      const scope = resolved.scope;
      const root = await getScopeRoot(scope);
      const paths = getScopePaths(root);

      const newFolder = args.folder.replace(/^\/+|\/+$/g, "");
      const destDir = newFolder ? join(paths.vault, newFolder) : paths.vault;
      const destPath = join(destDir, `${resolved.meta.slug}.md`);

      if (destPath === resolved.filePath) {
        throw new KamiError(
          `Article '${args.slug}' is already in '${newFolder}'`,
          "VALIDATION_ERROR",
          EXIT_CODES.GENERAL_ERROR,
        );
      }
      if (await storage.exists(destPath)) {
        throw new KamiError(
          `Destination '${destPath}' already exists`,
          "ARTICLE_ALREADY_EXISTS",
          EXIT_CODES.GENERAL_ERROR,
        );
      }

      await mkdir(dirname(destPath), { recursive: true });
      await rename(resolved.filePath, destPath);

      // Update index: rewrite folder + filePath
      const index = await loadIndex(root);
      const meta = index.articles[resolved.meta.slug];
      if (meta) {
        meta.folder = newFolder;
        meta.filePath = destPath;
        await saveIndex(root, index);
      } else {
        // Fallback: re-insert
        await removeFromIndex(root, resolved.meta.slug);
        await upsertInIndex(root, {
          ...resolved.meta,
          folder: newFolder,
          filePath: destPath,
        });
      }

      if (args.json) {
        console.log(
          jsonSuccess({
            slug: resolved.meta.slug,
            scope,
            from: resolved.filePath,
            to: destPath,
            folder: newFolder,
          }),
        );
        return;
      }
      console.log(
        `Moved ${scope}/${resolved.meta.slug} → ${newFolder || "(root)"}`,
      );
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
