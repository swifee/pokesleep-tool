/**
 * QuickSimIngredientSearch.ts
 * 起用率を固定して初期食材の配分を探す。評価器（料理だけの再計算）は注入する。
 *
 * 1. 開始点（レシピごとの比例配分・補充全振り・現在の設定）を少数試行で比べ、上位を残す。
 * 2. 上位の開始点それぞれから局所探索（1 単位の移動・2 食材の入れ替え）。
 *    近傍は 8 試行 → 上位を 32 試行 → 上位 3 件を 100 試行で確認し、改善があれば採用する。
 * 3. 100 試行以上の記録を平均 EP の高い順に返す。
 *
 * 全配分で同じシード列を使う（共通乱数）。おてつだいの結果と大成功の乱数は配分に
 * 依存しないので、同じシードなら配分どうしの差はほぼ決定的で、少ない試行で順位が決まる。
 */

import type { CookingSimulationSettings } from "../types/CookingTypes";
import {
	QUICK_SIM_INGREDIENT_LOCAL_SEARCH_STARTS,
	QUICK_SIM_INGREDIENT_NEIGHBOR_CONFIRM_TRIALS,
	QUICK_SIM_INGREDIENT_NEIGHBOR_KEEP_RATIO,
	QUICK_SIM_INGREDIENT_NEIGHBOR_MIN_KEEP,
	QUICK_SIM_INGREDIENT_NEIGHBOR_TRIALS,
	QUICK_SIM_INGREDIENT_START_KEEP_RATIO,
	QUICK_SIM_INGREDIENT_START_MIN_KEEP,
	QUICK_SIM_INGREDIENT_START_TRIALS,
	QUICK_SIM_OPTIMIZER_CONFIRM_CANDIDATES,
	QUICK_SIM_OPTIMIZER_MAX_LOCAL_SEARCH_ITERATIONS,
	QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
	type QuickSimIngredientEvaluator,
	type QuickSimIngredientSearchSettings,
	type QuickSimOptimizerPercents,
	type QuickSimOptimizerPhase,
} from "../types/QuickSimOptimizerTypes";
import {
	buildIngredientSearchSpace,
	buildIngredientStartUnits,
	generateIngredientNeighborUnits,
	initialIngredientsToStock,
	type QuickSimIngredientSearchSpace,
	type QuickSimIngredientUnits,
	unitsToStock,
} from "./QuickSimIngredientCandidates";
import { unitsKey } from "./QuickSimOptimizerCandidates";
import {
	keepCount,
	meanOfFirst,
	type PercentRange,
	partialRange,
	type SearchController,
	sortByMeanDesc,
	splitRange,
	type TrialRecord,
} from "./QuickSimOptimizerSearchCommon";

export interface QuickSimIngredientSearchInput {
	/** 固定する起用率（メンバー順、%） */
	percents: QuickSimOptimizerPercents;
	cookingSettings: CookingSimulationSettings;
	settings: QuickSimIngredientSearchSettings;
	evaluator: QuickSimIngredientEvaluator;
	controller: SearchController;
	/** 起用率が就寝中の入れ替えを必要とするとき、配分を除外扱いにするか */
	excludeSleepSwaps: boolean;
	/** この探索に割り当てる進捗の範囲 */
	percentRange: PercentRange;
}

/** 配分ごとの評価の蓄積 */
export interface IngredientRecord extends TrialRecord {
	units: number[];
	/** IngredientNames 順の個数 */
	stock: number[];
}

export interface QuickSimIngredientSearchResult {
	space: QuickSimIngredientSearchSpace;
	/** 100 試行以上の記録を平均 EP の高い順に並べたもの */
	records: IngredientRecord[];
}

/** 開始点の比較に使う進捗の割合（残りは局所探索） */
const START_PHASE_RATIO = 0.2;

/**
 * 探索空間を決める。料理が無効、または探索できる食材がなければ例外。
 */
export function resolveIngredientSearchSpace(
	cookingSettings: CookingSimulationSettings,
	settings: QuickSimIngredientSearchSettings,
): QuickSimIngredientSearchSpace {
	if (!cookingSettings.enabled) {
		throw new Error("Cooking simulation is disabled");
	}
	const space = buildIngredientSearchSpace(
		settings.totalCount,
		settings.maxCountByIngredient,
	);
	if (space === null) {
		throw new Error("No ingredient can be searched");
	}
	return space;
}

class IngredientSearchSession {
	private readonly records = new Map<string, IngredientRecord>();

	constructor(
		private readonly input: QuickSimIngredientSearchInput,
		readonly space: QuickSimIngredientSearchSpace,
	) {}

	get controller(): SearchController {
		return this.input.controller;
	}

	getRecord(units: QuickSimIngredientUnits): IngredientRecord {
		const key = unitsKey(units);
		const existing = this.records.get(key);
		if (existing) {
			return existing;
		}
		const record: IngredientRecord = {
			units: [...units],
			stock: unitsToStock(units, this.space),
			epBySeed: [],
			excluded: false,
		};
		this.records.set(key, record);
		return record;
	}

	allRecords(): IngredientRecord[] {
		return [...this.records.values()];
	}

	/**
	 * 各配分が trialCount 試行分の EP を持つように評価する。
	 * 既に持っている試行は再評価しない。除外された配分は除いて返す。
	 */
	async ensureTrials(
		records: readonly IngredientRecord[],
		trialCount: number,
		phase: QuickSimOptimizerPhase,
		percentRange: PercentRange,
	): Promise<IngredientRecord[]> {
		const pending = new Map<number, IngredientRecord[]>();
		for (const record of records) {
			if (record.excluded || record.epBySeed.length >= trialCount) {
				continue;
			}
			const group = pending.get(record.epBySeed.length) ?? [];
			group.push(record);
			pending.set(record.epBySeed.length, group);
		}
		const totalCount = [...pending.values()].reduce(
			(sum, group) => sum + group.length,
			0,
		);
		const [start, end] = percentRange;
		let completedBefore = 0;
		this.controller.reportProgress(phase, start, 0, totalCount);
		for (const [have, group] of pending) {
			this.controller.throwIfAborted();
			const seeds = this.controller.seedsBetween(have, trialCount);
			const evaluations = await this.input.evaluator.evaluateIngredients(
				this.input.percents,
				group.map((record) => record.stock),
				seeds,
				{ excludeSleepSwaps: this.input.excludeSleepSwaps },
				(completedSeeds, totalSeeds) => {
					// 進捗は配分数に換算する（シードが外側のループなので按分）
					const done =
						completedBefore +
						Math.floor(
							(group.length * completedSeeds) / Math.max(1, totalSeeds),
						);
					this.controller.reportProgress(
						phase,
						start + ((end - start) * done) / Math.max(1, totalCount),
						done,
						totalCount,
					);
				},
			);
			this.controller.throwIfAborted();
			if (evaluations.length !== group.length) {
				throw new Error("Evaluator returned an unexpected number of results");
			}
			group.forEach((record, index) => {
				const evaluation = evaluations[index];
				if (evaluation.excluded) {
					record.excluded = true;
					return;
				}
				if (record.epBySeed.length !== have) {
					throw new Error("Evaluation seeds do not continue the stored trials");
				}
				record.epBySeed.push(...evaluation.epBySeed);
			});
			completedBefore += group.length;
			this.controller.reportProgress(
				phase,
				start + ((end - start) * completedBefore) / Math.max(1, totalCount),
				completedBefore,
				totalCount,
			);
		}
		this.controller.reportProgress(phase, end, totalCount, totalCount);
		return records.filter((record) => !record.excluded);
	}
}

/** 1. 開始点を少数試行で比べ、局所探索の起点を選ぶ（100 試行まで評価済み） */
async function raceStartPoints(
	session: IngredientSearchSession,
	input: QuickSimIngredientSearchInput,
	percentRange: PercentRange,
): Promise<IngredientRecord[]> {
	const starts = buildIngredientStartUnits(
		input.cookingSettings,
		session.space,
		initialIngredientsToStock(input.cookingSettings.initialIngredients),
	).map((units) => session.getRecord(units));
	const stages = QUICK_SIM_INGREDIENT_START_TRIALS;
	const ranges = splitRange(percentRange, stages.length + 1);
	let pool = starts;
	for (let stage = 0; stage < stages.length; stage++) {
		pool = await session.ensureTrials(
			pool,
			stages[stage],
			"ingredientStart",
			ranges[stage],
		);
		if (pool.length === 0) {
			throw new Error("Current usage cannot be scheduled");
		}
		pool = sortByMeanDesc(pool, stages[stage]);
		const keep =
			stage < stages.length - 1
				? keepCount(
						pool.length,
						QUICK_SIM_INGREDIENT_START_KEEP_RATIO,
						QUICK_SIM_INGREDIENT_START_MIN_KEEP,
					)
				: QUICK_SIM_INGREDIENT_LOCAL_SEARCH_STARTS;
		pool = pool.slice(0, keep);
	}
	pool = await session.ensureTrials(
		pool,
		QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
		"ingredientStart",
		ranges[stages.length],
	);
	return sortByMeanDesc(pool, QUICK_SIM_OPTIMIZER_SEARCH_TRIALS);
}

/** 2. 局所探索。近傍を段階的に絞り、確認試行で改善が確かなものだけ採用する */
async function runLocalSearch(
	session: IngredientSearchSession,
	start: IngredientRecord,
	percentRange: PercentRange,
): Promise<IngredientRecord> {
	const maxIterations = QUICK_SIM_OPTIMIZER_MAX_LOCAL_SEARCH_ITERATIONS;
	const searchTrials = QUICK_SIM_OPTIMIZER_SEARCH_TRIALS;
	const neighborTrials = QUICK_SIM_INGREDIENT_NEIGHBOR_TRIALS;
	const confirmTrials = QUICK_SIM_INGREDIENT_NEIGHBOR_CONFIRM_TRIALS;
	const iterationRanges = splitRange(percentRange, maxIterations);
	let current = start;
	for (let iteration = 0; iteration < maxIterations; iteration++) {
		const range = iterationRanges[iteration];
		const neighbors = generateIngredientNeighborUnits(
			current.units,
			session.space.maxUnits,
		).map((units) => session.getRecord(units));
		if (neighbors.length === 0) {
			break;
		}
		const screened = await session.ensureTrials(
			neighbors,
			neighborTrials,
			"ingredientSearch",
			partialRange(range, 0, 0.5),
		);
		const shortlisted = sortByMeanDesc(screened, neighborTrials).slice(
			0,
			keepCount(
				screened.length,
				QUICK_SIM_INGREDIENT_NEIGHBOR_KEEP_RATIO,
				QUICK_SIM_INGREDIENT_NEIGHBOR_MIN_KEEP,
			),
		);
		const confirmed = await session.ensureTrials(
			shortlisted,
			confirmTrials,
			"ingredientSearch",
			partialRange(range, 0.5, 0.8),
		);
		const currentConfirmMean = meanOfFirst(current.epBySeed, confirmTrials);
		const promising = sortByMeanDesc(
			confirmed.filter(
				(record) =>
					meanOfFirst(record.epBySeed, confirmTrials) > currentConfirmMean,
			),
			confirmTrials,
		).slice(0, QUICK_SIM_OPTIMIZER_CONFIRM_CANDIDATES);
		if (promising.length === 0) {
			break;
		}
		const verified = await session.ensureTrials(
			promising,
			searchTrials,
			"ingredientSearch",
			partialRange(range, 0.8, 1),
		);
		const best = sortByMeanDesc(verified, searchTrials)[0];
		if (
			!best ||
			meanOfFirst(best.epBySeed, searchTrials) <=
				meanOfFirst(current.epBySeed, searchTrials)
		) {
			break;
		}
		current = best;
	}
	return current;
}

/**
 * 初期食材の探索を実行する。中止されたときは name が "AbortError" の例外を投げる。
 */
export async function runIngredientSearch(
	input: QuickSimIngredientSearchInput,
): Promise<QuickSimIngredientSearchResult> {
	const space = resolveIngredientSearchSpace(
		input.cookingSettings,
		input.settings,
	);
	const session = new IngredientSearchSession(input, space);
	input.controller.throwIfAborted();
	const starts = await raceStartPoints(
		session,
		input,
		partialRange(input.percentRange, 0, START_PHASE_RATIO),
	);
	const searchRanges = splitRange(
		partialRange(input.percentRange, START_PHASE_RATIO, 1),
		starts.length,
	);
	for (let index = 0; index < starts.length; index++) {
		await runLocalSearch(session, starts[index], searchRanges[index]);
	}
	const records = sortByMeanDesc(
		session
			.allRecords()
			.filter(
				(record) =>
					!record.excluded &&
					record.epBySeed.length >= QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
			),
		QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
	);
	return { space, records };
}
