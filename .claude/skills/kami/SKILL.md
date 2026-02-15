# kami CLI Skill

kami (Knowledge Agent Markdown Interface) はローカルファーストのパーソナルナレッジベースCLI。Markdown + YAML frontmatter で記事を管理する。

## 基本ルール

- 常に `--json` フラグを付けて実行し、構造化された結果を取得する
- 削除時は `--force --json` を使う（対話プロンプト回避）
- 本文の入力は `--body -` でstdinパイプを使う
- エラー時はJSON内の `error.code` で判断する

## スコープ

| スコープ | パス | 用途 |
|----------|------|------|
| global | `~/.kami/` | ユーザー共通のナレッジ |
| local | `./.kami/` | プロジェクト固有のナレッジ |

- 読み取り: ローカル優先→グローバルにフォールバック
- 書き込み: ローカルが存在すれば `local`、なければ `global`
- `--scope all` で両スコープを横断

## コマンド一覧

### 記事の作成

```bash
kami create <title> [--folder,-f <folder>] [--tag,-t <tag>]... [--template,-T <name>] [--slug <slug>] [--body,-b <path|->] [--draft] [--scope,-s local|global] [--json]
```

### 記事の読み取り

```bash
kami read <slug> [--meta-only,-m] [--no-frontmatter] [--scope,-s] [--json]
```

### 記事の編集

```bash
kami edit <slug> [--title <title>] [--add-tag <tag>]... [--remove-tag <tag>]... [--body,-b <path|->] [--append,-a <path|->] [--draft <bool>] [--add-alias <alias>] [--remove-alias <alias>] [--scope,-s] [--json]
```

`--body` は本文全体を置換、`--append` は末尾に追記。同時指定不可。

### 記事の削除

```bash
kami delete <slug> [--force,-F] [--scope,-s] [--json]
```

### 記事の一覧

```bash
kami list [--folder,-f <folder>] [--tag,-t <tag>]... [--sort created|updated|title] [--order asc|desc] [--limit,-n <num>] [--offset <num>] [--scope,-s local|global|all] [--draft <bool>] [--json]
```

### 全文検索

```bash
kami search <query> [--tag,-t <tag>]... [--folder,-f <folder>] [--scope,-s local|global|all] [--limit,-n <num>] [--json]
```

BM25ランキング。日本語対応（BudouX）。プレフィックス検索・ファジー検索あり。

### リンク

```bash
kami links <slug> [--scope,-s] [--json]       # 順リンク
kami backlinks <slug> [--scope,-s] [--json]   # 逆リンク
```

### テンプレート

```bash
kami template list [--scope,-s] [--json]
kami template show <name> [--scope,-s] [--json]
kami template create <name> [--body,-b <path|->] [--scope,-s] [--json]
```

### エクスポート

```bash
kami export <slug> [--format,-F md|html] [--output,-o <path>] [--scope,-s]
```

### インデックス再構築

```bash
kami reindex [--scope,-s local|global|all] [--json]
```

### 初期化

```bash
kami init [--force]
```

カレントディレクトリに `.kami/` を作成。

## JSON出力の構造

成功: `{ "ok": true, "data": { ... }, "error": null }`
エラー: `{ "ok": false, "data": null, "error": { "code": "...", "message": "..." } }`

## 終了コード

| コード | 意味 |
|--------|------|
| 0 | 成功 |
| 1 | 一般エラー |
| 2 | 記事が見つからない |
| 3 | slug曖昧（複数候補） |
| 4 | Hookによるブロック |

## Wikiリンク記法

記事本文内で `[[slug]]` で他記事を参照。`[[global:slug]]` / `[[local:slug]]` でスコープ明示。`[[slug|表示テキスト]]` で表示名を指定。

## 詳細リファレンス

各コマンドのJSON出力例・frontmatter仕様・テンプレート変数などの詳細は [cli-reference.md](./cli-reference.md) を参照。
