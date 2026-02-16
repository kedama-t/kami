---
title: kami installコマンドの実装
tags:
  - architecture
  - agent-skills
created: '2026-02-16T09:51:45.309Z'
updated: '2026-02-16T10:26:06.632Z'
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


## リファクタリング: Agent Skills統一アプローチ

### 背景
当初、Codex CLI と Gemini CLI は `AGENTS.md` / `GEMINI.md` というフラットなマークダウンファイルにスキル内容を書き出す方式で実装していた。しかし、調査の結果、Claude Code / Codex CLI / Gemini CLI の3ツールすべてが **Agent Skills 標準** (`SKILL.md` ベースのディレクトリ構造) に対応していることが判明。

### Agent Skills の配置パス

全ツール共通のパターン: `.<tool>/skills/<name>/SKILL.md`

| ツール | プロジェクトレベル | ユーザーレベル |
|--------|-------------------|---------------|
| Claude Code | `.claude/skills/kami/` | `~/.claude/skills/kami/` |
| Codex CLI | `.codex/skills/kami/` | `~/.codex/skills/kami/` |
| Gemini CLI | `.gemini/skills/kami/` | `~/.gemini/skills/kami/` |

### SKILL.md フロントマターの互換性

3ツール共通で `name` と `description` のみが必須。kamiの既存 SKILL.md はこの形式に準拠していたため、変換なしでそのままコピー可能。

### リファクタリングの成果

- `installFlatMarkdown()` / `buildConsolidatedContent()` / マーカー処理ロジックをすべて削除
- `TARGET_DIR` マッピング (`claude-code` → `.claude`, `codex` → `.codex`, `gemini` → `.gemini`) で統一
- コード量が約100行削減（218行 → 117行）
- テストも大幅に簡素化（`verifySkillDir()` ヘルパーで共通検証）

### 参考リンク

- Agent Skills 仕様: https://agentskills.io/specification
- Codex Skills: https://developers.openai.com/codex/skills/
- Gemini CLI Skills: https://geminicli.com/docs/cli/skills/

