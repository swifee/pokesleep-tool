/**
 * QuickSimEvaluator.ts
 * 起用率最適化の候補（メンバー順の起用率）をシミュレーションして EP を返す評価器。
 *
 * - 候補ごとにスケジュールとタイムラインを 1 度だけ作り、全試行で使い回す。
 * - 前半・後半のメンバーがいなければ 1 日分のスケジュールを全日に繰り返す
 *   （誰がいつ編成に入るかは集計期間分のスケジュールと同じで、生成は 1 桁速い。
 *   日をまたぐ枠の付け替えだけが変わり得るので、最終確認では
 *   usePeriodSchedule で通常の実行と同じスケジュールを使う）。
 * - ポケモンごとに固定した乱数列（perPokemonRandomStreams）を使い、候補どうしを
 *   同じシードで比べられるようにする（共通乱数）。
 * - とくべつなポケモンのルール（同時に 1 体まで。ラティアス＋ラティオスは可）は
 *   スケジューラに同時に編成できない組として渡し、どの候補でも守る。
 * - 初期食材の評価（evaluateIngredients）では、起用率とシードごとのおてつだい結果を
 *   キャッシュし、食材の配分ごとに料理だけを再計算する。
 */

import type PokemonBox from "../../../../util/PokemonBox";
import type { StrengthParameter } from "../../../../util/PokemonStrength";
import type { CookingSimulationSettings } from "../types/CookingTypes";
import type {
	QuickSimCandidateEvaluation,
	QuickSimIngredientEvaluation,
	QuickSimIngredientEvaluator,
	QuickSimIngredientStock,
	QuickSimOptimizerEvaluateOptions,
	QuickSimOptimizerEvaluator,
	QuickSimOptimizerMember,
	QuickSimOptimizerPercents,
} from "../types/QuickSimOptimizerTypes";
import type {
	QuickSimExclusionMap,
	QuickSimMember,
} from "../types/QuickSimTypes";
import type { TimelineBonusSettings } from "../types/TimelineBonusSettingsTypes";
import {
	clampSimulationDays,
	type SimulationConfig,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { stockToInitialIngredients } from "../utils/QuickSimIngredientCandidates";
import { percentsKey } from "../utils/QuickSimOptimizerCandidates";
import { buildQuickSimSchedule } from "../utils/QuickSimScheduler";
import {
	buildQuickSimTimeline,
	type QuickSimTimeline,
} from "../utils/QuickSimTimelineBuilder";
import { buildSpecialPokemonExclusionMap } from "../utils/SpecialPokemonUtils";
import {
	calculateGrandTotalEPWithCooking,
	type HelpingSimulationSnapshot,
	runHelpingSimulation,
	runSimulation,
	type SimulationInput,
} from "./TimelineSimulator";

export interface QuickSimEvaluatorContext {
	/** メンバーのポケモンを含むボックス */
	box: PokemonBox;
	members: readonly QuickSimOptimizerMember[];
	timeSlots: readonly TimeSlot[];
	/** seed は候補の評価時に上書きする */
	simulationConfig: SimulationConfig;
	bonusSettings: TimelineBonusSettings;
	cookingSettings: CookingSimulationSettings;
	/**
	 * ボーナス設定から構築済みの StrengthParameter。
	 * Web Worker では localStorage を読めないので、メインスレッドで作って渡す。
	 */
	strengthParameter: StrengthParameter;
}

/** 候補のシミュレーション入力（試行間で共有） */
interface PreparedCandidate {
	/** タイムラインのキャッシュキー（スケジュール日数 + 起用率） */
	key: string;
	timeline: QuickSimTimeline;
	usesSleepSwaps: boolean;
	unmetPokemonIds: number[];
	swapsPerDay: number;
}

/** 候補ごとのタイムラインのキャッシュ上限（超えたら古いものから捨てる） */
const TIMELINE_CACHE_LIMIT = 4000;
/**
 * おてつだい結果（起用率 × シード）のキャッシュ上限。
 * 7 日分の結果は数百 KB あるので、タイムラインより小さくする。
 */
const HELPING_CACHE_LIMIT = 64;
/** メインスレッドで評価するとき、描画のために処理を譲る間隔 */
const YIELD_INTERVAL_MS = 50;
/** 期間全体の配置が必要な起用方法 */
const PERIOD_USAGE_MODES = new Set(["firstHalf", "secondHalf"]);

function waitNextTick(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

function roundToSingleDecimal(value: number): number {
	return Math.round(value * 10) / 10;
}

/** 上限を超えたら最も古いエントリを捨てるキャッシュへの追加 */
function setWithLimit<T>(
	cache: Map<string, T>,
	key: string,
	value: T,
	limit: number,
): void {
	if (cache.size >= limit) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) {
			cache.delete(oldestKey);
		}
	}
	cache.set(key, value);
}

export class QuickSimEvaluator
	implements QuickSimOptimizerEvaluator, QuickSimIngredientEvaluator
{
	private readonly timelineCache = new Map<string, PreparedCandidate | null>();
	private readonly helpingCache = new Map<string, HelpingSimulationSnapshot>();
	private readonly simulationDays: number;
	/** 1 日分のスケジュールを繰り返せるか（前半・後半のメンバーがいない） */
	private readonly canRepeatDaySchedule: boolean;
	private readonly cookingDisabledSettings: CookingSimulationSettings;
	/** 同時に編成できないメンバーの組（とくべつなポケモンのルール） */
	private readonly exclusions: QuickSimExclusionMap;

	constructor(private readonly context: QuickSimEvaluatorContext) {
		this.simulationDays = clampSimulationDays(
			context.simulationConfig.simulationDays,
		);
		this.exclusions = buildSpecialPokemonExclusionMap(
			context.members.flatMap((member) => {
				const item = context.box.getById(member.pokemonId);
				return item ? [item] : [];
			}),
		);
		this.canRepeatDaySchedule = !context.members.some((member) =>
			PERIOD_USAGE_MODES.has(member.usageMode),
		);
		this.cookingDisabledSettings = {
			...context.cookingSettings,
			enabled: false,
		};
	}

	private toQuickSimMembers(
		percents: QuickSimOptimizerPercents,
	): QuickSimMember[] {
		return this.context.members.flatMap((member, index) => {
			const usagePercent = percents[index] ?? 0;
			if (usagePercent <= 0) {
				return [];
			}
			return [
				{
					pokemonId: member.pokemonId,
					usagePercent,
					usageMode: member.usageMode,
				},
			];
		});
	}

	/** 候補のスケジュールとタイムラインを作る（作れないときは null） */
	prepare(
		percents: QuickSimOptimizerPercents,
		usePeriodSchedule: boolean,
	): PreparedCandidate | null {
		const scheduleDays =
			this.canRepeatDaySchedule && !usePeriodSchedule ? 1 : this.simulationDays;
		const key = `${scheduleDays}:${percentsKey(percents)}`;
		const cached = this.timelineCache.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const scheduleResult = buildQuickSimSchedule(
			this.toQuickSimMembers(percents),
			this.context.timeSlots,
			scheduleDays,
			this.exclusions,
		);
		let prepared: PreparedCandidate | null = null;
		if (scheduleResult.ok) {
			const timeline = buildQuickSimTimeline(
				scheduleResult.schedule,
				this.context.timeSlots,
				this.simulationDays,
				this.context.box,
			);
			prepared = {
				key,
				timeline,
				usesSleepSwaps: scheduleResult.schedule.usesSleepSwaps,
				unmetPokemonIds: [...scheduleResult.schedule.unmetPokemonIds],
				swapsPerDay: roundToSingleDecimal(
					timeline.swaps.length / this.simulationDays,
				),
			};
		}
		setWithLimit(this.timelineCache, key, prepared, TIMELINE_CACHE_LIMIT);
		return prepared;
	}

	private buildSimulationInput(
		prepared: PreparedCandidate,
		seed: number,
		cookingSettings: CookingSimulationSettings,
	): SimulationInput {
		const { timeline } = prepared;
		return {
			team: timeline.team,
			timeSlots: timeline.timeSlots,
			config: { ...this.context.simulationConfig, seed },
			bonusSettings: this.context.bonusSettings,
			swaps: timeline.swaps,
			noCollectCells: timeline.noCollectCells,
			box: this.context.box,
			cookingSettings,
			strengthParameter: this.context.strengthParameter,
			analysisOptions: { perPokemonRandomStreams: true },
		};
	}

	private runTrial(
		prepared: PreparedCandidate,
		seed: number,
		disableCooking: boolean,
	): number {
		return runSimulation(
			this.buildSimulationInput(
				prepared,
				seed,
				disableCooking
					? this.cookingDisabledSettings
					: this.context.cookingSettings,
			),
		).teamSummary.grandTotalEP;
	}

	/** 起用率とシードごとのおてつだい結果（料理なし）。キャッシュして配分間で共有する */
	private getHelpingSnapshot(
		prepared: PreparedCandidate,
		seed: number,
	): HelpingSimulationSnapshot {
		const key = `${prepared.key}:${seed}`;
		const cached = this.helpingCache.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const snapshot = runHelpingSimulation(
			this.buildSimulationInput(prepared, seed, this.context.cookingSettings),
		);
		setWithLimit(this.helpingCache, key, snapshot, HELPING_CACHE_LIMIT);
		return snapshot;
	}

	private toCookingSettings(
		stock: QuickSimIngredientStock,
	): CookingSimulationSettings {
		return {
			...this.context.cookingSettings,
			initialIngredients: stockToInitialIngredients(stock),
		};
	}

	/** 1 候補を評価する */
	evaluateOne(
		percents: QuickSimOptimizerPercents,
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
	): QuickSimCandidateEvaluation {
		const prepared = this.prepare(percents, options.usePeriodSchedule === true);
		if (prepared === null) {
			return {
				percents: [...percents],
				epBySeed: [],
				excluded: true,
				usesSleepSwaps: false,
				unmetPokemonIds: [],
				swapsPerDay: 0,
			};
		}
		const excluded = options.excludeSleepSwaps && prepared.usesSleepSwaps;
		return {
			percents: [...percents],
			epBySeed: excluded
				? []
				: seeds.map((seed) =>
						this.runTrial(prepared, seed, options.disableCooking === true),
					),
			excluded,
			usesSleepSwaps: prepared.usesSleepSwaps,
			unmetPokemonIds: [...prepared.unmetPokemonIds],
			swapsPerDay: prepared.swapsPerDay,
		};
	}

	/** 同期的に全候補を評価する（ワーカー内で使う） */
	evaluateSync(
		candidates: readonly QuickSimOptimizerPercents[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): QuickSimCandidateEvaluation[] {
		const results: QuickSimCandidateEvaluation[] = [];
		for (const candidate of candidates) {
			results.push(this.evaluateOne(candidate, seeds, options));
			onProgress?.(results.length, candidates.length);
		}
		return results;
	}

	/** メインスレッド向け: 描画を止めないよう、定期的に処理を譲りながら評価する */
	async evaluate(
		candidates: readonly QuickSimOptimizerPercents[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): Promise<QuickSimCandidateEvaluation[]> {
		const results: QuickSimCandidateEvaluation[] = [];
		let lastYieldAt = Date.now();
		for (const candidate of candidates) {
			results.push(this.evaluateOne(candidate, seeds, options));
			onProgress?.(results.length, candidates.length);
			if (Date.now() - lastYieldAt >= YIELD_INTERVAL_MS) {
				await waitNextTick();
				lastYieldAt = Date.now();
			}
		}
		return results;
	}

	/**
	 * 初期食材の評価の準備。起用率のスケジュールを作れない、または就寝中の入れ替えが
	 * 必要で除外するときは、全配分を除外扱いにした結果だけを返す。
	 */
	private prepareIngredientEvaluation(
		percents: QuickSimOptimizerPercents,
		stocks: readonly QuickSimIngredientStock[],
		options: QuickSimOptimizerEvaluateOptions,
	): {
		prepared: PreparedCandidate | null;
		results: QuickSimIngredientEvaluation[];
		cookingSettingsByStock: CookingSimulationSettings[];
	} {
		const prepared = this.prepare(percents, options.usePeriodSchedule === true);
		const excluded =
			prepared === null ||
			(options.excludeSleepSwaps && prepared.usesSleepSwaps);
		return {
			prepared: excluded ? null : prepared,
			results: stocks.map((stock) => ({
				stock: [...stock],
				epBySeed: [],
				excluded,
			})),
			cookingSettingsByStock: excluded
				? []
				: stocks.map((stock) => this.toCookingSettings(stock)),
		};
	}

	/** 1 シードのおてつだい結果を全配分で共有し、料理だけを再計算して EP を追加する */
	private evaluateIngredientSeed(
		prepared: PreparedCandidate,
		seed: number,
		cookingSettingsByStock: readonly CookingSimulationSettings[],
		results: QuickSimIngredientEvaluation[],
	): void {
		const snapshot = this.getHelpingSnapshot(prepared, seed);
		cookingSettingsByStock.forEach((cookingSettings, stockIndex) => {
			results[stockIndex].epBySeed.push(
				calculateGrandTotalEPWithCooking(snapshot, cookingSettings),
			);
		});
	}

	/**
	 * 同期的に初期食材の配分を評価する（ワーカー内で使う）。
	 * シードを外側のループにし、進捗は評価し終えたシード数で知らせる。
	 */
	evaluateIngredientsSync(
		percents: QuickSimOptimizerPercents,
		stocks: readonly QuickSimIngredientStock[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): QuickSimIngredientEvaluation[] {
		const { prepared, results, cookingSettingsByStock } =
			this.prepareIngredientEvaluation(percents, stocks, options);
		if (prepared === null) {
			onProgress?.(seeds.length, seeds.length);
			return results;
		}
		seeds.forEach((seed, seedIndex) => {
			this.evaluateIngredientSeed(
				prepared,
				seed,
				cookingSettingsByStock,
				results,
			);
			onProgress?.(seedIndex + 1, seeds.length);
		});
		return results;
	}

	/** メインスレッド向け: 描画を止めないよう、定期的に処理を譲りながら評価する */
	async evaluateIngredients(
		percents: QuickSimOptimizerPercents,
		stocks: readonly QuickSimIngredientStock[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): Promise<QuickSimIngredientEvaluation[]> {
		const { prepared, results, cookingSettingsByStock } =
			this.prepareIngredientEvaluation(percents, stocks, options);
		if (prepared === null) {
			onProgress?.(seeds.length, seeds.length);
			return results;
		}
		let lastYieldAt = Date.now();
		for (let seedIndex = 0; seedIndex < seeds.length; seedIndex++) {
			this.evaluateIngredientSeed(
				prepared,
				seeds[seedIndex],
				cookingSettingsByStock,
				results,
			);
			onProgress?.(seedIndex + 1, seeds.length);
			if (Date.now() - lastYieldAt >= YIELD_INTERVAL_MS) {
				await waitNextTick();
				lastYieldAt = Date.now();
			}
		}
		return results;
	}
}
