import {
	type IngredientName,
	IngredientNames,
} from "../../../../data/pokemons";
import {
	type CookingCategory,
	type CookingSimulationSettings,
	createDefaultCookingSettings,
	type InitialIngredientsSettings,
	MAX_RECIPE_LEVEL,
	MIN_RECIPE_LEVEL,
	pickInitialIngredientsSettings,
} from "../types/CookingTypes";

export const STORAGE_KEY_COOKING_SETTINGS = "PstTeamTimelineCookingSettings";
/** 自動シミュ用の初期食材。料理設定に含まれる初期食材は詳細シミュ用 */
export const STORAGE_KEY_QUICK_SIM_INITIAL_INGREDIENTS =
	"PstTeamTimelineQuickSimInitialIngredients";

const VALID_CATEGORIES: readonly CookingCategory[] = [
	"curry",
	"salad",
	"dessert",
];
const MIN_POT_CAPACITY = 12;
const MAX_POT_CAPACITY = 99;
const POT_CAPACITY_STEP = 3;

function normalizePotCapacity(value: number): number {
	const clamped = Math.max(
		MIN_POT_CAPACITY,
		Math.min(MAX_POT_CAPACITY, Math.floor(value)),
	);
	return clamped - (clamped % POT_CAPACITY_STEP);
}

/** 料理設定をlocalStorageに保存 */
export function saveCookingSettingsToStorage(
	settings: CookingSimulationSettings,
): void {
	localStorage.setItem(STORAGE_KEY_COOKING_SETTINGS, JSON.stringify(settings));
}

/** 料理設定をlocalStorageから読み込み */
export function loadCookingSettingsFromStorage(): CookingSimulationSettings {
	const raw = localStorage.getItem(STORAGE_KEY_COOKING_SETTINGS);
	if (!raw) {
		return createDefaultCookingSettings();
	}
	try {
		const parsed = JSON.parse(raw);
		return normalizeCookingSettings(parsed);
	} catch {
		return createDefaultCookingSettings();
	}
}

/** 不正な値を正規化 */
function normalizeCookingSettings(parsed: unknown): CookingSimulationSettings {
	const defaults = createDefaultCookingSettings();

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return defaults;
	}

	const obj = parsed as Record<string, unknown>;

	// Validate enabled is boolean (default false)
	const enabled =
		typeof obj.enabled === "boolean" ? obj.enabled : defaults.enabled;

	// Validate category is 'curry' | 'salad' | 'dessert' (default 'curry')
	const category: CookingCategory =
		typeof obj.category === "string" &&
		VALID_CATEGORIES.includes(obj.category as CookingCategory)
			? (obj.category as CookingCategory)
			: defaults.category;

	// Validate recipeLevels is object with number values clamped to the recipe level range
	const recipeLevels: Record<string, number> = {};
	if (
		typeof obj.recipeLevels === "object" &&
		obj.recipeLevels !== null &&
		!Array.isArray(obj.recipeLevels)
	) {
		const levels = obj.recipeLevels as Record<string, unknown>;
		for (const [key, value] of Object.entries(levels)) {
			if (typeof value === "number" && Number.isFinite(value)) {
				recipeLevels[key] = Math.max(
					MIN_RECIPE_LEVEL,
					Math.min(MAX_RECIPE_LEVEL, Math.floor(value)),
				);
			}
		}
	}

	// Validate basePotCapacity is integer in 12-99 and divisible by 3 (default 81)
	const basePotCapacity =
		typeof obj.basePotCapacity === "number" &&
		Number.isFinite(obj.basePotCapacity)
			? normalizePotCapacity(obj.basePotCapacity)
			: defaults.basePotCapacity;

	const { initialIngredients, disabledExtraIngredients } =
		normalizeInitialIngredientsSettings(obj);

	// Validate disabledRecipes is object with boolean values
	const disabledRecipes: Record<string, boolean> = {};
	if (
		typeof obj.disabledRecipes === "object" &&
		obj.disabledRecipes !== null &&
		!Array.isArray(obj.disabledRecipes)
	) {
		const recipes = obj.disabledRecipes as Record<string, unknown>;
		for (const [key, value] of Object.entries(recipes)) {
			if (typeof value === "boolean") {
				disabledRecipes[key] = value;
			}
		}
	}

	return {
		enabled,
		category,
		recipeLevels,
		basePotCapacity,
		initialIngredients,
		disabledRecipes,
		disabledExtraIngredients,
	};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 初期食材まわりの不正な値を正規化。未知の食材名や不正な値は捨てる */
export function normalizeInitialIngredientsSettings(
	parsed: unknown,
): InitialIngredientsSettings {
	const obj = isPlainObject(parsed) ? parsed : {};

	// Validate initialIngredients is object with non-negative number values
	const initialIngredients: Partial<Record<IngredientName, number>> = {};
	if (isPlainObject(obj.initialIngredients)) {
		for (const [key, value] of Object.entries(obj.initialIngredients)) {
			if (
				IngredientNames.includes(key as IngredientName) &&
				typeof value === "number" &&
				Number.isFinite(value) &&
				value >= 0
			) {
				initialIngredients[key as IngredientName] = value;
			}
		}
	}

	// Validate disabledExtraIngredients is object with ingredientName->boolean values
	const disabledExtraIngredients: Partial<Record<IngredientName, boolean>> = {};
	if (isPlainObject(obj.disabledExtraIngredients)) {
		for (const [key, value] of Object.entries(obj.disabledExtraIngredients)) {
			if (
				IngredientNames.includes(key as IngredientName) &&
				typeof value === "boolean"
			) {
				disabledExtraIngredients[key as IngredientName] = value;
			}
		}
	}

	return { initialIngredients, disabledExtraIngredients };
}

/** 自動シミュ用の初期食材をlocalStorageに保存 */
export function saveQuickSimInitialIngredientsToStorage(
	settings: InitialIngredientsSettings,
): void {
	localStorage.setItem(
		STORAGE_KEY_QUICK_SIM_INITIAL_INGREDIENTS,
		JSON.stringify(pickInitialIngredientsSettings(settings)),
	);
}

/**
 * 自動シミュ用の初期食材をlocalStorageから読み込み。
 * 未保存なら fallback（料理設定に保存されていた詳細シミュ用の値）をそのまま使い、
 * 分離前と同じ値で自動シミュを始められるようにする。
 */
export function loadQuickSimInitialIngredientsFromStorage(
	fallback: InitialIngredientsSettings,
): InitialIngredientsSettings {
	const raw = localStorage.getItem(STORAGE_KEY_QUICK_SIM_INITIAL_INGREDIENTS);
	if (raw === null) {
		return pickInitialIngredientsSettings(fallback);
	}
	try {
		return normalizeInitialIngredientsSettings(JSON.parse(raw));
	} catch {
		return pickInitialIngredientsSettings(fallback);
	}
}
