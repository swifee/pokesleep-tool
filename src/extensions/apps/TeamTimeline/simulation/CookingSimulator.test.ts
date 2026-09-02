import { describe, expect, it } from "vitest";
import {
	calculateEffectivePotCapacity,
	computeInitialIngredientAttributedEP,
	createIngredientBag,
	executeMealCooking,
	planExtraIngredientsByEvent,
	selectBestRecipe,
} from "./CookingSimulator";
import SeededRandom from "./SeededRandom";

describe("CookingSimulator", () => {
	it("captures bag ingredients before cooking", () => {
		const bag = createIngredientBag({ apple: 7, egg: 4 });
		const random = new SeededRandom(12345);

		const { result } = executeMealCooking({
			bag,
			category: "curry",
			recipeLevels: {},
			basePotCapacity: 7,
			isGoodCampTicket: false,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: 0,
			fieldBonus: 0,
			eventBonus: 0,
			random,
			mealSlotId: "meal-1",
			mealType: "breakfast",
		});

		const beforeApple = result.bagIngredientsBeforeCooking?.find(
			(ingredient) => ingredient.name === "apple",
		);
		const beforeEgg = result.bagIngredientsBeforeCooking?.find(
			(ingredient) => ingredient.name === "egg",
		);

		expect(result.recipeName).toBe("specialAppleCurry");
		expect(beforeApple?.count).toBe(7);
		expect(beforeEgg?.count).toBe(4);
	});

	it("calculates initial ingredient attributed EP from cooking events", () => {
		const totalInitialIngredientEP = computeInitialIngredientAttributedEP([
			{
				mealSlotId: "slot-1",
				mealType: "breakfast",
				recipeName: "recipeA",
				isGreatSuccess: false,
				cookingEP: 100,
				eBase: 100,
				eDisplay: 100,
				eFinal: 100,
				ingredientsUsed: [
					{
						name: "apple",
						count: 10,
						pokemonAttribution: new Map(),
						fromInitial: 4,
					},
				],
				remainingPotCapacity: 0,
				effectivePotCapacity: 30,
				tastyChancePercent: 10,
				cookingPowerUpBonusUsed: 0,
			},
			{
				mealSlotId: "slot-2",
				mealType: "lunch",
				recipeName: "recipeB",
				isGreatSuccess: false,
				cookingEP: 300,
				eBase: 100,
				eDisplay: 100,
				eFinal: 100,
				ingredientsUsed: [
					{
						name: "apple",
						count: 6,
						pokemonAttribution: new Map([[1, 6]]),
						fromInitial: 0,
					},
				],
				remainingPotCapacity: 0,
				effectivePotCapacity: 30,
				tastyChancePercent: 10,
				cookingPowerUpBonusUsed: 0,
			},
		]);

		expect(totalInitialIngredientEP).toBe(40);
	});

	it("advances tasty chain even when no recipe is available", () => {
		const bag = createIngredientBag({});
		const random = new SeededRandom(20260216);

		const { result, newTastyChanceAccumulated } = executeMealCooking({
			bag,
			category: "curry",
			recipeLevels: {},
			basePotCapacity: 12,
			isGoodCampTicket: false,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: 90,
			fieldBonus: 0,
			eventBonus: 0,
			random,
			mealSlotId: "meal-skip",
			mealType: "dinner",
		});

		expect(result.recipeName).toBeNull();
		expect(result.cookingEP).toBe(0);
		expect(result.isGreatSuccess).toBe(true);
		expect(newTastyChanceAccumulated).toBe(0);
	});

	it("does not cook recipes that are marked disabled", () => {
		const bag = createIngredientBag({ apple: 7 });
		const random = new SeededRandom(13579);

		const selectedWithoutLock = selectBestRecipe("curry", bag, 7, {}, 0, 0);
		expect(selectedWithoutLock?.recipe.name).toBe("specialAppleCurry");

		const { result } = executeMealCooking({
			bag: createIngredientBag({ apple: 7 }),
			category: "curry",
			recipeLevels: {},
			basePotCapacity: 7,
			isGoodCampTicket: false,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: 0,
			fieldBonus: 0,
			eventBonus: 0,
			disabledRecipes: new Set(["specialAppleCurry"]),
			random,
			mealSlotId: "meal-disabled-recipe",
			mealType: "breakfast",
		});

		expect(result.recipeName).toBeNull();
	});

	it("plans extra ingredients with future-time constraints", () => {
		const plan = planExtraIngredientsByEvent([
			{
				mealSlotId: "slot-1",
				mealType: "breakfast",
				recipeName: "recipeA",
				isGreatSuccess: false,
				cookingEP: 100,
				eBase: 100,
				eDisplay: 100,
				eFinal: 100,
				ingredientsUsed: [
					{
						name: "apple",
						count: 8,
						pokemonAttribution: new Map(),
						fromInitial: 0,
					},
				],
				remainingPotCapacity: 5,
				effectivePotCapacity: 20,
				tastyChancePercent: 10,
				cookingPowerUpBonusUsed: 0,
				bagIngredientsBeforeCooking: [{ name: "apple", count: 10 }],
			},
			{
				mealSlotId: "slot-2",
				mealType: "lunch",
				recipeName: "recipeB",
				isGreatSuccess: false,
				cookingEP: 100,
				eBase: 100,
				eDisplay: 100,
				eFinal: 100,
				ingredientsUsed: [
					{
						name: "apple",
						count: 2,
						pokemonAttribution: new Map(),
						fromInitial: 0,
					},
				],
				remainingPotCapacity: 5,
				effectivePotCapacity: 20,
				tastyChancePercent: 10,
				cookingPowerUpBonusUsed: 0,
				bagIngredientsBeforeCooking: [{ name: "apple", count: 2 }],
			},
		]);

		expect(plan[0]).toEqual([]);
		expect(plan[1]).toEqual([]);
	});

	it("prioritizes higher base-energy ingredients for extra allocation", () => {
		const plan = planExtraIngredientsByEvent([
			{
				mealSlotId: "slot-1",
				mealType: "breakfast",
				recipeName: "recipeA",
				isGreatSuccess: false,
				cookingEP: 100,
				eBase: 100,
				eDisplay: 100,
				eFinal: 100,
				ingredientsUsed: [],
				remainingPotCapacity: 3,
				effectivePotCapacity: 20,
				tastyChancePercent: 10,
				cookingPowerUpBonusUsed: 0,
				bagIngredientsBeforeCooking: [
					{ name: "apple", count: 5 },
					{ name: "mushroom", count: 5 },
				],
			},
		]);

		expect(plan[0]?.[0]?.name).toBe("mushroom");
		expect(plan[0]?.[0]?.count).toBe(3);
	});

	it("excludes locked ingredients from extra allocation", () => {
		const plan = planExtraIngredientsByEvent(
			[
				{
					mealSlotId: "slot-1",
					mealType: "breakfast",
					recipeName: "recipeA",
					isGreatSuccess: false,
					cookingEP: 100,
					eBase: 100,
					eDisplay: 100,
					eFinal: 100,
					ingredientsUsed: [],
					remainingPotCapacity: 3,
					effectivePotCapacity: 20,
					tastyChancePercent: 10,
					cookingPowerUpBonusUsed: 0,
					bagIngredientsBeforeCooking: [
						{ name: "apple", count: 5 },
						{ name: "mushroom", count: 5 },
					],
				},
			],
			{
				excludedIngredientNames: new Set(["mushroom" as const]),
			},
		);

		expect(plan[0]?.[0]?.name).toBe("apple");
		expect(plan[0]?.[0]?.count).toBe(3);
	});

	it("includes extra ingredients in initial ingredient attributed EP", () => {
		const totalInitialIngredientEP = computeInitialIngredientAttributedEP([
			{
				mealSlotId: "slot-1",
				mealType: "breakfast",
				recipeName: "recipeA",
				isGreatSuccess: false,
				cookingEP: 120,
				eBase: 100,
				eDisplay: 100,
				eFinal: 100,
				ingredientsUsed: [
					{
						name: "apple",
						count: 10,
						pokemonAttribution: new Map([[1, 10]]),
						fromInitial: 0,
					},
				],
				extraIngredientsUsed: [
					{
						name: "milk",
						count: 10,
						pokemonAttribution: new Map(),
						fromInitial: 10,
					},
				],
				remainingPotCapacity: 0,
				effectivePotCapacity: 30,
				tastyChancePercent: 10,
				cookingPowerUpBonusUsed: 0,
			},
		]);

		expect(totalInitialIngredientEP).toBeCloseTo(62.55, 2);
	});
});

describe("calculateEffectivePotCapacity", () => {
	it("イベント倍率がない場合は従来の容量を維持する", () => {
		expect(calculateEffectivePotCapacity(60, false, 0)).toBe(60);
		expect(calculateEffectivePotCapacity(60, false, 0, 1)).toBe(60);
	});

	it("イベントの鍋容量倍率を基礎容量へ適用する", () => {
		expect(calculateEffectivePotCapacity(60, false, 0, 1.6)).toBe(96);
		expect(calculateEffectivePotCapacity(60, false, 0, 2)).toBe(120);
	});

	it("イベント倍率とキャンプチケット倍率は乗算で重なる", () => {
		expect(calculateEffectivePotCapacity(60, true, 0, 2)).toBe(180);
	});

	it("料理パワーアップの追加容量は倍率適用後に加算する", () => {
		expect(calculateEffectivePotCapacity(60, false, 7, 2)).toBe(127);
	});

	it("端数は丸めてから追加容量を足す", () => {
		// 21 * 1.6 = 33.6 -> 34
		expect(calculateEffectivePotCapacity(21, false, 0, 1.6)).toBe(34);
	});

	it("1未満の倍率は無効な入力として1として扱う", () => {
		expect(calculateEffectivePotCapacity(60, false, 0, 0)).toBe(60);
		expect(calculateEffectivePotCapacity(60, false, 0, -3)).toBe(60);
	});
});

describe("executeMealCooking の鍋容量倍率", () => {
	it("鍋容量倍率が有効容量へ反映される", () => {
		const withoutBonus = executeMealCooking({
			bag: createIngredientBag({ apple: 20 }),
			category: "curry",
			recipeLevels: {},
			basePotCapacity: 7,
			isGoodCampTicket: false,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: 0,
			fieldBonus: 0,
			eventBonus: 0,
			random: new SeededRandom(2026),
			mealSlotId: "meal-1",
			mealType: "breakfast",
		});
		const withBonus = executeMealCooking({
			bag: createIngredientBag({ apple: 20 }),
			category: "curry",
			recipeLevels: {},
			basePotCapacity: 7,
			isGoodCampTicket: false,
			potSizeMultiplier: 2,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: 0,
			fieldBonus: 0,
			eventBonus: 0,
			random: new SeededRandom(2026),
			mealSlotId: "meal-1",
			mealType: "breakfast",
		});

		expect(withoutBonus.result.effectivePotCapacity).toBe(7);
		expect(withBonus.result.effectivePotCapacity).toBe(14);
	});
});
