/**
 * QuickSimTimelineBuilder.ts
 * 簡易シミュのスケジュールを、既存のシミュレーターに渡せる
 * チーム・時間帯・入れ替え・回収しない設定へ変換する。
 */

import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import {
	MINUTES_PER_DAY,
	QUICK_SIM_SWAP_INITIAL_ENERGY,
	type QuickSimLaneSegment,
	type QuickSimSchedule,
} from "../types/QuickSimTypes";
import { MAX_TEAM_SIZE } from "../types/TeamTimelineTypes";
import {
	clampSimulationDays,
	type NoCollectCellSetting,
	type PokemonSwap,
	SWAP_NONE_POKEMON_ID,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { formatTime, parseTime } from "./TimeSlotUtils";

/** 自動入れ替えのために追加する時間帯スロットIDの接頭辞 */
export const QUICK_SIM_SLOT_ID_PREFIX = "quick-swap-";

/**
 * 区間の切り替わり時刻の前後この分数以内に既存の時間帯（チェック）があれば、
 * 時間帯を追加せずにその時間帯で入れ替える。
 */
export const QUICK_SIM_SWAP_SNAP_MINUTES = 30;

/** 追加する時間帯の時刻の刻み（分）。切り替わり時刻はこの倍数に丸める */
export const QUICK_SIM_SWAP_TIME_STEP_MINUTES = 10;

/** シミュレーターへの入力に変換した簡易シミュのタイムライン */
export interface QuickSimTimeline {
	/** 日の起点（就寝時）のチーム */
	team: (PokemonBoxItem | null)[];
	/** ユーザーの時間帯設定 + 入れ替えのために追加した時間帯 */
	timeSlots: TimeSlot[];
	/** 全日分の入れ替え設定 */
	swaps: PokemonSwap[];
	/** 追加した時間帯では入れ替え対象以外のポケモンを回収しない */
	noCollectCells: NoCollectCellSetting[];
	/** 追加した時間帯スロットID */
	insertedSlotIds: string[];
}

/**
 * 枠の占有者が切り替わる点。時刻は期間の先頭（初日の就寝時刻）からの経過分。
 */
interface LaneBoundary {
	minute: number;
	pokemonId: number | null;
}

/** 追加した時間帯と、それがある日 */
interface InsertedSlot {
	id: string;
	time: string;
	dayIndexes: Set<number>;
}

function toSwapPokemonId(pokemonId: number | null, box: PokemonBox): number {
	if (pokemonId === null || box.getById(pokemonId) === null) {
		return SWAP_NONE_POKEMON_ID;
	}
	return pokemonId;
}

/**
 * 指定した日の枠の区間列。スケジュールの日数を超える日は最終日を繰り返す。
 */
function resolveDayLanes(
	schedule: QuickSimSchedule,
	dayIndex: number,
): QuickSimLaneSegment[][] {
	const lanes =
		schedule.dayLanes[Math.min(dayIndex, schedule.dayLanes.length - 1)] ?? [];
	return Array.from(
		{ length: MAX_TEAM_SIZE },
		(_, index) => lanes[index] ?? [],
	);
}

/**
 * 期間全体の既存のチェック時刻（期間の先頭からの経過分、昇順）。
 * ユーザーの時間帯を毎日分並べ、期間の末尾（最終日の就寝）も含める。
 */
function collectExistingCheckMinutes(
	timeSlots: readonly TimeSlot[],
	originMinutes: number,
	days: number,
): number[] {
	const offsets = timeSlots.map(
		(slot) =>
			(parseTime(slot.time) - originMinutes + MINUTES_PER_DAY) %
			MINUTES_PER_DAY,
	);
	const minutes = new Set<number>([days * MINUTES_PER_DAY]);
	for (let dayIndex = 0; dayIndex < days; dayIndex++) {
		for (const offset of offsets) {
			minutes.add(dayIndex * MINUTES_PER_DAY + offset);
		}
	}
	return [...minutes].sort((a, b) => a - b);
}

/**
 * 切り替わり時刻を、入れ替えを行う時刻へ寄せる。
 * 前後 `QUICK_SIM_SWAP_SNAP_MINUTES` 以内に既存のチェックがあれば最も近いもの
 * （同距離なら早い方）へ、なければ `QUICK_SIM_SWAP_TIME_STEP_MINUTES` の倍数へ丸める。
 *
 * この写像は単調（早い切り替わりが遅い切り替わりを追い越さない）なので、
 * 寄せた後も枠内・枠間の順序は保たれる。
 */
function snapBoundaryMinute(
	minute: number,
	existingCheckMinutes: readonly number[],
): number {
	let nearest: number | null = null;
	for (const check of existingCheckMinutes) {
		if (
			nearest === null ||
			Math.abs(check - minute) < Math.abs(nearest - minute)
		) {
			nearest = check;
		}
	}
	if (
		nearest !== null &&
		Math.abs(nearest - minute) <= QUICK_SIM_SWAP_SNAP_MINUTES
	) {
		return nearest;
	}
	return (
		Math.round(minute / QUICK_SIM_SWAP_TIME_STEP_MINUTES) *
		QUICK_SIM_SWAP_TIME_STEP_MINUTES
	);
}

/**
 * 1つの枠の切り替わり点を期間全体で集め、時刻を寄せたうえで整理する。
 * 同じ時刻に重なった切り替わりは後のものだけを残し（前の区間は長さ 0 になる）、
 * 前と同じポケモンが続く切り替わりは取り除く。先頭は必ず期間の先頭（0 分）になる。
 */
function buildLaneBoundaries(
	schedule: QuickSimSchedule,
	laneIndex: number,
	days: number,
	existingCheckMinutes: readonly number[],
): LaneBoundary[] {
	const boundaries: LaneBoundary[] = [];
	for (let dayIndex = 0; dayIndex < days; dayIndex++) {
		const lane = resolveDayLanes(schedule, dayIndex)[laneIndex];
		const segments =
			lane.length > 0
				? lane
				: [{ pokemonId: null, startMinute: 0, endMinute: MINUTES_PER_DAY }];
		for (const segment of segments) {
			const minute = snapBoundaryMinute(
				dayIndex * MINUTES_PER_DAY + segment.startMinute,
				existingCheckMinutes,
			);
			while (
				boundaries.length > 0 &&
				boundaries[boundaries.length - 1].minute >= minute
			) {
				boundaries.pop();
			}
			const previous = boundaries[boundaries.length - 1];
			if (previous !== undefined && previous.pokemonId === segment.pokemonId) {
				continue;
			}
			boundaries.push({ minute, pokemonId: segment.pokemonId });
		}
	}
	return boundaries;
}

/**
 * スケジュールをシミュレーター入力へ変換する。
 *
 * - 各枠の期間先頭の占有者が初期チームになる。
 * - 区間の切り替わり時刻の前後 30 分以内に既存の時間帯があればそこで入れ替え、
 *   なければ 10 分の倍数に丸めた時刻に時間帯を追加して入れ替える。追加した時間帯は
 *   入れ替えのある日にだけ置き、入れ替え対象のポケモンだけを回収し（清算）、
 *   他のポケモンは回収しない設定にする。
 * - 日の境（就寝時刻）で切り替わる枠は、前日の就寝スロットで入れ替える。
 */
export function buildQuickSimTimeline(
	schedule: QuickSimSchedule,
	timeSlots: readonly TimeSlot[],
	simulationDays: number,
	box: PokemonBox,
): QuickSimTimeline {
	const days = clampSimulationDays(simulationDays);
	const originMinutes = parseTime(schedule.sleepTime);
	const existingCheckMinutes = collectExistingCheckMinutes(
		timeSlots,
		originMinutes,
		days,
	);
	const slotIdByTime = new Map<string, string>();
	for (const slot of timeSlots) {
		if (!slotIdByTime.has(slot.time)) {
			slotIdByTime.set(slot.time, slot.id);
		}
	}
	const insertedSlotByTime = new Map<string, InsertedSlot>();
	const resolveSlotId = (time: string, dayIndex: number): string => {
		const existing = slotIdByTime.get(time);
		if (existing !== undefined) {
			return existing;
		}
		let inserted = insertedSlotByTime.get(time);
		if (inserted === undefined) {
			inserted = {
				id: `${QUICK_SIM_SLOT_ID_PREFIX}${time.replace(":", "")}`,
				time,
				dayIndexes: new Set<number>(),
			};
			insertedSlotByTime.set(time, inserted);
		}
		inserted.dayIndexes.add(dayIndex);
		return inserted.id;
	};

	const team: (PokemonBoxItem | null)[] = [];
	const timedSwaps: { minute: number; swap: PokemonSwap }[] = [];
	for (let teamSlotIndex = 0; teamSlotIndex < MAX_TEAM_SIZE; teamSlotIndex++) {
		const boundaries = buildLaneBoundaries(
			schedule,
			teamSlotIndex,
			days,
			existingCheckMinutes,
		);
		const initialPokemonId = boundaries[0]?.pokemonId ?? null;
		team.push(initialPokemonId === null ? null : box.getById(initialPokemonId));

		for (const boundary of boundaries.slice(1)) {
			if (boundary.minute >= days * MINUTES_PER_DAY) {
				// 期間の末尾に寄った切り替わりは何も変えない
				continue;
			}
			const newPokemonId = toSwapPokemonId(boundary.pokemonId, box);
			const offset = boundary.minute % MINUTES_PER_DAY;
			if (offset === 0) {
				// 日の境（就寝時刻）の切り替わりは前日の就寝スロットで入れ替える
				timedSwaps.push({
					minute: boundary.minute,
					swap: {
						dayIndex: boundary.minute / MINUTES_PER_DAY - 1,
						slotId: `${schedule.sleepSlotId}-end`,
						teamSlotIndex,
						newPokemonId,
						initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
					},
				});
				continue;
			}
			const dayIndex = Math.floor(boundary.minute / MINUTES_PER_DAY);
			const time = formatTime((originMinutes + offset) % MINUTES_PER_DAY);
			timedSwaps.push({
				minute: boundary.minute,
				swap: {
					dayIndex,
					slotId: resolveSlotId(time, dayIndex),
					teamSlotIndex,
					newPokemonId,
					initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
				},
			});
		}
	}
	timedSwaps.sort(
		(a, b) =>
			a.minute - b.minute || a.swap.teamSlotIndex - b.swap.teamSlotIndex,
	);
	const swaps = timedSwaps.map((entry) => entry.swap);

	const insertedSlots: TimeSlot[] = [];
	const noCollectCells: NoCollectCellSetting[] = [];
	for (const inserted of insertedSlotByTime.values()) {
		const dayIndexes = [...inserted.dayIndexes].sort((a, b) => a - b);
		insertedSlots.push({
			id: inserted.id,
			time: inserted.time,
			sleepState: "none",
			hasMeal: false,
			dayIndexes,
		});
		for (const dayIndex of dayIndexes) {
			for (
				let teamSlotIndex = 0;
				teamSlotIndex < MAX_TEAM_SIZE;
				teamSlotIndex++
			) {
				noCollectCells.push({ dayIndex, slotId: inserted.id, teamSlotIndex });
			}
		}
	}

	return {
		team,
		timeSlots: [...timeSlots, ...insertedSlots],
		swaps,
		noCollectCells,
		insertedSlotIds: insertedSlots.map((slot) => slot.id),
	};
}
