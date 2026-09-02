import { describe, expect, it } from "vitest";
import { cbexFieldIndex, ggexFieldIndex } from "../../../../data/fields";
import pokemons from "../../../../data/pokemons";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { calculateHelp } from "./HelpCalculator";
import SeededRandom from "./SeededRandom";

function createTestPokemon(): PokemonBoxItem {
	const pikachu = pokemons.find((pokemon) => pokemon.name === "Pikachu");
	if (!pikachu) {
		throw new Error("Pikachu not found");
	}
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: pikachu.name, level: 30, skillLevel: 1 }),
	);
}

function mockBerryOnlyHelps(pokemon: PokemonBoxItem, berryCount: number): void {
	Object.defineProperty(pokemon.iv, "ingredientRate", {
		configurable: true,
		get: () => 0,
	});
	Object.defineProperty(pokemon.iv, "skillRate", {
		configurable: true,
		get: () => 0,
	});
	Object.defineProperty(pokemon.iv, "berryCount", {
		configurable: true,
		get: () => berryCount,
	});
}

describe("HelpCalculator bonus behavior", () => {
	it("いいキャンプチケット有効時はおてつだい回数が増える", () => {
		const pokemon = createTestPokemon();

		const base = calculateHelp({
			pokemon,
			durationMinutes: 600,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(101),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: pokemon.iv.carryLimit,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});
		const withCamp = calculateHelp({
			pokemon,
			durationMinutes: 600,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(101),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: pokemon.iv.carryLimit,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: true,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(withCamp.helpCount).toBeGreaterThan(base.helpCount);
	});

	it("いいキャンプチケット有効時は最大所持数が1.2倍扱いになる", () => {
		const pokemon = createTestPokemon();
		Object.defineProperty(pokemon.iv, "ingredientRate", {
			configurable: true,
			get: () => 1,
		});
		Object.defineProperty(pokemon.iv, "skillRate", {
			configurable: true,
			get: () => 0,
		});

		const withoutCamp = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(202),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});
		const withCamp = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(202),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: true,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(withoutCamp.newInventory).toBe(10);
		expect(withoutCamp.ingredients).toEqual([]);
		expect(withCamp.newInventory).toBeGreaterThan(10);
		expect(withCamp.ingredients.length).toBeGreaterThan(0);
	});

	it("carryLimitBonusがあるとイベント対象の最大所持数が増える", () => {
		const pokemon = createTestPokemon();
		Object.defineProperty(pokemon.iv, "ingredientRate", {
			configurable: true,
			get: () => 1,
		});
		Object.defineProperty(pokemon.iv, "skillRate", {
			configurable: true,
			get: () => 0,
		});

		const withoutCarryLimitBonus = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(303),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				carryLimitBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});
		const withCarryLimitBonus = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(303),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				carryLimitBonus: 8,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(withoutCarryLimitBonus.newInventory).toBe(10);
		expect(withCarryLimitBonus.newInventory).toBeGreaterThan(10);
		expect(withCarryLimitBonus.ingredients.length).toBeGreaterThan(0);
	});

	it("carryLimitBonusといいキャンプチケットは重複して最大所持数に反映される", () => {
		const pokemon = createTestPokemon();
		Object.defineProperty(pokemon.iv, "ingredientRate", {
			configurable: true,
			get: () => 1,
		});
		Object.defineProperty(pokemon.iv, "skillRate", {
			configurable: true,
			get: () => 0,
		});

		const withoutCamp = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(404),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 18,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				carryLimitBonus: 8,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});
		const withCamp = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(404),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 18,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				carryLimitBonus: 8,
				isGoodCampTicketSet: true,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(withoutCamp.newInventory).toBe(18);
		expect(withCamp.newInventory).toBeGreaterThan(18);
		expect(withCamp.ingredients.length).toBeGreaterThan(0);
	});

	it("所持数が上限に達している時はberryBonusが発動しない", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 2);

		const result = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(505),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 1,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(result.helpCount).toBeGreaterThan(0);
		expect(result.berryCount).toBe(result.helpCount * 2);
	});

	it("今回のきのみ取得で上限到達する時はberryBonusが発動しない", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 2);

		const result = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(606),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 7,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 1,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(result.helpCount).toBeGreaterThan(0);
		expect(result.berryCount).toBe(result.helpCount * 2);
	});

	it("上限未達の通常ケースではberryBonusが発動する", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 2);

		const result = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(707),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: 999,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 1,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(result.helpCount).toBeGreaterThan(0);
		expect(result.berryCount).toBe(result.helpCount * 3);
	});
});

describe("HelpCalculator EXフィールド別のきのみ速度補正", () => {
	function runWithField(options: {
		fieldIndex?: number;
		isMainBerry: boolean;
		isNonFavoriteBerry: boolean;
	}) {
		const pokemon = createTestPokemon();
		return calculateHelp({
			pokemon,
			durationMinutes: 600,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(2026),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: 999,
			bankedTimeSeconds: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: options.isMainBerry,
				isNonFavoriteBerry: options.isNonFavoriteBerry,
				fieldIndex: options.fieldIndex,
			},
		});
	}

	it("シアンビーチEXのメインきのみ補正はグリーングラスEXより強い", () => {
		const ggex = runWithField({
			fieldIndex: ggexFieldIndex,
			isMainBerry: true,
			isNonFavoriteBerry: false,
		});
		const cbex = runWithField({
			fieldIndex: cbexFieldIndex,
			isMainBerry: true,
			isNonFavoriteBerry: false,
		});

		expect(cbex.helpCount).toBeGreaterThan(ggex.helpCount);
	});

	it("シアンビーチEXの非好みきのみペナルティはグリーングラスEXより重い", () => {
		const ggex = runWithField({
			fieldIndex: ggexFieldIndex,
			isMainBerry: false,
			isNonFavoriteBerry: true,
		});
		const cbex = runWithField({
			fieldIndex: cbexFieldIndex,
			isMainBerry: false,
			isNonFavoriteBerry: true,
		});

		expect(cbex.helpCount).toBeLessThan(ggex.helpCount);
	});

	it("fieldIndex未指定時はグリーングラスEXと同じ結果になる", () => {
		const omitted = runWithField({
			isMainBerry: true,
			isNonFavoriteBerry: false,
		});
		const ggex = runWithField({
			fieldIndex: ggexFieldIndex,
			isMainBerry: true,
			isNonFavoriteBerry: false,
		});

		expect(omitted.helpCount).toBe(ggex.helpCount);
	});

	it("EX補正対象外ならフィールドが変わってもおてつだい回数は変わらない", () => {
		const ggex = runWithField({
			fieldIndex: ggexFieldIndex,
			isMainBerry: false,
			isNonFavoriteBerry: false,
		});
		const cbex = runWithField({
			fieldIndex: cbexFieldIndex,
			isMainBerry: false,
			isNonFavoriteBerry: false,
		});

		expect(cbex.helpCount).toBe(ggex.helpCount);
	});
});
