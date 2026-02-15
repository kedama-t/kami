# CLAUDE.md

## セットアップ

```sh
bun install
bun link
bun link kami
```

これにより `kami` コマンドがグローバルで利用可能になる。

## プロジェクト概要

**kami** (Knowledge Agent Markdown Interface) は、ローカルファーストのパーソナルナレッジベースCLI。
Markdown + YAML frontmatter 形式の記事をファイルシステム上で管理する。

- ランタイム: Bun
- CLIフレームワーク: citty
- 全文検索: MiniSearch + BudouX（日本語トークナイズ）
- Markdownパーサー: unified / remark / rehype

## ディレクトリ構成

```
src/
  cli/           # CLIコマンド定義（エントリポイント: index.ts）
    commands/    # 12個のサブコマンド（create, read, edit, delete, list, search, ...）
    helpers/     # 出力フォーマット、入力処理、フック実行ラッパー
  core/          # ビジネスロジック（article, frontmatter, scope, linker, search, ...）
  storage/       # ストレージ抽象化（adapter.ts）とローカル実装（local.ts）
  types/         # 型定義（article, index, config, scope, hook, result）
templates/       # ビルトインテンプレート（note.md, daily.md）
tests/           # テスト（core/, cli/, e2e/, storage/）
docs/            # 仕様書（REQUIREMENTS.md, specs/CLI.md）
```

## 開発コマンド

```sh
bun test          # 全テスト実行
bun run typecheck # 型チェック（tsc --noEmit）
```

変更後は必ず `bun test` と `bun run typecheck` の両方を実行して確認すること。

## マルチスコープ

| スコープ | パス | 用途 |
|----------|------|------|
| global | `~/.kami/` | ユーザー全体で共有するナレッジ |
| local | `./.kami/` | プロジェクト固有のナレッジ |

- 読み取り: ローカル優先、グローバルにフォールバック
- 書き込み: ローカルスコープがあればローカル、なければグローバル
- `--scope` フラグで明示指定可能（local / global / all）

## パスエイリアス

`@/*` → `src/*`（tsconfig.json で定義）

## 開発時のナレッジ記録

開発中に得た知見、設計判断、トラブルシューティングの記録には `kami` コマンドを使うこと。
ナレッジはローカルスコープ（`.kami/vault/`）に保存される。

```sh
# ローカルスコープの初期化（未作成の場合）
kami init

# 設計判断の記録
kami create "タイトル" --folder design --tag architecture --json --body - <<< "本文"

# バグ修正の知見を記録
kami create "タイトル" --folder troubleshooting --tag bug-fix --json --body - <<< "本文"

# 既存ナレッジの検索
kami search "キーワード" --json

# 関連記事への参照は Wiki リンク [[slug]] を使う
```

記録すべき内容の例:

- 設計上の判断とその理由（ADR）
- 非自明な実装の背景や意図
- 遭遇したバグと解決方法
- 依存ライブラリの使い方に関するハマりどころ
- パフォーマンス改善の知見
