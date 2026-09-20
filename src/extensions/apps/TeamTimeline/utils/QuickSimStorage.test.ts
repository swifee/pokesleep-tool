import { beforeEach, describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { STORAGE_KEY_QUICK_SIM } from "../types/QuickSimTypes";
import { DEFAULT_TIME_SLOTS, type PokemonSwap } from "../types/TimeSlotTypes";
import {
	deriveQuickSimMembersFromTimeline,
	loadQuickSimSettingsFromStorage,
	saveQuickSimSettingsToStorage,
} from "./QuickSimStorage";

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

describe("QuickSimStorage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns null when nothing is stored or the payload is broken", () => {
		const box = new PokemonBox([createItem("Pikachu", 1)]);
		expect(loadQuickSimSettingsFromStorage(box)).toBeNull();

		localStorage.setItem(STORAGE_KEY_QUICK_SIM, "{not json");
		expect(loadQuickSimSettingsFromStorage(box)).toBeNull();

		localStorage.setItem(STORAGE_KEY_QUICK_SIM, JSON.stringify({ members: 1 }));
		expect(loadQuickSimSettingsFromStorage(box)).toBeNull();
	});

	it("round-trips members through serialized strings and re-resolves ids", () => {
		const pikachu = createItem("Pikachu", 1, "Pika");
		const eevee = createItem("Eevee", 2);
		const box = new PokemonBox([pikachu, eevee]);

		saveQuickSimSettingsToStorage(
			{
				members: [
					{ pokemonId: pikachu.id, usagePercent: 100, usageMode: "even" },
					{ pokemonId: eevee.id, usagePercent: 35.6, usageMode: "remainder" },
					{ pokemonId: 999, usagePercent: 50, usageMode: "even" },
				],
			},
			box,
		);

		// Ids change between sessions; only the serialized string is stable.
		const reloadedBox = new PokemonBox([
			createItem("Eevee", 20),
			createItem("Pikachu", 10, "Pika"),
		]);
		expect(loadQuickSimSettingsFromStorage(reloadedBox)).toEqual({
			members: [
				{ pokemonId: 10, usagePercent: 100, usageMode: "even" },
				{ pokemonId: 20, usagePercent: 36, usageMode: "remainder" },
			],
		});
	});

	it("maps identical Pokemon to distinct box items and drops missing ones", () => {
		const first = createItem("Pikachu", 1);
		const second = createItem("Pikachu", 2);
		const box = new PokemonBox([first, second]);
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [
					{ serialized: first.serialize(), usagePercent: 40 },
					{
						serialized: second.serialize(),
						usagePercent: 60,
						usageMode: "bogus",
					},
					{ serialized: "missing", usagePercent: 10 },
					{ serialized: 5, usagePercent: 10 },
				],
			}),
		);

		expect(loadQuickSimSettingsFromStorage(box)).toEqual({
			// A missing or unknown usage mode falls back to "even".
			members: [
				{ pokemonId: 1, usagePercent: 40, usageMode: "even" },
				{ pokemonId: 2, usagePercent: 60, usageMode: "even" },
			],
		});
	});

	it("re-resolves edited members by similarity and only among the given candidates", () => {
		const editedPikachu = createItem("Pikachu", 1, "Pika", 45);
		const hiddenPreset = createItem("Eevee", 1000001, "", 45);
		const box = new PokemonBox([editedPikachu, hiddenPreset]);
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [
					{
						serialized: createItem("Pikachu", 9, "Pika", 30).serialize(),
						usagePercent: 80,
						usageMode: "sleep",
					},
					{
						serialized: createItem("Eevee", 9, "", 30).serialize(),
						usagePercent: 20,
					},
				],
			}),
		);

		// The hidden preset entry is not a similarity candidate, so Eevee is dropped.
		expect(loadQuickSimSettingsFromStorage(box, [editedPikachu])).toEqual({
			members: [
				{ pokemonId: editedPikachu.id, usagePercent: 80, usageMode: "sleep" },
			],
		});
		expect(loadQuickSimSettingsFromStorage(box)).toEqual({
			members: [
				{ pokemonId: editedPikachu.id, usagePercent: 80, usageMode: "sleep" },
				{ pokemonId: hiddenPreset.id, usagePercent: 20, usageMode: "even" },
			],
		});
	});

	it("derives usage percent from the detailed timeline duration share", () => {
		const pikachu = createItem("Pikachu", 1);
		const eevee = createItem("Eevee", 2);
		const bulbasaur = createItem("Bulbasaur", 3);
		const box = new PokemonBox([pikachu, eevee, bulbasaur]);
		// Eevee replaces Pikachu at the wake slot (07:00) on day 0: Pikachu 480min, Eevee 960min.
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-1",
				teamSlotIndex: 0,
				newPokemonId: eevee.id,
				initialEnergy: 100,
			},
		];

		const members = deriveQuickSimMembersFromTimeline({
			team: [pikachu, bulbasaur, null, null, null],
			swaps,
			timeSlots: DEFAULT_TIME_SLOTS,
			simulationDays: 1,
			box,
		});

		expect(members).toEqual([
			{ pokemonId: pikachu.id, usagePercent: 33, usageMode: "even" },
			{ pokemonId: bulbasaur.id, usagePercent: 100, usageMode: "even" },
			{ pokemonId: eevee.id, usagePercent: 67, usageMode: "even" },
		]);
	});
});
