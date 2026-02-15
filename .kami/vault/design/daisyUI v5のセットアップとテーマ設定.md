---
title: daisyUI v5のセットアップとテーマ設定
tags:
  - theming
created: '2026-02-15T22:58:41.112Z'
updated: '2026-02-15T22:58:41.112Z'
template: note
---

## daisyUI v5 の特徴

### ゼロ依存
daisyUI v5 は外部依存が完全にゼロ。v4以前は依存があったが、v5で全て除去された。

### Tailwind CSS v4 との統合
CSSファイルで `@plugin "daisyui"` と記述するだけで利用可能:
```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}
```

### 設定オプション
`@plugin "daisyui" { ... }` ブロック内で設定:
- `themes`: 有効にするテーマ一覧（`--default` / `--prefersdark` フラグ付き）
- `root`: CSSグローバル変数のセレクタ（デフォルト `:root`）
- `include` / `exclude`: 特定コンポーネントの選択的読み込み
- `prefix`: クラス名のプレフィックス（例: `d-` → `d-btn`）

### テーマシステム
- 35のビルトインテーマ
- `data-theme` 属性でテーマ切替
- `theme-controller` コンポーネント（CSS-only）で UI 切替
- テーマのネスト可能（子要素に異なるテーマを適用）
- カスタムテーマは `@plugin "daisyui/theme" { ... }` で定義

### theme-controller の永続化
`theme-controller` はCSS-onlyのため、ページリロードで状態が消える。
永続化には localStorage + インラインスクリプトが必要:
```html
<script>
  const t=localStorage.getItem("kami-theme");
  if(t)document.documentElement.setAttribute("data-theme",t);
</script>
```
→ `<head>` 内に配置してFOUC（Flash of Unstyled Content）を防止する。

### 新テーマ（v5で追加）
- caramellatte（暖色系ライトテーマ）
- abyss（暗色系グリーン/ティール）
- silk（蛍光テキスト）

