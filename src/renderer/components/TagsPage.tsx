import React from "react";
import type { Scope } from "../../types/scope.ts";
import { Layout } from "./Layout.tsx";
import { ScopeBadge } from "./common/ScopeBadge.tsx";

interface TagsPageProps {
  tags: Array<{
    tag: string;
    articles: Array<{
      slug: string;
      title: string;
      scope: Scope;
      folder: string;
    }>;
  }>;
}

export function TagsPage({ tags }: TagsPageProps) {
  return (
    <Layout title="Tags" currentPath="/tags">
      <h1 className="text-3xl font-bold mb-6">Tags</h1>

      {tags.length === 0 ? (
        <p className="text-base-content/60">No tags found.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {tags.map(({ tag, articles }) => (
            <div key={tag} id={tag}>
              <h2 className="text-xl font-semibold mb-2">
                <span className="badge badge-outline badge-lg">{tag}</span>
                <span className="text-sm text-base-content/60 ml-2">
                  ({articles.length})
                </span>
              </h2>
              <ul className="list bg-base-100">
                {articles.map((article) => (
                  <li
                    key={`${article.scope}-${article.slug}`}
                    className="list-row"
                  >
                    <a
                      href={`/articles/${article.scope}/${article.folder}/${article.slug}`}
                      className="link link-hover flex items-center gap-2"
                    >
                      <ScopeBadge scope={article.scope} />
                      {article.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
