import { describe, it, expect, vi, beforeEach } from 'vitest';
import PokemonIv from '../../../../util/PokemonIv';
import pokemons from '../../../../data/pokemons';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import SubSkill from '../../../../util/SubSkill';
import SubSkillList from '../../../../util/SubSkillList';
import { loadHelpEventBonus } from '../../../../data/events';
import { PokemonSwap, SimulationResult, TimeSlot } from '../types/TimeSlotTypes';
import { createDefaultTimelineBonusSettings } from '../utils/TimelineBonusSettingsBridge';

const processSkillTriggersMock = vi.fn();

vi.mock('./SkillEffectProcessor', async () => {
    const actual = await vi.importActual<typeof import('./SkillEffectProcessor')>('./SkillEffectProcessor');
    return {
        ...actual,
        processSkillTriggers: (...args: unknown[]) => processSkillTriggersMock(...args),
    };
});

import { runSimulation } from './TimelineSimulator';

const defaultBonusSettings = createDefaultTimelineBonusSettings();

function createBerryBurstDisguisePokemon(skillLevel: number): PokemonBoxItem {
    const pokemon = pokemons.find(p => p.skill === 'Berry Burst (Disguise)');
    if (!pokemon) {
        throw new Error('Berry Burst (Disguise) pokemon not found');
    }
    const iv = new PokemonIv({
        pokemonName: pokemon.name,
        skillLevel,
    });
    return new PokemonBoxItem(iv);
}

function createPokemonWithHelpingBonus(base: PokemonBoxItem): PokemonBoxItem {
    const withHelpingBonusIv = base.iv.changeSubSkills(
        new SubSkillList({ lv10: new SubSkill('Helping Bonus') })
    );
    return new PokemonBoxItem(withHelpingBonusIv);
}

function createNeutralSkillEffectResult(energyAfterSelfRecovery: number) {
    return {
        selfEnergyRecovery: 0,
        energyAfterSelfRecovery,
        directEP: 0,
        teamEnergyRecoveryPerMember: 0,
        skillIngredients: [],
        presentCandyCount: 0,
        berryJuiceCount: 0,
        supportSkillBerryCount: 0,
        supportSkillBerryEP: 0,
        supportHelpEvents: [],
        cookingPotCapacityIncrease: 0,
        tastyChanceIncreasePercent: 0,
        dreamShardCount: 0,
        ingredientDrawGreatSuccessCount: 0,
        cookingMinusTargets: new Map<number, number>(),
        cookingMinusEvents: [],
        berryBurstGreatSuccessCount: 0,
        berryBurstDisguiseLockedAfter: false,
        stockpileCountAfter: 0,
        stockpileStoreCount: 0,
        stockpileCountAtStore: 0,
        stockpileSpitCount: 0,
        badDreamsDamagePerTarget: 0,
        badDreamsHitCount: 0,
        badDreamsTotalDamage: 0,
        moonlightTargets: new Map<number, number>(),
        energizingCheerTargets: new Map<number, number>(),
        energizingCheerEvents: [],
        nuzzleTriggeredSkillEvents: [],
        proxySkillEvents: [],
        additionalRecoveryTargets: new Map<number, number>(),
    };
}

function sumHelpCount(result: SimulationResult, pokemonId: number): number {
    return Array.from(result.slotResults.values())
        .flat()
        .filter(slotResult => slotResult.pokemonId === pokemonId)
        .reduce((sum, slotResult) => sum + slotResult.helpCount, 0);
}

describe('TimelineSimulator', () => {
    beforeEach(() => {
        processSkillTriggersMock.mockReset();
    });

    it('sleepスロットでBerry Burst (Disguise)ロックを解除する', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const currentLock = Boolean(args[8]);
            return {
                selfEnergyRecovery: 0,
                energyAfterSelfRecovery: 50,
                directEP: 0,
                teamEnergyRecoveryPerMember: 0,
                skillIngredients: [],
                presentCandyCount: 0,
                berryJuiceCount: 0,
                supportSkillBerryCount: 0,
                supportSkillBerryEP: 0,
                supportHelpEvents: [],
                cookingPotCapacityIncrease: 0,
                tastyChanceIncreasePercent: 0,
                dreamShardCount: 0,
                ingredientDrawGreatSuccessCount: 0,
                cookingMinusTargets: new Map<number, number>(),
                cookingMinusEvents: [],
                berryBurstGreatSuccessCount: currentLock ? 0 : 1,
                berryBurstDisguiseLockedAfter: true,
                stockpileCountAfter: 0,
                stockpileStoreCount: 0,
                stockpileCountAtStore: 0,
                stockpileSpitCount: 0,
                badDreamsDamagePerTarget: 0,
                badDreamsHitCount: 0,
                badDreamsTotalDamage: 0,
                moonlightTargets: new Map<number, number>(),
                energizingCheerTargets: new Map<number, number>(),
                energizingCheerEvents: [],
                nuzzleTriggeredSkillEvents: [],
                proxySkillEvents: [],
                additionalRecoveryTargets: new Map<number, number>(),
            };
        });

        const pokemon = createBerryBurstDisguisePokemon(3);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep-start', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'morning', time: '08:00', sleepState: 'none', hasMeal: false },
            { id: 'afternoon', time: '14:00', sleepState: 'none', hasMeal: false },
        ];

        runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 12345, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });

        const lockArgs = processSkillTriggersMock.mock.calls.map(call => Boolean(call[8]));
        expect(lockArgs.length).toBeGreaterThanOrEqual(4);
        expect(lockArgs[0]).toBe(false);
        expect(lockArgs.some((locked, idx) => idx > 0 && idx < lockArgs.length - 1 && locked)).toBe(true);
        expect(lockArgs[lockArgs.length - 1]).toBe(false);
    });

    it('Ingredient Draw S (Hyper Cutter)の大成功回数をTimeSlotResultへ反映する', () => {
        processSkillTriggersMock.mockImplementation(() => ({
            selfEnergyRecovery: 0,
            energyAfterSelfRecovery: 50,
            directEP: 0,
            teamEnergyRecoveryPerMember: 0,
            skillIngredients: [],
            presentCandyCount: 0,
            berryJuiceCount: 0,
            supportSkillBerryCount: 0,
            supportSkillBerryEP: 0,
            supportHelpEvents: [],
            cookingPotCapacityIncrease: 0,
            tastyChanceIncreasePercent: 0,
            dreamShardCount: 0,
            ingredientDrawGreatSuccessCount: 2,
            cookingMinusTargets: new Map<number, number>(),
            cookingMinusEvents: [],
            berryBurstGreatSuccessCount: 0,
            berryBurstDisguiseLockedAfter: false,
            stockpileCountAfter: 0,
            stockpileStoreCount: 0,
            stockpileCountAtStore: 0,
            stockpileSpitCount: 0,
            badDreamsDamagePerTarget: 0,
            badDreamsHitCount: 0,
            badDreamsTotalDamage: 0,
            moonlightTargets: new Map<number, number>(),
            energizingCheerTargets: new Map<number, number>(),
            energizingCheerEvents: [],
            nuzzleTriggeredSkillEvents: [],
            proxySkillEvents: [],
            additionalRecoveryTargets: new Map<number, number>(),
        }));

        const pokemon = createBerryBurstDisguisePokemon(3);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep-start', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'morning', time: '08:00', sleepState: 'none', hasMeal: false },
        ];

        const result = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 23456, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });

        const morningResults = result.slotResults.get('morning__day0') ?? [];
        expect(morningResults.length).toBeGreaterThan(0);
        expect(morningResults[0]?.ingredientDrawGreatSuccessCount).toBe(2);
    });

    it('simulationDaysを増やすと結果件数が増え、合計は期間全体で集計される', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createBerryBurstDisguisePokemon(3);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            { id: 'lunch', time: '12:00', sleepState: 'none', hasMeal: true },
        ];

        const oneDay = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 34567, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });
        const twoDays = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 34567, initialEnergy: 50, simulationDays: 2 },
            bonusSettings: defaultBonusSettings,
        });

        expect(twoDays.slotResults.size).toBeGreaterThan(oneDay.slotResults.size);

        const oneDayHelp = sumHelpCount(oneDay, pokemon.id);
        const twoDaysHelp = sumHelpCount(twoDays, pokemon.id);
        expect(twoDaysHelp).toBeGreaterThan(oneDayHelp);
        expect(oneDay.dailySummaries[0]?.totalHelpCount).toBe(oneDayHelp);
        expect(twoDays.dailySummaries[0]?.totalHelpCount).toBe(twoDaysHelp);
    });

    it('2日目以降でも起床回復が発生する', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createBerryBurstDisguisePokemon(3);
        const result = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots: [
                { id: 'sleep', time: '22:30', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            ],
            config: { seed: 67890, initialEnergy: 50, simulationDays: 3 },
            bonusSettings: defaultBonusSettings,
        });

        const day0Wake = result.slotResults.get('wake__day0')?.[0];
        const day1Wake = result.slotResults.get('wake__day1')?.[0];
        const day2Wake = result.slotResults.get('wake__day2')?.[0];

        expect(day0Wake?.wakeRecovery).toBeGreaterThan(0);
        expect(day1Wake?.wakeRecovery).toBeGreaterThan(0);
        expect(day2Wake?.wakeRecovery).toBeGreaterThan(0);
    });

    it('dayIndex付きswapは対象日からのみ適用される', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemonA = createBerryBurstDisguisePokemon(2);
        const pokemonB = createBerryBurstDisguisePokemon(4);
        const box = new PokemonBox([pokemonA, pokemonB]);

        const result = runSimulation({
            team: [pokemonA, null, null, null, null],
            timeSlots: [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            ],
            config: { seed: 45678, initialEnergy: 50, simulationDays: 2 },
            bonusSettings: defaultBonusSettings,
            swaps: [{
                dayIndex: 1,
                slotId: 'wake',
                teamSlotIndex: 0,
                newPokemonId: pokemonB.id,
                initialEnergy: 80,
            }],
            box,
        });

        const day1EndPokemonId = result.slotResults.get('sleep-end__day0')?.[0]?.pokemonId;
        const day2EndPokemonId = result.slotResults.get('sleep-end__day1')?.[0]?.pokemonId;

        expect(day1EndPokemonId).toBe(pokemonA.id);
        expect(day2EndPokemonId).toBe(pokemonB.id);
    });

    it('dayIndexなしの旧swapはdayIndex=0として扱われる', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemonA = createBerryBurstDisguisePokemon(2);
        const pokemonB = createBerryBurstDisguisePokemon(4);
        const box = new PokemonBox([pokemonA, pokemonB]);
        const legacySwap = {
            slotId: 'wake',
            teamSlotIndex: 0,
            newPokemonId: pokemonB.id,
            initialEnergy: 70,
        } as unknown as PokemonSwap;

        const result = runSimulation({
            team: [pokemonA, null, null, null, null],
            timeSlots: [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            ],
            config: { seed: 56789, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            swaps: [legacySwap],
            box,
        });

        const endPokemonId = result.slotResults.get('sleep-end__day0')?.[0]?.pokemonId;
        expect(endPokemonId).toBe(pokemonB.id);
    });

    it('Helping Bonusは自分自身を含めておてつだい速度に反映される', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const basePokemon = createBerryBurstDisguisePokemon(3);
        const pokemonWithHelpingBonus = createPokemonWithHelpingBonus(basePokemon);
        const pokemonWithoutHelpingBonus = new PokemonBoxItem(basePokemon.iv.changeSubSkills(new SubSkillList()));

        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
        ];

        const resultWithHelpingBonus = runSimulation({
            team: [pokemonWithHelpingBonus, null, null, null, null],
            timeSlots,
            config: { seed: 90123, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });
        const resultWithoutHelpingBonus = runSimulation({
            team: [pokemonWithoutHelpingBonus, null, null, null, null],
            timeSlots,
            config: { seed: 90123, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });

        const withHelpingBonusHelpCount = sumHelpCount(resultWithHelpingBonus, pokemonWithHelpingBonus.id);
        const withoutHelpingBonusHelpCount = sumHelpCount(resultWithoutHelpingBonus, pokemonWithoutHelpingBonus.id);

        expect(withHelpingBonusHelpCount).toBeGreaterThan(withoutHelpingBonusHelpCount);
    });

    it('いいキャンプチケット有効時はおてつだい回数が増える', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createBerryBurstDisguisePokemon(3);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
        ];

        const withoutCamp = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 91234, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: {
                ...defaultBonusSettings,
                isGoodCampTicketSet: false,
            },
        });
        const withCamp = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 91234, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: {
                ...defaultBonusSettings,
                isGoodCampTicketSet: true,
            },
        });

        const withoutCampHelpCount = sumHelpCount(withoutCamp, pokemon.id);
        const withCampHelpCount = sumHelpCount(withCamp, pokemon.id);
        expect(withCampHelpCount).toBeGreaterThan(withoutCampHelpCount);
    });

    it('イベント/EXボーナスを設定すると結果が変化する', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createBerryBurstDisguisePokemon(3);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
        ];
        const baseResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 92345, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });
        const eventResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 92345, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: {
                ...defaultBonusSettings,
                event: 'custom',
                customEventBonus: loadHelpEventBonus({
                    target: {},
                    effects: {
                        berry: 1,
                    },
                }),
            },
        });
        const expertResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 92345, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: {
                ...defaultBonusSettings,
                fieldIndex: 7,
                favoriteType: [pokemon.iv.pokemon.type, 'fire', 'water'],
                expertEffect: 'berry',
            },
        });

        expect(eventResult.teamSummary.totalBerryEP).toBeGreaterThan(baseResult.teamSummary.totalBerryEP);
        expect(expertResult.teamSummary.totalBerryEP).toBeGreaterThan(baseResult.teamSummary.totalBerryEP);
    });
});
