import { Hono } from "hono";
import React from "react";
import type { Scope } from "@/types/scope.ts";
import { readArticle } from "@/core/article.ts";
import { search } from "@/core/search.ts";
import { loadIndex, queryIndex } from "@/core/index-manager.ts";
import { listTemplates } from "@/core/template.ts";
import { renderPage } from "@/renderer/render.ts";
import { SearchPage } from "@/renderer/components/SearchPage.tsx";
import { EditPage } from "@/renderer/components/EditPage.tsx";
import { CreatePage } from "@/renderer/components/CreatePage.tsx";
import { scopeMiddleware, type ScopeVariables } from "../middleware/scope.ts";

const pages = new Hono<{ Variables: ScopeVariables }>();

pages.use("*", scopeMiddleware);

// Edit page (SSR)
pages.get("/articles/:scope/:folder{.+}/:slug/edit", async (c) => {
  try {
    const { scope, slug } = c.req.param();
    const article = await readArticle(slug, scope as Scope);

    const html = renderPage(
      React.createElement(EditPage, {
        article: {
          slug: article.meta.slug,
          title: article.meta.title,
          tags: article.meta.tags,
          body: article.body,
          draft: article.meta.draft ?? false,
          folder: article.meta.folder,
          scope: article.scope,
        },
      }),
      {
        title: `Edit: ${article.meta.title}`,
        scripts: ["/assets/edit.js"],
      },
    );

    return c.html(html);
  } catch {
    return c.text("Article not found", 404);
  }
});

// Create page (SSR)
pages.get("/new", async (c) => {
  const scopes = c.get("scopes");
  const localRoot = c.get("localRoot");
  const globalRoot = c.get("globalRoot");

  const scopeRoots = scopes.map((s) => ({
    scope: s,
    root: s === "local" ? localRoot! : globalRoot,
  }));

  const templates = await listTemplates(scopeRoots);

  // Collect existing folders
  const folders = new Set<string>();
  for (const { root } of scopeRoots) {
    const index = await loadIndex(root);
    for (const meta of Object.values(index.articles)) {
      if (meta.folder) folders.add(meta.folder);
    }
  }

  const defaultScope: Scope = localRoot ? "local" : "global";

  const html = renderPage(
    React.createElement(CreatePage, {
      templates: templates.map((t) => ({ name: t.name, scope: t.scope })),
      folders: [...folders].sort(),
      defaultScope,
    }),
    {
      title: "New Article",
      scripts: ["/assets/edit.js"],
    },
  );

  return c.html(html);
});

// Search page (SSR)
pages.get("/search", async (c) => {
  const query = c.req.query("q") ?? "";
  const scopeFilter = c.req.query("scope") ?? "all";
  const tag = c.req.query("tag");

  const scopes = c.get("scopes");
  const localRoot = c.get("localRoot");
  const globalRoot = c.get("globalRoot");

  let filteredScopes = scopes;
  if (scopeFilter === "local" || scopeFilter === "global") {
    filteredScopes = scopes.filter((s) => s === scopeFilter);
  }

  const scopeRoots = filteredScopes.map((s) => ({
    scope: s,
    root: s === "local" ? localRoot! : globalRoot,
  }));

  let results: { results: Array<{ slug: string; title: string; scope: Scope; folder: string; tags: string[]; score: number }>; total: number; query: string } = {
    results: [],
    total: 0,
    query,
  };

  if (query) {
    results = await search(query, {
      scopes: scopeRoots,
      tags: tag ? [tag] : undefined,
    });
  }

  const html = renderPage(
    React.createElement(SearchPage, {
      query,
      results: results.results,
      total: results.total,
      scope: scopeFilter,
    }),
    {
      title: query ? `Search: ${query}` : "Search",
    },
  );

  return c.html(html);
});

export { pages as pageRoutes };
