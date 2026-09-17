import type { IngredientName } from "../../../../data/pokemons";
import {
	QUICK_SIM_MAX_USAGE_PERCENT,
	QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
	type QuickSimUsageMode,
} from "./QuickSimTypes";

/**
 * 簡易シミュの起用率最適化。
 * メンバーの起用方法は固定し、起用率（20% 刻み・合計 500%）の組み合わせから
 * 平均 EP が高いものを探す。
 */

/** 最適化で試す起用率の刻み（%） */
export const QUICK_SIM_OPTIMIZER_STEP_PERCENT = 20;
/** 1 匹あたりの起用率の最大単位数（100% ÷ 刻み） */
export const QUICK_SIM_OPTIMIZER_MAX_UNITS =
	QUICK_SIM_MAX_USAGE_PERCENT / QUICK_SIM_OPTIMIZER_STEP_PERCENT;
/** 全枠を埋める単位数（500% ÷ 刻み）。空き枠は EP を生まないので合計はここに固定する */
export const QUICK_SIM_OPTIMIZER_TOTAL_UNITS =
	QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT / QUICK_SIM_OPTIMIZER_STEP_PERCENT;
/** 最適化できるメンバー数の下限（5 匹以下は全員 100% で自明） */
export const QUICK_SIM_OPTIMIZER_MIN_MEMBERS = 6;
/** 最適化できるメンバー数の上限 */
export const QUICK_SIM_OPTIMIZER_MAX_MEMBERS = 12;

/** 単体 EP 表（絞り込み用）の試行数 */
export const QUICK_SIM_OPTIMIZER_SOLO_TRIALS = 16;
/** 単体 EP 表の代理スコアで実シミュに回す候補数 */
export const QUICK_SIM_OPTIMIZER_SCREENING_LIMIT = 2000;
/** 逐次半減（racing）の各段階の累積試行数 */
export const QUICK_SIM_OPTIMIZER_RACING_TRIALS: readonly number[] = [
	2, 8, 32, 100,
];
/** racing で次の段階に残す割合 */
export const QUICK_SIM_OPTIMIZER_RACING_KEEP_RATIO = 0.25;
/** racing で次の段階に残す最低数 */
export const QUICK_SIM_OPTIMIZER_RACING_MIN_KEEP = 20;
/** 局所探索で近傍を評価する試行数 */
export const QUICK_SIM_OPTIMIZER_NEIGHBOR_TRIALS = 32;
/** 探索中の判断に使う試行数（局所探索の確認・最終候補の選抜） */
export const QUICK_SIM_OPTIMIZER_SEARCH_TRIALS = 100;
/** 局所探索で確認試行に回す改善候補の数 */
export const QUICK_SIM_OPTIMIZER_CONFIRM_CANDIDATES = 3;
/** 局所探索の最大反復回数 */
export const QUICK_SIM_OPTIMIZER_MAX_LOCAL_SEARCH_ITERATIONS = 8;
/** 最終結果として表示する件数 */
export const QUICK_SIM_OPTIMIZER_RESULT_COUNT = 10;
/** 最終結果の試行数 */
export const QUICK_SIM_OPTIMIZER_FINAL_TRIALS = 1000;

/**
 * 最適化の対象。
 * - usage: 起用率だけを探索する（初期食材は設定のまま）
 * - ingredients: 起用率は現在の設定のまま、初期食材の配分だけを探索する
 * - both: 起用率を探索し、上位候補ごとに初期食材も探索して組み合わせを比べる
 */
export type QuickSimOptimizerTarget = "usage" | "ingredients" | "both";
export const QUICK_SIM_OPTIMIZER_TARGETS: readonly QuickSimOptimizerTarget[] = [
	"usage",
	"ingredients",
	"both",
];
export const DEFAULT_QUICK_SIM_OPTIMIZER_TARGET: QuickSimOptimizerTarget =
	"usage";

export function isQuickSimOptimizerTarget(
	value: unknown,
): value is QuickSimOptimizerTarget {
	return QUICK_SIM_OPTIMIZER_TARGETS.includes(value as QuickSimOptimizerTarget);
}

export function optimizerTargetIncludesUsage(
	target: QuickSimOptimizerTarget,
): boolean {
	return target === "usage" || target === "both";
}

export function optimizerTargetIncludesIngredients(
	target: QuickSimOptimizerTarget,
): boolean {
	return target === "ingredients" || target === "both";
}

/** 初期食材の探索の刻み（個）。1 単位 = この個数 */
export const QUICK_SIM_INGREDIENT_STEP_COUNT = 30;
/** 初期食材の合計（上限）の既定値 */
export const DEFAULT_QUICK_SIM_INGREDIENT_TOTAL_COUNT = 800;
/** 食材ごとの上限の既定値。0 の食材は探索しない */
export const DEFAULT_QUICK_SIM_INGREDIENT_MAX_COUNT = 0;
/** 合計・上限として受け付ける最大値 */
export const QUICK_SIM_INGREDIENT_COUNT_LIMIT = 9999;
/** 初期食材の開始点を比べる racing の累積試行数 */
export const QUICK_SIM_INGREDIENT_START_TRIALS: readonly number[] = [8, 32];
/** 開始点の racing で次の段階に残す割合と最低数 */
export const QUICK_SIM_INGREDIENT_START_KEEP_RATIO = 0.25;
export const QUICK_SIM_INGREDIENT_START_MIN_KEEP = 5;
/** 局所探索を始める開始点の数 */
export const QUICK_SIM_INGREDIENT_LOCAL_SEARCH_STARTS = 3;
/** 初期食材の近傍を 1 段目で評価する試行数 */
export const QUICK_SIM_INGREDIENT_NEIGHBOR_TRIALS = 8;
/** 初期食材の近傍のうち上位を 2 段目で評価する試行数 */
export const QUICK_SIM_INGREDIENT_NEIGHBOR_CONFIRM_TRIALS = 32;
/** 2 段目に残す割合と最低数 */
export const QUICK_SIM_INGREDIENT_NEIGHBOR_KEEP_RATIO = 0.25;
export const QUICK_SIM_INGREDIENT_NEIGHBOR_MIN_KEEP = 5;
/** 両方を最適化するとき、初期食材を探索する起用率候補の数 */
export const QUICK_SIM_OPTIMIZER_JOINT_USAGE_CANDIDATES = 5;

/** 初期食材の探索設定（パネルで保存する） */
export interface QuickSimIngredientSearchSettings {
	/** 配分する合計の上限（個）。刻みの倍数に切り捨てて使う */
	totalCount: number;
	/** 食材ごとの上限（個）。未設定・0 の食材は探索しない */
	maxCountByIngredient: Readonly<Partial<Record<IngredientName, number>>>;
}

export function createDefaultQuickSimIngredientSearchSettings(): QuickSimIngredientSearchSettings {
	return {
		totalCount: DEFAULT_QUICK_SIM_INGREDIENT_TOTAL_COUNT,
		maxCountByIngredient: {},
	};
}

/** 最適化のオプション */
export interface QuickSimOptimizerOptions {
	/** 就寝中の入れ替えが必要になる候補を除外する */
	excludeSleepSwaps: boolean;
}

export const DEFAULT_QUICK_SIM_OPTIMIZER_OPTIONS: QuickSimOptimizerOptions = {
	excludeSleepSwaps: true,
};

/** 最適化対象のメンバー。配列の順序が候補（起用率の並び）の順序になる */
export interface QuickSimOptimizerMember {
	pokemonId: number;
	usageMode: QuickSimUsageMode;
}

/** 候補: メンバー順の起用率（%） */
export type QuickSimOptimizerPercents = readonly number[];

/**
 * 同時に編成できないメンバー index の組。
 * 各組のメンバーは同じ時刻に編成できないので、組の起用率の合計は 100%
 * （`QUICK_SIM_OPTIMIZER_MAX_UNITS` 単位）を超えられない。
 * とくべつなポケモンのルール（同時に 1 体まで。ラティアス＋ラティオスは可）から作る。
 */
export type QuickSimOptimizerExclusiveGroups = readonly (readonly number[])[];

/** 進捗の段階 */
export type QuickSimOptimizerPhase =
	| "solo"
	| "screening"
	| "racing"
	| "localSearch"
	| "ingredientStart"
	| "ingredientSearch"
	| "final";

export interface QuickSimOptimizerProgress {
	phase: QuickSimOptimizerPhase;
	/** 全体の進捗（0〜100） */
	percent: number;
	/** 現在の段階で評価し終えた候補数と候補数 */
	completed: number;
	total: number;
}

/** 評価器へのオプション */
export interface QuickSimOptimizerEvaluateOptions {
	/** 料理シミュレーションを強制的に無効にする（単体 EP 表の作成用） */
	disableCooking?: boolean;
	/** 就寝中の入れ替えが必要な候補はシミュレーションせずに除外扱いにする */
	excludeSleepSwaps: boolean;
	/**
	 * 集計期間全体のスケジュールを作る（通常の簡易シミュの実行と同じ結果になる）。
	 * 既定では前半・後半のメンバーがいない限り 1 日分のスケジュールを繰り返す。
	 * 日をまたぐ枠の付け替えが変わるぶん EP がわずかに違うことがあるが、生成は 1 桁速い。
	 */
	usePeriodSchedule?: boolean;
}

/** 評価器が返す候補ごとの結果 */
export interface QuickSimCandidateEvaluation {
	percents: QuickSimOptimizerPercents;
	/** 要求したシードごとの EP（除外された候補は空） */
	epBySeed: number[];
	/** 除外されたか（就寝中の入れ替えが必要、またはスケジュールを作れない） */
	excluded: boolean;
	usesSleepSwaps: boolean;
	unmetPokemonIds: number[];
	/** 1 日あたりの入れ替え回数 */
	swapsPerDay: number;
}

/**
 * 候補をシミュレーションして EP を返す評価器。
 * 同じ候補・同じシードには同じ EP を返す（共通乱数）。
 */
export interface QuickSimOptimizerEvaluator {
	evaluate(
		candidates: readonly QuickSimOptimizerPercents[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): Promise<QuickSimCandidateEvaluation[]>;
}

/** 初期食材の配分: IngredientNames 順の個数 */
export type QuickSimIngredientStock = readonly number[];

/** 初期食材の配分ごとの評価結果 */
export interface QuickSimIngredientEvaluation {
	stock: number[];
	/** 要求したシードごとの EP（除外された配分は空） */
	epBySeed: number[];
	/** 除外されたか（起用率のスケジュールを作れない、または就寝中の入れ替えが必要） */
	excluded: boolean;
}

/**
 * 起用率を固定して初期食材の配分をシミュレーションする評価器。
 * 同じシードのおてつだい結果を配分間で共有し、料理だけを再計算する。
 */
export interface QuickSimIngredientEvaluator {
	evaluateIngredients(
		percents: QuickSimOptimizerPercents,
		stocks: readonly QuickSimIngredientStock[],
		seeds: readonly number[],
		options: QuickSimOptimizerEvaluateOptions,
		onProgress?: (completed: number, total: number) => void,
	): Promise<QuickSimIngredientEvaluation[]>;
}

/** 最終結果の 1 件 */
export interface QuickSimOptimizerResultEntry {
	/** メンバー順の起用率（%） */
	percents: number[];
	/** 初期食材の配分（初期食材を探索した対象のときだけ。19 種すべてのキーを持つ） */
	initialIngredients?: Partial<Record<IngredientName, number>>;
	/** 平均 EP */
	meanEP: number;
	trialCount: number;
	usesSleepSwaps: boolean;
	unmetPokemonIds: number[];
	swapsPerDay: number;
}

export interface QuickSimOptimizerResult {
	target: QuickSimOptimizerTarget;
	members: QuickSimOptimizerMember[];
	/** 初期食材を探索したときに実際に配分した合計（刻みと上限で切り詰めた後） */
	ingredientTotalCount?: number;
	/** 平均 EP の高い順 */
	entries: QuickSimOptimizerResultEntry[];
	/** 現在の起用率を同じシードで評価したもの（評価できないときは null） */
	current: QuickSimOptimizerResultEntry | null;
	/** 使ったシードの基点 */
	baseSeed: number;
}

export function isQuickSimOptimizerMemberCountSupported(
	memberCount: number,
): boolean {
	return (
		memberCount >= QUICK_SIM_OPTIMIZER_MIN_MEMBERS &&
		memberCount <= QUICK_SIM_OPTIMIZER_MAX_MEMBERS
	);
}
