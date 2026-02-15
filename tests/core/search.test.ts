import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { tokenize, buildSearchIndex, search } from "../../src/core/search.ts";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import { upsertInIndex } from "../../src/core/index-manager.ts";
import { serializeFrontmatter } from "../../src/core/frontmatter.ts";
import { LocalStorage } from "../../src/storage/local.ts";
import type { ArticleMeta } from "../../src/types/article.ts";

const storage = new LocalStorage();

describe("search", () => {
  describe("tokenize", () => {
    test("tokenizes English text", () => {
      const tokens = tokenize("Hello World TypeScript");
      expect(tokens).toEqual(["hello", "world", "typescript"]);
    });

    test("tokenizes Japanese text with BudouX", () => {
      const tokens = tokenize("TypeScriptの便利なテクニック");
      expect(tokens.length).toBeGreaterThan(1);
      // Should contain some Japanese segments
      expect(tokens.some((t) => /[ぁ-んァ-ヶ]/.test(t))).toBe(true);
    });

    test("handles mixed Japanese and English", () => {
      const tokens = tokenize("ReactとTypeScriptで開発する");
      expect(tokens.length).toBeGreaterThan(1);
    });

    test("lowercases tokens", () => {
      const tokens = tokenize("TypeScript REACT");
      expect(tokens).toContain("typescript");
      expect(tokens).toContain("react");
    });

    test("handles empty string", () => {
      const tokens = tokenize("");
      expect(tokens).toEqual([]);
    });
  });

  describe("search integration", () => {
    let tmpDir: string;
    let scopeRoot: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), "kami-search-test-"));
      scopeRoot = await initLocalScope(tmpDir);
      const paths = getScopePaths(scopeRoot);

      // Create test articles
      const articles: Array<{
        slug: string;
        title: string;
        tags: string[];
        body: string;
        folder: string;
      }> = [
        {
          slug: "typescript-tips",
          title: "TypeScriptの便利なテクニック",
          tags: ["typescript", "tips"],
          body: "# TypeScriptの便利なテクニック\n\nGenericsを使った型安全なコードの書き方",
          folder: "notes",
        },
        {
          slug: "react-hooks",
          title: "React Hooks入門",
          tags: ["react", "hooks"],
          body: "# React Hooks入門\n\nuseStateとuseEffectの基本的な使い方",
          folder: "notes",
        },
        {
          slug: "daily-2026-02-15",
          title: "2026-02-15",
          tags: ["daily"],
          body: "# 2026-02-15\n\n## Log\n\n- TypeScriptのジェネリクスを調査した",
          folder: "daily",
        },
      ];

      for (const a of articles) {
        const dir = a.folder
          ? join(paths.vault, a.folder)
          : paths.vault;
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
      }
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    test("finds articles by English keyword", async () => {
      const { results, total } = await search("TypeScript", {
        scopes: [{ scope: "local", root: scopeRoot }],
      });
      expect(total).toBeGreaterThanOrEqual(1);
      // TypeScript appears in multiple articles
      expect(results.some((r) => r.slug === "typescript-tips")).toBe(true);
    });

    test("finds articles by Japanese keyword", async () => {
      const { results } = await search("テクニック", {
        scopes: [{ scope: "local", root: scopeRoot }],
      });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.slug).toBe("typescript-tips");
    });

    test("finds articles by tag content", async () => {
      const { results } = await search("hooks", {
        scopes: [{ scope: "local", root: scopeRoot }],
      });
      expect(results.some((r) => r.slug === "react-hooks")).toBe(true);
    });

    test("filters by tag", async () => {
      const { results } = await search("TypeScript", {
        scopes: [{ scope: "local", root: scopeRoot }],
        tags: ["daily"],
      });
      // Only the daily entry mentions TypeScript and has the "daily" tag
      for (const r of results) {
        expect(r.tags).toContain("daily");
      }
    });

    test("filters by folder", async () => {
      const { results } = await search("TypeScript", {
        scopes: [{ scope: "local", root: scopeRoot }],
        folder: "notes",
      });
      for (const r of results) {
        expect(r.folder).toBe("notes");
      }
    });

    test("returns empty for non-matching query", async () => {
      const { results, total } = await search("xyznonexistent", {
        scopes: [{ scope: "local", root: scopeRoot }],
      });
      expect(total).toBe(0);
      expect(results).toHaveLength(0);
    });

    test("results include scope", async () => {
      const { results } = await search("React", {
        scopes: [{ scope: "local", root: scopeRoot }],
      });
      for (const r of results) {
        expect(r.scope).toBe("local");
      }
    });

    test("respects limit", async () => {
      const { results } = await search("TypeScript", {
        scopes: [{ scope: "local", root: scopeRoot }],
        limit: 1,
      });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    test("results sorted by score descending", async () => {
      const { results } = await search("TypeScript", {
        scopes: [{ scope: "local", root: scopeRoot }],
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
      }
    });
  });
});
