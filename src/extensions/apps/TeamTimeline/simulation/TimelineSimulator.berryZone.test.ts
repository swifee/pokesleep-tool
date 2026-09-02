import { describe, expect, it } from "vitest";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	createDefaultProvisionalSettings,
	type ProvisionalSettings,
} from "../types/ProvisionalSettingsTypes";
import {
	DEFAULT_TIME_SLOTS,
	type PokemonSwap,
	type TimeSlotResult,
} from "../types/TimeSlotTypes";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import { runSimulation } from "./TimelineSimulator";

const MEWTWO_ID = 1;
const NATU_ID = 2;
const PIKACHU_ID = 3;

function createMewtwo(): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: "Mewtwo", level: 50, skillLevel: 6 }),
		undefined,
		MEWTWO_ID,
	);
}

/** マゴのみ（エスパータイプ）のポケモン */
function createNatu(): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: "Natu", level: 50 }),
		undefined,
		NATU_ID,
	);
}

/** マゴのみ以外のポケモン */
function createPikachu(): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: "Pikachu", level: 50 }),
		undefined,
		PIKACHU_ID,
	);
}

function createProvisionalSettings(
	overrides: {
		berryZoneEnabled?: boolean;
		placeholderEnabled?: boolean;
		initialStackCount?: number;
	} = {},
): ProvisionalSettings {
	const settings = createDefaultProvisionalSettings();
	return {
		berryZone: {
			...settings.berryZone,
			enabled: overrides.berryZoneEnabled ?? true,
			initialStackCount: overrides.initialStackCount ?? 0,
			maxStackCount: 5,
			berryEnergyBonusPercent: 50,
			snorlaxEnergyByLevel: [100, 200, 300, 400, 500, 3000],
		},
		placeholderPokemon: {
			...settings.placeholderPokemon,
			enabled: overrides.placeholderEnabled ?? true,
			helpingFrequencySeconds: 1800,
			skillRatePercent: 30,
			carryLimit: 20,
		},
	};
}

function simulate(
	team: (PokemonBoxItem | null)[],
	provisionalSettings: ProvisionalSettings,
	swaps: PokemonSwap[] = [],
	box?: PokemonBoxItem[],
) {
	return runSimulation({
		team,
		timeSlots: DEFAULT_TIME_SLOTS,
		config: { seed: 20260902, initialEnergy: 80, simulationDays: 1 },
		bonusSettings: createDefaultTimelineBonusSettings(),
		provisionalSettings,
		swaps,
		box: box ? ({ items: box } as never) : undefined,
	});
}

function collectResults(
	slotResults: Map<string, TimeSlotResult[]>,
	pokemonId: number,
): TimeSlotResult[] {
	return [...slotResults.values()]
		.flat()
		.filter((result) => result.pokemonId === pokemonId);
}

describe("TimelineSimulator きのみゾーン（サイコブレイク）", () => {
	it("仮ステータスがないミュウツーはおてつだいもスキル発動もしない", () => {
		const result = simulate(
			[createMewtwo(), createNatu(), null, null, null],
			createProvisionalSettings({ placeholderEnabled: false }),
		);

		const mewtwoResults = collectResults(result.slotResults, MEWTWO_ID);
		expect(mewtwoResults.length).toBeGreaterThan(0);
		expect(
			mewtwoResults.reduce((total, slot) => total + slot.helpCount, 0),
		).toBe(0);
	});

	it("仮ステータスを有効にするとミュウツーがおてつだいしてゾーンを展開する", () => {
		const result = simulate(
			[createMewtwo(), createNatu(), null, null, null],
			createProvisionalSettings(),
		);

		const mewtwoResults = collectResults(result.slotResults, MEWTWO_ID);
		const totalHelpCount = mewtwoResults.reduce(
			(total, slot) => total + slot.helpCount,
			0,
		);
		const totalSkillTriggerCount = mewtwoResults.reduce(
			(total, slot) => total + slot.skillTriggerCount,
			0,
		);
		const totalSkillEP = mewtwoResults.reduce(
			(total, slot) => total + slot.directSkillEP,
			0,
		);
		const lastStackCount =
			mewtwoResults[mewtwoResults.length - 1]?.berryZoneStackCount ?? 0;

		expect(totalHelpCount).toBeGreaterThan(0);
		expect(totalSkillTriggerCount).toBeGreaterThan(0);
		expect(totalSkillEP).toBe(3000 * totalSkillTriggerCount);
		expect(lastStackCount).toBeGreaterThan(0);
	});

	it("展開中はマゴのみのきのみEPが上がり、他タイプは変わらない", () => {
		const team: (PokemonBoxItem | null)[] = [
			createNatu(),
			createPikachu(),
			null,
			null,
			null,
		];
		const withoutZone = simulate(
			team,
			createProvisionalSettings({
				berryZoneEnabled: false,
				initialStackCount: 2,
			}),
		);
		const withZone = simulate(
			team,
			createProvisionalSettings({ initialStackCount: 2 }),
		);

		const natuBefore = withoutZone.dailySummaries.find(
			(summary) => summary.pokemonId === NATU_ID,
		);
		const natuAfter = withZone.dailySummaries.find(
			(summary) => summary.pokemonId === NATU_ID,
		);
		const pikachuBefore = withoutZone.dailySummaries.find(
			(summary) => summary.pokemonId === PIKACHU_ID,
		);
		const pikachuAfter = withZone.dailySummaries.find(
			(summary) => summary.pokemonId === PIKACHU_ID,
		);

		expect(natuBefore?.berryEP).toBeGreaterThan(0);
		expect(natuAfter?.berryEP).toBeGreaterThan(natuBefore?.berryEP ?? 0);
		expect(pikachuAfter?.berryEP).toBe(pikachuBefore?.berryEP);
	});

	it("展開したゾーンはミュウツーを入れ替えても持続する", () => {
		const mewtwo = createMewtwo();
		const natu = createNatu();
		const pikachu = createPikachu();
		const swapSlotId = DEFAULT_TIME_SLOTS[1].id;
		const result = simulate(
			[mewtwo, natu, null, null, null],
			createProvisionalSettings(),
			[
				{
					slotId: swapSlotId,
					teamSlotIndex: 0,
					newPokemonId: PIKACHU_ID,
					initialEnergy: 80,
					dayIndex: 0,
				},
			],
			[mewtwo, natu, pikachu],
		);

		const natuResults = collectResults(result.slotResults, NATU_ID);
		const stackCounts = natuResults.map(
			(slot) => slot.berryZoneStackCount ?? 0,
		);
		const lastStackCount = stackCounts[stackCounts.length - 1];

		// 入れ替え後もミュウツーの結果は増えず、ゾーンだけが残る
		expect(
			collectResults(result.slotResults, PIKACHU_ID).length,
		).toBeGreaterThan(0);
		expect(lastStackCount).toBeGreaterThan(0);
		expect(natuResults[natuResults.length - 1]?.berryZoneMultiplier).toBe(
			1 + lastStackCount * 0.5,
		);
	});
});
