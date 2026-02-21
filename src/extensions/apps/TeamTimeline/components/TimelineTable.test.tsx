import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PokemonBox, { type PokemonBoxItem } from '../../../../util/PokemonBox';
import { NoCollectCellSetting, SimulationResult, TimeSlot, TimeSlotResult } from '../types/TimeSlotTypes';
import TimelineTable from './TimelineTable';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => {
            if (!defaultValue) {
                return key;
            }
            return defaultValue
                .replace('{{day}}', String(options?.day ?? ''))
                .replace('{{count}}', String(options?.count ?? ''))
                .replace('{{ep}}', String(options?.ep ?? ''));
        },
    }),
}));

vi.mock('./TimelineRow', () => ({
    default: ({
        dayIndex,
        originalSlotId,
        onSwapClick,
        onSwapLongPressStart,
        onSwapRemoveClick,
        noCollectCells,
        onNoCollectToggle,
        compactEmptyCells,
        alwaysShowSwapButton,
        displayMode,
        isFirstTimelineSlot,
        fitToViewport,
    }: {
        dayIndex: number;
        originalSlotId: string;
        onSwapClick?: (slotId: string, teamIndex: number, dayIndex: number) => void;
        onSwapLongPressStart?: (detail: {
            slotId: string;
            teamIndex: number;
            dayIndex: number;
            pointerId: number;
            clientX: number;
            clientY: number;
            swappedPokemonName?: string;
            previewWidth?: number;
            previewHeight?: number;
            pointerOffsetX?: number;
            pointerOffsetY?: number;
        }) => void;
        onSwapRemoveClick?: (slotId: string, teamIndex: number, dayIndex: number, pokemonId: number) => void;
        noCollectCells?: NoCollectCellSetting[];
        onNoCollectToggle?: (slotId: string, teamIndex: number, dayIndex: number) => void;
        compactEmptyCells?: boolean;
        alwaysShowSwapButton?: boolean;
        displayMode?: 'detailed' | 'simple';
        isFirstTimelineSlot?: boolean;
        fitToViewport?: boolean;
    }) => (
        <>
            <button
                type="button"
                data-testid={`swap-${dayIndex}-${originalSlotId}`}
                data-compact-empty={compactEmptyCells ? 'true' : 'false'}
                data-always-show-swap={alwaysShowSwapButton ? 'true' : 'false'}
                data-display-mode={displayMode ?? 'detailed'}
                data-first-timeline-slot={isFirstTimelineSlot ? 'true' : 'false'}
                data-fit-to-viewport={fitToViewport ? 'true' : 'false'}
                data-no-collect-count={String(noCollectCells?.length ?? 0)}
                onClick={() => onSwapClick?.(originalSlotId, 0, dayIndex)}
            >
                row
            </button>
            <button
                type="button"
                data-testid={`swap-longpress-${dayIndex}-${originalSlotId}`}
                onClick={() => onSwapLongPressStart?.({
                    slotId: originalSlotId,
                    teamIndex: 0,
                    dayIndex,
                    pointerId: 7,
                    clientX: 10,
                    clientY: 10,
                    swappedPokemonName: 'row',
                    previewWidth: 150,
                    previewHeight: 20,
                    pointerOffsetX: 25,
                    pointerOffsetY: 10,
                })}
            >
                longpress
            </button>
            <button
                type="button"
                data-testid={`swap-remove-${dayIndex}-${originalSlotId}`}
                onClick={() => onSwapRemoveClick?.(originalSlotId, 0, dayIndex, 25)}
            >
                remove
            </button>
            <button
                type="button"
                data-testid={`no-collect-toggle-${dayIndex}-${originalSlotId}`}
                onClick={() => onNoCollectToggle?.(originalSlotId, 0, dayIndex)}
            >
                no-collect
            </button>
        </>
    ),
}));

vi.mock('./DailySummaryRow', () => ({
    default: () => <div data-testid="daily-summary" />,
}));

vi.mock('./TeamSummaryRow', () => ({
    default: () => <div data-testid="team-summary" />,
}));
vi.mock('../../../../ui/IvCalc/PokemonIcon', () => ({
    default: ({ idForm, size }: { idForm: number; size: number }) => (
        <span data-testid="timeline-header-pokemon-icon">{`icon-${idForm}-${size}`}</span>
    ),
}));

const BASE_TIME_SLOTS: TimeSlot[] = [
    { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
    { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
    { id: 'night-snack', time: '03:30', sleepState: 'none', hasMeal: false },
];

const EMPTY_RESULT: SimulationResult = {
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
};

const HEADER_TEST_POKEMON: PokemonBoxItem = {
    iv: { idForm: 213, level: 50 },
    filledNickname: () => 'ツボツボ',
} as unknown as PokemonBoxItem;

function createTimeSlotResult(base: Partial<TimeSlotResult>): TimeSlotResult {
    return {
        slotId: 'slot-1',
        pokemonId: 1,
        teamIndex: 0,
        durationMinutes: 60,
        isSleeping: false,
        helpCount: 0,
        skillTriggerCount: 0,
        berryCount: 0,
        ingredients: [],
        skillIngredients: [],
        energyStart: 50,
        energyEnd: 50,
        mealRecovery: 0,
        skillRecovery: 0,
        wakeRecovery: 0,
        energyDecay: 0,
        skillOverflowCount: 0,
        overflowIngredients: [],
        selfSkillRecovery: 0,
        directSkillEP: 0,
        moonlightGivenRecovery: 0,
        moonlightReceivedRecovery: 0,
        energizingCheerGivenRecovery: 0,
        energizingCheerReceivedRecovery: 0,
        energizingCheerEvents: [],
        nuzzleTriggeredSkillEvents: [],
        proxySkillEvents: [],
        presentCandyCount: 0,
        berryJuiceCount: 0,
        supportSkillBerryCount: 0,
        supportSkillBerryEP: 0,
        supportHelpEvents: [],
        stockpileStoreCount: 0,
        stockpileCountAtStore: 0,
        stockpileSpitCount: 0,
        badDreamsHitCount: 0,
        badDreamsTotalDamageGiven: 0,
        badDreamsDamageTaken: 0,
        ...base,
    };
}

describe('TimelineTable', () => {
    it('hides text in the top-left corner cell only', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        const corner = screen.getByTestId('timeline-corner-header-cell');
        expect(corner.textContent).toBe('');
    });

    it('calls onOpenTimeSlotSettings when corner settings button is clicked', () => {
        const onOpenTimeSlotSettings = vi.fn();

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onOpenTimeSlotSettings={onOpenTimeSlotSettings}
            />
        );

        fireEvent.click(screen.getByTestId('timeline-corner-settings-button'));

        expect(onOpenTimeSlotSettings).toHaveBeenCalledTimes(1);
    });

    it('shows day bands including day 1 when simulation days are 2 or more', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={3}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        expect(screen.getByTestId('timeline-day-band-1').textContent).toBe('1日目');
        expect(screen.getByTestId('timeline-day-band-2').textContent).toContain('2日目');
        expect(screen.getByTestId('timeline-day-band-2').textContent).not.toContain('終了時');
        expect(screen.getByTestId('timeline-day-band-3').textContent).toContain('3日目');
        expect(screen.getByTestId('timeline-day-band-3').textContent).not.toContain('終了時');
    });

    it('computes actual cumulative EP for day-end bands', () => {
        const testPokemon: PokemonBoxItem = {
            id: 1,
            iv: {
                idForm: 25,
                level: 1,
                pokemon: { type: 'normal' },
            },
            filledNickname: () => 'テスト',
        } as unknown as PokemonBoxItem;
        const slotResults = new Map<string, TimeSlotResult[]>();
        slotResults.set('wake__day0', [createTimeSlotResult({
            slotId: 'wake__day0',
            pokemonId: 1,
            teamIndex: 0,
            berryCount: 3,
            directSkillEP: 16,
        })]);
        const result: SimulationResult = {
            ...EMPTY_RESULT,
            slotResults,
        };

        render(
            <TimelineTable
                team={[testPokemon, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={2}
                result={result}
                swaps={[]}
                box={new PokemonBox([testPokemon])}
            />
        );

        expect(screen.getByTestId('timeline-day-band-2').textContent).toContain('1日目終了時: 100 EP');
    });

    it('does not show day 1 band when simulation days is 1', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        expect(screen.queryByText('1日目')).toBeNull();
    });

    it('passes dayIndex=1 when clicking a day 2 slot swap', () => {
        const onSwapClick = vi.fn();

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={2}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onSwapClick={onSwapClick}
            />
        );

        fireEvent.click(screen.getByTestId('swap-1-wake'));

        expect(onSwapClick).toHaveBeenCalledTimes(1);
        expect(onSwapClick).toHaveBeenCalledWith('wake', 0, 1);
    });

    it('calls onHeaderSlotClick when header slot button is clicked', () => {
        const onHeaderSlotClick = vi.fn();

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onHeaderSlotClick={onHeaderSlotClick}
            />
        );

        fireEvent.click(screen.getByTestId('timeline-header-slot-button-0'));

        expect(onHeaderSlotClick).toHaveBeenCalledTimes(1);
        expect(onHeaderSlotClick).toHaveBeenCalledWith(0);
    });

    it('renders header content in Lv, icon, name order', () => {
        render(
            <TimelineTable
                team={[HEADER_TEST_POKEMON, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onHeaderSlotClick={vi.fn()}
            />
        );

        const button = screen.getByTestId('timeline-header-slot-button-0');
        const text = button.textContent ?? '';
        expect(text.indexOf('Lv.50')).toBeLessThan(text.indexOf('icon-213-30'));
        expect(text.indexOf('icon-213-30')).toBeLessThan(text.indexOf('ツボツボ'));
    });

    it('shows plus placeholder in empty header slots', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onHeaderSlotClick={vi.fn()}
            />
        );

        expect(screen.getAllByTestId('timeline-header-empty-plus-icon').length).toBeGreaterThan(0);
    });

    it('passes remove callback to TimelineRow', () => {
        const onSwapRemoveClick = vi.fn();

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onSwapRemoveClick={onSwapRemoveClick}
            />
        );

        fireEvent.click(screen.getByTestId('swap-remove-0-wake'));
        expect(onSwapRemoveClick).toHaveBeenCalledTimes(1);
        expect(onSwapRemoveClick).toHaveBeenCalledWith('wake', 0, 0, 25);
    });

    it('passes compact/always-show options down to TimelineRow', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                compactEmptyCells
                alwaysShowSwapButton
            />
        );

        const firstRow = screen.getByTestId('swap-0-sleep');
        expect(firstRow.getAttribute('data-compact-empty')).toBe('true');
        expect(firstRow.getAttribute('data-always-show-swap')).toBe('true');
    });

    it('passes no-collect cells and callback down to TimelineRow', () => {
        const onNoCollectToggle = vi.fn();
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                noCollectCells={[{ dayIndex: 0, slotId: 'wake', teamSlotIndex: 0 }]}
                box={new PokemonBox([])}
                onNoCollectToggle={onNoCollectToggle}
            />
        );

        expect(screen.getByTestId('swap-0-wake').getAttribute('data-no-collect-count')).toBe('1');
        fireEvent.click(screen.getByTestId('no-collect-toggle-0-wake'));
        expect(onNoCollectToggle).toHaveBeenCalledTimes(1);
        expect(onNoCollectToggle).toHaveBeenCalledWith('wake', 0, 0);
    });

    it('fits timeline width to viewport when compact mode is enabled', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                compactEmptyCells
            />
        );

        expect(screen.getByTestId('timeline-table-container').getAttribute('data-fit-to-viewport')).toBe('true');
        expect(screen.getByTestId('timeline-table-container').getAttribute('style')).toContain('--timeline-time-cell-width: 40px');
        expect(screen.getByTestId('swap-0-sleep').getAttribute('data-fit-to-viewport')).toBe('true');
    });

    it('passes simple display mode to rows and fits to viewport', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                displayMode="simple"
            />
        );

        const firstRow = screen.getByTestId('swap-0-sleep');
        expect(firstRow.getAttribute('data-display-mode')).toBe('simple');
        expect(firstRow.getAttribute('data-fit-to-viewport')).toBe('true');
        expect(screen.getByTestId('timeline-table-container').getAttribute('data-fit-to-viewport')).toBe('true');
        expect(screen.getByTestId('timeline-table-container').getAttribute('style')).toContain('--timeline-time-cell-width: 40px');
    });

    it('marks only the very first row as first timeline slot', () => {
        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={1}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        expect(screen.getByTestId('swap-0-sleep').getAttribute('data-first-timeline-slot')).toBe('true');
        expect(screen.getByTestId('swap-0-night-snack').getAttribute('data-first-timeline-slot')).toBe('false');
    });

    it('calls onSwapSeriesMove on pointer up after long-press drag', () => {
        const onSwapSeriesMove = vi.fn();
        const originalElementFromPoint = (document as Document & {
            elementFromPoint?: (x: number, y: number) => Element | null;
        }).elementFromPoint;
        const sourceCell = document.createElement('div');
        sourceCell.dataset.swapDropEnabled = 'true';
        sourceCell.dataset.swapSlotId = 'wake';
        sourceCell.dataset.swapTeamIndex = '0';
        sourceCell.dataset.swapDayIndex = '0';
        document.body.appendChild(sourceCell);

        const targetCell = document.createElement('div');
        targetCell.dataset.swapDropEnabled = 'true';
        targetCell.dataset.swapSlotId = 'sleep';
        targetCell.dataset.swapTeamIndex = '1';
        targetCell.dataset.swapDayIndex = '1';
        document.body.appendChild(targetCell);

        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: (x: number) => (x >= 11 ? targetCell : sourceCell),
        });

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={2}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onSwapSeriesMove={onSwapSeriesMove}
            />
        );

        fireEvent.click(screen.getByTestId('swap-longpress-0-wake'));
        fireEvent.pointerUp(window, { pointerId: 7, clientX: 11, clientY: 10 });

        expect(onSwapSeriesMove).toHaveBeenCalledTimes(1);
        expect(onSwapSeriesMove).toHaveBeenCalledWith('wake', 0, 0, 'sleep', 1, 1);

        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: originalElementFromPoint,
        });
        sourceCell.remove();
        targetCell.remove();
    });

    it('does not call onSwapSeriesMove when dropping on the same cell', () => {
        const onSwapSeriesMove = vi.fn();
        const originalElementFromPoint = (document as Document & {
            elementFromPoint?: (x: number, y: number) => Element | null;
        }).elementFromPoint;
        const sourceCell = document.createElement('div');
        sourceCell.dataset.swapDropEnabled = 'true';
        sourceCell.dataset.swapSlotId = 'wake';
        sourceCell.dataset.swapTeamIndex = '0';
        sourceCell.dataset.swapDayIndex = '0';
        document.body.appendChild(sourceCell);

        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: () => sourceCell,
        });

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={2}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
                onSwapSeriesMove={onSwapSeriesMove}
            />
        );

        fireEvent.click(screen.getByTestId('swap-longpress-0-wake'));
        fireEvent.pointerUp(window, { pointerId: 7, clientX: 10, clientY: 10 });

        expect(onSwapSeriesMove).not.toHaveBeenCalled();

        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: originalElementFromPoint,
        });
        sourceCell.remove();
    });

    it('shows drag ghost during drag session and hides it after pointer up', () => {
        const originalElementFromPoint = (document as Document & {
            elementFromPoint?: (x: number, y: number) => Element | null;
        }).elementFromPoint;
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: () => null,
        });

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={2}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        fireEvent.click(screen.getByTestId('swap-longpress-0-wake'));
        expect(screen.getByTestId('timeline-swap-drag-ghost')).toBeDefined();

        fireEvent.pointerUp(window, { pointerId: 7, clientX: 10, clientY: 10 });
        expect(screen.queryByTestId('timeline-swap-drag-ghost')).toBeNull();

        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: originalElementFromPoint,
        });
    });

    it('applies lift offset immediately when drag ghost appears', () => {
        const originalElementFromPoint = (document as Document & {
            elementFromPoint?: (x: number, y: number) => Element | null;
        }).elementFromPoint;
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: () => null,
        });

        render(
            <TimelineTable
                team={[null, null, null, null, null]}
                timeSlots={BASE_TIME_SLOTS}
                simulationDays={2}
                result={EMPTY_RESULT}
                swaps={[]}
                box={new PokemonBox([])}
            />
        );

        fireEvent.click(screen.getByTestId('swap-longpress-0-wake'));
        const ghost = screen.getByTestId('timeline-swap-drag-ghost');
        expect((ghost as HTMLElement).style.transform).toBe('translate3d(-15px, -10px, 0) scale(1)');

        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: originalElementFromPoint,
        });
    });
});
