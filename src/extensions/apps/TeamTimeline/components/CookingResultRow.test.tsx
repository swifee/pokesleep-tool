import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CookingEventResult } from '../types/CookingTypes';
import CookingResultRow from './CookingResultRow';

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

const EVENT: CookingEventResult = {
    mealSlotId: 'breakfast-1',
    mealType: 'breakfast',
    recipeName: 'specialAppleCurry',
    isGreatSuccess: false,
    cookingEP: 1200,
    eBase: 0,
    eDisplay: 0,
    eFinal: 0,
    ingredientsUsed: [],
    extraIngredientsUsed: [],
    remainingPotCapacity: 0,
    effectivePotCapacity: 15,
    tastyChancePercent: 10,
    cookingPowerUpBonusUsed: 0,
    bagIngredientsBeforeCooking: [],
};

describe('CookingResultRow', () => {
    it('renders translated recipe name', () => {
        render(<CookingResultRow event={EVENT} teamSize={5} />);

        expect(screen.getByText('translated:TeamTimeline.recipe specialAppleCurry')).toBeDefined();
    });

    it('removes top dashed line and uses rounded corners on cooking row', () => {
        render(<CookingResultRow event={EVENT} teamSize={5} />);

        const row = screen.getByTestId('cooking-result-row-breakfast-1');
        expect(row.getAttribute('data-top-divider')).toBe('off');
        expect(row.getAttribute('data-corner-radius')).toBe('6');
    });

    it('opens bag ingredient popover when clicking left cooking icon', () => {
        const event: CookingEventResult = {
            ...EVENT,
            bagIngredientsBeforeCooking: [
                { name: 'apple', count: 9 },
                { name: 'egg', count: 4 },
            ],
        };

        render(<CookingResultRow event={event} teamSize={5} />);

        fireEvent.click(screen.getByTestId('cooking-bag-trigger-breakfast-1'));

        expect(screen.getByText('料理直前のバッグ')).toBeDefined();
        expect(screen.getByText('apple')).toBeDefined();
        expect(screen.getByText('9')).toBeDefined();
        expect(screen.getByText('egg')).toBeDefined();
        expect(screen.getByText('4')).toBeDefined();
    });

    it('shows consumed count and non-consumed count in parentheses for extra ingredients', () => {
        const event: CookingEventResult = {
            ...EVENT,
            bagIngredientsBeforeCooking: [
                { name: 'apple', count: 75 },
                { name: 'egg', count: 40 },
            ],
            extraIngredientsUsed: [
                {
                    name: 'apple',
                    count: 15,
                    pokemonAttribution: new Map(),
                    fromInitial: 0,
                },
            ],
        };

        render(<CookingResultRow event={event} teamSize={5} />);

        fireEvent.click(screen.getByTestId('cooking-bag-trigger-breakfast-1'));

        expect(screen.getByText('60 (75)')).toBeDefined();
        expect(screen.getByText('40')).toBeDefined();
    });

    it('opens help popover when clicking question mark icon', () => {
        const event: CookingEventResult = {
            ...EVENT,
            bagIngredientsBeforeCooking: [
                { name: 'apple', count: 10 },
            ],
        };

        render(<CookingResultRow event={event} teamSize={5} />);

        fireEvent.click(screen.getByTestId('cooking-bag-trigger-breakfast-1'));
        fireEvent.click(screen.getByTestId('cooking-bag-help-trigger-breakfast-1'));

        expect(screen.getByText('カッコ内はここまでスキマ食材を一切入れなかった場合の数')).toBeDefined();
    });

    it('renders extra ingredients with plus and parentheses', () => {
        const event: CookingEventResult = {
            ...EVENT,
            ingredientsUsed: [
                {
                    name: 'corn',
                    count: 25,
                    pokemonAttribution: new Map(),
                    fromInitial: 0,
                },
                {
                    name: 'egg',
                    count: 20,
                    pokemonAttribution: new Map(),
                    fromInitial: 0,
                },
            ],
            extraIngredientsUsed: [
                {
                    name: 'mushroom',
                    count: 8,
                    pokemonAttribution: new Map(),
                    fromInitial: 0,
                },
                {
                    name: 'apple',
                    count: 10,
                    pokemonAttribution: new Map(),
                    fromInitial: 0,
                },
            ],
            remainingPotCapacity: 0,
        };

        render(<CookingResultRow event={event} teamSize={5} />);

        expect(screen.getByText('+')).toBeDefined();
        expect(screen.getAllByText('(').length).toBeGreaterThan(0);
        expect(screen.getByText('corn')).toBeDefined();
        expect(screen.getByText('egg')).toBeDefined();
        expect(screen.getByText('mushroom')).toBeDefined();
        expect(screen.getByText('apple')).toBeDefined();
    });

    it('hides used ingredients and remaining pot info in simple mode', () => {
        const event: CookingEventResult = {
            ...EVENT,
            ingredientsUsed: [
                {
                    name: 'corn',
                    count: 25,
                    pokemonAttribution: new Map(),
                    fromInitial: 0,
                },
            ],
            extraIngredientsUsed: [
                {
                    name: 'apple',
                    count: 10,
                    pokemonAttribution: new Map(),
                    fromInitial: 0,
                },
            ],
            remainingPotCapacity: 3,
        };

        render(<CookingResultRow event={event} teamSize={5} displayMode="simple" />);

        expect(screen.getByText('translated:TeamTimeline.recipe specialAppleCurry')).toBeDefined();
        expect(screen.queryByText('corn')).toBeNull();
        expect(screen.queryByText('apple')).toBeNull();
        expect(screen.queryByText('+')).toBeNull();
        expect(screen.queryByText(/\u934B\u7A7A\u304D/)).toBeNull();
    });
});
