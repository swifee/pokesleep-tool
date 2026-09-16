import { describe, expect, it } from "vitest";
import {
	QUICK_SIM_OPTIMIZER_MAX_UNITS,
	QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
} from "../types/QuickSimOptimizerTypes";
import {
	buildSoloUnits,
	countFullCandidates,
	generateNeighborUnits,
	type QuickSimSoloTable,
	selectTopCandidatesBySurrogate,
	surrogateScore,
	unitsKey,
	unitsToPercents,
} from "./QuickSimOptimizerCandidates";

/** 合計 totalUnits の全候補を素朴に列挙する（テストの正解用） */
function enumerateAll(
	memberCount: number,
	totalUnits: number,
	maxUnits: number,
): number[][] {
	const result: number[][] = [];
	const current: number[] = [];
	const visit = (index: number, remaining: number): void => {
		if (index === memberCount) {
			if (remaining === 0) {
				result.push([...current]);
			}
			return;
		}
		for (let units = 0; units <= Math.min(maxUnits, remaining); units++) {
			current.push(units);
			visit(index + 1, remaining - units);
			current.pop();
		}
	};
	visit(0, totalUnits);
	return result;
}

function buildConcaveSoloTable(weights: readonly number[]): QuickSimSoloTable {
	return weights.map((weight) =>
		Array.from({ length: QUICK_SIM_OPTIMIZER_MAX_UNITS + 1 }, (_, units) =>
			Math.round(weight * (units * 100 - units * units * 8)),
		),
	);
}

describe("QuickSimOptimizerCandidates", () => {
	it("converts units to percents with the 20% step", () => {
		expect(unitsToPercents([0, 1, 5])).toEqual([0, 20, 100]);
		expect(unitsKey([0, 1, 5])).toBe("0,1,5");
	});

	it("builds solo candidates", () => {
		expect(buildSoloUnits(4, 2, 3)).toEqual([0, 0, 3, 0]);
	});

	it("counts the full-usage candidates", () => {
		expect(countFullCandidates(5)).toBe(1);
		expect(countFullCandidates(6)).toBe(252);
		expect(countFullCandidates(7)).toBe(6538);
		expect(countFullCandidates(8)).toBe(82384);
		expect(countFullCandidates(6)).toBe(
			enumerateAll(
				6,
				QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
				QUICK_SIM_OPTIMIZER_MAX_UNITS,
			).length,
		);
	});

	it("selects the same top candidates as a brute-force ranking", () => {
		const soloTable = buildConcaveSoloTable([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]);
		const limit = 50;
		const selected = selectTopCandidatesBySurrogate(soloTable, limit);
		const expected = enumerateAll(
			7,
			QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
			QUICK_SIM_OPTIMIZER_MAX_UNITS,
		)
			.map((units) => ({ units, score: surrogateScore(soloTable, units) }))
			.sort((left, right) => right.score - left.score);

		expect(selected).toHaveLength(limit);
		for (const units of selected) {
			expect(units).toHaveLength(7);
			expect(units.reduce((sum, value) => sum + value, 0)).toBe(
				QUICK_SIM_OPTIMIZER_TOTAL_UNITS,
			);
		}
		const selectedScores = selected.map((units) =>
			surrogateScore(soloTable, units),
		);
		expect(selectedScores).toEqual(
			expected.slice(0, limit).map((entry) => entry.score),
		);
		expect(unitsKey(selected[0])).toBe(unitsKey(expected[0].units));
	});

	it("returns every candidate when the limit exceeds the candidate count", () => {
		const soloTable = buildConcaveSoloTable([1, 1, 1, 1, 1, 1]);
		const selected = selectTopCandidatesBySurrogate(soloTable, 10_000);
		expect(selected).toHaveLength(252);
		expect(new Set(selected.map(unitsKey)).size).toBe(252);
	});

	it("keeps the search tractable for twelve members", () => {
		const weights = Array.from({ length: 12 }, (_, index) => 1 - index * 0.05);
		const soloTable = buildConcaveSoloTable(weights);
		const start = performance.now();
		const selected = selectTopCandidatesBySurrogate(soloTable, 2000);
		const elapsed = performance.now() - start;
		expect(selected).toHaveLength(2000);
		expect(elapsed).toBeLessThan(5000);
		const scores = selected.map((units) => surrogateScore(soloTable, units));
		for (let index = 1; index < scores.length; index++) {
			expect(scores[index]).toBeLessThanOrEqual(scores[index - 1]);
		}
	});

	it("returns nothing when the total cannot be reached", () => {
		const soloTable = buildConcaveSoloTable([1, 1, 1]);
		expect(selectTopCandidatesBySurrogate(soloTable, 10)).toEqual([]);
		expect(selectTopCandidatesBySurrogate([], 10)).toEqual([]);
		expect(selectTopCandidatesBySurrogate(soloTable, 0)).toEqual([]);
	});

	it("generates single-unit moves and swaps without duplicates", () => {
		const neighbors = generateNeighborUnits([5, 3, 0]);
		const keys = neighbors.map(unitsKey);
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys).toContain("4,4,0");
		expect(keys).toContain("4,3,1");
		expect(keys).toContain("5,2,1");
		expect(keys).toContain("3,5,0");
		expect(keys).toContain("0,3,5");
		expect(keys).toContain("5,0,3");
		expect(keys).not.toContain("5,3,0");
		expect(keys).not.toContain("6,2,0");
		for (const units of neighbors) {
			expect(units.reduce((sum, value) => sum + value, 0)).toBe(8);
			expect(Math.max(...units)).toBeLessThanOrEqual(
				QUICK_SIM_OPTIMIZER_MAX_UNITS,
			);
		}
	});
});
