import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  executeHooks,
  expandVariables,
  buildArticleHookContext,
} from "../../src/core/hook.ts";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import { LocalStorage } from "../../src/storage/local.ts";
import type { HookContext, HookConfig } from "../../src/types/hook.ts";

const storage = new LocalStorage();

function makeContext(overrides?: Partial<HookContext>): HookContext {
  return {
    event: "article:post-create",
    timestamp: "2026-02-15T10:00:00Z",
    scope: "local",
    vault_path: "/tmp/test/.kami/vault",
    slug: "test-article",
    title: "Test Article",
    file_path: "/tmp/test/.kami/vault/notes/test-article.md",
    folder: "notes",
    tags: ["test", "example"],
    ...overrides,
  };
}

describe("hook", () => {
  let tmpDir: string;
  let scopeRoot: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-hook-test-"));
    scopeRoot = await initLocalScope(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("expandVariables", () => {
    test("expands simple variables", () => {
      const ctx = makeContext();
      const result = expandVariables("echo ${slug} ${title}", ctx);
      expect(result).toBe("echo test-article Test Article");
    });

    test("expands array variables", () => {
      const ctx = makeContext({ tags: ["a", "b", "c"] });
      const result = expandVariables("echo ${tags}", ctx);
      expect(result).toBe("echo a,b,c");
    });

    test("replaces unknown variables with empty string", () => {
      const ctx = makeContext();
      const result = expandVariables("echo ${unknown}", ctx);
      expect(result).toBe("echo ");
    });

    test("handles no variables", () => {
      const ctx = makeContext();
      const result = expandVariables("echo hello", ctx);
      expect(result).toBe("echo hello");
    });
  });

  describe("executeHooks", () => {
    async function writeHooks(config: HookConfig): Promise<void> {
      const paths = getScopePaths(scopeRoot);
      await storage.writeFile(paths.hooksFile, JSON.stringify(config));
    }

    test("runs post-hook commands", async () => {
      // Write a hook that creates a marker file
      const markerPath = join(tmpDir, "hook-ran");
      await writeHooks({
        hooks: {
          "article:post-create": [
            {
              hooks: [
                { type: "command", command: `touch ${markerPath}` },
              ],
            },
          ],
        },
      });

      const ctx = makeContext();
      const result = await executeHooks("article:post-create", ctx, [
        { scope: "local", root: scopeRoot },
      ]);

      expect(result.blocked).toBe(false);
      expect(await storage.exists(markerPath)).toBe(true);
    });

    test("pre-hook blocks on exit code 2", async () => {
      await writeHooks({
        hooks: {
          "article:pre-create": [
            {
              hooks: [
                { type: "command", command: "exit 2" },
              ],
            },
          ],
        },
      });

      const ctx = makeContext({ event: "article:pre-create" });
      const result = await executeHooks("article:pre-create", ctx, [
        { scope: "local", root: scopeRoot },
      ]);

      expect(result.blocked).toBe(true);
    });

    test("post-hook does not block on exit code 2", async () => {
      await writeHooks({
        hooks: {
          "article:post-create": [
            {
              hooks: [
                { type: "command", command: "exit 2" },
              ],
            },
          ],
        },
      });

      const ctx = makeContext();
      const result = await executeHooks("article:post-create", ctx, [
        { scope: "local", root: scopeRoot },
      ]);

      // post-hooks don't block even with exit code 2
      expect(result.blocked).toBe(false);
    });

    test("non-zero exit code produces warning", async () => {
      await writeHooks({
        hooks: {
          "article:post-create": [
            {
              hooks: [
                { type: "command", command: "exit 1" },
              ],
            },
          ],
        },
      });

      const ctx = makeContext();
      const result = await executeHooks("article:post-create", ctx, [
        { scope: "local", root: scopeRoot },
      ]);

      expect(result.blocked).toBe(false);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0]).toContain("warning");
    });

    test("matcher filters by folder", async () => {
      const markerPath = join(tmpDir, "matched");
      await writeHooks({
        hooks: {
          "article:post-create": [
            {
              matcher: "daily/.*",
              hooks: [
                { type: "command", command: `touch ${markerPath}` },
              ],
            },
          ],
        },
      });

      // notes folder should NOT match
      const ctx = makeContext({ folder: "notes" });
      await executeHooks("article:post-create", ctx, [
        { scope: "local", root: scopeRoot },
      ]);
      expect(await storage.exists(markerPath)).toBe(false);

      // daily folder SHOULD match
      const ctx2 = makeContext({ folder: "daily/2026" });
      await executeHooks("article:post-create", ctx2, [
        { scope: "local", root: scopeRoot },
      ]);
      expect(await storage.exists(markerPath)).toBe(true);
    });

    test("skips hooks when KAMI_HOOK=1", async () => {
      const markerPath = join(tmpDir, "should-not-exist");
      await writeHooks({
        hooks: {
          "article:post-create": [
            {
              hooks: [
                { type: "command", command: `touch ${markerPath}` },
              ],
            },
          ],
        },
      });

      const originalEnv = process.env.KAMI_HOOK;
      process.env.KAMI_HOOK = "1";
      try {
        const ctx = makeContext();
        const result = await executeHooks("article:post-create", ctx, [
          { scope: "local", root: scopeRoot },
        ]);
        expect(result.blocked).toBe(false);
        expect(await storage.exists(markerPath)).toBe(false);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.KAMI_HOOK;
        } else {
          process.env.KAMI_HOOK = originalEnv;
        }
      }
    });

    test("expands variables in command", async () => {
      const markerPath = join(tmpDir, "expanded");
      await writeHooks({
        hooks: {
          "article:post-create": [
            {
              hooks: [
                {
                  type: "command",
                  command: `echo \${slug} > ${markerPath}`,
                },
              ],
            },
          ],
        },
      });

      const ctx = makeContext({ slug: "my-slug" });
      await executeHooks("article:post-create", ctx, [
        { scope: "local", root: scopeRoot },
      ]);

      const content = await storage.readFile(markerPath);
      expect(content.trim()).toBe("my-slug");
    });

    test("handles empty hooks config", async () => {
      const ctx = makeContext();
      const result = await executeHooks("article:post-create", ctx, [
        { scope: "local", root: scopeRoot },
      ]);
      expect(result.blocked).toBe(false);
      expect(result.messages).toHaveLength(0);
    });

    test("pre-hook blocks on stdout continue=false", async () => {
      await writeHooks({
        hooks: {
          "article:pre-create": [
            {
              hooks: [
                {
                  type: "command",
                  command: 'echo \'{"continue": false, "message": "Validation failed"}\'',
                },
              ],
            },
          ],
        },
      });

      const ctx = makeContext({ event: "article:pre-create" });
      const result = await executeHooks("article:pre-create", ctx, [
        { scope: "local", root: scopeRoot },
      ]);

      expect(result.blocked).toBe(true);
      expect(result.messages).toContain("Validation failed");
    });
  });

  describe("buildArticleHookContext", () => {
    test("builds context with all fields", () => {
      const ctx = buildArticleHookContext(
        "article:post-create",
        "local",
        "/tmp/.kami/vault",
        {
          slug: "test",
          title: "Test",
          filePath: "/tmp/.kami/vault/test.md",
          folder: "notes",
          tags: ["a"],
        },
      );
      expect(ctx.event).toBe("article:post-create");
      expect(ctx.scope).toBe("local");
      expect(ctx.slug).toBe("test");
      expect(ctx.timestamp).toBeDefined();
    });
  });
});
