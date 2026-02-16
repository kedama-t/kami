---
title: WebUI Phase 4 実装ノート
tags:
  - webui
created: '2026-02-16T04:06:13.327Z'
updated: '2026-02-16T04:06:13.327Z'
template: note
---

# WebUI Phase 4 実装ノート

## 概要
kami の WebUI を Phase 4 として実装した。React SSR + Hono + Tailwind CSS v4 + daisyUI v5 の構成。

## アーキテクチャ判断

### ハイブリッドレンダリング
- **静的ページ** (閲覧系): `kami build` で事前生成 → `serveStatic` で配信
- **SSRページ** (編集/作成/検索): Hono の明示ルートで `renderToString` + `renderPage`
- **クライアントJS**: Vite でバンドル、Islands Architecture でフォームのみハイドレーション

### ルート優先順位
1. `/api/*` → REST API
2. 明示パス (`/new`, `/search`, `/articles/:scope/:slug/edit`) → SSR
3. `/*` → `serveStatic` (静的HTML + アセット)

## 技術的知見

### Hono の c.json() ステータスコード
Hono v4 の `c.json()` は `ContentfulStatusCode` 型を要求する。`number` 型を渡すとコンパイルエラーになるため、ステータスコードの返り値は `200 | 400 | 404 | 409 | 422 | 500` のようなユニオン型で定義する必要がある。

### tsconfig.json の DOM lib
クライアントサイドJSX（`document`, `window`, `localStorage`）を使用するため `"lib": ["ESNext", "DOM", "DOM.Iterable"]` が必要。Bun のみのプロジェクトでは `"DOM"` を含めていないことが多いが、WebUI のクライアントコードには必須。

### React 19 のイベントハンドラ型
React 19 + strict TypeScript では `onChange={(e) => ...}` で `e.target.value` にアクセスすると型エラー。明示的に `React.ChangeEvent<HTMLInputElement>` を指定する必要がある。

### Wiki リンクの Web 用変換
既存の `resolveWikiLinks()` は Markdown リンク `[title](slug.md)` に変換するが、WebUI ではパスベースの HTML リンク `/articles/{scope}/{folder}/{slug}` に変換する別関数 `resolveWikiLinksForWeb()` が必要。

### 自動再ビルド
API 経由の記事作成/更新/削除後に `setTimeout(() => buildStaticSite({ slug }), 0)` でバックグラウンドビルド。レスポンスはビルド完了を待たない。

## ファイル構成
```
src/renderer/         # SSR + 静的ビルド
  render.ts           # renderPage, renderFullPage
  build.ts            # buildStaticSite, resolveWikiLinksForWeb
  components/         # React コンポーネント（Layout, 各ページ, 共通パーツ）
  client/edit.tsx     # クライアントJS（Vite でバンドル）
  styles/app.css      # Tailwind CSS エントリポイント

src/server/           # Hono サーバー
  app.ts              # createApp()
  middleware/scope.ts  # スコープ解決ミドルウェア
  routes/api.ts       # REST API
  routes/pages.ts     # SSR ページルート
```

