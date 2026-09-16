import { describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
	type PokemonSwap,
	type SimulationResult,
	SWAP_NONE_POKEMON_ID,
} from "../types/TimeSlotTypes";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import { runSimulation } from "./TimelineSimulator";

const bonusSettings = createDefaultTimelineBonusSettings();

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName, level: 30 }), "", id);
}

function summaryOf(
	result: SimulationResult,
	pokemonId: number,
): { helps: number; ep: number } | undefined {
	const summary = result.dailySummaries.find(
		(daily) => daily.pokemonId === pokemonId,
	);
	return summary
		? { helps: summary.totalHelpCount, ep: summary.totalEP }
		: undefined;
}

function run(
	team: (PokemonBoxItem | null)[],
	options: {
		perPokemonRandomStreams?: boolean;
		swaps?: PokemonSwap[];
		box?: PokemonBox;
		days?: number;
	} = {},
): SimulationResult {
	return runSimulation({
		team,
		timeSlots: DEFAULT_TIME_SLOTS,
		config: {
			...DEFAULT_SIMULATION_CONFIG,
			seed: 4242,
			simulationDays: options.days ?? 2,
		},
		bonusSettings,
		swaps: options.swaps,
		box: options.box,
		analysisOptions:
			options.perPokemonRandomStreams === undefined
				? undefined
				: { perPokemonRandomStreams: options.perPokemonRandomStreams },
	});
}

describe("TimelineSimulator perPokemonRandomStreams", () => {
	const pikachu = createItem("Pikachu", 101);
	const eevee = createItem("Eevee", 102);

	it("keeps the default seeding when the option is off", () => {
		const team = [pikachu, eevee, null, null, null];
		const withoutOptions = run(team);
		const withOptionOff = run(team, { perPokemonRandomStreams: false });
		expect(summaryOf(withOptionOff, pikachu.id)).toEqual(
			summaryOf(withoutOptions, pikachu.id),
		);
		expect(summaryOf(withOptionOff, eevee.id)).toEqual(
			summaryOf(withoutOptions, eevee.id),
		);
	});

	it("gives a pokemon the same random stream regardless of its slot", () => {
		const first = run([pikachu, eevee, null, null, null], {
			perPokemonRandomStreams: true,
		});
		const swapped = run([eevee, pikachu, null, null, null], {
			perPokemonRandomStreams: true,
		});
		expect(summaryOf(swapped, pikachu.id)).toEqual(
			summaryOf(first, pikachu.id),
		);
		expect(summaryOf(swapped, eevee.id)).toEqual(summaryOf(first, eevee.id));
	});

	it("gives a pokemon the same random stream regardless of its teammates", () => {
		const alone = run([pikachu, null, null, null, null], {
			perPokemonRandomStreams: true,
		});
		const together = run([eevee, pikachu, null, null, null], {
			perPokemonRandomStreams: true,
		});
		expect(summaryOf(together, pikachu.id)).toEqual(
			summaryOf(alone, pikachu.id),
		);
	});

	it("continues the stream when a pokemon re-enters the team", () => {
		const box = new PokemonBox([pikachu, eevee]);
		// 初日の昼に外し、初日の夜（就寝スロット）で戻す
		const swaps: PokemonSwap[] = [
			{
				dayIndex: 0,
				slotId: "slot-2",
				teamSlotIndex: 0,
				newPokemonId: SWAP_NONE_POKEMON_ID,
				initialEnergy: 100,
			},
			{
				dayIndex: 0,
				slotId: "slot-5",
				teamSlotIndex: 0,
				newPokemonId: pikachu.id,
				initialEnergy: 100,
			},
		];
		const withStreams = run([pikachu, null, null, null, null], {
			perPokemonRandomStreams: true,
			swaps,
			box,
		});
		const summary = summaryOf(withStreams, pikachu.id);
		expect(summary).toBeDefined();
		expect(summary?.helps).toBeGreaterThan(0);

		// 同じシードで 2 回実行しても同じ結果になる（決定的）
		const again = run([pikachu, null, null, null, null], {
			perPokemonRandomStreams: true,
			swaps,
			box,
		});
		expect(summaryOf(again, pikachu.id)).toEqual(summary);
	});
});
