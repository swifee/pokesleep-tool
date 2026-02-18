import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SwapSupplementBar from './SwapSupplementBar';
import { SwapSupplementSequence } from '../utils/SwapSupplementUtils';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

vi.mock('../../../../ui/IvCalc/PokemonIcon', () => ({
    default: ({ idForm }: { idForm: number }) => <span>{idForm}</span>,
}));

describe('SwapSupplementBar', () => {
    it('does not render when no swaps exist', () => {
        const { container } = render(
            <SwapSupplementBar
                swapCount={0}
                swapSequences={[]}
                onClear={vi.fn()}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders and clears all swaps when delete is clicked', () => {
        const onClear = vi.fn();
        const sequences: SwapSupplementSequence[] = [
            {
                teamSlotIndex: 0,
                entries: [
                    { pokemonId: 10, pokemonIdForm: 10, activeMinutes: 600, activeRatioPercent: 41.7 },
                    { pokemonId: 25, pokemonIdForm: 25, activeMinutes: 840, activeRatioPercent: 58.3 },
                ],
            },
        ];

        render(
            <SwapSupplementBar
                swapCount={3}
                swapSequences={sequences}
                onClear={onClear}
            />
        );

        expect(screen.getByText('途中でのポケモン入れ替えが設定されています。')).toBeDefined();
        expect(screen.getByTestId('swap-supplement-bar')).toBeDefined();
        expect(screen.getByTestId('swap-supplement-delete-button')).toBeDefined();
        expect(screen.getAllByTestId('swap-supplement-icon')).toHaveLength(2);
        expect(screen.getByText('10H')).toBeDefined();
        expect(screen.getByText('(42%)')).toBeDefined();
        expect(screen.getAllByTestId('swap-supplement-arrow')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'リセット' }));
        expect(onClear).toHaveBeenCalledTimes(1);
    });
});
