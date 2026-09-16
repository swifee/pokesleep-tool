import { describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { runSimulation } from "../simulation/TimelineSimulator";
import {
	MINUTES_PER_DAY,
	QUICK_SIM_SWAP_INITIAL_ENERGY,
	type QuickSimLaneSegment,
	type QuickSimMember,
	type QuickSimSchedule,
} from "../types/QuickSimTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
	SWAP_NONE_POKEMON_ID,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { collectTimelineDurationSummaryByPokemon } from "./AdditionalAnalysisUtils";
import { buildQuickSimSchedule } from "./QuickSimScheduler";
import {
	buildQuickSimTimeline,
	QUICK_SIM_SLOT_ID_PREFIX,
} from "./QuickSimTimelineBuilder";
import { createDefaultTimelineBonusSettings } from "./TimelineBonusSettingsBridge";
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
	overrides: Partial<QuickSimSchedule> = {},
): QuickSimSchedule {
	return {
		dayLanes: [lanes],
		sleepSlotId: "slot-5",
		sleepTime: "23:00",
		sleepMinutes: SLEEP_MINUTES,
		usesSleepSwaps: false,
		unmetPokemonIds: [],
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
		const members: QuickSimMember[] = [
			{ pokemonId: pikachu.id, usagePercent: 100, usageMode: "even" },
			{ pokemonId: eevee.id, usagePercent: 70, usageMode: "even" },
			{ pokemonId: bulbasaur.id, usagePercent: 30, usageMode: "even" },
		];
		const days = 3;
		const result = buildQuickSimSchedule(members, DEFAULT_TIME_SLOTS, days);
		if (!result.ok) {
			throw new Error(result.error);
		}
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

	it("swaps at the previous bedtime when the next day starts with another member", () => {
		// Day 0: Pikachu all day. Day 1: Eevee all day. Day 2: Eevee until 600, then empty.
		const schedule = createSchedule([], {
			dayLanes: [
				[
					fullLane(pikachu.id),
					fullLane(null),
					fullLane(null),
					fullLane(null),
					fullLane(null),
				],
				[
					fullLane(eevee.id),
					fullLane(null),
					fullLane(null),
					fullLane(null),
					fullLane(null),
				],
				[
					[
						{ pokemonId: eevee.id, startMinute: 0, endMinute: 600 },
						{ pokemonId: null, startMinute: 600, endMinute: MINUTES_PER_DAY },
					],
					fullLane(null),
					fullLane(null),
					fullLane(null),
					fullLane(null),
				],
			],
		});

		const timeline = buildQuickSimTimeline(
			schedule,
			DEFAULT_TIME_SLOTS,
			3,
			box,
		);

		expect(timeline.team).toEqual([pikachu, null, null, null, null]);
		expect(timeline.swaps).toEqual([
			{
				dayIndex: 0,
				slotId: "slot-5-end",
				teamSlotIndex: 0,
				newPokemonId: eevee.id,
				initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
			},
			{
				dayIndex: 2,
				slotId: `${QUICK_SIM_SLOT_ID_PREFIX}0900`,
				teamSlotIndex: 0,
				newPokemonId: SWAP_NONE_POKEMON_ID,
				initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
			},
		]);

		const summary = collectTimelineDurationSummaryByPokemon(
			timeline.team,
			timeline.timeSlots,
			3,
			timeline.swaps,
			box,
		);
		expect(summary.activeMinutesByPokemonId.get(pikachu.id)).toBe(
			MINUTES_PER_DAY,
		);
		expect(summary.activeMinutesByPokemonId.get(eevee.id)).toBe(
			MINUTES_PER_DAY + 600,
		);
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

	it("simulates a member that is only used after waking up", () => {
		// A daytime member is placed from the wake slot, so every lane is empty at
		// bedtime and the member only enters the team through a swap.
		const members: QuickSimMember[] = [
			{ pokemonId: pikachu.id, usagePercent: 40, usageMode: "daytime" },
		];
		const result = buildQuickSimSchedule(members, DEFAULT_TIME_SLOTS, 1);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const timeline = buildQuickSimTimeline(
			result.schedule,
			DEFAULT_TIME_SLOTS,
			1,
			box,
		);
		expect(timeline.team).toEqual([null, null, null, null, null]);
		expect(timeline.swaps[0]).toMatchObject({
			dayIndex: 0,
			slotId: "slot-1",
			newPokemonId: pikachu.id,
		});

		const simulationResult = runSimulation({
			team: timeline.team,
			timeSlots: timeline.timeSlots,
			config: { ...DEFAULT_SIMULATION_CONFIG, seed: 1, simulationDays: 1 },
			bonusSettings: createDefaultTimelineBonusSettings(),
			swaps: timeline.swaps,
			noCollectCells: timeline.noCollectCells,
			box,
		});

		const pikachuSummary = simulationResult.dailySummaries.find(
			(summary) => summary.pokemonId === pikachu.id,
		);
		expect(pikachuSummary?.totalHelpCount ?? 0).toBeGreaterThan(0);
		expect(simulationResult.teamSummary.grandTotalEP).toBeGreaterThan(0);
	});
});
