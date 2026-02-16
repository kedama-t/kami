import React from "react";
import type { Scope } from "../../types/scope.ts";
import { Layout } from "./Layout.tsx";
import { ScopeBadge } from "./common/ScopeBadge.tsx";
import { TagBadge } from "./common/TagBadge.tsx";
import { BacklinkList } from "./common/BacklinkList.tsx";

interface ArticlePageProps {
  article: {
    slug: string;
    title: string;
    tags: string[];
    created: string;
    updated: string;
    folder: string;
    scope: Scope;
  };
  bodyHtml: string;
  backlinks: Array<{
    slug: string;
    scope: Scope;
    title: string;
    folder: string;
  }>;
}

export function ArticlePage({
  article,
  bodyHtml,
  backlinks,
}: ArticlePageProps) {
  const editUrl = `/articles/${article.scope}/${article.folder}/${article.slug}/edit`;

  return (
    <Layout title={article.title}>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <ScopeBadge scope={article.scope} />
          <span className="text-sm text-base-content/60">
            {article.folder}/
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-3">{article.title}</h1>
        <div className="flex flex-wrap gap-2 mb-2">
          {article.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} href={`/tags#${tag}`} />
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm text-base-content/60">
          <span>Created: {article.created}</span>
          <span>Updated: {article.updated}</span>
          <a href={editUrl} className="btn btn-ghost btn-sm">
            Edit
          </a>
        </div>
      </div>

      <article
        className="prose prose-lg max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      <BacklinkList backlinks={backlinks} />
    </Layout>
  );
}
