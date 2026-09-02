/**
 * HelpCalculator.ts
 * おてつだい回数、スキル発動、食材/きのみ取得を計算するモジュール
 */

import { ggexFieldIndex } from "../../../../data/fields";
import type { IngredientName } from "../../../../data/pokemons";
import { getSkillValue, type MainSkillName } from "../../../../util/MainSkill";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import type { IngredientResult } from "../types/TimeSlotTypes";
import { HUGE_MAGO_BERRY_COUNT_PER_PICKUP } from "../utils/HugeMagoBerryUtils";
import {
	getEffectiveMainSkillName,
	resolveBaseFrequency,
} from "../utils/TimelinePokemonUtils";
import { calculateWeightedEfficiency } from "./EnergyCalculator";
import type SeededRandom from "./SeededRandom";

export interface HelpBonusContext {
	/** スキル発動率倍率（イベント/EX） */
	skillTriggerBonus: number;
	/** きのみ追加数（イベント） */
	berryBonus: number;
	/** 食材追加数（イベント/EX） */
	ingredientBonus: number;
	/** 最大所持数追加（イベント） */
	carryLimitAdd?: number;
	/** 最大所持数倍率（イベント） */
	carryLimitMultiplier?: number;
	/** 最大所持数追加（旧設定互換） */
	carryLimitBonus?: number;
	/** いいキャンプチケット */
	isGoodCampTicketSet: boolean;
	/** EXメインきのみ補正対象 */
	isMainBerry: boolean;
	/** EX非好みきのみ補正対象 */
	isNonFavoriteBerry: boolean;
	/**
	 * フィールド index。
	 * EXフィールドごとにきのみ速度補正が異なるため、おてつだい間隔の計算に用いる。
	 * 省略時はグリーングラスEX（従来の補正値）として扱う。
	 */
	fieldIndex?: number;
	/**
	 * データ未公開ポケモンに適用するおてつだいスピード(秒)の仮値。
	 * 種族データが入るまでの仮設定で、通常のポケモンには影響しない。
	 */
	baseFrequencySecondsOverride?: number;
	/**
	 * おてつだい1回あたりに「とてもおおきなマゴのみ」を拾ってくる確率（0〜1）。
	 * 0 のときは判定そのものを行わない（乱数を消費しない）。
	 */
	hugeMagoBerryPickupRate?: number;
}

/**
 * おてつだい計算の入力パラメータ
 */
export interface HelpInput {
	/** ポケモン */
	pokemon: PokemonBoxItem;
	/** 経過時間（分） */
	durationMinutes: number;
	/** 開始時のげんき値 */
	startEnergy: number;
	/** 睡眠中フラグ */
	isSleeping: boolean;
	/** 乱数生成器 */
	random: SeededRandom;
	/** チーム内のHelping Bonusサブスキル保持数（自分を含む） */
	teamHelpingBonusCount: number;
	/** 現在のスキルストック */
	currentSkillStock: number;
	/** スキルストック上限 */
	maxSkillStock: number;
	/** 現在の所持数 */
	currentInventory: number;
	/** 最大所持数 */
	maxInventory: number;
	/** 持ち越し秒数 */
	bankedTimeSeconds: number;
	/** ボーナス設定（イベント/EX/キャンチケ） */
	bonusContext?: HelpBonusContext;
}

/**
 * おてつだい計算の結果
 */
export interface HelpOutput {
	/** おてつだい回数 */
	helpCount: number;
	/** スキル発動回数 */
	skillTriggerCount: number;
	/** きのみ取得個数 */
	berryCount: number;
	/** とてもおおきなマゴのみの取得個数 */
	hugeMagoBerryCount: number;
	/** 食材取得リスト */
	ingredients: IngredientResult[];
	/** スキル発動失敗（溢れ）回数 */
	skillOverflowCount: number;
	/** 溢れた食材 */
	overflowIngredients: IngredientResult[];
	/** 更新後のスキルストック */
	newSkillStock: number;
	/** 更新後の所持数 */
	newInventory: number;
	/** 次スロットへ持ち越す秒数 */
	newBankedTimeSeconds: number;
}

/**
 * スキル発動による効果
 */
export interface SkillEffect {
	/** スキル名 */
	skillName: string;
	/** チーム全員へのげんき回復量（Energy for Everyone S系のみ） */
	energyRecoveryForTeam: number;
}

export function getEffectiveMaxInventory(
	maxInventory: number,
	carryLimitAdd: number = 0,
	carryLimitMultiplier: number = 1,
	isGoodCampTicketSet: boolean = false,
): number {
	const adjustedMaxInventory = Math.max(0, maxInventory + carryLimitAdd);
	return Math.ceil(
		adjustedMaxInventory *
			Math.max(1, carryLimitMultiplier) *
			(isGoodCampTicketSet ? 1.2 : 1),
	);
}

/**
 * 基礎おてつだい間隔を取得（秒）
 * @param pokemon ポケモン
 * @param teamHelpingBonusCount チーム内のHelping Bonus保持数
 * @returns 基礎おてつだい間隔（秒）
 */
export function getBaseFrequency(
	pokemon: PokemonBoxItem,
	teamHelpingBonusCount: number,
): number {
	return pokemon.iv.frequencyWithHelpingBonus(teamHelpingBonusCount);
}

/**
 * おてつだい回数を計算
 * @param baseFrequencySeconds 基礎おてつだい間隔（秒）
 * @param durationMinutes 経過時間（分）
 * @param efficiency 効率倍率
 * @returns おてつだい回数
 */
export function calculateHelpCount(
	baseFrequencySeconds: number,
	durationMinutes: number,
	efficiency: number,
): number {
	if (durationMinutes <= 0 || baseFrequencySeconds <= 0) {
		return 0;
	}
	const effectiveFrequency = baseFrequencySeconds / efficiency;
	const durationSeconds = durationMinutes * 60;
	return Math.floor(durationSeconds / effectiveFrequency);
}

/**
 * 食材取得時の食材を決定
 * @param pokemon ポケモン
 * @param random 乱数生成器
 * @returns 取得した食材の名前と個数
 */
export function getIngredientForHelp(
	pokemon: PokemonBoxItem,
	random: SeededRandom,
): { name: IngredientName; count: number } {
	const level = pokemon.iv.level;

	// レベルに応じて解放された食材リストを作成
	const ingredients: { name: IngredientName; count: number }[] = [];

	const ing1 = pokemon.iv.ingredient1;
	if (ing1.count > 0) {
		ingredients.push({ name: ing1.name as IngredientName, count: ing1.count });
	}

	if (level >= 30) {
		const ing2 = pokemon.iv.ingredient2;
		if (ing2.count > 0) {
			ingredients.push({
				name: ing2.name as IngredientName,
				count: ing2.count,
			});
		}
	}

	if (level >= 60) {
		const ing3 = pokemon.iv.ingredient3;
		if (ing3.count > 0) {
			ingredients.push({
				name: ing3.name as IngredientName,
				count: ing3.count,
			});
		}
	}

	// 均等確率で選択
	if (ingredients.length === 0) {
		return { name: "unknown" as IngredientName, count: 0 };
	}

	const index = random.nextInt(0, ingredients.length - 1);
	return ingredients[index];
}

/**
 * 時間帯のおてつだい結果を計算
 * @param input おてつだい計算の入力
 * @returns おてつだい結果
 */
export function calculateHelp(input: HelpInput): HelpOutput {
	const {
		pokemon,
		durationMinutes,
		startEnergy,
		random,
		teamHelpingBonusCount,
		currentSkillStock,
		maxSkillStock,
		currentInventory,
		maxInventory,
		bankedTimeSeconds,
		bonusContext,
	} = input;

	const noHelpOutput: HelpOutput = {
		helpCount: 0,
		skillTriggerCount: 0,
		berryCount: 0,
		hugeMagoBerryCount: 0,
		ingredients: [],
		skillOverflowCount: 0,
		overflowIngredients: [],
		newSkillStock: currentSkillStock,
		newInventory: currentInventory,
		newBankedTimeSeconds: bankedTimeSeconds,
	};

	// 経過時間が0以下の場合は何もしない
	if (durationMinutes <= 0) {
		return noHelpOutput;
	}

	const skillTriggerBonus = bonusContext?.skillTriggerBonus ?? 1;
	const berryBonus = Math.max(0, bonusContext?.berryBonus ?? 0);
	const ingredientBonus = Math.max(0, bonusContext?.ingredientBonus ?? 0);
	const carryLimitAdd = Math.max(
		0,
		bonusContext?.carryLimitAdd ?? bonusContext?.carryLimitBonus ?? 0,
	);
	const carryLimitMultiplier = Math.max(
		1,
		bonusContext?.carryLimitMultiplier ?? 1,
	);
	const isGoodCampTicketSet = bonusContext?.isGoodCampTicketSet ?? false;
	const effectiveMaxInventory = getEffectiveMaxInventory(
		maxInventory,
		carryLimitAdd,
		carryLimitMultiplier,
		isGoodCampTicketSet,
	);
	const hugeMagoBerryPickupRate = Math.max(
		0,
		bonusContext?.hugeMagoBerryPickupRate ?? 0,
	);
	const isMainBerry = bonusContext?.isMainBerry ?? false;
	const isNonFavoriteBerry = bonusContext?.isNonFavoriteBerry ?? false;
	const fieldIndex = bonusContext?.fieldIndex ?? ggexFieldIndex;

	// 基礎おてつだい間隔
	const baseFrequency = resolveBaseFrequency(pokemon.iv, {
		helpBonusCount: Math.max(0, teamHelpingBonusCount),
		isGoodCampTicketSet,
		isMainBerry,
		isNonFavoriteBerry,
		fieldIndex,
		baseFrequencySecondsOverride: bonusContext?.baseFrequencySecondsOverride,
	});

	// 加重平均効率
	const efficiency = calculateWeightedEfficiency(startEnergy, durationMinutes);

	// おてつだい回数計算（持ち越し秒数を加算）
	const effectiveFrequency = baseFrequency / efficiency;

	// 未実装ポケモンは frequency が 0 のため、おてつだい回数が無限になる。
	// 実装済みデータが入るまでは、おてつだいしないものとして扱う。
	if (!Number.isFinite(effectiveFrequency) || effectiveFrequency <= 0) {
		return noHelpOutput;
	}

	const totalSeconds = durationMinutes * 60 + bankedTimeSeconds;
	const helpCount = Math.floor(totalSeconds / effectiveFrequency);
	const newBankedTimeSeconds = totalSeconds % effectiveFrequency;

	// 状態変数の初期化
	let skillStock = currentSkillStock;
	let inventory = currentInventory;
	let skillTriggerCount = 0;
	let skillOverflowCount = 0;
	let totalBerryCount = 0;
	let totalHugeMagoBerryCount = 0;

	const ingredientMap = new Map<IngredientName, number>();
	const overflowIngredientMap = new Map<IngredientName, number>();

	const ingredientRate = pokemon.iv.ingredientRate;
	const skillRate = Math.min(1, pokemon.iv.skillRate * skillTriggerBonus);
	const baseBerryCount = pokemon.iv.berryCount;
	const ingredientBonusBase = Math.floor(ingredientBonus);
	const ingredientBonusFraction = Math.max(
		0,
		ingredientBonus - ingredientBonusBase,
	);

	// 各おてつだいをループ
	for (let i = 0; i < helpCount; i++) {
		const isInventoryFull = inventory >= effectiveMaxInventory;

		if (isInventoryFull) {
			const berryCountForHelp = baseBerryCount;
			// いつのまに育成状態
			if (random.chance(ingredientRate)) {
				// 食材判定成功 → 溢れ食材としてカウント、きのみを代わりに取得
				const ing = getIngredientForHelp(pokemon, random);
				const extraCount =
					ingredientBonusBase +
					(ingredientBonusFraction > 0 && random.chance(ingredientBonusFraction)
						? 1
						: 0);
				const ingredientCount = ing.count + extraCount;
				const current = overflowIngredientMap.get(ing.name) || 0;
				overflowIngredientMap.set(ing.name, current + ingredientCount);
				totalBerryCount += berryCountForHelp;
			} else {
				// きのみ判定 → 通常通り取得
				totalBerryCount += berryCountForHelp;
			}
			// inventoryは増えない（溢れるため）

			// スキル判定は行う、成功したら溢れとしてカウント
			if (random.chance(skillRate)) {
				skillOverflowCount++;
			}
		} else {
			// 通常状態
			if (random.chance(ingredientRate)) {
				// 食材取得
				const ing = getIngredientForHelp(pokemon, random);
				const extraCount =
					ingredientBonusBase +
					(ingredientBonusFraction > 0 && random.chance(ingredientBonusFraction)
						? 1
						: 0);
				const ingredientCount = ing.count + extraCount;
				const current = ingredientMap.get(ing.name) || 0;
				ingredientMap.set(ing.name, current + ingredientCount);
				inventory += ingredientCount;
			} else {
				// きのみ取得
				const berryCountForHelp =
					inventory + baseBerryCount + berryBonus >= effectiveMaxInventory
						? baseBerryCount
						: baseBerryCount + berryBonus;
				totalBerryCount += berryCountForHelp;
				inventory += berryCountForHelp;
			}

			// とてもおおきなマゴのみの追加取得判定。
			// 所持数が満タンのときは拾えないため、通常状態のみ判定する。
			if (
				hugeMagoBerryPickupRate > 0 &&
				random.chance(hugeMagoBerryPickupRate)
			) {
				totalHugeMagoBerryCount += HUGE_MAGO_BERRY_COUNT_PER_PICKUP;
				inventory += HUGE_MAGO_BERRY_COUNT_PER_PICKUP;
			}

			// スキル発動判定
			if (random.chance(skillRate)) {
				if (skillStock < maxSkillStock) {
					skillTriggerCount++;
					skillStock++;
				} else {
					skillOverflowCount++;
				}
			}
		}
	}

	// 食材リストを配列に変換
	const ingredients: IngredientResult[] = [];
	ingredientMap.forEach((count, name) => {
		ingredients.push({ name, count });
	});

	// 溢れ食材リストを配列に変換
	const overflowIngredients: IngredientResult[] = [];
	overflowIngredientMap.forEach((count, name) => {
		overflowIngredients.push({ name, count });
	});

	return {
		helpCount,
		skillTriggerCount,
		berryCount: totalBerryCount,
		hugeMagoBerryCount: totalHugeMagoBerryCount,
		ingredients,
		skillOverflowCount,
		overflowIngredients,
		newSkillStock: skillStock,
		newInventory: inventory,
		newBankedTimeSeconds,
	};
}

/**
 * スキル発動による効果を取得
 * @param pokemon ポケモン
 * @param skillTriggerCount スキル発動回数
 * @returns スキル効果
 */
export function getSkillEffect(
	pokemon: PokemonBoxItem,
	skillTriggerCount: number,
): SkillEffect {
	const skillName = getEffectiveMainSkillName(pokemon);
	const skillLevel = pokemon.iv.skillLevel;

	// Energy for Everyone S系のスキルかチェック
	const e4eSkills: MainSkillName[] = [
		"Energy for Everyone S",
		"Energy for Everyone S (Lunar Blessing)",
		"Energy for Everyone S (Berry Juice)",
	];

	if (e4eSkills.includes(skillName)) {
		const recoveryPerTrigger = getSkillValue(skillName, skillLevel);
		return {
			skillName,
			energyRecoveryForTeam: recoveryPerTrigger * skillTriggerCount,
		};
	}

	return {
		skillName,
		energyRecoveryForTeam: 0,
	};
}
