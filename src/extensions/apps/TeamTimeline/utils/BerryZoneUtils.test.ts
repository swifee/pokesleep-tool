import { describe, expect, it } from "vitest";
import { getSkillSubValue, getSkillValue } from "../../../../util/MainSkill";
import {
	addBerryZoneRate,
	BERRY_ZONE_MAX_RATE_PERCENT,
	clampBerryZoneRatePercent,
	getBerryZoneBerryMultiplier,
	getBerryZoneMultiplierForType,
	getBerryZoneRateGainPercent,
	getBerryZoneStrengthPerTrigger,
	isBerryZoneSkill,
} from "./BerryZoneUtils";

describe("BerryZoneUtils", () => {
	it("きのみゾーン系のスキルだけを判定する", () => {
		expect(isBerryZoneSkill("Berry Zone (Psystrike)")).toBe(true);
		expect(isBerryZoneSkill("Berry Zone")).toBe(true);
		expect(isBerryZoneSkill("Charge Strength S")).toBe(false);
		expect(isBerryZoneSkill("Berry Burst")).toBe(false);
	});

	it("発動1回あたりのカビゴンエナジーは上流の公式値を使う", () => {
		// 公式: 1408 / 2002 / 2762 / 3813 / 5264 / 7274
		expect(getBerryZoneStrengthPerTrigger("Berry Zone (Psystrike)", 1)).toBe(
			1408,
		);
		expect(getBerryZoneStrengthPerTrigger("Berry Zone (Psystrike)", 6)).toBe(
			7274,
		);
		for (let level = 1; level <= 6; level += 1) {
			expect(
				getBerryZoneStrengthPerTrigger("Berry Zone (Psystrike)", level),
			).toBe(getSkillValue("Berry Zone (Psystrike)", level));
		}
	});

	it("発動1回あたりの増加率は上流の公式値を使う", () => {
		// 公式: 0.6 / 0.8 / 1.0 / 1.2 / 1.6 / 2.0 (%)
		expect(getBerryZoneRateGainPercent("Berry Zone (Psystrike)", 1)).toBe(0.6);
		expect(getBerryZoneRateGainPercent("Berry Zone (Psystrike)", 6)).toBe(2);
		for (let level = 1; level <= 6; level += 1) {
			expect(getBerryZoneRateGainPercent("Berry Zone (Psystrike)", level)).toBe(
				getSkillSubValue("Berry Zone (Psystrike)", level),
			);
		}
	});

	it("数値を持たないスキル名には 0 を返す", () => {
		expect(getBerryZoneStrengthPerTrigger("Berry Zone", 6)).toBe(0);
		expect(getBerryZoneRateGainPercent("Berry Zone", 6)).toBe(0);
		expect(getBerryZoneStrengthPerTrigger("Charge Strength S", 6)).toBe(0);
		expect(getBerryZoneRateGainPercent("Charge Strength S", 6)).toBe(0);
	});

	it("増加率は 0〜上限(24%) に収める", () => {
		expect(BERRY_ZONE_MAX_RATE_PERCENT).toBe(24);
		expect(clampBerryZoneRatePercent(-1)).toBe(0);
		expect(clampBerryZoneRatePercent(12.4)).toBe(12.4);
		expect(clampBerryZoneRatePercent(24)).toBe(24);
		expect(clampBerryZoneRatePercent(30)).toBe(24);
		expect(clampBerryZoneRatePercent(Number.NaN)).toBe(0);
		expect(clampBerryZoneRatePercent(Number.POSITIVE_INFINITY)).toBe(0);
	});

	it("発動による増加は上限で止まる", () => {
		expect(addBerryZoneRate(0, 2)).toBe(2);
		expect(addBerryZoneRate(10, 0.6)).toBeCloseTo(10.6, 10);
		// Lv6 (2%) は 12 回で上限に達し、それ以上は増えない
		expect(addBerryZoneRate(22, 2)).toBe(24);
		expect(addBerryZoneRate(24, 2)).toBe(24);
		expect(addBerryZoneRate(23, 4)).toBe(24);
		// 負の増加や NaN は無視する
		expect(addBerryZoneRate(10, -5)).toBe(10);
		expect(addBerryZoneRate(10, Number.NaN)).toBe(10);
	});

	it("きのみエナジー倍率は 1 + 増加率/100", () => {
		expect(getBerryZoneBerryMultiplier(0)).toBe(1);
		expect(getBerryZoneBerryMultiplier(2)).toBeCloseTo(1.02, 10);
		expect(getBerryZoneBerryMultiplier(24)).toBeCloseTo(1.24, 10);
		expect(getBerryZoneBerryMultiplier(50)).toBeCloseTo(1.24, 10);
	});

	it("倍率はマゴのみ（エスパー）にのみ適用される", () => {
		expect(getBerryZoneMultiplierForType("psychic", 24)).toBeCloseTo(1.24, 10);
		expect(getBerryZoneMultiplierForType("electric", 24)).toBe(1);
		expect(getBerryZoneMultiplierForType("psychic", 0)).toBe(1);
	});
});
