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
    body: article.body,
    title: article.title,
    tags: article.tags,
    draft: article.draft,
  });

  return (
    <Layout
      title={`Edit: ${article.title}`}
      scripts={["/assets/edit.js"]}
    >
      <div id="edit-app">
        <h1 className="text-3xl font-bold mb-4">Edit: {article.title}</h1>

        <form className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label" htmlFor="edit-title">
              <span className="label-text">Title</span>
            </label>
            <input
              id="edit-title"
              type="text"
              name="title"
              defaultValue={article.title}
              className="input input-bordered"
            />
          </div>

          <div className="form-control">
            <label className="label" htmlFor="edit-tags">
              <span className="label-text">Tags (comma separated)</span>
            </label>
            <input
              id="edit-tags"
              type="text"
              name="tags"
              defaultValue={article.tags.join(", ")}
              className="input input-bordered"
            />
          </div>

          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                name="draft"
                defaultChecked={article.draft}
                className="checkbox"
              />
              <span className="label-text">Draft</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label" htmlFor="edit-body">
                <span className="label-text">Body</span>
              </label>
              <textarea
                id="edit-body"
                name="body"
                defaultValue={article.body}
                className="textarea textarea-bordered h-96 font-mono"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Preview</span>
              </label>
              <div
                id="edit-preview"
                className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-4 h-96 overflow-auto"
              />
            </div>
          </div>

          <div className="flex gap-2">
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
