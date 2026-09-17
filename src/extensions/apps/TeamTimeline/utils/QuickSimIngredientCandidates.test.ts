import { describe, expect, it } from "vitest";
import {
	type IngredientName,
	IngredientNames,
} from "../../../../data/pokemons";
import { ingredientStrength } from "../../../../util/PokemonRp";
import { getRecipeByName } from "../data/RecipeData";
import {
	type CookingSimulationSettings,
	createDefaultCookingSettings,
} from "../types/CookingTypes";
import {
	buildFillerOrder,
	buildFillerStartUnits,
	buildIngredientSearchSpace,
	buildIngredientStartUnits,
	buildRecipeStartUnits,
	generateIngredientNeighborUnits,
	ingredientCountToUnits,
	initialIngredientsToStock,
	isWithinIngredientSpace,
	type QuickSimIngredientSearchSpace,
	snapStockToUnits,
	stockToInitialIngredients,
	unitsToStock,
} from "./QuickSimIngredientCandidates";
import { unitsKey } from "./QuickSimOptimizerCandidates";

function maxFor(
	entries: Partial<Record<IngredientName, number>>,
): Partial<Record<IngredientName, number>> {
	return entries;
}

function cookingSettings(
	overrides: Partial<CookingSimulationSettings> = {},
): CookingSimulationSettings {
	return {
		...createDefaultCookingSettings(),
		enabled: true,
		category: "curry",
		...overrides,
	};
}

function nameAt(space: QuickSimIngredientSearchSpace, position: number) {
	return IngredientNames[space.ingredientIndexes[position]];
}

describe("buildIngredientSearchSpace", () => {
	it("keeps only ingredients whose max is at least one unit, in IngredientNames order", () => {
		const space = buildIngredientSearchSpace(
			300,
			maxFor({ tomato: 210, apple: 29, soy: 60, coffee: 30 }),
		);
		expect(space).not.toBeNull();
		expect(
			space?.ingredientIndexes.map((index) => IngredientNames[index]),
		).toEqual(
			["soy", "tomato", "coffee"].sort(
				(a, b) =>
					IngredientNames.indexOf(a as IngredientName) -
					IngredientNames.indexOf(b as IngredientName),
			),
		);
		const maxByName = maxFor({ soy: 60, tomato: 210, coffee: 30 });
		expect(space?.maxUnits).toEqual(
			space?.ingredientIndexes.map((index) =>
				ingredientCountToUnits(maxByName[IngredientNames[index]] ?? 0),
			),
		);
		expect(space?.totalUnits).toBe(10);
		expect(space?.effectiveTotalCount).toBe(300);
	});

	it("floors a total that is not a multiple of the step", () => {
		const space = buildIngredientSearchSpace(800, maxFor({ apple: 900 }));
		expect(space?.totalUnits).toBe(26);
		expect(space?.effectiveTotalCount).toBe(780);
	});

	it("clamps the total to the sum of the caps", () => {
		const space = buildIngredientSearchSpace(
			800,
			maxFor({ apple: 60, milk: 90 }),
		);
		expect(space?.totalUnits).toBe(5);
		expect(space?.effectiveTotalCount).toBe(150);
	});

	it("returns null when nothing can be searched", () => {
		expect(buildIngredientSearchSpace(800, {})).toBeNull();
		expect(buildIngredientSearchSpace(800, maxFor({ apple: 29 }))).toBeNull();
		expect(buildIngredientSearchSpace(29, maxFor({ apple: 300 }))).toBeNull();
		expect(buildIngredientSearchSpace(0, maxFor({ apple: 300 }))).toBeNull();
		expect(
			buildIngredientSearchSpace(Number.NaN, maxFor({ apple: 300 })),
		).toBeNull();
	});
});

describe("stock conversions", () => {
	it("round-trips units, stock and initial ingredients", () => {
		const space = buildIngredientSearchSpace(
			180,
			maxFor({ apple: 90, milk: 90, honey: 90 }),
		);
		if (!space) {
			throw new Error("space");
		}
		const units = [3, 2, 1];
		const stock = unitsToStock(units, space);
		expect(stock).toHaveLength(IngredientNames.length);
		expect(stock.reduce((sum, count) => sum + count, 0)).toBe(180);
		const initialIngredients = stockToInitialIngredients(stock);
		expect(Object.keys(initialIngredients)).toHaveLength(
			IngredientNames.length,
		);
		expect(initialIngredients.apple).toBe(90);
		expect(initialIngredients.milk).toBe(60);
		expect(initialIngredients.honey).toBe(30);
		expect(initialIngredients.leek).toBe(0);
		expect(initialIngredientsToStock(initialIngredients)).toEqual(stock);
	});

	it("ignores invalid initial ingredient values", () => {
		const stock = initialIngredientsToStock({
			apple: 12.7,
			milk: -5,
			honey: Number.NaN,
		});
		expect(stock[IngredientNames.indexOf("apple")]).toBe(12);
		expect(stock[IngredientNames.indexOf("milk")]).toBe(0);
		expect(stock[IngredientNames.indexOf("honey")]).toBe(0);
	});
});

describe("start points", () => {
	const allMax = Object.fromEntries(
		IngredientNames.map((name) => [name, 210]),
	) as Partial<Record<IngredientName, number>>;

	it("orders fillers by strength with locked ingredients last", () => {
		const space = buildIngredientSearchSpace(300, allMax);
		if (!space) {
			throw new Error("space");
		}
		const order = buildFillerOrder(
			space,
			cookingSettings({ disabledExtraIngredients: { tail: true } }),
		);
		expect(order).toHaveLength(space.ingredientIndexes.length);
		const names = order.map((position) => nameAt(space, position));
		expect(names[names.length - 1]).toBe("tail");
		const unlocked = names.slice(0, -1);
		for (let index = 1; index < unlocked.length; index++) {
			expect(ingredientStrength[unlocked[index - 1]]).toBeGreaterThanOrEqual(
				ingredientStrength[unlocked[index]],
			);
		}
	});

	it("allocates a recipe start point proportionally and within caps", () => {
		const space = buildIngredientSearchSpace(
			300,
			maxFor({ soy: 120, leek: 120, sausage: 120, mushroom: 120, apple: 120 }),
		);
		const recipe = getRecipeByName("ninjaCurry");
		if (!space || !recipe) {
			throw new Error("fixture");
		}
		const fillerOrder = buildFillerOrder(space, cookingSettings());
		const units = buildRecipeStartUnits(recipe, space, fillerOrder);
		expect(units).not.toBeNull();
		if (!units) {
			return;
		}
		expect(isWithinIngredientSpace(units, space)).toBe(true);
		const byName = Object.fromEntries(
			units.map((value, position) => [nameAt(space, position), value]),
		);
		// soy 24 / leek 12 / sausage 9 / mushroom 5 (50) → 4.8 / 2.4 / 1.8 / 1.0 → 4 / 3 / 2 / 1
		expect(byName.soy).toBe(4);
		expect(byName.leek).toBe(3);
		expect(byName.sausage).toBe(2);
		expect(byName.mushroom).toBe(1);
		expect(byName.apple).toBe(0);
	});

	it("moves capped overflow to other recipe ingredients before fillers", () => {
		const space = buildIngredientSearchSpace(
			300,
			maxFor({ soy: 30, leek: 60, sausage: 300, mushroom: 300, apple: 300 }),
		);
		const recipe = getRecipeByName("ninjaCurry");
		if (!space || !recipe) {
			throw new Error("fixture");
		}
		const units = buildRecipeStartUnits(
			recipe,
			space,
			buildFillerOrder(space, cookingSettings()),
		);
		if (!units) {
			throw new Error("units");
		}
		expect(isWithinIngredientSpace(units, space)).toBe(true);
		const byName = Object.fromEntries(
			units.map((value, position) => [nameAt(space, position), value]),
		);
		expect(byName.soy).toBe(1);
		expect(byName.leek).toBe(2);
		expect(byName.apple).toBe(0);
		expect(byName.sausage + byName.mushroom).toBe(7);
	});

	it("returns null for a recipe whose ingredients are all outside the space", () => {
		const space = buildIngredientSearchSpace(300, maxFor({ apple: 300 }));
		const recipe = getRecipeByName("ninjaCurry");
		if (!space || !recipe) {
			throw new Error("fixture");
		}
		expect(buildRecipeStartUnits(recipe, space, [0])).toBeNull();
	});

	it("fills the filler start point in filler order up to the caps", () => {
		const space = buildIngredientSearchSpace(
			150,
			maxFor({ apple: 60, tail: 60, milk: 60 }),
		);
		if (!space) {
			throw new Error("space");
		}
		const fillerOrder = buildFillerOrder(space, cookingSettings());
		const units = buildFillerStartUnits(space, fillerOrder);
		expect(isWithinIngredientSpace(units, space)).toBe(true);
		expect(units[fillerOrder[0]]).toBe(2);
		expect(units[fillerOrder[1]]).toBe(2);
		expect(units[fillerOrder[2]]).toBe(1);
	});

	it("snaps the current stock onto the grid and fixes the total", () => {
		const space = buildIngredientSearchSpace(
			180,
			maxFor({ apple: 90, milk: 90, honey: 90 }),
		);
		if (!space) {
			throw new Error("space");
		}
		const fillerOrder = buildFillerOrder(space, cookingSettings());
		const tooMuch = snapStockToUnits(
			initialIngredientsToStock({ apple: 100, milk: 100, honey: 100 }),
			space,
			fillerOrder,
		);
		expect(isWithinIngredientSpace(tooMuch, space)).toBe(true);
		const tooLittle = snapStockToUnits(
			initialIngredientsToStock({ apple: 44 }),
			space,
			fillerOrder,
		);
		expect(isWithinIngredientSpace(tooLittle, space)).toBe(true);
		expect(
			tooLittle[
				space.ingredientIndexes.indexOf(IngredientNames.indexOf("apple"))
			],
		).toBeGreaterThanOrEqual(1);
		const empty = snapStockToUnits(
			initialIngredientsToStock({}),
			space,
			fillerOrder,
		);
		expect(isWithinIngredientSpace(empty, space)).toBe(true);
	});

	it("builds deduplicated start points that all fit the space", () => {
		const space = buildIngredientSearchSpace(780, allMax);
		if (!space) {
			throw new Error("space");
		}
		const starts = buildIngredientStartUnits(
			cookingSettings({ disabledRecipes: { ninjaCurry: true } }),
			space,
			initialIngredientsToStock({ apple: 300 }),
		);
		expect(starts.length).toBeGreaterThan(20);
		const keys = new Set(starts.map((units) => unitsKey(units)));
		expect(keys.size).toBe(starts.length);
		for (const units of starts) {
			expect(isWithinIngredientSpace(units, space)).toBe(true);
		}
	});
});

describe("generateIngredientNeighborUnits", () => {
	it("moves one unit and swaps within the caps", () => {
		const maxUnits = [2, 3, 1];
		const neighbors = generateIngredientNeighborUnits([2, 1, 0], maxUnits);
		const keys = new Set(neighbors.map((units) => unitsKey(units)));
		expect(keys.has("1,2,0")).toBe(true);
		expect(keys.has("1,1,1")).toBe(true);
		expect(keys.has("2,0,1")).toBe(true);
		// swap 0<->2 would put 2 units where the cap is 1
		expect(keys.has("0,1,2")).toBe(false);
		// swap 0<->1 is allowed (2 ≤ 3 and 1 ≤ 2)
		expect(keys.has("1,2,0")).toBe(true);
		for (const units of neighbors) {
			expect(units.reduce((sum, value) => sum + value, 0)).toBe(3);
			units.forEach((value, position) => {
				expect(value).toBeLessThanOrEqual(maxUnits[position]);
				expect(value).toBeGreaterThanOrEqual(0);
			});
		}
	});

	it("returns no neighbors for a single ingredient", () => {
		expect(generateIngredientNeighborUnits([3], [5])).toEqual([]);
	});
});
