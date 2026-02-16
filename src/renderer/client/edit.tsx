import React, { useState, useCallback, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as unknown as T;
}

interface ApiResponse {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { message: string };
}

// ----- Edit Client -----

interface EditClientProps {
  slug: string;
  scope: string;
  body: string;
  title: string;
  tags: string[];
  draft: boolean;
}

function EditClient(props: EditClientProps) {
  const [title, setTitle] = useState(props.title);
  const [tags, setTags] = useState(props.tags.join(", "));
  const [body, setBody] = useState(props.body);
  const [draft, setDraft] = useState(props.draft);
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPreview = useCallback(
    debounce(async (markdown: string) => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: markdown }),
        });
        const data = (await res.json()) as ApiResponse;
        if (data.ok && data.data) {
          setPreviewHtml(data.data.html as string);
        }
      } catch {
        // Ignore preview errors
      }
    }, 300),
    [],
  );

  useEffect(() => {
    fetchPreview(body);
  }, [body, fetchPreview]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/articles/${props.scope}/${props.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          addTags: parsedTags,
          removeTags: props.tags.filter((t) => !parsedTags.includes(t)),
          draft,
        }),
      });

      const data = (await res.json()) as ApiResponse;
      if (data.ok && data.data) {
        const scope = data.data.scope as string;
        window.location.href = `/articles/${scope}/${props.slug}`;
      } else {
        alert(`Error: ${data.error?.message ?? "Unknown error"}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Edit: {props.title}</h1>

      <div className="flex flex-col gap-4">
        <div className="form-control">
          <label className="label" htmlFor="edit-title">
            <span className="label-text">Title</span>
          </label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTitle(e.target.value)
            }
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
            value={tags}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTags(e.target.value)
            }
            className="input input-bordered"
          />
        </div>

        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              checked={draft}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDraft(e.target.checked)
              }
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
              value={body}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setBody(e.target.value)
              }
              className="textarea textarea-bordered h-96 font-mono"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Preview</span>
            </label>
            <div
              className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-4 h-96 overflow-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <a
            href={`/articles/${props.scope}/${props.slug}`}
            className="btn btn-ghost"
          >
            Cancel
          </a>
        </div>
      </div>
    </>
  );
}

// ----- Create Client -----

interface CreateClientProps {
  templates: Array<{ name: string; scope: string }>;
  folders: string[];
  defaultScope: string;
}

function CreateClient(props: CreateClientProps) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [template, setTemplate] = useState("");
  const [scope, setScope] = useState(props.defaultScope);
  const [tags, setTags] = useState("");
  const [draft, setDraft] = useState(false);
  const [body, setBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPreview = useCallback(
    debounce(async (markdown: string) => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: markdown }),
        });
        const data = (await res.json()) as ApiResponse;
        if (data.ok && data.data) {
          setPreviewHtml(data.data.html as string);
        }
      } catch {
        // Ignore preview errors
      }
    }, 300),
    [],
  );

  useEffect(() => {
    fetchPreview(body);
  }, [body, fetchPreview]);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    setCreating(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          folder: folder || undefined,
          template: template || undefined,
          scope,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
          body: body || undefined,
          draft,
        }),
      });

      const data = (await res.json()) as ApiResponse;
      if (data.ok && data.data) {
        const articleScope = data.data.scope as string;
        const articleFolder = (data.data.folder as string) ?? "";
        const articleSlug = data.data.slug as string;
        window.location.href = `/articles/${articleScope}/${articleFolder}/${articleSlug}`;
      } else {
        alert(`Error: ${data.error?.message ?? "Unknown error"}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold mb-4">New Article</h1>

      <div className="flex flex-col gap-4">
        <div className="form-control">
          <label className="label" htmlFor="create-title">
            <span className="label-text">Title</span>
          </label>
          <input
            id="create-title"
            type="text"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTitle(e.target.value)
            }
            placeholder="Article title"
            className="input input-bordered"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-control">
            <label className="label" htmlFor="create-folder">
              <span className="label-text">Folder</span>
            </label>
            <input
              id="create-folder"
              type="text"
              value={folder}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFolder(e.target.value)
              }
              list="folder-list"
              className="input input-bordered"
            />
            <datalist id="folder-list">
              {props.folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>

          <div className="form-control">
            <label className="label" htmlFor="create-template">
              <span className="label-text">Template</span>
            </label>
            <select
              id="create-template"
              value={template}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setTemplate(e.target.value)
              }
              className="select select-bordered"
            >
              <option value="">None</option>
              {props.templates.map((t) => (
                <option key={`${t.scope}-${t.name}`} value={t.name}>
                  {t.name} ({t.scope})
                </option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label" htmlFor="create-scope">
              <span className="label-text">Scope</span>
            </label>
            <select
              id="create-scope"
              value={scope}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setScope(e.target.value)
              }
              className="select select-bordered"
            >
              <option value="local">Local</option>
              <option value="global">Global</option>
            </select>
          </div>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="create-tags">
            <span className="label-text">Tags (comma separated)</span>
          </label>
          <input
            id="create-tags"
            type="text"
            value={tags}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTags(e.target.value)
            }
            className="input input-bordered"
          />
        </div>

        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              checked={draft}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDraft(e.target.checked)
              }
              className="checkbox"
            />
            <span className="label-text">Draft</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label" htmlFor="create-body">
              <span className="label-text">Body</span>
            </label>
            <textarea
              id="create-body"
              value={body}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setBody(e.target.value)
              }
              className="textarea textarea-bordered h-96 font-mono"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Preview</span>
            </label>
            <div
              className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-4 h-96 overflow-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="btn btn-primary"
          >
            {creating ? "Creating…" : "Create"}
          </button>
          <a href="/" className="btn btn-ghost">
            Cancel
          </a>
        </div>
      </div>
    </>
  );
}

// ----- Theme toggle -----

function initThemeToggle() {
  document.querySelectorAll<HTMLInputElement>(".theme-controller").forEach((el) => {
    // Restore state from localStorage
    const saved = localStorage.getItem("kami-theme");
    if (saved === "dark") {
      el.checked = true;
    }

    el.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      const theme = target.checked ? "dark" : "light";
      localStorage.setItem("kami-theme", theme);
    });
  });
}

// ----- Hydration -----

function init() {
  // Theme toggle
  initThemeToggle();

  // Edit page hydration
  const editContainer = document.getElementById("edit-app");
  const editPropsEl = document.getElementById("edit-props");
  if (editContainer && editPropsEl) {
    const props = JSON.parse(editPropsEl.textContent!) as EditClientProps;
    hydrateRoot(editContainer, <EditClient {...props} />);
  }

  // Create page hydration
  const createContainer = document.getElementById("create-app");
  const createPropsEl = document.getElementById("create-props");
  if (createContainer && createPropsEl) {
    const props = JSON.parse(createPropsEl.textContent!) as CreateClientProps;
    hydrateRoot(createContainer, <CreateClient {...props} />);
  }
}

// Execute on DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
