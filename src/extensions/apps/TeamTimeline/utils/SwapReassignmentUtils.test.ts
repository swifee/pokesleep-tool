import { describe, expect, it } from "vitest";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	type PokemonSwap,
	SWAP_NONE_POKEMON_ID,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { isSwapReassignment } from "./SwapReassignmentUtils";

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName }), "", id);
}

describe("SwapReassignmentUtils", () => {
	const timeSlots: TimeSlot[] = [
		{ id: "sleep", time: "22:00", sleepState: "sleep", hasMeal: false },
		{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
		{ id: "lunch", time: "12:00", sleepState: "none", hasMeal: false },
	];

	it("returns false when the selected pokemon has never been assigned before target slot", () => {
		const memberA = createItem("Bulbasaur", 10);
		const memberB = createItem("Charmander", 20);

		const result = isSwapReassignment({
			team: [memberA, null, null, null, null],
			timeSlots,
			simulationDays: 1,
			swaps: [],
			pendingPokemonId: memberB.id,
			targetSlotId: "wake",
			targetDayIndex: 0,
		});

		expect(result).toBe(false);
	});

	it("returns true when the selected pokemon was assigned before and is currently out of team", () => {
		const memberA = createItem("Squirtle", 30);
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "wake",
				teamSlotIndex: 0,
				newPokemonId: SWAP_NONE_POKEMON_ID,
				initialEnergy: 0,
			},
		];

		const result = isSwapReassignment({
			team: [memberA, null, null, null, null],
			timeSlots,
			simulationDays: 1,
			swaps,
			pendingPokemonId: memberA.id,
			targetSlotId: "lunch",
			targetDayIndex: 0,
		});

		expect(result).toBe(true);
	});

	it("returns false when the selected pokemon is still assigned immediately before target slot", () => {
		const memberA = createItem("Pikachu", 40);

		const result = isSwapReassignment({
			team: [memberA, null, null, null, null],
			timeSlots,
			simulationDays: 1,
			swaps: [],
			pendingPokemonId: memberA.id,
			targetSlotId: "wake",
			targetDayIndex: 0,
		});

		expect(result).toBe(false);
	});
});
