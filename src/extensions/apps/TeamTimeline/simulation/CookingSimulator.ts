import type { IngredientName } from "../../../../data/pokemons";
import { ingredientStrength } from "../../../../util/PokemonRp";
import { recipeLevelBonus } from "../../../../util/PokemonStrength";
import { getRecipesByCategory } from "../data/RecipeData";
import {
	BASE_GREAT_SUCCESS_CHANCE,
	type CookingBagIngredientSnapshotEntry,
	type CookingCategory,
	type CookingEventResult,
	type CookingIngredientUsage,
	DEFAULT_RECIPE_LEVEL,
	type IngredientBag,
	type LeftoverIngredients,
	type PokemonCookingAttribution,
	type RecipeDefinition,
} from "../types/CookingTypes";
import type { MealType } from "../types/TimeSlotTypes";
import type { SeededRandom } from "./SeededRandom";

const BAG_COUNT_EPSILON = 1e-9;

/**
 * レシピ選択の結果
 */
interface SelectedRecipe {
	recipe: RecipeDefinition;
	eBase: number;
	eDisplay: number;
	eFinal: number;
}

/**
 * executeMealCooking のパラメータ
 */
interface ExecuteMealCookingParams {
	bag: IngredientBag;
	category: CookingCategory;
	recipeLevels: Record<string, number>;
	basePotCapacity: number;
	isGoodCampTicket: boolean;
	cookingPowerUpBonus: number;
	tastyChanceAccumulated: number;
	fieldBonus: number;
	eventBonus: number;
	disabledRecipes?: ReadonlySet<string>;
	random: SeededRandom;
	mealSlotId: string;
	mealType: MealType;
}

/**
 * executeMealCooking の戻り値
 */
interface ExecuteMealCookingResult {
	result: CookingEventResult;
	newTastyChanceAccumulated: number;
}

export interface PlannedExtraIngredient {
	name: IngredientName;
	count: number;
}

type IngredientCountMap = Map<IngredientName, number>;

const EXTRA_INGREDIENT_PRIORITY: readonly IngredientName[] = Object.entries(
	ingredientStrength,
)
	.filter(([, strength]) => strength > 0)
	.sort(([nameA, strengthA], [nameB, strengthB]) => {
		if (strengthB !== strengthA) {
			return strengthB - strengthA;
		}
		return nameA.localeCompare(nameB);
	})
	.map(([name]) => name as IngredientName);

/**
 * 初期食材から食材バッグを作成する
 *
 * ユーザーが設定した初期食材を元に、シミュレーション用の食材バッグを初期化する。
 * 各食材について pokemonSources は空の Map、initialCount にユーザー設定値を格納する。
 *
 * @param initialIngredients ユーザー設定の初期食材マップ
 * @returns 初期化された食材バッグ
 */
export function createIngredientBag(
	initialIngredients: Partial<Record<IngredientName, number>>,
): IngredientBag {
	const bag: IngredientBag = new Map();

	for (const [name, count] of Object.entries(initialIngredients)) {
		if (count != null && count > 0) {
			bag.set(name as IngredientName, {
				pokemonSources: new Map(),
				initialCount: count,
			});
		}
	}

	return bag;
}

/**
 * ポケモンが収集した食材をバッグに追加する
 *
 * 指定されたポケモンIDの食材をバッグに追加し、出典を記録する。
 * バッグはミュータブルなランタイム状態として直接変更される。
 *
 * @param bag 食材バッグ（直接変更される）
 * @param pokemonId 食材を収集したポケモンのID
 * @param ingredients 追加する食材リスト
 */
export function addIngredientsToBag(
	bag: IngredientBag,
	pokemonId: number,
	ingredients: readonly { name: IngredientName; count: number }[],
): void {
	for (const { name, count } of ingredients) {
		let entry = bag.get(name);
		if (entry == null) {
			entry = { pokemonSources: new Map(), initialCount: 0 };
			bag.set(name, entry);
		}
		const current = entry.pokemonSources.get(pokemonId) ?? 0;
		entry.pokemonSources.set(pokemonId, current + count);
	}
}

/**
 * 有効鍋容量を計算する
 *
 * 基礎容量にキャンプチケット倍率と料理パワーアップボーナスを適用する。
 *
 * @param basePotCapacity 鍋の基礎容量
 * @param isGoodCampTicket おこうグッドキャンプチケット使用中かどうか
 * @param cookingPowerUpBonus 料理パワーアップスキルによる追加容量
 * @returns 有効鍋容量
 */
export function calculateEffectivePotCapacity(
	basePotCapacity: number,
	isGoodCampTicket: boolean,
	cookingPowerUpBonus: number,
): number {
	return (
		Math.round(basePotCapacity * (isGoodCampTicket ? 1.5 : 1)) +
		cookingPowerUpBonus
	);
}

/**
 * バッグ内の食材の合計数を取得する
 *
 * @param bag 食材バッグ
 * @param name 食材名
 * @returns バッグ内の合計数（ポケモン由来 + 初期食材）
 */
export function getAvailableIngredientCount(
	bag: IngredientBag,
	name: IngredientName,
): number {
	const entry = bag.get(name);
	if (entry == null) return 0;

	let pokemonTotal = 0;
	for (const count of entry.pokemonSources.values()) {
		pokemonTotal += count;
	}
	return pokemonTotal + entry.initialCount;
}

function snapshotToCountMap(
	snapshot: readonly CookingBagIngredientSnapshotEntry[] | undefined,
): IngredientCountMap {
	const map: IngredientCountMap = new Map();
	if (!snapshot) {
		return map;
	}
	for (const ingredient of snapshot) {
		if (ingredient.count > BAG_COUNT_EPSILON) {
			map.set(ingredient.name, ingredient.count);
		}
	}
	return map;
}

function usagesToCountMap(
	usages: readonly CookingIngredientUsage[],
): IngredientCountMap {
	const map: IngredientCountMap = new Map();
	for (const usage of usages) {
		map.set(usage.name, (map.get(usage.name) ?? 0) + usage.count);
	}
	return map;
}

/**
 * 各料理イベントの鍋空きに投入する追加食材を計画する
 *
 * ルール:
 * - その料理時点で所持していた食材のみを使用する
 * - 未来のベース料理成立を壊さない（時系列制約）
 * - 食材の基礎エナジーが高い順で投入
 */
export function planExtraIngredientsByEvent(
	events: readonly CookingEventResult[],
	options?: {
		excludedIngredientNames?: ReadonlySet<IngredientName>;
	},
): readonly PlannedExtraIngredient[][] {
	if (events.length === 0) {
		return [];
	}

	const slacks: IngredientCountMap[] = events.map((event) => {
		const before = snapshotToCountMap(event.bagIngredientsBeforeCooking);
		const demand = usagesToCountMap(event.ingredientsUsed);
		const ingredientNames = new Set<IngredientName>([
			...before.keys(),
			...demand.keys(),
		]);

		const slackMap: IngredientCountMap = new Map();
		for (const name of ingredientNames) {
			const slack = (before.get(name) ?? 0) - (demand.get(name) ?? 0);
			if (slack > BAG_COUNT_EPSILON) {
				slackMap.set(name, slack);
			}
		}
		return slackMap;
	});

	const minSuffixSlack: IngredientCountMap[] = new Array(events.length);
	for (let i = events.length - 1; i >= 0; i--) {
		const current = slacks[i] ?? new Map();
		if (i === events.length - 1) {
			minSuffixSlack[i] = new Map(current);
			continue;
		}

		const next = minSuffixSlack[i + 1] ?? new Map();
		const mergedNames = new Set<IngredientName>([
			...current.keys(),
			...next.keys(),
		]);
		const merged: IngredientCountMap = new Map();
		for (const name of mergedNames) {
			const currentSlack = current.get(name) ?? 0;
			const nextSlack = next.get(name) ?? 0;
			const minSlack = Math.min(currentSlack, nextSlack);
			if (minSlack > BAG_COUNT_EPSILON) {
				merged.set(name, minSlack);
			}
		}
		minSuffixSlack[i] = merged;
	}

	const consumedPrefix: IngredientCountMap = new Map();
	const plan: PlannedExtraIngredient[][] = [];
	const excludedIngredientNames = options?.excludedIngredientNames;

	for (let i = 0; i < events.length; i++) {
		const event = events[i];
		let remainingPotCapacity = event.remainingPotCapacity;
		const allocation: PlannedExtraIngredient[] = [];

		if (remainingPotCapacity <= BAG_COUNT_EPSILON) {
			plan.push(allocation);
			continue;
		}

		const currentSlack = slacks[i] ?? new Map();
		const currentMinSuffix = minSuffixSlack[i] ?? new Map();

		for (const ingredientName of EXTRA_INGREDIENT_PRIORITY) {
			if (remainingPotCapacity <= BAG_COUNT_EPSILON) {
				break;
			}
			if (excludedIngredientNames?.has(ingredientName)) {
				continue;
			}

			const alreadyConsumed = consumedPrefix.get(ingredientName) ?? 0;
			const byCurrent =
				(currentSlack.get(ingredientName) ?? 0) - alreadyConsumed;
			const byFuture =
				(currentMinSuffix.get(ingredientName) ?? 0) - alreadyConsumed;
			const allocatable = Math.min(byCurrent, byFuture, remainingPotCapacity);

			if (allocatable <= BAG_COUNT_EPSILON) {
				continue;
			}

			allocation.push({
				name: ingredientName,
				count: allocatable,
			});
			consumedPrefix.set(ingredientName, alreadyConsumed + allocatable);
			remainingPotCapacity -= allocatable;
		}

		plan.push(allocation);
	}

	return plan;
}

/**
 * 料理実行直前のバッグ内食材の内訳をスナップショットする
 *
 * @param bag 食材バッグ
 * @returns 食材ごとの総数（0より大きいもののみ）
 */
export function createBagIngredientSnapshot(
	bag: IngredientBag,
): CookingBagIngredientSnapshotEntry[] {
	const snapshot: CookingBagIngredientSnapshotEntry[] = [];

	for (const [name, entry] of bag) {
		let totalCount = entry.initialCount;
		for (const count of entry.pokemonSources.values()) {
			totalCount += count;
		}
		if (totalCount > BAG_COUNT_EPSILON) {
			snapshot.push({
				name,
				count: totalCount,
			});
		}
	}

	return snapshot;
}

/**
 * 最適なレシピを選択する
 *
 * 指定カテゴリのレシピの中から、鍋容量と食材の制約を満たし、
 * 最終EPが最も高いレシピを選択する。
 *
 * @param category 料理カテゴリ
 * @param bag 食材バッグ
 * @param effectivePotCapacity 有効鍋容量
 * @param recipeLevels レシピ名ごとのレベル
 * @param fieldBonus フィールドボーナス（%）
 * @param eventBonus イベントボーナス（%）
 * @returns 最適なレシピと計算結果、作れるレシピがない場合はnull
 */
export function selectBestRecipe(
	category: CookingCategory,
	bag: IngredientBag,
	effectivePotCapacity: number,
	recipeLevels: Record<string, number>,
	fieldBonus: number,
	eventBonus: number,
	disabledRecipes?: ReadonlySet<string>,
): SelectedRecipe | null {
	const recipes = getRecipesByCategory(category);
	let bestResult: SelectedRecipe | null = null;

	for (const recipe of recipes) {
		if (disabledRecipes?.has(recipe.name)) {
			continue;
		}

		// 食材総数が鍋容量以下であることを確認
		const totalIngredientCount = recipe.ingredients.reduce(
			(sum, ing) => sum + ing.count,
			0,
		);
		if (totalIngredientCount > effectivePotCapacity) {
			continue;
		}

		// バッグに十分な食材があることを確認
		let feasible = true;
		for (const ing of recipe.ingredients) {
			if (getAvailableIngredientCount(bag, ing.name) < ing.count) {
				feasible = false;
				break;
			}
		}
		if (!feasible) {
			continue;
		}

		// EP計算
		const rawStrength = recipe.ingredients.reduce(
			(sum, ing) => sum + ingredientStrength[ing.name] * ing.count,
			0,
		);
		const eBase = Math.round(rawStrength * (1 + recipe.recipeBonus));
		const level = recipeLevels[recipe.name] ?? DEFAULT_RECIPE_LEVEL;
		const levelBonus = recipeLevelBonus[Math.min(level, 65)] ?? 0;
		const eDisplay = eBase + Math.round((eBase * levelBonus) / 100);
		const eFinal = Math.round(
			eDisplay * (1 + fieldBonus / 100) * (1 + eventBonus / 100),
		);

		if (bestResult == null || eFinal > bestResult.eFinal) {
			bestResult = { recipe, eBase, eDisplay, eFinal };
		}
	}

	return bestResult;
}

/**
 * バッグから食材を消費する
 *
 * レシピに必要な食材をバッグから差し引き、各食材の使用内訳を記録する。
 * ポケモン由来の食材を優先的に消費し、不足分は初期食材から補う。
 * ポケモン由来の食材が十分な場合は、各ポケモンから比例配分で消費する。
 *
 * @param bag 食材バッグ（直接変更される）
 * @param recipe 作成するレシピ
 * @returns 各食材の使用内訳
 */
export function deductIngredientsFromBag(
	bag: IngredientBag,
	recipe: RecipeDefinition,
): CookingIngredientUsage[] {
	return deductIngredientCountsFromBag(
		bag,
		recipe.ingredients.map((ingredient) => ({
			name: ingredient.name,
			count: ingredient.count,
		})),
	);
}

function deductIngredientFromBag(
	bag: IngredientBag,
	name: IngredientName,
	required: number,
): CookingIngredientUsage {
	const entry = bag.get(name);
	if (entry == null) {
		return {
			name,
			count: required,
			pokemonAttribution: new Map(),
			fromInitial: required,
		};
	}

	let pokemonTotal = 0;
	for (const c of entry.pokemonSources.values()) {
		pokemonTotal += c;
	}

	const pokemonAttribution = new Map<number, number>();
	let fromInitial = 0;

	if (pokemonTotal >= required) {
		for (const [pokemonId, pokemonCount] of entry.pokemonSources) {
			const ratio = pokemonCount / pokemonTotal;
			const deduction = required * ratio;
			pokemonAttribution.set(pokemonId, deduction);
			entry.pokemonSources.set(pokemonId, pokemonCount - deduction);
		}
	} else {
		for (const [pokemonId, pokemonCount] of entry.pokemonSources) {
			pokemonAttribution.set(pokemonId, pokemonCount);
			entry.pokemonSources.set(pokemonId, 0);
		}
		fromInitial = required - pokemonTotal;
		entry.initialCount -= fromInitial;
	}

	return {
		name,
		count: required,
		pokemonAttribution,
		fromInitial,
	};
}

export function deductIngredientCountsFromBag(
	bag: IngredientBag,
	ingredientCounts: readonly { name: IngredientName; count: number }[],
): CookingIngredientUsage[] {
	const usages: CookingIngredientUsage[] = [];

	for (const { name, count } of ingredientCounts) {
		if (count <= BAG_COUNT_EPSILON) {
			continue;
		}
		usages.push(deductIngredientFromBag(bag, name, count));
	}

	return usages;
}

/**
 * 1回の食事の料理シミュレーションを実行する
 *
 * 最適レシピの選択、食材の消費、大成功判定を行い、料理結果を返す。
 *
 * @param params 料理実行パラメータ
 * @returns 料理結果と更新された大成功蓄積確率
 */
export function executeMealCooking(
	params: ExecuteMealCookingParams,
): ExecuteMealCookingResult {
	const {
		bag,
		category,
		recipeLevels,
		basePotCapacity,
		isGoodCampTicket,
		cookingPowerUpBonus,
		tastyChanceAccumulated,
		fieldBonus,
		eventBonus,
		disabledRecipes,
		random,
		mealSlotId,
		mealType,
	} = params;

	const effectivePotCapacity = calculateEffectivePotCapacity(
		basePotCapacity,
		isGoodCampTicket,
		cookingPowerUpBonus,
	);
	const bagIngredientsBeforeCooking = createBagIngredientSnapshot(bag);

	const selected = selectBestRecipe(
		category,
		bag,
		effectivePotCapacity,
		recipeLevels,
		fieldBonus,
		eventBonus,
		disabledRecipes,
	);

	// 作れるレシピがない場合はスキップ結果を返す
	if (selected == null) {
		const tastyChancePercent =
			BASE_GREAT_SUCCESS_CHANCE + tastyChanceAccumulated;
		const isGreatSuccess = random.chance(tastyChancePercent / 100);
		const newTastyChanceAccumulated = isGreatSuccess
			? 0
			: tastyChanceAccumulated;
		const result: CookingEventResult = {
			mealSlotId,
			mealType,
			recipeName: null,
			isGreatSuccess,
			cookingEP: 0,
			eBase: 0,
			eDisplay: 0,
			eFinal: 0,
			ingredientsUsed: [],
			extraIngredientsUsed: [],
			remainingPotCapacity: effectivePotCapacity,
			effectivePotCapacity,
			tastyChancePercent,
			cookingPowerUpBonusUsed: cookingPowerUpBonus,
			bagIngredientsBeforeCooking,
		};
		return { result, newTastyChanceAccumulated };
	}

	// 食材を消費
	const ingredientsUsed = deductIngredientsFromBag(bag, selected.recipe);

	// 鍋の残り容量を計算
	const totalIngredientCount = selected.recipe.ingredients.reduce(
		(sum, ing) => sum + ing.count,
		0,
	);
	const remainingPotCapacity = effectivePotCapacity - totalIngredientCount;

	// 大成功判定
	const tastyChancePercent = BASE_GREAT_SUCCESS_CHANCE + tastyChanceAccumulated;
	const isGreatSuccess = random.chance(tastyChancePercent / 100);

	// 最終EP計算（大成功は2倍）
	const cookingEP = isGreatSuccess ? selected.eFinal * 2 : selected.eFinal;

	// 大成功蓄積の更新（成功したらリセット）
	const newTastyChanceAccumulated = isGreatSuccess ? 0 : tastyChanceAccumulated;

	const result: CookingEventResult = {
		mealSlotId,
		mealType,
		recipeName: selected.recipe.name,
		isGreatSuccess,
		cookingEP,
		eBase: selected.eBase,
		eDisplay: selected.eDisplay,
		eFinal: selected.eFinal,
		ingredientsUsed,
		extraIngredientsUsed: [],
		remainingPotCapacity,
		effectivePotCapacity,
		tastyChancePercent,
		cookingPowerUpBonusUsed: cookingPowerUpBonus,
		bagIngredientsBeforeCooking,
	};

	return { result, newTastyChanceAccumulated };
}

/**
 * シミュレーション終了後の残り食材を集計する
 *
 * バッグ内の全食材をポケモン別・初期食材別・合計に分類して返す。
 *
 * @param bag 食材バッグ（シミュレーション終了時の状態）
 * @returns 残り食材の集計結果
 */
export function computeLeftoverIngredients(
	bag: IngredientBag,
): LeftoverIngredients {
	const byPokemon = new Map<number, Partial<Record<IngredientName, number>>>();
	const initialRemaining: Partial<Record<IngredientName, number>> = {};
	const total: Partial<Record<IngredientName, number>> = {};

	for (const [ingredientName, entry] of bag) {
		// ポケモン別の残り
		for (const [pokemonId, count] of entry.pokemonSources) {
			if (count > 0) {
				let pokemonRecord = byPokemon.get(pokemonId);
				if (pokemonRecord == null) {
					pokemonRecord = {};
					byPokemon.set(pokemonId, pokemonRecord);
				}
				pokemonRecord[ingredientName] =
					(pokemonRecord[ingredientName] ?? 0) + count;

				// 合計に加算
				total[ingredientName] = (total[ingredientName] ?? 0) + count;
			}
		}

		// 初期食材の残り
		if (entry.initialCount > 0) {
			initialRemaining[ingredientName] =
				(initialRemaining[ingredientName] ?? 0) + entry.initialCount;
			total[ingredientName] = (total[ingredientName] ?? 0) + entry.initialCount;
		}
	}

	return { byPokemon, initialRemaining, total };
}

/**
 * ポケモンごとの料理EP帰属を計算する
 *
 * 各料理イベントで使用された食材から、各ポケモンがどれだけのEPに貢献したかを
 * 食材エナジーの比率で帰属計算する。
 *
 * @param events 料理イベント結果の配列
 * @returns ポケモンごとの料理EP帰属リスト
 */
export function computePokemonCookingAttributions(
	events: readonly CookingEventResult[],
): PokemonCookingAttribution[] {
	const attributionMap = new Map<number, number>();

	for (const event of events) {
		const allUsages = [
			...event.ingredientsUsed,
			...(event.extraIngredientsUsed ?? []),
		];
		if (event.cookingEP === 0 || allUsages.length === 0) {
			continue;
		}

		// このイベントの食材エナジー合計を計算
		let totalIngredientStrength = 0;
		for (const usage of allUsages) {
			totalIngredientStrength += ingredientStrength[usage.name] * usage.count;
		}

		if (totalIngredientStrength === 0) {
			continue;
		}

		// 各ポケモンの貢献度を計算
		for (const usage of allUsages) {
			const unitStrength = ingredientStrength[usage.name];

			for (const [pokemonId, pokemonCount] of usage.pokemonAttribution) {
				const pokemonContribution = unitStrength * pokemonCount;
				const pokemonEP =
					event.cookingEP * (pokemonContribution / totalIngredientStrength);

				const current = attributionMap.get(pokemonId) ?? 0;
				attributionMap.set(pokemonId, current + pokemonEP);
			}
		}
	}

	// Map を配列に変換
	const attributions: PokemonCookingAttribution[] = [];
	for (const [pokemonId, attributedCookingEP] of attributionMap) {
		attributions.push({ pokemonId, attributedCookingEP });
	}

	return attributions;
}

/**
 * 初期食材由来の料理EP合計を計算する
 *
 * 各料理イベントで使われた食材のうち、初期食材から消費した割合を
 * 食材エナジー比で算出し、料理EPへ按分する。
 *
 * @param events 料理イベント結果の配列
 * @returns 初期食材由来EP合計
 */
export function computeInitialIngredientAttributedEP(
	events: readonly CookingEventResult[],
): number {
	let totalInitialIngredientEP = 0;

	for (const event of events) {
		const allUsages = [
			...event.ingredientsUsed,
			...(event.extraIngredientsUsed ?? []),
		];
		if (event.cookingEP === 0 || allUsages.length === 0) {
			continue;
		}

		let totalIngredientStrength = 0;
		let initialIngredientStrength = 0;
		for (const usage of allUsages) {
			const unitStrength = ingredientStrength[usage.name];
			totalIngredientStrength += unitStrength * usage.count;
			initialIngredientStrength += unitStrength * usage.fromInitial;
		}

		if (totalIngredientStrength === 0 || initialIngredientStrength <= 0) {
			continue;
		}

		totalInitialIngredientEP +=
			event.cookingEP * (initialIngredientStrength / totalIngredientStrength);
	}

	return totalInitialIngredientEP;
}
