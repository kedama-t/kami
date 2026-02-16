import React from "react";
import type { Scope } from "@/types/scope.ts";
import { Layout } from "./Layout.tsx";

interface EditPageProps {
  article: {
    slug: string;
    title: string;
    tags: string[];
    body: string;
    draft: boolean;
    folder: string;
    scope: Scope;
  };
}

export function EditPage({ article }: EditPageProps) {
  const propsJson = JSON.stringify({
    slug: article.slug,
    scope: article.scope,
    folder: article.folder,
    body: article.body,
    title: article.title,
    tags: article.tags,
    draft: article.draft,
  });

  return (
    <Layout
      title={`Edit: ${article.title}`}
      scripts={["/assets/edit.js"]}
      wide
    >
      <div id="edit-app">
        <h1 className="text-2xl font-bold mb-6">Edit: {article.title}</h1>

        <form className="flex flex-col gap-5">
          {/* Metadata section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label" htmlFor="edit-title">
                <span className="label-text font-medium">Title</span>
              </label>
              <input
                id="edit-title"
                type="text"
                name="title"
                defaultValue={article.title}
                className="input input-bordered w-full"
              />
            </div>

            <div className="form-control">
              <label className="label" htmlFor="edit-slug">
                <span className="label-text font-medium">Slug</span>
              </label>
              <input
                id="edit-slug"
                type="text"
                name="slug"
                defaultValue={article.slug}
                className="input input-bordered w-full font-mono text-sm"
                placeholder="article-slug"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label" htmlFor="edit-tags">
                <span className="label-text font-medium">Tags (comma separated)</span>
              </label>
              <input
                id="edit-tags"
                type="text"
                name="tags"
                defaultValue={article.tags.join(", ")}
                className="input input-bordered w-full"
              />
            </div>

            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-2">
                <span className="label-text font-medium">Options</span>
              </label>
              <label className="label cursor-pointer justify-start gap-2 h-12 border rounded-lg px-3">
                <input
                  type="checkbox"
                  name="draft"
                  defaultChecked={article.draft}
                  className="checkbox checkbox-sm"
                />
                <span className="label-text">Draft</span>
              </label>
            </div>
          </div>

          {/* Editor / Preview grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: "60vh" }}>
            <div className="form-control flex flex-col">
              <label className="label" htmlFor="edit-body">
                <span className="label-text font-medium">Body</span>
              </label>
              <textarea
                id="edit-body"
                name="body"
                defaultValue={article.body}
                className="textarea textarea-bordered font-mono text-sm flex-1 w-full resize-none"
                style={{ minHeight: "400px" }}
              />
            </div>

            <div className="form-control flex flex-col">
              <label className="label">
                <span className="label-text font-medium">Preview</span>
              </label>
              <div
                id="edit-preview"
                className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-4 flex-1 overflow-auto bg-base-100"
                style={{ minHeight: "400px" }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" id="edit-save" className="btn btn-primary">
              Save
            </button>
            <a
              href={`/articles/${article.scope}/${article.folder}/${article.slug}`}
              className="btn btn-ghost"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>

      <script
        type="application/json"
        id="edit-props"
        dangerouslySetInnerHTML={{ __html: propsJson }}
      />
    </Layout>
  );
}
