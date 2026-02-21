import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PokemonBox from '../../../../util/PokemonBox';
import { PokemonSwap, TimeSlot, TimeSlotResult } from '../types/TimeSlotTypes';
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
        pokemonIdForm,
    }: {
        swappedPokemonName?: string;
        onRemoveSwapClick?: () => void;
        pokemonIdForm?: number;
    }) => (
        <div data-testid="timeline-cell">
            <span>{swappedPokemonName ?? ''}</span>
            <span data-testid="remove-flag">{onRemoveSwapClick ? '1' : '0'}</span>
            <span data-testid="pokemon-id-form">{pokemonIdForm === undefined ? '' : String(pokemonIdForm)}</span>
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

    it('does not render a right border on the time cell', () => {
        renderRow({
            id: 'slot-no-divider',
            time: '12:00',
            sleepState: 'none',
            hasMeal: false,
        });

        const timeCell = screen.getByText('12:00').closest('[data-right-divider]');
        expect(timeCell).toBeTruthy();
        expect((timeCell as HTMLElement).getAttribute('data-right-divider')).toBe('off');
    });
});

describe('TimelineRow swap rendering', () => {
    const createPokemon = (id: number, idForm: number, nickname: string): PokemonBoxItem => ({
        id,
        iv: { idForm },
        filledNickname: () => nickname,
    } as unknown as PokemonBoxItem);

    it('renders direct swap target with remove action', () => {
        const swappedIn = createPokemon(101, 25, 'ピカチュウ');
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-4',
                teamSlotIndex: 0,
                newPokemonId: swappedIn.id,
                initialEnergy: 100,
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
                box={new PokemonBox([swappedIn])}
            />
        );

        const firstCell = screen.getAllByTestId('timeline-cell')[0];
        expect(within(firstCell).getByText('ピカチュウ')).toBeDefined();
        expect(within(firstCell).getByTestId('remove-flag').textContent).toBe('1');
    });

    it('keeps current pokemon icon on the swap cell before simulation results', () => {
        const current = createPokemon(1, 260, 'ラグラージ');
        const swappedIn = createPokemon(2, 154, 'メガニウム');
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-2',
                teamSlotIndex: 0,
                newPokemonId: swappedIn.id,
                initialEnergy: 100,
            },
        ];

        render(
            <TimelineRow
                slot={{ id: 'slot-2', time: '12:00', sleepState: 'none', hasMeal: false }}
                originalSlotId="slot-2"
                dayIndex={0}
                slotIndexInDay={1}
                slotOrderById={new Map([
                    ['slot-1', 0],
                    ['slot-2', 1],
                    ['slot-3', 2],
                ])}
                results={[]}
                team={[current, null, null, null, null]}
                swaps={swaps}
                box={new PokemonBox([current, swappedIn])}
            />
        );

        const firstCell = screen.getAllByTestId('timeline-cell')[0];
        expect(within(firstCell).getByTestId('pokemon-id-form').textContent).toBe('260');
    });

    it('uses swapped pokemon icon from the next slots onward before simulation results', () => {
        const current = createPokemon(1, 260, 'ラグラージ');
        const swappedIn = createPokemon(2, 154, 'メガニウム');
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-2',
                teamSlotIndex: 0,
                newPokemonId: swappedIn.id,
                initialEnergy: 100,
            },
        ];

        render(
            <TimelineRow
                slot={{ id: 'slot-3', time: '15:00', sleepState: 'none', hasMeal: false }}
                originalSlotId="slot-3"
                dayIndex={0}
                slotIndexInDay={2}
                slotOrderById={new Map([
                    ['slot-1', 0],
                    ['slot-2', 1],
                    ['slot-3', 2],
                ])}
                results={[]}
                team={[current, null, null, null, null]}
                swaps={swaps}
                box={new PokemonBox([current, swappedIn])}
            />
        );

        const firstCell = screen.getAllByTestId('timeline-cell')[0];
        expect(within(firstCell).getByTestId('pokemon-id-form').textContent).toBe('154');
    });

    it('does not treat same-slot swap as prior even when slot index basis differs', () => {
        const current = createPokemon(1, 260, 'ラグラージ');
        const swappedIn = createPokemon(2, 154, 'メガニウム');
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-2',
                teamSlotIndex: 0,
                newPokemonId: swappedIn.id,
                initialEnergy: 100,
            },
        ];

        render(
            <TimelineRow
                slot={{ id: 'slot-2', time: '12:00', sleepState: 'none', hasMeal: false }}
                originalSlotId="slot-2"
                dayIndex={0}
                slotIndexInDay={2}
                slotOrderById={new Map([
                    ['slot-1', 0],
                    ['slot-2', 1],
                    ['slot-3', 2],
                ])}
                results={[]}
                team={[current, null, null, null, null]}
                swaps={swaps}
                box={new PokemonBox([current, swappedIn])}
            />
        );

        const firstCell = screen.getAllByTestId('timeline-cell')[0];
        expect(within(firstCell).getByTestId('pokemon-id-form').textContent).toBe('260');
    });
});

describe('TimelineRow duration rendering', () => {
    const baseSlot: TimeSlot = {
        id: 'slot-1',
        time: '15:00',
        sleepState: 'none',
        hasMeal: false,
    };

    const createResult = (durationMinutes: number): TimeSlotResult => ({
        slotId: 'slot-1',
        pokemonId: 1,
        teamIndex: 0,
        durationMinutes,
        isSleeping: false,
    } as unknown as TimeSlotResult);

    it('uses uppercase H for hour duration in detailed mode', () => {
        render(
            <TimelineRow
                slot={baseSlot}
                originalSlotId={baseSlot.id}
                dayIndex={0}
                results={[createResult(180)]}
                team={[null, null, null, null, null]}
                swaps={[]}
                box={new PokemonBox([])}
                displayMode="detailed"
            />
        );

        expect(screen.getByText('3H')).toBeDefined();
        expect(screen.queryByText('3h')).toBeNull();
    });

    it('hides duration in simple mode', () => {
        render(
            <TimelineRow
                slot={baseSlot}
                originalSlotId={baseSlot.id}
                dayIndex={0}
                results={[createResult(180)]}
                team={[null, null, null, null, null]}
                swaps={[]}
                box={new PokemonBox([])}
                displayMode="simple"
            />
        );

        expect(screen.queryByText('3H')).toBeNull();
    });
});
