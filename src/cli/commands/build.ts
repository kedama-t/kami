import { defineCommand } from "citty";
import type { Scope } from "../../types/scope.ts";
import { buildStaticSite } from "../../renderer/build.ts";
import { handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "build",
    description: "Build static HTML pages",
  },
  args: {
    slug: {
      type: "string",
      description: "Build a specific article only (incremental build)",
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Scope: local | global",
    },
    clean: {
      type: "boolean",
      description: "Clean output directory before building",
      default: false,
    },
    outDir: {
      type: "string",
      alias: "o",
      description: "Output directory (default: dist)",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
  },
  async run({ args }) {
    try {
      const result = await buildStaticSite({
        slug: args.slug,
        scope: args.scope as Scope | undefined,
        clean: args.clean,
        outDir: args.outDir,
      });

      if (args.json) {
        console.log(
          JSON.stringify({
            ok: true,
            data: { pagesBuilt: result.pagesBuilt, outDir: result.outDir },
            error: null,
          }, null, 2),
        );
      } else {
        console.log(
          `Built ${result.pagesBuilt} page(s) → ${result.outDir}/`,
        );
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
