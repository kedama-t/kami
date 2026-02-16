import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readdir } from "node:fs/promises";
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

/** Verify that a skill directory has the expected structure */
async function verifySkillDir(skillDir: string) {
  const skillMd = await Bun.file(join(skillDir, "SKILL.md")).text();
  expect(skillMd).toContain("kami CLI");

  const refFiles = await readdir(join(skillDir, "reference"));
  expect(refFiles).toContain("article-format.md");
  expect(refFiles).toContain("json-examples.md");
  expect(refFiles).toContain("error-codes.md");
}

describe("install command", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-install-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("claude-code", () => {
    test("installs skill directory for project level", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--target", "claude-code", "--level", "project", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.target).toBe("claude-code");
      expect(result.data.level).toBe("project");
      expect(result.data.files.length).toBeGreaterThanOrEqual(2);

      await verifySkillDir(join(tmpDir, ".claude", "skills", "kami"));
    });

    test("text output shows installed message", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--target", "claude-code", "--level", "project"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed kami skill for Claude Code (project)");
    });

    test("errors if already exists without --force", async () => {
      await run(
        ["install", "--target", "claude-code", "--level", "project", "--json"],
        tmpDir,
      );
      const { stdout, exitCode } = await run(
        ["install", "--target", "claude-code", "--level", "project", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(1);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("--force");
    });

    test("--force overwrites existing installation", async () => {
      await run(
        ["install", "--target", "claude-code", "--level", "project", "--json"],
        tmpDir,
      );
      const { stdout, exitCode } = await run(
        [
          "install",
          "--target",
          "claude-code",
          "--level",
          "project",
          "--force",
          "--json",
        ],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
    });
  });

  describe("codex", () => {
    test("installs skill directory at .codex/skills/kami/", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--target", "codex", "--level", "project", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.target).toBe("codex");
      expect(result.data.files.length).toBeGreaterThanOrEqual(2);

      await verifySkillDir(join(tmpDir, ".codex", "skills", "kami"));
    });

    test("errors if already exists without --force", async () => {
      await run(
        ["install", "--target", "codex", "--level", "project", "--json"],
        tmpDir,
      );
      const { stdout, exitCode } = await run(
        ["install", "--target", "codex", "--level", "project", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(1);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    test("--force overwrites existing installation", async () => {
      await run(
        ["install", "--target", "codex", "--level", "project", "--json"],
        tmpDir,
      );
      const { stdout, exitCode } = await run(
        [
          "install",
          "--target",
          "codex",
          "--level",
          "project",
          "--force",
          "--json",
        ],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
    });
  });

  describe("gemini", () => {
    test("installs skill directory at .gemini/skills/kami/", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--target", "gemini", "--level", "project", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.data.target).toBe("gemini");

      await verifySkillDir(join(tmpDir, ".gemini", "skills", "kami"));
    });

    test("text output shows installed message", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--target", "gemini", "--level", "project"],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed kami skill for Gemini CLI (project)");
    });
  });

  describe("validation", () => {
    test("errors on invalid target", async () => {
      const { exitCode } = await run(
        ["install", "--target", "invalid", "--level", "project"],
        tmpDir,
      );
      expect(exitCode).toBe(1);
    });

    test("errors on invalid level", async () => {
      const { exitCode } = await run(
        ["install", "--target", "codex", "--level", "invalid"],
        tmpDir,
      );
      expect(exitCode).toBe(1);
    });

    test("JSON mode requires --target and --level", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(1);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error.message).toContain("--target and --level are required");
    });

    test("JSON mode with only --target errors", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--target", "codex", "--json"],
        tmpDir,
      );
      expect(exitCode).toBe(1);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
    });
  });

  describe("interactive prompts", () => {
    test("selects target and level from stdin", async () => {
      const { stdout, exitCode } = await run(
        ["install"],
        tmpDir,
        "2\n1\n",
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed kami skill for Codex CLI (project)");

      await verifySkillDir(join(tmpDir, ".codex", "skills", "kami"));
    });

    test("uses provided --target, prompts only for level", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--target", "gemini"],
        tmpDir,
        "1\n",
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed kami skill for Gemini CLI (project)");
    });

    test("uses provided --level, prompts only for target", async () => {
      const { stdout, exitCode } = await run(
        ["install", "--level", "project"],
        tmpDir,
        "1\n",
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed kami skill for Claude Code (project)");
    });
  });

  describe("quiet mode", () => {
    test("suppresses output with --quiet", async () => {
      const { stdout, exitCode } = await run(
        [
          "install",
          "--target",
          "codex",
          "--level",
          "project",
          "--quiet",
        ],
        tmpDir,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toBe("");

      // Skill directory should still be created
      await verifySkillDir(join(tmpDir, ".codex", "skills", "kami"));
    });
  });
});
