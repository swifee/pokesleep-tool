import { describe, expect, it } from "vitest";
import pokemons from "../../../../data/pokemons";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import type {
	DailySummary,
	IngredientResult,
	TimeSlotResult,
} from "../types/TimeSlotTypes";
import {
	aggregateIngredients,
	applyBerryZoneMultiplier,
	calculateBerryEP,
	calculateBerryStrength,
	calculateDailySummary,
	calculateHugeMagoBerryEP,
	calculateIngredientEP,
	calculateTeamSummary,
} from "./EnergyPointCalculator";

describe("EnergyPointCalculator", () => {
	describe("calculateBerryStrength", () => {
		it("レベル1のノーマルタイプのきのみ強度を計算", () => {
			const strength = calculateBerryStrength("normal", 1);
			expect(strength).toBe(28); // b0 + level - 1 = 28 + 1 - 1 = 28
		});

		it("レベル10のノーマルタイプのきのみ強度を計算", () => {
			const strength = calculateBerryStrength("normal", 10);
			// Math.max(28 + 10 - 1, Math.round(1.025^9 * 28))
			// = Math.max(37, Math.round(1.249 * 28))
			// = Math.max(37, 35) = 37
			expect(strength).toBe(37);
		});

		it("レベル50のドラゴンタイプのきのみ強度を計算", () => {
			const strength = calculateBerryStrength("dragon", 50);
			// Math.max(35 + 50 - 1, Math.round(1.025^49 * 35))
			// = Math.max(84, Math.round(3.43 * 35))
			// = Math.max(84, 120) = 120
			expect(strength).toBeGreaterThan(84);
		});
	});

	describe("calculateBerryEP", () => {
		it("きのみEPを正しく計算", () => {
			// ピカチュウ（electric）レベル1を作成
			const pikachu = pokemons.find((p) => p.name === "Pikachu");
			expect(pikachu).toBeDefined();

			const iv = new PokemonIv({ pokemonName: pikachu?.name, level: 1 });
			const pokemon = new PokemonBoxItem(iv);

			const berryCount = 10;
			const strength = calculateBerryStrength(
				pokemon.iv.pokemon.type,
				pokemon.iv.level,
			);
			const ep = calculateBerryEP(pokemon, berryCount);

			// electric type の基本強度は25、レベル1なので25
			expect(strength).toBe(25);
			expect(ep).toBe(25 * berryCount);
		});

		it("field/favoriteボーナス込みのきのみEPを計算する", () => {
			const pikachu = pokemons.find((p) => p.name === "Pikachu");
			expect(pikachu).toBeDefined();

			const iv = new PokemonIv({ pokemonName: pikachu?.name, level: 1 });
			const pokemon = new PokemonBoxItem(iv);
			const berryCount = 10;
			const ep = calculateBerryEP(pokemon, berryCount, {
				fieldBonus: 20,
				berryStrengthBonus: 2.4,
				recipeBonus: 0,
				recipeLevel: 1,
				dishBonus: 1,
			});

			// ceil(ceil(25 * 1.2) * 2.4) * 10 = 720
			expect(ep).toBe(720);
		});
	});

	describe("calculateIngredientEP", () => {
		it("食材EPを正しく計算", () => {
			const ingredients: IngredientResult[] = [
				{ name: "apple", count: 5 },
				{ name: "milk", count: 3 },
			];

			const ep = calculateIngredientEP(ingredients);
			// apple: 90 * 5 = 450
			// milk: 98 * 3 = 294
			// total: 744
			expect(ep).toBe(90 * 5 + 98 * 3);
		});

		it("空の食材配列で0を返す", () => {
			const ep = calculateIngredientEP([]);
			expect(ep).toBe(0);
		});

		it("recipe/field/dishボーナス込みの食材EPを計算する", () => {
			const ingredients: IngredientResult[] = [
				{ name: "apple", count: 10 }, // 900
			];

			const ep = calculateIngredientEP(ingredients, {
				fieldBonus: 20,
				berryStrengthBonus: 1,
				recipeBonus: 25,
				recipeLevel: 30,
				dishBonus: 1.1,
			});

			// 900 * (((1.25 * 1.61) * 0.8 + 0.2) * 1.2 * 1.1)
			expect(ep).toBeCloseTo(2150.28, 2);
		});
	});

	describe("aggregateIngredients", () => {
		it("複数の時間帯結果から食材を集計", () => {
			const results: TimeSlotResult[] = [
				{
					slotId: "slot-1",
					pokemonId: 1,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 5,
					skillTriggerCount: 1,
					berryCount: 10,
					ingredients: [
						{ name: "apple", count: 2 },
						{ name: "milk", count: 1 },
					],
					energyStart: 100,
					energyEnd: 90,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 10,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
				{
					slotId: "slot-2",
					pokemonId: 1,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 5,
					skillTriggerCount: 0,
					berryCount: 8,
					ingredients: [
						{ name: "apple", count: 3 },
						{ name: "honey", count: 2 },
					],
					energyStart: 90,
					energyEnd: 80,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 10,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const aggregated = aggregateIngredients(results);

			expect(aggregated).toHaveLength(3);
			expect(aggregated.find((i) => i.name === "apple")?.count).toBe(5);
			expect(aggregated.find((i) => i.name === "milk")?.count).toBe(1);
			expect(aggregated.find((i) => i.name === "honey")?.count).toBe(2);
		});

		it("空の結果配列で空配列を返す", () => {
			const aggregated = aggregateIngredients([]);
			expect(aggregated).toEqual([]);
		});
	});

	describe("calculateDailySummary", () => {
		it("一日合計を正しく計算", () => {
			const pikachu = pokemons.find((p) => p.name === "Pikachu");
			const iv = new PokemonIv({ pokemonName: pikachu?.name });
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-1",
					pokemonId: 1,
					teamIndex: 0,
					durationMinutes: 480,
					isSleeping: true,
					helpCount: 0,
					skillTriggerCount: 0,
					berryCount: 0,
					ingredients: [],
					energyStart: 50,
					energyEnd: 100,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 50,
					energyDecay: 0,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
				{
					slotId: "slot-2",
					pokemonId: 1,
					teamIndex: 0,
					durationMinutes: 300,
					isSleeping: false,
					helpCount: 10,
					skillTriggerCount: 2,
					berryCount: 15,
					ingredients: [{ name: "apple", count: 5 }],
					energyStart: 100,
					energyEnd: 80,
					mealRecovery: 20,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 20,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 800,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 4,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(1, pokemon, results);

			expect(summary.pokemonId).toBe(1);
			expect(summary.totalHelpCount).toBe(10);
			expect(summary.totalSkillCount).toBe(2);
			expect(summary.totalBerryCount).toBe(15);
			expect(summary.totalIngredients).toHaveLength(1);
			expect(summary.totalIngredients[0]).toEqual({ name: "apple", count: 5 });
			expect(summary.berryEP).toBeGreaterThan(0);
			expect(summary.ingredientEP).toBe(90 * 5);
			expect(summary.skillEP).toBeGreaterThan(0);
			expect(summary.totalEP).toBe(
				summary.berryEP + summary.ingredientEP + summary.skillEP,
			);
			expect(summary.totalPresentCandyCount).toBe(4);
			expect(summary.totalCookingPotCapacityIncrease).toBe(0);
			expect(summary.totalTastyChanceIncreasePercent).toBe(0);
			expect(summary.totalDreamShardCount).toBe(0);
		});

		it("bonusContextを渡した場合、berry/ingredient EPに倍率を反映する", () => {
			const pikachu = pokemons.find((p) => p.name === "Pikachu");
			const iv = new PokemonIv({ pokemonName: pikachu?.name, level: 1 });
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-bonus-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 1,
					skillTriggerCount: 0,
					berryCount: 10,
					ingredients: [{ name: "apple", count: 10 }],
					energyStart: 60,
					energyEnd: 55,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 5,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results, {
				fieldBonus: 20,
				berryStrengthBonus: 2.4,
				recipeBonus: 25,
				recipeLevel: 30,
				dishBonus: 1.1,
			});

			expect(summary.berryEP).toBe(720);
			expect(summary.ingredientEP).toBeCloseTo(2150.28, 2);
		});

		it("Extra Helpful SはdirectSkillEPをskillEPとして集計する", () => {
			const supportSkillPokemonData = pokemons.find(
				(p) => p.skill === "Extra Helpful S",
			);
			expect(supportSkillPokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: supportSkillPokemonData?.name,
				skillLevel: 4,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-support-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 4,
					skillTriggerCount: 2,
					berryCount: 6,
					ingredients: [],
					energyStart: 60,
					energyEnd: 55,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 5,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 1234,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 12,
					supportSkillBerryEP: 1234,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(1234);
			expect(summary.totalDirectSkillEP).toBe(1234);
			expect(summary.totalCookingPotCapacityIncrease).toBe(0);
			expect(summary.totalTastyChanceIncreasePercent).toBe(0);
			expect(summary.totalDreamShardCount).toBe(0);
		});

		it("Cooking Power-Up Sは発動回数があってもskillEPを0として集計する", () => {
			const nonEPSkillPokemonData = pokemons.find(
				(p) => p.skill === "Cooking Power-Up S",
			);
			expect(nonEPSkillPokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: nonEPSkillPokemonData?.name,
				skillLevel: 5,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-cooking-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 5,
					skillTriggerCount: 3,
					berryCount: 8,
					ingredients: [{ name: "apple", count: 4 }],
					energyStart: 70,
					energyEnd: 65,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 5,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					cookingPotCapacityIncrease: 17,
					tastyChanceIncreasePercent: 8,
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(0);
			expect(summary.totalEP).toBe(summary.berryEP + summary.ingredientEP);
			expect(summary.totalCookingPotCapacityIncrease).toBe(17);
			expect(summary.totalTastyChanceIncreasePercent).toBe(8);
			expect(summary.totalDreamShardCount).toBe(0);
		});

		it("Dream Shard Magnet Sは発動回数があってもskillEPを0として集計し、ゆめのかけらを合計する", () => {
			const dreamShardPokemonData = pokemons.find(
				(p) => p.skill === "Dream Shard Magnet S",
			);
			expect(dreamShardPokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: dreamShardPokemonData?.name,
				skillLevel: 6,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-dream-shard-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 3,
					skillTriggerCount: 2,
					berryCount: 4,
					ingredients: [{ name: "apple", count: 2 }],
					energyStart: 70,
					energyEnd: 66,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 4,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					dreamShardCount: 2520,
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(0);
			expect(summary.totalEP).toBe(summary.berryEP + summary.ingredientEP);
			expect(summary.totalDreamShardCount).toBe(2520);
		});

		it("Ingredient Draw SはskillEPを0として食材EPのみ加算する", () => {
			const skillPokemonData = pokemons.find(
				(p) => p.skill === "Ingredient Draw S",
			);
			expect(skillPokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: skillPokemonData?.name,
				skillLevel: 6,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-ingredient-draw-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 3,
					skillTriggerCount: 2,
					berryCount: 4,
					ingredients: [{ name: "apple", count: 10 }],
					energyStart: 70,
					energyEnd: 66,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 4,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					dreamShardCount: 0,
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(0);
			expect(summary.ingredientEP).toBeGreaterThan(0);
			expect(summary.totalEP).toBe(summary.berryEP + summary.ingredientEP);
		});

		it("Ingredient Draw S (Super Luck)のゆめのかけらはskillEPへ加算しない", () => {
			const skillPokemonData = pokemons.find(
				(p) => p.skill === "Ingredient Draw S (Super Luck)",
			);
			expect(skillPokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: skillPokemonData?.name,
				skillLevel: 7,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-super-luck-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 2,
					skillTriggerCount: 3,
					berryCount: 2,
					ingredients: [{ name: "milk", count: 6 }],
					energyStart: 70,
					energyEnd: 66,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 4,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					dreamShardCount: 12000,
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(0);
			expect(summary.totalDreamShardCount).toBe(12000);
			expect(summary.totalEP).toBe(summary.berryEP + summary.ingredientEP);
		});

		it("Ingredient Draw S (Hyper Cutter)は大成功があってもskillEPへ加算しない", () => {
			const skillPokemonData = pokemons.find(
				(p) => p.skill === "Ingredient Draw S (Hyper Cutter)",
			);
			expect(skillPokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: skillPokemonData?.name,
				skillLevel: 7,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-hyper-cutter-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 2,
					skillTriggerCount: 3,
					berryCount: 2,
					ingredients: [{ name: "honey", count: 24 }],
					energyStart: 70,
					energyEnd: 66,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 4,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					dreamShardCount: 0,
					ingredientDrawGreatSuccessCount: 2,
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(0);
			expect(summary.ingredientEP).toBeGreaterThan(0);
			expect(summary.totalEP).toBe(summary.berryEP + summary.ingredientEP);
		});

		it("Ingredient Magnet系はスキル食材を別集計しつつ食材合計へは合算する", () => {
			const skillPokemonData = pokemons.find(
				(p) => p.skill === "Ingredient Magnet S",
			);
			expect(skillPokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: skillPokemonData?.name,
				skillLevel: 6,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-ingredient-magnet-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 3,
					skillTriggerCount: 2,
					berryCount: 4,
					ingredients: [{ name: "apple", count: 2 }],
					skillIngredients: [{ name: "milk", count: 3 }],
					energyStart: 70,
					energyEnd: 66,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 4,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 0,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					dreamShardCount: 0,
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(0);
			expect(summary.totalSkillIngredients).toEqual([
				{ name: "milk", count: 3 },
			]);
			expect(summary.totalIngredients).toEqual([
				{ name: "apple", count: 2 },
				{ name: "milk", count: 3 },
			]);
			expect(summary.ingredientEP).toBe(90 * 2 + 98 * 3);
		});

		it("Berry BurstはdirectSkillEPをskillEPとして集計する", () => {
			const berryBurstPokemonData = pokemons.find(
				(p) => p.skill === "Berry Burst",
			);
			expect(berryBurstPokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: berryBurstPokemonData?.name,
				skillLevel: 4,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-berry-burst-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 4,
					skillTriggerCount: 2,
					berryCount: 6,
					ingredients: [],
					energyStart: 70,
					energyEnd: 65,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 5,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 4321,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(4321);
			expect(summary.totalDirectSkillEP).toBe(4321);
			expect(summary.totalDreamShardCount).toBe(0);
		});

		it("Metronomeはproxy発動由来のdirectSkillEPをskillEPとして集計する", () => {
			const metronomePokemonData = pokemons.find(
				(p) => p.skill === "Metronome",
			);
			expect(metronomePokemonData).toBeDefined();
			const iv = new PokemonIv({
				pokemonName: metronomePokemonData?.name,
				skillLevel: 7,
			});
			const pokemon = new PokemonBoxItem(iv);

			const results: TimeSlotResult[] = [
				{
					slotId: "slot-metronome-1",
					pokemonId: pokemon.id,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 4,
					skillTriggerCount: 2,
					berryCount: 6,
					ingredients: [],
					energyStart: 70,
					energyEnd: 65,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 5,
					skillOverflowCount: 0,
					overflowIngredients: [],
					selfSkillRecovery: 0,
					directSkillEP: 5678,
					moonlightGivenRecovery: 0,
					moonlightReceivedRecovery: 0,
					energizingCheerGivenRecovery: 0,
					energizingCheerReceivedRecovery: 0,
					energizingCheerEvents: [],
					nuzzleTriggeredSkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				},
			];

			const summary = calculateDailySummary(pokemon.id, pokemon, results);
			expect(summary.skillEP).toBe(5678);
			expect(summary.totalDirectSkillEP).toBe(5678);
		});
	});

	describe("calculateTeamSummary", () => {
		it("チーム合計を正しく計算", () => {
			const dailySummaries: DailySummary[] = [
				{
					pokemonId: 1,
					totalHelpCount: 20,
					totalSkillCount: 3,
					totalBerryCount: 30,
					totalIngredients: [
						{ name: "apple", count: 10 },
						{ name: "milk", count: 5 },
					],
					berryEP: 750,
					ingredientEP: 1390,
					skillEP: 2400,
					totalEP: 4540,
					totalSkillOverflowCount: 0,
					totalOverflowIngredients: [],
					totalDirectSkillEP: 0,
					totalPresentCandyCount: 4,
					totalCookingPotCapacityIncrease: 12,
					totalTastyChanceIncreasePercent: 5,
					totalDreamShardCount: 1200,
				},
				{
					pokemonId: 2,
					totalHelpCount: 25,
					totalSkillCount: 4,
					totalBerryCount: 35,
					totalIngredients: [
						{ name: "apple", count: 8 },
						{ name: "honey", count: 6 },
					],
					berryEP: 875,
					ingredientEP: 1326,
					skillEP: 3200,
					totalEP: 5401,
					totalSkillOverflowCount: 0,
					totalOverflowIngredients: [],
					totalDirectSkillEP: 0,
					totalPresentCandyCount: 8,
					totalCookingPotCapacityIncrease: 15,
					totalTastyChanceIncreasePercent: 10,
					totalDreamShardCount: 3400,
				},
			];

			const teamSummary = calculateTeamSummary(dailySummaries);

			expect(teamSummary.totalBerryEP).toBe(750 + 875);
			expect(teamSummary.totalIngredientEP).toBe(1390 + 1326);
			expect(teamSummary.totalSkillEP).toBe(2400 + 3200);
			expect(teamSummary.grandTotalEP).toBe(4540 + 5401);
			expect(teamSummary.totalPresentCandyCount).toBe(12);
			expect(teamSummary.totalCookingPotCapacityIncrease).toBe(27);
			expect(teamSummary.totalTastyChanceIncreasePercent).toBe(15);
			expect(teamSummary.totalDreamShardCount).toBe(4600);

			expect(teamSummary.totalIngredients).toHaveLength(3);
			expect(
				teamSummary.totalIngredients.find((i) => i.name === "apple")?.count,
			).toBe(18);
			expect(
				teamSummary.totalIngredients.find((i) => i.name === "milk")?.count,
			).toBe(5);
			expect(
				teamSummary.totalIngredients.find((i) => i.name === "honey")?.count,
			).toBe(6);
		});

		it("空のチームで0を返す", () => {
			const teamSummary = calculateTeamSummary([]);

			expect(teamSummary.totalBerryEP).toBe(0);
			expect(teamSummary.totalIngredientEP).toBe(0);
			expect(teamSummary.totalSkillEP).toBe(0);
			expect(teamSummary.grandTotalEP).toBe(0);
			expect(teamSummary.totalIngredients).toEqual([]);
			expect(teamSummary.totalPresentCandyCount).toBe(0);
			expect(teamSummary.totalCookingPotCapacityIncrease).toBe(0);
			expect(teamSummary.totalTastyChanceIncreasePercent).toBe(0);
			expect(teamSummary.totalDreamShardCount).toBe(0);
		});
	});
});

describe("きのみゾーンのきのみEP", () => {
	function createSlotResult(
		overrides: Partial<TimeSlotResult> = {},
	): TimeSlotResult {
		return {
			slotId: "slot-1",
			pokemonId: 1,
			teamIndex: 0,
			durationMinutes: 300,
			isSleeping: false,
			helpCount: 0,
			skillTriggerCount: 0,
			berryCount: 0,
			ingredients: [],
			energyStart: 100,
			energyEnd: 100,
			mealRecovery: 0,
			skillRecovery: 0,
			wakeRecovery: 0,
			energyDecay: 0,
			skillOverflowCount: 0,
			overflowIngredients: [],
			selfSkillRecovery: 0,
			directSkillEP: 0,
			moonlightGivenRecovery: 0,
			moonlightReceivedRecovery: 0,
			energizingCheerGivenRecovery: 0,
			energizingCheerReceivedRecovery: 0,
			energizingCheerEvents: [],
			nuzzleTriggeredSkillEvents: [],
			presentCandyCount: 0,
			berryJuiceCount: 0,
			supportSkillBerryCount: 0,
			supportSkillBerryEP: 0,
			supportHelpEvents: [],
			stockpileStoreCount: 0,
			stockpileSpitCount: 0,
			badDreamsHitCount: 0,
			badDreamsTotalDamageGiven: 0,
			badDreamsDamageTaken: 0,
			...overrides,
		};
	}

	const bonusContext = {
		fieldBonus: 0,
		berryStrengthBonus: 1,
		recipeBonus: 0,
		recipeLevel: 1,
		dishBonus: 1,
	};

	it("倍率が未指定なら元のボーナスコンテキストを返す", () => {
		expect(applyBerryZoneMultiplier(bonusContext, undefined)).toBe(
			bonusContext,
		);
		expect(applyBerryZoneMultiplier(bonusContext, 1)).toBe(bonusContext);
		expect(applyBerryZoneMultiplier(undefined, 1.5)).toBeUndefined();
	});

	it("倍率をきのみ強度ボーナスに掛ける", () => {
		expect(applyBerryZoneMultiplier(bonusContext, 1.5)).toEqual({
			...bonusContext,
			berryStrengthBonus: 1.5,
		});
	});

	it("きのみEPは時間帯ごとの倍率で計算する", () => {
		const iv = new PokemonIv({ pokemonName: "Natu", level: 1 });
		const pokemon = new PokemonBoxItem(iv);
		const results = [
			createSlotResult({ slotId: "slot-1", berryCount: 10 }),
			createSlotResult({
				slotId: "slot-2",
				berryCount: 10,
				berryZoneMultiplier: 1.5,
			}),
		];

		const summary = calculateDailySummary(1, pokemon, results, bonusContext);

		const baseStrength = calculateBerryStrength(
			pokemon.iv.pokemon.type,
			pokemon.iv.level,
		);
		expect(summary.berryEP).toBe(
			baseStrength * 10 + Math.ceil(baseStrength * 1.5) * 10,
		);
	});

	it("倍率がなければ従来どおり合計個数から計算した値と一致する", () => {
		const iv = new PokemonIv({ pokemonName: "Natu", level: 1 });
		const pokemon = new PokemonBoxItem(iv);
		const results = [
			createSlotResult({ slotId: "slot-1", berryCount: 7 }),
			createSlotResult({ slotId: "slot-2", berryCount: 13 }),
		];

		const summary = calculateDailySummary(1, pokemon, results, bonusContext);

		expect(summary.berryEP).toBe(calculateBerryEP(pokemon, 20, bonusContext));
	});
});

describe("とてもおおきなマゴのみのEP", () => {
	function createSlotResult(
		overrides: Partial<TimeSlotResult> = {},
	): TimeSlotResult {
		return {
			slotId: "slot-1",
			pokemonId: 1,
			teamIndex: 0,
			durationMinutes: 300,
			isSleeping: false,
			helpCount: 0,
			skillTriggerCount: 0,
			berryCount: 0,
			ingredients: [],
			energyStart: 100,
			energyEnd: 100,
			mealRecovery: 0,
			skillRecovery: 0,
			wakeRecovery: 0,
			energyDecay: 0,
			skillOverflowCount: 0,
			overflowIngredients: [],
			selfSkillRecovery: 0,
			directSkillEP: 0,
			moonlightGivenRecovery: 0,
			moonlightReceivedRecovery: 0,
			energizingCheerGivenRecovery: 0,
			energizingCheerReceivedRecovery: 0,
			energizingCheerEvents: [],
			nuzzleTriggeredSkillEvents: [],
			presentCandyCount: 0,
			berryJuiceCount: 0,
			supportSkillBerryCount: 0,
			supportSkillBerryEP: 0,
			supportHelpEvents: [],
			stockpileStoreCount: 0,
			stockpileSpitCount: 0,
			badDreamsHitCount: 0,
			badDreamsTotalDamageGiven: 0,
			badDreamsDamageTaken: 0,
			...overrides,
		};
	}

	const bonusContext = {
		fieldBonus: 0,
		berryStrengthBonus: 1,
		recipeBonus: 0,
		recipeLevel: 1,
		dishBonus: 1,
	};

	it("通常のマゴのみエナジーに倍率を掛ける", () => {
		const magoStrength = calculateBerryStrength("psychic", 50);

		expect(calculateHugeMagoBerryEP(50, 4, 3, bonusContext)).toBe(
			Math.ceil(magoStrength * 3) * 4,
		);
	});

	it("拾ったポケモンのタイプではなくマゴのみの強度を使う", () => {
		expect(calculateHugeMagoBerryEP(50, 1, 1, bonusContext)).toBe(
			calculateBerryStrength("psychic", 50),
		);
	});

	it("個数か倍率が0なら0になる", () => {
		expect(calculateHugeMagoBerryEP(50, 0, 3, bonusContext)).toBe(0);
		expect(calculateHugeMagoBerryEP(50, 5, 0, bonusContext)).toBe(0);
	});

	it("きのみゾーンの倍率を重ねて適用できる", () => {
		const magoStrength = calculateBerryStrength("psychic", 50);

		expect(
			calculateHugeMagoBerryEP(
				50,
				1,
				3,
				applyBerryZoneMultiplier(bonusContext, 1.5),
			),
		).toBe(Math.ceil(Math.ceil(magoStrength * 1.5) * 3));
	});

	it("一日合計のきのみEPに含まれ、個数も集計される", () => {
		const pokemon = new PokemonBoxItem(
			new PokemonIv({ pokemonName: "Pikachu", level: 30 }),
		);
		const results = [
			createSlotResult({
				slotId: "slot-1",
				berryCount: 10,
				hugeMagoBerryCount: 2,
				hugeMagoBerryEP: 300,
			}),
			createSlotResult({
				slotId: "slot-2",
				berryCount: 5,
				hugeMagoBerryCount: 1,
				hugeMagoBerryEP: 150,
			}),
		];

		const summary = calculateDailySummary(1, pokemon, results, bonusContext);

		expect(summary.totalHugeMagoBerryCount).toBe(3);
		expect(summary.hugeMagoBerryEP).toBe(450);
		expect(summary.berryEP).toBe(
			calculateBerryEP(pokemon, 15, bonusContext) + 450,
		);
		expect(summary.totalEP).toBe(
			summary.berryEP + summary.ingredientEP + summary.skillEP,
		);
	});

	it("チーム合計にも集計される", () => {
		const pokemon = new PokemonBoxItem(
			new PokemonIv({ pokemonName: "Pikachu", level: 30 }),
		);
		const summaries: DailySummary[] = [
			calculateDailySummary(
				1,
				pokemon,
				[createSlotResult({ hugeMagoBerryCount: 2, hugeMagoBerryEP: 300 })],
				bonusContext,
			),
			calculateDailySummary(
				2,
				pokemon,
				[createSlotResult({ hugeMagoBerryCount: 3, hugeMagoBerryEP: 450 })],
				bonusContext,
			),
		];

		const teamSummary = calculateTeamSummary(summaries);

		expect(teamSummary.totalHugeMagoBerryCount).toBe(5);
		expect(teamSummary.totalHugeMagoBerryEP).toBe(750);
		expect(teamSummary.totalBerryEP).toBe(750);
	});
});
