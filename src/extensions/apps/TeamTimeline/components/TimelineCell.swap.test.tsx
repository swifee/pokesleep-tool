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

    it('calls onRemoveSwapClick when x button is pressed and does not open swap selector', () => {
        const onSwapClick = vi.fn();
        const onRemoveSwapClick = vi.fn();

        render(
            <TimelineCell
                result={null}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                hasSwap
                swappedPokemonName="デデンネ"
                onSwapClick={onSwapClick}
                onRemoveSwapClick={onRemoveSwapClick}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: '入れ替え設定を解除' }));
        expect(onRemoveSwapClick).toHaveBeenCalledTimes(1);
        expect(onSwapClick).not.toHaveBeenCalled();
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

    it('renders empty content without placeholder dash in compact empty mode', () => {
        const { container } = render(
            <TimelineCell
                result={null}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                compactEmpty
                onSwapClick={vi.fn()}
            />
        );

        expect(container.textContent?.includes('-')).toBe(false);
    });

    it('keeps swap button always visible when alwaysShowSwapButton is enabled', () => {
        const { container } = render(
            <TimelineCell
                result={null}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                alwaysShowSwapButton
                onSwapClick={vi.fn()}
            />
        );

        const trigger = container.querySelector('.swap-trigger') as HTMLElement | null;
        expect(trigger).not.toBeNull();
        expect(trigger?.getAttribute('data-always-visible')).toBe('true');
    });

    it('shows swap info box even in compact empty mode', () => {
        const onSwapClick = vi.fn();
        const { container } = render(
            <TimelineCell
                result={null}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                hasSwap
                swappedPokemonName="ピカチュウ"
                compactEmpty
                alwaysShowSwapButton
                onSwapClick={onSwapClick}
            />
        );

        expect(container.querySelector('.swap-info')).not.toBeNull();
        fireEvent.click(screen.getByText('ピカチュウ'));
        expect(onSwapClick).toHaveBeenCalledTimes(1);
    });

    it('hides all swap UI and keeps compact layout when swap UI is disabled', () => {
        const { container } = render(
            <TimelineCell
                result={null}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                compactFirstSlot
                disableSwapUi
                onSwapClick={vi.fn()}
                hasSwap
                swappedPokemonName="フシギダネ"
            />
        );

        expect(container.querySelector('.swap-trigger')).toBeNull();
        expect(container.querySelector('.swap-info')).toBeNull();
        expect(container.querySelector('[data-compact-layout="true"]')).not.toBeNull();
    });
});
