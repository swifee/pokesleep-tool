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
 * スケジュールをシミュレーター入力へ変換する。
 *
 * - 初日の各枠の最初の区間の占有者が初期チームになる。
 * - 区間の切り替わり時刻に既存の時間帯があればそこで入れ替え、なければ
 *   その時刻に時間帯を追加して入れ替える。追加した時間帯では入れ替え対象の
 *   ポケモンだけを回収し（清算）、他のポケモンは回収しない設定にする。
 * - 翌日の先頭区間が前日の最終区間と異なるときは、前日の就寝スロットで入れ替える。
 */
export function buildQuickSimTimeline(
	schedule: QuickSimSchedule,
	timeSlots: readonly TimeSlot[],
	simulationDays: number,
	box: PokemonBox,
): QuickSimTimeline {
	const days = clampSimulationDays(simulationDays);
	const originMinutes = parseTime(schedule.sleepTime);
	const slotIdByTime = new Map<string, string>();
	for (const slot of timeSlots) {
		if (!slotIdByTime.has(slot.time)) {
			slotIdByTime.set(slot.time, slot.id);
		}
	}
	const insertedSlots: TimeSlot[] = [];
	const resolveSlotId = (time: string): string => {
		const existing = slotIdByTime.get(time);
		if (existing !== undefined) {
			return existing;
		}
		const id = `${QUICK_SIM_SLOT_ID_PREFIX}${time.replace(":", "")}`;
		insertedSlots.push({ id, time, sleepState: "none", hasMeal: false });
		slotIdByTime.set(time, id);
		return id;
	};

	const team = resolveDayLanes(schedule, 0).map((lane) => {
		const pokemonId = lane[0]?.pokemonId ?? null;
		return pokemonId === null ? null : box.getById(pokemonId);
	});

	const swaps: PokemonSwap[] = [];
	for (let dayIndex = 0; dayIndex < days; dayIndex++) {
		const lanes = resolveDayLanes(schedule, dayIndex);
		const previousLanes =
			dayIndex === 0 ? null : resolveDayLanes(schedule, dayIndex - 1);
		lanes.forEach((lane, teamSlotIndex) => {
			lane.forEach((segment, segmentIndex) => {
				if (segmentIndex === 0) {
					if (previousLanes === null) {
						return;
					}
					const previousLane = previousLanes[teamSlotIndex];
					const previousSegment = previousLane[previousLane.length - 1];
					if (previousSegment?.pokemonId === segment.pokemonId) {
						return;
					}
					swaps.push({
						dayIndex: dayIndex - 1,
						slotId: `${schedule.sleepSlotId}-end`,
						teamSlotIndex,
						newPokemonId: toSwapPokemonId(segment.pokemonId, box),
						initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
					});
					return;
				}
				const time = formatTime(
					(originMinutes + segment.startMinute) % MINUTES_PER_DAY,
				);
				swaps.push({
					dayIndex,
					slotId: resolveSlotId(time),
					teamSlotIndex,
					newPokemonId: toSwapPokemonId(segment.pokemonId, box),
					initialEnergy: QUICK_SIM_SWAP_INITIAL_ENERGY,
				});
			});
		});
	}

	const noCollectCells: NoCollectCellSetting[] = [];
	for (const slot of insertedSlots) {
		for (let dayIndex = 0; dayIndex < days; dayIndex++) {
			for (
				let teamSlotIndex = 0;
				teamSlotIndex < MAX_TEAM_SIZE;
				teamSlotIndex++
			) {
				noCollectCells.push({ dayIndex, slotId: slot.id, teamSlotIndex });
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
