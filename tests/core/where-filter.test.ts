import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseWhereClauses,
  filterByWhere,
  queryIndex,
  upsertInIndex,
} from "../../src/core/index-manager.ts";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import type { ArticleMeta } from "../../src/types/article.ts";

describe("parseWhereClauses", () => {
  test("parses key=value", () => {
    expect(parseWhereClauses("status=in-progress")).toEqual([
      { key: "status", op: "=", value: "in-progress" },
    ]);
  });

  test("parses key!=value", () => {
    expect(parseWhereClauses("priority!=low")).toEqual([
      { key: "priority", op: "!=", value: "low" },
    ]);
  });

  test("parses array of clauses", () => {
    expect(
      parseWhereClauses(["status=open", "priority!=low"]),
    ).toHaveLength(2);
  });

  test("trims whitespace around key/value", () => {
    expect(parseWhereClauses(" status = open ")).toEqual([
      { key: "status", op: "=", value: "open" },
    ]);
  });

  test("returns empty for undefined", () => {
    expect(parseWhereClauses(undefined)).toEqual([]);
  });

  test("throws on invalid expression", () => {
    expect(() => parseWhereClauses("nokey")).toThrow(/Invalid --where/);
  });
});

describe("filterByWhere", () => {
  const m = (over: Partial<ArticleMeta>): ArticleMeta => ({
    slug: "x",
    title: "x",
    folder: "",
    tags: [],
    created: "",
    updated: "",
    filePath: "",
    ...over,
  });

  test("matches custom field equality", () => {
    const items = [
      m({ slug: "a", custom: { status: "open" } }),
      m({ slug: "b", custom: { status: "closed" } }),
    ];
    const got = filterByWhere(items, [{ key: "status", op: "=", value: "open" }]);
    expect(got.map((g) => g.slug)).toEqual(["a"]);
  });

  test("matches built-in field (folder)", () => {
    const items = [
      m({ slug: "a", folder: "design" }),
      m({ slug: "b", folder: "notes" }),
    ];
    const got = filterByWhere(items, [{ key: "folder", op: "=", value: "design" }]);
    expect(got.map((g) => g.slug)).toEqual(["a"]);
  });

  test("!= excludes matching values", () => {
    const items = [
      m({ slug: "a", custom: { priority: "low" } }),
      m({ slug: "b", custom: { priority: "high" } }),
    ];
    const got = filterByWhere(items, [
      { key: "priority", op: "!=", value: "low" },
    ]);
    expect(got.map((g) => g.slug)).toEqual(["b"]);
  });

  test("missing custom value is treated as empty string", () => {
    const items = [m({ slug: "a", custom: undefined })];
    const eq = filterByWhere(items, [{ key: "status", op: "=", value: "" }]);
    expect(eq).toHaveLength(1);
    const ne = filterByWhere(items, [{ key: "status", op: "!=", value: "" }]);
    expect(ne).toHaveLength(0);
  });
});

describe("queryIndex --where integration", () => {
  let cwd: string;
  let root: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-where-"));
    await initLocalScope(cwd);
    root = join(cwd, ".kami");
    const base: Omit<ArticleMeta, "slug" | "title" | "custom"> = {
      folder: "",
      tags: [],
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      filePath: join(getScopePaths(root).vault, "x.md"),
    };
    await upsertInIndex(root, {
      ...base,
      slug: "alpha",
      title: "Alpha",
      custom: { status: "open", priority: "high" },
    });
    await upsertInIndex(root, {
      ...base,
      slug: "beta",
      title: "Beta",
      custom: { status: "closed", priority: "low" },
    });
    await upsertInIndex(root, {
      ...base,
      slug: "gamma",
      title: "Gamma",
      custom: { status: "open" },
    });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  test("filters by single clause", async () => {
    const { articles } = await queryIndex(root, {
      where: [{ key: "status", op: "=", value: "open" }],
    });
    expect(articles.map((a) => a.slug).sort()).toEqual(["alpha", "gamma"]);
  });

  test("filters by AND of clauses", async () => {
    const { articles } = await queryIndex(root, {
      where: [
        { key: "status", op: "=", value: "open" },
        { key: "priority", op: "=", value: "high" },
      ],
    });
    expect(articles.map((a) => a.slug)).toEqual(["alpha"]);
  });
});
