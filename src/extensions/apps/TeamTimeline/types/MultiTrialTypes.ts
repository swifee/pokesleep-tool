import type { AverageCookingSummary } from "./CookingTypes";
import type { DailySummary, TeamSummary } from "./TimeSlotTypes";

/**
 * MultiTrialTypes.ts
 * Multi-trial simulation type definitions
 */

/** Single trial summary (memory-efficient: only seed + EP) */
export interface TrialSummary {
	/** The seed used for this trial */
	readonly seed: number;
	/** Total EP from teamSummary.grandTotalEP */
	readonly grandTotalEP: number;
}

/** Multi-trial simulation result */
export interface MultiTrialResult {
	/** All trial summaries, sorted by grandTotalEP descending */
	readonly trials: readonly TrialSummary[];
	/** Index of the median trial (default view) */
	readonly medianIndex: number;
	/** Average daily summaries across all trials (one per pokemon) */
	readonly averageDailySummaries: DailySummary[];
	/** Average team summary across all trials */
	readonly averageTeamSummary: TeamSummary;
	/** Average cooking summary across all trials (when cooking simulation is enabled) */
	readonly averageCookingSummary: AverageCookingSummary | null;
}

/** Available trial count options */
export const TRIAL_COUNT_OPTIONS = [1, 100, 1000, 10000] as const;
export type TrialCount = (typeof TRIAL_COUNT_OPTIONS)[number];
