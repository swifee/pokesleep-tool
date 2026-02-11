import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamTimelineApp from './TeamTimelineApp';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

vi.mock('./components/TimelineHeader', () => ({
    default: () => <div data-testid="timeline-header" />,
}));

vi.mock('./components/SwapSupplementBar', () => ({
    default: () => null,
}));

vi.mock('./components/SimulationControls', () => ({
    default: () => <div data-testid="simulation-controls" />,
}));

vi.mock('./components/TimeSlotEditor', () => ({
    default: () => <div data-testid="time-slot-editor" />,
}));

vi.mock('./components/TimelineBonusSettingsPanel', () => ({
    default: () => <div data-testid="bonus-settings-panel" />,
}));

vi.mock('./components/TrialResultSelector', () => ({
    default: () => <div data-testid="trial-result-selector" />,
}));

vi.mock('./components/AdditionalAnalysisPanel', () => ({
    default: () => <div data-testid="additional-analysis-panel" />,
}));

vi.mock('./components/TeamSummaryRow', () => ({
    default: () => <div data-testid="team-summary-row" />,
}));

vi.mock('./components/DailySummaryRow', () => ({
    default: () => <div data-testid="daily-summary-row" />,
}));

vi.mock('./components/ResimulationNoticeBar', () => ({
    default: () => null,
}));

vi.mock('./components/WipeReveal', () => ({
    default: ({ show, children }: { show: boolean; children: React.ReactNode }) => (
        show ? <div data-testid="wipe-reveal">{children}</div> : null
    ),
}));

vi.mock('./components/SwapEnergyDialog', () => ({
    SwapEnergyDialog: () => null,
}));

vi.mock('./components/BoxSelectDialog', () => ({
    default: ({
        open,
        onRemoveSwap,
    }: {
        open: boolean;
        onRemoveSwap?: () => void;
    }) => (
        <div
            data-testid={onRemoveSwap ? 'swap-box-dialog' : 'team-box-dialog'}
            data-open={open ? 'true' : 'false'}
        />
    ),
}));

vi.mock('./components/TimelineTable', () => ({
    default: ({
        compactEmptyCells,
        alwaysShowSwapButton,
        onHeaderSlotClick,
    }: {
        compactEmptyCells?: boolean;
        alwaysShowSwapButton?: boolean;
        onHeaderSlotClick?: (index: number) => void;
    }) => (
        <div
            data-testid="timeline-table"
            data-compact-empty={compactEmptyCells ? 'true' : 'false'}
            data-always-show-swap={alwaysShowSwapButton ? 'true' : 'false'}
        >
            <button
                type="button"
                data-testid="timeline-header-slot-click"
                onClick={() => onHeaderSlotClick?.(0)}
            >
                header
            </button>
        </div>
    ),
}));

describe('TeamTimelineApp pre-simulation timeline', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('shows timeline table before simulation and hides summary areas', () => {
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('team-timeline-pre-simulation-table')).toBeDefined();

        const timeline = screen.getByTestId('timeline-table');
        expect(timeline.getAttribute('data-compact-empty')).toBe('true');
        expect(timeline.getAttribute('data-always-show-swap')).toBe('true');

        expect(screen.queryByTestId('team-summary-row')).toBeNull();
        expect(screen.queryByTestId('daily-summary-row')).toBeNull();
    });

    it('opens team box dialog when clicking timeline header slot', () => {
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('team-box-dialog').getAttribute('data-open')).toBe('false');

        fireEvent.click(screen.getByTestId('timeline-header-slot-click'));

        expect(screen.getByTestId('team-box-dialog').getAttribute('data-open')).toBe('true');
    });
});
