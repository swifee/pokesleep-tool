import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailySummary, SimulationResult, TeamSummary } from '../types/TimeSlotTypes';
import { runMultiTrialSimulation, runMultiTrialSimulationWithProgress } from './MultiTrialSimulator';
import { createDefaultTimelineBonusSettings } from '../utils/TimelineBonusSettingsBridge';

const runSimulationMock = vi.fn();
const defaultBonusSettings = createDefaultTimelineBonusSettings();

vi.mock('./TimelineSimulator', () => ({
    runSimulation: (...args: unknown[]) => runSimulationMock(...args),
}));

function createDailySummary(pokemonId: number, totalHelpCount: number, totalEP: number): DailySummary {
    return {
        pokemonId,
        totalHelpCount,
        totalSkillCount: totalHelpCount,
        totalBerryCount: totalHelpCount,
        totalIngredients: [],
        berryEP: totalEP,
        ingredientEP: 0,
        skillEP: 0,
        totalEP,
        totalSkillOverflowCount: 0,
        totalOverflowIngredients: [],
        totalDirectSkillEP: 0,
        totalPresentCandyCount: 0,
        totalCookingPotCapacityIncrease: 0,
        totalTastyChanceIncreasePercent: 0,
        totalDreamShardCount: 0,
    };
}

function createTeamSummary(grandTotalEP: number): TeamSummary {
    return {
        totalIngredients: [],
        totalBerryEP: grandTotalEP,
        totalIngredientEP: 0,
        totalSkillEP: 0,
        grandTotalEP,
        totalPresentCandyCount: 0,
        totalCookingPotCapacityIncrease: 0,
        totalTastyChanceIncreasePercent: 0,
        totalDreamShardCount: 0,
    };
}

function createSimulationResult(dailySummaries: DailySummary[], teamSummary: TeamSummary): SimulationResult {
    return {
        slotResults: new Map(),
        dailySummaries,
        teamSummary,
    };
}

describe('runMultiTrialSimulation', () => {
    beforeEach(() => {
        runSimulationMock.mockReset();
    });

    it('aggregates averages by pokemonId even when summary order changes between trials', () => {
        runSimulationMock
            .mockReturnValueOnce(createSimulationResult(
                [
                    createDailySummary(1, 10, 100),
                    createDailySummary(2, 20, 200),
                ],
                createTeamSummary(1000),
            ))
            .mockReturnValueOnce(createSimulationResult(
                [
                    createDailySummary(2, 40, 400),
                    createDailySummary(1, 30, 300),
                ],
                createTeamSummary(2000),
            ));

        const result = runMultiTrialSimulation({
            team: [],
            timeSlots: [],
            config: { initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            trialCount: 2,
            initialSeed: 500,
        });

        expect(result.averageDailySummaries.map(s => s.pokemonId)).toEqual([1, 2]);
        expect(result.averageDailySummaries.find(s => s.pokemonId === 1)?.totalHelpCount).toBe(20);
        expect(result.averageDailySummaries.find(s => s.pokemonId === 2)?.totalHelpCount).toBe(30);
    });

    it('includes swapped-in pokemon in average summaries and keeps first-seen order', () => {
        runSimulationMock
            .mockReturnValueOnce(createSimulationResult(
                [
                    createDailySummary(10, 50, 500),
                ],
                createTeamSummary(3000),
            ))
            .mockReturnValueOnce(createSimulationResult(
                [
                    createDailySummary(10, 70, 700),
                    createDailySummary(99, 20, 200),
                ],
                createTeamSummary(2500),
            ));

        const result = runMultiTrialSimulation({
            team: [],
            timeSlots: [],
            config: { initialEnergy: 80, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            trialCount: 2,
            initialSeed: 700,
        });

        expect(result.averageDailySummaries.map(s => s.pokemonId)).toEqual([10, 99]);
        expect(result.averageDailySummaries.find(s => s.pokemonId === 10)?.totalHelpCount).toBe(60);
        // Appears only in one trial, averaged over all trials.
        expect(result.averageDailySummaries.find(s => s.pokemonId === 99)?.totalHelpCount).toBe(10);
    });

    it('bonusSettingsをrunSimulationへ伝播する', () => {
        runSimulationMock.mockReturnValue(createSimulationResult(
            [createDailySummary(1, 1, 100)],
            createTeamSummary(100),
        ));

        const bonusSettings = {
            ...defaultBonusSettings,
            fieldBonus: 45,
            isGoodCampTicketSet: true,
        };
        runMultiTrialSimulation({
            team: [],
            timeSlots: [],
            config: { initialEnergy: 60, simulationDays: 1 },
            bonusSettings,
            trialCount: 1,
            initialSeed: 999,
        });

        expect(runSimulationMock).toHaveBeenCalledTimes(1);
        expect(runSimulationMock.mock.calls[0]?.[0]).toMatchObject({
            bonusSettings,
        });
    });

    it('reports progress until 100 in async simulation', async () => {
        runSimulationMock
            .mockReturnValue(createSimulationResult(
                [createDailySummary(1, 1, 100)],
                createTeamSummary(1000),
            ));
        const onProgress = vi.fn();

        await runMultiTrialSimulationWithProgress({
            team: [],
            timeSlots: [],
            config: { initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            trialCount: 3,
            initialSeed: 100,
            onProgress,
            yieldEvery: 1,
        });

        expect(onProgress).toHaveBeenCalled();
        expect(onProgress.mock.calls[0]?.[0]).toBe(0);
        expect(onProgress.mock.calls[onProgress.mock.calls.length - 1]?.[0]).toBe(100);
    });
});
