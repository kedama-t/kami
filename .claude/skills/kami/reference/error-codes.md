# Error Codes

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (invalid args, I/O error, etc.) |
| 2 | Article not found |
| 3 | Ambiguous slug (multiple candidates) |
| 4 | Hook blocked (pre-hook rejected operation) |

## JSON error codes

| code | Description |
|------|-------------|
| `ARTICLE_NOT_FOUND` | Article does not exist |
| `AMBIGUOUS_SLUG` | Multiple candidates. `error.candidates` contains the list |
| `ARTICLE_ALREADY_EXISTS` | Article with same slug already exists |
| `TEMPLATE_NOT_FOUND` | Template does not exist |
| `SCOPE_NOT_FOUND` | Scope not initialized |
| `INVALID_FRONTMATTER` | Frontmatter parse failure |
| `HOOK_BLOCKED` | Pre-hook rejected operation |
| `VALIDATION_ERROR` | Input validation error |
| `IO_ERROR` | File I/O error |

## Error JSON structure

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "AMBIGUOUS_SLUG",
    "message": "Multiple articles match 'tips'",
    "candidates": ["notes/typescript-tips", "notes/css-tips"]
  }
}
```
