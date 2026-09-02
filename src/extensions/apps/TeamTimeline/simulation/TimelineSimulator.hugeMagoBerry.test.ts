import { describe, expect, it } from "vitest";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	createDefaultProvisionalSettings,
	type HugeMagoBerryProvisionalSettings,
	type ProvisionalSettings,
} from "../types/ProvisionalSettingsTypes";
import {
	DEFAULT_TIME_SLOTS,
	type NoCollectCellSetting,
	type TimeSlotResult,
} from "../types/TimeSlotTypes";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import { calculateBerryStrength } from "./EnergyPointCalculator";
import { runSimulation } from "./TimelineSimulator";

const PIKACHU_ID = 1;
const NATU_ID = 2;

/** マゴのみ以外のポケモン */
function createPikachu(): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: "Pikachu", level: 50 }),
		undefined,
		PIKACHU_ID,
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

function createProvisionalSettings(
	hugeMagoBerry: Partial<HugeMagoBerryProvisionalSettings> = {},
	berryZoneOverrides: Partial<ProvisionalSettings["berryZone"]> = {},
): ProvisionalSettings {
	const defaults = createDefaultProvisionalSettings();
	return {
		...defaults,
		berryZone: { ...defaults.berryZone, ...berryZoneOverrides },
		hugeMagoBerry: {
			...defaults.hugeMagoBerry,
			enabled: true,
			energyMultiplier: 3,
			legendaryPickupRatePercent: 100,
			psychicPickupRatePercent: 100,
			otherPickupRatePercent: 100,
			...hugeMagoBerry,
		},
	};
}

function simulate(
	team: (PokemonBoxItem | null)[],
	provisionalSettings: ProvisionalSettings,
	noCollectCells: NoCollectCellSetting[] = [],
) {
	return runSimulation({
		team,
		timeSlots: DEFAULT_TIME_SLOTS,
		config: { seed: 20260914, initialEnergy: 80, simulationDays: 1 },
		bonusSettings: createDefaultTimelineBonusSettings(),
		provisionalSettings,
		noCollectCells,
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

function sumHugeMagoBerryCount(results: TimeSlotResult[]): number {
	return results.reduce(
		(total, result) => total + (result.hugeMagoBerryCount ?? 0),
		0,
	);
}

describe("TimelineSimulator とてもおおきなマゴのみ", () => {
	it("仮設定が無効なら1個も拾わない", () => {
		const result = simulate(
			[createPikachu(), null, null, null, null],
			createProvisionalSettings({ enabled: false }),
		);

		const results = collectResults(result.slotResults, PIKACHU_ID);
		expect(sumHugeMagoBerryCount(results)).toBe(0);
		expect(result.dailySummaries[0].totalHugeMagoBerryCount).toBe(0);
	});

	it("仮設定を有効にするとエスパー以外のポケモンも拾う", () => {
		const result = simulate(
			[createPikachu(), null, null, null, null],
			createProvisionalSettings(),
		);

		const results = collectResults(result.slotResults, PIKACHU_ID);
		expect(sumHugeMagoBerryCount(results)).toBeGreaterThan(0);
	});

	it("確率が高い区分ほど多く拾う", () => {
		const psychicOnly = simulate(
			[createNatu(), null, null, null, null],
			createProvisionalSettings({
				psychicPickupRatePercent: 100,
				otherPickupRatePercent: 0,
			}),
		);
		const otherOnly = simulate(
			[createPikachu(), null, null, null, null],
			createProvisionalSettings({
				psychicPickupRatePercent: 100,
				otherPickupRatePercent: 0,
			}),
		);

		expect(
			sumHugeMagoBerryCount(collectResults(psychicOnly.slotResults, NATU_ID)),
		).toBeGreaterThan(0);
		expect(
			sumHugeMagoBerryCount(collectResults(otherOnly.slotResults, PIKACHU_ID)),
		).toBe(0);
	});

	it("マゴのみとしてEPを計算し、きのみEPに含める", () => {
		const provisionalSettings = createProvisionalSettings();
		const result = simulate(
			[createPikachu(), null, null, null, null],
			provisionalSettings,
		);

		const summary = result.dailySummaries[0];
		const magoStrength = calculateBerryStrength("psychic", 50);
		const expectedEP =
			Math.ceil(
				magoStrength * provisionalSettings.hugeMagoBerry.energyMultiplier,
			) * (summary.totalHugeMagoBerryCount ?? 0);

		expect(summary.totalHugeMagoBerryCount).toBeGreaterThan(0);
		expect(summary.hugeMagoBerryEP).toBe(expectedEP);
		expect(summary.berryEP).toBeGreaterThan(expectedEP);
		expect(result.teamSummary.totalHugeMagoBerryEP).toBe(expectedEP);
	});

	it("きのみゾーン展開中はエナジーが上がる", () => {
		const withoutZone = simulate(
			[createPikachu(), null, null, null, null],
			createProvisionalSettings(),
		);
		const withZone = simulate(
			[createPikachu(), null, null, null, null],
			createProvisionalSettings(
				{},
				{ enabled: true, initialStackCount: 5, berryEnergyBonusPercent: 50 },
			),
		);

		expect(withZone.dailySummaries[0].totalHugeMagoBerryCount).toBe(
			withoutZone.dailySummaries[0].totalHugeMagoBerryCount,
		);
		expect(withZone.dailySummaries[0].hugeMagoBerryEP).toBeGreaterThan(
			withoutZone.dailySummaries[0].hugeMagoBerryEP ?? 0,
		);
	});

	it("回収しない時間帯では回収されず、溢れても取得扱いにならない", () => {
		const provisionalSettings = createProvisionalSettings();
		const noCollectSlotId = DEFAULT_TIME_SLOTS[1].id;
		const baseline = simulate(
			[createPikachu(), null, null, null, null],
			provisionalSettings,
		);
		const withNoCollect = simulate(
			[createPikachu(), null, null, null, null],
			provisionalSettings,
			[{ dayIndex: 0, slotId: noCollectSlotId, teamSlotIndex: 0 }],
		);

		const noCollectResults = collectResults(
			withNoCollect.slotResults,
			PIKACHU_ID,
		);
		const noCollectSlot = noCollectResults.find((result) =>
			result.slotId.startsWith(noCollectSlotId),
		);

		// いつのまに育成でカビゴンに渡せないため、溢れ回収の対象にならない。
		expect(noCollectSlot?.hugeMagoBerryCount).toBe(0);
		expect(noCollectSlot?.hugeMagoBerryEP).toBe(0);
		// 持ち越したきのみが所持数を埋めるため、1日の合計は回収した場合より減る。
		const noCollectTotal = sumHugeMagoBerryCount(noCollectResults);
		expect(noCollectTotal).toBeGreaterThan(0);
		expect(noCollectTotal).toBeLessThan(
			sumHugeMagoBerryCount(collectResults(baseline.slotResults, PIKACHU_ID)),
		);
	});
});
