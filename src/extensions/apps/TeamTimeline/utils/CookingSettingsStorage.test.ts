import { beforeEach, describe, expect, it } from "vitest";
import {
	type CookingSimulationSettings,
	createDefaultCookingSettings,
	createDefaultInitialIngredientsSettings,
} from "../types/CookingTypes";
import {
	loadCookingSettingsFromStorage,
	loadQuickSimInitialIngredientsFromStorage,
	normalizeInitialIngredientsSettings,
	STORAGE_KEY_COOKING_SETTINGS,
	STORAGE_KEY_QUICK_SIM_INITIAL_INGREDIENTS,
	saveCookingSettingsToStorage,
	saveQuickSimInitialIngredientsToStorage,
} from "./CookingSettingsStorage";

describe("normalizeInitialIngredientsSettings", () => {
	it("keeps valid counts and locks and drops everything else", () => {
		expect(
			normalizeInitialIngredientsSettings({
				initialIngredients: {
					apple: 30,
					honey: 0,
					unknown: 10,
					tail: -1,
					milk: "12",
					egg: Number.NaN,
				},
				disabledExtraIngredients: {
					apple: true,
					honey: false,
					unknown: true,
					tail: "yes",
				},
			}),
		).toEqual({
			initialIngredients: { apple: 30, honey: 0 },
			disabledExtraIngredients: { apple: true, honey: false },
		});
	});

	it("returns empty settings for non-object input", () => {
		expect(normalizeInitialIngredientsSettings(null)).toEqual(
			createDefaultInitialIngredientsSettings(),
		);
		expect(normalizeInitialIngredientsSettings([1, 2])).toEqual(
			createDefaultInitialIngredientsSettings(),
		);
		expect(
			normalizeInitialIngredientsSettings({
				initialIngredients: [30],
				disabledExtraIngredients: "apple",
			}),
		).toEqual(createDefaultInitialIngredientsSettings());
	});
});

describe("cooking settings storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("round-trips the detailed sim initial ingredients inside the cooking settings", () => {
		saveCookingSettingsToStorage({
			...createDefaultCookingSettings(),
			enabled: true,
			initialIngredients: { apple: 30 },
			disabledExtraIngredients: { honey: true },
		});

		const loaded = loadCookingSettingsFromStorage();
		expect(loaded.enabled).toBe(true);
		expect(loaded.initialIngredients).toEqual({ apple: 30 });
		expect(loaded.disabledExtraIngredients).toEqual({ honey: true });
	});

	it("falls back to defaults when the cooking settings are broken", () => {
		localStorage.setItem(STORAGE_KEY_COOKING_SETTINGS, "{not json");
		expect(loadCookingSettingsFromStorage()).toEqual(
			createDefaultCookingSettings(),
		);
	});
});

describe("quick sim initial ingredients storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	const fallback = {
		...createDefaultCookingSettings(),
		initialIngredients: { apple: 30 },
		disabledExtraIngredients: { honey: true },
	};

	it("uses the fallback (detailed sim values) when nothing is stored yet", () => {
		expect(loadQuickSimInitialIngredientsFromStorage(fallback)).toEqual({
			initialIngredients: { apple: 30 },
			disabledExtraIngredients: { honey: true },
		});
	});

	it("saves only the initial ingredient fields and loads them back", () => {
		const fullCookingSettings: CookingSimulationSettings = {
			...createDefaultCookingSettings(),
			enabled: true,
			initialIngredients: { milk: 12 },
			disabledExtraIngredients: { tail: true },
		};
		saveQuickSimInitialIngredientsToStorage(fullCookingSettings);

		expect(
			JSON.parse(
				localStorage.getItem(STORAGE_KEY_QUICK_SIM_INITIAL_INGREDIENTS) ?? "",
			),
		).toEqual({
			initialIngredients: { milk: 12 },
			disabledExtraIngredients: { tail: true },
		});
		expect(loadQuickSimInitialIngredientsFromStorage(fallback)).toEqual({
			initialIngredients: { milk: 12 },
			disabledExtraIngredients: { tail: true },
		});
	});

	it("keeps an explicitly empty stored value instead of the fallback", () => {
		saveQuickSimInitialIngredientsToStorage(
			createDefaultInitialIngredientsSettings(),
		);
		expect(loadQuickSimInitialIngredientsFromStorage(fallback)).toEqual(
			createDefaultInitialIngredientsSettings(),
		);
	});

	it("falls back when the stored value is broken", () => {
		localStorage.setItem(STORAGE_KEY_QUICK_SIM_INITIAL_INGREDIENTS, "{oops");
		expect(loadQuickSimInitialIngredientsFromStorage(fallback)).toEqual({
			initialIngredients: { apple: 30 },
			disabledExtraIngredients: { honey: true },
		});
	});
});
