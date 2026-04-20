import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createArticle,
  readArticle,
  updateArticle,
} from "../../src/core/article.ts";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import { LocalStorage } from "../../src/storage/local.ts";

const storage = new LocalStorage();

async function indexAfterCreate(slug: string, cwd: string, meta: unknown) {
  const root = join(cwd, ".kami");
  const paths = getScopePaths(root);
  const index = JSON.parse(await storage.readFile(paths.indexFile));
  index.articles[slug] = meta;
  await storage.writeFile(paths.indexFile, JSON.stringify(index, null, 2));
}

describe("KAMI_AGENT provenance", () => {
  let cwd: string;
  let original: string | undefined;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-prov-"));
    await initLocalScope(cwd);
    original = process.env.KAMI_AGENT;
  });

  afterEach(async () => {
    if (original === undefined) delete process.env.KAMI_AGENT;
    else process.env.KAMI_AGENT = original;
    await rm(cwd, { recursive: true, force: true });
  });

  test("create stamps created_by when KAMI_AGENT is set", async () => {
    process.env.KAMI_AGENT = "claude-code";
    const created = await createArticle("p1", { scope: "local" }, cwd);
    await indexAfterCreate(created.meta.slug, cwd, created.meta);
    const a = await readArticle(created.meta.slug, "local", cwd);
    expect(a.frontmatter.created_by).toBe("claude-code");
  });

  test("update stamps updated_by", async () => {
    process.env.KAMI_AGENT = "claude-code";
    const created = await createArticle("p2", { scope: "local" }, cwd);
    await indexAfterCreate(created.meta.slug, cwd, created.meta);

    process.env.KAMI_AGENT = "codex";
    const updated = await updateArticle(
      created.meta.slug,
      { append: "x", scope: "local" },
      cwd,
    );
    expect(updated.frontmatter.updated_by).toBe("codex");
    // created_by must be preserved across updates
    expect(updated.frontmatter.created_by).toBe("claude-code");
  });

  test("create without KAMI_AGENT leaves no provenance keys", async () => {
    delete process.env.KAMI_AGENT;
    const created = await createArticle("p3", { scope: "local" }, cwd);
    await indexAfterCreate(created.meta.slug, cwd, created.meta);
    const a = await readArticle(created.meta.slug, "local", cwd);
    expect(a.frontmatter.created_by).toBeUndefined();
    expect(a.frontmatter.updated_by).toBeUndefined();
  });
});
