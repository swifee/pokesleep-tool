import type { AverageCookingRecipeSummary } from "../types/CookingTypes";

export const MIN_VISIBLE_RECIPE_AVERAGE_COUNT = 1;
export const MIN_DISPLAYABLE_RECIPE_AVERAGE_COUNT = 0.01;
export const SMALL_RECIPE_AVERAGE_COUNT_THRESHOLD = 0.1;

function roundToDecimal(value: number, digits: number): number {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

export function formatAverageRecipeCount(value: number): string {
	if (value < SMALL_RECIPE_AVERAGE_COUNT_THRESHOLD) {
		const rounded = roundToDecimal(value, 2);
		return rounded.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}

	const rounded = roundToDecimal(value, 1);
	if (Number.isInteger(rounded)) {
		return rounded.toLocaleString();
	}
	return rounded.toLocaleString(undefined, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
}

export interface GroupedAverageCookingRecipes {
	visibleRecipes: AverageCookingRecipeSummary[];
	groupedRecipes: AverageCookingRecipeSummary[];
	groupedCount: number;
}

export function groupAverageCookingRecipes(
	recipes: readonly AverageCookingRecipeSummary[],
): GroupedAverageCookingRecipes {
	const displayableRecipes = recipes.filter(
		(recipe) => recipe.averageCount >= MIN_DISPLAYABLE_RECIPE_AVERAGE_COUNT,
	);
	const visibleRecipes = displayableRecipes.filter(
		(recipe) => recipe.averageCount >= MIN_VISIBLE_RECIPE_AVERAGE_COUNT,
	);
	const groupedRecipes = displayableRecipes.filter(
		(recipe) => recipe.averageCount < MIN_VISIBLE_RECIPE_AVERAGE_COUNT,
	);
	const groupedCount = groupedRecipes.reduce(
		(sum, recipe) => sum + recipe.averageCount,
		0,
	);

	return {
		visibleRecipes,
		groupedRecipes,
		groupedCount,
	};
}
