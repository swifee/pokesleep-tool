/**
 * WeekdayUtils.ts
 * 集計期間の各日の曜日を求めるユーティリティ
 */

import { DAYS_PER_WEEK, SUNDAY, type Weekday } from "../types/TimeSlotTypes";

/** 曜日セレクタの表示順（月曜始まり） */
export const WEEKDAY_SELECT_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** 曜日ごとの翻訳キー接尾辞 */
const WEEKDAY_KEY_SUFFIXES: Readonly<Record<Weekday, string>> = {
	0: "sun",
	1: "mon",
	2: "tue",
	3: "wed",
	4: "thu",
	5: "fri",
	6: "sat",
};

/** 曜日ごとの日本語の既定表示（翻訳が無い場合のフォールバック） */
const WEEKDAY_DEFAULT_LABELS: Readonly<Record<Weekday, string>> = {
	0: "日曜",
	1: "月曜",
	2: "火曜",
	3: "水曜",
	4: "木曜",
	5: "金曜",
	6: "土曜",
};

/**
 * 開始曜日と日インデックス（0始まり）からその日の曜日を求める
 */
export function getWeekdayForDayIndex(
	startDayOfWeek: Weekday,
	dayIndex: number,
): Weekday {
	const normalizedDayIndex = Math.max(0, Math.floor(dayIndex));
	return ((startDayOfWeek + normalizedDayIndex) % DAYS_PER_WEEK) as Weekday;
}

/**
 * 指定日が日曜日かどうかを判定する
 */
export function isSundayForDayIndex(
	startDayOfWeek: Weekday,
	dayIndex: number,
): boolean {
	return getWeekdayForDayIndex(startDayOfWeek, dayIndex) === SUNDAY;
}

/**
 * 曜日表示用の翻訳キー（TeamTimeline 名前空間）を返す
 */
export function getWeekdayLabelKey(weekday: Weekday): string {
	return `TeamTimeline.weekday ${WEEKDAY_KEY_SUFFIXES[weekday]}`;
}

/**
 * 曜日表示の既定文言（日本語）を返す
 */
export function getWeekdayDefaultLabel(weekday: Weekday): string {
	return WEEKDAY_DEFAULT_LABELS[weekday];
}
