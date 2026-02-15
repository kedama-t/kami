# kami - Requirements Specification

> **kami** — **K**nowledge **A**gent **M**arkdown **I**nterface
>
> AIエージェントと人間の双方が扱いやすい、ローカルファーストのパーソナルナレッジベース

---

## 1. プロジェクト概要

### 1.1 ポジショニング

- Claude CodeなどのコーディングエージェントがCLI経由で自然に読み書きできる
- 人間がWebUIで快適に閲覧・編集できる
- ローカルファーストで、同期手段はユーザーに委ねる（Git管理を想定）

### 1.2 技術スタック

| 項目 | 選定 |
|------|------|
| 言語 | TypeScript |
| ランタイム / パッケージマネージャ / テストランナー | Bun |
| CLIフレームワーク | 未定（後述） |
| APIサーバー | Hono |
| フロントエンド（静的レンダリング） | React (ReactDOMServer) |
| Markdownパーサー | unified / remark / rehype |
| データ形式 | Markdown + YAML frontmatter |
| ストレージ | ローカルファイルシステム（抽象化層あり） |

---

## 2. データモデル

### 2.1 記事構造: フォルダ階層 + タグ + グラフ（ハイブリッド）

```
vault/
  daily/
    2026-02-15.md
  projects/
    kami-development.md
  notes/
    typescript-tips.md
    markdown-parsing.md
  reading/
    book-review-example.md
```

- **フォルダ**: 大分類としての物理的な整理単位
- **タグ**: frontmatterで定義する横断的な分類
- **wikiリンク**: 本文中の `[[記事名]]` で記事間の関係を表現
- **バックリンク**: 自動生成・維持されるインデックス

### 2.2 Frontmatter スキーマ

```yaml
---
title: 記事タイトル
tags: [typescript, tips]
created: 2026-02-15T10:30:00+09:00
updated: 2026-02-15T10:30:00+09:00
template: note          # 使用したテンプレート名（省略可）
aliases: [ts-tips]      # 別名（wikiリンク解決に使用、省略可）
draft: false            # 下書きフラグ（省略可、デフォルト: false）
---
```

### 2.3 Wikiリンク記法

```markdown
通常リンク: [[typescript-tips]]
別名付き:   [[typescript-tips|TypeScriptのコツ]]
```

- リンク先は `title` または `aliases` またはファイル名（拡張子なし）で解決する
- 解決優先順位: title → aliases → ファイル名

### 2.4 インデックス

記事のメタデータ・リンク関係を高速に参照するために、インデックスファイルを管理する。

```
.kami/
  index.json        # 全記事のメタデータインデックス
  links.json        # リンクグラフ（forward links + backlinks）
```

- 記事の作成・更新・削除時にインクリメンタルに更新する
- `kami reindex` コマンドで全体を再構築できる

---

## 3. CLI（`kami`コマンド）

### 3.1 基本設計

- エージェントが扱いやすいよう、入出力はプレーンテキストまたはJSON（`--json` フラグ）
- 終了コードで成功/失敗を明示
- ヘルプは `--help` で参照可能

### 3.2 コマンド一覧

#### CRUD

| コマンド | 説明 |
|----------|------|
| `kami create <title> [--folder <path>] [--tag <tag>...] [--template <name>]` | 記事を作成 |
| `kami read <slug>` | 記事をstdoutに出力（Markdown） |
| `kami edit <slug> --title <new> / --add-tag <tag> / --body <file>` | 記事のメタデータ・本文を更新 |
| `kami delete <slug>` | 記事を削除（確認プロンプトあり、`--force` で省略） |
| `kami list [--folder <path>] [--tag <tag>] [--sort <field>] [--limit <n>]` | 記事一覧を表示 |

#### 検索

| コマンド | 説明 |
|----------|------|
| `kami search <query> [--tag <tag>] [--folder <path>]` | 全文検索 |

#### リンク管理

| コマンド | 説明 |
|----------|------|
| `kami links <slug>` | 指定記事のforwardリンク一覧 |
| `kami backlinks <slug>` | 指定記事のバックリンク一覧 |

#### テンプレート

| コマンド | 説明 |
|----------|------|
| `kami template list` | テンプレート一覧 |
| `kami template show <name>` | テンプレートの内容を表示 |
| `kami template create <name>` | 新しいテンプレートを作成 |

#### エクスポート

| コマンド | 説明 |
|----------|------|
| `kami export <slug> --format <md\|html>` | 指定記事をエクスポート（PDF対応は後日） |

#### ビルド・サーバー

| コマンド | 説明 |
|----------|------|
| `kami build [--slug <slug>]` | 静的HTMLをビルド（slug指定でインクリメンタル） |
| `kami serve [--port <n>]` | Honoサーバーを起動（静的ファイル配信 + POST API） |
| `kami reindex` | インデックスを全再構築 |

### 3.3 Slugの解決

slug（記事の識別子）は以下のいずれかで指定可能:

- ファイル名（拡張子なし）: `typescript-tips`
- フォルダ付きパス: `notes/typescript-tips`
- タイトル（完全一致）: `"TypeScriptのコツ"`

曖昧な場合は候補を表示し、ユーザーに選択させる。

---

## 4. WebUI

### 4.1 アーキテクチャ

```
[静的HTML] ← ReactDOMServerで事前ビルド
     ↑ 配信
[Hono Server]
     ↑ POST API（作成・更新・削除）
[ブラウザ]
     ↓ フォーム送信
[Hono Server] → ファイル保存 → インクリメンタルビルド → インデックス更新
```

- **閲覧**: 事前ビルド済みの静的HTMLを配信。JSバンドル最小限
- **編集**: テキストエリア + Markdownプレビューのシンプルな編集画面
- **変更時**: 対象ページのHTMLのみ再ビルド + インデックス更新

### 4.2 ページ構成

| ページ | パス | 説明 |
|--------|------|------|
| ホーム | `/` | 最近の記事一覧、タグクラウド |
| 記事閲覧 | `/articles/<slug>` | Markdownを静的レンダリングしたページ。バックリンク表示あり |
| 記事編集 | `/articles/<slug>/edit` | テキストエリア + プレビュー |
| 記事作成 | `/new` | 新規記事フォーム（テンプレート選択可） |
| 検索 | `/search?q=<query>` | 全文検索結果 |
| タグ一覧 | `/tags` | タグ一覧とタグ別記事リスト |

### 4.3 静的ビルド出力

```
dist/
  index.html
  articles/
    notes/
      typescript-tips.html
    daily/
      2026-02-15.html
  tags/
    index.html
  assets/
    style.css
    edit.js          # 編集ページ用の最小限のJS
```

---

## 5. ストレージ抽象化

### 5.1 目的

将来Cloudflare Workers（R2 + KV）へ移行可能にする。

### 5.2 インターフェース

```typescript
interface StorageAdapter {
  // 記事操作
  readArticle(path: string): Promise<string>;
  writeArticle(path: string, content: string): Promise<void>;
  deleteArticle(path: string): Promise<void>;
  listArticles(folder?: string): Promise<ArticleMeta[]>;

  // インデックス操作
  readIndex(): Promise<Index>;
  writeIndex(index: Index): Promise<void>;

  // テンプレート操作
  readTemplate(name: string): Promise<string>;
  listTemplates(): Promise<string[]>;
}
```

### 5.3 実装

| アダプタ | 用途 |
|----------|------|
| `LocalStorageAdapter` | ローカルファイルシステム（初期実装） |
| `CloudflareStorageAdapter` | R2 + KV（将来） |

---

## 6. プロジェクト構成

```
kami/
  src/
    cli/                  # CLIコマンド定義
      commands/
        create.ts
        read.ts
        edit.ts
        delete.ts
        list.ts
        search.ts
        links.ts
        backlinks.ts
        template.ts
        export.ts
        build.ts
        serve.ts
        reindex.ts
      index.ts            # CLIエントリポイント
    core/                 # ビジネスロジック
      article.ts          # 記事の読み書き・バリデーション
      frontmatter.ts      # frontmatterパース・シリアライズ
      search.ts           # 全文検索
      linker.ts           # wikiリンク解析・バックリンク管理
      index-manager.ts    # インデックス管理
      template.ts         # テンプレート管理
      exporter.ts         # エクスポート機能
    server/               # Hono APIサーバー
      app.ts              # Honoアプリ定義
      routes/
        api.ts            # POST APIルート
      middleware/
    renderer/             # 静的HTMLレンダリング
      build.ts            # ビルドロジック
      components/         # Reactコンポーネント（SSR用）
        Layout.tsx
        ArticlePage.tsx
        HomePage.tsx
        TagsPage.tsx
        EditPage.tsx
    storage/              # ストレージ抽象化
      adapter.ts          # インターフェース定義
      local.ts            # ローカルFS実装
    types/                # 型定義
      article.ts
      index.ts
      config.ts
  templates/              # 組み込みテンプレート
    note.md
    daily.md
  tests/                  # テスト
    core/
    cli/
    server/
  package.json
  tsconfig.json
  bunfig.toml
```

---

## 7. 設定ファイル

プロジェクトルートまたは `~/.config/kami/config.toml` に配置。

```toml
[vault]
path = "./vault"              # 記事の保存先

[build]
outDir = "./dist"             # 静的ビルド出力先

[server]
port = 3000

[templates]
dir = "./templates"           # テンプレートディレクトリ
```

---

## 8. 実装フェーズ（案）

### Phase 1: 基盤
- プロジェクトセットアップ（Bun, TypeScript, Hono, React）
- 型定義、ストレージアダプタ（ローカルFS）
- frontmatterパーサー
- 基本CRUD（CLI: create, read, edit, delete, list）

### Phase 2: グラフ・検索
- wikiリンクパーサー（remarkプラグイン）
- リンクインデックス・バックリンク管理
- 全文検索
- CLI: search, links, backlinks

### Phase 3: テンプレート・エクスポート
- テンプレート機能
- Markdown / HTMLエクスポート
- CLI: template, export

### Phase 4: WebUI
- 静的HTMLレンダリング（React SSR）
- kami build / kami serve
- 閲覧ページ、ホーム、タグ一覧
- 編集画面（テキストエリア + プレビュー）
- インクリメンタルビルド

### Phase 5: 拡張
- PDF エクスポート
- Cloudflare Workers対応（StorageAdapter実装）
- 認証機能

---

## 9. 未決事項

- [ ] CLIフレームワークの選定（commander / citty / 自前実装）
- [ ] 全文検索の実装方式（単純な文字列マッチ / MiniSearch / lunr）
- [ ] 設定ファイルフォーマットの確定（TOML / JSON / YAML）

---

*このドキュメントは要件の合意形成のためのものであり、実装の進行に伴い更新される。*
