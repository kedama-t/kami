import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { ResolvedArticle } from "../types/article.ts";
import type { MetadataIndex } from "../types/index.ts";
import { parseWikiLinks } from "./linker.ts";
import { loadIndex } from "./index-manager.ts";

/**
 * Resolve wiki links in markdown body to standard markdown links.
 * [[slug]] → [title](slug.md)
 * [[slug|text]] → [text](slug.md)
 * [[scope:slug]] → [title](slug.md)
 * Dangling links (not in index) → plain text without link brackets.
 */
export function resolveWikiLinks(
  body: string,
  index: MetadataIndex,
): string {
  const links = parseWikiLinks(body);
  let result = body;

  // Process in reverse to preserve string positions
  const sorted = [...links].sort(
    (a, b) => body.lastIndexOf(b.raw) - body.lastIndexOf(a.raw),
  );

  for (const link of sorted) {
    const articleMeta = index.articles[link.slug];
    if (articleMeta) {
      const displayText = link.displayText ?? articleMeta.title;
      const replacement = `[${displayText}](${link.slug}.md)`;
      result = result.replace(link.raw, replacement);
    } else {
      // Dangling link: keep display text but no link
      const displayText = link.displayText ?? link.slug;
      result = result.replace(link.raw, displayText);
    }
  }

  return result;
}

/**
 * Export article as Markdown with resolved wiki links.
 * @param scopeRoot - the scope root directory to load index from
 */
export async function exportAsMarkdown(
  article: ResolvedArticle,
  scopeRoot: string,
): Promise<string> {
  const index = await loadIndex(scopeRoot);
  return resolveWikiLinks(article.body, index);
}

/**
 * Export article as HTML via remark/rehype pipeline.
 * Wiki links are resolved before parsing.
 * @param scopeRoot - the scope root directory to load index from
 */
export async function exportAsHtml(
  article: ResolvedArticle,
  scopeRoot: string,
): Promise<string> {
  const markdown = await exportAsMarkdown(article, scopeRoot);

  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);

  return String(result);
}
