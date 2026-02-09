import React, { useReducer, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { Tabs, Tab, Box, Typography, Slider, useMediaQuery, useTheme } from '@mui/material';
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
import { TimeSlot, SimulationConfig, PokemonSwap, SWAP_NONE_POKEMON_ID } from './types/TimeSlotTypes';
import { runSimulation } from './simulation/TimelineSimulator';
import SimulationControls from './components/SimulationControls';
import { runMultiTrialSimulation } from './simulation/MultiTrialSimulator';
import { useSwapAutoRerun } from './utils/useSwapAutoRerun';
import TimelineBonusSettingsPanel from './components/TimelineBonusSettingsPanel';
import { TimelineBonusSettings } from './types/TimelineBonusSettingsTypes';
import {
    loadTimelineBonusSettingsFromIvStorage,
    saveTimelineBonusSettingsToIvStorage,
    IV_PARAMETER_STORAGE_KEY,
} from './utils/TimelineBonusSettingsBridge';

interface TeamNormalizationResult {
    normalizedTeam: (PokemonBoxItem | null)[];
    idRemap: Map<number, number>;
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
    return {
        dayIndex,
        slotId: candidate.slotId,
        teamSlotIndex: candidate.teamSlotIndex,
        newPokemonId: candidate.newPokemonId,
        initialEnergy: candidate.initialEnergy,
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

function normalizeLoadedSwaps(
    swaps: PokemonSwap[],
    box: PokemonBox,
    teamIdRemap: ReadonlyMap<number, number>,
): PokemonSwap[] {
    return swaps.map((swap) => {
        if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
            return swap;
        }
        if (box.getById(swap.newPokemonId)) {
            return swap;
        }
        const remappedId = teamIdRemap.get(swap.newPokemonId);
        if (remappedId === undefined) {
            return swap;
        }
        return { ...swap, newPokemonId: remappedId };
    });
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

        const savedSwaps = localStorage.getItem('PstTeamTimelineSwaps');
        if (savedSwaps) {
            try {
                const swaps: PokemonSwap[] = JSON.parse(savedSwaps);
                if (Array.isArray(swaps)) {
                    const migratedSwaps = swaps
                        .map(migrateSwap)
                        .filter((swap): swap is PokemonSwap => swap !== null);
                    const normalizedSwaps = normalizeLoadedSwaps(migratedSwaps, loadedBox, idRemap);
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

    // 個体値計算機連動フラグの永続化（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return;
        saveSyncWithIvParameterToStorage(state.syncWithIvParameter);
    }, [state.syncWithIvParameter, isInitialized]);

    // ポケモン入れ替え情報の永続化（初期化完了後のみ）
    useEffect(() => {
        if (!isInitialized) return;
        localStorage.setItem('PstTeamTimelineSwaps', JSON.stringify(state.swaps));
    }, [state.swaps, isInitialized]);

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

    const displayedSeed = useMemo(() => {
        if (
            state.multiTrialResults &&
            state.multiTrialSelectedIndex !== null &&
            state.multiTrialSelectedIndex >= 0 &&
            state.multiTrialSelectedIndex < state.multiTrialResults.length
        ) {
            return state.multiTrialResults[state.multiTrialSelectedIndex].seed;
        }
        return state.simulationConfig.seed;
    }, [state.multiTrialResults, state.multiTrialSelectedIndex, state.simulationConfig.seed]);

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
    ]);

    const runMultiTrialWithSeed = useCallback((initialSeed?: number, preferredSeed?: number) => {
        const multiResult = runMultiTrialSimulation({
            team: state.team,
            timeSlots: state.timeSlots,
            config: {
                initialEnergy: state.simulationConfig.initialEnergy,
                simulationDays: state.simulationConfig.simulationDays,
            },
            bonusSettings: state.bonusSettings,
            swaps: state.swaps,
            box: boxRef.current || undefined,
            trialCount: state.multiTrialCount,
            initialSeed,
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
    ]);

    const executeSimulation = useCallback((options?: {
        forcedInitialSeed?: number;
        preferredSeed?: number;
        forceMultiTrial?: boolean;
    }) => {
        const validTeam = state.team.filter(p => p !== null);
        if (validTeam.length === 0) {
            throw new Error('チームにポケモンを追加してください');
        }

        const forceMultiTrial = options?.forceMultiTrial === true;
        if (!forceMultiTrial && state.seedMode === 'fixed' && state.multiTrialCount === 1) {
            runSingleSimulationWithSeed(state.simulationConfig.seed);
            return;
        }

        const initialSeed = options?.forcedInitialSeed ?? (
            forceMultiTrial || state.seedMode === 'fixed'
                ? state.simulationConfig.seed
                : undefined
        );
        runMultiTrialWithSeed(initialSeed, options?.preferredSeed);
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
        dispatch({ type: 'startSimulation' });

        // Use setTimeout to allow React to render loading state before heavy computation
        setTimeout(() => {
            try {
                executeSimulation();
            } catch (e) {
                dispatch({ type: 'setSimulationError', error: String(e) });
            }
        }, 0);
    }, [executeSimulation]);

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
    ]);

    const handleSwapAutoRerun = useCallback((seed: number) => {
        dispatch({ type: 'startSimulation' });

        setTimeout(() => {
            try {
                executeSimulation({
                    forcedInitialSeed: seed,
                    preferredSeed: seed,
                    forceMultiTrial: true,
                });
            } catch (e) {
                dispatch({ type: 'setSimulationError', error: String(e) });
            }
        }, 0);
    }, [executeSimulation]);

    useSwapAutoRerun({
        swaps: state.swaps,
        isInitialized,
        hasSimulationResult: state.simulationResult !== null,
        simulationLoading: state.simulationLoading,
        currentSeed: displayedSeed,
        onAutoRerun: handleSwapAutoRerun,
    });

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

    // タブ切り替えハンドラー
    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: 'team' | 'settings') => {
        dispatch({ type: 'selectTab', tab: newValue });
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

    const handleSwapPokemonSelect = useCallback((item: PokemonBoxItem) => {
        dispatch({ type: 'setPendingSwap', pokemonId: item.id });
    }, []);

    const handleEnergyConfirm = useCallback((energy: number) => {
        dispatch({ type: 'confirmSwap', initialEnergy: energy });
    }, []);

    const handleEnergyCancel = useCallback(() => {
        dispatch({ type: 'closeSwapDialog' });
    }, []);

    // 「入れ替えしない」: 既存swapを削除してダイアログを閉じる
    const handleRemoveSwap = useCallback(() => {
        if (
            state.swapTargetSlotId !== null &&
            state.swapTargetTeamIndex !== null &&
            state.swapTargetDayIndex !== null
        ) {
            dispatch({
                type: 'removeSwap',
                slotId: state.swapTargetSlotId,
                teamIndex: state.swapTargetTeamIndex,
                dayIndex: state.swapTargetDayIndex,
            });
        }
        dispatch({ type: 'closeSwapDialog' });
    }, [state.swapTargetDayIndex, state.swapTargetSlotId, state.swapTargetTeamIndex]);

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

    return (
        <div style={{ margin: '0 0.5rem' }}>
            {/* タブUI */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={state.activeTab} onChange={handleTabChange}>
                    <Tab label={t('TeamTimeline.tab team', 'チーム')} value="team" />
                    <Tab label={t('TeamTimeline.tab settings', '設定')} value="settings" />
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
                        onClear={handleClearSwaps}
                    />

                    {/* シミュレーション実行コントロール */}
                    <SimulationControls
                        seedMode={state.seedMode}
                        seed={state.simulationConfig.seed}
                        simulationDays={state.simulationConfig.simulationDays}
                        multiTrialCount={state.multiTrialCount}
                        simulationLoading={state.simulationLoading}
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

                    {showAverageSection && boxRef.current && (
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
                                {t('TeamTimeline.simulation average', 'シミュレーション結果(平均)')}
                            </Typography>
                            <TeamSummaryRow
                                teamSummary={state.multiTrialAverageTeamSummary!}
                                layoutMode="average"
                                simulationDays={state.simulationConfig.simulationDays}
                            />
                            <DailySummaryRow
                                dailySummaries={state.multiTrialAverageDailySummaries!}
                                box={boxRef.current}
                                layoutMode="average"
                                simulationDays={state.simulationConfig.simulationDays}
                            />
                        </Box>
                    )}

                    {state.simulationResult && boxRef.current && (
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
                                    result={state.simulationResult}
                                    swaps={state.swaps}
                                    box={boxRef.current}
                                    onSwapClick={handleSwapClick}
                                    showSummaryRows={false}
                                />
                            </Box>
                            <TeamSummaryRow
                                teamSummary={state.simulationResult.teamSummary}
                                layoutMode="details"
                                simulationDays={state.simulationConfig.simulationDays}
                            />
                            <DailySummaryRow
                                dailySummaries={state.simulationResult.dailySummaries}
                                box={boxRef.current}
                                layoutMode="details"
                                simulationDays={state.simulationConfig.simulationDays}
                            />
                        </Box>
                    )}
                    </Box>
                </Box>
            )}

            {/* 設定タブ */}
            {state.activeTab === 'settings' && (
                <>
                    <TimelineBonusSettingsPanel
                        settings={state.bonusSettings}
                        syncWithIvParameter={state.syncWithIvParameter}
                        onSyncChange={handleSyncWithIvParameterChange}
                        onSettingsChange={handleBonusSettingsChange}
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
                    <TimeSlotEditor
                        timeSlots={state.timeSlots}
                        onAdd={handleAddTimeSlot}
                        onUpdate={handleUpdateTimeSlot}
                        onRemove={handleRemoveTimeSlot}
                        onReset={handleResetTimeSlots}
                    />
                </>
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
                    onRemoveSwap={handleRemoveSwap}
                    onSelectNone={handleSwapSelectNone}
                />
            )}

            {/* げんき設定ダイアログ */}
            <SwapEnergyDialog
                open={state.energyDialogOpen}
                pokemonName={getPendingPokemonName()}
                pokemonIdForm={getPendingPokemonIdForm()}
                defaultEnergy={100}
                onConfirm={handleEnergyConfirm}
                onCancel={handleEnergyCancel}
            />
        </div>
    );
}
