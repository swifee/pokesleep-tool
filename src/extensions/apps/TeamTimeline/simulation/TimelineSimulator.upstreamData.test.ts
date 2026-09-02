import { describe, expect, it } from "vitest";
import events from "../../../../data/events";
import fields, { cbexFieldIndex } from "../../../../data/fields";
import pokemons from "../../../../data/pokemons";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { DEFAULT_TIME_SLOTS } from "../types/TimeSlotTypes";
import {
	createDefaultTimelineBonusSettings,
	normalizeTimelineBonusSettings,
} from "../utils/TimelineBonusSettingsBridge";
import { runSimulation } from "./TimelineSimulator";

/**
 * 上流同期で追加されたデータ（新フィールド・新ポケモン・新イベント）を
 * TeamTimeline がそのまま扱えることを確認する。
 */
describe("TeamTimeline が上流追加データを扱えること", () => {
	function simulateWith(pokemonName: string, fieldIndex: number) {
		const pokemon = new PokemonBoxItem(
			new PokemonIv({ pokemonName, level: 30, skillLevel: 1 }),
		);
		return runSimulation({
			team: [pokemon, null, null, null, null],
			timeSlots: DEFAULT_TIME_SLOTS,
			config: { seed: 4649, initialEnergy: 50, simulationDays: 1 },
			bonusSettings: normalizeTimelineBonusSettings({
				...createDefaultTimelineBonusSettings(),
				fieldIndex,
			}),
		});
	}

	it("シアンビーチ(EX)がボーナス設定で選択できる", () => {
		expect(fields[cbexFieldIndex]?.expert).toBe(true);
		expect(
			normalizeTimelineBonusSettings({ fieldIndex: cbexFieldIndex }).fieldIndex,
		).toBe(cbexFieldIndex);
	});

	it("シアンビーチ(EX)でもシミュレーションが完走する", () => {
		const result = simulateWith("Pikachu", cbexFieldIndex);
		expect(result.dailySummaries).toHaveLength(1);
		expect(result.teamSummary.grandTotalEP).toBeGreaterThan(0);
	});

	it.each([
		"Mewtwo",
		"Hawlucha",
		"Tinkaton",
		"Lucario",
	])("上流で追加された %s をチームに入れてもシミュレーションが完走する", (pokemonName) => {
		expect(pokemons.some((p) => p.name === pokemonName)).toBe(true);

		const result = simulateWith(pokemonName, cbexFieldIndex);
		expect(result.dailySummaries).toHaveLength(1);
	});

	it("鍋容量ボーナス付きイベントが event データに存在する", () => {
		const potSizeEvents = events.bonus.filter(
			(event) => event.effects.potSize > 1,
		);
		expect(potSizeEvents.length).toBeGreaterThan(0);
	});
});
