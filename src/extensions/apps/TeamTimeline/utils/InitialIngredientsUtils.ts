import { IngredientNames } from "../../../../data/pokemons";
import type { InitialIngredientsSettings } from "../types/CookingTypes";

/**
 * 初期食材の合計数
 */
export function getInitialIngredientTotal(
	settings: Pick<InitialIngredientsSettings, "initialIngredients">,
): number {
	return IngredientNames.reduce(
		(sum, ingredientName) =>
			sum + (settings.initialIngredients[ingredientName] ?? 0),
		0,
	);
}
