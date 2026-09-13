import { describe, expect, it } from "vitest";
import {
	BASE_GREAT_SUCCESS_CHANCE,
	GREAT_SUCCESS_EP_MULTIPLIER,
	MAX_GREAT_SUCCESS_CHANCE,
	SUNDAY_GREAT_SUCCESS_CHANCE,
	SUNDAY_GREAT_SUCCESS_EP_MULTIPLIER,
	SUNDAY_POT_SIZE_MULTIPLIER,
} from "../types/CookingTypes";
import {
	applyGreatSuccessMultiplier,
	calculateEffectivePotCapacity,
	calculateGreatSuccessChance,
	computeInitialIngredientAttributedEP,
	createIngredientBag,
	executeMealCooking,
	getDayCookingRule,
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
				greatSuccessMultiplier: 2,
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
				greatSuccessMultiplier: 2,
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
				greatSuccessMultiplier: 2,
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
				greatSuccessMultiplier: 2,
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
				greatSuccessMultiplier: 2,
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
					greatSuccessMultiplier: 2,
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
				greatSuccessMultiplier: 2,
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

describe("calculateEffectivePotCapacity の曜日倍率", () => {
	it("日曜倍率(2)は基礎容量へ乗算される", () => {
		expect(calculateEffectivePotCapacity(60, false, 0, 1, 2)).toBe(120);
	});

	it("日曜倍率・イベント倍率・キャンプチケット倍率は乗算で重なってから丸める", () => {
		// 21 * 1.6 * 2 * 1.5 = 100.8 -> 101
		expect(calculateEffectivePotCapacity(21, true, 0, 1.6, 2)).toBe(101);
	});

	it("料理パワーアップの追加容量は日曜倍率の適用後に加算する", () => {
		expect(calculateEffectivePotCapacity(60, false, 7, 1, 2)).toBe(127);
	});

	it("1未満の曜日倍率は1として扱う", () => {
		expect(calculateEffectivePotCapacity(60, false, 0, 1, 0)).toBe(60);
	});
});

describe("getDayCookingRule", () => {
	it("月〜土は鍋1倍・大成功10%・EP2倍", () => {
		expect(getDayCookingRule(false)).toEqual({
			potSizeMultiplier: 1,
			baseGreatSuccessChance: BASE_GREAT_SUCCESS_CHANCE,
			greatSuccessMultiplier: GREAT_SUCCESS_EP_MULTIPLIER,
		});
	});

	it("日曜は鍋2倍・大成功30%・EP3倍", () => {
		expect(getDayCookingRule(true)).toEqual({
			potSizeMultiplier: SUNDAY_POT_SIZE_MULTIPLIER,
			baseGreatSuccessChance: SUNDAY_GREAT_SUCCESS_CHANCE,
			greatSuccessMultiplier: SUNDAY_GREAT_SUCCESS_EP_MULTIPLIER,
		});
	});
});

describe("calculateGreatSuccessChance", () => {
	it("基礎確率に料理チャンスの蓄積を加算する", () => {
		expect(calculateGreatSuccessChance(10, 12.5)).toBe(22.5);
		expect(calculateGreatSuccessChance(30, 12.5)).toBe(42.5);
	});

	it("日曜30%と料理チャンス上限70%の合算でちょうど100%になる", () => {
		expect(calculateGreatSuccessChance(30, 70)).toBe(100);
	});

	it("合算が100%を超える場合は100%で頭打ちにする", () => {
		expect(calculateGreatSuccessChance(30, 95)).toBe(MAX_GREAT_SUCCESS_CHANCE);
		expect(calculateGreatSuccessChance(10, 150)).toBe(MAX_GREAT_SUCCESS_CHANCE);
	});

	it("負の蓄積は0として扱う", () => {
		expect(calculateGreatSuccessChance(10, -5)).toBe(10);
	});
});

describe("applyGreatSuccessMultiplier", () => {
	it("大成功時のみ倍率を掛ける", () => {
		expect(applyGreatSuccessMultiplier(1000, false, 3)).toBe(1000);
		expect(applyGreatSuccessMultiplier(1000, true, 2)).toBe(2000);
		expect(applyGreatSuccessMultiplier(1000, true, 3)).toBe(3000);
	});
});

describe("executeMealCooking の日曜ルール", () => {
	function cookApples(options: {
		isSunday?: boolean;
		tastyChanceAccumulated?: number;
		seed?: number;
		basePotCapacity?: number;
	}) {
		return executeMealCooking({
			bag: createIngredientBag({ apple: 20 }),
			category: "curry",
			recipeLevels: {},
			basePotCapacity: options.basePotCapacity ?? 7,
			isGoodCampTicket: false,
			isSunday: options.isSunday,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: options.tastyChanceAccumulated ?? 0,
			fieldBonus: 0,
			eventBonus: 0,
			random: new SeededRandom(options.seed ?? 2026),
			mealSlotId: "meal-sunday",
			mealType: "breakfast",
		});
	}

	it("isSunday 未指定・false は従来通り 10% / 2倍 / 鍋1倍", () => {
		const { result } = cookApples({});
		const { result: explicitWeekday } = cookApples({ isSunday: false });

		expect(result.tastyChancePercent).toBe(10);
		expect(result.greatSuccessMultiplier).toBe(2);
		expect(result.effectivePotCapacity).toBe(7);
		expect(explicitWeekday.tastyChancePercent).toBe(10);
		expect(explicitWeekday.greatSuccessMultiplier).toBe(2);
		expect(explicitWeekday.effectivePotCapacity).toBe(7);
	});

	it("日曜は基礎大成功率30%・EP3倍・鍋容量2倍になる", () => {
		const { result } = cookApples({ isSunday: true });

		expect(result.tastyChancePercent).toBe(30);
		expect(result.greatSuccessMultiplier).toBe(3);
		expect(result.effectivePotCapacity).toBe(14);
	});

	it("日曜の大成功時は eFinal の3倍が料理EPになる", () => {
		// 蓄積70%で日曜は合算100%となり必ず大成功する
		const { result, newTastyChanceAccumulated } = cookApples({
			isSunday: true,
			tastyChanceAccumulated: 70,
		});

		expect(result.recipeName).toBe("specialAppleCurry");
		expect(result.isGreatSuccess).toBe(true);
		expect(result.tastyChancePercent).toBe(100);
		expect(result.cookingEP).toBe(result.eFinal * 3);
		expect(newTastyChanceAccumulated).toBe(0);
	});

	it("月〜土の大成功時は eFinal の2倍が料理EPになる", () => {
		const { result } = cookApples({
			isSunday: false,
			tastyChanceAccumulated: 90,
		});

		expect(result.isGreatSuccess).toBe(true);
		expect(result.tastyChancePercent).toBe(100);
		expect(result.cookingEP).toBe(result.eFinal * 2);
	});

	it("大成功率は料理チャンスの蓄積と合算しても100%で頭打ちになる", () => {
		const { result } = cookApples({
			isSunday: true,
			tastyChanceAccumulated: 95,
		});

		expect(result.tastyChancePercent).toBe(100);
	});

	it("作れるレシピが無い日曜の食事でも倍率と鍋容量は日曜の値を持つ", () => {
		const { result } = executeMealCooking({
			bag: createIngredientBag({}),
			category: "curry",
			recipeLevels: {},
			basePotCapacity: 12,
			isGoodCampTicket: false,
			isSunday: true,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: 0,
			fieldBonus: 0,
			eventBonus: 0,
			random: new SeededRandom(1),
			mealSlotId: "meal-skip-sunday",
			mealType: "dinner",
		});

		expect(result.recipeName).toBeNull();
		expect(result.cookingEP).toBe(0);
		expect(result.greatSuccessMultiplier).toBe(3);
		expect(result.tastyChancePercent).toBe(30);
		expect(result.effectivePotCapacity).toBe(24);
	});

	it("日曜は鍋容量が2倍になるため、より大きなレシピを選べる", () => {
		// 鍋8では7個レシピまでだが、日曜の鍋16なら満腹チーズバーグカレー(16個)が作れる
		const weekday = executeMealCooking({
			bag: createIngredientBag({ milk: 8, sausage: 8 }),
			category: "curry",
			recipeLevels: {},
			basePotCapacity: 8,
			isGoodCampTicket: false,
			isSunday: false,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: 0,
			fieldBonus: 0,
			eventBonus: 0,
			random: new SeededRandom(3),
			mealSlotId: "meal-weekday",
			mealType: "lunch",
		});
		const sunday = executeMealCooking({
			bag: createIngredientBag({ milk: 8, sausage: 8 }),
			category: "curry",
			recipeLevels: {},
			basePotCapacity: 8,
			isGoodCampTicket: false,
			isSunday: true,
			cookingPowerUpBonus: 0,
			tastyChanceAccumulated: 0,
			fieldBonus: 0,
			eventBonus: 0,
			random: new SeededRandom(3),
			mealSlotId: "meal-sunday",
			mealType: "lunch",
		});

		expect(weekday.result.recipeName).toBe("beanBurgerCurry");
		expect(sunday.result.recipeName).toBe("fullCheeseBurgerCurry");
	});
});
