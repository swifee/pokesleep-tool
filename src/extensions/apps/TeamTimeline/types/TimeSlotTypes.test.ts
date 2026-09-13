import { describe, expect, it } from "vitest";
import {
	DEFAULT_SIMULATION_CONFIG,
	isWeekday,
	MAX_SIMULATION_DAYS,
	MONDAY,
	resolveStartDayOfWeek,
	SUNDAY,
} from "./TimeSlotTypes";

describe("DEFAULT_SIMULATION_CONFIG", () => {
	it("天井ONかつ月曜開始が既定", () => {
		expect(DEFAULT_SIMULATION_CONFIG.pityProc).toBe(true);
		expect(DEFAULT_SIMULATION_CONFIG.startDayOfWeek).toBe(MONDAY);
	});
});

describe("isWeekday", () => {
	it("0〜6の整数だけを曜日として認める", () => {
		for (const value of [0, 1, 2, 3, 4, 5, 6]) {
			expect(isWeekday(value)).toBe(true);
		}
	});

	it("範囲外・小数・数値以外は曜日ではない", () => {
		expect(isWeekday(-1)).toBe(false);
		expect(isWeekday(7)).toBe(false);
		expect(isWeekday(1.5)).toBe(false);
		expect(isWeekday(Number.NaN)).toBe(false);
		expect(isWeekday("1")).toBe(false);
		expect(isWeekday(null)).toBe(false);
		expect(isWeekday(undefined)).toBe(false);
	});
});

describe("resolveStartDayOfWeek", () => {
	it("1〜6日の期間では指定した曜日をそのまま使う", () => {
		for (let days = 1; days < MAX_SIMULATION_DAYS; days++) {
			expect(resolveStartDayOfWeek(days, SUNDAY)).toBe(SUNDAY);
			expect(resolveStartDayOfWeek(days, 4)).toBe(4);
		}
	});

	it("7日間では月曜固定になる（最終日が日曜）", () => {
		expect(resolveStartDayOfWeek(MAX_SIMULATION_DAYS, SUNDAY)).toBe(MONDAY);
		expect(resolveStartDayOfWeek(MAX_SIMULATION_DAYS, 4)).toBe(MONDAY);
	});

	it("上限を超える日数も7日間として月曜固定になる", () => {
		expect(resolveStartDayOfWeek(10, SUNDAY)).toBe(MONDAY);
	});

	it("不正な日数は最小日数として扱い、指定した曜日を使う", () => {
		expect(resolveStartDayOfWeek(Number.NaN, SUNDAY)).toBe(SUNDAY);
	});
});
