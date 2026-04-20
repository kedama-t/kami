import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildExcerpt } from "../../src/core/linker.ts";

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

describe("buildExcerpt", () => {
  test("uses first paragraph", () => {
    expect(buildExcerpt("first line\n\nsecond")).toBe("first line");
  });

  test("skips leading headings", () => {
    expect(buildExcerpt("# Title\n\nbody text")).toBe("body text");
  });

  test("truncates with ellipsis", () => {
    const long = "a".repeat(400);
    const out = buildExcerpt(long, 100);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(101);
  });

  test("handles empty body", () => {
    expect(buildExcerpt("")).toBe("");
  });
});

describe("kami read --expand-links", () => {
  let cwd: string;
  let home: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-expand-"));
    home = await mkdtemp(join(tmpdir(), "kami-expand-home-"));
    await run(["init"], cwd, undefined, home);
    await run(
      ["create", "target", "--body", "-", "--quiet"],
      cwd,
      "# Target\n\nThis is the target article body content.",
      home,
    );
    await run(
      ["create", "source", "--body", "-", "--quiet"],
      cwd,
      "# Source\n\nSee [[target]] for details.\nAlso [[missing-target]].",
      home,
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  test("returns excerpts for resolved links", async () => {
    const r = await run(
      ["read", "source", "--expand-links", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(true);
    expect(Array.isArray(out.data.links)).toBe(true);

    const target = out.data.links.find(
      (l: { slug: string }) => l.slug === "target",
    );
    expect(target).toBeDefined();
    expect(target.resolved).toBe(true);
    expect(target.excerpt).toContain("target article body");

    const missing = out.data.links.find(
      (l: { slug: string }) => l.slug === "missing-target",
    );
    expect(missing).toBeDefined();
    expect(missing.resolved).toBe(false);
  });

  test("omits links field when --expand-links not set", async () => {
    const r = await run(["read", "source", "--json"], cwd, undefined, home);
    const out = JSON.parse(r.stdout);
    expect(out.data.links).toBeUndefined();
  });
});
