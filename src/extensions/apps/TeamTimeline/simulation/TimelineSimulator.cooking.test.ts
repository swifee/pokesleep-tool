import { describe, expect, it } from "vitest";
import type { IngredientName } from "../../../../data/pokemons";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	type CookingSimulationSettings,
	createDefaultCookingSettings,
} from "../types/CookingTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
	SUNDAY,
	type TimeSlotResult,
	type Weekday,
} from "../types/TimeSlotTypes";
import {
	buildStrengthParameterFromTimelineBonusSettings,
	createDefaultTimelineBonusSettings,
} from "../utils/TimelineBonusSettingsBridge";
import {
	calculateGrandTotalEPWithCooking,
	runHelpingSimulation,
	runSimulation,
	type SimulationInput,
} from "./TimelineSimulator";

const NAMES = ["Pikachu", "Eevee", "Bulbasaur", "Charmander", "Squirtle"];
/** 土曜日 */
const SATURDAY: Weekday = 6;

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName, level: 30 }), "", id);
}

function createCookingSettings(
	initialIngredients: CookingSimulationSettings["initialIngredients"],
	enabled = true,
): CookingSimulationSettings {
	return {
		...createDefaultCookingSettings(),
		enabled,
		category: "curry",
		initialIngredients,
	};
}

function createInput(
	cookingSettings: CookingSimulationSettings,
	overrides: Partial<SimulationInput> = {},
): SimulationInput {
	const items = NAMES.map((name, index) => createItem(name, index + 1));
	const bonusSettings = createDefaultTimelineBonusSettings();
	return {
		team: items,
		timeSlots: DEFAULT_TIME_SLOTS,
		config: { ...DEFAULT_SIMULATION_CONFIG, seed: 777, simulationDays: 7 },
		bonusSettings,
		box: new PokemonBox(items),
		cookingSettings,
		strengthParameter:
			buildStrengthParameterFromTimelineBonusSettings(bonusSettings),
		analysisOptions: { perPokemonRandomStreams: true },
		...overrides,
	};
}

describe("runHelpingSimulation + calculateGrandTotalEPWithCooking", () => {
	it("matches runSimulation exactly when cooking is enabled with initial ingredients", () => {
		const cookingSettings = createCookingSettings({ apple: 60, milk: 30 });
		const input = createInput(cookingSettings);
		const expected = runSimulation(input).teamSummary.grandTotalEP;

		const snapshot = runHelpingSimulation(input);
		expect(snapshot.isEmpty).toBe(false);
		expect(snapshot.slotResults.size).toBeGreaterThan(0);
		expect(calculateGrandTotalEPWithCooking(snapshot, cookingSettings)).toBe(
			expected,
		);
	});

	it("re-applies different initial ingredients to the same snapshot", () => {
		const input = createInput(createCookingSettings({}));
		const snapshot = runHelpingSimulation(input);
		const stocks: CookingSimulationSettings["initialIngredients"][] = [
			{ apple: 90 },
			{ soy: 60, tomato: 60, mushroom: 30, coffee: 30 },
			{ sausage: 210, honey: 210 },
		];
		for (const stock of stocks) {
			const cookingSettings = createCookingSettings(stock);
			const expected = runSimulation({ ...input, cookingSettings }).teamSummary
				.grandTotalEP;
			expect(calculateGrandTotalEPWithCooking(snapshot, cookingSettings)).toBe(
				expected,
			);
		}
	});

	it("returns the cooking-disabled total when cooking is disabled", () => {
		const disabled = createCookingSettings({ apple: 60 }, false);
		const input = createInput(disabled);
		const snapshot = runHelpingSimulation(input);
		const expected = runSimulation(input).teamSummary.grandTotalEP;
		expect(calculateGrandTotalEPWithCooking(snapshot, disabled)).toBe(expected);
		expect(snapshot.grandTotalEPWithoutCooking).toBe(expected);
	});

	it("returns 0 for an empty simulation even if initial ingredients could cook", () => {
		const cookingSettings = createCookingSettings({ apple: 210 });
		const input = createInput(cookingSettings, {
			team: [null, null, null, null, null],
		});
		const snapshot = runHelpingSimulation(input);
		expect(snapshot.isEmpty).toBe(true);
		expect(calculateGrandTotalEPWithCooking(snapshot, cookingSettings)).toBe(0);
		expect(runSimulation(input).teamSummary.grandTotalEP).toBe(0);
	});
});

describe("日曜の最後の食事は就寝直前に料理する", () => {
	// DEFAULT_TIME_SLOTS: 07:00 朝食(起床) / 12:00 昼食 / 15:00 / 18:00 夕食 / 23:00 就寝
	const DINNER_SLOT_ID = "slot-4";
	const BEDTIME_SLOT_ID = "slot-5-end";

	/** 指定スロット（含む）までに回収した食材の合計（通常 + スキル） */
	function sumCollectedIngredientsUpTo(
		slotResults: Map<string, TimeSlotResult[]>,
		lastSlotId: string,
	): Map<IngredientName, number> {
		const totals = new Map<IngredientName, number>();
		for (const [slotId, results] of slotResults) {
			for (const result of results) {
				for (const ingredient of [
					...result.ingredients,
					...(result.skillIngredients ?? []),
				]) {
					totals.set(
						ingredient.name,
						(totals.get(ingredient.name) ?? 0) + ingredient.count,
					);
				}
			}
			if (slotId === lastSlotId) {
				break;
			}
		}
		return totals;
	}

	it("7日間の最終日（日曜）は夕食スロットではなく就寝スロットで料理する", () => {
		const input = createInput(createCookingSettings({ apple: 30 }));
		const events = runSimulation(input).cookingResult?.events ?? [];
		const mealSlotIds = events.map((event) => event.mealSlotId);

		for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
			expect(mealSlotIds).toContain(`${DINNER_SLOT_ID}__day${dayIndex}`);
			expect(mealSlotIds).not.toContain(`${BEDTIME_SLOT_ID}__day${dayIndex}`);
		}
		expect(mealSlotIds).not.toContain(`${DINNER_SLOT_ID}__day6`);
		const sundayDinner = events.find(
			(event) => event.mealSlotId === `${BEDTIME_SLOT_ID}__day6`,
		);
		expect(sundayDinner?.mealType).toBe("dinner");
		// 日曜ルール（鍋2倍）はそのまま適用される
		expect(sundayDinner?.effectivePotCapacity).toBe(
			createDefaultCookingSettings().basePotCapacity * 2,
		);
	});

	it("就寝時の回収（チェック）→料理の順なので、就寝時に回収した食材も鍋に入る", () => {
		// 1日だけ・日曜開始・初期食材なし: 夕食前のバッグ = 回収合計 − 朝食・昼食の使用分
		const input = createInput(createCookingSettings({}), {
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				seed: 777,
				simulationDays: 1,
				startDayOfWeek: SUNDAY,
			},
		});
		const result = runSimulation(input);
		const events = result.cookingResult?.events ?? [];
		const sundayDinnerIndex = events.findIndex(
			(event) => event.mealSlotId === `${BEDTIME_SLOT_ID}__day0`,
		);
		expect(sundayDinnerIndex).toBeGreaterThanOrEqual(0);

		const bedtimeResults = result.slotResults.get(`${BEDTIME_SLOT_ID}__day0`);
		const collectedAtBedtime = (bedtimeResults ?? []).reduce(
			(sum, r) => sum + r.ingredients.reduce((s, i) => s + i.count, 0),
			0,
		);
		expect(collectedAtBedtime).toBeGreaterThan(0);

		const expectedBag = sumCollectedIngredientsUpTo(
			result.slotResults,
			`${BEDTIME_SLOT_ID}__day0`,
		);
		for (const earlier of events.slice(0, sundayDinnerIndex)) {
			for (const usage of earlier.ingredientsUsed) {
				expectedBag.set(
					usage.name,
					(expectedBag.get(usage.name) ?? 0) - usage.count,
				);
			}
		}
		const actualBag = new Map(
			(
				events[sundayDinnerIndex].bagIngredientsBeforeCookingWithoutExtra ?? []
			).map((entry) => [entry.name, entry.count] as const),
		);
		for (const [name, expectedCount] of expectedBag) {
			expect(actualBag.get(name) ?? 0).toBeCloseTo(expectedCount, 6);
		}
	});

	it("食事によるげんき回復も就寝スロットへ移る", () => {
		const input = createInput(createCookingSettings({}), {
			config: {
				...DEFAULT_SIMULATION_CONFIG,
				seed: 777,
				simulationDays: 2,
				startDayOfWeek: SATURDAY,
			},
		});
		const { slotResults } = runSimulation(input);
		const mealRecoveryAt = (slotId: string): number[] =>
			(slotResults.get(slotId) ?? []).map((r) => r.mealRecovery);

		// 土曜: 夕食スロットで回復、就寝スロットでは回復しない
		expect(mealRecoveryAt(`${DINNER_SLOT_ID}__day0`).every((v) => v > 0)).toBe(
			true,
		);
		expect(
			mealRecoveryAt(`${BEDTIME_SLOT_ID}__day0`).every((v) => v === 0),
		).toBe(true);
		// 日曜: 就寝スロットで回復、夕食スロットでは回復しない
		expect(
			mealRecoveryAt(`${DINNER_SLOT_ID}__day1`).every((v) => v === 0),
		).toBe(true);
		expect(mealRecoveryAt(`${BEDTIME_SLOT_ID}__day1`).every((v) => v > 0)).toBe(
			true,
		);
	});

	it("初期食材の再計算（スナップショット）でも同じ日曜の料理位置になる", () => {
		const cookingSettings = createCookingSettings({ apple: 30 });
		const input = createInput(cookingSettings);
		const snapshot = runHelpingSimulation(input);
		const sundayBedtime = snapshot.expandedSlots.find(
			(slot) => slot.slot.id === `${BEDTIME_SLOT_ID}__day6`,
		);
		const sundayDinner = snapshot.expandedSlots.find(
			(slot) => slot.slot.id === `${DINNER_SLOT_ID}__day6`,
		);
		expect(sundayBedtime?.slot.hasMeal).toBe(true);
		expect(sundayDinner?.slot.hasMeal).toBe(false);
		expect(calculateGrandTotalEPWithCooking(snapshot, cookingSettings)).toBe(
			runSimulation(input).teamSummary.grandTotalEP,
		);
	});
});
