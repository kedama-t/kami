# JSON Output Examples

## create

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScript Tips",
    "scope": "local",
    "folder": "notes",
    "file_path": "/path/.kami/vault/notes/typescript-tips.md",
    "tags": ["typescript"],
    "created": "2026-02-15T10:30:00+09:00"
  }
}
```

## read

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScript Tips",
    "scope": "local",
    "folder": "notes",
    "file_path": "/path/.kami/vault/notes/typescript-tips.md",
    "frontmatter": {
      "title": "TypeScript Tips",
      "tags": ["typescript"],
      "created": "2026-02-15T10:30:00+09:00",
      "updated": "2026-02-15T10:30:00+09:00",
      "template": "note",
      "aliases": [],
      "draft": false
    },
    "body": "# TypeScript Tips\n\n...",
    "links": ["generics-guide"],
    "backlinks": [{ "slug": "web-dev", "scope": "local", "title": "Web Dev Notes" }]
  }
}
```

## list

```json
{
  "ok": true,
  "data": {
    "articles": [
      {
        "slug": "architecture-overview",
        "title": "Architecture Overview",
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

## search

```json
{
  "ok": true,
  "data": {
    "results": [
      {
        "slug": "typescript-tips",
        "title": "TypeScript Tips",
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

## edit

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScript Tips",
    "scope": "local",
    "file_path": "/path/.kami/vault/notes/typescript-tips.md",
    "changes": {
      "title": { "from": "Old Title", "to": "TypeScript Tips" },
      "tags_added": ["advanced"],
      "tags_removed": [],
      "body_changed": false,
      "body_appended": false
    },
    "updated": "2026-02-15T14:00:00+09:00"
  }
}
```

## delete

```json
{
  "ok": true,
  "data": {
    "slug": "typescript-tips",
    "title": "TypeScript Tips",
    "scope": "local",
    "file_path": "/path/.kami/vault/notes/typescript-tips.md",
    "dangling_backlinks": [
      { "slug": "web-dev", "scope": "local" }
    ]
  }
}
```
