import { SimulationResult } from '../types/TimeSlotTypes';

export function shouldShowAdditionalAnalysisPanel(
    simulationResult: SimulationResult | null,
    simulationLoading: boolean
): boolean {
    return simulationResult !== null && !simulationLoading;
}
