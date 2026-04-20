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

describe("kami tag rename", () => {
  let cwd: string;
  let home: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "kami-tag-"));
    home = await mkdtemp(join(tmpdir(), "kami-tag-home-"));
    await run(["init"], cwd, undefined, home);
    await run(
      ["create", "alpha", "--tag", "old-tag", "--quiet"],
      cwd,
      undefined,
      home,
    );
    await run(
      ["create", "beta", "--tag", "old-tag", "--quiet"],
      cwd,
      undefined,
      home,
    );
    await run(
      ["create", "gamma", "--tag", "untouched", "--quiet"],
      cwd,
      undefined,
      home,
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  test("dry-run reports affected without writing", async () => {
    const r = await run(
      ["tag", "rename", "old-tag", "new-tag", "--dry-run", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.data.dryRun).toBe(true);
    expect(out.data.count).toBe(2);
    const slugs = out.data.affected.map((a: { slug: string }) => a.slug);
    expect(slugs.sort()).toEqual(["alpha", "beta"]);

    const before = await run(
      ["read", "alpha", "--json"],
      cwd,
      undefined,
      home,
    );
    const fm = JSON.parse(before.stdout).data.frontmatter;
    expect(fm.tags).toContain("old-tag");
    expect(fm.tags).not.toContain("new-tag");
  });

  test("renames tags across matching articles", async () => {
    const r = await run(
      ["tag", "rename", "old-tag", "new-tag", "--json"],
      cwd,
      undefined,
      home,
    );
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.data.count).toBe(2);

    const a = JSON.parse(
      (await run(["read", "alpha", "--json"], cwd, undefined, home)).stdout,
    ).data.frontmatter;
    expect(a.tags).toContain("new-tag");
    expect(a.tags).not.toContain("old-tag");

    const b = JSON.parse(
      (await run(["read", "beta", "--json"], cwd, undefined, home)).stdout,
    ).data.frontmatter;
    expect(b.tags).toContain("new-tag");
    expect(b.tags).not.toContain("old-tag");

    const g = JSON.parse(
      (await run(["read", "gamma", "--json"], cwd, undefined, home)).stdout,
    ).data.frontmatter;
    expect(g.tags).toEqual(["untouched"]);
  });
});
