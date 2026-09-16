/**
 * QuickSimOptimizerSearch.ts
 * 起用率最適化の探索手順。評価器（シミュレーション）は注入する。
 *
 * 1. 単体 EP 表: 各メンバーを単独で各単位数に置き、料理なしで少数試行する。
 * 2. 絞り込み: 単体 EP の和（代理スコア）が高い候補を上位 N 件だけ残す。
 * 3. racing: 残った候補を少ない試行で評価し、上位だけ試行を増やしていく。
 * 4. 局所探索: racing の最良から近傍（1 単位の移動・入れ替え）を試す。
 * 5. 最終確認: 上位候補と現在の起用率を、通常の実行と同じスケジュールで
 *    多数の試行により評価し直して並べる。
 *
 * 全候補で同じシード列を使う（共通乱数）ので、候補どうしの比較は同じ試行数の
 * 平均で行う。
 *
 * 同時に編成できないメンバーの組（とくべつなポケモンのルール）は exclusiveGroups で
 * 受け取り、組の起用率の合計が 100% を超える候補は最初から生成しない。
 * 評価器側のスケジューラも同じ組を同時に置かないので、結果を適用してもルールを守る。
 */

import {
	DEFAULT_QUICK_SIM_OPTIMIZER_OPTIONS,
	QUICK_SIM_OPTIMIZER_CONFIRM_CANDIDATES,
	QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
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
	type QuickSimOptimizerEvaluator,
	type QuickSimOptimizerExclusiveGroups,
	type QuickSimOptimizerMember,
	type QuickSimOptimizerOptions,
	type QuickSimOptimizerPercents,
	type QuickSimOptimizerPhase,
	type QuickSimOptimizerProgress,
	type QuickSimOptimizerResult,
	type QuickSimOptimizerResultEntry,
} from "../types/QuickSimOptimizerTypes";
import { QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT } from "../types/QuickSimTypes";
import {
	buildSoloUnits,
	generateNeighborUnits,
	type QuickSimOptimizerUnits,
	type QuickSimSoloTable,
	selectTopCandidatesBySurrogate,
	unitsKey,
	unitsToPercents,
} from "./QuickSimOptimizerCandidates";

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

/** 進捗の段階ごとの範囲（%） */
const PHASE_PERCENT_RANGE: Readonly<
	Record<QuickSimOptimizerPhase, readonly [number, number]>
> = {
	solo: [0, 5],
	screening: [5, 6],
	racing: [6, 55],
	localSearch: [55, 75],
	final: [75, 100],
};

/** 絞り込みで候補が足りないときに件数を増やす上限（倍率） */
const SCREENING_LIMIT_MAX_MULTIPLIER = 4;

const ABORT_ERROR_NAME = "AbortError";

export function createQuickSimOptimizerAbortError(): Error {
	const error = new Error("Quick sim optimization aborted");
	error.name = ABORT_ERROR_NAME;
	return error;
}

export function isQuickSimOptimizerAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === ABORT_ERROR_NAME;
}

function meanOfFirst(values: readonly number[], count: number): number {
	const n = Math.min(count, values.length);
	if (n <= 0) {
		return 0;
	}
	let sum = 0;
	for (let index = 0; index < n; index++) {
		sum += values[index];
	}
	return sum / n;
}

/**
 * 探索の状態。候補の評価結果を蓄積し、必要な試行数だけ評価器に依頼する。
 */
class SearchSession {
	private readonly records = new Map<string, CandidateRecord>();
	private readonly options: QuickSimOptimizerOptions;

	constructor(private readonly input: QuickSimOptimizationInput) {
		this.options = {
			...DEFAULT_QUICK_SIM_OPTIMIZER_OPTIONS,
			...input.options,
		};
	}

	get memberCount(): number {
		return this.input.members.length;
	}

	get exclusiveGroups(): QuickSimOptimizerExclusiveGroups {
		return this.input.exclusiveGroups ?? [];
	}

	throwIfAborted(): void {
		if (this.input.signal?.aborted) {
			throw createQuickSimOptimizerAbortError();
		}
	}

	reportProgress(
		phase: QuickSimOptimizerPhase,
		percent: number,
		completed: number,
		total: number,
	): void {
		this.input.onProgress?.({
			phase,
			percent: Math.max(0, Math.min(100, Math.round(percent))),
			completed,
			total,
		});
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

	private seedAt(index: number): number {
		return this.input.baseSeed + index;
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
		percentRange: readonly [number, number],
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
			const seeds: number[] = [];
			for (let index = have; index < trialCount; index++) {
				seeds.push(this.seedAt(index));
			}
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
		percentRange: readonly [number, number],
		excludeSleepSwaps: boolean,
	): Promise<QuickSimOptimizerResultEntry[]> {
		if (candidates.length === 0) {
			return [];
		}
		this.throwIfAborted();
		const seeds: number[] = [];
		for (let index = 0; index < trialCount; index++) {
			seeds.push(this.seedAt(index));
		}
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

	/** 現在の起用率を同じシードで評価する（候補の格子に乗っていなくてもよい） */
	async evaluateCurrent(
		trialCount: number,
		percentRange: readonly [number, number],
	): Promise<QuickSimOptimizerResultEntry | null> {
		const percents = [...this.input.currentPercents];
		if (percents.length !== this.memberCount) {
			return null;
		}
		const total = percents.reduce((sum, percent) => sum + percent, 0);
		if (total <= 0 || total > QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT) {
			return null;
		}
		const [entry] = await this.evaluateFinal(
			[percents],
			trialCount,
			percentRange,
			false,
		);
		return entry ?? null;
	}

	get excludeSleepSwaps(): boolean {
		return this.options.excludeSleepSwaps;
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
	await session.ensureTrials(
		flat,
		soloTrials,
		"solo",
		PHASE_PERCENT_RANGE.solo,
		{
			disableCooking: true,
			excludeSleepSwaps: false,
		},
	);
	return soloRecords.map((row) => [
		0,
		...row.map((record) =>
			record.excluded ? 0 : meanOfFirst(record.epBySeed, soloTrials),
		),
	]);
}

function keepCount(poolSize: number): number {
	return Math.min(
		poolSize,
		Math.max(
			QUICK_SIM_OPTIMIZER_RACING_MIN_KEEP,
			Math.ceil(poolSize * QUICK_SIM_OPTIMIZER_RACING_KEEP_RATIO),
		),
	);
}

function sortByMeanDesc(
	records: readonly CandidateRecord[],
	trialCount: number,
): CandidateRecord[] {
	return [...records].sort(
		(left, right) =>
			meanOfFirst(right.epBySeed, trialCount) -
			meanOfFirst(left.epBySeed, trialCount),
	);
}

/** racing の各段階の進捗範囲を、見込みの仕事量（候補数 × 追加試行数）で按分する */
function buildRacingPercentRanges(
	poolSize: number,
	trialStages: readonly number[],
): [number, number][] {
	const [start, end] = PHASE_PERCENT_RANGE.racing;
	const works: number[] = [];
	let size = poolSize;
	let previousTrials = 0;
	for (const trials of trialStages) {
		works.push(size * (trials - previousTrials));
		previousTrials = trials;
		size = keepCount(size);
	}
	const totalWork = works.reduce((sum, work) => sum + work, 0) || 1;
	const ranges: [number, number][] = [];
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
	const [screeningStart, screeningEnd] = PHASE_PERCENT_RANGE.screening;
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
	const ranges = buildRacingPercentRanges(screened.length, trialStages);
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
			pool = pool.slice(0, keepCount(pool.length));
		}
	}
	return pool;
}

/** 4. 局所探索。近傍を少数試行で評価し、有望なものだけ確認試行で判定する */
async function runLocalSearch(
	session: SearchSession,
	start: CandidateRecord,
): Promise<CandidateRecord> {
	const [phaseStart, phaseEnd] = PHASE_PERCENT_RANGE.localSearch;
	const maxIterations = QUICK_SIM_OPTIMIZER_MAX_LOCAL_SEARCH_ITERATIONS;
	const searchTrials = QUICK_SIM_OPTIMIZER_SEARCH_TRIALS;
	const neighborTrials = QUICK_SIM_OPTIMIZER_NEIGHBOR_TRIALS;
	let current = start;
	for (let iteration = 0; iteration < maxIterations; iteration++) {
		const iterationStart =
			phaseStart + ((phaseEnd - phaseStart) * iteration) / maxIterations;
		const iterationEnd =
			phaseStart + ((phaseEnd - phaseStart) * (iteration + 1)) / maxIterations;
		const iterationMid = (iterationStart + iterationEnd) / 2;
		const neighbors = generateNeighborUnits(
			current.units,
			QUICK_SIM_OPTIMIZER_MAX_UNITS,
			session.exclusiveGroups,
		).map((units) => session.getRecord(units));
		const evaluated = await session.ensureTrials(
			neighbors,
			neighborTrials,
			"localSearch",
			[iterationStart, iterationMid],
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
			[iterationMid, iterationEnd],
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

/** 5. 最終確認。探索で試行数が十分な候補の上位を、多数の試行で評価し直す */
async function runFinalEvaluation(
	session: SearchSession,
	members: readonly QuickSimOptimizerMember[],
	baseSeed: number,
): Promise<QuickSimOptimizerResult> {
	const [phaseStart, phaseEnd] = PHASE_PERCENT_RANGE.final;
	const searchTrials = QUICK_SIM_OPTIMIZER_SEARCH_TRIALS;
	const finalTrials = QUICK_SIM_OPTIMIZER_FINAL_TRIALS;
	const qualified = session
		.allRecords()
		.filter(
			(record) => !record.excluded && record.epBySeed.length >= searchTrials,
		);
	const top = sortByMeanDesc(qualified, searchTrials).slice(
		0,
		QUICK_SIM_OPTIMIZER_RESULT_COUNT,
	);
	const currentRangeStart = phaseStart + (phaseEnd - phaseStart) * 0.9;
	const entries = await session.evaluateFinal(
		top.map((record) => record.percents),
		finalTrials,
		[phaseStart, currentRangeStart],
		session.excludeSleepSwaps,
	);
	const current = await session.evaluateCurrent(finalTrials, [
		currentRangeStart,
		phaseEnd,
	]);
	return {
		members: members.map((member) => ({ ...member })),
		entries,
		current,
		baseSeed,
	};
}

/**
 * 起用率の最適化を実行する。
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
	const soloTable = await buildSoloTable(
		session,
		QUICK_SIM_OPTIMIZER_SOLO_TRIALS,
	);
	const racingPool = await runScreeningAndRacing(session, soloTable);
	if (racingPool.length === 0) {
		throw new Error("No candidate satisfied the constraints");
	}
	await runLocalSearch(session, racingPool[0]);
	return runFinalEvaluation(session, input.members, input.baseSeed);
}
