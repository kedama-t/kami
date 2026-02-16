import { Hono } from "hono";
import type { Scope } from "../../types/scope.ts";
import type { ErrorCode } from "../../types/result.ts";
import { KamiError } from "../../types/result.ts";
import { createArticle, readArticle, updateArticle, deleteArticle } from "../../core/article.ts";
import { search } from "../../core/search.ts";
import { getScopeRoot } from "../../core/scope.ts";
import { upsertInIndex, removeFromIndex } from "../../core/index-manager.ts";
import { parseWikiLinks, updateLinks, removeLinks, getBacklinks } from "../../core/linker.ts";
import { buildStaticSite } from "../../renderer/build.ts";
import { scopeMiddleware, type ScopeVariables } from "../middleware/scope.ts";

// remark/rehype pipeline for preview
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

type HttpStatus = 200 | 201 | 400 | 404 | 409 | 422 | 500;

function errorToStatus(code: ErrorCode): HttpStatus {
  const map: Record<string, HttpStatus> = {
    ARTICLE_NOT_FOUND: 404,
    AMBIGUOUS_SLUG: 409,
    ARTICLE_ALREADY_EXISTS: 409,
    TEMPLATE_NOT_FOUND: 404,
    SCOPE_NOT_FOUND: 404,
    INVALID_FRONTMATTER: 422,
    HOOK_BLOCKED: 409,
    VALIDATION_ERROR: 400,
    IO_ERROR: 500,
  };
  return map[code] ?? 500;
}

const api = new Hono<{ Variables: ScopeVariables }>();

api.use("*", scopeMiddleware);

// POST /api/articles — Create article
api.post("/articles", async (c) => {
  try {
    const body = await c.req.json<{
      title: string;
      folder?: string;
      tags?: string[];
      template?: string;
      scope?: Scope;
      slug?: string;
      body?: string;
      draft?: boolean;
    }>();

    if (!body.title) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "title is required" } }, 400);
    }

    const article = await createArticle(body.title, {
      folder: body.folder,
      tags: body.tags,
      template: body.template,
      scope: body.scope,
      slug: body.slug || undefined,
      body: body.body,
      draft: body.draft,
    });

    // Update index and links
    const scopeRoot = await getScopeRoot(article.scope);
    await upsertInIndex(scopeRoot, article.meta);
    const parsedLinks = parseWikiLinks(article.body);
    await updateLinks(scopeRoot, article.meta.slug, parsedLinks, article.scope);

    // Background rebuild
    setTimeout(() => {
      buildStaticSite({ slug: article.meta.slug }).catch(() => {});
    }, 0);

    return c.json({
      ok: true,
      data: {
        slug: article.meta.slug,
        scope: article.scope,
        folder: article.meta.folder,
        title: article.meta.title,
      },
    }, 201);
  } catch (err) {
    if (err instanceof KamiError) {
      return c.json({ ok: false, error: { code: err.code, message: err.message } }, errorToStatus(err.code));
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: { code: "IO_ERROR", message } }, 500);
  }
});

// PUT /api/articles/:scope/:slug — Update article
api.put("/articles/:scope/:slug", async (c) => {
  try {
    const { scope, slug } = c.req.param();
    const body = await c.req.json<{
      title?: string;
      slug?: string;
      body?: string;
      addTags?: string[];
      removeTags?: string[];
      draft?: boolean;
    }>();

    const slugChanged = body.slug !== undefined && body.slug !== slug;

    const article = await updateArticle(slug, {
      title: body.title,
      slug: body.slug,
      body: body.body,
      addTags: body.addTags,
      removeTags: body.removeTags,
      draft: body.draft,
      scope: scope as Scope,
    });

    // Update index and links
    const scopeRoot = await getScopeRoot(article.scope);

    // If slug changed, remove old index entry and links
    if (slugChanged) {
      await removeFromIndex(scopeRoot, slug);
      await removeLinks(scopeRoot, slug, article.scope);
    }

    await upsertInIndex(scopeRoot, article.meta);
    const parsedLinks = parseWikiLinks(article.body);
    await updateLinks(scopeRoot, article.meta.slug, parsedLinks, article.scope);

    // Background rebuild
    setTimeout(() => {
      buildStaticSite({ slug: article.meta.slug }).catch(() => {});
    }, 0);

    return c.json({
      ok: true,
      data: {
        slug: article.meta.slug,
        scope: article.scope,
        folder: article.meta.folder,
        title: article.meta.title,
      },
    });
  } catch (err) {
    if (err instanceof KamiError) {
      return c.json({ ok: false, error: { code: err.code, message: err.message } }, errorToStatus(err.code));
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: { code: "IO_ERROR", message } }, 500);
  }
});

// DELETE /api/articles/:scope/:slug — Delete article
api.delete("/articles/:scope/:slug", async (c) => {
  try {
    const { scope, slug } = c.req.param();
    const scopeTyped = scope as Scope;

    // Get backlinks before deletion
    const scopeRoot = await getScopeRoot(scopeTyped);
    const backlinks = await getBacklinks(scopeRoot, slug);

    const result = await deleteArticle(slug, scopeTyped);

    // Update index and links
    await removeFromIndex(scopeRoot, slug);
    await removeLinks(scopeRoot, slug, scopeTyped);

    // Background rebuild
    setTimeout(() => {
      buildStaticSite().catch(() => {});
    }, 0);

    return c.json({
      ok: true,
      data: {
        slug: result.meta.slug,
        scope: result.scope,
        danglingBacklinks: backlinks.length,
      },
    });
  } catch (err) {
    if (err instanceof KamiError) {
      return c.json({ ok: false, error: { code: err.code, message: err.message } }, errorToStatus(err.code));
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: { code: "IO_ERROR", message } }, 500);
  }
});

// GET /api/search — Full-text search
api.get("/search", async (c) => {
  try {
    const query = c.req.query("q") ?? "";
    const tag = c.req.query("tag");
    const limit = parseInt(c.req.query("limit") ?? "20", 10);

    const scopes = c.get("scopes");
    const localRoot = c.get("localRoot");
    const globalRoot = c.get("globalRoot");

    const scopeRoots = scopes.map((s) => ({
      scope: s,
      root: s === "local" ? localRoot! : globalRoot,
    }));

    if (!query) {
      return c.json({ ok: true, data: { results: [], total: 0, query: "" } });
    }

    const results = await search(query, {
      scopes: scopeRoots,
      tags: tag ? [tag] : undefined,
      limit,
    });

    return c.json({ ok: true, data: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: { code: "IO_ERROR", message } }, 500);
  }
});

// POST /api/preview — Markdown preview
api.post("/preview", async (c) => {
  try {
    const { body: markdown } = await c.req.json<{ body: string }>();

    const result = await unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(markdown ?? "");

    return c.json({ ok: true, data: { html: String(result) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: { code: "IO_ERROR", message } }, 500);
  }
});

export { api as apiRoutes };
