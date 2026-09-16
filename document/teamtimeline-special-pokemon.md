# TeamTimeline とくべつなポケモンの編成ルール

ゲームの仕様「とくべつなポケモンはチームに同時に 1 体しか入れられない。ただし
ラティアスとラティオスの組み合わせに限っては可」を、TeamTimeline の詳細シミュ・
簡易シミュ・起用率の最適化で扱うための実装メモ（2026-09-17）。

## 判定

- 元データ（`src/data/pokemon.json`）に「とくべつなポケモン」のフラグはない。上流の
  `getPokemonRarity`（`src/data/pokemons.ts`。レベル 25 到達 EXP が 1080 → `legendary`、
  1320 → `mythical`）で `normal` 以外を「とくべつなポケモン」とみなす。
  2026-09-17 時点の該当: ライコウ・エンテイ・スイクン・クレセリア・ラティアス・ラティオス・
  ミュウツー（伝説）、ダークライ・ミュウ（幻）。
- 判定は `utils/SpecialPokemonUtils.ts` にまとめる（上流の `src/data` / `src/util` は触らない）。
  - `isSpecialPokemon(pokemon)`
  - `canSpecialPokemonCoexist(a, b)`: どちらかが通常ポケモンなら可。両方とくべつなら
    ラティアス＋ラティオスの組み合わせだけ可（同じ種類 2 体、例えばラティアス 2 体は不可）。
  - `findSpecialPokemonConflictIds(members)`: 同時に編成しているメンバーのうち、ルールに反する
    組み合わせに含まれるポケモン ID。
  - `buildSpecialPokemonExclusionMap(items)`: 簡易シミュのスケジューラ向け
    （ポケモン ID → 同時に編成できないポケモン ID の集合）。
  - `buildSpecialPokemonExclusiveGroups(items)`: 起用率の最適化向け（同時に編成できない
    メンバー index の組。組の起用率の合計は 100% まで）。
  - `collectTimelineSpecialPokemonConflicts(team, timeSlots, days, swaps, box)`: 詳細シミュの
    タイムラインで、行ごとに同時に編成されているメンバーを追って重複を集める。

## 詳細シミュ（チーム編成 + 入れ替え）

編成や入れ替えの操作は制限しない（ユーザーが意図的に組める）。代わりに、重複している
箇所を目立たせて知らせる。

- 各行（時間帯）の編成は「その行より前の入れ替えを適用した後のチーム」。入れ替えは
  その時間帯の計算後に適用される仕様（`collectTimelineDurationSummaryByPokemon` と同じ）
  なので、入れ替えで 2 体目のとくべつなポケモンを入れた行の次の行から重複になる。
  先頭行（就寝の起点、経過時間 0）は初期チームで判定する。
- `TimelineTable` が `collectTimelineSpecialPokemonConflicts` で「展開後のスロット ID →
  重複しているチーム枠 index」を求め、`TimelineRow` → `TimelineCell` の `specialConflict`
  でそのセルの背景を赤系（`#fde8e8`）にする（`data-special-conflict="true"`）。
  ドラッグ先の色（`#fff4de`）が優先され、就寝中の色（`#f5f6fb`）より優先される。
  実行前のプレビュー表と実行後の詳細表の両方、簡易シミュの表示（読み取り専用）でも同じ。
- 詳細シミュタブの上部（入れ替え・回収しないの補足バーの下）に
  `components/SpecialPokemonConflictBar.tsx` を出す。ルールの説明と、重複に関わる
  ポケモン（登場順、アイコン + 名前）を並べる。重複がなければ何も出さない。
- シミュレーション自体は従来どおり実行できる（結果は「重複を許した場合」の値）。

## 簡易シミュ（自動入れ替えスケジュール）

`buildQuickSimSchedule(members, timeSlots, days, exclusions)` の第 4 引数
（`QuickSimExclusionMap`）に、同時に編成できないメンバーの組を渡す。
`QuickSimTab` はメンバーとボックスから `buildSpecialPokemonExclusionMap` で作る。

- 格子（`DayGrid`）の「置けない時刻」の判定 `isBlocked(pokemonId, minute)` を、
  「自分が別の枠にいる」に加えて「同時に編成できないメンバーがどこかの枠にいる」でも
  真にする。固定配置（`occupyMinute`）、巻き付け法（`fillLaneMajor`）、自然な配置の
  空き区間（`availableIntervals`）と夜担当の起床後の続き（`availableRunFrom`）が
  すべてこの判定を使うので、どの手順でも同時には置かれない。
- Phase 1 の夜担当の選定では、就寝中に同時に編成できないメンバー（固定配置、または
  先に選んだ夜担当）がいるメンバーを夜担当にしない。必ず夜担当になるメンバー同士が
  衝突するときは Phase 2 へ進む。
- 避けきれずに置けなかった分は `unmetPokemonIds` に入れ、UI の警告
  「起用方法やとくべつなポケモンの制限により、次のメンバーは起用率を満たせません」に
  含める。とくべつなポケモン同士の起用率の合計が 100% を超えるときは必ずこうなる
  （後に置かれる方が削られる）。
- メンバーに同時に編成できない組があるときは、スケジュールの節に
  「とくべつなポケモン（伝説・幻）は同時に 1 体まで…として入れ替えを組みます」と注記する。
- `validateQuickSimSchedule` / `validateQuickSimMultiDaySchedule` は第 3 引数に同じ組を
  受け取り、「同時に編成できないメンバーが同じ時刻に入っていない」ことも検証する。

## 起用率の最適化

- `runQuickSimOptimization` の入力 `exclusiveGroups`（`buildSpecialPokemonExclusiveGroups`）で
  「組の起用率の合計は 100% まで」の制約を候補の生成に入れる。絞り込みの DFS
  （`selectTopCandidatesBySurrogate`）では組の合計を枝を進めながら更新し、超える枝は
  辿らない。局所探索の近傍（`generateNeighborUnits`）も同じ制約で除く。
  制約に反する候補はシミュレーションされない。
- 組の作り方: とくべつなポケモンはラティアス・ラティオス以外は互いに同時に編成できない
  ので、「ラティアス・ラティオス以外のとくべつなポケモン ∪ ラティアス全員」と
  「同 ∪ ラティオス全員」が同時に編成できない組（極大クリーク）になる。組が 1 匹以下なら
  （1 匹の上限 100% と同じなので）含めない。
- 評価器（`QuickSimEvaluator`）のスケジューラにも同じ組を渡すので、結果を「適用」した
  簡易シミュのスケジュールもルールを守る。「現在」の起用率は制約に関係なく評価する
  （ルールに反する設定なら、後に置かれるポケモンが削られた状態で評価され、`!` で
  起用率を満たせない旨が出る）。
- パネルには、同時に編成できない組があるときだけ注記を出す。

## テスト

- `utils/SpecialPokemonUtils.test.ts`: 判定、組の作成、タイムラインの重複検出
  （初期チーム、入れ替えで入る/抜ける、日をまたぐ、ラティアス＋ラティオス）。
- `utils/QuickSimScheduler.test.ts`「buildQuickSimSchedule with exclusions」: 均等・睡眠の
  組が時間をずらして置かれる、夜担当に同時に置かない、合計 100% 超は unmet、
  ラティアス＋ラティオス + 第三のとくべつ、検証関数、ランダムな起用率・起用方法の混合。
- `utils/QuickSimOptimizerCandidates.test.ts` / `QuickSimOptimizerSearch.test.ts`: 制約付きの
  絞り込み・近傍・探索結果。
- `simulation/QuickSimEvaluator.test.ts`: ミュウツー + ダークライのメンバーで、候補の
  タイムラインに重複がないこと。
- `components/SpecialPokemonConflictBar.test.tsx`、`TimelineCell` / `TimelineRow` /
  `TimelineTable` / `TeamTimelineApp` のテスト: セルの色とバーの表示。
