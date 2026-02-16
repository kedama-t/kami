---
title: TailwindCSS v4のCSS-first設定とSSRでの注意点
tags:
  - ssr
created: '2026-02-15T22:58:21.113Z'
updated: '2026-02-15T22:58:21.113Z'
template: note
---

## TailwindCSS v4 の主な変更点

### CSS-first 設定
- `tailwind.config.js` が不要。CSS ファイル内で `@import "tailwindcss"` だけで動作する
- プラグインは `@plugin "pluginname"` ディレクティブで登録
- デザイントークンは `@theme { ... }` ブロックで定義
- コンテンツ検出は自動。`.gitignore` のファイルは除外される。追加パスは `@source` で指定

### SSRプロジェクトでのCSS ビルド方法
調査の結果、3つの選択肢がある:

1. **`@tailwindcss/cli`（推奨）**: 独立したビルドステップ。SSRとの相性が最も良い
2. **`@tailwindcss/postcss`**: PostCSS パイプラインに統合
3. **`@tailwindcss/vite`**: Vite プラグイン。ただしSSRとの組み合わせでアセットパスの不整合が報告されている（GitHub issue #16389）

### 決定
kamiのWebUIでは `@tailwindcss/cli` を採用する。理由:
- SSRプロジェクトでの信頼性が最も高い
- Vite はクライアントJSバンドルにのみ使用するため、CSS ビルドは独立させる方が明確
- `bunx @tailwindcss/cli -i input.css -o output.css --minify` で簡潔にビルド可能

### @source ディレクティブ
TSX コンポーネントが自動検出されない場合に備え、明示的にパスを指定する:
```css
@source "../../renderer/components";
@source "../../renderer/client";
```

