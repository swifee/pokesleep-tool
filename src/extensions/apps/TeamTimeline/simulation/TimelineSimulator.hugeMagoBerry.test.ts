import { describe, expect, it } from "vitest";
import { getBigBerryRate } from "../../../../data/BigBerry";
import { loadHelpEventBonus } from "../../../../data/events";
import { getBerryStrength } from "../../../../util/Berry";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { calcBerryStrengthBonus } from "../../../../util/PokemonStrength";
import type { TimelineBonusSettings } from "../types/TimelineBonusSettingsTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
	type NoCollectCellSetting,
	type TimeSlotResult,
} from "../types/TimeSlotTypes";
import {
	buildStrengthParameterFromTimelineBonusSettings,
	createDefaultTimelineBonusSettings,
} from "../utils/TimelineBonusSettingsBridge";
import { runSimulation } from "./TimelineSimulator";

const PIKACHU_ID = 1;
const NATU_ID = 2;
const MEWTWO_ID = 3;

/** マゴのみ以外のポケモン（取得確率 3% / 1個） */
function createPikachu(): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: "Pikachu", level: 50 }),
		undefined,
		PIKACHU_ID,
	);
}

/** マゴのみ（エスパータイプ）のポケモン（取得確率 6% / 1個） */
function createNatu(): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: "Natu", level: 50 }),
		undefined,
		NATU_ID,
	);
}

/** ミュウツー（取得確率 12% / 2個） */
function createMewtwo(): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: "Mewtwo", level: 50, skillLevel: 6 }),
		undefined,
		MEWTWO_ID,
	);
}

/** 「とてもおおきなマゴのみ」だけを持つカスタムイベント */
function createBigBerryEventSettings(): TimelineBonusSettings {
	return {
		...createDefaultTimelineBonusSettings(),
		event: "custom",
		customEventBonus: loadHelpEventBonus({
			target: {},
			effects: { bigBerry: "mewtwo1" },
		}),
	};
}

function simulate(
	team: (PokemonBoxItem | null)[],
	bonusSettings: TimelineBonusSettings,
	options: {
		simulationDays?: number;
		noCollectCells?: NoCollectCellSetting[];
	} = {},
) {
	return runSimulation({
		team,
		timeSlots: DEFAULT_TIME_SLOTS,
		config: {
			...DEFAULT_SIMULATION_CONFIG,
			seed: 20260914,
			initialEnergy: 80,
			simulationDays: options.simulationDays ?? 7,
		},
		bonusSettings,
		noCollectCells: options.noCollectCells ?? [],
		analysisOptions: { perPokemonRandomStreams: true },
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

function sumHelpCount(results: TimeSlotResult[]): number {
	return results.reduce((total, result) => total + result.helpCount, 0);
}

describe("TimelineSimulator とてもおおきなマゴのみ", () => {
	it("イベントが無ければ1個も拾わない", () => {
		const result = simulate(
			[createPikachu(), createNatu(), createMewtwo(), null, null],
			createDefaultTimelineBonusSettings(),
		);

		for (const id of [PIKACHU_ID, NATU_ID, MEWTWO_ID]) {
			expect(
				sumHugeMagoBerryCount(collectResults(result.slotResults, id)),
			).toBe(0);
		}
		expect(result.teamSummary.totalHugeMagoBerryCount).toBe(0);
	});

	it("「ミュウツーをおいかけて」イベントでは上流と同じ確率・個数で拾う", () => {
		const bonusSettings = {
			...createDefaultTimelineBonusSettings(),
			event: "pursue mewtwo 1st week",
		};
		const result = simulate(
			[createPikachu(), createNatu(), createMewtwo(), null, null],
			bonusSettings,
		);

		// 1週間分のおてつだいで、期待値に近い個数を拾う（区分ごとの確率 × 個数）
		for (const [id, pokemon] of [
			[PIKACHU_ID, createPikachu()],
			[NATU_ID, createNatu()],
			[MEWTWO_ID, createMewtwo()],
		] as const) {
			const results = collectResults(result.slotResults, id);
			const helpCount = sumHelpCount(results);
			const picked = sumHugeMagoBerryCount(results);
			const { rate, count } = getBigBerryRate("mewtwo1", pokemon.iv.pokemon);
			const expected = helpCount * rate * count;

			expect(rate).toBeGreaterThan(0);
			expect(picked).toBeGreaterThan(0);
			// 所持数の空きが無いときは拾わないため期待値より少なめになりうる
			expect(picked).toBeLessThanOrEqual(expected * 1.8);
			expect(picked).toBeGreaterThanOrEqual(expected * 0.3);
		}
		expect(getBigBerryRate("mewtwo1", createMewtwo().iv.pokemon)).toEqual({
			rate: 0.12,
			count: 2,
		});
		expect(getBigBerryRate("mewtwo1", createNatu().iv.pokemon)).toEqual({
			rate: 0.06,
			count: 1,
		});
		expect(getBigBerryRate("mewtwo1", createPikachu().iv.pokemon)).toEqual({
			rate: 0.03,
			count: 1,
		});
	});

	it("マゴのみ ×10 のエナジーとしてEPを計算し、きのみEPに含める", () => {
		const bonusSettings = createBigBerryEventSettings();
		const result = simulate(
			[createPikachu(), null, null, null, null],
			bonusSettings,
		);

		const strengthParameter =
			buildStrengthParameterFromTimelineBonusSettings(bonusSettings);
		const perBerryEP = getBerryStrength(
			"psychic",
			50,
			bonusSettings.fieldBonus,
			calcBerryStrengthBonus("psychic", strengthParameter),
			true,
		);
		const totalCount = result.dailySummaries.reduce(
			(total, summary) => total + (summary.totalHugeMagoBerryCount ?? 0),
			0,
		);
		const totalEP = result.dailySummaries.reduce(
			(total, summary) => total + (summary.hugeMagoBerryEP ?? 0),
			0,
		);

		expect(totalCount).toBeGreaterThan(0);
		expect(totalEP).toBe(perBerryEP * totalCount);
		expect(result.teamSummary.totalHugeMagoBerryEP).toBe(totalEP);
		for (const summary of result.dailySummaries) {
			expect(summary.berryEP).toBeGreaterThanOrEqual(
				summary.hugeMagoBerryEP ?? 0,
			);
		}
	});

	it("きのみゾーン展開中はエナジーが上がる", () => {
		const bonusSettings = createBigBerryEventSettings();
		const pikachu = createPikachu();
		const withoutZone = simulate(
			[pikachu, null, null, null, null],
			bonusSettings,
		);
		const withZone = simulate(
			[pikachu, createMewtwo(), null, null, null],
			bonusSettings,
		);

		const countWithout = sumHugeMagoBerryCount(
			collectResults(withoutZone.slotResults, PIKACHU_ID),
		);
		const countWith = sumHugeMagoBerryCount(
			collectResults(withZone.slotResults, PIKACHU_ID),
		);
		const epWithout = collectResults(
			withoutZone.slotResults,
			PIKACHU_ID,
		).reduce((total, slot) => total + (slot.hugeMagoBerryEP ?? 0), 0);
		const epWith = collectResults(withZone.slotResults, PIKACHU_ID).reduce(
			(total, slot) => total + (slot.hugeMagoBerryEP ?? 0),
			0,
		);

		// 乱数列はポケモンごとに固定なので個数は同じで、エナジーだけが上がる
		expect(countWith).toBe(countWithout);
		expect(countWith).toBeGreaterThan(0);
		expect(epWith).toBeGreaterThan(epWithout);
	});

	it("回収しない時間帯では回収されず、溢れても取得扱いにならない", () => {
		const bonusSettings = createBigBerryEventSettings();
		const noCollectSlotId = DEFAULT_TIME_SLOTS[1].id;
		const baseline = simulate(
			[createMewtwo(), null, null, null, null],
			bonusSettings,
		);
		const withNoCollect = simulate(
			[createMewtwo(), null, null, null, null],
			bonusSettings,
			{
				noCollectCells: [
					{ dayIndex: 0, slotId: noCollectSlotId, teamSlotIndex: 0 },
				],
			},
		);

		const noCollectResults = collectResults(
			withNoCollect.slotResults,
			MEWTWO_ID,
		);
		const noCollectSlot = noCollectResults.find(
			(result) =>
				result.slotId.startsWith(noCollectSlotId) &&
				result.slotId.endsWith("day0"),
		);

		// いつのまに育成でカビゴンに渡せないため、溢れ回収の対象にならない。
		expect(noCollectSlot).toBeDefined();
		expect(noCollectSlot?.hugeMagoBerryCount).toBe(0);
		expect(noCollectSlot?.hugeMagoBerryEP).toBe(0);
		// 持ち越したきのみが所持数を埋めるため、合計は回収した場合より減る。
		const noCollectTotal = sumHugeMagoBerryCount(noCollectResults);
		expect(noCollectTotal).toBeGreaterThan(0);
		expect(noCollectTotal).toBeLessThanOrEqual(
			sumHugeMagoBerryCount(collectResults(baseline.slotResults, MEWTWO_ID)),
		);
	});
});
