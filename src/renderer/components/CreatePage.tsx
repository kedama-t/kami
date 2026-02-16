import React from "react";
import type { Scope } from "../../types/scope.ts";
import { Layout } from "./Layout.tsx";

interface CreatePageProps {
  templates: Array<{ name: string; scope: Scope }>;
  folders: string[];
  defaultScope: Scope;
}

export function CreatePage({
  templates,
  folders,
  defaultScope,
}: CreatePageProps) {
  const propsJson = JSON.stringify({
    templates,
    folders,
    defaultScope,
  });

  return (
    <Layout title="New Article" scripts={["/assets/edit.js"]} wide>
      <div id="create-app">
        <h1 className="text-2xl font-bold mb-6">New Article</h1>

        <form className="flex flex-col gap-5">
          {/* Title and Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label" htmlFor="create-title">
                <span className="label-text font-medium">Title</span>
              </label>
              <input
                id="create-title"
                type="text"
                name="title"
                placeholder="Article title"
                className="input input-bordered w-full"
                required
              />
            </div>

            <div className="form-control">
              <label className="label" htmlFor="create-slug">
                <span className="label-text font-medium">Slug</span>
              </label>
              <input
                id="create-slug"
                type="text"
                name="slug"
                placeholder="auto-generated from title"
                className="input input-bordered w-full font-mono text-sm"
              />
            </div>
          </div>

          {/* Folder, Template, Scope */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-control">
              <label className="label" htmlFor="create-folder">
                <span className="label-text font-medium">Folder</span>
              </label>
              <input
                id="create-folder"
                type="text"
                name="folder"
                list="folder-list"
                className="input input-bordered w-full"
              />
              <datalist id="folder-list">
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            <div className="form-control">
              <label className="label" htmlFor="create-template">
                <span className="label-text font-medium">Template</span>
              </label>
              <select
                id="create-template"
                name="template"
                className="select select-bordered w-full"
              >
                <option value="">None</option>
                {templates.map((t) => (
                  <option key={`${t.scope}-${t.name}`} value={t.name}>
                    {t.name} ({t.scope})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label" htmlFor="create-scope">
                <span className="label-text font-medium">Scope</span>
              </label>
              <select
                id="create-scope"
                name="scope"
                defaultValue={defaultScope}
                className="select select-bordered w-full"
              >
                <option value="local">Local</option>
                <option value="global">Global</option>
              </select>
            </div>
          </div>

          {/* Tags and Draft */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label" htmlFor="create-tags">
                <span className="label-text font-medium">
                  Tags (comma separated)
                </span>
              </label>
              <input
                id="create-tags"
                type="text"
                name="tags"
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
                  className="checkbox checkbox-sm"
                />
                <span className="label-text">Draft</span>
              </label>
            </div>
          </div>

          {/* Editor / Preview grid */}
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            style={{ minHeight: "60vh" }}
          >
            <div className="form-control flex flex-col">
              <label className="label" htmlFor="create-body">
                <span className="label-text font-medium">Body</span>
              </label>
              <textarea
                id="create-body"
                name="body"
                className="textarea textarea-bordered font-mono text-sm flex-1 w-full resize-none"
                style={{ minHeight: "400px" }}
              />
            </div>

            <div className="form-control flex flex-col">
              <label className="label">
                <span className="label-text font-medium">Preview</span>
              </label>
              <div
                id="create-preview"
                className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-4 flex-1 overflow-auto bg-base-100"
                style={{ minHeight: "400px" }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              id="create-submit"
              className="btn btn-primary"
            >
              Create
            </button>
            <a href="/" className="btn btn-ghost">
              Cancel
            </a>
          </div>
        </form>
      </div>

      <script
        type="application/json"
        id="create-props"
        dangerouslySetInnerHTML={{ __html: propsJson }}
      />
    </Layout>
  );
}
