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
        compactEmptyCells,
        alwaysShowSwapButton,
        isFirstTimelineSlot,
    }: {
        dayIndex: number;
        originalSlotId: string;
        onSwapClick?: (slotId: string, teamIndex: number, dayIndex: number) => void;
        compactEmptyCells?: boolean;
        alwaysShowSwapButton?: boolean;
        isFirstTimelineSlot?: boolean;
    }) => (
        <button
            type="button"
            data-testid={`swap-${dayIndex}-${originalSlotId}`}
            data-compact-empty={compactEmptyCells ? 'true' : 'false'}
            data-always-show-swap={alwaysShowSwapButton ? 'true' : 'false'}
            data-first-timeline-slot={isFirstTimelineSlot ? 'true' : 'false'}
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
    it('hides text in the top-left corner cell only', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        const corner = screen.getByTestId('timeline-corner-header-cell');
        expect(corner.textContent).toBe('');
    });

    it('calls onOpenTimeSlotSettings when corner settings button is clicked', () => {
        const onOpenTimeSlotSettings = vi.fn();

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onOpenTimeSlotSettings={onOpenTimeSlotSettings}
            />
        );

        fireEvent.click(screen.getByTestId('timeline-corner-settings-button'));

        expect(onOpenTimeSlotSettings).toHaveBeenCalledTimes(1);
    });

    it('shows day bands including day 1 when simulation days are 2 or more', () => {
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

        expect(screen.getByText('1日目')).toBeDefined();
        expect(screen.getByText('2日目')).toBeDefined();
        expect(screen.getByText('3日目')).toBeDefined();
    });

    it('does not show day 1 band when simulation days is 1', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        expect(screen.queryByText('1日目')).toBeNull();
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

    it('calls onHeaderSlotClick when header slot button is clicked', () => {
        const onHeaderSlotClick = vi.fn();

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onHeaderSlotClick={onHeaderSlotClick}
            />
        );

        fireEvent.click(screen.getByTestId('timeline-header-slot-button-0'));

        expect(onHeaderSlotClick).toHaveBeenCalledTimes(1);
        expect(onHeaderSlotClick).toHaveBeenCalledWith(0);
    });

    it('passes compact/always-show options down to TimelineRow', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                compactEmptyCells
                alwaysShowSwapButton
            />
        );

        const firstRow = screen.getByTestId('swap-0-sleep');
        expect(firstRow.getAttribute('data-compact-empty')).toBe('true');
        expect(firstRow.getAttribute('data-always-show-swap')).toBe('true');
    });

    it('marks only the very first row as first timeline slot', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        expect(screen.getByTestId('swap-0-sleep').getAttribute('data-first-timeline-slot')).toBe('true');
        expect(screen.getByTestId('swap-0-night-snack').getAttribute('data-first-timeline-slot')).toBe('false');
    });
});
