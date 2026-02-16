import { IngredientName } from '../../../../data/pokemons';
import { MealType } from './TimeSlotTypes';

/** 料理カテゴリ */
export type CookingCategory = 'curry' | 'salad' | 'dessert';

/** レシピ定義(マスターデータ) */
export interface RecipeDefinition {
    /** 内部キー(英語) */
    readonly name: string;
    /** 料理カテゴリ */
    readonly category: CookingCategory;
    /** 必要食材リスト */
    readonly ingredients: readonly { readonly name: IngredientName; readonly count: number }[];
    /** 食材数ボーナス(料理ボーナス)倍率。例: 0.19, 0.205, 0.25 */
    readonly recipeBonus: number;
}

/** 料理シミュレーション設定(ユーザー設定、永続化対象) */
export interface CookingSimulationSettings {
    /** 料理シミュレーション有効/無効 */
    readonly enabled: boolean;
    /** 今週の料理カテゴリ */
    readonly category: CookingCategory;
    /** 各レシピのレベル: recipeName -> level (1-65) */
    readonly recipeLevels: Readonly<Record<string, number>>;
    /** 鍋の基礎容量 */
    readonly basePotCapacity: number;
    /** ユーザー設定の初期食材: ingredientName -> count */
    readonly initialIngredients: Readonly<Partial<Record<IngredientName, number>>>;
}

/** バッグ内の食材エントリ(シミュレーション中のランタイム状態) */
export interface IngredientBagEntry {
    /** ポケモン別の食材数: pokemonId -> count */
    pokemonSources: Map<number, number>;
    /** 初期食材からの残数 */
    initialCount: number;
}

/** 食材バッグ(シミュレーション中のランタイム状態) */
export type IngredientBag = Map<IngredientName, IngredientBagEntry>;

/** 料理で使用した食材の内訳 */
export interface CookingIngredientUsage {
    /** 食材名 */
    readonly name: IngredientName;
    /** 使用した総数 */
    readonly count: number;
    /** ポケモン別の使用数(小数): pokemonId -> count */
    readonly pokemonAttribution: ReadonlyMap<number, number>;
    /** 初期食材から消費した数 */
    readonly fromInitial: number;
}

/** 料理直前のバッグ内食材スナップショット */
export interface CookingBagIngredientSnapshotEntry {
    /** 食材名 */
    readonly name: IngredientName;
    /** その時点のバッグ内総数（ポケモン由来 + 初期食材） */
    readonly count: number;
}

/** 各食事の料理結果 */
export interface CookingEventResult {
    /** 食事が発生したスロットID */
    readonly mealSlotId: string;
    /** 食事タイプ */
    readonly mealType: MealType;
    /** 選択されたレシピ名(作れなかった場合null) */
    readonly recipeName: string | null;
    /** 大成功かどうか */
    readonly isGreatSuccess: boolean;
    /** 最終獲得EP(大成功2倍含む) */
    readonly cookingEP: number;
    /** E_base(ステップ①) */
    readonly eBase: number;
    /** E_display(ステップ②) */
    readonly eDisplay: number;
    /** E_final(ステップ③、大成功前) */
    readonly eFinal: number;
    /** 使用食材の内訳 */
    readonly ingredientsUsed: readonly CookingIngredientUsage[];
    /** 鍋の空き容量 */
    readonly remainingPotCapacity: number;
    /** 有効鍋容量(基礎 × キャンチケ + 料理パワーアップ) */
    readonly effectivePotCapacity: number;
    /** この食事での大成功確率(%) */
    readonly tastyChancePercent: number;
    /** この食事で消費した料理パワーアップボーナス */
    readonly cookingPowerUpBonusUsed: number;
    /** 料理直前のバッグ内食材の内訳 */
    readonly bagIngredientsBeforeCooking?: readonly CookingBagIngredientSnapshotEntry[];
}

/** 日ごとの料理サマリー */
export interface DailyCookingSummary {
    /** この日の料理イベント(最大3食) */
    readonly events: readonly CookingEventResult[];
    /** この日の料理EP合計 */
    readonly totalCookingEP: number;
    /** 大成功回数 */
    readonly greatSuccessCount: number;
}

/** ポケモンごとの料理EP帰属 */
export interface PokemonCookingAttribution {
    /** ポケモンID */
    readonly pokemonId: number;
    /** このポケモンの食材から帰属された料理EP */
    readonly attributedCookingEP: number;
}

/** あまり食材(シミュレーション終了時の残り食材) */
export interface LeftoverIngredients {
    /** ポケモン別の残り食材: pokemonId -> Record<IngredientName, count> */
    readonly byPokemon: ReadonlyMap<number, Readonly<Partial<Record<IngredientName, number>>>>;
    /** 初期食材の残り: ingredientName -> count */
    readonly initialRemaining: Readonly<Partial<Record<IngredientName, number>>>;
    /** 合計の残り食材: ingredientName -> count */
    readonly total: Readonly<Partial<Record<IngredientName, number>>>;
}

/** 料理シミュレーション全体の結果 */
export interface CookingSimulationResult {
    /** 全食事の料理イベント結果 */
    readonly events: readonly CookingEventResult[];
    /** 日ごとの料理サマリー */
    readonly dailySummaries: readonly DailyCookingSummary[];
    /** ポケモンごとの料理EP帰属 */
    readonly pokemonAttributions: readonly PokemonCookingAttribution[];
    /** あまり食材 */
    readonly leftoverIngredients: LeftoverIngredients;
    /** 料理EP合計 */
    readonly totalCookingEP: number;
    /** 初期食材由来EP合計 */
    readonly totalInitialIngredientEP?: number;
}

/** 平均表示用: 料理ごとの集計 */
export interface AverageCookingRecipeSummary {
    /** レシピ名 */
    readonly recipeName: string;
    /** 料理の基礎エナジー */
    readonly eBase: number;
    /** 期間あたり平均の調理回数 */
    readonly averageCount: number;
    /** 1回あたり平均エナジー */
    readonly averageCookingEP: number;
}

/** 平均表示用: 料理関連サマリー */
export interface AverageCookingSummary {
    /** 料理ごとの平均集計（基礎エナジー降順） */
    readonly recipes: readonly AverageCookingRecipeSummary[];
    /** 期間終了時の余り食材平均 */
    readonly leftoverIngredients: readonly { readonly name: IngredientName; readonly count: number }[];
    /** 初期食材由来EP合計の試行平均 */
    readonly averageInitialIngredientEP?: number;
}

/** 大成功の基礎確率(%) */
export const BASE_GREAT_SUCCESS_CHANCE = 10;

/** デフォルトの鍋基礎容量 */
export const DEFAULT_POT_CAPACITY = 81;

/** レシピレベル未設定時のデフォルト値 */
export const DEFAULT_RECIPE_LEVEL = 50;

/** デフォルトの料理シミュレーション設定を生成 */
export function createDefaultCookingSettings(): CookingSimulationSettings {
    return {
        enabled: false,
        category: 'curry',
        recipeLevels: {},
        basePotCapacity: DEFAULT_POT_CAPACITY,
        initialIngredients: {},
    };
}
