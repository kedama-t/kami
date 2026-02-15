import type { ArticleMeta } from "./article.ts";

/** Metadata index: slug -> ArticleMeta */
export interface MetadataIndex {
  articles: Record<string, ArticleMeta>;
}

/** A single link entry in the link graph */
export interface LinkEntry {
  /** Target slug */
  slug: string;
  /** Target scope (null if unresolvable) */
  scope: string | null;
  /** Display text (alias part of [[slug|alias]]) */
  displayText?: string;
}

/** Link graph for a scope */
export interface LinkGraph {
  /** Forward links: source slug -> array of link entries */
  forward: Record<string, LinkEntry[]>;
  /** Backlinks: target slug -> array of source slugs with scope */
  backlinks: Record<string, Array<{ slug: string; scope: string }>>;
}
