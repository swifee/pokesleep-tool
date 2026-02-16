import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TeamSummary } from '../types/TimeSlotTypes';
import type { AverageCookingSummary, CookingSimulationResult } from '../types/CookingTypes';
import TeamSummaryRow from './TeamSummaryRow';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => (
            key.startsWith('TeamTimeline.recipe ')
                ? `translated:${key}`
                : (defaultValue ?? key)
        ),
    }),
}));

vi.mock('../../../../ui/IvCalc/IngredientIcon', () => ({
    default: ({ name }: { name: string }) => <span>{name}</span>,
}));

const TEAM_SUMMARY: TeamSummary = {
    totalIngredients: [],
    totalBerryEP: 1000,
    totalIngredientEP: 2000,
    totalSkillEP: 3000,
    grandTotalEP: 6000,
    totalPresentCandyCount: 0,
    totalCookingPotCapacityIncrease: 0,
    totalTastyChanceIncreasePercent: 0,
    totalDreamShardCount: 0,
};

const TEAM_SUMMARY_WITH_INGREDIENTS: TeamSummary = {
    ...TEAM_SUMMARY,
    totalIngredients: [
        { name: 'milk', count: 3 },
        { name: 'apple', count: 12 },
        { name: 'honey', count: 1 },
        { name: 'mushroom', count: 6 },
    ],
};

const TEAM_SUMMARY_WITH_COOKING: TeamSummary = {
    ...TEAM_SUMMARY,
    totalCookingEP: 2400,
    grandTotalEP: 6400,
};

const COOKING_RESULT: CookingSimulationResult = {
    events: [],
    dailySummaries: [
        {
            events: [
                {
                    mealSlotId: 'breakfast',
                    mealType: 'breakfast',
                    recipeName: 'specialAppleCurry',
                    isGreatSuccess: false,
                    cookingEP: 1000,
                    eBase: 0,
                    eDisplay: 0,
                    eFinal: 0,
                    ingredientsUsed: [],
                    remainingPotCapacity: 0,
                    effectivePotCapacity: 15,
                    tastyChancePercent: 10,
                    cookingPowerUpBonusUsed: 0,
                },
            ],
            totalCookingEP: 1000,
            greatSuccessCount: 0,
        },
    ],
    pokemonAttributions: [],
    leftoverIngredients: {
        byPokemon: new Map(),
        initialRemaining: {},
        total: {},
    },
    totalCookingEP: 1000,
    totalInitialIngredientEP: 321,
};

const AVERAGE_COOKING_SUMMARY: AverageCookingSummary = {
    recipes: [
        {
            recipeName: 'lowBaseVisibleRecipe',
            eBase: 1200,
            averageCount: 1.5,
            averageCookingEP: 4200,
        },
        {
            recipeName: 'highBaseVisibleRecipe',
            eBase: 3000,
            averageCount: 2,
            averageCookingEP: 9800,
        },
        {
            recipeName: 'groupedRecipe',
            eBase: 2500,
            averageCount: 0.055,
            averageCookingEP: 550,
        },
        {
            recipeName: 'excludedRecipe',
            eBase: 500,
            averageCount: 0.009,
            averageCookingEP: 90,
        },
    ],
    leftoverIngredients: [
        { name: 'apple', count: 4.5 },
        { name: 'milk', count: 0 },
        { name: 'honey', count: 2 },
    ],
    averageInitialIngredientEP: 789,
};

describe('TeamSummaryRow', () => {
    it('shows label in details mode', () => {
        render(<TeamSummaryRow teamSummary={TEAM_SUMMARY} layoutMode="details" />);
        expect(screen.getByText('合計')).toBeDefined();
    });

    it('hides label in average mode', () => {
        render(<TeamSummaryRow teamSummary={TEAM_SUMMARY} layoutMode="average" />);
        expect(screen.queryByText('合計')).toBeNull();
        expect(screen.getByText('total 6,000EP')).toBeDefined();
    });

    it('sorts ingredients by count descending and shows ingredient totals in details mode', () => {
        const { container } = render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY_WITH_INGREDIENTS}
                layoutMode="details"
                simulationDays={2}
            />
        );

        const content = container.textContent ?? '';
        expect(content.indexOf('apple')).toBeLessThan(content.indexOf('mushroom'));
        expect(content.indexOf('mushroom')).toBeLessThan(content.indexOf('milk'));
        expect(content.indexOf('milk')).toBeLessThan(content.indexOf('honey'));
        expect(content).toContain('食材合計: 22');
        expect(content).toContain('1食平均 : 3.7');
    });

    it('renders EP panel before ingredient metadata', () => {
        const { container } = render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY_WITH_INGREDIENTS}
                layoutMode="details"
                simulationDays={2}
            />
        );

        const content = container.textContent ?? '';
        expect(content.indexOf('total 6,000EP')).toBeLessThan(content.indexOf('食材合計: 22'));
    });

    it('shows EP in berry -> skill -> ingredient order when cooking simulation is off', () => {
        const { container } = render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
            />
        );

        const content = container.textContent ?? '';
        expect(content.indexOf('きのみ : 1,000EP')).toBeLessThan(content.indexOf('スキル : 3,000EP'));
        expect(content.indexOf('スキル : 3,000EP')).toBeLessThan(content.indexOf('食材 : 2,000EP'));
    });

    it('shows EP in berry -> skill -> cooking order when cooking simulation is on', () => {
        const { container } = render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY_WITH_COOKING}
                layoutMode="details"
            />
        );

        const content = container.textContent ?? '';
        expect(content.indexOf('きのみ : 1,000EP')).toBeLessThan(content.indexOf('スキル : 3,000EP'));
        expect(content.indexOf('スキル : 3,000EP')).toBeLessThan(content.indexOf('料理 : 2,400EP'));
    });

    it('always keeps top 3 ingredients visible and groups only low ingredients after 4th item', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY_WITH_INGREDIENTS}
                layoutMode="average"
                simulationDays={2}
            />
        );

        const trigger = screen.getByRole('button', { name: '他 1' });
        expect(trigger).toBeDefined();
        expect(screen.getByText('milk')).toBeDefined();
        fireEvent.click(trigger);

        expect(screen.getByText('honey')).toBeDefined();
    });

    it('shows 食材合計 as integer', () => {
        render(
            <TeamSummaryRow
                teamSummary={{
                    ...TEAM_SUMMARY,
                    totalIngredients: [
                        { name: 'apple', count: 1000.4 },
                        { name: 'milk', count: 944.5 },
                    ],
                }}
                layoutMode="average"
                simulationDays={7}
            />
        );

        expect(screen.getByText('食材合計:')).toBeDefined();
        expect((screen.getByText('食材合計:').parentElement?.textContent) ?? '').toContain('1,945');
    });

    it('switches to daily average values when valueMode is dailyAverage', () => {
        render(
            <TeamSummaryRow
                teamSummary={{
                    ...TEAM_SUMMARY,
                    totalBerryEP: 3001,
                    totalIngredientEP: 2001,
                    totalSkillEP: 1001,
                    grandTotalEP: 6003,
                    totalIngredients: [{ name: 'apple', count: 10 }],
                }}
                layoutMode="details"
                simulationDays={3}
                valueMode="dailyAverage"
            />
        );

        const text = document.body.textContent ?? '';
        expect(text).toContain('きのみ : 1,000EP');
        expect(text).toContain('食材 : 667EP');
        expect(text).toContain('スキル : 334EP');
        expect(text).toContain('total 2,001EP');
        expect(text).toContain('食材合計: 3');
    });

    it('renders translated recipe names in cooking result', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
                cookingResult={COOKING_RESULT}
            />
        );

        expect(screen.getByText('translated:TeamTimeline.recipe specialAppleCurry')).toBeDefined();
    });

    it('shows initial ingredient EP total in cooking result details', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
                cookingResult={COOKING_RESULT}
            />
        );

        expect((document.body.textContent ?? '')).toContain('初期食材由来EP合計 : 321EP');
    });

    it('renders average cooking summary in requested format and groups recipes below 1.0 count', () => {
        const { container } = render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY_WITH_COOKING}
                layoutMode="average"
                averageCookingSummary={AVERAGE_COOKING_SUMMARY}
            />
        );

        const content = container.textContent ?? '';
        expect(content).toContain('あまり食材平均');
        expect(content).toContain('milk0');
        expect(content).toContain('translated:TeamTimeline.recipe highBaseVisibleRecipe : 平均9,800EP × 2回');
        expect(content).toContain('translated:TeamTimeline.recipe lowBaseVisibleRecipe : 平均4,200EP × 1.5回');
        expect(content.indexOf('translated:TeamTimeline.recipe highBaseVisibleRecipe'))
            .toBeLessThan(content.indexOf('translated:TeamTimeline.recipe lowBaseVisibleRecipe'));

        const groupedButton = screen.getByRole('button', { name: '他 0.06回' });
        expect(groupedButton).toBeDefined();

        fireEvent.click(groupedButton);
        const popoverText = document.body.textContent ?? '';
        expect(popoverText).toContain('translated:TeamTimeline.recipe groupedRecipe : 平均550EP × 0.06回');
        expect(popoverText).not.toContain('translated:TeamTimeline.recipe excludedRecipe');
    });

    it('shows initial ingredient EP total in average mode and converts by dailyAverage', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY_WITH_COOKING}
                layoutMode="average"
                simulationDays={3}
                valueMode="dailyAverage"
                averageCookingSummary={AVERAGE_COOKING_SUMMARY}
            />
        );

        expect((document.body.textContent ?? '')).toContain('初期食材由来EP合計 : 263EP');
    });
});
