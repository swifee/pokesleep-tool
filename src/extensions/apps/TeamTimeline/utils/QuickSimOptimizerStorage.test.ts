import { beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_QUICK_SIM_INGREDIENT_TOTAL_COUNT,
	QUICK_SIM_INGREDIENT_COUNT_LIMIT,
} from "../types/QuickSimOptimizerTypes";
import {
	loadQuickSimIngredientSearchSettings,
	normalizeQuickSimIngredientSearchSettings,
	STORAGE_KEY_QUICK_SIM_OPTIMIZER,
	saveQuickSimIngredientSearchSettings,
} from "./QuickSimOptimizerStorage";

describe("QuickSimOptimizerStorage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns the defaults when nothing is stored or the value is garbage", () => {
		expect(loadQuickSimIngredientSearchSettings()).toEqual({
			totalCount: DEFAULT_QUICK_SIM_INGREDIENT_TOTAL_COUNT,
			maxCountByIngredient: {},
		});
		localStorage.setItem(STORAGE_KEY_QUICK_SIM_OPTIMIZER, "{not json");
		expect(loadQuickSimIngredientSearchSettings().totalCount).toBe(
			DEFAULT_QUICK_SIM_INGREDIENT_TOTAL_COUNT,
		);
		expect(normalizeQuickSimIngredientSearchSettings([1, 2])).toEqual({
			totalCount: DEFAULT_QUICK_SIM_INGREDIENT_TOTAL_COUNT,
			maxCountByIngredient: {},
		});
	});

	it("clamps counts to non-negative integers within the limit and drops unknown ingredients", () => {
		const normalized = normalizeQuickSimIngredientSearchSettings({
			totalCount: 12345.6,
			maxCountByIngredient: {
				apple: 210.9,
				milk: -30,
				honey: "60",
				unknownIngredient: 90,
				soy: Number.POSITIVE_INFINITY,
			},
		});
		expect(normalized.totalCount).toBe(QUICK_SIM_INGREDIENT_COUNT_LIMIT);
		expect(normalized.maxCountByIngredient).toEqual({
			apple: 210,
			milk: 0,
			honey: 0,
			soy: 0,
		});
	});

	it("round-trips through localStorage", () => {
		saveQuickSimIngredientSearchSettings({
			totalCount: 800,
			maxCountByIngredient: { apple: 210, tomato: 60 },
		});
		expect(loadQuickSimIngredientSearchSettings()).toEqual({
			totalCount: 800,
			maxCountByIngredient: { apple: 210, tomato: 60 },
		});
	});
});
