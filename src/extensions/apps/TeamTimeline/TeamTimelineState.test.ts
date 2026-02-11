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
import { SimulationResult } from './types/TimeSlotTypes';
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
