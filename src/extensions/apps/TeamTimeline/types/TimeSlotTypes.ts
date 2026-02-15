import { IngredientName } from '../../../../data/pokemons';
import { CookingSimulationResult } from './CookingTypes';

/**
 * 睡眠状態のラベル
 */
export type SleepStateLabel = 'none' | 'sleep' | 'wake';

/**
 * 時間帯のラベル種別（後方互換性のため残す）
 */
export type TimeSlotLabel =
    | 'wake'      // 起床
    | 'breakfast' // 朝食
    | 'lunch'     // 昼食
    | 'dinner'    // 夕食
    | 'sleep'     // 就寝
    | 'custom';   // カスタム

/**
 * 食事を伴うラベル
 */
export const MEAL_LABELS: TimeSlotLabel[] = ['breakfast', 'lunch', 'dinner'];

/**
 * 食事タイプ
 */
export type MealType = 'breakfast' | 'lunch' | 'dinner';

/**
 * 時間帯の定義（新形式）
 */
export interface TimeSlot {
    /** 一意のID */
    id: string;
    /** 時刻 "HH:MM" 形式 */
    time: string;
    /** 睡眠状態 */
    sleepState: SleepStateLabel;
    /** 食事フラグ */
    hasMeal: boolean;

    // 後方互換性のため残す（オプション）
    /** @deprecated 旧形式のラベル */
    label?: TimeSlotLabel;
    /** @deprecated カスタムラベル */
    customLabel?: string;
}

/**
 * 時間から食事タイプを自動判定
 */
export function getMealType(time: string): MealType {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour >= 4 && hour < 12) return 'breakfast';
    if (hour >= 12 && hour < 18) return 'lunch';
    return 'dinner'; // 18:00〜翌3:59
}

/**
 * 後方互換性: 旧TimeSlotから表示用ラベルを生成
 */
export function getDisplayLabel(slot: TimeSlot): TimeSlotLabel {
    // 新形式
    if (slot.sleepState === 'sleep') return 'sleep';
    if (slot.sleepState === 'wake') return 'wake';
    if (slot.hasMeal) return getMealType(slot.time);
    return 'custom';
}

/**
 * 旧形式のTimeSlot（互換性のため）
 */
interface LegacyTimeSlot {
    id: string;
    time: string;
    label?: TimeSlotLabel;
    customLabel?: string;
}

/**
 * 旧形式から新形式へのマイグレーション
 */
export function migrateTimeSlot(oldSlot: TimeSlot | LegacyTimeSlot): TimeSlot {
    // すでに新形式の場合
    if ('sleepState' in oldSlot && 'hasMeal' in oldSlot) {
        return oldSlot as TimeSlot;
    }

    // 旧形式からの変換
    const legacy = oldSlot as LegacyTimeSlot;
    return {
        id: legacy.id,
        time: legacy.time,
        sleepState: legacy.label === 'sleep' ? 'sleep'
                  : legacy.label === 'wake' ? 'wake'
                  : 'none',
        hasMeal: legacy.label ? ['breakfast', 'lunch', 'dinner'].includes(legacy.label) : false,
    };
}

/**
 * シミュレーション設定
 */
export interface SimulationConfig {
    /** 乱数シード */
    seed: number;
    /** 就寝時のげんき（デフォルト50） */
    initialEnergy: number;
    /** シミュレーション期間（日数） */
    simulationDays: number;
}

/** シミュレーション日数の最小値 */
export const MIN_SIMULATION_DAYS = 1;
/** シミュレーション日数の最大値 */
export const MAX_SIMULATION_DAYS = 7;

export function clampSimulationDays(days: number): number {
    if (!Number.isFinite(days)) {
        return MIN_SIMULATION_DAYS;
    }
    return Math.min(MAX_SIMULATION_DAYS, Math.max(MIN_SIMULATION_DAYS, Math.floor(days)));
}

/**
 * デフォルトのシミュレーション設定
 */
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
    seed: 123456,
    initialEnergy: 50,
    simulationDays: MIN_SIMULATION_DAYS,
};

/**
 * 食材の結果（種類別）
 */
export interface IngredientResult {
    name: IngredientName;
    count: number;
}

export interface EnergizingCheerEvent {
    targetPokemonId: number;
    targetPokemonName: string;
    recovery: number;
    source: 'cheer' | 'nuzzle';
}

export interface NuzzleTriggeredSkillEvent {
    targetPokemonId: number;
    targetPokemonName: string;
    triggeredSkillName: string;
}

export interface MoonlightEvent {
    targetPokemonId: number;
    targetPokemonName: string;
    recovery: number;
}

export interface SupportHelpEvent {
    source: 'extraHelpful' | 'helperBoost';
    targetPokemonId: number;
    targetPokemonName: string;
    helpCount: number;
    berryCount: number;
    berryEP: number;
    ingredients: IngredientResult[];
}

export interface CookingMinusEvent {
    targetPokemonId: number;
    targetPokemonName: string;
    recovery: number;
}

export interface ProxySkillEvent {
    source: 'metronome' | 'skillCopy';
    triggeredSkillName: string;
    resolvedSkillName: string;
    resolvedSkillLevel: number;
    copiedFromPokemonId?: number;
    copiedFromPokemonName?: string;
    selfEnergyRecovery?: number;
    teamEnergyRecoveryPerMember?: number;
    teamEnergyRecoveryTargetCount?: number;
    directEP?: number;
    skillIngredients?: IngredientResult[];
    presentCandyCount?: number;
    berryJuiceCount?: number;
    supportSkillBerryEP?: number;
    cookingPotCapacityIncrease?: number;
    tastyChanceIncreasePercent?: number;
    dreamShardCount?: number;
    stockpileStoreCount?: number;
    stockpileCountAtStore?: number;
    stockpileSpitCount?: number;
    stockpileCountAtSpit?: number;
    badDreamsHitCount?: number;
    berryBurstGreatSuccessCount?: number;
    ingredientDrawGreatSuccessCount?: number;
}

/**
 * 時間帯ごとの計算結果（1ポケモン分）
 */
export interface TimeSlotResult {
    /** 時間帯ID */
    slotId: string;
    /** ポケモンID（PokemonBoxItem.id） */
    pokemonId: number;
    /** チームスロットインデックス (0-4) */
    teamIndex: number;
    /** 経過時間（分） */
    durationMinutes: number;
    /** 睡眠中フラグ */
    isSleeping: boolean;

    // おてつだい結果
    /** おてつだい回数 */
    helpCount: number;
    /** スキル発動回数 */
    skillTriggerCount: number;
    /** きのみ個数 */
    berryCount: number;
    /** 食材（種類別） */
    ingredients: IngredientResult[];
    /** スキルで獲得した食材（種類別） */
    skillIngredients?: IngredientResult[];

    // げんき
    /** 開始時げんき */
    energyStart: number;
    /** 終了時げんき */
    energyEnd: number;
    /** 食事回復量 */
    mealRecovery: number;
    /** スキル回復量（チームから受けた分） */
    skillRecovery: number;
    /** 起床時げんき回復量（実際に増加した分、上限適用後） */
    wakeRecovery: number;
    /** 時間経過によるげんき減少量 */
    energyDecay: number;
    /** スキル発動失敗（溢れ）回数 */
    skillOverflowCount: number;
    /** 溢れた食材（いつのまに育成で取得できなかった分） */
    overflowIngredients: IngredientResult[];
    /** 自己スキルげんき回復（Charge Energy S, Moonlight自己回復） */
    selfSkillRecovery: number;
    /** 直接スキルEP値（Charge Strength S/M/Random） */
    directSkillEP: number;
    /** Moonlight: 特定のチームメイトに与えた回復量（表示用） */
    moonlightGivenRecovery: number;
    /** Moonlight: 対象付きイベント（表示用） */
    moonlightEvents?: MoonlightEvent[];
    /** Moonlight: チームメイトのMoonlightスキルから受けた回復量 */
    moonlightReceivedRecovery: number;
    /** Energizing Cheer S: ランダム対象に与えた回復量（表示用） */
    energizingCheerGivenRecovery: number;
    /** Energizing Cheer S: チームメイトのEnergizing Cheer Sから受けた回復量 */
    energizingCheerReceivedRecovery: number;
    /** Energizing Cheer/Nuzzle の対象付きイベント（時系列） */
    energizingCheerEvents: EnergizingCheerEvent[];
    /** Nuzzle による追加発動イベント（時系列） */
    nuzzleTriggeredSkillEvents: NuzzleTriggeredSkillEvent[];
    /** Metronome/Skill Copy の追加発動イベント（時系列） */
    proxySkillEvents?: ProxySkillEvent[];
    /** Ingredient Magnet S (Present) で得たアメ数 */
    presentCandyCount: number;
    /** Energy for Everyone S (Berry Juice) で得たジュース数 */
    berryJuiceCount: number;
    /** Extra Helpful S / Helper Boost 由来のきのみ個数 */
    supportSkillBerryCount: number;
    /** Extra Helpful S / Helper Boost 由来のきのみEP */
    supportSkillBerryEP: number;
    /** Extra Helpful S / Helper Boost のイベント（時系列） */
    supportHelpEvents: SupportHelpEvent[];
    /** Cooking Power-Up S系: 鍋容量増加量合計 */
    cookingPotCapacityIncrease?: number;
    /** Tasty Chance S: 料理チャンス上昇率合計（%） */
    tastyChanceIncreasePercent?: number;
    /** Dream Shard Magnet S系: ゆめのかけら獲得量 */
    dreamShardCount?: number;
    /** Ingredient Draw S (Hyper Cutter): 大成功回数 */
    ingredientDrawGreatSuccessCount?: number;
    /** Cooking Power-Up S (Minus): 対象回復イベント（時系列） */
    cookingMinusEvents?: CookingMinusEvent[];
    /** Berry Burst (Disguise): 大成功回数 */
    berryBurstGreatSuccessCount?: number;
    /** チーム全員回復スキル: 1匹あたりの回復量（与えた側表示用） */
    teamEnergyRecoveryGivenPerMember?: number;
    /** チーム全員回復スキル: 対象人数（与えた側表示用） */
    teamEnergyRecoveryGivenTargetCount?: number;
    /** Charge Strength S (Stockpile): たくわえる回数 */
    stockpileStoreCount: number;
    /** Charge Strength S (Stockpile): この時間帯で最後にたくわえた直後の蓄積数 */
    stockpileCountAtStore?: number;
    /** Charge Strength S (Stockpile): はきだす回数 */
    stockpileSpitCount: number;
    /** Charge Strength S (Stockpile): この時間帯で最後にはきだした直前の蓄積数 */
    stockpileCountAtSpit?: number;
    /** Charge Strength S (Stockpile): 時間帯終了時の蓄積数 */
    stockpileCountAfter?: number;
    /** Charge Strength M (Bad Dreams): ヒット回数（-12回数） */
    badDreamsHitCount: number;
    /** Charge Strength M (Bad Dreams): 与えた減少量合計 */
    badDreamsTotalDamageGiven: number;
    /** Charge Strength M (Bad Dreams): 自分が受けた減少量 */
    badDreamsDamageTaken: number;
}

/**
 * 一日合計（1ポケモン分）
 */
export interface DailySummary {
    /** ポケモンID */
    pokemonId: number;
    /** 合計おてつだい回数 */
    totalHelpCount: number;
    /** 合計スキル発動回数 */
    totalSkillCount: number;
    /** 合計きのみ個数 */
    totalBerryCount: number;
    /** 合計食材（種類別） */
    totalIngredients: IngredientResult[];
    /** スキル由来の合計食材（種類別） */
    totalSkillIngredients?: IngredientResult[];

    // EP（エナジーポイント）
    /** きのみEP */
    berryEP: number;
    /** 食材EP */
    ingredientEP: number;
    /** スキルEP */
    skillEP: number;
    /** 合計EP */
    totalEP: number;
    /** 合計スキル発動失敗回数 */
    totalSkillOverflowCount: number;
    /** 合計溢れ食材 */
    totalOverflowIngredients: IngredientResult[];
    /** Charge Strengthスキルからの合計直接スキルEP */
    totalDirectSkillEP: number;
    /** Ingredient Magnet S (Present) の合計アメ数 */
    totalPresentCandyCount: number;
    /** Cooking Power-Up S系の合計鍋容量増加量 */
    totalCookingPotCapacityIncrease: number;
    /** Tasty Chance Sの合計料理チャンス上昇率（%） */
    totalTastyChanceIncreasePercent: number;
    /** Dream Shard Magnet S系の合計ゆめのかけら獲得量 */
    totalDreamShardCount: number;
    /** 料理EP（料理シミュレーションON時のみ） */
    cookingEP?: number;
}

/**
 * チーム合計
 */
export interface TeamSummary {
    /** 合計食材（種類別） */
    totalIngredients: IngredientResult[];
    /** 合計きのみEP */
    totalBerryEP: number;
    /** 合計食材EP */
    totalIngredientEP: number;
    /** 合計スキルEP */
    totalSkillEP: number;
    /** 総合計EP */
    grandTotalEP: number;
    /** Ingredient Magnet S (Present) の合計アメ数 */
    totalPresentCandyCount: number;
    /** Cooking Power-Up S系のチーム合計鍋容量増加量 */
    totalCookingPotCapacityIncrease: number;
    /** Tasty Chance Sのチーム合計料理チャンス上昇率（%） */
    totalTastyChanceIncreasePercent: number;
    /** Dream Shard Magnet S系のチーム合計ゆめのかけら獲得量 */
    totalDreamShardCount: number;
    /** 料理EP合計（料理シミュレーションON時のみ） */
    totalCookingEP?: number;
}

/**
 * シミュレーション全体の結果
 */
export interface SimulationResult {
    /** 時間帯ごとの結果（slotId -> ポケモンごとの結果配列） */
    slotResults: Map<string, TimeSlotResult[]>;
    /** 一日合計（ポケモンごと） */
    dailySummaries: DailySummary[];
    /** チーム合計 */
    teamSummary: TeamSummary;
    /** 料理シミュレーション結果（料理シミュレーションON時のみ） */
    cookingResult?: CookingSimulationResult;
}

/**
 * デフォルトの時間帯設定（新形式）
 */
export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
    { id: 'slot-1', time: '07:00', sleepState: 'wake', hasMeal: true },
    { id: 'slot-2', time: '12:00', sleepState: 'none', hasMeal: true },
    { id: 'slot-3', time: '15:00', sleepState: 'none', hasMeal: false },
    { id: 'slot-4', time: '18:00', sleepState: 'none', hasMeal: true },
    { id: 'slot-5', time: '23:00', sleepState: 'sleep', hasMeal: false },
];

/**
 * localStorage キー（時間帯設定）
 */
export const STORAGE_KEY_SLOTS = 'PstTeamTimelineSlots';

/**
 * localStorage キー（シミュレーション設定）
 */
export const STORAGE_KEY_CONFIG = 'PstTeamTimelineConfig';

/**
 * ポケモン入れ替え情報
 * 特定の時間帯から、あるスロットのポケモンを別のポケモンに入れ替える
 */
export interface PokemonSwap {
    /** 対象日（0始まり） */
    dayIndex: number;
    /** 入れ替えが発生する時間帯ID */
    slotId: string;
    /** チームスロットインデックス (0-4) */
    teamSlotIndex: number;
    /** 入れ替え先のポケモンID（PokemonBoxItemと同じ形式で保存） */
    newPokemonId: number;
    /** 初回登場時の初期げんき（デフォルト100） */
    initialEnergy: number;
}

/** Special Pokemon ID representing "none" (remove Pokemon from slot) */
export const SWAP_NONE_POKEMON_ID = -1;
