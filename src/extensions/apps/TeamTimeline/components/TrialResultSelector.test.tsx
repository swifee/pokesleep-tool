import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TrialResultSelector from './TrialResultSelector';

interface SliderMockProps {
    value: number;
    min: number;
    max: number;
    onChange?: (event: Event, value: number | number[]) => void;
    onChangeCommitted?: (event: React.SyntheticEvent | Event, value: number | number[]) => void;
    valueLabelFormat?: (value: number) => React.ReactNode;
    slots?: {
        valueLabel?: React.ComponentType<SliderValueLabelMockProps>;
    };
}

interface SliderValueLabelMockProps {
    children: React.ReactElement;
    open: boolean;
    value: React.ReactNode;
    index: number;
}

interface TooltipMockProps {
    children: React.ReactElement;
    title: React.ReactNode;
    open?: boolean;
    slotProps?: {
        popper?: {
            modifiers?: Array<{ name?: string }>;
        };
    };
}

function reactNodeToText(node: React.ReactNode): string {
    if (node == null || typeof node === 'boolean') {
        return '';
    }
    if (typeof node === 'string' || typeof node === 'number') {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node.map(reactNodeToText).join('');
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
        return reactNodeToText(node.props.children);
    }
    return '';
}

vi.mock('@mui/material', async () => {
    const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');
    return {
        ...actual,
        Slider: ({
            value,
            min,
            max,
            onChange,
            onChangeCommitted,
            valueLabelFormat,
            slots,
        }: SliderMockProps) => {
            const slider = (
                <input
                    aria-label="trial-slider"
                    type="range"
                    value={value}
                    min={min}
                    max={max}
                    onChange={(event) => onChange?.(event as unknown as Event, Number((event.target as HTMLInputElement).value))}
                    onMouseUp={(event) => onChangeCommitted?.(event as unknown as Event, Number((event.target as HTMLInputElement).value))}
                />
            );
            if (!slots?.valueLabel) {
                return slider;
            }

            const ValueLabel = slots.valueLabel;
            const formattedValue = valueLabelFormat ? valueLabelFormat(value) : value;
            return (
                <ValueLabel open value={formattedValue} index={0}>
                    {slider}
                </ValueLabel>
            );
        },
        Tooltip: ({ children, title, open, slotProps }: TooltipMockProps) => (
            <div
                data-testid="mock-tooltip"
                data-open={open ? 'true' : 'false'}
                data-title={reactNodeToText(title)}
                data-modifiers={(slotProps?.popper?.modifiers ?? [])
                    .map((modifier) => modifier.name ?? '')
                    .join(',')}
            >
                {children}
            </div>
        ),
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string, options?: Record<string, unknown>) => {
            if (!defaultValue) {
                return _key;
            }
            return Object.entries(options ?? {}).reduce((value, [name, replacement]) => (
                value.replace(`{{${name}}}`, String(replacement))
            ), defaultValue);
        },
    }),
}));

const RESULTS = [
    { seed: 1, grandTotalEP: 100 },
    { seed: 2, grandTotalEP: 90 },
    { seed: 3, grandTotalEP: 80 },
];
const DISTRIBUTION_VISIBILITY_STORAGE_KEY = 'PstTeamTimelineDistributionVisible';

function createResults(trialCount: number) {
    return Array.from({ length: trialCount }, (_, index) => ({
        seed: index + 1,
        grandTotalEP: 100000 - index,
    }));
}

describe('TrialResultSelector', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('shows distribution by default when storage is empty', () => {
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={vi.fn()} />);

        expect(screen.getByTestId('trial-distribution-chart')).toBeDefined();
        expect(screen.getByRole('button', { name: '分布を閉じる' })).toBeDefined();
    });

    it('renders status text and prev/next navigation', () => {
        const onSelect = vi.fn();
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={onSelect} />);

        expect(screen.getByText('3回中、')).toBeDefined();
        expect(screen.getByText('の結果を表示中')).toBeDefined();

        const statusRow = screen.getByTestId('trial-status-row');
        expect(within(statusRow).queryByRole('button', { name: 'previous-trial' })).toBeNull();
        expect(within(statusRow).queryByRole('button', { name: 'next-trial' })).toBeNull();

        const sliderControls = screen.getByTestId('trial-slider-controls');
        const prevButton = within(sliderControls).getByRole('button', { name: 'previous-trial' });
        const nextButton = within(sliderControls).getByRole('button', { name: 'next-trial' });
        fireEvent.click(prevButton);
        fireEvent.click(nextButton);

        expect(onSelect).toHaveBeenNthCalledWith(1, 2);
        expect(onSelect).toHaveBeenNthCalledWith(2, 0);
    });

    it('commits slider value on mouse up', () => {
        const onSelect = vi.fn();
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={onSelect} />);

        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '2' } });
        fireEvent.mouseUp(slider, { target: { value: '2' } });

        expect(onSelect).toHaveBeenCalledWith(0);
    });

    it('toggles distribution chart visibility by link', () => {
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={vi.fn()} />);

        expect(screen.getByTestId('trial-distribution-chart')).toBeDefined();

        const closeLink = screen.getByRole('button', { name: '分布を閉じる' });
        fireEvent.click(closeLink);
        expect(screen.queryByTestId('trial-distribution-chart')).toBeNull();

        const openLink = screen.getByRole('button', { name: '分布を表示' });
        fireEvent.click(openLink);
        expect(screen.getByTestId('trial-distribution-chart')).toBeDefined();
    });

    it('persists distribution visibility in localStorage', () => {
        const { unmount } = render(
            <TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={vi.fn()} />
        );

        fireEvent.click(screen.getByRole('button', { name: '分布を閉じる' }));
        expect(localStorage.getItem(DISTRIBUTION_VISIBILITY_STORAGE_KEY)).toBe('0');
        expect(screen.queryByTestId('trial-distribution-chart')).toBeNull();

        unmount();
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={vi.fn()} />);
        expect(screen.queryByTestId('trial-distribution-chart')).toBeNull();
        expect(screen.getByRole('button', { name: '分布を表示' })).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: '分布を表示' }));
        expect(localStorage.getItem(DISTRIBUTION_VISIBILITY_STORAGE_KEY)).toBe('1');
        expect(screen.getByTestId('trial-distribution-chart')).toBeDefined();
    });

    it('updates highlighted histogram bin while slider is moving', () => {
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={vi.fn()} />);

        expect(screen.getByTestId('trial-distribution-bar-1').getAttribute('data-active')).toBe('true');

        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '2' } });

        expect(screen.getByTestId('trial-distribution-bar-2').getAttribute('data-active')).toBe('true');
    });

    it('changes histogram bin count based on trial count', () => {
        const { rerender } = render(
            <TrialResultSelector results={createResults(100)} selectedIndex={0} onSelect={vi.fn()} />
        );

        const chart100 = screen.getByTestId('trial-distribution-chart');
        expect(chart100.querySelectorAll('[data-testid^="trial-distribution-bar-"]').length).toBe(16);

        rerender(<TrialResultSelector results={createResults(1000)} selectedIndex={0} onSelect={vi.fn()} />);
        const chart1000 = screen.getByTestId('trial-distribution-chart');
        expect(chart1000.querySelectorAll('[data-testid^="trial-distribution-bar-"]').length).toBe(51);
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

    it('configures value label tooltip with overflow-safe popper modifiers', () => {
        render(<TrialResultSelector results={RESULTS} selectedIndex={1} onSelect={vi.fn()} />);

        const tooltip = screen.getByTestId('mock-tooltip');
        expect(tooltip.getAttribute('data-open')).toBe('true');
        expect(tooltip.getAttribute('data-modifiers')).toContain('preventOverflow');
        expect(tooltip.getAttribute('data-modifiers')).toContain('flip');
        expect(tooltip.getAttribute('data-title')).toContain('2位:');
    });
});
