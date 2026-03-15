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

function createIngredientUsage(name: 'apple' | 'milk' | 'honey', count: number) {
    return {
        name,
        count,
        pokemonAttribution: new Map<number, number>(),
        fromInitial: count,
    };
}

const COOKING_RESULT_WITH_EXTRA_LEFTOVER: CookingSimulationResult = {
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
            extraIngredientsUsed: [
                createIngredientUsage('apple', 3),
                createIngredientUsage('milk', 1),
            ],
            remainingPotCapacity: 0,
            effectivePotCapacity: 15,
            tastyChancePercent: 10,
            cookingPowerUpBonusUsed: 0,
        },
    ],
    dailySummaries: [],
    pokemonAttributions: [],
    leftoverIngredients: {
        byPokemon: new Map(),
        initialRemaining: {},
        total: {
            apple: 10,
            milk: 4,
        },
    },
    totalCookingEP: 1000,
};

const AVERAGE_COOKING_SUMMARY_WITH_AFTER_EXTRA: AverageCookingSummary = {
    recipes: [],
    leftoverIngredients: [
        { name: 'apple', count: 7 },
        { name: 'milk', count: 3 },
    ],
    leftoverIngredientsAfterExtra: [
        { name: 'apple', count: 4 },
        { name: 'milk', count: 1 },
    ],
};

describe('TeamSummaryRow', () => {
    it('shows label in details mode', () => {
        render(<TeamSummaryRow teamSummary={TEAM_SUMMARY} layoutMode="details" />);
        expect(screen.getByText('合計')).toBeDefined();
    });

    it('hides label in average mode', () => {
        render(<TeamSummaryRow teamSummary={TEAM_SUMMARY} layoutMode="average" />);
        expect(screen.queryByText('合計')).toBeNull();
        expect(document.body.textContent ?? '').toContain('total 6,000 EP');
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
        expect(content.indexOf('total 6,000 EP')).toBeLessThan(content.indexOf('食材合計: 22'));
    });

    it('shows EP in berry -> skill -> ingredient order when cooking simulation is off', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
            />
        );

        const berryItem = screen.getByTestId('team-summary-ep-item-berry');
        const skillItem = screen.getByTestId('team-summary-ep-item-skill');
        const ingredientItem = screen.getByTestId('team-summary-ep-item-ingredient');
        expect(berryItem.compareDocumentPosition(skillItem) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
        expect(skillItem.compareDocumentPosition(ingredientItem) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    });

    it('shows EP in berry -> skill -> cooking order when cooking simulation is on', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY_WITH_COOKING}
                layoutMode="details"
            />
        );

        const berryItem = screen.getByTestId('team-summary-ep-item-berry');
        const skillItem = screen.getByTestId('team-summary-ep-item-skill');
        const cookingItem = screen.getByTestId('team-summary-ep-item-cooking');
        expect(berryItem.compareDocumentPosition(skillItem) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
        expect(skillItem.compareDocumentPosition(cookingItem) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
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

        expect(screen.getByTestId('team-summary-ep-item-berry').textContent).toContain('1,000 EP');
        expect(screen.getByTestId('team-summary-ep-item-ingredient').textContent).toContain('667 EP');
        expect(screen.getByTestId('team-summary-ep-item-skill').textContent).toContain('334 EP');
        expect((document.body.textContent ?? '')).toContain('total 2,001 EP');
        expect((document.body.textContent ?? '')).toContain('食材合計: 3');
    });

    it('shows 料理大成功 label in team metadata when tasty chance is positive', () => {
        render(
            <TeamSummaryRow
                teamSummary={{
                    ...TEAM_SUMMARY,
                    totalTastyChanceIncreasePercent: 12.5,
                }}
                layoutMode="details"
            />
        );

        const content = document.body.textContent ?? '';
        expect(content).toContain('料理大成功 : +12.5%');
        expect(content).not.toContain('料理チャンス : +12.5%');
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

        expect((document.body.textContent ?? '')).toContain('初期食材由来EP合計 : 321 EP');
    });

    it('renders remaining pot capacity in cooking details as integer when floating-point noise exists', () => {
        const cookingResultWithFloatingPot: CookingSimulationResult = {
            ...COOKING_RESULT,
            dailySummaries: [
                {
                    events: [
                        {
                            ...COOKING_RESULT.dailySummaries[0]!.events[0]!,
                            remainingPotCapacity: Number.parseFloat('76.0000000000003'),
                        },
                    ],
                    totalCookingEP: 1000,
                    greatSuccessCount: 0,
                },
            ],
        };

        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
                cookingResult={cookingResultWithFloatingPot}
            />
        );

        expect((document.body.textContent ?? '')).toContain('鍋空き76');
        expect((document.body.textContent ?? '')).not.toContain('76.0000000000003');
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
        expect(content).toContain('translated:TeamTimeline.recipe highBaseVisibleRecipe : 平均9,800 EP × 2回');
        expect(content).toContain('translated:TeamTimeline.recipe lowBaseVisibleRecipe : 平均4,200 EP × 1.5回');
        expect(content.indexOf('translated:TeamTimeline.recipe highBaseVisibleRecipe'))
            .toBeLessThan(content.indexOf('translated:TeamTimeline.recipe lowBaseVisibleRecipe'));

        const groupedButton = screen.getByRole('button', { name: '他 0.06回' });
        expect(groupedButton).toBeDefined();

        fireEvent.click(groupedButton);
        const popoverText = document.body.textContent ?? '';
        expect(popoverText).toContain('translated:TeamTimeline.recipe groupedRecipe : 平均550 EP × 0.06回');
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

        expect((document.body.textContent ?? '')).toContain('初期食材由来EP合計 : 263 EP');
    });

    it('shows leftover include toggle after leftover ingredient block when enabled', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
                cookingResult={COOKING_RESULT_WITH_EXTRA_LEFTOVER}
                showLeftoverIncludeExtraUsageToggle
                leftoverIncludeExtraUsage={false}
            />
        );

        const toggle = screen.getByTestId('leftover-extra-usage-toggle-details') as HTMLInputElement;
        expect(toggle.checked).toBe(false);
        const content = document.body.textContent ?? '';
        expect(content).toContain('追加食材使用分を含む');
        expect(content.indexOf('あまり食材')).toBeLessThan(content.indexOf('追加食材使用分を含む'));
    });

    it('uses fixed leftover totals when include-extra toggle is ON in details mode', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
                cookingResult={COOKING_RESULT_WITH_EXTRA_LEFTOVER}
                showLeftoverIncludeExtraUsageToggle
                leftoverIncludeExtraUsage
            />
        );

        const content = document.body.textContent ?? '';
        expect(content).toContain('apple10');
        expect(content).toContain('milk4');
        expect(content).not.toContain('apple7');
    });

    it('uses post-extra leftover totals when include-extra toggle is OFF in details mode', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
                cookingResult={COOKING_RESULT_WITH_EXTRA_LEFTOVER}
                showLeftoverIncludeExtraUsageToggle
                leftoverIncludeExtraUsage={false}
            />
        );

        const content = document.body.textContent ?? '';
        expect(content).toContain('apple7');
        expect(content).toContain('milk3');
        expect(content).not.toContain('apple10');
    });

    it('uses after-extra average leftovers when include-extra toggle is OFF', () => {
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY_WITH_COOKING}
                layoutMode="average"
                averageCookingSummary={AVERAGE_COOKING_SUMMARY_WITH_AFTER_EXTRA}
                showLeftoverIncludeExtraUsageToggle
                leftoverIncludeExtraUsage={false}
            />
        );

        const content = document.body.textContent ?? '';
        expect(content).toContain('apple4');
        expect(content).toContain('milk1');
        expect(content).not.toContain('apple7');
    });

    it('calls leftover include toggle callback', () => {
        const onChange = vi.fn();
        render(
            <TeamSummaryRow
                teamSummary={TEAM_SUMMARY}
                layoutMode="details"
                cookingResult={COOKING_RESULT}
                showLeftoverIncludeExtraUsageToggle
                leftoverIncludeExtraUsage={false}
                onLeftoverIncludeExtraUsageChange={onChange}
            />
        );

        fireEvent.click(screen.getByTestId('leftover-extra-usage-toggle-details'));
        expect(onChange).toHaveBeenCalledWith(true);
    });
});
