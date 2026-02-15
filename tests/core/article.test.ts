import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createArticle,
  readArticle,
  updateArticle,
  deleteArticle,
  titleToSlug,
} from "../../src/core/article.ts";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import { LocalStorage } from "../../src/storage/local.ts";

const storage = new LocalStorage();

describe("article", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-article-test-"));
    await initLocalScope(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("titleToSlug", () => {
    test("preserves simple title", () => {
      expect(titleToSlug("hello-world")).toBe("hello-world");
    });

    test("replaces invalid characters", () => {
      expect(titleToSlug('a/b\\c:d*e?"f<g>h|i')).toBe("a-b-c-d-e--f-g-h-i");
    });

    test("trims whitespace", () => {
      expect(titleToSlug("  hello  ")).toBe("hello");
    });

    test("preserves Japanese characters", () => {
      expect(titleToSlug("TypeScriptのコツ")).toBe("TypeScriptのコツ");
    });
  });

  describe("createArticle", () => {
    test("creates article with default options", async () => {
      const result = await createArticle(
        "Test Article",
        { scope: "local" },
        tmpDir,
      );
      expect(result.meta.title).toBe("Test Article");
      expect(result.meta.slug).toBe("Test Article");
      expect(result.scope).toBe("local");
      expect(await storage.exists(result.meta.filePath)).toBe(true);
    });

    test("creates article in specified folder", async () => {
      const result = await createArticle(
        "Design Doc",
        { folder: "design", scope: "local" },
        tmpDir,
      );
      expect(result.meta.folder).toBe("design");
      expect(result.meta.filePath).toContain("/design/");
    });

    test("creates article with tags", async () => {
      const result = await createArticle(
        "Tagged",
        { tags: ["a", "b"], scope: "local" },
        tmpDir,
      );
      expect(result.meta.tags).toEqual(["a", "b"]);
    });

    test("creates article with custom body", async () => {
      const result = await createArticle(
        "With Body",
        { body: "Custom content here", scope: "local" },
        tmpDir,
      );
      expect(result.body).toBe("Custom content here");
    });

    test("handles duplicate slugs by numbering", async () => {
      await createArticle("Dup", { scope: "local" }, tmpDir);
      const second = await createArticle("Dup", { scope: "local" }, tmpDir);
      expect(second.meta.slug).toBe("Dup-1");
    });

    test("creates draft article", async () => {
      const result = await createArticle(
        "Draft",
        { draft: true, scope: "local" },
        tmpDir,
      );
      expect(result.meta.draft).toBe(true);
    });
  });

  describe("readArticle (after index update)", () => {
    test("reads created article by slug", async () => {
      const created = await createArticle(
        "Readable",
        { tags: ["test"], scope: "local" },
        tmpDir,
      );

      // Manually update index so resolveSlug can find it
      const root = join(tmpDir, ".kami");
      const paths = getScopePaths(root);
      const index = JSON.parse(await storage.readFile(paths.indexFile));
      index.articles[created.meta.slug] = created.meta;
      await storage.writeFile(paths.indexFile, JSON.stringify(index, null, 2));

      const article = await readArticle("Readable", "local", tmpDir);
      expect(article.meta.title).toBe("Readable");
      expect(article.meta.tags).toEqual(["test"]);
      expect(article.scope).toBe("local");
    });

    test("throws on non-existent article", async () => {
      expect(readArticle("nonexistent", "local", tmpDir)).rejects.toThrow(
        "not found",
      );
    });
  });

  describe("updateArticle", () => {
    async function createAndIndex(title: string, opts = {}) {
      const created = await createArticle(
        title,
        { scope: "local", ...opts },
        tmpDir,
      );
      const root = join(tmpDir, ".kami");
      const paths = getScopePaths(root);
      const index = JSON.parse(await storage.readFile(paths.indexFile));
      index.articles[created.meta.slug] = created.meta;
      await storage.writeFile(paths.indexFile, JSON.stringify(index, null, 2));
      return created;
    }

    test("updates title", async () => {
      await createAndIndex("Original");
      const updated = await updateArticle(
        "Original",
        { title: "New Title", scope: "local" },
        tmpDir,
      );
      expect(updated.meta.title).toBe("New Title");
    });

    test("adds tags", async () => {
      await createAndIndex("Tag Test", { tags: ["a"] });
      const updated = await updateArticle(
        "Tag Test",
        { addTags: ["b", "c"], scope: "local" },
        tmpDir,
      );
      expect(updated.meta.tags).toEqual(["a", "b", "c"]);
    });

    test("removes tags", async () => {
      await createAndIndex("Tag Remove", { tags: ["a", "b", "c"] });
      const updated = await updateArticle(
        "Tag Remove",
        { removeTags: ["b"], scope: "local" },
        tmpDir,
      );
      expect(updated.meta.tags).toEqual(["a", "c"]);
    });

    test("replaces body", async () => {
      await createAndIndex("Body Replace");
      const updated = await updateArticle(
        "Body Replace",
        { body: "New body content", scope: "local" },
        tmpDir,
      );
      expect(updated.body).toBe("New body content");
    });

    test("appends to body", async () => {
      const created = await createAndIndex("Append Test");
      const updated = await updateArticle(
        "Append Test",
        { append: "Appended text", scope: "local" },
        tmpDir,
      );
      expect(updated.body).toContain("Appended text");
      expect(updated.body).toContain("# Append Test");
    });

    test("throws on body + append", async () => {
      await createAndIndex("Both");
      expect(
        updateArticle(
          "Both",
          { body: "a", append: "b", scope: "local" },
          tmpDir,
        ),
      ).rejects.toThrow("Cannot specify both");
    });

    test("updates timestamp", async () => {
      const created = await createAndIndex("Timestamp");
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));
      const updated = await updateArticle(
        "Timestamp",
        { title: "Timestamp Updated", scope: "local" },
        tmpDir,
      );
      expect(updated.meta.updated).not.toBe(created.meta.updated);
    });
  });

  describe("deleteArticle", () => {
    test("deletes an existing article", async () => {
      const created = await createArticle(
        "ToDelete",
        { scope: "local" },
        tmpDir,
      );
      // Index the article
      const root = join(tmpDir, ".kami");
      const paths = getScopePaths(root);
      const index = JSON.parse(await storage.readFile(paths.indexFile));
      index.articles[created.meta.slug] = created.meta;
      await storage.writeFile(paths.indexFile, JSON.stringify(index, null, 2));

      await deleteArticle("ToDelete", "local", tmpDir);
      expect(await storage.exists(created.meta.filePath)).toBe(false);
    });
  });
});
