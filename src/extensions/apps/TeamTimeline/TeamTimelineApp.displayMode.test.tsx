import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamTimelineApp from './TeamTimelineApp';

const { runSimulationMock } = vi.hoisted(() => ({
    runSimulationMock: vi.fn(() => ({
        slotResults: new Map(),
        dailySummaries: [],
        teamSummary: {
            totalIngredients: [],
            totalBerryEP: 0,
            totalIngredientEP: 0,
            totalSkillEP: 0,
            totalCookingEP: 0,
            grandTotalEP: 0,
            totalPresentCandyCount: 0,
            totalCookingPotCapacityIncrease: 0,
            totalTastyChanceIncreasePercent: 0,
            totalDreamShardCount: 0,
        },
    })),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

vi.mock('./simulation/TimelineSimulator', () => ({
    runSimulation: runSimulationMock,
}));

vi.mock('./TeamTimelineState', async () => {
    const actual = await vi.importActual<typeof import('./TeamTimelineState')>('./TeamTimelineState');
    const baseState = actual.createInitialState();
    const teamSummary = {
        totalIngredients: [],
        totalBerryEP: 0,
        totalIngredientEP: 0,
        totalSkillEP: 0,
        totalCookingEP: 0,
        grandTotalEP: 0,
        totalPresentCandyCount: 0,
        totalCookingPotCapacityIncrease: 0,
        totalTastyChanceIncreasePercent: 0,
        totalDreamShardCount: 0,
    };
    return {
        ...actual,
        createInitialState: () => ({
            ...baseState,
            simulationResult: {
                slotResults: new Map(),
                dailySummaries: [],
                teamSummary,
            },
            multiTrialResults: [
                { seed: 1, grandTotalEP: 0 },
                { seed: 2, grandTotalEP: 0 },
            ],
            multiTrialSelectedIndex: 0,
            multiTrialAverageDailySummaries: [],
            multiTrialAverageTeamSummary: teamSummary,
            multiTrialAverageCookingSummary: {
                recipes: [],
                leftoverIngredients: [{ name: 'apple', count: 1 }],
            },
            seedMode: 'fixed',
            multiTrialCount: 1,
        }),
    };
});

vi.mock('./components/TimelineHeader', () => ({
    default: () => null,
}));

vi.mock('./components/TeamSetToolbar', () => ({
    default: () => <div data-testid="team-set-toolbar" />,
}));

vi.mock('./components/SwapSupplementBar', () => ({
    default: () => null,
}));

vi.mock('./components/SimulationControls', () => ({
    default: ({ seed }: { seed: number }) => (
        <div data-testid="simulation-controls-seed">{seed}</div>
    ),
}));

vi.mock('./components/TimeSlotEditor', () => ({
    default: () => null,
}));

vi.mock('./components/TimelineBonusSettingsPanel', () => ({
    default: () => null,
}));

vi.mock('./components/TrialResultSelector', () => ({
    default: ({
        onSelect,
    }: {
        onSelect?: (index: number) => void;
    }) => (
        <button
            type="button"
            data-testid="trial-result-select-second"
            onClick={() => onSelect?.(1)}
        >
            select-second-trial
        </button>
    ),
}));

vi.mock('./components/AdditionalAnalysisPanel', () => ({
    default: () => null,
}));

vi.mock('./components/TeamSummaryRow', () => ({
    default: ({
        layoutMode,
        leftoverIncludeExtraUsage,
        onLeftoverIncludeExtraUsageChange,
    }: {
        layoutMode?: 'details' | 'average';
        leftoverIncludeExtraUsage?: boolean;
        onLeftoverIncludeExtraUsageChange?: (checked: boolean) => void;
    }) => (
        <div data-testid={`team-summary-row-${layoutMode ?? 'unknown'}`}>
            <span data-testid={`leftover-toggle-state-${layoutMode ?? 'unknown'}`}>
                {leftoverIncludeExtraUsage ? 'on' : 'off'}
            </span>
            <button
                type="button"
                data-testid={`leftover-toggle-button-${layoutMode ?? 'unknown'}`}
                onClick={() => onLeftoverIncludeExtraUsageChange?.(!(leftoverIncludeExtraUsage ?? false))}
            >
                toggle-leftover
            </button>
        </div>
    ),
}));

vi.mock('./components/DailySummaryRow', () => ({
    default: () => null,
}));

vi.mock('./components/ResimulationNoticeBar', () => ({
    default: ({
        open,
        mode,
        deltaSummary,
        onResimulate,
        onUndo,
        onClose,
    }: {
        open: boolean;
        mode?: 'notice' | 'result';
        deltaSummary?: { totalDeltaEP: number } | null;
        onResimulate?: () => void;
        onUndo?: () => void;
        onClose?: () => void;
    }) => (
        <div
            data-testid="resimulation-notice"
            data-open={open ? 'true' : 'false'}
            data-mode={mode ?? 'notice'}
            data-total-delta={deltaSummary ? String(deltaSummary.totalDeltaEP) : ''}
        >
            <button type="button" data-testid="resimulation-notice-run" onClick={() => onResimulate?.()}>
                run-resimulation
            </button>
            <button type="button" data-testid="resimulation-notice-undo" onClick={() => onUndo?.()}>
                undo-resimulation
            </button>
            <button type="button" data-testid="resimulation-notice-close" onClick={() => onClose?.()}>
                close-resimulation
            </button>
        </div>
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
        team,
        onHeaderSlotClick,
        noCollectCells,
        onNoCollectToggle,
    }: {
        displayMode?: 'detailed' | 'simple';
        team?: Array<{ iv: { pokemonName: string } } | null>;
        onHeaderSlotClick?: (index: number) => void;
        noCollectCells?: { dayIndex: number; slotId: string; teamSlotIndex: number }[];
        onNoCollectToggle?: (slotId: string, teamIndex: number, dayIndex: number) => void;
    }) => (
        <div
            data-testid="timeline-table"
            data-display-mode={displayMode ?? 'detailed'}
            data-no-collect-count={String(noCollectCells?.length ?? 0)}
            data-team-member-0={team?.[0]?.iv.pokemonName ?? 'null'}
        >
            <button
                type="button"
                data-testid="timeline-header-slot-click"
                onClick={() => onHeaderSlotClick?.(0)}
            >
                header
            </button>
            <button
                type="button"
                data-testid="timeline-no-collect-toggle"
                onClick={() => onNoCollectToggle?.('wake', 0, 0)}
            >
                no-collect
            </button>
        </div>
    ),
}));

describe('TeamTimelineApp timeline display mode', () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem('PstTeamTimelinePresetAppliedV1', '1');
        runSimulationMock.mockClear();
    });

    it('uses detailed mode by default and toggles to simple mode', () => {
        render(<TeamTimelineApp />);

        const table = screen.getByTestId('timeline-table');
        expect(table.getAttribute('data-display-mode')).toBe('detailed');
        expect(screen.getByTestId('team-timeline-post-simulation-scroll-container').getAttribute('data-scroll-overflow-x')).toBe('auto');

        fireEvent.click(screen.getByRole('switch', { name: 'シンプル表示' }));
        expect(table.getAttribute('data-display-mode')).toBe('simple');
        expect(screen.getByTestId('team-timeline-post-simulation-scroll-container').getAttribute('data-scroll-overflow-x')).toBe('hidden');
    });

    it('does not persist display mode after remount', () => {
        const firstRender = render(<TeamTimelineApp />);
        fireEvent.click(screen.getByRole('switch', { name: 'シンプル表示' }));
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
        expect(screen.getByRole('switch', { name: 'シンプル表示' })).toBeDefined();

        fireEvent.click(screen.getByTestId('timeline-header-slot-click'));
        fireEvent.click(screen.getByTestId('team-box-select-first'));

        expect(screen.getByTestId('team-box-dialog').getAttribute('data-open')).toBe('false');
        expect(screen.getByRole('switch', { name: 'シンプル表示' })).toBeDefined();
        expect(screen.getByTestId('resimulation-notice').getAttribute('data-open')).toBe('true');
    });

    it('persists no-collect cells and restores them after remount', () => {
        const firstRender = render(<TeamTimelineApp />);
        expect(screen.getByTestId('timeline-table').getAttribute('data-no-collect-count')).toBe('0');

        fireEvent.click(screen.getByTestId('timeline-no-collect-toggle'));
        const teamSetsPayload = localStorage.getItem('PstTeamTimelineTeamSetsV1');
        expect(teamSetsPayload).not.toBeNull();
        expect(teamSetsPayload!).toContain('"slotId":"wake"');
        expect(screen.getByTestId('timeline-table').getAttribute('data-no-collect-count')).toBe('1');

        firstRender.unmount();
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('timeline-table').getAttribute('data-no-collect-count')).toBe('1');
    });

    it('shows re-simulation notice when no-collect setting changes', () => {
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('resimulation-notice').getAttribute('data-open')).toBe('false');
        fireEvent.click(screen.getByTestId('timeline-no-collect-toggle'));
        expect(screen.getByTestId('resimulation-notice').getAttribute('data-open')).toBe('true');
    });

    it('shows result diff after re-simulation and restores previous settings on undo', async () => {
        localStorage.setItem('PstTeamTimelineSeedMode', 'fixed');
        localStorage.setItem('PstTeamTimelineTrialCount', '1');
        runSimulationMock.mockReturnValueOnce({
            slotResults: new Map(),
            dailySummaries: [],
            teamSummary: {
                totalIngredients: [],
                totalBerryEP: 2000,
                totalIngredientEP: 0,
                totalSkillEP: 3000,
                totalCookingEP: 5000,
                grandTotalEP: 10000,
                totalPresentCandyCount: 0,
                totalCookingPotCapacityIncrease: 0,
                totalTastyChanceIncreasePercent: 0,
                totalDreamShardCount: 0,
            },
        });

        render(<TeamTimelineApp />);

        expect(screen.getByTestId('timeline-table').getAttribute('data-team-member-0')).toBe('null');

        fireEvent.click(screen.getByTestId('timeline-header-slot-click'));
        fireEvent.click(screen.getByTestId('team-box-select-first'));
        expect(screen.getByTestId('timeline-table').getAttribute('data-team-member-0')).toBe('ピカチュウ');
        expect(screen.getByTestId('resimulation-notice').getAttribute('data-open')).toBe('true');

        fireEvent.click(screen.getByTestId('resimulation-notice-run'));

        await waitFor(() => {
            expect(screen.getByTestId('resimulation-notice').getAttribute('data-mode')).toBe('result');
        });
        expect(screen.getByTestId('resimulation-notice').getAttribute('data-total-delta')).toBe('10000');

        fireEvent.click(screen.getByTestId('resimulation-notice-undo'));

        await waitFor(() => {
            expect(screen.getByTestId('timeline-table').getAttribute('data-team-member-0')).toBe('null');
        });
    });

    it('shares leftover toggle state across average and details summary rows', () => {
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('leftover-toggle-state-average').textContent).toBe('off');
        expect(screen.getByTestId('leftover-toggle-state-details').textContent).toBe('off');

        fireEvent.click(screen.getByTestId('leftover-toggle-button-details'));

        expect(screen.getByTestId('leftover-toggle-state-average').textContent).toBe('on');
        expect(screen.getByTestId('leftover-toggle-state-details').textContent).toBe('on');
    });

    it('persists leftover toggle state across remounts', () => {
        const firstRender = render(<TeamTimelineApp />);
        fireEvent.click(screen.getByTestId('leftover-toggle-button-average'));
        expect(localStorage.getItem('PstTeamTimelineLeftoverIncludeExtraUsage')).toBe('1');

        firstRender.unmount();
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('leftover-toggle-state-average').textContent).toBe('on');
        expect(screen.getByTestId('leftover-toggle-state-details').textContent).toBe('on');
    });

    it('keeps simulation seed unchanged when selecting trial from simulation details slider', () => {
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('simulation-controls-seed').textContent).toBe('123456');

        fireEvent.click(screen.getByTestId('trial-result-select-second'));

        expect(runSimulationMock).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('simulation-controls-seed').textContent).toBe('123456');
    });
});
