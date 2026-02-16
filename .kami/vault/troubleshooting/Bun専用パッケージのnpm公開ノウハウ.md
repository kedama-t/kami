---
title: Bun専用パッケージのnpm公開ノウハウ
tags:
  - bun
created: '2026-02-16T05:10:41.401Z'
updated: '2026-02-16T05:10:41.401Z'
template: note
---

## 概要

Bun専用のCLIツールをnpmに公開する際のハマりどころと解決策。

## ハマりどころ1: scoped packageのアクセス制御

scoped package（`@org/name`）はデフォルトでprivate（有料）になる。
公開パッケージにするには `publishConfig.access: "public"` が必須。

```json
"publishConfig": {
  "access": "public"
}
```

これがないと `npm publish` 時に402エラーが出る。

## ハマりどころ2: TypeScriptソースの直接配布

通常のnpmパッケージはJSにビルドして配布するが、Bun専用パッケージの場合:

- BunはTypeScriptを直接実行できるため、ビルド不要
- `"bin"` フィールドで `.ts` ファイルを直接指定可能
- shebang `#!/usr/bin/env bun` を先頭に付けることで、PATH経由の実行時にBunが使われる

### 注意点
- `node` で実行しようとすると当然失敗する
- `npx` ではなく `bunx` を使うよう案内が必要
- `engines` フィールドでBun要件を明示すること

## ハマりどころ3: JSON importとtsconfigの設定

package.jsonからバージョン情報を読み込むために JSON import を使う場合:

```typescript
import pkg from "../../package.json";
```

必要なtsconfig設定:
- `"resolveJsonModule": true` — JSON importの許可
- `"module": "Preserve"` — Bunの推奨設定と互換

`verbatimModuleSyntax: true` 環境でも、JSON importは `with { type: "json" }` 無しで動作する（Bun + tsc --noEmit の組み合わせ）。

## ハマりどころ4: import.meta.dir の解決

kamiのテンプレート解決に `import.meta.dir` を使用:

```typescript
return join(import.meta.dir, "..", "..", "templates");
```

npm install後のパッケージ構造では、`import.meta.dir` はインストール先の `node_modules/@kami-pkm/kami/src/core/` を指す。
`templates/` ディレクトリが `files` フィールドに含まれていれば、相対パスで正しく解決される。

## ハマりどころ5: dist/assets の扱い

Web UIのアセット（CSS, JS）は `.gitignore` でgit管理から除外されているが、npmパッケージには含める必要がある:

- `files` フィールドに `dist/assets` を含める
- `prepublishOnly` スクリプトでビルドを自動実行
- `.gitignore` はnpm packに影響するが、`files` フィールドが優先される

```json
"files": ["src", "templates", "dist/assets"],
"scripts": {
  "prepublishOnly": "bun run css:build && bun run client:build"
}
```

