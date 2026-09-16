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
 */

import type PokemonBox from "../../../../util/PokemonBox";
import type { StrengthParameter } from "../../../../util/PokemonStrength";
import type { CookingSimulationSettings } from "../types/CookingTypes";
import type { ProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import type {
	QuickSimCandidateEvaluation,
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
import { percentsKey } from "../utils/QuickSimOptimizerCandidates";
import { buildQuickSimSchedule } from "../utils/QuickSimScheduler";
import {
	buildQuickSimTimeline,
	type QuickSimTimeline,
} from "../utils/QuickSimTimelineBuilder";
import { buildSpecialPokemonExclusionMap } from "../utils/SpecialPokemonUtils";
import { runSimulation } from "./TimelineSimulator";

export interface QuickSimEvaluatorContext {
	/** メンバーのポケモンを含むボックス */
	box: PokemonBox;
	members: readonly QuickSimOptimizerMember[];
	timeSlots: readonly TimeSlot[];
	/** seed は候補の評価時に上書きする */
	simulationConfig: SimulationConfig;
	bonusSettings: TimelineBonusSettings;
	cookingSettings: CookingSimulationSettings;
	provisionalSettings: ProvisionalSettings;
	/**
	 * ボーナス設定から構築済みの StrengthParameter。
	 * Web Worker では localStorage を読めないので、メインスレッドで作って渡す。
	 */
	strengthParameter: StrengthParameter;
}

/** 候補のシミュレーション入力（試行間で共有） */
interface PreparedCandidate {
	timeline: QuickSimTimeline;
	usesSleepSwaps: boolean;
	unmetPokemonIds: number[];
	swapsPerDay: number;
}

/** 候補ごとのタイムラインのキャッシュ上限（超えたら古いものから捨てる） */
const TIMELINE_CACHE_LIMIT = 4000;
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

export class QuickSimEvaluator implements QuickSimOptimizerEvaluator {
	private readonly timelineCache = new Map<string, PreparedCandidate | null>();
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
				timeline,
				usesSleepSwaps: scheduleResult.schedule.usesSleepSwaps,
				unmetPokemonIds: [...scheduleResult.schedule.unmetPokemonIds],
				swapsPerDay: roundToSingleDecimal(
					timeline.swaps.length / this.simulationDays,
				),
			};
		}
		if (this.timelineCache.size >= TIMELINE_CACHE_LIMIT) {
			const oldestKey = this.timelineCache.keys().next().value;
			if (oldestKey !== undefined) {
				this.timelineCache.delete(oldestKey);
			}
		}
		this.timelineCache.set(key, prepared);
		return prepared;
	}

	private runTrial(
		prepared: PreparedCandidate,
		seed: number,
		disableCooking: boolean,
	): number {
		const { timeline } = prepared;
		return runSimulation({
			team: timeline.team,
			timeSlots: timeline.timeSlots,
			config: { ...this.context.simulationConfig, seed },
			bonusSettings: this.context.bonusSettings,
			swaps: timeline.swaps,
			noCollectCells: timeline.noCollectCells,
			box: this.context.box,
			cookingSettings: disableCooking
				? this.cookingDisabledSettings
				: this.context.cookingSettings,
			provisionalSettings: this.context.provisionalSettings,
			strengthParameter: this.context.strengthParameter,
			analysisOptions: { perPokemonRandomStreams: true },
		}).teamSummary.grandTotalEP;
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
}
