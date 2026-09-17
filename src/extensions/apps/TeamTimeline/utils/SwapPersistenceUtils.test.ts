import { describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { type PokemonSwap, SWAP_NONE_POKEMON_ID } from "../types/TimeSlotTypes";
import {
	hydrateSwapsWithSerializedPokemon,
	normalizeLoadedSwapsWithBox,
} from "./SwapPersistenceUtils";

function createItem(
	pokemonName: string,
	id: number,
	nickname = "",
	level = 30,
): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName, level }),
		nickname,
		id,
	);
}

describe("SwapPersistenceUtils", () => {
	it("hydrates swap records with serialized pokemon strings", () => {
		const memberA = createItem("Bulbasaur", 10, "A");
		const memberB = createItem("Charmander", 20, "B");
		const box = new PokemonBox([memberA, memberB]);
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-1",
				teamSlotIndex: 0,
				newPokemonId: memberB.id,
				initialEnergy: 80,
			},
		];

		const hydrated = hydrateSwapsWithSerializedPokemon(swaps, box);

		expect(hydrated[0].newPokemonSerialized).toBe(memberB.serialize());
	});

	it("normalizes stale pokemon ids by serialized fallback", () => {
		const memberA = createItem("Squirtle", 11, "A");
		const memberB = createItem("Pikachu", 22, "B");
		const box = new PokemonBox([memberA, memberB]);
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-1",
				teamSlotIndex: 0,
				newPokemonId: memberB.id,
				newPokemonSerialized: memberA.serialize(),
				initialEnergy: 100,
			},
		];

		const normalized = normalizeLoadedSwapsWithBox(swaps, box, new Map());

		expect(normalized[0].newPokemonId).toBe(memberA.id);
	});

	it("keeps legacy ids when serialized fallback is unavailable", () => {
		const memberA = createItem("Eevee", 101);
		const box = new PokemonBox([memberA]);
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-1",
				teamSlotIndex: 0,
				newPokemonId: memberA.id,
				initialEnergy: 50,
			},
		];

		const normalized = normalizeLoadedSwapsWithBox(swaps, box, new Map());

		expect(normalized[0].newPokemonId).toBe(memberA.id);
	});

	it("re-resolves an edited pokemon by similarity when the serialized string no longer matches", () => {
		const editedPikachu = createItem("Pikachu", 30, "Pika", 45);
		const box = new PokemonBox([createItem("Eevee", 10), editedPikachu]);
		const staleSerialized = createItem("Pikachu", 99, "Pika", 30).serialize();
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-1",
				teamSlotIndex: 0,
				newPokemonId: 99,
				newPokemonSerialized: staleSerialized,
				initialEnergy: 100,
			},
			{
				dayIndex: 1,
				slotId: "slot-1",
				teamSlotIndex: 0,
				newPokemonId: 99,
				newPokemonSerialized: staleSerialized,
				initialEnergy: 100,
				isRepeatGenerated: true,
			},
			{
				dayIndex: 0,
				slotId: "slot-2",
				teamSlotIndex: 1,
				newPokemonId: SWAP_NONE_POKEMON_ID,
				initialEnergy: 100,
			},
		];

		const normalized = normalizeLoadedSwapsWithBox(swaps, box, new Map());

		expect(normalized.map((swap) => swap.newPokemonId)).toEqual([
			editedPikachu.id,
			editedPikachu.id,
			SWAP_NONE_POKEMON_ID,
		]);
	});

	it("limits similarity matches to the given candidates", () => {
		const hiddenPreset = createItem("Pikachu", 1000001, "", 45);
		const box = new PokemonBox([hiddenPreset]);
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-1",
				teamSlotIndex: 0,
				newPokemonId: 99,
				newPokemonSerialized: createItem("Pikachu", 99, "", 30).serialize(),
				initialEnergy: 100,
			},
		];

		expect(
			normalizeLoadedSwapsWithBox(swaps, box, new Map(), [])[0].newPokemonId,
		).toBe(99);
		expect(
			normalizeLoadedSwapsWithBox(swaps, box, new Map())[0].newPokemonId,
		).toBe(hiddenPreset.id);
	});
});
