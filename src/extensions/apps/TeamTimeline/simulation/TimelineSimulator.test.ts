import { describe, it, expect, vi, beforeEach } from 'vitest';
import PokemonIv from '../../../../util/PokemonIv';
import pokemons from '../../../../data/pokemons';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import SubSkill from '../../../../util/SubSkill';
import SubSkillList from '../../../../util/SubSkillList';
import { loadHelpEventBonus } from '../../../../data/events';
import { MainSkillName } from '../../../../util/MainSkill';
import {
    NoCollectCellSetting,
    PokemonSwap,
    SimulationResult,
    SWAP_NONE_POKEMON_ID,
    TimeSlot,
} from '../types/TimeSlotTypes';
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

function createMewPokemon(skillLevel: number, versatileSkill: MainSkillName): PokemonBoxItem {
    return new PokemonBoxItem(new PokemonIv({
        pokemonName: 'Mew',
        skillLevel,
        versatileSkill,
    }));
}

function createNonSkillSpecialtyPokemon(skillLevel: number): PokemonBoxItem {
    return new PokemonBoxItem(new PokemonIv({
        pokemonName: 'Pikachu',
        skillLevel,
    }));
}

function createPokemonWithHelpingBonus(base: PokemonBoxItem): PokemonBoxItem {
    const withHelpingBonusIv = base.iv.changeSubSkills(
        new SubSkillList({ lv10: new SubSkill('Helping Bonus') })
    );
    return new PokemonBoxItem(withHelpingBonusIv);
}

function createPokemonWithEnergyRecoveryBonus(base: PokemonBoxItem): PokemonBoxItem {
    const withErbIv = base.iv.changeSubSkills(
        new SubSkillList({ lv10: new SubSkill('Energy Recovery Bonus') })
    );
    return new PokemonBoxItem(withErbIv);
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

    it('単体対象イベントに targetPokemonIdForm を反映する', () => {
        const caster = createBerryBurstDisguisePokemon(3);
        const target = createBerryBurstDisguisePokemon(4);

        processSkillTriggersMock
            .mockImplementationOnce(() => ({
                ...createNeutralSkillEffectResult(50),
                moonlightTargets: new Map([[target.id, 12]]),
                energizingCheerTargets: new Map([[target.id, 18]]),
                energizingCheerEvents: [
                    { targetPokemonId: target.id, recovery: 18, source: 'cheer' as const },
                ],
                supportHelpEvents: [
                    {
                        source: 'extraHelpful' as const,
                        targetPokemonId: target.id,
                        helpCount: 1,
                        berryCount: 2,
                        berryEP: 240,
                        ingredients: [],
                    },
                ],
                cookingMinusTargets: new Map([[target.id, 9]]),
                cookingMinusEvents: [
                    { targetPokemonId: target.id, recovery: 9 },
                ],
            }))
            .mockImplementation(() => createNeutralSkillEffectResult(50));

        const result = runSimulation({
            team: [caster, target, null, null, null],
            timeSlots: [
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            ],
            config: { seed: 34567, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });

        const casterResult = result.slotResults.get('wake__day0')?.find(slotResult => slotResult.pokemonId === caster.id);
        expect(casterResult).toBeDefined();
        expect(casterResult?.moonlightEvents?.[0]?.targetPokemonIdForm).toBe(target.iv.idForm);
        expect(casterResult?.energizingCheerEvents[0]?.targetPokemonIdForm).toBe(target.iv.idForm);
        expect(casterResult?.supportHelpEvents[0]?.targetPokemonIdForm).toBe(target.iv.idForm);
        expect(casterResult?.cookingMinusEvents?.[0]?.targetPokemonIdForm).toBe(target.iv.idForm);
    });

    it('単体対象イベントの対象がマップに無い場合は targetPokemonIdForm を undefined のまま返す', () => {
        const caster = createBerryBurstDisguisePokemon(3);
        const missingTargetId = 99999;

        processSkillTriggersMock.mockImplementation(() => ({
            ...createNeutralSkillEffectResult(50),
            supportHelpEvents: [
                {
                    source: 'extraHelpful' as const,
                    targetPokemonId: missingTargetId,
                    helpCount: 1,
                    berryCount: 1,
                    berryEP: 120,
                    ingredients: [],
                },
            ],
        }));

        const result = runSimulation({
            team: [caster, null, null, null, null],
            timeSlots: [
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            ],
            config: { seed: 45678, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });

        const casterResult = result.slotResults.get('wake__day0')?.find(slotResult => slotResult.pokemonId === caster.id);
        expect(casterResult).toBeDefined();
        expect(casterResult?.supportHelpEvents[0]?.targetPokemonName).toBe(String(missingTargetId));
        expect(casterResult?.supportHelpEvents[0]?.targetPokemonIdForm).toBeUndefined();
    });

    it('Mew をシミュレーション投入時に保存済み Mew rate で正規化する', () => {
        processSkillTriggersMock.mockImplementation((pokemon: PokemonBoxItem, ...args: unknown[]) => {
            const energy = typeof args[1] === 'number' ? args[1] : 50;
            expect(pokemon.iv.baseIngRate).toBe(16);
            expect(pokemon.iv.baseSkillRate).toBe(2.8);
            return createNeutralSkillEffectResult(energy);
        });
        localStorage.setItem('PstStrenghParam', JSON.stringify({
            ...defaultBonusSettings,
            mew: {
                ing: 16,
                skill1: 8,
                skill2: 4.4,
                skill3: 2.8,
                success: 30,
            },
        }));

        const mew = createMewPokemon(6, 'Energy for Everyone S');
        const timeSlots: TimeSlot[] = [
            { id: 'sleep-start', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'morning', time: '08:00', sleepState: 'none', hasMeal: false },
        ];

        runSimulation({
            team: [mew, null, null, null, null],
            timeSlots,
            config: { seed: 24680, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });

        expect(processSkillTriggersMock).toHaveBeenCalled();
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

    it('再編成時は前回編成時の最終げんきを引き継ぐ', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemonA = createBerryBurstDisguisePokemon(2);
        const box = new PokemonBox([pokemonA]);

        const result = runSimulation({
            team: [pokemonA, null, null, null, null],
            timeSlots: [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                { id: 'lunch', time: '12:00', sleepState: 'none', hasMeal: false },
                { id: 'dinner', time: '18:00', sleepState: 'none', hasMeal: false },
            ],
            config: { seed: 14567, initialEnergy: 40, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            swaps: [
                {
                    dayIndex: 0,
                    slotId: 'wake',
                    teamSlotIndex: 0,
                    newPokemonId: SWAP_NONE_POKEMON_ID,
                    initialEnergy: 0,
                },
                {
                    dayIndex: 0,
                    slotId: 'lunch',
                    teamSlotIndex: 0,
                    newPokemonId: pokemonA.id,
                    initialEnergy: 10,
                },
            ],
            box,
        });

        const wakeResult = result.slotResults.get('wake__day0')?.find(r => r.pokemonId === pokemonA.id);
        const dinnerResult = result.slotResults.get('dinner__day0')?.find(r => r.pokemonId === pokemonA.id);

        expect(wakeResult).toBeDefined();
        expect(dinnerResult).toBeDefined();
        expect(dinnerResult!.energyStart).toBeCloseTo(wakeResult!.energyEnd, 6);
        expect(dinnerResult!.energyStart).toBeGreaterThan(10);
    });

    it('noCollect ONでは通常/スキル食材を持ち越し、次のOFFセルで清算する', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            const base = createNeutralSkillEffectResult(energy);
            return {
                ...base,
                skillIngredients: [{ name: 'apple', count: 2 }],
            };
        });

        const pokemon = createBerryBurstDisguisePokemon(2);
        const noCollectCells: NoCollectCellSetting[] = [
            { dayIndex: 0, slotId: 'wake', teamSlotIndex: 0 },
        ];
        const result = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots: [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                { id: 'lunch', time: '12:00', sleepState: 'none', hasMeal: false },
            ],
            config: { seed: 33445, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            noCollectCells,
        });

        const wake = result.slotResults.get('wake__day0')?.[0];
        const lunch = result.slotResults.get('lunch__day0')?.[0];
        expect(wake).toBeDefined();
        expect(lunch).toBeDefined();
        expect(wake!.ingredients).toEqual([]);
        expect(wake!.skillIngredients ?? []).toEqual([]);
        const lunchSkillIngredientTotal = (lunch!.skillIngredients ?? [])
            .reduce((sum, ingredient) => sum + ingredient.count, 0);
        expect(lunchSkillIngredientTotal).toBeGreaterThanOrEqual(4);
    });

    it('noCollect ONセルでは超過分きのみのみ清算し、食材は清算しない', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createBerryBurstDisguisePokemon(2);
        const result = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots: [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '18:00', sleepState: 'wake', hasMeal: false },
            ],
            config: { seed: 44001, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            noCollectCells: [{ dayIndex: 0, slotId: 'wake', teamSlotIndex: 0 }],
        });

        const wake = result.slotResults.get('wake__day0')?.[0];
        expect(wake).toBeDefined();
        expect(wake!.helpCount).toBeGreaterThan(0);
        expect(wake!.ingredients).toEqual([]);
        expect(wake!.skillIngredients ?? []).toEqual([]);
    });

    it('noCollectセルで所持数上限へ達する時はberryBonusが過大計上されない', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = new PokemonBoxItem(new PokemonIv({
            pokemonName: 'Toxel',
            level: 60,
            skillLevel: 1,
        }));
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '18:00', sleepState: 'wake', hasMeal: false },
        ];
        const noCollectCells: NoCollectCellSetting[] = [
            { dayIndex: 0, slotId: 'wake', teamSlotIndex: 0 },
        ];

        const baseResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 44002, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            noCollectCells,
        });
        const eventResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 44002, initialEnergy: 50, simulationDays: 1 },
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
            noCollectCells,
        });

        const baseWake = baseResult.slotResults.get('wake__day0')?.[0];
        const eventWake = eventResult.slotResults.get('wake__day0')?.[0];

        expect(baseWake).toBeDefined();
        expect(eventWake).toBeDefined();
        expect(baseWake?.berryCount).toBeGreaterThan(0);
        expect(eventWake?.berryCount ?? 0).toBeLessThanOrEqual(baseWake?.berryCount ?? 0);
    });

    it('swap設定セルはnoCollect指定されていても通常回収として扱う', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            const base = createNeutralSkillEffectResult(energy);
            return {
                ...base,
                skillIngredients: [{ name: 'apple', count: 3 }],
            };
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
            config: { seed: 44556, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            noCollectCells: [{ dayIndex: 0, slotId: 'wake', teamSlotIndex: 0 }],
            swaps: [{
                dayIndex: 0,
                slotId: 'wake',
                teamSlotIndex: 0,
                newPokemonId: pokemonB.id,
                initialEnergy: 70,
            }],
            box,
        });

        const wake = result.slotResults.get('wake__day0')?.[0];
        expect(wake).toBeDefined();
        const wakeSkillIngredientTotal = (wake!.skillIngredients ?? [])
            .reduce((sum, ingredient) => sum + ingredient.count, 0);
        expect(wakeSkillIngredientTotal).toBeGreaterThan(0);
    });

    it('非編成中に起床が発生した場合は1/20回復して再編成時に反映される', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemonA = createBerryBurstDisguisePokemon(2);
        const box = new PokemonBox([pokemonA]);

        const result = runSimulation({
            team: [pokemonA, null, null, null, null],
            timeSlots: [
                { id: 'sleep', time: '23:55', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '00:00', sleepState: 'wake', hasMeal: false },
            ],
            config: { seed: 24680, initialEnergy: 20, simulationDays: 2 },
            bonusSettings: defaultBonusSettings,
            swaps: [
                {
                    dayIndex: 0,
                    slotId: 'wake',
                    teamSlotIndex: 0,
                    newPokemonId: SWAP_NONE_POKEMON_ID,
                    initialEnergy: 0,
                },
                {
                    dayIndex: 1,
                    slotId: 'wake',
                    teamSlotIndex: 0,
                    newPokemonId: pokemonA.id,
                    initialEnergy: 1,
                },
            ],
            box,
        });

        const day0WakeResult = result.slotResults.get('wake__day0')?.find(r => r.pokemonId === pokemonA.id);
        const day1SleepEndResult = result.slotResults
            .get('sleep-end__day1')
            ?.find(r => r.pokemonId === pokemonA.id);

        expect(day0WakeResult).toBeDefined();
        expect(day1SleepEndResult).toBeDefined();
        expect(day1SleepEndResult!.energyStart).toBeGreaterThan(day0WakeResult!.energyEnd);
        expect(day1SleepEndResult!.energyStart).toBeLessThanOrEqual(100);
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

    it('おてつだいボーナス無効化オプションでおてつだい回数が減少する', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const basePokemon = createBerryBurstDisguisePokemon(3);
        const pokemonWithHelpingBonus = createPokemonWithHelpingBonus(basePokemon);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
        ];

        const normal = runSimulation({
            team: [pokemonWithHelpingBonus, null, null, null, null],
            timeSlots,
            config: { seed: 90234, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });
        const disabledHelpingBonus = runSimulation({
            team: [pokemonWithHelpingBonus, null, null, null, null],
            timeSlots,
            config: { seed: 90234, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            analysisOptions: {
                disableHelpingBonus: true,
            },
        });

        const normalHelpCount = sumHelpCount(normal, pokemonWithHelpingBonus.id);
        const disabledHelpCount = sumHelpCount(disabledHelpingBonus, pokemonWithHelpingBonus.id);
        expect(normalHelpCount).toBeGreaterThan(disabledHelpCount);
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

    it('スキル対象イベントのcarryLimitBonusは非対象ポケモンには適用されない', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createNonSkillSpecialtyPokemon(2);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '18:00', sleepState: 'wake', hasMeal: false },
        ];

        const baseResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 92346, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            noCollectCells: [{ dayIndex: 0, slotId: 'wake', teamSlotIndex: 0 }],
        });
        const eventResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 92346, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: {
                ...defaultBonusSettings,
                event: 'custom',
                customEventBonus: loadHelpEventBonus({
                    target: {
                        specialty: 'Skills',
                    },
                    effects: {
                        carryLimit: 15,
                    },
                }),
            },
            noCollectCells: [{ dayIndex: 0, slotId: 'wake', teamSlotIndex: 0 }],
        });

        const baseWake = baseResult.slotResults.get('wake__day0')?.[0];
        const eventWake = eventResult.slotResults.get('wake__day0')?.[0];

        expect(baseWake).toBeDefined();
        expect(eventWake).toBeDefined();
        expect(eventWake!.berryCount).toBe(baseWake!.berryCount);
        expect(eventWake!.helpCount).toBe(baseWake!.helpCount);
    });

    it('無効化対象はおてつだい/スキルを行わず、対象チームには残る', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemonA = createBerryBurstDisguisePokemon(3);
        const pokemonB = createBerryBurstDisguisePokemon(3);
        runSimulation({
            team: [pokemonA, pokemonB, null, null, null],
            timeSlots: [
                { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            ],
            config: { seed: 93456, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            analysisOptions: {
                disabledPokemonIds: [pokemonB.id],
                keepDisabledPokemonTargetable: true,
            },
        });

        const helpByA = sumHelpCount(
            runSimulation({
                team: [pokemonA, pokemonB, null, null, null],
                timeSlots: [
                    { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                    { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                ],
                config: { seed: 93456, initialEnergy: 50, simulationDays: 1 },
                bonusSettings: defaultBonusSettings,
                analysisOptions: {
                    disabledPokemonIds: [pokemonB.id],
                    keepDisabledPokemonTargetable: true,
                },
            }),
            pokemonA.id
        );
        const helpByB = sumHelpCount(
            runSimulation({
                team: [pokemonA, pokemonB, null, null, null],
                timeSlots: [
                    { id: 'sleep', time: '22:00', sleepState: 'sleep', hasMeal: false },
                    { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
                ],
                config: { seed: 93456, initialEnergy: 50, simulationDays: 1 },
                bonusSettings: defaultBonusSettings,
                analysisOptions: {
                    disabledPokemonIds: [pokemonB.id],
                    keepDisabledPokemonTargetable: true,
                },
            }),
            pokemonB.id
        );

        expect(helpByA).toBeGreaterThan(0);
        expect(helpByB).toBe(0);
        const firstCall = processSkillTriggersMock.mock.calls[0];
        expect(firstCall).toBeDefined();
        const teamMembersArg = firstCall?.[6] as PokemonBoxItem[] | undefined;
        expect(teamMembersArg?.map(member => member.id)).toContain(pokemonB.id);
        const analysisContextArg = firstCall?.[13] as {
            activeTeamMemberIds?: ReadonlySet<number>;
            targetableTeamMembers?: readonly PokemonBoxItem[];
        } | undefined;
        expect(analysisContextArg?.activeTeamMemberIds?.has(pokemonA.id)).toBe(true);
        expect(analysisContextArg?.activeTeamMemberIds?.has(pokemonB.id)).toBe(false);
        expect(analysisContextArg?.targetableTeamMembers?.map(member => member.id)).toContain(pokemonB.id);
    });

    it('げんき回復ボーナス無効化オプションで起床回復が減少する', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const basePokemon = createBerryBurstDisguisePokemon(3);
        const pokemonWithErb = createPokemonWithEnergyRecoveryBonus(basePokemon);
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '23:30', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '00:10', sleepState: 'wake', hasMeal: false },
        ];

        const normal = runSimulation({
            team: [pokemonWithErb, null, null, null, null],
            timeSlots,
            config: { seed: 94567, initialEnergy: 99, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
        });
        const disabledErb = runSimulation({
            team: [pokemonWithErb, null, null, null, null],
            timeSlots,
            config: { seed: 94567, initialEnergy: 99, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            analysisOptions: {
                disableEnergyRecoveryBonus: true,
            },
        });

        const normalWake = normal.slotResults.get('wake__day0')?.[0]?.wakeRecovery ?? 0;
        const disabledWake = disabledErb.slotResults.get('wake__day0')?.[0]?.wakeRecovery ?? 0;
        expect(normalWake).toBeGreaterThan(disabledWake);
    });

    it('レシピ未成立食事にあまり食材を後配分し、ごちゃまぜ料理として表示用結果を作る', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createBerryBurstDisguisePokemon(1);
        const result = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots: [
                { id: 'meal-only', time: '07:00', sleepState: 'wake', hasMeal: true },
            ],
            config: { seed: 32100, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            cookingSettings: {
                enabled: true,
                category: 'curry',
                recipeLevels: {},
                basePotCapacity: 3,
                initialIngredients: {
                    apple: 2,
                    milk: 2,
                },
                disabledRecipes: {},
                disabledExtraIngredients: {},
            },
        });

        const cookingEvent = result.cookingResult?.events[0];
        expect(cookingEvent).toBeDefined();
        expect(cookingEvent?.recipeName).toBe('mixedCurry');
        expect(cookingEvent?.cookingEP ?? 0).toBeGreaterThan(0);
        expect((cookingEvent?.extraIngredientsUsed ?? []).length).toBeGreaterThan(0);

        const fixedLeftoverTotal = Object.values(result.cookingResult?.leftoverIngredients.total ?? {})
            .reduce((sum, value) => sum + (value ?? 0), 0);
        expect(fixedLeftoverTotal).toBeCloseTo(4, 6);
    });

    it('後配分後の料理直前バッグに実値と「ここまで追加なし」仮想値を保持する', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createBerryBurstDisguisePokemon(1);
        const result = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots: [
                { id: 'meal-1', time: '07:00', sleepState: 'wake', hasMeal: true },
                { id: 'meal-2', time: '07:01', sleepState: 'none', hasMeal: true },
                { id: 'meal-3', time: '07:02', sleepState: 'none', hasMeal: true },
            ],
            config: { seed: 32101, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            cookingSettings: {
                enabled: true,
                category: 'curry',
                recipeLevels: {},
                basePotCapacity: 3,
                initialIngredients: {
                    apple: 5,
                },
                disabledRecipes: {},
                disabledExtraIngredients: {},
            },
        });

        const events = result.cookingResult?.events ?? [];
        expect(events).toHaveLength(3);

        const secondEvent = events[1];
        const thirdEvent = events[2];

        const secondActualApple = secondEvent?.bagIngredientsBeforeCooking?.find(entry => entry.name === 'apple')?.count ?? 0;
        const secondWithoutExtraApple = secondEvent?.bagIngredientsBeforeCookingWithoutExtra?.find(entry => entry.name === 'apple')?.count ?? 0;
        expect(secondActualApple).toBeCloseTo(2, 6);
        expect(secondWithoutExtraApple).toBeCloseTo(5, 6);

        const thirdActualApple = thirdEvent?.bagIngredientsBeforeCooking?.find(entry => entry.name === 'apple')?.count ?? 0;
        const thirdWithoutExtraApple = thirdEvent?.bagIngredientsBeforeCookingWithoutExtra?.find(entry => entry.name === 'apple')?.count ?? 0;
        expect(thirdActualApple).toBeCloseTo(0, 6);
        expect(thirdWithoutExtraApple).toBeCloseTo(5, 6);
    });

    it('料理イベント倍率dishは料理結果と配分後の料理EPへ反映される', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return {
                ...createNeutralSkillEffectResult(energy),
                skillIngredients: [{ name: 'apple', count: 7 }],
            };
        });

        const pokemon = createBerryBurstDisguisePokemon(1);
        const timeSlots: TimeSlot[] = [
            { id: 'meal-only', time: '07:00', sleepState: 'wake', hasMeal: true },
        ];
        const cookingSettings = {
            enabled: true,
            category: 'curry' as const,
            recipeLevels: {},
            basePotCapacity: 7,
            initialIngredients: {},
            disabledRecipes: {},
            disabledExtraIngredients: {},
        };

        const baseResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 55001, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            cookingSettings,
        });
        const eventResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 55001, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: {
                ...defaultBonusSettings,
                event: 'custom',
                customEventBonus: loadHelpEventBonus({
                    target: {
                        specialty: 'Skills',
                    },
                    effects: {
                        dish: 1.5,
                    },
                }),
            },
            cookingSettings,
        });

        const baseCookingEvent = baseResult.cookingResult?.events[0];
        const eventCookingEvent = eventResult.cookingResult?.events[0];
        const baseSummary = baseResult.dailySummaries[0];
        const eventSummary = eventResult.dailySummaries[0];
        const baseAttribution = baseResult.cookingResult?.pokemonAttributions[0];
        const eventAttribution = eventResult.cookingResult?.pokemonAttributions[0];

        expect(baseCookingEvent?.recipeName).toBe('specialAppleCurry');
        expect(eventCookingEvent?.recipeName).toBe('specialAppleCurry');
        expect(eventCookingEvent?.eFinal ?? 0).toBeGreaterThan(baseCookingEvent?.eFinal ?? 0);
        expect(eventCookingEvent?.cookingEP ?? 0).toBeGreaterThan(baseCookingEvent?.cookingEP ?? 0);
        expect(eventSummary?.cookingEP ?? 0).toBeGreaterThan(baseSummary?.cookingEP ?? 0);
        expect(eventResult.teamSummary.totalCookingEP ?? 0).toBeGreaterThan(baseResult.teamSummary.totalCookingEP ?? 0);
        expect(eventAttribution?.attributedCookingEP ?? 0).toBeGreaterThan(baseAttribution?.attributedCookingEP ?? 0);
        expect(eventAttribution?.attributedCookingEP).toBe(eventResult.teamSummary.totalCookingEP);
    });

    it('料理イベント倍率dishは後配分された追加食材の料理EPにも維持される', () => {
        processSkillTriggersMock.mockImplementation((...args: unknown[]) => {
            const energy = typeof args[2] === 'number' ? args[2] : 50;
            return createNeutralSkillEffectResult(energy);
        });

        const pokemon = createBerryBurstDisguisePokemon(1);
        const cookingSettings = {
            enabled: true,
            category: 'curry' as const,
            recipeLevels: {},
            basePotCapacity: 3,
            initialIngredients: {
                apple: 2,
                milk: 2,
            },
            disabledRecipes: {},
            disabledExtraIngredients: {},
        };
        const timeSlots: TimeSlot[] = [
            { id: 'meal-only', time: '07:00', sleepState: 'wake', hasMeal: true },
        ];

        const baseResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 55002, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: defaultBonusSettings,
            cookingSettings,
        });
        const eventResult = runSimulation({
            team: [pokemon, null, null, null, null],
            timeSlots,
            config: { seed: 55002, initialEnergy: 50, simulationDays: 1 },
            bonusSettings: {
                ...defaultBonusSettings,
                event: 'custom',
                customEventBonus: loadHelpEventBonus({
                    target: {},
                    effects: {
                        dish: 1.5,
                    },
                }),
            },
            cookingSettings,
        });

        const baseCookingEvent = baseResult.cookingResult?.events[0];
        const eventCookingEvent = eventResult.cookingResult?.events[0];

        expect(baseCookingEvent?.recipeName).toBe('mixedCurry');
        expect(eventCookingEvent?.recipeName).toBe('mixedCurry');
        expect((baseCookingEvent?.extraIngredientsUsed ?? []).length).toBeGreaterThan(0);
        expect((eventCookingEvent?.extraIngredientsUsed ?? []).length).toBeGreaterThan(0);
        expect(eventCookingEvent?.cookingEP ?? 0).toBeGreaterThan(baseCookingEvent?.cookingEP ?? 0);
    });
});
