export interface AnalysisBaseMetricsCache<TMetrics> {
    quickModeEnabled: boolean;
    metrics: TMetrics;
}

export function resolvePrecomputedBaseAverageMetrics<TMetrics>(
    cache: AnalysisBaseMetricsCache<TMetrics> | null,
    quickModeEnabled: boolean,
    metricsFromSimulation: TMetrics | null
): TMetrics | null {
    if (cache && cache.quickModeEnabled === quickModeEnabled) {
        return cache.metrics;
    }
    if (!quickModeEnabled) {
        return metricsFromSimulation;
    }
    return null;
}
