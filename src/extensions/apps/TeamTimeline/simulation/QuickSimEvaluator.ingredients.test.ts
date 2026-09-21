import { describe, expect, it, vi } from "vitest";
import { IngredientNames } from "../../../../data/pokemons";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	type CookingSimulationSettings,
	createDefaultCookingSettings,
} from "../types/CookingTypes";
import type { QuickSimOptimizerMember } from "../types/QuickSimOptimizerTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
} from "../types/TimeSlotTypes";
import {
	initialIngredientsToStock,
	stockToInitialIngredients,
} from "../utils/QuickSimIngredientCandidates";
import {
	buildStrengthParameterFromTimelineBonusSettings,
	createDefaultTimelineBonusSettings,
} from "../utils/TimelineBonusSettingsBridge";
import {
	QuickSimEvaluator,
	type QuickSimEvaluatorContext,
} from "./QuickSimEvaluator";
import * as TimelineSimulator from "./TimelineSimulator";

const NAMES = [
	"Pikachu",
	"Eevee",
	"Bulbasaur",
	"Charmander",
	"Squirtle",
	"Gengar",
];

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName, level: 30 }), "", id);
}

function createCookingSettings(
	overrides: Partial<CookingSimulationSettings> = {},
): CookingSimulationSettings {
	return {
		...createDefaultCookingSettings(),
		enabled: true,
		category: "curry",
		...overrides,
	};
}

function createContext(
	overrides: Partial<QuickSimEvaluatorContext> = {},
): QuickSimEvaluatorContext {
	const items = NAMES.map((name, index) => createItem(name, index + 1));
	const members: QuickSimOptimizerMember[] = items.map((item) => ({
		pokemonId: item.id,
		usageMode: "even",
	}));
	const bonusSettings = createDefaultTimelineBonusSettings();
	return {
		box: new PokemonBox(items),
		members,
		timeSlots: DEFAULT_TIME_SLOTS,
		simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, simulationDays: 2 },
		bonusSettings,
		cookingSettings: createCookingSettings(),
		strengthParameter:
			buildStrengthParameterFromTimelineBonusSettings(bonusSettings),
		...overrides,
	};
}

const PERCENTS = [100, 100, 100, 100, 60, 40];
const STOCK_A = initialIngredientsToStock({ apple: 90, milk: 60 });
const STOCK_B = initialIngredientsToStock({ soy: 60, tomato: 60, coffee: 30 });

describe("QuickSimEvaluator.evaluateIngredients", () => {
	it("matches a full runSimulation with the stock as initial ingredients", async () => {
		const context = createContext();
		const evaluator = new QuickSimEvaluator(context);
		const seeds = [11, 12];
		const results = await evaluator.evaluateIngredients(
			PERCENTS,
			[STOCK_A, STOCK_B],
			seeds,
			{ excludeSleepSwaps: false },
		);
		expect(results).toHaveLength(2);
		results.forEach((result, stockIndex) => {
			const stock = [STOCK_A, STOCK_B][stockIndex];
			expect(result.stock).toEqual(stock);
			expect(result.excluded).toBe(false);
			expect(result.epBySeed).toHaveLength(seeds.length);
			const prepared = evaluator.prepare(PERCENTS, false);
			if (!prepared) {
				throw new Error("prepare");
			}
			seeds.forEach((seed, seedIndex) => {
				const expected = TimelineSimulator.runSimulation({
					team: prepared.timeline.team,
					timeSlots: prepared.timeline.timeSlots,
					config: { ...context.simulationConfig, seed },
					bonusSettings: context.bonusSettings,
					swaps: prepared.timeline.swaps,
					noCollectCells: prepared.timeline.noCollectCells,
					box: context.box,
					cookingSettings: {
						...context.cookingSettings,
						initialIngredients: stockToInitialIngredients(stock),
					},
					strengthParameter: context.strengthParameter,
					analysisOptions: { perPokemonRandomStreams: true },
				}).teamSummary.grandTotalEP;
				expect(result.epBySeed[seedIndex]).toBe(expected);
			});
		});
		expect(results[0].epBySeed).not.toEqual(results[1].epBySeed);
	});

	it("agrees with evaluate() for the same percents, stock and seed", async () => {
		const stock = STOCK_A;
		const context = createContext({
			cookingSettings: createCookingSettings({
				initialIngredients: stockToInitialIngredients(stock),
			}),
		});
		const evaluator = new QuickSimEvaluator(context);
		const [usage] = await evaluator.evaluate([PERCENTS], [5, 6], {
			excludeSleepSwaps: false,
		});
		const [ingredients] = await evaluator.evaluateIngredients(
			PERCENTS,
			[stock],
			[5, 6],
			{ excludeSleepSwaps: false },
		);
		expect(ingredients.epBySeed).toEqual(usage.epBySeed);
	});

	it("runs the helping simulation once per seed and shares it across stocks and calls", async () => {
		const spy = vi.spyOn(TimelineSimulator, "runHelpingSimulation");
		try {
			const evaluator = new QuickSimEvaluator(createContext());
			await evaluator.evaluateIngredients(
				PERCENTS,
				[STOCK_A, STOCK_B],
				[1, 2, 3],
				{ excludeSleepSwaps: false },
			);
			expect(spy).toHaveBeenCalledTimes(3);
			const again = evaluator.evaluateIngredientsSync(
				PERCENTS,
				[STOCK_B],
				[2, 3, 4],
				{ excludeSleepSwaps: false },
			);
			expect(spy).toHaveBeenCalledTimes(4);
			expect(again[0].epBySeed).toHaveLength(3);
			// 期間全体のスケジュールは別のキャッシュキー
			await evaluator.evaluateIngredients(PERCENTS, [STOCK_A], [1], {
				excludeSleepSwaps: false,
				usePeriodSchedule: true,
			});
			expect(spy).toHaveBeenCalledTimes(5);
		} finally {
			spy.mockRestore();
		}
	});

	it("marks every stock as excluded when the percents cannot be scheduled", async () => {
		const evaluator = new QuickSimEvaluator(createContext());
		const results = await evaluator.evaluateIngredients(
			[0, 0, 0, 0, 0, 0],
			[STOCK_A, STOCK_B],
			[1],
			{ excludeSleepSwaps: false },
		);
		expect(results.map((result) => result.excluded)).toEqual([true, true]);
		expect(results.map((result) => result.epBySeed)).toEqual([[], []]);
	});

	it("reports progress per seed and returns stocks of full length", () => {
		const evaluator = new QuickSimEvaluator(createContext());
		const progress: [number, number][] = [];
		const results = evaluator.evaluateIngredientsSync(
			PERCENTS,
			[STOCK_A],
			[1, 2],
			{ excludeSleepSwaps: false },
			(completed, total) => {
				progress.push([completed, total]);
			},
		);
		expect(progress).toEqual([
			[1, 2],
			[2, 2],
		]);
		expect(results[0].stock).toHaveLength(IngredientNames.length);
	});
});
