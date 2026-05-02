import { describe, expect, it } from "vitest";
import { SeededRandom } from "./SeededRandom";

describe("SeededRandom", () => {
	describe("next()", () => {
		it("同じシードから同じ乱数列を生成", () => {
			const random1 = new SeededRandom(12345);
			const random2 = new SeededRandom(12345);

			const values1 = Array.from({ length: 10 }, () => random1.next());
			const values2 = Array.from({ length: 10 }, () => random2.next());

			expect(values1).toEqual(values2);
		});

		it("0以上1未満の値を生成", () => {
			const random = new SeededRandom(12345);

			for (let i = 0; i < 100; i++) {
				const value = random.next();
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThan(1);
			}
		});

		it("異なるシードから異なる乱数列を生成", () => {
			const random1 = new SeededRandom(12345);
			const random2 = new SeededRandom(54321);

			const values1 = Array.from({ length: 10 }, () => random1.next());
			const values2 = Array.from({ length: 10 }, () => random2.next());

			expect(values1).not.toEqual(values2);
		});
	});

	describe("nextInt()", () => {
		it("指定範囲の整数を生成", () => {
			const random = new SeededRandom(12345);

			for (let i = 0; i < 100; i++) {
				const value = random.nextInt(1, 6);
				expect(value).toBeGreaterThanOrEqual(1);
				expect(value).toBeLessThanOrEqual(6);
				expect(Number.isInteger(value)).toBe(true);
			}
		});

		it("最小値と最大値の両方を含む", () => {
			const random = new SeededRandom(12345);
			const values = new Set<number>();

			for (let i = 0; i < 1000; i++) {
				values.add(random.nextInt(1, 3));
			}

			expect(values.has(1)).toBe(true);
			expect(values.has(2)).toBe(true);
			expect(values.has(3)).toBe(true);
		});

		it("負の範囲でも動作", () => {
			const random = new SeededRandom(12345);

			for (let i = 0; i < 100; i++) {
				const value = random.nextInt(-10, -5);
				expect(value).toBeGreaterThanOrEqual(-10);
				expect(value).toBeLessThanOrEqual(-5);
			}
		});
	});

	describe("chance()", () => {
		it("確率0で常にfalse", () => {
			const random = new SeededRandom(12345);

			for (let i = 0; i < 100; i++) {
				expect(random.chance(0)).toBe(false);
			}
		});

		it("確率1で常にtrue", () => {
			const random = new SeededRandom(12345);

			for (let i = 0; i < 100; i++) {
				expect(random.chance(1)).toBe(true);
			}
		});

		it("確率0.5で約半分がtrue", () => {
			const random = new SeededRandom(12345);
			let successes = 0;

			for (let i = 0; i < 1000; i++) {
				if (random.chance(0.5)) {
					successes++;
				}
			}

			// 統計的に450〜550の範囲に収まるはず
			expect(successes).toBeGreaterThan(400);
			expect(successes).toBeLessThan(600);
		});
	});

	describe("binomial()", () => {
		it("n=0で常に0を返す", () => {
			const random = new SeededRandom(12345);
			expect(random.binomial(0, 0.5)).toBe(0);
		});

		it("p=0で常に0を返す", () => {
			const random = new SeededRandom(12345);
			expect(random.binomial(100, 0)).toBe(0);
		});

		it("p=1で常にnを返す", () => {
			const random = new SeededRandom(12345);
			expect(random.binomial(100, 1)).toBe(100);
		});

		it("結果が0以上n以下", () => {
			const random = new SeededRandom(12345);

			for (let i = 0; i < 100; i++) {
				const result = random.binomial(30, 0.2);
				expect(result).toBeGreaterThanOrEqual(0);
				expect(result).toBeLessThanOrEqual(30);
			}
		});

		it("期待値に近い結果を生成", () => {
			const random = new SeededRandom(12345);
			const n = 100;
			const p = 0.3;
			const expected = n * p; // 30

			const results: number[] = [];
			for (let i = 0; i < 1000; i++) {
				results.push(random.binomial(n, p));
			}

			const average = results.reduce((sum, x) => sum + x, 0) / results.length;

			// 平均が期待値の±10%以内
			expect(average).toBeGreaterThan(expected * 0.9);
			expect(average).toBeLessThan(expected * 1.1);
		});
	});

	describe("shuffle()", () => {
		it("すべての要素を保持", () => {
			const random = new SeededRandom(12345);
			const original = [1, 2, 3, 4, 5];
			const shuffled = random.shuffle(original);

			expect(shuffled.sort()).toEqual(original.sort());
		});

		it("元の配列を変更しない", () => {
			const random = new SeededRandom(12345);
			const original = [1, 2, 3, 4, 5];
			const copy = [...original];

			random.shuffle(original);

			expect(original).toEqual(copy);
		});

		it("同じシードで同じシャッフル結果", () => {
			const random1 = new SeededRandom(12345);
			const random2 = new SeededRandom(12345);
			const array = [1, 2, 3, 4, 5];

			const shuffled1 = random1.shuffle(array);
			const shuffled2 = random2.shuffle(array);

			expect(shuffled1).toEqual(shuffled2);
		});

		it("異なるシードで異なるシャッフル結果", () => {
			const random1 = new SeededRandom(12345);
			const random2 = new SeededRandom(54321);
			const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

			const shuffled1 = random1.shuffle(array);
			const shuffled2 = random2.shuffle(array);

			expect(shuffled1).not.toEqual(shuffled2);
		});

		it("空配列でも動作", () => {
			const random = new SeededRandom(12345);
			const shuffled = random.shuffle([]);

			expect(shuffled).toEqual([]);
		});

		it("1要素の配列でも動作", () => {
			const random = new SeededRandom(12345);
			const shuffled = random.shuffle([42]);

			expect(shuffled).toEqual([42]);
		});
	});

	describe("getSeed() / reset()", () => {
		it("シード値を取得できる", () => {
			const random = new SeededRandom(12345);
			random.next(); // シードが変わる

			const seed = random.getSeed();
			expect(typeof seed).toBe("number");
		});

		it("reset()で乱数列を再生成", () => {
			const random = new SeededRandom(12345);
			const values1 = Array.from({ length: 5 }, () => random.next());

			random.reset(12345);
			const values2 = Array.from({ length: 5 }, () => random.next());

			expect(values1).toEqual(values2);
		});
	});

	describe("再現性の総合テスト", () => {
		it("複雑な操作シーケンスでも再現可能", () => {
			const random1 = new SeededRandom(9999);
			const random2 = new SeededRandom(9999);

			const results1 = {
				next: random1.next(),
				int: random1.nextInt(1, 100),
				chance: random1.chance(0.5),
				binomial: random1.binomial(10, 0.3),
				shuffle: random1.shuffle([1, 2, 3, 4, 5]),
			};

			const results2 = {
				next: random2.next(),
				int: random2.nextInt(1, 100),
				chance: random2.chance(0.5),
				binomial: random2.binomial(10, 0.3),
				shuffle: random2.shuffle([1, 2, 3, 4, 5]),
			};

			expect(results1).toEqual(results2);
		});
	});
});
