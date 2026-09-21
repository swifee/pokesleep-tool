# TeamTimeline きのみゾーン（サイコブレイク）と とてもおおきなマゴのみ

ミュウツー関連の 2 要素をシミュレーションでどう扱うかをまとめる。
どちらも数値は公式発表値または上流（`nitoyon/pokesleep-tool`）のデータを使い、ユーザー設定は持たない。

2026-09-21 までは「仮設定（未確定パラメータ）」パネルでユーザーが任意の値を与えていたが、
公式値が確定したためパネルごと削除した（旧 `document/teamtimeline-provisional-settings.md`）。
旧パネルが保存していた `localStorage["PstTeamTimelineProvisionalSettings"]` は起動時に削除する。

## 1. サイコブレイク（きのみゾーン）

ミュウツーのメインスキル `Berry Zone (Psystrike)`。

- カビゴンのエナジーを増やすとともに、フィールドに「きのみゾーン」を展開する
- 展開中はマゴのみ（エスパータイプ）から得られるエナジーが増加率(%)ぶん UP する
- 発動のたびに増加率が上がり、上限 **+24%** に達するまで重ねがけされる
- 一度展開したゾーンはフィールドを移動するまで持続し、ミュウツーをチームから外しても消えない

### 数値

| 項目 | 値 | 取得元 |
|---|---|---|
| 発動1回あたりのカビゴンエナジー（Lv1〜6） | 1408 / 2002 / 2762 / 3813 / 5264 / 7274 | `getSkillValue("Berry Zone (Psystrike)")` |
| 発動1回あたりの増加率(%)（Lv1〜6） | 0.6 / 0.8 / 1.0 / 1.2 / 1.6 / 2.0 | `getSkillSubValue("Berry Zone (Psystrike)")` |
| 増加率の上限(%) | 24 | `BerryZoneUtils.BERRY_ZONE_MAX_RATE_PERCENT`（公式発表値。上流には未実装） |

きのみエナジー倍率 = `1 + 増加率 / 100`（マゴのみのみ。他タイプは 1）。
Lv6 なら 12 回の発動で上限に達する。

### 実装

- 判定・倍率計算は `utils/BerryZoneUtils.ts` に集約。
- `classifySkill` は `Berry Zone` 系を `directEP` として分類し、
  `SkillEffectProcessor` が発動回数 × `getSkillValue` を `directEP` に、
  発動回数 × `getSkillSubValue` を `berryZoneRateGainPercent` に入れる。
  （直接 EP は他の `Charge Strength` 系と同じくエリアボーナスを掛けない。）
- 増加率はフィールド単位の状態として `runSimulation` が `berryZoneRatePercent` に保持する。
  チーム全体で共有し、入れ替えでミュウツーが抜けても保持される。**開始時点は 0**（フィールド移動でリセットされる前提）。
- 発動による増加は**次の時間帯から**反映する（その時間帯のおてつだいは発動前に行われているため）。
  上限は `addBerryZoneRate` で加算のたびに適用する。
- 各 `TimeSlotResult` は、その時間帯の開始時点の増加率（`berryZoneRatePercent`）と、
  そのポケモンのきのみに掛かる倍率（`berryZoneMultiplier`、マゴのみ以外は 1）を持つ。
- きのみ EP は時間帯ごとの倍率で計算する（`calculateDailySummary` が時間帯単位で `calculateBerryEP` を呼ぶ）。
- スキル由来のきのみ EP（Berry Burst / Lunar Blessing / Extra Helpful S / Helper Boost）にも
  同じ倍率が掛かる（`SkillEffectProcessor.resolveBerryStrengthBonus`）。
- 上流の個体値計算機は増加率を統計値として積算するだけで、きのみエナジーへの反映は行っていない
  （`mewtwo warning`）。TeamTimeline のほうが先行している点に注意。

## 2. とてもおおきなマゴのみ（イベント）

「ミュウツーをおいかけて」（2026-09-14 / 09-21 の週）のイベント要素。上流の「おおきなきのみ」（big berry）に対応する。

- 選択中のイベントが `bigBerry` を持つとき（`event.json` の `pursue mewtwo 1st/2nd week` は `"mewtwo1"`）だけ有効
- 通常のおてつだいで、きのみ／食材に**追加で**拾ってくる
- 所持数に空きがあるときだけ拾い、空きを超える分は持ち帰らない（上流 `Help.ts` と同じ）
- 「いつのまに育成」でカビゴンに渡せないため、所持数が満タンのときは拾えず、溢れ回収の対象にもしない

### 数値（`src/data/BigBerry.ts`、`"mewtwo1"`）

| 区分 | おてつだい1回あたりの取得確率 | 1回に拾う個数 |
|---|---|---|
| ミュウ / ミュウツー | 12% | 2 |
| エスパータイプ | 6% | 1 |
| その他 | 3% | 1 |

1個あたりのエナジー = `getBerryStrength("psychic", level, fieldBonus, berryStrengthBonus, isBig = true)`
（マゴのみの強度 ×10 にエリアボーナスと好みのきのみ補正を掛けたもの）。
上流の `mewtwo warning` のとおり 1 週目の量であり、「秘境の奥へ進むほど多く見つかる」効果は再現していない。

### 実装

- 確率と個数は `PokemonStrength.bonusEffects` の `bigBerryRate` / `bigBerryCount` を
  `HelpBonusContext.hugeMagoBerryPickupRate` / `hugeMagoBerryPickupCount` に渡す（`buildPokemonBonusContext`）。
- 取得判定は `calculateHelp` のおてつだいループ内、所持数に空きがある分岐でのみ行う。
- エナジーは**拾ったポケモン自身のきのみではなくマゴのみ（エスパー）**として計算する
  （`calculateHugeMagoBerryEP`）。好みのきのみ補正もエスパーで判定するため、
  `PokemonBonusContext.hugeMagoBerry` に `calcBerryStrengthBonus("psychic", ...)` を持たせている。
- きのみゾーンの倍率も掛かる（マゴのみのため）。
- 回収は通常のきのみと同じく `PokemonState.carriedHugeMagoBerryCount` で持ち越し、
  回収する時間帯でまとめて計上する。「回収しない」セルでは溢れても回収されない。
- 計上先は `TimeSlotResult.hugeMagoBerryCount` / `hugeMagoBerryEP`。
  EP は `DailySummary.berryEP` に含めるため、合計 EP やチーム合計は自動的に反映される。
  個数は `DailySummary.totalHugeMagoBerryCount` / `TeamSummary.totalHugeMagoBerryCount` で参照できる。

## 3. データ未公開ポケモンの仮ステータス（削除済み）

上流がリリース前のポケモンを `frequency: 0` などのプレースホルダーで登録していた時期の暫定措置。
2026-09-14 の sync でミュウツーが正式データになり対象が 0 匹になったため、
2026-09-21 に仕組みごと削除した。`frequency` が 0 のポケモンは従来どおりおてつだいしない扱いになる
（`calculateHelp` のガード）。次のリリース前ポケモンが追加された場合は、必要になった時点で改めて検討する。

## 関連

- `document/teamtimeline-upstream-impact-20260914.md`（ミュウツーの正式データ、スキル値の公開）
- `document/teamtimeline-upstream-impact-20260921.md`（おおきなきのみのデータ、パネル削除）
