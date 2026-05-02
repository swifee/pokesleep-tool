import type { TimeSlot, TimeSlotLabel } from "../types/TimeSlotTypes";

/** AM 4:00 を一日の始まりとする基準時刻（分） */
const DAY_START_MINUTES = 4 * 60; // 240分

/**
 * 時間文字列を分に変換
 * @param time "HH:MM" 形式の時刻文字列
 * @returns 0時0分からの経過分（0-1439）
 */
export function parseTime(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * 分を時間文字列に変換
 * @param minutes 0時0分からの経過分（0-1439）
 * @returns "HH:MM" 形式の時刻文字列
 */
export function formatTime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * 2つの時間帯間の経過時間を計算（分）
 * 日をまたぐ場合も対応（就寝→起床など）
 *
 * @param startTime 開始時刻 "HH:MM"
 * @param endTime 終了時刻 "HH:MM"
 * @returns 経過時間（分）
 *
 * @example
 * // 同日内
 * calculateDuration('07:00', '12:00') // => 300（5時間）
 *
 * @example
 * // 日をまたぐ
 * calculateDuration('22:30', '07:00') // => 510（8時間30分）
 */
export function calculateDuration(startTime: string, endTime: string): number {
	const start = parseTime(startTime);
	const end = parseTime(endTime);

	if (end >= start) {
		// 同日内
		return end - start;
	} else {
		// 日をまたぐ（終了時刻が開始時刻より小さい）
		return 24 * 60 - start + end;
	}
}

/**
 * 時間帯が睡眠中かどうかを判定
 *
 * @param slot 判定対象の時間帯
 * @param slots すべての時間帯リスト
 * @param isFirstSlot シミュレーションの最初のスロットかどうか
 * @returns true: 睡眠中（グレー表示）, false: 起きている
 *
 * @description
 * - 就寝のセルはグレーにしない（例外: 最初の就寝はグレー）
 * - 就寝の次からのセルと、起床までを含むセルがグレー
 */
export function isSleepingSlot(
	slot: TimeSlot,
	slots: TimeSlot[],
	isFirstSlot: boolean = false,
): boolean {
	// 例外: シミュレーションの最初の就寝はグレーにする
	if (isFirstSlot && slot.label === "sleep") {
		return true;
	}

	// 就寝のセルはグレーにしない
	if (slot.label === "sleep") {
		return false;
	}

	// 起床のセルはグレーにする（睡眠期間の終わり）
	if (slot.label === "wake") {
		return true;
	}

	// sleep と wake を探す
	const sleepSlot = slots.find((s) => s.label === "sleep");
	const wakeSlot = slots.find((s) => s.label === "wake");

	// sleep または wake が存在しない場合は起きていると判定
	if (!sleepSlot || !wakeSlot) {
		return false;
	}

	const sleepTime = parseTime(sleepSlot.time);
	const wakeTime = parseTime(wakeSlot.time);
	const targetTime = parseTime(slot.time);

	// 日をまたぐケース（sleep > wake: 例 22:30 → 07:00）
	if (sleepTime > wakeTime) {
		// targetが sleepTime より後 または wakeTime 以下（起床を含む）
		return targetTime > sleepTime || targetTime <= wakeTime;
	} else {
		// 同日ケース（sleep < wake: 例 01:00 → 07:00）
		return targetTime > sleepTime && targetTime <= wakeTime;
	}
}

/**
 * 時間帯リストを時系列でソート
 * AM 4:00 を1日の始まりとして扱う
 *
 * @param slots ソート対象の時間帯リスト
 * @returns ソート済みの時間帯リスト（元の配列は変更しない）
 *
 * @example
 * // 入力: [wake(07:00), lunch(12:00), sleep(22:30)]
 * // 出力: [wake(07:00), lunch(12:00), sleep(22:30)]
 * // 4:00 が1日の開始として扱われる
 */
export function sortTimeSlots(slots: TimeSlot[]): TimeSlot[] {
	// AM 4:00 を基準（0分）として各スロットの相対位置を計算
	const withRelativeTime = slots.map((slot) => {
		const time = parseTime(slot.time);
		// 4:00以降は time - 240、4:00未満は time + (24*60 - 240)
		const relativeTime =
			time >= DAY_START_MINUTES
				? time - DAY_START_MINUTES
				: time + (24 * 60 - DAY_START_MINUTES);
		return { slot, relativeTime };
	});

	// 相対時刻でソート
	withRelativeTime.sort((a, b) => a.relativeTime - b.relativeTime);

	return withRelativeTime.map((item) => item.slot);
}

/**
 * 30分刻みの時刻オプションを生成
 * AM 4:00 を一日の始まりとして生成
 * @returns 04:00, 04:30, 05:00, ... 03:00, 03:30 の48個の時刻文字列
 */
export function generateTimeOptions(): string[] {
	const options: string[] = [];
	const DAY_START_HOUR = 4; // AM 4:00 が一日の始まり

	for (let i = 0; i < 48; i++) {
		const totalMinutes = (DAY_START_HOUR * 60 + i * 30) % (24 * 60);
		options.push(formatTime(totalMinutes));
	}
	return options;
}

/**
 * 一意のID生成（時間帯用）
 *
 * @returns "slot-{timestamp}-{random}" 形式のユニークID
 *
 * @example
 * generateSlotId() // => "slot-1738403456789-a3b2c1"
 */
export function generateSlotId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `slot-${timestamp}-${random}`;
}

/**
 * 時間帯ラベルに応じた表示名を取得（デバッグ用）
 *
 * @param label 時間帯ラベル
 * @param customLabel カスタムラベル（オプション）
 * @returns 表示用文字列
 *
 * @description
 * 実際のUIでは i18n の翻訳キーを使用することを推奨
 * この関数はデバッグやテスト時の参考用
 */
export function getLabelDisplayName(
	label: TimeSlotLabel,
	customLabel?: string,
): string {
	const labelMap: Record<TimeSlotLabel, string> = {
		wake: "起床",
		breakfast: "朝食",
		lunch: "昼食",
		dinner: "夕食",
		sleep: "就寝",
		custom: customLabel || "カスタム",
	};

	return labelMap[label];
}
