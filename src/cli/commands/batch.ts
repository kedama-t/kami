import { defineCommand } from "citty";
import { readFile } from "node:fs/promises";
import {
  createArticle,
  readArticle,
  updateArticle,
  deleteArticle,
  resolveSlug,
} from "../../core/article.ts";
import {
  upsertInIndex,
  removeFromIndex,
} from "../../core/index-manager.ts";
import { getScopeRoot } from "../../core/scope.ts";
import type { Scope } from "../../types/scope.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";
import { handleError } from "../helpers/output.ts";
import { runPreHook, runPostHook } from "../helpers/hooks.ts";

interface BatchLine {
  cmd: string;
  args: Record<string, unknown>;
}

interface BatchResult {
  line: number;
  ok: boolean;
  data: unknown;
  error: { code: string; message: string; candidates?: string[] } | null;
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Bun.stdin.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function dispatch(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  switch (cmd) {
    case "create": {
      const title = args.title as string;
      if (!title) throw new KamiError("create requires 'title'", "VALIDATION_ERROR", EXIT_CODES.GENERAL_ERROR);
      const result = await createArticle(title, {
        folder: args.folder as string | undefined,
        tags: args.tags as string[] | undefined,
        template: args.template as string | undefined,
        scope: args.scope as Scope | undefined,
        slug: args.slug as string | undefined,
        body: args.body as string | undefined,
        draft: args.draft as boolean | undefined,
      });
      const root = await getScopeRoot(result.scope);
      await upsertInIndex(root, result.meta);
      await runPostHook("article:post-create", result.scope, result.meta);
      return {
        slug: result.meta.slug,
        title: result.meta.title,
        scope: result.scope,
        folder: result.meta.folder,
        file_path: result.meta.filePath,
      };
    }
    case "read": {
      const slug = args.slug as string;
      if (!slug) throw new KamiError("read requires 'slug'", "VALIDATION_ERROR", EXIT_CODES.GENERAL_ERROR);
      const article = await readArticle(slug, args.scope as Scope | undefined);
      return {
        slug: article.meta.slug,
        title: article.meta.title,
        scope: article.scope,
        folder: article.meta.folder,
        file_path: article.meta.filePath,
        frontmatter: article.meta,
        body: article.body,
      };
    }
    case "edit": {
      const slug = args.slug as string;
      if (!slug) throw new KamiError("edit requires 'slug'", "VALIDATION_ERROR", EXIT_CODES.GENERAL_ERROR);
      const resolved = await resolveSlug(slug, args.scope as Scope | undefined);
      await runPreHook("article:pre-update", resolved.scope, resolved.meta);
      const result = await updateArticle(slug, {
        title: args.title as string | undefined,
        addTags: args.addTags as string[] | undefined,
        removeTags: args.removeTags as string[] | undefined,
        body: args.body as string | undefined,
        append: args.append as string | undefined,
        draft: args.draft as boolean | undefined,
        addAlias: args.addAlias as string | undefined,
        removeAlias: args.removeAlias as string | undefined,
        scope: args.scope as Scope | undefined,
      });
      const root = await getScopeRoot(result.scope);
      await upsertInIndex(root, result.meta);
      await runPostHook("article:post-update", result.scope, result.meta);
      return {
        slug: result.meta.slug,
        title: result.meta.title,
        scope: result.scope,
        file_path: result.meta.filePath,
        updated: result.meta.updated,
      };
    }
    case "delete": {
      const slug = args.slug as string;
      if (!slug) throw new KamiError("delete requires 'slug'", "VALIDATION_ERROR", EXIT_CODES.GENERAL_ERROR);
      const resolved = await resolveSlug(slug, args.scope as Scope | undefined);
      await runPreHook("article:pre-delete", resolved.scope, resolved.meta);
      const { meta, scope } = await deleteArticle(slug, args.scope as Scope | undefined);
      const root = await getScopeRoot(scope);
      await removeFromIndex(root, meta.slug);
      await runPostHook("article:post-delete", scope, meta);
      return {
        slug: meta.slug,
        title: meta.title,
        scope,
        file_path: meta.filePath,
      };
    }
    default:
      throw new KamiError(
        `Unknown batch command: ${cmd}`,
        "VALIDATION_ERROR",
        EXIT_CODES.GENERAL_ERROR,
      );
  }
}

export default defineCommand({
  meta: {
    name: "batch",
    description: "Execute multiple commands from JSON Lines (NDJSON) input",
  },
  args: {
    input: {
      type: "positional",
      description: "Input file path or '-' for stdin",
      default: "-",
      required: false,
    },
    "stop-on-error": {
      type: "boolean",
      default: false,
      description: "Stop on first error instead of continuing",
    },
  },
  async run({ args }) {
    try {
      const raw = args.input === "-" ? await readStdin() : await readFile(args.input, "utf-8");
      const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

      let hadError = false;
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        let result: BatchResult;
        try {
          const parsed = JSON.parse(lines[i]!) as BatchLine;
          if (typeof parsed.cmd !== "string") {
            throw new KamiError("Each line must have 'cmd' string", "VALIDATION_ERROR", EXIT_CODES.GENERAL_ERROR);
          }
          const data = await dispatch(parsed.cmd, parsed.args ?? {});
          result = { line: lineNum, ok: true, data, error: null };
        } catch (err) {
          hadError = true;
          if (err instanceof KamiError) {
            result = {
              line: lineNum,
              ok: false,
              data: null,
              error: { code: err.code, message: err.message, candidates: err.candidates },
            };
          } else {
            const message = err instanceof Error ? err.message : String(err);
            result = {
              line: lineNum,
              ok: false,
              data: null,
              error: { code: "IO_ERROR", message },
            };
          }
        }
        console.log(JSON.stringify(result));
        if (!result.ok && args["stop-on-error"]) break;
      }

      if (hadError) process.exit(EXIT_CODES.GENERAL_ERROR);
    } catch (err) {
      handleError(err, true);
    }
  },
});
