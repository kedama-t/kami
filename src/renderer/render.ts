import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";

interface RenderOptions {
  title: string;
  bodyHtml: string;
  scripts?: string[];
  inlineScript?: string;
}

const THEME_RESTORE_SCRIPT = `const t=localStorage.getItem("kami-theme");if(t)document.documentElement.setAttribute("data-theme",t);`;

/**
 * 完全なHTMLドキュメントを生成する。
 * Layout コンポーネントでラップ済みの bodyHtml を受け取り、
 * <!DOCTYPE html> から </html> までの完全なHTMLを返す。
 */
export function renderFullPage(options: RenderOptions): string {
  const { title, bodyHtml, scripts = [], inlineScript } = options;

  const scriptTags = scripts
    .map((src) => `<script type="module" src="${src}"></script>`)
    .join("\n    ");

  const inlineScriptTag = inlineScript
    ? `<script>${inlineScript}</script>`
    : `<script>${THEME_RESTORE_SCRIPT}</script>`;

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} - kami</title>
    <link rel="stylesheet" href="/assets/style.css" />
    ${inlineScriptTag}
    ${scriptTags}
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;
}

/**
 * React コンポーネントをSSRしてHTMLドキュメントを返す。
 * renderToString + renderFullPage のショートカット。
 */
export function renderPage(
  element: ReactElement,
  options: Omit<RenderOptions, "bodyHtml">,
): string {
  const bodyHtml = renderToString(element);
  return renderFullPage({ ...options, bodyHtml });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
