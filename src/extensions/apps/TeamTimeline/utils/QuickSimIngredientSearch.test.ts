import { describe, expect, it } from "vitest";
import {
	type IngredientName,
	IngredientNames,
} from "../../../../data/pokemons";
import {
	type CookingSimulationSettings,
	createDefaultCookingSettings,
} from "../types/CookingTypes";
import {
	QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
	type QuickSimIngredientEvaluation,
	type QuickSimIngredientEvaluator,
	type QuickSimIngredientSearchSettings,
	type QuickSimIngredientStock,
	type QuickSimOptimizerEvaluateOptions,
	type QuickSimOptimizerPercents,
	type QuickSimOptimizerProgress,
} from "../types/QuickSimOptimizerTypes";
import {
	buildIngredientSearchSpace,
	isWithinIngredientSpace,
	type QuickSimIngredientSearchSpace,
	stockKey,
	unitsToStock,
} from "./QuickSimIngredientCandidates";
import {
	resolveIngredientSearchSpace,
	runIngredientSearch,
} from "./QuickSimIngredientSearch";
import {
	isQuickSimOptimizerAbortError,
	SearchController,
} from "./QuickSimOptimizerSearchCommon";

/**
 * 決定的な擬似目的関数。
 * 食材ごとの価値 × 個数の和に、「トマト 60 以上かつコーヒー 30 以上」で解放される
 * ボーナスを足す（1 単位の移動だけでは到達しにくい相乗効果）。
 */
const VALUE_PER_COUNT: Partial<Record<IngredientName, number>> = {
	apple: 100,
	milk: 90,
	soy: 70,
	tomato: 60,
	coffee: 50,
};
const SYNERGY_BONUS = 8000;

function indexOf(name: IngredientName): number {
	return IngredientNames.indexOf(name);
}

function noiselessObjective(stock: QuickSimIngredientStock): number {
	let total = 0;
	IngredientNames.forEach((name, index) => {
		total += (VALUE_PER_COUNT[name] ?? 0) * stock[index];
	});
	if (stock[indexOf("tomato")] >= 60 && stock[indexOf("coffee")] >= 30) {
		total += SYNERGY_BONUS;
	}
	return total;
}

function hashString(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return hash;
}

function noise(stock: QuickSimIngredientStock, seed: number): number {
	const hash = hashString(`${stockKey(stock)}#${seed}`);
	return ((hash % 20001) / 10000 - 1) * 0.01;
}

class FakeIngredientEvaluator implements QuickSimIngredientEvaluator {
	readonly calls: {
		percents: QuickSimOptimizerPercents;
		stocks: QuickSimIngredientStock[];
		seeds: number[];
		options: QuickSimOptimizerEvaluateOptions;
	}[] = [];

	async evaluateIngredients(
		percents: QuickSimOptimizerPercents,
		stocks: readonly QuickSimIngredientStock[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): Promise<QuickSimIngredientEvaluation[]> {
		this.calls.push({
			percents: [...percents],
			stocks: stocks.map((stock) => [...stock]),
			seeds: [...seeds],
			options,
		});
		const excluded = percents.every((percent) => percent <= 0);
		const results = stocks.map((stock) => {
			const base = noiselessObjective(stock);
			return {
				stock: [...stock],
				epBySeed: excluded
					? []
					: seeds.map((seed) => base * (1 + noise(stock, seed))),
				excluded,
			};
		});
		onProgress?.(seeds.length, seeds.length);
		return results;
	}
}

const SETTINGS: QuickSimIngredientSearchSettings = {
	totalCount: 180,
	maxCountByIngredient: {
		apple: 90,
		milk: 90,
		tomato: 90,
		coffee: 60,
		soy: 60,
	},
};

function createCookingSettings(
	overrides: Partial<CookingSimulationSettings> = {},
): CookingSimulationSettings {
	return {
		...createDefaultCookingSettings(),
		enabled: true,
		category: "curry",
		initialIngredients: { apple: 45, honey: 10 },
		...overrides,
	};
}

function bruteForceBest(space: QuickSimIngredientSearchSpace): number[] {
	let best: number[] | null = null;
	let bestValue = Number.NEGATIVE_INFINITY;
	const current: number[] = [];
	const visit = (position: number, remaining: number): void => {
		if (position === space.ingredientIndexes.length) {
			if (remaining !== 0) {
				return;
			}
			const value = noiselessObjective(unitsToStock(current, space));
			if (value > bestValue) {
				bestValue = value;
				best = unitsToStock(current, space);
			}
			return;
		}
		const limit = Math.min(space.maxUnits[position], remaining);
		for (let units = 0; units <= limit; units++) {
			current.push(units);
			visit(position + 1, remaining - units);
			current.pop();
		}
	};
	visit(0, space.totalUnits);
	if (best === null) {
		throw new Error("no candidate");
	}
	return best;
}

const PERCENTS = [100, 100, 100, 100, 60, 40];

function createInput(
	evaluator: FakeIngredientEvaluator,
	overrides: {
		cookingSettings?: CookingSimulationSettings;
		settings?: QuickSimIngredientSearchSettings;
		percents?: number[];
		controller?: SearchController;
	} = {},
) {
	return {
		percents: overrides.percents ?? PERCENTS,
		cookingSettings: overrides.cookingSettings ?? createCookingSettings(),
		settings: overrides.settings ?? SETTINGS,
		evaluator,
		controller: overrides.controller ?? new SearchController({ baseSeed: 500 }),
		excludeSleepSwaps: false,
		percentRange: [10, 70] as const,
	};
}

describe("runIngredientSearch", () => {
	it("finds the brute-force optimum, including the two-ingredient synergy", async () => {
		const evaluator = new FakeIngredientEvaluator();
		const progress: QuickSimOptimizerProgress[] = [];
		const controller = new SearchController({
			baseSeed: 500,
			onProgress: (value) => progress.push(value),
		});
		const { space, records } = await runIngredientSearch(
			createInput(evaluator, { controller }),
		);
		expect(space.effectiveTotalCount).toBe(180);
		const expected = bruteForceBest(space);
		expect(records[0].stock).toEqual(expected);
		expect(records[0].stock[indexOf("tomato")]).toBe(60);
		expect(records[0].stock[indexOf("coffee")]).toBe(30);
		expect(records[0].stock[indexOf("apple")]).toBe(90);
		for (const record of records) {
			expect(record.epBySeed.length).toBeGreaterThanOrEqual(
				QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
			);
			expect(isWithinIngredientSpace(record.units, space)).toBe(true);
			expect(record.stock.reduce((sum, count) => sum + count, 0)).toBe(180);
		}
		for (let index = 1; index < records.length; index++) {
			const mean = (values: number[]) =>
				values
					.slice(0, QUICK_SIM_OPTIMIZER_SEARCH_TRIALS)
					.reduce((sum, value) => sum + value, 0);
			expect(mean(records[index].epBySeed)).toBeLessThanOrEqual(
				mean(records[index - 1].epBySeed),
			);
		}
		// 進捗は割り当てられた範囲の中で単調に進む
		expect(progress[0].percent).toBeGreaterThanOrEqual(10);
		expect(progress[progress.length - 1].percent).toBeLessThanOrEqual(70);
		expect(progress[progress.length - 1].phase).toBe("ingredientSearch");
		for (let index = 1; index < progress.length; index++) {
			expect(progress[index].percent).toBeGreaterThanOrEqual(
				progress[index - 1].percent,
			);
		}
		expect(new Set(progress.map((value) => value.phase))).toEqual(
			new Set(["ingredientStart", "ingredientSearch"]),
		);
	});

	it("only evaluates stocks inside the space and never re-runs a seed", async () => {
		const evaluator = new FakeIngredientEvaluator();
		const { space } = await runIngredientSearch(createInput(evaluator));
		const seedsByStock = new Map<string, number[]>();
		for (const call of evaluator.calls) {
			expect(call.percents).toEqual(PERCENTS);
			for (const stock of call.stocks) {
				expect(stock).toHaveLength(IngredientNames.length);
				expect(stock.reduce((sum, count) => sum + count, 0)).toBe(
					space.effectiveTotalCount,
				);
				IngredientNames.forEach((name, index) => {
					expect(stock[index]).toBeLessThanOrEqual(
						SETTINGS.maxCountByIngredient[name] ?? 0,
					);
					expect(stock[index] % 30).toBe(0);
				});
				const key = stockKey(stock);
				const seen = seedsByStock.get(key) ?? [];
				for (const seed of call.seeds) {
					expect(seen).not.toContain(seed);
					seen.push(seed);
				}
				seedsByStock.set(key, seen);
			}
		}
		for (const seeds of seedsByStock.values()) {
			expect(seeds).toEqual(seeds.map((_, index) => 500 + index));
		}
	});

	it("floors the total to the step and clamps it to the caps", async () => {
		const evaluator = new FakeIngredientEvaluator();
		const { space } = await runIngredientSearch(
			createInput(evaluator, {
				settings: { ...SETTINGS, totalCount: 200 },
			}),
		);
		expect(space.effectiveTotalCount).toBe(180);
		const clamped = await runIngredientSearch(
			createInput(new FakeIngredientEvaluator(), {
				settings: {
					totalCount: 800,
					maxCountByIngredient: { apple: 60, milk: 30 },
				},
			}),
		);
		expect(clamped.space.effectiveTotalCount).toBe(90);
		expect(clamped.records).toHaveLength(1);
	});

	it("rejects when cooking is disabled or nothing can be searched", async () => {
		expect(() =>
			resolveIngredientSearchSpace(
				createCookingSettings({ enabled: false }),
				SETTINGS,
			),
		).toThrow();
		expect(() =>
			resolveIngredientSearchSpace(createCookingSettings(), {
				totalCount: 800,
				maxCountByIngredient: {},
			}),
		).toThrow();
		expect(() =>
			resolveIngredientSearchSpace(createCookingSettings(), {
				totalCount: 20,
				maxCountByIngredient: { apple: 300 },
			}),
		).toThrow();
		await expect(
			runIngredientSearch(
				createInput(new FakeIngredientEvaluator(), {
					cookingSettings: createCookingSettings({ enabled: false }),
				}),
			),
		).rejects.toThrow();
	});

	it("rejects when the fixed usage cannot be scheduled", async () => {
		await expect(
			runIngredientSearch(
				createInput(new FakeIngredientEvaluator(), {
					percents: [0, 0, 0, 0, 0, 0],
				}),
			),
		).rejects.toThrow(/cannot be scheduled/);
	});

	it("stops with an abort error when the signal is aborted", async () => {
		const abort = new AbortController();
		const controller = new SearchController({
			baseSeed: 1,
			signal: abort.signal,
			onProgress: (value) => {
				if (value.phase === "ingredientSearch") {
					abort.abort();
				}
			},
		});
		await expect(
			runIngredientSearch(
				createInput(new FakeIngredientEvaluator(), { controller }),
			),
		).rejects.toSatisfy((error: unknown) =>
			isQuickSimOptimizerAbortError(error),
		);
	});

	it("exposes the space used for the search", () => {
		const space = buildIngredientSearchSpace(
			SETTINGS.totalCount,
			SETTINGS.maxCountByIngredient,
		);
		expect(space?.ingredientIndexes).toHaveLength(5);
		expect(space?.totalUnits).toBe(6);
	});
});
