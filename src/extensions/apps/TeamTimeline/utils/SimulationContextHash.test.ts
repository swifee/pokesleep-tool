import { describe, expect, it } from "vitest";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import { DEFAULT_TIME_SLOTS, MONDAY, SUNDAY } from "../types/TimeSlotTypes";
import { buildSimulationContextHash } from "./SimulationContextHash";
import { createDefaultTimelineBonusSettings } from "./TimelineBonusSettingsBridge";

function createBaseContext() {
	return {
		bonusSettings: createDefaultTimelineBonusSettings(),
		cookingSettings: createDefaultCookingSettings(),
		initialEnergy: 50,
		simulationDays: 3,
		pityProc: true,
		startDayOfWeek: MONDAY,
		timeSlots: DEFAULT_TIME_SLOTS,
	};
}

describe("buildSimulationContextHash", () => {
	it("returns the same hash for the same context", () => {
		const hash1 = buildSimulationContextHash(createBaseContext());
		const hash2 = buildSimulationContextHash(createBaseContext());

		expect(hash1).toBe(hash2);
	});

	it("changes when simulationDays changes", () => {
		const hash1 = buildSimulationContextHash({
			...createBaseContext(),
			simulationDays: 3,
		});
		const hash2 = buildSimulationContextHash({
			...createBaseContext(),
			simulationDays: 4,
		});

		expect(hash1).not.toBe(hash2);
	});

	it("changes when pityProc changes", () => {
		const hash1 = buildSimulationContextHash({
			...createBaseContext(),
			pityProc: true,
		});
		const hash2 = buildSimulationContextHash({
			...createBaseContext(),
			pityProc: false,
		});

		expect(hash1).not.toBe(hash2);
	});

	it("changes when startDayOfWeek changes", () => {
		const hash1 = buildSimulationContextHash({
			...createBaseContext(),
			startDayOfWeek: MONDAY,
		});
		const hash2 = buildSimulationContextHash({
			...createBaseContext(),
			startDayOfWeek: SUNDAY,
		});

		expect(hash1).not.toBe(hash2);
	});

	it("changes when cooking settings changes", () => {
		const baseCooking = createDefaultCookingSettings();
		const hash1 = buildSimulationContextHash({
			...createBaseContext(),
			cookingSettings: baseCooking,
		});
		const hash2 = buildSimulationContextHash({
			...createBaseContext(),
			cookingSettings: {
				...baseCooking,
				basePotCapacity: baseCooking.basePotCapacity + 1,
			},
		});

		expect(hash1).not.toBe(hash2);
	});

	it("keeps the same hash even if object key order differs", () => {
		const cookingSettingsA = {
			...createDefaultCookingSettings(),
			recipeLevels: { recipeA: 55, recipeB: 12 },
			disabledRecipes: { recipeA: true, recipeB: false },
		};
		const cookingSettingsB = {
			...createDefaultCookingSettings(),
			recipeLevels: { recipeB: 12, recipeA: 55 },
			disabledRecipes: { recipeB: false, recipeA: true },
		};
		const hash1 = buildSimulationContextHash({
			...createBaseContext(),
			cookingSettings: cookingSettingsA,
		});
		const hash2 = buildSimulationContextHash({
			...createBaseContext(),
			cookingSettings: cookingSettingsB,
		});

		expect(hash1).toBe(hash2);
	});
});
