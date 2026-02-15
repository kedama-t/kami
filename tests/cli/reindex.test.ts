import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import { serializeFrontmatter } from "../../src/core/frontmatter.ts";
import { LocalStorage } from "../../src/storage/local.ts";

const CLI = join(import.meta.dir, "..", "..", "src", "cli", "index.ts");
const storage = new LocalStorage();

async function run(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

describe("CLI reindex", () => {
  let tmpDir: string;
  let scopeRoot: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-reindex-test-"));
    scopeRoot = await initLocalScope(tmpDir);
    const paths = getScopePaths(scopeRoot);

    // Create articles directly (without going through index)
    const articles = [
      {
        slug: "alpha",
        title: "Alpha Article",
        tags: ["test"],
        body: "# Alpha Article\n\nLinks to [[beta]].",
        folder: "notes",
      },
      {
        slug: "beta",
        title: "Beta Article",
        tags: ["test"],
        body: "# Beta Article\n\nLinks to [[alpha]] and [[gamma]].",
        folder: "notes",
      },
      {
        slug: "gamma",
        title: "Gamma Article",
        tags: ["other"],
        body: "# Gamma Article\n\nNo links here.",
        folder: "",
      },
    ];

    for (const a of articles) {
      const dir = a.folder ? join(paths.vault, a.folder) : paths.vault;
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
    }
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("reindex produces correct article count (JSON)", async () => {
    const { stdout, exitCode } = await run(
      ["reindex", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.data.scopes).toHaveLength(1);
    expect(result.data.scopes[0].scope).toBe("local");
    expect(result.data.scopes[0].articles).toBe(3);
  });

  test("reindex rebuilds link graph correctly", async () => {
    const { stdout, exitCode } = await run(
      ["reindex", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    // alpha -> beta (1 link), beta -> alpha + gamma (2 links) = 3 total
    expect(result.data.scopes[0].links).toBe(3);
  });

  test("search works after reindex", async () => {
    // First reindex
    await run(["reindex", "--scope", "local"], tmpDir);

    // Then search
    const { stdout, exitCode } = await run(
      ["search", "Alpha", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.data.total).toBeGreaterThanOrEqual(1);
    expect(
      result.data.results.some(
        (r: { slug: string }) => r.slug === "alpha",
      ),
    ).toBe(true);
  });

  test("text output works", async () => {
    const { stdout, exitCode } = await run(
      ["reindex", "--scope", "local"],
      tmpDir,
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Reindexed local:");
    expect(stdout).toContain("3 articles");
  });

  test("backlinks work after reindex", async () => {
    await run(["reindex", "--scope", "local"], tmpDir);

    const { stdout, exitCode } = await run(
      ["backlinks", "beta", "--scope", "local", "--json"],
      tmpDir,
    );
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.data.backlinks).toHaveLength(1);
    expect(result.data.backlinks[0].slug).toBe("alpha");
  });
});
