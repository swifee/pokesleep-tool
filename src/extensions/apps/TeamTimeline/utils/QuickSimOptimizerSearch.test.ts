import { describe, expect, it } from "vitest";
import { IngredientNames } from "../../../../data/pokemons";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import {
	QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
	QUICK_SIM_OPTIMIZER_JOINT_USAGE_CANDIDATES,
	QUICK_SIM_OPTIMIZER_RESULT_COUNT,
	QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
	type QuickSimCandidateEvaluation,
	type QuickSimIngredientEvaluation,
	type QuickSimIngredientEvaluator,
	type QuickSimIngredientStock,
	type QuickSimOptimizerEvaluateOptions,
	type QuickSimOptimizerEvaluator,
	type QuickSimOptimizerMember,
	type QuickSimOptimizerPercents,
	type QuickSimOptimizerProgress,
} from "../types/QuickSimOptimizerTypes";
import { QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT } from "../types/QuickSimTypes";
import {
	initialIngredientsToStock,
	stockKey,
} from "./QuickSimIngredientCandidates";
import { percentsKey } from "./QuickSimOptimizerCandidates";
import {
	isQuickSimOptimizerAbortError,
	runQuickSimOptimization,
} from "./QuickSimOptimizerSearch";

/**
 * 決定的な擬似目的関数。
 * メンバー i の起用率 p の単独 EP は weight_i × (p − p² / 400)（逓減）。
 * 全員合わせたときは「20% のメンバーがいると 1 人あたり 2% 減る」相互作用を足す。
 * 試行ごとのノイズはシードと候補から決まる（同じ候補・同じシードなら同じ値）。
 */
const WEIGHTS = [100, 90, 80, 70, 60, 50];

function soloValue(memberIndex: number, percent: number): number {
	return WEIGHTS[memberIndex] * (percent - (percent * percent) / 400);
}

function noiselessObjective(percents: QuickSimOptimizerPercents): number {
	let total = 0;
	let smallCount = 0;
	percents.forEach((percent, index) => {
		total += soloValue(index, percent);
		if (percent === 20) {
			smallCount += 1;
		}
	});
	return total * (1 - 0.02 * smallCount);
}

function hashString(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return hash;
}

function noise(percents: QuickSimOptimizerPercents, seed: number): number {
	const hash = hashString(`${percentsKey(percents)}#${seed}`);
	// -1 〜 1 の一様乱数 × 1.5%
	return ((hash % 20001) / 10000 - 1) * 0.015;
}

/** 就寝中の入れ替えが必要な候補の擬似判定: 起用率 40% 以下のメンバーが 3 匹以上 */
function needsSleepSwaps(percents: QuickSimOptimizerPercents): boolean {
	return percents.filter((percent) => percent > 0 && percent <= 40).length >= 3;
}

class FakeEvaluator implements QuickSimOptimizerEvaluator {
	readonly calls: {
		candidates: QuickSimOptimizerPercents[];
		seeds: number[];
		options: QuickSimOptimizerEvaluateOptions;
	}[] = [];
	simulationCount = 0;

	async evaluate(
		candidates: readonly QuickSimOptimizerPercents[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): Promise<QuickSimCandidateEvaluation[]> {
		this.calls.push({
			candidates: candidates.map((candidate) => [...candidate]),
			seeds: [...seeds],
			options,
		});
		const results = candidates.map((percents, index) => {
			const usesSleepSwaps = needsSleepSwaps(percents);
			const excluded = options.excludeSleepSwaps && usesSleepSwaps;
			const base =
				noiselessObjective(percents) * (options.disableCooking ? 0.8 : 1);
			const epBySeed = excluded
				? []
				: seeds.map((seed) => base * (1 + noise(percents, seed)));
			this.simulationCount += epBySeed.length;
			onProgress?.(index + 1, candidates.length);
			return {
				percents: [...percents],
				epBySeed,
				excluded,
				usesSleepSwaps,
				unmetPokemonIds: [],
				swapsPerDay: percents.filter((percent) => percent > 0 && percent < 100)
					.length,
			};
		});
		return results;
	}
}

/**
 * 初期食材の擬似目的関数: 起用率の目的関数 × (1 + 食材の価値の和 / 10^4)。
 * りんご 1 個 = 3、ミルク 1 個 = 2、それ以外 = 1。
 * ノイズは起用率とシードだけで決まる（実際の評価器と同じく、同じシードの
 * おてつだい結果と大成功の乱数は配分に依存しない）。
 */
function stockBonus(stock: QuickSimIngredientStock): number {
	let value = 0;
	IngredientNames.forEach((name, index) => {
		const weight = name === "apple" ? 3 : name === "milk" ? 2 : 1;
		value += weight * stock[index];
	});
	return value / 10_000;
}

class FakeCombinedEvaluator
	extends FakeEvaluator
	implements QuickSimIngredientEvaluator
{
	readonly ingredientCalls: {
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
		this.ingredientCalls.push({
			percents: [...percents],
			stocks: stocks.map((stock) => [...stock]),
			seeds: [...seeds],
			options,
		});
		const excluded =
			percents.every((percent) => percent <= 0) ||
			(options.excludeSleepSwaps && needsSleepSwaps(percents));
		const base = noiselessObjective(percents);
		const results = stocks.map((stock) => ({
			stock: [...stock],
			epBySeed: excluded
				? []
				: seeds.map(
						(seed) =>
							base * (1 + stockBonus(stock)) * (1 + noise(percents, seed)),
					),
			excluded,
		}));
		onProgress?.(seeds.length, seeds.length);
		return results;
	}
}

const INGREDIENT_SETTINGS = {
	totalCount: 180,
	maxCountByIngredient: { apple: 90, milk: 90, honey: 60 },
};

const COOKING_SETTINGS = {
	...createDefaultCookingSettings(),
	enabled: true,
	category: "curry" as const,
	initialIngredients: { milk: 30, honey: 30 },
};

function bruteForceBest(
	memberCount: number,
	allowed: (percents: number[]) => boolean,
): number[] {
	let best: number[] | null = null;
	let bestValue = Number.NEGATIVE_INFINITY;
	const current: number[] = [];
	const visit = (index: number, remaining: number): void => {
		if (index === memberCount) {
			if (remaining !== 0 || !allowed(current)) {
				return;
			}
			const value = noiselessObjective(current);
			if (value > bestValue) {
				bestValue = value;
				best = [...current];
			}
			return;
		}
		for (let percent = 0; percent <= Math.min(100, remaining); percent += 20) {
			current.push(percent);
			visit(index + 1, remaining - percent);
			current.pop();
		}
	};
	visit(0, QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT);
	if (best === null) {
		throw new Error("no candidate");
	}
	return best;
}

const MEMBERS: QuickSimOptimizerMember[] = WEIGHTS.map((_, index) => ({
	pokemonId: index + 1,
	usageMode: "even",
}));

describe("runQuickSimOptimization", () => {
	it("finds the best allocation of a noisy objective and reports it with final trials", async () => {
		const evaluator = new FakeEvaluator();
		const progress: QuickSimOptimizerProgress[] = [];
		const result = await runQuickSimOptimization({
			members: MEMBERS,
			currentPercents: [100, 100, 100, 100, 100, 0],
			evaluator,
			options: { excludeSleepSwaps: false },
			baseSeed: 12345,
			onProgress: (value) => progress.push(value),
		});

		const expectedBest = bruteForceBest(MEMBERS.length, () => true);
		expect(result.entries[0].percents).toEqual(expectedBest);
		expect(result.entries.length).toBeLessThanOrEqual(
			QUICK_SIM_OPTIMIZER_RESULT_COUNT,
		);
		expect(result.entries.length).toBeGreaterThan(1);
		for (const entry of result.entries) {
			expect(entry.trialCount).toBe(QUICK_SIM_OPTIMIZER_FINAL_TRIALS);
			expect(entry.percents.reduce((sum, percent) => sum + percent, 0)).toBe(
				QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
			);
			expect(
				Math.abs(entry.meanEP - noiselessObjective(entry.percents)),
			).toBeLessThan(noiselessObjective(entry.percents) * 0.002);
		}
		for (let index = 1; index < result.entries.length; index++) {
			expect(result.entries[index].meanEP).toBeLessThanOrEqual(
				result.entries[index - 1].meanEP,
			);
		}
		expect(
			new Set(result.entries.map((entry) => percentsKey(entry.percents))).size,
		).toBe(result.entries.length);
		expect(result.members).toEqual(MEMBERS);
		expect(result.baseSeed).toBe(12345);

		// 現在の起用率も最終試行数で評価される
		expect(result.current).not.toBeNull();
		expect(result.current?.percents).toEqual([100, 100, 100, 100, 100, 0]);
		expect(result.current?.trialCount).toBe(QUICK_SIM_OPTIMIZER_FINAL_TRIALS);

		// 単体 EP 表は料理なし、それ以外は料理設定のまま
		const soloCalls = evaluator.calls.filter(
			(call) => call.options.disableCooking,
		);
		expect(soloCalls.length).toBeGreaterThan(0);
		for (const call of soloCalls) {
			for (const candidate of call.candidates) {
				expect(candidate.filter((percent) => percent > 0)).toHaveLength(1);
			}
		}
		// 最終確認だけは集計期間全体のスケジュールで、全試行を評価し直す
		const finalCalls = evaluator.calls.filter(
			(call) => call.options.usePeriodSchedule,
		);
		expect(finalCalls.length).toBe(2);
		for (const call of finalCalls) {
			expect(call.seeds).toHaveLength(QUICK_SIM_OPTIMIZER_FINAL_TRIALS);
			expect(call.seeds[0]).toBe(12345);
		}
		expect(new Set(finalCalls[0].candidates.map(percentsKey))).toEqual(
			new Set(result.entries.map((entry) => percentsKey(entry.percents))),
		);
		const searchCalls = evaluator.calls.filter(
			(call) => !call.options.usePeriodSchedule,
		);
		expect(
			searchCalls.every(
				(call) => call.seeds.length <= QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
			),
		).toBe(true);

		// 進捗は 0 → 100 に単調に進み、最後は final
		expect(progress[0].percent).toBe(0);
		expect(progress[progress.length - 1].percent).toBe(100);
		expect(progress[progress.length - 1].phase).toBe("final");
		for (let index = 1; index < progress.length; index++) {
			expect(progress[index].percent).toBeGreaterThanOrEqual(
				progress[index - 1].percent,
			);
		}
		expect(new Set(progress.map((value) => value.phase))).toEqual(
			new Set(["solo", "screening", "racing", "localSearch", "final"]),
		);
	});

	it("excludes candidates that need sleep swaps by default", async () => {
		const evaluator = new FakeEvaluator();
		const result = await runQuickSimOptimization({
			members: MEMBERS,
			currentPercents: [100, 100, 100, 100, 100, 0],
			evaluator,
			baseSeed: 7,
		});
		const expectedBest = bruteForceBest(
			MEMBERS.length,
			(percents) => !needsSleepSwaps(percents),
		);
		expect(result.entries[0].percents).toEqual(expectedBest);
		for (const entry of result.entries) {
			expect(entry.usesSleepSwaps).toBe(false);
		}
		// 現在の起用率は除外せずに評価する
		expect(result.current).not.toBeNull();
	});

	it("keeps every exclusive group within one lane and still finds the constrained optimum", async () => {
		const evaluator = new FakeEvaluator();
		// メンバー 0 と 1 は同時に編成できない（合計 100% まで）
		const exclusiveGroups = [[0, 1]];
		const result = await runQuickSimOptimization({
			members: MEMBERS,
			currentPercents: [100, 100, 100, 100, 100, 0],
			evaluator,
			options: { excludeSleepSwaps: false },
			exclusiveGroups,
			baseSeed: 4242,
		});
		const fits = (percents: number[]): boolean =>
			percents[0] + percents[1] <= 100;
		const expectedBest = bruteForceBest(MEMBERS.length, fits);
		expect(result.entries[0].percents).toEqual(expectedBest);
		// 残り 4 匹が 100% で埋まるので、候補は先頭 2 匹の配分 6 通りだけ
		expect(result.entries).toHaveLength(6);
		for (const entry of result.entries) {
			expect(fits(entry.percents)).toBe(true);
		}
		// 制約なしの最適解（先頭 2 匹が 100%）は候補として評価すらされない
		for (const call of evaluator.calls) {
			if (call.options.disableCooking) {
				continue;
			}
			for (const candidate of call.candidates) {
				if (
					call.options.usePeriodSchedule &&
					candidate[0] === 100 &&
					candidate[1] === 100
				) {
					// 現在の起用率だけは制約に関係なく評価する
					expect(candidate).toEqual([100, 100, 100, 100, 100, 0]);
					continue;
				}
				expect(fits([...candidate])).toBe(true);
			}
		}
		// 現在の起用率（制約違反）も比較用に評価される
		expect(result.current?.percents).toEqual([100, 100, 100, 100, 100, 0]);
	});

	it("returns null for the current allocation when it cannot be evaluated", async () => {
		const evaluator = new FakeEvaluator();
		const result = await runQuickSimOptimization({
			members: MEMBERS,
			currentPercents: [100, 100, 100, 100, 100, 100],
			evaluator,
			baseSeed: 1,
		});
		expect(result.current).toBeNull();
	});

	it("does not re-run trials it already has", async () => {
		const evaluator = new FakeEvaluator();
		await runQuickSimOptimization({
			members: MEMBERS,
			currentPercents: [0, 0, 0, 0, 0, 0],
			evaluator,
			baseSeed: 99,
		});
		const seedsByCandidate = new Map<string, number[]>();
		for (const call of evaluator.calls) {
			// 単体 EP 表と最終確認は別の評価なので除く
			if (call.options.disableCooking || call.options.usePeriodSchedule) {
				continue;
			}
			for (const candidate of call.candidates) {
				const key = percentsKey(candidate);
				const seen = seedsByCandidate.get(key) ?? [];
				for (const seed of call.seeds) {
					expect(seen).not.toContain(seed);
					seen.push(seed);
				}
				seedsByCandidate.set(key, seen);
			}
		}
		for (const seeds of seedsByCandidate.values()) {
			// シードは 0 番から隙間なく増える
			expect(seeds).toEqual(seeds.map((_, index) => 99 + index));
		}
	});

	it("stops with an abort error when the signal is aborted", async () => {
		const evaluator = new FakeEvaluator();
		const controller = new AbortController();
		const promise = runQuickSimOptimization({
			members: MEMBERS,
			currentPercents: [100, 100, 100, 100, 100, 0],
			evaluator,
			baseSeed: 5,
			signal: controller.signal,
			onProgress: (value) => {
				if (value.phase === "racing") {
					controller.abort();
				}
			},
		});
		await expect(promise).rejects.toSatisfy((error: unknown) =>
			isQuickSimOptimizerAbortError(error),
		);
		expect(evaluator.calls.some((call) => call.seeds.length >= 100)).toBe(
			false,
		);
	});

	it("rejects an empty member list", async () => {
		const evaluator = new FakeEvaluator();
		await expect(
			runQuickSimOptimization({
				members: [],
				currentPercents: [],
				evaluator,
				baseSeed: 1,
			}),
		).rejects.toThrow();
	});

	it("rejects an ingredient target without the ingredient inputs", async () => {
		const evaluator = new FakeEvaluator();
		await expect(
			runQuickSimOptimization({
				members: MEMBERS,
				currentPercents: [100, 100, 100, 100, 100, 0],
				evaluator,
				baseSeed: 1,
				target: "ingredients",
			}),
		).rejects.toThrow(/Ingredient optimization requires/);
	});

	it("optimizes the initial ingredients for the current usage", async () => {
		const evaluator = new FakeCombinedEvaluator();
		const progress: QuickSimOptimizerProgress[] = [];
		const currentPercents = [100, 100, 100, 100, 60, 40];
		const result = await runQuickSimOptimization({
			members: MEMBERS,
			currentPercents,
			evaluator,
			baseSeed: 2024,
			target: "ingredients",
			ingredientEvaluator: evaluator,
			cookingSettings: COOKING_SETTINGS,
			ingredientSettings: INGREDIENT_SETTINGS,
			onProgress: (value) => progress.push(value),
		});
		expect(result.target).toBe("ingredients");
		expect(result.ingredientTotalCount).toBe(180);
		expect(result.entries.length).toBeGreaterThan(0);
		expect(result.entries.length).toBeLessThanOrEqual(
			QUICK_SIM_OPTIMIZER_RESULT_COUNT,
		);
		// りんご 90 + ミルク 90 が最良
		expect(result.entries[0].initialIngredients).toMatchObject({
			apple: 90,
			milk: 90,
			honey: 0,
		});
		for (const entry of result.entries) {
			expect(entry.percents).toEqual(currentPercents);
			expect(entry.trialCount).toBe(QUICK_SIM_OPTIMIZER_FINAL_TRIALS);
			const stock = initialIngredientsToStock(entry.initialIngredients ?? {});
			expect(Object.keys(entry.initialIngredients ?? {})).toHaveLength(
				IngredientNames.length,
			);
			expect(stock.reduce((sum, count) => sum + count, 0)).toBe(180);
		}
		for (let index = 1; index < result.entries.length; index++) {
			expect(result.entries[index].meanEP).toBeLessThanOrEqual(
				result.entries[index - 1].meanEP,
			);
		}
		// 現在の配分（格子に乗っていない）も同じ起用率で評価される
		expect(result.current?.initialIngredients).toMatchObject({
			milk: 30,
			honey: 30,
			apple: 0,
		});
		expect(result.current?.percents).toEqual(currentPercents);
		expect(result.current?.trialCount).toBe(QUICK_SIM_OPTIMIZER_FINAL_TRIALS);
		const currentKey = stockKey(
			initialIngredientsToStock(COOKING_SETTINGS.initialIngredients),
		);
		expect(
			result.entries.some(
				(entry) =>
					stockKey(
						initialIngredientsToStock(entry.initialIngredients ?? {}),
					) === currentKey,
			),
		).toBe(false);
		// 起用率の探索は行わず、通常の評価器は起用方法の情報を 1 試行で取るだけ
		expect(evaluator.calls).toHaveLength(1);
		expect(evaluator.calls[0].seeds).toHaveLength(1);
		expect(evaluator.calls[0].options.usePeriodSchedule).toBe(true);
		const finalCalls = evaluator.ingredientCalls.filter(
			(call) => call.options.usePeriodSchedule,
		);
		expect(finalCalls).toHaveLength(1);
		expect(finalCalls[0].seeds).toHaveLength(QUICK_SIM_OPTIMIZER_FINAL_TRIALS);
		expect(finalCalls[0].stocks).toHaveLength(result.entries.length + 1);
		expect(new Set(progress.map((value) => value.phase))).toEqual(
			new Set(["ingredientStart", "ingredientSearch", "final"]),
		);
		expect(progress[progress.length - 1].percent).toBe(100);
		for (let index = 1; index < progress.length; index++) {
			expect(progress[index].percent).toBeGreaterThanOrEqual(
				progress[index - 1].percent,
			);
		}
	});

	it("optimizes usage and ingredients together", async () => {
		const evaluator = new FakeCombinedEvaluator();
		const progress: QuickSimOptimizerProgress[] = [];
		const result = await runQuickSimOptimization({
			members: MEMBERS,
			currentPercents: [100, 100, 100, 100, 100, 0],
			evaluator,
			baseSeed: 77,
			target: "both",
			ingredientEvaluator: evaluator,
			cookingSettings: COOKING_SETTINGS,
			ingredientSettings: INGREDIENT_SETTINGS,
			onProgress: (value) => progress.push(value),
		});
		expect(result.target).toBe("both");
		expect(result.entries.length).toBeGreaterThan(0);
		expect(result.entries.length).toBeLessThanOrEqual(
			QUICK_SIM_OPTIMIZER_JOINT_USAGE_CANDIDATES,
		);
		const expectedBest = bruteForceBest(
			MEMBERS.length,
			(percents) => !needsSleepSwaps(percents),
		);
		expect(result.entries[0].percents).toEqual(expectedBest);
		expect(result.entries[0].initialIngredients).toMatchObject({
			apple: 90,
			milk: 90,
		});
		for (const entry of result.entries) {
			expect(entry.trialCount).toBe(QUICK_SIM_OPTIMIZER_FINAL_TRIALS);
			expect(entry.usesSleepSwaps).toBe(false);
			expect(
				initialIngredientsToStock(entry.initialIngredients ?? {}).reduce(
					(sum, count) => sum + count,
					0,
				),
			).toBe(180);
		}
		expect(
			new Set(result.entries.map((entry) => percentsKey(entry.percents))).size,
		).toBe(result.entries.length);
		expect(result.current?.percents).toEqual([100, 100, 100, 100, 100, 0]);
		expect(result.current?.initialIngredients).toMatchObject({
			milk: 30,
			honey: 30,
		});
		// 起用率の最終確認（1,000 試行）は行わない
		const periodCalls = evaluator.calls.filter(
			(call) => call.options.usePeriodSchedule,
		);
		expect(periodCalls.length).toBeGreaterThan(0);
		expect(periodCalls.every((call) => call.seeds.length === 1)).toBe(true);
		// 上位 K 件の起用率それぞれに初期食材を探索する
		const searchedPercents = new Set(
			evaluator.ingredientCalls
				.filter((call) => !call.options.usePeriodSchedule)
				.map((call) => percentsKey(call.percents)),
		);
		expect(searchedPercents.size).toBe(
			QUICK_SIM_OPTIMIZER_JOINT_USAGE_CANDIDATES,
		);
		expect(searchedPercents.has(percentsKey(expectedBest))).toBe(true);
		expect(new Set(progress.map((value) => value.phase))).toEqual(
			new Set([
				"solo",
				"screening",
				"racing",
				"localSearch",
				"ingredientStart",
				"ingredientSearch",
				"final",
			]),
		);
		expect(progress[progress.length - 1].percent).toBe(100);
		for (let index = 1; index < progress.length; index++) {
			expect(progress[index].percent).toBeGreaterThanOrEqual(
				progress[index - 1].percent,
			);
		}
	});
});
