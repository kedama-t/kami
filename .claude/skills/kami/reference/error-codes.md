# エラーコード

## 終了コード

| コード | 意味 |
|--------|------|
| 0 | 成功 |
| 1 | 一般エラー（不正な引数、ファイルI/Oエラー等） |
| 2 | 記事が見つからない |
| 3 | slugが曖昧（複数候補あり） |
| 4 | Hookによるブロック（pre-hookが操作を拒否） |

## JSONエラーコード

| code | 説明 |
|------|------|
| `ARTICLE_NOT_FOUND` | 記事が存在しない |
| `AMBIGUOUS_SLUG` | 複数候補あり。`error.candidates` に候補リスト |
| `ARTICLE_ALREADY_EXISTS` | 同名記事が既に存在 |
| `TEMPLATE_NOT_FOUND` | テンプレートが存在しない |
| `SCOPE_NOT_FOUND` | スコープ未初期化 |
| `INVALID_FRONTMATTER` | frontmatterパース失敗 |
| `HOOK_BLOCKED` | pre-hookが操作を拒否 |
| `VALIDATION_ERROR` | バリデーションエラー |
| `IO_ERROR` | ファイルI/Oエラー |

## エラーJSON構造

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
