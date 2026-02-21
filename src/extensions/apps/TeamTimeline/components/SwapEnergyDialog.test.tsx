import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SwapEnergyDialog } from './SwapEnergyDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

describe('SwapEnergyDialog', () => {
    it('shows swap settings title', () => {
        render(
            <SwapEnergyDialog
                open
                pokemonName="ピカチュウ"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        expect(screen.getByText('入れ替え設定')).toBeDefined();
    });

    it('disables energy controls when energy setting is locked', () => {
        render(
            <SwapEnergyDialog
                open
                pokemonName="ピカチュウ"
                disableEnergySetting
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        const energyInput = screen.getByRole('spinbutton');
        const energySliderRoot = document.querySelector('.MuiSlider-root');

        expect(energyInput.getAttribute('disabled')).not.toBeNull();
        expect(energySliderRoot?.className.includes('Mui-disabled')).toBe(true);
    });

    it('shows repeat checkbox and confirms with repeat flag', () => {
        const onConfirm = vi.fn();

        render(
            <SwapEnergyDialog
                open
                pokemonName="ピカチュウ"
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />
        );

        const repeatCheckbox = screen.getByRole('checkbox');
        fireEvent.click(repeatCheckbox);
        fireEvent.click(screen.getByRole('button', { name: 'TeamTimeline.confirm' }));

        expect(onConfirm).toHaveBeenCalledWith(100, true);
    });

    it('does not render until selector labels', () => {
        render(
            <SwapEnergyDialog
                open
                pokemonName="ピカチュウ"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        expect(screen.queryByText('TeamTimeline.swap until suffix')).toBeNull();
        expect(screen.queryByText('TeamTimeline.swap until not set')).toBeNull();
    });
});
