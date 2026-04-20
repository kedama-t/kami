import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildSimilarityQuery } from "../../src/cli/commands/similar.ts";

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

describe("buildSimilarityQuery", () => {
  test("includes title and tags", () => {
    const q = buildSimilarityQuery("hello world", ["alpha", "beta"], "");
    expect(q).toContain("hello world");
    expect(q).toContain("alpha");
    expect(q).toContain("beta");
  });

  test("picks top body terms by frequency", () => {
    const body = "elephant elephant elephant zebra zebra rhino";
    const q = buildSimilarityQuery("title", [], body);
    expect(q).toContain("elephant");
    expect(q).toContain("zebra");
  });
});

describe("kami similar CLI", () => {
  let cwd: string;
  let home: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-similar-"));
    home = await mkdtemp(join(tmpdir(), "kami-similar-home-"));
    await run(["init"], cwd, undefined, home);
    await run(
      ["create", "rust-borrow", "--tag", "rust", "--body", "-", "--quiet"],
      cwd,
      "# Rust borrow checker\n\nOwnership and lifetimes in Rust prevent dangling references.",
      home,
    );
    await run(
      ["create", "rust-lifetimes", "--tag", "rust", "--body", "-", "--quiet"],
      cwd,
      "# Rust lifetimes deep dive\n\nLifetimes annotate references and the borrow checker.",
      home,
    );
    await run(
      ["create", "python-async", "--tag", "python", "--body", "-", "--quiet"],
      cwd,
      "# Python async/await\n\nasyncio event loop and coroutines for I/O concurrency.",
      home,
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  test("returns related articles, excluding the source itself", async () => {
    const r = await run(
      ["similar", "rust-borrow", "--limit", "5", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(true);
    const slugs = out.data.results.map((x: { slug: string }) => x.slug);
    expect(slugs).not.toContain("rust-borrow");
    expect(slugs).toContain("rust-lifetimes");
  });
});
