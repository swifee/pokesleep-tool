import { describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
} from "../types/TimeSlotTypes";
import {
	buildStrengthParameterFromTimelineBonusSettings,
	createDefaultTimelineBonusSettings,
} from "../utils/TimelineBonusSettingsBridge";
import type { QuickSimEvaluatorContext } from "./QuickSimEvaluator";
import {
	deserializeQuickSimEvaluatorContext,
	serializeQuickSimEvaluatorContext,
} from "./QuickSimOptimizerWorkerProtocol";

describe("QuickSimOptimizerWorkerProtocol", () => {
	it("round-trips the evaluator context through plain data", () => {
		const pikachu = new PokemonBoxItem(
			new PokemonIv({ pokemonName: "Pikachu", level: 40 }),
			"ピカ",
			11,
		);
		const eevee = new PokemonBoxItem(
			new PokemonIv({ pokemonName: "Eevee", level: 25 }),
			"",
			12,
		);
		const other = new PokemonBoxItem(
			new PokemonIv({ pokemonName: "Bulbasaur" }),
			"",
			13,
		);
		const bonusSettings = {
			...createDefaultTimelineBonusSettings(),
			fieldBonus: 35,
		};
		const context: QuickSimEvaluatorContext = {
			box: new PokemonBox([pikachu, eevee, other]),
			members: [
				{ pokemonId: 12, usageMode: "sleep" },
				{ pokemonId: 11, usageMode: "even" },
			],
			timeSlots: DEFAULT_TIME_SLOTS,
			simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, simulationDays: 3 },
			bonusSettings,
			cookingSettings: { ...createDefaultCookingSettings(), enabled: true },
			strengthParameter:
				buildStrengthParameterFromTimelineBonusSettings(bonusSettings),
		};

		const serialized = serializeQuickSimEvaluatorContext(context);
		// postMessage と同じく構造化クローンできる
		const cloned = structuredClone(serialized);
		const restored = deserializeQuickSimEvaluatorContext(cloned);

		expect(restored.members).toEqual(context.members);
		expect(restored.box.items.map((item) => item.id)).toEqual([12, 11]);
		const restoredPikachu = restored.box.getById(11);
		expect(restoredPikachu?.nickname).toBe("ピカ");
		expect(restoredPikachu?.iv.pokemonName).toBe("Pikachu");
		expect(restoredPikachu?.iv.level).toBe(40);
		expect(restored.box.getById(12)?.iv.level).toBe(25);
		expect(restored.box.getById(13)).toBeNull();
		expect(restored.timeSlots).toEqual(DEFAULT_TIME_SLOTS);
		expect(restored.simulationConfig).toEqual(context.simulationConfig);
		expect(restored.cookingSettings.enabled).toBe(true);
		expect(restored.bonusSettings).toEqual(context.bonusSettings);
		expect(restored.strengthParameter).toEqual(context.strengthParameter);
		expect(restored.strengthParameter.fieldBonus).toBe(35);
	});

	it("rejects members that are not in the box", () => {
		const bonusSettings = createDefaultTimelineBonusSettings();
		const context: QuickSimEvaluatorContext = {
			box: new PokemonBox([]),
			members: [{ pokemonId: 1, usageMode: "even" }],
			timeSlots: DEFAULT_TIME_SLOTS,
			simulationConfig: DEFAULT_SIMULATION_CONFIG,
			bonusSettings,
			cookingSettings: createDefaultCookingSettings(),
			strengthParameter:
				buildStrengthParameterFromTimelineBonusSettings(bonusSettings),
		};
		expect(() => serializeQuickSimEvaluatorContext(context)).toThrow();
	});
});
