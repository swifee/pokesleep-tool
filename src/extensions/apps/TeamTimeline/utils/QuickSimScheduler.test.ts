import { describe, expect, it } from "vitest";
import {
	MINUTES_PER_DAY,
	type QuickSimDaySchedule,
	type QuickSimMember,
} from "../types/QuickSimTypes";
import { DEFAULT_TIME_SLOTS, type TimeSlot } from "../types/TimeSlotTypes";
import {
	buildQuickSimDaySchedule,
	clampQuickSimUsagePercent,
	getQuickSimTargetMinutesById,
	getQuickSimTotalUsagePercent,
	isQuickSimUsageExceeded,
	resolveQuickSimDayStructure,
	usagePercentToMinutes,
	validateQuickSimSchedule,
} from "./QuickSimScheduler";

const SLEEP_MINUTES = 480; // 23:00 -> 07:00 (DEFAULT_TIME_SLOTS)

function members(...usages: number[]): QuickSimMember[] {
	return usages.map((usagePercent, index) => ({
		pokemonId: 100 + index,
		usagePercent,
	}));
}

function buildOrThrow(
	list: QuickSimMember[],
	timeSlots: TimeSlot[] = DEFAULT_TIME_SLOTS,
): QuickSimDaySchedule {
	const result = buildQuickSimDaySchedule(list, timeSlots);
	if (!result.ok) {
		throw new Error(`schedule failed: ${result.error}`);
	}
	return result.schedule;
}

function expectValid(schedule: QuickSimDaySchedule, list: QuickSimMember[]) {
	const errors = validateQuickSimSchedule(
		schedule,
		getQuickSimTargetMinutesById(list),
	);
	expect(errors).toEqual([]);
}

function countSwapStarts(schedule: QuickSimDaySchedule): number {
	return schedule.lanes.reduce(
		(sum, lane) =>
			sum + lane.filter((segment) => segment.startMinute > 0).length,
		0,
	);
}

function minutesById(schedule: QuickSimDaySchedule): Map<number, number> {
	const map = new Map<number, number>();
	for (const lane of schedule.lanes) {
		for (const segment of lane) {
			if (segment.pokemonId === null) continue;
			map.set(
				segment.pokemonId,
				(map.get(segment.pokemonId) ?? 0) +
					(segment.endMinute - segment.startMinute),
			);
		}
	}
	return map;
}

describe("usage helpers", () => {
	it("clamps and rounds usage percent", () => {
		expect(clampQuickSimUsagePercent(-5)).toBe(0);
		expect(clampQuickSimUsagePercent(150)).toBe(100);
		expect(clampQuickSimUsagePercent(33.4)).toBe(33);
		expect(clampQuickSimUsagePercent(Number.NaN)).toBe(0);
	});

	it("converts usage percent to minutes per day", () => {
		expect(usagePercentToMinutes(100)).toBe(MINUTES_PER_DAY);
		expect(usagePercentToMinutes(50)).toBe(720);
		expect(usagePercentToMinutes(1)).toBe(14);
		expect(usagePercentToMinutes(0)).toBe(0);
	});

	it("sums total usage and detects the 500% limit", () => {
		expect(getQuickSimTotalUsagePercent(members(100, 100, 50))).toBe(250);
		expect(isQuickSimUsageExceeded(members(100, 100, 100, 100, 100))).toBe(
			false,
		);
		expect(isQuickSimUsageExceeded(members(100, 100, 100, 100, 100, 1))).toBe(
			true,
		);
	});
});

describe("resolveQuickSimDayStructure", () => {
	it("uses the sleep slot as the day origin", () => {
		const structure = resolveQuickSimDayStructure(DEFAULT_TIME_SLOTS);
		expect(structure).toEqual({
			sleepSlotId: "slot-5",
			sleepTime: "23:00",
			wakeTime: "07:00",
			sleepMinutes: SLEEP_MINUTES,
		});
	});

	it("returns null without a sleep or wake slot", () => {
		expect(
			resolveQuickSimDayStructure([
				{ id: "a", time: "07:00", sleepState: "none", hasMeal: true },
			]),
		).toBeNull();
		expect(
			resolveQuickSimDayStructure([
				{ id: "s", time: "23:00", sleepState: "sleep", hasMeal: false },
				{ id: "a", time: "12:00", sleepState: "none", hasMeal: true },
			]),
		).toBeNull();
	});
});

describe("buildQuickSimDaySchedule", () => {
	it("reports errors for invalid input", () => {
		expect(
			buildQuickSimDaySchedule(members(100), [
				{ id: "a", time: "07:00", sleepState: "none", hasMeal: true },
			]),
		).toEqual({ ok: false, error: "noSleepSlot" });
		expect(buildQuickSimDaySchedule([], DEFAULT_TIME_SLOTS)).toEqual({
			ok: false,
			error: "noMembers",
		});
		expect(buildQuickSimDaySchedule(members(0, 0), DEFAULT_TIME_SLOTS)).toEqual(
			{ ok: false, error: "noMembers" },
		);
		expect(
			buildQuickSimDaySchedule(
				members(100, 100, 100, 100, 100, 10),
				DEFAULT_TIME_SLOTS,
			),
		).toEqual({ ok: false, error: "usageExceeded" });
	});

	it("keeps five full-time members in their own lanes without swaps", () => {
		const list = members(100, 100, 100, 100, 100);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(countSwapStarts(schedule)).toBe(0);
		expect(schedule.usesSleepSwaps).toBe(false);
		schedule.lanes.forEach((lane, index) => {
			expect(lane).toEqual([
				{ pokemonId: 100 + index, startMinute: 0, endMinute: MINUTES_PER_DAY },
			]);
		});
	});

	it("leaves lanes empty when fewer than five members are set", () => {
		const list = members(100, 50);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(schedule.lanes[0]).toEqual([
			{ pokemonId: 100, startMinute: 0, endMinute: MINUTES_PER_DAY },
		]);
		// 50% (720min) covers the night and continues after waking, then the lane is empty.
		expect(schedule.lanes[1]).toEqual([
			{ pokemonId: 101, startMinute: 0, endMinute: 720 },
			{ pokemonId: null, startMinute: 720, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.lanes[2]).toEqual([
			{ pokemonId: null, startMinute: 0, endMinute: MINUTES_PER_DAY },
		]);
	});

	it("lets a night member continue in its lane and fills the rest with a day-only member", () => {
		// D=70% (1008min) takes the night and 528 more minutes; E=30% (432min) fills the rest.
		const list = members(100, 100, 100, 70, 30);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(schedule.usesSleepSwaps).toBe(false);
		expect(schedule.lanes[3]).toEqual([
			{ pokemonId: 103, startMinute: 0, endMinute: SLEEP_MINUTES + 528 },
			{
				pokemonId: 104,
				startMinute: SLEEP_MINUTES + 528,
				endMinute: MINUTES_PER_DAY,
			},
		]);
		expect(countSwapStarts(schedule)).toBe(1);
	});

	it("does not pack two night members into one lane when both can stay put", () => {
		// Both 60% members (864min) cover the night and stay in their own lanes;
		// each lane then only needs one swap-out to an empty slot.
		const list = members(100, 100, 100, 60, 60);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(countSwapStarts(schedule)).toBe(2);
		expect(schedule.lanes[3]).toEqual([
			{ pokemonId: 103, startMinute: 0, endMinute: 864 },
			{ pokemonId: null, startMinute: 864, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.lanes[4]).toEqual([
			{ pokemonId: 104, startMinute: 0, endMinute: 864 },
			{ pokemonId: null, startMinute: 864, endMinute: MINUTES_PER_DAY },
		]);
	});

	it("starts day-only members at the wake slot and lines up their swap-outs", () => {
		// 30% (432min) cannot cover the night, so both members work after waking.
		// They enter at the wake slot in separate lanes and leave at the same time,
		// so only one extra time slot is needed for the swap-outs.
		const list = members(100, 100, 100, 30, 30);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(schedule.usesSleepSwaps).toBe(false);
		expect(schedule.lanes[3]).toEqual([
			{ pokemonId: null, startMinute: 0, endMinute: SLEEP_MINUTES },
			{
				pokemonId: 103,
				startMinute: SLEEP_MINUTES,
				endMinute: SLEEP_MINUTES + 432,
			},
			{
				pokemonId: null,
				startMinute: SLEEP_MINUTES + 432,
				endMinute: MINUTES_PER_DAY,
			},
		]);
		expect(schedule.lanes[4]).toEqual([
			{ pokemonId: null, startMinute: 0, endMinute: SLEEP_MINUTES },
			{
				pokemonId: 104,
				startMinute: SLEEP_MINUTES,
				endMinute: SLEEP_MINUTES + 432,
			},
			{
				pokemonId: null,
				startMinute: SLEEP_MINUTES + 432,
				endMinute: MINUTES_PER_DAY,
			},
		]);
	});

	it("reuses an existing boundary instead of adding a new time when possible", () => {
		// 70% (1008min) takes the night in lane 3 and leaves at 1008; the 20% (288min)
		// member then fills lane 3 instead of opening lane 4 with a new swap-out time.
		const list = members(100, 100, 100, 70, 20);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(schedule.lanes[3]).toEqual([
			{ pokemonId: 103, startMinute: 0, endMinute: 1008 },
			{ pokemonId: 104, startMinute: 1008, endMinute: 1008 + 288 },
			{ pokemonId: null, startMinute: 1008 + 288, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.lanes[4]).toEqual([
			{ pokemonId: null, startMinute: 0, endMinute: MINUTES_PER_DAY },
		]);
	});

	it("splits members across lanes with McNaughton when whole placement fails", () => {
		// Six members at 53% (763min): five take the night and 283 more minutes each,
		// the sixth (763min) does not fit into any single remaining lane and must be split.
		const list = members(53, 53, 53, 53, 53, 53, 30, 30);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(schedule.usesSleepSwaps).toBe(false);
		const sixthSegments = schedule.lanes.flatMap((lane) =>
			lane.filter((segment) => segment.pokemonId === 105),
		);
		expect(sixthSegments.length).toBeGreaterThan(1);
	});

	it("falls back to sleep swaps only when the settings cannot be met otherwise", () => {
		// 15 members at 30% (432min < 480min sleep): nobody can cover a full night,
		// so the night must be shared.
		const list = members(...Array.from({ length: 15 }, () => 30));
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(schedule.usesSleepSwaps).toBe(true);
	});

	it("needs sleep swaps when more than five members exceed the awake time", () => {
		const list = members(70, 70, 70, 70, 70, 70);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(schedule.usesSleepSwaps).toBe(true);
	});

	it("avoids sleep swaps in a mixed case that plain wrap-around would break", () => {
		// 3 x 100% and 5 x 40% (576min): laying everyone on one line would put a
		// boundary inside the night, but night-first packing keeps every swap awake.
		const list = members(100, 100, 100, 40, 40, 40, 40, 40);
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(schedule.usesSleepSwaps).toBe(false);
	});

	it("merges duplicated members and ignores zero usage", () => {
		const list: QuickSimMember[] = [
			{ pokemonId: 1, usagePercent: 40 },
			{ pokemonId: 1, usagePercent: 20 },
			{ pokemonId: 2, usagePercent: 0 },
		];
		const schedule = buildOrThrow(list);
		expectValid(schedule, list);
		expect(minutesById(schedule).get(1)).toBe(usagePercentToMinutes(60));
		expect(minutesById(schedule).has(2)).toBe(false);
	});

	it("keeps every member within a single lane at any time across many random cases", () => {
		let seed = 12345;
		const random = (): number => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		for (let trial = 0; trial < 200; trial++) {
			const count = 1 + Math.floor(random() * 12);
			const usages: number[] = [];
			let remaining = 500;
			for (let index = 0; index < count; index++) {
				const usage = Math.min(remaining, Math.floor(random() * 101));
				usages.push(usage);
				remaining -= usage;
			}
			const list = members(...usages);
			const result = buildQuickSimDaySchedule(list, DEFAULT_TIME_SLOTS);
			if (!result.ok) {
				expect(result.error).toBe("noMembers");
				expect(usages.every((usage) => usage === 0)).toBe(true);
				continue;
			}
			expectValid(result.schedule, list);
		}
	});

	it("respects a different sleep length", () => {
		const timeSlots: TimeSlot[] = [
			{ id: "sleep", time: "01:00", sleepState: "sleep", hasMeal: false },
			{ id: "wake", time: "09:00", sleepState: "wake", hasMeal: true },
			{ id: "lunch", time: "13:00", sleepState: "none", hasMeal: true },
		];
		const list = members(100, 40, 40);
		const schedule = buildOrThrow(list, timeSlots);
		expectValid(schedule, list);
		expect(schedule.sleepTime).toBe("01:00");
		expect(schedule.sleepMinutes).toBe(480);
		expect(schedule.usesSleepSwaps).toBe(false);
	});
});
