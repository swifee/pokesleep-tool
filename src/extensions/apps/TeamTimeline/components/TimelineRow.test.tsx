import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PokemonBox from '../../../../util/PokemonBox';
import { PokemonSwap, TimeSlot } from '../types/TimeSlotTypes';
import type { PokemonBoxItem } from '../../../../util/PokemonBox';
import TimelineRow from './TimelineRow';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('./TimelineCell', () => ({
    default: ({
        swappedPokemonName,
        onRemoveSwapClick,
    }: {
        swappedPokemonName?: string;
        onRemoveSwapClick?: () => void;
    }) => (
        <div data-testid="timeline-cell">
            <span>{swappedPokemonName ?? ''}</span>
            <span data-testid="remove-flag">{onRemoveSwapClick ? '1' : '0'}</span>
        </div>
    ),
}));

function renderRow(slot: TimeSlot): void {
    render(
        <TimelineRow
            slot={slot}
            originalSlotId={slot.id}
            dayIndex={0}
            results={[]}
            team={[null, null, null, null, null]}
            swaps={[]}
            box={new PokemonBox([])}
        />
    );
}

describe('TimelineRow label rendering', () => {
    it('shows wake and meal icons when wake and meal overlap', () => {
        renderRow({
            id: 'wake-breakfast',
            time: '07:00',
            sleepState: 'wake',
            hasMeal: true,
        });

        expect(screen.getByTestId('timeline-row-label-wakeup')).toBeDefined();
        expect(screen.getByTestId('timeline-row-label-cooking')).toBeDefined();
    });

    it('shows meal icon for non-wake meal slot', () => {
        renderRow({
            id: 'breakfast',
            time: '08:00',
            sleepState: 'none',
            hasMeal: true,
        });

        expect(screen.getByTestId('timeline-row-label-cooking')).toBeDefined();
    });

    it('shows sleep icon for sleep slot', () => {
        renderRow({
            id: 'sleep',
            time: '23:00',
            sleepState: 'sleep',
            hasMeal: false,
        });

        expect(screen.getByTestId('timeline-row-label-sleep')).toBeDefined();
    });
});

describe('TimelineRow swap rendering', () => {
    it('renders revert target at end slot when swap has "until" configuration', () => {
        const swappedIn = {
            id: 101,
            filledNickname: () => 'ピカチュウ',
        } as unknown as PokemonBoxItem;
        const reverted = {
            id: 42,
            filledNickname: () => 'ツボツボ',
        } as unknown as PokemonBoxItem;
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-1',
                teamSlotIndex: 0,
                newPokemonId: swappedIn.id,
                initialEnergy: 100,
                endSlotId: 'slot-4',
                endDayIndex: 0,
                revertPokemonId: reverted.id,
            },
        ];

        render(
            <TimelineRow
                slot={{ id: 'slot-4', time: '18:00', sleepState: 'none', hasMeal: true }}
                originalSlotId="slot-4"
                dayIndex={0}
                results={[]}
                team={[null, null, null, null, null]}
                swaps={swaps}
                box={new PokemonBox([swappedIn, reverted])}
            />
        );

        const firstCell = screen.getAllByTestId('timeline-cell')[0];
        expect(within(firstCell).getByText('ツボツボ')).toBeDefined();
        expect(within(firstCell).getByTestId('remove-flag').textContent).toBe('0');
    });
});
