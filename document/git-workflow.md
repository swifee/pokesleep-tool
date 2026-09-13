# Git 運用ルール

このリポジトリでは、コミット・push・PR・マージを AI エージェント(Claude Code)が行い、
ユーザーは Git / GitHub を直接操作しない前提で運用する。
エージェント向けの機械可読なルールは `.claude/rules/git-workflow.md`(ローカル専用)にあり、
本書はその人間向けの写し。手順を変更したら両方を更新する。

## ブランチ

| ブランチ  | 役割                                       | 更新方法                     |
|-----------|--------------------------------------------|------------------------------|
| `develop` | 作業用。作業途中のコードが入ってよい       | エージェントが直接コミット   |
| `main`    | 動作確認済みの状態のみ。VPS デプロイ元     | `develop` からの PR + CI 緑  |

- `main` はブランチ保護(PR 必須・直接 push 不可)を維持する。
- 大きな並行作業のみ `feature/*` を使い、完了したら `develop` にマージして削除する。
- upstream の取り込みは `upstream-sync` スキル(`sync/*` → `develop` への PR)。CI が緑ならマージし、`sync/*` は削除する。

## コミット(自動)

- 1つの作業単位(機能追加・修正・リファクタ)が完了し、`npm run typecheck` と関連テストが通った時点でコミットする。
- 動かない中間状態ではコミットしない。
- メッセージは `<Area>: <命令形の要約>` 形式(例: `TeamTimeline: Add skill pity proc and Sunday cooking rule`)。
- `scripts/deploy-vps.env` や `.env*` などの秘密情報はステージしない。

## push(自動)

- コミット後すぐに `origin/develop` へ push する(バックアップ + CI 実行のため)。

## main へのマージ(自動)

条件: 機能または修正が `develop` 上で完成し、`develop` の CI が緑。

1. `develop` → `main` の PR を作成する。
2. PR の CI(`npm run verify`)を待つ。
3. マージコミット方式でマージする(squash / rebase は使わない。`develop` と `main` の履歴を一致させるため)。
4. CI が赤ならマージしない。`develop` で修正して push し、再試行する。

## デプロイ(手動のみ)

- `npm run deploy` は `main` を VPS に公開する。ユーザーが明示的に依頼したときだけ実行する。
- マージ後の自動デプロイは行わない。

## 禁止事項

- `git push --force`、`develop` / `main` の履歴書き換え、`main` への直接 push。
- マージコンフリクトの無断解決。内容を説明し、どちらを採用するか確認する。
- worktree に未コミットの作業があるブランチの削除。

## ユーザーからの復旧依頼の例

- 「直前のコミットを取り消して」→ `develop` で `git revert HEAD` して push。
- 「main を1つ前に戻して」→ `main` に対する revert PR を作成(force push はしない)。
- 「今の状態を教えて」→ `git status`、`develop` の直近コミット、`main` との差分を報告。
