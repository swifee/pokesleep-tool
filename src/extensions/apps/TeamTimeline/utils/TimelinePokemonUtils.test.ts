import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cbexFieldIndex, ggexFieldIndex } from "../../../../data/fields";
import type { MainSkillName } from "../../../../util/MainSkill";
import Nature from "../../../../util/Nature";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import SubSkill from "../../../../util/SubSkill";
import SubSkillList from "../../../../util/SubSkillList";
import {
	PLACEHOLDER_POKEMON_NAME,
	registerPlaceholderPokemon,
} from "./PlaceholderPokemonTestHelpers";
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
	// 実在ポケモンは正式データに置き換わり得るため、合成プレースホルダーで検証する。
	let unregisterPlaceholder: () => void;
	beforeAll(() => {
		unregisterPlaceholder = registerPlaceholderPokemon();
	});
	afterAll(() => unregisterPlaceholder());

	const placeholderStats = {
		enabled: true,
		helpingFrequencySeconds: 2700,
		skillRatePercent: 2.5,
		carryLimit: 20,
	};

	it("上流のプレースホルダーデータを判定する", () => {
		const placeholder = new PokemonIv({
			pokemonName: PLACEHOLDER_POKEMON_NAME,
			level: 50,
		});
		const raichu = new PokemonIv({ pokemonName: "Raichu", level: 50 });

		expect(isPlaceholderPokemonData(placeholder.pokemon)).toBe(true);
		expect(isPlaceholderPokemonData(raichu.pokemon)).toBe(false);
	});

	it("正式データが入ったミュウツーはプレースホルダーとして扱わない", () => {
		// 2026-09-14 の upstream sync で frequency / skillRate / carryLimit が確定した。
		const mewtwo = new PokemonIv({ pokemonName: "Mewtwo", level: 50 });

		expect(isPlaceholderPokemonData(mewtwo.pokemon)).toBe(false);
		expect(mewtwo.pokemon.frequency).toBeGreaterThan(0);
		expect(mewtwo.pokemon.skillRate).toBeGreaterThan(0);
		expect(mewtwo.pokemon.carryLimit).toBeGreaterThan(0);
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
		const placeholder = new PokemonIv({
			pokemonName: PLACEHOLDER_POKEMON_NAME,
			level: 50,
		});
		const raichu = new PokemonIv({ pokemonName: "Raichu", level: 50 });

		expect(
			getProvisionalBaseFrequencySeconds(placeholder, placeholderStats),
		).toBe(2700);
		expect(getProvisionalBaseFrequencySeconds(raichu, placeholderStats)).toBe(
			0,
		);
		expect(
			getProvisionalBaseFrequencySeconds(placeholder, {
				...placeholderStats,
				enabled: false,
			}),
		).toBe(0);

		expect(getTimelineCarryLimit(placeholder, placeholderStats)).toBe(20);
		expect(getTimelineCarryLimit(placeholder, undefined)).toBe(
			placeholder.carryLimit,
		);
		expect(getTimelineCarryLimit(raichu, placeholderStats)).toBe(
			raichu.carryLimit,
		);
	});

	it("仮ステータスのスキル発動率を IV に反映する", () => {
		const placeholder = new PokemonIv({
			pokemonName: PLACEHOLDER_POKEMON_NAME,
			level: 50,
		});

		const normalized = normalizeTimelinePokemonIv(
			placeholder,
			placeholderStats,
		);

		expect(normalized.baseSkillRate).toBe(2.5);
		expect(normalized.skillRate).toBeCloseTo(0.025, 10);
		expect(normalizeTimelinePokemonIv(placeholder)).toBe(placeholder);
	});

	it("正式データのポケモンには仮ステータスのスキル発動率を適用しない", () => {
		const mewtwo = new PokemonIv({ pokemonName: "Mewtwo", level: 50 });

		expect(normalizeTimelinePokemonIv(mewtwo, placeholderStats)).toBe(mewtwo);
		expect(getProvisionalBaseFrequencySeconds(mewtwo, placeholderStats)).toBe(
			0,
		);
		expect(getTimelineCarryLimit(mewtwo, placeholderStats)).toBe(
			mewtwo.carryLimit,
		);
	});

	it("おてつだい間隔は仮のおてつだいスピードから計算される", () => {
		const placeholder = new PokemonIv({
			pokemonName: PLACEHOLDER_POKEMON_NAME,
			level: 50,
		});
		const options = {
			helpBonusCount: 0,
			isGoodCampTicketSet: false,
			isMainBerry: false,
			isNonFavoriteBerry: false,
			fieldIndex: 0,
		};

		expect(resolveBaseFrequency(placeholder, options)).toBe(0);
		expect(
			resolveBaseFrequency(placeholder, {
				...options,
				baseFrequencySecondsOverride: 2700,
			}),
		).toBeCloseTo(
			calculateBaseFrequencyWithBaseSeconds(placeholder, 2700, options),
			10,
		);
	});
});
