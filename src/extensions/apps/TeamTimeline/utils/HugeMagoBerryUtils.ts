/**
 * HugeMagoBerryUtils.ts
 * 「とてもおおきなマゴのみ」（「ミュウツーをおいかけて」イベント）に関する定数。
 *
 * 取得確率と1回に拾う個数は上流の `BigBerry.getBigBerryRate` が
 * `PokemonStrength.bonusEffects`（`bigBerryRate` / `bigBerryCount`）として解決し、
 * 選択中のイベントが `bigBerry` を持つときだけ 0 より大きくなる。
 * エナジーは上流の `Berry.getBerryStrength(..., isBig)` で計算する。
 */

import type { PokemonType } from "../../../../data/pokemons";

/** とてもおおきなマゴのみのきのみタイプ（マゴのみ = エスパー） */
export const HUGE_MAGO_BERRY_TYPE: PokemonType = "psychic";
