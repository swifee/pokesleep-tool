import { beforeEach, describe, expect, it } from "vitest";
import {
	createStrengthParameter,
	loadStrengthParameter,
} from "../../../../util/PokemonStrength";
import {
	buildStrengthParameterFromTimelineBonusSettings,
	createDefaultTimelineBonusSettings,
	IV_PARAMETER_STORAGE_KEY,
	mergeTimelineBonusSettingsIntoStrengthParameter,
	normalizeTimelineBonusSettings,
	saveTimelineBonusSettingsToIvStorage,
	strengthParameterToTimelineBonusSettings,
} from "./TimelineBonusSettingsBridge";

describe("TimelineBonusSettingsBridge", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("StrengthParameterから対象項目のみを正しく抽出する", () => {
		const parameter = createStrengthParameter({
			fieldIndex: 7,
			favoriteType: ["electric", "fire", "water"],
			expertEffect: "skill",
			fieldBonus: 55,
			isGoodCampTicketSet: true,
			event: "custom",
			recipeBonus: 48,
			recipeLevel: 50,
		});

		const settings = strengthParameterToTimelineBonusSettings(parameter);

		expect(settings.fieldIndex).toBe(7);
		expect(settings.favoriteType).toEqual(["electric", "fire", "water"]);
		expect(settings.expertEffect).toBe("skill");
		expect(settings.fieldBonus).toBe(55);
		expect(settings.isGoodCampTicketSet).toBe(true);
		expect(settings.event).toBe("custom");
		expect(settings.recipeBonus).toBe(48);
		expect(settings.recipeLevel).toBe(50);
	});

	it("部分マージ時に非対象項目を破壊しない", () => {
		const base = createStrengthParameter({
			period: 168,
			level: 60,
			evolved: true,
			maxSkillLevel: true,
			totalFlags: [false, true, false],
			fieldBonus: 0,
			recipeBonus: 19,
		});
		const settings = {
			...createDefaultTimelineBonusSettings(),
			fieldBonus: 35,
			isGoodCampTicketSet: true,
			recipeBonus: 61,
			recipeLevel: 55,
		};

		const merged = mergeTimelineBonusSettingsIntoStrengthParameter(
			base,
			settings,
		);

		expect(merged.period).toBe(168);
		expect(merged.level).toBe(60);
		expect(merged.evolved).toBe(true);
		expect(merged.maxSkillLevel).toBe(true);
		expect(merged.totalFlags).toEqual([false, true, false]);
		expect(merged.fieldBonus).toBe(35);
		expect(merged.isGoodCampTicketSet).toBe(true);
		expect(merged.recipeBonus).toBe(61);
		expect(merged.recipeLevel).toBe(55);
	});

	it("イベント固定きのみを正規化する", () => {
		const normalized = normalizeTimelineBonusSettings({
			...createDefaultTimelineBonusSettings(),
			event: "raikou entei suicune research 1st week",
			fieldIndex: 0,
			favoriteType: ["normal", "normal", "normal"],
		});

		expect(normalized.favoriteType).toEqual(["electric", "fire", "water"]);
	});

	it("IV設定へ保存する時に対象項目だけを更新する", () => {
		const base = createStrengthParameter({
			period: 168,
			level: 55,
			evolved: true,
			totalFlags: [false, true, false],
			fieldBonus: 0,
			recipeBonus: 19,
		});
		localStorage.setItem(IV_PARAMETER_STORAGE_KEY, JSON.stringify(base));

		const settings = {
			...createDefaultTimelineBonusSettings(),
			fieldBonus: 45,
			isGoodCampTicketSet: true,
			recipeBonus: 48,
			recipeLevel: 40,
			event: "custom",
		};

		saveTimelineBonusSettingsToIvStorage(settings);
		const loaded = loadStrengthParameter();

		expect(loaded.period).toBe(168);
		expect(loaded.level).toBe(55);
		expect(loaded.evolved).toBe(true);
		expect(loaded.totalFlags).toEqual([false, true, false]);
		expect(loaded.fieldBonus).toBe(45);
		expect(loaded.isGoodCampTicketSet).toBe(true);
		expect(loaded.recipeBonus).toBe(48);
		expect(loaded.recipeLevel).toBe(40);
		expect(loaded.event).toBe("custom");
	});

	it("StrengthParameter構築時に保存済み Mew 設定を引き継ぐ", () => {
		localStorage.setItem(
			IV_PARAMETER_STORAGE_KEY,
			JSON.stringify(
				createStrengthParameter({
					mew: {
						ing: 18,
						skill1: 7,
						skill2: 4.5,
						skill3: 2.5,
						success: 35,
					},
				}),
			),
		);

		const parameter = buildStrengthParameterFromTimelineBonusSettings(
			createDefaultTimelineBonusSettings(),
		);

		expect(parameter.mew).toEqual({
			ing: 18,
			skill1: 7,
			skill2: 4.5,
			skill3: 2.5,
			success: 35,
		});
	});
});
