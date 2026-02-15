# 記事フォーマット

## Frontmatter

```yaml
---
title: "記事タイトル"
tags: [tag1, tag2]
created: 2026-02-15T10:30:00+09:00
updated: 2026-02-15T10:30:00+09:00
template: note        # optional
aliases: [alias1]     # optional
draft: false          # optional
---
```

## Slug解決

slugには以下のいずれかを指定可能:
- ファイル名: `typescript-tips`
- フォルダ付き: `notes/typescript-tips`
- タイトル完全一致: `"TypeScriptの便利なテクニック"`
- エイリアス: aliases フィールドの値

自動生成ルール: タイトルそのまま使用（日本語OK）。FS禁止文字(`/ \ : * ? " < > |`)は `-` に置換。重複時は `-1`, `-2` を付与。

## テンプレート変数

| 変数 | 展開値 |
|------|--------|
| `{{title}}` | create時のタイトル |
| `{{date}}` | YYYY-MM-DD |
| `{{datetime}}` | ISO 8601 |
| `{{folder}}` | 保存先フォルダ |

## ディレクトリ構造

```
~/.kami/          (global)     ./.kami/          (local)
  config.json                    config.json
  hooks.json                     hooks.json
  templates/                     templates/
  vault/                         vault/
  index.json                     index.json
  links.json                     links.json
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
