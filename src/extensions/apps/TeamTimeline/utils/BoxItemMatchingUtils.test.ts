import { describe, expect, it } from "vitest";
import Nature from "../../../../util/Nature";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv, { type PokemonIvProps } from "../../../../util/PokemonIv";
import SubSkill, { type SubSkillType } from "../../../../util/SubSkill";
import SubSkillList from "../../../../util/SubSkillList";
import {
	BOX_ITEM_MATCH_THRESHOLD,
	findBestMatchingBoxItem,
	isSameEvolutionLine,
	resolveDistinctBoxItems,
	scoreBoxItemSimilarity,
} from "./BoxItemMatchingUtils";

function subSkills(names: (SubSkillType | null)[]): SubSkillList {
	const [lv10, lv25, lv50, lv70, lv80] = names.map((name) =>
		name === null ? null : new SubSkill(name),
	);
	return new SubSkillList({ lv10, lv25, lv50, lv70, lv80 });
}

/** 保存時のスナップショット。レベル 25、サブスキルは 3 枠だけ埋まっている */
const BASE_PROPS: Partial<PokemonIvProps> = {
	pokemonName: "Charmander",
	level: 25,
	skillLevel: 1,
	ingredient: "AAB",
	nature: new Nature("Adamant"),
	subSkills: subSkills([
		"Helping Speed S",
		"Ingredient Finder S",
		"Skill Trigger S",
		null,
		null,
	]),
};

function createIv(overrides: Partial<PokemonIvProps> = {}): PokemonIv {
	return new PokemonIv(BASE_PROPS).clone(overrides);
}

function createItem(iv: PokemonIv, id: number, nickname = ""): PokemonBoxItem {
	return new PokemonBoxItem(iv, nickname, id);
}

function score(
	candidate: PokemonIv,
	nicknames: { reference?: string; candidate?: string } = {},
): number | null {
	return scoreBoxItemSimilarity(
		{ iv: createIv(), nickname: nicknames.reference ?? "" },
		{ iv: candidate, nickname: nicknames.candidate ?? "" },
	);
}

describe("isSameEvolutionLine", () => {
	it("treats the same species and its evolutions as one line", () => {
		const charmander = createIv();
		expect(isSameEvolutionLine(charmander, createIv())).toBe(true);
		expect(
			isSameEvolutionLine(charmander, createIv({ pokemonName: "Charizard" })),
		).toBe(true);
		expect(
			isSameEvolutionLine(
				createIv({ pokemonName: "Charizard" }),
				createIv({ pokemonName: "Charmander" }),
			),
		).toBe(true);
	});

	it("rejects other species and special forms of the same species", () => {
		const charmander = createIv();
		expect(
			isSameEvolutionLine(
				charmander,
				new PokemonIv({ pokemonName: "Squirtle" }),
			),
		).toBe(false);
		expect(
			isSameEvolutionLine(
				new PokemonIv({ pokemonName: "Pikachu" }),
				new PokemonIv({ pokemonName: "Pikachu (Halloween)" }),
			),
		).toBe(false);
	});

	it("follows Toxel's nature-dependent evolution form", () => {
		const ampedToxel = new PokemonIv({
			pokemonName: "Toxel",
			nature: new Nature("Hardy"),
		});
		expect(
			isSameEvolutionLine(
				ampedToxel,
				new PokemonIv({ pokemonName: "Toxtricity (Amped)" }),
			),
		).toBe(true);
		expect(
			isSameEvolutionLine(
				ampedToxel,
				new PokemonIv({ pokemonName: "Toxtricity (Low Key)" }),
			),
		).toBe(false);
	});
});

describe("scoreBoxItemSimilarity", () => {
	it("scores an unchanged Pokémon as 100 and other lines as null", () => {
		expect(score(createIv())).toBe(100);
		expect(score(new PokemonIv({ pokemonName: "Squirtle" }))).toBeNull();
	});

	it("keeps ordinary progress above the threshold: level, skill level, ribbon, evolution, filled sub skills", () => {
		const progressed = createIv({
			pokemonName: "Charmeleon",
			level: 55,
			skillLevel: 3,
			ribbon: 2,
			subSkills: subSkills([
				"Helping Speed S",
				"Ingredient Finder S",
				"Skill Trigger S",
				"Berry Finding S",
				"Inventory Up S",
			]),
		});
		expect(score(progressed)).toBeGreaterThanOrEqual(BOX_ITEM_MATCH_THRESHOLD);
		// A temporary level change for testing still matches.
		expect(score(createIv({ level: 10 }))).toBeGreaterThanOrEqual(
			BOX_ITEM_MATCH_THRESHOLD,
		);
	});

	it("tolerates a single correction: nature, ingredient, nickname, or a sub skill upgrade", () => {
		expect(
			score(createIv({ nature: new Nature("Brave"), level: 30 })),
		).toBeGreaterThanOrEqual(BOX_ITEM_MATCH_THRESHOLD);
		expect(
			score(createIv({ ingredient: "ABB", level: 30 })),
		).toBeGreaterThanOrEqual(BOX_ITEM_MATCH_THRESHOLD);
		expect(
			score(createIv({ level: 40 }), {
				reference: "リザ",
				candidate: "リザードン",
			}),
		).toBeGreaterThanOrEqual(BOX_ITEM_MATCH_THRESHOLD);
		expect(
			score(
				createIv({
					level: 50,
					subSkills: subSkills([
						"Helping Speed M",
						"Ingredient Finder M",
						"Skill Trigger S",
						null,
						null,
					]),
				}),
			),
		).toBeGreaterThanOrEqual(BOX_ITEM_MATCH_THRESHOLD);
	});

	it("accepts completely different sub skills when nature and ingredients still agree", () => {
		const rerolled = createIv({
			level: 30,
			subSkills: subSkills([
				"Berry Finding S",
				"Inventory Up M",
				"Helping Bonus",
				null,
				null,
			]),
		});
		expect(score(rerolled)).toBeGreaterThanOrEqual(BOX_ITEM_MATCH_THRESHOLD);
	});

	it("rejects a different Pokémon of the same species", () => {
		// Nature, ingredients and the known sub skills all differ.
		expect(
			score(
				createIv({
					level: 40,
					nature: new Nature("Modest"),
					ingredient: "ABC",
					subSkills: subSkills([
						"Berry Finding S",
						"Inventory Up M",
						"Helping Bonus",
						null,
						null,
					]),
				}),
			),
		).toBeLessThan(BOX_ITEM_MATCH_THRESHOLD);
		// Same nature by coincidence, but the ingredients and known sub skills differ.
		expect(
			score(
				createIv({
					level: 22,
					ingredient: "ABC",
					subSkills: subSkills([
						"Berry Finding S",
						"Inventory Up M",
						null,
						null,
						null,
					]),
				}),
			),
		).toBeLessThan(BOX_ITEM_MATCH_THRESHOLD);
	});

	it("prefers the candidate with the matching nickname", () => {
		const sameNickname = score(createIv({ level: 40 }), {
			reference: "リザ",
			candidate: "リザ",
		});
		const noNickname = score(createIv({ level: 40 }), { reference: "リザ" });
		const otherNickname = score(createIv({ level: 40 }), {
			reference: "リザ",
			candidate: "ヒト",
		});
		expect(sameNickname).toBeGreaterThanOrEqual(BOX_ITEM_MATCH_THRESHOLD);
		expect(noNickname).toBeLessThan(sameNickname ?? 0);
		expect(otherNickname).toBeLessThan(noNickname ?? 0);
	});

	it("compares chosen ingredients and the main skill for Mew", () => {
		const mew = new PokemonIv({
			pokemonName: "Mew",
			level: 30,
			mythIng1: "leek",
			mythIng2: "egg",
			mythIng3: "unknown",
			versatileSkill: "Metronome",
		});
		const sameMew = { iv: mew, nickname: "" };
		const differentIngredients = {
			iv: mew.clone({ mythIng1: "herb", mythIng2: "oil" }),
			nickname: "",
		};
		const differentSkill = {
			iv: mew.clone({ versatileSkill: "Berry Burst" }),
			nickname: "",
		};
		expect(scoreBoxItemSimilarity(sameMew, sameMew)).toBe(100);
		expect(scoreBoxItemSimilarity(sameMew, differentSkill)).toBeLessThan(100);
		expect(scoreBoxItemSimilarity(sameMew, differentIngredients)).toBeLessThan(
			scoreBoxItemSimilarity(sameMew, differentSkill) ?? 0,
		);
	});
});

describe("findBestMatchingBoxItem", () => {
	it("returns the highest scoring candidate above the threshold, first one on ties", () => {
		const reference = { iv: createIv(), nickname: "" };
		const other = createItem(createIv({ nature: new Nature("Modest") }), 1);
		const closest = createItem(createIv({ level: 30 }), 2);
		const tie = createItem(createIv({ level: 30 }), 3);

		expect(findBestMatchingBoxItem(reference, [other, closest, tie])).toBe(
			closest,
		);
		expect(findBestMatchingBoxItem(reference, [tie, closest])).toBe(tie);
	});

	it("returns null when nothing is similar enough", () => {
		const reference = { iv: createIv(), nickname: "" };
		const stranger = createItem(
			createIv({
				nature: new Nature("Modest"),
				ingredient: "ABC",
				subSkills: subSkills([
					"Berry Finding S",
					"Inventory Up M",
					"Helping Bonus",
					null,
					null,
				]),
			}),
			1,
		);
		const otherLine = createItem(new PokemonIv({ pokemonName: "Squirtle" }), 2);
		expect(
			findBestMatchingBoxItem(reference, [stranger, otherLine]),
		).toBeNull();
		expect(findBestMatchingBoxItem(reference, [])).toBeNull();
	});
});

describe("resolveDistinctBoxItems", () => {
	it("resolves exact matches first so a similar entry cannot steal them", () => {
		const edited = createItem(createIv({ level: 40 }), 1);
		const unchanged = createItem(createIv(), 2);
		const box = new PokemonBox([edited, unchanged]);

		// The first reference only matches by similarity, the second one exactly.
		const resolved = resolveDistinctBoxItems(
			[
				createItem(createIv({ level: 26 }), 0).serialize(),
				unchanged.serialize(),
			],
			box,
		);

		expect(resolved).toEqual([edited, unchanged]);
	});

	it("assigns each box item to at most one reference, best pairs first", () => {
		const adamant = createItem(createIv({ level: 40 }), 1);
		const brave = createItem(
			createIv({ level: 41, nature: new Nature("Brave") }),
			2,
		);
		const box = new PokemonBox([adamant, brave]);
		const braveReference = createItem(
			createIv({ nature: new Nature("Brave") }),
			0,
		).serialize();
		const adamantReference = createItem(createIv(), 0).serialize();

		expect(
			resolveDistinctBoxItems([braveReference, adamantReference], box),
		).toEqual([brave, adamant]);
		expect(
			resolveDistinctBoxItems([adamantReference, braveReference], box),
		).toEqual([adamant, brave]);
		// Two references for one box entry: only one of them gets it.
		expect(
			resolveDistinctBoxItems(
				[adamantReference, adamantReference],
				new PokemonBox([adamant]),
			),
		).toEqual([adamant, null]);
	});

	it("keeps null and unparsable references as null", () => {
		const box = new PokemonBox([createItem(createIv(), 1)]);
		expect(resolveDistinctBoxItems([null, "broken"], box)).toEqual([
			null,
			null,
		]);
	});

	it("only searches the given fuzzy candidates for similarity matches", () => {
		const hiddenPreset = createItem(createIv({ level: 40 }), 1000001);
		const userItem = createItem(createIv({ level: 45 }), 1);
		const box = new PokemonBox([userItem, hiddenPreset]);
		const reference = createItem(createIv(), 0).serialize();

		expect(
			resolveDistinctBoxItems([reference], box, {
				fuzzyCandidates: [userItem],
			}),
		).toEqual([userItem]);
		expect(
			resolveDistinctBoxItems([reference], box, { fuzzyCandidates: [] }),
		).toEqual([null]);
		// Exact matches still come from the whole box.
		expect(
			resolveDistinctBoxItems([hiddenPreset.serialize()], box, {
				fuzzyCandidates: [],
			}),
		).toEqual([hiddenPreset]);
	});
});
