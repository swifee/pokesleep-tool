import { PokemonBoxItem } from '../../../../util/PokemonBox';
import { TimeSlot, SimulationConfig, SimulationResult, PokemonSwap, DailySummary, TeamSummary } from './TimeSlotTypes';
import { TrialSummary } from './MultiTrialTypes';
import { TimelineBonusSettings } from './TimelineBonusSettingsTypes';
import { AverageCookingSummary, CookingSimulationSettings } from './CookingTypes';

/**
 * チームタイムラインの状態
 */
export interface TeamTimelineState {
    /** チームに編成された5体のポケモン (null = 空きスロット) */
    team: (PokemonBoxItem | null)[];
    /** 現在選択中のスロットインデックス (ダイアログ用) */
    selectedSlotIndex: number | null;
    /** ボックス選択ダイアログの開閉状態 */
    boxSelectDialogOpen: boolean;
    // Phase 3: 時間帯とシミュレーション
    /** 時間帯設定 */
    timeSlots: TimeSlot[];
    /** シミュレーション設定 */
    simulationConfig: SimulationConfig;
    /** シミュレーション結果 */
    simulationResult: SimulationResult | null;
    /** シミュレーション実行中フラグ */
    simulationLoading: boolean;
    /** シミュレーションエラー */
    simulationError: string | null;
    /** アクティブなタブ */
    activeTab: 'team' | 'settings' | 'cooking';
    /** 編集中の時間帯スロットインデックス */
    editingSlotIndex: number | null;
    /** 時間帯編集ダイアログの開閉状態 */
    timeSlotDialogOpen: boolean;
    /** ポケモン入れ替え情報のリスト */
    swaps: PokemonSwap[];
    /** 入れ替えダイアログ用: 対象時間帯ID */
    swapTargetSlotId: string | null;
    /** 入れ替えダイアログ用: 対象チームスロットインデックス */
    swapTargetTeamIndex: number | null;
    /** 入れ替えダイアログ用: 対象日インデックス（0始まり） */
    swapTargetDayIndex: number | null;
    /** 入れ替えダイアログの開閉状態 */
    swapDialogOpen: boolean;
    /** げんき設定ダイアログの開閉状態 */
    energyDialogOpen: boolean;
    /** 確定待ちの入れ替え情報（げんき設定前） */
    pendingSwapPokemonId: number | null;
    /** Seed mode: 'random' (checkbox OFF) or 'fixed' (checkbox ON) */
    seedMode: 'random' | 'fixed';
    /** Number of trials for multi-trial mode */
    multiTrialCount: number;
    /** Multi-trial results (sorted by EP ascending) */
    multiTrialResults: TrialSummary[] | null;
    /** Currently selected trial index in the slider */
    multiTrialSelectedIndex: number | null;
    /** Average daily summaries across all trials */
    multiTrialAverageDailySummaries: DailySummary[] | null;
    /** Average team summary across all trials */
    multiTrialAverageTeamSummary: TeamSummary | null;
    /** Average cooking summary across all trials */
    multiTrialAverageCookingSummary: AverageCookingSummary | null;
    /** TeamTimeline 用ボーナス設定 */
    bonusSettings: TimelineBonusSettings;
    /** 料理シミュレーション設定 */
    cookingSettings: CookingSimulationSettings;
    /** 個体値計算機設定との連動フラグ */
    syncWithIvParameter: boolean;
}

/**
 * チームタイムラインのアクション型
 */
export type TeamTimelineAction =
    | { type: 'openSlotDialog'; index: number }
    | { type: 'closeSlotDialog' }
    | { type: 'selectPokemon'; index: number; item: PokemonBoxItem }
    | { type: 'removePokemon'; index: number }
    | { type: 'loadTeam'; team: (PokemonBoxItem | null)[] }
    // Phase 3: 時間帯操作
    | { type: 'addTimeSlot'; slot: TimeSlot }
    | { type: 'updateTimeSlot'; index: number; slot: TimeSlot }
    | { type: 'removeTimeSlot'; index: number }
    | { type: 'resetTimeSlots' }
    | { type: 'loadTimeSlots'; slots: TimeSlot[] }
    // Phase 3: シミュレーション設定
    | { type: 'updateSimulationConfig'; config: Partial<SimulationConfig> }
    | { type: 'loadSimulationConfig'; config: SimulationConfig }
    // Phase 3: シミュレーション実行
    | { type: 'startSimulation' }
    | { type: 'setSimulationPreviewResult'; result: SimulationResult }
    | { type: 'setSimulationResult'; result: SimulationResult }
    | { type: 'setSimulationError'; error: string }
    | { type: 'clearSimulationResult' }
    // Phase 3: UI状態
    | { type: 'selectTab'; tab: 'team' | 'settings' | 'cooking' }
    | { type: 'openTimeSlotDialog'; index?: number }
    | { type: 'closeTimeSlotDialog' }
    // Phase 4: ポケモン入れ替え
    | { type: 'openSwapDialog'; slotId: string; teamIndex: number; dayIndex: number }
    | { type: 'closeSwapDialog' }
    | { type: 'setPendingSwap'; pokemonId: number }
    | { type: 'confirmSwap'; initialEnergy: number; endSlotId?: string; endDayIndex?: number; repeat?: boolean }
    | { type: 'confirmSwapDirect'; pokemonId: number; initialEnergy: number }
    | {
        type: 'removeSwap';
        slotId: string;
        teamIndex: number;
        dayIndex: number;
        removeFutureRepeats?: boolean;
        pokemonId?: number;
    }
    | { type: 'clearSwaps' }
    | { type: 'loadSwaps'; swaps: PokemonSwap[] }
    // Phase 5: Multi-trial simulation
    | { type: 'setSeedMode'; mode: 'random' | 'fixed' }
    | { type: 'setMultiTrialCount'; count: number }
    | {
        type: 'setMultiTrialResults';
        results: TrialSummary[];
        medianIndex: number;
        averageDailySummaries: DailySummary[];
        averageTeamSummary: TeamSummary;
        averageCookingSummary: AverageCookingSummary | null;
    }
    | { type: 'setMultiTrialSelectedIndex'; index: number }
    | { type: 'clearMultiTrialResults' }
    | { type: 'setBonusSettings'; settings: TimelineBonusSettings }
    | { type: 'loadBonusSettings'; settings: TimelineBonusSettings }
    | { type: 'setSyncWithIvParameter'; enabled: boolean }
    | { type: 'loadSyncWithIvParameter'; enabled: boolean }
    | { type: 'setCookingSettings'; settings: CookingSimulationSettings }
    | { type: 'loadCookingSettings'; settings: CookingSimulationSettings };

/**
 * チームの最大メンバー数
 */
export const MAX_TEAM_SIZE = 5;

/**
 * localStorage キー
 */
export const STORAGE_KEY = 'PstTeamTimeline';

/**
 * 保存されるチームデータの形式
 * ボックスアイテムのシリアライズ文字列の配列
 */
export type SerializedTeam = (string | null)[];
