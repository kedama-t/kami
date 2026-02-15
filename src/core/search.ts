import MiniSearch from "minisearch";
import { loadDefaultJapaneseParser } from "budoux";
import type { ArticleMeta } from "../types/article.ts";
import type { Scope } from "../types/scope.ts";
import { LocalStorage } from "../storage/local.ts";
import { getScopePaths } from "./scope.ts";
import { loadIndex } from "./index-manager.ts";
import { parseFrontmatter } from "./frontmatter.ts";

const storage = new LocalStorage();

/** BudouX parser for Japanese text segmentation */
const jaParser = loadDefaultJapaneseParser();

/** Tokenize text: split on whitespace and use BudouX for CJK runs */
const CJK_RE =
  /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf\uff00-\uffef]/;

export function tokenize(text: string): string[] {
  // First split on whitespace and punctuation boundaries
  const roughTokens = text.split(/[\s,.;:!?()[\]{}"'`~@#$%^&*+=<>/\\|]+/);
  const tokens: string[] = [];

  for (const token of roughTokens) {
    if (!token) continue;

    // If token contains CJK characters, use BudouX to segment
    if (CJK_RE.test(token)) {
      const segments = jaParser.parse(token);
      for (const seg of segments) {
        const trimmed = seg.trim();
        if (trimmed) tokens.push(trimmed.toLowerCase());
      }
    } else {
      tokens.push(token.toLowerCase());
    }
  }

  return tokens;
}

/** Document shape for MiniSearch */
interface SearchDocument {
  id: string;
  title: string;
  body: string;
  tags: string;
  aliases: string;
}

/** Create a new MiniSearch instance with our configuration */
function createMiniSearch(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ["title", "body", "tags", "aliases"],
    storeFields: ["title", "tags"],
    tokenize,
    searchOptions: {
      boost: { title: 3, tags: 2, aliases: 2 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
}

/** Build search index for a scope by reading all articles */
export async function buildSearchIndex(
  scopeRoot: string,
): Promise<MiniSearch<SearchDocument>> {
  const paths = getScopePaths(scopeRoot);
  const index = await loadIndex(scopeRoot);
  const miniSearch = createMiniSearch();

  const docs: SearchDocument[] = [];

  for (const [slug, meta] of Object.entries(index.articles)) {
    try {
      const content = await storage.readFile(meta.filePath);
      const { body } = parseFrontmatter(content);

      docs.push({
        id: slug,
        title: meta.title,
        body,
        tags: meta.tags.join(" "),
        aliases: (meta.aliases ?? []).join(" "),
      });
    } catch {
      // Skip unreadable files
    }
  }

  miniSearch.addAll(docs);
  return miniSearch;
}

/** Add a single article to an existing search index */
export function addToSearchIndex(
  miniSearch: MiniSearch<SearchDocument>,
  slug: string,
  title: string,
  body: string,
  tags: string[],
  aliases: string[],
): void {
  // Remove existing entry if present
  try {
    miniSearch.discard(slug);
  } catch {
    // Not in index, that's fine
  }

  miniSearch.add({
    id: slug,
    title,
    body,
    tags: tags.join(" "),
    aliases: aliases.join(" "),
  });
}

/** Remove an article from the search index */
export function removeFromSearchIndex(
  miniSearch: MiniSearch<SearchDocument>,
  slug: string,
): void {
  try {
    miniSearch.discard(slug);
  } catch {
    // Not in index
  }
}

/** Search result with scope */
export interface SearchResult {
  slug: string;
  title: string;
  scope: Scope;
  folder: string;
  score: number;
  tags: string[];
  matches: {
    body: string[];
    title: string[];
  };
}

/** Execute a search across one or more scopes */
export async function search(
  query: string,
  options: {
    scopes: Array<{ scope: Scope; root: string }>;
    tags?: string[];
    folder?: string;
    limit?: number;
  },
): Promise<{ results: SearchResult[]; total: number; query: string }> {
  const allResults: SearchResult[] = [];

  for (const { scope, root } of options.scopes) {
    const index = await loadIndex(root);
    const miniSearch = await buildSearchIndex(root);

    const results = miniSearch.search(query);

    for (const result of results) {
      const meta = index.articles[result.id];
      if (!meta) continue;

      // Apply tag filter
      if (options.tags && options.tags.length > 0) {
        if (!options.tags.every((t) => meta.tags.includes(t))) continue;
      }

      // Apply folder filter
      if (options.folder && meta.folder !== options.folder) continue;

      // Extract match snippets
      const bodyMatches: string[] = [];
      const titleMatches: string[] = [];
      if (result.match) {
        for (const [term, fields] of Object.entries(result.match)) {
          if ((fields as string[]).includes("title")) {
            titleMatches.push(term);
          }
          if ((fields as string[]).includes("body")) {
            bodyMatches.push(term);
          }
        }
      }

      allResults.push({
        slug: result.id,
        title: meta.title,
        scope,
        folder: meta.folder,
        score: Math.round(result.score * 10) / 10,
        tags: meta.tags,
        matches: {
          body: bodyMatches,
          title: titleMatches,
        },
      });
    }
  }

  // Sort by score descending
  allResults.sort((a, b) => b.score - a.score);

  const limit = options.limit ?? 20;
  const total = allResults.length;

  return {
    results: allResults.slice(0, limit),
    total,
    query,
  };
}
