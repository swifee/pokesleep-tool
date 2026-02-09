import { IngredientResult } from '../types/TimeSlotTypes';

export const AVERAGE_INGREDIENT_GROUP_THRESHOLD_PER_DAY = 2;
export const MIN_VISIBLE_AVERAGE_INGREDIENTS = 3;
export const MEALS_PER_DAY = 3;

function roundToSingleDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}

export function formatIngredientCount(value: number): string {
    const rounded = roundToSingleDecimal(value);
    if (Number.isInteger(rounded)) {
        return rounded.toLocaleString();
    }
    return rounded.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
}

export function formatIngredientIntegerCount(value: number): string {
    return Math.round(value).toLocaleString();
}

export function sortIngredientsByCountDesc<T extends IngredientResult>(ingredients: readonly T[]): T[] {
    return [...ingredients].sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
    });
}

export function filterPositiveIngredients<T extends IngredientResult>(ingredients: readonly T[]): T[] {
    return ingredients.filter(ingredient => ingredient.count > 0);
}

export function calculateIngredientTotalCount(ingredients: readonly IngredientResult[]): number {
    return ingredients.reduce((sum, ingredient) => sum + ingredient.count, 0);
}

export interface GroupedAverageIngredients {
    visibleIngredients: IngredientResult[];
    groupedIngredients: IngredientResult[];
    groupedCount: number;
}

export function groupLowDailyIngredientsForAverage(
    ingredients: readonly IngredientResult[],
    simulationDays: number,
): GroupedAverageIngredients {
    const sortedIngredients = sortIngredientsByCountDesc(filterPositiveIngredients(ingredients));
    const divisor = simulationDays > 0 ? simulationDays : 1;

    const visibleIngredients: IngredientResult[] = [];
    const groupedIngredients: IngredientResult[] = [];

    sortedIngredients.forEach((ingredient, index) => {
        if (index < MIN_VISIBLE_AVERAGE_INGREDIENTS) {
            visibleIngredients.push(ingredient);
            return;
        }
        const perDayCount = ingredient.count / divisor;
        if (perDayCount < AVERAGE_INGREDIENT_GROUP_THRESHOLD_PER_DAY) {
            groupedIngredients.push(ingredient);
            return;
        }
        visibleIngredients.push(ingredient);
    });

    return {
        visibleIngredients,
        groupedIngredients,
        groupedCount: calculateIngredientTotalCount(groupedIngredients),
    };
}
