import { describe, expect, it } from "vitest";
import {
	type BerryZoneProvisionalSettings,
	createDefaultBerryZoneSettings,
} from "../types/ProvisionalSettingsTypes";
import {
	addBerryZoneStacks,
	clampBerryZoneStackCount,
	getBerryZoneBerryMultiplier,
	getBerryZoneMultiplierForType,
	getBerryZoneSnorlaxEnergy,
	getInitialBerryZoneStackCount,
	isBerryZoneSkill,
} from "./BerryZoneUtils";

function createSettings(
	overrides: Partial<BerryZoneProvisionalSettings> = {},
): BerryZoneProvisionalSettings {
	return {
		...createDefaultBerryZoneSettings(),
		enabled: true,
		maxStackCount: 5,
		berryEnergyBonusPercent: 20,
		snorlaxEnergyByLevel: [100, 200, 300, 400, 500, 600],
		...overrides,
	};
}

describe("BerryZoneUtils スキル判定", () => {
	it("きのみゾーンを展開するスキルを判定する", () => {
		expect(isBerryZoneSkill("Berry Zone")).toBe(true);
		expect(isBerryZoneSkill("Berry Zone (Psystrike)")).toBe(true);
		expect(isBerryZoneSkill("Charge Strength S")).toBe(false);
	});
});

describe("BerryZoneUtils 重ねがけ", () => {
	it("重ねがけ数は 0〜上限に収まる", () => {
		const settings = createSettings();

		expect(clampBerryZoneStackCount(-1, settings)).toBe(0);
		expect(clampBerryZoneStackCount(3, settings)).toBe(3);
		expect(clampBerryZoneStackCount(9, settings)).toBe(5);
		expect(clampBerryZoneStackCount(Number.NaN, settings)).toBe(0);
	});

	it("発動回数だけ重ねがけし、上限で頭打ちになる", () => {
		const settings = createSettings();

		expect(addBerryZoneStacks(0, 2, settings)).toBe(2);
		expect(addBerryZoneStacks(2, 2, settings)).toBe(4);
		expect(addBerryZoneStacks(4, 3, settings)).toBe(5);
	});

	it("開始時の重ねがけ数は上限でクランプされる", () => {
		expect(
			getInitialBerryZoneStackCount(
				createSettings({ initialStackCount: 3, maxStackCount: 5 }),
			),
		).toBe(3);
		expect(
			getInitialBerryZoneStackCount(
				createSettings({ initialStackCount: 9, maxStackCount: 5 }),
			),
		).toBe(5);
	});

	it("仮設定が無効なら重ねがけは発生しない", () => {
		const settings = createSettings({ enabled: false, initialStackCount: 3 });

		expect(getInitialBerryZoneStackCount(settings)).toBe(0);
		expect(addBerryZoneStacks(3, 2, settings)).toBe(0);
		expect(getInitialBerryZoneStackCount(undefined)).toBe(0);
	});
});

describe("BerryZoneUtils きのみエナジー倍率", () => {
	it("重ねがけ数に比例して倍率が上がる", () => {
		const settings = createSettings();

		expect(getBerryZoneBerryMultiplier(settings, 0)).toBe(1);
		expect(getBerryZoneBerryMultiplier(settings, 1)).toBeCloseTo(1.2, 10);
		expect(getBerryZoneBerryMultiplier(settings, 5)).toBeCloseTo(2, 10);
	});

	it("マゴのみ（エスパータイプ）以外には適用されない", () => {
		const settings = createSettings();

		expect(getBerryZoneMultiplierForType("psychic", settings, 2)).toBeCloseTo(
			1.4,
			10,
		);
		expect(getBerryZoneMultiplierForType("fire", settings, 2)).toBe(1);
	});

	it("仮設定が無効なら倍率は 1 のまま", () => {
		expect(
			getBerryZoneMultiplierForType(
				"psychic",
				createSettings({ enabled: false }),
				5,
			),
		).toBe(1);
		expect(getBerryZoneMultiplierForType("psychic", undefined, 5)).toBe(1);
	});
});

describe("BerryZoneUtils カビゴンエナジー", () => {
	it("スキルレベルに対応する仮の値を返す", () => {
		const settings = createSettings();

		expect(getBerryZoneSnorlaxEnergy(settings, 1)).toBe(100);
		expect(getBerryZoneSnorlaxEnergy(settings, 6)).toBe(600);
	});

	it("範囲外のスキルレベルや無効時は 0 を返す", () => {
		const settings = createSettings();

		expect(getBerryZoneSnorlaxEnergy(settings, 7)).toBe(0);
		expect(getBerryZoneSnorlaxEnergy(settings, 0)).toBe(0);
		expect(
			getBerryZoneSnorlaxEnergy(createSettings({ enabled: false }), 3),
		).toBe(0);
		expect(getBerryZoneSnorlaxEnergy(undefined, 3)).toBe(0);
	});
});
