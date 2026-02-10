import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResimulationNoticeBar from './ResimulationNoticeBar';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

describe('ResimulationNoticeBar', () => {
    it('does not render when closed', () => {
        const { queryByTestId } = render(
            <ResimulationNoticeBar open={false} onResimulate={vi.fn()} />
        );

        expect(queryByTestId('resimulation-notice-bar')).toBeNull();
    });

    it('renders and triggers re-simulation callback', () => {
        const onResimulate = vi.fn();
        render(<ResimulationNoticeBar open onResimulate={onResimulate} />);

        expect(screen.getByText('メンバー編成が変更されました。')).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: '再シミュレーション' }));
        expect(onResimulate).toHaveBeenCalledTimes(1);
    });
});
