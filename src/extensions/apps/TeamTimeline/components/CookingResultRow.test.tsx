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

        expect(screen.getByText('料理直前バッグ')).toBeDefined();
        expect(screen.getByText('apple')).toBeDefined();
        expect(screen.getByText('9')).toBeDefined();
        expect(screen.getByText('egg')).toBeDefined();
        expect(screen.getByText('4')).toBeDefined();
    });
});
