import { join, relative, dirname, basename } from "node:path";
import type {
  Article,
  ArticleMeta,
  ResolvedArticle,
  CreateArticleOptions,
  UpdateArticleOptions,
  Frontmatter,
} from "../types/article.ts";
import type { Scope } from "../types/scope.ts";
import { KamiError, EXIT_CODES } from "../types/result.ts";
import { LocalStorage } from "../storage/local.ts";
import {
  parseFrontmatter,
  serializeFrontmatter,
  generateFrontmatter,
} from "./frontmatter.ts";
import {
  resolveScope,
  getScopePaths,
  getScopeRoot,
  ensureGlobalScope,
  getGlobalRoot,
} from "./scope.ts";
import {
  readTemplate,
  expandTemplate,
  buildTemplateVariables,
} from "./template.ts";
import { loadIndex } from "./index-manager.ts";

const storage = new LocalStorage();

// Characters not allowed in file names
const INVALID_CHARS = /[/\\:*?"<>|]/g;

/** Sanitize a title to create a valid slug */
export function titleToSlug(title: string): string {
  return title.trim().replace(INVALID_CHARS, "-");
}

/** Resolve a slug to a file path and scope, searching across scopes */
export async function resolveSlug(
  slug: string,
  scope?: Scope,
  cwd?: string,
): Promise<{ filePath: string; scope: Scope; meta: ArticleMeta }> {
  const { scopes, localRoot, globalRoot } = await resolveScope(
    scope,
    "read",
    cwd,
  );

  const candidates: Array<{ filePath: string; scope: Scope; meta: ArticleMeta }> = [];

  for (const s of scopes) {
    const root = s === "local" ? localRoot! : globalRoot;

    // Load index (converts stored relative paths to absolute)
    const indexData = await loadIndex(root);

    // Search in index: by slug (exact key match)
    if (indexData.articles[slug]) {
      const meta = indexData.articles[slug]!;
      candidates.push({ filePath: meta.filePath, scope: s, meta });
      continue;
    }

    // Search by folder/slug path
    for (const [key, meta] of Object.entries(indexData.articles)) {
      const folderSlug = meta.folder ? `${meta.folder}/${key}` : key;
      if (folderSlug === slug) {
        candidates.push({ filePath: meta.filePath, scope: s, meta });
        break;
      }
    }

    // Search by title (exact match)
    if (candidates.length === 0) {
      for (const [, meta] of Object.entries(indexData.articles)) {
        if (meta.title === slug) {
          candidates.push({ filePath: meta.filePath, scope: s, meta });
          break;
        }
      }
    }

    // Search by alias
    if (candidates.length === 0) {
      for (const [, meta] of Object.entries(indexData.articles)) {
        if (meta.aliases?.includes(slug)) {
          candidates.push({ filePath: meta.filePath, scope: s, meta });
          break;
        }
      }
    }

    // If we found in this scope, don't search further (local-first)
    if (candidates.length > 0) break;
  }

  if (candidates.length === 0) {
    throw new KamiError(
      `Article '${slug}' not found`,
      "ARTICLE_NOT_FOUND",
      EXIT_CODES.NOT_FOUND,
    );
  }

  if (candidates.length > 1) {
    throw new KamiError(
      `Slug '${slug}' is ambiguous`,
      "AMBIGUOUS_SLUG",
      EXIT_CODES.AMBIGUOUS,
      candidates.map((c) => `${c.scope}:${c.meta.slug}`),
    );
  }

  return candidates[0]!;
}

/** Read an article by slug */
export async function readArticle(
  slug: string,
  scope?: Scope,
  cwd?: string,
): Promise<ResolvedArticle> {
  const resolved = await resolveSlug(slug, scope, cwd);
  const content = await storage.readFile(resolved.filePath);
  const { frontmatter, body } = parseFrontmatter(content);

  return {
    meta: {
      ...resolved.meta,
      // Refresh from actual file content
      title: frontmatter.title,
      tags: frontmatter.tags,
      created: frontmatter.created,
      updated: frontmatter.updated,
      template: frontmatter.template,
      aliases: frontmatter.aliases,
      draft: frontmatter.draft,
    },
    body,
    scope: resolved.scope,
  };
}

/** Create a new article */
export async function createArticle(
  title: string,
  options: CreateArticleOptions = {},
  cwd?: string,
): Promise<ResolvedArticle> {
  const { scopes, localRoot, globalRoot } = await resolveScope(
    options.scope,
    "write",
    cwd,
  );
  const targetScope = scopes[0]!;
  const root =
    targetScope === "local" ? localRoot! : await ensureGlobalScope();
  const paths = getScopePaths(root);

  // Generate slug
  let slug = options.slug ?? titleToSlug(title);

  // Determine file path
  const folder = options.folder ?? "";
  const dir = folder ? join(paths.vault, folder) : paths.vault;
  await storage.mkdir(dir);

  // Handle duplicate slugs
  let filePath = join(dir, `${slug}.md`);
  let counter = 1;
  while (await storage.exists(filePath)) {
    slug = `${options.slug ?? titleToSlug(title)}-${counter}`;
    filePath = join(dir, `${slug}.md`);
    counter++;
  }

  // Generate frontmatter
  const frontmatter = generateFrontmatter(title, {
    tags: options.tags,
    template: options.template ?? "note",
    draft: options.draft,
  });

  // Get body from template or options
  let body = "";
  if (options.body) {
    body = options.body;
  } else {
    // Try to load and expand template
    const templateName = options.template ?? "note";
    const scopeRoots = [
      ...(localRoot ? [{ scope: "local" as const, root: localRoot }] : []),
      { scope: "global" as const, root: getGlobalRoot() },
    ];
    const tpl = await readTemplate(templateName, scopeRoots);
    if (tpl) {
      const vars = buildTemplateVariables(title, folder);
      const expanded = expandTemplate(tpl.content, vars);
      // Parse expanded template: extract body (after frontmatter)
      try {
        const { body: tplBody } = parseFrontmatter(expanded);
        body = tplBody;
      } catch {
        // Template has no frontmatter, use as-is
        body = expanded;
      }
    } else {
      body = `# ${title}`;
    }
  }

  // Write file
  const content = serializeFrontmatter(frontmatter, body);
  await storage.writeFile(filePath, content);

  const meta: ArticleMeta = {
    slug,
    title,
    folder,
    tags: frontmatter.tags,
    created: frontmatter.created,
    updated: frontmatter.updated,
    template: frontmatter.template,
    aliases: frontmatter.aliases,
    draft: frontmatter.draft,
    filePath,
  };

  return { meta, body, scope: targetScope };
}

/** Update an existing article */
export async function updateArticle(
  slug: string,
  changes: UpdateArticleOptions,
  cwd?: string,
): Promise<ResolvedArticle> {
  if (changes.body !== undefined && changes.append !== undefined) {
    throw new KamiError(
      "Cannot specify both --body and --append",
      "VALIDATION_ERROR",
      EXIT_CODES.GENERAL_ERROR,
    );
  }

  const article = await readArticle(slug, changes.scope, cwd);

  // Apply metadata changes
  const fm: Frontmatter = { ...article.meta };

  if (changes.title !== undefined) fm.title = changes.title;

  if (changes.addTags) {
    fm.tags = [...new Set([...fm.tags, ...changes.addTags])];
  }
  if (changes.removeTags) {
    fm.tags = fm.tags.filter((t) => !changes.removeTags!.includes(t));
  }

  if (changes.draft !== undefined) fm.draft = changes.draft;

  if (changes.addAlias) {
    fm.aliases = [...new Set([...(fm.aliases ?? []), changes.addAlias])];
  }
  if (changes.removeAlias) {
    fm.aliases = (fm.aliases ?? []).filter((a) => a !== changes.removeAlias);
    if (fm.aliases.length === 0) fm.aliases = undefined;
  }

  // Update timestamp
  fm.updated = new Date().toISOString();

  // Apply body changes
  let body = article.body;
  if (changes.body !== undefined) {
    body = changes.body;
  } else if (changes.append !== undefined) {
    body = body ? `${body}\n\n${changes.append}` : changes.append;
  }

  // Write back
  const content = serializeFrontmatter(fm, body);
  await storage.writeFile(article.meta.filePath, content);

  const updatedMeta: ArticleMeta = {
    ...article.meta,
    title: fm.title,
    tags: fm.tags,
    updated: fm.updated,
    aliases: fm.aliases,
    draft: fm.draft,
  };

  return { meta: updatedMeta, body, scope: article.scope };
}

/** Delete an article */
export async function deleteArticle(
  slug: string,
  scope?: Scope,
  cwd?: string,
): Promise<{ meta: ArticleMeta; scope: Scope }> {
  const resolved = await resolveSlug(slug, scope, cwd);
  await storage.deleteFile(resolved.filePath);
  return { meta: resolved.meta, scope: resolved.scope };
}
