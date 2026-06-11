import type { TimeSlot } from "../types/TimeSlotTypes";
import { sortTimeSlots } from "./TimeSlotUtils";

export type TimeSlotValidationErrorType =
	| "consecutiveWake"
	| "wakeSleepCountMismatch"
	| "tooManyWakeSleepPairs";

/**
 * 時間帯設定における起床/就寝の入力エラーを判定する。
 *
 * 判定優先度:
 * 1. 起床の連続入力
 * 2. 起床/就寝回数の不一致（連続就寝は wake+sleep として補正）
 * 3. 起床/就寝ペア数が 3 回以上
 */
export function getTimeSlotValidationError(
	timeSlots: readonly TimeSlot[],
): TimeSlotValidationErrorType | null {
	const sortedSlots = sortTimeSlots([...timeSlots]);
	let previousSleepState: "sleep" | "wake" | null = null;
	let explicitWakeCount = 0;
	let sleepCount = 0;
	let impliedWakeCountFromConsecutiveSleep = 0;

	for (const slot of sortedSlots) {
		if (slot.sleepState === "wake") {
			if (previousSleepState === "wake") {
				return "consecutiveWake";
			}
			explicitWakeCount += 1;
			previousSleepState = "wake";
			continue;
		}

		if (slot.sleepState === "sleep") {
			if (previousSleepState === "sleep") {
				impliedWakeCountFromConsecutiveSleep += 1;
			}
			sleepCount += 1;
			previousSleepState = "sleep";
		}
	}

	const effectiveWakeCount =
		explicitWakeCount + impliedWakeCountFromConsecutiveSleep;
	if (effectiveWakeCount !== sleepCount) {
		return "wakeSleepCountMismatch";
	}

	if (sleepCount >= 3) {
		return "tooManyWakeSleepPairs";
	}

	return null;
}
