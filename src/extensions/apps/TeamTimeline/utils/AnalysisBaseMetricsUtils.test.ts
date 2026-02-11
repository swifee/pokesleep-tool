import { describe, expect, it } from 'vitest';
import {
    AnalysisBaseMetricsCache,
    resolvePrecomputedBaseAverageMetrics,
} from './AnalysisBaseMetricsUtils';

interface TestMetrics {
    teamEP: number;
    teamHelpCount: number;
}

function createMetrics(input: TestMetrics): TestMetrics {
    return {
        teamEP: input.teamEP,
        teamHelpCount: input.teamHelpCount,
    };
}

describe('AnalysisBaseMetricsUtils', () => {
    it('returns cached metrics when quick mode matches cache mode', () => {
        const cachedMetrics = createMetrics({ teamEP: 1000, teamHelpCount: 50 });
        const simulationMetrics = createMetrics({ teamEP: 9999, teamHelpCount: 999 });
        const cache: AnalysisBaseMetricsCache<TestMetrics> = {
            quickModeEnabled: true,
            metrics: cachedMetrics,
        };

        const resolved = resolvePrecomputedBaseAverageMetrics(cache, true, simulationMetrics);

        expect(resolved).toBe(cachedMetrics);
    });

    it('ignores simulation metrics in quick mode when cache is not available', () => {
        const simulationMetrics = createMetrics({ teamEP: 2000, teamHelpCount: 100 });

        const resolved = resolvePrecomputedBaseAverageMetrics<TestMetrics>(null, true, simulationMetrics);

        expect(resolved).toBeNull();
    });

    it('uses simulation metrics in normal mode when cache is not available', () => {
        const simulationMetrics = createMetrics({ teamEP: 3000, teamHelpCount: 150 });

        const resolved = resolvePrecomputedBaseAverageMetrics<TestMetrics>(null, false, simulationMetrics);

        expect(resolved).toBe(simulationMetrics);
    });

    it('falls back to simulation metrics in normal mode when cache mode differs', () => {
        const cachedQuickMetrics = createMetrics({ teamEP: 4000, teamHelpCount: 200 });
        const simulationMetrics = createMetrics({ teamEP: 5000, teamHelpCount: 250 });
        const cache: AnalysisBaseMetricsCache<TestMetrics> = {
            quickModeEnabled: true,
            metrics: cachedQuickMetrics,
        };

        const resolved = resolvePrecomputedBaseAverageMetrics(cache, false, simulationMetrics);

        expect(resolved).toBe(simulationMetrics);
    });
});
