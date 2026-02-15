import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveWikiLinks,
  exportAsMarkdown,
  exportAsHtml,
} from "../../src/core/exporter.ts";
import { createArticle } from "../../src/core/article.ts";
import { initLocalScope, getScopeRoot } from "../../src/core/scope.ts";
import { upsertInIndex, loadIndex } from "../../src/core/index-manager.ts";
import { updateLinks, parseWikiLinks } from "../../src/core/linker.ts";
import { readArticle } from "../../src/core/article.ts";
import type { MetadataIndex } from "../../src/types/index.ts";

describe("exporter", () => {
  let tmpDir: string;
  let scopeRoot: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-export-test-"));
    scopeRoot = await initLocalScope(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("resolveWikiLinks", () => {
    test("resolves wiki link to markdown link using title from index", () => {
      const index: MetadataIndex = {
        articles: {
          "react-hooks": {
            slug: "react-hooks",
            title: "React Hooks入門",
            folder: "notes",
            tags: ["react"],
            created: "2026-02-15T10:00:00Z",
            updated: "2026-02-15T10:00:00Z",
            filePath: "/vault/notes/react-hooks.md",
          },
        },
      };
      const body = "See [[react-hooks]] for details.";
      const result = resolveWikiLinks(body, index);
      expect(result).toBe("See [React Hooks入門](react-hooks.md) for details.");
    });

    test("resolves wiki link with display text", () => {
      const index: MetadataIndex = {
        articles: {
          "react-hooks": {
            slug: "react-hooks",
            title: "React Hooks入門",
            folder: "notes",
            tags: [],
            created: "2026-02-15T10:00:00Z",
            updated: "2026-02-15T10:00:00Z",
            filePath: "/vault/notes/react-hooks.md",
          },
        },
      };
      const body = "See [[react-hooks|React guide]] for details.";
      const result = resolveWikiLinks(body, index);
      expect(result).toBe("See [React guide](react-hooks.md) for details.");
    });

    test("resolves scoped wiki link", () => {
      const index: MetadataIndex = {
        articles: {
          "global-article": {
            slug: "global-article",
            title: "Global Article",
            folder: "",
            tags: [],
            created: "2026-02-15T10:00:00Z",
            updated: "2026-02-15T10:00:00Z",
            filePath: "/vault/global-article.md",
          },
        },
      };
      const body = "Link to [[global:global-article]].";
      const result = resolveWikiLinks(body, index);
      expect(result).toBe("Link to [Global Article](global-article.md).");
    });

    test("handles dangling links (not in index)", () => {
      const index: MetadataIndex = { articles: {} };
      const body = "See [[nonexistent]] for details.";
      const result = resolveWikiLinks(body, index);
      expect(result).toBe("See nonexistent for details.");
    });

    test("handles dangling links with display text", () => {
      const index: MetadataIndex = { articles: {} };
      const body = "See [[nonexistent|some text]] for details.";
      const result = resolveWikiLinks(body, index);
      expect(result).toBe("See some text for details.");
    });

    test("resolves multiple wiki links", () => {
      const index: MetadataIndex = {
        articles: {
          "article-a": {
            slug: "article-a",
            title: "Article A",
            folder: "",
            tags: [],
            created: "2026-02-15T10:00:00Z",
            updated: "2026-02-15T10:00:00Z",
            filePath: "/vault/article-a.md",
          },
          "article-b": {
            slug: "article-b",
            title: "Article B",
            folder: "",
            tags: [],
            created: "2026-02-15T10:00:00Z",
            updated: "2026-02-15T10:00:00Z",
            filePath: "/vault/article-b.md",
          },
        },
      };
      const body = "See [[article-a]] and [[article-b]].";
      const result = resolveWikiLinks(body, index);
      expect(result).toBe(
        "See [Article A](article-a.md) and [Article B](article-b.md).",
      );
    });

    test("handles body with no wiki links", () => {
      const index: MetadataIndex = { articles: {} };
      const body = "Just plain text with no links.";
      const result = resolveWikiLinks(body, index);
      expect(result).toBe("Just plain text with no links.");
    });
  });

  describe("exportAsMarkdown", () => {
    test("resolves wiki links in article body", async () => {
      // Create two articles with cross-references using explicit slugs
      const resultA = await createArticle("Article A", {
        scope: "local",
        slug: "article-a",
        body: "Content of A. See [[article-b]].",
      }, tmpDir);
      await upsertInIndex(scopeRoot, resultA.meta);

      const resultB = await createArticle("Article B", {
        scope: "local",
        slug: "article-b",
        body: "Content of B.",
      }, tmpDir);
      await upsertInIndex(scopeRoot, resultB.meta);

      const article = await readArticle("article-a", undefined, tmpDir);
      const exported = await exportAsMarkdown(article, scopeRoot);

      expect(exported).toContain("[Article B](article-b.md)");
      expect(exported).not.toContain("[[article-b]]");
    });
  });

  describe("exportAsHtml", () => {
    test("produces valid HTML output", async () => {
      const result = await createArticle("HTML Test", {
        scope: "local",
        slug: "html-test",
        body: "# Hello\n\nThis is **bold** text.",
      }, tmpDir);
      await upsertInIndex(scopeRoot, result.meta);

      const article = await readArticle("html-test", undefined, tmpDir);
      const html = await exportAsHtml(article, scopeRoot);

      expect(html).toContain("<h1>Hello</h1>");
      expect(html).toContain("<strong>bold</strong>");
    });

    test("resolves wiki links before converting to HTML", async () => {
      const resultA = await createArticle("Link Source", {
        scope: "local",
        slug: "link-source",
        body: "See [[link-target]] for more.",
      }, tmpDir);
      await upsertInIndex(scopeRoot, resultA.meta);

      const resultB = await createArticle("Link Target", {
        scope: "local",
        slug: "link-target",
      }, tmpDir);
      await upsertInIndex(scopeRoot, resultB.meta);

      const article = await readArticle("link-source", undefined, tmpDir);
      const html = await exportAsHtml(article, scopeRoot);

      expect(html).toContain("link-target.md");
      expect(html).toContain("Link Target");
      expect(html).not.toContain("[[link-target]]");
    });
  });
});
