import { readdir, mkdir, unlink, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { StorageAdapter } from "./adapter.ts";

/** Local filesystem storage adapter */
export class LocalStorage implements StorageAdapter {
  async readFile(path: string): Promise<string> {
    return Bun.file(path).text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    await Bun.write(path, content);
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
