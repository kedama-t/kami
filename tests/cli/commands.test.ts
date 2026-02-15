import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dir, "..", "..", "src", "cli", "index.ts");

/** Run a kami CLI command and return stdout, stderr, exit code */
async function run(
  args: string[],
  cwd: string,
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    cwd,
    stdin: stdin ? new Blob([stdin]) : undefined,
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

describe("CLI commands", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-cli-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("init", () => {
    test("initializes local scope", async () => {
      const { stdout, exitCode } = await run(["init"], tmpDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Initialized kami local scope");
    });

    test("init --json", async () => {
      const { stdout, exitCode } = await run(["init", "--json"], tmpDir);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.scope).toBe("local");
    });

    test("fails if already initialized", async () => {
      await run(["init"], tmpDir);
      const { exitCode } = await run(["init"], tmpDir);
      expect(exitCode).toBe(1);
    });

    test("--force reinitializes", async () => {
      await run(["init"], tmpDir);
      const { exitCode } = await run(["init", "--force"], tmpDir);
      expect(exitCode).toBe(0);
    });
  });

  describe("create", () => {
    beforeEach(async () => {
      await run(["init"], tmpDir);
    });

    test("creates an article", async () => {
      const { stdout, exitCode } = await run(
        ["create", "Test Article", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Created:");
      expect(stdout).toContain("Test Article");
    });

    test("create --json", async () => {
      const { stdout, exitCode } = await run(
        ["create", "JSON Test", "--json", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.title).toBe("JSON Test");
      expect(result.data.scope).toBe("local");
    });

    test("creates with folder and tags", async () => {
      const { stdout, exitCode } = await run(
        [
          "create",
          "Tagged Article",
          "--folder",
          "notes",
          "--tag",
          "test",
          "--scope",
          "local",
          "--json",
        ],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.data.folder).toBe("notes");
      expect(result.data.tags).toContain("test");
    });
  });

  describe("read", () => {
    beforeEach(async () => {
      await run(["init"], tmpDir);
      await run(
        ["create", "Read Me", "--tag", "test", "--scope", "local"],
        tmpDir,
      );
    });

    test("reads article by slug", async () => {
      const { stdout, exitCode } = await run(
        ["read", "Read Me", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("title: Read Me");
      expect(stdout).toContain("# Read Me");
    });

    test("read --meta-only", async () => {
      const { stdout, exitCode } = await run(
        ["read", "Read Me", "--meta-only", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("title: Read Me");
      expect(stdout).not.toContain("# Read Me");
    });

    test("read --body-only", async () => {
      const { stdout, exitCode } = await run(
        ["read", "Read Me", "--body-only", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("# Read Me");
      expect(stdout).not.toContain("title:");
    });

    test("read --json", async () => {
      const { stdout, exitCode } = await run(
        ["read", "Read Me", "--json", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.title).toBe("Read Me");
      expect(result.data.body).toContain("# Read Me");
    });

    test("returns error for non-existent article", async () => {
      const { exitCode } = await run(
        ["read", "nonexistent", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(2);
    });
  });

  describe("edit", () => {
    beforeEach(async () => {
      await run(["init"], tmpDir);
      await run(
        [
          "create",
          "Editable",
          "--tag",
          "original",
          "--scope",
          "local",
        ],
        tmpDir,
      );
    });

    test("updates title", async () => {
      const { exitCode } = await run(
        ["edit", "Editable", "--title", "New Title", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);

      const { stdout } = await run(
        ["read", "New Title", "--json", "--scope", "local"],
        tmpDir,
      );
      const result = JSON.parse(stdout);
      expect(result.data.title).toBe("New Title");
    });

    test("adds and removes tags", async () => {
      await run(
        [
          "edit",
          "Editable",
          "--add-tag",
          "new-tag",
          "--scope",
          "local",
        ],
        tmpDir,
      );
      const { stdout } = await run(
        ["read", "Editable", "--json", "--scope", "local"],
        tmpDir,
      );
      const result = JSON.parse(stdout);
      expect(result.data.frontmatter.tags).toContain("new-tag");
      expect(result.data.frontmatter.tags).toContain("original");
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await run(["init"], tmpDir);
      await run(["create", "Deletable", "--scope", "local"], tmpDir);
    });

    test("deletes with --force", async () => {
      const { stdout, exitCode } = await run(
        ["delete", "Deletable", "--force", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Deleted:");
    });

    test("delete --json --force", async () => {
      const { stdout, exitCode } = await run(
        ["delete", "Deletable", "--force", "--json", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
    });

    test("article gone after delete", async () => {
      await run(
        ["delete", "Deletable", "--force", "--scope", "local"],
        tmpDir,
      );
      const { exitCode } = await run(
        ["read", "Deletable", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(2);
    });
  });

  describe("list", () => {
    beforeEach(async () => {
      await run(["init"], tmpDir);
      await run(
        [
          "create",
          "Article A",
          "--folder",
          "notes",
          "--tag",
          "ts",
          "--scope",
          "local",
        ],
        tmpDir,
      );
      await run(
        [
          "create",
          "Article B",
          "--folder",
          "daily",
          "--tag",
          "daily",
          "--scope",
          "local",
        ],
        tmpDir,
      );
    });

    test("lists all articles", async () => {
      const { stdout, exitCode } = await run(
        ["list", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Article A");
      expect(stdout).toContain("Article B");
    });

    test("list --json", async () => {
      const { stdout, exitCode } = await run(
        ["list", "--json", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.articles).toHaveLength(2);
      expect(result.data.total).toBe(2);
    });

    test("filters by folder", async () => {
      const { stdout, exitCode } = await run(
        ["list", "--folder", "notes", "--json", "--scope", "local"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.data.articles).toHaveLength(1);
      expect(result.data.articles[0].folder).toBe("notes");
    });

    test("filters by tag", async () => {
      const { stdout } = await run(
        ["list", "--tag", "daily", "--json", "--scope", "local"],
        tmpDir,
      );
      const result = JSON.parse(stdout);
      expect(result.data.articles).toHaveLength(1);
      expect(result.data.articles[0].title).toBe("Article B");
    });
  });
});
