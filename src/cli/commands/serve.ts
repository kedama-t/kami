import { defineCommand } from "citty";
import { createApp } from "../../server/app.ts";
import { buildStaticSite, copyBundledAssets } from "../../renderer/build.ts";
import { handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "serve",
    description: "Start the web server",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Port number",
      default: "3000",
    },
    "no-build": {
      type: "boolean",
      description: "Skip initial build",
      default: false,
    },
  },
  async run({ args }) {
    try {
      const port = parseInt(args.port, 10);

      // Build unless --no-build is specified
      if (!args["no-build"]) {
        console.log("Building static site...");
        const result = await buildStaticSite();
        console.log(`Built ${result.pagesBuilt} page(s).`);
      } else {
        // Even with --no-build, ensure bundled assets are available
        await copyBundledAssets("dist");
      }

      const distDir = "dist";
      const app = createApp(distDir);

      const server = Bun.serve({
        fetch: app.fetch,
        port,
      });

      console.log(`kami server running at http://localhost:${server.port}`);
    } catch (err) {
      handleError(err, false);
    }
  },
});
