import { describe, expect, it } from "vitest";
import PokemonBox, { type PokemonBoxItem } from "../../../../util/PokemonBox";
import type { PokemonSwap, TimeSlot } from "../types/TimeSlotTypes";
import { buildSwapSupplementSequences } from "./SwapSupplementUtils";

function createPokemon(id: number, idForm: number): PokemonBoxItem {
	return {
		id,
		iv: { idForm },
	} as unknown as PokemonBoxItem;
}

describe("buildSwapSupplementSequences", () => {
	const timeSlots: TimeSlot[] = [
		{ id: "sleep", time: "22:00", sleepState: "sleep", hasMeal: false },
		{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
		{ id: "noon", time: "12:00", sleepState: "none", hasMeal: true },
	];

	it("builds swap chains per swapped slot and skips repeated pokemon in the same chain", () => {
		const pokemonA = createPokemon(1, 101);
		const pokemonB = createPokemon(2, 102);
		const pokemonC = createPokemon(3, 103);
		const pokemonD = createPokemon(4, 104);
		const team: (PokemonBoxItem | null)[] = [
			pokemonA,
			pokemonD,
			null,
			null,
			null,
		];
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "wake",
				teamSlotIndex: 0,
				newPokemonId: pokemonB.id,
				initialEnergy: 100,
			},
			{
				dayIndex: 0,
				slotId: "noon",
				teamSlotIndex: 0,
				newPokemonId: pokemonA.id,
				initialEnergy: 100,
			},
			{
				dayIndex: 1,
				slotId: "wake",
				teamSlotIndex: 0,
				newPokemonId: pokemonC.id,
				initialEnergy: 100,
			},
		];

		const summary = {
			totalTimelineMinutes: 1440,
			activeMinutesByPokemonId: new Map<number, number>([
				[pokemonA.id, 540],
				[pokemonB.id, 360],
				[pokemonC.id, 540],
				[pokemonD.id, 1440],
			]),
		};
		const sequences = buildSwapSupplementSequences({
			team,
			swaps,
			timeSlots,
			durationSummary: summary,
			box: new PokemonBox([pokemonA, pokemonB, pokemonC, pokemonD]),
		});

		expect(sequences).toHaveLength(1);
		expect(sequences[0].teamSlotIndex).toBe(0);
		expect(sequences[0].entries.map((entry) => entry.pokemonId)).toEqual([
			pokemonA.id,
			pokemonB.id,
			pokemonC.id,
		]);
	});

	it("includes active minutes and ratio for each displayed pokemon", () => {
		const pokemonA = createPokemon(1, 101);
		const pokemonB = createPokemon(2, 102);
		const team: (PokemonBoxItem | null)[] = [pokemonA, null, null, null, null];
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "wake",
				teamSlotIndex: 0,
				newPokemonId: pokemonB.id,
				initialEnergy: 100,
			},
		];
		const summary = {
			totalTimelineMinutes: 1000,
			activeMinutesByPokemonId: new Map<number, number>([
				[pokemonA.id, 250],
				[pokemonB.id, 500],
			]),
		};

		const sequences = buildSwapSupplementSequences({
			team,
			swaps,
			timeSlots,
			durationSummary: summary,
			box: new PokemonBox([pokemonA, pokemonB]),
		});

		expect(sequences).toHaveLength(1);
		expect(sequences[0].entries[0].activeMinutes).toBe(250);
		expect(sequences[0].entries[0].activeRatioPercent).toBeCloseTo(25);
		expect(sequences[0].entries[1].activeMinutes).toBe(500);
		expect(sequences[0].entries[1].activeRatioPercent).toBeCloseTo(50);
	});
});
