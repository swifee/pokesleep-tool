import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CookingSimulationResult } from "../types/CookingTypes";
import {
	type DailySummary,
	DEFAULT_SIMULATION_CONFIG,
	type SimulationResult,
	type TeamSummary,
} from "../types/TimeSlotTypes";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import {
	createAggregationState,
	createTrialSeeds,
	finalizeMultiTrialResult,
	mergeAggregationStates,
	runMultiTrialSimulation,
	runMultiTrialSimulationWithProgress,
	runTrialBatch,
	runTrialBatchAsync,
	summarizeAggregationForAnalysis,
} from "./MultiTrialSimulator";

const runSimulationMock = vi.fn();
const defaultBonusSettings = createDefaultTimelineBonusSettings();

vi.mock("./TimelineSimulator", () => ({
	runSimulation: (...args: unknown[]) => runSimulationMock(...args),
}));

function createDailySummary(
	pokemonId: number,
	totalHelpCount: number,
	totalEP: number,
): DailySummary {
	return {
		pokemonId,
		totalHelpCount,
		totalSkillCount: totalHelpCount,
		totalBerryCount: totalHelpCount,
		totalIngredients: [],
		berryEP: totalEP,
		ingredientEP: 0,
		skillEP: 0,
		totalEP,
		totalSkillOverflowCount: 0,
		totalOverflowIngredients: [],
		totalDirectSkillEP: 0,
		totalPresentCandyCount: 0,
		totalCookingPotCapacityIncrease: 0,
		totalTastyChanceIncreasePercent: 0,
		totalDreamShardCount: 0,
	};
}

function createTeamSummary(grandTotalEP: number): TeamSummary {
	return {
		totalIngredients: [],
		totalBerryEP: grandTotalEP,
		totalIngredientEP: 0,
		totalSkillEP: 0,
		grandTotalEP,
		totalPresentCandyCount: 0,
		totalCookingPotCapacityIncrease: 0,
		totalTastyChanceIncreasePercent: 0,
		totalDreamShardCount: 0,
	};
}

function createSimulationResult(
	dailySummaries: DailySummary[],
	teamSummary: TeamSummary,
): SimulationResult {
	return {
		slotResults: new Map(),
		dailySummaries,
		teamSummary,
	};
}

function createCookingResult(
	events: CookingSimulationResult["events"],
	leftoverTotal: CookingSimulationResult["leftoverIngredients"]["total"],
	totalInitialIngredientEP: number = 0,
): CookingSimulationResult {
	return {
		events,
		dailySummaries: [],
		pokemonAttributions: [],
		leftoverIngredients: {
			byPokemon: new Map(),
			initialRemaining: {},
			total: leftoverTotal,
		},
		totalCookingEP: events.reduce((sum, event) => sum + event.cookingEP, 0),
		totalInitialIngredientEP,
	};
}

function createCookingEventWithExtraUsages(
	mealSlotId: string,
	recipeName: string,
	cookingEP: number,
	extraIngredientsUsed: Array<{ name: "apple" | "milk"; count: number }>,
): CookingSimulationResult["events"][number] {
	return {
		mealSlotId,
		mealType: "breakfast",
		recipeName,
		isGreatSuccess: false,
		greatSuccessMultiplier: 2,
		cookingEP,
		eBase: cookingEP,
		eDisplay: cookingEP,
		eFinal: cookingEP,
		ingredientsUsed: [],
		extraIngredientsUsed: extraIngredientsUsed.map((usage) => ({
			name: usage.name,
			count: usage.count,
			pokemonAttribution: new Map<number, number>(),
			fromInitial: usage.count,
		})),
		remainingPotCapacity: 0,
		effectivePotCapacity: 30,
		tastyChancePercent: 10,
		cookingPowerUpBonusUsed: 0,
	};
}

describe("runMultiTrialSimulation", () => {
	beforeEach(() => {
		runSimulationMock.mockReset();
	});

	it("aggregates averages by pokemonId even when summary order changes between trials", () => {
		runSimulationMock
			.mockReturnValueOnce(
				createSimulationResult(
					[createDailySummary(1, 10, 100), createDailySummary(2, 20, 200)],
					createTeamSummary(1000),
				),
			)
			.mockReturnValueOnce(
				createSimulationResult(
					[createDailySummary(2, 40, 400), createDailySummary(1, 30, 300)],
					createTeamSummary(2000),
				),
			);

		const result = runMultiTrialSimulation({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 2,
			initialSeed: 500,
		});

		expect(result.averageDailySummaries.map((s) => s.pokemonId)).toEqual([
			1, 2,
		]);
		expect(
			result.averageDailySummaries.find((s) => s.pokemonId === 1)
				?.totalHelpCount,
		).toBe(20);
		expect(
			result.averageDailySummaries.find((s) => s.pokemonId === 2)
				?.totalHelpCount,
		).toBe(30);
	});

	it("includes swapped-in pokemon in average summaries and keeps first-seen order", () => {
		runSimulationMock
			.mockReturnValueOnce(
				createSimulationResult(
					[createDailySummary(10, 50, 500)],
					createTeamSummary(3000),
				),
			)
			.mockReturnValueOnce(
				createSimulationResult(
					[createDailySummary(10, 70, 700), createDailySummary(99, 20, 200)],
					createTeamSummary(2500),
				),
			);

		const result = runMultiTrialSimulation({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 80,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 2,
			initialSeed: 700,
		});

		expect(result.averageDailySummaries.map((s) => s.pokemonId)).toEqual([
			10, 99,
		]);
		expect(
			result.averageDailySummaries.find((s) => s.pokemonId === 10)
				?.totalHelpCount,
		).toBe(60);
		// Appears only in one trial, averaged over all trials.
		expect(
			result.averageDailySummaries.find((s) => s.pokemonId === 99)
				?.totalHelpCount,
		).toBe(10);
	});

	it("bonusSettingsをrunSimulationへ伝播する", () => {
		runSimulationMock.mockReturnValue(
			createSimulationResult(
				[createDailySummary(1, 1, 100)],
				createTeamSummary(100),
			),
		);

		const bonusSettings = {
			...defaultBonusSettings,
			fieldBonus: 45,
			isGoodCampTicketSet: true,
		};
		runMultiTrialSimulation({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 60,
				simulationDays: 1,
			},
			bonusSettings,
			trialCount: 1,
			initialSeed: 999,
		});

		expect(runSimulationMock).toHaveBeenCalledTimes(1);
		expect(runSimulationMock.mock.calls[0]?.[0]).toMatchObject({
			bonusSettings,
		});
	});

	it("uses sequential seeds from one random base when initialSeed is omitted", () => {
		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.12345);
		runSimulationMock.mockReturnValue(
			createSimulationResult(
				[createDailySummary(1, 1, 100)],
				createTeamSummary(1000),
			),
		);

		runMultiTrialSimulation({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 3,
		});

		const seeds = runSimulationMock.mock.calls.map(
			(call) => (call[0] as { config: { seed: number } }).config.seed,
		);
		expect(seeds).toEqual([123450, 123451, 123452]);
		randomSpy.mockRestore();
	});

	it("reports progress until 100 in async simulation", async () => {
		runSimulationMock.mockReturnValue(
			createSimulationResult(
				[createDailySummary(1, 1, 100)],
				createTeamSummary(1000),
			),
		);
		const onProgress = vi.fn();

		await runMultiTrialSimulationWithProgress({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 3,
			initialSeed: 100,
			onProgress,
			yieldEvery: 1,
		});

		expect(onProgress).toHaveBeenCalled();
		expect(onProgress.mock.calls[0]?.[0]).toBe(0);
		expect(onProgress.mock.calls[onProgress.mock.calls.length - 1]?.[0]).toBe(
			100,
		);
	});

	it("throttles progress updates by interval in async simulation", async () => {
		runSimulationMock.mockReturnValue(
			createSimulationResult(
				[createDailySummary(1, 1, 100)],
				createTeamSummary(1000),
			),
		);
		const onProgress = vi.fn();

		await runMultiTrialSimulationWithProgress({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 5,
			initialSeed: 200,
			onProgress,
			progressUpdateIntervalMs: 60_000,
			yieldEvery: 1,
		});

		expect(onProgress.mock.calls.map((call) => call[0])).toEqual([0, 100]);
	});

	it("returns partial aggregates when aborted mid-way", async () => {
		runSimulationMock.mockImplementation(
			({ config }: { config: { seed: number } }) =>
				createSimulationResult(
					[createDailySummary(1, config.seed, config.seed * 10)],
					createTeamSummary(config.seed),
				),
		);
		const onProgress = vi.fn();

		const result = await runMultiTrialSimulationWithProgress({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 5,
			initialSeed: 10,
			onProgress,
			shouldAbort: () => runSimulationMock.mock.calls.length >= 3,
			yieldEvery: 1,
		});

		expect(result.trials.map((trial) => trial.seed)).toEqual([12, 11, 10]);
		expect(result.averageTeamSummary.grandTotalEP).toBe(11);
		expect(result.averageDailySummaries[0]?.totalHelpCount).toBe(11);
		expect(onProgress.mock.calls[onProgress.mock.calls.length - 1]?.[0]).toBe(
			60,
		);
	});

	it("notifies completed trials with full trial result payload", async () => {
		runSimulationMock.mockImplementation(
			({ config }: { config: { seed: number } }) =>
				createSimulationResult(
					[createDailySummary(1, config.seed, config.seed * 10)],
					createTeamSummary(config.seed),
				),
		);
		const onTrialComplete = vi.fn();

		await runMultiTrialSimulationWithProgress({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 2,
			initialSeed: 300,
			onTrialComplete,
			yieldEvery: 1,
		});

		expect(onTrialComplete).toHaveBeenCalledTimes(2);
		expect(onTrialComplete.mock.calls[0]?.[0]).toMatchObject({
			index: 0,
			trialCount: 2,
			seed: 300,
		});
		expect(
			onTrialComplete.mock.calls[0]?.[0].result.teamSummary.grandTotalEP,
		).toBe(300);
		expect(onTrialComplete.mock.calls[1]?.[0]).toMatchObject({
			index: 1,
			trialCount: 2,
			seed: 301,
		});
	});

	it("aggregates average cooking summary by recipe and leftover ingredients", () => {
		runSimulationMock
			.mockReturnValueOnce({
				...createSimulationResult(
					[createDailySummary(1, 10, 100)],
					createTeamSummary(1000),
				),
				cookingResult: createCookingResult(
					[
						{
							mealSlotId: "slot-1",
							mealType: "breakfast",
							recipeName: "recipeA",
							isGreatSuccess: false,
							greatSuccessMultiplier: 2,
							cookingEP: 100,
							eBase: 1000,
							eDisplay: 1100,
							eFinal: 100,
							ingredientsUsed: [],
							remainingPotCapacity: 0,
							effectivePotCapacity: 30,
							tastyChancePercent: 10,
							cookingPowerUpBonusUsed: 0,
						},
						{
							mealSlotId: "slot-2",
							mealType: "lunch",
							recipeName: "recipeB",
							isGreatSuccess: false,
							greatSuccessMultiplier: 2,
							cookingEP: 300,
							eBase: 2000,
							eDisplay: 2200,
							eFinal: 300,
							ingredientsUsed: [],
							remainingPotCapacity: 0,
							effectivePotCapacity: 30,
							tastyChancePercent: 10,
							cookingPowerUpBonusUsed: 0,
						},
					],
					{ apple: 4 },
					120,
				),
			})
			.mockReturnValueOnce({
				...createSimulationResult(
					[createDailySummary(1, 20, 200)],
					createTeamSummary(2000),
				),
				cookingResult: createCookingResult(
					[
						{
							mealSlotId: "slot-3",
							mealType: "dinner",
							recipeName: "recipeA",
							isGreatSuccess: false,
							greatSuccessMultiplier: 2,
							cookingEP: 200,
							eBase: 1000,
							eDisplay: 1100,
							eFinal: 200,
							ingredientsUsed: [],
							remainingPotCapacity: 0,
							effectivePotCapacity: 30,
							tastyChancePercent: 10,
							cookingPowerUpBonusUsed: 0,
						},
						{
							mealSlotId: "slot-4",
							mealType: "breakfast",
							recipeName: "recipeB",
							isGreatSuccess: false,
							greatSuccessMultiplier: 2,
							cookingEP: 100,
							eBase: 2000,
							eDisplay: 2200,
							eFinal: 100,
							ingredientsUsed: [],
							remainingPotCapacity: 0,
							effectivePotCapacity: 30,
							tastyChancePercent: 10,
							cookingPowerUpBonusUsed: 0,
						},
						{
							mealSlotId: "slot-5",
							mealType: "lunch",
							recipeName: "recipeB",
							isGreatSuccess: false,
							greatSuccessMultiplier: 2,
							cookingEP: 300,
							eBase: 2000,
							eDisplay: 2200,
							eFinal: 300,
							ingredientsUsed: [],
							remainingPotCapacity: 0,
							effectivePotCapacity: 30,
							tastyChancePercent: 10,
							cookingPowerUpBonusUsed: 0,
						},
					],
					{ apple: 2, milk: 6 },
					180,
				),
			});

		const result = runMultiTrialSimulation({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 2,
			initialSeed: 900,
		});

		expect(result.averageCookingSummary).not.toBeNull();
		expect(
			result.averageCookingSummary?.recipes.map((recipe) => recipe.recipeName),
		).toEqual(["recipeB", "recipeA"]);
		expect(result.averageCookingSummary?.recipes[0]).toMatchObject({
			recipeName: "recipeB",
			averageCount: 1.5,
			averageCookingEP: 233,
		});
		expect(result.averageCookingSummary?.recipes[1]).toMatchObject({
			recipeName: "recipeA",
			averageCount: 1,
			averageCookingEP: 150,
		});
		expect(result.averageCookingSummary?.leftoverIngredients).toEqual([
			{ name: "apple", count: 3 },
			{ name: "milk", count: 3 },
		]);
		expect(result.averageCookingSummary?.averageInitialIngredientEP).toBe(150);
	});

	it("keeps leftover ingredient in average summary even when averaged count rounds to 0", () => {
		runSimulationMock
			.mockReturnValueOnce({
				...createSimulationResult(
					[createDailySummary(1, 10, 100)],
					createTeamSummary(1000),
				),
				cookingResult: createCookingResult([], { apple: 0.04 }),
			})
			.mockReturnValueOnce({
				...createSimulationResult(
					[createDailySummary(1, 10, 100)],
					createTeamSummary(1000),
				),
				cookingResult: createCookingResult([], {}),
			});

		const result = runMultiTrialSimulation({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 2,
			initialSeed: 1000,
		});

		expect(result.averageCookingSummary?.leftoverIngredients).toEqual([
			{ name: "apple", count: 0 },
		]);
	});

	it("aggregates leftoverIngredientsAfterExtra as trial average", () => {
		runSimulationMock
			.mockReturnValueOnce({
				...createSimulationResult(
					[createDailySummary(1, 10, 100)],
					createTeamSummary(1000),
				),
				cookingResult: createCookingResult(
					[
						createCookingEventWithExtraUsages("meal-1", "recipeA", 100, [
							{ name: "apple", count: 2 },
						]),
					],
					{ apple: 5, milk: 2 },
				),
			})
			.mockReturnValueOnce({
				...createSimulationResult(
					[createDailySummary(1, 10, 100)],
					createTeamSummary(1000),
				),
				cookingResult: createCookingResult(
					[
						createCookingEventWithExtraUsages("meal-2", "recipeA", 100, [
							{ name: "apple", count: 1 },
							{ name: "milk", count: 3 },
						]),
					],
					{ apple: 1, milk: 2 },
				),
			});

		const result = runMultiTrialSimulation({
			team: [],
			timeSlots: [],
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				initialEnergy: 50,
				simulationDays: 1,
			},
			bonusSettings: defaultBonusSettings,
			trialCount: 2,
			initialSeed: 2000,
		});

		expect(result.averageCookingSummary?.leftoverIngredientsAfterExtra).toEqual(
			[
				{ name: "apple", count: 1.5 },
				{ name: "milk", count: 1 },
			],
		);
	});
});

describe("aggregation helpers", () => {
	beforeEach(() => {
		runSimulationMock.mockReset();
	});

	const baseInput = {
		team: [],
		timeSlots: [],
		config: {
			...DEFAULT_SIMULATION_CONFIG,
			initialEnergy: 50,
			simulationDays: 1,
		},
		bonusSettings: defaultBonusSettings,
	};

	function mockSeedDrivenResults(): void {
		runSimulationMock.mockImplementation(
			({ config }: { config: { seed: number } }) => {
				const summaries = [
					createDailySummary(1, config.seed, config.seed * 10),
				];
				// Pokemon 2 only appears from seed 12 on, like a swapped-in member.
				if (config.seed >= 12) {
					summaries.push(createDailySummary(2, 1, config.seed));
				}
				return {
					...createSimulationResult(summaries, createTeamSummary(config.seed)),
					cookingResult: createCookingResult(
						[createCookingEventWithExtraUsages("m", "curry", config.seed, [])],
						{ apple: 0.5 },
						config.seed,
					),
				};
			},
		);
	}

	it("mergeAggregationStates reproduces a single batch from ordered chunks", () => {
		mockSeedDrivenResults();
		const seeds = createTrialSeeds(10, 6);
		const whole = runTrialBatch(baseInput, seeds);
		const merged = createAggregationState();
		for (const chunk of [
			seeds.slice(0, 2),
			seeds.slice(2, 5),
			seeds.slice(5),
		]) {
			mergeAggregationStates(merged, runTrialBatch(baseInput, chunk).state);
		}

		expect(merged.dailyOrder).toEqual(whole.state.dailyOrder);
		expect(merged.teamAcc).toEqual(whole.state.teamAcc);
		expect([...merged.dailyAccsByPokemonId.entries()]).toEqual([
			...whole.state.dailyAccsByPokemonId.entries(),
		]);
		expect(merged.cookingAcc.hasCookingResult).toBe(true);
		expect(merged.cookingAcc.totalInitialIngredientEPSum).toBe(
			whole.state.cookingAcc.totalInitialIngredientEPSum,
		);
		expect([...merged.cookingAcc.recipeAccs.entries()]).toEqual([
			...whole.state.cookingAcc.recipeAccs.entries(),
		]);
		expect(merged.cookingAcc.leftoverIngredientSums.get("apple")).toBeCloseTo(
			whole.state.cookingAcc.leftoverIngredientSums.get("apple") ?? Number.NaN,
		);
		expect(finalizeMultiTrialResult([...whole.trials], merged, 6)).toEqual(
			finalizeMultiTrialResult([...whole.trials], whole.state, 6),
		);
	});

	it("summarizeAggregationForAnalysis divides sums by the trial count", () => {
		mockSeedDrivenResults();
		const { state } = runTrialBatch(baseInput, createTrialSeeds(10, 4));

		const metrics = summarizeAggregationForAnalysis(state, 4);

		expect(metrics.trialCount).toBe(4);
		expect(metrics.averageTeamEP).toBe((10 + 11 + 12 + 13) / 4);
		expect(metrics.averageEPByPokemonId.get(1)).toBe(
			(100 + 110 + 120 + 130) / 4,
		);
		expect(metrics.averageEPByPokemonId.get(2)).toBe((12 + 13) / 4);
		expect(metrics.averageHelpByPokemonId.get(1)).toBe((10 + 11 + 12 + 13) / 4);
		expect(metrics.averageTeamHelpCount).toBe((10 + 11 + 12 + 13 + 2) / 4);
	});

	it("summarizeAggregationForAnalysis yields zeros for an empty run", () => {
		const metrics = summarizeAggregationForAnalysis(
			createAggregationState(),
			0,
		);
		expect(metrics.trialCount).toBe(1);
		expect(metrics.averageTeamEP).toBe(0);
		expect(metrics.averageEPByPokemonId.size).toBe(0);
	});

	it("runTrialBatchAsync stops between trials and reports progress before yielding", async () => {
		mockSeedDrivenResults();
		const progress: number[] = [];
		let stop = false;
		const { trials } = await runTrialBatchAsync(
			baseInput,
			createTrialSeeds(10, 5),
			{
				yieldIntervalMs: 0,
				onProgress: (completed) => {
					progress.push(completed);
					stop = completed >= 2;
				},
				shouldStop: () => stop,
			},
		);
		expect(trials.map((trial) => trial.seed)).toEqual([10, 11]);
		expect(progress).toEqual([1, 2]);
	});
});
