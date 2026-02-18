import React, { useReducer, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { Tabs, Tab, Box, Typography, Slider, Fade, useMediaQuery, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PokemonBox, { PokemonBoxItem } from '../../../util/PokemonBox';
import {
    createInitialState,
    teamTimelineReducer,
    saveTeamToStorage,
    loadTeamFromStorage,
    saveTimeSlotsToStorage,
    loadTimeSlotsFromStorage,
    saveConfigToStorage,
    loadConfigFromStorage,
    saveBonusSettingsToStorage,
    loadBonusSettingsFromStorage,
    saveSyncWithIvParameterToStorage,
    loadSyncWithIvParameterFromStorage,
    saveSummaryValueModeToStorage,
    loadSummaryValueModeFromStorage,
    saveSeedModeToStorage,
    loadSeedModeFromStorage,
    saveTrialCountToStorage,
    loadTrialCountFromStorage,
} from './TeamTimelineState';
import TimelineHeader from './components/TimelineHeader';
import BoxSelectDialog from './components/BoxSelectDialog';
import TimeSlotEditor from './components/TimeSlotEditor';
import TimelineTable from './components/TimelineTable';
import DailySummaryRow from './components/DailySummaryRow';
import TeamSummaryRow from './components/TeamSummaryRow';
import SwapSupplementBar from './components/SwapSupplementBar';
import TrialResultSelector from './components/TrialResultSelector';
import { SwapEnergyDialog } from './components/SwapEnergyDialog';
import SwapRemoveConfirmDialog from './components/SwapRemoveConfirmDialog';
import {
    TimeSlot,
    SimulationConfig,
    PokemonSwap,
    SWAP_NONE_POKEMON_ID,
    SimulationResult,
} from './types/TimeSlotTypes';
import { runSimulation } from './simulation/TimelineSimulator';
import SimulationControls from './components/SimulationControls';
import {
    runMultiTrialSimulationWithProgress,
} from './simulation/MultiTrialSimulator';
import TimelineBonusSettingsPanel from './components/TimelineBonusSettingsPanel';
import CookingSettingsPanel from './components/CookingSettingsPanel';
import { TimelineBonusSettings } from './types/TimelineBonusSettingsTypes';
import { CookingSimulationSettings } from './types/CookingTypes';
import { saveCookingSettingsToStorage, loadCookingSettingsFromStorage } from './utils/CookingSettingsStorage';
import { SummaryValueMode } from './utils/SummaryValueModeUtils';
import SummaryValueModeToggle from './components/SummaryValueModeToggle';
import ResimulationNoticeBar from './components/ResimulationNoticeBar';
import AdditionalAnalysisPanel from './components/AdditionalAnalysisPanel';
import WipeReveal from './components/WipeReveal';
import {
    ContributionEpAnalysisResult,
    HelpingBonusContributionResult,
    EnergyRecoveryBonusContributionResult,
    EnergySkillContributionResult,
    EnergySkillTeamContributionResult,
    EnergySkillContributionTarget,
} from './types/AdditionalAnalysisTypes';
import {
    calculateDeltaPercent,
    buildEnergySkillContributionTargets,
    collectAppearingTimelineMembers,
    collectAverageHelpingBonusMemberCountByDuration,
    collectAverageEnergyRecoveryBonusMemberCountByDuration,
    collectTimelineDurationSummaryByPokemon,
    collectWakeErbMemberCountRange,
} from './utils/AdditionalAnalysisUtils';
import {
    AnalysisBaseMetricsCache,
    resolvePrecomputedBaseAverageMetrics,
} from './utils/AnalysisBaseMetricsUtils';
import {
    shouldShowAdditionalAnalysisPanel,
    shouldSkipTeamResultEntryAnimation,
} from './utils/TeamTimelineDisplayUtils';
import {
    hydrateSwapsWithSerializedPokemon,
    normalizeLoadedSwapsWithBox,
} from './utils/SwapPersistenceUtils';
import { isSwapReassignment } from './utils/SwapReassignmentUtils';
import { buildExpandedTimeline } from './utils/TimelineDayExpansion';
import {
    loadTimelineBonusSettingsFromIvStorage,
    saveTimelineBonusSettingsToIvStorage,
    IV_PARAMETER_STORAGE_KEY,
} from './utils/TimelineBonusSettingsBridge';

interface TeamNormalizationResult {
    normalizedTeam: (PokemonBoxItem | null)[];
    idRemap: Map<number, number>;
}

interface AnalysisAverageMetrics {
    averageTeamEP: number;
    averageTeamHelpCount: number;
    averageEPByPokemonId: Map<number, number>;
    averageHelpByPokemonId: Map<number, number>;
    trialCount: number;
}

interface PendingSwapRemoval {
    slotId: string;
    teamIndex: number;
    dayIndex: number;
    pokemonId: number;
    hasFutureRepeat: boolean;
}

const ANALYSIS_PROGRESS_UPDATE_INTERVAL_MS = 200;
const ABORT_ERROR_NAME = 'AbortError';
const TIMELINE_WIPE_REVEAL_DURATION_MS = 800;
const TIMELINE_WIPE_REVEAL_EASING_IN_QUAD = 'cubic-bezier(0.55, 0.085, 0.68, 0.53)';
const TIMELINE_WIPE_REVEAL_EASING_OUT_QUAD = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
const TIMELINE_DETAILS_FADE_DURATION_MS = 450;
const TIMELINE_PAGE_BOTTOM_PADDING = '3em';
const TIME_SLOT_SETTINGS_SECTION_ID = 'team-timeline-time-slot-settings';
const EMPTY_SIMULATION_RESULT: SimulationResult = {
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

function createAbortError(): Error {
    const error = new Error('Aborted');
    error.name = ABORT_ERROR_NAME;
    return error;
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === ABORT_ERROR_NAME;
}

function buildAverageMetricsFromSummaries(
    teamEP: number,
    dailySummaries: readonly { pokemonId: number; totalHelpCount: number; totalEP: number }[],
    trialCount: number
): AnalysisAverageMetrics {
    const averageEPByPokemonId = new Map<number, number>();
    const averageHelpByPokemonId = new Map<number, number>();
    let averageTeamHelpCount = 0;

    dailySummaries.forEach((summary) => {
        averageEPByPokemonId.set(summary.pokemonId, summary.totalEP);
        averageHelpByPokemonId.set(summary.pokemonId, summary.totalHelpCount);
        averageTeamHelpCount += summary.totalHelpCount;
    });

    return {
        averageTeamEP: teamEP,
        averageTeamHelpCount,
        averageEPByPokemonId,
        averageHelpByPokemonId,
        trialCount,
    };
}

function pickEveryTenthSeeds(sortedSeeds: readonly number[]): number[] {
    const picked = sortedSeeds.filter((_, index) => (index + 1) % 10 === 0);
    if (picked.length > 0) {
        return picked;
    }
    return [...sortedSeeds];
}

function migrateSwap(rawSwap: unknown): PokemonSwap | null {
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
    const endSlotId = typeof candidate.endSlotId === 'string'
        ? candidate.endSlotId
        : undefined;
    const endDayIndex = typeof candidate.endDayIndex === 'number'
        ? Math.max(0, Math.floor(candidate.endDayIndex))
        : undefined;
    const isRepeatGenerated = candidate.isRepeatGenerated === true
        ? true
        : undefined;
    const revertPokemonId = typeof candidate.revertPokemonId === 'number'
        ? candidate.revertPokemonId
        : undefined;
    const newPokemonSerialized = typeof candidate.newPokemonSerialized === 'string'
        ? candidate.newPokemonSerialized
        : undefined;
    const revertPokemonSerialized = typeof candidate.revertPokemonSerialized === 'string'
        ? candidate.revertPokemonSerialized
        : undefined;
    return {
        dayIndex,
        slotId: candidate.slotId,
        teamSlotIndex: candidate.teamSlotIndex,
        newPokemonId: candidate.newPokemonId,
        newPokemonSerialized,
        initialEnergy: candidate.initialEnergy,
        endSlotId,
        endDayIndex,
        isRepeatGenerated,
        revertPokemonId,
        revertPokemonSerialized,
    };
}

function normalizeTeamWithBoxItems(
    loadedTeam: (PokemonBoxItem | null)[],
    boxItems: readonly PokemonBoxItem[],
): TeamNormalizationResult {
    const bucket = new Map<string, PokemonBoxItem[]>();
    boxItems.forEach((item) => {
        const key = item.serialize();
        const list = bucket.get(key) ?? [];
        list.push(item);
        bucket.set(key, list);
    });

    const idRemap = new Map<number, number>();
    const normalizedTeam = loadedTeam.map((member) => {
        if (member === null) {
            return null;
        }
        const key = member.serialize();
        const candidates = bucket.get(key);
        if (!candidates || candidates.length === 0) {
            return member;
        }
        const matched = candidates.shift()!;
        idRemap.set(member.id, matched.id);
        return matched;
    });

    return { normalizedTeam, idRemap };
}

function createSwapSignature(swaps: readonly PokemonSwap[]): string {
    return swaps
        .map(
            swap => `${swap.dayIndex}:${swap.slotId}:${swap.teamSlotIndex}:${swap.newPokemonId}:${swap.initialEnergy}`
        )
        .join('|');
}

/**
 * チームタイムラインアプリのメインコンポーネント
 */
export default function TeamTimelineApp() {
    const { t } = useTranslation();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
    const teamScale = isDesktop ? 1.5 : 1;
    const [state, dispatch] = useReducer(teamTimelineReducer, undefined, createInitialState);

    // 初期ロード完了フラグ
    const [isInitialized, setIsInitialized] = useState(false);
    const [summaryValueMode, setSummaryValueMode] = useState<SummaryValueMode>('periodTotal');
    const [simulationProgress, setSimulationProgress] = useState(0);
    const [showResimulationNotice, setShowResimulationNotice] = useState(false);
    const [pendingSwapRemoval, setPendingSwapRemoval] = useState<PendingSwapRemoval | null>(null);
    const [removeFutureRepeatChecked, setRemoveFutureRepeatChecked] = useState(false);
    const [analysisQuickModeEnabled, setAnalysisQuickModeEnabled] = useState(true);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [baseAverageMetricsCache, setBaseAverageMetricsCache]
        = useState<AnalysisBaseMetricsCache<AnalysisAverageMetrics> | null>(null);
    const [contributionResults, setContributionResults] = useState<Map<number, ContributionEpAnalysisResult>>(new Map());
    const [energySkillResults, setEnergySkillResults] = useState<Map<number, EnergySkillContributionResult>>(new Map());
    const [energySkillTeamResult, setEnergySkillTeamResult] = useState<EnergySkillTeamContributionResult | null>(null);
    const [helpingBonusResult, setHelpingBonusResult] = useState<HelpingBonusContributionResult | null>(null);
    const [energyRecoveryBonusResult, setEnergyRecoveryBonusResult] = useState<EnergyRecoveryBonusContributionResult | null>(null);
    const [contributionLoadingIds, setContributionLoadingIds] = useState<Set<number>>(new Set());
    const [energySkillLoadingIds, setEnergySkillLoadingIds] = useState<Set<number>>(new Set());
    const [contributionBatchLoading, setContributionBatchLoading] = useState(false);
    const [energySkillBatchLoading, setEnergySkillBatchLoading] = useState(false);
    const [energySkillTeamLoading, setEnergySkillTeamLoading] = useState(false);
    const [helpingBonusLoading, setHelpingBonusLoading] = useState(false);
    const [energyRecoveryBonusLoading, setEnergyRecoveryBonusLoading] = useState(false);
    const [contributionProgressById, setContributionProgressById] = useState<Map<number, number>>(new Map());
    const [energySkillProgressById, setEnergySkillProgressById] = useState<Map<number, number>>(new Map());
    const [contributionBatchProgress, setContributionBatchProgress] = useState(0);
    const [energySkillBatchProgress, setEnergySkillBatchProgress] = useState(0);
    const [energySkillTeamProgress, setEnergySkillTeamProgress] = useState(0);
    const [helpingBonusProgress, setHelpingBonusProgress] = useState(0);
    const [energyRecoveryBonusProgress, setEnergyRecoveryBonusProgress] = useState(0);
    const simulationAbortControllerRef = useRef<AbortController | null>(null);
    const analysisRunVersionRef = useRef(0);
    const previousActiveTabRef = useRef(state.activeTab);

    const resetAdditionalAnalysisState = useCallback(() => {
        analysisRunVersionRef.current += 1;
        setAnalysisError(null);
        setBaseAverageMetricsCache(null);
        setContributionResults(new Map());
        setEnergySkillResults(new Map());
        setEnergySkillTeamResult(null);
        setHelpingBonusResult(null);
        setEnergyRecoveryBonusResult(null);
        setContributionLoadingIds(new Set());
        setEnergySkillLoadingIds(new Set());
        setContributionBatchLoading(false);
        setEnergySkillBatchLoading(false);
        setEnergySkillTeamLoading(false);
        setHelpingBonusLoading(false);
        setEnergyRecoveryBonusLoading(false);
        setContributionProgressById(new Map());
        setEnergySkillProgressById(new Map());
        setContributionBatchProgress(0);
        setEnergySkillBatchProgress(0);
        setEnergySkillTeamProgress(0);
        setHelpingBonusProgress(0);
        setEnergyRecoveryBonusProgress(0);
    }, []);

    const cancelRunningAnalysisIfAny = useCallback((): boolean => {
        const hasRunningAnalysis = (
            contributionLoadingIds.size > 0
            || energySkillLoadingIds.size > 0
            || contributionBatchLoading
            || energySkillBatchLoading
            || energySkillTeamLoading
            || helpingBonusLoading
            || energyRecoveryBonusLoading
        );
        if (!hasRunningAnalysis) {
            return false;
        }
        resetAdditionalAnalysisState();
        return true;
    }, [
        contributionLoadingIds,
        energySkillLoadingIds,
        contributionBatchLoading,
        energySkillBatchLoading,
        energySkillTeamLoading,
        helpingBonusLoading,
        energyRecoveryBonusLoading,
        resetAdditionalAnalysisState,
    ]);

    // ボックスのロード（初回のみ）
    const boxRef = useRef<PokemonBox | null>(null);
    if (boxRef.current === null) {
        boxRef.current = new PokemonBox();
        boxRef.current.load();
    }
    const box = boxRef.current;

    // 初回マウント時にデータをロード
    useEffect(() => {
        const loadedBox = boxRef.current;
        if (!loadedBox) {
            return;
        }

        // ロード処理
        const loadedTeam = loadTeamFromStorage(loadedBox);
        const { normalizedTeam, idRemap } = normalizeTeamWithBoxItems(loadedTeam, loadedBox.items);
        dispatch({ type: 'loadTeam', team: normalizedTeam });

        const savedSlots = loadTimeSlotsFromStorage();
        dispatch({ type: 'loadTimeSlots', slots: savedSlots });

        const savedConfig = loadConfigFromStorage();
        dispatch({ type: 'loadSimulationConfig', config: savedConfig });
        dispatch({ type: 'setSeedMode', mode: loadSeedModeFromStorage() });
        dispatch({ type: 'setMultiTrialCount', count: loadTrialCountFromStorage() });
        setSummaryValueMode(loadSummaryValueModeFromStorage());
        const savedBonusSettings = loadBonusSettingsFromStorage();
        dispatch({ type: 'loadBonusSettings', settings: savedBonusSettings });
        const syncWithIvParameter = loadSyncWithIvParameterFromStorage();
        dispatch({ type: 'loadSyncWithIvParameter', enabled: syncWithIvParameter });
        if (syncWithIvParameter) {
            dispatch({
                type: 'loadBonusSettings',
                settings: loadTimelineBonusSettingsFromIvStorage(),
            });
        }

        const cookingSettings = loadCookingSettingsFromStorage();
        dispatch({ type: 'loadCookingSettings', settings: cookingSettings });

        const savedSwaps = localStorage.getItem('PstTeamTimelineSwaps');
        if (savedSwaps) {
            try {
                const swaps: PokemonSwap[] = JSON.parse(savedSwaps);
                if (Array.isArray(swaps)) {
                    const migratedSwaps = swaps
                        .map(migrateSwap)
                        .filter((swap): swap is PokemonSwap => swap !== null);
                    const normalizedSwaps = normalizeLoadedSwapsWithBox(migratedSwaps, loadedBox, idRemap);
                    dispatch({ type: 'loadSwaps', swaps: normalizedSwaps });
                }
            } catch (e) {
                console.error('Failed to load swaps', e);
            }
        }

        // ロード完了をマーク
        setIsInitialized(true);
    }, []); // 依存配列を空に

    // チームが変更されたらlocalStorageに保存（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return; // 初期化前は保存しない
        saveTeamToStorage(state.team);
    }, [state.team, isInitialized]);

    // 時間帯設定の永続化（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return;
        saveTimeSlotsToStorage(state.timeSlots);
    }, [state.timeSlots, isInitialized]);

    // シミュレーション設定の永続化（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return;
        saveConfigToStorage(state.simulationConfig);
    }, [state.simulationConfig, isInitialized]);

    // ボーナス設定の永続化（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return;
        saveBonusSettingsToStorage(state.bonusSettings);
    }, [state.bonusSettings, isInitialized]);

    // 料理設定の永続化（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return;
        saveCookingSettingsToStorage(state.cookingSettings);
    }, [state.cookingSettings, isInitialized]);

    // 個体値計算機連動フラグの永続化（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return;
        saveSyncWithIvParameterToStorage(state.syncWithIvParameter);
    }, [state.syncWithIvParameter, isInitialized]);

    // ポケモン入れ替え情報の永続化（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return;
        const swapsToPersist = hydrateSwapsWithSerializedPokemon(state.swaps, boxRef.current ?? undefined);
        localStorage.setItem('PstTeamTimelineSwaps', JSON.stringify(swapsToPersist));
    }, [state.swaps, isInitialized]);

    const previousSwapSignatureRef = useRef<string | null>(null);
    useEffect(() => {
        const signature = createSwapSignature(state.swaps);
        if (!isInitialized) {
            previousSwapSignatureRef.current = signature;
            return;
        }

        const previousSignature = previousSwapSignatureRef.current;
        previousSwapSignatureRef.current = signature;
        if (previousSignature === null || previousSignature === signature) {
            return;
        }
        if (state.simulationResult === null) {
            return;
        }
        setShowResimulationNotice(true);
    }, [state.swaps, state.simulationResult, isInitialized]);

    useEffect(() => {
        if (state.simulationConfig.simulationDays < 2) {
            setSummaryValueMode('periodTotal');
        }
    }, [state.simulationConfig.simulationDays]);

    useEffect(() => {
        if (!isInitialized) return;
        saveSummaryValueModeToStorage(summaryValueMode);
    }, [summaryValueMode, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;
        saveSeedModeToStorage(state.seedMode);
    }, [state.seedMode, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;
        saveTrialCountToStorage(state.multiTrialCount);
    }, [state.multiTrialCount, isInitialized]);

    // 連動ON中は個体値計算機パラメーターの外部更新を取り込む
    useEffect(() => {
        if (!state.syncWithIvParameter) {
            return undefined;
        }
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== IV_PARAMETER_STORAGE_KEY) {
                return;
            }
            dispatch({
                type: 'setBonusSettings',
                settings: loadTimelineBonusSettingsFromIvStorage(),
            });
        };
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
        };
    }, [state.syncWithIvParameter]);

    useEffect(() => () => {
        simulationAbortControllerRef.current?.abort();
        analysisRunVersionRef.current += 1;
    }, []);

    useEffect(() => {
        previousActiveTabRef.current = state.activeTab;
    }, [state.activeTab]);

    // スロットクリック時のハンドラ
    const handleSlotClick = useCallback((index: number) => {
        dispatch({ type: 'openSlotDialog', index });
    }, []);

    // ポケモン削除時のハンドラ
    const handleRemoveClick = useCallback((index: number) => {
        dispatch({ type: 'removePokemon', index });
    }, []);

    // ダイアログを閉じる
    const handleDialogClose = useCallback(() => {
        dispatch({ type: 'closeSlotDialog' });
    }, []);

    // ポケモン選択時のハンドラ
    const { selectedSlotIndex } = state;
    const handlePokemonSelect = useCallback((item: PokemonBoxItem) => {
        if (selectedSlotIndex !== null) {
            dispatch({ type: 'selectPokemon', index: selectedSlotIndex, item });
        }
    }, [selectedSlotIndex]);

    const runSingleSimulationWithSeed = useCallback((seed: number) => {
        const result = runSimulation({
            team: state.team,
            timeSlots: state.timeSlots,
            config: {
                seed,
                initialEnergy: state.simulationConfig.initialEnergy,
                simulationDays: state.simulationConfig.simulationDays,
            },
            bonusSettings: state.bonusSettings,
            swaps: state.swaps,
            box: boxRef.current || undefined,
            cookingSettings: state.cookingSettings,
        });
        dispatch({ type: 'setSimulationResult', result });
        dispatch({ type: 'updateSimulationConfig', config: { seed } });
    }, [
        state.team,
        state.timeSlots,
        state.simulationConfig.initialEnergy,
        state.simulationConfig.simulationDays,
        state.bonusSettings,
        state.swaps,
        state.cookingSettings,
    ]);

    const runMultiTrialWithSeed = useCallback(async (
        initialSeed?: number,
        preferredSeed?: number,
        abortSignal?: AbortSignal
    ) => {
        let hasShownFirstTrialPreview = false;
        const multiResult = await runMultiTrialSimulationWithProgress({
            team: state.team,
            timeSlots: state.timeSlots,
            config: {
                initialEnergy: state.simulationConfig.initialEnergy,
                simulationDays: state.simulationConfig.simulationDays,
            },
            bonusSettings: state.bonusSettings,
            cookingSettings: state.cookingSettings,
            swaps: state.swaps,
            box: boxRef.current || undefined,
            trialCount: state.multiTrialCount,
            initialSeed,
            onProgress: (progress) => {
                setSimulationProgress(progress);
            },
            onTrialComplete: ({ index, trialCount, seed, result }) => {
                if (abortSignal?.aborted) {
                    return;
                }
                if (trialCount < 2 || index !== 0 || hasShownFirstTrialPreview) {
                    return;
                }
                hasShownFirstTrialPreview = true;
                dispatch({ type: 'setSimulationPreviewResult', result });
                dispatch({ type: 'updateSimulationConfig', config: { seed } });
            },
            shouldAbort: () => abortSignal?.aborted === true,
        });

        if (multiResult.trials.length === 0) {
            throw new Error('シミュレーション結果がありません');
        }

        let selectedIndex = multiResult.medianIndex;
        if (preferredSeed !== undefined) {
            const preferredIndex = multiResult.trials.findIndex(trial => trial.seed === preferredSeed);
            if (preferredIndex >= 0) {
                selectedIndex = preferredIndex;
            }
        }

        dispatch({
            type: 'setMultiTrialResults',
            results: [...multiResult.trials],
            medianIndex: selectedIndex,
            averageDailySummaries: multiResult.averageDailySummaries,
            averageTeamSummary: multiResult.averageTeamSummary,
            averageCookingSummary: multiResult.averageCookingSummary,
        });

        const selectedSeed = multiResult.trials[selectedIndex].seed;
        const fullResult = runSimulation({
            team: state.team,
            timeSlots: state.timeSlots,
            config: {
                seed: selectedSeed,
                initialEnergy: state.simulationConfig.initialEnergy,
                simulationDays: state.simulationConfig.simulationDays,
            },
            bonusSettings: state.bonusSettings,
            swaps: state.swaps,
            box: boxRef.current || undefined,
            cookingSettings: state.cookingSettings,
        });
        dispatch({ type: 'setSimulationResult', result: fullResult });
        dispatch({ type: 'updateSimulationConfig', config: { seed: selectedSeed } });
    }, [
        state.team,
        state.timeSlots,
        state.simulationConfig.initialEnergy,
        state.simulationConfig.simulationDays,
        state.bonusSettings,
        state.swaps,
        state.multiTrialCount,
        state.cookingSettings,
    ]);

    const executeSimulation = useCallback(async (options?: {
        forcedInitialSeed?: number;
        preferredSeed?: number;
        forceMultiTrial?: boolean;
        abortSignal?: AbortSignal;
    }) => {
        const validTeam = state.team.filter(p => p !== null);
        if (validTeam.length === 0) {
            throw new Error('チームにポケモンを追加してください');
        }

        const forceMultiTrial = options?.forceMultiTrial === true;
        if (!forceMultiTrial && state.seedMode === 'fixed' && state.multiTrialCount === 1) {
            if (options?.abortSignal?.aborted) {
                return;
            }
            setSimulationProgress(30);
            runSingleSimulationWithSeed(state.simulationConfig.seed);
            setSimulationProgress(100);
            return;
        }

        const initialSeed = options?.forcedInitialSeed ?? (
            forceMultiTrial || state.seedMode === 'fixed'
                ? state.simulationConfig.seed
                : undefined
        );
        await runMultiTrialWithSeed(initialSeed, options?.preferredSeed, options?.abortSignal);
        setSimulationProgress(100);
    }, [
        state.team,
        state.seedMode,
        state.multiTrialCount,
        state.simulationConfig.seed,
        runSingleSimulationWithSeed,
        runMultiTrialWithSeed,
    ]);

    // シミュレーション実行ハンドラー（統合）
    const handleRunSimulation = useCallback(() => {
        if (state.simulationLoading) {
            simulationAbortControllerRef.current?.abort();
            resetAdditionalAnalysisState();
            return;
        }

        setShowResimulationNotice(false);
        resetAdditionalAnalysisState();
        setSimulationProgress(0);
        dispatch({ type: 'startSimulation' });
        const abortController = new AbortController();
        simulationAbortControllerRef.current = abortController;

        // Use setTimeout to allow React to render loading state before heavy computation
        setTimeout(() => {
            void executeSimulation({ abortSignal: abortController.signal })
                .catch((e) => {
                    if (isAbortError(e)) {
                        return;
                    }
                    dispatch({ type: 'setSimulationError', error: String(e) });
                    setSimulationProgress(0);
                })
                .finally(() => {
                    if (simulationAbortControllerRef.current === abortController) {
                        simulationAbortControllerRef.current = null;
                    }
                });
        }, 0);
    }, [executeSimulation, resetAdditionalAnalysisState, state.simulationLoading]);

    // スライダー変更ハンドラー（結果切り替え）
    const handleSliderChange = useCallback((index: number) => {
        if (!state.multiTrialResults || index < 0 || index >= state.multiTrialResults.length) return;
        dispatch({ type: 'setMultiTrialSelectedIndex', index });

        const trial = state.multiTrialResults[index];
        try {
            const result = runSimulation({
                team: state.team,
                timeSlots: state.timeSlots,
                config: {
                    seed: trial.seed,
                    initialEnergy: state.simulationConfig.initialEnergy,
                    simulationDays: state.simulationConfig.simulationDays,
                },
                bonusSettings: state.bonusSettings,
                swaps: state.swaps,
                box: boxRef.current || undefined,
                cookingSettings: state.cookingSettings,
            });
            dispatch({ type: 'setSimulationResult', result });
            dispatch({ type: 'updateSimulationConfig', config: { seed: trial.seed } });
        } catch (e) {
            dispatch({ type: 'setSimulationError', error: String(e) });
        }
    }, [
        state.multiTrialResults,
        state.team,
        state.timeSlots,
        state.simulationConfig.initialEnergy,
        state.simulationConfig.simulationDays,
        state.bonusSettings,
        state.swaps,
        state.cookingSettings,
    ]);

    // シードモード変更ハンドラー
    const handleSeedModeChange = useCallback((mode: 'random' | 'fixed') => {
        dispatch({ type: 'setSeedMode', mode });
    }, []);

    // 試行回数変更ハンドラー
    const handleTrialCountChange = useCallback((count: number) => {
        dispatch({ type: 'setMultiTrialCount', count });
    }, []);

    // シード値変更ハンドラー
    const handleSeedChange = useCallback((seed: number) => {
        dispatch({ type: 'updateSimulationConfig', config: { seed } });
    }, []);

    const handleSimulationDaysChange = useCallback((simulationDays: number) => {
        dispatch({ type: 'updateSimulationConfig', config: { simulationDays } });
    }, []);
    const handleSummaryValueModeChange = useCallback((mode: SummaryValueMode) => {
        setSummaryValueMode(mode);
    }, []);

    // タブ切り替えハンドラー
    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: 'team' | 'settings' | 'cooking') => {
        dispatch({ type: 'selectTab', tab: newValue });
    }, []);

    const handleOpenTimeSlotSettings = useCallback(() => {
        dispatch({ type: 'selectTab', tab: 'settings' });
        window.setTimeout(() => {
            const timeSlotSection = document.getElementById(TIME_SLOT_SETTINGS_SECTION_ID);
            timeSlotSection?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        }, 0);
    }, []);

    // 時間帯操作ハンドラー
    const handleAddTimeSlot = useCallback((slot: TimeSlot) => {
        dispatch({ type: 'addTimeSlot', slot });
    }, []);

    const handleUpdateTimeSlot = useCallback((index: number, slot: TimeSlot) => {
        dispatch({ type: 'updateTimeSlot', index, slot });
    }, []);

    const handleRemoveTimeSlot = useCallback((index: number) => {
        dispatch({ type: 'removeTimeSlot', index });
    }, []);

    const handleResetTimeSlots = useCallback(() => {
        dispatch({ type: 'resetTimeSlots' });
    }, []);

    const handleConfigChange = useCallback((config: Partial<SimulationConfig>) => {
        dispatch({ type: 'updateSimulationConfig', config });
    }, []);

    const handleBonusSettingsChange = useCallback((settings: TimelineBonusSettings) => {
        dispatch({ type: 'setBonusSettings', settings });
        if (state.syncWithIvParameter) {
            saveTimelineBonusSettingsToIvStorage(settings);
        }
    }, [state.syncWithIvParameter]);

    const handleCookingSettingsChange = useCallback((settings: CookingSimulationSettings) => {
        dispatch({ type: 'setCookingSettings', settings });
    }, []);

    const handleSyncWithIvParameterChange = useCallback((enabled: boolean) => {
        dispatch({ type: 'setSyncWithIvParameter', enabled });
        if (enabled) {
            dispatch({
                type: 'setBonusSettings',
                settings: loadTimelineBonusSettingsFromIvStorage(),
            });
        }
    }, []);

    // ポケモン入れ替えハンドラー
    const handleSwapClick = useCallback((slotId: string, teamIndex: number, dayIndex: number) => {
        dispatch({ type: 'openSwapDialog', slotId, teamIndex, dayIndex });
    }, []);

    const handleSwapRemoveRequest = useCallback((slotId: string, teamIndex: number, dayIndex: number, pokemonId: number) => {
        const hasFutureRepeat = state.swaps.some(
            swap =>
                swap.slotId === slotId &&
                swap.teamSlotIndex === teamIndex &&
                swap.newPokemonId === pokemonId &&
                swap.dayIndex === dayIndex + 1
        );
        setPendingSwapRemoval({
            slotId,
            teamIndex,
            dayIndex,
            pokemonId,
            hasFutureRepeat,
        });
        setRemoveFutureRepeatChecked(hasFutureRepeat);
    }, [state.swaps]);

    const handleSwapRemoveCancel = useCallback(() => {
        setPendingSwapRemoval(null);
        setRemoveFutureRepeatChecked(false);
    }, []);

    const handleSwapRemoveConfirm = useCallback(() => {
        if (!pendingSwapRemoval) {
            return;
        }

        dispatch({
            type: 'removeSwap',
            slotId: pendingSwapRemoval.slotId,
            teamIndex: pendingSwapRemoval.teamIndex,
            dayIndex: pendingSwapRemoval.dayIndex,
            removeFutureRepeats: pendingSwapRemoval.hasFutureRepeat && removeFutureRepeatChecked,
            pokemonId: pendingSwapRemoval.pokemonId,
        });
        setPendingSwapRemoval(null);
        setRemoveFutureRepeatChecked(false);
    }, [pendingSwapRemoval, removeFutureRepeatChecked]);

    const handleSwapPokemonSelect = useCallback((item: PokemonBoxItem) => {
        dispatch({ type: 'setPendingSwap', pokemonId: item.id });
    }, []);

    const handleEnergyConfirm = useCallback((energy: number, endSlotId?: string, endDayIndex?: number, repeat?: boolean) => {
        dispatch({ type: 'confirmSwap', initialEnergy: energy, endSlotId, endDayIndex, repeat });
    }, []);

    const handleEnergyCancel = useCallback(() => {
        dispatch({ type: 'closeSwapDialog' });
    }, []);

    // 「なし」: ポケモンなしのswapを直接確定（エネルギーダイアログなし）
    const handleSwapSelectNone = useCallback(() => {
        dispatch({ type: 'confirmSwapDirect', pokemonId: SWAP_NONE_POKEMON_ID, initialEnergy: 0 });
    }, []);

    const handleClearSwaps = useCallback(() => {
        dispatch({ type: 'clearSwaps' });
    }, []);

    // ヘルパー関数: 入れ替え対象ポケモンの名前を取得
    const getPendingPokemonName = useCallback((): string => {
        if (!state.pendingSwapPokemonId || !boxRef.current) return '';
        const pokemon = boxRef.current.items.find(item => item.id === state.pendingSwapPokemonId);
        return pokemon?.filledNickname(t) || '';
    }, [state.pendingSwapPokemonId, t]);

    // ヘルパー関数: 入れ替え対象ポケモンのidFormを取得
    const getPendingPokemonIdForm = useCallback((): number | undefined => {
        if (!state.pendingSwapPokemonId || !boxRef.current) return undefined;
        const pokemon = boxRef.current.items.find((item: PokemonBoxItem) => item.id === state.pendingSwapPokemonId);
        if (!pokemon) return undefined;
        return pokemon.iv.idForm;
    }, [state.pendingSwapPokemonId]);

    // Compute available end time slot options for the "until" dropdown in SwapEnergyDialog
    const availableEndSlots = useMemo(() => {
        if (state.swapTargetSlotId === null || state.swapTargetDayIndex === null) {
            return [];
        }
        const targetSlotId = state.swapTargetSlotId.replace(/__day\d+$/, '');
        const targetDayIndex = state.swapTargetDayIndex;
        const expandedTimeline = buildExpandedTimeline(
            state.timeSlots,
            state.simulationConfig.simulationDays
        );
        const targetExpandedIndex = expandedTimeline.expandedSlots.findIndex(
            expandedSlot =>
                expandedSlot.dayIndex === targetDayIndex &&
                expandedSlot.originalSlotId === targetSlotId
        );
        if (targetExpandedIndex < 0) {
            return [];
        }
        return expandedTimeline.expandedSlots
            .slice(targetExpandedIndex + 1)
            .map(expandedSlot => ({
                slotId: expandedSlot.originalSlotId,
                dayIndex: expandedSlot.dayIndex,
                time: expandedSlot.slot.time,
            }));
    }, [state.swapTargetSlotId, state.swapTargetDayIndex, state.timeSlots, state.simulationConfig]);

    const disableSwapEnergySetting = useMemo(() => (
        isSwapReassignment({
            team: state.team,
            timeSlots: state.timeSlots,
            simulationDays: state.simulationConfig.simulationDays,
            swaps: state.swaps,
            pendingPokemonId: state.pendingSwapPokemonId,
            targetSlotId: state.swapTargetSlotId,
            targetDayIndex: state.swapTargetDayIndex,
        })
    ), [
        state.team,
        state.timeSlots,
        state.simulationConfig.simulationDays,
        state.swaps,
        state.pendingSwapPokemonId,
        state.swapTargetSlotId,
        state.swapTargetDayIndex,
    ]);

    const swappedPokemonIdForms = useMemo(() => {
        if (!boxRef.current) {
            return [];
        }
        const uniqueIdForms = new Set<number>();
        state.swaps.forEach((swap) => {
            if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
                return;
            }
            const pokemon = boxRef.current!.items.find((item) => item.id === swap.newPokemonId);
            if (!pokemon) {
                return;
            }
            uniqueIdForms.add(pokemon.iv.idForm);
        });
        return [...uniqueIdForms];
    }, [state.swaps]);
    const hasConfiguredSwap = state.swaps.length > 0;

    const appearingTimelineMembers = useMemo(() => {
        if (!boxRef.current) {
            return [];
        }
        return collectAppearingTimelineMembers(state.team, state.swaps, boxRef.current);
    }, [state.team, state.swaps]);

    const timelineDurationSummary = useMemo(
        () => collectTimelineDurationSummaryByPokemon(
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
            boxRef.current ?? undefined
        ),
        [
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
        ]
    );

    const baseSortedSeeds = useMemo(() => {
        if (state.multiTrialResults && state.multiTrialResults.length > 0) {
            return state.multiTrialResults.map(trial => trial.seed);
        }
        return [state.simulationConfig.seed];
    }, [state.multiTrialResults, state.simulationConfig.seed]);

    const analysisSeeds = useMemo(() => (
        analysisQuickModeEnabled
            ? pickEveryTenthSeeds(baseSortedSeeds)
            : [...baseSortedSeeds]
    ), [analysisQuickModeEnabled, baseSortedSeeds]);

    const memberDisplayNameById = useMemo(() => {
        const map = new Map<number, string>();
        appearingTimelineMembers.forEach((member) => {
            map.set(member.id, member.filledNickname(t));
        });
        return map;
    }, [appearingTimelineMembers, t]);

    const energySkillTargets = useMemo(
        () => buildEnergySkillContributionTargets(
            appearingTimelineMembers,
            {
                team: state.team,
                timeSlots: state.timeSlots,
                simulationDays: state.simulationConfig.simulationDays,
                swaps: state.swaps,
                box: boxRef.current ?? undefined,
            }
        ).map((target) => ({
            ...target,
            pokemonName: memberDisplayNameById.get(target.pokemonId) ?? target.pokemonName,
        })),
        [
            appearingTimelineMembers,
            memberDisplayNameById,
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
        ]
    );

    const hasHelpingBonusMember = useMemo(
        () => appearingTimelineMembers.some(member =>
            member.iv.activeSubSkills.some(subSkill => subSkill.name === 'Helping Bonus')
        ),
        [appearingTimelineMembers]
    );

    const hasEnergyRecoveryBonusMember = useMemo(
        () => appearingTimelineMembers.some(member =>
            member.iv.activeSubSkills.some(subSkill => subSkill.name === 'Energy Recovery Bonus')
        ),
        [appearingTimelineMembers]
    );

    const averageHelpingBonusMemberCount = useMemo(
        () => collectAverageHelpingBonusMemberCountByDuration(
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
            boxRef.current ?? undefined
        ),
        [
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
        ]
    );

    const averageEnergyRecoveryBonusMemberCount = useMemo(
        () => collectAverageEnergyRecoveryBonusMemberCountByDuration(
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
            boxRef.current ?? undefined
        ),
        [
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
        ]
    );

    const wakeErbMemberCountRange = useMemo(
        () => collectWakeErbMemberCountRange(
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
            boxRef.current ?? undefined
        ),
        [
            state.team,
            state.timeSlots,
            state.simulationConfig.simulationDays,
            state.swaps,
        ]
    );

    const baseAverageMetricsFromSimulation = useMemo<AnalysisAverageMetrics | null>(() => {
        if (!state.simulationResult) {
            return null;
        }
        if (
            state.multiTrialResults !== null
            && state.multiTrialResults.length > 0
            && state.multiTrialAverageDailySummaries !== null
            && state.multiTrialAverageTeamSummary !== null
        ) {
            return buildAverageMetricsFromSummaries(
                state.multiTrialAverageTeamSummary.grandTotalEP,
                state.multiTrialAverageDailySummaries,
                state.multiTrialResults.length
            );
        }
        return buildAverageMetricsFromSummaries(
            state.simulationResult.teamSummary.grandTotalEP,
            state.simulationResult.dailySummaries,
            1
        );
    }, [
        state.simulationResult,
        state.multiTrialResults,
        state.multiTrialAverageDailySummaries,
        state.multiTrialAverageTeamSummary,
    ]);

    const baseAverageMetrics = useMemo(
        () => resolvePrecomputedBaseAverageMetrics(
            baseAverageMetricsCache,
            analysisQuickModeEnabled,
            baseAverageMetricsFromSimulation
        ),
        [analysisQuickModeEnabled, baseAverageMetricsCache, baseAverageMetricsFromSimulation]
    );
    const hasResolvedBaseMetrics = baseAverageMetrics !== null;

    const runAverageMetricsWithSeeds = useCallback(async (options: {
        disabledPokemonIds?: readonly number[];
        suppressEnergyDeltaSkillPokemonIds?: readonly number[];
        disableEnergyRecoveryBonus?: boolean;
        disableHelpingBonus?: boolean;
    }, onProgress?: (progress: number) => void, shouldAbort?: () => boolean): Promise<AnalysisAverageMetrics> => {
        const totalEPByPokemonId = new Map<number, number>();
        const totalHelpByPokemonId = new Map<number, number>();
        let totalTeamEP = 0;
        let totalTeamHelpCount = 0;
        let lastProgressUpdateAt = 0;
        let lastEmittedProgress = 0;
        const throwIfAborted = (): void => {
            if (shouldAbort?.()) {
                throw createAbortError();
            }
        };

        const emitProgress = async (progress: number, force = false): Promise<void> => {
            throwIfAborted();
            if (!onProgress) {
                return;
            }
            const normalizedProgress = Math.max(lastEmittedProgress, Math.max(0, Math.min(100, progress)));
            const now = Date.now();
            if (!force && now - lastProgressUpdateAt < ANALYSIS_PROGRESS_UPDATE_INTERVAL_MS) {
                return;
            }
            onProgress(normalizedProgress);
            lastEmittedProgress = normalizedProgress;
            lastProgressUpdateAt = now;
            // Yield only when we actually update progress UI.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            throwIfAborted();
        };

        throwIfAborted();
        const trialCount = Math.max(analysisSeeds.length, 1);
        for (let index = 0; index < analysisSeeds.length; index += 1) {
            throwIfAborted();
            const seed = analysisSeeds[index];
            const result = runSimulation({
                team: state.team,
                timeSlots: state.timeSlots,
                config: {
                    seed,
                    initialEnergy: state.simulationConfig.initialEnergy,
                    simulationDays: state.simulationConfig.simulationDays,
                },
                bonusSettings: state.bonusSettings,
                swaps: state.swaps,
                box: boxRef.current || undefined,
                cookingSettings: state.cookingSettings,
                analysisOptions: {
                    disabledPokemonIds: options.disabledPokemonIds,
                    keepDisabledPokemonTargetable: true,
                    suppressEnergyDeltaSkillPokemonIds: options.suppressEnergyDeltaSkillPokemonIds,
                    disableEnergyRecoveryBonus: options.disableEnergyRecoveryBonus,
                    disableHelpingBonus: options.disableHelpingBonus,
                },
            });

            totalTeamEP += result.teamSummary.grandTotalEP;
            let trialTeamHelpCount = 0;
            result.dailySummaries.forEach((summary) => {
                totalEPByPokemonId.set(
                    summary.pokemonId,
                    (totalEPByPokemonId.get(summary.pokemonId) ?? 0) + summary.totalEP
                );
                trialTeamHelpCount += summary.totalHelpCount;
                totalHelpByPokemonId.set(
                    summary.pokemonId,
                    (totalHelpByPokemonId.get(summary.pokemonId) ?? 0) + summary.totalHelpCount
                );
            });
            totalTeamHelpCount += trialTeamHelpCount;
            await emitProgress(((index + 1) / trialCount) * 100, index + 1 === analysisSeeds.length);
        }

        throwIfAborted();
        if (analysisSeeds.length === 0) {
            await emitProgress(100, true);
        }

        const divisor = trialCount;
        const averageEPByPokemonId = new Map<number, number>();
        totalEPByPokemonId.forEach((total, pokemonId) => {
            averageEPByPokemonId.set(pokemonId, total / divisor);
        });
        const averageHelpByPokemonId = new Map<number, number>();
        totalHelpByPokemonId.forEach((total, pokemonId) => {
            averageHelpByPokemonId.set(pokemonId, total / divisor);
        });
        throwIfAborted();

        return {
            averageTeamEP: totalTeamEP / divisor,
            averageTeamHelpCount: totalTeamHelpCount / divisor,
            averageEPByPokemonId,
            averageHelpByPokemonId,
            trialCount: divisor,
        };
    }, [
        analysisSeeds,
        state.team,
        state.timeSlots,
        state.simulationConfig.initialEnergy,
        state.simulationConfig.simulationDays,
        state.bonusSettings,
        state.swaps,
    ]);

    const resolveBaseAverageMetrics = useCallback(async (
        onProgress?: (progress: number) => void,
        shouldAbort?: () => boolean
    ): Promise<AnalysisAverageMetrics> => {
        if (shouldAbort?.()) {
            throw createAbortError();
        }
        if (baseAverageMetrics) {
            onProgress?.(100);
            return baseAverageMetrics;
        }
        const computed = await runAverageMetricsWithSeeds({}, onProgress, shouldAbort);
        if (shouldAbort?.()) {
            throw createAbortError();
        }
        setBaseAverageMetricsCache({
            quickModeEnabled: analysisQuickModeEnabled,
            metrics: computed,
        });
        return computed;
    }, [analysisQuickModeEnabled, baseAverageMetrics, runAverageMetricsWithSeeds]);

    const runContributionAnalysis = useCallback((pokemon: PokemonBoxItem) => {
        if (!state.simulationResult) {
            return;
        }
        if (cancelRunningAnalysisIfAny()) {
            return;
        }
        const runVersion = analysisRunVersionRef.current;
        const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
        setAnalysisError(null);
        setContributionLoadingIds((prev) => {
            const next = new Set(prev);
            next.add(pokemon.id);
            return next;
        });
        setContributionProgressById((prev) => {
            const next = new Map(prev);
            next.set(pokemon.id, 0);
            return next;
        });
        setTimeout(() => {
            void (async () => {
                const seedUnitCount = Math.max(analysisSeeds.length, 1);
                const hasBaseMetrics = hasResolvedBaseMetrics;
                const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
                let processedUnits = 0;
                const updateContributionProgress = (nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setContributionProgressById((prev) => {
                        const current = prev.get(pokemon.id) ?? 0;
                        if (clamped <= current) {
                            return prev;
                        }
                        const next = new Map(prev);
                        next.set(pokemon.id, clamped);
                        return next;
                    });
                };
                try {
                    const baseMetrics = await resolveBaseAverageMetrics(
                        hasBaseMetrics
                            ? undefined
                            : (baseProgress) => {
                                if (shouldAbort()) {
                                    return;
                                }
                                updateContributionProgress(((baseProgress / 100) * seedUnitCount / totalUnits) * 100);
                            },
                        shouldAbort
                    );
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    if (!hasBaseMetrics) {
                        processedUnits += seedUnitCount;
                    }
                    const scenarioMetrics = await runAverageMetricsWithSeeds({
                        disabledPokemonIds: [pokemon.id],
                    }, (scenarioProgress) => {
                        if (shouldAbort()) {
                            return;
                        }
                        const progress =
                            ((processedUnits + ((scenarioProgress / 100) * seedUnitCount)) / totalUnits) * 100;
                        updateContributionProgress(progress);
                    }, shouldAbort);
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    const analysisResult: ContributionEpAnalysisResult = {
                        pokemonId: pokemon.id,
                        pokemonName: pokemon.filledNickname(t),
                        baseTeamEP: baseMetrics.averageTeamEP,
                        scenarioTeamEP: scenarioMetrics.averageTeamEP,
                        deltaEP: scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
                        deltaPercent: calculateDeltaPercent(baseMetrics.averageTeamEP, scenarioMetrics.averageTeamEP),
                    };
                    setContributionResults((prev) => {
                        const next = new Map(prev);
                        next.set(pokemon.id, analysisResult);
                        return next;
                    });
                } catch (e) {
                    if (!isAbortError(e)) {
                        setAnalysisError(String(e));
                    }
                } finally {
                    if (!shouldAbort()) {
                        setContributionLoadingIds((prev) => {
                            const next = new Set(prev);
                            next.delete(pokemon.id);
                            return next;
                        });
                        setContributionProgressById((prev) => {
                            const next = new Map(prev);
                            next.set(pokemon.id, 100);
                            return next;
                        });
                    }
                }
            })();
        }, 0);
    }, [
        cancelRunningAnalysisIfAny,
        analysisSeeds.length,
        hasResolvedBaseMetrics,
        resolveBaseAverageMetrics,
        runAverageMetricsWithSeeds,
        state.simulationResult,
        t,
    ]);

    const runContributionAnalysisAll = useCallback(() => {
        if (!state.simulationResult || appearingTimelineMembers.length === 0) {
            return;
        }
        if (cancelRunningAnalysisIfAny()) {
            return;
        }
        const runVersion = analysisRunVersionRef.current;
        const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
        setAnalysisError(null);
        setContributionBatchLoading(true);
        setContributionBatchProgress(0);
        setContributionProgressById(new Map());
        setTimeout(() => {
            void (async () => {
                const seedUnitCount = Math.max(analysisSeeds.length, 1);
                const hasBaseMetrics = hasResolvedBaseMetrics;
                const totalUnits = seedUnitCount * (appearingTimelineMembers.length + (hasBaseMetrics ? 0 : 1));
                let processedUnits = 0;
                const updateBatchProgress = (nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setContributionBatchProgress(prev => Math.max(prev, clamped));
                };
                const updateMemberProgress = (pokemonId: number, nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setContributionProgressById((prev) => {
                        const current = prev.get(pokemonId) ?? 0;
                        if (clamped <= current) {
                            return prev;
                        }
                        const next = new Map(prev);
                        next.set(pokemonId, clamped);
                        return next;
                    });
                };
                try {
                    const baseMetrics = await resolveBaseAverageMetrics(
                        hasBaseMetrics
                            ? undefined
                            : (baseProgress) => {
                                if (shouldAbort()) {
                                    return;
                                }
                                const progress = ((baseProgress / 100) * seedUnitCount / totalUnits) * 100;
                                updateBatchProgress(progress);
                            },
                        shouldAbort
                    );
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    if (!hasBaseMetrics) {
                        processedUnits += seedUnitCount;
                    }
                    for (let index = 0; index < appearingTimelineMembers.length; index += 1) {
                        if (shouldAbort()) {
                            throw createAbortError();
                        }
                        const pokemon = appearingTimelineMembers[index];
                        updateMemberProgress(pokemon.id, 1);
                        const scenarioMetrics = await runAverageMetricsWithSeeds({
                            disabledPokemonIds: [pokemon.id],
                        }, (scenarioProgress) => {
                            if (shouldAbort()) {
                                return;
                            }
                            const progress =
                                ((processedUnits + ((scenarioProgress / 100) * seedUnitCount)) / totalUnits) * 100;
                            updateBatchProgress(progress);
                            updateMemberProgress(pokemon.id, Math.max(1, scenarioProgress));
                        }, shouldAbort);
                        if (shouldAbort()) {
                            throw createAbortError();
                        }
                        const nextResult: ContributionEpAnalysisResult = {
                            pokemonId: pokemon.id,
                            pokemonName: pokemon.filledNickname(t),
                            baseTeamEP: baseMetrics.averageTeamEP,
                            scenarioTeamEP: scenarioMetrics.averageTeamEP,
                            deltaEP: scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
                            deltaPercent: calculateDeltaPercent(baseMetrics.averageTeamEP, scenarioMetrics.averageTeamEP),
                        };
                        setContributionResults((prev) => {
                            const next = new Map(prev);
                            next.set(pokemon.id, nextResult);
                            return next;
                        });
                        updateMemberProgress(pokemon.id, 100);
                        processedUnits += seedUnitCount;
                    }
                } catch (e) {
                    if (!isAbortError(e)) {
                        setAnalysisError(String(e));
                    }
                } finally {
                    if (!shouldAbort()) {
                        setContributionBatchLoading(false);
                        setContributionBatchProgress(0);
                    }
                }
            })();
        }, 0);
    }, [
        cancelRunningAnalysisIfAny,
        analysisSeeds.length,
        hasResolvedBaseMetrics,
        appearingTimelineMembers,
        resolveBaseAverageMetrics,
        runAverageMetricsWithSeeds,
        state.simulationResult,
        t,
    ]);

    const runEnergySkillAnalysis = useCallback((target: EnergySkillContributionTarget) => {
        if (!state.simulationResult) {
            return;
        }
        if (cancelRunningAnalysisIfAny()) {
            return;
        }
        const runVersion = analysisRunVersionRef.current;
        const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
        setAnalysisError(null);
        setEnergySkillLoadingIds((prev) => {
            const next = new Set(prev);
            next.add(target.pokemonId);
            return next;
        });
        setEnergySkillProgressById((prev) => {
            const next = new Map(prev);
            next.set(target.pokemonId, 0);
            return next;
        });
        setTimeout(() => {
            void (async () => {
                const seedUnitCount = Math.max(analysisSeeds.length, 1);
                const hasBaseMetrics = hasResolvedBaseMetrics;
                const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
                let processedUnits = 0;
                const updateEnergySkillProgress = (nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setEnergySkillProgressById((prev) => {
                        const current = prev.get(target.pokemonId) ?? 0;
                        if (clamped <= current) {
                            return prev;
                        }
                        const next = new Map(prev);
                        next.set(target.pokemonId, clamped);
                        return next;
                    });
                };
                try {
                    const baseMetrics = await resolveBaseAverageMetrics(
                        hasBaseMetrics
                            ? undefined
                            : (baseProgress) => {
                                if (shouldAbort()) {
                                    return;
                                }
                                updateEnergySkillProgress(((baseProgress / 100) * seedUnitCount / totalUnits) * 100);
                            },
                        shouldAbort
                    );
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    if (!hasBaseMetrics) {
                        processedUnits += seedUnitCount;
                    }
                    const scenarioMetrics = await runAverageMetricsWithSeeds({
                        suppressEnergyDeltaSkillPokemonIds: [target.pokemonId],
                    }, (scenarioProgress) => {
                        if (shouldAbort()) {
                            return;
                        }
                        const progress =
                            ((processedUnits + ((scenarioProgress / 100) * seedUnitCount)) / totalUnits) * 100;
                        updateEnergySkillProgress(progress);
                    }, shouldAbort);
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    const baseSelfEP = baseMetrics.averageEPByPokemonId.get(target.pokemonId) ?? 0;
                    const scenarioSelfEP = scenarioMetrics.averageEPByPokemonId.get(target.pokemonId) ?? 0;
                    const baseSelfHelpCount = baseMetrics.averageHelpByPokemonId.get(target.pokemonId) ?? 0;
                    const scenarioSelfHelpCount = scenarioMetrics.averageHelpByPokemonId.get(target.pokemonId) ?? 0;
                    const analysisResult: EnergySkillContributionResult = {
                        pokemonId: target.pokemonId,
                        pokemonName: target.pokemonName,
                        skillName: target.skillName,
                        category: target.category,
                        baseSelfEP,
                        scenarioSelfEP,
                        selfDeltaEP: scenarioSelfEP - baseSelfEP,
                        selfDeltaPercent: calculateDeltaPercent(baseSelfEP, scenarioSelfEP),
                        baseTeamEP: baseMetrics.averageTeamEP,
                        scenarioTeamEP: scenarioMetrics.averageTeamEP,
                        teamDeltaEP: scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
                        teamDeltaPercent: calculateDeltaPercent(
                            baseMetrics.averageTeamEP,
                            scenarioMetrics.averageTeamEP
                        ),
                        baseSelfHelpCount,
                        scenarioSelfHelpCount,
                        baseTeamHelpCount: baseMetrics.averageTeamHelpCount,
                        scenarioTeamHelpCount: scenarioMetrics.averageTeamHelpCount,
                    };
                    setEnergySkillResults((prev) => {
                        const next = new Map(prev);
                        next.set(target.pokemonId, analysisResult);
                        return next;
                    });
                } catch (e) {
                    if (!isAbortError(e)) {
                        setAnalysisError(String(e));
                    }
                } finally {
                    if (!shouldAbort()) {
                        setEnergySkillLoadingIds((prev) => {
                            const next = new Set(prev);
                            next.delete(target.pokemonId);
                            return next;
                        });
                        setEnergySkillProgressById((prev) => {
                            const next = new Map(prev);
                            next.set(target.pokemonId, 100);
                            return next;
                        });
                    }
                }
            })();
        }, 0);
    }, [
        cancelRunningAnalysisIfAny,
        analysisSeeds.length,
        hasResolvedBaseMetrics,
        resolveBaseAverageMetrics,
        runAverageMetricsWithSeeds,
        state.simulationResult,
    ]);

    const runEnergySkillAnalysisAll = useCallback(() => {
        if (!state.simulationResult || energySkillTargets.length === 0) {
            return;
        }
        if (cancelRunningAnalysisIfAny()) {
            return;
        }
        const runVersion = analysisRunVersionRef.current;
        const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
        setAnalysisError(null);
        setEnergySkillBatchLoading(true);
        setEnergySkillBatchProgress(0);
        setEnergySkillProgressById(new Map());
        const shouldRunTeamOverall = energySkillTargets.length >= 2;
        if (shouldRunTeamOverall) {
            setEnergySkillTeamResult(null);
            setEnergySkillTeamLoading(true);
            setEnergySkillTeamProgress(0);
        }
        setTimeout(() => {
            void (async () => {
                const seedUnitCount = Math.max(analysisSeeds.length, 1);
                const hasBaseMetrics = hasResolvedBaseMetrics;
                const scenarioUnitCount = energySkillTargets.length + (shouldRunTeamOverall ? 1 : 0);
                const totalUnits = seedUnitCount * (scenarioUnitCount + (hasBaseMetrics ? 0 : 1));
                let processedUnits = 0;
                const updateBatchProgress = (nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setEnergySkillBatchProgress(prev => Math.max(prev, clamped));
                };
                const updateTeamProgress = (nextProgress: number): void => {
                    if (!shouldRunTeamOverall) {
                        return;
                    }
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setEnergySkillTeamProgress(prev => Math.max(prev, clamped));
                };
                const updateMemberProgress = (pokemonId: number, nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setEnergySkillProgressById((prev) => {
                        const current = prev.get(pokemonId) ?? 0;
                        if (clamped <= current) {
                            return prev;
                        }
                        const next = new Map(prev);
                        next.set(pokemonId, clamped);
                        return next;
                    });
                };
                try {
                    const baseMetrics = await resolveBaseAverageMetrics(
                        hasBaseMetrics
                            ? undefined
                            : (baseProgress) => {
                                if (shouldAbort()) {
                                    return;
                                }
                                const progress = ((baseProgress / 100) * seedUnitCount / totalUnits) * 100;
                                updateBatchProgress(progress);
                            },
                        shouldAbort
                    );
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    if (!hasBaseMetrics) {
                        processedUnits += seedUnitCount;
                    }
                    for (let index = 0; index < energySkillTargets.length; index += 1) {
                        if (shouldAbort()) {
                            throw createAbortError();
                        }
                        const target = energySkillTargets[index];
                        updateMemberProgress(target.pokemonId, 1);
                        const scenarioMetrics = await runAverageMetricsWithSeeds({
                            suppressEnergyDeltaSkillPokemonIds: [target.pokemonId],
                        }, (scenarioProgress) => {
                            if (shouldAbort()) {
                                return;
                            }
                            const progress =
                                ((processedUnits + ((scenarioProgress / 100) * seedUnitCount)) / totalUnits) * 100;
                            updateBatchProgress(progress);
                            updateMemberProgress(target.pokemonId, Math.max(1, scenarioProgress));
                        }, shouldAbort);
                        if (shouldAbort()) {
                            throw createAbortError();
                        }
                        const baseSelfEP = baseMetrics.averageEPByPokemonId.get(target.pokemonId) ?? 0;
                        const scenarioSelfEP = scenarioMetrics.averageEPByPokemonId.get(target.pokemonId) ?? 0;
                        const baseSelfHelpCount = baseMetrics.averageHelpByPokemonId.get(target.pokemonId) ?? 0;
                        const scenarioSelfHelpCount = scenarioMetrics.averageHelpByPokemonId.get(target.pokemonId) ?? 0;
                        const nextResult: EnergySkillContributionResult = {
                            pokemonId: target.pokemonId,
                            pokemonName: target.pokemonName,
                            skillName: target.skillName,
                            category: target.category,
                            baseSelfEP,
                            scenarioSelfEP,
                            selfDeltaEP: scenarioSelfEP - baseSelfEP,
                            selfDeltaPercent: calculateDeltaPercent(baseSelfEP, scenarioSelfEP),
                            baseTeamEP: baseMetrics.averageTeamEP,
                            scenarioTeamEP: scenarioMetrics.averageTeamEP,
                            teamDeltaEP: scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
                            teamDeltaPercent: calculateDeltaPercent(
                                baseMetrics.averageTeamEP,
                                scenarioMetrics.averageTeamEP
                            ),
                            baseSelfHelpCount,
                            scenarioSelfHelpCount,
                            baseTeamHelpCount: baseMetrics.averageTeamHelpCount,
                            scenarioTeamHelpCount: scenarioMetrics.averageTeamHelpCount,
                        };
                        setEnergySkillResults((prev) => {
                            const next = new Map(prev);
                            next.set(target.pokemonId, nextResult);
                            return next;
                        });
                        updateMemberProgress(target.pokemonId, 100);
                        processedUnits += seedUnitCount;
                    }
                    if (shouldRunTeamOverall) {
                        const allEnergySkillIds = energySkillTargets.map(target => target.pokemonId);
                        const scenarioMetrics = await runAverageMetricsWithSeeds({
                            suppressEnergyDeltaSkillPokemonIds: allEnergySkillIds,
                        }, (scenarioProgress) => {
                            if (shouldAbort()) {
                                return;
                            }
                            const progress =
                                ((processedUnits + ((scenarioProgress / 100) * seedUnitCount)) / totalUnits) * 100;
                            updateBatchProgress(progress);
                            updateTeamProgress(scenarioProgress);
                        }, shouldAbort);
                        if (shouldAbort()) {
                            throw createAbortError();
                        }
                        setEnergySkillTeamResult({
                            baseTeamEP: baseMetrics.averageTeamEP,
                            scenarioTeamEP: scenarioMetrics.averageTeamEP,
                            teamDeltaEP: scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
                            teamDeltaPercent: calculateDeltaPercent(
                                baseMetrics.averageTeamEP,
                                scenarioMetrics.averageTeamEP
                            ),
                        });
                        updateTeamProgress(100);
                        processedUnits += seedUnitCount;
                    }
                } catch (e) {
                    if (!isAbortError(e)) {
                        setAnalysisError(String(e));
                    }
                } finally {
                    if (!shouldAbort()) {
                        setEnergySkillBatchLoading(false);
                        setEnergySkillBatchProgress(0);
                        if (shouldRunTeamOverall) {
                            setEnergySkillTeamLoading(false);
                            setEnergySkillTeamProgress(0);
                        }
                    }
                }
            })();
        }, 0);
    }, [
        cancelRunningAnalysisIfAny,
        analysisSeeds.length,
        hasResolvedBaseMetrics,
        energySkillTargets,
        resolveBaseAverageMetrics,
        runAverageMetricsWithSeeds,
        state.simulationResult,
    ]);

    const runEnergySkillTeamAnalysis = useCallback(() => {
        if (!state.simulationResult || energySkillTargets.length < 2) {
            return;
        }
        if (cancelRunningAnalysisIfAny()) {
            return;
        }
        const runVersion = analysisRunVersionRef.current;
        const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
        setAnalysisError(null);
        setEnergySkillTeamLoading(true);
        setEnergySkillTeamProgress(0);
        setTimeout(() => {
            void (async () => {
                const seedUnitCount = Math.max(analysisSeeds.length, 1);
                const hasBaseMetrics = hasResolvedBaseMetrics;
                const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
                let processedUnits = 0;
                const updateTeamProgress = (nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setEnergySkillTeamProgress(prev => Math.max(prev, clamped));
                };
                try {
                    const baseMetrics = await resolveBaseAverageMetrics(
                        hasBaseMetrics
                            ? undefined
                            : (baseProgress) => {
                                if (shouldAbort()) {
                                    return;
                                }
                                updateTeamProgress(
                                    ((baseProgress / 100) * seedUnitCount / totalUnits) * 100
                                );
                            },
                        shouldAbort
                    );
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    if (!hasBaseMetrics) {
                        processedUnits += seedUnitCount;
                    }
                    const scenarioMetrics = await runAverageMetricsWithSeeds({
                        suppressEnergyDeltaSkillPokemonIds: energySkillTargets.map(target => target.pokemonId),
                    }, (scenarioProgress) => {
                        if (shouldAbort()) {
                            return;
                        }
                        const progress =
                            ((processedUnits + ((scenarioProgress / 100) * seedUnitCount)) / totalUnits) * 100;
                        updateTeamProgress(progress);
                    }, shouldAbort);
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    setEnergySkillTeamResult({
                        baseTeamEP: baseMetrics.averageTeamEP,
                        scenarioTeamEP: scenarioMetrics.averageTeamEP,
                        teamDeltaEP: scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
                        teamDeltaPercent: calculateDeltaPercent(
                            baseMetrics.averageTeamEP,
                            scenarioMetrics.averageTeamEP
                        ),
                    });
                } catch (e) {
                    if (!isAbortError(e)) {
                        setAnalysisError(String(e));
                    }
                } finally {
                    if (!shouldAbort()) {
                        setEnergySkillTeamLoading(false);
                        setEnergySkillTeamProgress(0);
                    }
                }
            })();
        }, 0);
    }, [
        cancelRunningAnalysisIfAny,
        analysisSeeds.length,
        hasResolvedBaseMetrics,
        energySkillTargets,
        resolveBaseAverageMetrics,
        runAverageMetricsWithSeeds,
        state.simulationResult,
    ]);

    const runHelpingBonusAnalysis = useCallback(() => {
        if (!state.simulationResult || !hasHelpingBonusMember) {
            return;
        }
        if (cancelRunningAnalysisIfAny()) {
            return;
        }
        const runVersion = analysisRunVersionRef.current;
        const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
        setAnalysisError(null);
        setHelpingBonusLoading(true);
        setHelpingBonusProgress(0);
        setTimeout(() => {
            void (async () => {
                const seedUnitCount = Math.max(analysisSeeds.length, 1);
                const hasBaseMetrics = hasResolvedBaseMetrics;
                const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
                let processedUnits = 0;
                const updateHelpingBonusProgress = (nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setHelpingBonusProgress(prev => Math.max(prev, clamped));
                };
                try {
                    const baseMetrics = await resolveBaseAverageMetrics(
                        hasBaseMetrics
                            ? undefined
                            : (baseProgress) => {
                                if (shouldAbort()) {
                                    return;
                                }
                                updateHelpingBonusProgress(
                                    ((baseProgress / 100) * seedUnitCount / totalUnits) * 100
                                );
                            },
                        shouldAbort
                    );
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    if (!hasBaseMetrics) {
                        processedUnits += seedUnitCount;
                    }
                    const scenarioMetrics = await runAverageMetricsWithSeeds({
                        disableHelpingBonus: true,
                    }, (scenarioProgress) => {
                        if (shouldAbort()) {
                            return;
                        }
                        const progress =
                            ((processedUnits + ((scenarioProgress / 100) * seedUnitCount)) / totalUnits) * 100;
                        updateHelpingBonusProgress(progress);
                    }, shouldAbort);
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    setHelpingBonusResult({
                        baseTeamEP: baseMetrics.averageTeamEP,
                        scenarioTeamEP: scenarioMetrics.averageTeamEP,
                        teamDeltaEP: scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
                        teamDeltaPercent: calculateDeltaPercent(
                            baseMetrics.averageTeamEP,
                            scenarioMetrics.averageTeamEP
                        ),
                    });
                } catch (e) {
                    if (!isAbortError(e)) {
                        setAnalysisError(String(e));
                    }
                } finally {
                    if (!shouldAbort()) {
                        setHelpingBonusLoading(false);
                        setHelpingBonusProgress(0);
                    }
                }
            })();
        }, 0);
    }, [
        cancelRunningAnalysisIfAny,
        analysisSeeds.length,
        hasResolvedBaseMetrics,
        hasHelpingBonusMember,
        resolveBaseAverageMetrics,
        runAverageMetricsWithSeeds,
        state.simulationResult,
    ]);

    const runEnergyRecoveryBonusAnalysis = useCallback(() => {
        if (!state.simulationResult || !hasEnergyRecoveryBonusMember) {
            return;
        }
        if (cancelRunningAnalysisIfAny()) {
            return;
        }
        const runVersion = analysisRunVersionRef.current;
        const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
        setAnalysisError(null);
        setEnergyRecoveryBonusLoading(true);
        setEnergyRecoveryBonusProgress(0);
        setTimeout(() => {
            void (async () => {
                const seedUnitCount = Math.max(analysisSeeds.length, 1);
                const hasBaseMetrics = hasResolvedBaseMetrics;
                const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
                let processedUnits = 0;
                const updateErbProgress = (nextProgress: number): void => {
                    const clamped = Math.max(0, Math.min(100, nextProgress));
                    setEnergyRecoveryBonusProgress(prev => Math.max(prev, clamped));
                };
                try {
                    const baseMetrics = await resolveBaseAverageMetrics(
                        hasBaseMetrics
                            ? undefined
                            : (baseProgress) => {
                                if (shouldAbort()) {
                                    return;
                                }
                                updateErbProgress(((baseProgress / 100) * seedUnitCount / totalUnits) * 100);
                            },
                        shouldAbort
                    );
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    if (!hasBaseMetrics) {
                        processedUnits += seedUnitCount;
                    }
                    const scenarioMetrics = await runAverageMetricsWithSeeds({
                        disableEnergyRecoveryBonus: true,
                    }, (scenarioProgress) => {
                        if (shouldAbort()) {
                            return;
                        }
                        const progress =
                            ((processedUnits + ((scenarioProgress / 100) * seedUnitCount)) / totalUnits) * 100;
                        updateErbProgress(progress);
                    }, shouldAbort);
                    if (shouldAbort()) {
                        throw createAbortError();
                    }
                    setEnergyRecoveryBonusResult({
                        baseTeamEP: baseMetrics.averageTeamEP,
                        scenarioTeamEP: scenarioMetrics.averageTeamEP,
                        teamDeltaEP: scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
                        teamDeltaPercent: calculateDeltaPercent(
                            baseMetrics.averageTeamEP,
                            scenarioMetrics.averageTeamEP
                        ),
                        wakeErbMemberCountMin: wakeErbMemberCountRange.minCount,
                        wakeErbMemberCountMax: wakeErbMemberCountRange.maxCount,
                        wakeSlotCount: wakeErbMemberCountRange.slotCount,
                    });
                } catch (e) {
                    if (!isAbortError(e)) {
                        setAnalysisError(String(e));
                    }
                } finally {
                    if (!shouldAbort()) {
                        setEnergyRecoveryBonusLoading(false);
                        setEnergyRecoveryBonusProgress(0);
                    }
                }
            })();
        }, 0);
    }, [
        cancelRunningAnalysisIfAny,
        analysisSeeds.length,
        hasResolvedBaseMetrics,
        hasEnergyRecoveryBonusMember,
        resolveBaseAverageMetrics,
        runAverageMetricsWithSeeds,
        state.simulationResult,
        wakeErbMemberCountRange,
    ]);

    useEffect(() => {
        resetAdditionalAnalysisState();
    }, [
        resetAdditionalAnalysisState,
        state.simulationResult,
        state.multiTrialResults,
        state.team,
        state.timeSlots,
        state.swaps,
        state.simulationConfig.seed,
        state.simulationConfig.initialEnergy,
        state.simulationConfig.simulationDays,
        state.bonusSettings,
    ]);

    const showSummaryValueToggle = state.simulationConfig.simulationDays >= 2;
    const showAdditionalAnalysis = shouldShowAdditionalAnalysisPanel(
        state.simulationResult,
        state.simulationLoading
    );
    const skipTeamResultEntryAnimation = shouldSkipTeamResultEntryAnimation(
        previousActiveTabRef.current,
        state.activeTab
    );
    const showSimulationDetails = state.simulationResult !== null && boxRef.current !== null;
    const showPreSimulationTimeline = state.simulationResult === null && boxRef.current !== null;
    const showAverageSection = useMemo(
        () => (
            state.multiTrialResults !== null
            && state.multiTrialResults.length > 1
            && boxRef.current !== null
            && state.multiTrialAverageDailySummaries !== null
            && state.multiTrialAverageTeamSummary !== null
        ),
        [
            state.multiTrialResults,
            state.multiTrialAverageDailySummaries,
            state.multiTrialAverageTeamSummary,
        ]
    );
    const showPostSimulationInsights = showAverageSection || showAdditionalAnalysis;

    return (
        <div style={{ margin: '0 0.5rem', paddingBottom: TIMELINE_PAGE_BOTTOM_PADDING }}>
            {/* タブUI */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={state.activeTab} onChange={handleTabChange}>
                    <Tab label={t('TeamTimeline.tab team', 'チーム')} value="team" />
                    <Tab label={t('TeamTimeline.tab settings', '設定')} value="settings" />
                    <Tab label={t('TeamTimeline.tab cooking', '料理')} value="cooking" />
                </Tabs>
            </Box>

            {/* チームタブ */}
            {state.activeTab === 'team' && (
                <Box
                    sx={{
                        maxWidth: isDesktop ? '960px' : '600px',
                    }}
                >
                    <Box
                        sx={{
                            transform: `scale(${teamScale})`,
                            transformOrigin: 'top left',
                            width: isDesktop ? 'max-content' : '100%',
                        }}
                    >
                    <TimelineHeader
                        team={state.team}
                        onSlotClick={handleSlotClick}
                        onRemoveClick={handleRemoveClick}
                    />

                    <SwapSupplementBar
                        swapCount={state.swaps.length}
                        swappedPokemonIdForms={swappedPokemonIdForms}
                        onClear={handleClearSwaps}
                    />

                    {/* シミュレーション実行コントロール */}
                    <SimulationControls
                        seedMode={state.seedMode}
                        seed={state.simulationConfig.seed}
                        simulationDays={state.simulationConfig.simulationDays}
                        multiTrialCount={state.multiTrialCount}
                        simulationLoading={state.simulationLoading}
                        simulationProgress={simulationProgress}
                        isTeamEmpty={state.team.every(p => p === null)}
                        onSeedModeChange={handleSeedModeChange}
                        onSeedChange={handleSeedChange}
                        onSimulationDaysChange={handleSimulationDaysChange}
                        onTrialCountChange={handleTrialCountChange}
                        onRunSimulation={handleRunSimulation}
                    />

                    {/* エラー表示 */}
                    {state.simulationError && (
                        <Box sx={{ color: 'error.main', mt: 1, mb: 1 }}>
                            {state.simulationError}
                        </Box>
                    )}

                    <WipeReveal
                        show={showPostSimulationInsights}
                        durationMs={skipTeamResultEntryAnimation ? 0 : TIMELINE_WIPE_REVEAL_DURATION_MS}
                        appear={!skipTeamResultEntryAnimation}
                        enterEasing={TIMELINE_WIPE_REVEAL_EASING_IN_QUAD}
                        exitEasing={TIMELINE_WIPE_REVEAL_EASING_OUT_QUAD}
                        testId="team-timeline-post-simulation-wipe"
                    >
                        <>
                            {showAverageSection && boxRef.current && (
                                <Box sx={{ mt: '18px' }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-start',
                                            gap: '8px',
                                            flexWrap: 'wrap',
                                            mb: '5px',
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: '14px',
                                                fontWeight: 700,
                                                lineHeight: '18px',
                                                letterSpacing: '0.4px',
                                            }}
                                        >
                                            {t('TeamTimeline.simulation average', 'シミュレーション結果(平均)')}
                                        </Typography>
                                        {showSummaryValueToggle && (
                                            <SummaryValueModeToggle
                                                value={summaryValueMode}
                                                onChange={handleSummaryValueModeChange}
                                                simulationDays={state.simulationConfig.simulationDays}
                                                orientation="horizontal"
                                            />
                                        )}
                                    </Box>
                                    <TeamSummaryRow
                                        teamSummary={state.multiTrialAverageTeamSummary!}
                                        layoutMode="average"
                                        simulationDays={state.simulationConfig.simulationDays}
                                        valueMode={summaryValueMode}
                                        averageCookingSummary={state.multiTrialAverageCookingSummary}
                                    />
                                    <DailySummaryRow
                                        dailySummaries={state.multiTrialAverageDailySummaries!}
                                        box={boxRef.current}
                                        layoutMode="average"
                                        simulationDays={state.simulationConfig.simulationDays}
                                        valueMode={summaryValueMode}
                                        showTimelineDurationShare={hasConfiguredSwap}
                                        timelineDurationByPokemonId={timelineDurationSummary.activeMinutesByPokemonId}
                                        totalTimelineDurationMinutes={timelineDurationSummary.totalTimelineMinutes}
                                    />
                                </Box>
                            )}

                            {showAdditionalAnalysis && (
                                <AdditionalAnalysisPanel
                                    quickModeEnabled={analysisQuickModeEnabled}
                                    onQuickModeChange={setAnalysisQuickModeEnabled}
                                    simulationDays={state.simulationConfig.simulationDays}
                                    valueMode={summaryValueMode}
                                    contributionMembers={appearingTimelineMembers}
                                    contributionResults={contributionResults}
                                    contributionActiveMinutesByPokemonId={timelineDurationSummary.activeMinutesByPokemonId}
                                    contributionLoadingIds={contributionLoadingIds}
                                    contributionBatchLoading={contributionBatchLoading}
                                    contributionBatchProgress={contributionBatchProgress}
                                    contributionProgressById={contributionProgressById}
                                    onRunContribution={runContributionAnalysis}
                                    onRunContributionAll={runContributionAnalysisAll}
                                    energySkillTargets={energySkillTargets}
                                    energySkillResults={energySkillResults}
                                    energySkillLoadingIds={energySkillLoadingIds}
                                    energySkillBatchLoading={energySkillBatchLoading}
                                    energySkillBatchProgress={energySkillBatchProgress}
                                    energySkillProgressById={energySkillProgressById}
                                    energySkillTeamResult={energySkillTeamResult}
                                    energySkillTeamLoading={energySkillTeamLoading}
                                    energySkillTeamProgress={energySkillTeamProgress}
                                    onRunEnergySkill={runEnergySkillAnalysis}
                                    onRunEnergySkillAll={runEnergySkillAnalysisAll}
                                    onRunEnergySkillTeam={runEnergySkillTeamAnalysis}
                                    hasHelpingBonusMember={hasHelpingBonusMember}
                                    helpingBonusResult={helpingBonusResult}
                                    helpingBonusLoading={helpingBonusLoading}
                                    helpingBonusProgress={helpingBonusProgress}
                                    onRunHelpingBonus={runHelpingBonusAnalysis}
                                    averageHelpingBonusMemberCount={averageHelpingBonusMemberCount}
                                    hasConfiguredSwap={hasConfiguredSwap}
                                    averageEnergyRecoveryBonusMemberCount={averageEnergyRecoveryBonusMemberCount}
                                    hasEnergyRecoveryBonusMember={hasEnergyRecoveryBonusMember}
                                    energyRecoveryBonusResult={energyRecoveryBonusResult}
                                    energyRecoveryBonusLoading={energyRecoveryBonusLoading}
                                    energyRecoveryBonusProgress={energyRecoveryBonusProgress}
                                    onRunEnergyRecoveryBonus={runEnergyRecoveryBonusAnalysis}
                                    errorMessage={analysisError}
                                />
                            )}
                        </>
                    </WipeReveal>

                    {showPreSimulationTimeline && (
                        <Box sx={{ mt: '18px' }} data-testid="team-timeline-pre-simulation-table">
                            <Box
                                sx={{
                                    width: '100%',
                                    maxWidth: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    WebkitOverflowScrolling: 'touch',
                                }}
                            >
                                <TimelineTable
                                    team={state.team}
                                    timeSlots={state.timeSlots}
                                    simulationDays={state.simulationConfig.simulationDays}
                                    result={EMPTY_SIMULATION_RESULT}
                                    swaps={state.swaps}
                                    box={boxRef.current!}
                                    onSwapClick={handleSwapClick}
                                    onSwapRemoveClick={handleSwapRemoveRequest}
                                    onHeaderSlotClick={handleSlotClick}
                                    onOpenTimeSlotSettings={handleOpenTimeSlotSettings}
                                    showSummaryRows={false}
                                    compactEmptyCells
                                    alwaysShowSwapButton
                                />
                            </Box>
                        </Box>
                    )}

                    <Fade
                        in={showSimulationDetails}
                        timeout={skipTeamResultEntryAnimation ? 0 : TIMELINE_DETAILS_FADE_DURATION_MS}
                        appear={!skipTeamResultEntryAnimation}
                        mountOnEnter
                        unmountOnExit
                    >
                        <Box data-testid="team-timeline-details-fade">
                            {showSimulationDetails && (
                                <Box sx={{ mt: '18px' }}>
                                    <Typography
                                        sx={{
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            lineHeight: '18px',
                                            letterSpacing: '0.4px',
                                            mb: '5px',
                                        }}
                                    >
                                        {t('TeamTimeline.simulation details', 'シミュレーション詳細')}
                                    </Typography>
                                    {state.multiTrialResults && state.multiTrialSelectedIndex !== null && (
                                        <TrialResultSelector
                                            results={state.multiTrialResults}
                                            selectedIndex={state.multiTrialSelectedIndex}
                                            onSelect={handleSliderChange}
                                        />
                                    )}
                                    <Box
                                        sx={{
                                            width: '100%',
                                            maxWidth: '100%',
                                            overflowX: 'auto',
                                            overflowY: 'hidden',
                                            WebkitOverflowScrolling: 'touch',
                                        }}
                                    >
                                        <TimelineTable
                                            team={state.team}
                                            timeSlots={state.timeSlots}
                                            simulationDays={state.simulationConfig.simulationDays}
                                            result={state.simulationResult!}
                                            swaps={state.swaps}
                                            box={boxRef.current!}
                                            onSwapClick={handleSwapClick}
                                            onSwapRemoveClick={handleSwapRemoveRequest}
                                            onOpenTimeSlotSettings={handleOpenTimeSlotSettings}
                                            showSummaryRows={false}
                                        />
                                    </Box>
                                    <TeamSummaryRow
                                        teamSummary={state.simulationResult!.teamSummary}
                                        layoutMode="details"
                                        simulationDays={state.simulationConfig.simulationDays}
                                        valueMode={summaryValueMode}
                                        showValueModeToggle={showSummaryValueToggle}
                                        onValueModeChange={handleSummaryValueModeChange}
                                        cookingResult={state.simulationResult!.cookingResult}
                                    />
                                    <DailySummaryRow
                                        dailySummaries={state.simulationResult!.dailySummaries}
                                        box={boxRef.current!}
                                        layoutMode="details"
                                        simulationDays={state.simulationConfig.simulationDays}
                                        valueMode={summaryValueMode}
                                        showTimelineDurationShare={hasConfiguredSwap}
                                        timelineDurationByPokemonId={timelineDurationSummary.activeMinutesByPokemonId}
                                        totalTimelineDurationMinutes={timelineDurationSummary.totalTimelineMinutes}
                                    />
                                </Box>
                            )}
                        </Box>
                    </Fade>
                    </Box>
                </Box>
            )}

            {/* 設定タブ */}
            {state.activeTab === 'settings' && (
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: isDesktop ? '960px' : '100%',
                    }}
                >
                    <TimelineBonusSettingsPanel
                        settings={state.bonusSettings}
                        syncWithIvParameter={state.syncWithIvParameter}
                        onSyncChange={handleSyncWithIvParameterChange}
                        onSettingsChange={handleBonusSettingsChange}
                        cookingSimEnabled={state.cookingSettings.enabled}
                    />
                    {/* 就寝時げんき設定 */}
                    <Box sx={{ mb: 3, p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            {t('TeamTimeline.sleep energy', '就寝時げんき')}
                        </Typography>
                        <Slider
                            value={state.simulationConfig.initialEnergy}
                            onChange={(_, value) => handleConfigChange({ initialEnergy: value as number })}
                            min={0}
                            max={100}
                            valueLabelDisplay="auto"
                        />
                    </Box>
                    <Box id={TIME_SLOT_SETTINGS_SECTION_ID}>
                        <TimeSlotEditor
                            timeSlots={state.timeSlots}
                            onAdd={handleAddTimeSlot}
                            onUpdate={handleUpdateTimeSlot}
                            onRemove={handleRemoveTimeSlot}
                            onReset={handleResetTimeSlots}
                        />
                    </Box>
                </Box>
            )}

            {/* 料理タブ */}
            {state.activeTab === 'cooking' && (
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: isDesktop ? '960px' : '100%',
                    }}
                >
                    <CookingSettingsPanel
                        settings={state.cookingSettings}
                        onChange={handleCookingSettingsChange}
                    />
                </Box>
            )}

            {/* 既存: ボックス選択ダイアログ（チーム編成用） */}
            <BoxSelectDialog
                open={state.boxSelectDialogOpen}
                box={box}
                onSelect={handlePokemonSelect}
                onClose={handleDialogClose}
            />

            {/* 入れ替え用ポケモン選択ダイアログ */}
            {boxRef.current && (
                <BoxSelectDialog
                    open={state.swapDialogOpen}
                    box={boxRef.current}
                    onSelect={handleSwapPokemonSelect}
                    onClose={() => dispatch({ type: 'closeSwapDialog' })}
                    onSelectNone={handleSwapSelectNone}
                />
            )}

            {/* げんき設定ダイアログ */}
            <SwapEnergyDialog
                open={state.energyDialogOpen}
                pokemonName={getPendingPokemonName()}
                pokemonIdForm={getPendingPokemonIdForm()}
                defaultEnergy={100}
                disableEnergySetting={disableSwapEnergySetting}
                onConfirm={handleEnergyConfirm}
                onCancel={handleEnergyCancel}
                availableEndSlots={availableEndSlots}
                swapDayIndex={state.swapTargetDayIndex ?? 0}
                simulationDays={state.simulationConfig.simulationDays}
            />
            <SwapRemoveConfirmDialog
                open={pendingSwapRemoval !== null}
                showRepeatOption={pendingSwapRemoval?.hasFutureRepeat ?? false}
                repeatChecked={removeFutureRepeatChecked}
                onRepeatCheckedChange={setRemoveFutureRepeatChecked}
                onCancel={handleSwapRemoveCancel}
                onConfirm={handleSwapRemoveConfirm}
            />
            <ResimulationNoticeBar
                open={showResimulationNotice}
                onResimulate={handleRunSimulation}
            />
        </div>
    );
}
