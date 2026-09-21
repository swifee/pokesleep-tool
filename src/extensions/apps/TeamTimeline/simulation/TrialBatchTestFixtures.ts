/**
 * Shared fixtures for the trial batch / worker test suites.
 *
 * No `describe`/`it` here, so the vitest runner ignores this file.
 */

import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import type { QuickSimMember } from "../types/QuickSimTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
} from "../types/TimeSlotTypes";
import { buildQuickSimSchedule } from "../utils/QuickSimScheduler";
import { buildQuickSimTimeline } from "../utils/QuickSimTimelineBuilder";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import type { TrialSimulationInput } from "./MultiTrialSimulator";

export function createTestBoxItem(
	pokemonName: string,
	id: number,
	nickname = "",
): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName, level: 50 }),
		nickname,
		id,
	);
}

/**
 * 8 members over 5 slots, so the timeline contains swaps into box-only
 * items, plus cooking and a custom name resolver.
 */
export function createSwapTrialInput(days = 2): TrialSimulationInput {
	const items = [
		createTestBoxItem("Pikachu", 1, "ピカ"),
		createTestBoxItem("Eevee", 2),
		createTestBoxItem("Bulbasaur", 3),
		createTestBoxItem("Charmander", 4),
		createTestBoxItem("Squirtle", 5),
		createTestBoxItem("Gengar", 6, "ゲン"),
		createTestBoxItem("Absol", 7),
		createTestBoxItem("Raichu", 8),
	];
	const box = new PokemonBox(items);
	const members: QuickSimMember[] = items.map((item, index) => ({
		pokemonId: item.id,
		usagePercent: [100, 100, 60, 60, 50, 50, 40, 40][index],
		usageMode: "even",
	}));
	const scheduleResult = buildQuickSimSchedule(
		members,
		DEFAULT_TIME_SLOTS,
		days,
	);
	if (!scheduleResult.ok) {
		throw new Error(scheduleResult.error);
	}
	const timeline = buildQuickSimTimeline(
		scheduleResult.schedule,
		DEFAULT_TIME_SLOTS,
		days,
		box,
	);
	return {
		team: timeline.team,
		timeSlots: timeline.timeSlots,
		config: { ...DEFAULT_SIMULATION_CONFIG, simulationDays: days },
		bonusSettings: createDefaultTimelineBonusSettings(),
		swaps: timeline.swaps,
		noCollectCells: timeline.noCollectCells,
		box,
		cookingSettings: { ...createDefaultCookingSettings(), enabled: true },
		resolvePokemonName: (pokemon) => `name:${pokemon.id}`,
	};
}
