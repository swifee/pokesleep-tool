/**
 * TrialBatchRunner.ts
 * Runs a batch of trials on a pool of Web Workers (one contiguous seed range
 * per worker) and merges the per-worker sums into a single result. Falls back
 * to the current thread where workers are unavailable (jsdom tests, very old
 * browsers), with the same partial-result semantics on abort.
 */

import type { MultiTrialResult, TrialSummary } from "../types/MultiTrialTypes";
import type { SimulationResult } from "../types/TimeSlotTypes";
import {
	createAggregationState,
	createTrialSeeds,
	finalizeMultiTrialResult,
	type MultiTrialInput,
	mergeAggregationStates,
	resolveBaseSeed,
	runTrialBatchAsync,
	type TrialBatchResult,
	type TrialSimulationInput,
} from "./MultiTrialSimulator";
import {
	serializeTrialSimulationInput,
	type TrialBatchRequest,
	type TrialBatchResponse,
} from "./TrialBatchProtocol";

export interface TrialBatchRunOptions {
	/** Progress in completed trials; throttled to a few updates per second. */
	onProgress?: (completed: number, total: number) => void;
	/** Full result of the first seed, for showing something before the batch ends. */
	onPreview?: (trial: { seed: number; result: SimulationResult }) => void;
	/** Polled at each progress update; true stops the batch after the current trial. */
	shouldAbort?: () => boolean;
	/** Aborting stops the batch after the current trial. */
	signal?: AbortSignal;
}

export interface TrialBatchRunResult extends TrialBatchResult {
	/** True when the batch stopped early; `trials` then holds the completed part. */
	aborted: boolean;
}

/** Upper bound on pool size; each worker holds its own copy of the data tables. */
const MAX_WORKER_COUNT = 8;
const DEFAULT_WORKER_COUNT = 2;
/** Minimum spacing of onProgress calls, so 8 workers don't flood React state. */
const PROGRESS_EMIT_INTERVAL_MS = 100;
/** How long to wait for workers to acknowledge a stop before terminating them. */
const STOP_TIMEOUT_MS = 2000;
/** Idle workers are released after this long to give memory back on mobile. */
const IDLE_DISPOSE_DELAY_MS = 60_000;

/** The worker itself failed (could not load or crashed), not the simulation. */
class WorkerUnavailableError extends Error {
	constructor(detail: string) {
		super(`Simulation worker unavailable: ${detail}`);
		this.name = "WorkerUnavailableError";
	}
}

let poolPromise: Promise<Worker[]> | null = null;
let workersUnavailable = false;
let runQueue: Promise<unknown> = Promise.resolve();
let nextJobId = 1;
let idleDisposeTimer: ReturnType<typeof setTimeout> | null = null;

function isWorkerSupported(): boolean {
	return typeof Worker !== "undefined" && !workersUnavailable;
}

function resolveWorkerCount(): number {
	const hardwareConcurrency =
		typeof navigator !== "undefined"
			? navigator.hardwareConcurrency
			: undefined;
	return Math.max(
		1,
		Math.min(MAX_WORKER_COUNT, hardwareConcurrency ?? DEFAULT_WORKER_COUNT),
	);
}

function getWorkerPool(): Promise<Worker[]> {
	if (poolPromise === null) {
		// Dynamic import: the factory is the only ESM (.mts) file in an
		// otherwise CommonJS-typechecked tree (see its own file comment).
		poolPromise = import("./createTimelineSimulationWorker.mjs").then((m) =>
			Array.from({ length: resolveWorkerCount() }, () =>
				m.createTimelineSimulationWorker(),
			),
		);
	}
	return poolPromise;
}

function disposeWorkerPool(): void {
	const pool = poolPromise;
	poolPromise = null;
	void pool?.then((workers) => {
		for (const worker of workers) {
			worker.terminate();
		}
	});
}

function scheduleIdleDisposal(): void {
	cancelIdleDisposal();
	idleDisposeTimer = setTimeout(() => {
		idleDisposeTimer = null;
		disposeWorkerPool();
	}, IDLE_DISPOSE_DELAY_MS);
}

function cancelIdleDisposal(): void {
	if (idleDisposeTimer !== null) {
		clearTimeout(idleDisposeTimer);
		idleDisposeTimer = null;
	}
}

/** Split seeds into `count` contiguous ranges of (almost) equal length. */
export function splitSeeds(
	seeds: readonly number[],
	count: number,
): number[][] {
	const chunkCount = Math.max(1, Math.min(count, seeds.length));
	const chunks: number[][] = [];
	for (let index = 0; index < chunkCount; index++) {
		const start = Math.floor((index * seeds.length) / chunkCount);
		const end = Math.floor(((index + 1) * seeds.length) / chunkCount);
		chunks.push(seeds.slice(start, end));
	}
	return chunks;
}

/** Merge per-chunk results in chunk order (= seed order). */
export function mergeTrialBatchResults(
	results: readonly TrialBatchResult[],
): TrialBatchResult {
	const state = createAggregationState();
	const trials: TrialSummary[] = [];
	for (const result of results) {
		trials.push(...result.trials);
		mergeAggregationStates(state, result.state);
	}
	return { trials, state };
}

function createProgressEmitter(
	total: number,
	onProgress: TrialBatchRunOptions["onProgress"],
): (completed: number, force?: boolean) => void {
	let lastEmittedAt = 0;
	let lastEmitted = -1;
	return (completed, force = false) => {
		if (!onProgress || completed === lastEmitted) {
			return;
		}
		const now = Date.now();
		if (!force && now - lastEmittedAt < PROGRESS_EMIT_INTERVAL_MS) {
			return;
		}
		lastEmittedAt = now;
		lastEmitted = completed;
		onProgress(completed, total);
	};
}

async function runInThread(
	input: TrialSimulationInput,
	seeds: readonly number[],
	options: TrialBatchRunOptions,
): Promise<TrialBatchRunResult> {
	const emitProgress = createProgressEmitter(seeds.length, options.onProgress);
	let aborted = false;
	const { trials, state } = await runTrialBatchAsync(input, seeds, {
		shouldStop: () => {
			if (options.signal?.aborted || options.shouldAbort?.()) {
				aborted = true;
			}
			return aborted;
		},
		onTrialComplete: ({ index, seed, result }) => {
			if (index === 0) {
				options.onPreview?.({ seed, result });
			}
		},
		onProgress: (completed) => emitProgress(completed),
	});
	emitProgress(trials.length, true);
	return { trials, state, aborted };
}

interface WorkerJob {
	jobId: number;
	worker: Worker;
	seeds: number[];
	completed: number;
	result: TrialBatchResult | null;
}

function runOnWorkers(
	workers: Worker[],
	input: TrialSimulationInput,
	seeds: readonly number[],
	options: TrialBatchRunOptions,
): Promise<TrialBatchRunResult> {
	const serializedInput = serializeTrialSimulationInput(input);
	const jobs: WorkerJob[] = splitSeeds(seeds, workers.length).map(
		(chunkSeeds, index) => ({
			jobId: nextJobId++,
			worker: workers[index],
			seeds: chunkSeeds,
			completed: 0,
			result: null,
		}),
	);
	const emitProgress = createProgressEmitter(seeds.length, options.onProgress);

	return new Promise<TrialBatchRunResult>((resolve, reject) => {
		let settled = false;
		let stopRequested = false;
		let stopTimer: ReturnType<typeof setTimeout> | null = null;
		const listeners: {
			job: WorkerJob;
			onMessage: (event: MessageEvent<TrialBatchResponse>) => void;
			onError: (event: Event) => void;
		}[] = [];

		function totalCompleted(): number {
			return jobs.reduce((sum, job) => sum + job.completed, 0);
		}

		function cleanup(): void {
			settled = true;
			if (stopTimer !== null) {
				clearTimeout(stopTimer);
			}
			options.signal?.removeEventListener("abort", requestStop);
			for (const { job, onMessage, onError } of listeners) {
				job.worker.removeEventListener("message", onMessage);
				job.worker.removeEventListener("error", onError);
				job.worker.removeEventListener("messageerror", onError);
			}
		}

		function finish(): void {
			cleanup();
			const merged = mergeTrialBatchResults(
				jobs.map(
					(job) =>
						job.result ?? { trials: [], state: createAggregationState() },
				),
			);
			emitProgress(merged.trials.length, true);
			resolve({ ...merged, aborted: stopRequested });
		}

		function fail(error: Error): void {
			cleanup();
			reject(error);
		}

		function requestStop(): void {
			if (settled || stopRequested) {
				return;
			}
			stopRequested = true;
			for (const job of jobs) {
				if (job.result === null) {
					const message: TrialBatchRequest = { type: "stop", jobId: job.jobId };
					job.worker.postMessage(message);
				}
			}
			// A worker that doesn't answer in time is stuck in a very long
			// trial: drop its part and rebuild the pool afterwards.
			stopTimer = setTimeout(() => {
				disposeWorkerPool();
				finish();
			}, STOP_TIMEOUT_MS);
		}

		function handleMessage(job: WorkerJob, message: TrialBatchResponse): void {
			switch (message.type) {
				case "progress":
					job.completed = message.completed;
					emitProgress(totalCompleted());
					if (options.shouldAbort?.()) {
						requestStop();
					}
					break;
				case "preview":
					options.onPreview?.({ seed: message.seed, result: message.result });
					break;
				case "done":
					job.result = { trials: message.trials, state: message.state };
					job.completed = message.trials.length;
					if (jobs.every((other) => other.result !== null)) {
						finish();
					} else {
						emitProgress(totalCompleted());
					}
					break;
				case "error":
					fail(new Error(message.message));
					break;
			}
		}

		for (const job of jobs) {
			const onMessage = (event: MessageEvent<TrialBatchResponse>): void => {
				if (!settled && event.data.jobId === job.jobId) {
					handleMessage(job, event.data);
				}
			};
			const onError = (event: Event): void => {
				const detail =
					event instanceof ErrorEvent ? event.message : "worker failure";
				fail(new WorkerUnavailableError(detail));
			};
			job.worker.addEventListener("message", onMessage);
			job.worker.addEventListener("error", onError);
			job.worker.addEventListener("messageerror", onError);
			listeners.push({ job, onMessage, onError });
		}

		options.signal?.addEventListener("abort", requestStop);

		for (const job of jobs) {
			const message: TrialBatchRequest = {
				type: "run",
				jobId: job.jobId,
				input: serializedInput,
				seeds: job.seeds,
				previewFirstTrial: job === jobs[0] && options.onPreview !== undefined,
			};
			job.worker.postMessage(message);
		}

		if (options.signal?.aborted || options.shouldAbort?.()) {
			requestStop();
		}
	});
}

async function runOnWorkerPool(
	input: TrialSimulationInput,
	seeds: readonly number[],
	options: TrialBatchRunOptions,
): Promise<TrialBatchRunResult> {
	cancelIdleDisposal();
	try {
		const workers = await getWorkerPool();
		return await runOnWorkers(workers, input, seeds, options);
	} catch (error) {
		if (!(error instanceof WorkerUnavailableError)) {
			throw error;
		}
		// Workers cannot run here (e.g. module workers unsupported): give the
		// batch to the current thread and stay there for the rest of the session.
		workersUnavailable = true;
		disposeWorkerPool();
		return runInThread(input, seeds, options);
	} finally {
		if (poolPromise !== null) {
			scheduleIdleDisposal();
		}
	}
}

/**
 * Run `seeds` for `input`, in parallel on Web Workers when available.
 * Runs are serialized so concurrent callers (simulation, analysis) never
 * compete for the same workers.
 */
export function runTrialBatchParallel(
	input: TrialSimulationInput,
	seeds: readonly number[],
	options: TrialBatchRunOptions = {},
): Promise<TrialBatchRunResult> {
	if (seeds.length === 0) {
		return Promise.resolve({
			trials: [],
			state: createAggregationState(),
			aborted: false,
		});
	}
	if (!isWorkerSupported()) {
		return runInThread(input, seeds, options);
	}
	const run = runQueue.then(() => runOnWorkerPool(input, seeds, options));
	runQueue = run.catch(() => undefined);
	return run;
}

export interface ParallelMultiTrialInput extends MultiTrialInput {
	/** Progress in percent (0–100). */
	readonly onProgress?: (progress: number) => void;
	readonly onPreview?: TrialBatchRunOptions["onPreview"];
	readonly shouldAbort?: () => boolean;
	readonly signal?: AbortSignal;
}

export interface ParallelMultiTrialResult extends MultiTrialResult {
	/** Seed of the first trial (initialSeed, or the random base that was drawn). */
	baseSeed: number;
	/** True when the run stopped early; averages then cover the completed trials. */
	aborted: boolean;
}

/**
 * {@link runMultiTrialSimulationWithProgress} equivalent that spreads the
 * trials over Web Workers. Seeds and aggregation are identical to the
 * in-thread runner, so a fixed initial seed reproduces the same trials.
 */
export async function runMultiTrialSimulationParallel(
	input: ParallelMultiTrialInput,
): Promise<ParallelMultiTrialResult> {
	const { trialCount, onProgress } = input;
	if (trialCount <= 0) {
		throw new Error("trialCount must be greater than 0");
	}
	const baseSeed = resolveBaseSeed(input.initialSeed);
	const seeds = createTrialSeeds(baseSeed, trialCount);
	onProgress?.(0);
	const { trials, state, aborted } = await runTrialBatchParallel(input, seeds, {
		onProgress: (completed, total) =>
			onProgress?.(Math.round((completed / total) * 100)),
		onPreview: input.onPreview,
		shouldAbort: input.shouldAbort,
		signal: input.signal,
	});
	return {
		...finalizeMultiTrialResult(trials, state, trials.length),
		baseSeed,
		aborted,
	};
}
