import { describe, expect, it } from "vitest";
import { cbexFieldIndex, ggexFieldIndex } from "../../../../data/fields";
import pokemons from "../../../../data/pokemons";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	calculateHelp,
	getPityProcThreshold,
	type HelpInput,
	isPityProcTriggered,
} from "./HelpCalculator";
import SeededRandom from "./SeededRandom";

function createTestPokemon(): PokemonBoxItem {
	const pikachu = pokemons.find((pokemon) => pokemon.name === "Pikachu");
	if (!pikachu) {
		throw new Error("Pikachu not found");
	}
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName: pikachu.name, level: 30, skillLevel: 1 }),
	);
}

function mockBerryOnlyHelps(pokemon: PokemonBoxItem, berryCount: number): void {
	Object.defineProperty(pokemon.iv, "ingredientRate", {
		configurable: true,
		get: () => 0,
	});
	Object.defineProperty(pokemon.iv, "skillRate", {
		configurable: true,
		get: () => 0,
	});
	Object.defineProperty(pokemon.iv, "berryCount", {
		configurable: true,
		get: () => berryCount,
	});
}

describe("HelpCalculator bonus behavior", () => {
	it("いいキャンプチケット有効時はおてつだい回数が増える", () => {
		const pokemon = createTestPokemon();

		const base = calculateHelp({
			pokemon,
			durationMinutes: 600,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(101),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: pokemon.iv.carryLimit,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});
		const withCamp = calculateHelp({
			pokemon,
			durationMinutes: 600,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(101),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: pokemon.iv.carryLimit,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: true,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(withCamp.helpCount).toBeGreaterThan(base.helpCount);
	});

	it("いいキャンプチケット有効時は最大所持数が1.2倍扱いになる", () => {
		const pokemon = createTestPokemon();
		Object.defineProperty(pokemon.iv, "ingredientRate", {
			configurable: true,
			get: () => 1,
		});
		Object.defineProperty(pokemon.iv, "skillRate", {
			configurable: true,
			get: () => 0,
		});

		const withoutCamp = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(202),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});
		const withCamp = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(202),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: true,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(withoutCamp.newInventory).toBe(10);
		expect(withoutCamp.ingredients).toEqual([]);
		expect(withCamp.newInventory).toBeGreaterThan(10);
		expect(withCamp.ingredients.length).toBeGreaterThan(0);
	});

	it("carryLimitBonusがあるとイベント対象の最大所持数が増える", () => {
		const pokemon = createTestPokemon();
		Object.defineProperty(pokemon.iv, "ingredientRate", {
			configurable: true,
			get: () => 1,
		});
		Object.defineProperty(pokemon.iv, "skillRate", {
			configurable: true,
			get: () => 0,
		});

		const withoutCarryLimitBonus = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(303),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				carryLimitBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});
		const withCarryLimitBonus = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(303),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				carryLimitBonus: 8,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(withoutCarryLimitBonus.newInventory).toBe(10);
		expect(withCarryLimitBonus.newInventory).toBeGreaterThan(10);
		expect(withCarryLimitBonus.ingredients.length).toBeGreaterThan(0);
	});

	it("carryLimitBonusといいキャンプチケットは重複して最大所持数に反映される", () => {
		const pokemon = createTestPokemon();
		Object.defineProperty(pokemon.iv, "ingredientRate", {
			configurable: true,
			get: () => 1,
		});
		Object.defineProperty(pokemon.iv, "skillRate", {
			configurable: true,
			get: () => 0,
		});

		const withoutCamp = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(404),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 18,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				carryLimitBonus: 8,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});
		const withCamp = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(404),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 18,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				carryLimitBonus: 8,
				isGoodCampTicketSet: true,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(withoutCamp.newInventory).toBe(18);
		expect(withCamp.newInventory).toBeGreaterThan(18);
		expect(withCamp.ingredients.length).toBeGreaterThan(0);
	});

	it("所持数が上限に達している時はberryBonusが発動しない", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 2);

		const result = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(505),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 10,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 1,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(result.helpCount).toBeGreaterThan(0);
		expect(result.berryCount).toBe(result.helpCount * 2);
	});

	it("今回のきのみ取得で上限到達する時はberryBonusが発動しない", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 2);

		const result = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(606),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 7,
			maxInventory: 10,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 1,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(result.helpCount).toBeGreaterThan(0);
		expect(result.berryCount).toBe(result.helpCount * 2);
	});

	it("上限未達の通常ケースではberryBonusが発動する", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 2);

		const result = calculateHelp({
			pokemon,
			durationMinutes: 300,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(707),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: 999,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 1,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
			},
		});

		expect(result.helpCount).toBeGreaterThan(0);
		expect(result.berryCount).toBe(result.helpCount * 3);
	});
});

describe("HelpCalculator EXフィールド別のきのみ速度補正", () => {
	function runWithField(options: {
		fieldIndex?: number;
		isMainBerry: boolean;
		isNonFavoriteBerry: boolean;
	}) {
		const pokemon = createTestPokemon();
		return calculateHelp({
			pokemon,
			durationMinutes: 600,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(2026),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: 999,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: options.isMainBerry,
				isNonFavoriteBerry: options.isNonFavoriteBerry,
				fieldIndex: options.fieldIndex,
			},
		});
	}

	it("シアンビーチEXのメインきのみ補正はグリーングラスEXより強い", () => {
		const ggex = runWithField({
			fieldIndex: ggexFieldIndex,
			isMainBerry: true,
			isNonFavoriteBerry: false,
		});
		const cbex = runWithField({
			fieldIndex: cbexFieldIndex,
			isMainBerry: true,
			isNonFavoriteBerry: false,
		});

		expect(cbex.helpCount).toBeGreaterThan(ggex.helpCount);
	});

	it("シアンビーチEXの非好みきのみペナルティはグリーングラスEXより重い", () => {
		const ggex = runWithField({
			fieldIndex: ggexFieldIndex,
			isMainBerry: false,
			isNonFavoriteBerry: true,
		});
		const cbex = runWithField({
			fieldIndex: cbexFieldIndex,
			isMainBerry: false,
			isNonFavoriteBerry: true,
		});

		expect(cbex.helpCount).toBeLessThan(ggex.helpCount);
	});

	it("fieldIndex未指定時はグリーングラスEXと同じ結果になる", () => {
		const omitted = runWithField({
			isMainBerry: true,
			isNonFavoriteBerry: false,
		});
		const ggex = runWithField({
			fieldIndex: ggexFieldIndex,
			isMainBerry: true,
			isNonFavoriteBerry: false,
		});

		expect(omitted.helpCount).toBe(ggex.helpCount);
	});

	it("EX補正対象外ならフィールドが変わってもおてつだい回数は変わらない", () => {
		const ggex = runWithField({
			fieldIndex: ggexFieldIndex,
			isMainBerry: false,
			isNonFavoriteBerry: false,
		});
		const cbex = runWithField({
			fieldIndex: cbexFieldIndex,
			isMainBerry: false,
			isNonFavoriteBerry: false,
		});

		expect(cbex.helpCount).toBe(ggex.helpCount);
	});
});

describe("HelpCalculator 未実装データの扱い", () => {
	it("おてつだいスピードが0のポケモンはおてつだいしない", () => {
		// 上流はプレースホルダーのポケモンを frequency 0 で追加する。
		// 0 で割るとおてつだい回数が無限になり、シミュレーションが停止しなくなる。
		const pokemon = createTestPokemon();
		Object.defineProperty(pokemon.iv, "frequencyWithHelpingBonus", {
			configurable: true,
			value: () => 0,
		});

		const result = calculateHelp({
			pokemon,
			durationMinutes: 600,
			startEnergy: 50,
			isSleeping: false,
			random: new SeededRandom(31),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 3,
			maxInventory: 0,
			bankedTimeSeconds: 12,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
		});

		expect(result.helpCount).toBe(0);
		expect(result.berryCount).toBe(0);
		expect(result.ingredients).toEqual([]);
		expect(result.newInventory).toBe(3);
		expect(result.newBankedTimeSeconds).toBe(12);
	});
});

describe("HelpCalculator とてもおおきなマゴのみ", () => {
	function createHelpInput(
		pokemon: PokemonBoxItem,
		overrides: {
			hugeMagoBerryPickupRate?: number;
			hugeMagoBerryPickupCount?: number;
			currentInventory?: number;
			maxInventory?: number;
		} = {},
	) {
		return {
			pokemon,
			durationMinutes: 600,
			startEnergy: 100,
			isSleeping: false,
			random: new SeededRandom(777),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: overrides.currentInventory ?? 0,
			maxInventory: overrides.maxInventory ?? pokemon.iv.carryLimit,
			bankedTimeSeconds: 0,
			pityProcEnabled: false,
			helpsSinceLastSkill: 0,
			bonusContext: {
				skillTriggerBonus: 1,
				berryBonus: 0,
				ingredientBonus: 0,
				isGoodCampTicketSet: false,
				isMainBerry: false,
				isNonFavoriteBerry: false,
				hugeMagoBerryPickupRate: overrides.hugeMagoBerryPickupRate ?? 0,
				hugeMagoBerryPickupCount: overrides.hugeMagoBerryPickupCount ?? 1,
			},
		};
	}

	it("確率100%ならおてつだい1回につき1個拾う", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 1);

		const output = calculateHelp(
			createHelpInput(pokemon, {
				hugeMagoBerryPickupRate: 1,
				maxInventory: 1000,
			}),
		);

		expect(output.helpCount).toBeGreaterThan(0);
		expect(output.hugeMagoBerryCount).toBe(output.helpCount);
	});

	it("きのみの数Sを持っていても1回1個のまま", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 3);

		const output = calculateHelp(
			createHelpInput(pokemon, {
				hugeMagoBerryPickupRate: 1,
				maxInventory: 1000,
			}),
		);

		expect(output.berryCount).toBe(output.helpCount * 3);
		expect(output.hugeMagoBerryCount).toBe(output.helpCount);
	});

	it("ミュウ / ミュウツーのように1回2個拾う設定なら2個ずつ拾う", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 1);

		const output = calculateHelp(
			createHelpInput(pokemon, {
				hugeMagoBerryPickupRate: 1,
				hugeMagoBerryPickupCount: 2,
				maxInventory: 1000,
			}),
		);

		expect(output.helpCount).toBeGreaterThan(0);
		expect(output.hugeMagoBerryCount).toBe(output.helpCount * 2);
	});

	it("個数が0なら確率があっても拾わない", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 1);

		const output = calculateHelp(
			createHelpInput(pokemon, {
				hugeMagoBerryPickupRate: 1,
				hugeMagoBerryPickupCount: 0,
				maxInventory: 1000,
			}),
		);

		expect(output.helpCount).toBeGreaterThan(0);
		expect(output.hugeMagoBerryCount).toBe(0);
	});

	it("所持数の空きを超える分は持ち帰らない", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 1);

		// 1回目のおてつだい: きのみ1個で空き1 → 2個拾う設定でも1個だけ
		const output = calculateHelp(
			createHelpInput(pokemon, {
				hugeMagoBerryPickupRate: 1,
				hugeMagoBerryPickupCount: 2,
				currentInventory: 0,
				maxInventory: 2,
			}),
		);

		expect(output.helpCount).toBeGreaterThan(1);
		expect(output.hugeMagoBerryCount).toBe(1);
		expect(output.newInventory).toBeGreaterThanOrEqual(2);
	});

	it("所持数が満タンなら拾わない（いつのまに育成では取得できない）", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 1);

		const output = calculateHelp(
			createHelpInput(pokemon, {
				hugeMagoBerryPickupRate: 1,
				currentInventory: 20,
				maxInventory: 20,
			}),
		);

		expect(output.helpCount).toBeGreaterThan(0);
		expect(output.hugeMagoBerryCount).toBe(0);
	});

	it("拾った分だけ所持数を消費する", () => {
		const pokemon = createTestPokemon();
		mockBerryOnlyHelps(pokemon, 1);

		const without = calculateHelp(
			createHelpInput(pokemon, { maxInventory: 1000 }),
		);
		const withPickup = calculateHelp(
			createHelpInput(pokemon, {
				hugeMagoBerryPickupRate: 1,
				maxInventory: 1000,
			}),
		);

		expect(withPickup.newInventory).toBe(
			without.newInventory + withPickup.hugeMagoBerryCount,
		);
	});

	it("確率0なら乱数を消費せず従来と同じ結果になる", () => {
		const pokemon = createTestPokemon();
		const withoutContext = calculateHelp({
			...createHelpInput(pokemon),
			bonusContext: undefined,
		});
		const withZeroRate = calculateHelp(
			createHelpInput(pokemon, { hugeMagoBerryPickupRate: 0 }),
		);

		expect(withZeroRate.hugeMagoBerryCount).toBe(0);
		expect(withZeroRate.berryCount).toBe(withoutContext.berryCount);
		expect(withZeroRate.newInventory).toBe(withoutContext.newInventory);
		expect(withZeroRate.skillTriggerCount).toBe(
			withoutContext.skillTriggerCount,
		);
	});
});

describe("HelpCalculator スキル連続不発天井", () => {
	/** SeededRandom が next() ごとに加算する定数（消費回数の計測用） */
	const SEED_STEP = 0x6d2b79f5;
	/** 乱数では実質発動しないスキル発動率 */
	const NEVER_SKILL_RATE = 1e-9;

	function createPityPokemon(options?: {
		skillRate?: number;
		pityProcHelpCount?: number;
	}): PokemonBoxItem {
		const pokemon = createTestPokemon();
		Object.defineProperty(pokemon.iv, "ingredientRate", {
			configurable: true,
			get: () => 0,
		});
		Object.defineProperty(pokemon.iv, "skillRate", {
			configurable: true,
			get: () => options?.skillRate ?? NEVER_SKILL_RATE,
		});
		if (options?.pityProcHelpCount !== undefined) {
			Object.defineProperty(pokemon.iv, "pityProcHelpCount", {
				configurable: true,
				get: () => options.pityProcHelpCount,
			});
		}
		return pokemon;
	}

	function createPityInput(
		pokemon: PokemonBoxItem,
		overrides?: Partial<HelpInput>,
	): HelpInput {
		return {
			pokemon,
			durationMinutes: 600,
			startEnergy: 100,
			isSleeping: false,
			random: new SeededRandom(9001),
			teamHelpingBonusCount: 0,
			currentSkillStock: 0,
			maxSkillStock: 1,
			currentInventory: 0,
			maxInventory: 999,
			bankedTimeSeconds: 0,
			pityProcEnabled: true,
			helpsSinceLastSkill: 0,
			...overrides,
		};
	}

	it("閾値は個体値計算機と同じ pityProcHelpCount を参照する", () => {
		const pokemon = createTestPokemon();
		expect(getPityProcThreshold(pokemon)).toBe(pokemon.iv.pityProcHelpCount);
		// きのみとくいのピカチュウは78回
		expect(getPityProcThreshold(pokemon)).toBe(78);
	});

	it("閾値回連続で不発なら次のおてつだいで確定発動し、カウンタは0に戻る", () => {
		const pokemon = createPityPokemon();
		const threshold = getPityProcThreshold(pokemon);

		const output = calculateHelp(
			createPityInput(pokemon, { helpsSinceLastSkill: threshold }),
		);

		expect(output.helpCount).toBeGreaterThan(1);
		expect(output.skillTriggerCount).toBe(1);
		expect(output.newSkillStock).toBe(1);
		// 1回目で確定発動 → 残りのおてつだいはストック満杯のため数えない
		expect(output.newHelpsSinceLastSkill).toBe(0);
	});

	it("N回連続不発のあと N+1 回目で確定発動する（閾値未満では発動しない）", () => {
		const pokemon = createPityPokemon();
		const threshold = getPityProcThreshold(pokemon);
		const helpCount = calculateHelp(createPityInput(pokemon)).helpCount;
		expect(helpCount).toBeGreaterThan(0);

		// この時間帯の終了時点でちょうど閾値回の連続不発になる
		const reachingThreshold = calculateHelp(
			createPityInput(pokemon, {
				helpsSinceLastSkill: threshold - helpCount,
			}),
		);
		expect(reachingThreshold.skillTriggerCount).toBe(0);
		expect(reachingThreshold.newHelpsSinceLastSkill).toBe(threshold);

		// 次の時間帯の最初のおてつだい（N+1回目）で確定発動する
		const next = calculateHelp(
			createPityInput(pokemon, {
				helpsSinceLastSkill: reachingThreshold.newHelpsSinceLastSkill,
				maxSkillStock: 999,
			}),
		);
		expect(next.skillTriggerCount).toBe(1);
		expect(next.newHelpsSinceLastSkill).toBe(next.helpCount - 1);
	});

	it("天井OFFなら確定発動せず、不発回数はそのまま積み上がる", () => {
		const pokemon = createPityPokemon();
		const threshold = getPityProcThreshold(pokemon);

		const output = calculateHelp(
			createPityInput(pokemon, {
				pityProcEnabled: false,
				helpsSinceLastSkill: threshold,
			}),
		);

		expect(output.skillTriggerCount).toBe(0);
		expect(output.newHelpsSinceLastSkill).toBe(threshold + output.helpCount);
	});

	it("確定発動時は乱数を消費しない", () => {
		const pokemon = createPityPokemon();
		const threshold = getPityProcThreshold(pokemon);
		const seed = 4242;

		const randomWithPity = new SeededRandom(seed);
		const withPity = calculateHelp(
			createPityInput(pokemon, {
				random: randomWithPity,
				helpsSinceLastSkill: threshold,
			}),
		);
		const randomWithoutPity = new SeededRandom(seed);
		const withoutPity = calculateHelp(
			createPityInput(pokemon, {
				random: randomWithoutPity,
				pityProcEnabled: false,
				helpsSinceLastSkill: threshold,
			}),
		);

		expect(withPity.helpCount).toBe(withoutPity.helpCount);
		const drawsWithPity = (randomWithPity.getSeed() - seed) / SEED_STEP;
		const drawsWithoutPity = (randomWithoutPity.getSeed() - seed) / SEED_STEP;
		// 確定発動した1回分だけスキル判定の乱数を引いていない
		expect(drawsWithoutPity - drawsWithPity).toBe(1);
	});

	it("所持数が満杯（いつのまに育成）の間はカウンタが増減せず確定発動もしない", () => {
		const pokemon = createPityPokemon();
		const threshold = getPityProcThreshold(pokemon);

		const output = calculateHelp(
			createPityInput(pokemon, {
				helpsSinceLastSkill: threshold,
				currentInventory: 10,
				maxInventory: 10,
			}),
		);

		expect(output.helpCount).toBeGreaterThan(0);
		expect(output.skillTriggerCount).toBe(0);
		expect(output.skillOverflowCount).toBe(0);
		expect(output.newHelpsSinceLastSkill).toBe(threshold);
	});

	it("スキルストックが満杯の間はカウンタが増減せず確定発動もしない", () => {
		const pokemon = createPityPokemon();
		const threshold = getPityProcThreshold(pokemon);

		const output = calculateHelp(
			createPityInput(pokemon, {
				helpsSinceLastSkill: threshold,
				currentSkillStock: 1,
				maxSkillStock: 1,
			}),
		);

		expect(output.helpCount).toBeGreaterThan(0);
		expect(output.skillTriggerCount).toBe(0);
		expect(output.newSkillStock).toBe(1);
		expect(output.newHelpsSinceLastSkill).toBe(threshold);
	});

	it("通常発動でもカウンタは0に戻る", () => {
		const pokemon = createPityPokemon({ skillRate: 1 });

		const output = calculateHelp(
			createPityInput(pokemon, {
				helpsSinceLastSkill: 5,
				maxSkillStock: 999,
			}),
		);

		expect(output.skillTriggerCount).toBe(output.helpCount);
		expect(output.newHelpsSinceLastSkill).toBe(0);
	});

	it("スキル発動率が0のポケモンは天井でも発動しない", () => {
		const pokemon = createPityPokemon({ skillRate: 0 });
		const threshold = getPityProcThreshold(pokemon);

		const output = calculateHelp(
			createPityInput(pokemon, { helpsSinceLastSkill: threshold }),
		);

		expect(output.helpCount).toBeGreaterThan(0);
		expect(output.skillTriggerCount).toBe(0);
	});

	it("閾値はポケモンごとの pityProcHelpCount に従う", () => {
		const pokemon = createPityPokemon({ pityProcHelpCount: 3 });

		const output = calculateHelp(
			createPityInput(pokemon, {
				helpsSinceLastSkill: 0,
				maxSkillStock: 999,
			}),
		);

		// 3回不発 → 4回目で確定発動を繰り返す
		expect(output.skillTriggerCount).toBe(Math.floor(output.helpCount / 4));
		expect(output.newHelpsSinceLastSkill).toBe(output.helpCount % 4);
	});

	it("おてつだいが0回なら入力のカウンタをそのまま返す", () => {
		const pokemon = createPityPokemon();

		const output = calculateHelp(
			createPityInput(pokemon, {
				durationMinutes: 0,
				helpsSinceLastSkill: 12,
			}),
		);

		expect(output.helpCount).toBe(0);
		expect(output.newHelpsSinceLastSkill).toBe(12);
	});

	it("負のカウンタは0として扱う", () => {
		const pokemon = createPityPokemon({ skillRate: 0 });

		const output = calculateHelp(
			createPityInput(pokemon, { helpsSinceLastSkill: -5 }),
		);

		expect(output.newHelpsSinceLastSkill).toBe(output.helpCount);
	});
});

describe("isPityProcTriggered", () => {
	it("閾値以上の連続不発で true になる", () => {
		expect(isPityProcTriggered(true, 0.02, 78, 78)).toBe(true);
		expect(isPityProcTriggered(true, 0.02, 79, 78)).toBe(true);
	});

	it("閾値未満、天井OFF、発動率0では false になる", () => {
		expect(isPityProcTriggered(true, 0.02, 77, 78)).toBe(false);
		expect(isPityProcTriggered(false, 0.02, 78, 78)).toBe(false);
		expect(isPityProcTriggered(true, 0, 78, 78)).toBe(false);
	});
});
