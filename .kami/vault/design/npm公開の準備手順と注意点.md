---
title: npm公開の準備手順と注意点
tags:
  - release
created: '2026-02-16T05:10:18.547Z'
updated: '2026-02-16T05:10:18.547Z'
template: note
---

## 概要

kamiをnpmパッケージ `@kami-pkm/kami` として公開するための準備手順と、調査で得た知見のまとめ。

## パッケージ名の選定

- npmレジストリで `kami` は既に別パッケージ（WebGL utilities by mattdesl）に使用されている
- scoped package `@kami-pkm/kami` を採用。bin名は `kami` のまま維持可能
- scoped packageの場合、`publishConfig.access: "public"` を設定しないとデフォルトでprivateになる
- npm orgの作成が必要（npmjs.comで事前に `kami-pkm` orgを作成すること）

## Bun専用パッケージとしての公開戦略

### なぜNode.js対応しないか

kamiはBun固有のAPIを広範に使用している:
- `Bun.file()` / `Bun.write()` — ファイルI/O
- `Bun.Glob` — ファイルグロブ
- `Bun.serve()` — Webサーバー
- `Bun.spawn()` — プロセス起動
- `Bun.stdin.stream()` — stdin読み取り
- `import.meta.dir` — モジュールディレクトリ解決

これらをNode.js互換に置き換えるのは大規模なリファクタリングになるため、Bun専用パッケージとして公開する。

### Bun専用パッケージの設定

- `engines.bun: ">=1.0.0"` で明示
- shebang `#!/usr/bin/env bun` により、bin実行時にBunランタイムが使われる
- TypeScriptソースを直接配布（BunはTSを直接実行可能）
- ビルドステップ不要でCLI部分が動作する

## package.json の変更内容

### 必須変更
- `"private": true` を削除
- `"name"` をスコープ付きに変更
- `"license": "MIT"` を追加
- `"files"` フィールドで配布対象を限定（`src`, `templates`, `dist/assets`）

### 推奨フィールド
- `repository`, `homepage`, `bugs` — GitHubリンク
- `keywords` — npm検索での発見性向上
- `publishConfig.access: "public"` — scoped packageの公開に必要
- `engines` — ランタイム要件の明示

### スクリプト
- `prepublishOnly: "bun run css:build && bun run client:build"` — Web UIアセットの自動ビルド

## バージョン管理の同期

CLIのメタ情報（cittyのdefineCommand内）でバージョンをハードコードしていたのを、package.jsonからの動的読み込みに変更:

```typescript
import pkg from "../../package.json";
// meta: { version: pkg.version, description: pkg.description }
```

tsconfig.jsonに `"resolveJsonModule": true` の追加が必要。Bunの `"module": "Preserve"` + `"verbatimModuleSyntax": true` の環境でもJSON importは正常動作する。

## files フィールドの設計

```json
"files": ["src", "templates", "dist/assets"]
```

- `src/` — TypeScriptソース（Bunが直接実行）
- `templates/` — ビルトインテンプレート（init時にコピーされる）
- `dist/assets/` — Web UIの静的アセット（CSS, クライアントJS）

`dist/assets/` は `prepublishOnly` で自動ビルドされる。gitignoreされているがnpmパッケージには含まれる。

## パブリッシュ前チェックリスト

1. npm orgの作成: npmjs.comで `kami-pkm` orgを作成
2. npmログイン: `npm login` または `bunx npm login`
3. バージョン確認: package.jsonのversionが正しいか
4. テスト実行: `bun test && bun run typecheck`
5. パッケージ内容確認: `npm pack --dry-run` で含まれるファイルを確認
6. 公開: `npm publish` または `bun publish`（prepublishOnlyが自動実行される）

