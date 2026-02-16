import { describe, expect, it } from 'vitest';
import {
    createInitialState,
    teamTimelineReducer,
    loadSummaryValueModeFromStorage,
    saveSummaryValueModeToStorage,
    STORAGE_KEY_SUMMARY_VALUE_MODE,
    loadSeedModeFromStorage,
    saveSeedModeToStorage,
    STORAGE_KEY_SEED_MODE,
    loadTrialCountFromStorage,
    saveTrialCountToStorage,
    STORAGE_KEY_TRIAL_COUNT,
    loadSyncWithIvParameterFromStorage,
    STORAGE_KEY_SYNC_IV_PARAMETER,
} from './TeamTimelineState';
import { SimulationResult, PokemonSwap } from './types/TimeSlotTypes';
import type { PokemonBoxItem } from '../../../util/PokemonBox';

function createSimulationResult(grandTotalEP: number): SimulationResult {
    return {
        slotResults: new Map(),
        dailySummaries: [],
        teamSummary: {
            totalIngredients: [],
            totalBerryEP: grandTotalEP,
            totalIngredientEP: 0,
            totalSkillEP: 0,
            grandTotalEP,
            totalPresentCandyCount: 0,
            totalCookingPotCapacityIncrease: 0,
            totalTastyChanceIncreasePercent: 0,
            totalDreamShardCount: 0,
        },
    };
}

function createStateWithSimulationData() {
    const simulationResult = createSimulationResult(2000);
    return {
        ...createInitialState(),
        simulationLoading: true,
        simulationResult,
        simulationError: 'error',
        multiTrialResults: [{ seed: 1, grandTotalEP: 1900 }],
        multiTrialSelectedIndex: 0,
        multiTrialAverageDailySummaries: [],
        multiTrialAverageTeamSummary: simulationResult.teamSummary,
        multiTrialAverageCookingSummary: {
            recipes: [],
            leftoverIngredients: [],
        },
    };
}

describe('teamTimelineReducer', () => {
    it('uses requested first-access defaults for simulation controls', () => {
        const state = createInitialState();

        expect(state.simulationConfig.simulationDays).toBe(1);
        expect(state.simulationConfig.initialEnergy).toBe(50);
        expect(state.simulationConfig.seed).toBe(123456);
        expect(state.seedMode).toBe('random');
        expect(state.multiTrialCount).toBe(1000);
        expect(state.syncWithIvParameter).toBe(true);
        expect(state.cookingSettings.basePotCapacity).toBe(81);
        expect(state.cookingSettings.recipeLevels).toEqual({});
        expect(state.timeSlots).toEqual([
            { id: 'slot-1', time: '07:00', sleepState: 'wake', hasMeal: true },
            { id: 'slot-2', time: '12:00', sleepState: 'none', hasMeal: true },
            { id: 'slot-3', time: '15:00', sleepState: 'none', hasMeal: false },
            { id: 'slot-4', time: '18:00', sleepState: 'none', hasMeal: true },
            { id: 'slot-5', time: '23:00', sleepState: 'sleep', hasMeal: false },
        ]);
    });

    it('keeps simulation loading state when preview result is set', () => {
        const started = teamTimelineReducer(createInitialState(), { type: 'startSimulation' });
        const previewResult = createSimulationResult(1234);

        const next = teamTimelineReducer(started, {
            type: 'setSimulationPreviewResult',
            result: previewResult,
        });

        expect(next.simulationLoading).toBe(true);
        expect(next.simulationResult).toEqual(previewResult);
    });

    it('clears all simulation outputs when selecting team member', () => {
        const state = createStateWithSimulationData();

        const next = teamTimelineReducer(state, {
            type: 'selectPokemon',
            index: 0,
            item: {} as PokemonBoxItem,
        });

        expect(next.simulationLoading).toBe(false);
        expect(next.simulationResult).toBeNull();
        expect(next.simulationError).toBeNull();
        expect(next.multiTrialResults).toBeNull();
        expect(next.multiTrialSelectedIndex).toBeNull();
        expect(next.multiTrialAverageDailySummaries).toBeNull();
        expect(next.multiTrialAverageTeamSummary).toBeNull();
        expect(next.multiTrialAverageCookingSummary).toBeNull();
    });

    it('clears all simulation outputs when removing team member', () => {
        const state = createStateWithSimulationData();

        const next = teamTimelineReducer(state, {
            type: 'removePokemon',
            index: 0,
        });

        expect(next.simulationLoading).toBe(false);
        expect(next.simulationResult).toBeNull();
        expect(next.simulationError).toBeNull();
        expect(next.multiTrialResults).toBeNull();
        expect(next.multiTrialSelectedIndex).toBeNull();
        expect(next.multiTrialAverageDailySummaries).toBeNull();
        expect(next.multiTrialAverageTeamSummary).toBeNull();
        expect(next.multiTrialAverageCookingSummary).toBeNull();
    });

    it('keeps simulation outputs when only swaps are changed', () => {
        const state = {
            ...createStateWithSimulationData(),
            swaps: [
                {
                    dayIndex: 0,
                    slotId: 'morning',
                    teamSlotIndex: 0,
                    newPokemonId: 123,
                    initialEnergy: 100,
                },
            ],
        };

        const next = teamTimelineReducer(state, { type: 'clearSwaps' });

        expect(next.swaps).toEqual([]);
        expect(next.simulationResult).toBe(state.simulationResult);
        expect(next.multiTrialResults).toBe(state.multiTrialResults);
        expect(next.multiTrialAverageTeamSummary).toBe(state.multiTrialAverageTeamSummary);
        expect(next.multiTrialAverageCookingSummary).toBe(state.multiTrialAverageCookingSummary);
    });
});

describe('removeSwap behavior', () => {
    it('removeSwap without repeat option removes only the targeted day', () => {
        const state = {
            ...createInitialState(),
            swaps: [
                { dayIndex: 0, slotId: 'slot-2', teamSlotIndex: 0, newPokemonId: 999, initialEnergy: 80 },
                { dayIndex: 1, slotId: 'slot-2', teamSlotIndex: 0, newPokemonId: 999, initialEnergy: 80 },
            ],
        };

        const next = teamTimelineReducer(state, {
            type: 'removeSwap',
            slotId: 'slot-2',
            teamIndex: 0,
            dayIndex: 0,
        });

        expect(next.swaps).toHaveLength(1);
        expect(next.swaps[0].dayIndex).toBe(1);
    });

    it('removeSwap with repeat option removes current and future same-pokemon swaps', () => {
        const state = {
            ...createInitialState(),
            swaps: [
                { dayIndex: 0, slotId: 'slot-2', teamSlotIndex: 0, newPokemonId: 999, initialEnergy: 80 },
                { dayIndex: 1, slotId: 'slot-2', teamSlotIndex: 0, newPokemonId: 999, initialEnergy: 80 },
                { dayIndex: 2, slotId: 'slot-2', teamSlotIndex: 0, newPokemonId: 999, initialEnergy: 80 },
                { dayIndex: 3, slotId: 'slot-2', teamSlotIndex: 0, newPokemonId: 888, initialEnergy: 80 },
                { dayIndex: 1, slotId: 'slot-3', teamSlotIndex: 0, newPokemonId: 999, initialEnergy: 80 },
            ],
        };

        const next = teamTimelineReducer(state, {
            type: 'removeSwap',
            slotId: 'slot-2',
            teamIndex: 0,
            dayIndex: 0,
            removeFutureRepeats: true,
            pokemonId: 999,
        });

        expect(next.swaps).toHaveLength(2);
        expect(next.swaps).toEqual([
            { dayIndex: 3, slotId: 'slot-2', teamSlotIndex: 0, newPokemonId: 888, initialEnergy: 80 },
            { dayIndex: 1, slotId: 'slot-3', teamSlotIndex: 0, newPokemonId: 999, initialEnergy: 80 },
        ]);
    });
});

describe('summary value mode storage', () => {
    it('saves and loads dailyAverage mode', () => {
        saveSummaryValueModeToStorage('dailyAverage');
        expect(loadSummaryValueModeFromStorage()).toBe('dailyAverage');
    });

    it('falls back to periodTotal for missing or invalid value', () => {
        localStorage.removeItem(STORAGE_KEY_SUMMARY_VALUE_MODE);
        expect(loadSummaryValueModeFromStorage()).toBe('periodTotal');

        localStorage.setItem(STORAGE_KEY_SUMMARY_VALUE_MODE, 'unexpected');
        expect(loadSummaryValueModeFromStorage()).toBe('periodTotal');
    });
});

describe('confirmSwap with endSlotId and repeat', () => {
    /** Helper to create a state with swap dialog targeting a specific slot */
    function createSwapReadyState(overrides?: {
        simulationDays?: number;
        pendingSwapPokemonId?: number;
        swapTargetSlotId?: string;
        swapTargetTeamIndex?: number;
        swapTargetDayIndex?: number;
        team?: (PokemonBoxItem | null)[];
        swaps?: PokemonSwap[];
    }) {
        const team = overrides?.team ?? [
            { id: 100 } as PokemonBoxItem,
            { id: 200 } as PokemonBoxItem,
            null,
            null,
            null,
        ];
        const base = createInitialState();
        return {
            ...base,
            team,
            simulationConfig: {
                ...base.simulationConfig,
                simulationDays: overrides?.simulationDays ?? 1,
            },
            swapTargetSlotId: overrides?.swapTargetSlotId ?? 'slot-2',
            swapTargetTeamIndex: overrides?.swapTargetTeamIndex ?? 0,
            swapTargetDayIndex: overrides?.swapTargetDayIndex ?? 0,
            swapDialogOpen: false,
            energyDialogOpen: true,
            pendingSwapPokemonId: overrides?.pendingSwapPokemonId ?? 999,
            swaps: overrides?.swaps ?? [],
        };
    }

    it('confirmSwap stores endSlotId and endDayIndex', () => {
        const state = createSwapReadyState();

        const next = teamTimelineReducer(state, {
            type: 'confirmSwap',
            initialEnergy: 80,
            endSlotId: 'slot-4',
            endDayIndex: 0,
        });

        expect(next.swaps).toHaveLength(1);
        const swap = next.swaps[0];
        expect(swap.endSlotId).toBe('slot-4');
        expect(swap.endDayIndex).toBe(0);
        expect(swap.revertPokemonId).toBe(100); // original team Pokemon id
    });

    it('confirmSwap with repeat generates swaps for subsequent days', () => {
        const state = createSwapReadyState({
            simulationDays: 3,
            swapTargetDayIndex: 0,
        });

        const next = teamTimelineReducer(state, {
            type: 'confirmSwap',
            initialEnergy: 80,
            repeat: true,
        });

        expect(next.swaps).toHaveLength(3);

        // Day 0: the original swap
        expect(next.swaps[0].dayIndex).toBe(0);
        expect(next.swaps[0].isRepeatGenerated).toBeUndefined();

        // Day 1: repeat-generated
        expect(next.swaps[1].dayIndex).toBe(1);
        expect(next.swaps[1].isRepeatGenerated).toBe(true);

        // Day 2: repeat-generated
        expect(next.swaps[2].dayIndex).toBe(2);
        expect(next.swaps[2].isRepeatGenerated).toBe(true);
    });

    it('confirmSwap with repeat and endSlotId adjusts endDayIndex for each day', () => {
        const state = createSwapReadyState({
            simulationDays: 3,
            swapTargetDayIndex: 0,
        });

        const next = teamTimelineReducer(state, {
            type: 'confirmSwap',
            initialEnergy: 80,
            endSlotId: 'slot-4',
            endDayIndex: 0,
            repeat: true,
        });

        expect(next.swaps).toHaveLength(3);
        expect(next.swaps[0].endDayIndex).toBe(0);
        expect(next.swaps[1].endDayIndex).toBe(1);
        expect(next.swaps[2].endDayIndex).toBe(2);
    });

    it('confirmSwap revertPokemonId uses original team Pokemon', () => {
        const state = createSwapReadyState({
            team: [
                { id: 42 } as PokemonBoxItem,
                { id: 77 } as PokemonBoxItem,
                null,
                null,
                null,
            ],
            swapTargetTeamIndex: 0,
            pendingSwapPokemonId: 555,
        });

        const next = teamTimelineReducer(state, {
            type: 'confirmSwap',
            initialEnergy: 100,
        });

        expect(next.swaps).toHaveLength(1);
        expect(next.swaps[0].revertPokemonId).toBe(42);
    });

    it('confirmSwap revertPokemonId uses prior swap Pokemon when one exists', () => {
        // An existing swap at slot-1 day 0 that placed Pokemon 777
        const existingSwap: PokemonSwap = {
            dayIndex: 0,
            slotId: 'slot-1',
            teamSlotIndex: 0,
            newPokemonId: 777,
            initialEnergy: 100,
        };

        const state = createSwapReadyState({
            team: [
                { id: 42 } as PokemonBoxItem,
                null,
                null,
                null,
                null,
            ],
            swapTargetTeamIndex: 0,
            swapTargetSlotId: 'slot-3',   // later slot than slot-1
            swapTargetDayIndex: 0,
            pendingSwapPokemonId: 888,
            swaps: [existingSwap],
        });

        const next = teamTimelineReducer(state, {
            type: 'confirmSwap',
            initialEnergy: 80,
        });

        // The new swap should be at slot-3
        const newSwap = next.swaps.find(s => s.slotId === 'slot-3');
        expect(newSwap).toBeDefined();
        // revertPokemonId should be the prior swap's Pokemon, not the original team Pokemon
        expect(newSwap!.revertPokemonId).toBe(777);
    });

    it('confirmSwap revertPokemonId follows timeline state after prior swap reverts', () => {
        const existingSwapWithEnd: PokemonSwap = {
            dayIndex: 0,
            slotId: 'slot-2',
            teamSlotIndex: 0,
            newPokemonId: 777,
            initialEnergy: 100,
            endSlotId: 'slot-3',
            endDayIndex: 0,
            revertPokemonId: 42,
        };

        const state = createSwapReadyState({
            team: [
                { id: 42 } as PokemonBoxItem,
                null,
                null,
                null,
                null,
            ],
            swapTargetTeamIndex: 0,
            swapTargetSlotId: 'slot-4',
            swapTargetDayIndex: 0,
            pendingSwapPokemonId: 888,
            swaps: [existingSwapWithEnd],
        });

        const next = teamTimelineReducer(state, {
            type: 'confirmSwap',
            initialEnergy: 80,
        });

        const newSwap = next.swaps.find(
            s => s.dayIndex === 0 && s.slotId === 'slot-4' && s.newPokemonId === 888
        );
        expect(newSwap).toBeDefined();
        expect(newSwap!.revertPokemonId).toBe(42);
    });

    it('confirmSwap on later day uses carried active pokemon as revert target', () => {
        const persistentSwap: PokemonSwap = {
            dayIndex: 0,
            slotId: 'slot-2',
            teamSlotIndex: 0,
            newPokemonId: 777,
            initialEnergy: 100,
        };

        const state = createSwapReadyState({
            simulationDays: 3,
            team: [
                { id: 42 } as PokemonBoxItem,
                null,
                null,
                null,
                null,
            ],
            swapTargetTeamIndex: 0,
            swapTargetSlotId: 'slot-2',
            swapTargetDayIndex: 1,
            pendingSwapPokemonId: 888,
            swaps: [persistentSwap],
        });

        const next = teamTimelineReducer(state, {
            type: 'confirmSwap',
            initialEnergy: 80,
        });

        const newSwap = next.swaps.find(
            s => s.dayIndex === 1 && s.slotId === 'slot-2' && s.newPokemonId === 888
        );
        expect(newSwap).toBeDefined();
        expect(newSwap!.revertPokemonId).toBe(777);
    });
});

describe('simulation controls storage', () => {
    it('saves and loads seed mode', () => {
        saveSeedModeToStorage('fixed');
        expect(loadSeedModeFromStorage()).toBe('fixed');
    });

    it('falls back to random seed mode for missing or invalid value', () => {
        localStorage.removeItem(STORAGE_KEY_SEED_MODE);
        expect(loadSeedModeFromStorage()).toBe('random');

        localStorage.setItem(STORAGE_KEY_SEED_MODE, 'unexpected');
        expect(loadSeedModeFromStorage()).toBe('random');
    });

    it('saves and loads trial count', () => {
        saveTrialCountToStorage(1000);
        expect(loadTrialCountFromStorage()).toBe(1000);
    });

    it('falls back to default trial count for missing or invalid value', () => {
        localStorage.removeItem(STORAGE_KEY_TRIAL_COUNT);
        expect(loadTrialCountFromStorage()).toBe(1000);

        localStorage.setItem(STORAGE_KEY_TRIAL_COUNT, '999');
        expect(loadTrialCountFromStorage()).toBe(1000);
    });

    it('defaults syncWithIvParameter to true when storage is missing', () => {
        localStorage.removeItem(STORAGE_KEY_SYNC_IV_PARAMETER);
        expect(loadSyncWithIvParameterFromStorage()).toBe(true);
    });

    it('loads syncWithIvParameter from storage when explicitly set', () => {
        localStorage.setItem(STORAGE_KEY_SYNC_IV_PARAMETER, '0');
        expect(loadSyncWithIvParameterFromStorage()).toBe(false);

        localStorage.setItem(STORAGE_KEY_SYNC_IV_PARAMETER, '1');
        expect(loadSyncWithIvParameterFromStorage()).toBe(true);
    });
});
