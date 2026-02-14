import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import PokemonIv from '../../../../util/PokemonIv';
import pokemons from '../../../../data/pokemons';
import { DailySummary } from '../types/TimeSlotTypes';
import DailySummaryRow from './DailySummaryRow';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key,
    }),
}));

vi.mock('../../../../ui/IvCalc/IngredientIcon', () => ({
    default: ({ name }: { name: string }) => <span>{name}</span>,
}));

function createPokemon(pokemonName: string, level: number, nickname: string): PokemonBoxItem {
    const pokemon = pokemons.find(p => p.name === pokemonName);
    if (!pokemon) {
        throw new Error(`${pokemonName} is not found`);
    }
    const iv = new PokemonIv({ pokemonName: pokemon.name, level });
    return new PokemonBoxItem(iv, nickname);
}

function createDailySummary(pokemonId: number, baseValue: number): DailySummary {
    return {
        pokemonId,
        totalHelpCount: baseValue,
        totalSkillCount: baseValue,
        totalBerryCount: baseValue,
        totalIngredients: [],
        totalSkillIngredients: [],
        berryEP: baseValue * 10,
        ingredientEP: baseValue * 20,
        skillEP: baseValue * 30,
        totalEP: baseValue * 60,
        totalSkillOverflowCount: 0,
        totalOverflowIngredients: [],
        totalDirectSkillEP: 0,
        totalPresentCandyCount: 0,
        totalCookingPotCapacityIncrease: 0,
        totalTastyChanceIncreasePercent: 0,
        totalDreamShardCount: 0,
    };
}

describe('DailySummaryRow', () => {
    it('renders all summaries when there are more than 5 pokemon', () => {
        const items = [
            createPokemon('Pikachu', 10, 'Poke1'),
            createPokemon('Bulbasaur', 11, 'Poke2'),
            createPokemon('Charmander', 12, 'Poke3'),
            createPokemon('Squirtle', 13, 'Poke4'),
            createPokemon('Eevee', 14, 'Poke5'),
            createPokemon('Dratini', 15, 'Poke6'),
        ];
        const box = new PokemonBox(items);
        const summaries = items.map((item, index) => createDailySummary(item.id, index + 1));

        const { container } = render(
            <DailySummaryRow dailySummaries={summaries} box={box} label="平均" layoutMode="details" />
        );

        expect(screen.getByText('平均')).toBeDefined();
        expect(container.querySelectorAll('[data-testid="daily-summary-row"]')).toHaveLength(1);
        expect(container.querySelectorAll('[data-testid="daily-summary-cell"]')).toHaveLength(6);
    });

    it('shows pokemon name for each summary cell', () => {
        const items = [
            createPokemon('Pikachu', 25, 'Alpha'),
            createPokemon('Bulbasaur', 30, 'Beta'),
        ];
        const box = new PokemonBox(items);
        const summaries = items.map((item, index) => createDailySummary(item.id, index + 1));

        render(<DailySummaryRow dailySummaries={summaries} box={box} layoutMode="details" />);

        expect(screen.getByText('Alpha')).toBeDefined();
        expect(screen.getByText('Beta')).toBeDefined();
    });

    it('renders only summary count (not fixed to 5 columns)', () => {
        const items = [
            createPokemon('Pikachu', 8, 'One'),
            createPokemon('Bulbasaur', 9, 'Two'),
            createPokemon('Charmander', 10, 'Three'),
        ];
        const box = new PokemonBox(items);
        const summaries = items.map((item, index) => createDailySummary(item.id, index + 1));

        const { container } = render(<DailySummaryRow dailySummaries={summaries} box={box} layoutMode="details" />);

        expect(container.querySelectorAll('[data-testid="daily-summary-cell"]')).toHaveLength(3);
    });

    it('shows 個別成績 as default label in details mode', () => {
        const items = [createPokemon('Pikachu', 12, 'Solo')];
        const box = new PokemonBox(items);
        const summaries = [createDailySummary(items[0].id, 1)];

        render(<DailySummaryRow dailySummaries={summaries} box={box} layoutMode="details" />);

        expect(screen.getByText('個別成績')).toBeDefined();
    });

    it('does not show label in average mode', () => {
        const items = [createPokemon('Pikachu', 12, 'Solo')];
        const box = new PokemonBox(items);
        const summaries = [createDailySummary(items[0].id, 1)];

        render(<DailySummaryRow dailySummaries={summaries} box={box} layoutMode="average" />);

        expect(screen.queryByText('個別成績')).toBeNull();
    });

    it('renders EP box between pokemon name and other stats', () => {
        const items = [createPokemon('Pikachu', 12, 'Solo')];
        const box = new PokemonBox(items);
        const summaries = [createDailySummary(items[0].id, 1)];

        const { container } = render(<DailySummaryRow dailySummaries={summaries} box={box} layoutMode="details" />);

        const content = container.textContent ?? '';
        expect(content.indexOf('Solo')).toBeLessThan(content.indexOf('60EP'));
        expect(content.indexOf('60EP')).toBeLessThan(content.indexOf('🔍1'));
    });

    it('renders overflow ingredients in timeline-style format without +溢', () => {
        const items = [createPokemon('Pikachu', 20, 'OverflowMon')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);
        summary.totalOverflowIngredients = [
            { name: 'apple', count: 4 },
            { name: 'mushroom', count: 9 },
        ];

        const { container } = render(
            <DailySummaryRow dailySummaries={[summary]} box={box} layoutMode="details" />
        );

        expect(container.textContent).toContain('(');
        expect(container.textContent).toContain(')');
        expect(container.textContent).not.toContain('+溢');
    });

    it('sorts ingredients by count descending and appends 食材合計 in details mode', () => {
        const items = [createPokemon('Pikachu', 20, 'Sorter')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);
        summary.totalIngredients = [
            { name: 'milk', count: 2 },
            { name: 'apple', count: 9 },
            { name: 'mushroom', count: 5 },
        ];

        const { container } = render(
            <DailySummaryRow dailySummaries={[summary]} box={box} layoutMode="details" />
        );

        const content = container.textContent ?? '';
        expect(content.indexOf('apple')).toBeLessThan(content.indexOf('mushroom'));
        expect(content.indexOf('mushroom')).toBeLessThan(content.indexOf('milk'));
        expect(content).toContain('食材合計: 16');
    });

    it('always keeps top 3 ingredients visible and groups only low ingredients after 4th item', () => {
        const items = [createPokemon('Pikachu', 20, 'Averager')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);
        summary.totalIngredients = [
            { name: 'apple', count: 8 },
            { name: 'milk', count: 3 },
            { name: 'mushroom', count: 2 },
            { name: 'honey', count: 1 },
        ];

        render(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="average"
                simulationDays={2}
            />
        );

        const trigger = screen.getByRole('button', { name: '他 1' });
        expect(screen.getByText('mushroom')).toBeDefined();
        fireEvent.click(trigger);

        expect(screen.getByText('honey')).toBeDefined();
    });

    it('uses 料理チャンス label (not abbreviated) in individual option line', () => {
        const items = [createPokemon('Pikachu', 20, 'Chef')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);
        summary.totalTastyChanceIncreasePercent = 12.5;

        render(<DailySummaryRow dailySummaries={[summary]} box={box} layoutMode="details" />);

        expect(screen.getByText('料理チャンス+12.5%')).toBeDefined();
        expect(screen.queryByText('料理+12.5%')).toBeNull();
    });

    it('applies dailyAverage conversion and rounds EP to integer', () => {
        const items = [createPokemon('Pikachu', 20, 'AverageMon')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);
        summary.totalHelpCount = 5;
        summary.totalSkillCount = 7;
        summary.totalBerryCount = 9;
        summary.berryEP = 1001;
        summary.ingredientEP = 2002;
        summary.skillEP = 3002;
        summary.totalEP = 6005;
        summary.totalIngredients = [{ name: 'apple', count: 10 }];

        render(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="details"
                simulationDays={2}
                valueMode="dailyAverage"
            />
        );

        const text = document.body.textContent ?? '';
        expect(text).toContain('AverageMon');
        expect(text).toContain('501EP');
        expect(text).toContain('1,001EP');
        expect(text).toContain('1,501EP');
        expect(text).toContain('3,003EP');
        expect(text).toContain('🔍2.5');
        expect(text).toContain('食材合計: 5');
    });

    it('opens skill ingredient popover by clicking the skill count number', () => {
        const items = [createPokemon('Pikachu', 20, 'SkillIngMon')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);
        summary.totalSkillIngredients = [
            { name: 'apple', count: 3 },
            { name: 'milk', count: 1 },
        ];

        render(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="details"
            />
        );

        fireEvent.click(screen.getByTestId(`skill-ingredient-trigger-${items[0].id}`));

        expect(screen.getByText('apple')).toBeDefined();
        expect(screen.getByText('milk')).toBeDefined();
    });

    it('shows timeline duration share when swap is configured', () => {
        const items = [createPokemon('Pikachu', 20, 'ShareMon')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);

        render(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="details"
                showTimelineDurationShare
                timelineDurationByPokemonId={new Map([[items[0].id, 720]])}
                totalTimelineDurationMinutes={1440}
            />
        );

        expect(screen.getByText('12H (50％)')).toBeDefined();
    });

    it('formats timeline duration share with one decimal when needed', () => {
        const items = [createPokemon('Pikachu', 20, 'DecimalShareMon')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);

        render(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="details"
                showTimelineDurationShare
                timelineDurationByPokemonId={new Map([[items[0].id, 570]])}
                totalTimelineDurationMinutes={1440}
            />
        );

        expect(screen.getByText('9.5H (39.6％)')).toBeDefined();
    });

    it('hides timeline duration share when disabled or total is zero', () => {
        const items = [createPokemon('Pikachu', 20, 'HiddenShareMon')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);

        const { rerender } = render(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="details"
                showTimelineDurationShare={false}
                timelineDurationByPokemonId={new Map([[items[0].id, 720]])}
                totalTimelineDurationMinutes={1440}
            />
        );
        expect(screen.queryByText('12H (50％)')).toBeNull();

        rerender(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="details"
                showTimelineDurationShare
                timelineDurationByPokemonId={new Map([[items[0].id, 720]])}
                totalTimelineDurationMinutes={0}
            />
        );
        expect(screen.queryByText('12H (50％)')).toBeNull();
    });

    it('shows timeline duration share in average layout mode', () => {
        const items = [createPokemon('Pikachu', 20, 'AverageShareMon')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);

        render(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="average"
                showTimelineDurationShare
                timelineDurationByPokemonId={new Map([[items[0].id, 720]])}
                totalTimelineDurationMinutes={1440}
            />
        );

        expect(screen.getByText('12H (50％)')).toBeDefined();
    });

    it('shows per-day timeline duration share in dailyAverage mode', () => {
        const items = [createPokemon('Pikachu', 20, 'PerDayShareMon')];
        const box = new PokemonBox(items);
        const summary = createDailySummary(items[0].id, 1);

        render(
            <DailySummaryRow
                dailySummaries={[summary]}
                box={box}
                layoutMode="average"
                simulationDays={7}
                valueMode="dailyAverage"
                showTimelineDurationShare
                timelineDurationByPokemonId={new Map([[items[0].id, 720]])}
                totalTimelineDurationMinutes={1440}
            />
        );

        expect(screen.getByText('1.7H (50％)')).toBeDefined();
    });
});
