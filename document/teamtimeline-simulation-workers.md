# TeamTimeline 複数試行の Web Worker 実行

詳細シミュ・簡易シミュの複数試行（100 / 1,000 / 10,000 回）と追加分析の試行は、
メインスレッドではなく Web Worker のプールで並列に実行する。個体値計算機の
チーム機能（`src/util/Team/teamSimulation.worker.ts`）と同じ構成で、
1 試行の計算（`runSimulation`）自体は変えていない。

## 構成（`src/extensions/apps/TeamTimeline/simulation/`）

| ファイル | 役割 |
|---|---|
| `TrialBatchRunner.ts` | メインスレッド側。`runTrialBatchParallel`（シード列を Worker に分配して合計値をマージ）と `runMultiTrialSimulationParallel`（`MultiTrialResult` を返す高水準 API） |
| `TrialBatchProtocol.ts` | Worker とやり取りするメッセージ型と、入力の直列化（`PokemonBoxItem` → `serialize()` 文字列、`StrengthParameter` → `serializeStrengthParameter`、表示名 → id ごとの文字列） |
| `TrialBatchWorkerHandler.ts` | Worker 側のリクエスト処理（`self` に依存しないのでテストでは偽の Worker から直接呼ぶ） |
| `timelineSimulation.worker.ts` | Worker のエントリ。`tsconfig.worker.json` で型検査し、`tsconfig.json` からは除外する |
| `createTimelineSimulationWorker.mts` | `new Worker(new URL(..., import.meta.url), { type: "module" })` を包む ESM ファイル |
| `MultiTrialSimulator.ts` | 試行の積算（`AggregationState`）。`accumulateTrialResult` / `mergeAggregationStates` / `finalizeMultiTrialResult` / `summarizeAggregationForAnalysis` を公開し、Worker とメインスレッドで同じ積算を使う |

## 動作

- Worker 数は `navigator.hardwareConcurrency`（上限 8、最小 1）。プールはセッション中使い回し、
  60 秒使われなければ解放する。
- シードは `initialSeed`（またはランダムな基準値）からの連番で、連続した範囲を Worker ごとに
  割り当てる。試行ごとの結果は直列実行と同一で、合計値は足す順序が違うだけなので、
  丸めた平均値は一致する（浮動小数の最下位桁だけ変わりうる）。
- 進捗は各 Worker が約 50ms ごとに送り、メインスレッドでは 100ms ごとに間引いて
  `onProgress` に渡す。
- 中断（実行ボタンの再押下）は `stop` メッセージで伝え、各 Worker は現在の試行を終えてから
  完了分だけを返す。直列実行と同じく「完了した試行までの結果」を表示する。
  2 秒以内に応答しない Worker は破棄してプールを作り直す。
- Worker の起動や読み込みに失敗した環境では、そのセッションはメインスレッドで実行する
  （`runTrialBatchAsync`。挙動は従来の `runMultiTrialSimulationWithProgress` と同じ）。
  Vitest（jsdom）には `Worker` がないため常にこちらを通る。
- 追加分析（貢献 EP など）は同じ `runTrialBatchParallel` で走らせ、`AggregationState` の
  合計から `summarizeAggregationForAnalysis` で平均を求める（以前の逐次計算と同じ値）。

## Worker に渡せない依存の扱い

- `StrengthParameter` は `buildStrengthParameterFromTimelineBonusSettings` が localStorage
  （個体値計算機の設定）を読むため、メインスレッドで構築して `SimulationInput.strengthParameter`
  として渡す。
- スキル対象名などの表示名は i18next が必要なため、`SimulationInput.resolvePokemonName`
  で呼び出し側が解決する（App / QuickSimTab は `pokemon.filledNickname(t)`）。
  シミュレータは i18next を参照しない。Worker へは id ごとの文字列にして渡す。

## 計測（22 スレッド機・Vite dev・初期プリセットのチーム・7 日・料理あり）

| 条件 | 従来（メインスレッド） | Worker 8 並列 |
|---|---|---|
| 1,000 試行 | 約 3.0 秒（UI はブロック） | 約 1.0 秒（UI は応答可能） |
| 10,000 試行 | 約 33.6 秒 | 約 4.6 秒 |

Worker の初回起動（モジュール読み込み）は dev で 1 秒前後、本番ビルド（`timelineSimulation.worker-*.js`
約 260KB）ではそれより短い。
