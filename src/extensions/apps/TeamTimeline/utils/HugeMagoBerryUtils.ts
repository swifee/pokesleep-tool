/**
 * HugeMagoBerryUtils.ts
 * 「とてもおおきなマゴのみ」（2026-09-14 / 09-21 の週のイベント）を解決する純粋関数群。
 *
 * 取得確率とエナジー倍率は公式未公開のため、値はすべて仮設定
 * （{@link HugeMagoBerryProvisionalSettings}）から取得する。
 * 仮設定が無効なときは、どの関数も「効果なし」を返す。
 */

import type { PokemonData, PokemonType } from "../../../../data/pokemons";
import type { HugeMagoBerryProvisionalSettings } from "../types/ProvisionalSettingsTypes";

/** とてもおおきなマゴのみのきのみタイプ（マゴのみ = エスパー） */
export const HUGE_MAGO_BERRY_TYPE: PokemonType = "psychic";

/**
 * 1回の取得で拾ってくる個数。
 * サブスキル「きのみの数S」やイベントのきのみ追加数は適用されない。
 */
export const HUGE_MAGO_BERRY_COUNT_PER_PICKUP = 1;

/** 最も多く拾ってくるポケモン */
export const HUGE_MAGO_BERRY_LEGENDARY_POKEMON_NAMES: readonly string[] = [
	"Mew",
	"Mewtwo",
];

/** 効果なしを表すエナジー倍率 */
const NO_HUGE_MAGO_BERRY_MULTIPLIER = 0;

/** とてもおおきなマゴのみの仮パラメータが有効かどうか */
export function isHugeMagoBerryEnabled(
	settings: HugeMagoBerryProvisionalSettings | undefined,
): settings is HugeMagoBerryProvisionalSettings {
	return settings?.enabled === true;
}

/** 拾ってくる確率の区分 */
export type HugeMagoBerryPickupTier = "legendary" | "psychic" | "other";

/**
 * ポケモンが属する取得確率の区分を返す。
 * 公式の「拾ってくる数が多い順」に対応する。
 */
export function getHugeMagoBerryPickupTier(
	pokemon: PokemonData,
): HugeMagoBerryPickupTier {
	if (HUGE_MAGO_BERRY_LEGENDARY_POKEMON_NAMES.includes(pokemon.name)) {
		return "legendary";
	}
	if (pokemon.type === HUGE_MAGO_BERRY_TYPE) {
		return "psychic";
	}
	return "other";
}

/**
 * おてつだい1回あたりの取得確率（0〜1）。
 * 仮設定が無効なら 0 を返し、乱数を消費させない。
 */
export function getHugeMagoBerryPickupRate(
	pokemon: PokemonData,
	settings: HugeMagoBerryProvisionalSettings | undefined,
): number {
	if (!isHugeMagoBerryEnabled(settings)) {
		return 0;
	}
	const percentByTier: Record<HugeMagoBerryPickupTier, number> = {
		legendary: settings.legendaryPickupRatePercent,
		psychic: settings.psychicPickupRatePercent,
		other: settings.otherPickupRatePercent,
	};
	const percent = percentByTier[getHugeMagoBerryPickupTier(pokemon)];
	if (!Number.isFinite(percent)) {
		return 0;
	}
	return Math.max(0, Math.min(100, percent)) / 100;
}

/**
 * 通常のマゴのみ1個に対するエナジー倍率。
 * 仮設定が無効なら 0（＝EPに寄与しない）を返す。
 */
export function getHugeMagoBerryEnergyMultiplier(
	settings: HugeMagoBerryProvisionalSettings | undefined,
): number {
	if (!isHugeMagoBerryEnabled(settings)) {
		return NO_HUGE_MAGO_BERRY_MULTIPLIER;
	}
	const multiplier = settings.energyMultiplier;
	if (!Number.isFinite(multiplier)) {
		return NO_HUGE_MAGO_BERRY_MULTIPLIER;
	}
	return Math.max(0, multiplier);
}
