/**
 * BerryZoneUtils.ts
 * 「きのみゾーン」（サイコブレイク）の効果を解決するための純粋関数群。
 *
 * 公式仕様:
 * - カビゴンのエナジーを増やすとともに、フィールドに「きのみゾーン」を展開する
 * - 展開中はマゴのみ（エスパータイプ）から得られるエナジーが増加率(%)ぶん UP する
 * - 発動のたびに増加率が上がり、上限（+24%）に達するまで重ねがけされる
 * - 一度展開したゾーンはフィールドを移動するまで持続する
 *
 * 発動1回あたりのカビゴンエナジーと増加率は上流の `MainSkill` から取得する。
 */

import type { PokemonType } from "../../../../data/pokemons";
import {
	getSkillSubValue,
	getSkillValue,
	type MainSkillName,
} from "../../../../util/MainSkill";

/** きのみゾーンを展開するメインスキル */
export const BERRY_ZONE_SKILL_NAMES: readonly MainSkillName[] = [
	"Berry Zone",
	"Berry Zone (Psystrike)",
];

/**
 * 発動値を持つきのみゾーンスキル。
 * "Berry Zone" 単体は上流のスキル分類用の名前で、数値を持たない。
 */
const BERRY_ZONE_VALUED_SKILL: MainSkillName = "Berry Zone (Psystrike)";

/** きのみゾーンで強化されるきのみのタイプ（マゴのみ = エスパー） */
export const BERRY_ZONE_BOOSTED_BERRY_TYPE: PokemonType = "psychic";

/** きのみゾーン増加率の上限(%)（公式: エナジー効果上限 +24%） */
export const BERRY_ZONE_MAX_RATE_PERCENT = 24;

/** 効果なしを表すきのみエナジー倍率 */
const NO_BERRY_ZONE_MULTIPLIER = 1;

/** きのみゾーンを展開するスキルかどうか */
export function isBerryZoneSkill(skillName: string): boolean {
	return BERRY_ZONE_SKILL_NAMES.some((name) => name === skillName);
}

/** 発動1回あたりのカビゴンエナジー */
export function getBerryZoneStrengthPerTrigger(
	skillName: MainSkillName,
	skillLevel: number,
): number {
	if (skillName !== BERRY_ZONE_VALUED_SKILL) {
		return 0;
	}
	return getSkillValue(skillName, skillLevel);
}

/** 発動1回あたりのきのみゾーン増加率(%) */
export function getBerryZoneRateGainPercent(
	skillName: MainSkillName,
	skillLevel: number,
): number {
	if (skillName !== BERRY_ZONE_VALUED_SKILL) {
		return 0;
	}
	return getSkillSubValue(skillName, skillLevel);
}

/** 増加率(%)を 0〜上限に収める */
export function clampBerryZoneRatePercent(ratePercent: number): number {
	if (!Number.isFinite(ratePercent)) {
		return 0;
	}
	return Math.max(0, Math.min(ratePercent, BERRY_ZONE_MAX_RATE_PERCENT));
}

/** 発動による増加を適用した後の増加率(%) */
export function addBerryZoneRate(
	currentRatePercent: number,
	gainPercent: number,
): number {
	const gain = Number.isFinite(gainPercent) ? Math.max(0, gainPercent) : 0;
	return clampBerryZoneRatePercent(
		clampBerryZoneRatePercent(currentRatePercent) + gain,
	);
}

/** 展開中のきのみエナジー倍率（マゴのみに適用） */
export function getBerryZoneBerryMultiplier(ratePercent: number): number {
	const rate = clampBerryZoneRatePercent(ratePercent);
	if (rate === 0) {
		return NO_BERRY_ZONE_MULTIPLIER;
	}
	return NO_BERRY_ZONE_MULTIPLIER + rate / 100;
}

/** タイプ別のきのみエナジー倍率（マゴのみ以外は効果なし） */
export function getBerryZoneMultiplierForType(
	type: PokemonType,
	ratePercent: number,
): number {
	if (type !== BERRY_ZONE_BOOSTED_BERRY_TYPE) {
		return NO_BERRY_ZONE_MULTIPLIER;
	}
	return getBerryZoneBerryMultiplier(ratePercent);
}

/**
 * きのみゾーンの展開状態。
 * 増加率に加えて、どのポケモンの発動で何 % 上がったかを持つ。
 * 上昇分のエナジーを「ゾーンを展開したポケモンが得たもの」として集計するときに使う。
 */
export interface BerryZoneState {
	/** 現在の増加率(%)（上限適用後） */
	ratePercent: number;
	/** 発動したポケモンごとの増加率への寄与分(%)（上限で切り捨てられた分は含まない） */
	contributionByPokemonId: ReadonlyMap<number, number>;
}

/** 未展開のきのみゾーン */
export const INITIAL_BERRY_ZONE_STATE: BerryZoneState = {
	ratePercent: 0,
	contributionByPokemonId: new Map<number, number>(),
};

/**
 * 発動による増加をポケモンごとに順に反映した新しい状態を返す。
 * 上限に達して反映されなかった分は寄与に数えない。
 */
export function applyBerryZoneRateGains(
	state: BerryZoneState,
	gainPercentByPokemonId: ReadonlyMap<number, number>,
): BerryZoneState {
	let ratePercent = clampBerryZoneRatePercent(state.ratePercent);
	const contributionByPokemonId = new Map(state.contributionByPokemonId);
	for (const [pokemonId, gainPercent] of gainPercentByPokemonId) {
		const nextRatePercent = addBerryZoneRate(ratePercent, gainPercent);
		const appliedPercent = nextRatePercent - ratePercent;
		if (appliedPercent <= 0) {
			continue;
		}
		contributionByPokemonId.set(
			pokemonId,
			(contributionByPokemonId.get(pokemonId) ?? 0) + appliedPercent,
		);
		ratePercent = nextRatePercent;
	}
	return { ratePercent, contributionByPokemonId };
}

/**
 * きのみゾーンで上がった分のエナジーを、増加率への寄与分に比例して発動したポケモンへ配分する。
 * 寄与がないときは空の Map を返す。
 */
export function distributeBerryZoneBonusEP(
	totalBonusEP: number,
	contributionByPokemonId: ReadonlyMap<number, number>,
): Map<number, number> {
	const distributed = new Map<number, number>();
	if (!Number.isFinite(totalBonusEP) || totalBonusEP <= 0) {
		return distributed;
	}
	let totalContribution = 0;
	for (const contribution of contributionByPokemonId.values()) {
		totalContribution += Math.max(0, contribution);
	}
	if (totalContribution <= 0) {
		return distributed;
	}
	for (const [pokemonId, contribution] of contributionByPokemonId) {
		if (contribution <= 0) {
			continue;
		}
		distributed.set(
			pokemonId,
			totalBonusEP * (contribution / totalContribution),
		);
	}
	return distributed;
}
