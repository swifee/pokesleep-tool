import { cbexFieldIndex } from "../../../../data/fields";
import type { PokemonData } from "../../../../data/pokemons";
import type { MainSkillName } from "../../../../util/MainSkill";
import { trunc } from "../../../../util/NumberUtil";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import type PokemonIv from "../../../../util/PokemonIv";
import {
	cbexMainBerrySpeedBonus,
	cbexNonFavoriteBerrySpeedPenalty,
	ggexMainBerrySpeedBonus,
	ggexNonFavoriteBerrySpeedPenalty,
	type StrengthParameter,
} from "../../../../util/PokemonStrength";
import type { PlaceholderPokemonProvisionalSettings } from "../types/ProvisionalSettingsTypes";

/** サブスキル1つあたりのおてつだいスピード補正 */
const HELPING_SPEED_PER_SUB_SKILL = 0.07;
/** おてつだいボーナス1匹あたりの補正 */
const HELPING_SPEED_PER_HELPING_BONUS = 0.05;
/** おてつだいスピード補正の上限 */
const MAX_HELPING_SPEED_FACTOR = 0.35;
/** サブスキル「最大所持数アップ」1つあたりの所持数 */
const CARRY_LIMIT_PER_SUB_SKILL = 6;
/** 進化1段階あたりの最大所持数 */
const CARRY_LIMIT_PER_EVOLUTION = 5;

function getMewSkillRate(
	versatileSkill: MainSkillName,
	mew: StrengthParameter["mew"],
): number {
	if (
		versatileSkill === "Charge Strength S (Random)" ||
		versatileSkill === "Charge Energy S"
	) {
		return mew.skill1;
	}
	if (
		versatileSkill === "Energy for Everyone S" ||
		versatileSkill === "Berry Burst"
	) {
		return mew.skill3;
	}
	return mew.skill2;
}

function toPokemonIv(source: PokemonIv | PokemonBoxItem): PokemonIv {
	return source instanceof PokemonBoxItem ? source.iv : source;
}

export function getEffectiveMainSkillName(
	source: PokemonIv | PokemonBoxItem,
): MainSkillName {
	const iv = toPokemonIv(source);
	const rawSkill = iv.pokemon?.skill ?? iv.versatileSkill ?? "unknown";
	return rawSkill === "Versatile" ? iv.versatileSkill : rawSkill;
}

/**
 * 上流がリリース前のポケモンに入れているプレースホルダーデータかどうか。
 * （おてつだいスピードやスキル発動率が 0 のままのデータ）
 */
export function isPlaceholderPokemonData(pokemon: PokemonData): boolean {
	return (
		pokemon.frequency <= 0 || pokemon.skillRate <= 0 || pokemon.carryLimit <= 0
	);
}

/**
 * 種族のおてつだいスピードを差し替えて、おてつだい間隔を計算する。
 *
 * PokemonIv.frequencyWithHelpingBonus と同じ補正を用いる
 * （プレースホルダーデータは frequency が 0 のため、そのままでは計算できない）。
 */
export function calculateFrequencyWithBaseSeconds(
	iv: PokemonIv,
	baseFrequencySeconds: number,
	helpingBonusCount: number,
): number {
	const helpingSpeed =
		iv.activeSubSkills.reduce(
			(total, subSkill) => total + subSkill.helpingSpeed,
			0,
		) * HELPING_SPEED_PER_SUB_SKILL;
	const subSkillFactor = Math.min(
		helpingSpeed + HELPING_SPEED_PER_HELPING_BONUS * helpingBonusCount,
		MAX_HELPING_SPEED_FACTOR,
	);

	return (
		baseFrequencySeconds *
		trunc(
			((501 - iv.level) / 500) *
				(iv.nature?.speedOfHelpFactor ?? 1) *
				iv.speedOfRibbonFactor *
				(1 - subSkillFactor),
			4,
		)
	);
}

/** 基礎おてつだい間隔の計算条件 */
export interface BaseFrequencyOptions {
	/** チーム内のおてつだいボーナス保持数 */
	helpBonusCount: number;
	/** いいキャンプチケット */
	isGoodCampTicketSet: boolean;
	/** EXフィールドのメインきのみ補正対象 */
	isMainBerry: boolean;
	/** EXフィールドの非好みきのみ補正対象 */
	isNonFavoriteBerry: boolean;
	/** フィールド index */
	fieldIndex: number;
	/** データ未公開ポケモン向けのおてつだいスピード(秒)の仮値 */
	baseFrequencySecondsOverride?: number;
}

/**
 * 種族のおてつだいスピードを差し替えて、基礎おてつだい間隔を計算する。
 * PokemonIv.getBaseFrequency と同じ補正を用いる。
 */
export function calculateBaseFrequencyWithBaseSeconds(
	iv: PokemonIv,
	baseFrequencySeconds: number,
	options: BaseFrequencyOptions,
): number {
	const isCbex = options.fieldIndex === cbexFieldIndex;
	const mainBerrySpeedBonus = isCbex
		? cbexMainBerrySpeedBonus
		: ggexMainBerrySpeedBonus;
	const nonFavoriteBerrySpeedPenalty = isCbex
		? cbexNonFavoriteBerrySpeedPenalty
		: ggexNonFavoriteBerrySpeedPenalty;

	return (
		(calculateFrequencyWithBaseSeconds(
			iv,
			baseFrequencySeconds,
			options.helpBonusCount,
		) /
			(options.isGoodCampTicketSet ? 1.2 : 1)) *
		(options.isMainBerry ? 1 - mainBerrySpeedBonus : 1) *
		(options.isNonFavoriteBerry ? 1 + nonFavoriteBerrySpeedPenalty : 1)
	);
}

/**
 * 基礎おてつだい間隔を求める。
 * データ未公開ポケモンで仮値が指定されている場合のみ、仮値から計算する。
 */
export function resolveBaseFrequency(
	iv: PokemonIv,
	options: BaseFrequencyOptions,
): number {
	const override = options.baseFrequencySecondsOverride ?? 0;
	if (override > 0 && isPlaceholderPokemonData(iv.pokemon)) {
		return calculateBaseFrequencyWithBaseSeconds(iv, override, options);
	}
	return iv.getBaseFrequency(
		options.helpBonusCount,
		options.isGoodCampTicketSet,
		options.isMainBerry,
		options.isNonFavoriteBerry,
		options.fieldIndex,
	);
}

/**
 * 種族の最大所持数を差し替えて、最大所持数を計算する。
 * PokemonIv.carryLimit と同じ補正を用いる。
 */
export function calculateCarryLimitWithBase(
	iv: PokemonIv,
	baseCarryLimit: number,
): number {
	return (
		baseCarryLimit +
		CARRY_LIMIT_PER_EVOLUTION * Math.max(0, iv.pokemon.evolutionCount) +
		iv.ribbonCarryLimit +
		iv.activeSubSkills.reduce(
			(total, subSkill) => total + subSkill.inventory,
			0,
		) *
			CARRY_LIMIT_PER_SUB_SKILL
	);
}

/**
 * 仮ステータスを適用したおてつだい間隔(秒)を返す。
 * 仮ステータスが無効、または通常のデータを持つポケモンなら 0 を返す。
 */
export function getProvisionalBaseFrequencySeconds(
	iv: PokemonIv,
	placeholderStats?: PlaceholderPokemonProvisionalSettings,
): number {
	if (!placeholderStats?.enabled || !isPlaceholderPokemonData(iv.pokemon)) {
		return 0;
	}
	return Math.max(0, placeholderStats.helpingFrequencySeconds);
}

/**
 * 仮ステータスを適用した最大所持数を返す。
 */
export function getTimelineCarryLimit(
	iv: PokemonIv,
	placeholderStats?: PlaceholderPokemonProvisionalSettings,
): number {
	if (!placeholderStats?.enabled || !isPlaceholderPokemonData(iv.pokemon)) {
		return iv.carryLimit;
	}
	return calculateCarryLimitWithBase(iv, placeholderStats.carryLimit);
}

export function normalizeTimelinePokemonIv(
	iv: PokemonIv,
	strengthParameter: StrengthParameter,
	placeholderStats?: PlaceholderPokemonProvisionalSettings,
): PokemonIv {
	if (iv.pokemon.name === "Mew") {
		return iv.clone({
			baseIngRate: strengthParameter.mew.ing,
			baseSkillRate: getMewSkillRate(iv.versatileSkill, strengthParameter.mew),
		});
	}

	if (placeholderStats?.enabled && isPlaceholderPokemonData(iv.pokemon)) {
		// pokemon.skillRate は百分率で保持されるため、そのまま渡す。
		return iv.clone({
			baseSkillRate: Math.max(0, placeholderStats.skillRatePercent),
		});
	}

	return iv;
}

export function normalizeTimelinePokemon(
	pokemon: PokemonBoxItem,
	strengthParameter: StrengthParameter,
	placeholderStats?: PlaceholderPokemonProvisionalSettings,
): PokemonBoxItem {
	const normalizedIv = normalizeTimelinePokemonIv(
		pokemon.iv,
		strengthParameter,
		placeholderStats,
	);
	if (normalizedIv === pokemon.iv) {
		return pokemon;
	}

	return new PokemonBoxItem(normalizedIv, pokemon.nickname, pokemon.id);
}
