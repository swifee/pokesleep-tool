import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTrialSeeds,
	finalizeMultiTrialResult,
	runMultiTrialSimulation,
	runTrialBatch,
} from "./MultiTrialSimulator";
import type {
	TrialBatchRequest,
	TrialBatchResponse,
} from "./TrialBatchProtocol";
import {
	mergeTrialBatchResults,
	runMultiTrialSimulationParallel,
	runTrialBatchParallel,
	splitSeeds,
} from "./TrialBatchRunner";
import { createSwapTrialInput } from "./TrialBatchTestFixtures";
import { createTrialBatchHandler } from "./TrialBatchWorkerHandler";

/**
 * In-process stand-in for a Web Worker: runs the real worker handler and
 * delivers its responses asynchronously through structured clone, like the
 * browser does.
 */
class FakeWorker extends EventTarget {
	static instances: FakeWorker[] = [];
	static failOnRun = false;
	terminated = false;
	private readonly handle: (request: TrialBatchRequest) => void;

	constructor() {
		super();
		FakeWorker.instances.push(this);
		this.handle = createTrialBatchHandler((message: TrialBatchResponse) => {
			setTimeout(() => {
				if (this.terminated) {
					return;
				}
				this.dispatchEvent(
					new MessageEvent("message", { data: structuredClone(message) }),
				);
			}, 0);
		});
	}

	postMessage(request: TrialBatchRequest): void {
		if (FakeWorker.failOnRun) {
			setTimeout(() => {
				this.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
			}, 0);
			return;
		}
		this.handle(structuredClone(request));
	}

	terminate(): void {
		this.terminated = true;
	}
}

describe("splitSeeds", () => {
	it("splits into contiguous, near-equal ranges without gaps", () => {
		const seeds = createTrialSeeds(100, 10);
		expect(splitSeeds(seeds, 3)).toEqual([
			[100, 101, 102],
			[103, 104, 105],
			[106, 107, 108, 109],
		]);
	});

	it("never creates empty chunks", () => {
		expect(splitSeeds([1, 2], 8)).toEqual([[1], [2]]);
		expect(splitSeeds([], 4)).toEqual([[]]);
	});
});

describe("mergeTrialBatchResults", () => {
	it("equals accumulating the same trials in one batch", () => {
		const input = createSwapTrialInput(1);
		const seeds = createTrialSeeds(10, 5);
		const whole = runTrialBatch(input, seeds);
		const merged = mergeTrialBatchResults(
			splitSeeds(seeds, 2).map((chunk) => runTrialBatch(input, chunk)),
		);
		expect(merged.trials).toEqual(whole.trials);
		expect(merged.state.dailyOrder).toEqual(whole.state.dailyOrder);
		expect(finalizeMultiTrialResult(merged.trials, merged.state, 5)).toEqual(
			finalizeMultiTrialResult(whole.trials, whole.state, 5),
		);
	});
});

describe("runTrialBatchParallel (no Worker available)", () => {
	beforeEach(() => {
		vi.stubGlobal("Worker", undefined);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("matches the synchronous batch trial by trial", async () => {
		const input = createSwapTrialInput(1);
		const seeds = createTrialSeeds(500, 6);
		const expected = runTrialBatch(input, seeds);
		const progress: number[] = [];
		const previews: number[] = [];

		const actual = await runTrialBatchParallel(input, seeds, {
			onProgress: (completed) => progress.push(completed),
			onPreview: ({ seed }) => previews.push(seed),
		});

		expect(actual.aborted).toBe(false);
		expect(actual.trials).toEqual(expected.trials);
		expect(actual.state).toEqual(expected.state);
		expect(previews).toEqual([500]);
		expect(progress.at(-1)).toBe(6);
	});

	it("returns the completed part when aborted", async () => {
		const input = createSwapTrialInput(1);
		const seeds = createTrialSeeds(500, 6);
		let calls = 0;
		const actual = await runTrialBatchParallel(input, seeds, {
			shouldAbort: () => ++calls >= 2,
		});
		expect(actual.aborted).toBe(true);
		expect(actual.trials.length).toBeGreaterThan(0);
		expect(actual.trials.length).toBeLessThan(seeds.length);
	});

	it("returns an empty result for no seeds", async () => {
		const actual = await runTrialBatchParallel(createSwapTrialInput(1), []);
		expect(actual.trials).toEqual([]);
		expect(actual.aborted).toBe(false);
	});
});

// The runner keeps one pool per module instance, so these tests depend on
// their order: the fallback test (which disables workers) runs last.
describe("runTrialBatchParallel (fake Workers)", () => {
	beforeEach(() => {
		FakeWorker.instances = [];
		FakeWorker.failOnRun = false;
		vi.stubGlobal("Worker", FakeWorker);
		Object.defineProperty(navigator, "hardwareConcurrency", {
			value: 3,
			configurable: true,
		});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("spreads seeds over workers and merges to the serial result", async () => {
		const input = createSwapTrialInput(1);
		const seeds = createTrialSeeds(900, 7);
		const expected = runTrialBatch(input, seeds);
		const previews: number[] = [];

		const actual = await runTrialBatchParallel(input, seeds, {
			onPreview: ({ seed }) => previews.push(seed),
		});

		expect(FakeWorker.instances.length).toBe(3);
		expect(actual.aborted).toBe(false);
		expect(actual.trials).toEqual(expected.trials);
		expect(actual.state.dailyOrder).toEqual(expected.state.dailyOrder);
		expect(finalizeMultiTrialResult(actual.trials, actual.state, 7)).toEqual(
			finalizeMultiTrialResult(expected.trials, expected.state, 7),
		);
		expect(previews).toEqual([900]);
	});

	it("reuses the pool and reproduces the serial runner for a fixed seed", async () => {
		const input = createSwapTrialInput(1);
		const serial = runMultiTrialSimulation({
			...input,
			trialCount: 5,
			initialSeed: 42,
		});
		const progress: number[] = [];
		const parallel = await runMultiTrialSimulationParallel({
			...input,
			trialCount: 5,
			initialSeed: 42,
			onProgress: (value) => progress.push(value),
		});
		// The pool from the previous run is reused: no new workers were created.
		expect(FakeWorker.instances.length).toBe(0);
		const { baseSeed, aborted, ...comparable } = parallel;
		expect(baseSeed).toBe(42);
		expect(aborted).toBe(false);
		expect(comparable).toEqual(serial);
		expect(progress[0]).toBe(0);
		expect(progress.at(-1)).toBe(100);
	});

	it("stops after the current trial on abort and keeps the completed part", async () => {
		const input = createSwapTrialInput(7);
		const seeds = createTrialSeeds(900, 300);
		const controller = new AbortController();

		const actual = await runTrialBatchParallel(input, seeds, {
			onProgress: (completed) => {
				if (completed >= 3) {
					controller.abort();
				}
			},
			signal: controller.signal,
		});

		expect(actual.aborted).toBe(true);
		expect(actual.trials.length).toBeGreaterThanOrEqual(3);
		expect(actual.trials.length).toBeLessThan(seeds.length);
		for (const trial of actual.trials) {
			expect(seeds).toContain(trial.seed);
		}
	});

	it("falls back to the current thread when the worker cannot run", async () => {
		FakeWorker.failOnRun = true;
		const input = createSwapTrialInput(1);
		const seeds = createTrialSeeds(300, 4);
		const expected = runTrialBatch(input, seeds);

		const actual = await runTrialBatchParallel(input, seeds);

		expect(actual.aborted).toBe(false);
		expect(actual.trials).toEqual(expected.trials);
		// The failed pool was released.
		expect(FakeWorker.instances.every((worker) => worker.terminated)).toBe(
			true,
		);
	});
});
