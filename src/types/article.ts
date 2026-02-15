import type { Scope } from "./scope.ts";

/** Frontmatter fields of an article */
export interface Frontmatter {
  title: string;
  tags: string[];
  created: string; // ISO 8601
  updated: string; // ISO 8601
  template?: string;
  aliases?: string[];
  draft?: boolean;
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
}

/** Full article: metadata + body */
export interface Article {
  meta: ArticleMeta;
  body: string;
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
  addTags?: string[];
  removeTags?: string[];
  body?: string;
  append?: string;
  draft?: boolean;
  addAlias?: string;
  removeAlias?: string;
  scope?: Scope;
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
