import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, stat, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dir, "..", "..", "src", "cli", "index.ts");

async function run(
  args: string[],
  cwd: string,
  stdin?: string,
  home?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    cwd,
    stdin: stdin ? new Blob([stdin]) : undefined,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HOME: home ?? cwd },
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe("kami move", () => {
  let cwd: string;
  let home: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-move-"));
    home = await mkdtemp(join(tmpdir(), "kami-move-home-"));
    await run(["init"], cwd, undefined, home);
    await run(
      ["create", "to-move", "--quiet"],
      cwd,
      undefined,
      home,
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  test("moves the file and updates index folder/filePath", async () => {
    const r = await run(
      ["move", "to-move", "design", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(true);
    expect(out.data.folder).toBe("design");

    expect(await exists(join(cwd, ".kami/vault/to-move.md"))).toBe(false);
    expect(await exists(join(cwd, ".kami/vault/design/to-move.md"))).toBe(true);

    const read = await run(
      ["read", "to-move", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(read.exitCode).toBe(0);
    const meta = JSON.parse(read.stdout).data;
    expect(meta.file_path).toContain(".kami/vault/design/to-move.md");
    expect(meta.folder).toBe("design");
  });

  test("rejects same-folder no-op", async () => {
    const r = await run(
      ["move", "to-move", "", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(r.exitCode).not.toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects when destination already has the slug", async () => {
    const destDir = join(cwd, ".kami/vault/design");
    await mkdir(destDir, { recursive: true });
    await writeFile(join(destDir, "to-move.md"), "stub", "utf8");
    const r = await run(
      ["move", "to-move", "design", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(r.exitCode).not.toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.error.code).toBe("ARTICLE_ALREADY_EXISTS");
  });
});
