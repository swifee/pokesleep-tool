import { MAX_TEAM_SIZE } from "./TeamTimelineTypes";

/**
 * 簡易シミュのメンバー設定
 */
export interface QuickSimMember {
	/** ボックス内ポケモンID（PokemonBoxItem.id） */
	pokemonId: number;
	/** 1日のうち編成に入れる割合（%）。0〜100 */
	usagePercent: number;
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

/** スケジュール生成に失敗した理由 */
export type QuickSimScheduleErrorType =
	| "noSleepSlot"
	| "noMembers"
	| "usageExceeded";

export type QuickSimScheduleResult =
	| { ok: true; schedule: QuickSimDaySchedule }
	| { ok: false; error: QuickSimScheduleErrorType };

/**
 * localStorage キー（簡易シミュ設定）
 */
export const STORAGE_KEY_QUICK_SIM = "PstTeamTimelineQuickSimV1";
