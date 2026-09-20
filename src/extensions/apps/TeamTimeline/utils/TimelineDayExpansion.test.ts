import { describe, expect, it } from "vitest";
import {
	MONDAY,
	SUNDAY,
	type TimeSlot,
	type Weekday,
} from "../types/TimeSlotTypes";
import { buildExpandedTimeline } from "./TimelineDayExpansion";

/** 土曜日 */
const SATURDAY: Weekday = 6;

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

	it("dayIndexes を持つ時間帯はその日にだけ展開する", () => {
		// 自動シミュが 2 日目だけに追加する入れ替え用のセルを想定
		const timeSlots: TimeSlot[] = [
			{ id: "sleep", time: "23:00", sleepState: "sleep", hasMeal: false },
			{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
			{
				id: "quick-swap-0900",
				time: "09:00",
				sleepState: "none",
				hasMeal: false,
				dayIndexes: [1],
			},
		];

		const expanded = buildExpandedTimeline(timeSlots, 3);
		const ids = expanded.expandedSlots.map((slot) => slot.slot.id);
		expect(ids).toEqual([
			"sleep__day0",
			"wake__day0",
			"sleep-end__day0",
			"wake__day1",
			"quick-swap-0900__day1",
			"sleep-end__day1",
			"wake__day2",
			"sleep-end__day2",
		]);
		// 毎日の並び（枠の順序）には含める
		expect(expanded.baseDaySlots.map((slot) => slot.id)).toEqual([
			"sleep",
			"wake",
			"quick-swap-0900",
			"sleep-end",
		]);
		expect(expanded.slotsByDay.map((slots) => slots.length)).toEqual([3, 3, 2]);
		// 日内の位置は、その日に実際にあるセルの並びで数える
		const daySlot = expanded.expandedSlots.find(
			(slot) => slot.slot.id === "sleep-end__day1",
		);
		expect(daySlot?.slotIndexInDay).toBe(2);
		expect(expanded.dayBands).toEqual([
			{ afterDisplaySlotId: "sleep-end__day0", dayNumber: 2 },
			{ afterDisplaySlotId: "sleep-end__day1", dayNumber: 3 },
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

describe("buildExpandedTimeline 日曜の最後の食事の就寝直前への移動", () => {
	const timeSlots: TimeSlot[] = [
		{ id: "sleep", time: "23:00", sleepState: "sleep", hasMeal: false },
		{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: true },
		{ id: "lunch", time: "12:00", sleepState: "none", hasMeal: true },
		{ id: "dinner", time: "18:00", sleepState: "none", hasMeal: true },
	];
	const mealSlotIds = (
		expanded: ReturnType<typeof buildExpandedTimeline>,
		dayIndex: number,
	): string[] =>
		expanded.slotsByDay[dayIndex]
			.filter((slot) => slot.hasMeal)
			.map((slot) => slot.id);

	it("日曜にあたる日は最後の食事（夕食）を就寝スロットへ移す", () => {
		// 土曜開始の2日間 → 2日目（dayIndex 1）が日曜
		const expanded = buildExpandedTimeline(timeSlots, 2, SATURDAY);

		expect(mealSlotIds(expanded, 0)).toEqual([
			"wake__day0",
			"lunch__day0",
			"dinner__day0",
		]);
		expect(mealSlotIds(expanded, 1)).toEqual([
			"wake__day1",
			"lunch__day1",
			"sleep-end__day1",
		]);
	});

	it("移動しても各スロットの並び順と ID は変わらない", () => {
		const withRelocation = buildExpandedTimeline(timeSlots, 2, SATURDAY);
		const withoutRelocation = buildExpandedTimeline(timeSlots, 2);

		expect(withRelocation.expandedSlots.map((slot) => slot.slot.id)).toEqual(
			withoutRelocation.expandedSlots.map((slot) => slot.slot.id),
		);
		expect(withRelocation.dayBands).toEqual(withoutRelocation.dayBands);
		// 時間帯設定（元のスロット）は書き換えない
		expect(timeSlots.find((slot) => slot.id === "dinner")?.hasMeal).toBe(true);
	});

	it("開始曜日を省略すると移動しない", () => {
		const expanded = buildExpandedTimeline(timeSlots, 2);
		expect(mealSlotIds(expanded, 1)).toEqual([
			"wake__day1",
			"lunch__day1",
			"dinner__day1",
		]);
	});

	it("7日間は月曜開始扱いなので7日目だけが日曜になる", () => {
		const expanded = buildExpandedTimeline(timeSlots, 7, MONDAY);
		for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
			expect(mealSlotIds(expanded, dayIndex)).toContain(
				`dinner__day${dayIndex}`,
			);
		}
		expect(mealSlotIds(expanded, 6)).toEqual([
			"wake__day6",
			"lunch__day6",
			"sleep-end__day6",
		]);
	});

	it("最後の食事と就寝時刻の食事区分が異なるときは移動しない", () => {
		// 夕食がなく昼食が最後 → 23:00（夕食枠）には昼食を作れない
		const noDinner: TimeSlot[] = timeSlots.map((slot) =>
			slot.id === "dinner" ? { ...slot, hasMeal: false } : slot,
		);
		const expanded = buildExpandedTimeline(noDinner, 1, SUNDAY);
		expect(mealSlotIds(expanded, 0)).toEqual(["wake__day0", "lunch__day0"]);
	});

	it("就寝スロット自体が食事スロットなら何もしない", () => {
		const dinnerAtBedtime: TimeSlot[] = timeSlots.map((slot) => {
			if (slot.id === "dinner") return { ...slot, hasMeal: false };
			if (slot.id === "sleep") return { ...slot, hasMeal: true };
			return slot;
		});
		const expanded = buildExpandedTimeline(dinnerAtBedtime, 1, SUNDAY);
		expect(mealSlotIds(expanded, 0)).toEqual([
			"sleep__day0",
			"wake__day0",
			"lunch__day0",
			"sleep-end__day0",
		]);
	});

	it("就寝スロットがない設定では移動しない", () => {
		const noSleep: TimeSlot[] = timeSlots.filter((slot) => slot.id !== "sleep");
		const expanded = buildExpandedTimeline(noSleep, 1, SUNDAY);
		expect(mealSlotIds(expanded, 0)).toEqual([
			"wake__day0",
			"lunch__day0",
			"dinner__day0",
		]);
	});

	it("就寝〜AM4:00 の間の追加セルがあっても移動先は就寝の終わり", () => {
		// 自動シミュが就寝中の入れ替えのために追加するセルを想定
		const withLateNight: TimeSlot[] = [
			...timeSlots,
			{ id: "quick-swap", time: "20:30", sleepState: "none", hasMeal: false },
			{ id: "late-night", time: "01:00", sleepState: "none", hasMeal: false },
		];
		const expanded = buildExpandedTimeline(withLateNight, 1, SUNDAY);
		expect(mealSlotIds(expanded, 0)).toEqual([
			"wake__day0",
			"lunch__day0",
			"sleep-end__day0",
		]);
	});
});
