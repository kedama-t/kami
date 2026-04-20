import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
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

describe("kami edit --section", () => {
  let cwd: string;
  let home: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-section-"));
    home = await mkdtemp(join(tmpdir(), "kami-section-home-"));
    await run(["init"], cwd, undefined, home);
    const body = `# Doc

intro

## Tasks

- old1
- old2

## Notes

note body
`;
    const r = await run(
      ["create", "doc", "--body", "-", "--json"],
      cwd,
      body,
      home,
    );
    expect(r.exitCode).toBe(0);
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  test("--section with --replace replaces only the section body", async () => {
    const r = await run(
      ["edit", "doc", "--section", "Tasks", "--replace", "-", "--json"],
      cwd,
      "- new",
      home,
    );
    expect(r.exitCode).toBe(0);

    const read = await run(["read", "doc", "--body-only"], cwd, undefined, home);
    expect(read.exitCode).toBe(0);
    expect(read.stdout).toContain("## Tasks");
    expect(read.stdout).toContain("- new");
    expect(read.stdout).not.toContain("- old1");
    expect(read.stdout).toContain("## Notes");
    expect(read.stdout).toContain("note body");
  });

  test("--section with --append adds to section end", async () => {
    const r = await run(
      ["edit", "doc", "--section", "Tasks", "--append", "-", "--json"],
      cwd,
      "- new",
      home,
    );
    expect(r.exitCode).toBe(0);

    const read = await run(["read", "doc", "--body-only"], cwd, undefined, home);
    const tasksIdx = read.stdout.indexOf("## Tasks");
    const notesIdx = read.stdout.indexOf("## Notes");
    const slice = read.stdout.slice(tasksIdx, notesIdx);
    expect(slice).toContain("- old1");
    expect(slice).toContain("- old2");
    expect(slice).toContain("- new");
  });

  test("--section --insert-before prepends above heading", async () => {
    const r = await run(
      [
        "edit",
        "doc",
        "--section",
        "Notes",
        "--insert-before",
        "-",
        "--json",
      ],
      cwd,
      "## Inserted\n\nbefore notes",
      home,
    );
    expect(r.exitCode).toBe(0);

    const read = await run(["read", "doc", "--body-only"], cwd, undefined, home);
    const insertedIdx = read.stdout.indexOf("## Inserted");
    const notesIdx = read.stdout.indexOf("## Notes");
    expect(insertedIdx).toBeGreaterThan(0);
    expect(insertedIdx).toBeLessThan(notesIdx);
  });

  test("--section without operation flags fails with VALIDATION_ERROR", async () => {
    const r = await run(
      ["edit", "doc", "--section", "Tasks", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(r.exitCode).toBe(1);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(false);
    expect(out.error.code).toBe("VALIDATION_ERROR");
  });

  test("missing section returns SECTION_NOT_FOUND with exit 2", async () => {
    const r = await run(
      ["edit", "doc", "--section", "Missing", "--replace", "-", "--json"],
      cwd,
      "x",
      home,
    );
    expect(r.exitCode).toBe(2);
    const out = JSON.parse(r.stdout);
    expect(out.error.code).toBe("SECTION_NOT_FOUND");
  });
});
