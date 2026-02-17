# 📃kami

**Knowledge Agent Markdown Interface** — AI フレンドリーなパーソナルナレッジベース

[English](README.md)

kami は、Markdown + YAML frontmatter 形式の記事をファイルシステム上で管理するローカルファーストのパーソナルナレッジベース CLI です。AI コーディングエージェント（CLI/JSON 経由）と人間（Web UI 経由）の両方が自然に使えるように設計されています。

## 特徴

- **Markdown + YAML frontmatter** — 標準的なフォーマット、どんなエディタでも利用可能
- **マルチスコープ** — グローバル（`~/.kami/`）とローカル（`./.kami/`）の2つのスコープ
- **全文検索** — MiniSearch + BudouX による日本語トークナイズ対応
- **Wiki リンク** — `[[slug]]` 記法による記事間の相互参照とバックリンク追跡
- **Web UI** — ブラウザで記事の閲覧・検索・作成・編集（React SSR + Hono）
- **静的サイト生成** — ナレッジベースから静的 HTML サイトをビルド
- **フックシステム** — 記事のライフサイクルイベントでカスタムスクリプトを実行（create/update/delete/build の前後）
- **テンプレート** — 変数展開に対応したカスタマイズ可能な記事テンプレート
- **AI ツール連携** — `kami install` で Claude Code、Codex、Gemini にスキルを導入
- **JSON 出力** — 全コマンドで `--json` フラグによる機械可読な出力

## 動作要件

- [Bun](https://bun.sh) >= 1.0.0

## インストール

```sh
bun install -g @kami-pkm/kami
```

## クイックスタート

```sh
# 現在のプロジェクトにナレッジベースを初期化
kami init

# 記事を作成
kami create "はじめての記事" --folder notes --tag getting-started

# 記事一覧を表示
kami list

# 検索
kami search "キーワード"

# 記事を読む
kami read my-first-article

# Web UI を起動
kami serve
```

## スコープ

kami はマルチスコープアーキテクチャにより、プロジェクト固有のナレッジと共有ナレッジを分離します:

| スコープ | パス       | 用途                                    |
| -------- | ---------- | --------------------------------------- |
| global   | `~/.kami/` | 全プロジェクト共通のナレッジ            |
| local    | `./.kami/` | プロジェクト固有のナレッジ（ADR など）  |

- **読み取り**: ローカルスコープ優先、グローバルにフォールバック
- **書き込み**: ローカルスコープがあればローカル、なければグローバル
- **`--scope`** フラグ: `local`、`global`、`all` を明示的に指定可能

## CLI コマンド

| コマンド    | 説明                                           |
| ----------- | ---------------------------------------------- |
| `init`      | 新しいスコープを初期化                         |
| `create`    | 記事を作成                                     |
| `read`      | 記事の内容を表示                               |
| `edit`      | 記事を編集                                     |
| `delete`    | 記事を削除                                     |
| `list`      | 記事の一覧をフィルタ・ソート付きで表示         |
| `search`    | 全文検索                                       |
| `links`     | 記事のフォワードリンクを表示                   |
| `backlinks` | 記事のバックリンクを表示                       |
| `template`  | テンプレートの管理（一覧・表示・作成）         |
| `export`    | 記事を Markdown または HTML でエクスポート     |
| `reindex`   | 検索インデックスとリンクグラフを再構築         |
| `build`     | 静的 HTML サイトをビルド                       |
| `serve`     | Web サーバーを起動                             |
| `install`   | AI コーディングツール向けスキルをインストール  |

各コマンドの詳細は `kami <command> --help` を参照してください。

## JSON モード

全コマンドが `--json` フラグに対応しており、AI コーディングエージェントとの連携に最適です:

```sh
kami list --json
kami search "query" --json
kami read my-article --json
```

## Wiki リンク

記事の本文で `[[slug]]` 記法を使うことで、記事間の相互参照を作成できます。kami はフォワードリンクとバックリンクを自動的に追跡します:

```sh
kami links my-article       # 発リンクを表示
kami backlinks my-article   # 被リンクを表示
```

## テンプレート

kami にはビルトインテンプレート（`note`、`daily`）が付属しており、カスタムテンプレートも作成できます:

```sh
kami template list             # テンプレート一覧
kami template show note        # テンプレート内容を表示
kami create "タイトル" -T daily   # テンプレートから記事を作成
```

テンプレートは変数展開に対応: `{{title}}`、`{{date}}`、`{{datetime}}`

## フック

記事のライフサイクルイベントでカスタムスクリプトを実行できます。スコープディレクトリ内の `hooks.json` で設定します:

**対応イベント**: `article:pre-create`、`article:post-create`、`article:pre-update`、`article:post-update`、`article:pre-delete`、`article:post-delete`、`build:pre`、`build:post`

pre イベントのフックは操作をブロック可能、post イベントのフックは通知として実行されます。

## Web UI

Web サーバーを起動して、ブラウザで記事の閲覧・検索・編集ができます:

```sh
kami serve              # デフォルトポート 3000 で起動
kami serve --port 8080  # ポートを指定
```

## 静的サイト生成

ナレッジベースから静的 HTML サイトをビルドできます:

```sh
kami build              # フルビルド
kami build --clean      # クリーンビルド
```

## AI ツール連携

AI コーディングツールに kami スキルをインストールできます:

```sh
kami install                                       # 対話形式
kami install --target claude-code --level project   # 非対話形式
```

対応ツール: `claude-code`、`codex`、`gemini`

## 開発

```sh
bun install
bun test           # テスト実行
bun run typecheck  # 型チェック
```

## ライセンス

[MIT](LICENSE)
