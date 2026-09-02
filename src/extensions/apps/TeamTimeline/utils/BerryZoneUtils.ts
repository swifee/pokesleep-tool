/**
 * BerryZoneUtils.ts
 * 「きのみゾーン」（サイコブレイク）の仮パラメータを解決するための純粋関数群。
 *
 * 公式に数値が公開されていないため、値はすべて仮設定
 * （{@link BerryZoneProvisionalSettings}）から取得する。
 * 仮設定が無効なときは、どの関数も「効果なし」を返す。
 */

import type { PokemonType } from "../../../../data/pokemons";
import {
	BERRY_ZONE_SKILL_NAMES,
	type BerryZoneProvisionalSettings,
} from "../types/ProvisionalSettingsTypes";

/** きのみゾーンで強化されるきのみのタイプ（マゴのみ = エスパー） */
export const BERRY_ZONE_BOOSTED_BERRY_TYPE: PokemonType = "psychic";

/** 効果なしを表すきのみエナジー倍率 */
const NO_BERRY_ZONE_MULTIPLIER = 1;

/** きのみゾーンを展開するスキルかどうか */
export function isBerryZoneSkill(skillName: string): boolean {
	return BERRY_ZONE_SKILL_NAMES.some((name) => name === skillName);
}

/** きのみゾーンの仮パラメータが有効かどうか */
export function isBerryZoneEnabled(
	settings: BerryZoneProvisionalSettings | undefined,
): settings is BerryZoneProvisionalSettings {
	return settings?.enabled === true;
}

/** 重ねがけ数を 0〜上限に収める */
export function clampBerryZoneStackCount(
	stackCount: number,
	settings: BerryZoneProvisionalSettings | undefined,
): number {
	if (!isBerryZoneEnabled(settings)) {
		return 0;
	}
	if (!Number.isFinite(stackCount)) {
		return 0;
	}
	return Math.max(
		0,
		Math.min(Math.floor(stackCount), Math.max(0, settings.maxStackCount)),
	);
}

/** シミュレーション開始時点の重ねがけ数 */
export function getInitialBerryZoneStackCount(
	settings: BerryZoneProvisionalSettings | undefined,
): number {
	if (!isBerryZoneEnabled(settings)) {
		return 0;
	}
	return clampBerryZoneStackCount(settings.initialStackCount, settings);
}

/** 発動による重ねがけを適用した後の重ねがけ数 */
export function addBerryZoneStacks(
	currentStackCount: number,
	gainedStackCount: number,
	settings: BerryZoneProvisionalSettings | undefined,
): number {
	if (!isBerryZoneEnabled(settings)) {
		return 0;
	}
	const gained = Number.isFinite(gainedStackCount)
		? Math.max(0, Math.floor(gainedStackCount))
		: 0;
	return clampBerryZoneStackCount(
		clampBerryZoneStackCount(currentStackCount, settings) + gained,
		settings,
	);
}

/** 展開中のきのみエナジー倍率（マゴのみに適用） */
export function getBerryZoneBerryMultiplier(
	settings: BerryZoneProvisionalSettings | undefined,
	stackCount: number,
): number {
	if (!isBerryZoneEnabled(settings)) {
		return NO_BERRY_ZONE_MULTIPLIER;
	}
	const stacks = clampBerryZoneStackCount(stackCount, settings);
	if (stacks === 0) {
		return NO_BERRY_ZONE_MULTIPLIER;
	}
	const bonusPercent = Math.max(0, settings.berryEnergyBonusPercent);
	return NO_BERRY_ZONE_MULTIPLIER + (stacks * bonusPercent) / 100;
}

/** タイプ別のきのみエナジー倍率（マゴのみ以外は効果なし） */
export function getBerryZoneMultiplierForType(
	type: PokemonType,
	settings: BerryZoneProvisionalSettings | undefined,
	stackCount: number,
): number {
	if (type !== BERRY_ZONE_BOOSTED_BERRY_TYPE) {
		return NO_BERRY_ZONE_MULTIPLIER;
	}
	return getBerryZoneBerryMultiplier(settings, stackCount);
}

/** 発動1回あたりのカビゴンエナジー */
export function getBerryZoneSnorlaxEnergy(
	settings: BerryZoneProvisionalSettings | undefined,
	skillLevel: number,
): number {
	if (!isBerryZoneEnabled(settings)) {
		return 0;
	}
	const levelIndex = Math.floor(skillLevel) - 1;
	const energy = settings.snorlaxEnergyByLevel[levelIndex];
	if (energy === undefined || !Number.isFinite(energy)) {
		return 0;
	}
	return Math.max(0, energy);
}
