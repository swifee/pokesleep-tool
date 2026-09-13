import { describe, expect, it } from "vitest";
import { MONDAY, SUNDAY, type Weekday } from "../types/TimeSlotTypes";
import {
	getWeekdayDefaultLabel,
	getWeekdayForDayIndex,
	getWeekdayLabelKey,
	isSundayForDayIndex,
	WEEKDAY_SELECT_ORDER,
} from "./WeekdayUtils";

describe("getWeekdayForDayIndex", () => {
	it("開始曜日に日インデックスを足した曜日を返す", () => {
		expect(getWeekdayForDayIndex(MONDAY, 0)).toBe(MONDAY);
		expect(getWeekdayForDayIndex(MONDAY, 1)).toBe(2);
		expect(getWeekdayForDayIndex(MONDAY, 6)).toBe(SUNDAY);
	});

	it("週をまたぐと曜日が巡回する", () => {
		expect(getWeekdayForDayIndex(6, 1)).toBe(SUNDAY);
		expect(getWeekdayForDayIndex(SUNDAY, 7)).toBe(SUNDAY);
		expect(getWeekdayForDayIndex(5, 9)).toBe(SUNDAY);
	});

	it("負や小数の日インデックスは0日目として扱う", () => {
		expect(getWeekdayForDayIndex(3, -1)).toBe(3);
		expect(getWeekdayForDayIndex(3, 1.9)).toBe(4);
	});
});

describe("isSundayForDayIndex", () => {
	it("月曜開始なら7日目（インデックス6）が日曜になる", () => {
		const sundays = [0, 1, 2, 3, 4, 5, 6].map((dayIndex) =>
			isSundayForDayIndex(MONDAY, dayIndex),
		);
		expect(sundays).toEqual([false, false, false, false, false, false, true]);
	});

	it("日曜開始なら初日が日曜になる", () => {
		expect(isSundayForDayIndex(SUNDAY, 0)).toBe(true);
		expect(isSundayForDayIndex(SUNDAY, 1)).toBe(false);
	});
});

describe("weekday labels", () => {
	it("セレクタの表示順は月曜始まりで日曜が最後", () => {
		expect(WEEKDAY_SELECT_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
	});

	it("曜日ごとに TeamTimeline 名前空間の翻訳キーと既定文言を返す", () => {
		const expectations: [Weekday, string, string][] = [
			[0, "TeamTimeline.weekday sun", "日曜"],
			[1, "TeamTimeline.weekday mon", "月曜"],
			[2, "TeamTimeline.weekday tue", "火曜"],
			[3, "TeamTimeline.weekday wed", "水曜"],
			[4, "TeamTimeline.weekday thu", "木曜"],
			[5, "TeamTimeline.weekday fri", "金曜"],
			[6, "TeamTimeline.weekday sat", "土曜"],
		];
		for (const [weekday, key, label] of expectations) {
			expect(getWeekdayLabelKey(weekday)).toBe(key);
			expect(getWeekdayDefaultLabel(weekday)).toBe(label);
		}
	});
});
