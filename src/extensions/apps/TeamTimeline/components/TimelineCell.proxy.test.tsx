import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import pokemons from "../../../../data/pokemons";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import SeededRandom from "../simulation/SeededRandom";
import { processSkillTriggers } from "../simulation/SkillEffectProcessor";
import type { TimeSlotResult } from "../types/TimeSlotTypes";
import TimelineCell from "./TimelineCell";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
	}),
}));

const METRONOME_POOL_LAST_INDEX = 22;

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

function createTimeSlotResult(base: Partial<TimeSlotResult>): TimeSlotResult {
	return {
		slotId: "slot-1",
		pokemonId: 1,
		teamIndex: 0,
		durationMinutes: 60,
		isSleeping: false,
		helpCount: 0,
		skillTriggerCount: 0,
		berryCount: 0,
		ingredients: [],
		skillIngredients: [],
		energyStart: 50,
		energyEnd: 50,
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
		proxySkillEvents: [],
		presentCandyCount: 0,
		berryJuiceCount: 0,
		supportSkillBerryCount: 0,
		supportSkillBerryEP: 0,
		supportHelpEvents: [],
		stockpileStoreCount: 0,
		stockpileCountAtStore: 0,
		stockpileSpitCount: 0,
		badDreamsHitCount: 0,
		badDreamsTotalDamageGiven: 0,
		badDreamsDamageTaken: 0,
		...base,
	};
}

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function countSkillPrefixIcon(html: string): number {
	return (html.match(/data-skill-prefix-icon="true"/g) ?? []).length;
}

function runMetronomeWithForcedIndices(
	indices: number[],
): ReturnType<typeof processSkillTriggers> {
	const caster = createPokemonBySkill("Metronome", 7);
	const teammate1 = createPokemonBySkill("Energy for Everyone S", 6);
	const teammate2 = createPokemonBySkill("Charge Energy S", 6);
	const teamMembers = [caster, teammate1, teammate2];

	const random = new SeededRandom(99123);
	const originalNextInt = random.nextInt.bind(random);
	let cursor = 0;
	vi.spyOn(random, "nextInt").mockImplementation((min: number, max: number) => {
		if (
			min === 0 &&
			max === METRONOME_POOL_LAST_INDEX &&
			cursor < indices.length
		) {
			const next = indices[cursor] ?? 0;
			cursor += 1;
			return next;
		}
		return originalNextInt(min, max);
	});

	return processSkillTriggers(
		caster,
		indices.length,
		50,
		random,
		[teammate1, teammate2],
		0,
		teamMembers,
	);
}

describe("TimelineCell proxy display", () => {
	it("ゆびをふる1回: 全スキルで❗は1つになり、派生名の括弧サフィックスを表示しない", () => {
		for (
			let skillIndex = 0;
			skillIndex <= METRONOME_POOL_LAST_INDEX;
			skillIndex++
		) {
			const skillResult = runMetronomeWithForcedIndices([skillIndex]);
			const result = createTimeSlotResult({
				skillTriggerCount: 1,
				directSkillEP: skillResult.directEP,
				selfSkillRecovery: skillResult.selfEnergyRecovery,
				skillIngredients: skillResult.skillIngredients,
				supportSkillBerryEP: skillResult.supportSkillBerryEP,
				supportHelpEvents: skillResult.supportHelpEvents.map((event) => ({
					source: event.source,
					targetPokemonId: event.targetPokemonId,
					targetPokemonName: String(event.targetPokemonId),
					helpCount: event.helpCount,
					berryCount: event.berryCount,
					berryEP: event.berryEP,
					ingredients: event.ingredients,
				})),
				proxySkillEvents: skillResult.proxySkillEvents.map((event) => ({
					source: event.source,
					triggeredSkillName: event.triggeredSkillName,
					resolvedSkillName: event.resolvedSkillName,
					resolvedSkillLevel: event.resolvedSkillLevel,
					copiedFromPokemonId: event.copiedFromPokemonId,
					selfEnergyRecovery: event.selfEnergyRecovery,
					teamEnergyRecoveryPerMember: event.teamEnergyRecoveryPerMember,
					teamEnergyRecoveryTargetCount: event.teamEnergyRecoveryTargetCount,
					directEP: event.directEP,
					skillIngredients: event.skillIngredients,
					presentCandyCount: event.presentCandyCount,
					berryJuiceCount: event.berryJuiceCount,
					supportSkillBerryEP: event.supportSkillBerryEP,
					cookingPotCapacityIncrease: event.cookingPotCapacityIncrease,
					tastyChanceIncreasePercent: event.tastyChanceIncreasePercent,
					dreamShardCount: event.dreamShardCount,
					stockpileStoreCount: event.stockpileStoreCount,
					stockpileCountAtStore: event.stockpileCountAtStore,
					stockpileSpitCount: event.stockpileSpitCount,
					badDreamsHitCount: event.badDreamsHitCount,
					berryBurstGreatSuccessCount: event.berryBurstGreatSuccessCount,
					ingredientDrawGreatSuccessCount:
						event.ingredientDrawGreatSuccessCount,
				})),
				stockpileStoreCount: skillResult.stockpileStoreCount,
				stockpileCountAtStore: skillResult.stockpileCountAtStore,
				stockpileSpitCount: skillResult.stockpileSpitCount,
				berryJuiceCount: skillResult.berryJuiceCount,
				dreamShardCount: skillResult.dreamShardCount,
			});

			const html = renderToStaticMarkup(
				<TimelineCell
					result={result}
					isSleeping={false}
					slotId="slot-1"
					teamIndex={0}
				/>,
			);
			const text = stripHtml(html);
			expect(countSkillPrefixIcon(html)).toBe(1);
			expect(text.includes("(Moonlight)")).toBe(false);
			expect(text.includes("(Nuzzle)")).toBe(false);
			expect(text.includes("(Stockpile)")).toBe(false);
			expect(text.includes("(Bad Dreams)")).toBe(false);
			expect(text.includes("(Lunar Blessing)")).toBe(false);
			expect(text.includes("(Berry Juice)")).toBe(false);
			expect(text.includes("(Present)")).toBe(false);
			expect(text.includes("(Plus)")).toBe(false);
			expect(text.includes("(Minus)")).toBe(false);
			expect(text.includes("(Random)")).toBe(false);
			expect(text.includes("(Super Luck)")).toBe(false);
			expect(text.includes("(Hyper Cutter)")).toBe(false);
			expect(text.includes("(Disguise)")).toBe(false);
		}
	});

	it("ゆびをふる2回(異なるスキル): ❗行が2つになる", () => {
		const skillResult = runMetronomeWithForcedIndices([0, 1]);
		const result = createTimeSlotResult({
			skillTriggerCount: 2,
			proxySkillEvents: skillResult.proxySkillEvents.map((event) => ({
				source: event.source,
				triggeredSkillName: event.triggeredSkillName,
				resolvedSkillName: event.resolvedSkillName,
				resolvedSkillLevel: event.resolvedSkillLevel,
				selfEnergyRecovery: event.selfEnergyRecovery,
				teamEnergyRecoveryPerMember: event.teamEnergyRecoveryPerMember,
				teamEnergyRecoveryTargetCount: event.teamEnergyRecoveryTargetCount,
				directEP: event.directEP,
				skillIngredients: event.skillIngredients,
				supportSkillBerryEP: event.supportSkillBerryEP,
				stockpileStoreCount: event.stockpileStoreCount,
				stockpileCountAtStore: event.stockpileCountAtStore,
				stockpileSpitCount: event.stockpileSpitCount,
			})),
		});

		const html = renderToStaticMarkup(
			<TimelineCell
				result={result}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
			/>,
		);
		expect(countSkillPrefixIcon(html)).toBe(2);
	});

	it("ゆびをふる2回(同じスキル): ❗行が2つになる", () => {
		const skillResult = runMetronomeWithForcedIndices([2, 2]);
		const result = createTimeSlotResult({
			skillTriggerCount: 2,
			proxySkillEvents: skillResult.proxySkillEvents.map((event) => ({
				source: event.source,
				triggeredSkillName: event.triggeredSkillName,
				resolvedSkillName: event.resolvedSkillName,
				resolvedSkillLevel: event.resolvedSkillLevel,
				selfEnergyRecovery: event.selfEnergyRecovery,
				teamEnergyRecoveryPerMember: event.teamEnergyRecoveryPerMember,
				teamEnergyRecoveryTargetCount: event.teamEnergyRecoveryTargetCount,
				directEP: event.directEP,
				skillIngredients: event.skillIngredients,
				supportSkillBerryEP: event.supportSkillBerryEP,
				stockpileStoreCount: event.stockpileStoreCount,
				stockpileCountAtStore: event.stockpileCountAtStore,
				stockpileSpitCount: event.stockpileSpitCount,
			})),
		});

		const html = renderToStaticMarkup(
			<TimelineCell
				result={result}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
			/>,
		);
		expect(countSkillPrefixIcon(html)).toBe(2);
	});

	it("proxyのげんきオール表示は(ALL)になる", () => {
		const result = createTimeSlotResult({
			skillTriggerCount: 1,
			proxySkillEvents: [
				{
					source: "metronome",
					triggeredSkillName: "Energy for Everyone S",
					resolvedSkillName: "Energy for Everyone S",
					resolvedSkillLevel: 6,
					teamEnergyRecoveryPerMember: 18,
					teamEnergyRecoveryTargetCount: 5,
				},
			],
		});

		const html = renderToStaticMarkup(
			<TimelineCell
				result={result}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
			/>,
		);
		const text = stripHtml(html);
		expect(text).toContain("+18(ALL)");
		expect(text).not.toContain("+18×5");
		expect(html).toContain('data-heal-icon="true"');
	});
});
