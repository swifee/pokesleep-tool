import React from 'react';
import { render, screen } from '@testing-library/react';
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

vi.mock('../../../../ui/IvCalc/PokemonIcon', () => ({
    default: ({ idForm, size }: { idForm: number; size: number }) => (
        <span data-testid="mock-pokemon-icon">{`${idForm}-${size}`}</span>
    ),
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
        expect(content).toContain('→SupportTarget');
        expect(content).toContain('840 EP');
        expect(content).not.toContain('(+840 EP)');
        expect(content.indexOf('840 EP')).toBeLessThan(content.indexOf('apple'));
        expect(countOccurrences(content, 'apple1')).toBe(1);
        expect(countOccurrences(content, 'mushroom1')).toBe(1);
        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.querySelectorAll('[data-skill-prefix-icon="true"]')).toHaveLength(1);
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
        expect(content).toContain('→CheerTarget');
        expect(content).toContain('→MoonTarget');
        expect(content).toContain('→SupportTarget2');
        expect(content).toContain('→MinusTarget');
        expect(container.querySelectorAll('[data-skill-prefix-icon="true"]')).toHaveLength(4);
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
        expect(content).toContain('+18(ALL)');
        expect(content).not.toContain('+18×5');
        expect(container.querySelectorAll('[data-heal-icon="true"]').length).toBeGreaterThan(0);
    });

    it('renders pokemon icon next to energy display when pokemonIdForm exists', () => {
        const result = createTimeSlotResult({
            energyEnd: 60,
        });

        render(
            <TimelineCell
                result={result}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                pokemonIdForm={25}
            />
        );

        expect(screen.getByTestId('timeline-cell-pokemon-icon').textContent).toBe('25-14');
    });

    it('keeps pokemon icon visible for pre-simulation empty cell', () => {
        render(
            <TimelineCell
                result={null}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                pokemonIdForm={35}
            />
        );

        expect(screen.getByTestId('timeline-cell-pokemon-icon').textContent).toBe('35-14');
    });

    it('shows simple mode metrics and counts cooking from regular ingredients only', () => {
        const result = createTimeSlotResult({
            berryCount: 10,
            skillTriggerCount: 2,
            skillOverflowCount: 1,
            ingredients: [
                { name: 'apple', count: 2 },
                { name: 'mushroom', count: 3 },
            ],
            skillIngredients: [
                { name: 'honey', count: 9 },
            ],
            overflowIngredients: [
                { name: 'egg', count: 4 },
            ],
        });

        render(
            <TimelineCell
                result={result}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                displayMode="simple"
            />
        );

        expect(screen.getByTestId('timeline-cell-simple-berry').textContent).toContain('10');
        expect(screen.getByTestId('timeline-cell-simple-cooking').textContent).toContain('5');
        expect(screen.getByTestId('timeline-cell-simple-cooking').textContent).not.toContain('14');
        expect(screen.getByTestId('timeline-cell-simple-skill')).toBeDefined();
        const simpleSkillOverflowIcon = screen.getByTestId('timeline-cell-simple-skill-none');
        expect(simpleSkillOverflowIcon).toBeDefined();
        expect(getComputedStyle(simpleSkillOverflowIcon).color).toBe('rgb(158, 158, 158)');
        expect(screen.queryByTestId('timeline-cell-help-icon-work')).toBeNull();
    });

    it('hides simple mode skill icons when trigger and overflow are zero', () => {
        const result = createTimeSlotResult({
            skillTriggerCount: 0,
            skillOverflowCount: 0,
            ingredients: [{ name: 'apple', count: 1 }],
        });

        render(
            <TimelineCell
                result={result}
                isSleeping={false}
                slotId="slot-1"
                teamIndex={0}
                displayMode="simple"
            />
        );

        expect(screen.queryByTestId('timeline-cell-simple-skill')).toBeNull();
        expect(screen.queryByTestId('timeline-cell-simple-skill-none')).toBeNull();
    });
});
