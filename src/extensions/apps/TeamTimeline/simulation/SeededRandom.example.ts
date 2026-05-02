/**
 * SeededRandom の使用例
 *
 * このファイルは実際のシミュレーションでの使用パターンを示します。
 */

import { SeededRandom } from "./SeededRandom";

// ===== 基本的な使い方 =====

function basicUsage() {
	const random = new SeededRandom(12345);

	// 0〜1の乱数
	console.log("Random float:", random.next());

	// 1〜6のサイコロ
	console.log("Dice roll:", random.nextInt(1, 6));

	// 20%の確率判定
	console.log("20% chance:", random.chance(0.2));

	// 30回試行して成功回数
	console.log("30 trials, 20% each:", random.binomial(30, 0.2));

	// 配列をシャッフル
	const items = ["A", "B", "C", "D", "E"];
	console.log("Shuffled:", random.shuffle(items));
}

// ===== ポケスリのシミュレーション例 =====

/**
 * スキル発動のシミュレーション
 * 30分間（30回のチャンス）で何回発動するか
 */
function simulateSkillProcs(
	skillChance: number,
	duration: number,
	seed: number,
): number {
	const random = new SeededRandom(seed);
	return random.binomial(duration, skillChance);
}

/**
 * チーム全体の食材収集シミュレーション
 */
function simulateTeamIngredients(seed: number) {
	const random = new SeededRandom(seed);

	const team = [
		{ name: "ピカチュウ", ingredientChance: 0.2, count: 2 },
		{ name: "カビゴン", ingredientChance: 0.35, count: 3 },
		{ name: "イーブイ", ingredientChance: 0.15, count: 1 },
	];

	const results = team.map((pokemon) => {
		const procs = random.binomial(30, pokemon.ingredientChance);
		const totalIngredients = procs * pokemon.count;

		return {
			pokemon: pokemon.name,
			procs,
			totalIngredients,
		};
	});

	return results;
}

/**
 * サブスキル発動順のシミュレーション
 * メインスキル、げんき回復、食材確率UPの順で発動
 */
function simulateSkillOrder(seed: number) {
	const random = new SeededRandom(seed);

	const skills = ["メインスキル", "げんき回復", "食材確率UP", "エナジー増加"];

	// ランダムな順序で発動
	return random.shuffle(skills);
}

/**
 * 複数回のシミュレーションで平均を取る
 */
function averageSimulation(runs: number, baseSeed: number) {
	const results: number[] = [];

	for (let i = 0; i < runs; i++) {
		const seed = baseSeed + i; // シードを少しずつ変える
		const procs = simulateSkillProcs(0.2, 30, seed);
		results.push(procs);
	}

	const average = results.reduce((sum, x) => sum + x, 0) / results.length;
	const min = Math.min(...results);
	const max = Math.max(...results);

	return { average, min, max, results };
}

// ===== 実行例 =====

// vitest実行時はスキップ
const hasVitest = typeof globalThis === "object" && "vitest" in globalThis;

if (!hasVitest) {
	console.log("\n===== 基本的な使い方 =====");
	basicUsage();

	console.log("\n===== スキル発動シミュレーション =====");
	const skillProcs = simulateSkillProcs(0.2, 30, 12345);
	console.log(`30分間で${skillProcs}回発動`);

	console.log("\n===== チーム食材収集シミュレーション =====");
	const teamResults = simulateTeamIngredients(12345);
	teamResults.forEach((r) => {
		console.log(`${r.pokemon}: ${r.procs}回発動 → ${r.totalIngredients}個収集`);
	});

	console.log("\n===== スキル発動順シミュレーション =====");
	const skillOrder = simulateSkillOrder(12345);
	console.log("発動順:", skillOrder.join(" → "));

	console.log("\n===== 1000回シミュレーションの平均 =====");
	const avgResult = averageSimulation(1000, 12345);
	console.log(`平均: ${avgResult.average.toFixed(2)}回`);
	console.log(`最小: ${avgResult.min}回`);
	console.log(`最大: ${avgResult.max}回`);
}

// ===== エクスポート =====

export {
	averageSimulation,
	simulateSkillOrder,
	simulateSkillProcs,
	simulateTeamIngredients,
};
