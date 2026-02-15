import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadIndex,
  saveIndex,
  upsertInIndex,
  removeFromIndex,
  rebuildIndex,
  queryIndex,
} from "../../src/core/index-manager.ts";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import { serializeFrontmatter } from "../../src/core/frontmatter.ts";
import { LocalStorage } from "../../src/storage/local.ts";
import type { ArticleMeta } from "../../src/types/article.ts";

const storage = new LocalStorage();

function makeMeta(overrides: Partial<ArticleMeta> & { slug: string }): ArticleMeta {
  return {
    title: overrides.slug,
    folder: "",
    tags: [],
    created: "2026-02-15T10:00:00Z",
    updated: "2026-02-15T10:00:00Z",
    filePath: `/fake/${overrides.slug}.md`,
    ...overrides,
  };
}

describe("index-manager", () => {
  let tmpDir: string;
  let scopeRoot: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-index-test-"));
    scopeRoot = await initLocalScope(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("loadIndex / saveIndex", () => {
    test("loads empty index", async () => {
      const index = await loadIndex(scopeRoot);
      expect(index.articles).toEqual({});
    });

    test("round-trips index", async () => {
      const meta = makeMeta({ slug: "test" });
      await saveIndex(scopeRoot, { articles: { test: meta } });
      const loaded = await loadIndex(scopeRoot);
      expect(loaded.articles.test?.slug).toBe("test");
    });
  });

  describe("upsertInIndex / removeFromIndex", () => {
    test("adds article to index", async () => {
      const meta = makeMeta({ slug: "new-article", title: "New" });
      await upsertInIndex(scopeRoot, meta);
      const index = await loadIndex(scopeRoot);
      expect(index.articles["new-article"]?.title).toBe("New");
    });

    test("updates existing article in index", async () => {
      const meta = makeMeta({ slug: "update-me", title: "V1" });
      await upsertInIndex(scopeRoot, meta);
      const meta2 = makeMeta({ slug: "update-me", title: "V2" });
      await upsertInIndex(scopeRoot, meta2);
      const index = await loadIndex(scopeRoot);
      expect(index.articles["update-me"]?.title).toBe("V2");
    });

    test("removes article from index", async () => {
      const meta = makeMeta({ slug: "to-remove" });
      await upsertInIndex(scopeRoot, meta);
      await removeFromIndex(scopeRoot, "to-remove");
      const index = await loadIndex(scopeRoot);
      expect(index.articles["to-remove"]).toBeUndefined();
    });
  });

  describe("rebuildIndex", () => {
    test("scans vault and builds index", async () => {
      const paths = getScopePaths(scopeRoot);

      // Create some articles in vault
      await storage.mkdir(join(paths.vault, "notes"));
      await storage.writeFile(
        join(paths.vault, "notes", "article-a.md"),
        serializeFrontmatter(
          {
            title: "Article A",
            tags: ["test"],
            created: "2026-02-15T10:00:00Z",
            updated: "2026-02-15T10:00:00Z",
          },
          "# Article A\n\nBody A",
        ),
      );
      await storage.writeFile(
        join(paths.vault, "article-b.md"),
        serializeFrontmatter(
          {
            title: "Article B",
            tags: ["other"],
            created: "2026-02-14T10:00:00Z",
            updated: "2026-02-14T10:00:00Z",
          },
          "# Article B\n\nBody B",
        ),
      );

      const index = await rebuildIndex(scopeRoot);
      expect(Object.keys(index.articles)).toHaveLength(2);
      expect(index.articles["article-a"]?.title).toBe("Article A");
      expect(index.articles["article-a"]?.folder).toBe("notes");
      expect(index.articles["article-b"]?.title).toBe("Article B");
      expect(index.articles["article-b"]?.folder).toBe("");
    });
  });

  describe("queryIndex", () => {
    beforeEach(async () => {
      await upsertInIndex(
        scopeRoot,
        makeMeta({
          slug: "a",
          title: "Alpha",
          folder: "notes",
          tags: ["ts", "tips"],
          updated: "2026-02-15T10:00:00Z",
        }),
      );
      await upsertInIndex(
        scopeRoot,
        makeMeta({
          slug: "b",
          title: "Beta",
          folder: "notes",
          tags: ["ts"],
          updated: "2026-02-14T10:00:00Z",
        }),
      );
      await upsertInIndex(
        scopeRoot,
        makeMeta({
          slug: "c",
          title: "Gamma",
          folder: "daily",
          tags: ["daily"],
          updated: "2026-02-13T10:00:00Z",
          draft: true,
        }),
      );
    });

    test("returns all articles by default", async () => {
      const { articles, total } = await queryIndex(scopeRoot);
      expect(total).toBe(3);
    });

    test("filters by folder", async () => {
      const { articles } = await queryIndex(scopeRoot, { folder: "notes" });
      expect(articles).toHaveLength(2);
      expect(articles.every((a) => a.folder === "notes")).toBe(true);
    });

    test("filters by tags (AND)", async () => {
      const { articles } = await queryIndex(scopeRoot, {
        tags: ["ts", "tips"],
      });
      expect(articles).toHaveLength(1);
      expect(articles[0]!.slug).toBe("a");
    });

    test("filters by draft", async () => {
      const { articles } = await queryIndex(scopeRoot, { draft: true });
      expect(articles).toHaveLength(1);
      expect(articles[0]!.slug).toBe("c");
    });

    test("sorts by title ascending", async () => {
      const { articles } = await queryIndex(scopeRoot, {
        sort: "title",
        order: "asc",
      });
      expect(articles.map((a) => a.title)).toEqual([
        "Alpha",
        "Beta",
        "Gamma",
      ]);
    });

    test("sorts by updated descending (default)", async () => {
      const { articles } = await queryIndex(scopeRoot);
      expect(articles[0]!.slug).toBe("a"); // newest
      expect(articles[2]!.slug).toBe("c"); // oldest
    });

    test("paginates", async () => {
      const { articles } = await queryIndex(scopeRoot, {
        limit: 2,
        offset: 0,
      });
      expect(articles).toHaveLength(2);

      const page2 = await queryIndex(scopeRoot, { limit: 2, offset: 2 });
      expect(page2.articles).toHaveLength(1);
    });
  });
});
