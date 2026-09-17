/**
 * QuickSimOptimizerSearchCommon.ts
 * 起用率の探索と初期食材の探索で共有する小さな道具。
 * 中止エラー、試行平均、racing の残し数、進捗範囲、進捗・中止・シードの管理。
 */

import type {
	QuickSimOptimizerPhase,
	QuickSimOptimizerProgress,
} from "../types/QuickSimOptimizerTypes";

const ABORT_ERROR_NAME = "AbortError";

export function createQuickSimOptimizerAbortError(): Error {
	const error = new Error("Quick sim optimization aborted");
	error.name = ABORT_ERROR_NAME;
	return error;
}

export function isQuickSimOptimizerAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === ABORT_ERROR_NAME;
}

/** 先頭 count 件の平均（試行数をそろえて候補を比べるため） */
export function meanOfFirst(values: readonly number[], count: number): number {
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

/** 試行結果を持つ記録 */
export interface TrialRecord {
	/** シード順の EP。先頭 n 件の平均が「n 試行の平均」 */
	epBySeed: number[];
	excluded: boolean;
}

export function sortByMeanDesc<T extends TrialRecord>(
	records: readonly T[],
	trialCount: number,
): T[] {
	return [...records].sort(
		(left, right) =>
			meanOfFirst(right.epBySeed, trialCount) -
			meanOfFirst(left.epBySeed, trialCount),
	);
}

/** racing で次の段階に残す件数（割合と最低数、候補数の小さい方） */
export function keepCount(
	poolSize: number,
	ratio: number,
	minKeep: number,
): number {
	return Math.min(poolSize, Math.max(minKeep, Math.ceil(poolSize * ratio)));
}

/** 進捗の範囲（%） */
export type PercentRange = readonly [number, number];

/** 範囲の一部（0〜1 の割合で指定） */
export function partialRange(
	range: PercentRange,
	startRatio: number,
	endRatio: number,
): PercentRange {
	const [start, end] = range;
	const width = end - start;
	return [start + width * startRatio, start + width * endRatio];
}

/** 範囲を等分する */
export function splitRange(range: PercentRange, parts: number): PercentRange[] {
	const count = Math.max(1, parts);
	return Array.from({ length: count }, (_, index) =>
		partialRange(range, index / count, (index + 1) / count),
	);
}

export interface SearchControllerInput {
	/** シードの基点。i 番目の試行はシード baseSeed + i */
	baseSeed: number;
	onProgress?: (progress: QuickSimOptimizerProgress) => void;
	signal?: AbortSignal;
}

/** 探索全体で共有する進捗・中止・シードの管理 */
export class SearchController {
	constructor(private readonly input: SearchControllerInput) {}

	get baseSeed(): number {
		return this.input.baseSeed;
	}

	seedAt(index: number): number {
		return this.input.baseSeed + index;
	}

	/** index が from 以上 to 未満のシード */
	seedsBetween(from: number, to: number): number[] {
		const seeds: number[] = [];
		for (let index = from; index < to; index++) {
			seeds.push(this.seedAt(index));
		}
		return seeds;
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
}
