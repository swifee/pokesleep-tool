import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import {
	loadProvisionalSettingsFromStorage,
	normalizeProvisionalSettings,
	STORAGE_KEY_PROVISIONAL_SETTINGS,
	saveProvisionalSettingsToStorage,
} from "./ProvisionalSettingsStorage";

describe("ProvisionalSettingsStorage 正規化", () => {
	it("未指定の項目は既定値で埋める", () => {
		expect(normalizeProvisionalSettings(undefined)).toEqual(
			createDefaultProvisionalSettings(),
		);
		expect(normalizeProvisionalSettings({})).toEqual(
			createDefaultProvisionalSettings(),
		);
	});

	it("重ねがけ数は上限に合わせてクランプする", () => {
		const normalized = normalizeProvisionalSettings({
			berryZone: {
				enabled: true,
				maxStackCount: 3,
				initialStackCount: 10,
				berryEnergyBonusPercent: 25,
				snorlaxEnergyByLevel: [1, 2, 3, 4, 5, 6],
			},
		});

		expect(normalized.berryZone.maxStackCount).toBe(3);
		expect(normalized.berryZone.initialStackCount).toBe(3);
	});

	it("カビゴンエナジーはスキルレベル分の配列に整える", () => {
		const normalized = normalizeProvisionalSettings({
			berryZone: { snorlaxEnergyByLevel: [500, -10, "x", 700] },
		});
		const defaults = createDefaultProvisionalSettings();

		expect(normalized.berryZone.snorlaxEnergyByLevel).toHaveLength(6);
		expect(normalized.berryZone.snorlaxEnergyByLevel[0]).toBe(500);
		expect(normalized.berryZone.snorlaxEnergyByLevel[1]).toBe(0);
		expect(normalized.berryZone.snorlaxEnergyByLevel[2]).toBe(
			defaults.berryZone.snorlaxEnergyByLevel[2],
		);
		expect(normalized.berryZone.snorlaxEnergyByLevel[3]).toBe(700);
	});

	it("仮ステータスは有効範囲に収める", () => {
		const normalized = normalizeProvisionalSettings({
			placeholderPokemon: {
				enabled: true,
				helpingFrequencySeconds: 10,
				skillRatePercent: 500,
				carryLimit: -5,
			},
		});

		expect(normalized.placeholderPokemon.helpingFrequencySeconds).toBe(300);
		expect(normalized.placeholderPokemon.skillRatePercent).toBe(100);
		expect(normalized.placeholderPokemon.carryLimit).toBe(0);
	});
});

describe("ProvisionalSettingsStorage とてもおおきなマゴのみの正規化", () => {
	it("範囲外の値をクランプする", () => {
		const normalized = normalizeProvisionalSettings({
			hugeMagoBerry: {
				enabled: true,
				energyMultiplier: -1,
				legendaryPickupRatePercent: 250,
				psychicPickupRatePercent: -10,
				otherPickupRatePercent: 12.5,
			},
		});

		expect(normalized.hugeMagoBerry).toEqual({
			enabled: true,
			energyMultiplier: 0,
			legendaryPickupRatePercent: 100,
			psychicPickupRatePercent: 0,
			otherPickupRatePercent: 12.5,
		});
	});

	it("未指定なら既定値を使う", () => {
		const normalized = normalizeProvisionalSettings({ hugeMagoBerry: {} });

		expect(normalized.hugeMagoBerry).toEqual(
			createDefaultProvisionalSettings().hugeMagoBerry,
		);
	});
});

describe("ProvisionalSettingsStorage 永続化", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("保存した設定を読み戻せる", () => {
		const settings = createDefaultProvisionalSettings();
		settings.berryZone.enabled = true;
		settings.berryZone.berryEnergyBonusPercent = 35;

		saveProvisionalSettingsToStorage(settings);

		expect(loadProvisionalSettingsFromStorage()).toEqual(settings);
	});

	it("保存値が壊れている場合は既定値を返す", () => {
		localStorage.setItem(STORAGE_KEY_PROVISIONAL_SETTINGS, "{invalid");

		expect(loadProvisionalSettingsFromStorage()).toEqual(
			createDefaultProvisionalSettings(),
		);
	});

	it("未保存なら既定値を返す", () => {
		expect(loadProvisionalSettingsFromStorage()).toEqual(
			createDefaultProvisionalSettings(),
		);
	});
});
