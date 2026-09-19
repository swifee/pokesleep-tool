import { describe, expect, it } from "vitest";
import type { TimeSlot } from "../types/TimeSlotTypes";
import { buildExpandedTimeline } from "./TimelineDayExpansion";

describe("buildExpandedTimeline", () => {
	it("2日目以降は先頭の就寝コピーを含めない", () => {
		const timeSlots: TimeSlot[] = [
			{ id: "sleep", time: "22:30", sleepState: "sleep", hasMeal: false },
			{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
			{ id: "lunch", time: "12:00", sleepState: "none", hasMeal: true },
		];

		const expanded = buildExpandedTimeline(timeSlots, 2);
		const ids = expanded.expandedSlots.map((slot) => slot.slot.id);

		expect(ids).toContain("sleep__day0");
		expect(ids).toContain("sleep-end__day0");
		expect(ids).toContain("wake__day1");
		expect(ids).toContain("sleep-end__day1");
		expect(ids).not.toContain("sleep__day1");
	});

	it("就寝〜AM4:00 の間のスロットは就寝の直後に時系列で並ぶ", () => {
		const timeSlots: TimeSlot[] = [
			{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
			{ id: "dinner", time: "18:00", sleepState: "none", hasMeal: true },
			{ id: "sleep", time: "23:00", sleepState: "sleep", hasMeal: false },
			{ id: "late-night", time: "01:00", sleepState: "none", hasMeal: false },
		];

		const expanded = buildExpandedTimeline(timeSlots, 1);
		expect(expanded.baseDaySlots.map((slot) => slot.id)).toEqual([
			"sleep",
			"late-night",
			"wake",
			"dinner",
			"sleep-end",
		]);
	});

	it("日付帯は各日の最後のセル（就寝の終わり）の直後に配置される", () => {
		const timeSlots: TimeSlot[] = [
			{ id: "sleep", time: "23:00", sleepState: "sleep", hasMeal: false },
			{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
			{ id: "lunch", time: "12:00", sleepState: "none", hasMeal: true },
		];

		const expanded = buildExpandedTimeline(timeSlots, 3);
		expect(expanded.dayBands).toEqual([
			{ afterDisplaySlotId: "sleep-end__day0", dayNumber: 2 },
			{ afterDisplaySlotId: "sleep-end__day1", dayNumber: 3 },
		]);
	});

	it("就寝〜起床の間にセルがあっても日付帯は就寝の終わりの直後に置く", () => {
		// 自動シミュが就寝中の入れ替えのために追加するセル（AM4:00 より前）を想定
		const timeSlots: TimeSlot[] = [
			{ id: "sleep", time: "23:00", sleepState: "sleep", hasMeal: false },
			{
				id: "quick-swap-0212",
				time: "02:12",
				sleepState: "none",
				hasMeal: false,
			},
			{
				id: "quick-swap-0348",
				time: "03:48",
				sleepState: "none",
				hasMeal: false,
			},
			{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
		];

		const expanded = buildExpandedTimeline(timeSlots, 3);
		expect(expanded.dayBands).toEqual([
			{ afterDisplaySlotId: "sleep-end__day0", dayNumber: 2 },
			{ afterDisplaySlotId: "sleep-end__day1", dayNumber: 3 },
		]);
		// 2日目のセルはすべて2日目の日付帯より後に並ぶ
		const ids = expanded.expandedSlots.map((slot) => slot.slot.id);
		const bandIndex = ids.indexOf("sleep-end__day0");
		expect(ids.indexOf("quick-swap-0212__day1")).toBeGreaterThan(bandIndex);
		expect(ids.indexOf("wake__day1")).toBeGreaterThan(bandIndex);
	});

	it("就寝セルがない場合は日付帯を各日の最後のセルの直後に置く", () => {
		const timeSlots: TimeSlot[] = [
			{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
			{ id: "late-night", time: "01:00", sleepState: "none", hasMeal: false },
		];

		const expanded = buildExpandedTimeline(timeSlots, 2);
		expect(expanded.dayBands).toEqual([
			{ afterDisplaySlotId: "late-night__day0", dayNumber: 2 },
		]);
	});

	it("集計期間が1日のときは日付帯を作らない", () => {
		const timeSlots: TimeSlot[] = [
			{ id: "sleep", time: "23:00", sleepState: "sleep", hasMeal: false },
			{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
		];

		expect(buildExpandedTimeline(timeSlots, 1).dayBands).toEqual([]);
	});
});
