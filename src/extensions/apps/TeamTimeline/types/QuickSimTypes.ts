import { MAX_TEAM_SIZE } from "./TeamTimelineTypes";

/**
 * 起用方法。起用率をどの時間帯に割り当てるかを決める。
 * - even: 毎日同じ時間だけ起用し、空いている枠に詰める（既定）
 * - firstHalf: 集計期間の先頭から、起用時間の合計に達するまで連続して起用する
 * - secondHalf: 集計期間の末尾に向けて、起用時間の合計に達するまで連続して起用する
 * - sleep: 毎日、就寝中を優先して起用する
 * - daytime: 毎日、起床後を優先して起用する
 */
export type QuickSimUsageMode =
	| "even"
	| "firstHalf"
	| "secondHalf"
	| "sleep"
	| "daytime";

/** 起用方法の一覧（プルダウンの表示順） */
export const QUICK_SIM_USAGE_MODES: readonly QuickSimUsageMode[] = [
	"even",
	"firstHalf",
	"secondHalf",
	"sleep",
	"daytime",
];

/** 既定の起用方法 */
export const DEFAULT_QUICK_SIM_USAGE_MODE: QuickSimUsageMode = "even";

/**
 * 起用方法ごとの配置の優先順位（小さいほど先に配置する）。
 * 前半 → 後半 → 就寝 → 日中 の順に固定配置し、均等は残った空きに詰める。
 */
export const QUICK_SIM_USAGE_MODE_PRIORITY: Readonly<
	Record<QuickSimUsageMode, number>
> = {
	firstHalf: 0,
	secondHalf: 1,
	sleep: 2,
	daytime: 3,
	even: 4,
};

export function isQuickSimUsageMode(
	value: unknown,
): value is QuickSimUsageMode {
	return (
		typeof value === "string" &&
		(QUICK_SIM_USAGE_MODES as readonly string[]).includes(value)
	);
}

/**
 * 簡易シミュのメンバー設定
 */
export interface QuickSimMember {
	/** ボックス内ポケモンID（PokemonBoxItem.id） */
	pokemonId: number;
	/** 1日のうち編成に入れる割合（%）。0〜100 */
	usagePercent: number;
	/** 起用方法 */
	usageMode: QuickSimUsageMode;
}

/**
 * 簡易シミュの設定（永続化対象）
 */
export interface QuickSimSettings {
	members: QuickSimMember[];
}

/** 起用率の下限（%） */
export const QUICK_SIM_MIN_USAGE_PERCENT = 0;
/** 起用率の上限（%）。1匹は最大でも1つの枠を1日中占有できる */
export const QUICK_SIM_MAX_USAGE_PERCENT = 100;
/** 起用率合計の上限（%）。5枠 × 100% */
export const QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT =
	MAX_TEAM_SIZE * QUICK_SIM_MAX_USAGE_PERCENT;
/** 起用率の増減ボタンの刻み（%） */
export const QUICK_SIM_USAGE_STEP_PERCENT = 5;
/** 途中から編成に入るポケモンの初期げんき（詳細シミュの入れ替え既定値と同じ） */
export const QUICK_SIM_SWAP_INITIAL_ENERGY = 100;

/** 1日の分数 */
export const MINUTES_PER_DAY = 24 * 60;

/**
 * 1日のうち、あるポケモンが1つの枠を占有する区間。
 * 時刻は「日の起点（就寝時刻）からの経過分」で表す。
 */
export interface QuickSimLaneSegment {
	/** 占有するポケモンID。null は空き枠 */
	pokemonId: number | null;
	/** 区間の開始（日の起点からの経過分、0 以上） */
	startMinute: number;
	/** 区間の終了（日の起点からの経過分、MINUTES_PER_DAY 以下） */
	endMinute: number;
}

/**
 * 1日分の自動入れ替えスケジュール。
 * 集計期間が複数日でも同じスケジュールを毎日繰り返す。
 */
export interface QuickSimDaySchedule {
	/** 枠ごとの占有区間（MAX_TEAM_SIZE 個、各枠は 0〜MINUTES_PER_DAY を隙間なく覆う） */
	lanes: QuickSimLaneSegment[][];
	/** 日の起点となる就寝スロットID */
	sleepSlotId: string;
	/** 日の起点となる就寝時刻 "HH:MM" */
	sleepTime: string;
	/** 就寝から起床までの分数 */
	sleepMinutes: number;
	/** 就寝中の入れ替えを含むかどうか */
	usesSleepSwaps: boolean;
}

/**
 * 集計期間全体の自動入れ替えスケジュール。
 * 前半・後半の起用方法があると日ごとに配置が変わるため、日ごとに区間列を持つ。
 */
export interface QuickSimSchedule {
	/** 日ごと・枠ごとの区間列。dayLanes[dayIndex][laneIndex] */
	dayLanes: QuickSimLaneSegment[][][];
	/** 日の起点となる就寝スロットID */
	sleepSlotId: string;
	/** 日の起点となる就寝時刻 "HH:MM" */
	sleepTime: string;
	/** 就寝から起床までの分数 */
	sleepMinutes: number;
	/** 就寝中の入れ替えを含むかどうか */
	usesSleepSwaps: boolean;
	/**
	 * 起用方法の指定や同時に編成できない組（とくべつなポケモン）の制限により、
	 * 設定した起用時間を満たせなかったメンバーのID
	 */
	unmetPokemonIds: number[];
}

/**
 * 同時に編成できないメンバーの組。
 * ポケモン ID → 同時に編成できないポケモン ID の集合（とくべつなポケモンのルール用）。
 * スケジューラは、ここに挙げた組が同じ時刻に別の枠へ入らないように配置する。
 */
export type QuickSimExclusionMap = ReadonlyMap<number, ReadonlySet<number>>;

/** 同時に編成できない組のない空の設定 */
export const EMPTY_QUICK_SIM_EXCLUSION_MAP: QuickSimExclusionMap = new Map();

/** スケジュール生成に失敗した理由 */
export type QuickSimScheduleErrorType =
	| "noSleepSlot"
	| "noMembers"
	| "usageExceeded";

export type QuickSimDayScheduleResult =
	| { ok: true; schedule: QuickSimDaySchedule }
	| { ok: false; error: QuickSimScheduleErrorType };

export type QuickSimScheduleResult =
	| { ok: true; schedule: QuickSimSchedule }
	| { ok: false; error: QuickSimScheduleErrorType };

/**
 * localStorage キー（簡易シミュ設定）
 */
export const STORAGE_KEY_QUICK_SIM = "PstTeamTimelineQuickSimV1";
