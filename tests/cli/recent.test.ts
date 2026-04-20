import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseDuration } from "../../src/cli/commands/recent.ts";

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

describe("parseDuration", () => {
  test("parses seconds", () => expect(parseDuration("30s")).toBe(30_000));
  test("parses minutes", () => expect(parseDuration("15m")).toBe(900_000));
  test("parses hours", () => expect(parseDuration("2h")).toBe(7_200_000));
  test("parses days", () => expect(parseDuration("3d")).toBe(259_200_000));
  test("rejects invalid", () =>
    expect(() => parseDuration("1week")).toThrow(/Invalid --since/));
});

describe("kami recent CLI", () => {
  let cwd: string;
  let home: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-recent-"));
    home = await mkdtemp(join(tmpdir(), "kami-recent-home-"));
    await run(["init"], cwd, undefined, home);
    await run(["create", "fresh", "--json", "--quiet"], cwd, undefined, home);
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  test("returns the freshly created article within 1h", async () => {
    const r = await run(["recent", "--since", "1h", "--json"], cwd, undefined, home);
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(true);
    const slugs = out.data.articles.map((a: { slug: string }) => a.slug);
    expect(slugs).toContain("fresh");
  });

  test("rejects malformed --since", async () => {
    const r = await run(["recent", "--since", "abc", "--json"], cwd, undefined, home);
    expect(r.exitCode).toBe(1);
    const out = JSON.parse(r.stdout);
    expect(out.error.code).toBe("VALIDATION_ERROR");
  });
});
