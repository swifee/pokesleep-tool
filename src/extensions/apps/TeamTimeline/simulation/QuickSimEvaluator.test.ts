import { describe, expect, it } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import { createDefaultProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import type { QuickSimOptimizerMember } from "../types/QuickSimOptimizerTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
} from "../types/TimeSlotTypes";
import { buildQuickSimSchedule } from "../utils/QuickSimScheduler";
import { buildQuickSimTimeline } from "../utils/QuickSimTimelineBuilder";
import {
	buildStrengthParameterFromTimelineBonusSettings,
	createDefaultTimelineBonusSettings,
} from "../utils/TimelineBonusSettingsBridge";
import {
	QuickSimEvaluator,
	type QuickSimEvaluatorContext,
} from "./QuickSimEvaluator";
import { runSimulation } from "./TimelineSimulator";

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName, level: 30 }), "", id);
}

const NAMES = [
	"Pikachu",
	"Eevee",
	"Bulbasaur",
	"Charmander",
	"Squirtle",
	"Gengar",
];

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
		simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, simulationDays: 1 },
		bonusSettings,
		cookingSettings: createDefaultCookingSettings(),
		provisionalSettings: createDefaultProvisionalSettings(),
		strengthParameter:
			buildStrengthParameterFromTimelineBonusSettings(bonusSettings),
		...overrides,
	};
}

describe("QuickSimEvaluator", () => {
	it("returns one EP per seed and is reproducible for the same seed", async () => {
		const evaluator = new QuickSimEvaluator(createContext());
		const candidate = [100, 100, 100, 100, 60, 40];
		const [first] = await evaluator.evaluate([candidate], [1, 2, 3], {
			excludeSleepSwaps: true,
		});
		expect(first.percents).toEqual(candidate);
		expect(first.epBySeed).toHaveLength(3);
		expect(first.excluded).toBe(false);
		expect(first.usesSleepSwaps).toBe(false);
		expect(first.unmetPokemonIds).toEqual([]);
		expect(first.swapsPerDay).toBeGreaterThan(0);
		for (const ep of first.epBySeed) {
			expect(ep).toBeGreaterThan(0);
		}

		const [again] = await evaluator.evaluate([candidate], [2], {
			excludeSleepSwaps: true,
		});
		expect(again.epBySeed).toEqual([first.epBySeed[1]]);
	});

	it("skips simulation for candidates that need sleep swaps when excluded", async () => {
		const evaluator = new QuickSimEvaluator(createContext());
		const candidates = [
			[100, 100, 100, 100, 100, 0],
			[100, 100, 100, 100, 60, 40],
		];
		const results = await evaluator.evaluate(candidates, [1], {
			excludeSleepSwaps: true,
		});
		expect(results).toHaveLength(2);
		const scheduled = candidates.map((percents) =>
			buildQuickSimSchedule(
				percents.flatMap((usagePercent, index) =>
					usagePercent > 0
						? [
								{
									pokemonId: index + 1,
									usagePercent,
									usageMode: "even" as const,
								},
							]
						: [],
				),
				DEFAULT_TIME_SLOTS,
				1,
			),
		);
		results.forEach((result, index) => {
			const schedule = scheduled[index];
			if (!schedule.ok) {
				throw new Error("schedule failed");
			}
			expect(result.usesSleepSwaps).toBe(schedule.schedule.usesSleepSwaps);
			expect(result.excluded).toBe(schedule.schedule.usesSleepSwaps);
			expect(result.epBySeed).toHaveLength(
				schedule.schedule.usesSleepSwaps ? 0 : 1,
			);
		});
	});

	it("marks candidates whose schedule cannot be built as excluded", async () => {
		const evaluator = new QuickSimEvaluator(createContext());
		const [empty, exceeded] = await evaluator.evaluate(
			[
				[0, 0, 0, 0, 0, 0],
				[100, 100, 100, 100, 100, 100],
			],
			[1],
			{ excludeSleepSwaps: false },
		);
		expect(empty.excluded).toBe(true);
		expect(exceeded.excluded).toBe(true);
	});

	it("disables cooking when requested", async () => {
		const context = createContext({
			cookingSettings: { ...createDefaultCookingSettings(), enabled: true },
		});
		const evaluator = new QuickSimEvaluator(context);
		const candidate = [100, 100, 100, 100, 100, 0];
		const [withCooking] = await evaluator.evaluate([candidate], [5], {
			excludeSleepSwaps: false,
		});
		const [withoutCooking] = await evaluator.evaluate([candidate], [5], {
			excludeSleepSwaps: false,
			disableCooking: true,
		});
		const timeline = buildQuickSimTimeline(
			(() => {
				const schedule = buildQuickSimSchedule(
					candidate.flatMap((usagePercent, index) =>
						usagePercent > 0
							? [
									{
										pokemonId: index + 1,
										usagePercent,
										usageMode: "even" as const,
									},
								]
							: [],
					),
					DEFAULT_TIME_SLOTS,
					1,
				);
				if (!schedule.ok) {
					throw new Error("schedule failed");
				}
				return schedule.schedule;
			})(),
			DEFAULT_TIME_SLOTS,
			1,
			context.box,
		);
		const expectedWithoutCooking = runSimulation({
			team: timeline.team,
			timeSlots: timeline.timeSlots,
			config: { ...context.simulationConfig, seed: 5 },
			bonusSettings: context.bonusSettings,
			swaps: timeline.swaps,
			noCollectCells: timeline.noCollectCells,
			box: context.box,
			cookingSettings: createDefaultCookingSettings(),
			provisionalSettings: context.provisionalSettings,
			strengthParameter: context.strengthParameter,
			analysisOptions: { perPokemonRandomStreams: true },
		}).teamSummary.grandTotalEP;
		expect(withoutCooking.epBySeed[0]).toBe(expectedWithoutCooking);
		expect(withCooking.epBySeed[0]).not.toBe(expectedWithoutCooking);
	});

	it("repeats a one-day schedule by default and uses the period schedule on request", async () => {
		const days = 3;
		const context = createContext({
			simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, simulationDays: days },
		});
		const evaluator = new QuickSimEvaluator(context);
		const candidate = [100, 100, 100, 80, 60, 60];
		const members = candidate.map((usagePercent, index) => ({
			pokemonId: index + 1,
			usagePercent,
			usageMode: "even" as const,
		}));
		const simulate = (scheduleDays: number): number => {
			const schedule = buildQuickSimSchedule(
				members,
				DEFAULT_TIME_SLOTS,
				scheduleDays,
			);
			if (!schedule.ok) {
				throw new Error("schedule failed");
			}
			const timeline = buildQuickSimTimeline(
				schedule.schedule,
				DEFAULT_TIME_SLOTS,
				days,
				context.box,
			);
			return runSimulation({
				team: timeline.team,
				timeSlots: timeline.timeSlots,
				config: { ...context.simulationConfig, seed: 11 },
				bonusSettings: context.bonusSettings,
				swaps: timeline.swaps,
				noCollectCells: timeline.noCollectCells,
				box: context.box,
				cookingSettings: context.cookingSettings,
				provisionalSettings: context.provisionalSettings,
				strengthParameter: context.strengthParameter,
				analysisOptions: { perPokemonRandomStreams: true },
			}).teamSummary.grandTotalEP;
		};

		const [repeated] = await evaluator.evaluate([candidate], [11], {
			excludeSleepSwaps: false,
		});
		expect(repeated.epBySeed[0]).toBe(simulate(1));

		const [period] = await evaluator.evaluate([candidate], [11], {
			excludeSleepSwaps: false,
			usePeriodSchedule: true,
		});
		expect(period.epBySeed[0]).toBe(simulate(days));
		// 日をまたぐ枠の付け替えが違うだけなので、差はわずか
		expect(Math.abs(period.epBySeed[0] - repeated.epBySeed[0])).toBeLessThan(
			period.epBySeed[0] * 0.01,
		);
	});

	it("always uses the period schedule when a member has a period usage mode", async () => {
		const days = 3;
		const base = createContext({
			simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, simulationDays: days },
		});
		const context: QuickSimEvaluatorContext = {
			...base,
			members: base.members.map((member, index) =>
				index === 5 ? { ...member, usageMode: "firstHalf" } : member,
			),
		};
		const evaluator = new QuickSimEvaluator(context);
		const candidate = [100, 100, 100, 100, 40, 60];
		const [repeated] = await evaluator.evaluate([candidate], [3], {
			excludeSleepSwaps: false,
		});
		const [period] = await evaluator.evaluate([candidate], [3], {
			excludeSleepSwaps: false,
			usePeriodSchedule: true,
		});
		expect(repeated.epBySeed).toEqual(period.epBySeed);
		expect(repeated.swapsPerDay).toBe(period.swapsPerDay);
	});

	it("reports progress per candidate", async () => {
		const evaluator = new QuickSimEvaluator(createContext());
		const progress: [number, number][] = [];
		await evaluator.evaluate(
			[
				[100, 100, 100, 100, 100, 0],
				[100, 100, 100, 100, 0, 100],
			],
			[1],
			{ excludeSleepSwaps: false },
			(completed, total) => progress.push([completed, total]),
		);
		expect(progress).toEqual([
			[1, 2],
			[2, 2],
		]);
	});
});
