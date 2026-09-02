/**
 * MultiTrialSimulator.ts
 * Multi-trial simulation for finding median and percentile results
 */

import type { IngredientName } from "../../../../data/pokemons";
import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import type {
	AverageCookingSummary,
	CookingSimulationResult,
	CookingSimulationSettings,
} from "../types/CookingTypes";
import type { MultiTrialResult, TrialSummary } from "../types/MultiTrialTypes";
import type { ProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import type { TimelineBonusSettings } from "../types/TimelineBonusSettingsTypes";
import type {
	DailySummary,
	NoCollectCellSetting,
	PokemonSwap,
	SimulationConfig,
	SimulationResult,
	TeamSummary,
	TimeSlot,
} from "../types/TimeSlotTypes";
import { runSimulation } from "./TimelineSimulator";

/** Multi-trial simulation input */
export interface MultiTrialInput {
	readonly team: (PokemonBoxItem | null)[];
	readonly timeSlots: TimeSlot[];
	readonly config: Omit<SimulationConfig, "seed">;
	readonly bonusSettings: TimelineBonusSettings;
	readonly swaps?: PokemonSwap[];
	readonly noCollectCells?: NoCollectCellSetting[];
	readonly box?: PokemonBox;
	readonly cookingSettings?: CookingSimulationSettings;
	/** 仮設定（公式未公開パラメータ） */
	readonly provisionalSettings?: ProvisionalSettings;
	readonly trialCount: number;
	readonly initialSeed?: number;
}

export interface MultiTrialProgressInput extends MultiTrialInput {
	readonly onProgress?: (progress: number) => void;
	readonly onTrialComplete?: (trial: {
		index: number;
		trialCount: number;
		seed: number;
		result: SimulationResult;
	}) => void;
	readonly shouldAbort?: () => boolean;
	readonly progressUpdateIntervalMs?: number;
	readonly yieldEvery?: number;
}

/** Merge ingredient counts into an accumulator map */
function accumulateIngredients(
	acc: Map<string, number>,
	ingredients: readonly { name: IngredientName; count: number }[],
): void {
	for (const ing of ingredients) {
		acc.set(ing.name, (acc.get(ing.name) ?? 0) + ing.count);
	}
}

function roundToSingleDecimal(value: number): number {
	return Math.round(value * 10) / 10;
}

type DailyAccumulator = {
	pokemonId: number;
	totalHelpCount: number;
	totalSkillCount: number;
	totalBerryCount: number;
	totalHugeMagoBerryCount: number;
	hugeMagoBerryEP: number;
	totalSkillOverflowCount: number;
	ingredientSums: Map<string, number>;
	skillIngredientSums: Map<string, number>;
	overflowIngredientSums: Map<string, number>;
	berryEP: number;
	ingredientEP: number;
	skillEP: number;
	totalEP: number;
	totalDirectSkillEP: number;
	totalPresentCandyCount: number;
	totalCookingPotCapacityIncrease: number;
	totalTastyChanceIncreasePercent: number;
	totalDreamShardCount: number;
	cookingEP: number;
};

type CookingRecipeAccumulator = {
	recipeName: string;
	eBase: number;
	count: number;
	totalCookingEP: number;
};

type AggregationState = {
	dailyAccsByPokemonId: Map<number, DailyAccumulator>;
	dailyOrder: number[];
	teamAcc: {
		ingredientSums: Map<string, number>;
		totalBerryEP: number;
		totalHugeMagoBerryCount: number;
		totalHugeMagoBerryEP: number;
		totalIngredientEP: number;
		totalSkillEP: number;
		grandTotalEP: number;
		totalPresentCandyCount: number;
		totalCookingPotCapacityIncrease: number;
		totalTastyChanceIncreasePercent: number;
		totalDreamShardCount: number;
		totalCookingEP: number;
	};
	cookingAcc: {
		recipeAccs: Map<string, CookingRecipeAccumulator>;
		leftoverIngredientSums: Map<IngredientName, number>;
		leftoverIngredientSeen: Set<IngredientName>;
		leftoverIngredientAfterExtraSums: Map<IngredientName, number>;
		leftoverIngredientAfterExtraSeen: Set<IngredientName>;
		totalInitialIngredientEPSum: number;
		hasCookingResult: boolean;
	};
};

function createAggregationState(): AggregationState {
	return {
		dailyAccsByPokemonId: new Map<number, DailyAccumulator>(),
		dailyOrder: [],
		teamAcc: {
			ingredientSums: new Map<string, number>(),
			totalBerryEP: 0,
			totalHugeMagoBerryCount: 0,
			totalHugeMagoBerryEP: 0,
			totalIngredientEP: 0,
			totalSkillEP: 0,
			grandTotalEP: 0,
			totalPresentCandyCount: 0,
			totalCookingPotCapacityIncrease: 0,
			totalTastyChanceIncreasePercent: 0,
			totalDreamShardCount: 0,
			totalCookingEP: 0,
		},
		cookingAcc: {
			recipeAccs: new Map<string, CookingRecipeAccumulator>(),
			leftoverIngredientSums: new Map<IngredientName, number>(),
			leftoverIngredientSeen: new Set<IngredientName>(),
			leftoverIngredientAfterExtraSums: new Map<IngredientName, number>(),
			leftoverIngredientAfterExtraSeen: new Set<IngredientName>(),
			totalInitialIngredientEPSum: 0,
			hasCookingResult: false,
		},
	};
}

function resolveBaseSeed(initialSeed: number | undefined): number {
	if (initialSeed !== undefined) {
		return initialSeed;
	}
	return Math.floor(Math.random() * 1_000_000);
}

function createSeed(baseSeed: number, index: number): number {
	return baseSeed + index;
}

function accumulateDailySummary(
	state: AggregationState,
	dailySummary: DailySummary,
): void {
	let acc = state.dailyAccsByPokemonId.get(dailySummary.pokemonId);
	if (!acc) {
		acc = {
			pokemonId: dailySummary.pokemonId,
			totalHelpCount: 0,
			totalSkillCount: 0,
			totalBerryCount: 0,
			totalHugeMagoBerryCount: 0,
			hugeMagoBerryEP: 0,
			totalSkillOverflowCount: 0,
			ingredientSums: new Map(),
			skillIngredientSums: new Map(),
			overflowIngredientSums: new Map(),
			berryEP: 0,
			ingredientEP: 0,
			skillEP: 0,
			totalEP: 0,
			totalDirectSkillEP: 0,
			totalPresentCandyCount: 0,
			totalCookingPotCapacityIncrease: 0,
			totalTastyChanceIncreasePercent: 0,
			totalDreamShardCount: 0,
			cookingEP: 0,
		};
		state.dailyAccsByPokemonId.set(dailySummary.pokemonId, acc);
		state.dailyOrder.push(dailySummary.pokemonId);
	}
	acc.totalHelpCount += dailySummary.totalHelpCount;
	acc.totalSkillCount += dailySummary.totalSkillCount;
	acc.totalBerryCount += dailySummary.totalBerryCount;
	acc.totalHugeMagoBerryCount += dailySummary.totalHugeMagoBerryCount ?? 0;
	acc.hugeMagoBerryEP += dailySummary.hugeMagoBerryEP ?? 0;
	acc.totalSkillOverflowCount += dailySummary.totalSkillOverflowCount;
	acc.berryEP += dailySummary.berryEP;
	acc.ingredientEP += dailySummary.ingredientEP;
	acc.skillEP += dailySummary.skillEP;
	acc.totalEP += dailySummary.totalEP;
	acc.totalDirectSkillEP += dailySummary.totalDirectSkillEP;
	acc.totalPresentCandyCount += dailySummary.totalPresentCandyCount;
	acc.totalCookingPotCapacityIncrease +=
		dailySummary.totalCookingPotCapacityIncrease;
	acc.totalTastyChanceIncreasePercent +=
		dailySummary.totalTastyChanceIncreasePercent;
	acc.totalDreamShardCount += dailySummary.totalDreamShardCount;
	acc.cookingEP += dailySummary.cookingEP ?? 0;
	accumulateIngredients(acc.ingredientSums, dailySummary.totalIngredients);
	accumulateIngredients(
		acc.skillIngredientSums,
		dailySummary.totalSkillIngredients ?? [],
	);
	accumulateIngredients(
		acc.overflowIngredientSums,
		dailySummary.totalOverflowIngredients,
	);
}

function accumulateTeamSummary(
	state: AggregationState,
	teamSummary: TeamSummary,
): void {
	state.teamAcc.totalBerryEP += teamSummary.totalBerryEP;
	state.teamAcc.totalHugeMagoBerryCount +=
		teamSummary.totalHugeMagoBerryCount ?? 0;
	state.teamAcc.totalHugeMagoBerryEP += teamSummary.totalHugeMagoBerryEP ?? 0;
	state.teamAcc.totalIngredientEP += teamSummary.totalIngredientEP;
	state.teamAcc.totalSkillEP += teamSummary.totalSkillEP;
	state.teamAcc.grandTotalEP += teamSummary.grandTotalEP;
	state.teamAcc.totalPresentCandyCount += teamSummary.totalPresentCandyCount;
	state.teamAcc.totalCookingPotCapacityIncrease +=
		teamSummary.totalCookingPotCapacityIncrease;
	state.teamAcc.totalTastyChanceIncreasePercent +=
		teamSummary.totalTastyChanceIncreasePercent;
	state.teamAcc.totalDreamShardCount += teamSummary.totalDreamShardCount;
	state.teamAcc.totalCookingEP += teamSummary.totalCookingEP ?? 0;
	accumulateIngredients(
		state.teamAcc.ingredientSums,
		teamSummary.totalIngredients,
	);
}

function accumulateCookingResult(
	state: AggregationState,
	cookingResult: CookingSimulationResult | undefined,
): void {
	if (!cookingResult) {
		return;
	}
	state.cookingAcc.hasCookingResult = true;
	state.cookingAcc.totalInitialIngredientEPSum +=
		cookingResult.totalInitialIngredientEP ?? 0;

	for (const event of cookingResult.events) {
		if (event.recipeName == null || event.cookingEP <= 0) {
			continue;
		}
		const existing = state.cookingAcc.recipeAccs.get(event.recipeName);
		if (existing) {
			existing.count += 1;
			existing.totalCookingEP += event.cookingEP;
			existing.eBase = Math.max(existing.eBase, event.eBase);
			continue;
		}
		state.cookingAcc.recipeAccs.set(event.recipeName, {
			recipeName: event.recipeName,
			eBase: event.eBase,
			count: 1,
			totalCookingEP: event.cookingEP,
		});
	}

	const extraIngredientUsageMap = new Map<IngredientName, number>();
	for (const event of cookingResult.events) {
		for (const usage of event.extraIngredientsUsed ?? []) {
			extraIngredientUsageMap.set(
				usage.name,
				(extraIngredientUsageMap.get(usage.name) ?? 0) + usage.count,
			);
		}
	}

	for (const [name, count] of Object.entries(
		cookingResult.leftoverIngredients.total,
	)) {
		if (count == null || count <= 0) {
			continue;
		}
		const ingredientName = name as IngredientName;
		state.cookingAcc.leftoverIngredientSeen.add(ingredientName);
		state.cookingAcc.leftoverIngredientSums.set(
			ingredientName,
			(state.cookingAcc.leftoverIngredientSums.get(ingredientName) ?? 0) +
				count,
		);

		const postLeftoverCount = Math.max(
			0,
			count - (extraIngredientUsageMap.get(ingredientName) ?? 0),
		);
		state.cookingAcc.leftoverIngredientAfterExtraSeen.add(ingredientName);
		state.cookingAcc.leftoverIngredientAfterExtraSums.set(
			ingredientName,
			(state.cookingAcc.leftoverIngredientAfterExtraSums.get(ingredientName) ??
				0) + postLeftoverCount,
		);
	}
}

function finalizeAverageCookingSummary(
	state: AggregationState,
	trialCount: number,
): AverageCookingSummary | null {
	if (!state.cookingAcc.hasCookingResult) {
		return null;
	}

	const recipes = [...state.cookingAcc.recipeAccs.values()]
		.map((acc) => ({
			recipeName: acc.recipeName,
			eBase: Math.round(acc.eBase),
			averageCount: roundToSingleDecimal(acc.count / trialCount),
			averageCookingEP:
				acc.count > 0 ? Math.round(acc.totalCookingEP / acc.count) : 0,
		}))
		.sort((a, b) => {
			if (b.eBase !== a.eBase) {
				return b.eBase - a.eBase;
			}
			return a.recipeName.localeCompare(b.recipeName);
		});

	const leftoverIngredients = [...state.cookingAcc.leftoverIngredientSeen]
		.map((name) => ({
			name,
			count: roundToSingleDecimal(
				(state.cookingAcc.leftoverIngredientSums.get(name) ?? 0) / trialCount,
			),
		}))
		.sort((a, b) => {
			if (b.count !== a.count) {
				return b.count - a.count;
			}
			return a.name.localeCompare(b.name);
		});

	const leftoverIngredientsAfterExtra = [
		...state.cookingAcc.leftoverIngredientAfterExtraSeen,
	]
		.map((name) => ({
			name,
			count: roundToSingleDecimal(
				(state.cookingAcc.leftoverIngredientAfterExtraSums.get(name) ?? 0) /
					trialCount,
			),
		}))
		.sort((a, b) => {
			if (b.count !== a.count) {
				return b.count - a.count;
			}
			return a.name.localeCompare(b.name);
		});

	return {
		recipes,
		leftoverIngredients,
		leftoverIngredientsAfterExtra,
		averageInitialIngredientEP: Math.round(
			state.cookingAcc.totalInitialIngredientEPSum / trialCount,
		),
	};
}

function finalizeAverages(
	state: AggregationState,
	trialCount: number,
): {
	averageDailySummaries: DailySummary[];
	averageTeamSummary: TeamSummary;
	averageCookingSummary: AverageCookingSummary | null;
} {
	const n = trialCount;
	const averageDailySummaries: DailySummary[] = state.dailyOrder
		.map((pokemonId) => state.dailyAccsByPokemonId.get(pokemonId))
		.filter((acc): acc is DailyAccumulator => acc !== undefined)
		.map((acc) => ({
			pokemonId: acc.pokemonId,
			totalHelpCount: Math.round((acc.totalHelpCount / n) * 10) / 10,
			totalSkillCount: Math.round((acc.totalSkillCount / n) * 10) / 10,
			totalBerryCount: Math.round((acc.totalBerryCount / n) * 10) / 10,
			totalHugeMagoBerryCount: roundToSingleDecimal(
				acc.totalHugeMagoBerryCount / n,
			),
			hugeMagoBerryEP: Math.round(acc.hugeMagoBerryEP / n),
			totalSkillOverflowCount:
				Math.round((acc.totalSkillOverflowCount / n) * 10) / 10,
			totalIngredients: [...acc.ingredientSums.entries()].map(
				([name, count]) => ({
					name: name as IngredientName,
					count: Math.round((count / n) * 10) / 10,
				}),
			),
			totalSkillIngredients: [...acc.skillIngredientSums.entries()].map(
				([name, count]) => ({
					name: name as IngredientName,
					count: Math.round((count / n) * 10) / 10,
				}),
			),
			totalOverflowIngredients: [...acc.overflowIngredientSums.entries()].map(
				([name, count]) => ({
					name: name as IngredientName,
					count: Math.round((count / n) * 10) / 10,
				}),
			),
			berryEP: Math.round(acc.berryEP / n),
			ingredientEP: Math.round(acc.ingredientEP / n),
			skillEP: Math.round(acc.skillEP / n),
			totalEP: Math.round(acc.totalEP / n),
			totalDirectSkillEP: Math.round(acc.totalDirectSkillEP / n),
			totalPresentCandyCount: roundToSingleDecimal(
				acc.totalPresentCandyCount / n,
			),
			totalCookingPotCapacityIncrease: roundToSingleDecimal(
				acc.totalCookingPotCapacityIncrease / n,
			),
			totalTastyChanceIncreasePercent: roundToSingleDecimal(
				acc.totalTastyChanceIncreasePercent / n,
			),
			totalDreamShardCount: roundToSingleDecimal(acc.totalDreamShardCount / n),
			cookingEP: acc.cookingEP > 0 ? Math.round(acc.cookingEP / n) : undefined,
		}));

	const averageTeamSummary: TeamSummary = {
		totalIngredients: [...state.teamAcc.ingredientSums.entries()].map(
			([name, count]) => ({
				name: name as IngredientName,
				count: Math.round((count / n) * 10) / 10,
			}),
		),
		totalBerryEP: Math.round(state.teamAcc.totalBerryEP / n),
		totalHugeMagoBerryCount: roundToSingleDecimal(
			state.teamAcc.totalHugeMagoBerryCount / n,
		),
		totalHugeMagoBerryEP: Math.round(state.teamAcc.totalHugeMagoBerryEP / n),
		totalIngredientEP: Math.round(state.teamAcc.totalIngredientEP / n),
		totalSkillEP: Math.round(state.teamAcc.totalSkillEP / n),
		grandTotalEP: Math.round(state.teamAcc.grandTotalEP / n),
		totalPresentCandyCount: roundToSingleDecimal(
			state.teamAcc.totalPresentCandyCount / n,
		),
		totalCookingPotCapacityIncrease: roundToSingleDecimal(
			state.teamAcc.totalCookingPotCapacityIncrease / n,
		),
		totalTastyChanceIncreasePercent: roundToSingleDecimal(
			state.teamAcc.totalTastyChanceIncreasePercent / n,
		),
		totalDreamShardCount: roundToSingleDecimal(
			state.teamAcc.totalDreamShardCount / n,
		),
		totalCookingEP:
			state.teamAcc.totalCookingEP > 0
				? Math.round(state.teamAcc.totalCookingEP / n)
				: undefined,
	};

	const averageCookingSummary = finalizeAverageCookingSummary(state, n);
	return { averageDailySummaries, averageTeamSummary, averageCookingSummary };
}

function finalizeMultiTrialResult(
	trials: TrialSummary[],
	state: AggregationState,
	completedTrialCount: number,
): MultiTrialResult {
	trials.sort((a, b) => b.grandTotalEP - a.grandTotalEP);
	const medianIndex = Math.floor((trials.length - 1) / 2);
	const { averageDailySummaries, averageTeamSummary, averageCookingSummary } =
		finalizeAverages(state, completedTrialCount);
	return {
		trials,
		medianIndex,
		averageDailySummaries,
		averageTeamSummary,
		averageCookingSummary,
	};
}

/**
 * Run multi-trial simulation with different seeds.
 * Returns trials sorted by grandTotalEP (descending, highest first),
 * plus average DailySummary and TeamSummary across all trials.
 */
export function runMultiTrialSimulation(
	input: MultiTrialInput,
): MultiTrialResult {
	const {
		team,
		timeSlots,
		config,
		bonusSettings,
		swaps,
		noCollectCells,
		box,
		trialCount,
	} = input;
	if (trialCount <= 0) {
		throw new Error("trialCount must be greater than 0");
	}
	const trials: TrialSummary[] = [];
	const state = createAggregationState();
	const baseSeed = resolveBaseSeed(input.initialSeed);

	for (let i = 0; i < trialCount; i++) {
		const seed = createSeed(baseSeed, i);
		const result = runSimulation({
			team,
			timeSlots,
			config: { ...config, seed },
			bonusSettings,
			swaps,
			noCollectCells,
			box,
			cookingSettings: input.cookingSettings,
			provisionalSettings: input.provisionalSettings,
		});

		trials.push({
			seed,
			grandTotalEP: result.teamSummary.grandTotalEP,
		});

		for (const dailySummary of result.dailySummaries) {
			accumulateDailySummary(state, dailySummary);
		}
		accumulateTeamSummary(state, result.teamSummary);
		accumulateCookingResult(state, result.cookingResult);
	}

	return finalizeMultiTrialResult(trials, state, trials.length);
}

function waitNextTick(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

const DEFAULT_PROGRESS_UPDATE_INTERVAL_MS = 200;

/**
 * Run multi-trial simulation with progress callback.
 * This yields to the event loop periodically to allow UI progress updates.
 */
export async function runMultiTrialSimulationWithProgress(
	input: MultiTrialProgressInput,
): Promise<MultiTrialResult> {
	const {
		team,
		timeSlots,
		config,
		bonusSettings,
		swaps,
		noCollectCells,
		box,
		trialCount,
		onProgress,
		onTrialComplete,
		shouldAbort,
		progressUpdateIntervalMs = DEFAULT_PROGRESS_UPDATE_INTERVAL_MS,
		yieldEvery = 20,
	} = input;
	if (trialCount <= 0) {
		throw new Error("trialCount must be greater than 0");
	}
	const trials: TrialSummary[] = [];
	const state = createAggregationState();
	const baseSeed = resolveBaseSeed(input.initialSeed);
	let lastProgressUpdateAt = Date.now();
	let lastEmittedProgress = 0;

	onProgress?.(0);

	const emitProgress = async (
		progress: number,
		force = false,
	): Promise<void> => {
		if (!onProgress) {
			return;
		}
		const normalizedProgress = Math.max(
			lastEmittedProgress,
			Math.max(0, Math.min(100, progress)),
		);
		const now = Date.now();
		if (
			!force &&
			progressUpdateIntervalMs > 0 &&
			now - lastProgressUpdateAt < progressUpdateIntervalMs
		) {
			return;
		}
		onProgress(normalizedProgress);
		lastEmittedProgress = normalizedProgress;
		lastProgressUpdateAt = now;
		await waitNextTick();
	};

	for (let i = 0; i < trialCount; i++) {
		if (i > 0 && shouldAbort?.()) {
			break;
		}
		const seed = createSeed(baseSeed, i);
		const result = runSimulation({
			team,
			timeSlots,
			config: { ...config, seed },
			bonusSettings,
			swaps,
			noCollectCells,
			box,
			cookingSettings: input.cookingSettings,
			provisionalSettings: input.provisionalSettings,
		});

		trials.push({
			seed,
			grandTotalEP: result.teamSummary.grandTotalEP,
		});
		onTrialComplete?.({
			index: i,
			trialCount,
			seed,
			result,
		});

		for (const dailySummary of result.dailySummaries) {
			accumulateDailySummary(state, dailySummary);
		}
		accumulateTeamSummary(state, result.teamSummary);
		accumulateCookingResult(state, result.cookingResult);

		const progress = Math.round(((i + 1) / trialCount) * 100);
		await emitProgress(progress, i + 1 === trialCount);

		if (
			!onProgress &&
			yieldEvery > 0 &&
			(i + 1) % yieldEvery === 0 &&
			i < trialCount - 1
		) {
			await waitNextTick();
		}
	}

	const finalProgress = Math.round((trials.length / trialCount) * 100);
	if (finalProgress > lastEmittedProgress) {
		await emitProgress(finalProgress, true);
	}

	return finalizeMultiTrialResult(trials, state, trials.length);
}
