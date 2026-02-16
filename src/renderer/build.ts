import { join } from "node:path";
import { renderToString } from "react-dom/server";
import React from "react";
import type { Scope } from "@/types/scope.ts";
import type { MetadataIndex } from "@/types/index.ts";
import type { ArticleMeta } from "@/types/article.ts";
import { resolveScope, getScopePaths, getScopeRoot } from "@/core/scope.ts";
import { loadIndex, queryIndex } from "@/core/index-manager.ts";
import { readArticle } from "@/core/article.ts";
import { parseWikiLinks } from "@/core/linker.ts";
import { getBacklinks, loadLinkGraph } from "@/core/linker.ts";
import { renderFullPage } from "./render.ts";
import { ArticlePage } from "./components/ArticlePage.tsx";
import { HomePage } from "./components/HomePage.tsx";
import { TagsPage } from "./components/TagsPage.tsx";
import { LocalStorage } from "@/storage/local.ts";

// remark/rehype pipeline
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const storage = new LocalStorage();

export interface BuildOptions {
  slug?: string;
  scope?: Scope;
  clean?: boolean;
  outDir?: string;
  cwd?: string;
}

export interface BuildResult {
  pagesBuilt: number;
  outDir: string;
}

/**
 * Wiki リンクを WebUI 内部リンクに変換する。
 * [[slug]] → [title](/articles/{scope}/{folder}/{slug})
 * ダングリングリンク → <span class="text-warning">slug</span>
 */
export function resolveWikiLinksForWeb(
  body: string,
  localIndex: MetadataIndex,
  globalIndex: MetadataIndex,
  currentScope: Scope,
): string {
  const links = parseWikiLinks(body);
  let result = body;

  // Process in reverse to preserve string positions
  const sorted = [...links].sort(
    (a, b) => body.lastIndexOf(b.raw) - body.lastIndexOf(a.raw),
  );

  for (const link of sorted) {
    // Determine which index to search
    const targetScope = link.scope as Scope | null;
    let meta: ArticleMeta | undefined;
    let resolvedScope: Scope = currentScope;

    if (targetScope) {
      // Explicit scope
      const idx = targetScope === "local" ? localIndex : globalIndex;
      meta = idx.articles[link.slug];
      resolvedScope = targetScope;
    } else {
      // Search local first, then global
      meta = localIndex.articles[link.slug];
      if (meta) {
        resolvedScope = "local";
      } else {
        meta = globalIndex.articles[link.slug];
        if (meta) {
          resolvedScope = "global";
        }
      }
    }

    if (meta) {
      const displayText = link.displayText ?? meta.title;
      const href = `/articles/${resolvedScope}/${meta.folder}/${link.slug}`;
      const replacement = `[${displayText}](${href})`;
      result = result.replace(link.raw, replacement);
    } else {
      // Dangling link
      const displayText = link.displayText ?? link.slug;
      result = result.replace(link.raw, displayText);
    }
  }

  return result;
}

/** Convert Markdown to HTML using remark/rehype */
async function markdownToHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);
  return String(result);
}

/** Build static HTML pages */
export async function buildStaticSite(
  options: BuildOptions = {},
): Promise<BuildResult> {
  const outDir = options.outDir ?? "dist";
  const { scopes, localRoot, globalRoot } = await resolveScope(
    options.scope ?? "all",
    "read",
    options.cwd,
  );

  // Clean output directory if requested
  if (options.clean) {
    try {
      const { rmSync } = await import("node:fs");
      rmSync(outDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  }

  // Ensure output directories exist
  await storage.mkdir(join(outDir, "assets"));
  await storage.mkdir(join(outDir, "articles"));
  await storage.mkdir(join(outDir, "tags"));

  // Load indices for all scopes
  const localIndex: MetadataIndex = localRoot
    ? await loadIndex(localRoot)
    : { articles: {} };
  const globalIndex: MetadataIndex = await loadIndex(globalRoot);

  let pagesBuilt = 0;

  if (options.slug) {
    // Incremental build: single article
    pagesBuilt += await buildSingleArticlePage(
      options.slug,
      scopes,
      localRoot,
      globalRoot,
      localIndex,
      globalIndex,
      outDir,
      options.cwd,
    );
  } else {
    // Full build: all articles
    pagesBuilt += await buildAllArticlePages(
      scopes,
      localRoot,
      globalRoot,
      localIndex,
      globalIndex,
      outDir,
    );
  }

  // Always rebuild home and tags pages
  pagesBuilt += await buildHomePage(localIndex, globalIndex, scopes, localRoot, globalRoot, outDir);
  pagesBuilt += await buildTagsPage(localIndex, globalIndex, scopes, localRoot, globalRoot, outDir);

  return { pagesBuilt, outDir };
}

async function buildSingleArticlePage(
  slug: string,
  scopes: Scope[],
  localRoot: string | null,
  globalRoot: string,
  localIndex: MetadataIndex,
  globalIndex: MetadataIndex,
  outDir: string,
  cwd?: string,
): Promise<number> {
  try {
    const article = await readArticle(slug, undefined, cwd);
    if (article.meta.draft) return 0;

    await buildArticlePage(
      article.meta,
      article.body,
      article.scope,
      localRoot,
      globalRoot,
      localIndex,
      globalIndex,
      outDir,
    );
    return 1;
  } catch {
    return 0;
  }
}

async function buildAllArticlePages(
  scopes: Scope[],
  localRoot: string | null,
  globalRoot: string,
  localIndex: MetadataIndex,
  globalIndex: MetadataIndex,
  outDir: string,
): Promise<number> {
  let count = 0;

  for (const scope of scopes) {
    const root = scope === "local" ? localRoot! : globalRoot;
    const { articles } = await queryIndex(root, { draft: false });

    const promises = articles.map(async (meta) => {
      try {
        const content = await storage.readFile(meta.filePath);
        const { body } = await import("@/core/frontmatter.ts").then((m) =>
          m.parseFrontmatter(content),
        );

        await buildArticlePage(
          meta,
          body,
          scope,
          localRoot,
          globalRoot,
          localIndex,
          globalIndex,
          outDir,
        );
        return 1;
      } catch {
        return 0;
      }
    });

    const results = await Promise.all(promises);
    count += results.reduce<number>((a, b) => a + b, 0);
  }

  return count;
}

async function buildArticlePage(
  meta: ArticleMeta,
  body: string,
  scope: Scope,
  localRoot: string | null,
  globalRoot: string,
  localIndex: MetadataIndex,
  globalIndex: MetadataIndex,
  outDir: string,
): Promise<void> {
  // Resolve wiki links for web
  const resolvedBody = resolveWikiLinksForWeb(
    body,
    localIndex,
    globalIndex,
    scope,
  );

  // Convert markdown to HTML
  const bodyHtml = await markdownToHtml(resolvedBody);

  // Get backlinks
  const scopeRoot = scope === "local" ? localRoot! : globalRoot;
  const rawBacklinks = await getBacklinks(scopeRoot, meta.slug);

  // Resolve backlink metadata
  const backlinks = rawBacklinks
    .map((bl) => {
      const blScope = bl.scope as Scope;
      const idx = blScope === "local" ? localIndex : globalIndex;
      const blMeta = idx.articles[bl.slug];
      if (!blMeta) return null;
      return {
        slug: bl.slug,
        scope: blScope,
        title: blMeta.title,
        folder: blMeta.folder,
      };
    })
    .filter((bl): bl is NonNullable<typeof bl> => bl !== null);

  // Render the page
  const html = renderToString(
    React.createElement(ArticlePage, {
      article: {
        slug: meta.slug,
        title: meta.title,
        tags: meta.tags,
        created: meta.created,
        updated: meta.updated,
        folder: meta.folder,
        scope,
      },
      bodyHtml,
      backlinks,
    }),
  );

  const fullHtml = renderFullPage({
    title: meta.title,
    bodyHtml: html,
  });

  // Write file
  const articleDir = join(outDir, "articles", scope, meta.folder);
  await storage.mkdir(articleDir);
  await storage.writeFile(join(articleDir, `${meta.slug}.html`), fullHtml);
}

async function buildHomePage(
  localIndex: MetadataIndex,
  globalIndex: MetadataIndex,
  scopes: Scope[],
  localRoot: string | null,
  globalRoot: string,
  outDir: string,
): Promise<number> {
  // Collect all non-draft articles from both scopes
  const allArticles: Array<{
    slug: string;
    title: string;
    scope: Scope;
    folder: string;
    tags: string[];
    updated: string;
  }> = [];

  for (const scope of scopes) {
    const index = scope === "local" ? localIndex : globalIndex;
    for (const meta of Object.values(index.articles)) {
      if (meta.draft) continue;
      allArticles.push({
        slug: meta.slug,
        title: meta.title,
        scope,
        folder: meta.folder,
        tags: meta.tags,
        updated: meta.updated,
      });
    }
  }

  // Sort by updated descending, take top 20
  allArticles.sort((a, b) => b.updated.localeCompare(a.updated));
  const recentArticles = allArticles.slice(0, 20);

  // Build tag cloud
  const tagCounts = new Map<string, number>();
  for (const article of allArticles) {
    for (const tag of article.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tagCloud = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  const html = renderToString(
    React.createElement(HomePage, { recentArticles, tagCloud }),
  );

  const fullHtml = renderFullPage({
    title: "kami",
    bodyHtml: html,
  });

  await storage.writeFile(join(outDir, "index.html"), fullHtml);
  return 1;
}

async function buildTagsPage(
  localIndex: MetadataIndex,
  globalIndex: MetadataIndex,
  scopes: Scope[],
  localRoot: string | null,
  globalRoot: string,
  outDir: string,
): Promise<number> {
  // Group articles by tag
  const tagMap = new Map<
    string,
    Array<{ slug: string; title: string; scope: Scope; folder: string }>
  >();

  for (const scope of scopes) {
    const index = scope === "local" ? localIndex : globalIndex;
    for (const meta of Object.values(index.articles)) {
      if (meta.draft) continue;
      for (const tag of meta.tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, []);
        }
        tagMap.get(tag)!.push({
          slug: meta.slug,
          title: meta.title,
          scope,
          folder: meta.folder,
        });
      }
    }
  }

  const tags = [...tagMap.entries()]
    .map(([tag, articles]) => ({ tag, articles }))
    .sort((a, b) => a.tag.localeCompare(b.tag));

  const html = renderToString(
    React.createElement(TagsPage, { tags }),
  );

  const fullHtml = renderFullPage({
    title: "Tags",
    bodyHtml: html,
  });

  await storage.writeFile(join(outDir, "tags", "index.html"), fullHtml);
  return 1;
}
