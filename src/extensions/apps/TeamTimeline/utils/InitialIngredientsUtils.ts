import { IngredientNames } from "../../../../data/pokemons";
import type { CookingSimulationSettings } from "../types/CookingTypes";

/**
 * 初期食材の合計数
 */
export function getInitialIngredientTotal(
	settings: CookingSimulationSettings,
): number {
	return IngredientNames.reduce(
		(sum, ingredientName) =>
			sum + (settings.initialIngredients[ingredientName] ?? 0),
		0,
	);
}
