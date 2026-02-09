import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SwapSupplementBar from './SwapSupplementBar';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

describe('SwapSupplementBar', () => {
    it('does not render when no swaps exist', () => {
        const { container } = render(<SwapSupplementBar swapCount={0} onClear={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders and clears all swaps when delete is clicked', () => {
        const onClear = vi.fn();
        render(<SwapSupplementBar swapCount={3} onClear={onClear} />);

        expect(screen.getByText('途中でのポケモン入れ替えが設定されています。')).toBeDefined();
        expect(screen.getByTestId('swap-supplement-bar')).toBeDefined();
        expect(screen.getByTestId('swap-supplement-delete-button')).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: '削除' }));
        expect(onClear).toHaveBeenCalledTimes(1);
    });
});
