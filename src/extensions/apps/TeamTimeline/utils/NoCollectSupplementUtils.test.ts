import { describe, expect, it } from "vitest";
import PokemonBox, { type PokemonBoxItem } from "../../../../util/PokemonBox";
import {
	type NoCollectCellSetting,
	type PokemonSwap,
	SWAP_NONE_POKEMON_ID,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import {
	buildNoCollectSupplementEntries,
	countActiveNoCollectCells,
} from "./NoCollectSupplementUtils";

function createPokemon(id: number, idForm: number): PokemonBoxItem {
	return {
		id,
		iv: { idForm },
	} as unknown as PokemonBoxItem;
}

describe("NoCollectSupplementUtils", () => {
	const timeSlots: TimeSlot[] = [
		{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
		{ id: "noon", time: "12:00", sleepState: "none", hasMeal: true },
		{ id: "night", time: "18:00", sleepState: "none", hasMeal: false },
	];

	it("counts no-collect entries by pokemon after applying prior swaps and excluding same-cell swaps", () => {
		const pokemonA = createPokemon(1, 101);
		const pokemonB = createPokemon(2, 102);
		const team: (PokemonBoxItem | null)[] = [pokemonA, null, null, null, null];
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "noon",
				teamSlotIndex: 0,
				newPokemonId: pokemonB.id,
				initialEnergy: 100,
			},
		];
		const noCollectCells: NoCollectCellSetting[] = [
			{ dayIndex: 0, slotId: "wake", teamSlotIndex: 0 },
			{ dayIndex: 0, slotId: "noon", teamSlotIndex: 0 },
			{ dayIndex: 0, slotId: "night", teamSlotIndex: 0 },
			{ dayIndex: 1, slotId: "wake", teamSlotIndex: 0 },
		];

		expect(countActiveNoCollectCells(noCollectCells, swaps)).toBe(3);

		const entries = buildNoCollectSupplementEntries({
			team,
			swaps,
			noCollectCells,
			timeSlots,
			simulationDays: 2,
			box: new PokemonBox([pokemonA, pokemonB]),
		});

		expect(entries).toHaveLength(2);
		expect(entries.map((entry) => entry.pokemonId)).toEqual([
			pokemonA.id,
			pokemonB.id,
		]);
		expect(entries.map((entry) => entry.count)).toEqual([1, 2]);
	});

	it("returns no supplement entries when active no-collect cells resolve to no pokemon", () => {
		const pokemonA = createPokemon(1, 101);
		const team: (PokemonBoxItem | null)[] = [pokemonA, null, null, null, null];
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "wake",
				teamSlotIndex: 0,
				newPokemonId: SWAP_NONE_POKEMON_ID,
				initialEnergy: 0,
			},
		];
		const noCollectCells: NoCollectCellSetting[] = [
			{ dayIndex: 0, slotId: "wake", teamSlotIndex: 0 },
			{ dayIndex: 0, slotId: "night", teamSlotIndex: 0 },
		];

		expect(countActiveNoCollectCells(noCollectCells, swaps)).toBe(1);

		const entries = buildNoCollectSupplementEntries({
			team,
			swaps,
			noCollectCells,
			timeSlots,
			simulationDays: 1,
			box: new PokemonBox([pokemonA]),
		});

		expect(entries).toHaveLength(0);
	});
});
