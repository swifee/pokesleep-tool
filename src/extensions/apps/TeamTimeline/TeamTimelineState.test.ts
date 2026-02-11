import { describe, expect, it } from 'vitest';
import { createInitialState, teamTimelineReducer } from './TeamTimelineState';
import { SimulationResult } from './types/TimeSlotTypes';

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

describe('teamTimelineReducer', () => {
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
});
