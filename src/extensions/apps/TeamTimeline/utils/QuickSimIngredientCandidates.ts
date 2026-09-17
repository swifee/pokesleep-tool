/**
 * QuickSimIngredientCandidates.ts
 * 初期食材の最適化の候補（探索対象の食材ごとの単位数）を扱う純粋関数。
 *
 * - 1 単位 = 刻み（30 個）。候補は「対象の食材ごとに 0〜上限単位、合計は決められた単位数ちょうど」。
 *   在庫が増えて EP が下がることはほぼないので、合計は上限いっぱいに固定する（起用率の 500% と同じ考え方）。
 * - 開始点はレシピごとの比例配分（同時に複数の食材を足さないと解放されないレシピを 1 単位の
 *   移動で見つけるのは難しいため）、補充食材（鍋の空き埋め）への全振り、現在の設定の 3 種類。
 * - 局所探索の近傍は「1 単位の移動」と「2 食材の入れ替え」。
 */

import {
	type IngredientName,
	IngredientNames,
} from "../../../../data/pokemons";
import { ingredientStrength } from "../../../../util/PokemonRp";
import { getRecipesByCategory } from "../data/RecipeData";
import type {
	CookingSimulationSettings,
	RecipeDefinition,
} from "../types/CookingTypes";
import {
	QUICK_SIM_INGREDIENT_STEP_COUNT,
	type QuickSimIngredientStock,
} from "../types/QuickSimOptimizerTypes";
import { unitsKey } from "./QuickSimOptimizerCandidates";

/** 候補: 探索対象の食材順（`ingredientIndexes` の順）の単位数 */
export type QuickSimIngredientUnits = readonly number[];

/** 初期食材の探索空間 */
export interface QuickSimIngredientSearchSpace {
	/** 探索対象の食材（`IngredientNames` の index、昇順） */
	ingredientIndexes: number[];
	/** 対象ごとの上限単位数（`ingredientIndexes` と同じ順） */
	maxUnits: number[];
	/** 配分する単位数（合計） */
	totalUnits: number;
	/** 実際に配分する個数（totalUnits × 刻み） */
	effectiveTotalCount: number;
}

/** 個数を単位数に切り捨てる */
export function ingredientCountToUnits(count: number): number {
	if (!Number.isFinite(count) || count <= 0) {
		return 0;
	}
	return Math.floor(count / QUICK_SIM_INGREDIENT_STEP_COUNT);
}

/**
 * 探索空間を作る。上限が 1 単位に満たない食材は対象外。
 * 合計が対象の上限の和を超えるときは和に切り詰める。対象がない、または配分する単位が
 * ないときは null。
 */
export function buildIngredientSearchSpace(
	totalCount: number,
	maxCountByIngredient: Readonly<Partial<Record<IngredientName, number>>>,
): QuickSimIngredientSearchSpace | null {
	const ingredientIndexes: number[] = [];
	const maxUnits: number[] = [];
	IngredientNames.forEach((name, index) => {
		const units = ingredientCountToUnits(maxCountByIngredient[name] ?? 0);
		if (units <= 0) {
			return;
		}
		ingredientIndexes.push(index);
		maxUnits.push(units);
	});
	const capacity = maxUnits.reduce((sum, units) => sum + units, 0);
	const totalUnits = Math.min(ingredientCountToUnits(totalCount), capacity);
	if (ingredientIndexes.length === 0 || totalUnits <= 0) {
		return null;
	}
	return {
		ingredientIndexes,
		maxUnits,
		totalUnits,
		effectiveTotalCount: totalUnits * QUICK_SIM_INGREDIENT_STEP_COUNT,
	};
}

/** 候補が探索空間に収まっているか（合計ちょうど・各上限以内） */
export function isWithinIngredientSpace(
	units: QuickSimIngredientUnits,
	space: QuickSimIngredientSearchSpace,
): boolean {
	if (units.length !== space.ingredientIndexes.length) {
		return false;
	}
	let total = 0;
	for (let position = 0; position < units.length; position++) {
		const value = units[position];
		if (value < 0 || value > space.maxUnits[position]) {
			return false;
		}
		total += value;
	}
	return total === space.totalUnits;
}

/** 単位数を `IngredientNames` 順の個数（19 要素）に変換する */
export function unitsToStock(
	units: QuickSimIngredientUnits,
	space: QuickSimIngredientSearchSpace,
): number[] {
	const stock: number[] = IngredientNames.map(() => 0);
	space.ingredientIndexes.forEach((ingredientIndex, position) => {
		stock[ingredientIndex] =
			(units[position] ?? 0) * QUICK_SIM_INGREDIENT_STEP_COUNT;
	});
	return stock;
}

export function stockKey(stock: QuickSimIngredientStock): string {
	return stock.join(",");
}

export function stockTotal(stock: QuickSimIngredientStock): number {
	return stock.reduce((sum, count) => sum + count, 0);
}

/** 初期食材の設定を `IngredientNames` 順の個数に変換する */
export function initialIngredientsToStock(
	initialIngredients: Readonly<Partial<Record<IngredientName, number>>>,
): number[] {
	return IngredientNames.map((name) => {
		const count = initialIngredients[name];
		return count !== undefined && Number.isFinite(count) && count > 0
			? Math.floor(count)
			: 0;
	});
}

/** 個数を初期食材の設定に変換する。19 種すべてのキーを持つ（適用時に全置換するため） */
export function stockToInitialIngredients(
	stock: QuickSimIngredientStock,
): Partial<Record<IngredientName, number>> {
	const result: Partial<Record<IngredientName, number>> = {};
	IngredientNames.forEach((name, index) => {
		result[name] = stock[index] ?? 0;
	});
	return result;
}

/**
 * 補充（鍋の空き埋め）に向く順の位置（探索空間内の index）。
 * 追加食材として使える食材を強さの高い順に並べ、使わない設定の食材はその後ろに置く。
 * 余った単位を置く先にも使うので、対象のすべての位置を含む。
 */
export function buildFillerOrder(
	space: QuickSimIngredientSearchSpace,
	cookingSettings: CookingSimulationSettings,
): number[] {
	return space.ingredientIndexes
		.map((ingredientIndex, position) => {
			const name = IngredientNames[ingredientIndex];
			return {
				position,
				locked: cookingSettings.disabledExtraIngredients[name] === true,
				strength: ingredientStrength[name] ?? 0,
			};
		})
		.sort((left, right) => {
			if (left.locked !== right.locked) {
				return left.locked ? 1 : -1;
			}
			if (right.strength !== left.strength) {
				return right.strength - left.strength;
			}
			return left.position - right.position;
		})
		.map((entry) => entry.position);
}

/** positions の順に、上限まで remaining 単位を置く。置けなかった単位数を返す */
function allocateUnits(
	units: number[],
	positions: readonly number[],
	remaining: number,
	maxUnits: readonly number[],
): number {
	let rest = remaining;
	for (const position of positions) {
		if (rest <= 0) {
			break;
		}
		const room = maxUnits[position] - units[position];
		if (room <= 0) {
			continue;
		}
		const placed = Math.min(room, rest);
		units[position] += placed;
		rest -= placed;
	}
	return rest;
}

/** positions の順に excess 単位を取り除く。取り除けなかった単位数を返す */
function removeUnits(
	units: number[],
	positions: readonly number[],
	excess: number,
): number {
	let rest = excess;
	for (const position of positions) {
		if (rest <= 0) {
			break;
		}
		const removed = Math.min(units[position], rest);
		units[position] -= removed;
		rest -= removed;
	}
	return rest;
}

/**
 * レシピの食材数に比例して合計単位を配分した開始点（最大剰余法）。
 * 上限を超えた分はレシピ内の他の食材（必要数の多い順）、それでも余れば補充順の食材に置く。
 * レシピの食材が探索対象に 1 つもなければ null。
 */
export function buildRecipeStartUnits(
	recipe: RecipeDefinition,
	space: QuickSimIngredientSearchSpace,
	fillerOrder: readonly number[],
): number[] | null {
	const positionByIngredientIndex = new Map<number, number>();
	space.ingredientIndexes.forEach((ingredientIndex, position) => {
		positionByIngredientIndex.set(ingredientIndex, position);
	});
	const entries = recipe.ingredients.flatMap((ingredient) => {
		const position = positionByIngredientIndex.get(
			IngredientNames.indexOf(ingredient.name),
		);
		return position === undefined
			? []
			: [{ position, count: ingredient.count }];
	});
	if (entries.length === 0) {
		return null;
	}
	const units: number[] = space.ingredientIndexes.map(() => 0);
	const weightTotal = entries.reduce((sum, entry) => sum + entry.count, 0);
	const shares = entries.map(
		(entry) => (space.totalUnits * entry.count) / weightTotal,
	);
	let remaining = space.totalUnits;
	entries.forEach((entry, index) => {
		const whole = Math.floor(shares[index]);
		units[entry.position] = whole;
		remaining -= whole;
	});
	const byRemainder = entries
		.map((entry, index) => ({
			position: entry.position,
			fraction: shares[index] - Math.floor(shares[index]),
		}))
		.sort(
			(left, right) =>
				right.fraction - left.fraction || left.position - right.position,
		);
	for (const { position } of byRemainder) {
		if (remaining <= 0) {
			break;
		}
		units[position] += 1;
		remaining -= 1;
	}
	for (const entry of entries) {
		const excess = units[entry.position] - space.maxUnits[entry.position];
		if (excess > 0) {
			units[entry.position] = space.maxUnits[entry.position];
			remaining += excess;
		}
	}
	const recipeOrder = [...entries]
		.sort(
			(left, right) =>
				right.count - left.count || left.position - right.position,
		)
		.map((entry) => entry.position);
	remaining = allocateUnits(units, recipeOrder, remaining, space.maxUnits);
	allocateUnits(units, fillerOrder, remaining, space.maxUnits);
	return units;
}

/** 補充順の食材に上限まで置いていく開始点（鍋の空き埋めに全振り） */
export function buildFillerStartUnits(
	space: QuickSimIngredientSearchSpace,
	fillerOrder: readonly number[],
): number[] {
	const units: number[] = space.ingredientIndexes.map(() => 0);
	allocateUnits(units, fillerOrder, space.totalUnits, space.maxUnits);
	return units;
}

/**
 * 現在の初期食材を探索空間の格子に丸める。
 * 各食材を単位に四捨五入して上限で切り、合計が多ければ補充順の後ろから減らし、
 * 少なければ補充順の前から足す。
 */
export function snapStockToUnits(
	stock: QuickSimIngredientStock,
	space: QuickSimIngredientSearchSpace,
	fillerOrder: readonly number[],
): number[] {
	const units = space.ingredientIndexes.map((ingredientIndex, position) =>
		Math.min(
			space.maxUnits[position],
			Math.max(
				0,
				Math.round(
					(stock[ingredientIndex] ?? 0) / QUICK_SIM_INGREDIENT_STEP_COUNT,
				),
			),
		),
	);
	const total = units.reduce((sum, value) => sum + value, 0);
	if (total > space.totalUnits) {
		removeUnits(units, [...fillerOrder].reverse(), total - space.totalUnits);
	} else if (total < space.totalUnits) {
		allocateUnits(units, fillerOrder, space.totalUnits - total, space.maxUnits);
	}
	return units;
}

/** 探索の開始点（重複除去済み）。レシピごと → 補充全振り → 現在の設定の順 */
export function buildIngredientStartUnits(
	cookingSettings: CookingSimulationSettings,
	space: QuickSimIngredientSearchSpace,
	currentStock: QuickSimIngredientStock,
): number[][] {
	const fillerOrder = buildFillerOrder(space, cookingSettings);
	const seen = new Set<string>();
	const starts: number[][] = [];
	const offer = (units: number[] | null): void => {
		if (units === null) {
			return;
		}
		const key = unitsKey(units);
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		starts.push(units);
	};
	for (const recipe of getRecipesByCategory(cookingSettings.category)) {
		if (cookingSettings.disabledRecipes[recipe.name] === true) {
			continue;
		}
		offer(buildRecipeStartUnits(recipe, space, fillerOrder));
	}
	offer(buildFillerStartUnits(space, fillerOrder));
	offer(snapStockToUnits(currentStock, space, fillerOrder));
	return starts;
}

/**
 * 局所探索の近傍。
 * - 食材 i の 1 単位を食材 j へ移す（j が上限未満のとき）
 * - 食材 i と j の単位数を入れ替える（どちらも相手の上限以内のとき）
 */
export function generateIngredientNeighborUnits(
	units: QuickSimIngredientUnits,
	maxUnits: readonly number[],
): number[][] {
	const neighbors: number[][] = [];
	const seen = new Set<string>();
	const offer = (candidate: number[]): void => {
		const key = unitsKey(candidate);
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		neighbors.push(candidate);
	};
	for (let from = 0; from < units.length; from++) {
		for (let to = 0; to < units.length; to++) {
			if (from === to) {
				continue;
			}
			if (units[from] >= 1 && units[to] < maxUnits[to]) {
				const moved = [...units];
				moved[from] -= 1;
				moved[to] += 1;
				offer(moved);
			}
			if (
				from < to &&
				units[from] !== units[to] &&
				units[from] <= maxUnits[to] &&
				units[to] <= maxUnits[from]
			) {
				const swapped = [...units];
				swapped[from] = units[to];
				swapped[to] = units[from];
				offer(swapped);
			}
		}
	}
	return neighbors;
}
