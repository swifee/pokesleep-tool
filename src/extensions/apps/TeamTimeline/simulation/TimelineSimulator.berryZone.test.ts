import { describe, expect, it } from "vitest";
import { getSkillValue } from "../../../../util/MainSkill";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
	type PokemonSwap,
	type TimeSlotResult,
} from "../types/TimeSlotTypes";
import { BERRY_ZONE_MAX_RATE_PERCENT } from "../utils/BerryZoneUtils";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import { runSimulation } from "./TimelineSimulator";

const MEWTWO_ID = 1;
const NATU_ID = 2;
const PIKACHU_ID = 3;

/** ミュウツー（きのみゾーン（サイコブレイク）） */
function createMewtwo(skillLevel = 6): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: "Mewtwo", level: 50, skillLevel }),
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

function simulate(
	team: (PokemonBoxItem | null)[],
	options: {
		simulationDays?: number;
		swaps?: PokemonSwap[];
		box?: PokemonBoxItem[];
	} = {},
) {
	return runSimulation({
		team,
		timeSlots: DEFAULT_TIME_SLOTS,
		config: {
			...DEFAULT_SIMULATION_CONFIG,
			seed: 20260902,
			initialEnergy: 80,
			simulationDays: options.simulationDays ?? 1,
		},
		bonusSettings: createDefaultTimelineBonusSettings(),
		swaps: options.swaps ?? [],
		box: options.box ? ({ items: options.box } as never) : undefined,
		// チーム構成を変えてもポケモンごとの乱数列が変わらないようにする
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

function sum(results: TimeSlotResult[], pick: (r: TimeSlotResult) => number) {
	return results.reduce((total, result) => total + pick(result), 0);
}

describe("TimelineSimulator きのみゾーン（サイコブレイク）", () => {
	it("ミュウツーは公式値のカビゴンエナジーを獲得し、発動ごとに増加率を積み上げる", () => {
		const result = simulate([createMewtwo(6), createNatu(), null, null, null]);

		const mewtwoResults = collectResults(result.slotResults, MEWTWO_ID);
		const totalSkillTriggerCount = sum(
			mewtwoResults,
			(slot) => slot.skillTriggerCount,
		);
		const totalSkillEP = sum(mewtwoResults, (slot) => slot.directSkillEP);
		const lastRate =
			mewtwoResults[mewtwoResults.length - 1]?.berryZoneRatePercent ?? 0;

		expect(sum(mewtwoResults, (slot) => slot.helpCount)).toBeGreaterThan(0);
		expect(totalSkillTriggerCount).toBeGreaterThan(0);
		expect(totalSkillEP).toBe(
			getSkillValue("Berry Zone (Psystrike)", 6) * totalSkillTriggerCount,
		);
		expect(lastRate).toBeGreaterThan(0);
		expect(lastRate).toBeLessThanOrEqual(BERRY_ZONE_MAX_RATE_PERCENT);
	});

	it("発動による増加は次の時間帯から反映され、その時間帯の倍率に一致する", () => {
		const result = simulate([createMewtwo(6), createNatu(), null, null, null]);

		const natuResults = collectResults(result.slotResults, NATU_ID);
		// 開始時点は未展開
		expect(natuResults[0]?.berryZoneRatePercent).toBe(0);
		expect(natuResults[0]?.berryZoneMultiplier).toBe(1);

		let previousRate = 0;
		for (const slot of natuResults) {
			const rate = slot.berryZoneRatePercent ?? 0;
			expect(rate).toBeGreaterThanOrEqual(previousRate);
			expect(slot.berryZoneMultiplier).toBeCloseTo(1 + rate / 100, 10);
			previousRate = rate;
		}
		expect(previousRate).toBeGreaterThan(0);
	});

	it("増加率は上限 24% で止まる", () => {
		// Lv6 は 1 回 2% なので 12 回発動で上限。
		// 実データの発動率(2.9%)では1週間で届かないことがあるため、発動率を引き上げる。
		const mewtwo = createMewtwo(6);
		Object.defineProperty(mewtwo.iv, "skillRate", {
			configurable: true,
			get: () => 0.5,
		});
		const result = simulate([mewtwo, createNatu(), null, null, null], {
			simulationDays: 7,
		});

		const mewtwoResults = collectResults(result.slotResults, MEWTWO_ID);
		const totalSkillTriggerCount = sum(
			mewtwoResults,
			(slot) => slot.skillTriggerCount,
		);
		const rates = mewtwoResults.map((slot) => slot.berryZoneRatePercent ?? 0);

		expect(totalSkillTriggerCount).toBeGreaterThan(12);
		expect(Math.max(...rates)).toBe(BERRY_ZONE_MAX_RATE_PERCENT);
		expect(rates.every((rate) => rate <= BERRY_ZONE_MAX_RATE_PERCENT)).toBe(
			true,
		);
	});

	it("展開中はマゴのみのきのみEPが上がり、他タイプは変わらない", () => {
		const natu = createNatu();
		const pikachu = createPikachu();
		const withoutZone = simulate([null, natu, pikachu, null, null]);
		const withZone = simulate([createMewtwo(6), natu, pikachu, null, null]);

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

		// 乱数列はポケモンごとに固定なので、きのみの個数は同じ
		expect(natuAfter?.totalBerryCount).toBe(natuBefore?.totalBerryCount);
		expect(pikachuAfter?.totalBerryCount).toBe(pikachuBefore?.totalBerryCount);
		expect(natuBefore?.berryEP).toBeGreaterThan(0);
		expect(natuAfter?.berryEP).toBeGreaterThan(natuBefore?.berryEP ?? 0);
		expect(pikachuAfter?.berryEP).toBe(pikachuBefore?.berryEP);
		expect(
			collectResults(withZone.slotResults, PIKACHU_ID).every(
				(slot) => slot.berryZoneMultiplier === 1,
			),
		).toBe(true);
	});

	it("展開したゾーンはミュウツーを入れ替えても持続する", () => {
		const mewtwo = createMewtwo(6);
		const natu = createNatu();
		const pikachu = createPikachu();
		const swapSlotId = DEFAULT_TIME_SLOTS[1].id;
		const result = simulate([mewtwo, natu, null, null, null], {
			swaps: [
				{
					slotId: swapSlotId,
					teamSlotIndex: 0,
					newPokemonId: PIKACHU_ID,
					initialEnergy: 80,
					dayIndex: 0,
				},
			],
			box: [mewtwo, natu, pikachu],
		});

		const natuResults = collectResults(result.slotResults, NATU_ID);
		const rates = natuResults.map((slot) => slot.berryZoneRatePercent ?? 0);
		const lastRate = rates[rates.length - 1];

		// 入れ替え後もミュウツーの結果は増えず、ゾーンだけが残る
		expect(
			collectResults(result.slotResults, PIKACHU_ID).length,
		).toBeGreaterThan(0);
		expect(lastRate).toBeGreaterThan(0);
		expect(
			natuResults[natuResults.length - 1]?.berryZoneMultiplier,
		).toBeCloseTo(1 + lastRate / 100, 10);
	});
});
