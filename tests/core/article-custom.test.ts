import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createArticle,
  readArticle,
  updateArticle,
} from "../../src/core/article.ts";
import {
  initLocalScope,
  getScopePaths,
} from "../../src/core/scope.ts";
import { LocalStorage } from "../../src/storage/local.ts";

const storage = new LocalStorage();

async function createAndIndex(
  title: string,
  cwd: string,
  opts: Parameters<typeof createArticle>[1] = {},
) {
  const created = await createArticle(title, { scope: "local", ...opts }, cwd);
  const root = join(cwd, ".kami");
  const paths = getScopePaths(root);
  const index = JSON.parse(await storage.readFile(paths.indexFile));
  index.articles[created.meta.slug] = created.meta;
  await storage.writeFile(paths.indexFile, JSON.stringify(index, null, 2));
  return created;
}

describe("article custom frontmatter passthrough", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-fm-cwd-"));
    await initLocalScope(cwd);
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  test("create with body containing frontmatter merges custom keys", async () => {
    const body = `---
title: ignored-via-cli-positional
status: in-progress
priority: high
---

actual body
`;
    const created = await createAndIndex("doc", cwd, { body });
    const article = await readArticle(created.meta.slug, "local", cwd);
    expect(article.frontmatter.title).toBe("doc");
    expect(article.frontmatter.status).toBe("in-progress");
    expect(article.frontmatter.priority).toBe("high");
    expect(article.body).toBe("actual body");
  });

  test("update preserves custom keys from existing file", async () => {
    const created = await createAndIndex("keep-custom", cwd, {
      body: `---
status: planning
owner: alice
---

initial body
`,
    });
    const updated = await updateArticle(
      created.meta.slug,
      { append: "more", scope: "local" },
      cwd,
    );
    expect(updated.frontmatter.status).toBe("planning");
    expect(updated.frontmatter.owner).toBe("alice");
    expect(updated.body).toContain("initial body");
    expect(updated.body).toContain("more");
  });

  test("loose-frontmatter without title still merges custom keys", async () => {
    const created = await createAndIndex("no-title-fm", cwd, {
      body: `---
status: draft
---
just body
`,
    });
    const article = await readArticle(created.meta.slug, "local", cwd);
    expect(article.frontmatter.title).toBe("no-title-fm");
    expect(article.frontmatter.status).toBe("draft");
    expect(article.body).toBe("just body");
  });
});
