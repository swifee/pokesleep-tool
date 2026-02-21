import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SwapRemoveConfirmDialog from './SwapRemoveConfirmDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

describe('SwapRemoveConfirmDialog', () => {
    it('renders confirmation text and action buttons', () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();

        render(
            <SwapRemoveConfirmDialog
                open
                showRepeatOption={false}
                repeatChecked={false}
                onRepeatCheckedChange={vi.fn()}
                onCancel={onCancel}
                onConfirm={onConfirm}
            />
        );

        expect(screen.getByText('入れ替え設定を解除します。よろしいですか？')).toBeDefined();
        expect(screen.queryByLabelText('以降の繰り返しも解除')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
        fireEvent.click(screen.getByRole('button', { name: 'ok' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('shows and toggles repeat checkbox when repeat option is available', () => {
        const onRepeatCheckedChange = vi.fn();

        render(
            <SwapRemoveConfirmDialog
                open
                showRepeatOption
                repeatChecked
                onRepeatCheckedChange={onRepeatCheckedChange}
                onCancel={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        const checkbox = screen.getByLabelText('以降の繰り返しも解除');
        fireEvent.click(checkbox);
        expect(onRepeatCheckedChange).toHaveBeenCalledWith(false);
    });
});
