import { describe, expect, it } from "vitest";
import { getSkillSubValue, getSkillValue } from "../../../../util/MainSkill";
import {
	addBerryZoneRate,
	applyBerryZoneRateGains,
	BERRY_ZONE_MAX_RATE_PERCENT,
	clampBerryZoneRatePercent,
	distributeBerryZoneBonusEP,
	getBerryZoneBerryMultiplier,
	getBerryZoneMultiplierForType,
	getBerryZoneRateGainPercent,
	getBerryZoneStrengthPerTrigger,
	INITIAL_BERRY_ZONE_STATE,
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

	describe("applyBerryZoneRateGains", () => {
		it("発動したポケモンごとに増加率への寄与を積み上げる", () => {
			const first = applyBerryZoneRateGains(
				INITIAL_BERRY_ZONE_STATE,
				new Map([[1, 4]]),
			);
			expect(first.ratePercent).toBe(4);
			expect(first.contributionByPokemonId.get(1)).toBe(4);

			const second = applyBerryZoneRateGains(first, new Map([[1, 2]]));
			expect(second.ratePercent).toBe(6);
			expect(second.contributionByPokemonId.get(1)).toBe(6);
			// 元の状態は変えない
			expect(first.ratePercent).toBe(4);
			expect(first.contributionByPokemonId.get(1)).toBe(4);
		});

		it("上限で切り捨てられた分は寄与に数えない", () => {
			const state = applyBerryZoneRateGains(
				INITIAL_BERRY_ZONE_STATE,
				new Map([
					[1, 20],
					[2, 10],
				]),
			);
			expect(state.ratePercent).toBe(BERRY_ZONE_MAX_RATE_PERCENT);
			expect(state.contributionByPokemonId.get(1)).toBe(20);
			expect(state.contributionByPokemonId.get(2)).toBe(4);

			const capped = applyBerryZoneRateGains(state, new Map([[3, 2]]));
			expect(capped.ratePercent).toBe(BERRY_ZONE_MAX_RATE_PERCENT);
			expect(capped.contributionByPokemonId.has(3)).toBe(false);
		});

		it("増加がなければ状態は変わらない", () => {
			const state = applyBerryZoneRateGains(
				INITIAL_BERRY_ZONE_STATE,
				new Map([[1, 0]]),
			);
			expect(state.ratePercent).toBe(0);
			expect(state.contributionByPokemonId.size).toBe(0);
		});
	});

	describe("distributeBerryZoneBonusEP", () => {
		it("寄与が1匹なら全額をそのポケモンに配分する", () => {
			const distributed = distributeBerryZoneBonusEP(500, new Map([[1, 6]]));
			expect(distributed.get(1)).toBe(500);
			expect(distributed.size).toBe(1);
		});

		it("寄与が複数なら寄与分に比例して配分する", () => {
			const distributed = distributeBerryZoneBonusEP(
				300,
				new Map([
					[1, 20],
					[2, 4],
				]),
			);
			expect(distributed.get(1)).toBeCloseTo(250, 10);
			expect(distributed.get(2)).toBeCloseTo(50, 10);
		});

		it("上昇分がない、または寄与がないときは空になる", () => {
			expect(distributeBerryZoneBonusEP(0, new Map([[1, 6]])).size).toBe(0);
			expect(distributeBerryZoneBonusEP(100, new Map()).size).toBe(0);
			expect(
				distributeBerryZoneBonusEP(Number.NaN, new Map([[1, 6]])).size,
			).toBe(0);
		});
	});
});
