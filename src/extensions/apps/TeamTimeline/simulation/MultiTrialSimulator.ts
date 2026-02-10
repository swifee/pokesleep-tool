/**
 * MultiTrialSimulator.ts
 * Multi-trial simulation for finding median and percentile results
 */

import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import { TimeSlot, SimulationConfig, PokemonSwap, DailySummary, TeamSummary } from '../types/TimeSlotTypes';
import { IngredientName } from '../../../../data/pokemons';
import { runSimulation } from './TimelineSimulator';
import { TrialSummary, MultiTrialResult } from '../types/MultiTrialTypes';
import { TimelineBonusSettings } from '../types/TimelineBonusSettingsTypes';

/** Multi-trial simulation input */
export interface MultiTrialInput {
    readonly team: (PokemonBoxItem | null)[];
    readonly timeSlots: TimeSlot[];
    readonly config: Omit<SimulationConfig, 'seed'>;
    readonly bonusSettings: TimelineBonusSettings;
    readonly swaps?: PokemonSwap[];
    readonly box?: PokemonBox;
    readonly trialCount: number;
    readonly initialSeed?: number;
}

export interface MultiTrialProgressInput extends MultiTrialInput {
    readonly onProgress?: (progress: number) => void;
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

type DailyAccumulator = {
    pokemonId: number;
    totalHelpCount: number;
    totalSkillCount: number;
    totalBerryCount: number;
    totalSkillOverflowCount: number;
    ingredientSums: Map<string, number>;
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
};

type AggregationState = {
    dailyAccsByPokemonId: Map<number, DailyAccumulator>;
    dailyOrder: number[];
    teamAcc: {
        ingredientSums: Map<string, number>;
        totalBerryEP: number;
        totalIngredientEP: number;
        totalSkillEP: number;
        grandTotalEP: number;
        totalPresentCandyCount: number;
        totalCookingPotCapacityIncrease: number;
        totalTastyChanceIncreasePercent: number;
        totalDreamShardCount: number;
    };
};

function createAggregationState(): AggregationState {
    return {
        dailyAccsByPokemonId: new Map<number, DailyAccumulator>(),
        dailyOrder: [],
        teamAcc: {
            ingredientSums: new Map<string, number>(),
            totalBerryEP: 0,
            totalIngredientEP: 0,
            totalSkillEP: 0,
            grandTotalEP: 0,
            totalPresentCandyCount: 0,
            totalCookingPotCapacityIncrease: 0,
            totalTastyChanceIncreasePercent: 0,
            totalDreamShardCount: 0,
        },
    };
}

function createSeed(initialSeed: number | undefined, index: number): number {
    if (initialSeed !== undefined) {
        return initialSeed + index;
    }
    return Math.floor(Math.random() * 1_000_000);
}

function accumulateDailySummary(state: AggregationState, dailySummary: DailySummary): void {
    let acc = state.dailyAccsByPokemonId.get(dailySummary.pokemonId);
    if (!acc) {
        acc = {
            pokemonId: dailySummary.pokemonId,
            totalHelpCount: 0,
            totalSkillCount: 0,
            totalBerryCount: 0,
            totalSkillOverflowCount: 0,
            ingredientSums: new Map(),
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
        };
        state.dailyAccsByPokemonId.set(dailySummary.pokemonId, acc);
        state.dailyOrder.push(dailySummary.pokemonId);
    }
    acc.totalHelpCount += dailySummary.totalHelpCount;
    acc.totalSkillCount += dailySummary.totalSkillCount;
    acc.totalBerryCount += dailySummary.totalBerryCount;
    acc.totalSkillOverflowCount += dailySummary.totalSkillOverflowCount;
    acc.berryEP += dailySummary.berryEP;
    acc.ingredientEP += dailySummary.ingredientEP;
    acc.skillEP += dailySummary.skillEP;
    acc.totalEP += dailySummary.totalEP;
    acc.totalDirectSkillEP += dailySummary.totalDirectSkillEP;
    acc.totalPresentCandyCount += dailySummary.totalPresentCandyCount;
    acc.totalCookingPotCapacityIncrease += dailySummary.totalCookingPotCapacityIncrease;
    acc.totalTastyChanceIncreasePercent += dailySummary.totalTastyChanceIncreasePercent;
    acc.totalDreamShardCount += dailySummary.totalDreamShardCount;
    accumulateIngredients(acc.ingredientSums, dailySummary.totalIngredients);
    accumulateIngredients(acc.overflowIngredientSums, dailySummary.totalOverflowIngredients);
}

function accumulateTeamSummary(state: AggregationState, teamSummary: TeamSummary): void {
    state.teamAcc.totalBerryEP += teamSummary.totalBerryEP;
    state.teamAcc.totalIngredientEP += teamSummary.totalIngredientEP;
    state.teamAcc.totalSkillEP += teamSummary.totalSkillEP;
    state.teamAcc.grandTotalEP += teamSummary.grandTotalEP;
    state.teamAcc.totalPresentCandyCount += teamSummary.totalPresentCandyCount;
    state.teamAcc.totalCookingPotCapacityIncrease += teamSummary.totalCookingPotCapacityIncrease;
    state.teamAcc.totalTastyChanceIncreasePercent += teamSummary.totalTastyChanceIncreasePercent;
    state.teamAcc.totalDreamShardCount += teamSummary.totalDreamShardCount;
    accumulateIngredients(state.teamAcc.ingredientSums, teamSummary.totalIngredients);
}

function finalizeAverages(state: AggregationState, trialCount: number): {
    averageDailySummaries: DailySummary[];
    averageTeamSummary: TeamSummary;
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
            totalSkillOverflowCount: Math.round((acc.totalSkillOverflowCount / n) * 10) / 10,
            totalIngredients: [...acc.ingredientSums.entries()].map(([name, count]) => ({
                name: name as IngredientName,
                count: Math.round((count / n) * 10) / 10,
            })),
            totalOverflowIngredients: [...acc.overflowIngredientSums.entries()].map(([name, count]) => ({
                name: name as IngredientName,
                count: Math.round((count / n) * 10) / 10,
            })),
            berryEP: Math.round(acc.berryEP / n),
            ingredientEP: Math.round(acc.ingredientEP / n),
            skillEP: Math.round(acc.skillEP / n),
            totalEP: Math.round(acc.totalEP / n),
            totalDirectSkillEP: Math.round(acc.totalDirectSkillEP / n),
            totalPresentCandyCount: Math.round((acc.totalPresentCandyCount / n) * 10) / 10,
            totalCookingPotCapacityIncrease: Math.round((acc.totalCookingPotCapacityIncrease / n) * 10) / 10,
            totalTastyChanceIncreasePercent: Math.round((acc.totalTastyChanceIncreasePercent / n) * 10) / 10,
            totalDreamShardCount: Math.round((acc.totalDreamShardCount / n) * 10) / 10,
        }));

    const averageTeamSummary: TeamSummary = {
        totalIngredients: [...state.teamAcc.ingredientSums.entries()].map(([name, count]) => ({
            name: name as IngredientName,
            count: Math.round((count / n) * 10) / 10,
        })),
        totalBerryEP: Math.round(state.teamAcc.totalBerryEP / n),
        totalIngredientEP: Math.round(state.teamAcc.totalIngredientEP / n),
        totalSkillEP: Math.round(state.teamAcc.totalSkillEP / n),
        grandTotalEP: Math.round(state.teamAcc.grandTotalEP / n),
        totalPresentCandyCount: Math.round((state.teamAcc.totalPresentCandyCount / n) * 10) / 10,
        totalCookingPotCapacityIncrease: Math.round((state.teamAcc.totalCookingPotCapacityIncrease / n) * 10) / 10,
        totalTastyChanceIncreasePercent: Math.round((state.teamAcc.totalTastyChanceIncreasePercent / n) * 10) / 10,
        totalDreamShardCount: Math.round((state.teamAcc.totalDreamShardCount / n) * 10) / 10,
    };

    return { averageDailySummaries, averageTeamSummary };
}

function finalizeMultiTrialResult(
    trials: TrialSummary[],
    state: AggregationState,
    trialCount: number,
): MultiTrialResult {
    trials.sort((a, b) => b.grandTotalEP - a.grandTotalEP);
    const medianIndex = Math.floor((trials.length - 1) / 2);
    const { averageDailySummaries, averageTeamSummary } = finalizeAverages(state, trialCount);
    return {
        trials,
        medianIndex,
        averageDailySummaries,
        averageTeamSummary,
    };
}

/**
 * Run multi-trial simulation with different seeds.
 * Returns trials sorted by grandTotalEP (descending, highest first),
 * plus average DailySummary and TeamSummary across all trials.
 */
export function runMultiTrialSimulation(input: MultiTrialInput): MultiTrialResult {
    const { team, timeSlots, config, bonusSettings, swaps, box, trialCount } = input;
    const trials: TrialSummary[] = [];
    const state = createAggregationState();

    for (let i = 0; i < trialCount; i++) {
        const seed = createSeed(input.initialSeed, i);
        const result = runSimulation({
            team,
            timeSlots,
            config: { ...config, seed },
            bonusSettings,
            swaps,
            box,
        });

        trials.push({
            seed,
            grandTotalEP: result.teamSummary.grandTotalEP,
        });

        for (const dailySummary of result.dailySummaries) {
            accumulateDailySummary(state, dailySummary);
        }
        accumulateTeamSummary(state, result.teamSummary);
    }

    return finalizeMultiTrialResult(trials, state, trialCount);
}

function waitNextTick(): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

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
        box,
        trialCount,
        onProgress,
        yieldEvery = 20,
    } = input;
    const trials: TrialSummary[] = [];
    const state = createAggregationState();

    onProgress?.(0);

    for (let i = 0; i < trialCount; i++) {
        const seed = createSeed(input.initialSeed, i);
        const result = runSimulation({
            team,
            timeSlots,
            config: { ...config, seed },
            bonusSettings,
            swaps,
            box,
        });

        trials.push({
            seed,
            grandTotalEP: result.teamSummary.grandTotalEP,
        });

        for (const dailySummary of result.dailySummaries) {
            accumulateDailySummary(state, dailySummary);
        }
        accumulateTeamSummary(state, result.teamSummary);

        const progress = Math.round(((i + 1) / trialCount) * 100);
        onProgress?.(progress);

        if (yieldEvery > 0 && (i + 1) % yieldEvery === 0 && i < trialCount - 1) {
            await waitNextTick();
        }
    }

    onProgress?.(100);
    return finalizeMultiTrialResult(trials, state, trialCount);
}
