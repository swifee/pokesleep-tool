import { describe, expect, it } from "vitest";
import { getRecipeByName } from "./RecipeData";

describe("RecipeData", () => {
	it("uses corrected ingredients for sparkSpiceSpicyCola", () => {
		const recipe = getRecipeByName("sparkSpiceSpicyCola");

		expect(recipe).toBeDefined();
		expect(recipe?.ingredients).toEqual([
			{ name: "leek", count: 20 },
			{ name: "apple", count: 35 },
			{ name: "ginger", count: 20 },
			{ name: "coffee", count: 12 },
		]);
	});
});
