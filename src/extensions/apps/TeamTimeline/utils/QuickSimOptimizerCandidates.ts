/**
 * QuickSimOptimizerCandidates.ts
 * 起用率最適化の候補（メンバー順の単位数）を扱う純粋関数。
 *
 * - 単位数 1 = 刻み（20%）。候補は「各メンバー 0〜5 単位、合計 25 単位」。
 * - 単体 EP 表（メンバーごと・単位数ごとの単独 EP）の和を代理スコアとして、
 *   上位 K 件を深さ優先探索 + 上界による枝刈りで取り出す。
 * - 局所探索の近傍は「1 単位の移動」と「2 匹の起用率の入れ替え」。
 */

import {
	QUICK_SIM_OPTIMIZER_MAX_UNITS,
	QUICK_SIM_OPTIMIZER_STEP_PERCENT,
	QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
	type QuickSimOptimizerPercents,
} from "../types/QuickSimOptimizerTypes";

/** 候補: メンバー順の単位数 */
export type QuickSimOptimizerUnits = readonly number[];

/** 単体 EP 表。soloTable[memberIndex][units] = 単独で置いたときの平均 EP（units=0 は 0） */
export type QuickSimSoloTable = readonly (readonly number[])[];

export function unitsToPercents(units: QuickSimOptimizerUnits): number[] {
	return units.map((unit) => unit * QUICK_SIM_OPTIMIZER_STEP_PERCENT);
}

/** 評価結果のキャッシュなどに使うキー */
export function percentsKey(percents: QuickSimOptimizerPercents): string {
	return percents.join(",");
}

export function unitsKey(units: QuickSimOptimizerUnits): string {
	return units.join(",");
}

/** メンバー index だけを units 単位で起用する候補（単体 EP 表の作成用） */
export function buildSoloUnits(
	memberCount: number,
	memberIndex: number,
	units: number,
): number[] {
	const result: number[] = Array.from({ length: memberCount }, () => 0);
	result[memberIndex] = units;
	return result;
}

/** 代理スコア: 単体 EP の和 */
export function surrogateScore(
	soloTable: QuickSimSoloTable,
	units: QuickSimOptimizerUnits,
): number {
	let score = 0;
	for (let index = 0; index < units.length; index++) {
		score += soloTable[index][units[index]] ?? 0;
	}
	return score;
}

/**
 * メンバー index 以降で残り r 単位を使い切るときの代理スコアの最大値。
 * suffixBest[index][r]。到達できない組み合わせは -Infinity。
 */
function buildSuffixBest(
	soloTable: QuickSimSoloTable,
	totalUnits: number,
	maxUnits: number,
): number[][] {
	const memberCount = soloTable.length;
	const suffixBest: number[][] = Array.from({ length: memberCount + 1 }, () =>
		Array.from({ length: totalUnits + 1 }, () => Number.NEGATIVE_INFINITY),
	);
	suffixBest[memberCount][0] = 0;
	for (let index = memberCount - 1; index >= 0; index--) {
		for (let remaining = 0; remaining <= totalUnits; remaining++) {
			let best = Number.NEGATIVE_INFINITY;
			const limit = Math.min(maxUnits, remaining);
			for (let units = 0; units <= limit; units++) {
				const rest = suffixBest[index + 1][remaining - units];
				if (rest === Number.NEGATIVE_INFINITY) {
					continue;
				}
				const value = rest + (soloTable[index][units] ?? 0);
				if (value > best) {
					best = value;
				}
			}
			suffixBest[index][remaining] = best;
		}
	}
	return suffixBest;
}

interface ScoredUnits {
	units: number[];
	score: number;
}

/** スコアが最小の要素を根に持つ二分ヒープ（上位 K 件の保持用） */
class MinScoreHeap {
	private readonly items: ScoredUnits[] = [];

	get size(): number {
		return this.items.length;
	}

	peekScore(): number {
		return this.items[0]?.score ?? Number.NEGATIVE_INFINITY;
	}

	push(item: ScoredUnits): void {
		this.items.push(item);
		let index = this.items.length - 1;
		while (index > 0) {
			const parent = (index - 1) >> 1;
			if (this.items[parent].score <= this.items[index].score) {
				break;
			}
			[this.items[parent], this.items[index]] = [
				this.items[index],
				this.items[parent],
			];
			index = parent;
		}
	}

	pop(): ScoredUnits | undefined {
		const top = this.items[0];
		const last = this.items.pop();
		if (last === undefined || this.items.length === 0) {
			return top;
		}
		this.items[0] = last;
		let index = 0;
		for (;;) {
			const left = index * 2 + 1;
			const right = left + 1;
			let smallest = index;
			if (
				left < this.items.length &&
				this.items[left].score < this.items[smallest].score
			) {
				smallest = left;
			}
			if (
				right < this.items.length &&
				this.items[right].score < this.items[smallest].score
			) {
				smallest = right;
			}
			if (smallest === index) {
				break;
			}
			[this.items[smallest], this.items[index]] = [
				this.items[index],
				this.items[smallest],
			];
			index = smallest;
		}
		return top;
	}

	toSortedDesc(): ScoredUnits[] {
		return [...this.items].sort((left, right) => right.score - left.score);
	}
}

/**
 * 代理スコア（単体 EP の和）が高い候補を上位 limit 件、スコアの高い順に返す。
 * 合計 totalUnits 単位・各メンバー maxUnits 単位以下の候補を、深さ優先で列挙しながら
 * 「残りメンバーで達成できる最大スコア」の上界で枝刈りする。
 */
export function selectTopCandidatesBySurrogate(
	soloTable: QuickSimSoloTable,
	limit: number,
	totalUnits: number = QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
	maxUnits: number = QUICK_SIM_OPTIMIZER_MAX_UNITS,
): number[][] {
	const memberCount = soloTable.length;
	if (memberCount === 0 || limit <= 0) {
		return [];
	}
	const suffixBest = buildSuffixBest(soloTable, totalUnits, maxUnits);
	if (suffixBest[0][totalUnits] === Number.NEGATIVE_INFINITY) {
		return [];
	}
	const heap = new MinScoreHeap();
	const current: number[] = [];

	const visit = (index: number, remaining: number, score: number): void => {
		if (index === memberCount) {
			if (remaining !== 0) {
				return;
			}
			if (heap.size < limit) {
				heap.push({ units: [...current], score });
			} else if (score > heap.peekScore()) {
				heap.pop();
				heap.push({ units: [...current], score });
			}
			return;
		}
		const bound = score + suffixBest[index][remaining];
		if (heap.size >= limit && bound <= heap.peekScore()) {
			return;
		}
		// 大きい単位から試すと良い候補が早く見つかり、枝刈りが効きやすい
		for (let units = Math.min(maxUnits, remaining); units >= 0; units--) {
			if (
				suffixBest[index + 1][remaining - units] === Number.NEGATIVE_INFINITY
			) {
				continue;
			}
			current.push(units);
			visit(
				index + 1,
				remaining - units,
				score + (soloTable[index][units] ?? 0),
			);
			current.pop();
		}
	};
	visit(0, totalUnits, 0);
	return heap.toSortedDesc().map((item) => item.units);
}

/**
 * 局所探索の近傍。
 * - メンバー i の 1 単位をメンバー j へ移す
 * - メンバー i と j の単位数を入れ替える
 */
export function generateNeighborUnits(
	units: QuickSimOptimizerUnits,
	maxUnits: number = QUICK_SIM_OPTIMIZER_MAX_UNITS,
): number[][] {
	const neighbors: number[][] = [];
	const seen = new Set<string>();
	const offer = (candidate: number[]): void => {
		const key = unitsKey(candidate);
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		neighbors.push(candidate);
	};
	for (let from = 0; from < units.length; from++) {
		for (let to = 0; to < units.length; to++) {
			if (from === to) {
				continue;
			}
			if (units[from] >= 1 && units[to] < maxUnits) {
				const moved = [...units];
				moved[from] -= 1;
				moved[to] += 1;
				offer(moved);
			}
			if (from < to && units[from] !== units[to]) {
				const swapped = [...units];
				swapped[from] = units[to];
				swapped[to] = units[from];
				offer(swapped);
			}
		}
	}
	return neighbors;
}

/** メンバー数に対する合計 totalUnits の候補数（テストや目安表示用） */
export function countFullCandidates(
	memberCount: number,
	totalUnits: number = QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
	maxUnits: number = QUICK_SIM_OPTIMIZER_MAX_UNITS,
): number {
	let counts: number[] = Array.from({ length: totalUnits + 1 }, () => 0);
	counts[0] = 1;
	for (let index = 0; index < memberCount; index++) {
		const next: number[] = Array.from({ length: totalUnits + 1 }, () => 0);
		for (let remaining = 0; remaining <= totalUnits; remaining++) {
			if (counts[remaining] === 0) {
				continue;
			}
			for (
				let units = 0;
				units <= maxUnits && remaining + units <= totalUnits;
				units++
			) {
				next[remaining + units] += counts[remaining];
			}
		}
		counts = next;
	}
	return counts[totalUnits];
}
