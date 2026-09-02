/**
 * ProvisionalSettingsStorage.ts
 * 仮設定（未公開パラメータ）の正規化と localStorage への永続化。
 */

import {
	BERRY_ZONE_MAX_BONUS_PERCENT,
	BERRY_ZONE_MAX_SKILL_LEVEL,
	BERRY_ZONE_MAX_SNORLAX_ENERGY,
	BERRY_ZONE_MAX_STACK_LIMIT,
	type BerryZoneProvisionalSettings,
	createDefaultBerryZoneSettings,
	createDefaultPlaceholderPokemonSettings,
	createDefaultProvisionalSettings,
	PLACEHOLDER_MAX_CARRY_LIMIT,
	PLACEHOLDER_MAX_FREQUENCY_SECONDS,
	PLACEHOLDER_MAX_SKILL_RATE_PERCENT,
	PLACEHOLDER_MIN_FREQUENCY_SECONDS,
	type PlaceholderPokemonProvisionalSettings,
	type ProvisionalSettings,
} from "../types/ProvisionalSettingsTypes";

export const STORAGE_KEY_PROVISIONAL_SETTINGS =
	"PstTeamTimelineProvisionalSettings";

function clampNumber(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(min, Math.min(max, value));
}

function clampInteger(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function toRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function normalizeSnorlaxEnergyByLevel(
	value: unknown,
	fallback: readonly number[],
): number[] {
	const source = Array.isArray(value) ? value : [];
	const normalized: number[] = [];
	for (let level = 0; level < BERRY_ZONE_MAX_SKILL_LEVEL; level += 1) {
		normalized.push(
			clampInteger(
				source[level],
				0,
				BERRY_ZONE_MAX_SNORLAX_ENERGY,
				fallback[level] ?? 0,
			),
		);
	}
	return normalized;
}

/** きのみゾーンの仮パラメータを正規化する */
export function normalizeBerryZoneSettings(
	input: unknown,
): BerryZoneProvisionalSettings {
	const defaults = createDefaultBerryZoneSettings();
	const raw = toRecord(input);
	if (raw === null) {
		return defaults;
	}

	const maxStackCount = clampInteger(
		raw.maxStackCount,
		1,
		BERRY_ZONE_MAX_STACK_LIMIT,
		defaults.maxStackCount,
	);

	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
		maxStackCount,
		initialStackCount: clampInteger(
			raw.initialStackCount,
			0,
			maxStackCount,
			Math.min(defaults.initialStackCount, maxStackCount),
		),
		berryEnergyBonusPercent: clampNumber(
			raw.berryEnergyBonusPercent,
			0,
			BERRY_ZONE_MAX_BONUS_PERCENT,
			defaults.berryEnergyBonusPercent,
		),
		snorlaxEnergyByLevel: normalizeSnorlaxEnergyByLevel(
			raw.snorlaxEnergyByLevel,
			defaults.snorlaxEnergyByLevel,
		),
	};
}

/** データ未公開ポケモンの仮ステータスを正規化する */
export function normalizePlaceholderPokemonSettings(
	input: unknown,
): PlaceholderPokemonProvisionalSettings {
	const defaults = createDefaultPlaceholderPokemonSettings();
	const raw = toRecord(input);
	if (raw === null) {
		return defaults;
	}

	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
		helpingFrequencySeconds: clampInteger(
			raw.helpingFrequencySeconds,
			PLACEHOLDER_MIN_FREQUENCY_SECONDS,
			PLACEHOLDER_MAX_FREQUENCY_SECONDS,
			defaults.helpingFrequencySeconds,
		),
		skillRatePercent: clampNumber(
			raw.skillRatePercent,
			0,
			PLACEHOLDER_MAX_SKILL_RATE_PERCENT,
			defaults.skillRatePercent,
		),
		carryLimit: clampInteger(
			raw.carryLimit,
			0,
			PLACEHOLDER_MAX_CARRY_LIMIT,
			defaults.carryLimit,
		),
	};
}

/** 仮設定を正規化する */
export function normalizeProvisionalSettings(
	input: unknown,
): ProvisionalSettings {
	const raw = toRecord(input);
	if (raw === null) {
		return createDefaultProvisionalSettings();
	}
	return {
		berryZone: normalizeBerryZoneSettings(raw.berryZone),
		placeholderPokemon: normalizePlaceholderPokemonSettings(
			raw.placeholderPokemon,
		),
	};
}

/** 仮設定を localStorage に保存 */
export function saveProvisionalSettingsToStorage(
	settings: ProvisionalSettings,
): void {
	localStorage.setItem(
		STORAGE_KEY_PROVISIONAL_SETTINGS,
		JSON.stringify(settings),
	);
}

/** 仮設定を localStorage から読み込み */
export function loadProvisionalSettingsFromStorage(): ProvisionalSettings {
	const raw = localStorage.getItem(STORAGE_KEY_PROVISIONAL_SETTINGS);
	if (!raw) {
		return createDefaultProvisionalSettings();
	}
	try {
		return normalizeProvisionalSettings(JSON.parse(raw));
	} catch {
		return createDefaultProvisionalSettings();
	}
}
