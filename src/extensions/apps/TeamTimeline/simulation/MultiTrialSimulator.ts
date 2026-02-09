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

/** Merge ingredient counts into an accumulator map */
function accumulateIngredients(
    acc: Map<string, number>,
    ingredients: readonly { name: IngredientName; count: number }[],
): void {
    for (const ing of ingredients) {
        acc.set(ing.name, (acc.get(ing.name) ?? 0) + ing.count);
    }
}

/**
 * Run multi-trial simulation with different seeds.
 * Returns trials sorted by grandTotalEP (descending, highest first),
 * plus average DailySummary and TeamSummary across all trials.
 */
export function runMultiTrialSimulation(input: MultiTrialInput): MultiTrialResult {
    const { team, timeSlots, config, bonusSettings, swaps, box, trialCount } = input;
    const trials: TrialSummary[] = [];

    // Accumulators for daily summaries (per pokemon)
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
    const dailyAccsByPokemonId = new Map<number, DailyAccumulator>();
    const dailyOrder: number[] = [];

    // Accumulator for team summary
    const teamAcc = {
        ingredientSums: new Map<string, number>(),
        totalBerryEP: 0,
        totalIngredientEP: 0,
        totalSkillEP: 0,
        grandTotalEP: 0,
        totalPresentCandyCount: 0,
        totalCookingPotCapacityIncrease: 0,
        totalTastyChanceIncreasePercent: 0,
        totalDreamShardCount: 0,
    };

    for (let i = 0; i < trialCount; i++) {
        // Use sequential seeds if initialSeed is provided, otherwise random
        const seed = input.initialSeed !== undefined
            ? input.initialSeed + i
            : Math.floor(Math.random() * 1_000_000);

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

        // Accumulate daily summaries by pokemon ID
        for (const ds of result.dailySummaries) {
            let acc = dailyAccsByPokemonId.get(ds.pokemonId);
            if (!acc) {
                acc = {
                    pokemonId: ds.pokemonId,
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
                dailyAccsByPokemonId.set(ds.pokemonId, acc);
                dailyOrder.push(ds.pokemonId);
            }
            acc.totalHelpCount += ds.totalHelpCount;
            acc.totalSkillCount += ds.totalSkillCount;
            acc.totalBerryCount += ds.totalBerryCount;
            acc.totalSkillOverflowCount += ds.totalSkillOverflowCount;
            acc.berryEP += ds.berryEP;
            acc.ingredientEP += ds.ingredientEP;
            acc.skillEP += ds.skillEP;
            acc.totalEP += ds.totalEP;
            acc.totalDirectSkillEP += ds.totalDirectSkillEP;
            acc.totalPresentCandyCount += ds.totalPresentCandyCount;
            acc.totalCookingPotCapacityIncrease += ds.totalCookingPotCapacityIncrease;
            acc.totalTastyChanceIncreasePercent += ds.totalTastyChanceIncreasePercent;
            acc.totalDreamShardCount += ds.totalDreamShardCount;
            accumulateIngredients(acc.ingredientSums, ds.totalIngredients);
            accumulateIngredients(acc.overflowIngredientSums, ds.totalOverflowIngredients);
        }

        // Accumulate team summary
        const ts = result.teamSummary;
        teamAcc.totalBerryEP += ts.totalBerryEP;
        teamAcc.totalIngredientEP += ts.totalIngredientEP;
        teamAcc.totalSkillEP += ts.totalSkillEP;
        teamAcc.grandTotalEP += ts.grandTotalEP;
        teamAcc.totalPresentCandyCount += ts.totalPresentCandyCount;
        teamAcc.totalCookingPotCapacityIncrease += ts.totalCookingPotCapacityIncrease;
        teamAcc.totalTastyChanceIncreasePercent += ts.totalTastyChanceIncreasePercent;
        teamAcc.totalDreamShardCount += ts.totalDreamShardCount;
        accumulateIngredients(teamAcc.ingredientSums, ts.totalIngredients);
    }

    // Sort descending by grandTotalEP (highest EP = rank 1)
    trials.sort((a, b) => b.grandTotalEP - a.grandTotalEP);

    // Median index (0-based, lower-median)
    const medianIndex = Math.floor((trials.length - 1) / 2);

    // Compute averages
    const n = trialCount;

    const averageDailySummaries: DailySummary[] = dailyOrder
        .map((pokemonId) => dailyAccsByPokemonId.get(pokemonId))
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
        totalIngredients: [...teamAcc.ingredientSums.entries()].map(([name, count]) => ({
            name: name as IngredientName,
            count: Math.round((count / n) * 10) / 10,
        })),
        totalBerryEP: Math.round(teamAcc.totalBerryEP / n),
        totalIngredientEP: Math.round(teamAcc.totalIngredientEP / n),
        totalSkillEP: Math.round(teamAcc.totalSkillEP / n),
        grandTotalEP: Math.round(teamAcc.grandTotalEP / n),
        totalPresentCandyCount: Math.round((teamAcc.totalPresentCandyCount / n) * 10) / 10,
        totalCookingPotCapacityIncrease: Math.round((teamAcc.totalCookingPotCapacityIncrease / n) * 10) / 10,
        totalTastyChanceIncreasePercent: Math.round((teamAcc.totalTastyChanceIncreasePercent / n) * 10) / 10,
        totalDreamShardCount: Math.round((teamAcc.totalDreamShardCount / n) * 10) / 10,
    };

    return { trials, medianIndex, averageDailySummaries, averageTeamSummary };
}
