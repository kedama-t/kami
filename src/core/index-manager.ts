import { join, relative, basename, dirname, resolve, isAbsolute } from "node:path";
import { homedir } from "node:os";
import type { MetadataIndex } from "../types/index.ts";
import type { ArticleMeta } from "../types/article.ts";
import type { Scope } from "../types/scope.ts";
import type { ScopePaths } from "../types/scope.ts";
import { LocalStorage } from "../storage/local.ts";
import {
  parseFrontmatter,
  extractCustomFrontmatter,
} from "./frontmatter.ts";
import { getScopePaths, getScopeRoot, getGlobalRoot } from "./scope.ts";

const storage = new LocalStorage();

/** Check if a scope root is the global scope */
function isGlobalScope(scopeRoot: string): boolean {
  return resolve(scopeRoot) === resolve(getGlobalRoot());
}

/** Convert an absolute filePath to a stored relative path */
export function toStoredFilePath(scopeRoot: string, absolutePath: string): string {
  if (isGlobalScope(scopeRoot)) {
    const home = homedir();
    const rel = relative(home, absolutePath);
    return `~/${rel}`;
  } else {
    const projectRoot = dirname(scopeRoot);
    return relative(projectRoot, absolutePath);
  }
}

/** Convert a stored relative path back to an absolute path */
export function fromStoredFilePath(scopeRoot: string, storedPath: string): string {
  if (storedPath.startsWith("~/")) {
    return join(homedir(), storedPath.slice(2));
  } else if (storedPath.startsWith(".kami/") || storedPath.startsWith(".kami\\")) {
    const projectRoot = dirname(scopeRoot);
    return join(projectRoot, storedPath);
  } else if (isAbsolute(storedPath)) {
    // Backwards compatibility: already absolute
    return storedPath;
  } else {
    const projectRoot = dirname(scopeRoot);
    return join(projectRoot, storedPath);
  }
}

/** Load the metadata index for a scope */
export async function loadIndex(scopeRoot: string): Promise<MetadataIndex> {
  const paths = getScopePaths(scopeRoot);
  try {
    const raw = await storage.readFile(paths.indexFile);
    const parsed: MetadataIndex = JSON.parse(raw);
    // Convert stored relative paths back to absolute
    for (const meta of Object.values(parsed.articles)) {
      meta.filePath = fromStoredFilePath(scopeRoot, meta.filePath);
    }
    return parsed;
  } catch {
    return { articles: {} };
  }
}

/** Save the metadata index for a scope */
export async function saveIndex(
  scopeRoot: string,
  index: MetadataIndex,
): Promise<void> {
  const paths = getScopePaths(scopeRoot);
  // Convert absolute paths to relative for storage
  const stored: MetadataIndex = {
    articles: Object.fromEntries(
      Object.entries(index.articles).map(([slug, meta]) => [
        slug,
        { ...meta, filePath: toStoredFilePath(scopeRoot, meta.filePath) },
      ]),
    ),
  };
  await storage.writeFile(paths.indexFile, JSON.stringify(stored, null, 2));
}

/** Add or update an article in the index */
export async function upsertInIndex(
  scopeRoot: string,
  meta: ArticleMeta,
): Promise<void> {
  const index = await loadIndex(scopeRoot);
  index.articles[meta.slug] = meta;
  await saveIndex(scopeRoot, index);
}

/** Remove an article from the index */
export async function removeFromIndex(
  scopeRoot: string,
  slug: string,
): Promise<void> {
  const index = await loadIndex(scopeRoot);
  delete index.articles[slug];
  await saveIndex(scopeRoot, index);
}

/** Rebuild the entire index by scanning all files in the vault */
export async function rebuildIndex(scopeRoot: string): Promise<MetadataIndex> {
  const paths = getScopePaths(scopeRoot);
  const files = await storage.listFiles(paths.vault, "**/*.md");

  const index: MetadataIndex = { articles: {} };

  for (const filePath of files) {
    try {
      const content = await storage.readFile(filePath);
      const { frontmatter } = parseFrontmatter(content);

      const relPath = relative(paths.vault, filePath);
      const slug = basename(filePath, ".md");
      const parts = relPath.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

      const meta: ArticleMeta = {
        slug,
        title: frontmatter.title,
        folder,
        tags: frontmatter.tags,
        created: frontmatter.created,
        updated: frontmatter.updated,
        template: frontmatter.template,
        aliases: frontmatter.aliases,
        draft: frontmatter.draft,
        filePath,
        custom: extractCustomFrontmatter(frontmatter),
      };

      index.articles[slug] = meta;
    } catch {
      // Skip files with invalid frontmatter
    }
  }

  await saveIndex(scopeRoot, index);
  return index;
}

export type WhereClause = { key: string; op: "=" | "!="; value: string };

/**
 * Parse `--where` strings like "key=value" or "key!=value" into clauses.
 * Throws on malformed input. Empty/undefined input returns [].
 */
export function parseWhereClauses(
  raw: string | string[] | undefined,
): WhereClause[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: WhereClause[] = [];
  for (const item of list) {
    const neIdx = item.indexOf("!=");
    if (neIdx > 0) {
      out.push({
        key: item.slice(0, neIdx).trim(),
        op: "!=",
        value: item.slice(neIdx + 2).trim(),
      });
      continue;
    }
    const eqIdx = item.indexOf("=");
    if (eqIdx > 0) {
      out.push({
        key: item.slice(0, eqIdx).trim(),
        op: "=",
        value: item.slice(eqIdx + 1).trim(),
      });
      continue;
    }
    throw new Error(
      `Invalid --where expression: "${item}" (expected key=value or key!=value)`,
    );
  }
  return out;
}

function metaFieldValue(meta: ArticleMeta, key: string): unknown {
  switch (key) {
    case "slug":
    case "title":
    case "folder":
    case "created":
    case "updated":
    case "template":
    case "draft":
      return (meta as unknown as Record<string, unknown>)[key];
    default:
      return meta.custom?.[key];
  }
}

function matchesWhere(meta: ArticleMeta, clauses: WhereClause[]): boolean {
  for (const c of clauses) {
    const raw = metaFieldValue(meta, c.key);
    const actual = raw === undefined || raw === null ? "" : String(raw);
    const match = actual === c.value;
    if (c.op === "=" && !match) return false;
    if (c.op === "!=" && match) return false;
  }
  return true;
}

/** Apply where clauses to a list of metas (exported so search can reuse). */
export function filterByWhere<T extends ArticleMeta>(
  metas: T[],
  clauses: WhereClause[],
): T[] {
  if (clauses.length === 0) return metas;
  return metas.filter((m) => matchesWhere(m, clauses));
}

/** Query the index with filters, sorting, and pagination */
export async function queryIndex(
  scopeRoot: string,
  options: {
    folder?: string;
    tags?: string[];
    sort?: "created" | "updated" | "title";
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
    draft?: boolean;
    where?: WhereClause[];
  } = {},
): Promise<{ articles: ArticleMeta[]; total: number }> {
  const index = await loadIndex(scopeRoot);
  let articles = Object.values(index.articles);

  // Filter by folder
  if (options.folder) {
    articles = articles.filter((a) => a.folder === options.folder);
  }

  // Filter by tags (AND)
  if (options.tags && options.tags.length > 0) {
    articles = articles.filter((a) =>
      options.tags!.every((t) => a.tags.includes(t)),
    );
  }

  // Filter by draft status
  if (options.draft !== undefined) {
    articles = articles.filter((a) => (a.draft ?? false) === options.draft);
  }

  // Filter by --where clauses (custom + known fields)
  if (options.where && options.where.length > 0) {
    articles = filterByWhere(articles, options.where);
  }

  const total = articles.length;

  // Sort
  const sortField = options.sort ?? "updated";
  const order = options.order ?? "desc";
  articles.sort((a, b) => {
    let cmp: number;
    if (sortField === "title") {
      cmp = a.title.localeCompare(b.title);
    } else {
      cmp = a[sortField].localeCompare(b[sortField]);
    }
    return order === "desc" ? -cmp : cmp;
  });

  // Pagination
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 20;
  articles = articles.slice(offset, offset + limit);

  return { articles, total };
}
