import { describe, expect, it } from "vitest";
import type { MainSkillName } from "../../../../util/MainSkill";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
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

	it("Mew のスキル率を選択中のオールマイティスキルに応じた固定値で上書きする", () => {
		const cases: [MainSkillName, number][] = [
			["Charge Strength S (Random)", 6.4],
			["Charge Energy S", 6.4],
			["Energizing Cheer S", 4.39],
			["Energy for Everyone S", 3.37],
			["Berry Burst", 2.84],
			["Ingredient Magnet S", 4],
		];

		for (const [versatileSkill, expected] of cases) {
			const mew = new PokemonIv({
				pokemonName: "Mew",
				skillLevel: 6,
				versatileSkill,
			});

			const normalized = normalizeTimelinePokemonIv(mew);

			expect(normalized).not.toBe(mew);
			expect(normalized.baseSkillRate).toBe(expected);
			// 食材率は上流データ（pokemon.json）の値をそのまま使う
			expect(normalized.baseIngRate).toBe(mew.baseIngRate);
		}
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

		const normalized = normalizeTimelinePokemon(item);

		expect(normalized).not.toBe(item);
		expect(normalized.id).toBe(321);
		expect(normalized.nickname).toBe("MyMew");
		expect(normalized.iv.baseSkillRate).toBe(6.4);
	});

	it("Mew 以外は同じインスタンスを返す", () => {
		const raichu = new PokemonIv({ pokemonName: "Raichu", skillLevel: 6 });
		const item = new PokemonBoxItem(raichu, "Rai", 1);

		expect(normalizeTimelinePokemonIv(raichu)).toBe(raichu);
		expect(normalizeTimelinePokemon(item)).toBe(item);
	});

	it("正式データのミュウツーはそのままシミュレーションに使う", () => {
		// 2026-09-14 の upstream sync で frequency / skillRate / carryLimit が確定した。
		const mewtwo = new PokemonIv({ pokemonName: "Mewtwo", level: 50 });

		expect(mewtwo.pokemon.frequency).toBeGreaterThan(0);
		expect(mewtwo.pokemon.skillRate).toBeGreaterThan(0);
		expect(mewtwo.pokemon.carryLimit).toBeGreaterThan(0);
		expect(normalizeTimelinePokemonIv(mewtwo)).toBe(mewtwo);
	});
});
