import { describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	MINUTES_PER_DAY,
	QUICK_SIM_SWAP_INITIAL_ENERGY,
	type QuickSimDaySchedule,
	type QuickSimLaneSegment,
} from "../types/QuickSimTypes";
import {
	DEFAULT_TIME_SLOTS,
	SWAP_NONE_POKEMON_ID,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { collectTimelineDurationSummaryByPokemon } from "./AdditionalAnalysisUtils";
import { buildQuickSimDaySchedule } from "./QuickSimScheduler";
import {
	buildQuickSimTimeline,
	QUICK_SIM_SLOT_ID_PREFIX,
} from "./QuickSimTimelineBuilder";
import { buildExpandedTimeline } from "./TimelineDayExpansion";
import { calculateDuration } from "./TimeSlotUtils";

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName }), "", id);
}

const SLEEP_MINUTES = 480;

function fullLane(pokemonId: number | null): QuickSimLaneSegment[] {
	return [{ pokemonId, startMinute: 0, endMinute: MINUTES_PER_DAY }];
}

function createSchedule(
	lanes: QuickSimLaneSegment[][],
	overrides: Partial<QuickSimDaySchedule> = {},
): QuickSimDaySchedule {
	return {
		lanes,
		sleepSlotId: "slot-5",
		sleepTime: "23:00",
		sleepMinutes: SLEEP_MINUTES,
		usesSleepSwaps: false,
		...overrides,
	};
}

describe("buildQuickSimTimeline", () => {
	const pikachu = createItem("Pikachu", 1);
	const eevee = createItem("Eevee", 2);
	const bulbasaur = createItem("Bulbasaur", 3);
	const box = new PokemonBox([pikachu, eevee, bulbasaur]);

	it("uses the first segment of each lane as the initial team", () => {
		const schedule = createSchedule([
			fullLane(pikachu.id),
			fullLane(null),
			fullLane(eevee.id),
			fullLane(null),
			fullLane(null),
		]);

		const timeline = buildQuickSimTimeline(
			schedule,
			DEFAULT_TIME_SLOTS,
			1,
			box,
		);

		expect(timeline.team).toEqual([pikachu, null, eevee, null, null]);
		expect(timeline.swaps).toEqual([]);
		expect(timeline.noCollectCells).toEqual([]);
		expect(timeline.insertedSlotIds).toEqual([]);
		expect(timeline.timeSlots).toEqual(DEFAULT_TIME_SLOTS);
	});

	it("swaps at an existing slot when the boundary matches its time", () => {
		// 23:00 + 480min = 07:00 (wake slot), 23:00 + 780min = 12:00 (lunch slot).
		const schedule = createSchedule([
			[
				{ pokemonId: pikachu.id, startMinute: 0, endMinute: SLEEP_MINUTES },
				{ pokemonId: eevee.id, startMinute: SLEEP_MINUTES, endMinute: 780 },
				{ pokemonId: null, startMinute: 780, endMinute: MINUTES_PER_DAY },
			],
			fullLane(null),
			fullLane(null),
			fullLane(null),
			fullLane(null),
		]);

		const timeline = buildQuickSimTimeline(
			schedule,
			DEFAULT_TIME_SLOTS,
			1,
			box,
		);

		expect(timeline.swaps).toEqual([
			{
				dayIndex: 0,
				slotId: "slot-1",
				teamSlotIndex: 0,
				newPokemonId: eevee.id,
				initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
			},
			{
				dayIndex: 0,
				slotId: "slot-2",
				teamSlotIndex: 0,
				newPokemonId: SWAP_NONE_POKEMON_ID,
				initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
			},
		]);
		expect(timeline.insertedSlotIds).toEqual([]);
	});

	it("inserts a time slot for boundaries outside the configured slots", () => {
		// 23:00 + 600min = 09:00 is not a configured slot.
		const schedule = createSchedule([
			[
				{ pokemonId: pikachu.id, startMinute: 0, endMinute: 600 },
				{ pokemonId: eevee.id, startMinute: 600, endMinute: MINUTES_PER_DAY },
			],
			fullLane(bulbasaur.id),
			fullLane(null),
			fullLane(null),
			fullLane(null),
		]);

		const timeline = buildQuickSimTimeline(
			schedule,
			DEFAULT_TIME_SLOTS,
			2,
			box,
		);

		const insertedId = `${QUICK_SIM_SLOT_ID_PREFIX}0900`;
		expect(timeline.insertedSlotIds).toEqual([insertedId]);
		expect(timeline.timeSlots).toHaveLength(DEFAULT_TIME_SLOTS.length + 1);
		expect(timeline.timeSlots[DEFAULT_TIME_SLOTS.length]).toEqual({
			id: insertedId,
			time: "09:00",
			sleepState: "none",
			hasMeal: false,
		});

		// The boundary repeats every day, and the lane returns to Pikachu at bedtime.
		expect(timeline.swaps).toEqual([
			{
				dayIndex: 0,
				slotId: insertedId,
				teamSlotIndex: 0,
				newPokemonId: eevee.id,
				initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
			},
			{
				dayIndex: 0,
				slotId: "slot-5-end",
				teamSlotIndex: 0,
				newPokemonId: pikachu.id,
				initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
			},
			{
				dayIndex: 1,
				slotId: insertedId,
				teamSlotIndex: 0,
				newPokemonId: eevee.id,
				initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
			},
		]);

		// Every lane on every day skips collection at the inserted slot; the simulator
		// ignores the entries on cells that carry a swap, so the outgoing Pokemon is settled.
		expect(timeline.noCollectCells).toHaveLength(2 * 5);
		expect(timeline.noCollectCells).toContainEqual({
			dayIndex: 1,
			slotId: insertedId,
			teamSlotIndex: 4,
		});
	});

	it("turns members missing from the box into empty slots", () => {
		const schedule = createSchedule([
			[
				{ pokemonId: 999, startMinute: 0, endMinute: 600 },
				{ pokemonId: 998, startMinute: 600, endMinute: MINUTES_PER_DAY },
			],
			fullLane(null),
			fullLane(null),
			fullLane(null),
			fullLane(null),
		]);

		const timeline = buildQuickSimTimeline(
			schedule,
			DEFAULT_TIME_SLOTS,
			1,
			box,
		);

		expect(timeline.team[0]).toBeNull();
		expect(timeline.swaps[0].newPokemonId).toBe(SWAP_NONE_POKEMON_ID);
	});

	it("reproduces the requested usage per day in the expanded timeline", () => {
		const members = [
			{ pokemonId: pikachu.id, usagePercent: 100 },
			{ pokemonId: eevee.id, usagePercent: 70 },
			{ pokemonId: bulbasaur.id, usagePercent: 30 },
		];
		const result = buildQuickSimDaySchedule(members, DEFAULT_TIME_SLOTS);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const days = 3;
		const timeline = buildQuickSimTimeline(
			result.schedule,
			DEFAULT_TIME_SLOTS,
			days,
			box,
		);

		const summary = collectTimelineDurationSummaryByPokemon(
			timeline.team,
			timeline.timeSlots,
			days,
			timeline.swaps,
			box,
		);
		expect(summary.totalTimelineMinutes).toBe(days * MINUTES_PER_DAY);
		expect(summary.activeMinutesByPokemonId.get(pikachu.id)).toBe(
			days * MINUTES_PER_DAY,
		);
		expect(summary.activeMinutesByPokemonId.get(eevee.id)).toBe(days * 1008);
		expect(summary.activeMinutesByPokemonId.get(bulbasaur.id)).toBe(days * 432);
	});

	it("keeps inserted slots in chronological order within the expanded day", () => {
		const timeSlots: TimeSlot[] = [
			{ id: "sleep", time: "01:00", sleepState: "sleep", hasMeal: false },
			{ id: "wake", time: "09:00", sleepState: "wake", hasMeal: true },
			{ id: "dinner", time: "19:00", sleepState: "none", hasMeal: true },
		];
		// Sleep swap at 01:00 + 120min = 03:00 (before AM 4:00), and one at 09:00 + 60min.
		const schedule = createSchedule(
			[
				[
					{ pokemonId: pikachu.id, startMinute: 0, endMinute: 120 },
					{ pokemonId: eevee.id, startMinute: 120, endMinute: 540 },
					{
						pokemonId: bulbasaur.id,
						startMinute: 540,
						endMinute: MINUTES_PER_DAY,
					},
				],
				fullLane(null),
				fullLane(null),
				fullLane(null),
				fullLane(null),
			],
			{ sleepSlotId: "sleep", sleepTime: "01:00", usesSleepSwaps: true },
		);

		const timeline = buildQuickSimTimeline(schedule, timeSlots, 1, box);
		const expanded = buildExpandedTimeline(timeline.timeSlots, 1);
		const times = expanded.baseDaySlots.map((slot) => slot.time);
		expect(times).toEqual([
			"01:00",
			"03:00",
			"09:00",
			"10:00",
			"19:00",
			"01:00",
		]);

		let total = 0;
		for (let index = 1; index < times.length; index++) {
			total += calculateDuration(times[index - 1], times[index]);
		}
		expect(total).toBe(MINUTES_PER_DAY);
	});
});
