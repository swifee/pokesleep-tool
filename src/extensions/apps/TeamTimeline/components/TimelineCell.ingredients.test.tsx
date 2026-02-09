import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimelineCell from './TimelineCell';
import { TimeSlotResult } from '../types/TimeSlotTypes';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key,
    }),
}));

vi.mock('../../../../ui/IvCalc/IngredientIcon', () => ({
    default: ({ name }: { name: string }) => <span>{name}</span>,
}));

function countOccurrences(text: string, token: string): number {
    return (text.match(new RegExp(token, 'g')) ?? []).length;
}

function createTimeSlotResult(base: Partial<TimeSlotResult>): TimeSlotResult {
    return {
        slotId: 'slot-1',
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

describe('TimelineCell ingredient ordering', () => {
    it('sorts slot ingredients and overflow ingredients by count descending', () => {
        const result = createTimeSlotResult({
            ingredients: [
                { name: 'milk', count: 2 },
                { name: 'apple', count: 9 },
                { name: 'mushroom', count: 5 },
            ],
            overflowIngredients: [
                { name: 'honey', count: 1 },
                { name: 'egg', count: 4 },
            ],
        });

        const { container } = render(
            <TimelineCell
                result={result}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
            />
        );

        const content = container.textContent ?? '';
        expect(content.indexOf('apple')).toBeLessThan(content.indexOf('mushroom'));
        expect(content.indexOf('mushroom')).toBeLessThan(content.indexOf('milk'));
        expect(content.indexOf('egg')).toBeLessThan(content.indexOf('honey'));
    });

    it('renders support help as berry EP first and removes old parenthesized EP format', () => {
        const result = createTimeSlotResult({
            skillTriggerCount: 1,
            skillIngredients: [
                { name: 'apple', count: 1 },
                { name: 'mushroom', count: 1 },
            ],
            supportHelpEvents: [
                {
                    source: 'extraHelpful',
                    targetPokemonId: 7,
                    targetPokemonName: 'SupportTarget',
                    helpCount: 2,
                    berryCount: 4,
                    berryEP: 840,
                    ingredients: [
                        { name: 'apple', count: 1 },
                        { name: 'mushroom', count: 1 },
                    ],
                },
            ],
        });

        const { container } = render(
            <TimelineCell
                result={result}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
            />
        );

        const content = container.textContent ?? '';
        expect(content).toContain('❗→SupportTarget');
        expect(content).toContain('840EP');
        expect(content).not.toContain('(+840EP)');
        expect(content.indexOf('840EP')).toBeLessThan(content.indexOf('apple'));
        expect(countOccurrences(content, 'apple1')).toBe(1);
        expect(countOccurrences(content, 'mushroom1')).toBe(1);
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('renders arrows for all team-target skill event names', () => {
        const result = createTimeSlotResult({
            skillTriggerCount: 1,
            energizingCheerEvents: [
                {
                    source: 'cheer',
                    targetPokemonId: 11,
                    targetPokemonName: 'CheerTarget',
                    recovery: 18,
                },
            ],
            moonlightEvents: [
                {
                    targetPokemonId: 12,
                    targetPokemonName: 'MoonTarget',
                    recovery: 12,
                },
            ],
            supportHelpEvents: [
                {
                    source: 'extraHelpful',
                    targetPokemonId: 13,
                    targetPokemonName: 'SupportTarget2',
                    helpCount: 1,
                    berryCount: 2,
                    berryEP: 420,
                    ingredients: [],
                },
            ],
            cookingMinusEvents: [
                {
                    targetPokemonId: 14,
                    targetPokemonName: 'MinusTarget',
                    recovery: 9,
                },
            ],
        });

        const { container } = render(
            <TimelineCell
                result={result}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
            />
        );

        const content = container.textContent ?? '';
        expect(content).toContain('❗→CheerTarget');
        expect(content).toContain('❗→MoonTarget');
        expect(content).toContain('❗→SupportTarget2');
        expect(content).toContain('❗→MinusTarget');
    });

    it('renders team-wide recovery as (ALL) instead of target count', () => {
        const result = createTimeSlotResult({
            skillTriggerCount: 1,
            teamEnergyRecoveryGivenPerMember: 18,
            teamEnergyRecoveryGivenTargetCount: 5,
        });

        const { container } = render(
            <TimelineCell
                result={result}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
            />
        );

        const content = container.textContent ?? '';
        expect(content).toContain('❇️+18(ALL)');
        expect(content).not.toContain('❇️+18×5');
    });
});
