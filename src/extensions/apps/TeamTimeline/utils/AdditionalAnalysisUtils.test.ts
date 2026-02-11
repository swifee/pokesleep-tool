import { describe, expect, it } from 'vitest';
import PokemonIv from '../../../../util/PokemonIv';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import pokemons from '../../../../data/pokemons';
import { PokemonSwap, SimulationResult, SWAP_NONE_POKEMON_ID } from '../types/TimeSlotTypes';
import {
    buildContributionEpAnalysisResult,
    buildEnergyRecoveryBonusContributionResult,
    buildEnergySkillContributionResult,
    buildEnergySkillContributionTargets,
    calculateDeltaPercent,
    collectAppearingTimelineMembers,
    formatSignedPercent,
} from './AdditionalAnalysisUtils';
import { EnergySkillContributionTarget } from '../types/AdditionalAnalysisTypes';

function createPokemonBySkill(skillName: string): PokemonBoxItem {
    const pokemon = pokemons.find(entry => entry.skill === skillName);
    if (!pokemon) {
        throw new Error(`Pokemon with skill ${skillName} not found`);
    }
    return new PokemonBoxItem(new PokemonIv({
        pokemonName: pokemon.name,
        skillLevel: 6,
    }));
}

function createMockResult(teamEP: number, helpByPokemonId: ReadonlyMap<number, number>): SimulationResult {
    return {
        slotResults: new Map(),
        dailySummaries: Array.from(helpByPokemonId.entries()).map(([pokemonId, totalHelpCount]) => ({
            pokemonId,
            totalHelpCount,
            totalSkillCount: 0,
            totalBerryCount: 0,
            totalIngredients: [],
            berryEP: 0,
            ingredientEP: 0,
            skillEP: 0,
            totalSkillOverflowCount: 0,
            totalOverflowIngredients: [],
            totalDirectSkillEP: 0,
            totalPresentCandyCount: 0,
            totalCookingPotCapacityIncrease: 0,
            totalTastyChanceIncreasePercent: 0,
            totalDreamShardCount: 0,
            totalEP: totalHelpCount,
        })),
        teamSummary: {
            totalIngredients: [],
            totalBerryEP: 0,
            totalIngredientEP: 0,
            totalSkillEP: 0,
            grandTotalEP: teamEP,
            totalPresentCandyCount: 0,
            totalCookingPotCapacityIncrease: 0,
            totalTastyChanceIncreasePercent: 0,
            totalDreamShardCount: 0,
        },
    };
}

describe('AdditionalAnalysisUtils', () => {
    it('collects appearing members from initial team and swaps uniquely', () => {
        const member1 = createPokemonBySkill('Charge Energy S');
        const member2 = createPokemonBySkill('Energy for Everyone S');
        const member3 = createPokemonBySkill('Charge Strength M (Bad Dreams)');
        const box = new PokemonBox([member1, member2, member3]);
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-1',
                teamSlotIndex: 0,
                newPokemonId: member2.id,
                initialEnergy: 80,
            },
            {
                dayIndex: 1,
                slotId: 'slot-2',
                teamSlotIndex: 1,
                newPokemonId: member3.id,
                initialEnergy: 60,
            },
            {
                dayIndex: 1,
                slotId: 'slot-3',
                teamSlotIndex: 2,
                newPokemonId: SWAP_NONE_POKEMON_ID,
                initialEnergy: 0,
            },
        ];

        const members = collectAppearingTimelineMembers(
            [member1, null, null, null, null],
            swaps,
            box
        );

        expect(members.map(member => member.id)).toEqual([member1.id, member2.id, member3.id]);
    });

    it('builds energy skill targets with category and conditional Cooking Minus inclusion', () => {
        const minusMember = createPokemonBySkill('Cooking Power-Up S (Minus)');
        const selfMember = createPokemonBySkill('Charge Energy S');
        const teamMember = createPokemonBySkill('Energy for Everyone S');
        const nightmareMember = createPokemonBySkill('Charge Strength M (Bad Dreams)');

        const targetsWithoutPlusMinus = buildEnergySkillContributionTargets([selfMember, teamMember]);
        expect(targetsWithoutPlusMinus.some(target => target.pokemonId === minusMember.id)).toBe(false);

        const targets = buildEnergySkillContributionTargets([
            minusMember,
            createPokemonBySkill('Ingredient Magnet S (Plus)'),
            selfMember,
            teamMember,
            nightmareMember,
        ]);

        const byId = new Map<number, EnergySkillContributionTarget>(targets.map(target => [target.pokemonId, target]));
        expect(byId.get(minusMember.id)?.category).toBe('team');
        expect(byId.get(selfMember.id)?.category).toBe('self');
        expect(byId.get(teamMember.id)?.category).toBe('team');
        expect(byId.get(nightmareMember.id)?.category).toBe('nightmare');
    });

    it('calculates deltas and formats percent safely when base is zero', () => {
        expect(calculateDeltaPercent(0, 10)).toBeNull();
        expect(formatSignedPercent(null)).toBe('-');
        expect(formatSignedPercent(12.345)).toBe('+12.3%');
        expect(formatSignedPercent(-2.4)).toBe('-2.4%');
    });

    it('builds contribution/energy/erb analysis result payloads', () => {
        const member = createPokemonBySkill('Charge Energy S');
        const target: EnergySkillContributionTarget = {
            pokemonId: member.id,
            pokemonName: member.iv.pokemonName,
            skillName: member.iv.pokemon.skill,
            category: 'self',
        };
        const base = createMockResult(10000, new Map([[member.id, 100], [999, 200]]));
        const scenario = createMockResult(9200, new Map([[member.id, 80], [999, 180]]));

        const contribution = buildContributionEpAnalysisResult(member, base, scenario);
        expect(contribution.deltaEP).toBe(-800);
        expect(contribution.deltaPercent).toBeCloseTo(-8);

        const energySkill = buildEnergySkillContributionResult(target, base, scenario);
        expect(energySkill.selfDeltaEP).toBe(-20);
        expect(energySkill.selfDeltaPercent).toBeCloseTo(-20);
        expect(energySkill.teamDeltaEP).toBe(-800);
        expect(energySkill.teamDeltaPercent).toBeCloseTo(-8);

        const erb = buildEnergyRecoveryBonusContributionResult(base, scenario);
        expect(erb.teamDeltaPercent).toBeCloseTo(-13.333, 2);
    });
});
