import { describe, expect, it } from 'vitest';
import { shouldShowAdditionalAnalysisPanel } from './TeamTimelineDisplayUtils';
import { SimulationResult } from '../types/TimeSlotTypes';

function createSimulationResult(): SimulationResult {
    return {
        slotResults: new Map(),
        dailySummaries: [],
        teamSummary: {
            totalIngredients: [],
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

describe('TeamTimelineDisplayUtils', () => {
    it('returns true only when simulation has a result and is not loading', () => {
        const result = createSimulationResult();
        expect(shouldShowAdditionalAnalysisPanel(null, false)).toBe(false);
        expect(shouldShowAdditionalAnalysisPanel(result, true)).toBe(false);
        expect(shouldShowAdditionalAnalysisPanel(result, false)).toBe(true);
    });
});
