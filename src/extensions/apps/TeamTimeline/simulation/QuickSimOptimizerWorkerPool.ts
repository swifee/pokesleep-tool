/**
 * QuickSimOptimizerWorkerPool.ts
 * 複数の Web Worker に候補の評価を分配する評価器。
 *
 * 仕事は小さなタスクに分け、手の空いたワーカーが順に取る（動的な割り当て）。
 * コアの速さが揃わない端末でも、遅いワーカー 1 つに全体が引きずられない。
 * - 候補が多いとき: 候補をまとめた束をタスクにする（束の中では同じ候補の
 *   スケジュールを試行間で使い回せる）。
 * - 候補が少なく試行が多いとき（最終確認など）: 候補ごとにシード列を分割して
 *   タスクにし、1 候補の 1,000 試行も全ワーカーで手分けする。
 *
 * Worker が使えない環境ではメインスレッドの QuickSimEvaluator にフォールバックする。
 */

import type {
	QuickSimCandidateEvaluation,
	QuickSimOptimizerEvaluateOptions,
	QuickSimOptimizerEvaluator,
	QuickSimOptimizerPercents,
} from "../types/QuickSimOptimizerTypes";
import { createQuickSimOptimizerAbortError } from "../utils/QuickSimOptimizerSearch";
import {
	QuickSimEvaluator,
	type QuickSimEvaluatorContext,
} from "./QuickSimEvaluator";
import {
	type QuickSimOptimizerWorkerRequest,
	type QuickSimOptimizerWorkerResponse,
	serializeQuickSimEvaluatorContext,
} from "./QuickSimOptimizerWorkerProtocol";

/** 同時に使うワーカー数の上限 */
export const QUICK_SIM_OPTIMIZER_MAX_WORKERS = 8;
/** 論理コア数が分からないときのワーカー数 */
const DEFAULT_WORKER_COUNT = 2;
/** 候補を束にするときの 1 タスクあたりの候補数 */
const CANDIDATES_PER_TASK = 16;
/** シード列を分割するときの 1 タスクあたりの試行数 */
const SEEDS_PER_TASK = 50;
/** 候補数がワーカー数のこの倍数未満なら、候補ではなくシード列を分割する */
const SEED_SPLIT_CANDIDATE_RATIO = 2;

/** 評価器と、使い終わったときの後始末 */
export interface QuickSimOptimizerEvaluatorHandle {
	evaluator: QuickSimOptimizerEvaluator;
	dispose: () => void;
}

interface PendingRequest {
	resolve: (evaluations: QuickSimCandidateEvaluation[]) => void;
	reject: (error: Error) => void;
	onProgress: (completed: number) => void;
}

/** ワーカーに渡す 1 単位の仕事 */
interface EvaluationTask {
	/** 元の候補配列での位置 */
	candidateIndexes: number[];
	/** 元のシード配列での開始位置 */
	seedOffset: number;
	seeds: number[];
}

/** 論理コア数（1〜上限）をワーカーに使う */
export function resolveQuickSimOptimizerWorkerCount(
	hardwareConcurrency: number | undefined,
): number {
	const cores =
		hardwareConcurrency !== undefined && hardwareConcurrency > 0
			? hardwareConcurrency
			: DEFAULT_WORKER_COUNT;
	return Math.max(1, Math.min(QUICK_SIM_OPTIMIZER_MAX_WORKERS, cores));
}

/**
 * 候補とシードをタスクに分ける。
 * 候補が十分多ければ候補の束、少なければ候補ごとのシード分割にする。
 */
export function buildEvaluationTasks(
	candidateCount: number,
	seeds: readonly number[],
	workerCount: number,
): EvaluationTask[] {
	const tasks: EvaluationTask[] = [];
	if (candidateCount === 0 || seeds.length === 0) {
		return tasks;
	}
	const splitSeeds =
		candidateCount < workerCount * SEED_SPLIT_CANDIDATE_RATIO &&
		seeds.length > SEEDS_PER_TASK;
	if (splitSeeds) {
		for (let index = 0; index < candidateCount; index++) {
			for (let offset = 0; offset < seeds.length; offset += SEEDS_PER_TASK) {
				tasks.push({
					candidateIndexes: [index],
					seedOffset: offset,
					seeds: seeds.slice(offset, offset + SEEDS_PER_TASK),
				});
			}
		}
		return tasks;
	}
	for (let start = 0; start < candidateCount; start += CANDIDATES_PER_TASK) {
		const end = Math.min(candidateCount, start + CANDIDATES_PER_TASK);
		tasks.push({
			candidateIndexes: Array.from(
				{ length: end - start },
				(_, offset) => start + offset,
			),
			seedOffset: 0,
			seeds: [...seeds],
		});
	}
	return tasks;
}

export class QuickSimOptimizerWorkerPool implements QuickSimOptimizerEvaluator {
	private readonly pending = new Map<number, PendingRequest>();
	private nextRequestId = 1;
	private terminated = false;

	private constructor(private readonly workers: readonly Worker[]) {
		for (const worker of workers) {
			worker.addEventListener("message", this.handleMessage);
			worker.addEventListener("error", this.handleWorkerError);
		}
	}

	static isSupported(): boolean {
		return typeof Worker !== "undefined";
	}

	get workerCount(): number {
		return this.workers.length;
	}

	/** ワーカーを起動して評価器の文脈を送り、全員の準備が整うまで待つ */
	static async create(
		context: QuickSimEvaluatorContext,
		workerCount: number,
	): Promise<QuickSimOptimizerWorkerPool> {
		const { createQuickSimOptimizerWorker } = await import(
			"./createQuickSimOptimizerWorker.mjs"
		);
		const serialized = serializeQuickSimEvaluatorContext(context);
		const workers: Worker[] = [];
		try {
			for (let index = 0; index < Math.max(1, workerCount); index++) {
				workers.push(createQuickSimOptimizerWorker());
			}
			await Promise.all(
				workers.map(
					(worker) =>
						new Promise<void>((resolve, reject) => {
							const handleReady = (
								event: MessageEvent<QuickSimOptimizerWorkerResponse>,
							) => {
								if (event.data.type === "ready") {
									cleanup();
									resolve();
								} else if (event.data.type === "error") {
									cleanup();
									reject(new Error(event.data.message));
								}
							};
							const handleError = (event: ErrorEvent) => {
								cleanup();
								reject(new Error(event.message || "Worker failed to start"));
							};
							const cleanup = () => {
								worker.removeEventListener("message", handleReady);
								worker.removeEventListener("error", handleError);
							};
							worker.addEventListener("message", handleReady);
							worker.addEventListener("error", handleError);
							const request: QuickSimOptimizerWorkerRequest = {
								type: "init",
								context: serialized,
							};
							worker.postMessage(request);
						}),
				),
			);
		} catch (error) {
			for (const worker of workers) {
				worker.terminate();
			}
			throw error;
		}
		return new QuickSimOptimizerWorkerPool(workers);
	}

	private readonly handleMessage = (
		event: MessageEvent<QuickSimOptimizerWorkerResponse>,
	): void => {
		const response = event.data;
		if (response.type === "ready") {
			return;
		}
		if (response.requestId === null) {
			return;
		}
		const request = this.pending.get(response.requestId);
		if (!request) {
			return;
		}
		if (response.type === "progress") {
			request.onProgress(response.completed);
			return;
		}
		this.pending.delete(response.requestId);
		if (response.type === "result") {
			request.resolve(response.evaluations);
		} else {
			request.reject(new Error(response.message));
		}
	};

	private readonly handleWorkerError = (event: ErrorEvent): void => {
		const error = new Error(
			event.message || "Quick sim optimizer worker failed",
		);
		for (const request of this.pending.values()) {
			request.reject(error);
		}
		this.pending.clear();
	};

	private postEvaluate(
		worker: Worker,
		candidates: number[][],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress: (completed: number) => void,
	): Promise<QuickSimCandidateEvaluation[]> {
		return new Promise((resolve, reject) => {
			if (this.terminated) {
				reject(createQuickSimOptimizerAbortError());
				return;
			}
			const requestId = this.nextRequestId++;
			this.pending.set(requestId, { resolve, reject, onProgress });
			const request: QuickSimOptimizerWorkerRequest = {
				type: "evaluate",
				requestId,
				candidates,
				seeds: [...seeds],
				options,
			};
			worker.postMessage(request);
		});
	}

	async evaluate(
		candidates: readonly QuickSimOptimizerPercents[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): Promise<QuickSimCandidateEvaluation[]> {
		const tasks = buildEvaluationTasks(
			candidates.length,
			seeds,
			this.workers.length,
		);
		const results: (QuickSimCandidateEvaluation | undefined)[] = candidates.map(
			() => undefined,
		);
		// 進捗は「候補 × 試行」の単位で数え、候補数に換算して知らせる
		const totalUnits = candidates.length * seeds.length;
		let completedUnits = 0;
		const inFlightUnits = new Map<number, number>();
		const reportProgress = (): void => {
			if (!onProgress || totalUnits === 0) {
				return;
			}
			let units = completedUnits;
			for (const value of inFlightUnits.values()) {
				units += value;
			}
			onProgress(
				Math.min(candidates.length, Math.floor(units / seeds.length)),
				candidates.length,
			);
		};
		const mergeTaskResult = (
			task: EvaluationTask,
			evaluations: QuickSimCandidateEvaluation[],
		): void => {
			task.candidateIndexes.forEach((candidateIndex, position) => {
				const evaluation = evaluations[position];
				const existing = results[candidateIndex];
				if (!existing) {
					const epBySeed: number[] = [];
					evaluation.epBySeed.forEach((ep, offset) => {
						epBySeed[task.seedOffset + offset] = ep;
					});
					results[candidateIndex] = { ...evaluation, epBySeed };
					return;
				}
				evaluation.epBySeed.forEach((ep, offset) => {
					existing.epBySeed[task.seedOffset + offset] = ep;
				});
			});
		};

		let nextTask = 0;
		const runWorker = async (worker: Worker, workerIndex: number) => {
			while (nextTask < tasks.length) {
				const task = tasks[nextTask++];
				const taskUnits = task.candidateIndexes.length * task.seeds.length;
				const evaluations = await this.postEvaluate(
					worker,
					task.candidateIndexes.map((index) => [...candidates[index]]),
					task.seeds,
					options,
					(completed) => {
						inFlightUnits.set(workerIndex, completed * task.seeds.length);
						reportProgress();
					},
				);
				inFlightUnits.delete(workerIndex);
				completedUnits += taskUnits;
				mergeTaskResult(task, evaluations);
				reportProgress();
			}
		};
		await Promise.all(
			this.workers.map((worker, workerIndex) => runWorker(worker, workerIndex)),
		);
		return results.map((result, index) => {
			if (!result) {
				throw new Error(`Candidate ${index} was not evaluated`);
			}
			// 除外された候補は試行を持たない
			return result.excluded ? { ...result, epBySeed: [] } : result;
		});
	}

	/** ワーカーを止める。待ち中の評価は中止エラーになる */
	terminate(): void {
		this.terminated = true;
		for (const worker of this.workers) {
			worker.removeEventListener("message", this.handleMessage);
			worker.removeEventListener("error", this.handleWorkerError);
			worker.terminate();
		}
		const error = createQuickSimOptimizerAbortError();
		for (const request of this.pending.values()) {
			request.reject(error);
		}
		this.pending.clear();
	}
}

/**
 * 環境に応じた評価器を用意する。
 * Worker が使えればワーカープール、使えない（またはワーカーの起動に失敗した）
 * ときはメインスレッドの評価器を返す。
 */
export async function createQuickSimOptimizerEvaluator(
	context: QuickSimEvaluatorContext,
): Promise<QuickSimOptimizerEvaluatorHandle> {
	if (QuickSimOptimizerWorkerPool.isSupported()) {
		try {
			const pool = await QuickSimOptimizerWorkerPool.create(
				context,
				resolveQuickSimOptimizerWorkerCount(
					typeof navigator !== "undefined"
						? navigator.hardwareConcurrency
						: undefined,
				),
			);
			return { evaluator: pool, dispose: () => pool.terminate() };
		} catch {
			// ワーカーが起動できなければメインスレッドで計算する
		}
	}
	return { evaluator: new QuickSimEvaluator(context), dispose: () => {} };
}
