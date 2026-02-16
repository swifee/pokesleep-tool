import PokemonBox, { PokemonBoxItem } from '../../../util/PokemonBox';
import {
    TeamTimelineState,
    TeamTimelineAction,
    MAX_TEAM_SIZE,
    STORAGE_KEY,
    SerializedTeam,
} from './types/TeamTimelineTypes';
import {
    TimeSlot,
    SimulationConfig,
    PokemonSwap,
    DEFAULT_TIME_SLOTS,
    DEFAULT_SIMULATION_CONFIG,
    clampSimulationDays,
    STORAGE_KEY_SLOTS,
    STORAGE_KEY_CONFIG,
    migrateTimeSlot,
    SWAP_NONE_POKEMON_ID,
} from './types/TimeSlotTypes';
import { SummaryValueMode } from './utils/SummaryValueModeUtils';
import { TRIAL_COUNT_OPTIONS } from './types/MultiTrialTypes';
import { TimelineBonusSettings } from './types/TimelineBonusSettingsTypes';
import { buildExpandedTimeline } from './utils/TimelineDayExpansion';
import {
    createDefaultTimelineBonusSettings,
    normalizeTimelineBonusSettings,
} from './utils/TimelineBonusSettingsBridge';
import { createDefaultCookingSettings } from './types/CookingTypes';

export const STORAGE_KEY_BONUS_SETTINGS = 'PstTeamTimelineBonusSettings';
export const STORAGE_KEY_SYNC_IV_PARAMETER = 'PstTeamTimelineSyncIvParam';
export const STORAGE_KEY_SUMMARY_VALUE_MODE = 'PstTeamTimelineSummaryValueMode';
export const STORAGE_KEY_SEED_MODE = 'PstTeamTimelineSeedMode';
export const STORAGE_KEY_TRIAL_COUNT = 'PstTeamTimelineTrialCount';

function buildSwapEventsBySlot(
    swaps: readonly PokemonSwap[],
    teamSlotIndex: number
): Map<string, number[]> {
    const swapsBySlot = new Map<string, number[]>();

    const addEvent = (dayIndex: number, slotId: string, pokemonId: number) => {
        const key = `${dayIndex}:${slotId}`;
        const list = swapsBySlot.get(key) ?? [];
        list.push(pokemonId);
        swapsBySlot.set(key, list);
    };

    swaps.forEach((swap) => {
        if (swap.teamSlotIndex !== teamSlotIndex) {
            return;
        }
        addEvent(swap.dayIndex, swap.slotId, swap.newPokemonId);
    });

    swaps.forEach((swap) => {
        if (swap.teamSlotIndex !== teamSlotIndex) {
            return;
        }
        if (!swap.endSlotId || swap.endDayIndex === undefined || swap.revertPokemonId === undefined) {
            return;
        }
        addEvent(swap.endDayIndex, swap.endSlotId, swap.revertPokemonId);
    });

    return swapsBySlot;
}

function resolvePokemonIdBeforeSwap(params: {
    team: readonly (PokemonBoxItem | null)[];
    timeSlots: readonly TimeSlot[];
    simulationDays: number;
    swaps: readonly PokemonSwap[];
    teamSlotIndex: number;
    targetDayIndex: number;
    targetSlotId: string;
}): number {
    const {
        team,
        timeSlots,
        simulationDays,
        swaps,
        teamSlotIndex,
        targetDayIndex,
        targetSlotId,
    } = params;
    const originalPokemonId = team[teamSlotIndex]?.id ?? SWAP_NONE_POKEMON_ID;
    const expandedTimeline = buildExpandedTimeline([...timeSlots], simulationDays);
    const targetIndex = expandedTimeline.expandedSlots.findIndex(
        expandedSlot =>
            expandedSlot.dayIndex === targetDayIndex &&
            expandedSlot.originalSlotId === targetSlotId
    );
    if (targetIndex <= 0) {
        return originalPokemonId;
    }

    const swapsBySlot = buildSwapEventsBySlot(swaps, teamSlotIndex);
    let currentPokemonId = originalPokemonId;

    for (let i = 0; i < targetIndex; i++) {
        const expandedSlot = expandedTimeline.expandedSlots[i];
        const slotEvents = swapsBySlot.get(`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`);
        if (!slotEvents || slotEvents.length === 0) {
            continue;
        }
        currentPokemonId = slotEvents[slotEvents.length - 1];
    }

    return currentPokemonId;
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
    return {
        team: Array(MAX_TEAM_SIZE).fill(null),
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
            return {
                ...state,
                ...getResetSimulationFields(),
                team: newTeam,
                selectedSlotIndex: null,
                boxSelectDialogOpen: false,
            };
        }
        case 'removePokemon': {
            const newTeam = [...state.team];
            newTeam[action.index] = null;
            return {
                ...state,
                ...getResetSimulationFields(),
                team: newTeam,
            };
        }
        case 'loadTeam':
            return {
                ...state,
                team: action.team,
            };
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
            const swapsForResolution: PokemonSwap[] = [...swapsWithoutOldRepeats];

            const resolveRevertPokemonId = (dayIndex: number): number => resolvePokemonIdBeforeSwap({
                team: state.team,
                timeSlots: state.timeSlots,
                simulationDays: state.simulationConfig.simulationDays,
                swaps: swapsForResolution,
                teamSlotIndex,
                targetDayIndex: dayIndex,
                targetSlotId,
            });

            const newSwap: PokemonSwap = {
                dayIndex: targetDayIndex,
                slotId: targetSlotId,
                teamSlotIndex,
                newPokemonId: state.pendingSwapPokemonId,
                initialEnergy: action.initialEnergy,
                endSlotId: action.endSlotId,
                endDayIndex: action.endDayIndex,
                revertPokemonId: resolveRevertPokemonId(targetDayIndex),
            };
            const allNewSwaps: PokemonSwap[] = [newSwap];
            swapsForResolution.push(newSwap);

            if (action.repeat) {
                const simulationDays = state.simulationConfig.simulationDays;
                for (let d = targetDayIndex + 1; d < simulationDays; d++) {
                    const repeatedSwap: PokemonSwap = {
                        dayIndex: d,
                        slotId: targetSlotId,
                        teamSlotIndex,
                        newPokemonId: state.pendingSwapPokemonId,
                        initialEnergy: action.initialEnergy,
                        endSlotId: action.endSlotId,
                        endDayIndex: action.endDayIndex !== undefined
                            ? action.endDayIndex + (d - targetDayIndex)
                            : undefined,
                        isRepeatGenerated: true,
                        revertPokemonId: resolveRevertPokemonId(d),
                    };
                    allNewSwaps.push(repeatedSwap);
                    swapsForResolution.push(repeatedSwap);
                }
            }

            return {
                ...state,
                swaps: [...swapsWithoutOldRepeats, ...allNewSwaps],
                swapTargetSlotId: null,
                swapTargetTeamIndex: null,
                swapTargetDayIndex: null,
                swapDialogOpen: false,
                energyDialogOpen: false,
                pendingSwapPokemonId: null,
            };
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
            return {
                ...state,
                swaps: [...filteredSwaps, newSwap],
                swapTargetSlotId: null,
                swapTargetTeamIndex: null,
                swapTargetDayIndex: null,
                swapDialogOpen: false,
                energyDialogOpen: false,
                pendingSwapPokemonId: null,
            };
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
            return {
                ...state,
                swaps: newSwaps,
            };
        }
        case 'clearSwaps':
            return {
                ...state,
                swaps: [],
            };
        case 'loadSwaps':
            return {
                ...state,
                swaps: action.swaps,
            };
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
