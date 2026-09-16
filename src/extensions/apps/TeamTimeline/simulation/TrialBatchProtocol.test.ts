import { describe, expect, it } from "vitest";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import { SWAP_NONE_POKEMON_ID } from "../types/TimeSlotTypes";
import { buildTrialSimulationInput } from "./MultiTrialSimulator";
import { runSimulation } from "./TimelineSimulator";
import {
	deserializeTrialSimulationInput,
	serializeTrialSimulationInput,
} from "./TrialBatchProtocol";
import {
	createSwapTrialInput,
	createTestBoxItem,
} from "./TrialBatchTestFixtures";

describe("TrialBatchProtocol", () => {
	it("round-trips the input so a trial produces the same result", () => {
		const input = createSwapTrialInput();
		const serialized = serializeTrialSimulationInput(input);
		// postMessage uses structured clone; JSON is a stricter stand-in for
		// the request side, which carries plain data only.
		const cloned = JSON.parse(JSON.stringify(serialized));
		const restored = deserializeTrialSimulationInput(cloned);

		const expected = runSimulation(buildTrialSimulationInput(input, 777));
		const actual = runSimulation(buildTrialSimulationInput(restored, 777));

		expect(actual.teamSummary).toEqual(expected.teamSummary);
		expect(actual.dailySummaries).toEqual(expected.dailySummaries);
		expect(actual.cookingResult?.totalCookingEP).toBe(
			expected.cookingResult?.totalCookingEP,
		);
		expect([...actual.slotResults.keys()]).toEqual([
			...expected.slotResults.keys(),
		]);
	});

	it("includes swap targets that only exist in the box", () => {
		const input = createSwapTrialInput();
		const serialized = serializeTrialSimulationInput(input);
		const swapTargetIds = new Set(
			(input.swaps ?? [])
				.map((swap) => swap.newPokemonId)
				.filter((id) => id !== SWAP_NONE_POKEMON_ID),
		);
		expect(swapTargetIds.size).toBeGreaterThan(0);
		const serializedIds = new Set(serialized.boxItems.map((item) => item.id));
		for (const id of swapTargetIds) {
			expect(serializedIds.has(id)).toBe(true);
		}
		expect(serialized.teamIds).toEqual(
			input.team.map((pokemon) => pokemon?.id ?? null),
		);
	});

	it("carries display names resolved on the sending side", () => {
		const input = createSwapTrialInput();
		const restored = deserializeTrialSimulationInput(
			serializeTrialSimulationInput(input),
		);
		const pikachu = restored.team.find((pokemon) => pokemon?.id === 1);
		expect(pikachu).toBeDefined();
		expect(pikachu?.nickname).toBe("ピカ");
		expect(restored.resolvePokemonName?.(pikachu as PokemonBoxItem)).toBe(
			"name:1",
		);
		// Unknown ids fall back to nickname / internal name, never throw.
		const stranger = createTestBoxItem("Ditto", 999, "メタ");
		expect(restored.resolvePokemonName?.(stranger)).toBe("メタ");
	});

	it("passes the pre-built StrengthParameter through", () => {
		const input = createSwapTrialInput();
		const restored = deserializeTrialSimulationInput(
			serializeTrialSimulationInput(input),
		);
		expect(restored.strengthParameter).toBeDefined();
		expect(restored.strengthParameter?.fieldIndex).toBe(
			input.bonusSettings.fieldIndex,
		);
		expect(restored.strengthParameter?.fieldBonus).toBe(
			input.bonusSettings.fieldBonus,
		);
	});
});
