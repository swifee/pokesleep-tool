import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrialResultSelector from './TrialResultSelector';

interface SliderMockProps {
    value: number;
    min: number;
    max: number;
    onChange?: (event: Event, value: number | number[]) => void;
    onChangeCommitted?: (event: React.SyntheticEvent | Event, value: number | number[]) => void;
}

vi.mock('@mui/material', async () => {
    const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');
    return {
        ...actual,
        Slider: ({ value, min, max, onChange, onChangeCommitted }: SliderMockProps) => (
            <input
                aria-label="trial-slider"
                type="range"
                value={value}
                min={min}
                max={max}
                onChange={(event) => onChange?.(event as unknown as Event, Number((event.target as HTMLInputElement).value))}
                onMouseUp={(event) => onChangeCommitted?.(event as unknown as Event, Number((event.target as HTMLInputElement).value))}
            />
        ),
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string, options?: Record<string, unknown>) => {
            if (!defaultValue) {
                return _key;
            }
            return defaultValue.replace('{{count}}', String(options?.count ?? ''));
        },
    }),
}));

const RESULTS = [
    { seed: 1, grandTotalEP: 100 },
    { seed: 2, grandTotalEP: 90 },
    { seed: 3, grandTotalEP: 80 },
];

describe('TrialResultSelector', () => {
    it('renders status text and prev/next navigation', () => {
        const onSelect = vi.fn();
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={onSelect} />);

        expect(screen.getByText('3回中、上から')).toBeDefined();
        expect(screen.getByText('番目の結果を表示中')).toBeDefined();

        const [prevButton, nextButton] = screen.getAllByRole('button');
        fireEvent.click(prevButton);
        fireEvent.click(nextButton);

        expect(onSelect).toHaveBeenNthCalledWith(1, 0);
        expect(onSelect).toHaveBeenNthCalledWith(2, 2);
    });

    it('commits slider value on mouse up', () => {
        const onSelect = vi.fn();
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={onSelect} />);

        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '2' } });
        fireEvent.mouseUp(slider, { target: { value: '2' } });

        expect(onSelect).toHaveBeenCalledWith(2);
    });

    it('returns null when there is only one result', () => {
        const { container } = render(
            <TrialResultSelector
                results={[{ seed: 1, grandTotalEP: 100 }]}
                selectedIndex={0}
                onSelect={vi.fn()}
            />
        );

        expect(container.firstChild).toBeNull();
    });
});
