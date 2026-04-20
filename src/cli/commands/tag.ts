import { defineCommand } from "citty";
import { updateArticle } from "../../core/article.ts";
import {
  loadIndex,
  upsertInIndex,
} from "../../core/index-manager.ts";
import { resolveScope, getScopeRoot } from "../../core/scope.ts";
import type { ScopeOption, Scope } from "../../types/scope.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

const renameCmd = defineCommand({
  meta: {
    name: "rename",
    description: "Rename a tag across all matching articles",
  },
  args: {
    old: {
      type: "positional",
      description: "Existing tag",
      required: true,
    },
    new: {
      type: "positional",
      description: "Replacement tag",
      required: true,
    },
    scope: {
      type: "string",
      alias: "s",
      default: "all",
      description: "Scope: local, global, or all",
    },
    "dry-run": {
      type: "boolean",
      default: false,
      description: "Show affected articles without writing",
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
      const oldTag = args.old;
      const newTag = args.new;
      if (!oldTag || !newTag) {
        throw new Error("Both old and new tag are required");
      }

      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as ScopeOption,
        "read",
      );

      const affected: Array<{ slug: string; scope: Scope }> = [];

      for (const scope of scopes) {
        const root = scope === "local" ? localRoot! : globalRoot;
        const index = await loadIndex(root);
        for (const meta of Object.values(index.articles)) {
          if (!meta.tags.includes(oldTag)) continue;
          affected.push({ slug: meta.slug, scope });

          if (args["dry-run"]) continue;

          const result = await updateArticle(
            meta.slug,
            { addTags: [newTag], removeTags: [oldTag], scope },
          );
          const r = await getScopeRoot(result.scope);
          await upsertInIndex(r, result.meta);
        }
      }

      if (args.json) {
        console.log(
          jsonSuccess({
            old: oldTag,
            new: newTag,
            dryRun: args["dry-run"],
            affected,
            count: affected.length,
          }),
        );
        return;
      }

      const verb = args["dry-run"] ? "Would rename" : "Renamed";
      console.log(
        `${verb} tag "${oldTag}" → "${newTag}" in ${affected.length} article(s).`,
      );
      for (const a of affected) {
        console.log(`  ${a.scope}/${a.slug}`);
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});

export default defineCommand({
  meta: {
    name: "tag",
    description: "Tag bulk operations",
  },
  subCommands: {
    rename: renameCmd,
  },
});
