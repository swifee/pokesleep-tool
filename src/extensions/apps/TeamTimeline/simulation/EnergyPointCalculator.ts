import { IngredientResult, TimeSlotResult, DailySummary, TeamSummary } from '../types/TimeSlotTypes';
import { PokemonBoxItem } from '../../../../util/PokemonBox';
import { PokemonType, IngredientName } from '../../../../data/pokemons';
import { recipeLevelBonus } from '../../../../util/PokemonStrength';

/**
 * きのみ強度マップ（タイプ別）
 * PokemonRp.ts の berryStrength と同じデータを使用
 */
const berryStrength: {[type in PokemonType]: number} = {
    "normal": 28,
    "fire": 27,
    "water": 31,
    "electric": 25,
    "grass": 30,
    "ice": 32,
    "fighting": 27,
    "poison": 32,
    "ground": 29,
    "flying": 24,
    "psychic": 26,
    "bug": 24,
    "rock": 30,
    "ghost": 26,
    "dragon": 35,
    "dark": 31,
    "steel": 33,
    "fairy": 26,
};

/**
 * 食材強度マップ
 * PokemonRp.ts の ingredientStrength をインポート
 */
import { ingredientStrength } from '../../../../util/PokemonRp';

export interface DailySummaryBonusContext {
    fieldBonus: number;
    berryStrengthBonus: number;
    recipeBonus: number;
    recipeLevel: number;
    dishBonus: number;
}

const DEFAULT_DAILY_SUMMARY_BONUS_CONTEXT: DailySummaryBonusContext = {
    fieldBonus: 0,
    berryStrengthBonus: 1,
    recipeBonus: 0,
    recipeLevel: 1,
    dishBonus: 1,
};

function normalizeDailySummaryBonusContext(
    bonusContext?: DailySummaryBonusContext
): DailySummaryBonusContext {
    if (!bonusContext) {
        return DEFAULT_DAILY_SUMMARY_BONUS_CONTEXT;
    }
    const recipeLevel = Number.isInteger(bonusContext.recipeLevel) &&
        bonusContext.recipeLevel >= 1 &&
        bonusContext.recipeLevel <= 65
        ? bonusContext.recipeLevel
        : DEFAULT_DAILY_SUMMARY_BONUS_CONTEXT.recipeLevel;

    return {
        fieldBonus: Number.isFinite(bonusContext.fieldBonus)
            ? bonusContext.fieldBonus
            : DEFAULT_DAILY_SUMMARY_BONUS_CONTEXT.fieldBonus,
        berryStrengthBonus: Number.isFinite(bonusContext.berryStrengthBonus)
            ? bonusContext.berryStrengthBonus
            : DEFAULT_DAILY_SUMMARY_BONUS_CONTEXT.berryStrengthBonus,
        recipeBonus: Number.isFinite(bonusContext.recipeBonus)
            ? bonusContext.recipeBonus
            : DEFAULT_DAILY_SUMMARY_BONUS_CONTEXT.recipeBonus,
        recipeLevel,
        dishBonus: Number.isFinite(bonusContext.dishBonus)
            ? bonusContext.dishBonus
            : DEFAULT_DAILY_SUMMARY_BONUS_CONTEXT.dishBonus,
    };
}

/**
 * きのみ1個あたりの強度を計算
 * PokemonRp.berryStrength のロジックを参考に実装
 *
 * @param type - ポケモンのタイプ
 * @param level - ポケモンのレベル
 * @returns きのみ強度
 */
export function calculateBerryStrength(type: PokemonType, level: number): number {
    const b0 = berryStrength[type];
    return Math.max(
        b0 + level - 1,
        Math.round(Math.pow(1.025, level - 1) * b0)
    );
}

/**
 * きのみEPを計算
 *
 * @param pokemon - ポケモンボックスアイテム
 * @param berryCount - きのみ個数
 * @returns きのみEP
 */
export function calculateBerryEP(
    pokemon: PokemonBoxItem,
    berryCount: number,
    bonusContext?: DailySummaryBonusContext
): number {
    const strength = calculateBerryStrength(pokemon.iv.pokemon.type, pokemon.iv.level);
    if (!bonusContext) {
        return strength * berryCount;
    }

    const normalized = normalizeDailySummaryBonusContext(bonusContext);
    const areaAppliedStrength = Math.ceil(strength * (1 + normalized.fieldBonus / 100));
    const perBerryStrength = Math.ceil(areaAppliedStrength * normalized.berryStrengthBonus);
    return perBerryStrength * berryCount;
}

/**
 * 食材EPを計算
 *
 * @param ingredients - 食材の配列
 * @returns 食材EP
 */
export function calculateIngredientEP(
    ingredients: IngredientResult[],
    bonusContext?: DailySummaryBonusContext
): number {
    const rawIngredientEP = ingredients.reduce((total, ing) => {
        return total + (ingredientStrength[ing.name] * ing.count);
    }, 0);
    if (!bonusContext) {
        return rawIngredientEP;
    }

    const normalized = normalizeDailySummaryBonusContext(bonusContext);
    const recipeRate = normalized.recipeBonus === 0
        ? 1
        : (1 + normalized.recipeBonus / 100) * (1 + recipeLevelBonus[normalized.recipeLevel] / 100);
    const ingredientRate = (recipeRate * 0.8 + 0.2) *
        (1 + normalized.fieldBonus / 100) *
        normalized.dishBonus;
    return rawIngredientEP * ingredientRate;
}

/**
 * 複数の時間帯結果から食材を集計
 * 同じ食材名をまとめて count を合計
 *
 * @param results - 時間帯結果の配列
 * @returns 集計された食材の配列
 */
export function aggregateIngredients(results: TimeSlotResult[]): IngredientResult[] {
    const ingredientMap = new Map<string, number>();

    for (const result of results) {
        for (const ing of result.ingredients) {
            const current = ingredientMap.get(ing.name) || 0;
            ingredientMap.set(ing.name, current + ing.count);
        }
        for (const ing of result.skillIngredients ?? []) {
            const current = ingredientMap.get(ing.name) || 0;
            ingredientMap.set(ing.name, current + ing.count);
        }
    }

    return Array.from(ingredientMap.entries()).map(([name, count]) => ({
        name: name as IngredientName,
        count,
    }));
}

/**
 * 複数の時間帯結果からスキル食材を集計
 * 同じ食材名をまとめて count を合計
 *
 * @param results - 時間帯結果の配列
 * @returns 集計されたスキル食材の配列
 */
export function aggregateSkillIngredients(results: TimeSlotResult[]): IngredientResult[] {
    const ingredientMap = new Map<string, number>();

    for (const result of results) {
        for (const ing of result.skillIngredients ?? []) {
            const current = ingredientMap.get(ing.name) || 0;
            ingredientMap.set(ing.name, current + ing.count);
        }
    }

    return Array.from(ingredientMap.entries()).map(([name, count]) => ({
        name: name as IngredientName,
        count,
    }));
}

/**
 * 複数の時間帯結果から溢れ食材を集計
 * 同じ食材名をまとめて count を合計
 *
 * @param results - 時間帯結果の配列
 * @returns 集計された溢れ食材の配列
 */
export function aggregateOverflowIngredients(results: TimeSlotResult[]): IngredientResult[] {
    const ingredientMap = new Map<string, number>();

    for (const result of results) {
        for (const ing of result.overflowIngredients) {
            const current = ingredientMap.get(ing.name) || 0;
            ingredientMap.set(ing.name, current + ing.count);
        }
    }

    return Array.from(ingredientMap.entries()).map(([name, count]) => ({
        name: name as IngredientName,
        count,
    }));
}

/**
 * 1ポケモンの一日合計を計算
 * 時間帯ごとの結果を集計し、各EPを計算して DailySummary を生成
 *
 * @param pokemonId - ポケモンID
 * @param pokemon - ポケモンボックスアイテム
 * @param results - 時間帯結果の配列
 * @returns 一日合計
 */
export function calculateDailySummary(
    pokemonId: number,
    pokemon: PokemonBoxItem,
    results: TimeSlotResult[],
    bonusContext?: DailySummaryBonusContext
): DailySummary {
    // 時間帯ごとの結果を集計
    let totalHelpCount = 0;
    let totalSkillCount = 0;
    let totalBerryCount = 0;
    let totalSkillOverflowCount = 0;
    let totalDirectSkillEP = 0;
    let totalPresentCandyCount = 0;
    let totalCookingPotCapacityIncrease = 0;
    let totalTastyChanceIncreasePercent = 0;
    let totalDreamShardCount = 0;

    for (const result of results) {
        totalHelpCount += result.helpCount;
        totalSkillCount += result.skillTriggerCount;
        totalBerryCount += result.berryCount;
        totalSkillOverflowCount += result.skillOverflowCount;
        totalDirectSkillEP += result.directSkillEP;
        totalPresentCandyCount += result.presentCandyCount;
        totalCookingPotCapacityIncrease += result.cookingPotCapacityIncrease ?? 0;
        totalTastyChanceIncreasePercent += result.tastyChanceIncreasePercent ?? 0;
        totalDreamShardCount += result.dreamShardCount ?? 0;
    }

    // 食材を集計（通常 + スキル）
    const totalIngredients = aggregateIngredients(results);
    const totalSkillIngredients = aggregateSkillIngredients(results);

    // 溢れ食材を集計
    const totalOverflowIngredients = aggregateOverflowIngredients(results);

    // 各EPを計算
    const berryEP = calculateBerryEP(pokemon, totalBerryCount, bonusContext);
    const ingredientEP = calculateIngredientEP(totalIngredients, bonusContext);

    // スキルEPの計算: 直接エナジー獲得値のみを集計
    const skillEP = totalDirectSkillEP;

    const totalEP = berryEP + ingredientEP + skillEP;

    return {
        pokemonId,
        totalHelpCount,
        totalSkillCount,
        totalBerryCount,
        totalIngredients,
        totalSkillIngredients,
        berryEP,
        ingredientEP,
        skillEP,
        totalEP,
        totalSkillOverflowCount,
        totalOverflowIngredients,
        totalDirectSkillEP,
        totalPresentCandyCount,
        totalCookingPotCapacityIncrease,
        totalTastyChanceIncreasePercent,
        totalDreamShardCount,
    };
}

/**
 * チーム合計を計算
 * 各ポケモンのDailySummaryを集計してTeamSummaryを生成
 * 食材は全ポケモン分を集約
 *
 * @param dailySummaries - 各ポケモンの一日合計の配列
 * @returns チーム合計
 */
export function calculateTeamSummary(dailySummaries: DailySummary[]): TeamSummary {
    let totalBerryEP = 0;
    let totalIngredientEP = 0;
    let totalSkillEP = 0;
    let totalPresentCandyCount = 0;
    let totalCookingPotCapacityIncrease = 0;
    let totalTastyChanceIncreasePercent = 0;
    let totalDreamShardCount = 0;

    // 全ポケモンの食材を集約
    const allIngredients: IngredientResult[] = [];
    for (const summary of dailySummaries) {
        totalBerryEP += summary.berryEP;
        totalIngredientEP += summary.ingredientEP;
        totalSkillEP += summary.skillEP;
        totalPresentCandyCount += summary.totalPresentCandyCount;
        totalCookingPotCapacityIncrease += summary.totalCookingPotCapacityIncrease;
        totalTastyChanceIncreasePercent += summary.totalTastyChanceIncreasePercent;
        totalDreamShardCount += summary.totalDreamShardCount;
        allIngredients.push(...summary.totalIngredients);
    }

    // 食材を名前でグルーピング
    const ingredientMap = new Map<string, number>();
    for (const ing of allIngredients) {
        const current = ingredientMap.get(ing.name) || 0;
        ingredientMap.set(ing.name, current + ing.count);
    }

    const totalIngredients = Array.from(ingredientMap.entries()).map(([name, count]) => ({
        name: name as IngredientName,
        count,
    }));

    const grandTotalEP = totalBerryEP + totalIngredientEP + totalSkillEP;

    return {
        totalIngredients,
        totalBerryEP,
        totalIngredientEP,
        totalSkillEP,
        grandTotalEP,
        totalPresentCandyCount,
        totalCookingPotCapacityIncrease,
        totalTastyChanceIncreasePercent,
        totalDreamShardCount,
    };
}
