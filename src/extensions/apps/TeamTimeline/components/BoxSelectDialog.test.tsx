import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import PokemonIv from '../../../../util/PokemonIv';
import BoxFilterConfig from '../../../../util/PokemonBoxFilter';
import BoxSelectDialog from './BoxSelectDialog';
import { DIALOG_PAPER_SX, DIALOG_SX } from './BoxSelectDialogStyles';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key,
    }),
}));

vi.mock('../../../../ui/IvCalc/PokemonIcon', () => ({
    default: () => <div data-testid="pokemon-icon" />,
}));

vi.mock('../../../../ui/IvCalc/PokemonFilterFooter', () => ({
    default: ({
        value,
        onChange,
        onFilterButtonClick,
    }: {
        value: { sort: string; descending: boolean };
        onChange: (value: { sort: string; descending: boolean }) => void;
        onFilterButtonClick: () => void;
    }) => (
        <div>
            <button type="button" onClick={onFilterButtonClick}>open-filter</button>
            <button type="button" onClick={() => onChange({ ...value, sort: 'name' })}>sort-name</button>
            <button type="button" onClick={() => onChange({ ...value, descending: !value.descending })}>toggle-desc</button>
        </div>
    ),
}));

vi.mock('../../../../ui/IvCalc/Box/BoxSortConfigFooter', () => ({
    default: () => <div data-testid="sort-config-footer" />,
}));

vi.mock('../../../../ui/IvCalc/Box/BoxFilterDialog', () => ({
    default: ({
        open,
        value,
        onChange,
    }: {
        open: boolean;
        value: BoxFilterConfig;
        onChange: (value: BoxFilterConfig) => void;
    }) => (
        open ? (
            <button
                type="button"
                onClick={() => onChange(new BoxFilterConfig({ ...value, name: 'alpha' }))}
            >
                apply-alpha-filter
            </button>
        ) : null
    ),
}));

function createPokemon(pokemonName: string, level: number, nickname: string): PokemonBoxItem {
    return new PokemonBoxItem(new PokemonIv({ pokemonName, level }), nickname);
}

function getRenderedNames(): string[] {
    return screen.getAllByTestId('team-timeline-box-item-name').map((node) => node.textContent ?? '');
}

describe('BoxSelectDialog', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('supports sorting and filtering like IvCalc box', () => {
        const box = new PokemonBox([
            createPokemon('Pikachu', 10, 'Bravo'),
            createPokemon('Bulbasaur', 30, 'Alpha'),
            createPokemon('Charmander', 20, 'Charlie'),
        ]);

        render(
            <BoxSelectDialog
                open
                box={box}
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(getRenderedNames()).toEqual(['Alpha', 'Charlie', 'Bravo']);

        fireEvent.click(screen.getByRole('button', { name: 'sort-name' }));
        expect(getRenderedNames()).toEqual(['Charlie', 'Bravo', 'Alpha']);

        fireEvent.click(screen.getByRole('button', { name: 'toggle-desc' }));
        expect(getRenderedNames()).toEqual(['Alpha', 'Bravo', 'Charlie']);

        fireEvent.click(screen.getByRole('button', { name: 'open-filter' }));
        fireEvent.click(screen.getByRole('button', { name: 'apply-alpha-filter' }));
        expect(getRenderedNames()).toEqual(['Alpha']);
    });

    it('uses centered dialog styles for mobile stability', () => {
        expect(DIALOG_SX['& .MuiDialog-container'].alignItems).toBe('center');
        expect(DIALOG_PAPER_SX.maxWidth).toBe('none');
        expect(DIALOG_PAPER_SX.width).toEqual({
            xs: 'calc(100% - 16px)',
            sm: 'min(720px, calc(100% - 24px))',
        });
        expect(DIALOG_PAPER_SX.margin).toEqual({
            xs: '30px 8px',
            sm: '30px 12px',
        });
        expect(DIALOG_PAPER_SX.maxHeight).toBe('calc(100% - 60px)');
    });

    it('places sorting footer outside scrollable content area', () => {
        const box = new PokemonBox([
            createPokemon('Pikachu', 10, 'Bravo'),
            createPokemon('Bulbasaur', 30, 'Alpha'),
        ]);

        render(
            <BoxSelectDialog
                open
                box={box}
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />
        );

        const content = screen.getByTestId('team-timeline-box-select-content');
        const footer = screen.getByTestId('team-timeline-box-select-footer');
        expect(content.contains(footer)).toBe(false);
    });

    it('shows only "swap none" special option in swap dialog', () => {
        const box = new PokemonBox([
            createPokemon('Pikachu', 10, 'Bravo'),
        ]);

        render(
            <BoxSelectDialog
                open
                box={box}
                onSelect={vi.fn()}
                onClose={vi.fn()}
                onSelectNone={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: 'TeamTimeline.swap none' })).toBeDefined();
        expect(screen.queryByRole('button', { name: 'TeamTimeline.swap no change' })).toBeNull();
    });
});
