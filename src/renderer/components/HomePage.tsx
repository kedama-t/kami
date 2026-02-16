import React from "react";
import type { Scope } from "@/types/scope.ts";
import { Layout } from "./Layout.tsx";
import { ArticleList } from "./common/ArticleList.tsx";
import { TagBadge } from "./common/TagBadge.tsx";

interface HomePageProps {
  recentArticles: Array<{
    slug: string;
    title: string;
    scope: Scope;
    folder: string;
    tags: string[];
    updated: string;
  }>;
  tagCloud: Array<{ tag: string; count: number }>;
}

export function HomePage({ recentArticles, tagCloud }: HomePageProps) {
  return (
    <Layout title="kami" currentPath="/">
      <h2 className="text-2xl font-bold mb-4">Recent Articles</h2>
      <ArticleList articles={recentArticles} />

      {tagCloud.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tagCloud.map((t) => (
              <TagBadge
                key={t.tag}
                tag={t.tag}
                count={t.count}
                href={`/tags#${t.tag}`}
              />
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
