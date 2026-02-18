import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamTimelineApp from './TeamTimelineApp';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

vi.mock('./TeamTimelineState', async () => {
    const actual = await vi.importActual<typeof import('./TeamTimelineState')>('./TeamTimelineState');
    const baseState = actual.createInitialState();
    return {
        ...actual,
        createInitialState: () => ({
            ...baseState,
            simulationResult: {
                slotResults: new Map(),
                dailySummaries: [],
                teamSummary: {
                    totalIngredients: [],
                    totalBerryEP: 0,
                    totalIngredientEP: 0,
                    totalSkillEP: 0,
                    grandTotalEP: 0,
                    totalPresentCandyCount: 0,
                    totalCookingPotCapacityIncrease: 0,
                    totalTastyChanceIncreasePercent: 0,
                    totalDreamShardCount: 0,
                },
            },
        }),
    };
});

vi.mock('./components/TimelineHeader', () => ({
    default: () => null,
}));

vi.mock('./components/SwapSupplementBar', () => ({
    default: () => null,
}));

vi.mock('./components/SimulationControls', () => ({
    default: () => null,
}));

vi.mock('./components/TimeSlotEditor', () => ({
    default: () => null,
}));

vi.mock('./components/TimelineBonusSettingsPanel', () => ({
    default: () => null,
}));

vi.mock('./components/TrialResultSelector', () => ({
    default: () => null,
}));

vi.mock('./components/AdditionalAnalysisPanel', () => ({
    default: () => null,
}));

vi.mock('./components/TeamSummaryRow', () => ({
    default: () => null,
}));

vi.mock('./components/DailySummaryRow', () => ({
    default: () => null,
}));

vi.mock('./components/ResimulationNoticeBar', () => ({
    default: ({ open }: { open: boolean }) => (
        <div data-testid="resimulation-notice" data-open={open ? 'true' : 'false'} />
    ),
}));

vi.mock('./components/WipeReveal', () => ({
    default: ({ show, children }: { show: boolean; children: React.ReactNode }) => (
        show ? <>{children}</> : null
    ),
}));

vi.mock('./components/SwapEnergyDialog', () => ({
    SwapEnergyDialog: () => null,
}));

vi.mock('./components/BoxSelectDialog', () => ({
    default: ({
        open,
        onSelect,
        onSelectNone,
    }: {
        open: boolean;
        onSelect?: (item: unknown) => void;
        onSelectNone?: () => void;
    }) => (
        <div
            data-testid={onSelectNone ? 'swap-box-dialog' : 'team-box-dialog'}
            data-open={open ? 'true' : 'false'}
        >
            {!onSelectNone && open && (
                <button
                    type="button"
                    data-testid="team-box-select-first"
                    onClick={() => onSelect?.({
                        id: 999,
                        nickname: 'ピカチュウ',
                        serialize: () => 'mock-serialized-pikachu',
                        iv: {
                            idForm: 25,
                            level: 60,
                            pokemonName: 'ピカチュウ',
                            pokemon: { skill: 'Charge Energy S' },
                            activeSubSkills: [],
                        },
                        filledNickname: () => 'ピカチュウ',
                    })}
                >
                    select
                </button>
            )}
        </div>
    ),
}));

vi.mock('./components/TimelineTable', () => ({
    default: ({
        displayMode,
        onHeaderSlotClick,
    }: {
        displayMode?: 'detailed' | 'simple';
        onHeaderSlotClick?: (index: number) => void;
    }) => (
        <div data-testid="timeline-table" data-display-mode={displayMode ?? 'detailed'}>
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

describe('TeamTimelineApp timeline display mode', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('uses detailed mode by default and toggles to simple mode', () => {
        render(<TeamTimelineApp />);

        const table = screen.getByTestId('timeline-table');
        expect(table.getAttribute('data-display-mode')).toBe('detailed');

        fireEvent.click(screen.getByRole('checkbox', { name: 'シンプル表示' }));
        expect(table.getAttribute('data-display-mode')).toBe('simple');
    });

    it('does not persist display mode after remount', () => {
        const firstRender = render(<TeamTimelineApp />);
        fireEvent.click(screen.getByRole('checkbox', { name: 'シンプル表示' }));
        expect(screen.getByTestId('timeline-table').getAttribute('data-display-mode')).toBe('simple');

        firstRender.unmount();
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('timeline-table').getAttribute('data-display-mode')).toBe('detailed');
    });

    it('opens team box dialog when clicking header slot after simulation', () => {
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('team-box-dialog').getAttribute('data-open')).toBe('false');

        fireEvent.click(screen.getByTestId('timeline-header-slot-click'));

        expect(screen.getByTestId('team-box-dialog').getAttribute('data-open')).toBe('true');
    });

    it('keeps simulation details and shows re-simulation notice when team member changes', () => {
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('resimulation-notice').getAttribute('data-open')).toBe('false');
        expect(screen.getByRole('checkbox', { name: 'シンプル表示' })).toBeDefined();

        fireEvent.click(screen.getByTestId('timeline-header-slot-click'));
        fireEvent.click(screen.getByTestId('team-box-select-first'));

        expect(screen.getByTestId('team-box-dialog').getAttribute('data-open')).toBe('false');
        expect(screen.getByRole('checkbox', { name: 'シンプル表示' })).toBeDefined();
        expect(screen.getByTestId('resimulation-notice').getAttribute('data-open')).toBe('true');
    });
});
