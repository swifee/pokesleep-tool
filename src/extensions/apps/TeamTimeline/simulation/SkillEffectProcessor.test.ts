import { describe, expect, it, vi } from "vitest";
import pokemons, { type PokemonType } from "../../../../data/pokemons";
import {
	getDracoMeteorBerryCount,
	getLunarBlessingBerryCount,
	getSkillRandomRange,
	getSkillSubValue,
	getSkillValue,
	hyperCutterSuccess,
	type MainSkillName,
	superLuckIngRate,
	superLuckShard5Rate,
	superLuckShardRate,
} from "../../../../util/MainSkill";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	type BerryZoneProvisionalSettings,
	createDefaultBerryZoneSettings,
} from "../types/ProvisionalSettingsTypes";
import SeededRandom from "./SeededRandom";
import {
	classifySkill,
	isNonEPSkill,
	type PokemonSkillBonusContext,
	processSkillTriggers,
	resolveSkillLevelForSkill,
	type TeamSkillBonusContext,
} from "./SkillEffectProcessor";

function createPokemonBySkill(
	skillName: string,
	skillLevel: number,
): PokemonBoxItem {
	const pokemon = pokemons.find((p) => p.skill === skillName);
	if (!pokemon) {
		throw new Error(`${skillName} pokemon not found`);
	}

	const iv = new PokemonIv({
		pokemonName: pokemon.name,
		skillLevel,
	});
	return new PokemonBoxItem(iv);
}

function createIngredientMagnetPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Ingredient Magnet S", skillLevel);
}

function createIngredientMagnetPlusPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Ingredient Magnet S (Plus)", skillLevel);
}

function createIngredientMagnetPresentPokemon(
	skillLevel: number,
): PokemonBoxItem {
	return createPokemonBySkill("Ingredient Magnet S (Present)", skillLevel);
}

function createIngredientDrawPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Ingredient Draw S", skillLevel);
}

function createIngredientDrawSuperLuckPokemon(
	skillLevel: number,
): PokemonBoxItem {
	return createPokemonBySkill("Ingredient Draw S (Super Luck)", skillLevel);
}

function createIngredientDrawHyperCutterPokemon(
	skillLevel: number,
): PokemonBoxItem {
	return createPokemonBySkill("Ingredient Draw S (Hyper Cutter)", skillLevel);
}

function createMinusPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Cooking Power-Up S (Minus)", skillLevel);
}

function createStockpilePokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Charge Strength S (Stockpile)", skillLevel);
}

function createBadDreamsPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Charge Strength M (Bad Dreams)", skillLevel);
}

function createEnergizingCheerPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Energizing Cheer S", skillLevel);
}

function createNuzzlePokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Energizing Cheer S (Nuzzle)", skillLevel);
}

function createHealPulsePokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Energizing Cheer S (Heal Pulse)", skillLevel);
}

function createEnergyForEveryonePokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Energy for Everyone S", skillLevel);
}

function createLunarBlessingPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill(
		"Energy for Everyone S (Lunar Blessing)",
		skillLevel,
	);
}

function createBerryJuicePokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill(
		"Energy for Everyone S (Berry Juice)",
		skillLevel,
	);
}

function createExtraHelpfulPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Extra Helpful S", skillLevel);
}

function createHelperBoostPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Helper Boost", skillLevel);
}

function createCookingPowerUpPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Cooking Power-Up S", skillLevel);
}

function createTastyChancePokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Tasty Chance S", skillLevel);
}

function createBulkUpPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Cooking Assist S (Bulk Up)", skillLevel);
}

function createBerryBurstPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Berry Burst", skillLevel);
}

function createBerryBurstDisguisePokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Berry Burst (Disguise)", skillLevel);
}

function createDracoMeteorPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Berry Burst (Draco Meteor)", skillLevel);
}

function createDreamShardMagnetPokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Dream Shard Magnet S", skillLevel);
}

function createDreamShardMagnetRandomPokemon(
	skillLevel: number,
): PokemonBoxItem {
	return createPokemonBySkill("Dream Shard Magnet S (Random)", skillLevel);
}

function createMetronomePokemon(skillLevel: number): PokemonBoxItem {
	return createPokemonBySkill("Metronome", skillLevel);
}

function createSkillCopyPokemon(skillLevel: number): PokemonBoxItem {
	const pokemon = pokemons.find(
		(p) =>
			p.skill === "Skill Copy" ||
			p.skill === "Skill Copy (Transform)" ||
			p.skill === "Skill Copy (Mimic)",
	);
	if (!pokemon) {
		throw new Error("Skill Copy family pokemon not found");
	}
	const iv = new PokemonIv({
		pokemonName: pokemon.name,
		skillLevel,
	});
	return new PokemonBoxItem(iv);
}

function createMewPokemon(
	skillLevel: number,
	versatileSkill: MainSkillName,
): PokemonBoxItem {
	return new PokemonBoxItem(
		new PokemonIv({
			pokemonName: "Mew",
			skillLevel,
			versatileSkill,
		}),
	);
}

function ingredientCount(
	ingredients: { name: string; count: number }[],
	name: string,
): number {
	return ingredients.find((i) => i.name === name)?.count ?? 0;
}

function totalIngredientCount(
	ingredients: { name: string; count: number }[],
): number {
	return ingredients.reduce((sum, ingredient) => sum + ingredient.count, 0);
}

function normalizeIngredients(
	ingredients: { name: string; count: number }[],
): { name: string; count: number }[] {
	return [...ingredients].sort((a, b) => a.name.localeCompare(b.name));
}

function getIngredientDrawPool(pokemon: PokemonBoxItem): string[] {
	return [
		pokemon.iv.pokemon.ing1.name,
		pokemon.iv.pokemon.ing2.name,
		pokemon.iv.pokemon.ing3?.name ?? pokemon.iv.pokemon.ing1.name,
	].filter((name) => !name.startsWith("unknown"));
}

function simulateSuperLuckExpected(
	pokemon: PokemonBoxItem,
	triggerCount: number,
	seed: number,
): { ingredients: { name: string; count: number }[]; dreamShardCount: number } {
	const random = new SeededRandom(seed);
	const ingredientPool = getIngredientDrawPool(pokemon);
	const ingredientCountPerTrigger = getSkillValue(
		"Ingredient Draw S (Super Luck)",
		pokemon.iv.skillLevel,
	);
	const dreamShardPerOne = getSkillSubValue(
		"Ingredient Draw S (Super Luck)",
		pokemon.iv.skillLevel,
	);
	const ingredientMap = new Map<string, number>();
	let dreamShardCount = 0;

	for (let i = 0; i < triggerCount; i++) {
		const roll = random.next();
		if (roll < superLuckIngRate) {
			const ingredientIndex = random.nextInt(0, ingredientPool.length - 1);
			const ingredient = ingredientPool[ingredientIndex] ?? ingredientPool[0];
			if (ingredient) {
				ingredientMap.set(
					ingredient,
					(ingredientMap.get(ingredient) ?? 0) + ingredientCountPerTrigger,
				);
			}
			continue;
		}
		if (roll < superLuckIngRate + superLuckShardRate) {
			dreamShardCount += dreamShardPerOne;
			continue;
		}
		if (roll < superLuckIngRate + superLuckShardRate + superLuckShard5Rate) {
			dreamShardCount += dreamShardPerOne * 5;
		}
	}

	return {
		ingredients: Array.from(ingredientMap.entries()).map(([name, count]) => ({
			name,
			count,
		})),
		dreamShardCount,
	};
}

function simulateHyperCutterExpected(
	pokemon: PokemonBoxItem,
	triggerCount: number,
	seed: number,
): {
	ingredients: { name: string; count: number }[];
	greatSuccessCount: number;
} {
	const random = new SeededRandom(seed);
	const ingredientPool = getIngredientDrawPool(pokemon);
	const ingredientCountPerTrigger = getSkillValue(
		"Ingredient Draw S (Hyper Cutter)",
		pokemon.iv.skillLevel,
	);
	const ingredientMap = new Map<string, number>();
	let greatSuccessCount = 0;

	for (let i = 0; i < triggerCount; i++) {
		let multiplier = 1;
		if (random.chance(hyperCutterSuccess)) {
			multiplier = 2;
			greatSuccessCount += 1;
		}
		const ingredientIndex = random.nextInt(0, ingredientPool.length - 1);
		const ingredient = ingredientPool[ingredientIndex] ?? ingredientPool[0];
		if (!ingredient) {
			continue;
		}
		ingredientMap.set(
			ingredient,
			(ingredientMap.get(ingredient) ?? 0) +
				ingredientCountPerTrigger * multiplier,
		);
	}

	return {
		ingredients: Array.from(ingredientMap.entries()).map(([name, count]) => ({
			name,
			count,
		})),
		greatSuccessCount,
	};
}

function simulateStockpileExpected(
	skillLevel: number,
	triggerCount: number,
	seed: number,
	initialStockpileCount: number,
): {
	directEP: number;
	stockpileAfter: number;
	storeCount: number;
	spitCount: number;
} {
	const STOCKPILE_RATE = 0.735;
	const STOCKPILE_MAX = 10;
	const table: readonly (readonly number[])[] = [
		[600, 1020, 1500, 2040, 2640, 3300, 4020, 4920, 6480, 8880, 12120],
		[853, 1450, 2132, 2900, 3753, 4691, 5715, 6995, 9213, 12625, 17231],
		[1177, 2001, 2943, 4002, 5179, 6464, 7886, 9652, 12712, 17420, 23776],
		[1625, 2763, 4063, 5526, 7151, 8939, 10889, 13327, 17552, 24052, 32827],
		[2243, 3813, 5607, 7626, 9869, 12336, 15028, 18393, 24225, 33197, 45309],
		[3099, 5268, 7747, 10536, 13635, 17040, 20763, 25412, 33469, 45865, 62600],
		[4502, 7653, 11255, 15307, 19809, 24761, 30163, 36916, 48621, 66629, 90940],
	];

	const random = new SeededRandom(seed);
	let stockpile = Math.min(Math.max(initialStockpileCount, 0), STOCKPILE_MAX);
	let directEP = 0;
	let storeCount = 0;
	let spitCount = 0;

	const levelIndex = Math.min(Math.max(skillLevel, 1), table.length) - 1;
	const epRow = table[levelIndex];

	for (let i = 0; i < triggerCount; i++) {
		if (random.chance(STOCKPILE_RATE)) {
			stockpile = Math.min(STOCKPILE_MAX, stockpile + 1);
			storeCount++;
			continue;
		}
		directEP += epRow[stockpile] ?? epRow[0] ?? 0;
		stockpile = 0;
		spitCount++;
	}

	return { directEP, stockpileAfter: stockpile, storeCount, spitCount };
}

function createPokemonByType(type: string, skillLevel: number): PokemonBoxItem {
	const pokemon = pokemons.find((p) => p.type === type);
	if (!pokemon) {
		throw new Error(`${type} type pokemon not found`);
	}
	const iv = new PokemonIv({
		pokemonName: pokemon.name,
		skillLevel,
	});
	return new PokemonBoxItem(iv);
}

function calculateBerryStrength(type: PokemonType, level: number): number {
	const baseStrength: Record<PokemonType, number> = {
		normal: 28,
		fire: 27,
		water: 31,
		electric: 25,
		grass: 30,
		ice: 32,
		fighting: 27,
		poison: 32,
		ground: 29,
		flying: 24,
		psychic: 26,
		bug: 24,
		rock: 30,
		ghost: 26,
		dragon: 35,
		dark: 31,
		steel: 33,
		fairy: 26,
	};
	return Math.max(
		baseStrength[type] + level - 1,
		Math.round(1.025 ** (level - 1) * baseStrength[type]),
	);
}

function createPokemonBonusContext(
	overrides: Partial<PokemonSkillBonusContext> = {},
): PokemonSkillBonusContext {
	return {
		skillTriggerBonus: 1,
		skillLevelBonus: 0,
		ingredientMagnetMultiplier: 1,
		ingredientDrawMultiplier: 1,
		skillIngredientMultiplier: 1,
		dreamShardMultiplier: 1,
		mainSkillDreamShardMultiplier: 1,
		berryBurstMultiplier: 1,
		berryStrengthBonus: 1,
		...overrides,
	};
}

function createTeamBonusContext(
	pokemon: PokemonBoxItem,
	overrides: Partial<PokemonSkillBonusContext>,
): TeamSkillBonusContext {
	return {
		fieldBonus: 0,
		byPokemonId: new Map<number, PokemonSkillBonusContext>([
			[pokemon.id, createPokemonBonusContext(overrides)],
		]),
	};
}

describe("SkillEffectProcessor", () => {
	it("Ingredient Magnet SをingredientMagnetカテゴリに分類する", () => {
		expect(classifySkill("Ingredient Magnet S")).toBe("ingredientMagnet");
	});

	it("Ingredient Magnet S (Plus)をingredientMagnetカテゴリに分類する", () => {
		expect(classifySkill("Ingredient Magnet S (Plus)")).toBe(
			"ingredientMagnet",
		);
	});

	it("Ingredient Magnet S (Present)をingredientMagnetカテゴリに分類する", () => {
		expect(classifySkill("Ingredient Magnet S (Present)")).toBe(
			"ingredientMagnet",
		);
	});

	it("Ingredient Draw SをingredientDrawカテゴリに分類する", () => {
		expect(classifySkill("Ingredient Draw S")).toBe("ingredientDraw");
	});

	it("Ingredient Draw S (Super Luck)をingredientDrawカテゴリに分類する", () => {
		expect(classifySkill("Ingredient Draw S (Super Luck)")).toBe(
			"ingredientDraw",
		);
	});

	it("Ingredient Draw S (Hyper Cutter)をingredientDrawカテゴリに分類する", () => {
		expect(classifySkill("Ingredient Draw S (Hyper Cutter)")).toBe(
			"ingredientDraw",
		);
	});

	it("Charge Strength S (Stockpile)をdirectEPカテゴリに分類する", () => {
		expect(classifySkill("Charge Strength S (Stockpile)")).toBe("directEP");
	});

	it("Charge Strength M (Bad Dreams)をdirectEPカテゴリに分類する", () => {
		expect(classifySkill("Charge Strength M (Bad Dreams)")).toBe("directEP");
	});

	it("Energizing Cheer SをtargetEnergyカテゴリに分類する", () => {
		expect(classifySkill("Energizing Cheer S")).toBe("targetEnergy");
	});

	it("Energizing Cheer S (Nuzzle)をtargetEnergyカテゴリに分類する", () => {
		expect(classifySkill("Energizing Cheer S (Nuzzle)")).toBe("targetEnergy");
	});

	it("Energizing Cheer S (Heal Pulse)をtargetEnergyカテゴリに分類する", () => {
		expect(classifySkill("Energizing Cheer S (Heal Pulse)")).toBe(
			"targetEnergy",
		);
	});

	it("Energy for Everyone SをteamEnergyカテゴリに分類する", () => {
		expect(classifySkill("Energy for Everyone S")).toBe("teamEnergy");
	});

	it("Energy for Everyone S (Lunar Blessing)をteamEnergyカテゴリに分類する", () => {
		expect(classifySkill("Energy for Everyone S (Lunar Blessing)")).toBe(
			"teamEnergy",
		);
	});

	it("Energy for Everyone S (Berry Juice)をteamEnergyカテゴリに分類する", () => {
		expect(classifySkill("Energy for Everyone S (Berry Juice)")).toBe(
			"teamEnergy",
		);
	});

	it("Extra Helpful SをhelpSupportカテゴリに分類する", () => {
		expect(classifySkill("Extra Helpful S")).toBe("helpSupport");
	});

	it("Helper BoostをhelpSupportカテゴリに分類する", () => {
		expect(classifySkill("Helper Boost")).toBe("helpSupport");
	});

	it("Cooking Power-Up SをcookingSupportカテゴリに分類する", () => {
		expect(classifySkill("Cooking Power-Up S")).toBe("cookingSupport");
	});

	it("Cooking Power-Up S (Minus)をcookingSupportカテゴリに分類する", () => {
		expect(classifySkill("Cooking Power-Up S (Minus)")).toBe("cookingSupport");
	});

	it("Tasty Chance SをcookingSupportカテゴリに分類する", () => {
		expect(classifySkill("Tasty Chance S")).toBe("cookingSupport");
	});

	it("Cooking Assist S (Bulk Up)をcookingSupportカテゴリに分類する", () => {
		expect(classifySkill("Cooking Assist S (Bulk Up)")).toBe("cookingSupport");
	});

	it("Dream Shard Magnet SをdreamShardカテゴリに分類する", () => {
		expect(classifySkill("Dream Shard Magnet S")).toBe("dreamShard");
	});

	it("Dream Shard Magnet S (Random)をdreamShardカテゴリに分類する", () => {
		expect(classifySkill("Dream Shard Magnet S (Random)")).toBe("dreamShard");
	});

	it("Berry BurstをdirectEPカテゴリに分類する", () => {
		expect(classifySkill("Berry Burst")).toBe("directEP");
	});

	it("Berry Burst (Disguise)をdirectEPカテゴリに分類する", () => {
		expect(classifySkill("Berry Burst (Disguise)")).toBe("directEP");
	});

	it("Berry Burst (Draco Meteor)をdirectEPカテゴリに分類する", () => {
		expect(classifySkill("Berry Burst (Draco Meteor)")).toBe("directEP");
	});

	it("MetronomeをproxySkillカテゴリに分類する", () => {
		expect(classifySkill("Metronome")).toBe("proxySkill");
	});

	it("Skill CopyをproxySkillカテゴリに分類する", () => {
		expect(classifySkill("Skill Copy")).toBe("proxySkill");
	});

	it("resolveSkillLevelForSkill: 対象スキルの有効範囲へclampする", () => {
		expect(resolveSkillLevelForSkill("Energy for Everyone S", 7)).toBe(6);
		expect(resolveSkillLevelForSkill("Charge Strength S", 0)).toBe(1);
	});

	it("skillLevelボーナスを有効スキルレベルとして反映する", () => {
		const caster = createEnergyForEveryonePokemon(1);
		const bonusContext = createTeamBonusContext(caster, {
			skillLevelBonus: 2,
		});

		const result = processSkillTriggers(
			caster,
			1,
			50,
			new SeededRandom(45450),
			[],
			0,
			[caster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			bonusContext,
		);

		expect(result.teamEnergyRecoveryPerMember).toBe(
			getSkillValue("Energy for Everyone S", 3),
		);
	});

	it("Mew: versatileSkill が Charge Strength M なら directEP として処理する", () => {
		const mew = createMewPokemon(6, "Charge Strength M");

		const result = processSkillTriggers(
			mew,
			2,
			50,
			new SeededRandom(45449),
			[],
		);

		expect(result.directEP).toBe(getSkillValue("Charge Strength M", 6) * 2);
		expect(result.teamEnergyRecoveryPerMember).toBe(0);
	});

	it("Mew: versatileSkill が Energy for Everyone S なら teamEnergy として処理する", () => {
		const mew = createMewPokemon(6, "Energy for Everyone S");

		const result = processSkillTriggers(
			mew,
			3,
			50,
			new SeededRandom(45450),
			[],
		);

		expect(result.teamEnergyRecoveryPerMember).toBe(
			getSkillValue("Energy for Everyone S", 6) * 3,
		);
		expect(result.directEP).toBe(0);
	});

	it("Ingredient Magnet/Drawは最大倍率を適用する", () => {
		const magnetCaster = createIngredientMagnetPokemon(2);
		const drawCaster = createIngredientDrawPokemon(3);
		const magnetBonusContext = createTeamBonusContext(magnetCaster, {
			ingredientMagnetMultiplier: 1.5,
			skillIngredientMultiplier: 1.25,
		});
		const drawBonusContext = createTeamBonusContext(drawCaster, {
			ingredientDrawMultiplier: 1.5,
			skillIngredientMultiplier: 1.25,
		});

		const magnetResult = processSkillTriggers(
			magnetCaster,
			1,
			50,
			new SeededRandom(45456),
			[],
			0,
			[magnetCaster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			magnetBonusContext,
		);
		const drawResult = processSkillTriggers(
			drawCaster,
			1,
			50,
			new SeededRandom(45457),
			[],
			0,
			[drawCaster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			drawBonusContext,
		);

		const magnetTotal = totalIngredientCount(magnetResult.skillIngredients);
		const drawTotal = totalIngredientCount(drawResult.skillIngredients);
		expect(magnetTotal).toBe(
			Math.floor(getSkillValue("Ingredient Magnet S", 2) * 1.5),
		);
		expect(drawTotal).toBe(
			Math.floor(getSkillValue("Ingredient Draw S", 3) * 1.5),
		);
	});

	it("Dream Shard倍率を反映する", () => {
		const caster = createDreamShardMagnetPokemon(4);
		const bonusContext = createTeamBonusContext(caster, {
			dreamShardMultiplier: 2,
		});

		const result = processSkillTriggers(
			caster,
			3,
			50,
			new SeededRandom(45458),
			[],
			0,
			[caster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			bonusContext,
		);

		expect(result.dreamShardCount).toBe(
			getSkillValue("Dream Shard Magnet S", 4) * 3 * 2,
		);
	});

	it("Berry Burst倍率を反映する", () => {
		const caster = createBerryBurstPokemon(3);
		const bonusContext = createTeamBonusContext(caster, {
			berryBurstMultiplier: 1.4,
			berryStrengthBonus: 1,
		});
		const boostedBerryCount = Math.ceil(getSkillValue("Berry Burst", 3) * 1.4);
		const expectedBerryEP =
			calculateBerryStrength(caster.iv.pokemon.type, caster.iv.level) *
			boostedBerryCount;

		const result = processSkillTriggers(
			caster,
			1,
			50,
			new SeededRandom(45459),
			[],
			0,
			[caster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			bonusContext,
		);

		expect(result.directEP).toBe(expectedBerryEP);
	});

	it("Cooking Power-Up S: 鍋容量増加量がスキル値×発動回数と一致する", () => {
		const caster = createCookingPowerUpPokemon(5);
		const triggerCount = 4;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45451),
			[],
		);

		expect(result.cookingPotCapacityIncrease).toBe(
			getSkillValue("Cooking Power-Up S", 5) * triggerCount,
		);
		expect(result.tastyChanceIncreasePercent).toBe(0);
		expect(result.cookingMinusEvents).toHaveLength(0);
	});

	it("Cooking Power-Up S (Minus): 条件不成立なら追加回復しない", () => {
		const caster = createMinusPokemon(4);
		const teammate = createPokemonByType("water", 4);
		const teamMembers = [caster, teammate];

		const result = processSkillTriggers(
			caster,
			5,
			50,
			new SeededRandom(45452),
			[teammate],
			0,
			teamMembers,
		);

		expect(result.cookingPotCapacityIncrease).toBe(
			getSkillValue("Cooking Power-Up S (Minus)", 4) * 5,
		);
		expect(result.cookingMinusEvents).toHaveLength(0);
		expect(
			Array.from(result.cookingMinusTargets.values()).reduce(
				(sum, v) => sum + v,
				0,
			),
		).toBe(0);
	});

	it("Cooking Power-Up S (Minus): 条件成立なら対象回復イベントを記録する", () => {
		const caster = createMinusPokemon(6);
		const triggerCount = 4;
		const teammateMinus = createMinusPokemon(3);
		const teamMembers = [caster, teammateMinus];
		const expectedRecovery = getSkillSubValue("Cooking Power-Up S (Minus)", 6);

		const result1 = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45453),
			[teammateMinus],
			0,
			teamMembers,
		);
		const result2 = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45453),
			[teammateMinus],
			0,
			teamMembers,
		);

		expect(result1.cookingMinusEvents).toHaveLength(triggerCount);
		expect(result1.cookingMinusEvents).toEqual(result2.cookingMinusEvents);
		expect(
			result1.cookingMinusEvents.every(
				(event) => event.recovery === expectedRecovery,
			),
		).toBe(true);
		expect(
			result1.cookingMinusEvents.every((event) =>
				teamMembers.some((member) => member.id === event.targetPokemonId),
			),
		).toBe(true);
		expect(
			Array.from(result1.cookingMinusTargets.values()).reduce(
				(sum, v) => sum + v,
				0,
			),
		).toBe(expectedRecovery * triggerCount);
	});

	it("Tasty Chance S: 上昇率がスキル値×発動回数と一致する", () => {
		const caster = createTastyChancePokemon(6);
		const triggerCount = 3;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45454),
			[],
		);

		expect(result.tastyChanceIncreasePercent).toBe(
			getSkillValue("Tasty Chance S", 6) * triggerCount,
		);
		expect(result.cookingPotCapacityIncrease).toBe(0);
		expect(result.cookingMinusEvents).toHaveLength(0);
	});

	it("Cooking Assist S (Bulk Up): 食材と料理チャンス増加を同時に記録する", () => {
		const caster = createBulkUpPokemon(6);
		const triggerCount = 2;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(454541),
			[],
		);

		expect(totalIngredientCount(result.skillIngredients)).toBe(
			getSkillValue("Cooking Assist S (Bulk Up)", 6) * triggerCount,
		);
		expect(result.tastyChanceIncreasePercent).toBe(
			getSkillSubValue("Cooking Assist S (Bulk Up)", 6) * triggerCount,
		);
	});

	it("Dream Shard Magnet S: ゆめのかけら獲得量がスキル値×発動回数と一致する", () => {
		const caster = createDreamShardMagnetPokemon(7);
		const triggerCount = 4;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45458),
			[],
		);

		expect(result.dreamShardCount).toBe(
			getSkillValue("Dream Shard Magnet S", 7) * triggerCount,
		);
		expect(result.directEP).toBe(0);
	});

	it("Dream Shard Magnet S: dreamShard と dreamShard2 の両方を反映する", () => {
		const caster = createDreamShardMagnetPokemon(4);
		const triggerCount = 3;
		const bonusContext = createTeamBonusContext(caster, {
			dreamShardMultiplier: 1.5,
			mainSkillDreamShardMultiplier: 1.5,
		});

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(454581),
			[],
			0,
			[caster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			bonusContext,
		);

		expect(result.dreamShardCount).toBe(
			getSkillValue("Dream Shard Magnet S", 4) * triggerCount * 2.25,
		);
	});

	it("Dream Shard Magnet S (Random): 同一seedで再現可能かつ範囲内", () => {
		const caster = createDreamShardMagnetRandomPokemon(6);
		const triggerCount = 5;
		const [minShard, maxShard] = getSkillRandomRange(
			"Dream Shard Magnet S (Random)",
			6,
		);

		const result1 = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45459),
			[],
		);
		const result2 = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45459),
			[],
		);

		expect(result1.dreamShardCount).toBe(result2.dreamShardCount);
		expect(result1.dreamShardCount).toBeGreaterThanOrEqual(
			minShard * triggerCount,
		);
		expect(result1.dreamShardCount).toBeLessThanOrEqual(
			maxShard * triggerCount,
		);
		expect(result1.directEP).toBe(0);
	});

	it("Dream Shard Magnet S (Random): dreamShard と dreamShard2 の両方を反映する", () => {
		const caster = createDreamShardMagnetRandomPokemon(6);
		const triggerCount = 1;
		const bonusContext = createTeamBonusContext(caster, {
			dreamShardMultiplier: 1.5,
			mainSkillDreamShardMultiplier: 1.5,
		});
		const baseResult = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(454592),
			[],
		);
		const boostedResult = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(454592),
			[],
			0,
			[caster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			bonusContext,
		);

		expect(boostedResult.dreamShardCount).toBe(
			Math.round(baseResult.dreamShardCount * 2.25),
		);
	});

	it("Metronome: 発動者Lv7でmaxLv6スキルを引いた場合はLv6で処理する", () => {
		const caster = createMetronomePokemon(7);
		const random = new SeededRandom(91001);
		const nextIntSpy = vi.spyOn(random, "nextInt");
		nextIntSpy.mockImplementation(() => 11); // Energy for Everyone S

		const result = processSkillTriggers(caster, 1, 50, random, []);

		expect(result.teamEnergyRecoveryPerMember).toBe(
			getSkillValue("Energy for Everyone S", 6),
		);
		expect(result.proxySkillEvents).toHaveLength(1);
		expect(result.proxySkillEvents[0]?.resolvedSkillName).toBe(
			"Energy for Everyone S",
		);
		expect(result.proxySkillEvents[0]?.resolvedSkillLevel).toBe(6);
	});

	it("Metronome: Charge Strength S (Stockpile)は強制ではきだすとして処理する", () => {
		const caster = createMetronomePokemon(7);
		const random = new SeededRandom(91004);
		const nextIntSpy = vi.spyOn(random, "nextInt");
		nextIntSpy.mockImplementation(() => 7); // Charge Strength S (Stockpile)

		const result = processSkillTriggers(caster, 1, 50, random, [], 0, [caster]);

		expect(result.proxySkillEvents).toHaveLength(1);
		expect(result.proxySkillEvents[0]?.resolvedSkillName).toBe(
			"Charge Strength S (Stockpile)",
		);
		expect(result.proxySkillEvents[0]?.stockpileStoreCount).toBe(0);
		expect(result.proxySkillEvents[0]?.stockpileSpitCount).toBe(1);
		expect(result.proxySkillEvents[0]?.stockpileCountAtSpit).toBe(0);
		expect(result.directEP).toBe(4502);
	});

	it("Skill Copy: コピー先maxLv6スキルは発動者Lv7でもLv6で処理する", () => {
		const caster = createSkillCopyPokemon(7);
		const target = createEnergyForEveryonePokemon(3);
		const teamMembers = [caster, target];

		const result = processSkillTriggers(
			caster,
			1,
			50,
			new SeededRandom(91002),
			[target],
			0,
			teamMembers,
		);

		expect(result.teamEnergyRecoveryPerMember).toBe(
			getSkillValue("Energy for Everyone S", 6),
		);
		expect(result.proxySkillEvents).toHaveLength(1);
		expect(result.proxySkillEvents[0]?.source).toBe("skillCopy");
		expect(result.proxySkillEvents[0]?.resolvedSkillLevel).toBe(6);
		expect(result.proxySkillEvents[0]?.copiedFromPokemonId).toBe(target.id);
	});

	it("Skill Copy: Cooking Assist S (Bulk Up) をコピーすると両方の効果を記録する", () => {
		const caster = createSkillCopyPokemon(7);
		const target = createBulkUpPokemon(6);
		const teamMembers = [caster, target];

		const result = processSkillTriggers(
			caster,
			1,
			50,
			new SeededRandom(910021),
			[target],
			0,
			teamMembers,
		);

		expect(totalIngredientCount(result.skillIngredients)).toBe(
			getSkillValue("Cooking Assist S (Bulk Up)", 7),
		);
		expect(result.tastyChanceIncreasePercent).toBe(
			getSkillSubValue("Cooking Assist S (Bulk Up)", 7),
		);
		expect(result.proxySkillEvents[0]?.resolvedSkillName).toBe(
			"Cooking Assist S (Bulk Up)",
		);
	});

	it("Skill Copy: コピー先がSkill Copy系列ならCharge Strength Sへフォールバックする", () => {
		const caster = createSkillCopyPokemon(7);
		const target = createSkillCopyPokemon(3);
		const teamMembers = [caster, target];

		const result = processSkillTriggers(
			caster,
			1,
			50,
			new SeededRandom(91003),
			[target],
			0,
			teamMembers,
		);

		expect(result.directEP).toBe(getSkillValue("Charge Strength S", 7));
		expect(result.proxySkillEvents).toHaveLength(1);
		expect(result.proxySkillEvents[0]?.triggeredSkillName).toBe(
			"Skill Copy (Mimic)",
		);
		expect(result.proxySkillEvents[0]?.resolvedSkillName).toBe(
			"Charge Strength S",
		);
		expect(result.proxySkillEvents[0]?.resolvedSkillLevel).toBe(7);
	});

	it("Berry Burst: 発動者+他メンバー各体のきのみEPを合算する", () => {
		const caster = createBerryBurstPokemon(4);
		const teammate1 = createPokemonByType("fire", 4);
		const teammate2 = createPokemonByType("water", 4);
		const teamMembers = [caster, teammate1, teammate2];
		const triggerCount = 2;
		const selfBerryCount = getSkillValue("Berry Burst", 4);
		const otherBerryCount = getSkillSubValue("Berry Burst", 4);
		const expectedPerTrigger = teamMembers.reduce((sum, member) => {
			const berryCount =
				member.id === caster.id ? selfBerryCount : otherBerryCount;
			return (
				sum +
				calculateBerryStrength(member.iv.pokemon.type, member.iv.level) *
					berryCount
			);
		}, 0);

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45455),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(result.directEP).toBe(expectedPerTrigger * triggerCount);
		expect(result.berryBurstGreatSuccessCount).toBe(0);
	});

	it("Berry Burst (Disguise): ロックOFFでは最初の大成功のみ3倍で計上する", () => {
		const caster = createBerryBurstDisguisePokemon(3);
		const teammate = createPokemonByType("fire", 3);
		const teamMembers = [caster, teammate];
		const selfBerryCount = getSkillValue("Berry Burst (Disguise)", 3);
		const otherBerryCount = getSkillSubValue("Berry Burst (Disguise)", 3);
		const basePerTrigger = teamMembers.reduce((sum, member) => {
			const berryCount =
				member.id === caster.id ? selfBerryCount : otherBerryCount;
			return (
				sum +
				calculateBerryStrength(member.iv.pokemon.type, member.iv.level) *
					berryCount
			);
		}, 0);
		const random = new SeededRandom(45456);
		const chanceSpy = vi.spyOn(random, "chance");
		chanceSpy.mockReturnValue(true);

		const result = processSkillTriggers(
			caster,
			3,
			50,
			random,
			[teammate],
			0,
			teamMembers,
		);

		expect(result.berryBurstGreatSuccessCount).toBe(1);
		expect(result.directEP).toBe(basePerTrigger * 5);
		expect(result.berryBurstDisguiseLockedAfter).toBe(true);
	});

	it("Berry Burst (Disguise): ロックON入力時は大成功しない", () => {
		const caster = createBerryBurstDisguisePokemon(2);
		const teammate = createPokemonByType("water", 2);
		const teamMembers = [caster, teammate];
		const random = new SeededRandom(45457);
		const chanceSpy = vi.spyOn(random, "chance");
		chanceSpy.mockReturnValue(true);

		const result = processSkillTriggers(
			caster,
			2,
			50,
			random,
			[teammate],
			0,
			teamMembers,
			undefined,
			true,
		);

		expect(result.berryBurstGreatSuccessCount).toBe(0);
		expect(result.berryBurstDisguiseLockedAfter).toBe(true);
	});

	it("Berry Burst (Draco Meteor): ドラゴン種族数とラティアス補正でEPを計算する", () => {
		const caster = createDracoMeteorPokemon(4);
		const latias = createHealPulsePokemon(4);
		const teamMembers = [caster, latias];
		const triggerCount = 2;
		const { myBerryCount, othersBerryCount } = getDracoMeteorBerryCount(
			caster.iv.skillLevel,
			2,
			true,
		);
		const expectedPerTrigger = teamMembers.reduce((sum, member) => {
			const berryCount =
				member.id === caster.id ? myBerryCount : othersBerryCount;
			return (
				sum +
				calculateBerryStrength(member.iv.pokemon.type, member.iv.level) *
					berryCount
			);
		}, 0);

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(45458),
			[latias],
			0,
			teamMembers,
		);

		expect(result.directEP).toBe(expectedPerTrigger * triggerCount);
	});

	it("Ingredient Magnet S 1回発動で合計個数がスキル値と一致する", () => {
		const pokemon = createIngredientMagnetPokemon(4);
		const random = new SeededRandom(12345);

		const result = processSkillTriggers(pokemon, 1, 50, random, []);
		const expectedTotal = getSkillValue(
			"Ingredient Magnet S",
			pokemon.iv.skillLevel,
		);
		const actualTotal = totalIngredientCount(result.skillIngredients);

		expect(actualTotal).toBe(expectedTotal);
	});

	it("Ingredient Magnet S 1回発動で3種類の食材を獲得しunknownを含まない", () => {
		const pokemon = createIngredientMagnetPokemon(5);
		const random = new SeededRandom(98765);

		const result = processSkillTriggers(pokemon, 1, 50, random, []);

		expect(result.skillIngredients).toHaveLength(3);
		expect(
			result.skillIngredients.every((ingredient) => ingredient.count > 0),
		).toBe(true);
		expect(
			result.skillIngredients.some((ingredient) =>
				ingredient.name.startsWith("unknown"),
			),
		).toBe(false);
	});

	it("Ingredient Magnet S (Plus) は同居条件なしでは追加食材を付与しない", () => {
		const pokemon = createIngredientMagnetPlusPokemon(6);

		const withoutTeammate = processSkillTriggers(
			pokemon,
			1,
			50,
			new SeededRandom(11223),
			[],
		);

		const expectedTotal = getSkillValue(
			"Ingredient Magnet S (Plus)",
			pokemon.iv.skillLevel,
		);
		expect(totalIngredientCount(withoutTeammate.skillIngredients)).toBe(
			expectedTotal,
		);
	});

	it("Ingredient Magnet S (Plus) はPlus/Minus同居で第1食材を追加する", () => {
		const pokemon = createIngredientMagnetPlusPokemon(6);
		const teammate = createMinusPokemon(6);
		const firstIngredient = pokemon.iv.pokemon.ing1.name;
		const bonus = getSkillSubValue(
			"Ingredient Magnet S (Plus)",
			pokemon.iv.skillLevel,
			firstIngredient,
		);

		const withoutTeammate = processSkillTriggers(
			pokemon,
			1,
			50,
			new SeededRandom(33445),
			[],
		);
		const withTeammate = processSkillTriggers(
			pokemon,
			1,
			50,
			new SeededRandom(33445),
			[teammate],
		);

		const totalDelta =
			totalIngredientCount(withTeammate.skillIngredients) -
			totalIngredientCount(withoutTeammate.skillIngredients);
		const firstIngredientDelta =
			ingredientCount(withTeammate.skillIngredients, firstIngredient) -
			ingredientCount(withoutTeammate.skillIngredients, firstIngredient);

		expect(totalDelta).toBe(bonus);
		expect(firstIngredientDelta).toBe(bonus);
	});

	it("Ingredient Magnet S (Present) はアメを再現可能に計算する", () => {
		const pokemon = createIngredientMagnetPresentPokemon(6);

		const result1 = processSkillTriggers(
			pokemon,
			30,
			50,
			new SeededRandom(55667),
			[],
		);
		const result2 = processSkillTriggers(
			pokemon,
			30,
			50,
			new SeededRandom(55667),
			[],
		);

		expect(normalizeIngredients(result1.skillIngredients)).toEqual(
			normalizeIngredients(result2.skillIngredients),
		);
		expect(result1.presentCandyCount).toBe(result2.presentCandyCount);
		expect(result1.presentCandyCount).toBeGreaterThanOrEqual(0);
	});

	it("Ingredient Magnet S (Present) は十分な試行数でアメを獲得する", () => {
		const pokemon = createIngredientMagnetPresentPokemon(6);
		const result = processSkillTriggers(
			pokemon,
			100,
			50,
			new SeededRandom(77889),
			[],
		);

		expect(result.presentCandyCount).toBeGreaterThan(0);
		expect(result.presentCandyCount % 4).toBe(0);
	});

	it("同一seedならIngredient Magnet Sの結果が再現される", () => {
		const pokemon = createIngredientMagnetPokemon(6);

		const result1 = processSkillTriggers(
			pokemon,
			2,
			50,
			new SeededRandom(24680),
			[],
		);
		const result2 = processSkillTriggers(
			pokemon,
			2,
			50,
			new SeededRandom(24680),
			[],
		);

		expect(normalizeIngredients(result1.skillIngredients)).toEqual(
			normalizeIngredients(result2.skillIngredients),
		);
	});

	it("異なるseedではIngredient Magnet Sの配分が変わるケースがある", () => {
		const pokemon = createIngredientMagnetPokemon(6);

		const baseline = normalizeIngredients(
			processSkillTriggers(pokemon, 2, 50, new SeededRandom(11111), [])
				.skillIngredients,
		);

		let foundDifferent = false;
		for (let seed = 11112; seed <= 11140; seed++) {
			const current = normalizeIngredients(
				processSkillTriggers(pokemon, 2, 50, new SeededRandom(seed), [])
					.skillIngredients,
			);
			if (JSON.stringify(current) !== JSON.stringify(baseline)) {
				foundDifferent = true;
				break;
			}
		}

		expect(foundDifferent).toBe(true);
	});

	it("発動回数0のときスキル食材は空配列かつアメは0", () => {
		const pokemon = createIngredientMagnetPokemon(3);
		const random = new SeededRandom(54321);

		const result = processSkillTriggers(pokemon, 0, 50, random, []);

		expect(result.skillIngredients).toEqual([]);
		expect(result.presentCandyCount).toBe(0);
	});

	it("Ingredient Draw S: 1回発動で自身の食材プールから1種をスキル値分獲得する", () => {
		const pokemon = createIngredientDrawPokemon(6);
		const result = processSkillTriggers(
			pokemon,
			1,
			50,
			new SeededRandom(32101),
			[],
		);

		const expectedCount = getSkillValue(
			"Ingredient Draw S",
			pokemon.iv.skillLevel,
		);
		const ingredientPool = getIngredientDrawPool(pokemon);

		expect(totalIngredientCount(result.skillIngredients)).toBe(expectedCount);
		expect(result.skillIngredients).toHaveLength(1);
		expect(
			result.skillIngredients.every((ingredient) =>
				ingredientPool.includes(ingredient.name),
			),
		).toBe(true);
		expect(result.directEP).toBe(0);
	});

	it("Ingredient Draw S (Super Luck): 同一seedで食材/ゆめのかけら分岐が再現される", () => {
		const pokemon = createIngredientDrawSuperLuckPokemon(7);
		const triggerCount = 40;
		const seed = 32102;
		const expected = simulateSuperLuckExpected(pokemon, triggerCount, seed);

		const result = processSkillTriggers(
			pokemon,
			triggerCount,
			50,
			new SeededRandom(seed),
			[],
		);

		expect(normalizeIngredients(result.skillIngredients)).toEqual(
			normalizeIngredients(expected.ingredients),
		);
		expect(result.dreamShardCount).toBe(expected.dreamShardCount);
		expect(result.directEP).toBe(0);
		expect(result.ingredientDrawGreatSuccessCount).toBe(0);
	});

	it("Ingredient Draw S (Super Luck): ingredientDraw と dreamShard2 をゆめのかけら出力へ反映する", () => {
		const pokemon = createIngredientDrawSuperLuckPokemon(7);
		const triggerCount = 40;
		const seed = 32104;
		const baseResult = processSkillTriggers(
			pokemon,
			triggerCount,
			50,
			new SeededRandom(seed),
			[],
		);
		const bonusContext = createTeamBonusContext(pokemon, {
			ingredientDrawMultiplier: 1.5,
			mainSkillDreamShardMultiplier: 1.5,
		});

		const boostedResult = processSkillTriggers(
			pokemon,
			triggerCount,
			50,
			new SeededRandom(seed),
			[],
			0,
			[pokemon],
			undefined,
			false,
			undefined,
			undefined,
			false,
			bonusContext,
		);

		expect(boostedResult.dreamShardCount).toBe(
			baseResult.dreamShardCount * 2.25,
		);
	});

	it("Ingredient Draw S (Hyper Cutter): 同一seedで大成功回数と2倍獲得が再現される", () => {
		const pokemon = createIngredientDrawHyperCutterPokemon(7);
		const triggerCount = 60;
		const seed = 32103;
		const expected = simulateHyperCutterExpected(pokemon, triggerCount, seed);

		const result = processSkillTriggers(
			pokemon,
			triggerCount,
			50,
			new SeededRandom(seed),
			[],
		);

		expect(normalizeIngredients(result.skillIngredients)).toEqual(
			normalizeIngredients(expected.ingredients),
		);
		expect(result.ingredientDrawGreatSuccessCount).toBe(
			expected.greatSuccessCount,
		);
		expect(result.dreamShardCount).toBe(0);
		expect(result.directEP).toBe(0);
	});

	it("Stockpile: 同一seedでEP・蓄積更新が再現される", () => {
		const pokemon = createStockpilePokemon(5);
		const seed = 13579;
		const initialStockpile = 3;
		const triggerCount = 20;

		const expected = simulateStockpileExpected(
			pokemon.iv.skillLevel,
			triggerCount,
			seed,
			initialStockpile,
		);

		const result = processSkillTriggers(
			pokemon,
			triggerCount,
			50,
			new SeededRandom(seed),
			[],
			initialStockpile,
		);

		expect(result.directEP).toBe(expected.directEP);
		expect(result.stockpileCountAfter).toBe(expected.stockpileAfter);
		expect(result.stockpileStoreCount).toBe(expected.storeCount);
		expect(result.stockpileSpitCount).toBe(expected.spitCount);
	});

	it("Stockpile: 発動回数0なら蓄積数を保持する", () => {
		const pokemon = createStockpilePokemon(4);
		const result = processSkillTriggers(
			pokemon,
			0,
			50,
			new SeededRandom(24680),
			[],
			7,
		);

		expect(result.directEP).toBe(0);
		expect(result.stockpileCountAfter).toBe(7);
		expect(result.stockpileStoreCount).toBe(0);
		expect(result.stockpileSpitCount).toBe(0);
	});

	it("Bad Dreams: EPは固定値×発動回数で計算される", () => {
		const pokemon = createBadDreamsPokemon(3);
		const triggerCount = 4;
		const result = processSkillTriggers(
			pokemon,
			triggerCount,
			50,
			new SeededRandom(99991),
			[],
			0,
			[pokemon],
		);

		expect(result.directEP).toBe(
			getSkillValue("Charge Strength M (Bad Dreams)", 3) * triggerCount,
		);
	});

	it("Bad Dreams: 悪タイプ以外のみを対象としてヒット回数を計算する", () => {
		const caster = createBadDreamsPokemon(2);
		const darkTeammate = createPokemonByType("dark", 2);
		const normalTeammate = createPokemonByType("normal", 2);
		const fireTeammate = createPokemonByType("fire", 2);
		const teamMembers = [caster, darkTeammate, normalTeammate, fireTeammate];
		const triggerCount = 3;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(99992),
			[darkTeammate, normalTeammate, fireTeammate],
			0,
			teamMembers,
		);

		const nonDarkCount = teamMembers.filter(
			(member) => member.iv.pokemon.type !== "dark",
		).length;
		expect(result.badDreamsHitCount).toBe(nonDarkCount * triggerCount);
		expect(result.badDreamsDamagePerTarget).toBe(12 * triggerCount);
		expect(result.badDreamsTotalDamage).toBe(result.badDreamsHitCount * 12);
	});

	it("Energizing Cheer S: 回復総量がスキル値×発動回数と一致する", () => {
		const caster = createEnergizingCheerPokemon(5);
		const teammate1 = createPokemonByType("fire", 5);
		const teammate2 = createPokemonByType("water", 5);
		const teamMembers = [caster, teammate1, teammate2];
		const triggerCount = 7;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(88881),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		const expectedRecovery =
			getSkillValue("Energizing Cheer S", caster.iv.skillLevel) * triggerCount;
		const actualRecovery = Array.from(
			result.energizingCheerTargets.values(),
		).reduce((sum, v) => sum + v, 0);

		expect(actualRecovery).toBe(expectedRecovery);
		expect(result.teamEnergyRecoveryPerMember).toBe(0);
	});

	it("Energizing Cheer S: 同一seedで同一ターゲット配分になる", () => {
		const caster = createEnergizingCheerPokemon(4);
		const teammate1 = createPokemonByType("grass", 4);
		const teammate2 = createPokemonByType("electric", 4);
		const teamMembers = [caster, teammate1, teammate2];

		const result1 = processSkillTriggers(
			caster,
			9,
			50,
			new SeededRandom(88882),
			[teammate1, teammate2],
			0,
			teamMembers,
		);
		const result2 = processSkillTriggers(
			caster,
			9,
			50,
			new SeededRandom(88882),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(Array.from(result1.energizingCheerTargets.entries()).sort()).toEqual(
			Array.from(result2.energizingCheerTargets.entries()).sort(),
		);
	});

	it("Nuzzle: 回復イベントが対象付きで記録される", () => {
		const caster = createNuzzlePokemon(3);
		const teammate1 = createPokemonByType("grass", 3);
		const teammate2 = createPokemonByType("electric", 3);
		const teamMembers = [caster, teammate1, teammate2];

		const result = processSkillTriggers(
			caster,
			4,
			50,
			new SeededRandom(77771),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(result.energizingCheerEvents.length).toBeGreaterThanOrEqual(4);
		expect(result.energizingCheerEvents[0]?.source).toBe("nuzzle");
		expect(
			result.energizingCheerEvents.every((event) =>
				teamMembers.some((member) => member.id === event.targetPokemonId),
			),
		).toBe(true);
	});

	it("Nuzzle: 追加発動の連鎖は1スロット20回で打ち切られる", () => {
		const caster = createNuzzlePokemon(6);
		Object.defineProperty(caster.iv, "skillRate", {
			configurable: true,
			get: () => 1,
		});
		const teamMembers = [caster];

		const result = processSkillTriggers(
			caster,
			1,
			50,
			new SeededRandom(77772),
			[],
			0,
			teamMembers,
		);

		expect(result.nuzzleTriggeredSkillEvents.length).toBe(20);
	});

	it("Heal Pulse: 2体を回復し、対象ごとに追加おてつだいを適用する", () => {
		const caster = createHealPulsePokemon(6);
		const teammate1 = createPokemonByType("grass", 6);
		const teammate2 = createPokemonByType("water", 6);
		const teamMembers = [caster, teammate1, teammate2];

		const result = processSkillTriggers(
			caster,
			1,
			50,
			new SeededRandom(77773),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(result.energizingCheerEvents).toHaveLength(2);
		expect(
			result.energizingCheerEvents.every(
				(event) =>
					event.source === "healPulse" &&
					event.recovery ===
						getSkillValue("Energizing Cheer S (Heal Pulse)", 6),
			),
		).toBe(true);
		expect(result.supportHelpEvents).toHaveLength(2);
		expect(
			result.supportHelpEvents.every(
				(event) =>
					event.source === "healPulse" &&
					event.helpCount ===
						getSkillSubValue("Energizing Cheer S (Heal Pulse)", 6),
			),
		).toBe(true);
		expect(result.supportSkillBerryEP).toBe(result.directEP);
	});

	it("Heal Pulse: ラティオスがいる場合は追加おてつだい回数を増やす", () => {
		const caster = createHealPulsePokemon(6);
		const latios = createDracoMeteorPokemon(6);
		const teammate = createPokemonByType("water", 6);
		const teamMembers = [caster, latios, teammate];

		const result = processSkillTriggers(
			caster,
			1,
			50,
			new SeededRandom(77774),
			[latios, teammate],
			0,
			teamMembers,
		);

		expect(result.supportHelpEvents).toHaveLength(2);
		expect(
			result.supportHelpEvents.every(
				(event) =>
					event.helpCount ===
					getSkillSubValue("Energizing Cheer S (Heal Pulse)", 6) + 3,
			),
		).toBe(true);
	});

	it("Energy for Everyone S: 全員回復量がスキル値×発動回数と一致する", () => {
		const caster = createEnergyForEveryonePokemon(4);
		const teammate1 = createPokemonByType("fire", 4);
		const teammate2 = createPokemonByType("water", 4);
		const teamMembers = [caster, teammate1, teammate2];
		const triggerCount = 3;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(66661),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(result.teamEnergyRecoveryPerMember).toBe(
			getSkillValue("Energy for Everyone S", 4) * triggerCount,
		);
		expect(result.directEP).toBe(0);
	});

	it("Energy for Everyone S (Berry Juice): 同一seedで再現可能に確率判定される", () => {
		const caster = createBerryJuicePokemon(5);
		const teammate1 = createPokemonByType("fire", 5);
		const teammate2 = createPokemonByType("water", 5);
		const teamMembers = [caster, teammate1, teammate2];
		const triggerCount = 30;

		const result1 = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(66662),
			[teammate1, teammate2],
			0,
			teamMembers,
		);
		const result2 = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(66662),
			[teammate1, teammate2],
			0,
			teamMembers,
		);
		const result3 = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(66663),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(result1.teamEnergyRecoveryPerMember).toBe(
			getSkillValue("Energy for Everyone S (Berry Juice)", 5) * triggerCount,
		);
		expect(result1.berryJuiceCount).toBe(result2.berryJuiceCount);
		expect(result1.berryJuiceCount).toBeGreaterThanOrEqual(0);
		expect(result1.berryJuiceCount).toBeLessThanOrEqual(triggerCount);
		expect(result3.berryJuiceCount).toBeGreaterThanOrEqual(0);
		expect(result3.berryJuiceCount).toBeLessThanOrEqual(triggerCount);
	});

	it("Energy for Everyone S (Berry Juice): 発動0回ならジュース0個", () => {
		const caster = createBerryJuicePokemon(3);
		const result = processSkillTriggers(
			caster,
			0,
			50,
			new SeededRandom(66664),
			[],
			0,
			[caster],
		);

		expect(result.berryJuiceCount).toBe(0);
	});

	it("Energy for Everyone S (Berry Juice): 十分な試行でジュースを獲得できる", () => {
		const caster = createBerryJuicePokemon(6);
		const teammate1 = createPokemonByType("fire", 6);
		const teammate2 = createPokemonByType("water", 6);
		const teamMembers = [caster, teammate1, teammate2];
		const result = processSkillTriggers(
			caster,
			200,
			50,
			new SeededRandom(66665),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(result.berryJuiceCount).toBeGreaterThan(0);
	});

	it("Energy for Everyone S (Lunar Blessing): サイキック種族数に応じて追加EPを獲得する", () => {
		const caster = createLunarBlessingPokemon(3);
		const psychicTeammate = createPokemonByType("psychic", 3);
		const normalTeammate = createPokemonByType("normal", 3);
		const teamMembers = [caster, psychicTeammate, normalTeammate];
		const triggerCount = 2;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(66663),
			[psychicTeammate, normalTeammate],
			0,
			teamMembers,
		);

		const psychicSpeciesCount = new Set(
			teamMembers
				.filter((member) => member.iv.pokemon.type === "psychic")
				.map((member) => member.iv.pokemonName),
		).size;
		const { myBerryCount, othersBerryCount } = getLunarBlessingBerryCount(
			3,
			Math.min(Math.max(psychicSpeciesCount, 1), 5),
		);
		const expectedPerTrigger = teamMembers.reduce((sum, member) => {
			const berryCount =
				member.id === caster.id ? myBerryCount : othersBerryCount;
			return (
				sum +
				calculateBerryStrength(member.iv.pokemon.type, member.iv.level) *
					berryCount
			);
		}, 0);

		expect(result.teamEnergyRecoveryPerMember).toBe(
			getSkillValue("Energy for Everyone S (Lunar Blessing)", 3) * triggerCount,
		);
		expect(result.directEP).toBe(expectedPerTrigger * triggerCount);
	});

	it("Extra Helpful S: 発動ごとに対象1体へ追加おてつだいを適用する", () => {
		const caster = createExtraHelpfulPokemon(4);
		const teammate1 = createPokemonByType("grass", 4);
		const teammate2 = createPokemonByType("water", 4);
		const teamMembers = [caster, teammate1, teammate2];
		const triggerCount = 3;

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(55551),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(result.supportHelpEvents.length).toBe(triggerCount);
		expect(
			result.supportHelpEvents.every(
				(event) => event.source === "extraHelpful",
			),
		).toBe(true);
		expect(
			result.supportHelpEvents.every(
				(event) => event.helpCount === getSkillValue("Extra Helpful S", 4),
			),
		).toBe(true);
		expect(result.supportSkillBerryEP).toBe(result.directEP);
	});

	it("Extra Helpful S: 同一seedで同一イベント列になる", () => {
		const caster = createExtraHelpfulPokemon(5);
		const teammate1 = createPokemonByType("grass", 5);
		const teammate2 = createPokemonByType("water", 5);
		const teamMembers = [caster, teammate1, teammate2];

		const result1 = processSkillTriggers(
			caster,
			4,
			50,
			new SeededRandom(55552),
			[teammate1, teammate2],
			0,
			teamMembers,
		);
		const result2 = processSkillTriggers(
			caster,
			4,
			50,
			new SeededRandom(55552),
			[teammate1, teammate2],
			0,
			teamMembers,
		);

		expect(result1.supportHelpEvents).toEqual(result2.supportHelpEvents);
		expect(result1.skillIngredients).toEqual(result2.skillIngredients);
		expect(result1.supportSkillBerryEP).toBe(result2.supportSkillBerryEP);
	});

	it("Helper Boost: チーム全員へ同回数のおてつだいを適用する", () => {
		const caster = createHelperBoostPokemon(6);
		const teammate1 = createPokemonByType("grass", 6);
		const teammate2 = createPokemonByType("water", 6);
		const teammate3 = createPokemonByType("electric", 6);
		const teamMembers = [caster, teammate1, teammate2, teammate3];
		const triggerCount = 2;
		const sameTypeSpeciesCount = new Set(
			teamMembers
				.filter((member) => member.iv.pokemon.type === caster.iv.pokemon.type)
				.map((member) => member.iv.pokemonName),
		).size;
		const expectedHelpCount = getSkillValue(
			"Helper Boost",
			6,
			Math.min(Math.max(sameTypeSpeciesCount, 1), 5),
		);

		const result = processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(55553),
			[teammate1, teammate2, teammate3],
			0,
			teamMembers,
		);

		expect(result.supportHelpEvents.length).toBe(
			triggerCount * teamMembers.length,
		);
		expect(
			result.supportHelpEvents.every((event) => event.source === "helperBoost"),
		).toBe(true);
		expect(
			result.supportHelpEvents.every(
				(event) => event.helpCount === expectedHelpCount,
			),
		).toBe(true);
		expect(result.supportSkillBerryEP).toBe(result.directEP);
	});

	it("Extra Helpful S: 無効対象が選ばれた場合は成果0になる", () => {
		const caster = createExtraHelpfulPokemon(4);
		const disabledTarget = createPokemonByType("water", 4);
		const teamMembers = [caster, disabledTarget];
		const random = new SeededRandom(60001);
		const nextIntSpy = vi.spyOn(random, "nextInt");
		nextIntSpy.mockReturnValue(1);

		const result = processSkillTriggers(
			caster,
			1,
			50,
			random,
			[disabledTarget],
			0,
			teamMembers,
			undefined,
			false,
			undefined,
			undefined,
			false,
			undefined,
			{
				activeTeamMemberIds: new Set([caster.id]),
				targetableTeamMembers: teamMembers,
			},
		);

		expect(result.supportHelpEvents).toHaveLength(1);
		expect(result.supportHelpEvents[0]?.targetPokemonId).toBe(
			disabledTarget.id,
		);
		expect(result.supportHelpEvents[0]?.berryEP).toBe(0);
		expect(result.supportHelpEvents[0]?.berryCount).toBe(0);
		expect(result.skillIngredients).toHaveLength(0);
	});

	it("回復/減少量0化オプションでEnergy for Everyoneの回復だけを0化する", () => {
		const caster = createBerryJuicePokemon(5);
		const random = new SeededRandom(60002);
		const chanceSpy = vi.spyOn(random, "chance");
		chanceSpy.mockReturnValue(true);

		const result = processSkillTriggers(
			caster,
			3,
			50,
			random,
			[],
			0,
			[caster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			undefined,
			{
				suppressEnergyDelta: true,
			},
		);

		expect(result.teamEnergyRecoveryPerMember).toBe(0);
		expect(result.berryJuiceCount).toBeGreaterThan(0);
	});

	it("回復/減少量0化オプションでBad Dreams減少を0化する", () => {
		const caster = createBadDreamsPokemon(4);
		const teammate = createPokemonByType("water", 4);
		const teamMembers = [caster, teammate];

		const result = processSkillTriggers(
			caster,
			2,
			50,
			new SeededRandom(60003),
			[teammate],
			0,
			teamMembers,
			undefined,
			false,
			undefined,
			undefined,
			false,
			undefined,
			{
				suppressEnergyDelta: true,
				targetableTeamMembers: teamMembers,
			},
		);

		expect(result.badDreamsDamagePerTarget).toBe(0);
		expect(result.badDreamsHitCount).toBe(0);
		expect(result.badDreamsTotalDamage).toBe(0);
		expect(result.directEP).toBeGreaterThan(0);
	});

	it("Nuzzle: 無効対象に当たった場合は連鎖発動しない", () => {
		const caster = createNuzzlePokemon(6);
		const disabledTarget = createEnergyForEveryonePokemon(6);
		const teamMembers = [caster, disabledTarget];
		const random = new SeededRandom(60004);
		const nextIntSpy = vi.spyOn(random, "nextInt");
		nextIntSpy.mockReturnValue(1);

		const result = processSkillTriggers(
			caster,
			2,
			50,
			random,
			[disabledTarget],
			0,
			teamMembers,
			undefined,
			false,
			undefined,
			undefined,
			false,
			undefined,
			{
				activeTeamMemberIds: new Set([caster.id]),
				targetableTeamMembers: teamMembers,
			},
		);

		expect(result.energizingCheerEvents).toHaveLength(2);
		expect(result.nuzzleTriggeredSkillEvents).toHaveLength(0);
	});
});

describe("上流で追加されたメインスキルの分類", () => {
	it("Dream Shard Magnet S (Aura Sphere) をゆめのかけらスキルとして扱う", () => {
		expect(classifySkill("Dream Shard Magnet S (Aura Sphere)")).toBe(
			"dreamShard",
		);
		expect(isNonEPSkill("Dream Shard Magnet S (Aura Sphere)")).toBe(true);
	});

	it("Aura Sphere のスキル値は Dream Shard Magnet S と同じ", () => {
		for (let level = 1; level <= 7; level += 1) {
			expect(getSkillValue("Dream Shard Magnet S (Aura Sphere)", level)).toBe(
				getSkillValue("Dream Shard Magnet S", level),
			);
		}
	});

	it("Berry Zone はカビゴンのエナジーを増やす直接EPスキルとして扱う", () => {
		// 数値は上流未実装のため、仮設定から与える。
		expect(classifySkill("Berry Zone")).toBe("directEP");
		expect(classifySkill("Berry Zone (Psystrike)")).toBe("directEP");
		expect(isNonEPSkill("Berry Zone")).toBe(false);
	});
});

describe("Berry Zone (Psystrike)", () => {
	function createMewtwo(skillLevel: number): PokemonBoxItem {
		return new PokemonBoxItem(
			new PokemonIv({ pokemonName: "Mewtwo", level: 50, skillLevel }),
		);
	}

	function createBerryZoneBonusContext(
		members: PokemonBoxItem[],
		berryZone: Partial<BerryZoneProvisionalSettings>,
		berryZoneStackCount = 0,
	): TeamSkillBonusContext {
		return {
			fieldBonus: 0,
			byPokemonId: new Map<number, PokemonSkillBonusContext>(
				members.map((member) => [member.id, createPokemonBonusContext()]),
			),
			berryZone: {
				...createDefaultBerryZoneSettings(),
				enabled: true,
				snorlaxEnergyByLevel: [100, 200, 300, 400, 500, 600],
				...berryZone,
			},
			berryZoneStackCount,
		};
	}

	function triggerBerryZone(
		caster: PokemonBoxItem,
		triggerCount: number,
		bonusContext?: TeamSkillBonusContext,
	) {
		return processSkillTriggers(
			caster,
			triggerCount,
			50,
			new SeededRandom(4321),
			[],
			0,
			[caster],
			undefined,
			false,
			undefined,
			undefined,
			false,
			bonusContext,
		);
	}

	it("仮設定がない場合はエナジーもゾーン展開も発生しない", () => {
		const result = triggerBerryZone(createMewtwo(3), 2);

		expect(result.directEP).toBe(0);
		expect(result.berryZoneStackGain).toBe(0);
	});

	it("仮設定が無効な場合は効果なしとして扱う", () => {
		const caster = createMewtwo(3);
		const bonusContext = createBerryZoneBonusContext(caster ? [caster] : [], {
			enabled: false,
		});

		const result = triggerBerryZone(caster, 2, bonusContext);

		expect(result.directEP).toBe(0);
		expect(result.berryZoneStackGain).toBe(0);
	});

	it("発動回数分のカビゴンエナジーを獲得し、同じ回数だけ重ねがけする", () => {
		const caster = createMewtwo(3);
		const bonusContext = createBerryZoneBonusContext([caster], {});

		const result = triggerBerryZone(caster, 2, bonusContext);

		expect(result.directEP).toBe(300 * 2);
		expect(result.berryZoneStackGain).toBe(2);
	});

	it("ゾーン展開中はマゴのみ由来のスキルEPが上がる", () => {
		// マゴのみ（エスパー）のきのみEPを配るスキルで確認する。
		const caster = createPokemonBySkill(
			"Energy for Everyone S (Lunar Blessing)",
			3,
		);
		expect(caster.iv.pokemon.type).toBe("psychic");
		const withoutZone = createBerryZoneBonusContext([caster], {
			berryEnergyBonusPercent: 20,
		});
		const withZone = createBerryZoneBonusContext(
			[caster],
			{ berryEnergyBonusPercent: 20 },
			2,
		);

		const baseResult = triggerBerryZone(caster, 1, withoutZone);
		const zoneResult = triggerBerryZone(caster, 1, withZone);

		expect(baseResult.directEP).toBeGreaterThan(0);
		expect(zoneResult.directEP).toBeGreaterThan(baseResult.directEP);
	});

	it("マゴのみ以外のきのみ由来のスキルEPは変わらない", () => {
		const caster = createBerryBurstPokemon(3);
		expect(caster.iv.pokemon.type).not.toBe("psychic");
		const withoutZone = createBerryZoneBonusContext([caster], {});
		const withZone = createBerryZoneBonusContext([caster], {}, 3);

		expect(triggerBerryZone(caster, 1, withZone).directEP).toBe(
			triggerBerryZone(caster, 1, withoutZone).directEP,
		);
	});
});
