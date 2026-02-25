import PokemonBox, { PokemonBoxItem } from '../../../util/PokemonBox';
import {
    TeamTimelineState,
    TeamTimelineAction,
    TeamSetState,
    TeamSetSimulationSnapshot,
    MAX_TEAM_SIZE,
    STORAGE_KEY,
    SerializedTeam,
} from './types/TeamTimelineTypes';
import {
    TimeSlot,
    SimulationConfig,
    PokemonSwap,
    NoCollectCellSetting,
    DEFAULT_TIME_SLOTS,
    DEFAULT_SIMULATION_CONFIG,
    clampSimulationDays,
    STORAGE_KEY_SLOTS,
    STORAGE_KEY_CONFIG,
    migrateTimeSlot,
} from './types/TimeSlotTypes';
import { SummaryValueMode } from './utils/SummaryValueModeUtils';
import { TRIAL_COUNT_OPTIONS } from './types/MultiTrialTypes';
import { TimelineBonusSettings } from './types/TimelineBonusSettingsTypes';
import {
    createDefaultTimelineBonusSettings,
    normalizeTimelineBonusSettings,
} from './utils/TimelineBonusSettingsBridge';
import { createDefaultCookingSettings } from './types/CookingTypes';

export const STORAGE_KEY_BONUS_SETTINGS = 'PstTeamTimelineBonusSettings';
export const STORAGE_KEY_SYNC_IV_PARAMETER = 'PstTeamTimelineSyncIvParam';
export const STORAGE_KEY_SUMMARY_VALUE_MODE = 'PstTeamTimelineSummaryValueMode';
export const STORAGE_KEY_LEFTOVER_INCLUDE_EXTRA_USAGE = 'PstTeamTimelineLeftoverIncludeExtraUsage';
export const STORAGE_KEY_SEED_MODE = 'PstTeamTimelineSeedMode';
export const STORAGE_KEY_TRIAL_COUNT = 'PstTeamTimelineTrialCount';
export const STORAGE_KEY_TEAM_SETS = 'PstTeamTimelineTeamSetsV1';

interface SerializedTeamSetState {
    id: string;
    name: string;
    team: SerializedTeam;
    swaps: PokemonSwap[];
    noCollectCells: NoCollectCellSetting[];
    lastSimulationSnapshot?: TeamSetSimulationSnapshot | null;
}

interface SerializedTeamSetPayload {
    activeTeamSetIndex: number;
    teamSets: SerializedTeamSetState[];
}

interface SwapPosition {
    dayIndex: number;
    slotId: string;
    teamSlotIndex: number;
}

function createEmptyTeam(): (PokemonBoxItem | null)[] {
    return Array(MAX_TEAM_SIZE).fill(null);
}

function normalizeTeamLength(team: readonly (PokemonBoxItem | null)[]): (PokemonBoxItem | null)[] {
    const normalized = [...team];
    while (normalized.length < MAX_TEAM_SIZE) {
        normalized.push(null);
    }
    return normalized.slice(0, MAX_TEAM_SIZE);
}

function cloneTeamSet(set: TeamSetState): TeamSetState {
    return {
        id: set.id,
        name: set.name,
        team: normalizeTeamLength(set.team),
        swaps: [...set.swaps],
        noCollectCells: [...set.noCollectCells],
        lastSimulationSnapshot: set.lastSimulationSnapshot
            ? { ...set.lastSimulationSnapshot }
            : null,
    };
}

function createEmptyTeamSet(id: string, name: string): TeamSetState {
    return {
        id,
        name,
        team: createEmptyTeam(),
        swaps: [],
        noCollectCells: [],
        lastSimulationSnapshot: null,
    };
}

function clampActiveTeamSetIndex(index: number, teamSets: readonly TeamSetState[]): number {
    if (teamSets.length === 0) {
        return 0;
    }
    if (!Number.isFinite(index)) {
        return 0;
    }
    return Math.max(0, Math.min(Math.floor(index), teamSets.length - 1));
}

function replaceActiveTeamSet(
    state: TeamTimelineState,
    nextTeam: (PokemonBoxItem | null)[],
    nextSwaps: PokemonSwap[],
    nextNoCollectCells: NoCollectCellSetting[],
): TeamTimelineState {
    const activeIndex = clampActiveTeamSetIndex(state.activeTeamSetIndex, state.teamSets);
    const nextTeamSets = state.teamSets.map((set, index) => {
        if (index !== activeIndex) {
            return set;
        }
        return {
            ...set,
            team: normalizeTeamLength(nextTeam),
            swaps: [...nextSwaps],
            noCollectCells: [...nextNoCollectCells],
            lastSimulationSnapshot: null,
        };
    });
    return {
        ...state,
        activeTeamSetIndex: activeIndex,
        team: normalizeTeamLength(nextTeam),
        swaps: [...nextSwaps],
        noCollectCells: [...nextNoCollectCells],
        teamSets: nextTeamSets,
    };
}

function toSwapPositionKey(position: SwapPosition): string {
    return `${position.dayIndex}:${position.slotId}:${position.teamSlotIndex}`;
}

function getSwapPosition(swap: Pick<PokemonSwap, 'dayIndex' | 'slotId' | 'teamSlotIndex'>): SwapPosition {
    return {
        dayIndex: swap.dayIndex,
        slotId: swap.slotId,
        teamSlotIndex: swap.teamSlotIndex,
    };
}

function findSwapAtPosition(
    swaps: readonly PokemonSwap[],
    position: SwapPosition
): PokemonSwap | undefined {
    for (let index = swaps.length - 1; index >= 0; index--) {
        const swap = swaps[index];
        if (
            swap.dayIndex === position.dayIndex &&
            swap.slotId === position.slotId &&
            swap.teamSlotIndex === position.teamSlotIndex
        ) {
            return swap;
        }
    }
    return undefined;
}

function collectRepeatSeriesFromSwap(
    swaps: readonly PokemonSwap[],
    anchorSwap: PokemonSwap
): PokemonSwap[] {
    const repeatedSwaps = swaps
        .filter(
            swap =>
                swap.slotId === anchorSwap.slotId &&
                swap.teamSlotIndex === anchorSwap.teamSlotIndex &&
                swap.dayIndex > anchorSwap.dayIndex &&
                swap.isRepeatGenerated === true
        )
        .sort((left, right) => left.dayIndex - right.dayIndex);
    return [anchorSwap, ...repeatedSwaps];
}

function getResetSimulationFields(): Pick<
    TeamTimelineState,
    | 'simulationLoading'
    | 'simulationResult'
    | 'simulationError'
    | 'multiTrialResults'
    | 'multiTrialSelectedIndex'
    | 'multiTrialAverageDailySummaries'
    | 'multiTrialAverageTeamSummary'
    | 'multiTrialAverageCookingSummary'
> {
    return {
        simulationLoading: false,
        simulationResult: null,
        simulationError: null,
        multiTrialResults: null,
        multiTrialSelectedIndex: null,
        multiTrialAverageDailySummaries: null,
        multiTrialAverageTeamSummary: null,
        multiTrialAverageCookingSummary: null,
    };
}

/**
 * 初期状態を生成
 */
export function createInitialState(): TeamTimelineState {
    const initialTeamSet = createEmptyTeamSet('team-set-initial', 'Team 1');
    return {
        teamSets: [initialTeamSet],
        activeTeamSetIndex: 0,
        team: [...initialTeamSet.team],
        selectedSlotIndex: null,
        boxSelectDialogOpen: false,
        // Phase 3: 時間帯とシミュレーション
        timeSlots: DEFAULT_TIME_SLOTS,
        simulationConfig: DEFAULT_SIMULATION_CONFIG,
        simulationResult: null,
        simulationLoading: false,
        simulationError: null,
        activeTab: 'team',
        editingSlotIndex: null,
        timeSlotDialogOpen: false,
        // Phase 4: ポケモン入れ替え
        swaps: [],
        noCollectCells: [],
        swapTargetSlotId: null,
        swapTargetTeamIndex: null,
        swapTargetDayIndex: null,
        swapDialogOpen: false,
        energyDialogOpen: false,
        pendingSwapPokemonId: null,
        seedMode: 'random' as const,
        multiTrialCount: 1000,
        multiTrialResults: null,
        multiTrialSelectedIndex: null,
        multiTrialAverageDailySummaries: null,
        multiTrialAverageTeamSummary: null,
        multiTrialAverageCookingSummary: null,
        bonusSettings: createDefaultTimelineBonusSettings(),
        syncWithIvParameter: true,
        cookingSettings: createDefaultCookingSettings(),
    };
}

/**
 * チームタイムラインのリデューサー
 */
export function teamTimelineReducer(
    state: TeamTimelineState,
    action: TeamTimelineAction
): TeamTimelineState {
    switch (action.type) {
        case 'renameActiveTeamSet': {
            const activeIndex = clampActiveTeamSetIndex(state.activeTeamSetIndex, state.teamSets);
            return {
                ...state,
                activeTeamSetIndex: activeIndex,
                teamSets: state.teamSets.map((set, index) => (
                    index === activeIndex
                        ? { ...set, name: action.name }
                        : set
                )),
            };
        }
        case 'createTeamSet': {
            const newSet = createEmptyTeamSet(action.id, action.name);
            const nextTeamSets = [...state.teamSets, newSet];
            const nextActiveIndex = nextTeamSets.length - 1;
            return {
                ...state,
                teamSets: nextTeamSets,
                activeTeamSetIndex: nextActiveIndex,
                team: [...newSet.team],
                swaps: [],
                noCollectCells: [],
            };
        }
        case 'duplicateTeamSet': {
            const activeIndex = clampActiveTeamSetIndex(state.activeTeamSetIndex, state.teamSets);
            const sourceSet = state.teamSets[activeIndex] ?? createEmptyTeamSet(action.id, action.name);
            const duplicatedSet: TeamSetState = {
                ...cloneTeamSet(sourceSet),
                id: action.id,
                name: action.name,
                lastSimulationSnapshot: null,
            };
            const nextTeamSets = [...state.teamSets, duplicatedSet];
            const nextActiveIndex = nextTeamSets.length - 1;
            return {
                ...state,
                teamSets: nextTeamSets,
                activeTeamSetIndex: nextActiveIndex,
                team: [...duplicatedSet.team],
                swaps: [...duplicatedSet.swaps],
                noCollectCells: [...duplicatedSet.noCollectCells],
            };
        }
        case 'deleteTeamSet': {
            if (state.teamSets.length <= 1) {
                const replacement = createEmptyTeamSet(action.fallbackId, action.fallbackName);
                return {
                    ...state,
                    teamSets: [replacement],
                    activeTeamSetIndex: 0,
                    team: [...replacement.team],
                    swaps: [],
                    noCollectCells: [],
                };
            }

            const activeIndex = clampActiveTeamSetIndex(state.activeTeamSetIndex, state.teamSets);
            const nextTeamSets = state.teamSets.filter((_, index) => index !== activeIndex);
            const nextActiveIndex = clampActiveTeamSetIndex(activeIndex, nextTeamSets);
            const activeSet = nextTeamSets[nextActiveIndex];
            return {
                ...state,
                teamSets: nextTeamSets,
                activeTeamSetIndex: nextActiveIndex,
                team: [...activeSet.team],
                swaps: [...activeSet.swaps],
                noCollectCells: [...activeSet.noCollectCells],
            };
        }
        case 'selectTeamSet': {
            const nextActiveIndex = clampActiveTeamSetIndex(action.index, state.teamSets);
            const activeSet = state.teamSets[nextActiveIndex];
            return {
                ...state,
                activeTeamSetIndex: nextActiveIndex,
                team: [...activeSet.team],
                swaps: [...activeSet.swaps],
                noCollectCells: [...activeSet.noCollectCells],
            };
        }
        case 'loadTeamSets': {
            const normalizedTeamSets = action.teamSets.length > 0
                ? action.teamSets.map(cloneTeamSet)
                : [createEmptyTeamSet('team-set-initial', 'Team 1')];
            const nextActiveIndex = clampActiveTeamSetIndex(action.activeIndex, normalizedTeamSets);
            const activeSet = normalizedTeamSets[nextActiveIndex];
            return {
                ...state,
                teamSets: normalizedTeamSets,
                activeTeamSetIndex: nextActiveIndex,
                team: [...activeSet.team],
                swaps: [...activeSet.swaps],
                noCollectCells: [...activeSet.noCollectCells],
            };
        }
        case 'setActiveTeamSetSimulationSnapshot': {
            const activeIndex = clampActiveTeamSetIndex(state.activeTeamSetIndex, state.teamSets);
            return {
                ...state,
                activeTeamSetIndex: activeIndex,
                teamSets: state.teamSets.map((set, index) => (
                    index === activeIndex
                        ? { ...set, lastSimulationSnapshot: { ...action.snapshot } }
                        : set
                )),
            };
        }
        case 'openSlotDialog':
            return {
                ...state,
                selectedSlotIndex: action.index,
                boxSelectDialogOpen: true,
            };
        case 'closeSlotDialog':
            return {
                ...state,
                selectedSlotIndex: null,
                boxSelectDialogOpen: false,
            };
        case 'selectPokemon': {
            const newTeam = [...state.team];
            newTeam[action.index] = action.item;
            const nextState = {
                ...state,
                selectedSlotIndex: null,
                boxSelectDialogOpen: false,
            };
            return replaceActiveTeamSet(nextState, newTeam, state.swaps, state.noCollectCells);
        }
        case 'removePokemon': {
            const newTeam = [...state.team];
            newTeam[action.index] = null;
            return replaceActiveTeamSet(state, newTeam, state.swaps, state.noCollectCells);
        }
        case 'loadTeam':
            return replaceActiveTeamSet(state, action.team, state.swaps, state.noCollectCells);
        // Phase 3: 時間帯操作
        case 'addTimeSlot':
            return {
                ...state,
                timeSlots: [...state.timeSlots, action.slot],
            };
        case 'updateTimeSlot': {
            const newTimeSlots = [...state.timeSlots];
            newTimeSlots[action.index] = action.slot;
            return {
                ...state,
                timeSlots: newTimeSlots,
            };
        }
        case 'removeTimeSlot': {
            const newTimeSlots = state.timeSlots.filter((_, i) => i !== action.index);
            return {
                ...state,
                timeSlots: newTimeSlots,
            };
        }
        case 'resetTimeSlots':
            return {
                ...state,
                timeSlots: DEFAULT_TIME_SLOTS,
            };
        case 'loadTimeSlots':
            return {
                ...state,
                timeSlots: action.slots,
            };
        // Phase 3: シミュレーション設定
        case 'updateSimulationConfig': {
            const mergedConfig: SimulationConfig = {
                ...state.simulationConfig,
                ...action.config,
            };
            if (action.config.simulationDays !== undefined) {
                mergedConfig.simulationDays = clampSimulationDays(action.config.simulationDays);
            }
            return {
                ...state,
                simulationConfig: mergedConfig,
            };
        }
        case 'loadSimulationConfig':
            return {
                ...state,
                simulationConfig: action.config,
            };
        // Phase 3: シミュレーション実行
        case 'startSimulation':
            return {
                ...state,
                simulationLoading: true,
                simulationError: null,
                multiTrialResults: null,
                multiTrialSelectedIndex: null,
                multiTrialAverageDailySummaries: null,
                multiTrialAverageTeamSummary: null,
                multiTrialAverageCookingSummary: null,
            };
        case 'setSimulationPreviewResult':
            return {
                ...state,
                simulationResult: action.result,
            };
        case 'setSimulationResult':
            return {
                ...state,
                simulationLoading: false,
                simulationResult: action.result,
            };
        case 'setSimulationError':
            return {
                ...state,
                simulationLoading: false,
                simulationError: action.error,
            };
        case 'clearSimulationResult':
            return {
                ...state,
                simulationResult: null,
                simulationError: null,
            };
        // Phase 3: UI状態
        case 'selectTab':
            return {
                ...state,
                activeTab: action.tab,
            };
        case 'openTimeSlotDialog':
            return {
                ...state,
                timeSlotDialogOpen: true,
                editingSlotIndex: action.index ?? null,
            };
        case 'closeTimeSlotDialog':
            return {
                ...state,
                timeSlotDialogOpen: false,
                editingSlotIndex: null,
            };
        // Phase 4: ポケモン入れ替え
        case 'openSwapDialog':
            return {
                ...state,
                swapTargetSlotId: action.slotId,
                swapTargetTeamIndex: action.teamIndex,
                swapTargetDayIndex: action.dayIndex,
                swapDialogOpen: true,
            };
        case 'closeSwapDialog':
            return {
                ...state,
                swapTargetSlotId: null,
                swapTargetTeamIndex: null,
                swapTargetDayIndex: null,
                swapDialogOpen: false,
                energyDialogOpen: false,
                pendingSwapPokemonId: null,
            };
        case 'setPendingSwap':
            return {
                ...state,
                pendingSwapPokemonId: action.pokemonId,
                energyDialogOpen: true,
                swapDialogOpen: false,
            };
        case 'confirmSwap': {
            if (
                state.swapTargetSlotId === null ||
                state.swapTargetTeamIndex === null ||
                state.swapTargetDayIndex === null ||
                state.pendingSwapPokemonId === null
            ) {
                return state;
            }

            const teamSlotIndex = state.swapTargetTeamIndex;
            const targetDayIndex = state.swapTargetDayIndex;
            const targetSlotId = state.swapTargetSlotId;

            // Remove existing swaps at the same position (and any repeat-generated swaps
            // for the same teamSlotIndex/slotId on later days if we are re-creating them)
            const filteredSwaps = state.swaps.filter(
                s => !(
                    s.dayIndex === targetDayIndex &&
                    s.slotId === targetSlotId &&
                    s.teamSlotIndex === teamSlotIndex
                )
            );
            const swapsWithoutOldRepeats = action.repeat
                ? filteredSwaps.filter(
                    s => !(
                        s.slotId === targetSlotId &&
                        s.teamSlotIndex === teamSlotIndex &&
                        s.isRepeatGenerated === true
                    )
                )
                : filteredSwaps;

            const newSwap: PokemonSwap = {
                dayIndex: targetDayIndex,
                slotId: targetSlotId,
                teamSlotIndex,
                newPokemonId: state.pendingSwapPokemonId,
                initialEnergy: action.initialEnergy,
            };
            const allNewSwaps: PokemonSwap[] = [newSwap];

            if (action.repeat) {
                const simulationDays = state.simulationConfig.simulationDays;
                for (let d = targetDayIndex + 1; d < simulationDays; d++) {
                    const repeatedSwap: PokemonSwap = {
                        dayIndex: d,
                        slotId: targetSlotId,
                        teamSlotIndex,
                        newPokemonId: state.pendingSwapPokemonId,
                        initialEnergy: action.initialEnergy,
                        isRepeatGenerated: true,
                    };
                    allNewSwaps.push(repeatedSwap);
                }
            }

            const nextState = {
                ...state,
                swapTargetSlotId: null,
                swapTargetTeamIndex: null,
                swapTargetDayIndex: null,
                swapDialogOpen: false,
                energyDialogOpen: false,
                pendingSwapPokemonId: null,
            };
            return replaceActiveTeamSet(nextState, state.team, [...swapsWithoutOldRepeats, ...allNewSwaps], state.noCollectCells);
        }
        case 'confirmSwapDirect': {
            if (
                state.swapTargetSlotId === null ||
                state.swapTargetTeamIndex === null ||
                state.swapTargetDayIndex === null
            ) {
                return state;
            }
            const filteredSwaps = state.swaps.filter(
                s => !(
                    s.dayIndex === state.swapTargetDayIndex &&
                    s.slotId === state.swapTargetSlotId &&
                    s.teamSlotIndex === state.swapTargetTeamIndex
                )
            );
            const newSwap = {
                dayIndex: state.swapTargetDayIndex,
                slotId: state.swapTargetSlotId,
                teamSlotIndex: state.swapTargetTeamIndex,
                newPokemonId: action.pokemonId,
                initialEnergy: action.initialEnergy,
            };
            const nextState = {
                ...state,
                swapTargetSlotId: null,
                swapTargetTeamIndex: null,
                swapTargetDayIndex: null,
                swapDialogOpen: false,
                energyDialogOpen: false,
                pendingSwapPokemonId: null,
            };
            return replaceActiveTeamSet(nextState, state.team, [...filteredSwaps, newSwap], state.noCollectCells);
        }
        case 'removeSwap': {
            const newSwaps = state.swaps.filter(
                (swap) => {
                    const isSameSlotTarget =
                        swap.slotId === action.slotId &&
                        swap.teamSlotIndex === action.teamIndex;
                    if (!isSameSlotTarget) {
                        return true;
                    }

                    if (action.removeFutureRepeats && action.pokemonId !== undefined) {
                        const isSamePokemon = swap.newPokemonId === action.pokemonId;
                        const isCurrentOrFuture = swap.dayIndex >= action.dayIndex;
                        return !(isSamePokemon && isCurrentOrFuture);
                    }

                    return swap.dayIndex !== action.dayIndex;
                }
            );
            return replaceActiveTeamSet(state, state.team, newSwaps, state.noCollectCells);
        }
        case 'moveSwapSeries': {
            const sourcePosition: SwapPosition = {
                dayIndex: action.fromDayIndex,
                slotId: action.fromSlotId,
                teamSlotIndex: action.fromTeamIndex,
            };
            const targetPosition: SwapPosition = {
                dayIndex: action.toDayIndex,
                slotId: action.toSlotId,
                teamSlotIndex: action.toTeamIndex,
            };
            if (
                sourcePosition.dayIndex === targetPosition.dayIndex &&
                sourcePosition.slotId === targetPosition.slotId &&
                sourcePosition.teamSlotIndex === targetPosition.teamSlotIndex
            ) {
                return state;
            }

            const sourceAnchor = findSwapAtPosition(state.swaps, sourcePosition);
            if (!sourceAnchor) {
                return state;
            }

            const sourceSeries = collectRepeatSeriesFromSwap(state.swaps, sourceAnchor);
            const sourceSeriesKeySet = new Set(
                sourceSeries.map((swap) => toSwapPositionKey(getSwapPosition(swap)))
            );
            let remainingSwaps = state.swaps.filter(
                (swap) => !sourceSeriesKeySet.has(toSwapPositionKey(getSwapPosition(swap)))
            );

            const targetAnchor = findSwapAtPosition(remainingSwaps, targetPosition);
            if (targetAnchor) {
                const targetSeries = collectRepeatSeriesFromSwap(remainingSwaps, targetAnchor);
                const targetSeriesKeySet = new Set(
                    targetSeries.map((swap) => toSwapPositionKey(getSwapPosition(swap)))
                );
                remainingSwaps = remainingSwaps.filter(
                    (swap) => !targetSeriesKeySet.has(toSwapPositionKey(getSwapPosition(swap)))
                );
            }

            const movedSwaps = sourceSeries
                .map((swap): PokemonSwap | null => {
                    const dayOffset = swap.dayIndex - sourceAnchor.dayIndex;
                    const movedDayIndex = targetPosition.dayIndex + dayOffset;
                    if (movedDayIndex < 0 || movedDayIndex >= state.simulationConfig.simulationDays) {
                        return null;
                    }
                    return {
                        dayIndex: movedDayIndex,
                        slotId: targetPosition.slotId,
                        teamSlotIndex: targetPosition.teamSlotIndex,
                        newPokemonId: swap.newPokemonId,
                        newPokemonSerialized: swap.newPokemonSerialized,
                        initialEnergy: swap.initialEnergy,
                        isRepeatGenerated: swap.isRepeatGenerated,
                    };
                })
                .filter((swap): swap is PokemonSwap => swap !== null);

            if (movedSwaps.length === 0) {
                return replaceActiveTeamSet(state, state.team, remainingSwaps, state.noCollectCells);
            }

            const movedSwapKeySet = new Set(
                movedSwaps.map((swap) => toSwapPositionKey(getSwapPosition(swap)))
            );
            remainingSwaps = remainingSwaps.filter(
                (swap) => !movedSwapKeySet.has(toSwapPositionKey(getSwapPosition(swap)))
            );

            return replaceActiveTeamSet(state, state.team, [...remainingSwaps, ...movedSwaps], state.noCollectCells);
        }
        case 'clearSwaps':
            return replaceActiveTeamSet(state, state.team, [], state.noCollectCells);
        case 'loadSwaps':
            return replaceActiveTeamSet(state, state.team, action.swaps, state.noCollectCells);
        case 'toggleNoCollectCell': {
            const nextTarget: NoCollectCellSetting = {
                dayIndex: action.dayIndex,
                slotId: action.slotId,
                teamSlotIndex: action.teamIndex,
            };
            const targetIndex = state.noCollectCells.findIndex(
                (cell) =>
                    cell.dayIndex === nextTarget.dayIndex &&
                    cell.slotId === nextTarget.slotId &&
                    cell.teamSlotIndex === nextTarget.teamSlotIndex
            );
            if (targetIndex >= 0) {
                return replaceActiveTeamSet(
                    state,
                    state.team,
                    state.swaps,
                    state.noCollectCells.filter((_, index) => index !== targetIndex),
                );
            }
            return replaceActiveTeamSet(
                state,
                state.team,
                state.swaps,
                [...state.noCollectCells, nextTarget],
            );
        }
        case 'loadNoCollectCells':
            return replaceActiveTeamSet(state, state.team, state.swaps, action.noCollectCells);
        case 'setSeedMode':
            return { ...state, seedMode: action.mode };
        case 'setMultiTrialCount':
            return { ...state, multiTrialCount: action.count };
        case 'setMultiTrialResults':
            return {
                ...state,
                multiTrialResults: action.results,
                multiTrialSelectedIndex: action.medianIndex,
                multiTrialAverageDailySummaries: action.averageDailySummaries,
                multiTrialAverageTeamSummary: action.averageTeamSummary,
                multiTrialAverageCookingSummary: action.averageCookingSummary,
                simulationLoading: false,
            };
        case 'setMultiTrialSelectedIndex':
            return { ...state, multiTrialSelectedIndex: action.index };
        case 'clearMultiTrialResults':
            return {
                ...state,
                multiTrialResults: null,
                multiTrialSelectedIndex: null,
                multiTrialAverageDailySummaries: null,
                multiTrialAverageTeamSummary: null,
                multiTrialAverageCookingSummary: null,
                simulationResult: null,
            };
        case 'setBonusSettings':
            return {
                ...state,
                bonusSettings: action.settings,
            };
        case 'loadBonusSettings':
            return {
                ...state,
                bonusSettings: action.settings,
            };
        case 'setSyncWithIvParameter':
            return {
                ...state,
                syncWithIvParameter: action.enabled,
            };
        case 'loadSyncWithIvParameter':
            return {
                ...state,
                syncWithIvParameter: action.enabled,
            };
        case 'setCookingSettings':
            return {
                ...state,
                ...getResetSimulationFields(),
                cookingSettings: action.settings,
            };
        case 'loadCookingSettings':
            return {
                ...state,
                cookingSettings: action.settings,
            };
        default:
            return state;
    }
}

/**
 * チームデータをlocalStorageに保存
 */
export function saveTeamToStorage(team: (PokemonBoxItem | null)[]): void {
    const serialized: SerializedTeam = team.map(item =>
        item ? item.serialize() : null
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
}

/**
 * チームデータをlocalStorageから読み込み
 * @param box ボックス（デシリアライズに使用）
 */
export function loadTeamFromStorage(box: PokemonBox): (PokemonBoxItem | null)[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
        return Array(MAX_TEAM_SIZE).fill(null);
    }

    try {
        const serialized: SerializedTeam = JSON.parse(data);
        if (!Array.isArray(serialized)) {
            return Array(MAX_TEAM_SIZE).fill(null);
        }

        const team: (PokemonBoxItem | null)[] = serialized.map(item => {
            if (!item) return null;
            const parsed = box.deserializeItem(item);
            if (!parsed) return null;
            return new PokemonBoxItem(parsed.iv, parsed.nickname);
        });

        // 配列サイズを調整
        while (team.length < MAX_TEAM_SIZE) {
            team.push(null);
        }
        return team.slice(0, MAX_TEAM_SIZE);
    } catch {
        return Array(MAX_TEAM_SIZE).fill(null);
    }
}

function migratePokemonSwap(rawSwap: unknown): PokemonSwap | null {
    if (!rawSwap || typeof rawSwap !== 'object') {
        return null;
    }
    const candidate = rawSwap as Partial<PokemonSwap> & { dayIndex?: unknown };
    if (
        typeof candidate.slotId !== 'string' ||
        typeof candidate.teamSlotIndex !== 'number' ||
        typeof candidate.newPokemonId !== 'number' ||
        typeof candidate.initialEnergy !== 'number'
    ) {
        return null;
    }
    const dayIndex = typeof candidate.dayIndex === 'number'
        ? Math.max(0, Math.floor(candidate.dayIndex))
        : 0;
    return {
        dayIndex,
        slotId: candidate.slotId,
        teamSlotIndex: Math.max(0, Math.floor(candidate.teamSlotIndex)),
        newPokemonId: candidate.newPokemonId,
        newPokemonSerialized: typeof candidate.newPokemonSerialized === 'string'
            ? candidate.newPokemonSerialized
            : undefined,
        initialEnergy: candidate.initialEnergy,
        isRepeatGenerated: candidate.isRepeatGenerated === true ? true : undefined,
    };
}

function migrateNoCollectCell(rawCell: unknown): NoCollectCellSetting | null {
    if (!rawCell || typeof rawCell !== 'object') {
        return null;
    }
    const candidate = rawCell as Partial<NoCollectCellSetting> & { dayIndex?: unknown };
    if (
        typeof candidate.slotId !== 'string' ||
        typeof candidate.teamSlotIndex !== 'number'
    ) {
        return null;
    }
    const dayIndex = typeof candidate.dayIndex === 'number'
        ? Math.max(0, Math.floor(candidate.dayIndex))
        : 0;
    return {
        dayIndex,
        slotId: candidate.slotId,
        teamSlotIndex: Math.max(0, Math.floor(candidate.teamSlotIndex)),
    };
}

function migrateTeamSetSimulationSnapshot(rawSnapshot: unknown): TeamSetSimulationSnapshot | null {
    if (!rawSnapshot || typeof rawSnapshot !== 'object') {
        return null;
    }
    const candidate = rawSnapshot as Partial<TeamSetSimulationSnapshot>;
    if (
        typeof candidate.averageTotalEP !== 'number'
        || !Number.isFinite(candidate.averageTotalEP)
        || typeof candidate.settingsHash !== 'string'
        || candidate.settingsHash.length === 0
    ) {
        return null;
    }
    return {
        averageTotalEP: candidate.averageTotalEP,
        settingsHash: candidate.settingsHash,
    };
}

function deserializeSerializedTeam(
    serializedTeam: unknown,
    box: PokemonBox,
): (PokemonBoxItem | null)[] {
    if (!Array.isArray(serializedTeam)) {
        return createEmptyTeam();
    }
    const deserialized = serializedTeam.map((item) => {
        if (typeof item !== 'string') {
            return null;
        }
        const parsed = box.deserializeItem(item);
        if (!parsed) {
            return null;
        }
        return new PokemonBoxItem(parsed.iv, parsed.nickname);
    });
    return normalizeTeamLength(deserialized);
}

function serializeTeam(team: readonly (PokemonBoxItem | null)[]): SerializedTeam {
    return normalizeTeamLength(team).map((item) => (item ? item.serialize() : null));
}

export function saveTeamSetsToStorage(teamSets: TeamSetState[], activeTeamSetIndex: number): void {
    const payload: SerializedTeamSetPayload = {
        activeTeamSetIndex: clampActiveTeamSetIndex(activeTeamSetIndex, teamSets),
        teamSets: teamSets.map((teamSet) => ({
            id: teamSet.id,
            name: teamSet.name,
            team: serializeTeam(teamSet.team),
            swaps: [...teamSet.swaps],
            noCollectCells: [...teamSet.noCollectCells],
            lastSimulationSnapshot: teamSet.lastSimulationSnapshot
                ? { ...teamSet.lastSimulationSnapshot }
                : null,
        })),
    };
    localStorage.setItem(STORAGE_KEY_TEAM_SETS, JSON.stringify(payload));
}

export function loadTeamSetsFromStorage(
    box: PokemonBox,
): { teamSets: TeamSetState[]; activeTeamSetIndex: number } | null {
    const raw = localStorage.getItem(STORAGE_KEY_TEAM_SETS);
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as Partial<SerializedTeamSetPayload>;
        if (!Array.isArray(parsed.teamSets)) {
            return null;
        }
        const teamSets = parsed.teamSets
            .map((rawTeamSet, index): TeamSetState | null => {
                if (!rawTeamSet || typeof rawTeamSet !== 'object') {
                    return null;
                }
                const id = typeof rawTeamSet.id === 'string' && rawTeamSet.id.length > 0
                    ? rawTeamSet.id
                    : `team-set-${index + 1}`;
                const name = typeof rawTeamSet.name === 'string' && rawTeamSet.name.length > 0
                    ? rawTeamSet.name
                    : `Team ${index + 1}`;
                const swaps = Array.isArray(rawTeamSet.swaps)
                    ? rawTeamSet.swaps
                        .map(migratePokemonSwap)
                        .filter((swap): swap is PokemonSwap => swap !== null)
                    : [];
                const noCollectCells = Array.isArray(rawTeamSet.noCollectCells)
                    ? rawTeamSet.noCollectCells
                        .map(migrateNoCollectCell)
                        .filter((cell): cell is NoCollectCellSetting => cell !== null)
                    : [];
                const lastSimulationSnapshot = migrateTeamSetSimulationSnapshot(rawTeamSet.lastSimulationSnapshot);
                return {
                    id,
                    name,
                    team: deserializeSerializedTeam(rawTeamSet.team, box),
                    swaps,
                    noCollectCells,
                    lastSimulationSnapshot,
                };
            })
            .filter((teamSet): teamSet is TeamSetState => teamSet !== null);

        if (teamSets.length === 0) {
            return null;
        }

        const activeTeamSetIndex = clampActiveTeamSetIndex(parsed.activeTeamSetIndex ?? 0, teamSets);
        return { teamSets, activeTeamSetIndex };
    } catch {
        return null;
    }
}

/**
 * 時間帯設定をlocalStorageに保存
 */
export function saveTimeSlotsToStorage(slots: TimeSlot[]): void {
    localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(slots));
}

/**
 * 時間帯設定をlocalStorageから読み込み
 */
export function loadTimeSlotsFromStorage(): TimeSlot[] {
    const data = localStorage.getItem(STORAGE_KEY_SLOTS);
    if (!data) {
        return DEFAULT_TIME_SLOTS;
    }
    try {
        const slots = JSON.parse(data);
        if (!Array.isArray(slots)) {
            return DEFAULT_TIME_SLOTS;
        }
        // マイグレーション処理を適用
        return slots.map(slot => migrateTimeSlot(slot));
    } catch {
        return DEFAULT_TIME_SLOTS;
    }
}

/**
 * シミュレーション設定をlocalStorageに保存
 */
export function saveConfigToStorage(config: SimulationConfig): void {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
}

/**
 * シミュレーション設定をlocalStorageから読み込み
 */
export function loadConfigFromStorage(): SimulationConfig {
    const data = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!data) {
        return DEFAULT_SIMULATION_CONFIG;
    }
    try {
        const parsed = JSON.parse(data);
        if (
            typeof parsed.seed !== 'number' ||
            typeof parsed.initialEnergy !== 'number'
        ) {
            return DEFAULT_SIMULATION_CONFIG;
        }

        return {
            seed: parsed.seed,
            initialEnergy: parsed.initialEnergy,
            simulationDays: clampSimulationDays(
                typeof parsed.simulationDays === 'number'
                    ? parsed.simulationDays
                    : DEFAULT_SIMULATION_CONFIG.simulationDays
            ),
        };
    } catch {
        return DEFAULT_SIMULATION_CONFIG;
    }
}

/**
 * ボーナス設定を localStorage に保存
 */
export function saveBonusSettingsToStorage(settings: TimelineBonusSettings): void {
    localStorage.setItem(STORAGE_KEY_BONUS_SETTINGS, JSON.stringify(settings));
}

/**
 * ボーナス設定を localStorage から読み込み
 */
export function loadBonusSettingsFromStorage(): TimelineBonusSettings {
    const raw = localStorage.getItem(STORAGE_KEY_BONUS_SETTINGS);
    if (!raw) {
        return createDefaultTimelineBonusSettings();
    }
    try {
        const parsed = JSON.parse(raw) as Partial<TimelineBonusSettings>;
        return normalizeTimelineBonusSettings(parsed);
    } catch {
        return createDefaultTimelineBonusSettings();
    }
}

/**
 * 個体値計算機連動フラグを localStorage に保存
 */
export function saveSyncWithIvParameterToStorage(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEY_SYNC_IV_PARAMETER, enabled ? '1' : '0');
}

/**
 * 個体値計算機連動フラグを localStorage から読み込み
 */
export function loadSyncWithIvParameterFromStorage(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY_SYNC_IV_PARAMETER);
    if (raw === null) {
        return true;
    }
    return raw === '1';
}

/**
 * サマリー表示モードを localStorage に保存
 */
export function saveSummaryValueModeToStorage(mode: SummaryValueMode): void {
    localStorage.setItem(STORAGE_KEY_SUMMARY_VALUE_MODE, mode);
}

/**
 * サマリー表示モードを localStorage から読み込み
 */
export function loadSummaryValueModeFromStorage(): SummaryValueMode {
    const raw = localStorage.getItem(STORAGE_KEY_SUMMARY_VALUE_MODE);
    return raw === 'dailyAverage' ? 'dailyAverage' : 'periodTotal';
}

/**
 * あまり食材表示に追加食材使用分を含めるかを localStorage に保存
 */
export function saveLeftoverIncludeExtraUsageToStorage(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEY_LEFTOVER_INCLUDE_EXTRA_USAGE, enabled ? '1' : '0');
}

/**
 * あまり食材表示に追加食材使用分を含めるかを localStorage から読み込み
 */
export function loadLeftoverIncludeExtraUsageFromStorage(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY_LEFTOVER_INCLUDE_EXTRA_USAGE);
    if (raw === null) {
        return false;
    }
    return raw === '1';
}

/**
 * シード固定モードを localStorage に保存
 */
export function saveSeedModeToStorage(mode: 'random' | 'fixed'): void {
    localStorage.setItem(STORAGE_KEY_SEED_MODE, mode);
}

/**
 * シード固定モードを localStorage から読み込み
 */
export function loadSeedModeFromStorage(): 'random' | 'fixed' {
    const raw = localStorage.getItem(STORAGE_KEY_SEED_MODE);
    return raw === 'fixed' ? 'fixed' : 'random';
}

/**
 * 試行回数を localStorage に保存
 */
export function saveTrialCountToStorage(count: number): void {
    localStorage.setItem(STORAGE_KEY_TRIAL_COUNT, String(count));
}

/**
 * 試行回数を localStorage から読み込み
 */
export function loadTrialCountFromStorage(defaultCount: number = 1000): number {
    const raw = localStorage.getItem(STORAGE_KEY_TRIAL_COUNT);
    if (raw === null) {
        return defaultCount;
    }
    const parsed = Number.parseInt(raw, 10);
    const availableTrialCounts = TRIAL_COUNT_OPTIONS as readonly number[];
    if (!Number.isFinite(parsed) || !availableTrialCounts.includes(parsed)) {
        return defaultCount;
    }
    return parsed;
}

// PokemonBoxItemをエクスポート（型用に別ファイルで使えるように）
export { PokemonBoxItem };
