import { describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	type CookingSimulationSettings,
	createDefaultCookingSettings,
} from "../types/CookingTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
} from "../types/TimeSlotTypes";
import {
	buildStrengthParameterFromTimelineBonusSettings,
	createDefaultTimelineBonusSettings,
} from "../utils/TimelineBonusSettingsBridge";
import {
	calculateGrandTotalEPWithCooking,
	runHelpingSimulation,
	runSimulation,
	type SimulationInput,
} from "./TimelineSimulator";

const NAMES = ["Pikachu", "Eevee", "Bulbasaur", "Charmander", "Squirtle"];

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName, level: 30 }), "", id);
}

function createCookingSettings(
	initialIngredients: CookingSimulationSettings["initialIngredients"],
	enabled = true,
): CookingSimulationSettings {
	return {
		...createDefaultCookingSettings(),
		enabled,
		category: "curry",
		initialIngredients,
	};
}

function createInput(
	cookingSettings: CookingSimulationSettings,
	overrides: Partial<SimulationInput> = {},
): SimulationInput {
	const items = NAMES.map((name, index) => createItem(name, index + 1));
	const bonusSettings = createDefaultTimelineBonusSettings();
	return {
		team: items,
		timeSlots: DEFAULT_TIME_SLOTS,
		config: { ...DEFAULT_SIMULATION_CONFIG, seed: 777, simulationDays: 7 },
		bonusSettings,
		box: new PokemonBox(items),
		cookingSettings,
		strengthParameter:
			buildStrengthParameterFromTimelineBonusSettings(bonusSettings),
		analysisOptions: { perPokemonRandomStreams: true },
		...overrides,
	};
}

describe("runHelpingSimulation + calculateGrandTotalEPWithCooking", () => {
	it("matches runSimulation exactly when cooking is enabled with initial ingredients", () => {
		const cookingSettings = createCookingSettings({ apple: 60, milk: 30 });
		const input = createInput(cookingSettings);
		const expected = runSimulation(input).teamSummary.grandTotalEP;

		const snapshot = runHelpingSimulation(input);
		expect(snapshot.isEmpty).toBe(false);
		expect(snapshot.slotResults.size).toBeGreaterThan(0);
		expect(calculateGrandTotalEPWithCooking(snapshot, cookingSettings)).toBe(
			expected,
		);
	});

	it("re-applies different initial ingredients to the same snapshot", () => {
		const input = createInput(createCookingSettings({}));
		const snapshot = runHelpingSimulation(input);
		const stocks: CookingSimulationSettings["initialIngredients"][] = [
			{ apple: 90 },
			{ soy: 60, tomato: 60, mushroom: 30, coffee: 30 },
			{ sausage: 210, honey: 210 },
		];
		for (const stock of stocks) {
			const cookingSettings = createCookingSettings(stock);
			const expected = runSimulation({ ...input, cookingSettings }).teamSummary
				.grandTotalEP;
			expect(calculateGrandTotalEPWithCooking(snapshot, cookingSettings)).toBe(
				expected,
			);
		}
	});

	it("returns the cooking-disabled total when cooking is disabled", () => {
		const disabled = createCookingSettings({ apple: 60 }, false);
		const input = createInput(disabled);
		const snapshot = runHelpingSimulation(input);
		const expected = runSimulation(input).teamSummary.grandTotalEP;
		expect(calculateGrandTotalEPWithCooking(snapshot, disabled)).toBe(expected);
		expect(snapshot.grandTotalEPWithoutCooking).toBe(expected);
	});

	it("returns 0 for an empty simulation even if initial ingredients could cook", () => {
		const cookingSettings = createCookingSettings({ apple: 210 });
		const input = createInput(cookingSettings, {
			team: [null, null, null, null, null],
		});
		const snapshot = runHelpingSimulation(input);
		expect(snapshot.isEmpty).toBe(true);
		expect(calculateGrandTotalEPWithCooking(snapshot, cookingSettings)).toBe(0);
		expect(runSimulation(input).teamSummary.grandTotalEP).toBe(0);
	});
});
