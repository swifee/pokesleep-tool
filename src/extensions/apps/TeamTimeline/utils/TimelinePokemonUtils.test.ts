import { describe, expect, it } from "vitest";
import { cbexFieldIndex, ggexFieldIndex } from "../../../../data/fields";
import type { MainSkillName } from "../../../../util/MainSkill";
import Nature from "../../../../util/Nature";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import SubSkill from "../../../../util/SubSkill";
import SubSkillList from "../../../../util/SubSkillList";
import {
	calculateBaseFrequencyWithBaseSeconds,
	calculateCarryLimitWithBase,
	getEffectiveMainSkillName,
	getProvisionalBaseFrequencySeconds,
	getTimelineCarryLimit,
	isPlaceholderPokemonData,
	normalizeTimelinePokemon,
	normalizeTimelinePokemonIv,
	resolveBaseFrequency,
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

	it("Mew 以外で仮ステータスが無ければ同じインスタンスを返す", () => {
		const raichu = new PokemonIv({ pokemonName: "Raichu", skillLevel: 6 });
		const item = new PokemonBoxItem(raichu, "Rai", 1);

		expect(normalizeTimelinePokemonIv(raichu)).toBe(raichu);
		expect(normalizeTimelinePokemon(item)).toBe(item);
	});
});

describe("TimelinePokemonUtils データ未公開ポケモンの仮ステータス", () => {
	const placeholderStats = {
		enabled: true,
		helpingFrequencySeconds: 2700,
		skillRatePercent: 2.5,
		carryLimit: 20,
	};

	it("上流のプレースホルダーデータを判定する", () => {
		const mewtwo = new PokemonIv({ pokemonName: "Mewtwo", level: 50 });
		const raichu = new PokemonIv({ pokemonName: "Raichu", level: 50 });

		expect(isPlaceholderPokemonData(mewtwo.pokemon)).toBe(true);
		expect(isPlaceholderPokemonData(raichu.pokemon)).toBe(false);
	});

	it("種族値を差し替えた計算は PokemonIv と同じ結果になる", () => {
		const iv = new PokemonIv({
			pokemonName: "Raichu",
			level: 42,
			ribbon: 2,
			subSkills: new SubSkillList({
				lv10: new SubSkill("Helping Speed M"),
				lv25: new SubSkill("Inventory Up L"),
			}),
			nature: new Nature("Adamant"),
		});

		for (const options of [
			{
				helpBonusCount: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
				fieldIndex: 0,
			},
			{
				helpBonusCount: 3,
				isGoodCampTicketSet: true,
				isMainBerry: true,
				isNonFavoriteBerry: false,
				fieldIndex: ggexFieldIndex,
			},
			{
				helpBonusCount: 1,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: true,
				fieldIndex: cbexFieldIndex,
			},
		]) {
			expect(
				calculateBaseFrequencyWithBaseSeconds(
					iv,
					iv.pokemon.frequency,
					options,
				),
			).toBeCloseTo(
				iv.getBaseFrequency(
					options.helpBonusCount,
					options.isGoodCampTicketSet,
					options.isMainBerry,
					options.isNonFavoriteBerry,
					options.fieldIndex,
				),
				10,
			);
		}

		expect(calculateCarryLimitWithBase(iv, iv.pokemon.carryLimit)).toBe(
			iv.carryLimit,
		);
	});

	it("仮ステータスはデータ未公開ポケモンにのみ適用される", () => {
		const mewtwo = new PokemonIv({ pokemonName: "Mewtwo", level: 50 });
		const raichu = new PokemonIv({ pokemonName: "Raichu", level: 50 });

		expect(getProvisionalBaseFrequencySeconds(mewtwo, placeholderStats)).toBe(
			2700,
		);
		expect(getProvisionalBaseFrequencySeconds(raichu, placeholderStats)).toBe(
			0,
		);
		expect(
			getProvisionalBaseFrequencySeconds(mewtwo, {
				...placeholderStats,
				enabled: false,
			}),
		).toBe(0);

		expect(getTimelineCarryLimit(mewtwo, placeholderStats)).toBe(20);
		expect(getTimelineCarryLimit(mewtwo, undefined)).toBe(mewtwo.carryLimit);
		expect(getTimelineCarryLimit(raichu, placeholderStats)).toBe(
			raichu.carryLimit,
		);
	});

	it("仮ステータスのスキル発動率を IV に反映する", () => {
		const mewtwo = new PokemonIv({ pokemonName: "Mewtwo", level: 50 });

		const normalized = normalizeTimelinePokemonIv(mewtwo, placeholderStats);

		expect(normalized.baseSkillRate).toBe(2.5);
		expect(normalized.skillRate).toBeCloseTo(0.025, 10);
		expect(normalizeTimelinePokemonIv(mewtwo)).toBe(mewtwo);
	});

	it("おてつだい間隔は仮のおてつだいスピードから計算される", () => {
		const mewtwo = new PokemonIv({ pokemonName: "Mewtwo", level: 50 });
		const options = {
			helpBonusCount: 0,
			isGoodCampTicketSet: false,
			isMainBerry: false,
			isNonFavoriteBerry: false,
			fieldIndex: 0,
		};

		expect(resolveBaseFrequency(mewtwo, options)).toBe(0);
		expect(
			resolveBaseFrequency(mewtwo, {
				...options,
				baseFrequencySecondsOverride: 2700,
			}),
		).toBeCloseTo(
			calculateBaseFrequencyWithBaseSeconds(mewtwo, 2700, options),
			10,
		);
	});
});
