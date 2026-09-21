import { describe, expect, it } from "vitest";
import {
	MINUTES_PER_DAY,
	QUICK_SIM_USAGE_MODES,
	type QuickSimDaySchedule,
	type QuickSimExclusionMap,
	type QuickSimLaneSegment,
	type QuickSimMember,
	type QuickSimSchedule,
	type QuickSimUsageMode,
} from "../types/QuickSimTypes";
import { DEFAULT_TIME_SLOTS, type TimeSlot } from "../types/TimeSlotTypes";
import {
	buildQuickSimDaySchedule,
	buildQuickSimSchedule,
	clampQuickSimUsagePercent,
	getQuickSimTargetMinutesById,
	getQuickSimTotalTargetMinutesById,
	getQuickSimTotalUsagePercent,
	isQuickSimUsageExceeded,
	isQuickSimUsageModeEffective,
	resolveQuickSimDayStructure,
	usagePercentToMinutes,
	validateQuickSimMultiDaySchedule,
	validateQuickSimSchedule,
} from "./QuickSimScheduler";

const SLEEP_MINUTES = 480; // 23:00 -> 07:00 (DEFAULT_TIME_SLOTS)

function members(...usages: number[]): QuickSimMember[] {
	return usages.map((usagePercent, index) => ({
		pokemonId: 100 + index,
		usagePercent,
		usageMode: "even" as const,
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

	it("treats the usage mode as effective only between 1% and 99%", () => {
		expect(isQuickSimUsageModeEffective(0)).toBe(false);
		expect(isQuickSimUsageModeEffective(1)).toBe(true);
		expect(isQuickSimUsageModeEffective(50)).toBe(true);
		expect(isQuickSimUsageModeEffective(99)).toBe(true);
		expect(isQuickSimUsageModeEffective(100)).toBe(false);
		expect(isQuickSimUsageModeEffective(150)).toBe(false);
		expect(isQuickSimUsageModeEffective(Number.NaN)).toBe(false);
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
			{ pokemonId: 1, usagePercent: 40, usageMode: "even" },
			{ pokemonId: 1, usagePercent: 20, usageMode: "even" },
			{ pokemonId: 2, usagePercent: 0, usageMode: "even" },
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

/** メンバー定義: [起用率, 起用方法] */
function modeMembers(
	...entries: [number, QuickSimUsageMode][]
): QuickSimMember[] {
	return entries.map(([usagePercent, usageMode], index) => ({
		pokemonId: 200 + index,
		usagePercent,
		usageMode,
	}));
}

function buildMultiOrThrow(
	list: QuickSimMember[],
	days: number,
	timeSlots: TimeSlot[] = DEFAULT_TIME_SLOTS,
): QuickSimSchedule {
	const result = buildQuickSimSchedule(list, timeSlots, days);
	if (!result.ok) {
		throw new Error(`schedule failed: ${result.error}`);
	}
	return result.schedule;
}

function expectMultiValid(
	schedule: QuickSimSchedule,
	list: QuickSimMember[],
	days: number,
) {
	expect(schedule.unmetPokemonIds).toEqual([]);
	const errors = validateQuickSimMultiDaySchedule(
		schedule,
		getQuickSimTotalTargetMinutesById(list, days),
	);
	expect(errors).toEqual([]);
}

function segmentsOf(
	schedule: QuickSimSchedule,
	dayIndex: number,
	pokemonId: number,
): { laneIndex: number; startMinute: number; endMinute: number }[] {
	return schedule.dayLanes[dayIndex].flatMap((lane, laneIndex) =>
		lane
			.filter((segment) => segment.pokemonId === pokemonId)
			.map((segment) => ({
				laneIndex,
				startMinute: segment.startMinute,
				endMinute: segment.endMinute,
			})),
	);
}

function fullLane(pokemonId: number | null): QuickSimLaneSegment[] {
	return [{ pokemonId, startMinute: 0, endMinute: MINUTES_PER_DAY }];
}

/**
 * 続投中（区間の終わりと同じ時刻に次の区間が始まる）メンバーの枠が変わった回数。
 * 日をまたぐ続投も含めて数える。
 */
function countLaneChanges(schedule: QuickSimSchedule): number {
	const startsByDay = schedule.dayLanes.map((lanes) => {
		const starts = new Map<string, number>();
		lanes.forEach((lane, laneIndex) => {
			for (const segment of lane) {
				if (segment.pokemonId !== null) {
					starts.set(`${segment.pokemonId}@${segment.startMinute}`, laneIndex);
				}
			}
		});
		return starts;
	});
	let changes = 0;
	schedule.dayLanes.forEach((lanes, dayIndex) => {
		lanes.forEach((lane, laneIndex) => {
			for (const segment of lane) {
				if (segment.pokemonId === null) {
					continue;
				}
				const next =
					segment.endMinute < MINUTES_PER_DAY
						? startsByDay[dayIndex].get(
								`${segment.pokemonId}@${segment.endMinute}`,
							)
						: startsByDay[dayIndex + 1]?.get(`${segment.pokemonId}@0`);
				if (next !== undefined && next !== laneIndex) {
					changes++;
				}
			}
		});
	});
	return changes;
}

describe("buildQuickSimSchedule with usage modes", () => {
	it("repeats the single-day schedule when every member is even", () => {
		const list = members(100, 70, 30);
		const days = 3;
		const schedule = buildMultiOrThrow(list, days);
		expectMultiValid(schedule, list, days);
		expect(schedule.dayLanes).toHaveLength(days);
		const single = buildOrThrow(list);
		for (const lanes of schedule.dayLanes) {
			expect(lanes).toEqual(single.lanes);
		}
	});

	it("puts a sleep member at bedtime and lets even members use the rest", () => {
		// Sleep 40% (576min) covers the night in lane 0; the even members take other lanes.
		const list = modeMembers([40, "sleep"], [100, "even"], [60, "even"]);
		const schedule = buildMultiOrThrow(list, 1);
		expectMultiValid(schedule, list, 1);
		expect(schedule.dayLanes[0][0]).toEqual([
			{ pokemonId: 200, startMinute: 0, endMinute: 576 },
			{ pokemonId: null, startMinute: 576, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.dayLanes[0][1]).toEqual(fullLane(201));
		expect(schedule.dayLanes[0][2]).toEqual([
			{ pokemonId: 202, startMinute: 0, endMinute: 864 },
			{ pokemonId: null, startMinute: 864, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.usesSleepSwaps).toBe(false);
	});

	it("reports a sleep swap when a sleep member is shorter than the night", () => {
		const list = modeMembers([30, "sleep"], [100, "even"]);
		const schedule = buildMultiOrThrow(list, 1);
		expectMultiValid(schedule, list, 1);
		expect(segmentsOf(schedule, 0, 200)).toEqual([
			{ laneIndex: 0, startMinute: 0, endMinute: 432 },
		]);
		expect(schedule.usesSleepSwaps).toBe(true);
	});

	it("starts a daytime member at the wake slot", () => {
		const list = modeMembers([50, "daytime"], [100, "even"]);
		const schedule = buildMultiOrThrow(list, 1);
		expectMultiValid(schedule, list, 1);
		// Lanes are threaded in order of appearance: the all-day member takes lane 0.
		expect(schedule.dayLanes[0][0]).toEqual(fullLane(201));
		expect(schedule.dayLanes[0][1]).toEqual([
			{ pokemonId: null, startMinute: 0, endMinute: SLEEP_MINUTES },
			{ pokemonId: 200, startMinute: SLEEP_MINUTES, endMinute: 1200 },
			{ pokemonId: null, startMinute: 1200, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.usesSleepSwaps).toBe(false);
	});

	it("wraps a daytime member into the night only when the awake time is too short", () => {
		// 80% (1152min) > 960min awake: stays from waking to bedtime and 192min into the night.
		const list = modeMembers([80, "daytime"]);
		const schedule = buildMultiOrThrow(list, 1);
		expectMultiValid(schedule, list, 1);
		expect(schedule.dayLanes[0][0]).toEqual([
			{ pokemonId: 200, startMinute: 0, endMinute: 192 },
			{ pokemonId: null, startMinute: 192, endMinute: SLEEP_MINUTES },
			{
				pokemonId: 200,
				startMinute: SLEEP_MINUTES,
				endMinute: MINUTES_PER_DAY,
			},
		]);
		expect(schedule.usesSleepSwaps).toBe(true);
	});

	it("places sleep before daytime and shifts the overflowing daytime member", () => {
		// The sleep member takes lane 0 until 576; four daytime members take lanes 1-4
		// from waking, and the fifth daytime member starts when lane 0 frees up.
		const list = modeMembers(
			[60, "daytime"],
			[60, "daytime"],
			[60, "daytime"],
			[60, "daytime"],
			[60, "daytime"],
			[40, "sleep"],
		);
		const schedule = buildMultiOrThrow(list, 1);
		expectMultiValid(schedule, list, 1);
		expect(segmentsOf(schedule, 0, 205)).toEqual([
			{ laneIndex: 0, startMinute: 0, endMinute: 576 },
		]);
		const starts = [200, 201, 202, 203, 204].map(
			(pokemonId) => segmentsOf(schedule, 0, pokemonId)[0].startMinute,
		);
		expect(starts.filter((start) => start === SLEEP_MINUTES)).toHaveLength(4);
		expect(starts).toContain(576);
		expect(segmentsOf(schedule, 0, 204)).toEqual([
			{ laneIndex: 0, startMinute: 576, endMinute: MINUTES_PER_DAY },
		]);
	});

	it("places first-half members before sleep members", () => {
		// Five first-half members at 50% over 2 days (1440min each) fill day 0 entirely,
		// so the sleep member only gets its night on day 1.
		const list = modeMembers(
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[30, "sleep"],
		);
		const schedule = buildMultiOrThrow(list, 2);
		expect(segmentsOf(schedule, 0, 205)).toEqual([]);
		expect(segmentsOf(schedule, 1, 205)).toEqual([
			{ laneIndex: 0, startMinute: 0, endMinute: 432 },
		]);
		expect(schedule.unmetPokemonIds).toEqual([205]);
	});

	it("runs a first-half member continuously from the start of the period", () => {
		// 50% over 3 days = 2160min: day 0 in full, day 1 until 720, then nothing.
		const list = modeMembers([50, "firstHalf"], [100, "even"]);
		const days = 3;
		const schedule = buildMultiOrThrow(list, days);
		expectMultiValid(schedule, list, days);
		expect(schedule.dayLanes[0][0]).toEqual(fullLane(200));
		expect(schedule.dayLanes[1][0]).toEqual([
			{ pokemonId: 200, startMinute: 0, endMinute: 720 },
			{ pokemonId: null, startMinute: 720, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.dayLanes[2][0]).toEqual(fullLane(null));
		// The even member keeps lane 1 on every day, so no swap is needed at bedtime.
		for (let dayIndex = 0; dayIndex < days; dayIndex++) {
			expect(schedule.dayLanes[dayIndex][1]).toEqual(fullLane(201));
		}
		expect(schedule.usesSleepSwaps).toBe(false);
	});

	it("runs a second-half member continuously up to the end of the period", () => {
		// 50% over 3 days = 2160min: nothing on day 0, from 720 on day 1, day 2 in full.
		// The even member keeps lane 0 throughout; the newcomer takes the next free lane.
		const list = modeMembers([50, "secondHalf"], [100, "even"]);
		const days = 3;
		const schedule = buildMultiOrThrow(list, days);
		expectMultiValid(schedule, list, days);
		expect(segmentsOf(schedule, 0, 200)).toEqual([]);
		expect(segmentsOf(schedule, 1, 200)).toEqual([
			{ laneIndex: 1, startMinute: 720, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.dayLanes[2][1]).toEqual(fullLane(200));
		for (let dayIndex = 0; dayIndex < days; dayIndex++) {
			expect(schedule.dayLanes[dayIndex][0]).toEqual(fullLane(201));
		}
	});

	it("keeps continuing members in their lanes when a first-half member hands over to a second-half member", () => {
		// Four 100% members plus 30% first half and 70% second half over 4 days:
		// the two partial members share one lane (first half 1728min, then second half
		// 4032min from 23:00 + 288min on day 1), and nobody else ever changes lanes.
		const list = modeMembers(
			[100, "even"],
			[100, "even"],
			[100, "even"],
			[70, "secondHalf"],
			[30, "firstHalf"],
			[100, "even"],
		);
		const days = 4;
		const schedule = buildMultiOrThrow(list, days);
		expectMultiValid(schedule, list, days);
		expect(schedule.usesSleepSwaps).toBe(true);

		const laneOfFullMember = new Map<number, number>();
		for (let dayIndex = 0; dayIndex < days; dayIndex++) {
			for (const pokemonId of [200, 201, 202, 205]) {
				const segments = segmentsOf(schedule, dayIndex, pokemonId);
				expect(segments).toHaveLength(1);
				expect(segments[0].startMinute).toBe(0);
				expect(segments[0].endMinute).toBe(MINUTES_PER_DAY);
				const lane = laneOfFullMember.get(pokemonId) ?? segments[0].laneIndex;
				expect(segments[0].laneIndex).toBe(lane);
				laneOfFullMember.set(pokemonId, lane);
			}
		}
		const sharedLane = segmentsOf(schedule, 0, 204)[0].laneIndex;
		expect(schedule.dayLanes[0][sharedLane]).toEqual(fullLane(204));
		expect(schedule.dayLanes[1][sharedLane]).toEqual([
			{ pokemonId: 204, startMinute: 0, endMinute: 288 },
			{ pokemonId: 203, startMinute: 288, endMinute: MINUTES_PER_DAY },
		]);
		expect(schedule.dayLanes[2][sharedLane]).toEqual(fullLane(203));
		expect(schedule.dayLanes[3][sharedLane]).toEqual(fullLane(203));
		expect(countLaneChanges(schedule)).toBe(0);
	});

	it("moves even usage to the days left free by first-half members", () => {
		// Five first-half members at 50% fill every lane for the first 3.5 days;
		// the even member (30% = 432min/day, 3024min total) gets its time afterwards.
		const list = modeMembers(
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[30, "even"],
		);
		const days = 7;
		const schedule = buildMultiOrThrow(list, days);
		expectMultiValid(schedule, list, days);
		for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
			expect(segmentsOf(schedule, dayIndex, 205)).toEqual([]);
		}
		const day3 = segmentsOf(schedule, 3, 205);
		expect(day3.length).toBeGreaterThan(0);
		expect(day3.every((segment) => segment.startMinute >= 720)).toBe(true);
	});

	it("keeps large even members whole and squeezes the small one on crowded days", () => {
		// Day 2 is full with the second-half member and four 100% members; the 50%
		// member gets nothing that day and catches up on the other days instead.
		const list = modeMembers(
			[100, "even"],
			[100, "even"],
			[100, "even"],
			[100, "even"],
			[50, "secondHalf"],
			[50, "even"],
		);
		const days = 3;
		const schedule = buildMultiOrThrow(list, days);
		expectMultiValid(schedule, list, days);
		for (let dayIndex = 0; dayIndex < days; dayIndex++) {
			for (const pokemonId of [200, 201, 202, 203]) {
				expect(segmentsOf(schedule, dayIndex, pokemonId)).toEqual([
					expect.objectContaining({
						startMinute: 0,
						endMinute: MINUTES_PER_DAY,
					}),
				]);
			}
		}
		expect(segmentsOf(schedule, 2, 205)).toEqual([]);
	});

	it("reports members whose usage cannot be met because of the fixed modes", () => {
		// Five first-half members (50% over 2 days = 1440min each) fill day 0 entirely;
		// the even member (60% = 1728min) can only get one lane on day 1 (1440min).
		const list = modeMembers(
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[60, "even"],
		);
		const schedule = buildMultiOrThrow(list, 2);
		expect(schedule.unmetPokemonIds).toEqual([205]);
		const errors = validateQuickSimMultiDaySchedule(
			schedule,
			getQuickSimTotalTargetMinutesById(list, 2),
		);
		expect(errors).toEqual(["pokemon 205: 1440 minutes, expected 1728"]);
	});

	it("repeats the single-day schedule when remainder members join daily modes", () => {
		const list = modeMembers([40, "sleep"], [60, "even"], [50, "remainder"]);
		const days = 3;
		const schedule = buildMultiOrThrow(list, days);
		expectMultiValid(schedule, list, days);
		for (const lanes of schedule.dayLanes) {
			expect(lanes).toEqual(schedule.dayLanes[0]);
		}
	});

	it("lets an even member take the night before a remainder member, whatever the order", () => {
		// Only lane 4 is free. Two even members would give the night to the longer
		// one (60%); as a remainder member it waits until the even member (40%)
		// has taken bedtime and then fills the rest of the day.
		const list = modeMembers(
			[60, "remainder"],
			[40, "even"],
			[100, "even"],
			[100, "even"],
			[100, "even"],
			[100, "even"],
		);
		const schedule = buildMultiOrThrow(list, 1);
		expectMultiValid(schedule, list, 1);
		expect(segmentsOf(schedule, 0, 201)).toEqual([
			expect.objectContaining({ startMinute: 0, endMinute: 576 }),
		]);
		expect(segmentsOf(schedule, 0, 200)).toEqual([
			expect.objectContaining({ startMinute: 576, endMinute: MINUTES_PER_DAY }),
		]);
	});

	it("shorts the remainder member, not the even member, when the space runs out", () => {
		// Four first-half members fill lanes 0-3 for the first 1.2 days. Lane 4 on
		// day 0 goes to the even member (80% = 1152min/day); the remainder member
		// only gets the leftovers even though it is listed first.
		const list = modeMembers(
			[80, "remainder"],
			[80, "even"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
			[50, "firstHalf"],
		);
		const days = 2;
		const schedule = buildMultiOrThrow(list, days);
		expect(schedule.unmetPokemonIds).toEqual([200]);
		const errors = validateQuickSimMultiDaySchedule(
			schedule,
			getQuickSimTotalTargetMinutesById(list, days),
		);
		expect(errors).toEqual(["pokemon 200: 1728 minutes, expected 2304"]);
		expect(segmentsOf(schedule, 0, 201)).toEqual([
			expect.objectContaining({ startMinute: 0, endMinute: 1152 }),
		]);
	});

	it("keeps every member within a single lane at any time across random mode mixes", {
		timeout: 20_000,
	}, () => {
		let seed = 2468;
		const random = (): number => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		for (let trial = 0; trial < 150; trial++) {
			const count = 1 + Math.floor(random() * 10);
			const entries: [number, QuickSimUsageMode][] = [];
			let remaining = 500;
			for (let index = 0; index < count; index++) {
				const usage = Math.min(remaining, Math.floor(random() * 101));
				const mode =
					QUICK_SIM_USAGE_MODES[
						Math.floor(random() * QUICK_SIM_USAGE_MODES.length)
					];
				entries.push([usage, mode]);
				remaining -= usage;
			}
			const days = 1 + Math.floor(random() * 7);
			const list = modeMembers(...entries);
			const result = buildQuickSimSchedule(list, DEFAULT_TIME_SLOTS, days);
			if (!result.ok) {
				expect(result.error).toBe("noMembers");
				expect(entries.every(([usage]) => usage === 0)).toBe(true);
				continue;
			}
			const targets = getQuickSimTotalTargetMinutesById(list, days);
			const unmet = new Set(result.schedule.unmetPokemonIds);
			const errors = validateQuickSimMultiDaySchedule(
				result.schedule,
				targets,
			).filter(
				(error) =>
					![...unmet].some((pokemonId) =>
						error.startsWith(`pokemon ${pokemonId}: `),
					),
			);
			expect(errors).toEqual([]);
			expect(result.schedule.dayLanes).toHaveLength(days);
			expect(countLaneChanges(result.schedule)).toBe(0);
		}
	});
});

/** 同時に編成できない組（とくべつなポケモンのルール相当）を pokemonId の組から作る */
function exclusionsOf(...pairs: [number, number][]): QuickSimExclusionMap {
	const map = new Map<number, Set<number>>();
	for (const [left, right] of pairs) {
		for (const [from, to] of [
			[left, right],
			[right, left],
		]) {
			const set = map.get(from) ?? new Set<number>();
			set.add(to);
			map.set(from, set);
		}
	}
	return map;
}

/** 各日について、同時に編成できない組が同じ時刻に入っている箇所（分単位で確認） */
function findExcludedOverlaps(
	schedule: QuickSimSchedule,
	exclusions: QuickSimExclusionMap,
): string[] {
	const overlaps: string[] = [];
	schedule.dayLanes.forEach((lanes, dayIndex) => {
		const occupants = lanes.map((lane) => {
			const minutes = new Int32Array(MINUTES_PER_DAY).fill(-1);
			for (const segment of lane) {
				if (segment.pokemonId !== null) {
					minutes.fill(
						segment.pokemonId,
						segment.startMinute,
						segment.endMinute,
					);
				}
			}
			return minutes;
		});
		for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
			const present = occupants
				.map((minutes) => minutes[minute])
				.filter((pokemonId) => pokemonId >= 0);
			for (const pokemonId of present) {
				const excluded = exclusions.get(pokemonId);
				if (excluded?.size && present.some((other) => excluded.has(other))) {
					overlaps.push(`day ${dayIndex} minute ${minute}: ${pokemonId}`);
				}
			}
		}
	});
	return overlaps;
}

function expectNoExcludedOverlap(
	schedule: QuickSimSchedule,
	exclusions: QuickSimExclusionMap,
): void {
	expect(findExcludedOverlaps(schedule, exclusions)).toEqual([]);
}

describe("buildQuickSimSchedule with exclusions", () => {
	it("keeps two excluded even members apart in time", () => {
		// 100 と 101 は同時に編成できない（例: ミュウツーとダークライ）
		const list = members(60, 40, 100, 100, 100, 100);
		const exclusions = exclusionsOf([100, 101]);
		const result = buildQuickSimSchedule(
			list,
			DEFAULT_TIME_SLOTS,
			1,
			exclusions,
		);
		if (!result.ok) {
			throw new Error(result.error);
		}
		expectMultiValid(result.schedule, list, 1);
		expect(
			validateQuickSimMultiDaySchedule(
				result.schedule,
				getQuickSimTotalTargetMinutesById(list, 1),
				exclusions,
			),
		).toEqual([]);
		expectNoExcludedOverlap(result.schedule, exclusions);
		expect(result.schedule.usesSleepSwaps).toBe(false);
	});

	it("shifts a sleep member behind an excluded sleep member instead of overlapping", () => {
		const list = modeMembers(
			[40, "sleep"],
			[40, "sleep"],
			[100, "even"],
			[100, "even"],
			[100, "even"],
			[100, "even"],
			[20, "even"],
		);
		const exclusions = exclusionsOf([200, 201]);
		const result = buildQuickSimSchedule(
			list,
			DEFAULT_TIME_SLOTS,
			1,
			exclusions,
		);
		if (!result.ok) {
			throw new Error(result.error);
		}
		expectMultiValid(result.schedule, list, 1);
		expectNoExcludedOverlap(result.schedule, exclusions);
		// 200 は就寝時刻から、201 はその直後から連続して起用する
		expect(segmentsOf(result.schedule, 0, 200)).toEqual([
			{ laneIndex: 0, startMinute: 0, endMinute: 576 },
		]);
		expect(segmentsOf(result.schedule, 0, 201)).toEqual([
			{ laneIndex: 0, startMinute: 576, endMinute: 1152 },
		]);
	});

	it("does not choose two excluded members as night members", () => {
		// 3 匹の 100% が夜担当を 3 枠使い、残り 2 枠の夜担当候補は 50% の 4 匹。
		// 先頭の 2 匹（同時に編成できない）を両方とも夜担当にしてはいけない。
		const list = members(50, 50, 100, 100, 100, 50, 50);
		const exclusions = exclusionsOf([100, 101]);
		const result = buildQuickSimSchedule(
			list,
			DEFAULT_TIME_SLOTS,
			1,
			exclusions,
		);
		if (!result.ok) {
			throw new Error(result.error);
		}
		expectMultiValid(result.schedule, list, 1);
		expectNoExcludedOverlap(result.schedule, exclusions);
		expect(result.schedule.usesSleepSwaps).toBe(false);
	});

	it("reports the member whose usage cannot be met when the excluded pair exceeds one lane", () => {
		const list = members(100, 20, 100, 100, 100, 80);
		const exclusions = exclusionsOf([100, 101]);
		const result = buildQuickSimSchedule(
			list,
			DEFAULT_TIME_SLOTS,
			2,
			exclusions,
		);
		if (!result.ok) {
			throw new Error(result.error);
		}
		expect(result.schedule.unmetPokemonIds).toEqual([101]);
		expectNoExcludedOverlap(result.schedule, exclusions);
		const errors = validateQuickSimMultiDaySchedule(
			result.schedule,
			getQuickSimTotalTargetMinutesById(list, 2),
			exclusions,
		).filter((error) => !error.startsWith("pokemon 101: "));
		expect(errors).toEqual([]);
	});

	it("lets a pair that is not excluded (Latias + Latios) overlap while a third special stays apart", () => {
		// 100(ラティアス) と 101(ラティオス) は同時可。102(ミュウツー) はどちらとも不可。
		const list = members(60, 60, 40, 100, 100, 100, 40);
		const exclusions = exclusionsOf([100, 102], [101, 102]);
		const result = buildQuickSimSchedule(
			list,
			DEFAULT_TIME_SLOTS,
			1,
			exclusions,
		);
		if (!result.ok) {
			throw new Error(result.error);
		}
		expectMultiValid(result.schedule, list, 1);
		expectNoExcludedOverlap(result.schedule, exclusions);
	});

	it("validates excluded overlaps in a hand-made schedule", () => {
		const schedule: QuickSimSchedule = {
			dayLanes: [
				[
					fullLane(100),
					[
						{ pokemonId: null, startMinute: 0, endMinute: 600 },
						{ pokemonId: 101, startMinute: 600, endMinute: MINUTES_PER_DAY },
					],
					fullLane(null),
					fullLane(null),
					fullLane(null),
				],
			],
			sleepSlotId: "slot-5",
			sleepTime: "23:00",
			sleepMinutes: SLEEP_MINUTES,
			usesSleepSwaps: false,
			unmetPokemonIds: [],
		};
		const errors = validateQuickSimMultiDaySchedule(
			schedule,
			new Map([
				[100, MINUTES_PER_DAY],
				[101, MINUTES_PER_DAY - 600],
			]),
			exclusionsOf([100, 101]),
		);
		expect(errors).toEqual(["day 0: pokemon 100 and 101: both present at 600"]);
	});

	it("never overlaps excluded members across random usage and mode mixes", {
		timeout: 30_000,
	}, () => {
		let seed = 97531;
		const random = (): number => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		for (let trial = 0; trial < 120; trial++) {
			const count = 2 + Math.floor(random() * 9);
			const entries: [number, QuickSimUsageMode][] = [];
			let remaining = 500;
			for (let index = 0; index < count; index++) {
				const usage = Math.min(remaining, Math.floor(random() * 101));
				const mode =
					QUICK_SIM_USAGE_MODES[
						Math.floor(random() * QUICK_SIM_USAGE_MODES.length)
					];
				entries.push([usage, mode]);
				remaining -= usage;
			}
			const list = modeMembers(...entries);
			// 先頭 2〜3 匹を同時に編成できない組にする
			const specialCount = 2 + Math.floor(random() * 2);
			const pairs: [number, number][] = [];
			for (let left = 0; left < specialCount; left++) {
				for (let right = left + 1; right < specialCount; right++) {
					pairs.push([200 + left, 200 + right]);
				}
			}
			const exclusions = exclusionsOf(...pairs);
			const days = 1 + Math.floor(random() * 7);
			const result = buildQuickSimSchedule(
				list,
				DEFAULT_TIME_SLOTS,
				days,
				exclusions,
			);
			if (!result.ok) {
				expect(result.error).toBe("noMembers");
				continue;
			}
			expectNoExcludedOverlap(result.schedule, exclusions);
			const unmet = new Set(result.schedule.unmetPokemonIds);
			const errors = validateQuickSimMultiDaySchedule(
				result.schedule,
				getQuickSimTotalTargetMinutesById(list, days),
				exclusions,
			).filter(
				(error) =>
					![...unmet].some((pokemonId) =>
						error.startsWith(`pokemon ${pokemonId}: `),
					),
			);
			expect(errors).toEqual([]);
			expect(countLaneChanges(result.schedule)).toBe(0);
		}
	});
});

/** 各日・各枠の空き区間（pokemonId が null の区間） */
function emptySegments(schedule: QuickSimSchedule): {
	dayIndex: number;
	laneIndex: number;
	startMinute: number;
	endMinute: number;
}[] {
	return schedule.dayLanes.flatMap((lanes, dayIndex) =>
		lanes.flatMap((lane, laneIndex) =>
			lane
				.filter((segment) => segment.pokemonId === null)
				.map((segment) => ({
					dayIndex,
					laneIndex,
					startMinute: segment.startMinute,
					endMinute: segment.endMinute,
				})),
		),
	);
}

/** 期間中に誰かが入る枠に残った空き区間（期間中ずっと空きの枠は除く） */
function emptySegmentsInUsedLanes(
	schedule: QuickSimSchedule,
): ReturnType<typeof emptySegments> {
	const usedLanes = new Set<number>();
	for (const lanes of schedule.dayLanes) {
		lanes.forEach((lane, laneIndex) => {
			if (lane.some((segment) => segment.pokemonId !== null)) {
				usedLanes.add(laneIndex);
			}
		});
	}
	return emptySegments(schedule).filter((gap) => usedLanes.has(gap.laneIndex));
}

/** 期間全体で各メンバーが編成に入っている分数 */
function totalMinutesById(schedule: QuickSimSchedule): Map<number, number> {
	const totals = new Map<number, number>();
	for (const lanes of schedule.dayLanes) {
		for (const lane of lanes) {
			for (const segment of lane) {
				if (segment.pokemonId === null) {
					continue;
				}
				totals.set(
					segment.pokemonId,
					(totals.get(segment.pokemonId) ?? 0) +
						segment.endMinute -
						segment.startMinute,
				);
			}
		}
	}
	return totals;
}

describe("buildQuickSimSchedule with fillEmptyLanes", () => {
	const buildFilled = (
		list: QuickSimMember[],
		days: number,
		exclusions?: QuickSimExclusionMap,
	): QuickSimSchedule => {
		const result = buildQuickSimSchedule(
			list,
			DEFAULT_TIME_SLOTS,
			days,
			exclusions,
			true,
		);
		if (!result.ok) {
			throw new Error(`schedule failed: ${result.error}`);
		}
		return result.schedule;
	};

	it("keeps the previous member in the lane until the next one arrives", () => {
		// 4 匹が 100%、5 匹目は 10% と 73%（残り）で 17% 分の空きが出る
		const list = modeMembers(
			[100, "even"],
			[100, "even"],
			[100, "even"],
			[100, "even"],
			[10, "even"],
			[73, "remainder"],
		);
		const schedule = buildFilled(list, 2);

		expect(emptySegments(schedule)).toEqual([]);
		expect(schedule.unmetPokemonIds).toEqual([]);
		// 空きは「残り」のメンバーが居続けて埋まり、10% のメンバーはそのまま
		const totals = totalMinutesById(schedule);
		expect(totals.get(204)).toBe(2 * usagePercentToMinutes(10));
		expect(totals.get(205)).toBe(
			2 * (MINUTES_PER_DAY - usagePercentToMinutes(10)),
		);
		expect(countLaneChanges(schedule)).toBe(0);
	});

	it("does not change a schedule that already has no gaps", () => {
		const list = members(100, 100, 100, 100, 60, 40);
		const plain = buildMultiOrThrow(list, 3);
		const filled = buildFilled(list, 3);
		expect(filled.dayLanes).toEqual(plain.dayLanes);
	});

	it("lets the next member start from the beginning when the lane starts empty", () => {
		// 後半のメンバーだけなので、埋めなければ期間の前半が空きになる
		const list = modeMembers([40, "secondHalf"]);
		const plain = buildMultiOrThrow(list, 2);
		expect(emptySegments(plain).length).toBeGreaterThan(0);

		const schedule = buildFilled(list, 2);
		expect(emptySegmentsInUsedLanes(schedule)).toEqual([]);
		expect(schedule.dayLanes[0][0]).toEqual(fullLane(200));
		expect(schedule.dayLanes[1][0]).toEqual(fullLane(200));
	});

	it("leaves a lane empty when no member can fill it", () => {
		// 100% のメンバーは別の枠にいるので、5 つ目の枠は誰も埋められない
		const list = members(100, 100, 100, 100);
		const schedule = buildFilled(list, 1);
		expect(emptySegments(schedule)).toEqual([
			{ dayIndex: 0, laneIndex: 4, startMinute: 0, endMinute: MINUTES_PER_DAY },
		]);
	});

	it("never puts a member into two lanes or next to an excluded member", () => {
		// 200 と 201 は同時に編成できない。201 は 200 が抜けた後にしか入れない
		const list = modeMembers([70, "even"], [30, "even"]);
		const exclusions = exclusionsOf([200, 201]);
		const schedule = buildFilled(list, 2, exclusions);

		expectNoExcludedOverlap(schedule, exclusions);
		expect(
			validateQuickSimMultiDaySchedule(
				schedule,
				totalMinutesById(schedule),
				exclusions,
			),
		).toEqual([]);
		// 空きは 200 か 201 のどちらかが居続けて埋まる
		expect(emptySegmentsInUsedLanes(schedule)).toEqual([]);
	});

	it("reports unmet members from the schedule before filling", () => {
		// 201 は 200 と同時に編成できず、200 が一日中いるので一度も入れない
		const list = modeMembers([100, "even"], [50, "even"]);
		const exclusions = exclusionsOf([200, 201]);
		const schedule = buildFilled(list, 1, exclusions);
		expect(schedule.unmetPokemonIds).toEqual([201]);
	});

	it("fills every gap that a neighbour can take across many random cases", () => {
		let seed = 424242;
		const random = (): number => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		for (let trial = 0; trial < 40; trial++) {
			const count = 1 + Math.floor(random() * 8);
			const entries: [number, QuickSimUsageMode][] = [];
			let remaining = 500;
			for (let index = 0; index < count; index++) {
				const usage = Math.min(remaining, Math.floor(random() * 101));
				const mode =
					QUICK_SIM_USAGE_MODES[
						Math.floor(random() * QUICK_SIM_USAGE_MODES.length)
					];
				entries.push([usage, mode]);
				remaining -= usage;
			}
			const list = modeMembers(...entries);
			const days = 1 + Math.floor(random() * 7);
			const result = buildQuickSimSchedule(
				list,
				DEFAULT_TIME_SLOTS,
				days,
				undefined,
				true,
			);
			if (!result.ok) {
				expect(result.error).toBe("noMembers");
				continue;
			}
			const schedule = result.schedule;
			// 枠の整合性（隙間なし・同じメンバーが同時に 2 枠にいない）は保つ
			expect(
				validateQuickSimMultiDaySchedule(schedule, totalMinutesById(schedule)),
			).toEqual([]);
			expect(countLaneChanges(schedule)).toBe(0);
			// 埋めた後の起用時間は設定を下回らない
			const totals = totalMinutesById(schedule);
			for (const member of list) {
				if (schedule.unmetPokemonIds.includes(member.pokemonId)) {
					continue;
				}
				expect(totals.get(member.pokemonId) ?? 0).toBeGreaterThanOrEqual(
					usagePercentToMinutes(member.usagePercent) * days,
				);
			}
			// 残った空きは、前後に誰もいないか、前後のメンバーがその時刻に別の枠にいる場合だけ
			for (const gap of emptySegments(schedule)) {
				const previous = occupantBefore(schedule, gap);
				const next = occupantAfter(schedule, gap);
				if (previous !== null) {
					expect(
						isPresentElsewhere(
							schedule,
							gap.dayIndex,
							gap.startMinute,
							previous,
						),
					).toBe(true);
				}
				if (next !== null) {
					expect(
						isPresentElsewhere(schedule, gap.dayIndex, gap.endMinute - 1, next),
					).toBe(true);
				}
			}
		}
	});
});

interface GapPosition {
	dayIndex: number;
	laneIndex: number;
	startMinute: number;
	endMinute: number;
}

/** 空き区間の直前にいたメンバー（前日の末尾も見る）。誰もいなければ null */
function occupantBefore(
	schedule: QuickSimSchedule,
	gap: GapPosition,
): number | null {
	const lane = schedule.dayLanes[gap.dayIndex][gap.laneIndex];
	const index = lane.findIndex(
		(segment) => segment.startMinute === gap.startMinute,
	);
	if (index > 0) {
		return lane[index - 1].pokemonId;
	}
	const previousLane = schedule.dayLanes[gap.dayIndex - 1]?.[gap.laneIndex];
	return previousLane?.[previousLane.length - 1]?.pokemonId ?? null;
}

/** 空き区間の直後に入るメンバー（翌日の先頭も見る）。誰もいなければ null */
function occupantAfter(
	schedule: QuickSimSchedule,
	gap: GapPosition,
): number | null {
	const lane = schedule.dayLanes[gap.dayIndex][gap.laneIndex];
	const index = lane.findIndex(
		(segment) => segment.startMinute === gap.startMinute,
	);
	if (index < lane.length - 1) {
		return lane[index + 1].pokemonId;
	}
	return (
		schedule.dayLanes[gap.dayIndex + 1]?.[gap.laneIndex]?.[0]?.pokemonId ?? null
	);
}

/** その時刻に、そのメンバーがどこかの枠に入っているか */
function isPresentElsewhere(
	schedule: QuickSimSchedule,
	dayIndex: number,
	minute: number,
	pokemonId: number,
): boolean {
	return schedule.dayLanes[dayIndex].some((lane) =>
		lane.some(
			(segment) =>
				segment.pokemonId === pokemonId &&
				segment.startMinute <= minute &&
				minute < segment.endMinute,
		),
	);
}
