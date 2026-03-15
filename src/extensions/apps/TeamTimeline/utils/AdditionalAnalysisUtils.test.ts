import { describe, expect, it } from 'vitest';
import PokemonIv from '../../../../util/PokemonIv';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import pokemons from '../../../../data/pokemons';
import { PokemonSwap, SimulationResult, SWAP_NONE_POKEMON_ID, TimeSlot } from '../types/TimeSlotTypes';
import {
    buildContributionEpAnalysisResult,
    buildEnergyRecoveryBonusContributionResult,
    buildEnergySkillContributionResult,
    buildEnergySkillContributionTargets,
    calculateDeltaPercent,
    collectWakeErbMemberCountRange,
    collectAverageHelpingBonusMemberCountByDuration,
    collectAverageEnergyRecoveryBonusMemberCountByDuration,
    collectTimelineDurationSummaryByPokemon,
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

function createStubMember(id: number, hasErb: boolean, hasHelpingBonus = false): PokemonBoxItem {
    const activeSubSkills: { name: string }[] = [];
    if (hasErb) {
        activeSubSkills.push({ name: 'Energy Recovery Bonus' });
    }
    if (hasHelpingBonus) {
        activeSubSkills.push({ name: 'Helping Bonus' });
    }
    return {
        id,
        iv: {
            activeSubSkills,
        },
    } as unknown as PokemonBoxItem;
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

    it('Mew は実効スキル名で energy skill targets を構築する', () => {
        const mew = new PokemonBoxItem(new PokemonIv({
            pokemonName: 'Mew',
            skillLevel: 6,
            versatileSkill: 'Energy for Everyone S',
        }));

        const targets = buildEnergySkillContributionTargets([mew]);

        expect(targets).toHaveLength(1);
        expect(targets[0]?.skillName).toBe('Energy for Everyone S');
        expect(targets[0]?.category).toBe('team');
    });

    it('shows Cooking Minus target only when timeline has concurrent plus/minus teammate timing', () => {
        const minusMember = createPokemonBySkill('Cooking Power-Up S (Minus)');
        const plusMember = createPokemonBySkill('Ingredient Magnet S (Plus)');
        const box = new PokemonBox([minusMember, plusMember]);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            { id: 'custom', time: '10:00', sleepState: 'none', hasMeal: false },
        ];

        const targetsWithConcurrentTiming = buildEnergySkillContributionTargets(
            [minusMember, plusMember],
            {
                team: [minusMember, null, null, null, null],
                timeSlots,
                simulationDays: 1,
                swaps: [{
                    dayIndex: 0,
                    slotId: 'wake',
                    teamSlotIndex: 1,
                    newPokemonId: plusMember.id,
                    initialEnergy: 100,
                }],
                box,
            }
        );
        expect(targetsWithConcurrentTiming.some(target => target.pokemonId === minusMember.id)).toBe(true);

        const targetsWithoutConcurrentTiming = buildEnergySkillContributionTargets(
            [minusMember, plusMember],
            {
                team: [minusMember, null, null, null, null],
                timeSlots,
                simulationDays: 1,
                swaps: [{
                    dayIndex: 0,
                    slotId: 'wake',
                    teamSlotIndex: 0,
                    newPokemonId: plusMember.id,
                    initialEnergy: 100,
                }],
                box,
            }
        );
        expect(targetsWithoutConcurrentTiming.some(target => target.pokemonId === minusMember.id)).toBe(false);
    });

    it('shows Cooking Minus targets when multiple minus members are simultaneously active', () => {
        const minusA = createPokemonBySkill('Cooking Power-Up S (Minus)');
        const minusB = createPokemonBySkill('Cooking Power-Up S (Minus)');
        const box = new PokemonBox([minusA, minusB]);
        const targets = buildEnergySkillContributionTargets(
            [minusA, minusB],
            {
                team: [minusA, minusB, null, null, null],
                timeSlots: [
                    { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                    { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                ],
                simulationDays: 1,
                swaps: [],
                box,
            }
        );

        const byId = new Map<number, EnergySkillContributionTarget>(targets.map(target => [target.pokemonId, target]));
        expect(byId.get(minusA.id)?.category).toBe('team');
        expect(byId.get(minusB.id)?.category).toBe('team');
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

        const erb = buildEnergyRecoveryBonusContributionResult(base, scenario, {
            minCount: 0,
            maxCount: 2,
            slotCount: 3,
        });
        expect(erb.teamDeltaEP).toBe(-800);
        expect(erb.teamDeltaPercent).toBeCloseTo(-8);
        expect(erb.wakeErbMemberCountMin).toBe(0);
        expect(erb.wakeErbMemberCountMax).toBe(2);
        expect(erb.wakeSlotCount).toBe(3);
    });

    it('counts wake ERB members using pre-swap team at the same slot', () => {
        const noErb = createStubMember(1, false);
        const hasErbA = createStubMember(2, true);
        const hasErbB = createStubMember(3, true);
        const box = new PokemonBox([noErb, hasErbA, hasErbB]);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            { id: 'custom', time: '08:00', sleepState: 'none', hasMeal: false },
            { id: 'wake2', time: '09:00', sleepState: 'wake', hasMeal: false },
        ];
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'wake',
                teamSlotIndex: 0,
                newPokemonId: hasErbA.id,
                initialEnergy: 100,
            },
            {
                dayIndex: 0,
                slotId: 'custom',
                teamSlotIndex: 1,
                newPokemonId: hasErbB.id,
                initialEnergy: 100,
            },
        ];

        const range = collectWakeErbMemberCountRange(
            [noErb, noErb, null, null, null],
            timeSlots,
            1,
            swaps,
            box
        );

        // wake(07:00) 時点は swap 未適用で 0体、wake2(09:00) は適用後で 2体
        expect(range).toEqual({
            minCount: 0,
            maxCount: 2,
            slotCount: 2,
        });
    });

    it('calculates average helping bonus member count by duration with pre-swap membership', () => {
        const memberA = createStubMember(10, false, true);
        const memberB = createStubMember(11, false);
        const box = new PokemonBox([memberA, memberB]);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            { id: 'custom', time: '10:00', sleepState: 'none', hasMeal: false },
        ];
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'wake',
                teamSlotIndex: 0,
                newPokemonId: SWAP_NONE_POKEMON_ID,
                initialEnergy: 0,
            },
            {
                dayIndex: 0,
                slotId: 'custom',
                teamSlotIndex: 0,
                newPokemonId: memberB.id,
                initialEnergy: 100,
            },
        ];

        const averageCount = collectAverageHelpingBonusMemberCountByDuration(
            [memberA, null, null, null, null],
            timeSlots,
            1,
            swaps,
            box
        );

        // 22:00->07:00 は HB 1体、07:00->10:00 は 0体、10:00->22:00 は non-HB なので 0体
        // (540 + 0 + 0) / 1440 = 0.375
        expect(averageCount).toBeCloseTo(0.375);
    });

    it('includes zero-member duration and returns 0 when team is always empty', () => {
        const averageCount = collectAverageHelpingBonusMemberCountByDuration(
            [null, null, null, null, null],
            [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            ],
            1,
            []
        );
        expect(averageCount).toBe(0);
    });

    it('returns 0 when total timeline duration is zero', () => {
        const member = createStubMember(100, false, true);
        const averageCount = collectAverageHelpingBonusMemberCountByDuration(
            [member, null, null, null, null],
            [{ id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false }],
            1,
            []
        );
        expect(averageCount).toBe(0);
    });

    it('calculates average ERB member count weighted by sleep duration at each wake', () => {
        const erbA = createStubMember(20, true, false);
        const erbB = createStubMember(21, true, false);
        const nonErb = createStubMember(22, false, false);
        const box = new PokemonBox([erbA, erbB, nonErb]);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '06:00', sleepState: 'wake', hasMeal: false },
        ];
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'wake',
                teamSlotIndex: 1,
                newPokemonId: nonErb.id,
                initialEnergy: 100,
            },
            {
                dayIndex: 1,
                slotId: 'wake',
                teamSlotIndex: 0,
                newPokemonId: nonErb.id,
                initialEnergy: 100,
            },
        ];

        const averageCount = collectAverageEnergyRecoveryBonusMemberCountByDuration(
            [erbA, erbB, null, null, null],
            timeSlots,
            3,
            swaps,
            box
        );

        // 8時間睡眠を3回で、起床時ERB編成数が 2,1,0 になるケース
        // ((8h*2)+(8h*1)+(8h*0))/(8h*3) = 1
        expect(averageCount).toBeCloseTo(1);
    });

    it('collects timeline duration per pokemon without swaps', () => {
        const memberA = createStubMember(101, false, false);
        const summary = collectTimelineDurationSummaryByPokemon(
            [memberA, null, null, null, null],
            [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                { id: 'custom', time: '10:00', sleepState: 'none', hasMeal: false },
            ],
            1,
            []
        );

        expect(summary.totalTimelineMinutes).toBe(1440);
        expect(summary.activeMinutesByPokemonId.get(memberA.id)).toBe(1440);
    });

    it('splits timeline duration by swap timing', () => {
        const memberA = createStubMember(201, false, false);
        const memberB = createStubMember(202, false, false);
        const box = new PokemonBox([memberA, memberB]);
        const summary = collectTimelineDurationSummaryByPokemon(
            [memberA, null, null, null, null],
            [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                { id: 'custom', time: '10:00', sleepState: 'none', hasMeal: false },
            ],
            1,
            [{
                dayIndex: 0,
                slotId: 'custom',
                teamSlotIndex: 0,
                newPokemonId: memberB.id,
                initialEnergy: 100,
            }],
            box
        );

        expect(summary.totalTimelineMinutes).toBe(1440);
        expect(summary.activeMinutesByPokemonId.get(memberA.id)).toBe(720);
        expect(summary.activeMinutesByPokemonId.get(memberB.id)).toBe(720);
    });

    it('keeps total timeline duration even when swap removes pokemon', () => {
        const memberA = createStubMember(301, false, false);
        const summary = collectTimelineDurationSummaryByPokemon(
            [memberA, null, null, null, null],
            [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                { id: 'custom', time: '10:00', sleepState: 'none', hasMeal: false },
            ],
            1,
            [{
                dayIndex: 0,
                slotId: 'wake',
                teamSlotIndex: 0,
                newPokemonId: SWAP_NONE_POKEMON_ID,
                initialEnergy: 0,
            }]
        );

        expect(summary.totalTimelineMinutes).toBe(1440);
        expect(summary.activeMinutesByPokemonId.get(memberA.id)).toBe(540);
    });

    it('counts each segment with pre-swap roster at the same slot', () => {
        const memberA = createStubMember(401, false, false);
        const memberB = createStubMember(402, false, false);
        const box = new PokemonBox([memberA, memberB]);
        const summary = collectTimelineDurationSummaryByPokemon(
            [memberA, null, null, null, null],
            [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                { id: 'custom', time: '10:00', sleepState: 'none', hasMeal: false },
            ],
            1,
            [{
                dayIndex: 0,
                slotId: 'wake',
                teamSlotIndex: 0,
                newPokemonId: memberB.id,
                initialEnergy: 100,
            }],
            box
        );

        // wake slot duration (22:00->07:00) should be attributed to pre-swap memberA.
        expect(summary.activeMinutesByPokemonId.get(memberA.id)).toBe(540);
        expect(summary.activeMinutesByPokemonId.get(memberB.id)).toBe(900);
    });
});
