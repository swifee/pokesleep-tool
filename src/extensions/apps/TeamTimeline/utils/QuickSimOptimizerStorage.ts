/**
 * QuickSimOptimizerStorage.ts
 * 起用率最適化パネルの初期食材の探索設定（合計・食材ごとの上限）の正規化と
 * localStorage への永続化。対象（起用率 / 初期食材 / 両方）は保存しない。
 */

import {
	type IngredientName,
	IngredientNames,
} from "../../../../data/pokemons";
import {
	createDefaultQuickSimIngredientSearchSettings,
	QUICK_SIM_INGREDIENT_COUNT_LIMIT,
	type QuickSimIngredientSearchSettings,
} from "../types/QuickSimOptimizerTypes";

export const STORAGE_KEY_QUICK_SIM_OPTIMIZER =
	"PstTeamTimelineQuickSimOptimizerV1";

function normalizeCount(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(
		0,
		Math.min(QUICK_SIM_INGREDIENT_COUNT_LIMIT, Math.floor(value)),
	);
}

/** 不正な値を既定値に置き換える。個数は 0〜上限の整数に丸める */
export function normalizeQuickSimIngredientSearchSettings(
	parsed: unknown,
): QuickSimIngredientSearchSettings {
	const defaults = createDefaultQuickSimIngredientSearchSettings();
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return defaults;
	}
	const record = parsed as Record<string, unknown>;
	const maxCountByIngredient: Partial<Record<IngredientName, number>> = {};
	const rawMax = record.maxCountByIngredient;
	if (typeof rawMax === "object" && rawMax !== null && !Array.isArray(rawMax)) {
		const maxRecord = rawMax as Record<string, unknown>;
		for (const name of IngredientNames) {
			const value = maxRecord[name];
			if (value === undefined) {
				continue;
			}
			maxCountByIngredient[name] = normalizeCount(value, 0);
		}
	}
	return {
		totalCount: normalizeCount(record.totalCount, defaults.totalCount),
		maxCountByIngredient,
	};
}

export function saveQuickSimIngredientSearchSettings(
	settings: QuickSimIngredientSearchSettings,
): void {
	try {
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM_OPTIMIZER,
			JSON.stringify(settings),
		);
	} catch {
		// 保存できない環境（容量超過・プライベートモードなど）では黙って諦める
	}
}

export function loadQuickSimIngredientSearchSettings(): QuickSimIngredientSearchSettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY_QUICK_SIM_OPTIMIZER);
		if (!raw) {
			return createDefaultQuickSimIngredientSearchSettings();
		}
		return normalizeQuickSimIngredientSearchSettings(JSON.parse(raw));
	} catch {
		return createDefaultQuickSimIngredientSearchSettings();
	}
}
