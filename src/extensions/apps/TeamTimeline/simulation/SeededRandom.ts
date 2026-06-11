/**
 * シード付き乱数生成器
 *
 * 再現性のある疑似乱数を生成するクラス。
 * Mulberry32アルゴリズムを使用した高速な実装。
 *
 * @example
 * ```typescript
 * const random = new SeededRandom(12345);
 * random.next();           // 0〜1の乱数
 * random.nextInt(1, 6);    // 1〜6の整数
 * random.chance(0.2);      // 20%の確率でtrue
 * random.binomial(30, 0.2) // 30回試行で成功回数
 * ```
 */
export class SeededRandom {
	private seed: number;

	/**
	 * @param seed シード値（整数）
	 */
	constructor(seed: number) {
		this.seed = seed >>> 0; // 32bit unsigned integerに変換
	}

	/**
	 * 0以上1未満の乱数を生成
	 * Mulberry32アルゴリズムを使用
	 *
	 * @returns 0 <= x < 1 の乱数
	 */
	next(): number {
		this.seed += 0x6d2b79f5;
		let t = this.seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/**
	 * 指定範囲の整数乱数を生成
	 *
	 * @param min 最小値（含む）
	 * @param max 最大値（含む）
	 * @returns min <= x <= max の整数
	 *
	 * @example
	 * random.nextInt(1, 6)  // サイコロ: 1〜6
	 * random.nextInt(0, 99) // 0〜99
	 */
	nextInt(min: number, max: number): number {
		min = Math.floor(min);
		max = Math.floor(max);
		return Math.floor(this.next() * (max - min + 1)) + min;
	}

	/**
	 * 確率判定
	 *
	 * @param probability 成功確率（0〜1）
	 * @returns true: 成功, false: 失敗
	 *
	 * @example
	 * random.chance(0.2)  // 20%の確率でtrue
	 * random.chance(0.05) // 5%の確率でtrue
	 */
	chance(probability: number): boolean {
		return this.next() < probability;
	}

	/**
	 * 二項分布に従う乱数を生成
	 * n回の独立試行で成功回数を返す
	 *
	 * @param n 試行回数
	 * @param p 各試行の成功確率
	 * @returns 成功回数（0〜n）
	 *
	 * @example
	 * random.binomial(30, 0.2) // 30回試行、各20%の確率で成功
	 * random.binomial(100, 0.5) // 100回試行、各50%の確率で成功
	 */
	binomial(n: number, p: number): number {
		let successes = 0;
		for (let i = 0; i < n; i++) {
			if (this.chance(p)) {
				successes++;
			}
		}
		return successes;
	}

	/**
	 * 配列をランダムにシャッフル（Fisher-Yatesアルゴリズム）
	 * 元の配列は変更されない（新しい配列を返す）
	 *
	 * @param array シャッフルする配列
	 * @returns シャッフルされた新しい配列
	 *
	 * @example
	 * const items = [1, 2, 3, 4, 5];
	 * const shuffled = random.shuffle(items);
	 * // items は変更されない
	 * // shuffled は [3, 1, 5, 2, 4] など
	 */
	shuffle<T>(array: readonly T[]): T[] {
		const result = [...array];

		// Fisher-Yates shuffle
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(this.next() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}

		return result;
	}

	/**
	 * 現在のシード値を取得
	 * デバッグや状態保存に使用
	 *
	 * @returns 現在のシード値
	 */
	getSeed(): number {
		return this.seed;
	}

	/**
	 * シード値をリセット
	 * 乱数列を最初から再生成する場合に使用
	 *
	 * @param seed 新しいシード値
	 */
	reset(seed: number): void {
		this.seed = seed >>> 0;
	}
}

export default SeededRandom;
