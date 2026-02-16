# kami WebUI 実装計画

> Phase 4 WebUI の具体的な実装計画。タスク分解、依存関係、ファイル単位の実装仕様を定義する。

---

## 1. 前提

### 1.1 参照ドキュメント

- [WebUI.md](./WebUI.md) — WebUI仕様書
- [CLI.md](./CLI.md) — CLI仕様書（既存CLIコマンドの定義）
- [REQUIREMENTS.md](../REQUIREMENTS.md) — 全体要件定義

### 1.2 調査で判明した技術的制約

| 項目 | 判断 | 理由 |
|------|------|------|
| CSSビルド | `@tailwindcss/cli` を使用 | Vite プラグイン (`@tailwindcss/vite`) は SSR との組み合わせでアセットパスの不整合が報告されている。CLI は独立したビルドステップとして信頼性が高い |
| サーバービルド | 不要（Bunが直接TSXを実行） | Bun は TypeScript / TSX をネイティブ実行できるため、サーバーのトランスパイルは不要 |
| Vite の用途 | クライアントJSバンドルのみ | 編集画面のインタラクティブJS（edit.tsx）のバンドルにのみ使用 |
| React SSR | `renderToString` を使用 | `renderToReadableStream`（ストリーミング）は静的ビルドでは不要。kami serveのSSRページでも十分高速 |
| JSX設定 | `jsxImportSource: "react"` | Honoの組み込みJSX (`hono/jsx`) ではなくReactのJSXを使用。tsconfig.json の変更が必要 |

### 1.3 追加パッケージ一覧

```bash
# サーバー
bun add hono

# React SSR
bun add react react-dom
bun add -d @types/react @types/react-dom

# CSSビルド（Tailwind CSS v4 + daisyUI v5）
bun add -d tailwindcss @tailwindcss/cli @tailwindcss/typography daisyui

# クライアントJSバンドル
bun add -d vite @vitejs/plugin-react
```

> **注**: `@tailwindcss/vite` は採用しない。CSS ビルドには `@tailwindcss/cli` を使用する。

---

## 2. ビルドパイプライン設計

### 2.1 概要

```
kami build
  │
  ├── 1. build:pre Hook
  │
  ├── 2. CSS ビルド
  │      bunx @tailwindcss/cli -i src/renderer/styles/app.css -o dist/assets/style.css --minify
  │
  ├── 3. クライアント JS ビルド
  │      bunx vite build  (src/renderer/client/edit.tsx → dist/assets/edit.js)
  │
  ├── 4. 静的 HTML 生成
  │      Bun 上で ReactDOMServer.renderToString を実行
  │      ├── dist/index.html
  │      ├── dist/articles/{scope}/{folder}/{slug}.html
  │      └── dist/tags/index.html
  │
  └── 5. build:post Hook
```

### 2.2 package.json scripts

```json
{
  "scripts": {
    "css:build": "bunx @tailwindcss/cli -i src/renderer/styles/app.css -o dist/assets/style.css --minify",
    "css:watch": "bunx @tailwindcss/cli -i src/renderer/styles/app.css -o dist/assets/style.css --watch",
    "client:build": "bunx vite build",
    "build": "bun run css:build && bun run client:build && bun run src/cli/index.ts build",
    "serve": "bun run src/cli/index.ts serve"
  }
}
```

### 2.3 Vite設定（クライアントJSのみ）

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/assets",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        edit: "src/renderer/client/edit.tsx",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash].[ext]",
      },
    },
  },
});
```

> `emptyOutDir: false` — CSS ビルドの `style.css` を上書きしないため。

### 2.4 tsconfig.json の変更

```jsonc
{
  "compilerOptions": {
    // 既存設定に追加
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

---

## 3. CSS設定

### 3.1 エントリポイント

```css
/* src/renderer/styles/app.css */
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}

/* Tailwind にコンポーネントファイルをスキャンさせる */
@source "../../renderer/components";
@source "../../renderer/client";
```

### 3.2 @source ディレクティブの必要性

Tailwind CSS v4 はテンプレートファイルを自動検出するが、`src/renderer/` 配下の TSX ファイルが検出されない場合に備えて `@source` で明示する。特にビルド済みの `dist/` は `.gitignore` に含まれるため、自動検出の対象外となる。

---

## 4. 実装フェーズ詳細

### Phase 4.1: 基盤構築

#### 4.1.1 パッケージインストールと設定

**タスク**: 依存パッケージの追加と設定ファイルの更新

- `bun add` でパッケージをインストール
- `tsconfig.json` に JSX 設定を追加
- `vite.config.ts` を作成
- `src/renderer/styles/app.css` を作成
- `package.json` に scripts を追加

**成果物**: 設定ファイル群

---

#### 4.1.2 SSR レンダリングヘルパー

**ファイル**: `src/renderer/render.ts`

HTMLドキュメント全体を生成するヘルパー関数。静的ビルドとSSRの両方で共通利用する。

```typescript
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";

interface RenderOptions {
  title: string;
  bodyHtml: string;     // renderToString済みのReactコンポーネントHTML
  scripts?: string[];   // <script> タグのsrc
  inlineScript?: string; // <head>内インラインスクリプト（テーマ復元用）
}

/**
 * 完全なHTMLドキュメントを生成する。
 * Layout コンポーネントでラップ済みの bodyHtml を受け取り、
 * <!DOCTYPE html> から </html> までの完全なHTMLを返す。
 */
export function renderFullPage(options: RenderOptions): string;

/**
 * React コンポーネントをSSRしてHTMLドキュメントを返す。
 * renderToString + renderFullPage のショートカット。
 */
export function renderPage(element: ReactElement, options: Omit<RenderOptions, "bodyHtml">): string;
```

**使用する core 関数**: なし（純粋なレンダリングユーティリティ）

---

#### 4.1.3 共通レイアウトコンポーネント

**ファイル**: `src/renderer/components/Layout.tsx`

```typescript
interface LayoutProps {
  title: string;
  children: React.ReactNode;
  currentPath?: string;
  scripts?: string[];
}
```

**daisyUI コンポーネント**:
- `navbar` — ヘッダー
- `input` — 検索バー（`/search` への GET フォーム）
- `btn btn-primary` — 新規作成ボタン（`/new` へのリンク）
- `swap swap-rotate` + `theme-controller` — テーマ切替
- `footer` — フッター

**テーマ復元スクリプト**: `<head>` 内にインラインスクリプトを配置し、FOUC を防止。

```html
<script>
  const t=localStorage.getItem("kami-theme");
  if(t)document.documentElement.setAttribute("data-theme",t);
</script>
```

---

#### 4.1.4 共通UIパーツ

**ファイル群**: `src/renderer/components/common/`

| ファイル | 責務 | daisyUI |
|----------|------|---------|
| `ScopeBadge.tsx` | スコープバッジ表示 | `badge badge-primary` / `badge-secondary` |
| `TagBadge.tsx` | タグバッジ表示 | `badge badge-outline` |
| `ArticleList.tsx` | 記事一覧（ホーム・タグ・検索で共通） | `card card-compact` |
| `BacklinkList.tsx` | バックリンク一覧 | `list` |

**Props 例** (`ArticleList.tsx`):

```typescript
interface ArticleListProps {
  articles: Array<{
    slug: string;
    title: string;
    scope: Scope;
    folder: string;
    tags: string[];
    updated: string;
  }>;
}
```

---

#### 4.1.5 Hono サーバー基本セットアップ

**ファイル**: `src/server/app.ts`

```typescript
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { apiRoutes } from "./routes/api";
import { pageRoutes } from "./routes/pages";

export function createApp(distDir: string) {
  const app = new Hono();

  // API ルート
  app.route("/api", apiRoutes);

  // SSR ページルート（/new, /search, /articles/:scope/:slug/edit）
  app.route("/", pageRoutes);

  // 静的ファイル配信（dist/ から）
  app.use("/*", serveStatic({ root: distDir }));

  return app;
}
```

**ルート登録順序**:
1. `/api/*` — API エンドポイント（最優先）
2. SSR ページルート — 明示的なパスのみ（`/new`, `/search`, `/articles/:scope/:slug/edit`）
3. `/*` — 静的ファイル配信（フォールバック）

この順序により、静的 HTML（`/`, `/articles/...`, `/tags`）は `serveStatic` が処理し、SSR ページはそれに先行する明示ルートが処理する。

---

#### 4.1.6 kami serve コマンド実装

**ファイル**: `src/cli/commands/serve.ts`

```typescript
// citty コマンド定義
{
  meta: { name: "serve", description: "Start web server" },
  args: {
    port: { type: "string", description: "Port number", default: "3000" },
    "no-build": { type: "boolean", description: "Skip initial build" },
  },
  async run({ args }) {
    // 1. --no-build でなければ kami build を実行
    // 2. config.json から port を読み込み（args で上書き可能）
    // 3. createApp(distDir) で Hono アプリを生成
    // 4. Bun.serve({ fetch: app.fetch, port }) で起動
  }
}
```

**使用する core 関数**:
- `resolveScope("all", "read")` — 両スコープの検出
- `getScopePaths(root)` — 各スコープのパス取得

**テスト**: `tests/cli/serve.test.ts`
- サーバー起動・停止
- ポート指定
- `--no-build` フラグ

---

### Phase 4.2: 静的ビルド

#### 4.2.1 ビルドロジック

**ファイル**: `src/renderer/build.ts`

```typescript
import { renderToString } from "react-dom/server";

interface BuildOptions {
  slug?: string;      // インクリメンタルビルド対象
  scope?: Scope;      // スコープ指定
  clean?: boolean;    // dist/ を事前に削除
  outDir?: string;    // 出力先（デフォルト: config.build.outDir）
}

/**
 * 静的HTMLをビルドする。
 * slug 指定時はインクリメンタルビルド。
 */
export async function buildStaticSite(options: BuildOptions): Promise<BuildResult>;
```

**使用する core 関数**:
- `resolveScope(scope, "read")` — ビルド対象スコープの決定
- `loadIndex(scopeRoot)` — 記事メタデータの取得
- `queryIndex(scopeRoot, { draft: false })` — 下書き除外した記事一覧
- `readArticle(slug, scope)` — 記事の読み込み
- `exportAsHtml(article, scopeRoot)` — Markdown → HTML 変換
- `loadLinkGraph(scopeRoot)` — バックリンク情報の取得
- `getBacklinks(scopeRoot, slug)` — 記事ごとのバックリンク取得
- `executeHooks("build:pre" | "build:post", ...)` — Hook 実行

**ビルド処理フロー**:

```
buildStaticSite(options)
  │
  ├── executeHooks("build:pre")
  │
  ├── ensureDir(outDir)
  │
  ├── copyAssets()  ← style.css, edit.js を dist/assets/ にコピー（既にある場合はスキップ）
  │
  ├── buildArticlePages()
  │   ├── for each (scope, scopeRoot):
  │   │   ├── loadIndex(scopeRoot)
  │   │   ├── for each article (下書き除外):
  │   │   │   ├── readArticle(slug, scope)
  │   │   │   ├── resolveWikiLinksToHtmlLinks(body, index, scope)  ← 新規関数
  │   │   │   ├── markdownToHtml(resolvedBody)                    ← remark/rehype
  │   │   │   ├── getBacklinks(scopeRoot, slug)
  │   │   │   ├── renderToString(<ArticlePage ... />)
  │   │   │   └── writeFile(dist/articles/{scope}/{folder}/{slug}.html)
  │
  ├── buildHomePage()
  │   ├── 両スコープのインデックスを統合
  │   ├── updated 降順でソート、上位20件
  │   ├── タグクラウドを集計
  │   ├── renderToString(<HomePage ... />)
  │   └── writeFile(dist/index.html)
  │
  ├── buildTagsPage()
  │   ├── 両スコープのインデックスからタグをグループ化
  │   ├── renderToString(<TagsPage ... />)
  │   └── writeFile(dist/tags/index.html)
  │
  └── executeHooks("build:post")
```

---

#### 4.2.2 Wiki リンクの HTML リンク変換

**ファイル**: `src/renderer/build.ts` 内のヘルパー関数

既存の `resolveWikiLinks()` (exporter.ts) は Markdown リンクに変換する。静的ビルドでは HTML リンク（`/articles/:scope/:folder/:slug`）に変換する必要があるため、新しい関数を追加する。

```typescript
/**
 * Wiki リンクを WebUI 内部リンクに変換する。
 * [[slug]] → [title](/articles/{scope}/{folder}/{slug})
 * ダングリングリンク → <span class="text-warning">slug</span>
 */
export function resolveWikiLinksForWeb(
  body: string,
  localIndex: MetadataIndex,
  globalIndex: MetadataIndex,
  currentScope: Scope,
): string;
```

**使用する core 関数**:
- `parseWikiLinks(body)` — Wiki リンクの解析
- `loadIndex(scopeRoot)` — インデックスから記事メタデータ取得

---

#### 4.2.3 記事閲覧ページコンポーネント

**ファイル**: `src/renderer/components/ArticlePage.tsx`

```typescript
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
```

**構造**:
```
<Layout title={article.title}>
  <ScopeBadge scope={article.scope} />
  <h1>{article.title}</h1>
  <div class="flex gap-2">{tags.map(t => <TagBadge />)}</div>
  <div>Created: {created} · Updated: {updated}</div>
  <a href={editUrl} class="btn btn-ghost btn-sm">Edit</a>

  <article class="prose prose-lg max-w-none dark:prose-invert">
    {bodyHtml}  ← dangerouslySetInnerHTML
  </article>

  <BacklinkList backlinks={backlinks} />
</Layout>
```

---

#### 4.2.4 ホームページコンポーネント

**ファイル**: `src/renderer/components/HomePage.tsx`

```typescript
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
```

**構造**:
```
<Layout title="kami" currentPath="/">
  <h2>Recent Articles</h2>
  <ArticleList articles={recentArticles} />

  <h2>Tags</h2>
  <div class="flex flex-wrap gap-2">
    {tagCloud.map(t => <a href={`/tags#${t.tag}`}><TagBadge /> ({t.count})</a>)}
  </div>
</Layout>
```

---

#### 4.2.5 タグ一覧ページコンポーネント

**ファイル**: `src/renderer/components/TagsPage.tsx`

```typescript
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
```

---

#### 4.2.6 kami build コマンド実装

**ファイル**: `src/cli/commands/build.ts`

```typescript
{
  meta: { name: "build", description: "Build static HTML" },
  args: {
    slug: { type: "string", description: "Build specific article" },
    scope: { type: "string", description: "Scope: local | global" },
    clean: { type: "boolean", description: "Clean output directory" },
  },
  async run({ args }) {
    // 1. CSSビルド: Bun.spawn(["bunx", "@tailwindcss/cli", ...])
    // 2. クライアントJSビルド: Bun.spawn(["bunx", "vite", "build"])
    // 3. buildStaticSite(options)
  }
}
```

**テスト**: `tests/cli/build.test.ts`
- フルビルド（全記事 + ホーム + タグ）
- インクリメンタルビルド（`--slug` 指定）
- `--clean` フラグ
- 下書き記事の除外
- Wiki リンクの変換

---

### Phase 4.3: SSR ページ + API

#### 4.3.1 スコープ解決ミドルウェア

**ファイル**: `src/server/middleware/scope.ts`

```typescript
import { createMiddleware } from "hono/factory";

/**
 * リクエストごとにスコープ情報を Hono コンテキストに注入する。
 * c.get("localRoot"), c.get("globalRoot"), c.get("scopes") でアクセス可能。
 */
export const scopeMiddleware = createMiddleware(async (c, next) => {
  const { scopes, localRoot, globalRoot } = await resolveScope("all", "read");
  c.set("scopes", scopes);
  c.set("localRoot", localRoot);
  c.set("globalRoot", globalRoot);
  await next();
});
```

**使用する core 関数**:
- `resolveScope("all", "read")`

---

#### 4.3.2 REST API エンドポイント

**ファイル**: `src/server/routes/api.ts`

| エンドポイント | ハンドラ | 使用する core 関数 |
|---------------|---------|-------------------|
| `POST /api/articles` | 記事作成 | `createArticle(title, options)`, `executeHooks("article:post-create")`, `buildStaticSite({ slug })` |
| `PUT /api/articles/:scope/:slug` | 記事更新 | `readArticle(slug, scope)`, `updateArticle(slug, changes)`, `executeHooks("article:post-update")`, `buildStaticSite({ slug })` |
| `DELETE /api/articles/:scope/:slug` | 記事削除 | `deleteArticle(slug, scope)`, `getBacklinks(scopeRoot, slug)`, `executeHooks("article:post-delete")`, `buildStaticSite()` |
| `GET /api/search` | 全文検索 | `search(query, { scopes, tags, limit })` |
| `POST /api/preview` | プレビュー | `exportAsHtml()` のパイプライン（remark/rehype） |

**エラーハンドリング**: `KamiError` を catch し、`error.code` から HTTP ステータスコードにマッピング。

```typescript
function errorToStatus(code: ErrorCode): number {
  const map: Record<ErrorCode, number> = {
    ARTICLE_NOT_FOUND: 404,
    AMBIGUOUS_SLUG: 409,
    ARTICLE_ALREADY_EXISTS: 409,
    TEMPLATE_NOT_FOUND: 404,
    SCOPE_NOT_FOUND: 404,
    INVALID_FRONTMATTER: 422,
    HOOK_BLOCKED: 409,
    VALIDATION_ERROR: 400,
    IO_ERROR: 500,
  };
  return map[code] ?? 500;
}
```

**自動再ビルド**: 記事の作成・更新・削除の API レスポンス後に、バックグラウンドで対象記事のインクリメンタルビルドを実行する。レスポンスはビルド完了を待たない。

```typescript
// レスポンス後にバックグラウンドビルド
c.executionCtx?.waitUntil?.(buildStaticSite({ slug }));
// Bun では waitUntil が使えない場合、setTimeout(fn, 0) で非同期実行
```

**テスト**: `tests/server/api.test.ts`
- 各エンドポイントの正常系
- バリデーションエラー（400）
- 記事未検出（404）
- Hook ブロック時の挙動

---

#### 4.3.3 SSR ページルート

**ファイル**: `src/server/routes/pages.ts`

```typescript
import { Hono } from "hono";

const pages = new Hono();

// 編集ページ（SSR）
pages.get("/articles/:scope/:slug/edit", async (c) => {
  const { scope, slug } = c.req.param();
  const article = await readArticle(slug, scope as Scope);
  const html = renderPage(<EditPage article={article} scope={scope as Scope} />, {
    title: `Edit: ${article.meta.title}`,
    scripts: ["/assets/edit.js"],
  });
  return c.html(html);
});

// 作成ページ（SSR）
pages.get("/new", async (c) => {
  const templates = await listTemplates(scopeRoots);
  const folders = await collectFolders(scopeRoots);
  const html = renderPage(<CreatePage templates={templates} ... />, {
    title: "New Article",
    scripts: ["/assets/edit.js"],
  });
  return c.html(html);
});

// 検索ページ（SSR）
pages.get("/search", async (c) => {
  const query = c.req.query("q") ?? "";
  const scope = c.req.query("scope") ?? "all";
  const tag = c.req.query("tag");
  const results = query ? await search(query, { scopes, tags: tag ? [tag] : undefined }) : { results: [], total: 0, query };
  const html = renderPage(<SearchPage query={query} results={results.results} total={results.total} scope={scope} />, {
    title: query ? `Search: ${query}` : "Search",
  });
  return c.html(html);
});

export { pages as pageRoutes };
```

**使用する core 関数**:
- `readArticle(slug, scope)` — 編集ページ
- `listTemplates(scopeRoots)` — 作成ページ
- `search(query, options)` — 検索ページ

---

#### 4.3.4 検索ページコンポーネント

**ファイル**: `src/renderer/components/SearchPage.tsx`

WebUI 仕様書のワイヤーフレーム準拠。検索フォームは `<form action="/search" method="GET">` で実装（JS不要）。

---

#### 4.3.5 編集ページコンポーネント

**ファイル**: `src/renderer/components/EditPage.tsx`

SSR で初期レンダリングし、クライアントで部分ハイドレーションする。

**SSR 部分**: フォーム全体をレンダリング。プレビュー領域は空の `<div>` として出力。

**クライアント部分** (Phase 4.4 で実装):
- `<div id="edit-app">` をハイドレーション対象
- `<script type="application/json" id="edit-props">` で初期 Props を埋め込み
- `<script type="module" src="/assets/edit.js">` でクライアント JS を読み込み

---

#### 4.3.6 作成ページコンポーネント

**ファイル**: `src/renderer/components/CreatePage.tsx`

編集ページと同様の構造。フォーム送信は `POST /api/articles` への fetch。

---

### Phase 4.4: クライアントインタラクション

#### 4.4.1 編集画面クライアント JS

**ファイル**: `src/renderer/client/edit.tsx`

```typescript
// Islands アーキテクチャ: 編集エリアのみハイドレーション
import { hydrateRoot } from "react-dom/client";

interface EditClientProps {
  article: { slug: string; scope: string; body: string; title: string; tags: string[]; draft: boolean };
}

function EditClient(props: EditClientProps) {
  // state: body, title, tags, draft, previewHtml
  // テキストエリア onChange → debounce 300ms → POST /api/preview → previewHtml 更新
  // Save ボタン → PUT /api/articles/:scope/:slug → リダイレクト
  // Cancel ボタン → location.href = `/articles/:scope/:slug`
}

// ハイドレーション
const container = document.getElementById("edit-app");
if (container) {
  const propsEl = document.getElementById("edit-props");
  const props = propsEl ? JSON.parse(propsEl.textContent!) : {};
  hydrateRoot(container, <EditClient {...props} />);
}
```

**デバウンス実装**: 外部ライブラリ不要。シンプルな `setTimeout` / `clearTimeout` で実装。

```typescript
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
```

---

#### 4.4.2 作成画面クライアント JS

`edit.tsx` に統合。同一のバンドルで、`#create-app` の存在をチェックして作成フォームのハイドレーションも行う。

---

#### 4.4.3 テーマ切替

Layout の `<head>` にインラインスクリプトとして組み込む（Phase 4.1.3 で実装済み）。

テーマトグルのイベントリスナーは以下のインラインスクリプトで処理:

```html
<script>
  document.querySelectorAll(".theme-controller").forEach(el => {
    el.addEventListener("change", e => {
      const theme = e.target.checked ? "dark" : "light";
      localStorage.setItem("kami-theme", theme);
    });
  });
</script>
```

> daisyUI の `theme-controller` は CSS のみでテーマ切替を行うが、`localStorage` への保存には JS が必要。このスクリプトは Layout 内に直接埋め込むため、別バンドルは不要。

---

## 5. テスト計画

### 5.1 テストファイル構成

```
tests/
  renderer/
    build.test.ts            # 静的ビルドロジック
    render.test.ts           # SSRレンダリングヘルパー
    components/
      Layout.test.tsx        # レイアウトコンポーネント
      ArticlePage.test.tsx   # 記事ページ
      HomePage.test.tsx      # ホームページ
      SearchPage.test.tsx    # 検索ページ
      EditPage.test.tsx      # 編集ページ
      CreatePage.test.tsx    # 作成ページ
  server/
    api.test.ts              # REST APIエンドポイント
    pages.test.ts            # SSRページルート
    middleware.test.ts       # スコープミドルウェア
  cli/
    build.test.ts            # kami build コマンド
    serve.test.ts            # kami serve コマンド
  e2e/
    webui.test.ts            # E2Eテスト（サーバー起動→ブラウザ操作）
```

### 5.2 テスト方針

| カテゴリ | 方法 |
|----------|------|
| コンポーネント | `renderToString` でHTMLを生成し、文字列マッチングで検証 |
| API | `app.request()` (Hono のテストヘルパー) でリクエスト送信 |
| ビルド | 一時ディレクトリに `.kami/` を作成し、ビルド→ファイル存在チェック |
| CLI | 既存テストと同じパターン（`Bun.spawn` でコマンド実行） |

---

## 6. 実装順序と依存関係

```
Phase 4.1 基盤構築
  4.1.1 パッケージ・設定 ─────────────────────────┐
  4.1.2 SSRレンダリングヘルパー ──────────┐         │
  4.1.3 Layout コンポーネント ──┐          │         │
  4.1.4 共通UIパーツ ──────────┤          │         │
                               │          │         │
Phase 4.2 静的ビルド           ↓          ↓         ↓
  4.2.2 Wikiリンク HTML変換 ───┐
  4.2.3 ArticlePage ───────────┤
  4.2.4 HomePage ──────────────┤
  4.2.5 TagsPage ──────────────┤
  4.2.1 ビルドロジック ────────←┘
  4.2.6 kami build コマンド ───←── 4.2.1
                               │
  4.1.5 Hono サーバー ─────────┤
  4.1.6 kami serve コマンド ───←┘
                               │
Phase 4.3 SSR + API            ↓
  4.3.1 スコープミドルウェア ──┐
  4.3.2 REST API ──────────────┤
  4.3.4 SearchPage ────────────┤
  4.3.5 EditPage (SSR部分) ────┤
  4.3.6 CreatePage ────────────┤
  4.3.3 SSRページルート ──────←┘
                               │
Phase 4.4 クライアント         ↓
  4.4.1 EditClient (JS) ──────┐
  4.4.2 CreateClient (JS) ────┤
  4.4.3 テーマ切替 ────────────┘
```

---

## 7. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Tailwind CSS v4 の `@source` で TSX が検出されない | ユーティリティクラスが CSS に含まれない | `@source` ディレクティブで明示的にパスを指定。ビルド後にクラスの有無を検証するテストを追加 |
| Bun での ReactDOMServer の互換性問題 | SSR が動作しない | React 19 は Bun を公式サポート。問題発生時は `react-dom/server.browser` にフォールバック |
| daisyUI v5 と @tailwindcss/typography の競合 | prose スタイルが崩れる | daisyUI の `@plugin` を typography の後に記述。テーマの `prose-invert` で dark mode 対応 |
| Vite ビルドと @tailwindcss/cli の出力先競合 | ファイル上書き | `emptyOutDir: false` を Vite に設定。CSS → JS の順序でビルド |
| 大量記事時のフルビルド時間 | ビルドが遅くなる | インクリメンタルビルドを優先使用。フルビルドは並列化（`Promise.all`）で高速化 |

---

*この実装計画は WebUI.md の仕様に基づく。実装の進行に伴い更新する。*
