import { afterEach, describe, expect, it, vi } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import type { QuickSimOptimizerMember } from "../types/QuickSimOptimizerTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
} from "../types/TimeSlotTypes";
import { initialIngredientsToStock } from "../utils/QuickSimIngredientCandidates";
import {
	buildStrengthParameterFromTimelineBonusSettings,
	createDefaultTimelineBonusSettings,
} from "../utils/TimelineBonusSettingsBridge";
import {
	QuickSimEvaluator,
	type QuickSimEvaluatorContext,
} from "./QuickSimEvaluator";
import {
	buildEvaluationTasks,
	buildIngredientEvaluationTasks,
	QuickSimOptimizerWorkerPool,
	resolveQuickSimOptimizerWorkerCount,
} from "./QuickSimOptimizerWorkerPool";
import {
	deserializeQuickSimEvaluatorContext,
	type QuickSimOptimizerWorkerRequest,
	type QuickSimOptimizerWorkerResponse,
} from "./QuickSimOptimizerWorkerProtocol";

type Listener = (event: { data?: unknown; message?: string }) => void;

/** postMessage を非同期に処理する擬似ワーカー（本物と同じプロトコルで応答する） */
class FakeWorker {
	static instances: FakeWorker[] = [];
	private readonly listeners = new Map<string, Listener[]>();
	private evaluator: QuickSimEvaluator | null = null;
	requests: QuickSimOptimizerWorkerRequest[] = [];
	terminated = false;

	constructor() {
		FakeWorker.instances.push(this);
	}

	addEventListener(type: string, listener: Listener): void {
		const list = this.listeners.get(type) ?? [];
		list.push(listener);
		this.listeners.set(type, list);
	}

	removeEventListener(type: string, listener: Listener): void {
		const list = this.listeners.get(type) ?? [];
		this.listeners.set(
			type,
			list.filter((candidate) => candidate !== listener),
		);
	}

	terminate(): void {
		this.terminated = true;
	}

	private emit(response: QuickSimOptimizerWorkerResponse): void {
		for (const listener of this.listeners.get("message") ?? []) {
			listener({ data: response });
		}
	}

	postMessage(request: QuickSimOptimizerWorkerRequest): void {
		this.requests.push(request);
		setTimeout(() => {
			if (this.terminated) {
				return;
			}
			if (request.type === "init") {
				this.evaluator = new QuickSimEvaluator(
					deserializeQuickSimEvaluatorContext(structuredClone(request.context)),
				);
				this.emit({ type: "ready" });
				return;
			}
			if (!this.evaluator) {
				this.emit({
					type: "error",
					requestId: request.requestId,
					message: "not initialized",
				});
				return;
			}
			const reportProgress = (completed: number, total: number) => {
				this.emit({
					type: "progress",
					requestId: request.requestId,
					completed,
					total,
				});
			};
			if (request.type === "evaluateIngredients") {
				const evaluations = this.evaluator.evaluateIngredientsSync(
					request.percents,
					request.stocks,
					request.seeds,
					request.options,
					reportProgress,
				);
				this.emit({
					type: "ingredientResult",
					requestId: request.requestId,
					evaluations: structuredClone(evaluations),
				});
				return;
			}
			const evaluations = this.evaluator.evaluateSync(
				request.candidates,
				request.seeds,
				request.options,
				reportProgress,
			);
			this.emit({
				type: "result",
				requestId: request.requestId,
				evaluations: structuredClone(evaluations),
			});
		}, 0);
	}
}

vi.mock("./createQuickSimOptimizerWorker.mjs", () => ({
	createQuickSimOptimizerWorker: () => new FakeWorker(),
}));

function createContext(): QuickSimEvaluatorContext {
	const names = [
		"Pikachu",
		"Eevee",
		"Bulbasaur",
		"Charmander",
		"Squirtle",
		"Gengar",
	];
	const items = names.map(
		(name, index) =>
			new PokemonBoxItem(
				new PokemonIv({ pokemonName: name, level: 30 }),
				"",
				index + 1,
			),
	);
	const members: QuickSimOptimizerMember[] = items.map((item) => ({
		pokemonId: item.id,
		usageMode: "even",
	}));
	const bonusSettings = createDefaultTimelineBonusSettings();
	return {
		box: new PokemonBox(items),
		members,
		timeSlots: DEFAULT_TIME_SLOTS,
		simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, simulationDays: 1 },
		bonusSettings,
		cookingSettings: {
			...createDefaultCookingSettings(),
			enabled: true,
			category: "curry",
		},
		strengthParameter:
			buildStrengthParameterFromTimelineBonusSettings(bonusSettings),
	};
}

describe("resolveQuickSimOptimizerWorkerCount", () => {
	it("uses the logical cores up to the cap", () => {
		expect(resolveQuickSimOptimizerWorkerCount(undefined)).toBe(2);
		expect(resolveQuickSimOptimizerWorkerCount(1)).toBe(1);
		expect(resolveQuickSimOptimizerWorkerCount(4)).toBe(4);
		expect(resolveQuickSimOptimizerWorkerCount(22)).toBe(8);
	});
});

describe("buildEvaluationTasks", () => {
	it("batches candidates when there are many of them", () => {
		const seeds = [1, 2, 3];
		const tasks = buildEvaluationTasks(40, seeds, 4);
		expect(tasks.map((task) => task.candidateIndexes.length)).toEqual([
			16, 16, 8,
		]);
		expect(tasks.every((task) => task.seedOffset === 0)).toBe(true);
		expect(tasks.every((task) => task.seeds.length === 3)).toBe(true);
		expect(tasks.flatMap((task) => task.candidateIndexes)).toEqual(
			Array.from({ length: 40 }, (_, index) => index),
		);
	});

	it("splits the seed list when there are few candidates and many seeds", () => {
		const seeds = Array.from({ length: 120 }, (_, index) => 1000 + index);
		const tasks = buildEvaluationTasks(3, seeds, 4);
		expect(tasks).toHaveLength(9);
		for (const task of tasks) {
			expect(task.candidateIndexes).toHaveLength(1);
			expect(task.seeds).toEqual(
				seeds.slice(task.seedOffset, task.seedOffset + task.seeds.length),
			);
		}
		expect(tasks.filter((task) => task.candidateIndexes[0] === 2)).toHaveLength(
			3,
		);
	});

	it("keeps few candidates with few seeds in one batch each", () => {
		const tasks = buildEvaluationTasks(2, [1, 2], 4);
		expect(tasks).toHaveLength(1);
		expect(tasks[0].candidateIndexes).toEqual([0, 1]);
	});

	it("returns nothing without candidates or seeds", () => {
		expect(buildEvaluationTasks(0, [1], 2)).toEqual([]);
		expect(buildEvaluationTasks(3, [], 2)).toEqual([]);
	});
});

describe("buildIngredientEvaluationTasks", () => {
	it("keeps every stock in each task and splits only the seeds", () => {
		const seeds = Array.from({ length: 1000 }, (_, index) => index);
		const tasks = buildIngredientEvaluationTasks(11, seeds, 8);
		expect(tasks).toHaveLength(16);
		for (const task of tasks) {
			expect(task.candidateIndexes).toEqual(
				Array.from({ length: 11 }, (_, index) => index),
			);
			expect(task.seeds.length).toBeLessThanOrEqual(63);
			expect(task.seeds).toEqual(
				seeds.slice(task.seedOffset, task.seedOffset + task.seeds.length),
			);
		}
		expect(tasks.reduce((sum, task) => sum + task.seeds.length, 0)).toBe(1000);
	});

	it("uses one seed per task when there are few seeds", () => {
		const tasks = buildIngredientEvaluationTasks(
			3,
			[1, 2, 3, 4, 5, 6, 7, 8],
			4,
		);
		expect(tasks).toHaveLength(8);
		expect(tasks.every((task) => task.seeds.length === 1)).toBe(true);
	});

	it("returns nothing without stocks or seeds", () => {
		expect(buildIngredientEvaluationTasks(0, [1], 2)).toEqual([]);
		expect(buildIngredientEvaluationTasks(3, [], 2)).toEqual([]);
	});
});

describe("QuickSimOptimizerWorkerPool", () => {
	afterEach(() => {
		FakeWorker.instances = [];
	});

	it("evaluates ingredient stocks like the in-thread evaluator and spreads seeds over workers", async () => {
		const context = createContext();
		const pool = await QuickSimOptimizerWorkerPool.create(context, 4);
		const percents = [100, 100, 100, 100, 60, 40];
		const stocks = [
			initialIngredientsToStock({ apple: 90 }),
			initialIngredientsToStock({ soy: 60, tomato: 60 }),
			initialIngredientsToStock({}),
		];
		const seeds = Array.from({ length: 130 }, (_, index) => 200 + index);
		const progress: [number, number][] = [];
		const pooled = await pool.evaluateIngredients(
			percents,
			stocks,
			seeds,
			{ excludeSleepSwaps: false },
			(completed, total) => progress.push([completed, total]),
		);
		const direct = await new QuickSimEvaluator(context).evaluateIngredients(
			percents,
			stocks,
			seeds,
			{ excludeSleepSwaps: false },
		);
		expect(pooled).toEqual(direct);
		expect(pooled[0].epBySeed).toHaveLength(130);
		expect(progress[progress.length - 1]).toEqual([130, 130]);
		const requests = FakeWorker.instances.flatMap((worker) =>
			worker.requests.filter(
				(request) => request.type === "evaluateIngredients",
			),
		);
		expect(requests).toHaveLength(8);
		for (const request of requests) {
			if (request.type === "evaluateIngredients") {
				expect(request.stocks).toHaveLength(3);
			}
		}
		expect(
			FakeWorker.instances.filter((worker) =>
				worker.requests.some(
					(request) => request.type === "evaluateIngredients",
				),
			).length,
		).toBeGreaterThan(1);
		pool.terminate();
	});

	it("marks every stock excluded when the percents cannot be scheduled", async () => {
		const context = createContext();
		const pool = await QuickSimOptimizerWorkerPool.create(context, 2);
		const pooled = await pool.evaluateIngredients(
			[0, 0, 0, 0, 0, 0],
			[initialIngredientsToStock({ apple: 90 })],
			[1, 2],
			{ excludeSleepSwaps: false },
		);
		expect(pooled).toEqual([
			{
				stock: initialIngredientsToStock({ apple: 90 }),
				epBySeed: [],
				excluded: true,
			},
		]);
		pool.terminate();
	});

	it("returns the same results as the in-thread evaluator, in candidate order", async () => {
		const context = createContext();
		const pool = await QuickSimOptimizerWorkerPool.create(context, 3);
		expect(pool.workerCount).toBe(3);
		expect(FakeWorker.instances).toHaveLength(3);
		const candidates = [
			[100, 100, 100, 100, 100, 0],
			[100, 100, 100, 100, 60, 40],
			[0, 0, 0, 0, 0, 0],
			[100, 100, 100, 100, 0, 100],
		];
		const seeds = [5, 6, 7];
		const progress: [number, number][] = [];
		const pooled = await pool.evaluate(
			candidates,
			seeds,
			{ excludeSleepSwaps: false },
			(completed, total) => progress.push([completed, total]),
		);
		const direct = await new QuickSimEvaluator(context).evaluate(
			candidates,
			seeds,
			{ excludeSleepSwaps: false },
		);
		expect(pooled).toEqual(direct);
		expect(pooled[2].excluded).toBe(true);
		expect(progress[progress.length - 1]).toEqual([4, 4]);
		pool.terminate();
		expect(FakeWorker.instances.every((worker) => worker.terminated)).toBe(
			true,
		);
	});

	it("splits many seeds of a few candidates across workers and reassembles them", async () => {
		const context = createContext();
		const pool = await QuickSimOptimizerWorkerPool.create(context, 4);
		const candidates = [
			[100, 100, 100, 100, 100, 0],
			[100, 100, 100, 100, 60, 40],
		];
		const seeds = Array.from({ length: 130 }, (_, index) => 100 + index);
		const pooled = await pool.evaluate(candidates, seeds, {
			excludeSleepSwaps: false,
			usePeriodSchedule: true,
		});
		const direct = await new QuickSimEvaluator(context).evaluate(
			candidates,
			seeds,
			{ excludeSleepSwaps: false, usePeriodSchedule: true },
		);
		expect(pooled).toEqual(direct);
		expect(pooled[0].epBySeed).toHaveLength(130);
		const evaluateRequests = FakeWorker.instances.flatMap((worker) =>
			worker.requests.filter((request) => request.type === "evaluate"),
		);
		expect(evaluateRequests.length).toBe(6);
		expect(
			FakeWorker.instances.filter((worker) =>
				worker.requests.some((request) => request.type === "evaluate"),
			).length,
		).toBeGreaterThan(1);
		pool.terminate();
	});

	it("rejects pending evaluations when terminated", async () => {
		const context = createContext();
		const pool = await QuickSimOptimizerWorkerPool.create(context, 1);
		const promise = pool.evaluate([[100, 100, 100, 100, 100, 0]], [1], {
			excludeSleepSwaps: false,
		});
		pool.terminate();
		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
	});
});
