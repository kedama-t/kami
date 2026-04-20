import { mkdir, unlink, stat, writeFile, rename } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageAdapter } from "./adapter.ts";

/** Local filesystem storage adapter */
export class LocalStorage implements StorageAdapter {
  async readFile(path: string): Promise<string> {
    return Bun.file(path).text();
  }

  /**
   * tempfile を同一ディレクトリに作成して rename で置換。
   * 並行書き込み時の partial-write による破損を防ぐ（lost-update は許容）。
   */
  async writeFile(path: string, content: string): Promise<void> {
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    const tmpPath = join(
      dir,
      `.${basename(path)}.tmp.${process.pid}.${randomUUID()}`,
    );
    try {
      await writeFile(tmpPath, content);
      await rename(tmpPath, path);
    } catch (err) {
      await unlink(tmpPath).catch(() => {});
      throw err;
    }
  }

  async deleteFile(path: string): Promise<void> {
    await unlink(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async listFiles(dir: string, pattern = "**/*.md"): Promise<string[]> {
    const dirExists = await this.exists(dir);
    if (!dirExists) return [];

    const glob = new Bun.Glob(pattern);
    const results: string[] = [];
    for await (const entry of glob.scan({ cwd: dir, onlyFiles: true })) {
      results.push(join(dir, entry));
    }
    return results.sort();
  }
}
