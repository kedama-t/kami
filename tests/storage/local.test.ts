import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalStorage } from "../../src/storage/local.ts";

describe("LocalStorage", () => {
  let storage: LocalStorage;
  let tmpDir: string;

  beforeEach(async () => {
    storage = new LocalStorage();
    tmpDir = await mkdtemp(join(tmpdir(), "kami-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("writeFile and readFile", async () => {
    const filePath = join(tmpDir, "test.txt");
    await storage.writeFile(filePath, "hello world");
    const content = await storage.readFile(filePath);
    expect(content).toBe("hello world");
  });

  test("writeFile creates parent directories", async () => {
    const filePath = join(tmpDir, "sub", "dir", "test.txt");
    await storage.writeFile(filePath, "nested");
    const content = await storage.readFile(filePath);
    expect(content).toBe("nested");
  });

  test("deleteFile removes file", async () => {
    const filePath = join(tmpDir, "to-delete.txt");
    await storage.writeFile(filePath, "delete me");
    expect(await storage.exists(filePath)).toBe(true);
    await storage.deleteFile(filePath);
    expect(await storage.exists(filePath)).toBe(false);
  });

  test("exists returns false for non-existent path", async () => {
    expect(await storage.exists(join(tmpDir, "nope"))).toBe(false);
  });

  test("exists returns true for existing file", async () => {
    const filePath = join(tmpDir, "exists.txt");
    await storage.writeFile(filePath, "");
    expect(await storage.exists(filePath)).toBe(true);
  });

  test("mkdir creates directory recursively", async () => {
    const dirPath = join(tmpDir, "a", "b", "c");
    await storage.mkdir(dirPath);
    expect(await storage.exists(dirPath)).toBe(true);
  });

  test("listFiles returns matching files", async () => {
    const vault = join(tmpDir, "vault");
    await storage.mkdir(join(vault, "notes"));
    await storage.mkdir(join(vault, "daily"));
    await storage.writeFile(join(vault, "notes", "a.md"), "# A");
    await storage.writeFile(join(vault, "notes", "b.md"), "# B");
    await storage.writeFile(join(vault, "daily", "c.md"), "# C");
    await storage.writeFile(join(vault, "notes", "readme.txt"), "skip");

    const files = await storage.listFiles(vault);
    expect(files).toHaveLength(3);
    expect(files.every((f) => f.endsWith(".md"))).toBe(true);
  });

  test("listFiles returns empty for non-existent dir", async () => {
    const files = await storage.listFiles(join(tmpDir, "nonexistent"));
    expect(files).toEqual([]);
  });

  test("listFiles with custom pattern", async () => {
    await storage.writeFile(join(tmpDir, "a.json"), "{}");
    await storage.writeFile(join(tmpDir, "b.md"), "# B");
    const files = await storage.listFiles(tmpDir, "*.json");
    expect(files).toHaveLength(1);
    expect(files[0]!.endsWith(".json")).toBe(true);
  });
});
