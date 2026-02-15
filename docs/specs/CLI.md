# kami CLI Specification

> `kami` コマンドの詳細仕様。各コマンドの引数・オプション・入出力・終了コード・使用例を定義する。

---

## 共通仕様

### グローバルオプション

すべてのコマンドで使用可能なオプション。

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--json` | `-j` | boolean | `false` | 出力をJSON形式にする |
| `--scope` | `-s` | `local` \| `global` \| `all` | (自動解決) | 対象スコープを明示 |
| `--help` | `-h` | boolean | — | ヘルプを表示 |
| `--version` | `-V` | boolean | — | バージョンを表示 |
| `--quiet` | `-q` | boolean | `false` | 出力を抑制（終了コードのみで結果を返す） |

### スコープの自動解決

`--scope` を省略した場合の動作:

| 操作 | デフォルト |
|------|-----------|
| 読み取り（read, search, list, links, backlinks） | ローカル優先で検索。見つからなければグローバル |
| 書き込み（create, edit, delete） | ローカルスコープが存在すれば `local`、なければ `global` |
| 一覧系で `--scope` 省略 | ローカルスコープが存在すれば `local`。`--scope all` で両方表示 |

### 終了コード

| コード | 意味 |
|--------|------|
| `0` | 成功 |
| `1` | 一般エラー（不正な引数、ファイルI/Oエラーなど） |
| `2` | 記事が見つからない |
| `3` | slug の解決が曖昧（複数候補あり） |
| `4` | Hook によるブロック（pre-hook が操作を拒否） |

### stdin からの本文入力

`--body -` を指定すると、本文をstdinから読み取る。ファイルパスを指定した場合はそのファイルを読み取る。

```bash
# ファイルから
kami edit my-article --body ./draft.md

# stdinから（パイプ）
echo "# New content" | kami edit my-article --body -

# stdinから（ヒアドキュメント）
kami edit my-article --body - <<'EOF'
# Updated content
This is the new body.
EOF
```

### JSON出力の共通構造

`--json` 指定時、すべてのコマンドは以下の構造で出力する:

```json
{
  "ok": true,
  "data": { ... },
  "error": null
}
```

エラー時:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "Article 'nonexistent' not found",
    "candidates": []
  }
}
```

### エラーコード一覧

| コード | 説明 |
|--------|------|
| `ARTICLE_NOT_FOUND` | 指定された記事が見つからない |
| `AMBIGUOUS_SLUG` | slugが曖昧（複数候補あり）。`candidates` に候補リストを含む |
| `ARTICLE_ALREADY_EXISTS` | 同名の記事が既に存在する |
| `TEMPLATE_NOT_FOUND` | 指定されたテンプレートが見つからない |
| `SCOPE_NOT_FOUND` | 指定されたスコープが存在しない（例: ローカルスコープ未初期化で `--scope local`） |
| `INVALID_FRONTMATTER` | frontmatterのパースに失敗 |
| `HOOK_BLOCKED` | pre-hookが操作をブロックした |
| `VALIDATION_ERROR` | 入力値のバリデーションエラー |
| `IO_ERROR` | ファイルI/Oエラー |

---

## コマンド詳細

---

### `kami init`

カレントディレクトリにローカルスコープ（`.kami/`）を初期化する。

#### 構文

```
kami init [--force]
```

#### オプション

| オプション | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `--force` | boolean | `false` | 既存の `.kami/` を上書き初期化 |

#### 動作

1. カレントディレクトリに `.kami/` が存在しないことを確認
2. 以下のディレクトリ構造を作成:
   ```
   .kami/
     config.json
     hooks.json
     templates/
     vault/
     index.json
     links.json
   ```
3. `config.json` にデフォルト設定を書き込む
4. `hooks.json` に空のhooks設定を書き込む
5. `index.json` と `links.json` を空の初期状態で作成

#### 出力

```
Initialized kami local scope in /path/to/project/.kami/
```

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "path": "/path/to/project/.kami",
    "scope": "local"
  }
}
```

#### 終了コード

| コード | 条件 |
|--------|------|
| `0` | 初期化成功 |
| `1` | `.kami/` が既に存在（`--force` なし） |

---

### `kami create`

新しい記事を作成する。

#### 構文

```
kami create <title> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `title` | yes | 記事のタイトル |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--folder` | `-f` | string | (vault直下) | 保存先フォルダ |
| `--tag` | `-t` | string[] | `[]` | タグ（複数指定可） |
| `--template` | `-T` | string | `"note"` | 使用するテンプレート名 |
| `--scope` | `-s` | `local` \| `global` | (自動解決) | 保存先スコープ |
| `--slug` | | string | (タイトルから自動生成) | slugを明示指定 |
| `--body` | `-b` | string | — | 本文の入力元（ファイルパスまたは `-` でstdin） |
| `--draft` | | boolean | `false` | 下書きとして作成 |

#### slug の自動生成ルール

1. タイトルをそのままslugとして使用（日本語もそのまま許可）
2. ファイルシステムで使用できない文字（`/ \ : * ? " < > |`）は `-` に置換
3. 前後の空白をトリム
4. 同名ファイルが存在する場合は `-1`, `-2`, ... を付与

#### 動作

1. テンプレートを読み込む（スコープ解決ルールに従う）
2. frontmatter を生成（title, tags, created, updated, template, draft）
3. `--body` が指定されていれば本文を読み込み、テンプレートの本文部分を置換
4. `--body` が未指定ならテンプレートの本文をそのまま使用
5. ファイルを書き込み
6. インデックスを更新
7. wikiリンクを解析してリンクインデックスを更新
8. Hook を実行（`article:pre-create` → 書き込み → `article:post-create`）

#### 使用例

```bash
# 基本的な作成
kami create "TypeScriptの便利なテクニック"

# フォルダ・タグ指定
kami create "ADR-001: Bunランタイムの採用" --folder adr --tag adr --tag architecture

# テンプレート指定でグローバルに作成
kami create "2026-02-15" --template daily --scope global --folder daily

# 本文付きで作成（ファイル指定）
kami create "設計メモ" --body ./draft.md --folder design

# 本文付きで作成（stdin）
echo "# 概要\n\nここに本文" | kami create "設計メモ" --body - --folder design

# エージェントによる作成（JSON出力）
kami create "新しいメモ" --tag note --json
```

#### 出力

```
Created: notes/typescript-tips (local)
```

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScriptの便利なテクニック",
    "scope": "local",
    "folder": "notes",
    "file_path": "/path/to/project/.kami/vault/notes/typescript-tips.md",
    "tags": ["typescript", "tips"],
    "created": "2026-02-15T10:30:00+09:00"
  }
}
```

#### 終了コード

| コード | 条件 |
|--------|------|
| `0` | 作成成功 |
| `1` | 同名記事が既に存在 / バリデーションエラー |
| `4` | pre-hookがブロック |

---

### `kami read`

記事の内容をstdoutに出力する。

#### 構文

```
kami read <slug> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `slug` | yes | 記事の識別子（slug、フォルダ付きパス、またはタイトル） |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--scope` | `-s` | `local` \| `global` | (自動解決) | 対象スコープ |
| `--meta-only` | `-m` | boolean | `false` | frontmatterのみ出力（本文を含めない） |
| `--no-frontmatter` | | boolean | `false` | frontmatterを除いた本文のみ出力 |

#### 動作

1. スコープ解決ルールに従って記事を検索
2. ファイルの内容をstdoutに出力

#### 使用例

```bash
# 基本的な読み取り
kami read typescript-tips

# グローバルスコープから明示的に読み取り
kami read --scope global typescript-tips

# フォルダ付きパスで指定
kami read notes/typescript-tips

# タイトルで指定
kami read "TypeScriptの便利なテクニック"

# メタデータのみ
kami read typescript-tips --meta-only

# 本文のみ（frontmatterなし）
kami read typescript-tips --no-frontmatter

# JSON形式で取得（エージェント向け）
kami read typescript-tips --json
```

#### 出力（デフォルト）

```markdown
---
title: TypeScriptの便利なテクニック
tags: [typescript, tips]
created: 2026-02-15T10:30:00+09:00
updated: 2026-02-15T10:30:00+09:00
---

# TypeScriptの便利なテクニック

本文がここに表示される...
```

#### 出力（`--meta-only`）

```yaml
title: TypeScriptの便利なテクニック
tags: [typescript, tips]
created: 2026-02-15T10:30:00+09:00
updated: 2026-02-15T10:30:00+09:00
template: note
draft: false
```

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScriptの便利なテクニック",
    "scope": "local",
    "folder": "notes",
    "file_path": "/path/to/.kami/vault/notes/typescript-tips.md",
    "frontmatter": {
      "title": "TypeScriptの便利なテクニック",
      "tags": ["typescript", "tips"],
      "created": "2026-02-15T10:30:00+09:00",
      "updated": "2026-02-15T10:30:00+09:00",
      "template": "note",
      "aliases": [],
      "draft": false
    },
    "body": "# TypeScriptの便利なテクニック\n\n本文がここに表示される...",
    "links": ["generics-guide", "global:typescript-generics"],
    "backlinks": [
      { "slug": "web-development", "scope": "local", "title": "Web開発メモ" }
    ]
  }
}
```

#### 終了コード

| コード | 条件 |
|--------|------|
| `0` | 成功 |
| `2` | 記事が見つからない |
| `3` | slugが曖昧（複数候補あり） |

---

### `kami edit`

記事のメタデータや本文を更新する。

#### 構文

```
kami edit <slug> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `slug` | yes | 記事の識別子 |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--title` | | string | — | タイトルを変更 |
| `--add-tag` | | string[] | — | タグを追加 |
| `--remove-tag` | | string[] | — | タグを削除 |
| `--body` | `-b` | string | — | 本文を置換（ファイルパスまたは `-` でstdin） |
| `--append` | `-a` | string | — | 本文末尾に追記（ファイルパスまたは `-` でstdin） |
| `--draft` | | boolean | — | 下書きフラグを設定 |
| `--add-alias` | | string | — | エイリアスを追加 |
| `--remove-alias` | | string | — | エイリアスを削除 |
| `--scope` | `-s` | `local` \| `global` | (自動解決) | 対象スコープ |

#### 動作

1. 記事を検索・読み込み
2. Hook を実行（`article:pre-update`）
3. 指定されたオプションに応じてfrontmatterや本文を更新
4. `updated` タイムスタンプを現在時刻に更新
5. ファイルを書き込み
6. インデックスを更新
7. wikiリンクの変更を検出し、リンクインデックスを更新
8. Hook を実行（`article:post-update`）

#### `--body` と `--append` の違い

- `--body`: 本文を**全体置換**する。frontmatterは保持
- `--append`: 既存の本文の**末尾に追記**する。改行を1つ挟んで追加

`--body` と `--append` を同時に指定した場合はエラー。

#### 使用例

```bash
# タイトル変更
kami edit typescript-tips --title "TypeScript Tips & Tricks"

# タグの追加・削除
kami edit typescript-tips --add-tag advanced --remove-tag beginner

# 本文の全体置換（ファイルから）
kami edit typescript-tips --body ./updated-content.md

# 本文の全体置換（stdinから）
cat new-content.md | kami edit typescript-tips --body -

# 本文末尾に追記（stdinから）
echo "## 追記 (2026-02-15)\n\n新しい情報..." | kami edit typescript-tips --append -

# 本文末尾に追記（ファイルから）
kami edit typescript-tips --append ./additional-notes.md

# デイリーノートへの追記（典型的なエージェントの使い方）
echo "- 14:30 meeting with team about kami design" | kami edit 2026-02-15 --append - --scope global

# 複数のメタデータを同時に変更
kami edit typescript-tips --title "New Title" --add-tag advanced --draft false

# JSON出力
kami edit typescript-tips --add-tag new-tag --json
```

#### 出力

```
Updated: notes/typescript-tips (local)
```

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScript Tips & Tricks",
    "scope": "local",
    "file_path": "/path/to/.kami/vault/notes/typescript-tips.md",
    "changes": {
      "title": { "from": "TypeScriptの便利なテクニック", "to": "TypeScript Tips & Tricks" },
      "tags_added": ["advanced"],
      "tags_removed": ["beginner"],
      "body_changed": false,
      "body_appended": false
    },
    "updated": "2026-02-15T14:00:00+09:00"
  }
}
```

#### 終了コード

| コード | 条件 |
|--------|------|
| `0` | 更新成功 |
| `1` | バリデーションエラー / `--body` と `--append` の同時指定 |
| `2` | 記事が見つからない |
| `3` | slugが曖昧 |
| `4` | pre-hookがブロック |

---

### `kami delete`

記事を削除する。

#### 構文

```
kami delete <slug> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `slug` | yes | 記事の識別子 |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--force` | `-F` | boolean | `false` | 確認プロンプトなしで削除 |
| `--scope` | `-s` | `local` \| `global` | (自動解決) | 対象スコープ |

#### 動作

1. 記事を検索
2. `--force` でない場合、確認プロンプトを表示（`--json` モードでは `--force` 必須）
3. Hook を実行（`article:pre-delete`）
4. バックリンクの存在を確認し、警告を表示
5. ファイルを削除
6. インデックスから記事を削除
7. リンクインデックスを更新（削除された記事へのリンクはdangling linkとして記録）
8. Hook を実行（`article:post-delete`）

#### 使用例

```bash
# 確認プロンプト付き削除
kami delete typescript-tips

# 強制削除
kami delete typescript-tips --force

# エージェントからの削除（JSON + force）
kami delete typescript-tips --force --json
```

#### 出力

```
Article 'typescript-tips' has 2 backlink(s): web-development, learning-log
Delete notes/typescript-tips (local)? [y/N] y
Deleted: notes/typescript-tips (local)
```

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScriptの便利なテクニック",
    "scope": "local",
    "file_path": "/path/to/.kami/vault/notes/typescript-tips.md",
    "dangling_backlinks": [
      { "slug": "web-development", "scope": "local" },
      { "slug": "learning-log", "scope": "local" }
    ]
  }
}
```

#### 終了コード

| コード | 条件 |
|--------|------|
| `0` | 削除成功 |
| `1` | ユーザーがキャンセル / `--json` で `--force` なし |
| `2` | 記事が見つからない |
| `3` | slugが曖昧 |
| `4` | pre-hookがブロック |

---

### `kami list`

記事の一覧を表示する。

#### 構文

```
kami list [options]
```

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--folder` | `-f` | string | — | フォルダでフィルタ |
| `--tag` | `-t` | string[] | — | タグでフィルタ（複数指定時はAND） |
| `--sort` | | `created` \| `updated` \| `title` | `updated` | ソート基準 |
| `--order` | | `asc` \| `desc` | `desc` | ソート順 |
| `--limit` | `-n` | number | `20` | 表示件数 |
| `--offset` | | number | `0` | 表示開始位置 |
| `--scope` | `-s` | `local` \| `global` \| `all` | (自動解決) | 対象スコープ |
| `--draft` | | boolean | — | 下書きのみ / 下書きを除外（未指定: 全て） |

#### 使用例

```bash
# デフォルト（ローカルスコープ、更新日時降順、20件）
kami list

# 両スコープから全記事
kami list --scope all

# フォルダとタグでフィルタ
kami list --folder daily --tag meeting

# タイトル昇順でソート
kami list --sort title --order asc

# ページネーション
kami list --limit 10 --offset 10

# エージェント向け
kami list --scope all --json
```

#### 出力

```
 SCOPE   FOLDER   SLUG                  TITLE                         UPDATED
 local   design   architecture-overview  アーキテクチャ概要             2026-02-15
 local   adr      001-use-bun-runtime    ADR-001: Bunランタイムの採用   2026-02-14
 global  notes    typescript-tips        TypeScriptの便利なテクニック   2026-02-13
 (3 articles)
```

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "articles": [
      {
        "slug": "architecture-overview",
        "title": "アーキテクチャ概要",
        "scope": "local",
        "folder": "design",
        "tags": ["architecture"],
        "created": "2026-02-15T09:00:00+09:00",
        "updated": "2026-02-15T10:30:00+09:00",
        "draft": false
      }
    ],
    "total": 3,
    "limit": 20,
    "offset": 0
  }
}
```

#### 終了コード

| コード | 条件 |
|--------|------|
| `0` | 成功（結果0件でも成功） |
| `1` | 不正なオプション |

---

### `kami search`

記事の全文検索を行う。

#### 構文

```
kami search <query> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `query` | yes | 検索クエリ |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--tag` | `-t` | string[] | — | タグでフィルタ（検索結果を絞り込み） |
| `--folder` | `-f` | string | — | フォルダでフィルタ |
| `--scope` | `-s` | `local` \| `global` \| `all` | `all` | 対象スコープ |
| `--limit` | `-n` | number | `20` | 表示件数 |

#### 検索仕様

- MiniSearch によるBM25ランキング
- 検索対象: タイトル、本文、タグ、エイリアス
- プレフィックス検索: クエリ末尾が部分一致（例: `type` → `typescript` にもマッチ）
- ファジー検索: 編集距離1以内の誤字を許容
- 日本語テキストはBudouXでトークン化

#### 使用例

```bash
# 基本検索（両スコープ）
kami search "TypeScript generics"

# タグで絞り込み
kami search "設計" --tag architecture

# ローカルスコープのみ
kami search "API" --scope local

# エージェント向け
kami search "エラーハンドリング" --json
```

#### 出力

```
 SCOPE   SLUG                  TITLE                         SCORE   MATCH
 local   typescript-tips       TypeScriptの便利なテクニック   12.4    ...Genericsを使った<mark>型安全</mark>な...
 global  typescript-generics   ジェネリクスの使い方           8.7     ...<mark>TypeScript</mark>の<mark>generics</mark>は...
 (2 results)
```

#### JSON出力

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
          "body": ["...Genericsを使った**型安全**な..."],
          "title": []
        },
        "tags": ["typescript", "tips"]
      }
    ],
    "total": 2,
    "query": "TypeScript generics"
  }
}
```

#### 終了コード

| コード | 条件 |
|--------|------|
| `0` | 成功（結果0件でも成功） |
| `1` | 不正なオプション |

---

### `kami links`

指定記事が参照しているforwardリンクの一覧を表示する。

#### 構文

```
kami links <slug> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `slug` | yes | 記事の識別子 |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--scope` | `-s` | `local` \| `global` | (自動解決) | 対象スコープ |

#### 使用例

```bash
kami links typescript-tips
kami links typescript-tips --json
```

#### 出力

```
Links from 'typescript-tips' (local):
  → generics-guide (local)          ジェネリクスガイド
  → global:typescript-generics       ジェネリクスの使い方
  ✗ nonexistent-article              (not found)
```

`✗` はリンク先が存在しないdangling linkを示す。

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "scope": "local",
    "links": [
      {
        "slug": "generics-guide",
        "scope": "local",
        "title": "ジェネリクスガイド",
        "exists": true
      },
      {
        "slug": "typescript-generics",
        "scope": "global",
        "title": "ジェネリクスの使い方",
        "exists": true
      },
      {
        "slug": "nonexistent-article",
        "scope": null,
        "title": null,
        "exists": false
      }
    ]
  }
}
```

#### 終了コード

| コード | 条件 |
|--------|------|
| `0` | 成功 |
| `2` | 記事が見つからない |
| `3` | slugが曖昧 |

---

### `kami backlinks`

指定記事を参照しているバックリンクの一覧を表示する。

#### 構文

```
kami backlinks <slug> [options]
```

#### 引数・オプション

`kami links` と同じ。

#### 使用例

```bash
kami backlinks typescript-tips
kami backlinks typescript-tips --json
```

#### 出力

```
Backlinks to 'typescript-tips' (local):
  ← web-development (local)         Web開発メモ
  ← learning-log (local)            学習ログ
```

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "scope": "local",
    "backlinks": [
      {
        "slug": "web-development",
        "scope": "local",
        "title": "Web開発メモ"
      },
      {
        "slug": "learning-log",
        "scope": "local",
        "title": "学習ログ"
      }
    ]
  }
}
```

#### 終了コード

`kami links` と同じ。

---

### `kami template list`

利用可能なテンプレートの一覧を表示する。

#### 構文

```
kami template list [options]
```

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--scope` | `-s` | `local` \| `global` \| `all` | `all` | 対象スコープ |

#### 使用例

```bash
kami template list
kami template list --json
```

#### 出力

```
 SCOPE   NAME    DESCRIPTION
 local   adr     Architecture Decision Record
 global  note    General note (default)
 global  daily   Daily journal entry
```

ローカルとグローバルに同名テンプレートがある場合、ローカルが優先される旨を注記表示。

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "templates": [
      { "name": "adr", "scope": "local", "description": "Architecture Decision Record" },
      { "name": "note", "scope": "global", "description": "General note (default)" },
      { "name": "daily", "scope": "global", "description": "Daily journal entry" }
    ]
  }
}
```

---

### `kami template show`

テンプレートの内容を表示する。

#### 構文

```
kami template show <name> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `name` | yes | テンプレート名 |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--scope` | `-s` | `local` \| `global` | (自動解決) | 対象スコープ |

#### 出力

テンプレートファイルの内容をそのままstdoutに出力。

---

### `kami template create`

新しいテンプレートを作成する。

#### 構文

```
kami template create <name> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `name` | yes | テンプレート名 |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--scope` | `-s` | `local` \| `global` | (自動解決) | 保存先スコープ |
| `--body` | `-b` | string | — | テンプレートの内容（ファイルパスまたは `-` でstdin） |

#### 動作

`--body` 未指定の場合、デフォルトのテンプレート雛形を作成する:

```markdown
---
title: ""
tags: []
---
```

---

### `kami export`

記事をエクスポートする。

#### 構文

```
kami export <slug> [options]
```

#### 引数

| 引数 | 必須 | 説明 |
|------|------|------|
| `slug` | yes | 記事の識別子 |

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--format` | `-F` | `md` \| `html` | `md` | 出力形式 |
| `--output` | `-o` | string | (stdout) | 出力先ファイルパス |
| `--scope` | `-s` | `local` \| `global` | (自動解決) | 対象スコープ |

#### 動作

- `md`: wikiリンクを解決したMarkdown（`[[slug]]` → `[title](path)` に変換）
- `html`: remark/rehype でレンダリングしたHTMLを出力

#### 使用例

```bash
# Markdownとしてstdoutに出力
kami export typescript-tips

# HTMLファイルとして保存
kami export typescript-tips --format html --output ./output.html
```

---

### `kami build`

静的HTMLをビルドする。

#### 構文

```
kami build [options]
```

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--slug` | | string | — | 特定記事のみビルド（インクリメンタル） |
| `--scope` | `-s` | `local` \| `global` \| `all` | `all` | 対象スコープ |
| `--clean` | | boolean | `false` | 出力先を削除してからフルビルド |

#### 動作

1. Hook を実行（`build:pre`）
2. `--slug` 指定時: 対象記事のHTMLのみ再生成
3. `--slug` 未指定時: 全記事のHTMLを生成 + ホーム、タグ一覧、検索ページを生成
4. Hook を実行（`build:post`）

#### 使用例

```bash
# フルビルド
kami build

# 特定記事のみインクリメンタルビルド
kami build --slug typescript-tips

# クリーンビルド
kami build --clean
```

#### 出力

```
Building...
  ✓ articles/local/design/architecture-overview.html
  ✓ articles/global/notes/typescript-tips.html
  ✓ index.html
  ✓ tags/index.html
Built 4 pages in 120ms
```

---

### `kami serve`

開発用Honoサーバーを起動する。

#### 構文

```
kami serve [options]
```

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--port` | `-p` | number | `3000` | ポート番号 |
| `--build` | | boolean | `true` | 起動前にビルドを実行 |

#### 動作

1. `--build` が `true` の場合、`kami build` を実行
2. Honoサーバーを起動
3. 静的ファイルの配信 + POST APIエンドポイントを提供

#### 出力

```
kami server running at http://localhost:3000
  Local scope:  /path/to/project/.kami
  Global scope: /home/user/.kami
```

---

### `kami reindex`

インデックスを再構築する。

#### 構文

```
kami reindex [options]
```

#### オプション

| オプション | 短縮 | 型 | デフォルト | 説明 |
|-----------|------|-----|-----------|------|
| `--scope` | `-s` | `local` \| `global` \| `all` | `all` | 対象スコープ |

#### 動作

1. 対象スコープのvault内の全Markdownファイルをスキャン
2. frontmatterをパースしてメタデータインデックス（`index.json`）を再構築
3. wikiリンクを解析してリンクインデックス（`links.json`）を再構築
4. 全文検索インデックスを再構築

#### 使用例

```bash
# 全スコープ再構築
kami reindex

# ローカルスコープのみ
kami reindex --scope local
```

#### 出力

```
Reindexing...
  local:  15 articles, 42 links
  global: 87 articles, 156 links
Reindexed in 340ms
```

#### JSON出力

```json
{
  "ok": true,
  "data": {
    "scopes": {
      "local": { "articles": 15, "links": 42 },
      "global": { "articles": 87, "links": 156 }
    },
    "duration_ms": 340
  }
}
```

---

## テンプレートファイル仕様

テンプレートは `templates/` ディレクトリ内のMarkdownファイル。ファイル名（拡張子なし）がテンプレート名。

### テンプレート内の変数

テンプレート内で使用できるプレースホルダ:

| 変数 | 説明 |
|------|------|
| `{{title}}` | `kami create` で指定されたタイトル |
| `{{date}}` | 作成日（YYYY-MM-DD） |
| `{{datetime}}` | 作成日時（ISO 8601） |
| `{{folder}}` | 保存先フォルダ |

### 組み込みテンプレート例

#### `note.md`

```markdown
---
title: "{{title}}"
tags: []
created: {{datetime}}
updated: {{datetime}}
template: note
---

# {{title}}
```

#### `daily.md`

```markdown
---
title: "{{date}}"
tags: [daily]
created: {{datetime}}
updated: {{datetime}}
template: daily
---

# {{date}}

## Log
```
