import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PokemonBox from '../../../../util/PokemonBox';
import { SimulationResult, TimeSlot } from '../types/TimeSlotTypes';
import TimelineTable from './TimelineTable';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => {
            if (!defaultValue) {
                return key;
            }
            return defaultValue
                .replace('{{day}}', String(options?.day ?? ''))
                .replace('{{count}}', String(options?.count ?? ''));
        },
    }),
}));

vi.mock('./TimelineRow', () => ({
    default: ({
        dayIndex,
        originalSlotId,
        onSwapClick,
    }: {
        dayIndex: number;
        originalSlotId: string;
        onSwapClick?: (slotId: string, teamIndex: number, dayIndex: number) => void;
    }) => (
        <button
            type="button"
            data-testid={`swap-${dayIndex}-${originalSlotId}`}
            onClick={() => onSwapClick?.(originalSlotId, 0, dayIndex)}
        >
            row
        </button>
    ),
}));

vi.mock('./DailySummaryRow', () => ({
    default: () => <div data-testid="daily-summary" />,
}));

vi.mock('./TeamSummaryRow', () => ({
    default: () => <div data-testid="team-summary" />,
}));

const BASE_TIME_SLOTS: TimeSlot[] = [
    { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
    { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
    { id: 'night-snack', time: '03:30', sleepState: 'none', hasMeal: false },
];

const EMPTY_RESULT: SimulationResult = {
    slotResults: new Map(),
    dailySummaries: [],
    teamSummary: {
        totalIngredients: [],
        totalBerryEP: 0,
        totalIngredientEP: 0,
        totalSkillEP: 0,
        grandTotalEP: 0,
        totalPresentCandyCount: 0,
        totalCookingPotCapacityIncrease: 0,
        totalTastyChanceIncreasePercent: 0,
        totalDreamShardCount: 0,
    },
};

describe('TimelineTable', () => {
    it('shows day bands from day 2 onward', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={3}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        expect(screen.getByText('2日目')).toBeDefined();
        expect(screen.getByText('3日目')).toBeDefined();
    });

    it('passes dayIndex=1 when clicking a day 2 slot swap', () => {
        const onSwapClick = vi.fn();

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={2}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onSwapClick={onSwapClick}
            />
        );

        fireEvent.click(screen.getByTestId('swap-1-wake'));

        expect(onSwapClick).toHaveBeenCalledTimes(1);
        expect(onSwapClick).toHaveBeenCalledWith('wake', 0, 1);
    });
});
