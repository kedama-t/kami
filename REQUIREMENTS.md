# kami - Requirements Specification

> **kami** — **K**nowledge **A**gent **M**arkdown **I**nterface
>
> AIエージェントと人間の双方が扱いやすい、ローカルファーストのパーソナルナレッジベース

---

## 1. プロジェクト概要

### 1.1 ポジショニング

- Claude CodeなどのコーディングエージェントがCLI経由で自然に読み書きできる
- 人間がWebUIで快適に閲覧・編集できる
- ローカルファースト。同期手段はユーザーに委ねる（Git管理を想定）

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
| ストレージ | ローカルファイルシステム |

---

## 2. データモデル

### 2.1 マルチスコープ構成

kamiは**グローバルスコープ**と**ローカルスコープ**の2階層でデータを管理する。

| スコープ | パス | 用途 |
|----------|------|------|
| グローバル | `~/.kami/` | ユーザー全体で共有するナレッジ（汎用メモ、読書記録、個人的な知見など） |
| ローカル | `./.kami/` | カレントプロジェクト固有のナレッジ（設計メモ、ADR、手順書など） |

```
~/.kami/                          # グローバルスコープ
  config.toml                     # グローバル設定
  hooks.toml                      # グローバルHook設定
  templates/                      # グローバルテンプレート
    note.md
    daily.md
  vault/                          # グローバル記事
    daily/
      2026-02-15.md
    notes/
      typescript-tips.md
    reading/
      book-review-example.md
  index.json                      # グローバルインデックス
  links.json                      # グローバルリンクグラフ

./.kami/                          # ローカルスコープ（プロジェクトルート）
  config.toml                     # ローカル設定（グローバルをオーバーライド）
  hooks.toml                      # ローカルHook設定
  templates/                      # ローカルテンプレート
    adr.md
  vault/                          # ローカル記事
    design/
      architecture-overview.md
    adr/
      001-use-bun-runtime.md
  index.json                      # ローカルインデックス
  links.json                      # ローカルリンクグラフ
```

- ローカルスコープが存在しない環境では、グローバルスコープのみで動作する
- `kami init` でカレントディレクトリにローカルスコープ（`.kami/`）を作成する

### 2.2 スコープ解決ルール

#### 名前解決の優先順位

slug（記事識別子）の解決は**ローカル優先**:

1. ローカルスコープで検索
2. 見つからなければグローバルスコープで検索
3. 両方に存在する場合はローカルを返す

明示的なスコープ指定も可能:

```bash
kami read typescript-tips                  # ローカル優先で解決
kami read --scope global typescript-tips   # グローバルを明示
kami read --scope local typescript-tips    # ローカルを明示
kami list --scope all                      # 両スコープを統合表示
```

#### Wikiリンクのスコープ解決

```markdown
[[typescript-tips]]              → ローカル優先で解決
[[global:typescript-tips]]       → グローバルを明示
[[local:typescript-tips]]        → ローカルを明示
```

#### クロススコープのリンク方向

- **ローカル → グローバル**: OK（共有知識を参照）
- **グローバル → ローカル**: 警告を出す（グローバルは特定プロジェクトに依存すべきでない）

#### デフォルトの書き込み先

| 条件 | デフォルトスコープ |
|------|-------------------|
| ローカルスコープが存在する | local |
| ローカルスコープが存在しない | global |
| `--scope` で明示指定 | 指定されたスコープ |

### 2.3 記事構造: フォルダ階層 + タグ + グラフ（ハイブリッド）

各スコープ内のvaultは同じ構造を持つ:

- **フォルダ**: 大分類としての物理的な整理単位
- **タグ**: frontmatterで定義する横断的な分類
- **wikiリンク**: 本文中の `[[記事名]]` で記事間の関係を表現
- **バックリンク**: インデックスで自動管理される逆方向リンク

### 2.4 Frontmatter スキーマ

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

### 2.5 Wikiリンク記法

```markdown
通常リンク:       [[typescript-tips]]
別名付き:         [[typescript-tips|TypeScriptのコツ]]
スコープ明示:     [[global:typescript-tips]]
スコープ+別名:    [[global:typescript-tips|TypeScriptのコツ]]
```

- リンク先は `title` → `aliases` → ファイル名（拡張子なし）の優先順位で解決する

### 2.6 インデックス

各スコープごとに独立したインデックスを管理する。

```
~/.kami/
  index.json        # グローバル記事のメタデータインデックス
  links.json        # グローバルリンクグラフ

./.kami/
  index.json        # ローカル記事のメタデータインデックス
  links.json        # ローカルリンクグラフ（クロススコープリンクを含む）
```

- 記事の作成・更新・削除時にインクリメンタルに更新する
- `kami reindex` コマンドで全体を再構築できる
- クロススコープリンク（ローカル→グローバル）はローカル側のlinks.jsonに記録する

---

## 3. CLI（`kami`コマンド）

### 3.1 基本設計

- エージェントが扱いやすいよう、入出力はプレーンテキストまたはJSON（`--json` フラグ）
- 終了コードで成功/失敗を明示
- ヘルプは `--help` で参照可能
- `--scope` フラグで対象スコープを明示できる（省略時はスコープ解決ルールに従う）

### 3.2 コマンド一覧

#### 初期化

| コマンド | 説明 |
|----------|------|
| `kami init` | カレントディレクトリにローカルスコープ（`.kami/`）を作成 |

#### CRUD

| コマンド | 説明 |
|----------|------|
| `kami create <title> [--folder <path>] [--tag <tag>...] [--template <name>] [--scope <scope>]` | 記事を作成 |
| `kami read <slug> [--scope <scope>]` | 記事をstdoutに出力（Markdown） |
| `kami edit <slug> --title <new> / --add-tag <tag> / --body <file>` | 記事のメタデータ・本文を更新 |
| `kami delete <slug> [--force]` | 記事を削除（確認プロンプトあり、`--force` で省略） |
| `kami list [--folder <path>] [--tag <tag>] [--sort <field>] [--limit <n>] [--scope <scope>]` | 記事一覧を表示 |

#### 検索

| コマンド | 説明 |
|----------|------|
| `kami search <query> [--tag <tag>] [--folder <path>] [--scope <scope>]` | 全文検索 |

検索結果にはスコープを表示する:
```
$ kami search "TypeScript" --scope all
[local]  notes/typescript-tips       - TypeScriptの便利なテクニック
[global] notes/typescript-generics   - ジェネリクスの使い方
```

#### リンク管理

| コマンド | 説明 |
|----------|------|
| `kami links <slug>` | 指定記事のforwardリンク一覧 |
| `kami backlinks <slug>` | 指定記事のバックリンク一覧 |

#### テンプレート

| コマンド | 説明 |
|----------|------|
| `kami template list` | テンプレート一覧（両スコープ統合） |
| `kami template show <name>` | テンプレートの内容を表示 |
| `kami template create <name> [--scope <scope>]` | 新しいテンプレートを作成 |

テンプレートもローカル優先で解決する。同名のテンプレートが両スコープにある場合はローカルが優先。

#### エクスポート

| コマンド | 説明 |
|----------|------|
| `kami export <slug> --format <md\|html>` | 指定記事をエクスポート |

#### ビルド・サーバー

| コマンド | 説明 |
|----------|------|
| `kami build [--slug <slug>] [--scope <scope>]` | 静的HTMLをビルド（slug指定でインクリメンタル） |
| `kami serve [--port <n>]` | Honoサーバーを起動（静的ファイル配信 + POST API） |
| `kami reindex [--scope <scope>]` | インデックスを再構築 |

### 3.3 Slugの解決

slug（記事の識別子）は以下のいずれかで指定可能:

- ファイル名（拡張子なし）: `typescript-tips`
- フォルダ付きパス: `notes/typescript-tips`
- タイトル（完全一致）: `"TypeScriptのコツ"`

曖昧な場合は候補を表示し、ユーザーに選択させる（`--json` モードではエラーと候補リストを返す）。

---

## 4. Hook

### 4.1 概要

記事操作やビルドのライフサイクルに応じてシェルコマンドを自動実行する仕組み。
リビルドのトリガーやgitの自動コミットなど、ワークフローの自動化に使用する。

### 4.2 ライフサイクルイベント

| イベント | タイミング | 用途例 |
|----------|-----------|--------|
| `article:pre-create` | 記事作成前 | バリデーション、テンプレート加工 |
| `article:post-create` | 記事作成後 | リビルド、git add |
| `article:pre-update` | 記事更新前 | バリデーション |
| `article:post-update` | 記事更新後 | リビルド、git commit |
| `article:pre-delete` | 記事削除前 | 依存チェック |
| `article:post-delete` | 記事削除後 | リビルド、リンク切れ警告、git rm |
| `build:pre` | ビルド前 | 前処理 |
| `build:post` | ビルド後 | デプロイ連携、通知 |

### 4.3 設定

`hooks.toml` で設定する。グローバル（`~/.kami/hooks.toml`）とローカル（`./.kami/hooks.toml`）の両方を読み込み、同一イベントに対しては**両方実行**する（ローカル → グローバルの順）。

```toml
[hooks."article:post-create"]
commands = [
  "kami build --slug {{slug}}",
  "git add {{file_path}}",
]

[hooks."article:post-update"]
commands = [
  "kami build --slug {{slug}}",
  "git add {{file_path}} && git commit -m 'update: {{title}}'",
]

[hooks."article:post-delete"]
commands = [
  "kami build",
  "git add -A && git commit -m 'delete: {{slug}}'",
]

[hooks."build:post"]
commands = [
  "echo 'Build completed at {{timestamp}}'",
]
```

### 4.4 テンプレート変数

Hook内のコマンドで使用できる変数:

| 変数 | 説明 | 使用可能なイベント |
|------|------|-------------------|
| `{{slug}}` | 記事のslug | article:* |
| `{{title}}` | 記事タイトル | article:* |
| `{{file_path}}` | ファイルの絶対パス | article:* |
| `{{folder}}` | フォルダパス | article:* |
| `{{tags}}` | タグ（カンマ区切り） | article:* |
| `{{scope}}` | `local` or `global` | article:* |
| `{{timestamp}}` | ISO 8601タイムスタンプ | all |
| `{{vault_path}}` | vaultルートの絶対パス | all |

### 4.5 実行ルール

| ルール | 内容 |
|--------|------|
| pre-hookの失敗 | 操作を中止。エラーメッセージを表示 |
| post-hookの失敗 | 警告のみ。本体の操作はロールバックしない |
| 実行順序 | commands配列の定義順に同期実行。1つが失敗したら後続はスキップ |
| スコープ間の順序 | ローカルHook → グローバルHookの順に実行 |
| Hook内からのkami呼び出し | Hookフラグを付与し、再帰的なHook発火を防止する |

---

## 5. WebUI

### 5.1 アーキテクチャ

```
[静的HTML] ← ReactDOMServerで事前ビルド
     ↑ 配信
[Hono Server]
     ↑ POST API（作成・更新・削除）
[ブラウザ]
     ↓ フォーム送信
[Hono Server] → ファイル保存 → Hook実行（リビルド等）
```

- **閲覧**: 事前ビルド済みの静的HTMLを配信。JSバンドル最小限
- **編集**: テキストエリア + Markdownプレビューのシンプルな編集画面
- **変更時**: Hook経由で対象ページのHTMLリビルド + インデックス更新
- **スコープ表示**: 記事一覧や検索結果ではスコープ（local / global）をラベル表示

### 5.2 ページ構成

| ページ | パス | 説明 |
|--------|------|------|
| ホーム | `/` | 最近の記事一覧、タグクラウド |
| 記事閲覧 | `/articles/<scope>/<slug>` | Markdownを静的レンダリング。バックリンク表示あり |
| 記事編集 | `/articles/<scope>/<slug>/edit` | テキストエリア + プレビュー |
| 記事作成 | `/new` | 新規記事フォーム（テンプレート・スコープ選択可） |
| 検索 | `/search?q=<query>` | 全文検索結果（スコープラベル付き） |
| タグ一覧 | `/tags` | タグ一覧とタグ別記事リスト（両スコープ統合） |

### 5.3 静的ビルド出力

```
dist/
  index.html
  articles/
    local/
      design/
        architecture-overview.html
      adr/
        001-use-bun-runtime.html
    global/
      notes/
        typescript-tips.html
      daily/
        2026-02-15.html
  tags/
    index.html
  search/
    index.html
  assets/
    style.css
    edit.js          # 編集ページ用の最小限のJS
```

---

## 6. プロジェクト構成

```
kami/
  src/
    cli/                  # CLIコマンド定義
      commands/
        init.ts
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
      scope.ts            # スコープ解決ロジック
      hook.ts             # Hook管理・実行
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
    storage/              # ストレージ
      adapter.ts          # インターフェース定義
      local.ts            # ローカルFS実装
    types/                # 型定義
      article.ts
      index.ts
      config.ts
      hook.ts
      scope.ts
  templates/              # 組み込みテンプレート（初回セットアップ時にコピー）
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

グローバル設定（`~/.kami/config.toml`）をベースに、ローカル設定（`./.kami/config.toml`）で上書きする。

### 7.1 グローバル設定（`~/.kami/config.toml`）

```toml
[server]
port = 3000

[build]
outDir = "~/.kami/dist"
```

### 7.2 ローカル設定（`./.kami/config.toml`）

```toml
[build]
outDir = "./.kami/dist"            # ローカルスコープのビルド出力先
```

### 7.3 設定のマージルール

- ローカル設定に存在するキーはローカルの値を使用
- ローカル設定に存在しないキーはグローバルの値にフォールバック
- vault, templates, index, linksのパスは各スコープのディレクトリ内に固定（設定で変更不可）

---

## 8. 実装フェーズ（案）

### Phase 1: 基盤
- プロジェクトセットアップ（Bun, TypeScript, Hono, React）
- 型定義
- スコープ解決ロジック（global / local の発見と切り替え）
- ストレージアダプタ（ローカルFS）
- frontmatterパーサー
- 基本CRUD（CLI: init, create, read, edit, delete, list）

### Phase 2: グラフ・検索
- wikiリンクパーサー（remarkプラグイン、スコープ付きリンク対応）
- リンクインデックス・バックリンク管理
- 全文検索
- CLI: search, links, backlinks

### Phase 3: テンプレート・エクスポート・Hook
- テンプレート機能（スコープ付き解決）
- Markdown / HTMLエクスポート
- Hook機能（hooks.toml、ライフサイクル実行）
- CLI: template, export

### Phase 4: WebUI
- 静的HTMLレンダリング（React SSR）
- kami build / kami serve
- 閲覧ページ、ホーム、タグ一覧（スコープラベル付き）
- 編集画面（テキストエリア + プレビュー）
- インクリメンタルビルド

### Phase 5: 拡張
- PDF エクスポート
- 認証機能

---

## 9. 未決事項

- [ ] CLIフレームワークの選定（commander / citty / 自前実装）
- [ ] 全文検索の実装方式（単純な文字列マッチ / MiniSearch / lunr）
- [ ] 設定ファイルフォーマットの確定（TOML / JSON / YAML）

---

*このドキュメントは要件の合意形成のためのものであり、実装の進行に伴い更新される。*
