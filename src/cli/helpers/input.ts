import { LocalStorage } from "../../storage/local.ts";

const storage = new LocalStorage();

/** Read body content from a file path or stdin ("-") */
export async function readBody(source: string): Promise<string> {
  if (source === "-") {
    return readStdin();
  }
  return storage.readFile(source);
}

/** Read all input from stdin */
async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Bun.stdin.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
