/**
 * QuickSimScheduler.ts
 * 簡易シミュの起用率設定から、1日分の自動入れ替えスケジュールを生成する。
 *
 * 1日は就寝スロットを起点とした 24 時間で、各枠（チームスロット）を
 * 「誰がいつからいつまで占有するか」の区間列として表す。
 *
 * 方針:
 * 1. 就寝中（就寝〜起床）は入れ替えを行わない前提で組む（Phase 1）。
 *    - 就寝を丸ごと担当できるメンバー（起用時間 >= 就寝時間）を夜担当に選ぶ。
 *    - 残りの起用時間を起床後の時間帯に詰める。まずは各メンバーが連続して
 *      1つの枠に入る「自然な」配置を試し、収まらなければ McNaughton の
 *      巻き付け法で分割を許して詰める。
 * 2. それでも起用率を満たせないときだけ、就寝中の入れ替えを許す（Phase 2）。
 */

import {
	MINUTES_PER_DAY,
	QUICK_SIM_MAX_USAGE_PERCENT,
	QUICK_SIM_MIN_USAGE_PERCENT,
	QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
	type QuickSimDaySchedule,
	type QuickSimLaneSegment,
	type QuickSimMember,
	type QuickSimScheduleResult,
} from "../types/QuickSimTypes";
import { MAX_TEAM_SIZE } from "../types/TeamTimelineTypes";
import { getDisplayLabel, type TimeSlot } from "../types/TimeSlotTypes";
import { buildExpandedTimeline } from "./TimelineDayExpansion";
import { calculateDuration } from "./TimeSlotUtils";

/** 1日あたりの全枠の合計分数 */
const TOTAL_LANE_MINUTES_PER_DAY = MAX_TEAM_SIZE * MINUTES_PER_DAY;

/** 就寝スロットを起点とした1日の構造 */
export interface QuickSimDayStructure {
	/** 日の起点となる就寝スロットID */
	sleepSlotId: string;
	/** 就寝時刻 "HH:MM" */
	sleepTime: string;
	/** 起床時刻 "HH:MM" */
	wakeTime: string;
	/** 就寝から起床までの分数 */
	sleepMinutes: number;
}

/** メンバーごとの1日の起用時間（分） */
interface ScheduleJob {
	pokemonId: number;
	minutes: number;
}

/** 起床後の時間帯だけを扱う区間（0 = 起床時刻） */
interface DaySegment {
	pokemonId: number;
	startMinute: number;
	endMinute: number;
}

/** 起床後の時間帯を詰めるための枠 */
interface DayLane {
	/** 就寝中にこの枠を占有するメンバー */
	nightPokemonId: number | null;
	segments: DaySegment[];
	/** 次の区間を置ける位置（0 = 起床時刻） */
	cursor: number;
}

/**
 * 起用率(%)をクランプする
 */
export function clampQuickSimUsagePercent(percent: number): number {
	if (!Number.isFinite(percent)) {
		return QUICK_SIM_MIN_USAGE_PERCENT;
	}
	return Math.min(
		QUICK_SIM_MAX_USAGE_PERCENT,
		Math.max(QUICK_SIM_MIN_USAGE_PERCENT, Math.round(percent)),
	);
}

/**
 * 起用率(%)を1日あたりの分数に変換する
 */
export function usagePercentToMinutes(percent: number): number {
	const clamped = clampQuickSimUsagePercent(percent);
	return Math.round((clamped / 100) * MINUTES_PER_DAY);
}

/**
 * メンバーの起用率合計(%)
 */
export function getQuickSimTotalUsagePercent(
	members: readonly QuickSimMember[],
): number {
	return members.reduce(
		(sum, member) => sum + clampQuickSimUsagePercent(member.usagePercent),
		0,
	);
}

/**
 * 起用率合計が上限を超えているか
 */
export function isQuickSimUsageExceeded(
	members: readonly QuickSimMember[],
): boolean {
	return (
		getQuickSimTotalUsagePercent(members) > QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT
	);
}

/**
 * 時間帯設定から、就寝スロットを起点とした1日の構造を求める。
 * 就寝または起床が設定されていないときは null。
 */
export function resolveQuickSimDayStructure(
	timeSlots: readonly TimeSlot[],
): QuickSimDayStructure | null {
	const { baseDaySlots } = buildExpandedTimeline([...timeSlots], 1);
	const sleepSlot = baseDaySlots[0];
	if (!sleepSlot || getDisplayLabel(sleepSlot) !== "sleep") {
		return null;
	}
	const wakeSlot = baseDaySlots
		.slice(1)
		.find((slot) => getDisplayLabel(slot) === "wake");
	if (!wakeSlot) {
		return null;
	}
	const sleepMinutes = calculateDuration(sleepSlot.time, wakeSlot.time);
	if (sleepMinutes <= 0 || sleepMinutes >= MINUTES_PER_DAY) {
		return null;
	}
	return {
		sleepSlotId: sleepSlot.id,
		sleepTime: sleepSlot.time,
		wakeTime: wakeSlot.time,
		sleepMinutes,
	};
}

function sortByMinutesDesc<T extends { minutes: number }>(
	jobs: readonly T[],
): T[] {
	return [...jobs].sort((left, right) => right.minutes - left.minutes);
}

function sumMinutes(jobs: readonly { minutes: number }[]): number {
	return jobs.reduce((sum, job) => sum + job.minutes, 0);
}

/**
 * メンバー設定を起用時間(分)のジョブに変換する。
 * 同じポケモンが重複しているときは合算し、起用率 0 のメンバーは除く。
 */
function buildScheduleJobs(members: readonly QuickSimMember[]): ScheduleJob[] {
	const minutesById = new Map<number, number>();
	const order: number[] = [];
	for (const member of members) {
		const minutes = usagePercentToMinutes(member.usagePercent);
		if (minutes <= 0) {
			continue;
		}
		if (!minutesById.has(member.pokemonId)) {
			order.push(member.pokemonId);
		}
		minutesById.set(
			member.pokemonId,
			Math.min(
				MINUTES_PER_DAY,
				(minutesById.get(member.pokemonId) ?? 0) + minutes,
			),
		);
	}
	return order.map((pokemonId) => ({
		pokemonId,
		minutes: minutesById.get(pokemonId) ?? 0,
	}));
}

/**
 * 分への丸めで全枠の容量をわずかに超えたとき、大きいジョブから1分ずつ削る。
 */
function trimRoundingExcess(jobs: readonly ScheduleJob[]): ScheduleJob[] {
	const trimmed = jobs.map((job) => ({ ...job }));
	let excess = sumMinutes(trimmed) - TOTAL_LANE_MINUTES_PER_DAY;
	while (excess > 0) {
		const largest = trimmed.reduce((best, job) =>
			job.minutes > best.minutes ? job : best,
		);
		largest.minutes -= 1;
		excess -= 1;
	}
	return trimmed.filter((job) => job.minutes > 0);
}

function createEmptyDayLanes(): DayLane[] {
	return Array.from({ length: MAX_TEAM_SIZE }, () => ({
		nightPokemonId: null,
		segments: [],
		cursor: 0,
	}));
}

/**
 * McNaughton の巻き付け法。
 * ジョブを1本の線に並べて枠の長さごとに切る。1つのジョブが2枠にまたがっても、
 * ジョブの長さが枠の長さ以下なら同じ時刻に2枠へ入ることはない。
 */
function fillLanesWrapAround(
	lanes: DayLane[],
	line: readonly ScheduleJob[],
	laneMinutes: number,
): void {
	let laneIndex = 0;
	for (const job of line) {
		let remaining = job.minutes;
		while (remaining > 0) {
			if (laneIndex >= lanes.length) {
				throw new Error("Quick sim schedule exceeds the lane capacity");
			}
			const lane = lanes[laneIndex];
			const free = laneMinutes - lane.cursor;
			if (free <= 0) {
				laneIndex += 1;
				continue;
			}
			const piece = Math.min(remaining, free);
			lane.segments.push({
				pokemonId: job.pokemonId,
				startMinute: lane.cursor,
				endMinute: lane.cursor + piece,
			});
			lane.cursor += piece;
			remaining -= piece;
		}
	}
}

/**
 * 「自然な」配置: 夜担当は起床後もそのまま自分の枠に残り、
 * 昼だけのメンバーは分割せずに1つの枠へ入れる。
 *
 * 入れ替えのために追加する時刻（既存の時間帯にない切り替わり）は、
 * その時刻にチーム全員のスキル発動が起きるため、できるだけ増やさない。
 * 区間の始まりは常に既存の切り替わり時刻（起床、または前の占有者の終わり）なので、
 * 区間の終わりが新しい時刻になるかどうかで候補の枠を選ぶ。
 * 同点なら残り時間がもっとも少ない枠（ぴったり埋まる枠）を優先する。
 * 収まらないメンバーがいれば null。
 */
function packDayJobsNaturally(
	nightDayJobs: readonly ScheduleJob[],
	dayOnlyJobs: readonly ScheduleJob[],
	awakeMinutes: number,
): DayLane[] | null {
	const lanes = createEmptyDayLanes();
	const boundaryMinutes = new Set<number>([0, awakeMinutes]);
	nightDayJobs.forEach((job, index) => {
		const lane = lanes[index];
		lane.nightPokemonId = job.pokemonId;
		if (job.minutes > 0) {
			lane.segments.push({
				pokemonId: job.pokemonId,
				startMinute: 0,
				endMinute: job.minutes,
			});
			lane.cursor = job.minutes;
			boundaryMinutes.add(job.minutes);
		}
	});

	const countNewBoundaries = (lane: DayLane, minutes: number): number =>
		boundaryMinutes.has(lane.cursor + minutes) ? 0 : 1;

	for (const job of sortByMinutesDesc(dayOnlyJobs)) {
		const candidates = lanes.filter(
			(lane) => awakeMinutes - lane.cursor >= job.minutes,
		);
		if (candidates.length === 0) {
			return null;
		}
		const target = candidates.reduce((best, lane) => {
			const bestScore = countNewBoundaries(best, job.minutes);
			const laneScore = countNewBoundaries(lane, job.minutes);
			if (laneScore !== bestScore) {
				return laneScore < bestScore ? lane : best;
			}
			return lane.cursor > best.cursor ? lane : best;
		});
		target.segments.push({
			pokemonId: job.pokemonId,
			startMinute: target.cursor,
			endMinute: target.cursor + job.minutes,
		});
		target.cursor += job.minutes;
		boundaryMinutes.add(target.cursor);
	}
	return lanes;
}

/**
 * 分割を許す配置: 夜担当の昼の分を先頭に並べて巻き付け法で詰める。
 * 起床時刻（0分）にいるメンバーが夜担当なら、その枠の夜担当にする。
 */
function packDayJobsWrapAround(
	nightDayJobs: readonly ScheduleJob[],
	dayOnlyJobs: readonly ScheduleJob[],
	awakeMinutes: number,
): DayLane[] {
	const line: ScheduleJob[] = [
		...sortByMinutesDesc(nightDayJobs.filter((job) => job.minutes > 0)),
		...sortByMinutesDesc(dayOnlyJobs),
	];
	const lanes = createEmptyDayLanes();
	fillLanesWrapAround(lanes, line, awakeMinutes);

	const unassignedNightIds = nightDayJobs.map((job) => job.pokemonId);
	for (const lane of lanes) {
		const first = lane.segments[0];
		if (!first || first.startMinute !== 0) {
			continue;
		}
		const index = unassignedNightIds.indexOf(first.pokemonId);
		if (index >= 0) {
			lane.nightPokemonId = first.pokemonId;
			unassignedNightIds.splice(index, 1);
		}
	}
	for (const lane of lanes) {
		if (lane.nightPokemonId !== null || unassignedNightIds.length === 0) {
			continue;
		}
		lane.nightPokemonId = unassignedNightIds.shift() ?? null;
	}
	return lanes;
}

function toFullDayLane(
	lane: DayLane,
	sleepMinutes: number,
): QuickSimLaneSegment[] {
	const segments: QuickSimLaneSegment[] = [];
	if (lane.nightPokemonId !== null) {
		segments.push({
			pokemonId: lane.nightPokemonId,
			startMinute: 0,
			endMinute: sleepMinutes,
		});
	}
	for (const segment of lane.segments) {
		segments.push({
			pokemonId: segment.pokemonId,
			startMinute: sleepMinutes + segment.startMinute,
			endMinute: sleepMinutes + segment.endMinute,
		});
	}
	return segments;
}

/**
 * Phase 1: 就寝中の入れ替えを行わない配置。満たせなければ null。
 */
function scheduleWithProtectedSleep(
	jobs: readonly ScheduleJob[],
	sleepMinutes: number,
): QuickSimLaneSegment[][] | null {
	const awakeMinutes = MINUTES_PER_DAY - sleepMinutes;

	// 起床後だけでは足りないメンバーは必ず夜担当になる
	const mustNightJobs = sortByMinutesDesc(
		jobs.filter((job) => job.minutes > awakeMinutes),
	);
	if (mustNightJobs.length > MAX_TEAM_SIZE) {
		return null;
	}
	if (mustNightJobs.some((job) => job.minutes < sleepMinutes)) {
		return null;
	}

	// 残りの夜担当は、就寝を丸ごと担当できるメンバーから起用時間の多い順に選ぶ
	const nightJobs: ScheduleJob[] = [...mustNightJobs];
	for (const job of sortByMinutesDesc(jobs)) {
		if (nightJobs.length >= MAX_TEAM_SIZE) {
			break;
		}
		if (job.minutes < sleepMinutes || nightJobs.includes(job)) {
			continue;
		}
		nightJobs.push(job);
	}
	const nightIds = new Set(nightJobs.map((job) => job.pokemonId));

	const nightDayJobs: ScheduleJob[] = nightJobs.map((job) => ({
		pokemonId: job.pokemonId,
		minutes: job.minutes - sleepMinutes,
	}));
	const dayOnlyJobs: ScheduleJob[] = jobs.filter(
		(job) => !nightIds.has(job.pokemonId),
	);
	const totalDayMinutes = sumMinutes(nightDayJobs) + sumMinutes(dayOnlyJobs);
	if (totalDayMinutes > MAX_TEAM_SIZE * awakeMinutes) {
		return null;
	}

	const dayLanes =
		packDayJobsNaturally(nightDayJobs, dayOnlyJobs, awakeMinutes) ??
		packDayJobsWrapAround(nightDayJobs, dayOnlyJobs, awakeMinutes);
	return dayLanes.map((lane) => toFullDayLane(lane, sleepMinutes));
}

/**
 * Phase 2: 就寝中の入れ替えも許して、1日全体を巻き付け法で詰める。
 */
function scheduleWithSleepSwaps(
	jobs: readonly ScheduleJob[],
): QuickSimLaneSegment[][] {
	const lanes = createEmptyDayLanes();
	fillLanesWrapAround(lanes, sortByMinutesDesc(jobs), MINUTES_PER_DAY);
	return lanes.map((lane) =>
		lane.segments.map((segment) => ({
			pokemonId: segment.pokemonId,
			startMinute: segment.startMinute,
			endMinute: segment.endMinute,
		})),
	);
}

/**
 * 枠の区間列を正規化する。
 * 時刻順に並べ、空き時間を null 区間で埋め、隣り合う同じ占有者の区間を結合する。
 */
function normalizeLane(
	segments: readonly QuickSimLaneSegment[],
): QuickSimLaneSegment[] {
	const sorted = [...segments]
		.filter((segment) => segment.endMinute > segment.startMinute)
		.sort((left, right) => left.startMinute - right.startMinute);
	const normalized: QuickSimLaneSegment[] = [];
	let cursor = 0;

	const push = (segment: QuickSimLaneSegment): void => {
		const last = normalized[normalized.length - 1];
		if (last && last.pokemonId === segment.pokemonId) {
			last.endMinute = segment.endMinute;
			return;
		}
		normalized.push({ ...segment });
	};

	for (const segment of sorted) {
		if (segment.startMinute > cursor) {
			push({
				pokemonId: null,
				startMinute: cursor,
				endMinute: segment.startMinute,
			});
		}
		push(segment);
		cursor = segment.endMinute;
	}
	if (cursor < MINUTES_PER_DAY) {
		push({ pokemonId: null, startMinute: cursor, endMinute: MINUTES_PER_DAY });
	}
	return normalized;
}

function hasSwapDuringSleep(
	lanes: readonly QuickSimLaneSegment[][],
	sleepMinutes: number,
): boolean {
	return lanes.some((lane) =>
		lane.some(
			(segment) =>
				segment.startMinute > 0 && segment.startMinute < sleepMinutes,
		),
	);
}

/**
 * スケジュールの整合性を検証し、問題があればその説明を返す。
 * - 各枠が 0〜24h を隙間なく覆っている
 * - 各メンバーの合計時間が目標と一致する
 * - 同じメンバーが同じ時刻に複数の枠へ入っていない
 */
export function validateQuickSimSchedule(
	schedule: QuickSimDaySchedule,
	targetMinutesById: ReadonlyMap<number, number>,
): string[] {
	const errors: string[] = [];
	const totalById = new Map<number, number>();
	const intervalsById = new Map<
		number,
		{ startMinute: number; endMinute: number }[]
	>();

	if (schedule.lanes.length !== MAX_TEAM_SIZE) {
		errors.push(`lane count must be ${MAX_TEAM_SIZE}`);
	}
	schedule.lanes.forEach((lane, laneIndex) => {
		let cursor = 0;
		for (const segment of lane) {
			if (segment.startMinute !== cursor) {
				errors.push(
					`lane ${laneIndex}: gap or overlap at ${segment.startMinute}`,
				);
			}
			if (segment.endMinute <= segment.startMinute) {
				errors.push(
					`lane ${laneIndex}: empty segment at ${segment.startMinute}`,
				);
			}
			cursor = segment.endMinute;
			if (segment.pokemonId === null) {
				continue;
			}
			totalById.set(
				segment.pokemonId,
				(totalById.get(segment.pokemonId) ?? 0) +
					(segment.endMinute - segment.startMinute),
			);
			const intervals = intervalsById.get(segment.pokemonId) ?? [];
			intervals.push({
				startMinute: segment.startMinute,
				endMinute: segment.endMinute,
			});
			intervalsById.set(segment.pokemonId, intervals);
		}
		if (cursor !== MINUTES_PER_DAY) {
			errors.push(`lane ${laneIndex}: ends at ${cursor}`);
		}
	});

	targetMinutesById.forEach((target, pokemonId) => {
		const actual = totalById.get(pokemonId) ?? 0;
		if (actual !== target) {
			errors.push(
				`pokemon ${pokemonId}: ${actual} minutes, expected ${target}`,
			);
		}
	});
	totalById.forEach((_, pokemonId) => {
		if (!targetMinutesById.has(pokemonId)) {
			errors.push(`pokemon ${pokemonId}: not requested`);
		}
	});

	intervalsById.forEach((intervals, pokemonId) => {
		const sorted = [...intervals].sort(
			(left, right) => left.startMinute - right.startMinute,
		);
		for (let index = 1; index < sorted.length; index++) {
			if (sorted[index].startMinute < sorted[index - 1].endMinute) {
				errors.push(
					`pokemon ${pokemonId}: overlapping intervals at ${sorted[index].startMinute}`,
				);
			}
		}
	});

	return errors;
}

/**
 * メンバーごとの1日の目標起用時間（分）。
 * スケジュール生成と同じ丸め・合算・削り込みを適用する。
 */
export function getQuickSimTargetMinutesById(
	members: readonly QuickSimMember[],
): Map<number, number> {
	const jobs = trimRoundingExcess(buildScheduleJobs(members));
	return new Map(jobs.map((job) => [job.pokemonId, job.minutes]));
}

/**
 * 起用率設定から1日分の自動入れ替えスケジュールを生成する。
 */
export function buildQuickSimDaySchedule(
	members: readonly QuickSimMember[],
	timeSlots: readonly TimeSlot[],
): QuickSimScheduleResult {
	const structure = resolveQuickSimDayStructure(timeSlots);
	if (!structure) {
		return { ok: false, error: "noSleepSlot" };
	}
	if (isQuickSimUsageExceeded(members)) {
		return { ok: false, error: "usageExceeded" };
	}
	const jobs = trimRoundingExcess(buildScheduleJobs(members));
	if (jobs.length === 0) {
		return { ok: false, error: "noMembers" };
	}

	const lanes =
		scheduleWithProtectedSleep(jobs, structure.sleepMinutes) ??
		scheduleWithSleepSwaps(jobs);
	const normalizedLanes = lanes.map(normalizeLane);

	return {
		ok: true,
		schedule: {
			lanes: normalizedLanes,
			sleepSlotId: structure.sleepSlotId,
			sleepTime: structure.sleepTime,
			sleepMinutes: structure.sleepMinutes,
			usesSleepSwaps: hasSwapDuringSleep(
				normalizedLanes,
				structure.sleepMinutes,
			),
		},
	};
}
