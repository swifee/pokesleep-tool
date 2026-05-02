import type { CookingCategory, RecipeDefinition } from "../types/CookingTypes";

/**
 * 全レシピのマスターデータ。
 * カレー・シチュー(curry): 23品、サラダ(salad): 25品、デザート・ドリンク(dessert): 23品
 * 合計 71 レシピ。
 */
export const RECIPES: readonly RecipeDefinition[] = [
	// ========================================================================
	// カレー・シチュー (curry) - 23 recipes
	// ========================================================================
	{
		name: "specialAppleCurry",
		category: "curry",
		ingredients: [{ name: "apple", count: 7 }],
		recipeBonus: 0.19,
	},
	{
		name: "simpleWhiteStew",
		category: "curry",
		ingredients: [{ name: "milk", count: 7 }],
		recipeBonus: 0.19,
	},
	{
		name: "babyHoneyCurry",
		category: "curry",
		ingredients: [{ name: "honey", count: 7 }],
		recipeBonus: 0.19,
	},
	{
		name: "beanBurgerCurry",
		category: "curry",
		ingredients: [{ name: "sausage", count: 7 }],
		recipeBonus: 0.19,
	},
	{
		name: "fullCheeseBurgerCurry",
		category: "curry",
		ingredients: [
			{ name: "milk", count: 8 },
			{ name: "sausage", count: 8 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "droughtCutletCurry",
		category: "curry",
		ingredients: [
			{ name: "sausage", count: 10 },
			{ name: "oil", count: 5 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "sunPowerTomatoCurry",
		category: "curry",
		ingredients: [
			{ name: "tomato", count: 10 },
			{ name: "herb", count: 5 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "meltingOmeletteCurry",
		category: "curry",
		ingredients: [
			{ name: "egg", count: 10 },
			{ name: "tomato", count: 6 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "cozyWhiteStew",
		category: "curry",
		ingredients: [
			{ name: "milk", count: 10 },
			{ name: "potato", count: 8 },
			{ name: "mushroom", count: 4 },
		],
		recipeBonus: 0.205,
	},
	{
		name: "bulkUpBeanCurry",
		category: "curry",
		ingredients: [
			{ name: "soy", count: 12 },
			{ name: "sausage", count: 6 },
			{ name: "herb", count: 4 },
			{ name: "egg", count: 4 },
		],
		recipeBonus: 0.21,
	},
	{
		name: "mushroomSporeCurry",
		category: "curry",
		ingredients: [
			{ name: "mushroom", count: 14 },
			{ name: "potato", count: 9 },
		],
		recipeBonus: 0.205,
	},
	{
		name: "parentBondCurry",
		category: "curry",
		ingredients: [
			{ name: "honey", count: 12 },
			{ name: "apple", count: 11 },
			{ name: "egg", count: 8 },
			{ name: "potato", count: 4 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "flexCornStew",
		category: "curry",
		ingredients: [
			{ name: "corn", count: 14 },
			{ name: "milk", count: 8 },
			{ name: "potato", count: 8 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "chirpChirpPunchSpicyCurry",
		category: "curry",
		ingredients: [
			{ name: "coffee", count: 11 },
			{ name: "herb", count: 11 },
			{ name: "honey", count: 11 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "spicyLeekCurry",
		category: "curry",
		ingredients: [
			{ name: "leek", count: 14 },
			{ name: "ginger", count: 10 },
			{ name: "herb", count: 8 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "grilledTailCurry",
		category: "curry",
		ingredients: [
			{ name: "tail", count: 8 },
			{ name: "herb", count: 25 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "absoluteSleepButterCurry",
		category: "curry",
		ingredients: [
			{ name: "potato", count: 18 },
			{ name: "tomato", count: 15 },
			{ name: "cacao", count: 12 },
			{ name: "milk", count: 10 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "ninjaCurry",
		category: "curry",
		ingredients: [
			{ name: "soy", count: 24 },
			{ name: "sausage", count: 9 },
			{ name: "leek", count: 12 },
			{ name: "mushroom", count: 5 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "infernoCornKeemaCurry",
		category: "curry",
		ingredients: [
			{ name: "herb", count: 27 },
			{ name: "sausage", count: 24 },
			{ name: "corn", count: 14 },
			{ name: "ginger", count: 12 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "awakeningPowerStew",
		category: "curry",
		ingredients: [
			{ name: "soy", count: 28 },
			{ name: "tomato", count: 25 },
			{ name: "mushroom", count: 23 },
			{ name: "coffee", count: 16 },
		],
		recipeBonus: 0.61,
	},
	{
		name: "sacredSwordSukiyakiCurry",
		category: "curry",
		ingredients: [
			{ name: "sausage", count: 26 },
			{ name: "honey", count: 26 },
			{ name: "egg", count: 22 },
			{ name: "leek", count: 27 },
		],
		recipeBonus: 0.61,
	},
	{
		name: "trickOrTreatPumpkinStew",
		category: "curry",
		ingredients: [
			{ name: "pumpkin", count: 10 },
			{ name: "sausage", count: 16 },
			{ name: "potato", count: 18 },
			{ name: "mushroom", count: 25 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "verdantAvocadoGratin",
		category: "curry",
		ingredients: [
			{ name: "avocado", count: 22 },
			{ name: "potato", count: 20 },
			{ name: "milk", count: 41 },
			{ name: "oil", count: 32 },
		],
		recipeBonus: 0.78,
	},

	// ========================================================================
	// サラダ (salad) - 25 recipes
	// ========================================================================
	{
		name: "specialAppleSalad",
		category: "salad",
		ingredients: [{ name: "apple", count: 8 }],
		recipeBonus: 0.19,
	},
	{
		name: "beanHamSalad",
		category: "salad",
		ingredients: [{ name: "sausage", count: 8 }],
		recipeBonus: 0.19,
	},
	{
		name: "sleepyTomatoSalad",
		category: "salad",
		ingredients: [{ name: "tomato", count: 8 }],
		recipeBonus: 0.19,
	},
	{
		name: "snowClawCaesarSalad",
		category: "salad",
		ingredients: [
			{ name: "milk", count: 10 },
			{ name: "sausage", count: 6 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "heatWaveTofuSalad",
		category: "salad",
		ingredients: [
			{ name: "herb", count: 6 },
			{ name: "soy", count: 10 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "charmAppleCheeseSalad",
		category: "salad",
		ingredients: [
			{ name: "apple", count: 15 },
			{ name: "milk", count: 5 },
			{ name: "oil", count: 3 },
		],
		recipeBonus: 0.205,
	},
	{
		name: "immunityLeekSalad",
		category: "salad",
		ingredients: [
			{ name: "leek", count: 10 },
			{ name: "ginger", count: 5 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "furyAttackCornSalad",
		category: "salad",
		ingredients: [
			{ name: "corn", count: 9 },
			{ name: "oil", count: 8 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "mooMooCaprese",
		category: "salad",
		ingredients: [
			{ name: "milk", count: 12 },
			{ name: "tomato", count: 6 },
			{ name: "oil", count: 5 },
		],
		recipeBonus: 0.205,
	},
	{
		name: "superPowerWildSalad",
		category: "salad",
		ingredients: [
			{ name: "sausage", count: 9 },
			{ name: "ginger", count: 6 },
			{ name: "egg", count: 5 },
			{ name: "potato", count: 3 },
		],
		recipeBonus: 0.205,
	},
	{
		name: "hydrationTofuSalad",
		category: "salad",
		ingredients: [
			{ name: "soy", count: 15 },
			{ name: "tomato", count: 9 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "moodyChocoMeatSalad",
		category: "salad",
		ingredients: [
			{ name: "cacao", count: 14 },
			{ name: "sausage", count: 9 },
		],
		recipeBonus: 0.205,
	},
	{
		name: "gluttonPotatoSalad",
		category: "salad",
		ingredients: [
			{ name: "potato", count: 14 },
			{ name: "egg", count: 9 },
			{ name: "sausage", count: 7 },
			{ name: "apple", count: 6 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "overheatSalad",
		category: "salad",
		ingredients: [
			{ name: "herb", count: 17 },
			{ name: "ginger", count: 10 },
			{ name: "tomato", count: 8 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "mushroomSporeSalad",
		category: "salad",
		ingredients: [
			{ name: "mushroom", count: 17 },
			{ name: "tomato", count: 8 },
			{ name: "oil", count: 8 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "calmMindSweetSalad",
		category: "salad",
		ingredients: [
			{ name: "corn", count: 12 },
			{ name: "apple", count: 21 },
			{ name: "honey", count: 16 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "slowpokeTailPepperSalad",
		category: "salad",
		ingredients: [
			{ name: "tail", count: 10 },
			{ name: "herb", count: 10 },
			{ name: "oil", count: 15 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "crossChopSalad",
		category: "salad",
		ingredients: [
			{ name: "egg", count: 20 },
			{ name: "sausage", count: 15 },
			{ name: "corn", count: 11 },
			{ name: "tomato", count: 10 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "greenGrassSalad",
		category: "salad",
		ingredients: [
			{ name: "corn", count: 17 },
			{ name: "potato", count: 9 },
			{ name: "tomato", count: 14 },
			{ name: "oil", count: 22 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "ninjaSalad",
		category: "salad",
		ingredients: [
			{ name: "leek", count: 15 },
			{ name: "soy", count: 19 },
			{ name: "mushroom", count: 12 },
			{ name: "ginger", count: 11 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "petalBlizzardMimosaSalad",
		category: "salad",
		ingredients: [
			{ name: "egg", count: 25 },
			{ name: "oil", count: 17 },
			{ name: "potato", count: 15 },
			{ name: "sausage", count: 12 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "appleYogurtSalad",
		category: "salad",
		ingredients: [
			{ name: "milk", count: 18 },
			{ name: "tomato", count: 23 },
			{ name: "egg", count: 35 },
			{ name: "apple", count: 28 },
		],
		recipeBonus: 0.78,
	},
	{
		name: "competitiveCoffeeSalad",
		category: "salad",
		ingredients: [
			{ name: "coffee", count: 28 },
			{ name: "sausage", count: 28 },
			{ name: "oil", count: 22 },
			{ name: "potato", count: 22 },
		],
		recipeBonus: 0.61,
	},
	{
		name: "crushingAvocadoSalad",
		category: "salad",
		ingredients: [
			{ name: "avocado", count: 14 },
			{ name: "tomato", count: 18 },
			{ name: "milk", count: 10 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "bulldozeGuacamoleChips",
		category: "salad",
		ingredients: [
			{ name: "avocado", count: 28 },
			{ name: "corn", count: 25 },
			{ name: "herb", count: 30 },
			{ name: "soy", count: 22 },
		],
		recipeBonus: 0.78,
	},

	// ========================================================================
	// デザート・ドリンク (dessert) - 23 recipes
	// ========================================================================
	{
		name: "mooMooHotMilk",
		category: "dessert",
		ingredients: [{ name: "milk", count: 7 }],
		recipeBonus: 0.19,
	},
	{
		name: "specialAppleJuice",
		category: "dessert",
		ingredients: [{ name: "apple", count: 8 }],
		recipeBonus: 0.19,
	},
	{
		name: "craftSodaPop",
		category: "dessert",
		ingredients: [{ name: "honey", count: 9 }],
		recipeBonus: 0.19,
	},
	{
		name: "wishfulApplePie",
		category: "dessert",
		ingredients: [
			{ name: "apple", count: 12 },
			{ name: "milk", count: 4 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "agedSweetPotato",
		category: "dessert",
		ingredients: [
			{ name: "potato", count: 9 },
			{ name: "milk", count: 5 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "emberGingerTea",
		category: "dessert",
		ingredients: [
			{ name: "ginger", count: 9 },
			{ name: "apple", count: 7 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "lightSoyCake",
		category: "dessert",
		ingredients: [
			{ name: "egg", count: 8 },
			{ name: "soy", count: 7 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "ownPaceVeggieJuice",
		category: "dessert",
		ingredients: [
			{ name: "tomato", count: 9 },
			{ name: "apple", count: 7 },
		],
		recipeBonus: 0.19,
	},
	{
		name: "bigMalasada",
		category: "dessert",
		ingredients: [
			{ name: "oil", count: 10 },
			{ name: "milk", count: 7 },
			{ name: "honey", count: 6 },
		],
		recipeBonus: 0.205,
	},
	{
		name: "earlyBirdCoffeeJelly",
		category: "dessert",
		ingredients: [
			{ name: "coffee", count: 16 },
			{ name: "milk", count: 14 },
			{ name: "honey", count: 12 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "petalDanceChocolateTart",
		category: "dessert",
		ingredients: [
			{ name: "cacao", count: 11 },
			{ name: "apple", count: 11 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "hugePowerSoyDonuts",
		category: "dessert",
		ingredients: [
			{ name: "oil", count: 16 },
			{ name: "soy", count: 12 },
			{ name: "cacao", count: 7 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "lovelyKissFruitAuLait",
		category: "dessert",
		ingredients: [
			{ name: "apple", count: 11 },
			{ name: "milk", count: 9 },
			{ name: "honey", count: 7 },
			{ name: "cacao", count: 8 },
		],
		recipeBonus: 0.25,
	},
	{
		name: "moldBreakerCornTiramisu",
		category: "dessert",
		ingredients: [
			{ name: "coffee", count: 14 },
			{ name: "corn", count: 14 },
			{ name: "milk", count: 12 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "grassMixerSmoothie",
		category: "dessert",
		ingredients: [
			{ name: "avocado", count: 18 },
			{ name: "tomato", count: 16 },
			{ name: "milk", count: 14 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "puddingAlaModeParty",
		category: "dessert",
		ingredients: [
			{ name: "honey", count: 20 },
			{ name: "egg", count: 15 },
			{ name: "milk", count: 10 },
			{ name: "apple", count: 10 },
		],
		recipeBonus: 0.35,
	},
	{
		name: "teaTimeCornScone",
		category: "dessert",
		ingredients: [
			{ name: "ginger", count: 20 },
			{ name: "apple", count: 20 },
			{ name: "corn", count: 18 },
			{ name: "milk", count: 9 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "flowerGiftMacaron",
		category: "dessert",
		ingredients: [
			{ name: "cacao", count: 25 },
			{ name: "egg", count: 25 },
			{ name: "honey", count: 17 },
			{ name: "milk", count: 10 },
		],
		recipeBonus: 0.48,
	},
	{
		name: "sparkSpiceSpicyCola",
		category: "dessert",
		ingredients: [
			{ name: "leek", count: 20 },
			{ name: "apple", count: 35 },
			{ name: "ginger", count: 20 },
			{ name: "coffee", count: 12 },
		],
		recipeBonus: 0.61,
	},
	{
		name: "dondoEclair",
		category: "dessert",
		ingredients: [
			{ name: "cacao", count: 30 },
			{ name: "milk", count: 26 },
			{ name: "coffee", count: 24 },
			{ name: "honey", count: 22 },
		],
		recipeBonus: 0.61,
	},
	{
		name: "thrillingScaryFacePancake",
		category: "dessert",
		ingredients: [
			{ name: "potato", count: 18 },
			{ name: "egg", count: 24 },
			{ name: "honey", count: 32 },
			{ name: "tomato", count: 29 },
		],
		recipeBonus: 0.78,
	},
	{
		name: "honeyGatherChocoWaffle",
		category: "dessert",
		ingredients: [
			{ name: "honey", count: 38 },
			{ name: "corn", count: 28 },
			{ name: "cacao", count: 21 },
			{ name: "oil", count: 28 },
		],
		recipeBonus: 0.78,
	},
	{
		name: "explosionPopcorn",
		category: "dessert",
		ingredients: [
			{ name: "corn", count: 15 },
			{ name: "milk", count: 7 },
			{ name: "oil", count: 14 },
		],
		recipeBonus: 0.35,
	},
] satisfies readonly RecipeDefinition[];

/**
 * カテゴリでレシピを絞り込む
 * @param category 料理カテゴリ
 * @returns 指定カテゴリに属するレシピの配列
 */
export function getRecipesByCategory(
	category: CookingCategory,
): readonly RecipeDefinition[] {
	return RECIPES.filter((r) => r.category === category);
}

/**
 * 全レシピ名の一覧を返す
 * @returns レシピ名の配列
 */
export function getAllRecipeNames(): readonly string[] {
	return RECIPES.map((r) => r.name);
}

/**
 * レシピ名からレシピ定義を検索する
 * @param name レシピ名(内部キー)
 * @returns 該当するレシピ定義。見つからなければ undefined
 */
export function getRecipeByName(name: string): RecipeDefinition | undefined {
	return RECIPES.find((r) => r.name === name);
}
