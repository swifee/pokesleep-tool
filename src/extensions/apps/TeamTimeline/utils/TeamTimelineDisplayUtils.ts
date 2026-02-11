import { SimulationResult } from '../types/TimeSlotTypes';

export type TeamTimelineTab = 'team' | 'settings';

export function shouldShowAdditionalAnalysisPanel(
    simulationResult: SimulationResult | null,
    simulationLoading: boolean
): boolean {
    return simulationResult !== null && !simulationLoading;
}

export function shouldSkipTeamResultEntryAnimation(
    previousTab: TeamTimelineTab,
    nextTab: TeamTimelineTab
): boolean {
    return previousTab === 'settings' && nextTab === 'team';
}
