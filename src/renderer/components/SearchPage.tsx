import React from "react";
import type { Scope } from "../../types/scope.ts";
import { Layout } from "./Layout.tsx";
import { ArticleList } from "./common/ArticleList.tsx";

interface SearchResult {
  slug: string;
  title: string;
  scope: Scope;
  folder: string;
  tags: string[];
  score: number;
}

interface SearchPageProps {
  query: string;
  results: SearchResult[];
  total: number;
  scope: string;
}

export function SearchPage({ query, results, total, scope }: SearchPageProps) {
  return (
    <Layout title={query ? `Search: ${query}` : "Search"} currentPath="/search">
      <h1 className="text-3xl font-bold mb-4">Search</h1>

      <form action="/search" method="GET" className="flex gap-2 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search articles…"
          className="input input-bordered flex-1"
        />
        <select
          name="scope"
          defaultValue={scope}
          className="select select-bordered"
        >
          <option value="all">All scopes</option>
          <option value="local">Local</option>
          <option value="global">Global</option>
        </select>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {query && (
        <div className="mb-4 text-sm text-base-content/60">
          {total} result{total !== 1 ? "s" : ""} for &quot;{query}&quot;
        </div>
      )}

      <ArticleList
        articles={results.map((r) => ({
          slug: r.slug,
          title: r.title,
          scope: r.scope,
          folder: r.folder,
          tags: r.tags,
          updated: "",
        }))}
      />
    </Layout>
  );
}
