import { describe, test, expect } from "bun:test";
import {
  parseFrontmatter,
  serializeFrontmatter,
  generateFrontmatter,
  validateFrontmatter,
} from "../../src/core/frontmatter.ts";

describe("frontmatter", () => {
  describe("parseFrontmatter", () => {
    test("parses valid frontmatter", () => {
      const content = `---
title: Test Article
tags: [typescript, tips]
created: 2026-02-15T10:30:00+09:00
updated: 2026-02-15T10:30:00+09:00
---

# Test Article

Body content here.`;

      const { frontmatter, body } = parseFrontmatter(content);
      expect(frontmatter.title).toBe("Test Article");
      expect(frontmatter.tags).toEqual(["typescript", "tips"]);
      expect(frontmatter.created).toBe("2026-02-15T10:30:00+09:00");
      expect(body).toBe("# Test Article\n\nBody content here.");
    });

    test("parses frontmatter with optional fields", () => {
      const content = `---
title: Draft
tags: []
created: 2026-02-15T10:30:00+09:00
updated: 2026-02-15T10:30:00+09:00
template: note
aliases: [draft-1]
draft: true
---

Body`;

      const { frontmatter } = parseFrontmatter(content);
      expect(frontmatter.template).toBe("note");
      expect(frontmatter.aliases).toEqual(["draft-1"]);
      expect(frontmatter.draft).toBe(true);
    });

    test("throws on missing title", () => {
      const content = `---
tags: [test]
---

Body`;
      expect(() => parseFrontmatter(content)).toThrow("title");
    });
  });

  describe("serializeFrontmatter", () => {
    test("round-trips correctly", () => {
      const original = {
        title: "Test",
        tags: ["a", "b"],
        created: "2026-02-15T10:00:00Z",
        updated: "2026-02-15T10:00:00Z",
      };
      const body = "# Test\n\nContent here.";

      const serialized = serializeFrontmatter(original, body);
      const { frontmatter, body: parsedBody } = parseFrontmatter(serialized);

      expect(frontmatter.title).toBe(original.title);
      expect(frontmatter.tags).toEqual(original.tags);
      expect(parsedBody).toBe(body);
    });

    test("includes optional fields when present", () => {
      const fm = {
        title: "Test",
        tags: [],
        created: "2026-02-15T10:00:00Z",
        updated: "2026-02-15T10:00:00Z",
        template: "note",
        aliases: ["alias1"],
        draft: true,
      };
      const serialized = serializeFrontmatter(fm, "body");
      expect(serialized).toContain("template: note");
      expect(serialized).toContain("alias1");
      expect(serialized).toContain("draft: true");
    });

    test("omits optional fields when absent", () => {
      const fm = {
        title: "Test",
        tags: [],
        created: "2026-02-15T10:00:00Z",
        updated: "2026-02-15T10:00:00Z",
      };
      const serialized = serializeFrontmatter(fm, "");
      expect(serialized).not.toContain("template");
      expect(serialized).not.toContain("aliases");
      expect(serialized).not.toContain("draft");
    });
  });

  describe("generateFrontmatter", () => {
    test("generates with defaults", () => {
      const fm = generateFrontmatter("New Article");
      expect(fm.title).toBe("New Article");
      expect(fm.tags).toEqual([]);
      expect(fm.created).toBeDefined();
      expect(fm.updated).toBeDefined();
      expect(fm.template).toBeUndefined();
      expect(fm.draft).toBeUndefined();
    });

    test("generates with options", () => {
      const fm = generateFrontmatter("Draft", {
        tags: ["test"],
        template: "note",
        draft: true,
      });
      expect(fm.tags).toEqual(["test"]);
      expect(fm.template).toBe("note");
      expect(fm.draft).toBe(true);
    });
  });

  describe("validateFrontmatter", () => {
    test("normalizes single tag string to array", () => {
      const fm = validateFrontmatter({ title: "Test", tags: "single" });
      expect(fm.tags).toEqual(["single"]);
    });

    test("defaults missing tags to empty array", () => {
      const fm = validateFrontmatter({ title: "Test" });
      expect(fm.tags).toEqual([]);
    });
  });
});
