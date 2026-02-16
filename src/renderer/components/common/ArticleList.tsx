import React from "react";
import type { Scope } from "@/types/scope.ts";
import { ScopeBadge } from "./ScopeBadge.tsx";
import { TagBadge } from "./TagBadge.tsx";

interface ArticleListItem {
  slug: string;
  title: string;
  scope: Scope;
  folder: string;
  tags: string[];
  updated: string;
}

interface ArticleListProps {
  articles: ArticleListItem[];
}

function articleUrl(scope: Scope, folder: string, slug: string): string {
  return `/articles/${scope}/${folder}/${slug}`;
}

export function ArticleList({ articles }: ArticleListProps) {
  if (articles.length === 0) {
    return <p className="text-base-content/60 py-4">No articles found.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {articles.map((article) => (
        <div key={`${article.scope}-${article.slug}`} className="card card-compact bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex items-center gap-2">
              <ScopeBadge scope={article.scope} />
              <a
                href={articleUrl(article.scope, article.folder, article.slug)}
                className="card-title text-base link link-hover"
              >
                {article.title}
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm text-base-content/60">
              <span>{article.folder}/</span>
              <span>·</span>
              <span>{article.updated}</span>
            </div>
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {article.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} href={`/tags#${tag}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
