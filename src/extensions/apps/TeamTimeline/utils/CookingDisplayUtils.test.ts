import { describe, expect, it } from "vitest";
import {
	formatAverageRecipeCount,
	groupAverageCookingRecipes,
} from "./CookingDisplayUtils";

describe("formatAverageRecipeCount", () => {
	it("formats values below 0.1 with two decimals", () => {
		expect(formatAverageRecipeCount(0.055)).toBe("0.06");
		expect(formatAverageRecipeCount(0.1 - Number.EPSILON)).toBe("0.10");
	});

	it("formats values 0.1 and above with up to one decimal", () => {
		expect(formatAverageRecipeCount(1)).toBe("1");
		expect(formatAverageRecipeCount(1.25)).toBe("1.3");
		expect(formatAverageRecipeCount(17)).toBe("17");
	});
});

describe("groupAverageCookingRecipes", () => {
	it("keeps >=1 as visible, groups <1, and excludes <0.01", () => {
		const grouped = groupAverageCookingRecipes([
			{
				recipeName: "visible",
				eBase: 100,
				averageCount: 1,
				averageCookingEP: 1000,
			},
			{
				recipeName: "grouped",
				eBase: 200,
				averageCount: 0.5,
				averageCookingEP: 500,
			},
			{
				recipeName: "excluded",
				eBase: 300,
				averageCount: 0.009,
				averageCookingEP: 100,
			},
		]);

		expect(grouped.visibleRecipes.map((recipe) => recipe.recipeName)).toEqual([
			"visible",
		]);
		expect(grouped.groupedRecipes.map((recipe) => recipe.recipeName)).toEqual([
			"grouped",
		]);
		expect(grouped.groupedCount).toBe(0.5);
	});
});
