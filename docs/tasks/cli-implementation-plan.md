# kami CLI Implementation Plan

> CLI実装の計画とTODOリスト。要件定義書（REQUIREMENTS.md）とCLI仕様書（specs/CLI.md）に基づく。

---

## 実装方針

### 原則

- **ボトムアップ**: core層（型定義・ストレージ・ビジネスロジック）を先に実装し、CLI層はcoreを呼び出すだけの薄いレイヤーにする
- **テスト駆動**: 各coreモジュールにユニットテストを書きながら進める
- **インクリメンタル**: 動くものを小さく作り、段階的にコマンドを追加する
- **Phase 1〜3を対象**: build / serve（Phase 4: WebUI）は本計画のスコープ外

### 依存関係グラフ

```
types/  ←── すべてのモジュールが依存
  ↑
storage/adapter.ts + local.ts  ←── ファイルI/Oの基盤
  ↑
core/scope.ts  ←── グローバル/ローカルスコープの発見・解決
  ↑
core/frontmatter.ts  ←── frontmatterのパース・シリアライズ
  ↑
core/article.ts  ←── CRUD操作（scope + storage + frontmatter を統合）
  ↑
core/index-manager.ts  ←── メタデータインデックスの管理
  ↑
core/linker.ts  ←── wikiリンク解析・リンクインデックス管理
  ↑
core/search.ts  ←── MiniSearch + BudouXによる全文検索
  ↑
core/template.ts  ←── テンプレートの読み込み・変数展開
  ↑
core/hook.ts  ←── Hook設定の読み込み・実行
  ↑
core/exporter.ts  ←── エクスポート（wikiリンク解決・HTMLレンダリング）
  ↑
cli/commands/*  ←── 各コマンドはcoreの関数を呼び出すだけ
  ↑
cli/index.ts  ←── citty によるコマンドルーティング
```

---

## Step 0: プロジェクトセットアップ

- [ ] `bun init` でプロジェクト初期化
- [ ] `tsconfig.json` 設定（strict, paths alias）
- [ ] 依存パッケージのインストール
  - `citty` — CLIフレームワーク
  - `gray-matter` — frontmatterパーサー
  - `minisearch` — 全文検索
  - `budoux` — 日本語トークナイザ
  - `unified`, `remark-parse`, `remark-rehype`, `rehype-stringify` — Markdown→HTML変換
- [ ] `package.json` の `bin` フィールド設定（`kami` コマンド）
- [ ] `bunfig.toml` 設定
- [ ] ディレクトリ構造の作成（`src/cli/`, `src/core/`, `src/storage/`, `src/types/`）
- [ ] 組み込みテンプレート（`templates/note.md`, `templates/daily.md`）作成

### 完了条件

`bun run src/cli/index.ts --help` で空のkamiコマンドが表示される。

---

## Step 1: 型定義

- [ ] `src/types/scope.ts` — Scope型（`"local" | "global"`）、ScopeAll型、スコープパス関連
- [ ] `src/types/article.ts` — Frontmatter型、ArticleMeta型、Article型（frontmatter + body）、ResolvedArticle型（scope付き）
- [ ] `src/types/index.ts` — MetadataIndex型、LinkGraph型（forward links + backlinks）
- [ ] `src/types/config.ts` — KamiConfig型、デフォルト値
- [ ] `src/types/hook.ts` — HookEvent型、HookHandler型、HookConfig型
- [ ] `src/types/result.ts` — CLIのJSON出力用。SuccessResult / ErrorResult / ErrorCode 型

### 完了条件

全型定義がコンパイルを通る。他のモジュールからimport可能。

---

## Step 2: ストレージアダプタ

- [ ] `src/storage/adapter.ts` — StorageAdapterインターフェース定義
- [ ] `src/storage/local.ts` — LocalStorageAdapter実装
  - `readFile(path)` / `writeFile(path, content)` / `deleteFile(path)`
  - `listFiles(dir, pattern?)` — glob対応のファイル一覧
  - `exists(path)` / `mkdir(path)`
- [ ] `tests/storage/local.test.ts` — tmpdir上でのCRUDテスト

### 完了条件

テスト全パス。tmpディレクトリでファイルの読み書き・削除・一覧が正しく動く。

---

## Step 3: スコープ解決

- [ ] `src/core/scope.ts`
  - `findGlobalScope()` — `~/.kami/` のパスを返す（存在確認付き）
  - `findLocalScope(cwd?)` — カレントディレクトリから上方向に `.kami/` を探索
  - `resolveScope(requested?, operation?)` — 要件に基づくスコープ自動解決
  - `getScopePaths(scope)` — スコープからvault/index/links/templates等のパスを導出
  - `initLocalScope(cwd)` — `.kami/` ディレクトリ構造を初期化
- [ ] `tests/core/scope.test.ts`

### 完了条件

テスト全パス。global / local / 自動解決がCLI仕様の通りに動く。

---

## Step 4: Frontmatterパーサー

- [ ] `src/core/frontmatter.ts`
  - `parseFrontmatter(content)` — Markdown文字列からfrontmatter + bodyを分離
  - `serializeFrontmatter(frontmatter, body)` — frontmatter + bodyをMarkdown文字列に結合
  - `validateFrontmatter(data)` — 必須フィールドの検証、デフォルト値の補完
  - `generateFrontmatter(title, options?)` — 新規記事用のfrontmatterを生成
- [ ] `tests/core/frontmatter.test.ts`

### 完了条件

テスト全パス。パース→シリアライズの往復で内容が保持される。

---

## Step 5: 記事CRUD（core層）

- [ ] `src/core/article.ts`
  - `createArticle(title, options)` — テンプレート読み込み、frontmatter生成、ファイル書き込み
  - `readArticle(slug, scope?)` — スコープ解決 → ファイル読み込み → パース
  - `updateArticle(slug, changes)` — メタデータ更新、本文置換/追記、updatedタイムスタンプ更新
  - `deleteArticle(slug, scope?)` — ファイル削除
  - `listArticles(options)` — インデックスからフィルタ・ソート・ページネーション
  - `resolveSlug(slug, scope?)` — slug → ファイルパスの解決（title/alias/filename検索、曖昧さ判定）
  - slug自動生成ヘルパー（タイトルからのサニタイズ、重複時のナンバリング）
  - stdin読み込みヘルパー（`--body -` 対応）
- [ ] `tests/core/article.test.ts` — 各操作のテスト（正常系 + エラー系）

### 完了条件

テスト全パス。tmpディレクトリ上でCRUD操作が正しく動き、frontmatter・本文が期待通り。

---

## Step 6: インデックス管理

- [ ] `src/core/index-manager.ts`
  - `loadIndex(scope)` / `saveIndex(scope, index)` — index.jsonの読み書き
  - `addToIndex(scope, meta)` / `removeFromIndex(scope, slug)` / `updateInIndex(scope, meta)` — インクリメンタル更新
  - `rebuildIndex(scope)` — vault全体をスキャンしてインデックスを再構築
  - `queryIndex(scope, filters, sort, pagination)` — フィルタリング・ソート・ページネーション
- [ ] `tests/core/index-manager.test.ts`

### 完了条件

テスト全パス。記事のCRUDに連動してインデックスが正しく更新される。

---

## Step 7: CLIコマンド（CRUD + init）

ここでcittyによるCLI配線を構築し、Step 3〜6のcore層をコマンドとして公開する。

- [ ] `src/cli/index.ts` — cittyのメインコマンド定義（グローバルオプション、subCommands）
- [ ] `src/cli/helpers/output.ts` — JSON/テキスト出力の共通ヘルパー（`{ ok, data, error }` フォーマット）
- [ ] `src/cli/helpers/input.ts` — stdin読み込み、`--body` 解決ヘルパー
- [ ] `src/cli/commands/init.ts`
- [ ] `src/cli/commands/create.ts`
- [ ] `src/cli/commands/read.ts`
- [ ] `src/cli/commands/edit.ts`（`--body`, `--append`, メタデータ変更）
- [ ] `src/cli/commands/delete.ts`（確認プロンプト、`--force`）
- [ ] `src/cli/commands/list.ts`
- [ ] `tests/cli/commands.test.ts` — CLIの統合テスト（実際にコマンドを実行して出力を検証）

### 完了条件

以下が動く:
```bash
kami init
kami create "Test Article" --tag test
kami read test-article
kami edit test-article --append - <<< "appended text"
kami list --json
kami delete test-article --force
```

---

## Step 8: Wikiリンク解析・リンクインデックス

- [ ] `src/core/linker.ts`
  - `parseWikiLinks(body)` — 本文からwikiリンクを抽出（`[[slug]]`, `[[scope:slug]]`, `[[slug|alias]]`）
  - `resolveWikiLink(link, fromScope)` — wikiリンクの参照先を解決
  - `loadLinkGraph(scope)` / `saveLinkGraph(scope, graph)`
  - `updateLinks(scope, slug, links)` — 記事のリンク情報を更新（forward + backlink両方）
  - `removeLinks(scope, slug)` — 記事削除時のリンク情報削除
  - `getForwardLinks(scope, slug)` / `getBacklinks(scope, slug)`
  - クロススコープリンクの方向チェック（global→local の警告）
- [ ] `tests/core/linker.test.ts`

### 完了条件

テスト全パス。wikiリンクのパース・解決・バックリンク管理が正しく動く。

---

## Step 9: 全文検索

- [ ] `src/core/search.ts`
  - `buildSearchIndex(scope)` — MiniSearchインデックスの構築
  - `loadSearchIndex(scope)` / `saveSearchIndex(scope)` — インデックスの永続化
  - `addToSearchIndex(scope, article)` / `removeFromSearchIndex(scope, slug)` — インクリメンタル更新
  - `search(query, options)` — 検索実行（スコープフィルタ、タグフィルタ、ページネーション）
  - BudouXトークナイザの統合（MiniSearchのcustom tokenizer）
- [ ] `tests/core/search.test.ts` — 日本語・英語混在テキストの検索テスト

### 完了条件

テスト全パス。日本語/英語の全文検索が動き、BM25スコアでランキングされる。

---

## Step 10: CLIコマンド（検索・リンク）

- [ ] `src/cli/commands/search.ts`
- [ ] `src/cli/commands/links.ts`
- [ ] `src/cli/commands/backlinks.ts`
- [ ] `tests/cli/search-links.test.ts`

### 完了条件

`kami search`, `kami links`, `kami backlinks` が仕様通りに動く。

---

## Step 11: テンプレート機能

- [ ] `src/core/template.ts`
  - `listTemplates(scope?)` — テンプレート一覧（スコープ付き）
  - `readTemplate(name, scope?)` — テンプレートの読み込み（ローカル優先）
  - `createTemplate(name, content?, scope?)` — テンプレートの作成
  - `expandTemplate(template, variables)` — `{{title}}`, `{{date}}` 等の変数展開
- [ ] `src/cli/commands/template.ts` — template list / show / create サブコマンド
- [ ] `tests/core/template.test.ts`

### 完了条件

`kami template list`, `kami template show <name>`, `kami template create <name>` が動く。
`kami create --template <name>` でテンプレートが正しく適用される。

---

## Step 12: Hook機能

- [ ] `src/core/hook.ts`
  - `loadHooks(scope?)` — hooks.jsonの読み込み（ローカル + グローバルをマージ）
  - `executeHooks(event, context, phase)` — pre/post hookの実行
    - コマンド文字列内の `${変数名}` 展開
    - stdinへのコンテキストJSON送信
    - stdout JSONの解析（`continue` フィールド）
    - 終了コード判定（0=成功, 2=ブロック, other=警告）
    - タイムアウト処理
    - `KAMI_HOOK=1` 環境変数による再帰防止
  - matcherの正規表現マッチング
- [ ] article.tsのCRUD操作にhook呼び出しを統合
- [ ] `tests/core/hook.test.ts`

### 完了条件

テスト全パス。pre-hookでのブロック、post-hookでの警告、変数展開、再帰防止が正しく動く。

---

## Step 13: エクスポート機能

- [ ] `src/core/exporter.ts`
  - `exportAsMarkdown(slug, scope?)` — wikiリンクを標準Markdownリンクに変換
  - `exportAsHtml(slug, scope?)` — remark/rehype でHTMLに変換
- [ ] `src/cli/commands/export.ts`
- [ ] `tests/core/exporter.test.ts`

### 完了条件

`kami export <slug> --format md` と `kami export <slug> --format html` が動く。

---

## Step 14: reindexコマンド

- [ ] `src/cli/commands/reindex.ts` — インデックス・リンクグラフ・検索インデックスの全再構築
- [ ] `tests/cli/reindex.test.ts`

### 完了条件

`kami reindex` で全インデックスが再構築され、その後のsearch / links / backlinks が正しい結果を返す。

---

## Step 15: 統合テスト・仕上げ

- [ ] E2Eテスト: `kami init` → `create` → `read` → `edit --append` → `search` → `links` → `delete` の一連のフローテスト
- [ ] エッジケースのテスト
  - 日本語タイトルのslug生成
  - クロススコープリンク
  - 同名記事の曖昧さ解決
  - stdinからの入力（`--body -`, `--append -`）
  - グローバルスコープのみ（ローカル未初期化）での動作
- [ ] エラーメッセージの統一確認（全ErrorCodeが正しく使われているか）
- [ ] `--json` 出力の全コマンドでの一貫性確認
- [ ] `--quiet` モードの動作確認
- [ ] `--help` の全コマンドでの出力確認

### 完了条件

全テストパス。CLIとして一通り使える状態。

---

## 実装順序のまとめ

| Step | 内容 | 推定規模 | 依存 |
|------|------|---------|------|
| 0 | プロジェクトセットアップ | S | - |
| 1 | 型定義 | S | 0 |
| 2 | ストレージアダプタ | S | 1 |
| 3 | スコープ解決 | M | 1, 2 |
| 4 | Frontmatterパーサー | S | 1 |
| 5 | 記事CRUD（core） | L | 2, 3, 4 |
| 6 | インデックス管理 | M | 2, 4 |
| 7 | CLIコマンド（CRUD + init） | L | 5, 6 |
| 8 | Wikiリンク解析 | M | 5, 6 |
| 9 | 全文検索 | M | 6 |
| 10 | CLIコマンド（検索・リンク） | S | 8, 9 |
| 11 | テンプレート機能 | S | 2, 3 |
| 12 | Hook機能 | M | 1 |
| 13 | エクスポート | S | 5, 8 |
| 14 | reindexコマンド | S | 6, 8, 9 |
| 15 | 統合テスト・仕上げ | M | all |

### 並列実行可能なグループ

```
         Step 0 → Step 1
                    ├→ Step 2 → Step 3 ─┐
                    └→ Step 4 ──────────┼→ Step 5 → Step 7 (CLI CRUD)
                                        │      ↓
                               Step 6 ←─┘   Step 8 → Step 10 (CLI search/links)
                                              ↓
                               Step 11       Step 9 → Step 10
                               Step 12       Step 13
                                              Step 14
                                                ↓
                                            Step 15
```

---

## スコープ外（今回の実装対象外）

- `kami build` — Phase 4: WebUI（React SSR、Honoサーバー）
- `kami serve` — Phase 4: WebUI
- PDFエクスポート — Phase 5
