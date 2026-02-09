import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TimelineCell from './TimelineCell';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key,
    }),
}));

describe('TimelineCell swap ui', () => {
    it('shows swap info as clickable box and hides standalone swap button when swap is configured', () => {
        const onSwapClick = vi.fn();

        const { container } = render(
            <TimelineCell
                result={null}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                hasSwap
                swappedPokemonName="カメックス Lv60"
                onSwapClick={onSwapClick}
            />
        );

        expect(container.querySelector('.swap-info')).not.toBeNull();
        fireEvent.click(screen.getByText('カメックス Lv60'));
        expect(onSwapClick).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.swap-trigger')).toBeNull();
    });

    it('shows swap icon button when no swap is configured', () => {
        const { container } = render(
            <TimelineCell
                result={null}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                onSwapClick={vi.fn()}
            />
        );

        expect(container.querySelector('.swap-trigger')).not.toBeNull();
        expect(container.querySelector('.swap-info')).toBeNull();
    });
});
