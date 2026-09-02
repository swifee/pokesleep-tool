# TeamTimeline 仮設定（未確定パラメータ）

公式に数値が公開されていない要素を、ユーザーが任意の値でシミュレートするための仕組み。
上流（`nitoyon/pokesleep-tool`）に正式な数値が入るまでの暫定措置で、判明した項目はここから取り除いていく。

- 設定 UI: 基本設定タブ末尾の「仮設定（未確定パラメータ）」
- 保存先: `localStorage["PstTeamTimelineProvisionalSettings"]`
- 型と既定値: `types/ProvisionalSettingsTypes.ts`
- 正規化と永続化: `utils/ProvisionalSettingsStorage.ts`
- UI: `components/ProvisionalSettingsPanel.tsx`

仮設定はシミュレーション入力（`SimulationInput.provisionalSettings`）として渡され、
`buildSimulationContextHash` にも含まれるため、値を変えると再シミュレーションが必要な状態として扱われる。
**すべての項目は既定で OFF** で、OFF のときは従来どおりの計算結果になる。

## 1. サイコブレイク（きのみゾーン）

ミュウツーのメインスキル `Berry Zone (Psystrike)`。公式説明は次のとおり。

- カビゴンのエナジーを増やすとともに、フィールドに「きのみゾーン」を展開する
- 展開中はマゴのみ（エスパータイプ）から得られるエナジーが UP する
- 発動のたびに上限まで重ねがけされる
- 一度展開したゾーンはフィールドを移動するまで持続し、ミュウツーをチームから外しても消えない

### 設定項目

| 項目 | 意味 |
|---|---|
| 発動1回あたりのカビゴンエナジー（Lv1〜6） | 直接獲得 EP。`Charge Strength S` と同じ扱いで `directSkillEP` に加算される |
| 1重ねがけあたりのマゴのみエナジー上昇率(%) | きのみエナジー倍率 = `1 + 重ねがけ数 × 上昇率 / 100` |
| 重ねがけの上限回数 | ゾーンの重ねがけ上限 |
| 開始時点で展開済みの重ねがけ数 | ミュウツー不在でも「展開済みのフィールド」を再現するための初期値 |

### 実装

- 判定・倍率計算は `utils/BerryZoneUtils.ts` に集約（仮設定が無効なら常に「効果なし」を返す）。
- `classifySkill` は `Berry Zone` 系を `directEP` として分類し、スキル値は
  `getSkillValue` ではなく仮設定から取得する（仮設定が無効なら 0）。
- ゾーンの重ねがけ数はフィールド単位の状態として `runSimulation` が保持する。
  チーム全体で共有し、入れ替えでミュウツーが抜けても保持される。
- 発動による重ねがけは**次の時間帯から**反映する（その時間帯のおてつだいは発動前に行われているため）。
- 各 `TimeSlotResult` は、その時間帯の開始時点の重ねがけ数（`berryZoneStackCount`）と、
  そのポケモンのきのみに掛かる倍率（`berryZoneMultiplier`、マゴのみ以外は 1）を持つ。
- きのみ EP は時間帯ごとの倍率で計算する。`calculateDailySummary` は合計個数ではなく
  時間帯単位で `calculateBerryEP` を呼ぶ（倍率が一定なら従来と同じ値になる）。
- スキル由来のきのみ EP（Berry Burst / Lunar Blessing / Extra Helpful S / Helper Boost）にも
  同じ倍率が掛かる（`SkillEffectProcessor.resolveBerryStrengthBonus`）。

## 2. とてもおおきなマゴのみ（イベント）

2026-09-14 / 09-21 の週のイベント要素。公式説明は次のとおり。

- 開催期間中、すべてのおてつだいポケモンが通常のおてつだいで追加で拾ってくることがある
- 通常より高いエナジーを持った特別なマゴのみ
- 秘境の奥へ進むにつれて多く見つかる
- 拾ってくる数は ミュウ/ミュウツー ＞ エスパータイプ ＞ その他 の順に多い
- サブスキル「きのみの数S」は適用されない
- 「いつのまに育成」でカビゴンにあげることはできない

### シミュレーション上の解釈

| 公式表現 | 本ツールでの扱い |
|---|---|
| 拾ってくる数が異なる | おてつだい1回あたりの**取得確率**が異なるものとして扱う（1回につき1個） |
| 秘境の奥へ進むほど多く | 再現せず、一律の確率とする |
| 「いつのまに育成」であげられない | 所持数が満タンのときは拾えない。溢れ回収（いつのまに育成）の対象にもしない |
| きのみの数Sが適用されない | イベントのきのみ追加数も含め、1回1個で固定 |

### 設定項目

| 項目 | 意味 |
|---|---|
| 通常のマゴのみに対するエナジー倍率 | きのみ1個あたりのエナジー = マゴのみのエナジー × 倍率 |
| ミュウ / ミュウツーの取得確率(%) | おてつだい1回あたりの取得確率 |
| エスパータイプの取得確率(%) | 同上 |
| その他の取得確率(%) | 同上 |

### 実装

- 区分判定と確率・倍率の解決は `utils/HugeMagoBerryUtils.ts` に集約する。
  仮設定が無効なら確率も倍率も 0 を返すため、乱数を消費せず従来と同じ結果になる。
- 取得判定は `calculateHelp` のおてつだいループ内、所持数に空きがある分岐でのみ行う。
  拾った1個は所持数を消費する。
- エナジーは**拾ったポケモン自身のきのみではなくマゴのみ（エスパー）**として計算する
  （`calculateHugeMagoBerryEP`）。好みのきのみ補正もエスパーで判定するため、
  `PokemonBonusContext.hugeMagoBerry` に `calcBerryStrengthBonus("psychic", ...)` を持たせている。
- ミュウツーのサイコブレイクで展開した「きのみゾーン」の倍率も掛かる（マゴのみのため）。
- 回収は通常のきのみと同じく `PokemonState.carriedHugeMagoBerryCount` で持ち越し、
  回収する時間帯でまとめて計上する。「回収しない」セルでは溢れても回収されない。
- 計上先は `TimeSlotResult.hugeMagoBerryCount` / `hugeMagoBerryEP`。
  EP は `DailySummary.berryEP` に含めるため、合計EPやチーム合計は自動的に反映される。
  個数は `DailySummary.totalHugeMagoBerryCount` / `TeamSummary.totalHugeMagoBerryCount` で参照できる。

## 3. データ未公開ポケモンの仮ステータス

上流はリリース前のポケモンを `frequency: 0` / `skillRate: 0` / `carryLimit: 0` のプレースホルダーで
追加する（2026-09-02 時点ではミュウツーのみ）。このままではおてつだいもスキル発動も起きないため、
ゾーン展開そのものをシミュレートできない。

| 項目 | 反映先 |
|---|---|
| おてつだいスピード(秒) | `HelpBonusContext.baseFrequencySecondsOverride` → `resolveBaseFrequency` |
| メインスキル発動率(%) | `PokemonIv.clone({ baseSkillRate })`（`pokemon.skillRate` は百分率で保持される） |
| 最大所持数 | `PokemonState.maxInventory`（`getTimelineCarryLimit`） |

対象は `isPlaceholderPokemonData` が true のポケモンのみ。通常のポケモンには一切影響しない。
食材は上流が `unknown1` などのままなので仮設定の対象にせず、きのみのみを集めるものとして計算する。

`calculateBaseFrequencyWithBaseSeconds` と `calculateCarryLimitWithBase` は
`PokemonIv.getBaseFrequency` / `PokemonIv.carryLimit` と同じ補正を種族値だけ差し替えて再現する。
上流の式が変わったときに気付けるよう、実データのポケモンで両者が一致することをテストで固定している
（`utils/TimelinePokemonUtils.test.ts`）。

## 正式な数値が判明したら

1. `Berry Zone (Psystrike)` の値が上流の `getSkillValue` に入ったら、
   `BerryZoneUtils.getBerryZoneSnorlaxEnergy` の参照先を上流へ切り替え、UI の入力欄を削除する。
2. とてもおおきなマゴのみの確率とエナジーが判明したら、`HugeMagoBerryUtils` の
   参照先を実データへ切り替える。イベント終了後は項目ごと削除してよい。
3. ミュウツーの種族値が入ったら `isPlaceholderPokemonData` が false になるため、
   仮ステータスは自動的に無効化される。対象が 0 匹になった時点で項目ごと削除してよい。
