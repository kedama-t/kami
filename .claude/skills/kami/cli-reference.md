# kami CLI リファレンス詳細

必要な時だけ参照すること。基本的な使い方は SKILL.md を参照。

## Frontmatter仕様

```yaml
---
title: "記事タイトル"
tags: [tag1, tag2]
created: 2026-02-15T10:30:00+09:00  # ISO 8601
updated: 2026-02-15T10:30:00+09:00
template: note        # optional
aliases: [alias1]     # optional
draft: false          # optional
---
```

## テンプレート変数

| 変数 | 展開値 |
|------|--------|
| `{{title}}` | create時のタイトル |
| `{{date}}` | YYYY-MM-DD |
| `{{datetime}}` | ISO 8601 |
| `{{folder}}` | 保存先フォルダ |

## Slug解決

slugには以下のいずれかを指定可能:
- ファイル名: `typescript-tips`
- フォルダ付き: `notes/typescript-tips`
- タイトル完全一致: `"TypeScriptの便利なテクニック"`
- エイリアス: aliases フィールドの値

自動生成: タイトルそのまま使用（日本語OK）。FS禁止文字は `-` に置換。重複時は `-1`, `-2` を付与。

## エラーコード

| code | 説明 |
|------|------|
| `ARTICLE_NOT_FOUND` | 記事が存在しない |
| `AMBIGUOUS_SLUG` | 複数候補あり（`candidates` で一覧取得可） |
| `ARTICLE_ALREADY_EXISTS` | 同名記事が既に存在 |
| `TEMPLATE_NOT_FOUND` | テンプレートが存在しない |
| `SCOPE_NOT_FOUND` | スコープ未初期化 |
| `INVALID_FRONTMATTER` | frontmatterパース失敗 |
| `HOOK_BLOCKED` | pre-hookが操作を拒否 |
| `VALIDATION_ERROR` | バリデーションエラー |
| `IO_ERROR` | ファイルI/Oエラー |

## 主要コマンドのJSON出力例

### create

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScriptの便利なテクニック",
    "scope": "local",
    "folder": "notes",
    "file_path": "/path/.kami/vault/notes/typescript-tips.md",
    "tags": ["typescript"],
    "created": "2026-02-15T10:30:00+09:00"
  }
}
```

### read (--json)

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScriptの便利なテクニック",
    "scope": "local",
    "folder": "notes",
    "file_path": "/path/.kami/vault/notes/typescript-tips.md",
    "frontmatter": {
      "title": "TypeScriptの便利なテクニック",
      "tags": ["typescript"],
      "created": "2026-02-15T10:30:00+09:00",
      "updated": "2026-02-15T10:30:00+09:00",
      "template": "note",
      "aliases": [],
      "draft": false
    },
    "body": "# TypeScriptの便利なテクニック\n\n...",
    "links": ["generics-guide"],
    "backlinks": [{ "slug": "web-dev", "scope": "local", "title": "Web開発メモ" }]
  }
}
```

### list (--json)

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
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

### search (--json)

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
        "matches": { "body": ["...snippet..."], "title": [] },
        "tags": ["typescript"]
      }
    ],
    "total": 1,
    "query": "TypeScript"
  }
}
```

### edit (--json)

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScript Tips",
    "scope": "local",
    "file_path": "/path/.kami/vault/notes/typescript-tips.md",
    "changes": {
      "title": { "from": "旧タイトル", "to": "TypeScript Tips" },
      "tags_added": ["advanced"],
      "tags_removed": [],
      "body_changed": false,
      "body_appended": false
    },
    "updated": "2026-02-15T14:00:00+09:00"
  }
}
```

### delete (--force --json)

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScriptの便利なテクニック",
    "scope": "local",
    "file_path": "/path/.kami/vault/notes/typescript-tips.md",
    "dangling_backlinks": [
      { "slug": "web-dev", "scope": "local" }
    ]
  }
}
```

## Hook設定 (hooks.json)

```json
{
  "hooks": {
    "article:post-create": [
      {
        "matcher": "daily/.*",
        "hooks": [{ "type": "command", "command": "git add ${file_path}", "timeout": 30 }]
      }
    ]
  }
}
```

イベント: `article:pre-create`, `article:post-create`, `article:pre-update`, `article:post-update`, `article:pre-delete`, `article:post-delete`, `build:pre`, `build:post`

変数: `${slug}`, `${title}`, `${file_path}`, `${scope}`

## ディレクトリ構造

```
~/.kami/                    ./.kami/
  config.json                config.json
  hooks.json                 hooks.json
  templates/                 templates/
  vault/                     vault/
  index.json                 index.json
  links.json                 links.json
```
