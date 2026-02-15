import { join } from "node:path";
import type { LinkGraph, LinkEntry } from "../types/index.ts";
import type { Scope } from "../types/scope.ts";
import { LocalStorage } from "../storage/local.ts";
import { getScopePaths } from "./scope.ts";

const storage = new LocalStorage();

/** Parsed wiki link from article body */
export interface ParsedWikiLink {
  raw: string; // full match including [[ ]]
  scope: string | null; // "global" | "local" | null
  slug: string; // target slug
  displayText: string | null; // alias text after |
}

/** Regex for [[scope:slug|display]] wiki links */
const WIKI_LINK_RE = /\[\[(?:([a-z]+):)?([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Parse all wiki links from a markdown body */
export function parseWikiLinks(body: string): ParsedWikiLink[] {
  const links: ParsedWikiLink[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for safety
  WIKI_LINK_RE.lastIndex = 0;

  while ((match = WIKI_LINK_RE.exec(body)) !== null) {
    links.push({
      raw: match[0]!,
      scope: match[1] ?? null,
      slug: match[2]!.trim(),
      displayText: match[3]?.trim() ?? null,
    });
  }

  return links;
}

/** Load the link graph for a scope */
export async function loadLinkGraph(scopeRoot: string): Promise<LinkGraph> {
  const paths = getScopePaths(scopeRoot);
  try {
    const raw = await storage.readFile(paths.linksFile);
    return JSON.parse(raw);
  } catch {
    return { forward: {}, backlinks: {} };
  }
}

/** Save the link graph for a scope */
export async function saveLinkGraph(
  scopeRoot: string,
  graph: LinkGraph,
): Promise<void> {
  const paths = getScopePaths(scopeRoot);
  await storage.writeFile(paths.linksFile, JSON.stringify(graph, null, 2));
}

/** Update forward links for an article and recompute backlinks */
export async function updateLinks(
  scopeRoot: string,
  slug: string,
  parsedLinks: ParsedWikiLink[],
  fromScope: Scope,
): Promise<void> {
  const graph = await loadLinkGraph(scopeRoot);

  // Remove old backlinks pointing from this slug
  removeBacklinksFrom(graph, slug, fromScope);

  // Set new forward links
  const entries: LinkEntry[] = parsedLinks.map((link) => ({
    slug: link.slug,
    scope: link.scope,
    displayText: link.displayText ?? undefined,
  }));

  if (entries.length > 0) {
    graph.forward[slug] = entries;
  } else {
    delete graph.forward[slug];
  }

  // Rebuild backlinks from this slug
  for (const entry of entries) {
    const targetSlug = entry.slug;
    if (!graph.backlinks[targetSlug]) {
      graph.backlinks[targetSlug] = [];
    }
    // Avoid duplicate backlinks
    const existing = graph.backlinks[targetSlug]!.find(
      (b) => b.slug === slug && b.scope === fromScope,
    );
    if (!existing) {
      graph.backlinks[targetSlug]!.push({ slug, scope: fromScope });
    }
  }

  await saveLinkGraph(scopeRoot, graph);
}

/** Remove all forward links and backlinks for a deleted article */
export async function removeLinks(
  scopeRoot: string,
  slug: string,
  fromScope: Scope,
): Promise<void> {
  const graph = await loadLinkGraph(scopeRoot);

  // Remove forward links
  delete graph.forward[slug];

  // Remove backlinks pointing from this slug
  removeBacklinksFrom(graph, slug, fromScope);

  // Remove backlinks pointing to this slug (they become dangling)
  delete graph.backlinks[slug];

  await saveLinkGraph(scopeRoot, graph);
}

/** Get forward links for an article */
export async function getForwardLinks(
  scopeRoot: string,
  slug: string,
): Promise<LinkEntry[]> {
  const graph = await loadLinkGraph(scopeRoot);
  return graph.forward[slug] ?? [];
}

/** Get backlinks for an article */
export async function getBacklinks(
  scopeRoot: string,
  slug: string,
): Promise<Array<{ slug: string; scope: string }>> {
  const graph = await loadLinkGraph(scopeRoot);
  return graph.backlinks[slug] ?? [];
}

/** Helper: remove all backlink entries that point FROM a given slug */
function removeBacklinksFrom(
  graph: LinkGraph,
  fromSlug: string,
  fromScope: Scope,
): void {
  for (const [targetSlug, backlinks] of Object.entries(graph.backlinks)) {
    graph.backlinks[targetSlug] = backlinks.filter(
      (b) => !(b.slug === fromSlug && b.scope === fromScope),
    );
    if (graph.backlinks[targetSlug]!.length === 0) {
      delete graph.backlinks[targetSlug];
    }
  }
}

/** Check for cross-scope link warnings (global -> local is discouraged) */
export function checkCrossScopeWarnings(
  parsedLinks: ParsedWikiLink[],
  fromScope: Scope,
): string[] {
  const warnings: string[] = [];
  if (fromScope === "global") {
    for (const link of parsedLinks) {
      if (link.scope === "local") {
        warnings.push(
          `Warning: global article links to local '${link.slug}'. Global articles should not depend on local scope.`,
        );
      }
    }
  }
  return warnings;
}
