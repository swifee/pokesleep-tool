import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PokemonBox from '../../../../util/PokemonBox';
import { TimeSlot } from '../types/TimeSlotTypes';
import TimelineRow from './TimelineRow';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('./TimelineCell', () => ({
    default: () => <div data-testid="timeline-cell" />,
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
    it('shows wake and meal as emoji when wake and meal overlap', () => {
        renderRow({
            id: 'wake-breakfast',
            time: '07:00',
            sleepState: 'wake',
            hasMeal: true,
        });

        expect(screen.getByText('⏰🍴')).toBeDefined();
    });

    it('shows meal emoji for non-wake meal slot', () => {
        renderRow({
            id: 'breakfast',
            time: '08:00',
            sleepState: 'none',
            hasMeal: true,
        });

        expect(screen.getByText('🍴')).toBeDefined();
    });

    it('shows sleep emoji for sleep slot', () => {
        renderRow({
            id: 'sleep',
            time: '23:00',
            sleepState: 'sleep',
            hasMeal: false,
        });

        expect(screen.getByText('🛌')).toBeDefined();
    });
});
