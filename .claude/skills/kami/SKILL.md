---
name: kami
description: Read and write articles in the kami personal knowledge base using the kami CLI. Use this skill when the user asks to create, read, edit, delete, search, or list knowledge base articles, or when managing wiki-linked notes.
---

# kami CLI

kami (Knowledge Agent Markdown Interface) — ローカルファーストのナレッジベースCLI。Markdown + YAML frontmatter で記事を管理する。

## Agent向け基本ルール

- 常に `--json` フラグを付けて構造化された結果を取得する
- 削除時は `--force --json` を使う（対話プロンプト回避）
- 本文の入力は `--body -` でstdinパイプを使う
- エラー時はJSON内の `error.code` で判断する（コード一覧は [reference/error-codes.md](reference/error-codes.md)）

## スコープ

| スコープ | パス | 用途 |
|----------|------|------|
| global | `~/.kami/` | ユーザー共通のナレッジ |
| local | `./.kami/` | プロジェクト固有のナレッジ |

- 読み取り: ローカル優先→グローバルにフォールバック
- 書き込み: ローカルが存在すれば local、なければ global
- `--scope all` で両スコープを横断

## コマンド一覧

### 記事 CRUD

```bash
# 作成
kami create <title> [-f <folder>] [-t <tag>]... [-T <template>] [--slug <slug>] [-b <path|->] [--draft] [-s local|global] [--json]

# 読み取り
kami read <slug> [-m|--meta-only] [--no-frontmatter] [-s <scope>] [--json]

# 編集（--body: 全置換, --append: 末尾追記。同時指定不可）
kami edit <slug> [--title <t>] [--add-tag <tag>]... [--remove-tag <tag>]... [-b <path|->] [-a <path|->] [--draft <bool>] [--add-alias <a>] [--remove-alias <a>] [-s <scope>] [--json]

# 削除
kami delete <slug> [-F|--force] [-s <scope>] [--json]
```

### 一覧・検索

```bash
# 一覧
kami list [-f <folder>] [-t <tag>]... [--sort created|updated|title] [--order asc|desc] [-n <limit>] [--offset <num>] [-s local|global|all] [--draft <bool>] [--json]

# 全文検索（BM25, 日本語対応, プレフィックス・ファジー検索）
kami search <query> [-t <tag>]... [-f <folder>] [-s local|global|all] [-n <limit>] [--json]
```

### リンク

```bash
kami links <slug> [-s <scope>] [--json]       # 順リンク
kami backlinks <slug> [-s <scope>] [--json]   # 逆リンク
```

### テンプレート

```bash
kami template list [-s <scope>] [--json]
kami template show <name> [-s <scope>] [--json]
kami template create <name> [-b <path|->] [-s <scope>] [--json]
```

### その他

```bash
kami export <slug> [-F md|html] [-o <path>] [-s <scope>]
kami reindex [-s local|global|all] [--json]
kami init [--force]   # カレントディレクトリに .kami/ を作成
```

## JSON出力の共通構造

成功: `{ "ok": true, "data": { ... }, "error": null }`
エラー: `{ "ok": false, "data": null, "error": { "code": "...", "message": "..." } }`

## 終了コード

0=成功, 1=一般エラー, 2=記事未発見, 3=slug曖昧(複数候補), 4=Hookブロック

## Wikiリンク

記事本文内で `[[slug]]` で他記事を参照。`[[global:slug]]` / `[[local:slug]]` でスコープ明示。`[[slug|表示テキスト]]` で表示名指定。

## リファレンス

- [JSON出力例](reference/json-examples.md) — 各コマンドのレスポンス例
- [記事フォーマット](reference/article-format.md) — frontmatter仕様・slug解決・テンプレート変数
- [エラーコード](reference/error-codes.md) — エラーコード一覧
