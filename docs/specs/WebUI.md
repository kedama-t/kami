# kami WebUI Specification

> Phase 4: WebUI の詳細仕様。アーキテクチャ、ページ構成、API、コンポーネント、ビルドパイプラインを定義する。

---

## 1. 概要

### 1.1 目的

CLIで管理するナレッジベースを、ブラウザから快適に閲覧・編集できるWebUIを提供する。

### 1.2 設計方針

- **閲覧はとにかく速く**: 記事ページは `kami build` で事前生成した静的HTMLを配信
- **編集・検索は動的に**: 編集画面や検索結果はHonoサーバーがリクエスト時にSSRで生成
- **クライアントJSは最小限**: 編集画面のリアルタイムプレビューなど、必要な箇所だけにJSを使用
- **CLIとの一貫性**: データ層（core/）を共有し、WebUI固有のビジネスロジックは持たない

### 1.3 技術スタック

| 項目 | 選定 | バージョン |
|------|------|-----------|
| サーバーフレームワーク | Hono | 最新 |
| SSRレンダリング | React (ReactDOMServer) | 19.x |
| CSSフレームワーク | Tailwind CSS | v4 |
| UIコンポーネント | daisyUI | v5 |
| ビルドツール | Vite | 6.x |
| Markdownプレビュー（クライアント） | unified / remark / rehype | 既存依存と共通 |

---

## 2. アーキテクチャ

### 2.1 ハイブリッドレンダリング

```
┌─────────────────────────────────────────────────────────────┐
│                        kami serve                           │
│                                                             │
│  [Hono Server]                                              │
│       │                                                     │
│       ├── GET /                        → 静的HTML配信       │
│       ├── GET /articles/:scope/:slug   → 静的HTML配信       │
│       ├── GET /tags                    → 静的HTML配信       │
│       │                                                     │
│       ├── GET /articles/:scope/:slug/edit → SSR (React)     │
│       ├── GET /new                        → SSR (React)     │
│       ├── GET /search?q=...               → SSR (React)     │
│       │                                                     │
│       ├── POST /api/articles              → 記事作成API     │
│       ├── PUT  /api/articles/:scope/:slug → 記事更新API     │
│       ├── DELETE /api/articles/:scope/:slug → 記事削除API   │
│       ├── GET  /api/search?q=...          → 検索API         │
│       └── GET  /api/preview               → プレビューAPI   │
│                                                             │
│       静的ファイル: dist/ から配信                           │
│       アセット: dist/assets/ (CSS, JS)                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 レンダリング方式の使い分け

| ページ | 方式 | 理由 |
|--------|------|------|
| ホーム (`/`) | 静的ビルド | コンテンツが変わるのは記事操作時のみ |
| 記事閲覧 (`/articles/:scope/:slug`) | 静的ビルド | 頻繁なアクセスに対して最速で配信 |
| タグ一覧 (`/tags`) | 静的ビルド | 記事操作時にのみ変更 |
| 記事編集 (`/articles/:scope/:slug/edit`) | SSR | フォーム初期値を動的に生成 |
| 記事作成 (`/new`) | SSR | テンプレート一覧・スコープ状態を動的取得 |
| 検索結果 (`/search?q=...`) | SSR | クエリに応じた動的レスポンス |

### 2.3 データフロー

```
[ブラウザ]
    │
    ├── 閲覧 ──→ GET 静的HTML ──→ dist/ から配信
    │
    ├── 編集 ──→ GET /articles/:scope/:slug/edit (SSR)
    │           ├── フォーム表示（React SSR）
    │           └── リアルタイムプレビュー（クライアントJS）
    │               └── POST /api/preview（Markdown → HTML変換）
    │
    ├── 保存 ──→ PUT /api/articles/:scope/:slug
    │           ├── core/article.ts で記事更新
    │           ├── Hook実行（article:post-update）
    │           ├── 対象ページのHTML再ビルド
    │           └── リダイレクト → /articles/:scope/:slug
    │
    └── 検索 ──→ GET /search?q=...
                ├── サーバー側で MiniSearch 検索
                └── React SSR でレンダリング
```

---

## 3. セットアップ

### 3.1 追加パッケージ

```bash
# サーバー
bun add hono

# React SSR
bun add react react-dom
bun add -d @types/react @types/react-dom

# Vite + TailwindCSS v4
bun add -d vite @vitejs/plugin-react @tailwindcss/vite

# TailwindCSS v4 + daisyUI v5
bun add -d tailwindcss daisyui
```

### 3.2 Tailwind CSS v4 設定

Tailwind CSS v4 では `tailwind.config.js` は不要。CSS ファイルで直接設定する。

#### `src/renderer/styles/app.css`

```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}
```

- `@import "tailwindcss"` — Tailwind CSS v4 の全ユーティリティを読み込む
- `@plugin "daisyui"` — daisyUI v5 をプラグインとして登録
- `--default` — light テーマをデフォルトに設定
- `--prefersdark` — `prefers-color-scheme: dark` 時に dark テーマを適用

### 3.3 Vite 設定

#### `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // クライアントバンドル（編集画面用JS）
    outDir: "dist/assets",
    rollupOptions: {
      input: {
        edit: "src/renderer/client/edit.tsx",
      },
    },
  },
});
```

Vite はクライアントサイドJSのバンドルにのみ使用する。サーバーサイドのSSRは `ReactDOMServer.renderToString` を直接呼び出す（Bunランタイム上で実行）。

---

## 4. ディレクトリ構成

```
src/
  server/                      # Hono サーバー
    app.ts                     # Hono アプリケーション定義
    routes/
      pages.ts                 # ページルーティング（静的配信 + SSR）
      api.ts                   # REST API エンドポイント
    middleware/
      scope.ts                 # スコープ解決ミドルウェア

  renderer/                    # レンダリング
    build.ts                   # 静的HTMLビルドロジック
    render.ts                  # SSRレンダリングヘルパー
    components/                # React コンポーネント（共通）
      Layout.tsx               # 共通レイアウト（ヘッダー、サイドバー、フッター）
      ArticlePage.tsx          # 記事閲覧ページ
      HomePage.tsx             # ホームページ
      TagsPage.tsx             # タグ一覧ページ
      EditPage.tsx             # 記事編集ページ（SSR部分）
      CreatePage.tsx           # 記事作成ページ
      SearchPage.tsx           # 検索結果ページ
      common/                  # 共通UIパーツ
        ArticleList.tsx        # 記事一覧
        TagBadge.tsx           # タグバッジ
        ScopeBadge.tsx         # スコープラベル
        BacklinkList.tsx       # バックリンク一覧
        Pagination.tsx         # ページネーション
    client/                    # クライアントサイド JS
      edit.tsx                 # 編集画面のリアルタイムプレビュー
    styles/
      app.css                  # Tailwind CSS + daisyUI エントリポイント
```

---

## 5. ページ仕様

### 5.1 共通レイアウト（`Layout.tsx`）

すべてのページで共通のレイアウトを使用する。

```
┌──────────────────────────────────────────────┐
│  navbar                                      │
│  ┌──────────────────────────────────────────┐ │
│  │ kami ロゴ │ 検索バー │ + 新規作成ボタン  │ │
│  └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│                                              │
│  メインコンテンツ                             │
│                                              │
├──────────────────────────────────────────────┤
│  footer                                      │
│  kami v{version} · {scope} scope             │
└──────────────────────────────────────────────┘
```

#### daisyUI コンポーネント利用

| UI要素 | daisyUI コンポーネント |
|--------|----------------------|
| ヘッダー | `navbar` |
| 検索バー | `input` (`input-bordered`) |
| 新規作成ボタン | `btn` (`btn-primary`) |
| フッター | `footer` |
| テーマ切替 | `theme-controller` (`toggle`) |

#### Props

```typescript
interface LayoutProps {
  title: string;          // <title> タグ
  children: React.ReactNode;
  currentPath?: string;   // アクティブなナビゲーション項目のハイライト用
}
```

---

### 5.2 ホームページ (`/`)

最近の記事一覧とタグクラウドを表示する。

#### レンダリング方式: 静的ビルド

#### ワイヤーフレーム

```
┌──────────────────────────────────────────────┐
│  navbar                                      │
├──────────────────────────────────────────────┤
│                                              │
│  Recent Articles                             │
│  ┌──────────────────────────────────────┐    │
│  │ [local] design/architecture-overview │    │
│  │ アーキテクチャ概要                    │    │
│  │ #architecture  ·  2026-02-15         │    │
│  ├──────────────────────────────────────┤    │
│  │ [global] notes/typescript-tips       │    │
│  │ TypeScriptの便利なテクニック          │    │
│  │ #typescript #tips  ·  2026-02-14     │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Tags                                        │
│  ┌──────────────────────────────────────┐    │
│  │ architecture (3)  typescript (5)     │    │
│  │ tips (2)  daily (12)  adr (4)        │    │
│  └──────────────────────────────────────┘    │
│                                              │
├──────────────────────────────────────────────┤
│  footer                                      │
└──────────────────────────────────────────────┘
```

#### daisyUI コンポーネント利用

| UI要素 | daisyUI コンポーネント |
|--------|----------------------|
| 記事カード | `card` (`card-compact`) |
| スコープラベル | `badge` (`badge-primary` / `badge-secondary`) |
| タグクラウド | `badge` (`badge-outline`) |

#### Props

```typescript
interface HomePageProps {
  recentArticles: ArticleMeta[];  // 最新20件（両スコープ統合、updated降順）
  tagCloud: TagCount[];           // { tag: string; count: number }[]
}
```

---

### 5.3 記事閲覧ページ (`/articles/:scope/:slug`)

Markdownを静的レンダリングした記事を表示する。

#### レンダリング方式: 静的ビルド

#### ワイヤーフレーム

```
┌──────────────────────────────────────────────┐
│  navbar                                      │
├──────────────────────────────────────────────┤
│                                              │
│  [local]  design/architecture-overview       │
│                                              │
│  ┌ article-header ─────────────────────────┐ │
│  │ アーキテクチャ概要                       │ │
│  │ #architecture #design                   │ │
│  │ Created: 2026-02-15  Updated: 2026-02-15│ │
│  │ [Edit]                                  │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌ article-body (prose) ───────────────────┐ │
│  │                                         │ │
│  │ レンダリング済みHTML                     │ │
│  │ (wiki links は内部リンクに変換済み)      │ │
│  │                                         │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌ backlinks ──────────────────────────────┐ │
│  │ Backlinks (2)                           │ │
│  │  ← web-development (local)             │ │
│  │  ← learning-log (local)                │ │
│  └─────────────────────────────────────────┘ │
│                                              │
├──────────────────────────────────────────────┤
│  footer                                      │
└──────────────────────────────────────────────┘
```

#### daisyUI コンポーネント利用

| UI要素 | daisyUI コンポーネント |
|--------|----------------------|
| 記事ヘッダー | `card` |
| タグ | `badge` (`badge-outline`) |
| 編集ボタン | `btn` (`btn-ghost btn-sm`) |
| 記事本文 | Tailwind `prose` クラス |
| バックリンクセクション | `card` (`card-compact`) |
| バックリンクリスト | `list` |

#### Wikiリンクの変換

ビルド時にwikiリンクを内部HTMLリンクに変換する:

| Markdown | HTML |
|----------|------|
| `[[typescript-tips]]` | `<a href="/articles/local/notes/typescript-tips">TypeScriptの便利なテクニック</a>` |
| `[[global:typescript-tips]]` | `<a href="/articles/global/notes/typescript-tips">TypeScriptの便利なテクニック</a>` |
| `[[nonexistent]]` | `<span class="text-warning">nonexistent</span>` (dangling link) |

#### Props

```typescript
interface ArticlePageProps {
  article: ResolvedArticle;
  bodyHtml: string;           // remark/rehype でレンダリング済みHTML
  backlinks: BacklinkInfo[];  // { slug, scope, title, folder }[]
}
```

---

### 5.4 記事編集ページ (`/articles/:scope/:slug/edit`)

テキストエリアとリアルタイムプレビューを並べて表示する。

#### レンダリング方式: SSR + クライアントJS（ハイドレーション）

#### ワイヤーフレーム

```
┌──────────────────────────────────────────────────────────┐
│  navbar                                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Edit: アーキテクチャ概要  [local]                        │
│                                                          │
│  ┌ metadata ──────────────────────────────────────────┐  │
│  │ Title:  [                                        ] │  │
│  │ Tags:   [architecture] [design] [+]                │  │
│  │ Draft:  [ ] チェックボックス                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌ editor (50%) ─────┐ ┌ preview (50%) ──────────────┐  │
│  │                    │ │                             │  │
│  │ # アーキテクチャ   │ │ アーキテクチャ概要          │  │
│  │ 概要               │ │                             │  │
│  │                    │ │ レンダリング済みHTML         │  │
│  │ ## 背景            │ │                             │  │
│  │                    │ │ 背景                        │  │
│  │ kamiの設計思想...  │ │                             │  │
│  │                    │ │ kamiの設計思想...            │  │
│  │                    │ │                             │  │
│  └────────────────────┘ └─────────────────────────────┘  │
│                                                          │
│  [Save]  [Cancel]                                        │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  footer                                                  │
└──────────────────────────────────────────────────────────┘
```

#### daisyUI コンポーネント利用

| UI要素 | daisyUI コンポーネント |
|--------|----------------------|
| タイトル入力 | `input` (`input-bordered`) |
| タグ入力 | `badge` + `input` |
| 下書きチェック | `checkbox` |
| テキストエリア | `textarea` (`textarea-bordered`) |
| プレビュー領域 | `card` + Tailwind `prose` |
| 保存ボタン | `btn` (`btn-primary`) |
| キャンセルボタン | `btn` (`btn-ghost`) |

#### リアルタイムプレビュー

編集画面はクライアントサイドJSによるリアルタイムプレビューを提供する。

**方式**: デバウンス付きサーバーAPI呼び出し

1. テキストエリアの入力を監視（`input` イベント）
2. 300ms のデバウンスを適用
3. `GET /api/preview` にMarkdownテキストをクエリパラメータ（短い場合）またはPOSTボディで送信
4. サーバー側で remark/rehype パイプラインでHTMLに変換
5. レスポンスのHTMLをプレビュー領域に反映

```typescript
// クライアントサイド（概念）
const handleInput = debounce(async (markdown: string) => {
  const res = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "text/markdown" },
    body: markdown,
  });
  const html = await res.text();
  previewEl.innerHTML = html;
}, 300);
```

**代替案**: クライアントサイドでの remark/rehype 実行も検討したが、バンドルサイズの増大を避けるためサーバーAPI方式を採用する。サーバーは既にunified依存を持っているため追加コストがない。

#### Props（SSR）

```typescript
interface EditPageProps {
  article: ResolvedArticle;    // 編集対象の記事
  scope: Scope;
}
```

#### クライアントJSのハイドレーション

編集ページのみ、ReactによるPartial Hydrationを行う。

```typescript
// src/renderer/client/edit.tsx
import { hydrateRoot } from "react-dom/client";
import { EditPageClient } from "../components/EditPage";

const container = document.getElementById("edit-app");
const props = JSON.parse(document.getElementById("edit-props")!.textContent!);
hydrateRoot(container!, <EditPageClient {...props} />);
```

SSRレスポンスには以下を含める:

```html
<div id="edit-app"><!-- SSR済みHTML --></div>
<script type="application/json" id="edit-props"><!-- シリアライズされたProps --></script>
<script type="module" src="/assets/edit.js"></script>
```

---

### 5.5 記事作成ページ (`/new`)

新規記事を作成するフォーム。

#### レンダリング方式: SSR

#### ワイヤーフレーム

```
┌──────────────────────────────────────────────────────────┐
│  navbar                                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  New Article                                             │
│                                                          │
│  ┌ form ──────────────────────────────────────────────┐  │
│  │ Title:     [                                     ] │  │
│  │ Folder:    [                                     ] │  │
│  │ Tags:      [         ] [+]                         │  │
│  │ Template:  [ note          ▼ ]                     │  │
│  │ Scope:     ( ) auto  (●) local  ( ) global         │  │
│  │ Draft:     [ ] チェックボックス                      │  │
│  │                                                    │  │
│  │ Body:                                              │  │
│  │ ┌──────────────────┐ ┌──────────────────────────┐  │  │
│  │ │ テキストエリア    │ │ プレビュー               │  │  │
│  │ │                  │ │                          │  │  │
│  │ └──────────────────┘ └──────────────────────────┘  │  │
│  │                                                    │  │
│  │ [Create]  [Cancel]                                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  footer                                                  │
└──────────────────────────────────────────────────────────┘
```

#### daisyUI コンポーネント利用

| UI要素 | daisyUI コンポーネント |
|--------|----------------------|
| フォーム全体 | `fieldset` |
| 各入力フィールド | `label` + `input` |
| テンプレート選択 | `select` |
| スコープ選択 | `radio` |
| 作成ボタン | `btn` (`btn-primary`) |

#### Props（SSR）

```typescript
interface CreatePageProps {
  templates: TemplateMeta[];      // 利用可能なテンプレート一覧
  hasLocalScope: boolean;         // ローカルスコープの有無
  folders: string[];              // 既存フォルダ一覧（サジェスト用）
}
```

---

### 5.6 検索ページ (`/search?q=...`)

全文検索の結果を表示する。

#### レンダリング方式: SSR

#### ワイヤーフレーム

```
┌──────────────────────────────────────────────┐
│  navbar                                      │
├──────────────────────────────────────────────┤
│                                              │
│  Search                                      │
│  ┌ search-form ────────────────────────────┐ │
│  │ [TypeScript generics        ] [Search]  │ │
│  │ Scope: (●) all ( ) local ( ) global     │ │
│  │ Tag:   [           ] (optional)         │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  2 results for "TypeScript generics"         │
│                                              │
│  ┌ result ─────────────────────────────────┐ │
│  │ [local] TypeScriptの便利なテクニック     │ │
│  │ notes/typescript-tips                   │ │
│  │ ...Genericsを使った型安全な...           │ │
│  │ Score: 12.4  · #typescript #tips        │ │
│  ├─────────────────────────────────────────┤ │
│  │ [global] ジェネリクスの使い方           │ │
│  │ notes/typescript-generics               │ │
│  │ ...TypeScriptのgenericsは...            │ │
│  │ Score: 8.7   · #typescript              │ │
│  └─────────────────────────────────────────┘ │
│                                              │
├──────────────────────────────────────────────┤
│  footer                                      │
└──────────────────────────────────────────────┘
```

#### daisyUI コンポーネント利用

| UI要素 | daisyUI コンポーネント |
|--------|----------------------|
| 検索フォーム | `fieldset` + `input` + `btn` |
| スコープ選択 | `radio` (`radio-sm`) |
| 検索結果カード | `card` (`card-compact`) |
| スコープバッジ | `badge` |
| マッチハイライト | `<mark>` (Tailwind `bg-warning/30`) |

#### 検索の実行

1. ブラウザから `GET /search?q=TypeScript+generics&scope=all` にリクエスト
2. サーバーがクエリパラメータを解析
3. `GET /api/search?q=...&scope=...&tag=...` と同等のロジックでMiniSearchを実行
4. 結果をReact SSRでレンダリングして返却

#### Props（SSR）

```typescript
interface SearchPageProps {
  query: string;
  scope: ScopeOption;
  tag?: string;
  results: SearchResult[];
  total: number;
}
```

---

### 5.7 タグ一覧ページ (`/tags`)

すべてのタグと各タグに紐づく記事一覧を表示する。

#### レンダリング方式: 静的ビルド

#### ワイヤーフレーム

```
┌──────────────────────────────────────────────┐
│  navbar                                      │
├──────────────────────────────────────────────┤
│                                              │
│  Tags                                        │
│                                              │
│  ┌ tag-cloud ──────────────────────────────┐ │
│  │ architecture (3)  typescript (5)        │ │
│  │ tips (2)  daily (12)  adr (4)           │ │
│  │ bug-fix (1)  design (3)                 │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  #architecture (3 articles)                  │
│  ┌─────────────────────────────────────────┐ │
│  │ [local] アーキテクチャ概要              │ │
│  │ [local] ADR-001: Bunランタイムの採用    │ │
│  │ [global] システム設計パターン           │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  #typescript (5 articles)                    │
│  ┌─────────────────────────────────────────┐ │
│  │ ...                                     │ │
│  └─────────────────────────────────────────┘ │
│                                              │
├──────────────────────────────────────────────┤
│  footer                                      │
└──────────────────────────────────────────────┘
```

#### daisyUI コンポーネント利用

| UI要素 | daisyUI コンポーネント |
|--------|----------------------|
| タグクラウド | `badge` (`badge-lg`) |
| タグセクション見出し | heading + `badge` |
| 記事リスト | `list` |

#### Props

```typescript
interface TagsPageProps {
  tags: TagGroup[];  // { tag: string; articles: ArticleMeta[] }[]
}
```

---

## 6. REST API

### 6.1 エンドポイント一覧

| Method | Path | 説明 |
|--------|------|------|
| `POST` | `/api/articles` | 記事作成 |
| `PUT` | `/api/articles/:scope/:slug` | 記事更新 |
| `DELETE` | `/api/articles/:scope/:slug` | 記事削除 |
| `GET` | `/api/search` | 全文検索 |
| `POST` | `/api/preview` | Markdownプレビュー |

### 6.2 共通レスポンス形式

CLIの `--json` 出力と同じ構造を使用する。

```typescript
// 成功
{ "ok": true,  "data": T,    "error": null }

// エラー
{ "ok": false, "data": null,  "error": { "code": string, "message": string } }
```

HTTPステータスコードとエラーコードのマッピング:

| HTTPステータス | CLIエラーコード | 説明 |
|---------------|----------------|------|
| `200` | — | 成功 |
| `201` | — | 作成成功 |
| `400` | `VALIDATION_ERROR` | リクエストパラメータ不正 |
| `404` | `ARTICLE_NOT_FOUND` | 記事が見つからない |
| `409` | `ARTICLE_ALREADY_EXISTS` | 記事が既に存在 |
| `409` | `AMBIGUOUS_SLUG` | slugが曖昧 |
| `422` | `INVALID_FRONTMATTER` | frontmatter不正 |
| `500` | `IO_ERROR` | サーバー内部エラー |

### 6.3 `POST /api/articles` — 記事作成

#### リクエスト

```json
{
  "title": "新しい記事",
  "folder": "notes",
  "tags": ["typescript"],
  "template": "note",
  "scope": "local",
  "body": "# 新しい記事\n\n本文...",
  "draft": false
}
```

| フィールド | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `title` | yes | string | 記事タイトル |
| `folder` | no | string | 保存先フォルダ |
| `tags` | no | string[] | タグ |
| `template` | no | string | テンプレート名 (デフォルト: `"note"`) |
| `scope` | no | `"local"` \| `"global"` | スコープ (デフォルト: 自動解決) |
| `body` | no | string | 本文 |
| `draft` | no | boolean | 下書きフラグ |

#### レスポンス (`201 Created`)

```json
{
  "ok": true,
  "data": {
    "slug": "新しい記事",
    "title": "新しい記事",
    "scope": "local",
    "folder": "notes",
    "file_path": "/path/to/.kami/vault/notes/新しい記事.md"
  }
}
```

#### 後処理

1. `core/article.ts` の作成ロジックを実行
2. Hook 実行（`article:post-create`）
3. 対象記事 + ホーム + タグ一覧の静的HTMLを再ビルド

### 6.4 `PUT /api/articles/:scope/:slug` — 記事更新

#### リクエスト

```json
{
  "title": "更新後のタイトル",
  "tags": ["typescript", "advanced"],
  "body": "# 更新後\n\n新しい本文...",
  "draft": false
}
```

| フィールド | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `title` | no | string | タイトル変更 |
| `tags` | no | string[] | タグの完全置換 |
| `body` | no | string | 本文の完全置換 |
| `draft` | no | boolean | 下書きフラグ |

未指定のフィールドは変更しない。

#### レスポンス (`200 OK`)

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "更新後のタイトル",
    "scope": "local",
    "updated": "2026-02-15T14:00:00+09:00"
  }
}
```

#### 後処理

1. `core/article.ts` の更新ロジックを実行
2. Hook 実行（`article:post-update`）
3. 対象記事 + ホーム + タグ一覧の静的HTMLを再ビルド

### 6.5 `DELETE /api/articles/:scope/:slug` — 記事削除

#### レスポンス (`200 OK`)

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "scope": "local",
    "dangling_backlinks": [
      { "slug": "web-development", "scope": "local" }
    ]
  }
}
```

#### 後処理

1. `core/article.ts` の削除ロジックを実行
2. Hook 実行（`article:post-delete`）
3. ホーム + タグ一覧の静的HTMLを再ビルド
4. 削除された記事のHTMLファイルを削除

### 6.6 `GET /api/search` — 全文検索

#### クエリパラメータ

| パラメータ | 必須 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `q` | yes | string | — | 検索クエリ |
| `scope` | no | `local` \| `global` \| `all` | `all` | 対象スコープ |
| `tag` | no | string | — | タグフィルタ |
| `limit` | no | number | `20` | 最大件数 |

#### レスポンス (`200 OK`)

```json
{
  "ok": true,
  "data": {
    "results": [
      {
        "slug": "typescript-tips",
        "title": "TypeScriptの便利なテクニック",
        "scope": "local",
        "folder": "notes",
        "score": 12.4,
        "matches": {
          "body": ["...Genericsを使った<mark>型安全</mark>な..."],
          "title": []
        },
        "tags": ["typescript", "tips"]
      }
    ],
    "total": 1,
    "query": "TypeScript generics"
  }
}
```

### 6.7 `POST /api/preview` — Markdownプレビュー

#### リクエスト

- `Content-Type: text/markdown`
- Body: Markdownテキスト

#### レスポンス (`200 OK`)

- `Content-Type: text/html`
- Body: レンダリング済みHTML

このエンドポイントはCLI共通レスポンス形式を使用せず、HTMLを直接返す（編集画面のプレビュー用途に最適化）。

---

## 7. 静的ビルドパイプライン

### 7.1 `kami build` コマンド

既存のCLI仕様（`kami build`）に準拠する。

#### ビルドプロセス

```
1. build:pre Hook 実行
2. CSSビルド（Tailwind CSS + daisyUI → dist/assets/style.css）
3. クライアントJSバンドル（Vite → dist/assets/edit.js）
4. 記事ページ生成
   a. 全記事のfrontmatter + 本文を読み込み
   b. wikiリンクを内部HTMLリンクに変換
   c. remark/rehype でMarkdown → HTML変換
   d. ArticlePage コンポーネントでSSR
   e. Layout でラップ
   f. dist/articles/{scope}/{folder}/{slug}.html に出力
5. ホームページ生成
   a. 最新記事一覧 + タグクラウドを集計
   b. HomePage コンポーネントでSSR
   c. dist/index.html に出力
6. タグ一覧ページ生成
   a. 全タグ + タグ別記事をグループ化
   b. TagsPage コンポーネントでSSR
   c. dist/tags/index.html に出力
7. build:post Hook 実行
```

### 7.2 出力構造

```
dist/
├── index.html                          # ホームページ
├── articles/
│   ├── local/
│   │   ├── design/
│   │   │   └── architecture-overview.html
│   │   └── adr/
│   │       └── 001-use-bun-runtime.html
│   └── global/
│       ├── notes/
│       │   └── typescript-tips.html
│       └── daily/
│           └── 2026-02-15.html
├── tags/
│   └── index.html                      # タグ一覧
└── assets/
    ├── style.css                       # Tailwind CSS + daisyUI
    └── edit.js                         # 編集画面用クライアントJS
```

### 7.3 インクリメンタルビルド

`kami build --slug <slug>` で特定記事のみ再ビルドする。

1. 対象記事の `dist/articles/{scope}/{folder}/{slug}.html` を再生成
2. ホームページの再生成（最近の記事一覧が変わる可能性があるため）
3. タグ一覧の再生成（タグが変わる可能性があるため）

### 7.4 CSSビルド

Tailwind CSS v4 は Vite プラグインとして統合する。ビルド時に以下を生成:

```bash
# Vite のビルドプロセスで自動的に処理
# 入力: src/renderer/styles/app.css
# 出力: dist/assets/style.css
```

CSSには以下が含まれる:
- Tailwind CSS v4 のユーティリティクラス（使用されているもののみ）
- daisyUI v5 のコンポーネントスタイル
- daisyUI テーマ（light, dark）

---

## 8. Hono サーバー

### 8.1 サーバー構成

```typescript
// src/server/app.ts（概念）
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { pageRoutes } from "./routes/pages";
import { apiRoutes } from "./routes/api";

const app = new Hono();

// API ルート
app.route("/api", apiRoutes);

// SSR ページルート（動的ページ）
app.route("/", pageRoutes);

// 静的ファイル配信（dist/）
app.use("/*", serveStatic({ root: "./dist" }));

export default app;
```

### 8.2 `kami serve` コマンド

```bash
kami serve [--port 3000] [--build]
```

1. `--build` が `true`（デフォルト）の場合、起動前に `kami build` を実行
2. Honoサーバーを起動
3. 静的ファイル配信 + SSRページ + REST APIを提供

```
kami server running at http://localhost:3000
  Local scope:  /path/to/project/.kami
  Global scope: /home/user/.kami
```

### 8.3 スコープ解決ミドルウェア

```typescript
// src/server/middleware/scope.ts（概念）
// リクエストごとにスコープ情報をコンテキストに注入
app.use("*", async (c, next) => {
  const scopeInfo = await resolveScope("all", "read");
  c.set("scopeInfo", scopeInfo);
  await next();
});
```

---

## 9. テーマとスタイリング

### 9.1 daisyUI テーマ設定

デフォルトで `light` と `dark` テーマを有効にする。

```css
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}
```

- ユーザーのOS設定 (`prefers-color-scheme`) に自動で追従
- ヘッダーのテーマトグルで手動切替可能

### 9.2 テーマ切替

daisyUI の `theme-controller` コンポーネントを使用する。

```html
<label class="swap swap-rotate">
  <input type="checkbox" class="theme-controller" value="dark" />
  <!-- sun icon -->
  <!-- moon icon -->
</label>
```

テーマの選択状態は `localStorage` に保存し、ページロード時に復元する。このロジックは `<head>` 内のインラインスクリプトで実行し、フラッシュ（FOUC）を防止する。

```html
<script>
  const theme = localStorage.getItem("kami-theme");
  if (theme) document.documentElement.setAttribute("data-theme", theme);
</script>
```

### 9.3 Markdown 記事本文のスタイリング

記事本文には Tailwind CSS の `prose` クラス（`@tailwindcss/typography`）を使用する。

```bash
bun add -d @tailwindcss/typography
```

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}
```

```html
<article class="prose prose-lg max-w-none">
  <!-- レンダリング済みHTML -->
</article>
```

daisyUI のテーマに連動して `prose` のカラースキームも自動で切り替わる。

---

## 10. スコープ表示

### 10.1 スコープバッジ

すべてのページでスコープを視覚的に区別する。

```html
<!-- ローカルスコープ -->
<span class="badge badge-primary badge-sm">local</span>

<!-- グローバルスコープ -->
<span class="badge badge-secondary badge-sm">global</span>
```

### 10.2 スコープ表示ルール

| コンテキスト | 表示 |
|-------------|------|
| 記事一覧（ホーム、タグ、検索結果） | 各記事にスコープバッジ |
| 記事閲覧ページ | ヘッダーにスコープバッジ |
| 記事編集ページ | タイトル横にスコープバッジ（読み取り専用） |
| 記事作成ページ | スコープ選択ラジオボタン |
| バックリンク | 各リンクにスコープバッジ |

---

## 11. エラーハンドリング

### 11.1 ページレベル

| 状況 | 対応 |
|------|------|
| 記事が見つからない（404） | daisyUI `alert` (`alert-error`) で「Article not found」を表示 |
| スコープが存在しない | daisyUI `alert` (`alert-warning`) で案内を表示 |
| ビルドが未実行 | 静的ファイルが存在しない場合、SSRにフォールバック |

### 11.2 APIレベル

APIエラーはセクション6.2で定義した共通レスポンス形式に従う。

### 11.3 フォームバリデーション

編集・作成フォームでは、サーバーサイドバリデーションの結果をフォーム上にエラー表示する。

```html
<label class="label">
  <span class="label-text">Title</span>
</label>
<input type="text" class="input input-bordered input-error" />
<p class="text-error text-sm mt-1">タイトルは必須です</p>
```

---

## 12. 実装フェーズ

WebUI（Phase 4）の実装を以下のサブフェーズに分割する。

### Phase 4.1: 基盤構築

- Hono サーバーの基本セットアップ (`src/server/app.ts`)
- Tailwind CSS v4 + daisyUI v5 のセットアップ
- Vite ビルド設定
- 共通レイアウトコンポーネント (`Layout.tsx`)
- 静的ファイル配信

### Phase 4.2: 静的ビルド

- `kami build` の実装（HTML生成ロジック）
- ホームページ（`HomePage.tsx`）の静的生成
- 記事閲覧ページ（`ArticlePage.tsx`）の静的生成
- タグ一覧ページ（`TagsPage.tsx`）の静的生成
- CSS / アセットのビルド

### Phase 4.3: SSRページ + API

- REST API エンドポイント実装
- 検索ページ（`SearchPage.tsx`）のSSR
- 記事編集ページ（`EditPage.tsx`）のSSR
- 記事作成ページ（`CreatePage.tsx`）のSSR
- Markdownプレビュー API

### Phase 4.4: クライアントインタラクション

- 編集画面のリアルタイムプレビュー（クライアントJS）
- テーマ切替機能
- フォームバリデーション
- インクリメンタルビルド（API操作後の自動再ビルド）

---

## 13. 技術選定の補足

### 13.1 TailwindCSS v4 を選定する理由

| 項目 | 説明 |
|------|------|
| CSS-first設定 | `tailwind.config.js` が不要。CSSファイル内で完結するため設定が簡潔 |
| 高速ビルド | Lightning CSS エンジンによるフルビルド 5x高速化、インクリメンタルビルド 100x高速化 |
| ゼロ設定コンテンツ検出 | `content` 配列が不要。テンプレートファイルを自動検出 |
| Vite プラグイン | `@tailwindcss/vite` による最適な統合。PostCSS不要 |

### 13.2 daisyUI v5 を選定する理由

| 項目 | 説明 |
|------|------|
| ゼロ依存 | daisyUI v5 は外部依存なし。軽量 |
| Tailwind CSS v4 対応 | `@plugin "daisyui"` ディレクティブでCSS-first設定に統合 |
| テーマシステム | 35のビルトインテーマ + カスタムテーマ。`data-theme` 属性で切替 |
| コンポーネント豊富 | navbar, card, badge, input, btn 等、ナレッジベースUIに必要な要素が揃う |
| セマンティッククラス | `btn-primary`, `card-compact` 等の宣言的なクラス名でコードの可読性が高い |

### 13.3 ハイブリッドレンダリングを採用する理由

| 項目 | 説明 |
|------|------|
| 閲覧の高速化 | 静的HTMLはサーバー処理不要。ファイル配信のみで最速レスポンス |
| 動的ページの柔軟性 | 編集・検索は最新データを即時反映。ビルド待ちが不要 |
| CLIとの統合 | `kami build` で静的HTMLを出力する既存のCLI仕様を活かせる |
| リソース効率 | 静的ページはCDN配信可能。サーバーリソースは動的ページに集中 |

---

*この仕様書はPhase 4 WebUIの実装ガイドとして使用する。実装の進行に伴い詳細を追記・更新する。*
