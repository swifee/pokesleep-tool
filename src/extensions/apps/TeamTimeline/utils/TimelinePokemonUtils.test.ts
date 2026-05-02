import { describe, expect, it } from "vitest";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { createStrengthParameter } from "../../../../util/PokemonStrength";
import {
	getEffectiveMainSkillName,
	normalizeTimelinePokemon,
	normalizeTimelinePokemonIv,
} from "./TimelinePokemonUtils";

describe("TimelinePokemonUtils", () => {
	it("Mew は versatileSkill を実効スキル名として返す", () => {
		const mew = new PokemonIv({
			pokemonName: "Mew",
			skillLevel: 6,
			versatileSkill: "Energy for Everyone S",
		});

		expect(getEffectiveMainSkillName(mew)).toBe("Energy for Everyone S");
		expect(getEffectiveMainSkillName(new PokemonBoxItem(mew))).toBe(
			"Energy for Everyone S",
		);
	});

	it("Mew 以外は元のメインスキル名を返す", () => {
		const raichu = new PokemonIv({
			pokemonName: "Raichu",
			skillLevel: 6,
		});

		expect(getEffectiveMainSkillName(raichu)).toBe(raichu.pokemon.skill);
	});

	it("Mew の食材率とスキル率を StrengthParameter.mew に合わせて上書きする", () => {
		const mew = new PokemonIv({
			pokemonName: "Mew",
			skillLevel: 6,
			versatileSkill: "Berry Burst",
		});
		const parameter = createStrengthParameter({
			mew: {
				ing: 17,
				skill1: 9,
				skill2: 5,
				skill3: 2.75,
				success: 40,
			},
		});

		const normalized = normalizeTimelinePokemonIv(mew, parameter);

		expect(normalized).not.toBe(mew);
		expect(normalized.baseIngRate).toBe(17);
		expect(normalized.baseSkillRate).toBe(2.75);
	});

	it("normalizeTimelinePokemon は id と nickname を維持したまま Mew を差し替える", () => {
		const item = new PokemonBoxItem(
			new PokemonIv({
				pokemonName: "Mew",
				skillLevel: 6,
				versatileSkill: "Charge Energy S",
			}),
			"MyMew",
			321,
		);
		const parameter = createStrengthParameter({
			mew: {
				ing: 19,
				skill1: 7.5,
				skill2: 4,
				skill3: 3,
				success: 30,
			},
		});

		const normalized = normalizeTimelinePokemon(item, parameter);

		expect(normalized).not.toBe(item);
		expect(normalized.id).toBe(321);
		expect(normalized.nickname).toBe("MyMew");
		expect(normalized.iv.baseIngRate).toBe(19);
		expect(normalized.iv.baseSkillRate).toBe(7.5);
	});
});
