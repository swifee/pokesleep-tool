/**
 * QuickSimOptimizerSearch.ts
 * 起用率最適化の探索手順。評価器（シミュレーション）は注入する。
 *
 * 対象 usage（起用率）:
 * 1. 単体 EP 表: 各メンバーを単独で各単位数に置き、料理なしで少数試行する。
 * 2. 絞り込み: 単体 EP の和（代理スコア）が高い候補を上位 N 件だけ残す。
 * 3. racing: 残った候補を少ない試行で評価し、上位だけ試行を増やしていく。
 * 4. 局所探索: racing の最良から近傍（1 単位の移動・入れ替え）を試す。
 * 5. 最終確認: 上位候補と現在の起用率を、通常の実行と同じスケジュールで
 *    多数の試行により評価し直して並べる。
 *
 * 対象 ingredients（初期食材）: 現在の起用率を固定し、初期食材の配分を
 * `QuickSimIngredientSearch` で探し、上位と現在の配分を最終確認する。
 *
 * 対象 both（両方）: 起用率の 1〜4 を行い、100 試行以上の上位 K 候補それぞれに
 * 初期食材を探索して、K 組と現在の組み合わせを最終確認する。
 *
 * 全候補で同じシード列を使う（共通乱数）ので、候補どうしの比較は同じ試行数の
 * 平均で行う。
 *
 * 同時に編成できないメンバーの組（とくべつなポケモンのルール）は exclusiveGroups で
 * 受け取り、組の起用率の合計が 100% を超える候補は最初から生成しない。
 * 評価器側のスケジューラも同じ組を同時に置かないので、結果を適用してもルールを守る。
 */

import type { CookingSimulationSettings } from "../types/CookingTypes";
import {
	DEFAULT_QUICK_SIM_OPTIMIZER_OPTIONS,
	DEFAULT_QUICK_SIM_OPTIMIZER_TARGET,
	optimizerTargetIncludesIngredients,
	QUICK_SIM_OPTIMIZER_CONFIRM_CANDIDATES,
	QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
	QUICK_SIM_OPTIMIZER_JOINT_USAGE_CANDIDATES,
	QUICK_SIM_OPTIMIZER_MAX_LOCAL_SEARCH_ITERATIONS,
	QUICK_SIM_OPTIMIZER_MAX_UNITS,
	QUICK_SIM_OPTIMIZER_NEIGHBOR_TRIALS,
	QUICK_SIM_OPTIMIZER_RACING_KEEP_RATIO,
	QUICK_SIM_OPTIMIZER_RACING_MIN_KEEP,
	QUICK_SIM_OPTIMIZER_RACING_TRIALS,
	QUICK_SIM_OPTIMIZER_RESULT_COUNT,
	QUICK_SIM_OPTIMIZER_SCREENING_LIMIT,
	QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
	QUICK_SIM_OPTIMIZER_SOLO_TRIALS,
	QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
	type QuickSimCandidateEvaluation,
	type QuickSimIngredientEvaluator,
	type QuickSimIngredientSearchSettings,
	type QuickSimIngredientStock,
	type QuickSimOptimizerEvaluator,
	type QuickSimOptimizerExclusiveGroups,
	type QuickSimOptimizerMember,
	type QuickSimOptimizerOptions,
	type QuickSimOptimizerPercents,
	type QuickSimOptimizerPhase,
	type QuickSimOptimizerProgress,
	type QuickSimOptimizerResult,
	type QuickSimOptimizerResultEntry,
	type QuickSimOptimizerTarget,
} from "../types/QuickSimOptimizerTypes";
import { QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT } from "../types/QuickSimTypes";
import {
	initialIngredientsToStock,
	stockKey,
	stockToInitialIngredients,
} from "./QuickSimIngredientCandidates";
import { runIngredientSearch } from "./QuickSimIngredientSearch";
import {
	buildSoloUnits,
	generateNeighborUnits,
	type QuickSimOptimizerUnits,
	type QuickSimSoloTable,
	selectTopCandidatesBySurrogate,
	unitsKey,
	unitsToPercents,
} from "./QuickSimOptimizerCandidates";
import {
	keepCount,
	meanOfFirst,
	type PercentRange,
	partialRange,
	SearchController,
	sortByMeanDesc,
	splitRange,
} from "./QuickSimOptimizerSearchCommon";

export {
	createQuickSimOptimizerAbortError,
	isQuickSimOptimizerAbortError,
} from "./QuickSimOptimizerSearchCommon";

export interface QuickSimOptimizationInput {
	members: readonly QuickSimOptimizerMember[];
	/** 現在の起用率（メンバー順、%）。同じシードで評価して比較用に返す */
	currentPercents: readonly number[];
	evaluator: QuickSimOptimizerEvaluator;
	options?: Partial<QuickSimOptimizerOptions>;
	/** 同時に編成できないメンバー index の組（組の起用率の合計は 100% まで） */
	exclusiveGroups?: QuickSimOptimizerExclusiveGroups;
	/** シードの基点。候補 i 番目の試行はシード baseSeed + i */
	baseSeed: number;
	onProgress?: (progress: QuickSimOptimizerProgress) => void;
	signal?: AbortSignal;
	/** 最適化の対象（既定は起用率） */
	target?: QuickSimOptimizerTarget;
	/** 初期食材を探索する対象で必要 */
	ingredientEvaluator?: QuickSimIngredientEvaluator;
	cookingSettings?: CookingSimulationSettings;
	ingredientSettings?: QuickSimIngredientSearchSettings;
}

/** 候補ごとの評価の蓄積 */
interface CandidateRecord {
	units: number[];
	percents: number[];
	/** シード順の EP。先頭 n 件の平均が「n 試行の平均」 */
	epBySeed: number[];
	excluded: boolean;
	usesSleepSwaps: boolean;
	unmetPokemonIds: number[];
	swapsPerDay: number;
}

/** 進捗の範囲を決める区分（起用率の各段階・初期食材の探索・最終確認） */
type ProgressStage = QuickSimOptimizerPhase | "ingredient";

/** 対象ごとの進捗の範囲（%） */
const PHASE_PERCENT_RANGES: Readonly<
	Record<
		QuickSimOptimizerTarget,
		Readonly<Partial<Record<ProgressStage, PercentRange>>>
	>
> = {
	usage: {
		solo: [0, 5],
		screening: [5, 6],
		racing: [6, 55],
		localSearch: [55, 75],
		final: [75, 100],
	},
	ingredients: {
		ingredient: [0, 75],
		final: [75, 100],
	},
	both: {
		solo: [0, 4],
		screening: [4, 5],
		racing: [5, 40],
		localSearch: [40, 55],
		ingredient: [55, 80],
		final: [80, 100],
	},
};

/** 絞り込みで候補が足りないときに件数を増やす上限（倍率） */
const SCREENING_LIMIT_MAX_MULTIPLIER = 4;

/** 最終確認の進捗のうち、現在の設定の評価に使う割合 */
const FINAL_CURRENT_RATIO = 0.1;

/** 初期食材を探索する対象に必要な入力 */
interface IngredientSearchContext {
	evaluator: QuickSimIngredientEvaluator;
	cookingSettings: CookingSimulationSettings;
	settings: QuickSimIngredientSearchSettings;
}

/** 最終確認の 1 組（起用率と初期食材の配分） */
interface FinalCandidate {
	percents: QuickSimOptimizerPercents;
	stock: QuickSimIngredientStock;
}

/**
 * 探索の状態。候補の評価結果を蓄積し、必要な試行数だけ評価器に依頼する。
 */
class SearchSession {
	private readonly records = new Map<string, CandidateRecord>();
	private readonly options: QuickSimOptimizerOptions;
	readonly controller: SearchController;
	readonly target: QuickSimOptimizerTarget;

	constructor(private readonly input: QuickSimOptimizationInput) {
		this.options = {
			...DEFAULT_QUICK_SIM_OPTIMIZER_OPTIONS,
			...input.options,
		};
		this.controller = new SearchController(input);
		this.target = input.target ?? DEFAULT_QUICK_SIM_OPTIMIZER_TARGET;
	}

	get memberCount(): number {
		return this.input.members.length;
	}

	get exclusiveGroups(): QuickSimOptimizerExclusiveGroups {
		return this.input.exclusiveGroups ?? [];
	}

	get excludeSleepSwaps(): boolean {
		return this.options.excludeSleepSwaps;
	}

	/** 進捗の範囲。対象に含まれない段階は幅 0 */
	range(stage: ProgressStage): PercentRange {
		return PHASE_PERCENT_RANGES[this.target][stage] ?? [0, 0];
	}

	throwIfAborted(): void {
		this.controller.throwIfAborted();
	}

	reportProgress(
		phase: QuickSimOptimizerPhase,
		percent: number,
		completed: number,
		total: number,
	): void {
		this.controller.reportProgress(phase, percent, completed, total);
	}

	getRecord(units: QuickSimOptimizerUnits): CandidateRecord {
		const key = unitsKey(units);
		const existing = this.records.get(key);
		if (existing) {
			return existing;
		}
		const record: CandidateRecord = {
			units: [...units],
			percents: unitsToPercents(units),
			epBySeed: [],
			excluded: false,
			usesSleepSwaps: false,
			unmetPokemonIds: [],
			swapsPerDay: 0,
		};
		this.records.set(key, record);
		return record;
	}

	allRecords(): CandidateRecord[] {
		return [...this.records.values()];
	}

	private applyEvaluation(
		record: CandidateRecord,
		evaluation: QuickSimCandidateEvaluation,
		firstSeedIndex: number,
	): void {
		record.usesSleepSwaps = evaluation.usesSleepSwaps;
		record.unmetPokemonIds = [...evaluation.unmetPokemonIds];
		record.swapsPerDay = evaluation.swapsPerDay;
		if (evaluation.excluded) {
			record.excluded = true;
			return;
		}
		if (record.epBySeed.length !== firstSeedIndex) {
			throw new Error("Evaluation seeds do not continue the stored trials");
		}
		record.epBySeed.push(...evaluation.epBySeed);
	}

	/**
	 * 各候補が trialCount 試行分の EP を持つように評価する。
	 * 既に持っている試行は再評価しない。除外された候補は除いて返す。
	 */
	async ensureTrials(
		records: readonly CandidateRecord[],
		trialCount: number,
		phase: QuickSimOptimizerPhase,
		percentRange: PercentRange,
		options: { disableCooking?: boolean; excludeSleepSwaps?: boolean } = {},
	): Promise<CandidateRecord[]> {
		const excludeSleepSwaps =
			options.excludeSleepSwaps ?? this.options.excludeSleepSwaps;
		const pending = new Map<number, CandidateRecord[]>();
		for (const record of records) {
			if (record.excluded || record.epBySeed.length >= trialCount) {
				continue;
			}
			const have = record.epBySeed.length;
			const group = pending.get(have) ?? [];
			group.push(record);
			pending.set(have, group);
		}
		const totalCount = [...pending.values()].reduce(
			(sum, group) => sum + group.length,
			0,
		);
		const [start, end] = percentRange;
		let completedBefore = 0;
		this.reportProgress(phase, start, 0, totalCount);
		for (const [have, group] of pending) {
			this.throwIfAborted();
			const seeds = this.controller.seedsBetween(have, trialCount);
			const evaluations = await this.input.evaluator.evaluate(
				group.map((record) => record.percents),
				seeds,
				{
					disableCooking: options.disableCooking,
					excludeSleepSwaps,
				},
				(completed) => {
					const done = completedBefore + completed;
					this.reportProgress(
						phase,
						start + ((end - start) * done) / Math.max(1, totalCount),
						done,
						totalCount,
					);
				},
			);
			this.throwIfAborted();
			if (evaluations.length !== group.length) {
				throw new Error("Evaluator returned an unexpected number of results");
			}
			group.forEach((record, index) => {
				this.applyEvaluation(record, evaluations[index], have);
			});
			completedBefore += group.length;
			this.reportProgress(
				phase,
				start + ((end - start) * completedBefore) / Math.max(1, totalCount),
				completedBefore,
				totalCount,
			);
		}
		this.reportProgress(phase, end, totalCount, totalCount);
		return records.filter((record) => !record.excluded);
	}

	/**
	 * 最終確認。通常の簡易シミュと同じ集計期間全体のスケジュールで、
	 * 全試行を最初から評価し直す（探索中の 1 日スケジュールの結果とは混ぜない）。
	 * 除外された候補は結果から外し、平均 EP の高い順に返す。
	 */
	async evaluateFinal(
		candidates: readonly QuickSimOptimizerPercents[],
		trialCount: number,
		percentRange: PercentRange,
		excludeSleepSwaps: boolean,
	): Promise<QuickSimOptimizerResultEntry[]> {
		if (candidates.length === 0) {
			return [];
		}
		this.throwIfAborted();
		const seeds = this.controller.seedsBetween(0, trialCount);
		const [start, end] = percentRange;
		this.reportProgress("final", start, 0, candidates.length);
		const evaluations = await this.input.evaluator.evaluate(
			candidates,
			seeds,
			{ excludeSleepSwaps, usePeriodSchedule: true },
			(completed, totalCount) => {
				this.reportProgress(
					"final",
					start + ((end - start) * completed) / Math.max(1, totalCount),
					completed,
					totalCount,
				);
			},
		);
		this.throwIfAborted();
		this.reportProgress("final", end, candidates.length, candidates.length);
		return evaluations
			.filter((evaluation) => !evaluation.excluded)
			.map((evaluation) => ({
				percents: [...evaluation.percents],
				meanEP: meanOfFirst(evaluation.epBySeed, trialCount),
				trialCount: evaluation.epBySeed.length,
				usesSleepSwaps: evaluation.usesSleepSwaps,
				unmetPokemonIds: [...evaluation.unmetPokemonIds],
				swapsPerDay: evaluation.swapsPerDay,
			}))
			.sort((left, right) => right.meanEP - left.meanEP);
	}

	/** 現在の起用率が評価できる形か（合計が 0 より大きく上限以内） */
	hasValidCurrentPercents(): boolean {
		const percents = this.input.currentPercents;
		if (percents.length !== this.memberCount) {
			return false;
		}
		const total = percents.reduce((sum, percent) => sum + percent, 0);
		return total > 0 && total <= QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT;
	}

	get currentPercents(): number[] {
		return [...this.input.currentPercents];
	}

	/** 現在の起用率を同じシードで評価する（候補の格子に乗っていなくてもよい） */
	async evaluateCurrent(
		trialCount: number,
		percentRange: PercentRange,
	): Promise<QuickSimOptimizerResultEntry | null> {
		if (!this.hasValidCurrentPercents()) {
			return null;
		}
		const [entry] = await this.evaluateFinal(
			[this.currentPercents],
			trialCount,
			percentRange,
			false,
		);
		return entry ?? null;
	}

	/** 初期食材を探索する対象に必要な入力。足りなければ例外 */
	requireIngredientContext(): IngredientSearchContext {
		const { ingredientEvaluator, cookingSettings, ingredientSettings } =
			this.input;
		if (!ingredientEvaluator || !cookingSettings || !ingredientSettings) {
			throw new Error(
				"Ingredient optimization requires an ingredient evaluator, cooking settings and ingredient settings",
			);
		}
		return {
			evaluator: ingredientEvaluator,
			cookingSettings,
			settings: ingredientSettings,
		};
	}

	/**
	 * 初期食材を含む組み合わせの最終確認。
	 * 起用率ごとに配分をまとめて料理だけを再計算し、起用方法の情報（入れ替え回数など）は
	 * 通常の評価器から 1 試行で取る。平均 EP の高い順に返す。
	 */
	async evaluateFinalWithStocks(
		context: IngredientSearchContext,
		candidates: readonly FinalCandidate[],
		trialCount: number,
		percentRange: PercentRange,
		excludeSleepSwaps: boolean,
	): Promise<QuickSimOptimizerResultEntry[]> {
		if (candidates.length === 0) {
			return [];
		}
		const groups = new Map<
			string,
			{ percents: QuickSimOptimizerPercents; stocks: QuickSimIngredientStock[] }
		>();
		for (const candidate of candidates) {
			const key = candidate.percents.join(",");
			const group = groups.get(key) ?? {
				percents: candidate.percents,
				stocks: [],
			};
			group.stocks.push(candidate.stock);
			groups.set(key, group);
		}
		const seeds = this.controller.seedsBetween(0, trialCount);
		const ranges = splitRange(percentRange, groups.size);
		const entries: QuickSimOptimizerResultEntry[] = [];
		let groupIndex = 0;
		for (const group of groups.values()) {
			this.throwIfAborted();
			const [start, end] = ranges[groupIndex++];
			const totalStocks = group.stocks.length;
			this.reportProgress("final", start, 0, totalStocks);
			const [metadata] = await this.input.evaluator.evaluate(
				[group.percents],
				[this.controller.seedAt(0)],
				{ excludeSleepSwaps, usePeriodSchedule: true },
			);
			if (!metadata || metadata.excluded) {
				continue;
			}
			const evaluations = await context.evaluator.evaluateIngredients(
				group.percents,
				group.stocks,
				seeds,
				{ excludeSleepSwaps, usePeriodSchedule: true },
				(completedSeeds, totalSeeds) => {
					const done = Math.floor(
						(totalStocks * completedSeeds) / Math.max(1, totalSeeds),
					);
					this.reportProgress(
						"final",
						start + ((end - start) * done) / Math.max(1, totalStocks),
						done,
						totalStocks,
					);
				},
			);
			this.throwIfAborted();
			for (const evaluation of evaluations) {
				if (evaluation.excluded) {
					continue;
				}
				entries.push({
					percents: [...group.percents],
					initialIngredients: stockToInitialIngredients(evaluation.stock),
					meanEP: meanOfFirst(evaluation.epBySeed, trialCount),
					trialCount: evaluation.epBySeed.length,
					usesSleepSwaps: metadata.usesSleepSwaps,
					unmetPokemonIds: [...metadata.unmetPokemonIds],
					swapsPerDay: metadata.swapsPerDay,
				});
			}
			this.reportProgress("final", end, totalStocks, totalStocks);
		}
		return entries.sort((left, right) => right.meanEP - left.meanEP);
	}
}

/** 1. 単体 EP 表（料理なし）。除外や失敗は 0 とみなす */
async function buildSoloTable(
	session: SearchSession,
	soloTrials: number,
): Promise<QuickSimSoloTable> {
	const memberCount = session.memberCount;
	const soloRecords: CandidateRecord[][] = [];
	const flat: CandidateRecord[] = [];
	for (let memberIndex = 0; memberIndex < memberCount; memberIndex++) {
		const row: CandidateRecord[] = [];
		for (let units = 1; units <= QUICK_SIM_OPTIMIZER_MAX_UNITS; units++) {
			const record = session.getRecord(
				buildSoloUnits(memberCount, memberIndex, units),
			);
			row.push(record);
			flat.push(record);
		}
		soloRecords.push(row);
	}
	await session.ensureTrials(flat, soloTrials, "solo", session.range("solo"), {
		disableCooking: true,
		excludeSleepSwaps: false,
	});
	return soloRecords.map((row) => [
		0,
		...row.map((record) =>
			record.excluded ? 0 : meanOfFirst(record.epBySeed, soloTrials),
		),
	]);
}

function usageKeepCount(poolSize: number): number {
	return keepCount(
		poolSize,
		QUICK_SIM_OPTIMIZER_RACING_KEEP_RATIO,
		QUICK_SIM_OPTIMIZER_RACING_MIN_KEEP,
	);
}

/** racing の各段階の進捗範囲を、見込みの仕事量（候補数 × 追加試行数）で按分する */
function buildRacingPercentRanges(
	range: PercentRange,
	poolSize: number,
	trialStages: readonly number[],
): PercentRange[] {
	const [start, end] = range;
	const works: number[] = [];
	let size = poolSize;
	let previousTrials = 0;
	for (const trials of trialStages) {
		works.push(size * (trials - previousTrials));
		previousTrials = trials;
		size = usageKeepCount(size);
	}
	const totalWork = works.reduce((sum, work) => sum + work, 0) || 1;
	const ranges: PercentRange[] = [];
	let cursor = start;
	for (const work of works) {
		const next = cursor + ((end - start) * work) / totalWork;
		ranges.push([cursor, next]);
		cursor = next;
	}
	return ranges;
}

/**
 * 2. 絞り込み + 3. racing。
 * 最初の段階で除外（就寝中の入れ替えなど）が多く候補が足りないときは、
 * 代理スコアの次点から補充する。
 */
async function runScreeningAndRacing(
	session: SearchSession,
	soloTable: QuickSimSoloTable,
): Promise<CandidateRecord[]> {
	const [screeningStart, screeningEnd] = session.range("screening");
	session.throwIfAborted();
	session.reportProgress("screening", screeningStart, 0, 0);
	let screeningLimit = QUICK_SIM_OPTIMIZER_SCREENING_LIMIT;
	const screen = (limit: number): number[][] =>
		selectTopCandidatesBySurrogate(
			soloTable,
			limit,
			QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
			QUICK_SIM_OPTIMIZER_MAX_UNITS,
			session.exclusiveGroups,
		);
	let screened = screen(screeningLimit);
	session.throwIfAborted();
	session.reportProgress(
		"screening",
		screeningEnd,
		screened.length,
		screened.length,
	);
	const trialStages = QUICK_SIM_OPTIMIZER_RACING_TRIALS;
	const ranges = buildRacingPercentRanges(
		session.range("racing"),
		screened.length,
		trialStages,
	);
	const firstTrials = trialStages[0];

	let pool = await session.ensureTrials(
		screened.map((units) => session.getRecord(units)),
		firstTrials,
		"racing",
		ranges[0],
	);
	while (
		pool.length < QUICK_SIM_OPTIMIZER_RACING_MIN_KEEP &&
		screened.length >= screeningLimit &&
		screeningLimit <
			QUICK_SIM_OPTIMIZER_SCREENING_LIMIT * SCREENING_LIMIT_MAX_MULTIPLIER
	) {
		const previousKeys = new Set(screened.map((units) => unitsKey(units)));
		screeningLimit *= 2;
		screened = screen(screeningLimit);
		const additional = screened.filter(
			(units) => !previousKeys.has(unitsKey(units)),
		);
		const evaluated = await session.ensureTrials(
			additional.map((units) => session.getRecord(units)),
			firstTrials,
			"racing",
			ranges[0],
		);
		pool = [...pool, ...evaluated];
	}

	for (let stage = 0; stage < trialStages.length; stage++) {
		const trials = trialStages[stage];
		if (stage > 0) {
			pool = await session.ensureTrials(pool, trials, "racing", ranges[stage]);
		}
		pool = sortByMeanDesc(pool, trials);
		if (stage < trialStages.length - 1) {
			pool = pool.slice(0, usageKeepCount(pool.length));
		}
	}
	return pool;
}

/** 4. 局所探索。近傍を少数試行で評価し、有望なものだけ確認試行で判定する */
async function runLocalSearch(
	session: SearchSession,
	start: CandidateRecord,
): Promise<CandidateRecord> {
	const maxIterations = QUICK_SIM_OPTIMIZER_MAX_LOCAL_SEARCH_ITERATIONS;
	const searchTrials = QUICK_SIM_OPTIMIZER_SEARCH_TRIALS;
	const neighborTrials = QUICK_SIM_OPTIMIZER_NEIGHBOR_TRIALS;
	const iterationRanges = splitRange(
		session.range("localSearch"),
		maxIterations,
	);
	let current = start;
	for (let iteration = 0; iteration < maxIterations; iteration++) {
		const range = iterationRanges[iteration];
		const neighbors = generateNeighborUnits(
			current.units,
			QUICK_SIM_OPTIMIZER_MAX_UNITS,
			session.exclusiveGroups,
		).map((units) => session.getRecord(units));
		const evaluated = await session.ensureTrials(
			neighbors,
			neighborTrials,
			"localSearch",
			partialRange(range, 0, 0.5),
		);
		const currentNeighborMean = meanOfFirst(current.epBySeed, neighborTrials);
		const promising = sortByMeanDesc(
			evaluated.filter(
				(record) =>
					meanOfFirst(record.epBySeed, neighborTrials) > currentNeighborMean,
			),
			neighborTrials,
		).slice(0, QUICK_SIM_OPTIMIZER_CONFIRM_CANDIDATES);
		if (promising.length === 0) {
			break;
		}
		const confirmed = await session.ensureTrials(
			promising,
			searchTrials,
			"localSearch",
			partialRange(range, 0.5, 1),
		);
		const best = sortByMeanDesc(confirmed, searchTrials)[0];
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

/** 起用率の探索（1〜4）。100 試行以上の候補を平均 EP の高い順に返す */
async function runUsageSearch(
	session: SearchSession,
): Promise<CandidateRecord[]> {
	const soloTable = await buildSoloTable(
		session,
		QUICK_SIM_OPTIMIZER_SOLO_TRIALS,
	);
	const racingPool = await runScreeningAndRacing(session, soloTable);
	if (racingPool.length === 0) {
		throw new Error("No candidate satisfied the constraints");
	}
	await runLocalSearch(session, racingPool[0]);
	const searchTrials = QUICK_SIM_OPTIMIZER_SEARCH_TRIALS;
	return sortByMeanDesc(
		session
			.allRecords()
			.filter(
				(record) => !record.excluded && record.epBySeed.length >= searchTrials,
			),
		searchTrials,
	);
}

function buildResult(
	session: SearchSession,
	members: readonly QuickSimOptimizerMember[],
	entries: QuickSimOptimizerResultEntry[],
	current: QuickSimOptimizerResultEntry | null,
	ingredientTotalCount?: number,
): QuickSimOptimizerResult {
	return {
		target: session.target,
		members: members.map((member) => ({ ...member })),
		entries,
		current,
		baseSeed: session.controller.baseSeed,
		...(ingredientTotalCount !== undefined ? { ingredientTotalCount } : {}),
	};
}

/** 対象 usage: 5. 最終確認。探索で試行数が十分な候補の上位を、多数の試行で評価し直す */
async function runUsageTarget(
	session: SearchSession,
	members: readonly QuickSimOptimizerMember[],
): Promise<QuickSimOptimizerResult> {
	const qualified = await runUsageSearch(session);
	const finalRange = session.range("final");
	const top = qualified.slice(0, QUICK_SIM_OPTIMIZER_RESULT_COUNT);
	const entries = await session.evaluateFinal(
		top.map((record) => record.percents),
		QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
		partialRange(finalRange, 0, 1 - FINAL_CURRENT_RATIO),
		session.excludeSleepSwaps,
	);
	const current = await session.evaluateCurrent(
		QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
		partialRange(finalRange, 1 - FINAL_CURRENT_RATIO, 1),
	);
	return buildResult(session, members, entries, current);
}

/** 対象 ingredients: 現在の起用率を固定して初期食材を探索し、上位と現在を最終確認する */
async function runIngredientsTarget(
	session: SearchSession,
	members: readonly QuickSimOptimizerMember[],
): Promise<QuickSimOptimizerResult> {
	const context = session.requireIngredientContext();
	if (!session.hasValidCurrentPercents()) {
		throw new Error("Current usage percents are not valid");
	}
	const percents = session.currentPercents;
	const { space, records } = await runIngredientSearch({
		percents,
		cookingSettings: context.cookingSettings,
		settings: context.settings,
		evaluator: context.evaluator,
		controller: session.controller,
		excludeSleepSwaps: false,
		percentRange: session.range("ingredient"),
	});
	const currentStock = initialIngredientsToStock(
		context.cookingSettings.initialIngredients,
	);
	const currentKey = stockKey(currentStock);
	const top = records.slice(0, QUICK_SIM_OPTIMIZER_RESULT_COUNT);
	const evaluated = await session.evaluateFinalWithStocks(
		context,
		[
			...top.map((record) => ({ percents, stock: record.stock })),
			{ percents, stock: currentStock },
		],
		QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
		session.range("final"),
		false,
	);
	const entryKey = (entry: QuickSimOptimizerResultEntry): string =>
		stockKey(initialIngredientsToStock(entry.initialIngredients ?? {}));
	const current =
		evaluated.find((entry) => entryKey(entry) === currentKey) ?? null;
	// 現在の配分は「現在」の行に出す。上位に同じ配分があるときは候補の行にも 1 つ残す
	const currentInTop = top.some(
		(record) => stockKey(record.stock) === currentKey,
	);
	let currentEntriesLeft = currentInTop ? 1 : 0;
	const entries = evaluated.filter((entry) => {
		if (entryKey(entry) !== currentKey) {
			return true;
		}
		if (currentEntriesLeft > 0) {
			currentEntriesLeft -= 1;
			return true;
		}
		return false;
	});
	return buildResult(
		session,
		members,
		entries.slice(0, QUICK_SIM_OPTIMIZER_RESULT_COUNT),
		current,
		space.effectiveTotalCount,
	);
}

/** 対象 both: 起用率の上位候補ごとに初期食材を探索し、組み合わせを最終確認する */
async function runBothTarget(
	session: SearchSession,
	members: readonly QuickSimOptimizerMember[],
): Promise<QuickSimOptimizerResult> {
	const context = session.requireIngredientContext();
	const qualified = await runUsageSearch(session);
	const usageCandidates = qualified.slice(
		0,
		QUICK_SIM_OPTIMIZER_JOINT_USAGE_CANDIDATES,
	);
	const ingredientRanges = splitRange(
		session.range("ingredient"),
		usageCandidates.length,
	);
	const pairs: FinalCandidate[] = [];
	let effectiveTotalCount: number | undefined;
	for (let index = 0; index < usageCandidates.length; index++) {
		const candidate = usageCandidates[index];
		const { space, records } = await runIngredientSearch({
			percents: candidate.percents,
			cookingSettings: context.cookingSettings,
			settings: context.settings,
			evaluator: context.evaluator,
			controller: session.controller,
			excludeSleepSwaps: session.excludeSleepSwaps,
			percentRange: ingredientRanges[index],
		});
		effectiveTotalCount = space.effectiveTotalCount;
		const best = records[0];
		if (best) {
			pairs.push({ percents: candidate.percents, stock: best.stock });
		}
	}
	const finalRange = session.range("final");
	const entries = await session.evaluateFinalWithStocks(
		context,
		pairs,
		QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
		partialRange(finalRange, 0, 1 - FINAL_CURRENT_RATIO),
		session.excludeSleepSwaps,
	);
	let current: QuickSimOptimizerResultEntry | null = null;
	if (session.hasValidCurrentPercents()) {
		const [entry] = await session.evaluateFinalWithStocks(
			context,
			[
				{
					percents: session.currentPercents,
					stock: initialIngredientsToStock(
						context.cookingSettings.initialIngredients,
					),
				},
			],
			QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
			partialRange(finalRange, 1 - FINAL_CURRENT_RATIO, 1),
			false,
		);
		current = entry ?? null;
	}
	return buildResult(session, members, entries, current, effectiveTotalCount);
}

/**
 * 最適化を実行する。対象は input.target（既定は起用率）。
 * 中止されたときは name が "AbortError" の例外を投げる。
 */
export async function runQuickSimOptimization(
	input: QuickSimOptimizationInput,
): Promise<QuickSimOptimizerResult> {
	if (input.members.length === 0) {
		throw new Error("No members to optimize");
	}
	const session = new SearchSession(input);
	session.throwIfAborted();
	if (optimizerTargetIncludesIngredients(session.target)) {
		// 入力の不足は探索を始める前に検出する
		session.requireIngredientContext();
	}
	switch (session.target) {
		case "ingredients":
			return runIngredientsTarget(session, input.members);
		case "both":
			return runBothTarget(session, input.members);
		default:
			return runUsageTarget(session, input.members);
	}
}
