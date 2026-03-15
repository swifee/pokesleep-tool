import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type PokemonBox from '../../../util/PokemonBox';
import TeamTimelineApp from './TeamTimelineApp';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

vi.mock('./components/TimelineHeader', () => ({
    default: () => <div data-testid="timeline-header" />,
}));

vi.mock('./components/TeamSetToolbar', () => ({
    default: ({
        onCreate,
        onSelect,
    }: {
        onCreate?: () => void;
        onSelect?: (index: number) => void;
    }) => (
        <div data-testid="team-set-toolbar">
            <button type="button" data-testid="team-set-create-click" onClick={() => onCreate?.()}>
                create-team-set
            </button>
            <button type="button" data-testid="team-set-select-second-click" onClick={() => onSelect?.(1)}>
                select-team-set-2
            </button>
        </div>
    ),
}));

vi.mock('./components/SwapSupplementBar', () => ({
    default: () => null,
}));

vi.mock('./components/SimulationControls', () => ({
    default: ({
        fieldIndex,
        cookingSimEnabled,
        cookingCategory,
    }: {
        fieldIndex: number;
        cookingSimEnabled: boolean;
        cookingCategory: string;
    }) => (
        <div
            data-testid="simulation-controls"
            data-field-index={String(fieldIndex)}
            data-cooking-enabled={cookingSimEnabled ? 'true' : 'false'}
            data-cooking-category={cookingCategory}
        />
    ),
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
        box,
        onSelectNone,
    }: {
        open: boolean;
        box: PokemonBox;
        onSelectNone?: () => void;
    }) => (
        <div
            data-testid={onSelectNone ? 'swap-box-dialog' : 'team-box-dialog'}
            data-open={open ? 'true' : 'false'}
            data-item-count={String(box.items.length)}
        />
    ),
}));

vi.mock('./components/TimelineTable', () => ({
    default: ({
        compactEmptyCells,
        alwaysShowSwapButton,
        displayMode,
        team,
        swaps,
        onHeaderSlotClick,
        onOpenTimeSlotSettings,
    }: {
        compactEmptyCells?: boolean;
        alwaysShowSwapButton?: boolean;
        displayMode?: 'detailed' | 'simple';
        team: Array<{ iv: { pokemonName: string } } | null>;
        swaps: Array<{ dayIndex: number; slotId: string; teamSlotIndex: number; newPokemonId: number }>;
        onHeaderSlotClick?: (index: number) => void;
        onOpenTimeSlotSettings?: () => void;
    }) => (
        <div
            data-testid="timeline-table"
            data-compact-empty={compactEmptyCells ? 'true' : 'false'}
            data-always-show-swap={alwaysShowSwapButton ? 'true' : 'false'}
            data-display-mode={displayMode ?? 'detailed'}
            data-team={team.map(member => member?.iv.pokemonName ?? 'null').join('|')}
            data-swaps={swaps
                .map(swap => `${swap.dayIndex}:${swap.slotId}:${swap.teamSlotIndex}:${swap.newPokemonId}`)
                .join('|')}
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
                data-testid="timeline-open-time-slot-settings-click"
                onClick={() => onOpenTimeSlotSettings?.()}
            >
                open-time-slot-settings
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

        expect(screen.getByTestId('team-set-toolbar')).toBeDefined();
        expect(screen.getByTestId('team-timeline-pre-simulation-table')).toBeDefined();
        expect(screen.getByTestId('team-timeline-pre-simulation-scroll-container').getAttribute('data-scroll-overflow-x')).toBe('hidden');

        const timeline = screen.getByTestId('timeline-table');
        expect(timeline.getAttribute('data-compact-empty')).toBe('true');
        expect(timeline.getAttribute('data-always-show-swap')).toBe('true');
        expect(timeline.getAttribute('data-team')).toBe('Pikachu|Dragonite|Slowbro|null|Psyduck');
        expect(timeline.getAttribute('data-swaps')).toContain('0:slot-1:3:1000005');
        expect(timeline.getAttribute('data-swaps')).toContain('0:slot-2:3:1000006');
        expect(localStorage.getItem('PstTeamTimelinePresetAppliedV1')).toBe('1');

        expect(screen.queryByTestId('team-summary-row')).toBeNull();
        expect(screen.queryByTestId('daily-summary-row')).toBeNull();
    });

    it('switches team state by team set dropdown selection', () => {
        render(<TeamTimelineApp />);

        const timeline = screen.getByTestId('timeline-table');
        expect(timeline.getAttribute('data-team')).toBe('Pikachu|Dragonite|Slowbro|null|Psyduck');

        fireEvent.click(screen.getByTestId('team-set-create-click'));
        fireEvent.click(screen.getByTestId('team-set-select-second-click'));

        expect(screen.getByTestId('timeline-table').getAttribute('data-team')).toBe('null|null|null|null|null');
    });

    it('opens team box dialog when clicking timeline header slot', () => {
        render(<TeamTimelineApp />);

        expect(screen.getByTestId('team-box-dialog').getAttribute('data-open')).toBe('false');
        expect(screen.getByTestId('team-box-dialog').getAttribute('data-item-count')).toBe('0');
        expect(screen.getByTestId('swap-box-dialog').getAttribute('data-item-count')).toBe('0');

        fireEvent.click(screen.getByTestId('timeline-header-slot-click'));

        expect(screen.getByTestId('team-box-dialog').getAttribute('data-open')).toBe('true');
    });

    it('switches to settings tab when clicking timeline corner settings button', () => {
        render(<TeamTimelineApp />);

        expect(screen.queryByTestId('time-slot-editor')).toBeNull();

        fireEvent.click(screen.getByTestId('timeline-open-time-slot-settings-click'));

        expect(screen.getByTestId('time-slot-editor')).toBeDefined();
    });

    it('shows current sleep energy value next to slider in settings tab', () => {
        render(<TeamTimelineApp />);

        fireEvent.click(screen.getByTestId('timeline-open-time-slot-settings-click'));

        expect(screen.getByTestId('team-timeline-sleep-energy-value').textContent).toBe('50');
    });

    it('restores saved cooking and field settings from active team set and when switching team set', async () => {
        localStorage.setItem('PstTeamTimelineBonusSettings', JSON.stringify({
            fieldIndex: 1,
            favoriteType: ['fire', 'fire', 'fire'],
        }));
        localStorage.setItem('PstTeamTimelineCookingSettings', JSON.stringify({
            enabled: false,
            category: 'curry',
            recipeLevels: {},
            basePotCapacity: 81,
            initialIngredients: {},
            disabledRecipes: {},
            disabledExtraIngredients: {},
        }));
        localStorage.setItem('PstTeamTimelineTeamSetsV1', JSON.stringify({
            activeTeamSetIndex: 0,
            teamSets: [
                {
                    id: 'set-1',
                    name: 'set1',
                    team: [null, null, null, null, null],
                    swaps: [],
                    noCollectCells: [],
                    lastSimulationSnapshot: null,
                    saveCookingSettings: true,
                    saveFieldSettings: true,
                    savedCookingSettings: {
                        enabled: true,
                        category: 'dessert',
                    },
                    savedFieldSettings: {
                        fieldIndex: 4,
                        favoriteType: ['rock', 'ground', 'steel'],
                    },
                },
                {
                    id: 'set-2',
                    name: 'set2',
                    team: [null, null, null, null, null],
                    swaps: [],
                    noCollectCells: [],
                    lastSimulationSnapshot: null,
                    saveCookingSettings: true,
                    saveFieldSettings: true,
                    savedCookingSettings: {
                        enabled: false,
                        category: 'salad',
                    },
                    savedFieldSettings: {
                        fieldIndex: 2,
                        favoriteType: ['fire', 'water', 'grass'],
                    },
                },
            ],
        }));

        render(<TeamTimelineApp />);

        await waitFor(() => {
            const controls = screen.getByTestId('simulation-controls');
            expect(controls.getAttribute('data-field-index')).toBe('4');
            expect(controls.getAttribute('data-cooking-enabled')).toBe('true');
            expect(controls.getAttribute('data-cooking-category')).toBe('dessert');
        });

        fireEvent.click(screen.getByTestId('team-set-select-second-click'));

        await waitFor(() => {
            const controls = screen.getByTestId('simulation-controls');
            expect(controls.getAttribute('data-field-index')).toBe('2');
            expect(controls.getAttribute('data-cooking-enabled')).toBe('false');
            expect(controls.getAttribute('data-cooking-category')).toBe('salad');
        });
    });
});
