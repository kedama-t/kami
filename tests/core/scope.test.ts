import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getScopePaths,
  findLocalRoot,
  resolveScope,
  initLocalScope,
} from "../../src/core/scope.ts";
import { LocalStorage } from "../../src/storage/local.ts";

const storage = new LocalStorage();

describe("scope", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-scope-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getScopePaths", () => {
    test("returns all expected paths", () => {
      const paths = getScopePaths("/home/user/.kami");
      expect(paths.root).toBe("/home/user/.kami");
      expect(paths.vault).toBe("/home/user/.kami/vault");
      expect(paths.templates).toBe("/home/user/.kami/templates");
      expect(paths.indexFile).toBe("/home/user/.kami/index.json");
      expect(paths.linksFile).toBe("/home/user/.kami/links.json");
      expect(paths.configFile).toBe("/home/user/.kami/config.json");
      expect(paths.hooksFile).toBe("/home/user/.kami/hooks.json");
    });
  });

  describe("findLocalRoot", () => {
    test("finds .kami in current directory", async () => {
      const kamiDir = join(tmpDir, ".kami");
      await storage.mkdir(kamiDir);
      const result = await findLocalRoot(tmpDir);
      expect(result).toBe(kamiDir);
    });

    test("finds .kami in parent directory", async () => {
      const kamiDir = join(tmpDir, ".kami");
      await storage.mkdir(kamiDir);
      const subDir = join(tmpDir, "sub", "deep");
      await storage.mkdir(subDir);
      const result = await findLocalRoot(subDir);
      expect(result).toBe(kamiDir);
    });

    test("returns null when no .kami found", async () => {
      const result = await findLocalRoot(tmpDir);
      expect(result).toBeNull();
    });
  });

  describe("resolveScope", () => {
    test("auto-resolve write: local when local exists", async () => {
      await initLocalScope(tmpDir);
      const result = await resolveScope(undefined, "write", tmpDir);
      expect(result.scopes).toEqual(["local"]);
    });

    test("auto-resolve write: global when no local", async () => {
      const result = await resolveScope(undefined, "write", tmpDir);
      expect(result.scopes).toEqual(["global"]);
    });

    test("auto-resolve read: local-first when local exists", async () => {
      await initLocalScope(tmpDir);
      const result = await resolveScope(undefined, "read", tmpDir);
      expect(result.scopes).toEqual(["local", "global"]);
    });

    test("explicit local throws when no local scope", async () => {
      expect(resolveScope("local", "read", tmpDir)).rejects.toThrow(
        "Local scope not found",
      );
    });

    test("explicit global always works", async () => {
      const result = await resolveScope("global", "read", tmpDir);
      expect(result.scopes).toEqual(["global"]);
    });
  });

  describe("initLocalScope", () => {
    test("creates full directory structure", async () => {
      const root = await initLocalScope(tmpDir);
      expect(root).toBe(join(tmpDir, ".kami"));
      expect(await storage.exists(join(root, "vault"))).toBe(true);
      expect(await storage.exists(join(root, "templates"))).toBe(true);
      expect(await storage.exists(join(root, "index.json"))).toBe(true);
      expect(await storage.exists(join(root, "links.json"))).toBe(true);
      expect(await storage.exists(join(root, "config.json"))).toBe(true);
      expect(await storage.exists(join(root, "hooks.json"))).toBe(true);
    });

    test("index.json has correct initial structure", async () => {
      const root = await initLocalScope(tmpDir);
      const content = JSON.parse(
        await storage.readFile(join(root, "index.json")),
      );
      expect(content).toEqual({ articles: {} });
    });

    test("links.json has correct initial structure", async () => {
      const root = await initLocalScope(tmpDir);
      const content = JSON.parse(
        await storage.readFile(join(root, "links.json")),
      );
      expect(content).toEqual({ forward: {}, backlinks: {} });
    });
  });
});
