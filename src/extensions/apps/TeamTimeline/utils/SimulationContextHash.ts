import type { CookingSimulationSettings } from "../types/CookingTypes";
import type { ProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import type { TimelineBonusSettings } from "../types/TimelineBonusSettingsTypes";
import type { TimeSlot } from "../types/TimeSlotTypes";

interface SimulationContextHashInput {
	bonusSettings: TimelineBonusSettings;
	cookingSettings: CookingSimulationSettings;
	initialEnergy: number;
	simulationDays: number;
	timeSlots: TimeSlot[];
	/** 仮設定（未指定ならハッシュに含めない） */
	provisionalSettings?: ProvisionalSettings;
}

type StableValue =
	| null
	| boolean
	| number
	| string
	| StableValue[]
	| { [key: string]: StableValue };

function normalizeStableValue(value: unknown): StableValue {
	if (value === null) {
		return null;
	}
	if (typeof value === "boolean" || typeof value === "string") {
		return value;
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (Array.isArray(value)) {
		return value.map((item) => normalizeStableValue(item));
	}
	if (typeof value === "object") {
		const normalized: { [key: string]: StableValue } = {};
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, entryValue]) => entryValue !== undefined)
			.sort(([left], [right]) => left.localeCompare(right));
		entries.forEach(([key, entryValue]) => {
			normalized[key] = normalizeStableValue(entryValue);
		});
		return normalized;
	}
	return String(value);
}

function stableStringify(value: unknown): string {
	return JSON.stringify(normalizeStableValue(value));
}

function createHash(source: string): string {
	let hash = 2166136261;
	for (let index = 0; index < source.length; index += 1) {
		hash ^= source.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildSimulationContextHash(
	input: SimulationContextHashInput,
): string {
	return createHash(
		stableStringify({
			bonusSettings: input.bonusSettings,
			cookingSettings: input.cookingSettings,
			initialEnergy: input.initialEnergy,
			simulationDays: input.simulationDays,
			timeSlots: input.timeSlots,
			provisionalSettings: input.provisionalSettings,
		}),
	);
}
