import { defineCommand } from "citty";
import { readArticle } from "../../core/article.ts";
import { exportAsMarkdown, exportAsHtml } from "../../core/exporter.ts";
import { getScopeRoot } from "../../core/scope.ts";
import type { Scope } from "../../types/scope.ts";
import { handleError } from "../helpers/output.ts";
import { LocalStorage } from "../../storage/local.ts";

const storage = new LocalStorage();

export default defineCommand({
  meta: {
    name: "export",
    description: "Export an article",
  },
  args: {
    slug: {
      type: "positional",
      description: "Article identifier",
      required: true,
    },
    format: {
      type: "string",
      alias: "F",
      default: "md",
      description: "Output format: md or html",
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output file path (default: stdout)",
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Target scope",
    },
  },
  async run({ args }) {
    try {
      const article = await readArticle(
        args.slug,
        args.scope as Scope | undefined,
      );

      const scopeRoot = await getScopeRoot(article.scope);

      let content: string;
      if (args.format === "html") {
        content = await exportAsHtml(article, scopeRoot);
      } else {
        content = await exportAsMarkdown(article, scopeRoot);
      }

      if (args.output) {
        await storage.writeFile(args.output, content);
        console.log(`Exported to ${args.output}`);
      } else {
        process.stdout.write(content);
      }
    } catch (err) {
      handleError(err, false);
    }
  },
});
