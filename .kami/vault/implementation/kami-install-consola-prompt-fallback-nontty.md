---
title: kami install promptをconsolaに置換
tags:
  - install
created: '2026-02-19T15:33:23.102Z'
updated: '2026-02-19T15:33:23.102Z'
template: note
---

## What was done

- `src/cli/commands/install.ts` の対話入力を `LineReader` 直読み中心の実装から `consola.prompt()` ベースへ変更。
- `promptForSelection()` ヘルパーを追加し、target/level の番号選択ロジックを共通化。
- 非TTY環境（パイプ入力・テスト実行）では `consola.prompt()` が期待どおり複数段プロンプトを処理しづらいため、非TTY時のみ `LineReader` で行読み込みするフォールバックを追加。
- `consola` を依存関係に追加。

## Why it was done

- 要件として `kami install` の対話プロンプト処理を `consola` ベースへ置き換える必要があった。
- 既存テストは stdin パイプで対話をシミュレートしており、TTY前提実装に完全移行すると回帰が発生するため。

## Key insights / trade-offs

- `consola.prompt()` はTTYではUXが良いが、非TTY（Blob/piped stdin）では挙動差が出る。
- 対話体験（TTY）と自動テスト安定性（非TTY）を両立するには、`process.stdin.isTTY` で分岐するハイブリッド実装が実務的。
- 既存の「数字選択UI」を維持すると、ユーザー操作とテストケースの差分を最小化できる。

## Reusable patterns

- CLI対話入力は以下の分岐を標準パターン化できる:
  - TTY: `consola.prompt()`
  - non-TTY: 行バッファリーダーで deterministic に入力取得
- インデックス選択ロジックは、
  - parse
  - 範囲検証
  - `undefined` ガード
  を1ヘルパーに閉じると型安全と再利用性が上がる。

