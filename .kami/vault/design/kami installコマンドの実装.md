---
title: kami installコマンドの実装
tags:
  - architecture
created: '2026-02-16T09:51:45.309Z'
updated: '2026-02-16T09:51:45.309Z'
template: note
---

## 概要

`kami install` コマンドを追加し、AIコーディングツール (Claude Code, Codex CLI, Gemini CLI) にkami skillをインストールする機能を実装した。

## 設計判断

### ターゲットツールごとのインストール方式

| ツール | プロジェクトレベル | ユーザーレベル |
|--------|-------------------|---------------|
| Claude Code | `.claude/skills/kami/` (ディレクトリ構造) | `~/.claude/skills/kami/` |
| Codex CLI | `AGENTS.md` (単一マークダウン) | `~/.codex/instructions.md` |
| Gemini CLI | `GEMINI.md` (単一マークダウン) | `~/.gemini/GEMINI.md` |

### Claude Code vs Codex/Gemini の違い

- **Claude Code**: スキルディレクトリ構造 (SKILL.md + reference/) をそのままコピー
- **Codex/Gemini**: SKILL.md + reference/* を1つのマークダウンに統合。`<!-- kami:start -->` / `<!-- kami:end -->` マーカーでセクション管理

### マーカーによるセクション管理

Codex/Gemini向けのファイル（AGENTS.md、GEMINI.md）には既存コンテンツがある可能性がある。マーカーで管理することで:
- マーカーなしの既存ファイル → 末尾に追記
- マーカーありの既存ファイル → `--force` なしではエラー、`--force` ありでセクション置換
- ファイルなし → 新規作成

### 対話式インターフェイス

- `--target` / `--level` フラグがない場合、対話式プロンプトを表示
- JSONモードでは両フラグ必須（delete コマンドの `--force` パターンに準拠）
- `LineReader` クラスで行バッファリングを実装（Bun stdin の一括読み込み対策）

## 実装のポイント

### LineReader クラス

Bun の stdin は `Blob` として入力を受け取ると全データが1チャンクで到着する。`ReadableStreamDefaultReader.read()` を単純に2回呼ぶと2回目で空になるため、内部バッファで改行分割する `LineReader` クラスを実装。

### スキルソースの解決

`import.meta.dir` からパッケージルートへの相対パスで `.claude/skills/kami/` を解決。`bun link` 環境ではシンボリックリンク経由でソースを参照。

### ファイル構成

- `src/core/installer.ts`: コアロジック（パス解決、ファイルコピー/生成、マーカー処理）
- `src/cli/commands/install.ts`: CLIコマンド定義（対話式プロンプト、バリデーション）
- `tests/cli/install.test.ts`: テスト（18テストケース）

## 関連

- [[kami-cli-command-pattern]]: 既存コマンドパターンに準拠

