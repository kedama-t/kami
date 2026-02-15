# Article Format

## Frontmatter

```yaml
---
title: "Article Title"
tags: [tag1, tag2]
created: 2026-02-15T10:30:00+09:00
updated: 2026-02-15T10:30:00+09:00
template: note        # optional
aliases: [alias1]     # optional
draft: false          # optional
---
```

## Slug resolution

A slug can be any of:
- Filename: `typescript-tips`
- Folder-qualified: `notes/typescript-tips`
- Exact title match: `"TypeScript Tips"`
- Alias: any value in the `aliases` field

Auto-generation: uses title as-is (Japanese OK). Filesystem-unsafe chars (`/ \ : * ? " < > |`) are replaced with `-`. Duplicates get `-1`, `-2` suffix.

## Template variables

| Variable | Expands to |
|----------|------------|
| `{{title}}` | Title from `kami create` |
| `{{date}}` | YYYY-MM-DD |
| `{{datetime}}` | ISO 8601 |
| `{{folder}}` | Target folder |

## Directory structure

```
~/.kami/          (global)     ./.kami/          (local)
  config.json                    config.json
  hooks.json                     hooks.json
  templates/                     templates/
  vault/                         vault/
  index.json                     index.json
  links.json                     links.json
```

## Hooks (hooks.json)

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

Events: `article:pre-create`, `article:post-create`, `article:pre-update`, `article:post-update`, `article:pre-delete`, `article:post-delete`, `build:pre`, `build:post`

Variables: `${slug}`, `${title}`, `${file_path}`, `${scope}`
