import type { Scope } from "./scope.ts";

/** Known frontmatter fields that kami manages explicitly */
export const KNOWN_FRONTMATTER_KEYS = [
  "title",
  "tags",
  "created",
  "updated",
  "template",
  "aliases",
  "draft",
] as const;

/** Frontmatter fields of an article (custom keys are passed through) */
export interface Frontmatter {
  title: string;
  tags: string[];
  created: string; // ISO 8601
  updated: string; // ISO 8601
  template?: string;
  aliases?: string[];
  draft?: boolean;
  [key: string]: unknown;
}

/** Metadata stored in index.json (frontmatter + location) */
export interface ArticleMeta {
  slug: string;
  title: string;
  folder: string;
  tags: string[];
  created: string;
  updated: string;
  template?: string;
  aliases?: string[];
  draft?: boolean;
  filePath: string;
  /** Custom (non-known) frontmatter keys, mirrored to enable --where filtering. */
  custom?: Record<string, unknown>;
}

/** Full article: metadata + body + parsed frontmatter (incl. custom keys) */
export interface Article {
  meta: ArticleMeta;
  body: string;
  frontmatter: Frontmatter;
}

/** Article with scope information */
export interface ResolvedArticle extends Article {
  scope: Scope;
}

/** Options for creating an article */
export interface CreateArticleOptions {
  folder?: string;
  tags?: string[];
  template?: string;
  scope?: Scope;
  slug?: string;
  body?: string;
  draft?: boolean;
}

/** Options for updating an article */
export interface UpdateArticleOptions {
  title?: string;
  slug?: string;
  addTags?: string[];
  removeTags?: string[];
  body?: string;
  append?: string;
  draft?: boolean;
  addAlias?: string;
  removeAlias?: string;
  scope?: Scope;
  /** Section heading (exact-or-prefix match) to scope edits to. */
  section?: string;
  /** Replace the section body when `section` is set. */
  sectionReplace?: string;
  /** Insert content above the section heading line. */
  sectionInsertBefore?: string;
}

/** Options for listing articles */
export interface ListArticlesOptions {
  folder?: string;
  tags?: string[];
  sort?: "created" | "updated" | "title";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  scope?: Scope;
  draft?: boolean;
}
