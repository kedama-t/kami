import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import { serializeFrontmatter } from "../../src/core/frontmatter.ts";
import { upsertInIndex } from "../../src/core/index-manager.ts";
import { updateLinks, parseWikiLinks } from "../../src/core/linker.ts";
import { LocalStorage } from "../../src/storage/local.ts";
import type { ArticleMeta } from "../../src/types/article.ts";

const CLI = join(import.meta.dir, "..", "..", "src", "cli", "index.ts");
const storage = new LocalStorage();

async function run(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

describe("CLI search, links, backlinks", () => {
  let tmpDir: string;
  let scopeRoot: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-search-cli-test-"));
    scopeRoot = await initLocalScope(tmpDir);
    const paths = getScopePaths(scopeRoot);

    // Create articles with wiki links
    const articles = [
      {
        slug: "typescript-tips",
        title: "TypeScriptの便利なテクニック",
        tags: ["typescript", "tips"],
        body: "# TypeScriptの便利なテクニック\n\n[[react-hooks]]を使ったパターン。\n\n[[nonexistent]]もある。",
        folder: "notes",
      },
      {
        slug: "react-hooks",
        title: "React Hooks入門",
        tags: ["react", "hooks"],
        body: "# React Hooks入門\n\nuseStateの使い方。[[typescript-tips]]も参照。",
        folder: "notes",
      },
      {
        slug: "daily-log",
        title: "2026-02-15",
        tags: ["daily"],
        body: "# 2026-02-15\n\n- TypeScriptのジェネリクス調査",
        folder: "daily",
      },
    ];

    for (const a of articles) {
      const dir = join(paths.vault, a.folder);
      await storage.mkdir(dir);
      const filePath = join(dir, `${a.slug}.md`);
      const content = serializeFrontmatter(
        {
          title: a.title,
          tags: a.tags,
          created: "2026-02-15T10:00:00Z",
          updated: "2026-02-15T10:00:00Z",
        },
        a.body,
      );
      await storage.writeFile(filePath, content);

      const meta: ArticleMeta = {
        slug: a.slug,
        title: a.title,
        folder: a.folder,
        tags: a.tags,
        created: "2026-02-15T10:00:00Z",
        updated: "2026-02-15T10:00:00Z",
        filePath,
      };
      await upsertInIndex(scopeRoot, meta);

      // Update link graph
      const parsedLinks = parseWikiLinks(a.body);
      await updateLinks(scopeRoot, a.slug, parsedLinks, "local");
    }
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("search", () => {
    test("finds articles by keyword", async () => {
      const { stdout, exitCode } = await run(
        ["search", "TypeScript", "--scope", "local", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.total).toBeGreaterThanOrEqual(1);
      expect(
        result.data.results.some(
          (r: { slug: string }) => r.slug === "typescript-tips",
        ),
      ).toBe(true);
    });

    test("filters by tag", async () => {
      const { stdout, exitCode } = await run(
        ["search", "TypeScript", "--tag", "daily", "--scope", "local", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      for (const r of result.data.results) {
        expect(r.tags).toContain("daily");
      }
    });

    test("filters by folder", async () => {
      const { stdout } = await run(
        [
          "search",
          "TypeScript",
          "--folder",
          "notes",
          "--scope",
          "local",
          "--json",
        ],
        tmpDir,
      );
      const result = JSON.parse(stdout);
      for (const r of result.data.results) {
        expect(r.folder).toBe("notes");
      }
    });

    test("text output works", async () => {
      const { stdout, exitCode } = await run(
        ["search", "React", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("react-hooks");
    });

    test("returns empty for non-matching query", async () => {
      const { stdout, exitCode } = await run(
        ["search", "zzzzqqqq99999", "--scope", "local", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.data.total).toBe(0);
    });
  });

  describe("links", () => {
    test("shows forward links as JSON", async () => {
      const { stdout, exitCode } = await run(
        ["links", "typescript-tips", "--scope", "local", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.links).toHaveLength(2);
      expect(
        result.data.links.some((l: { slug: string }) => l.slug === "react-hooks"),
      ).toBe(true);
      expect(
        result.data.links.some((l: { slug: string }) => l.slug === "nonexistent"),
      ).toBe(true);
    });

    test("shows forward links as text", async () => {
      const { stdout, exitCode } = await run(
        ["links", "typescript-tips", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Links from");
      expect(stdout).toContain("react-hooks");
    });

    test("shows existing and dangling links", async () => {
      const { stdout } = await run(
        ["links", "typescript-tips", "--scope", "local", "--json"],
        tmpDir,
      );
      const result = JSON.parse(stdout);
      const existing = result.data.links.find(
        (l: { slug: string }) => l.slug === "react-hooks",
      );
      const dangling = result.data.links.find(
        (l: { slug: string }) => l.slug === "nonexistent",
      );
      expect(existing.exists).toBe(true);
      expect(dangling.exists).toBe(false);
    });
  });

  describe("backlinks", () => {
    test("shows backlinks as JSON", async () => {
      const { stdout, exitCode } = await run(
        ["backlinks", "react-hooks", "--scope", "local", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.backlinks).toHaveLength(1);
      expect(result.data.backlinks[0].slug).toBe("typescript-tips");
    });

    test("shows backlinks as text", async () => {
      const { stdout, exitCode } = await run(
        ["backlinks", "react-hooks", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Backlinks to");
      expect(stdout).toContain("typescript-tips");
    });

    test("shows mutual backlinks", async () => {
      const { stdout } = await run(
        ["backlinks", "typescript-tips", "--scope", "local", "--json"],
        tmpDir,
      );
      const result = JSON.parse(stdout);
      expect(result.data.backlinks).toHaveLength(1);
      expect(result.data.backlinks[0].slug).toBe("react-hooks");
    });

    test("shows empty backlinks for unlinked article", async () => {
      const { stdout } = await run(
        ["backlinks", "daily-log", "--scope", "local", "--json"],
        tmpDir,
      );
      const result = JSON.parse(stdout);
      expect(result.data.backlinks).toHaveLength(0);
    });
  });
});
