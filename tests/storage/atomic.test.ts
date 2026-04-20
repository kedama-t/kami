import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalStorage } from "../../src/storage/local.ts";

describe("LocalStorage atomic write", () => {
  let storage: LocalStorage;
  let tmpDir: string;

  beforeEach(async () => {
    storage = new LocalStorage();
    tmpDir = await mkdtemp(join(tmpdir(), "kami-atomic-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("並行書き込みでファイルが破損せず、いずれかの完全な内容になる", async () => {
    const filePath = join(tmpDir, "concurrent.json");
    const writers = Array.from({ length: 50 }, (_, i) => {
      const content = JSON.stringify({ writer: i, data: "x".repeat(1000) });
      return storage.writeFile(filePath, content);
    });
    await Promise.all(writers);

    const final = await storage.readFile(filePath);
    const parsed = JSON.parse(final);
    expect(typeof parsed.writer).toBe("number");
    expect(parsed.writer).toBeGreaterThanOrEqual(0);
    expect(parsed.writer).toBeLessThan(50);
    expect(parsed.data).toBe("x".repeat(1000));
  });

  test("正常終了後に temp ファイルが残らない", async () => {
    const filePath = join(tmpDir, "leftover.txt");
    await Promise.all(
      Array.from({ length: 20 }, () => storage.writeFile(filePath, "ok")),
    );
    const entries = await readdir(tmpDir);
    const tmpFiles = entries.filter((e) => e.includes(".tmp."));
    expect(tmpFiles).toHaveLength(0);
  });

  test("親ディレクトリを再帰的に作成する", async () => {
    const filePath = join(tmpDir, "a", "b", "c", "deep.txt");
    await storage.writeFile(filePath, "deep");
    expect(await storage.readFile(filePath)).toBe("deep");
  });
});
