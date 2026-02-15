/** Abstract storage interface for file operations */
export interface StorageAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  listFiles(dir: string, pattern?: string): Promise<string[]>;
}
