import {
	clampSimulationDays,
	getDisplayLabel,
	getMealType,
	isTimeSlotOnDay,
	type TimeSlot,
	type Weekday,
} from "../types/TimeSlotTypes";
import { sortTimeSlots } from "./TimeSlotUtils";
import { isSundayForDayIndex } from "./WeekdayUtils";

export interface ExpandedTimelineSlot {
	slot: TimeSlot;
	originalSlotId: string;
	dayIndex: number;
	slotIndexInDay: number;
}

/**
 * 日曜の最後の食事を就寝スロット（その日の末尾）へ移す指示。
 * `fromIndex` の食事を外し、`toIndex`（就寝の終わり）で食事する。
 */
interface MealRelocation {
	fromIndex: number;
	toIndex: number;
}

export interface DayBandMarker {
	afterDisplaySlotId: string;
	dayNumber: number;
}

export interface ExpandedTimeline {
	baseDaySlots: TimeSlot[];
	expandedSlots: ExpandedTimelineSlot[];
	dayBands: DayBandMarker[];
	slotsByDay: TimeSlot[][];
}

function buildBaseDaySlots(timeSlots: TimeSlot[]): TimeSlot[] {
	const sortedSlots = sortTimeSlots(timeSlots);
	const sleepSlot = timeSlots.find((slot) => getDisplayLabel(slot) === "sleep");
	if (!sleepSlot) {
		return sortedSlots;
	}

	// 就寝スロットを先頭にし、残りは時系列のまま回転させる。
	// 就寝〜AM4:00 の間にあるスロットも就寝の直後に並ぶ。
	const sleepIndex = sortedSlots.findIndex((slot) => slot.id === sleepSlot.id);
	const normalizedSlots =
		sleepIndex > 0
			? [...sortedSlots.slice(sleepIndex), ...sortedSlots.slice(0, sleepIndex)]
			: [...sortedSlots];

	const endSlot: TimeSlot = {
		...sleepSlot,
		id: `${sleepSlot.id}-end`,
	};
	return [...normalizedSlots, endSlot];
}

/**
 * 日曜の最後の食事を就寝直前へ移す位置を求める。
 *
 * ゲームでは日曜の最後の料理（鍋2倍）を就寝直前まで遅らせて、
 * それまでの回収分をすべて鍋に入れるのが定石なので、日曜にあたる日は
 * その日の最後の食事スロットの料理を就寝スロット（その日の末尾）で行う。
 * 就寝時の回収（チェック）→料理の順になる。
 *
 * 移さない場合（`null`）:
 * - 日の末尾が就寝スロットではない（就寝の設定がない）
 * - 就寝スロット自体が食事スロット（すでに就寝直前に料理している）
 * - その日に食事スロットがない
 * - 最後の食事と就寝時刻の食事区分（朝食/昼食/夕食）が異なる
 *   （例: 昼食を就寝時刻の 23:00 には作れない）
 */
function findSundayMealRelocation(daySlots: TimeSlot[]): MealRelocation | null {
	const toIndex = daySlots.length - 1;
	const bedtimeSlot = daySlots[toIndex];
	if (bedtimeSlot === undefined || getDisplayLabel(bedtimeSlot) !== "sleep") {
		return null;
	}
	if (bedtimeSlot.hasMeal) {
		return null;
	}

	let fromIndex = -1;
	for (let i = toIndex - 1; i >= 0; i--) {
		if (daySlots[i].hasMeal) {
			fromIndex = i;
			break;
		}
	}
	if (fromIndex < 0) {
		return null;
	}
	if (getMealType(daySlots[fromIndex].time) !== getMealType(bedtimeSlot.time)) {
		return null;
	}
	return { fromIndex, toIndex };
}

function resolveExpandedHasMeal(
	originalSlot: TimeSlot,
	slotIndexInDay: number,
	relocation: MealRelocation | null,
): boolean {
	if (relocation === null) {
		return originalSlot.hasMeal;
	}
	if (slotIndexInDay === relocation.fromIndex) {
		return false;
	}
	if (slotIndexInDay === relocation.toIndex) {
		return true;
	}
	return originalSlot.hasMeal;
}

/**
 * 時間帯設定を日数分に展開する。
 *
 * `startDayOfWeek` を渡すと、日曜にあたる日はその日の最後の食事を
 * 就寝スロットへ移す（`findSundayMealRelocation`）。展開後スロットの
 * `hasMeal` はこの移動を反映した「その日にその時間帯で食事するか」を表す。
 * 省略時は時間帯設定の `hasMeal` をそのまま使う。
 *
 * `dayIndexes` を持つ時間帯（自動シミュが特定の日だけに追加する入れ替え用の
 * 時間帯）は、その日にだけ展開する。`baseDaySlots` には毎日の並びとして含める。
 */
export function buildExpandedTimeline(
	timeSlots: TimeSlot[],
	simulationDays: number,
	startDayOfWeek?: Weekday,
): ExpandedTimeline {
	const days = clampSimulationDays(simulationDays);
	const baseDaySlots = buildBaseDaySlots(timeSlots);
	const expandedSlots: ExpandedTimelineSlot[] = [];
	const slotsByDay: TimeSlot[][] = [];
	const dayBands: DayBandMarker[] = [];

	if (baseDaySlots.length === 0) {
		return {
			baseDaySlots,
			expandedSlots,
			dayBands,
			slotsByDay,
		};
	}

	const firstSlot = baseDaySlots[0];
	const hasSleepStartCopy =
		firstSlot !== undefined &&
		getDisplayLabel(firstSlot) === "sleep" &&
		baseDaySlots.some((slot) => slot.id === `${firstSlot.id}-end`);

	for (let dayIndex = 0; dayIndex < days; dayIndex++) {
		const sourceSlots = (
			dayIndex > 0 && hasSleepStartCopy ? baseDaySlots.slice(1) : baseDaySlots
		).filter((slot) => isTimeSlotOnDay(slot, dayIndex));
		if (sourceSlots.length === 0) {
			slotsByDay.push([]);
			continue;
		}
		const mealRelocation =
			startDayOfWeek !== undefined &&
			isSundayForDayIndex(startDayOfWeek, dayIndex)
				? findSundayMealRelocation(sourceSlots)
				: null;
		const daySlots: TimeSlot[] = [];
		for (
			let slotIndexInDay = 0;
			slotIndexInDay < sourceSlots.length;
			slotIndexInDay++
		) {
			const originalSlot = sourceSlots[slotIndexInDay];
			const displaySlotId = `${originalSlot.id}__day${dayIndex}`;
			const slot: TimeSlot = {
				...originalSlot,
				id: displaySlotId,
				hasMeal: resolveExpandedHasMeal(
					originalSlot,
					slotIndexInDay,
					mealRelocation,
				),
			};
			daySlots.push(slot);
			expandedSlots.push({
				slot,
				originalSlotId: originalSlot.id,
				dayIndex,
				slotIndexInDay,
			});
		}
		slotsByDay.push(daySlots);

		// 日付帯はその日の最後のセル（就寝の終わり）の直後に置く。
		// 就寝〜起床の間に追加されたセルは前の日に属するので、区切りにはしない。
		if (dayIndex < days - 1) {
			dayBands.push({
				afterDisplaySlotId: daySlots[daySlots.length - 1].id,
				dayNumber: dayIndex + 2,
			});
		}
	}

	return {
		baseDaySlots,
		expandedSlots,
		dayBands,
		slotsByDay,
	};
}
