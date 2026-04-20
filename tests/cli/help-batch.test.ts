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

describe("kami help --json (catalog)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-help-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns full command catalog", async () => {
    const { stdout, exitCode } = await run(["help", "--json"], tmpDir);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.data.name).toBe("kami");
    expect(typeof result.data.version).toBe("string");
    expect(Array.isArray(result.data.commands)).toBe(true);

    const names = result.data.commands.map((c: { name: string }) => c.name);
    for (const expected of ["init", "create", "read", "edit", "delete", "list", "search", "batch", "help"]) {
      expect(names).toContain(expected);
    }
  });

  test("create command exposes args with positional/required flags", async () => {
    const { stdout } = await run(["help", "--json"], tmpDir);
    const result = JSON.parse(stdout);
    const createCmd = result.data.commands.find(
      (c: { name: string }) => c.name === "create",
    );
    expect(createCmd).toBeDefined();
    const titleArg = createCmd.args.find((a: { name: string }) => a.name === "title");
    expect(titleArg.positional).toBe(true);
    expect(titleArg.required).toBe(true);
  });

  test("nested subcommands (template list/show/create) are included", async () => {
    const { stdout } = await run(["help", "--json"], tmpDir);
    const result = JSON.parse(stdout);
    const templateCmd = result.data.commands.find(
      (c: { name: string }) => c.name === "template",
    );
    expect(templateCmd).toBeDefined();
    expect(Array.isArray(templateCmd.subCommands)).toBe(true);
    const subNames = templateCmd.subCommands.map((s: { name: string }) => s.name);
    expect(subNames).toContain("list");
    expect(subNames).toContain("show");
    expect(subNames).toContain("create");
  });

  test("plain `kami help` outputs human-readable text", async () => {
    const { stdout, exitCode } = await run(["help"], tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("kami");
    expect(stdout).toContain("Commands:");
    expect(stdout).toContain("create");
  });
});

describe("kami batch (JSON Lines)", () => {
  let tmpDir: string;
  let homeDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-batch-"));
    // local scope と global scope (~/.kami) を別ディレクトリに分離
    homeDir = await mkdtemp(join(tmpdir(), "kami-batch-home-"));
    await run(["init"], tmpDir, undefined, homeDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  test("creates multiple articles from stdin NDJSON", async () => {
    const input =
      JSON.stringify({ cmd: "create", args: { title: "alpha", tags: ["a"] } }) +
      "\n" +
      JSON.stringify({ cmd: "create", args: { title: "beta" } }) +
      "\n";
    const { stdout, exitCode } = await run(["batch", "-"], tmpDir, input, homeDir);
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(2);
    const [r1, r2] = lines.map((l) => JSON.parse(l));
    expect(r1.ok).toBe(true);
    expect(r1.line).toBe(1);
    expect(r1.data.slug).toBe("alpha");
    expect(r2.ok).toBe(true);
    expect(r2.data.slug).toBe("beta");
  });

  test("create + edit + read in single batch", async () => {
    const input =
      JSON.stringify({ cmd: "create", args: { title: "doc" } }) +
      "\n" +
      JSON.stringify({ cmd: "edit", args: { slug: "doc", append: "appended-line" } }) +
      "\n" +
      JSON.stringify({ cmd: "read", args: { slug: "doc" } }) +
      "\n";
    const { stdout, exitCode } = await run(["batch", "-"], tmpDir, input, homeDir);
    expect(exitCode).toBe(0);
    const results = stdout.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    expect(results).toHaveLength(3);
    expect(results[2].ok).toBe(true);
    expect(results[2].data.body).toContain("appended-line");
  });

  test("continues after error and exits non-zero", async () => {
    const input =
      JSON.stringify({ cmd: "read", args: { slug: "missing" } }) +
      "\n" +
      JSON.stringify({ cmd: "create", args: { title: "after-error" } }) +
      "\n";
    const { stdout, exitCode } = await run(["batch", "-"], tmpDir, input, homeDir);
    expect(exitCode).toBe(1);
    const results = stdout.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(false);
    expect(results[0].error.code).toBe("ARTICLE_NOT_FOUND");
    expect(results[1].ok).toBe(true);
  });

  test("--stop-on-error halts after first failure", async () => {
    const input =
      JSON.stringify({ cmd: "read", args: { slug: "missing" } }) +
      "\n" +
      JSON.stringify({ cmd: "create", args: { title: "should-not-create" } }) +
      "\n";
    const { stdout, exitCode } = await run(["batch", "-", "--stop-on-error"], tmpDir, input, homeDir);
    expect(exitCode).toBe(1);
    const results = stdout.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
  });

  test("rejects unknown command", async () => {
    const input = JSON.stringify({ cmd: "bogus", args: {} }) + "\n";
    const { stdout, exitCode } = await run(["batch", "-"], tmpDir, input, homeDir);
    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});
