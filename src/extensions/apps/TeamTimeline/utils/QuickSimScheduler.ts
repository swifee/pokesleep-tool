/**
 * QuickSimScheduler.ts
 * 簡易シミュの起用率・起用方法から、集計期間全体の自動入れ替えスケジュールを生成する。
 *
 * 1日は就寝スロットを起点とした 24 時間で、各枠（チームスロット）を
 * 「誰がいつからいつまで占有するか」の区間列として表す。
 * 内部では期間全体を「枠 × 分」の格子で持ち、最後に区間列へ変換する。
 *
 * 方針:
 * 1. 起用方法が固定のメンバーを、前半 → 後半 → 就寝 → 日中 の順に先に配置する。
 *    - 前半: 期間の先頭から、期間全体の起用時間に達するまで連続して起用する。
 *    - 後半: 期間の末尾から遡って、期間全体の起用時間に達するまで連続して起用する。
 *    - 就寝: 毎日、就寝時刻から起用時間だけ連続して起用する。
 *    - 日中: 毎日、起床時刻から起用時間だけ連続して起用する（足りなければ就寝中へ回る）。
 *    希望の時刻に空き枠がなければ、その方法の中で最も近い空きへずらす。
 * 2. 均等のメンバーは、残った空きに毎日同じ時間だけ詰める。前半・後半で日ごとの
 *    空きが偏るときは、足りない分を空きのある日に均等に振り分ける。
 *    1日の中では就寝中（就寝〜起床）に入れ替えない前提で組む（Phase 1）。
 *    - 就寝を丸ごと担当できるメンバー（起用時間 >= 就寝時間）を夜担当に選ぶ。
 *    - 残りの起用時間を起床後の時間帯に詰める。まずは各メンバーが連続して
 *      1つの枠に入る「自然な」配置を試し、収まらなければ枠順に詰める
 *      （McNaughton の巻き付け法）。
 *    それでも満たせないときだけ、就寝中の入れ替えを許す（Phase 2）。
 * 3. 最後に枠の割り当てを引き直す（rethreadLanes）。上の手順は「誰がいつ編成に
 *    入っているか」だけを決めるものとみなし、続投するメンバーは同じ枠に居続け、
 *    入れ替わるメンバーは抜けたメンバーの枠に入るように枠を付け替える。
 *    これで続投中のポケモンの列が変わることはなくなる。
 *
 * 同時に編成できないメンバーの組（とくべつなポケモンのルール。`QuickSimExclusionMap`）が
 * あるときは、どの手順でも「相手が別の枠にいる時刻」を自分がいる時刻と同じく避けて
 * 配置する。避けきれずに置けなかった分は起用率を満たせないメンバーとして報告する。
 */

import {
	DEFAULT_QUICK_SIM_USAGE_MODE,
	EMPTY_QUICK_SIM_EXCLUSION_MAP,
	MINUTES_PER_DAY,
	QUICK_SIM_MAX_USAGE_PERCENT,
	QUICK_SIM_MIN_USAGE_PERCENT,
	QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
	QUICK_SIM_USAGE_MODE_PRIORITY,
	type QuickSimDaySchedule,
	type QuickSimDayScheduleResult,
	type QuickSimExclusionMap,
	type QuickSimLaneSegment,
	type QuickSimMember,
	type QuickSimSchedule,
	type QuickSimScheduleResult,
	type QuickSimUsageMode,
} from "../types/QuickSimTypes";
import { MAX_TEAM_SIZE } from "../types/TeamTimelineTypes";
import {
	clampSimulationDays,
	getDisplayLabel,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { buildExpandedTimeline } from "./TimelineDayExpansion";
import { calculateDuration } from "./TimeSlotUtils";

/** 1日あたりの全枠の合計分数 */
const TOTAL_LANE_MINUTES_PER_DAY = MAX_TEAM_SIZE * MINUTES_PER_DAY;

/** 格子の空きを表す値 */
const FREE = -1;

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

/** メンバーごとの1日の起用時間（分）と起用方法 */
interface ScheduleJob {
	pokemonId: number;
	minutes: number;
	mode: QuickSimUsageMode;
}

/** 1日の中で配置する起用時間（分） */
interface DayJob {
	pokemonId: number;
	minutes: number;
}

/** 1日の空き区間 */
interface FreeInterval {
	startMinute: number;
	endMinute: number;
}

/** 自然な配置の候補 */
interface PlacementCandidate {
	laneIndex: number;
	start: number;
	/** 空き区間の余り（小さいほどぴったり埋まる） */
	slack: number;
	/** 新しい切り替わり時刻を増やすなら 1 */
	score: number;
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
 * 起用方法が配置に影響するか。
 * 0% はスケジュールに含めず、100% は常に1枠を占有するので、1〜99% のときだけ影響する。
 */
export function isQuickSimUsageModeEffective(percent: number): boolean {
	const clamped = clampQuickSimUsagePercent(percent);
	return (
		clamped > QUICK_SIM_MIN_USAGE_PERCENT &&
		clamped < QUICK_SIM_MAX_USAGE_PERCENT
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

function allLaneIndexes(): number[] {
	return Array.from({ length: MAX_TEAM_SIZE }, (_, index) => index);
}

/**
 * メンバー設定を起用時間(分)のジョブに変換する。
 * 同じポケモンが重複しているときは合算し（起用方法は先頭のもの）、起用率 0 のメンバーは除く。
 */
function buildScheduleJobs(members: readonly QuickSimMember[]): ScheduleJob[] {
	const jobById = new Map<number, ScheduleJob>();
	const order: number[] = [];
	for (const member of members) {
		const minutes = usagePercentToMinutes(member.usagePercent);
		if (minutes <= 0) {
			continue;
		}
		const existing = jobById.get(member.pokemonId);
		if (existing) {
			existing.minutes = Math.min(MINUTES_PER_DAY, existing.minutes + minutes);
			continue;
		}
		order.push(member.pokemonId);
		jobById.set(member.pokemonId, {
			pokemonId: member.pokemonId,
			minutes,
			mode: member.usageMode ?? DEFAULT_QUICK_SIM_USAGE_MODE,
		});
	}
	return order.flatMap((pokemonId) => {
		const job = jobById.get(pokemonId);
		return job ? [{ ...job }] : [];
	});
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

/**
 * 1日分の枠の占有状況（枠 × 分）。
 * 均等メンバーの配置を試すときの作業用で、失敗したら捨てて別の方法を試す。
 */
class DayGrid {
	readonly lanes: Int32Array[];

	constructor(
		readonly exclusions: QuickSimExclusionMap,
		lanes?: readonly Int32Array[],
	) {
		this.lanes = lanes
			? lanes.map((lane) => Int32Array.from(lane))
			: allLaneIndexes().map(() => new Int32Array(MINUTES_PER_DAY).fill(FREE));
	}

	clone(): DayGrid {
		return new DayGrid(this.exclusions, this.lanes);
	}

	isFree(laneIndex: number, minute: number): boolean {
		return this.lanes[laneIndex][minute] === FREE;
	}

	/** 同じ時刻に別の枠へ入っているか */
	isPresent(pokemonId: number, minute: number): boolean {
		return this.lanes.some((lane) => lane[minute] === pokemonId);
	}

	/**
	 * その時刻に置けないか。
	 * 自分が別の枠にいる、または同時に編成できないメンバーがどこかの枠にいる。
	 */
	isBlocked(pokemonId: number, minute: number): boolean {
		const excluded = this.exclusions.get(pokemonId);
		for (const lane of this.lanes) {
			const occupant = lane[minute];
			if (occupant === FREE) {
				continue;
			}
			if (occupant === pokemonId || excluded?.has(occupant)) {
				return true;
			}
		}
		return false;
	}

	isRangeFree(laneIndex: number, start: number, end: number): boolean {
		const lane = this.lanes[laneIndex];
		for (let minute = start; minute < end; minute++) {
			if (lane[minute] !== FREE) {
				return false;
			}
		}
		return true;
	}

	/** 範囲内に置けない時刻があるか（枠は問わない） */
	isRangeBlocked(pokemonId: number, start: number, end: number): boolean {
		for (let minute = start; minute < end; minute++) {
			if (this.isBlocked(pokemonId, minute)) {
				return true;
			}
		}
		return false;
	}

	occupyRange(
		laneIndex: number,
		start: number,
		end: number,
		pokemonId: number,
	): void {
		this.lanes[laneIndex].fill(pokemonId, start, end);
	}

	/** 指定した時刻から、そのメンバーを連続して置ける長さ（枠が空きで、置けない時刻がない） */
	availableRunFrom(
		pokemonId: number,
		laneIndex: number,
		start: number,
	): number {
		const lane = this.lanes[laneIndex];
		let minute = start;
		while (
			minute < MINUTES_PER_DAY &&
			lane[minute] === FREE &&
			!this.isBlocked(pokemonId, minute)
		) {
			minute++;
		}
		return minute - start;
	}

	/** 範囲内で、そのメンバーを置ける区間（枠が空きで、置けない時刻がない） */
	availableIntervals(
		pokemonId: number,
		laneIndex: number,
		start: number,
		end: number,
	): FreeInterval[] {
		const lane = this.lanes[laneIndex];
		const intervals: FreeInterval[] = [];
		let minute = start;
		while (minute < end) {
			if (lane[minute] !== FREE || this.isBlocked(pokemonId, minute)) {
				minute++;
				continue;
			}
			const intervalStart = minute;
			while (
				minute < end &&
				lane[minute] === FREE &&
				!this.isBlocked(pokemonId, minute)
			) {
				minute++;
			}
			intervals.push({ startMinute: intervalStart, endMinute: minute });
		}
		return intervals;
	}

	countFreeMinutes(start: number, end: number): number {
		let count = 0;
		for (const lane of this.lanes) {
			for (let minute = start; minute < end; minute++) {
				if (lane[minute] === FREE) {
					count++;
				}
			}
		}
		return count;
	}

	/** 少なくとも1枠が空いている分数 */
	countMinutesWithFreeLane(): number {
		let count = 0;
		for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
			if (this.lanes.some((lane) => lane[minute] === FREE)) {
				count++;
			}
		}
		return count;
	}

	/** 既存の切り替わり時刻（区間の始まりと終わり） */
	collectBoundaries(): Set<number> {
		const boundaries = new Set<number>([0, MINUTES_PER_DAY]);
		for (const lane of this.lanes) {
			for (let minute = 1; minute < MINUTES_PER_DAY; minute++) {
				if (lane[minute] !== lane[minute - 1]) {
					boundaries.add(minute);
				}
			}
		}
		return boundaries;
	}

	/**
	 * 枠順にジョブを詰める（McNaughton の巻き付け法の一般形）。
	 * 同じ時刻に別の枠へ入らないよう、自分（や同時に編成できないメンバー）が
	 * 既にいる分は飛ばす。置けなかった分数を返す。
	 */
	fillLaneMajor(
		job: DayJob,
		laneOrder: readonly number[],
		start: number,
		end: number,
	): number {
		let remaining = job.minutes;
		for (const laneIndex of laneOrder) {
			const lane = this.lanes[laneIndex];
			for (let minute = start; minute < end && remaining > 0; minute++) {
				if (lane[minute] !== FREE || this.isBlocked(job.pokemonId, minute)) {
					continue;
				}
				lane[minute] = job.pokemonId;
				remaining--;
			}
			if (remaining <= 0) {
				break;
			}
		}
		return remaining;
	}

	toLaneSegments(): QuickSimLaneSegment[][] {
		return this.lanes.map((lane) => {
			const segments: QuickSimLaneSegment[] = [];
			let start = 0;
			for (let minute = 1; minute <= MINUTES_PER_DAY; minute++) {
				if (minute < MINUTES_PER_DAY && lane[minute] === lane[start]) {
					continue;
				}
				segments.push({
					pokemonId: lane[start] === FREE ? null : lane[start],
					startMinute: start,
					endMinute: minute,
				});
				start = minute;
			}
			return segments;
		});
	}
}

/**
 * 期間全体の枠の占有状況（日ごとの DayGrid）
 */
class PeriodGrid {
	readonly days: DayGrid[];
	/** 枠ごとの使用済み分数。固定配置のメンバーを少ない枠に寄せるために使う */
	private readonly usedMinutesByLane: number[] = allLaneIndexes().map(() => 0);

	constructor(dayCount: number, exclusions: QuickSimExclusionMap) {
		this.days = Array.from({ length: dayCount }, () => new DayGrid(exclusions));
	}

	get totalMinutes(): number {
		return this.days.length * MINUTES_PER_DAY;
	}

	private split(minute: number): { day: DayGrid; minuteInDay: number } {
		const dayIndex = Math.floor(minute / MINUTES_PER_DAY);
		return {
			day: this.days[dayIndex],
			minuteInDay: minute - dayIndex * MINUTES_PER_DAY,
		};
	}

	occupantAt(laneIndex: number, minute: number): number {
		if (minute < 0 || minute >= this.totalMinutes) {
			return FREE;
		}
		const { day, minuteInDay } = this.split(minute);
		return day.lanes[laneIndex][minuteInDay];
	}

	/**
	 * 1分だけ配置する。空き枠がない、または同時に編成できないメンバーがいれば false。
	 * 直前（または直後）の分で使っていた枠 → 使用済みの分数が多い枠 → 若い番号の枠
	 * の順に選ぶ。固定配置のメンバー同士を同じ枠に寄せ（前半が抜けた枠に後半が入るなど）、
	 * まるごと空いた枠を均等メンバーのために残す。
	 */
	occupyMinute(
		pokemonId: number,
		minute: number,
		adjacentMinute: number,
	): boolean {
		const { day, minuteInDay } = this.split(minute);
		if (day.isPresent(pokemonId, minuteInDay)) {
			return true;
		}
		if (day.isBlocked(pokemonId, minuteInDay)) {
			return false;
		}
		const byUsage = allLaneIndexes().sort(
			(left, right) =>
				this.usedMinutesByLane[right] - this.usedMinutesByLane[left] ||
				left - right,
		);
		const candidates = [
			...byUsage.filter(
				(laneIndex) => this.occupantAt(laneIndex, adjacentMinute) === pokemonId,
			),
			...byUsage,
		];
		const laneIndex = candidates.find((candidate) =>
			day.isFree(candidate, minuteInDay),
		);
		if (laneIndex === undefined) {
			return false;
		}
		day.lanes[laneIndex][minuteInDay] = pokemonId;
		this.usedMinutesByLane[laneIndex] += 1;
		return true;
	}

	/**
	 * 時刻の列に沿って、空き枠へ順に配置する。置けなかった分数を返す。
	 */
	sweep(
		pokemonId: number,
		minutes: number,
		timeline: Iterable<number>,
	): number {
		let remaining = minutes;
		let previous = -1;
		for (const minute of timeline) {
			if (remaining <= 0) {
				break;
			}
			if (this.occupyMinute(pokemonId, minute, previous)) {
				remaining--;
			}
			previous = minute;
		}
		return remaining;
	}

	/**
	 * 枠の割り当てを引き直す。各時刻に「誰が編成に入っているか」は変えずに、
	 * 続投するメンバーは同じ枠に残し、新しく入るメンバーは同じ時刻に抜けた
	 * メンバーの枠（なければ若い番号の空き枠）へ入れる。
	 */
	rethreadLanes(): void {
		const laneById = new Map<number, number>();
		for (const day of this.days) {
			const source = day.lanes.map((lane) => Int32Array.from(lane));
			for (const lane of day.lanes) {
				lane.fill(FREE);
			}
			for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
				const present = new Set<number>();
				for (const lane of source) {
					if (lane[minute] !== FREE) {
						present.add(lane[minute]);
					}
				}
				const vacated: number[] = [];
				for (const [pokemonId, laneIndex] of laneById) {
					if (!present.has(pokemonId)) {
						laneById.delete(pokemonId);
						vacated.push(laneIndex);
					}
				}
				const usedLanes = new Set(laneById.values());
				const freeLanes = [
					...vacated.sort((left, right) => left - right),
					...allLaneIndexes().filter(
						(laneIndex) =>
							!usedLanes.has(laneIndex) && !vacated.includes(laneIndex),
					),
				];
				for (const pokemonId of present) {
					if (laneById.has(pokemonId)) {
						continue;
					}
					const laneIndex = freeLanes.shift();
					if (laneIndex === undefined) {
						throw new Error("Quick sim rethread ran out of lanes");
					}
					laneById.set(pokemonId, laneIndex);
				}
				for (const [pokemonId, laneIndex] of laneById) {
					day.lanes[laneIndex][minute] = pokemonId;
				}
			}
		}
	}

	countMinutesById(): Map<number, number> {
		const totals = new Map<number, number>();
		for (const day of this.days) {
			for (const lane of day.lanes) {
				for (const occupant of lane) {
					if (occupant === FREE) {
						continue;
					}
					totals.set(occupant, (totals.get(occupant) ?? 0) + 1);
				}
			}
		}
		return totals;
	}
}

function* ascendingMinutes(start: number, end: number): Generator<number> {
	for (let minute = start; minute < end; minute++) {
		yield minute;
	}
}

function* descendingMinutes(start: number, end: number): Generator<number> {
	for (let minute = end - 1; minute >= start; minute--) {
		yield minute;
	}
}

/** 起床時刻から始めて、就寝中へ回り込む1日分の時刻列 */
function* daytimeFirstMinutes(
	dayIndex: number,
	sleepMinutes: number,
): Generator<number> {
	const origin = dayIndex * MINUTES_PER_DAY;
	for (let offset = 0; offset < MINUTES_PER_DAY; offset++) {
		yield origin + ((sleepMinutes + offset) % MINUTES_PER_DAY);
	}
}

function compareFixedJobs(left: ScheduleJob, right: ScheduleJob): number {
	const priority =
		QUICK_SIM_USAGE_MODE_PRIORITY[left.mode] -
		QUICK_SIM_USAGE_MODE_PRIORITY[right.mode];
	if (priority !== 0) {
		return priority;
	}
	return right.minutes - left.minutes;
}

/**
 * 起用方法が固定のメンバーを、優先順位の順に配置する。
 */
function placeFixedJobs(
	grid: PeriodGrid,
	jobs: readonly ScheduleJob[],
	sleepMinutes: number,
): void {
	const dayCount = grid.days.length;
	const sorted = jobs
		.filter((job) => job.mode !== "even")
		.sort(compareFixedJobs);
	for (const job of sorted) {
		switch (job.mode) {
			case "sleep":
				for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
					const origin = dayIndex * MINUTES_PER_DAY;
					grid.sweep(
						job.pokemonId,
						job.minutes,
						ascendingMinutes(origin, origin + MINUTES_PER_DAY),
					);
				}
				break;
			case "daytime":
				for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
					grid.sweep(
						job.pokemonId,
						job.minutes,
						daytimeFirstMinutes(dayIndex, sleepMinutes),
					);
				}
				break;
			case "firstHalf":
				grid.sweep(
					job.pokemonId,
					job.minutes * dayCount,
					ascendingMinutes(0, grid.totalMinutes),
				);
				break;
			case "secondHalf":
				grid.sweep(
					job.pokemonId,
					job.minutes * dayCount,
					descendingMinutes(0, grid.totalMinutes),
				);
				break;
			default:
				break;
		}
	}
}

/**
 * 均等メンバーの日ごとの起用時間を決める。
 * 基本は毎日同じ時間。空きが足りない日は起用時間の多いメンバーから順に空きを割り当て
 * （多いメンバーほど他の日で取り返しにくい）、足りなかった分を空きのある日へ
 * 均等に振り分ける。1日の上限は「どこかの枠が空いている分数」。
 */
function allocateEvenMinutesPerDay(
	grid: PeriodGrid,
	jobs: readonly ScheduleJob[],
): number[][] {
	const dayCount = grid.days.length;
	const capacity = grid.days.map((day) =>
		day.countFreeMinutes(0, MINUTES_PER_DAY),
	);
	const capPerMember = grid.days.map((day) =>
		Math.min(MINUTES_PER_DAY, day.countMinutesWithFreeLane()),
	);
	const order = jobs
		.map((job, index) => ({ index, minutes: job.minutes }))
		.sort((left, right) => right.minutes - left.minutes);

	const allocation = jobs.map(() => Array.from({ length: dayCount }, () => 0));
	for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
		let remaining = capacity[dayIndex];
		for (const { index, minutes } of order) {
			const minutesForDay = Math.min(
				minutes,
				capPerMember[dayIndex],
				remaining,
			);
			allocation[index][dayIndex] = minutesForDay;
			remaining -= minutesForDay;
		}
	}

	const spareOf = (dayIndex: number): number =>
		capacity[dayIndex] -
		allocation.reduce((sum, row) => sum + row[dayIndex], 0);
	for (const { index } of order) {
		const row = allocation[index];
		let deficit =
			jobs[index].minutes * dayCount -
			row.reduce((sum, value) => sum + value, 0);
		while (deficit > 0) {
			const candidates: number[] = [];
			for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
				if (row[dayIndex] < capPerMember[dayIndex] && spareOf(dayIndex) > 0) {
					candidates.push(dayIndex);
				}
			}
			if (candidates.length === 0) {
				break;
			}
			const share = Math.ceil(deficit / candidates.length);
			let progressed = false;
			for (const dayIndex of candidates) {
				const add = Math.min(
					share,
					capPerMember[dayIndex] - row[dayIndex],
					spareOf(dayIndex),
					deficit,
				);
				if (add <= 0) {
					continue;
				}
				row[dayIndex] += add;
				deficit -= add;
				progressed = true;
				if (deficit <= 0) {
					break;
				}
			}
			if (!progressed) {
				break;
			}
		}
	}
	return allocation;
}

function isBetterCandidate(
	candidate: PlacementCandidate,
	best: PlacementCandidate | null,
): boolean {
	if (best === null) {
		return true;
	}
	if (candidate.score !== best.score) {
		return candidate.score < best.score;
	}
	return candidate.slack < best.slack;
}

/**
 * 「自然な」配置: 夜担当は起床後もそのまま自分の枠に残り、
 * 昼だけのメンバーは分割せずに1つの空き区間へ入れる。
 *
 * 入れ替えのために追加する時刻（既存の時間帯にない切り替わり）は、
 * その時刻にチーム全員のスキル発動が起きるため、できるだけ増やさない。
 * 区間の始まりは常に既存の切り替わり時刻（起床、または前の占有者の終わり）なので、
 * 区間の終わりが新しい時刻になるかどうかで候補の枠を選ぶ。
 * 同点なら残り時間がもっとも少ない区間（ぴったり埋まる区間）を優先する。
 * 収まらないメンバーがいれば null。
 */
/**
 * 夜担当の枠を選ぶ。
 * 起床後の残りがそのまま収まる枠 → 起床後の空きが長い枠 → 若い番号の枠 の順に優先する。
 */
function chooseNightLane(
	grid: DayGrid,
	candidates: readonly number[],
	job: DayJob,
	sleepMinutes: number,
): number {
	const remainder = job.minutes - sleepMinutes;
	const rank = (laneIndex: number): [number, number] => {
		const run = grid.availableRunFrom(job.pokemonId, laneIndex, sleepMinutes);
		return [run >= remainder ? 1 : 0, run];
	};
	return candidates.reduce((best, candidate) => {
		const bestRank = rank(best);
		const candidateRank = rank(candidate);
		for (let index = 0; index < bestRank.length; index++) {
			if (candidateRank[index] !== bestRank[index]) {
				return candidateRank[index] > bestRank[index] ? candidate : best;
			}
		}
		return best;
	});
}

function packDayJobsNaturally(
	base: DayGrid,
	nightCapableLanes: readonly number[],
	nightJobs: readonly DayJob[],
	dayOnlyJobs: readonly DayJob[],
	sleepMinutes: number,
): DayGrid | null {
	const grid = base.clone();
	const boundaries = grid.collectBoundaries();
	boundaries.add(sleepMinutes);
	const remainingLanes = [...nightCapableLanes];
	const leftovers: DayJob[] = [];

	for (const job of nightJobs) {
		if (remainingLanes.length === 0) {
			return null;
		}
		const laneIndex = chooseNightLane(grid, remainingLanes, job, sleepMinutes);
		remainingLanes.splice(remainingLanes.indexOf(laneIndex), 1);
		const remainder = job.minutes - sleepMinutes;
		const run = Math.min(
			remainder,
			grid.availableRunFrom(job.pokemonId, laneIndex, sleepMinutes),
		);
		grid.occupyRange(laneIndex, 0, sleepMinutes + run, job.pokemonId);
		boundaries.add(sleepMinutes + run);
		if (remainder > run) {
			leftovers.push({ pokemonId: job.pokemonId, minutes: remainder - run });
		}
	}

	for (const job of sortByMinutesDesc([...dayOnlyJobs, ...leftovers])) {
		let best: PlacementCandidate | null = null;
		for (const laneIndex of allLaneIndexes()) {
			for (const interval of grid.availableIntervals(
				job.pokemonId,
				laneIndex,
				sleepMinutes,
				MINUTES_PER_DAY,
			)) {
				const length = interval.endMinute - interval.startMinute;
				if (length < job.minutes) {
					continue;
				}
				const start = interval.startMinute;
				const end = start + job.minutes;
				const candidate: PlacementCandidate = {
					laneIndex,
					start,
					slack: length - job.minutes,
					score: boundaries.has(end) ? 0 : 1,
				};
				if (isBetterCandidate(candidate, best)) {
					best = candidate;
				}
			}
		}
		if (best === null) {
			return null;
		}
		grid.occupyRange(
			best.laneIndex,
			best.start,
			best.start + job.minutes,
			job.pokemonId,
		);
		boundaries.add(best.start + job.minutes);
	}
	return grid;
}

/**
 * 分割を許す配置: 夜担当の昼の分を先頭に並べて枠順に詰める。
 * 起床時刻にいるメンバーが夜担当なら、その枠の夜担当にする。
 * 収まらないメンバーがいれば null。
 */
function packDayJobsWrapAround(
	base: DayGrid,
	nightCapableLanes: readonly number[],
	nightJobs: readonly DayJob[],
	dayOnlyJobs: readonly DayJob[],
	sleepMinutes: number,
): DayGrid | null {
	const grid = base.clone();
	const otherLanes = allLaneIndexes().filter(
		(laneIndex) => !nightCapableLanes.includes(laneIndex),
	);
	const laneOrder = [...nightCapableLanes, ...otherLanes];
	const line: DayJob[] = [
		...sortByMinutesDesc(
			nightJobs
				.map((job) => ({
					pokemonId: job.pokemonId,
					minutes: job.minutes - sleepMinutes,
				}))
				.filter((job) => job.minutes > 0),
		),
		...sortByMinutesDesc(dayOnlyJobs),
	];
	for (const job of line) {
		if (grid.fillLaneMajor(job, laneOrder, sleepMinutes, MINUTES_PER_DAY) > 0) {
			return null;
		}
	}

	const unassigned = nightJobs.map((job) => job.pokemonId);
	const assignedLanes = new Set<number>();
	for (const laneIndex of nightCapableLanes) {
		const index = unassigned.indexOf(grid.lanes[laneIndex][sleepMinutes]);
		if (index < 0) {
			continue;
		}
		grid.occupyRange(laneIndex, 0, sleepMinutes, unassigned[index]);
		unassigned.splice(index, 1);
		assignedLanes.add(laneIndex);
	}
	for (const laneIndex of nightCapableLanes) {
		if (assignedLanes.has(laneIndex) || unassigned.length === 0) {
			continue;
		}
		const pokemonId = unassigned.shift();
		if (pokemonId === undefined) {
			break;
		}
		grid.occupyRange(laneIndex, 0, sleepMinutes, pokemonId);
	}
	return grid;
}

/**
 * Phase 1: 就寝中の入れ替えを行わない配置。満たせなければ null。
 */
function scheduleDayWithProtectedSleep(
	base: DayGrid,
	jobs: readonly DayJob[],
	sleepMinutes: number,
): DayGrid | null {
	const awakeMinutes = MINUTES_PER_DAY - sleepMinutes;
	const nightCapableLanes = allLaneIndexes().filter((laneIndex) =>
		base.isRangeFree(laneIndex, 0, sleepMinutes),
	);
	// 就寝中に同時に編成できないメンバー（固定配置、または他の夜担当）がいると夜担当にできない
	const canTakeNight = (job: DayJob, chosen: readonly DayJob[]): boolean =>
		!base.isRangeBlocked(job.pokemonId, 0, sleepMinutes) &&
		chosen.every(
			(other) => !base.exclusions.get(job.pokemonId)?.has(other.pokemonId),
		);

	// 起床後だけでは足りないメンバーは必ず夜担当になる
	const mustNightJobs = sortByMinutesDesc(
		jobs.filter((job) => job.minutes > awakeMinutes),
	);
	if (mustNightJobs.length > nightCapableLanes.length) {
		return null;
	}
	if (mustNightJobs.some((job) => job.minutes < sleepMinutes)) {
		return null;
	}
	if (
		mustNightJobs.some(
			(job, index) => !canTakeNight(job, mustNightJobs.slice(0, index)),
		)
	) {
		return null;
	}

	// 残りの夜担当は、就寝を丸ごと担当できるメンバーから起用時間の多い順に選ぶ
	const nightJobs: DayJob[] = [...mustNightJobs];
	for (const job of sortByMinutesDesc(jobs)) {
		if (nightJobs.length >= nightCapableLanes.length) {
			break;
		}
		if (
			job.minutes < sleepMinutes ||
			nightJobs.includes(job) ||
			!canTakeNight(job, nightJobs)
		) {
			continue;
		}
		nightJobs.push(job);
	}
	const nightIds = new Set(nightJobs.map((job) => job.pokemonId));
	const dayOnlyJobs = jobs.filter((job) => !nightIds.has(job.pokemonId));
	const totalDayMinutes =
		sumMinutes(nightJobs) -
		nightJobs.length * sleepMinutes +
		sumMinutes(dayOnlyJobs);
	if (totalDayMinutes > base.countFreeMinutes(sleepMinutes, MINUTES_PER_DAY)) {
		return null;
	}

	return (
		packDayJobsNaturally(
			base,
			nightCapableLanes,
			nightJobs,
			dayOnlyJobs,
			sleepMinutes,
		) ??
		packDayJobsWrapAround(
			base,
			nightCapableLanes,
			nightJobs,
			dayOnlyJobs,
			sleepMinutes,
		)
	);
}

/**
 * Phase 2: 就寝中の入れ替えも許して、1日全体を枠順に詰める。
 * 置けなかった分は切り捨てる（起用率を満たせないメンバーとして報告する）。
 */
function scheduleDayWithSleepSwaps(
	base: DayGrid,
	jobs: readonly DayJob[],
): DayGrid {
	const grid = base.clone();
	const laneOrder = allLaneIndexes();
	for (const job of sortByMinutesDesc(jobs)) {
		grid.fillLaneMajor(job, laneOrder, 0, MINUTES_PER_DAY);
	}
	return grid;
}

/**
 * 均等メンバーを、固定配置の後の空きへ日ごとに詰める。
 */
function placeEvenJobs(
	grid: PeriodGrid,
	jobs: readonly ScheduleJob[],
	sleepMinutes: number,
): void {
	const evenJobs = jobs.filter((job) => job.mode === "even");
	if (evenJobs.length === 0) {
		return;
	}
	const allocation = allocateEvenMinutesPerDay(grid, evenJobs);
	grid.days.forEach((day, dayIndex) => {
		const dayJobs: DayJob[] = evenJobs
			.map((job, index) => ({
				pokemonId: job.pokemonId,
				minutes: allocation[index][dayIndex],
			}))
			.filter((job) => job.minutes > 0);
		if (dayJobs.length === 0) {
			return;
		}
		const placed =
			scheduleDayWithProtectedSleep(day, dayJobs, sleepMinutes) ??
			scheduleDayWithSleepSwaps(day, dayJobs);
		placed.lanes.forEach((lane, laneIndex) => {
			day.lanes[laneIndex].set(lane);
		});
	});
}

function hasSwapDuringSleep(
	dayLanes: readonly QuickSimLaneSegment[][][],
	sleepMinutes: number,
): boolean {
	return dayLanes.some((lanes) =>
		lanes.some((lane) =>
			lane.some(
				(segment) =>
					segment.startMinute > 0 && segment.startMinute < sleepMinutes,
			),
		),
	);
}

function validateDayLanes(
	lanes: readonly QuickSimLaneSegment[][],
	label: string,
	errors: string[],
	totalById: Map<number, number>,
): void {
	const intervalsById = new Map<
		number,
		{ startMinute: number; endMinute: number }[]
	>();
	if (lanes.length !== MAX_TEAM_SIZE) {
		errors.push(`${label}lane count must be ${MAX_TEAM_SIZE}`);
	}
	lanes.forEach((lane, laneIndex) => {
		let cursor = 0;
		for (const segment of lane) {
			if (segment.startMinute !== cursor) {
				errors.push(
					`${label}lane ${laneIndex}: gap or overlap at ${segment.startMinute}`,
				);
			}
			if (segment.endMinute <= segment.startMinute) {
				errors.push(
					`${label}lane ${laneIndex}: empty segment at ${segment.startMinute}`,
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
			errors.push(`${label}lane ${laneIndex}: ends at ${cursor}`);
		}
	});

	intervalsById.forEach((intervals, pokemonId) => {
		const sorted = [...intervals].sort(
			(left, right) => left.startMinute - right.startMinute,
		);
		for (let index = 1; index < sorted.length; index++) {
			if (sorted[index].startMinute < sorted[index - 1].endMinute) {
				errors.push(
					`${label}pokemon ${pokemonId}: overlapping intervals at ${sorted[index].startMinute}`,
				);
			}
		}
	});
}

/**
 * 同時に編成できないメンバーが同じ時刻に別の枠へ入っていないか。
 */
function validateDayExclusions(
	lanes: readonly QuickSimLaneSegment[][],
	label: string,
	exclusions: QuickSimExclusionMap,
	errors: string[],
): void {
	const segments = lanes.flatMap((lane) =>
		lane.filter((segment) => segment.pokemonId !== null),
	);
	for (let left = 0; left < segments.length; left++) {
		const leftId = segments[left].pokemonId;
		if (leftId === null) {
			continue;
		}
		const excluded = exclusions.get(leftId);
		if (!excluded) {
			continue;
		}
		for (let right = left + 1; right < segments.length; right++) {
			const rightId = segments[right].pokemonId;
			if (rightId === null || !excluded.has(rightId)) {
				continue;
			}
			const overlapStart = Math.max(
				segments[left].startMinute,
				segments[right].startMinute,
			);
			const overlapEnd = Math.min(
				segments[left].endMinute,
				segments[right].endMinute,
			);
			if (overlapStart < overlapEnd) {
				errors.push(
					`${label}pokemon ${leftId} and ${rightId}: both present at ${overlapStart}`,
				);
			}
		}
	}
}

function validateTotals(
	totalById: ReadonlyMap<number, number>,
	targetMinutesById: ReadonlyMap<number, number>,
	errors: string[],
): void {
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
}

/**
 * 1日分のスケジュールの整合性を検証し、問題があればその説明を返す。
 * - 各枠が 0〜24h を隙間なく覆っている
 * - 各メンバーの合計時間が目標と一致する
 * - 同じメンバーが同じ時刻に複数の枠へ入っていない
 * - 同時に編成できないメンバーが同じ時刻に入っていない
 */
export function validateQuickSimSchedule(
	schedule: QuickSimDaySchedule,
	targetMinutesById: ReadonlyMap<number, number>,
	exclusions: QuickSimExclusionMap = EMPTY_QUICK_SIM_EXCLUSION_MAP,
): string[] {
	const errors: string[] = [];
	const totalById = new Map<number, number>();
	validateDayLanes(schedule.lanes, "", errors, totalById);
	validateDayExclusions(schedule.lanes, "", exclusions, errors);
	validateTotals(totalById, targetMinutesById, errors);
	return errors;
}

/**
 * 期間全体のスケジュールの整合性を検証し、問題があればその説明を返す。
 * 目標は期間全体の合計分数で与える。
 */
export function validateQuickSimMultiDaySchedule(
	schedule: QuickSimSchedule,
	targetMinutesById: ReadonlyMap<number, number>,
	exclusions: QuickSimExclusionMap = EMPTY_QUICK_SIM_EXCLUSION_MAP,
): string[] {
	const errors: string[] = [];
	const totalById = new Map<number, number>();
	schedule.dayLanes.forEach((lanes, dayIndex) => {
		validateDayLanes(lanes, `day ${dayIndex}: `, errors, totalById);
		validateDayExclusions(lanes, `day ${dayIndex}: `, exclusions, errors);
	});
	validateTotals(totalById, targetMinutesById, errors);
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
 * メンバーごとの期間全体の目標起用時間（分）。
 */
export function getQuickSimTotalTargetMinutesById(
	members: readonly QuickSimMember[],
	simulationDays: number,
): Map<number, number> {
	const days = clampSimulationDays(simulationDays);
	const perDay = getQuickSimTargetMinutesById(members);
	return new Map(
		[...perDay.entries()].map(([pokemonId, minutes]) => [
			pokemonId,
			minutes * days,
		]),
	);
}

/**
 * 起用率・起用方法から、集計期間全体の自動入れ替えスケジュールを生成する。
 * `exclusions` に挙げた同時に編成できないメンバーの組は、同じ時刻に別の枠へ入れない。
 */
export function buildQuickSimSchedule(
	members: readonly QuickSimMember[],
	timeSlots: readonly TimeSlot[],
	simulationDays: number,
	exclusions: QuickSimExclusionMap = EMPTY_QUICK_SIM_EXCLUSION_MAP,
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

	const dayCount = clampSimulationDays(simulationDays);
	const grid = new PeriodGrid(dayCount, exclusions);
	placeFixedJobs(grid, jobs, structure.sleepMinutes);
	placeEvenJobs(grid, jobs, structure.sleepMinutes);
	grid.rethreadLanes();

	const actualById = grid.countMinutesById();
	const unmetPokemonIds = jobs
		.filter(
			(job) => (actualById.get(job.pokemonId) ?? 0) < job.minutes * dayCount,
		)
		.map((job) => job.pokemonId);
	const dayLanes = grid.days.map((day) => day.toLaneSegments());

	return {
		ok: true,
		schedule: {
			dayLanes,
			sleepSlotId: structure.sleepSlotId,
			sleepTime: structure.sleepTime,
			sleepMinutes: structure.sleepMinutes,
			usesSleepSwaps: hasSwapDuringSleep(dayLanes, structure.sleepMinutes),
			unmetPokemonIds,
		},
	};
}

/**
 * 起用率設定から1日分の自動入れ替えスケジュールを生成する。
 * （1日分の集計期間として `buildQuickSimSchedule` を呼ぶ）
 */
export function buildQuickSimDaySchedule(
	members: readonly QuickSimMember[],
	timeSlots: readonly TimeSlot[],
	exclusions: QuickSimExclusionMap = EMPTY_QUICK_SIM_EXCLUSION_MAP,
): QuickSimDayScheduleResult {
	const result = buildQuickSimSchedule(members, timeSlots, 1, exclusions);
	if (!result.ok) {
		return result;
	}
	const { schedule } = result;
	return {
		ok: true,
		schedule: {
			lanes: schedule.dayLanes[0],
			sleepSlotId: schedule.sleepSlotId,
			sleepTime: schedule.sleepTime,
			sleepMinutes: schedule.sleepMinutes,
			usesSleepSwaps: schedule.usesSleepSwaps,
		},
	};
}
