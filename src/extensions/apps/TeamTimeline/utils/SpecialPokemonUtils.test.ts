import { describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	DEFAULT_TIME_SLOTS,
	type PokemonSwap,
	SWAP_NONE_POKEMON_ID,
} from "../types/TimeSlotTypes";
import {
	buildSpecialPokemonExclusionMap,
	buildSpecialPokemonExclusiveGroups,
	canSpecialPokemonCoexist,
	collectTimelineSpecialPokemonConflicts,
	findSpecialPokemonConflictIds,
	isSpecialPokemon,
} from "./SpecialPokemonUtils";

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName, level: 30 }), "", id);
}

const pikachu = createItem("Pikachu", 1);
const eevee = createItem("Eevee", 2);
const mewtwo = createItem("Mewtwo", 10);
const darkrai = createItem("Darkrai", 11);
const latias = createItem("Latias", 12);
const latios = createItem("Latios", 13);
const latias2 = createItem("Latias", 14);
const raikou = createItem("Raikou", 15);

describe("isSpecialPokemon / canSpecialPokemonCoexist", () => {
	it("treats legendary and mythical Pokémon as special", () => {
		expect(isSpecialPokemon(mewtwo.iv.pokemon)).toBe(true);
		expect(isSpecialPokemon(darkrai.iv.pokemon)).toBe(true);
		expect(isSpecialPokemon(latias.iv.pokemon)).toBe(true);
		expect(isSpecialPokemon(raikou.iv.pokemon)).toBe(true);
		expect(isSpecialPokemon(pikachu.iv.pokemon)).toBe(false);
	});

	it("allows a normal Pokémon with anything", () => {
		expect(
			canSpecialPokemonCoexist(pikachu.iv.pokemon, mewtwo.iv.pokemon),
		).toBe(true);
		expect(
			canSpecialPokemonCoexist(mewtwo.iv.pokemon, pikachu.iv.pokemon),
		).toBe(true);
		expect(canSpecialPokemonCoexist(pikachu.iv.pokemon, eevee.iv.pokemon)).toBe(
			true,
		);
	});

	it("allows only the Latias + Latios pair among special Pokémon", () => {
		expect(canSpecialPokemonCoexist(latias.iv.pokemon, latios.iv.pokemon)).toBe(
			true,
		);
		expect(canSpecialPokemonCoexist(latios.iv.pokemon, latias.iv.pokemon)).toBe(
			true,
		);
		expect(
			canSpecialPokemonCoexist(mewtwo.iv.pokemon, darkrai.iv.pokemon),
		).toBe(false);
		expect(canSpecialPokemonCoexist(latias.iv.pokemon, mewtwo.iv.pokemon)).toBe(
			false,
		);
		// 同じ種類 2 体は不可
		expect(
			canSpecialPokemonCoexist(latias.iv.pokemon, latias2.iv.pokemon),
		).toBe(false);
	});
});

describe("findSpecialPokemonConflictIds", () => {
	it("returns nothing for a team with at most one special Pokémon", () => {
		expect(findSpecialPokemonConflictIds([pikachu, eevee, null])).toEqual([]);
		expect(findSpecialPokemonConflictIds([pikachu, mewtwo, null])).toEqual([]);
		expect(findSpecialPokemonConflictIds([latias, latios, pikachu])).toEqual(
			[],
		);
	});

	it("returns every special Pokémon involved in a conflict, in team order", () => {
		expect(
			findSpecialPokemonConflictIds([darkrai, pikachu, mewtwo, null, eevee]),
		).toEqual([darkrai.id, mewtwo.id]);
		expect(findSpecialPokemonConflictIds([latias, latios, mewtwo])).toEqual([
			latias.id,
			latios.id,
			mewtwo.id,
		]);
		expect(findSpecialPokemonConflictIds([latias, latias2])).toEqual([
			latias.id,
			latias2.id,
		]);
	});
});

describe("buildSpecialPokemonExclusionMap", () => {
	it("maps each special Pokémon to the ones it cannot join", () => {
		const exclusions = buildSpecialPokemonExclusionMap([
			pikachu,
			mewtwo,
			darkrai,
			latias,
			latios,
		]);
		expect(exclusions.has(pikachu.id)).toBe(false);
		expect([...(exclusions.get(mewtwo.id) ?? [])].sort()).toEqual(
			[darkrai.id, latias.id, latios.id].sort(),
		);
		expect([...(exclusions.get(latias.id) ?? [])].sort()).toEqual(
			[mewtwo.id, darkrai.id].sort(),
		);
		expect(exclusions.get(latias.id)?.has(latios.id)).toBe(false);
	});

	it("is empty without conflicting members", () => {
		expect(buildSpecialPokemonExclusionMap([pikachu, mewtwo]).size).toBe(0);
		expect(buildSpecialPokemonExclusionMap([latias, latios]).size).toBe(0);
	});
});

describe("buildSpecialPokemonExclusiveGroups", () => {
	it("groups the special Pokémon that cannot be used together", () => {
		expect(
			buildSpecialPokemonExclusiveGroups([pikachu, mewtwo, eevee, darkrai]),
		).toEqual([[1, 3]]);
	});

	it("keeps Latias and Latios in separate groups with the other specials", () => {
		expect(
			buildSpecialPokemonExclusiveGroups([latias, mewtwo, latios, pikachu]),
		).toEqual([
			[0, 1],
			[1, 2],
		]);
		// ラティアス 2 体はお互いに同時に編成できない
		expect(
			buildSpecialPokemonExclusiveGroups([latias, latios, latias2]),
		).toEqual([[0, 2]]);
	});

	it("returns no group when at most one special Pokémon is present", () => {
		expect(buildSpecialPokemonExclusiveGroups([pikachu, mewtwo, null])).toEqual(
			[],
		);
		expect(buildSpecialPokemonExclusiveGroups([latias, latios])).toEqual([]);
	});
});

describe("collectTimelineSpecialPokemonConflicts", () => {
	const box = new PokemonBox([pikachu, eevee, mewtwo, darkrai, latias, latios]);

	it("returns nothing when the team has no conflicting special Pokémon", () => {
		for (const team of [
			[pikachu, mewtwo, eevee, null, null],
			[latias, latios, pikachu, null, null],
		]) {
			const result = collectTimelineSpecialPokemonConflicts(
				team,
				DEFAULT_TIME_SLOTS,
				2,
				[],
				box,
			);
			expect(result.teamIndexesBySlotId.size).toBe(0);
			expect(result.pokemonIds).toEqual([]);
		}
	});

	it("marks every row while the initial team keeps two special Pokémon", () => {
		const result = collectTimelineSpecialPokemonConflicts(
			[mewtwo, pikachu, darkrai, null, null],
			DEFAULT_TIME_SLOTS,
			1,
			[],
			box,
		);
		// 就寝(起点) + 起床 + 12:00 + 15:00 + 18:00 + 就寝(終端) = 6 行
		expect(result.teamIndexesBySlotId.size).toBe(6);
		for (const teamIndexes of result.teamIndexesBySlotId.values()) {
			expect(teamIndexes).toEqual([0, 2]);
		}
		expect(result.pokemonIds).toEqual([mewtwo.id, darkrai.id]);
	});

	it("starts the conflict on the row after a swap brings in a second special Pokémon", () => {
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-2", // 12:00
				teamSlotIndex: 1,
				newPokemonId: darkrai.id,
				initialEnergy: 100,
			},
			{
				dayIndex: 0,
				slotId: "slot-4", // 18:00
				teamSlotIndex: 1,
				newPokemonId: SWAP_NONE_POKEMON_ID,
				initialEnergy: 100,
			},
		];
		const result = collectTimelineSpecialPokemonConflicts(
			[mewtwo, pikachu, null, null, null],
			DEFAULT_TIME_SLOTS,
			1,
			swaps,
			box,
		);
		// 入れ替えは行の計算後に適用されるので、15:00 と 18:00 の行だけ重複する
		expect([...result.teamIndexesBySlotId.keys()]).toEqual([
			"slot-3__day0",
			"slot-4__day0",
		]);
		expect(result.teamIndexesBySlotId.get("slot-3__day0")).toEqual([0, 1]);
		expect(result.pokemonIds).toEqual([mewtwo.id, darkrai.id]);
	});

	it("follows swaps across days and ignores the Latias + Latios pair", () => {
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-5-end", // 初日の就寝(終端)
				teamSlotIndex: 2,
				newPokemonId: darkrai.id,
				initialEnergy: 100,
			},
		];
		const result = collectTimelineSpecialPokemonConflicts(
			[latias, latios, pikachu, null, null],
			DEFAULT_TIME_SLOTS,
			2,
			swaps,
			box,
		);
		// 2 日目の全行（起床〜就寝終端の 5 行）でラティアス・ラティオス・ダークライが重複
		const keys = [...result.teamIndexesBySlotId.keys()];
		expect(keys.every((key) => key.endsWith("__day1"))).toBe(true);
		expect(keys).toHaveLength(5);
		expect(result.teamIndexesBySlotId.get("slot-1__day1")).toEqual([0, 1, 2]);
		expect(result.pokemonIds).toEqual([latias.id, latios.id, darkrai.id]);
	});
});
