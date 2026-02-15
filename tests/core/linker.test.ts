import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseWikiLinks,
  updateLinks,
  removeLinks,
  getForwardLinks,
  getBacklinks,
  loadLinkGraph,
  checkCrossScopeWarnings,
} from "../../src/core/linker.ts";
import { initLocalScope } from "../../src/core/scope.ts";

describe("linker", () => {
  let tmpDir: string;
  let scopeRoot: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-linker-test-"));
    scopeRoot = await initLocalScope(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("parseWikiLinks", () => {
    test("parses simple wiki link", () => {
      const links = parseWikiLinks("See [[typescript-tips]] for details.");
      expect(links).toHaveLength(1);
      expect(links[0]!.slug).toBe("typescript-tips");
      expect(links[0]!.scope).toBeNull();
      expect(links[0]!.displayText).toBeNull();
    });

    test("parses link with display text", () => {
      const links = parseWikiLinks("See [[typescript-tips|TSのコツ]].");
      expect(links).toHaveLength(1);
      expect(links[0]!.slug).toBe("typescript-tips");
      expect(links[0]!.displayText).toBe("TSのコツ");
    });

    test("parses link with scope prefix", () => {
      const links = parseWikiLinks("See [[global:typescript-tips]].");
      expect(links).toHaveLength(1);
      expect(links[0]!.slug).toBe("typescript-tips");
      expect(links[0]!.scope).toBe("global");
    });

    test("parses link with scope and display text", () => {
      const links = parseWikiLinks(
        "See [[global:typescript-tips|TSのコツ]].",
      );
      expect(links).toHaveLength(1);
      expect(links[0]!.slug).toBe("typescript-tips");
      expect(links[0]!.scope).toBe("global");
      expect(links[0]!.displayText).toBe("TSのコツ");
    });

    test("parses multiple links", () => {
      const body = `
# Notes
See [[article-a]] and [[global:article-b|B記事]].
Also check [[local:article-c]].
      `;
      const links = parseWikiLinks(body);
      expect(links).toHaveLength(3);
      expect(links[0]!.slug).toBe("article-a");
      expect(links[1]!.slug).toBe("article-b");
      expect(links[1]!.scope).toBe("global");
      expect(links[2]!.slug).toBe("article-c");
      expect(links[2]!.scope).toBe("local");
    });

    test("returns empty for no links", () => {
      const links = parseWikiLinks("No links here.");
      expect(links).toHaveLength(0);
    });

    test("parses Japanese slug", () => {
      const links = parseWikiLinks("参照: [[TypeScriptのコツ]]");
      expect(links).toHaveLength(1);
      expect(links[0]!.slug).toBe("TypeScriptのコツ");
    });
  });

  describe("updateLinks / getForwardLinks / getBacklinks", () => {
    test("stores forward links", async () => {
      const parsed = parseWikiLinks("See [[target-a]] and [[target-b]].");
      await updateLinks(scopeRoot, "source", parsed, "local");

      const forward = await getForwardLinks(scopeRoot, "source");
      expect(forward).toHaveLength(2);
      expect(forward.map((f) => f.slug).sort()).toEqual([
        "target-a",
        "target-b",
      ]);
    });

    test("creates backlinks", async () => {
      const parsed = parseWikiLinks("See [[target]].");
      await updateLinks(scopeRoot, "source-1", parsed, "local");
      await updateLinks(scopeRoot, "source-2", parsed, "local");

      const backlinks = await getBacklinks(scopeRoot, "target");
      expect(backlinks).toHaveLength(2);
      expect(backlinks.map((b) => b.slug).sort()).toEqual([
        "source-1",
        "source-2",
      ]);
    });

    test("updates forward links on re-save", async () => {
      // First save: links to A and B
      await updateLinks(
        scopeRoot,
        "source",
        parseWikiLinks("[[a]] [[b]]"),
        "local",
      );
      expect(await getForwardLinks(scopeRoot, "source")).toHaveLength(2);
      expect(await getBacklinks(scopeRoot, "a")).toHaveLength(1);
      expect(await getBacklinks(scopeRoot, "b")).toHaveLength(1);

      // Second save: links to B and C (removed A, added C)
      await updateLinks(
        scopeRoot,
        "source",
        parseWikiLinks("[[b]] [[c]]"),
        "local",
      );
      expect(await getForwardLinks(scopeRoot, "source")).toHaveLength(2);
      expect(await getBacklinks(scopeRoot, "a")).toHaveLength(0);
      expect(await getBacklinks(scopeRoot, "b")).toHaveLength(1);
      expect(await getBacklinks(scopeRoot, "c")).toHaveLength(1);
    });

    test("no duplicate backlinks on repeated update", async () => {
      const parsed = parseWikiLinks("[[target]]");
      await updateLinks(scopeRoot, "source", parsed, "local");
      await updateLinks(scopeRoot, "source", parsed, "local");

      const backlinks = await getBacklinks(scopeRoot, "target");
      expect(backlinks).toHaveLength(1);
    });
  });

  describe("removeLinks", () => {
    test("removes forward links and backlinks for deleted article", async () => {
      await updateLinks(
        scopeRoot,
        "source",
        parseWikiLinks("[[target]]"),
        "local",
      );
      await updateLinks(
        scopeRoot,
        "other",
        parseWikiLinks("[[source]]"),
        "local",
      );

      // Before removal
      expect(await getForwardLinks(scopeRoot, "source")).toHaveLength(1);
      expect(await getBacklinks(scopeRoot, "target")).toHaveLength(1);
      expect(await getBacklinks(scopeRoot, "source")).toHaveLength(1);

      await removeLinks(scopeRoot, "source", "local");

      // After removal: forward gone, backlinks from source gone, backlinks to source gone
      expect(await getForwardLinks(scopeRoot, "source")).toHaveLength(0);
      expect(await getBacklinks(scopeRoot, "target")).toHaveLength(0);
      expect(await getBacklinks(scopeRoot, "source")).toHaveLength(0);
    });
  });

  describe("checkCrossScopeWarnings", () => {
    test("warns when global links to local", () => {
      const parsed = parseWikiLinks("[[local:some-article]]");
      const warnings = checkCrossScopeWarnings(parsed, "global");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("global article links to local");
    });

    test("no warning for local linking to global", () => {
      const parsed = parseWikiLinks("[[global:some-article]]");
      const warnings = checkCrossScopeWarnings(parsed, "local");
      expect(warnings).toHaveLength(0);
    });

    test("no warning for same-scope links", () => {
      const parsed = parseWikiLinks("[[some-article]]");
      const warnings = checkCrossScopeWarnings(parsed, "local");
      expect(warnings).toHaveLength(0);
    });
  });
});
