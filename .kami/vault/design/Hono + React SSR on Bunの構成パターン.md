---
title: Hono + React SSR on Bunの構成パターン
tags:
  - bun
created: '2026-02-15T22:59:03.746Z'
updated: '2026-02-15T22:59:03.746Z'
template: note
---

## Hono + React SSR on Bun の構成

### 基本アーキテクチャ
- **サーバー**: Bun が TypeScript/TSX をネイティブ実行。ビルドステップ不要
- **SSR**: `react-dom/server` の `renderToString` を Hono ルートハンドラ内で呼び出し
- **静的ファイル**: `serveStatic` from `hono/bun` で配信
- **クライアントJS**: Vite でバンドル

### serveStatic の使い方
```typescript
import { serveStatic } from "hono/bun";
app.use("/assets/*", serveStatic({ root: "./dist" }));
```
- `root` は `process.cwd()` からの相対パス
- `rewriteRequestPath` で URL パスとファイルシステムパスのマッピングを変更可能
- `onFound` / `onNotFound` フックで Cache-Control ヘッダー設定やログ出力

### ルート登録順序（重要）
1. API ルート (`/api/*`)
2. SSR ページルート（明示的パス: `/new`, `/search`, `/articles/:scope/:slug/edit`）
3. 静的ファイル配信 (`/*` catch-all)

この順序により、静的HTML（`/index.html`, `/articles/...`）は serveStatic が処理し、動的ページはそれに先行する明示ルートが処理する。

### 部分ハイドレーション（Islands パターン）
フレームワーク（HonoX）を使わず、手動で実装:
1. SSRで完全なHTMLを出力
2. インタラクティブ部分に `<div id="edit-app">` + `<script id="edit-props" type="application/json">` を埋め込み
3. クライアントJSで `hydrateRoot(container, <Component {...props} />)` を実行

### tsconfig.json の注意点
Hono は独自の JSX (`hono/jsx`) を持つが、React SSR では React の JSX を使用する。
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```
`jsxImportSource: "hono/jsx"` のままだと React コンポーネントが動作しない。

### Bun.serve での起動
```typescript
export default {
  port: 3000,
  fetch: app.fetch,
};
```
Bun はデフォルトエクスポートの `fetch` プロパティを自動検出してサーバーを起動する。

