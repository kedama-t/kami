import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dir, "..", "..", "src", "cli", "index.ts");

async function run(
  args: string[],
  cwd: string,
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: stdin !== undefined ? new Blob([stdin]).stream() : undefined,
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

describe("E2E full lifecycle", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-e2e-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("complete article lifecycle via CLI", async () => {
    // 1. kami init → local scope created
    const initResult = await run(["init"], tmpDir);
    expect(initResult.exitCode).toBe(0);
    expect(initResult.stdout).toContain("Initialized");

    // 2. kami create "Article A" --folder notes --tag ts --json
    const createA = await run(
      [
        "create",
        "Article A",
        "--folder",
        "notes",
        "--tag",
        "ts",
        "--slug",
        "article-a",
        "--json",
      ],
      tmpDir,
    );
    expect(createA.exitCode).toBe(0);
    const createAData = JSON.parse(createA.stdout);
    expect(createAData.ok).toBe(true);
    expect(createAData.data.slug).toBe("article-a");
    expect(createAData.data.folder).toBe("notes");
    expect(createAData.data.tags).toContain("ts");

    // 3. kami create "Article B" --body - (piped with wiki links)
    const bodyB =
      "# Article B\n\nThis links to [[article-a]] and [[nonexistent]].";
    const createB = await run(
      ["create", "Article B", "--slug", "article-b", "--body", "-", "--json"],
      tmpDir,
      bodyB,
    );
    expect(createB.exitCode).toBe(0);
    const createBData = JSON.parse(createB.stdout);
    expect(createBData.ok).toBe(true);
    expect(createBData.data.slug).toBe("article-b");

    // 4. kami read "article-a" --json
    const readA = await run(
      ["read", "article-a", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(readA.exitCode).toBe(0);
    const readAData = JSON.parse(readA.stdout);
    expect(readAData.ok).toBe(true);
    expect(readAData.data.title).toBe("Article A");

    // 5. kami edit "article-a" --add-tag react --json
    const editA = await run(
      [
        "edit",
        "article-a",
        "--add-tag",
        "react",
        "--scope",
        "local",
        "--json",
      ],
      tmpDir,
    );
    expect(editA.exitCode).toBe(0);

    // Verify tag was added
    const readA2 = await run(
      ["read", "article-a", "--scope", "local", "--json"],
      tmpDir,
    );
    const readA2Data = JSON.parse(readA2.stdout);
    expect(readA2Data.data.frontmatter.tags).toContain("react");
    expect(readA2Data.data.frontmatter.tags).toContain("ts");

    // 6. kami search "Article" --json
    const searchResult = await run(
      ["search", "Article", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(searchResult.exitCode).toBe(0);
    const searchData = JSON.parse(searchResult.stdout);
    expect(searchData.data.total).toBeGreaterThanOrEqual(2);

    // 7. kami list --json
    const listResult = await run(
      ["list", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(listResult.exitCode).toBe(0);
    const listData = JSON.parse(listResult.stdout);
    expect(listData.data.articles.length).toBe(2);

    // 8. kami export article-b --format html
    const exportResult = await run(
      ["export", "article-b", "--format", "html", "--scope", "local"],
      tmpDir,
    );
    expect(exportResult.exitCode).toBe(0);
    expect(exportResult.stdout).toContain("<h1>");
    // Wiki link should be resolved
    expect(exportResult.stdout).toContain("article-a.md");

    // 9. kami reindex --json
    const reindexResult = await run(
      ["reindex", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(reindexResult.exitCode).toBe(0);
    const reindexData = JSON.parse(reindexResult.stdout);
    expect(reindexData.data.scopes[0].articles).toBe(2);

    // 10. kami delete "article-a" --force --json
    const deleteResult = await run(
      ["delete", "article-a", "--force", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(deleteResult.exitCode).toBe(0);
    const deleteData = JSON.parse(deleteResult.stdout);
    expect(deleteData.data.slug).toBe("article-a");

    // 11. kami list --json → now 1 article
    const listResult2 = await run(
      ["list", "--scope", "local", "--json"],
      tmpDir,
    );
    const listData2 = JSON.parse(listResult2.stdout);
    expect(listData2.data.articles.length).toBe(1);
    expect(listData2.data.articles[0].slug).toBe("article-b");
  }, 30000);

  test("template lifecycle via CLI", async () => {
    // Init
    await run(["init"], tmpDir);

    // Create custom template
    const tplContent =
      '---\ntitle: "{{title}}"\ntags: [adr]\ncreated: {{datetime}}\nupdated: {{datetime}}\ntemplate: adr\n---\n\n# {{title}}\n\n## Status\nProposed\n\n## Context\n\n## Decision\n\n## Consequences\n';
    const createTpl = await run(
      ["template", "create", "adr", "--body", "-", "--scope", "local"],
      tmpDir,
      tplContent,
    );
    expect(createTpl.exitCode).toBe(0);

    // List templates
    const listTpl = await run(
      ["template", "list", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(listTpl.exitCode).toBe(0);
    const tplData = JSON.parse(listTpl.stdout);
    expect(tplData.data.templates.some((t: { name: string }) => t.name === "adr")).toBe(
      true,
    );

    // Show template
    const showTpl = await run(
      ["template", "show", "adr", "--scope", "local"],
      tmpDir,
    );
    expect(showTpl.exitCode).toBe(0);
    expect(showTpl.stdout).toContain("## Status");
  });
});

describe("E2E edge cases", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-e2e-edge-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("--json and --quiet on create", async () => {
    await run(["init"], tmpDir);

    // --quiet should produce no output
    const quietResult = await run(
      ["create", "Quiet Test", "--slug", "quiet-test", "--quiet"],
      tmpDir,
    );
    expect(quietResult.exitCode).toBe(0);
    expect(quietResult.stdout).toBe("");

    // --json should produce JSON
    const jsonResult = await run(
      ["create", "JSON Test", "--slug", "json-test", "--json"],
      tmpDir,
    );
    expect(jsonResult.exitCode).toBe(0);
    const parsed = JSON.parse(jsonResult.stdout);
    expect(parsed.ok).toBe(true);
  });

  test("reading non-existent article returns error", async () => {
    await run(["init"], tmpDir);

    const result = await run(
      ["read", "nonexistent", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(result.exitCode).toBe(2); // NOT_FOUND
  });

  test("Japanese title slug generation", async () => {
    await run(["init"], tmpDir);

    const result = await run(
      ["create", "TypeScriptの基礎", "--json"],
      tmpDir,
    );
    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.ok).toBe(true);
    // Slug should preserve the characters (titleToSlug just strips invalid chars)
    expect(data.data.slug).toBeDefined();
    expect(data.data.title).toBe("TypeScriptの基礎");
  });

  test("duplicate slug gets auto-incremented", async () => {
    await run(["init"], tmpDir);

    const first = await run(
      ["create", "Test", "--slug", "test-dup", "--json"],
      tmpDir,
    );
    expect(first.exitCode).toBe(0);

    const second = await run(
      ["create", "Test 2", "--slug", "test-dup", "--json"],
      tmpDir,
    );
    expect(second.exitCode).toBe(0);
    const data = JSON.parse(second.stdout);
    // Should have incremented slug
    expect(data.data.slug).toBe("test-dup-1");
  });

  test("edit with --append adds content", async () => {
    await run(["init"], tmpDir);

    await run(
      ["create", "Append Test", "--slug", "append-test", "--body", "-", "--json"],
      tmpDir,
      "# Append Test\n\nOriginal content.",
    );

    await run(
      [
        "edit",
        "append-test",
        "--append",
        "-",
        "--scope",
        "local",
        "--json",
      ],
      tmpDir,
      "\n\nAppended content.",
    );

    const readResult = await run(
      ["read", "append-test", "--scope", "local", "--body-only"],
      tmpDir,
    );
    expect(readResult.stdout).toContain("Original content.");
    expect(readResult.stdout).toContain("Appended content.");
  });

  test("search returns empty for no matches", async () => {
    await run(["init"], tmpDir);
    await run(["create", "Sample", "--slug", "sample"], tmpDir);

    const result = await run(
      ["search", "zzzzqqqq99999", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.data.total).toBe(0);
  });

  test("export as markdown resolves wiki links", async () => {
    await run(["init"], tmpDir);

    await run(
      ["create", "Source", "--slug", "source", "--body", "-", "--json"],
      tmpDir,
      "# Source\n\nSee [[target]] for details.",
    );
    await run(
      ["create", "Target Article", "--slug", "target", "--json"],
      tmpDir,
    );

    const result = await run(
      ["export", "source", "--format", "md", "--scope", "local"],
      tmpDir,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[Target Article](target.md)");
    expect(result.stdout).not.toContain("[[target]]");
  });
});
