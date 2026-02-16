import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CookingSettingsPanel from './CookingSettingsPanel';
import { CookingSimulationSettings, createDefaultCookingSettings } from '../types/CookingTypes';

interface ChildrenProps {
    children?: React.ReactNode;
    [key: string]: unknown;
}

interface TextFieldProps extends ChildrenProps {
    type?: string;
    value?: string | number;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    inputProps?: Record<string, unknown>;
    size?: string;
    variant?: string;
    sx?: unknown;
}

interface SelectProps extends ChildrenProps {
    value?: string | number;
    onChange?: React.ChangeEventHandler<HTMLSelectElement>;
    size?: string;
    variant?: string;
    sx?: unknown;
}

interface MenuItemProps extends ChildrenProps {
    value?: string | number;
}

interface TabsProps extends ChildrenProps {
    value?: string | number;
    onChange?: (event: React.SyntheticEvent, value: unknown) => void;
    sx?: unknown;
}

interface TabProps extends ChildrenProps {
    value?: string | number;
    label?: React.ReactNode;
    onSelect?: (value: unknown) => void;
    selected?: boolean;
    sx?: unknown;
}

interface SwitchProps extends ChildrenProps {
    checked?: boolean;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

interface FormControlLabelProps extends ChildrenProps {
    control?: React.ReactNode;
    label?: React.ReactNode;
}

vi.mock('@mui/material', () => ({
    Box: ({ children, sx, ...rest }: ChildrenProps & { sx?: unknown }) => {
        const sxText = typeof sx === 'object' && sx != null ? JSON.stringify(sx) : undefined;
        return <div data-sx={sxText} {...rest}>{children}</div>;
    },
    Typography: ({ children, ...rest }: ChildrenProps) => <span {...rest}>{children}</span>,
    TextField: ({ type, value, onChange, onBlur, inputProps, size, variant, sx, ...rest }: TextFieldProps) => {
        void inputProps;
        void size;
        void variant;
        void sx;
        return <input type={type ?? 'text'} value={value} onChange={onChange} onBlur={onBlur} {...rest} />;
    },
    Select: ({ value, onChange, size, variant, sx, children, ...rest }: SelectProps) => {
        void size;
        void variant;
        void sx;
        return <select value={value} onChange={onChange} {...rest}>{children}</select>;
    },
    MenuItem: ({ value, children }: MenuItemProps) => <option value={value}>{children}</option>,
    Tabs: ({ value, onChange, sx, children, ...rest }: TabsProps) => {
        void sx;
        return (
            <div {...rest}>
                {React.Children.map(children, (child) => {
                    if (!React.isValidElement<TabProps>(child)) {
                        return child;
                    }
                    return React.cloneElement(child, {
                        selected: child.props.value === value,
                        onSelect: (nextValue: unknown) => onChange?.({} as React.SyntheticEvent, nextValue),
                    });
                })}
            </div>
        );
    },
    Tab: ({ value, label, onSelect, selected, sx, ...rest }: TabProps) => {
        void sx;
        return (
            <button type="button" aria-pressed={selected} onClick={() => onSelect?.(value)} {...rest}>
                {label}
            </button>
        );
    },
    Switch: ({ checked, onChange, ...rest }: SwitchProps) => (
        <input type="checkbox" checked={checked} onChange={onChange} {...rest} />
    ),
    FormControlLabel: ({ control, label }: FormControlLabelProps) => <label>{control}{label}</label>,
    Button: ({ children, ...rest }: ChildrenProps) => <button type="button" {...rest}>{children}</button>,
    Divider: () => <hr />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

vi.mock('../../../../ui/IvCalc/IngredientIcon', () => ({
    default: ({ name }: { name: string }) => <span>[{name}]</span>,
}));

vi.mock('../../../../data/pokemons', async () => {
    const actual = await vi.importActual<typeof import('../../../../data/pokemons')>('../../../../data/pokemons');
    return {
        ...actual,
        IngredientNames: ['apple', 'mushroom', 'egg'],
    };
});

vi.mock('../data/RecipeData', () => {
    const recipes = [
        {
            name: 'megaStew',
            category: 'curry',
            ingredients: [
                { name: 'apple', count: 30 },
                { name: 'mushroom', count: 30 },
            ],
            recipeBonus: 0.19,
        },
        {
            name: 'lightSalad',
            category: 'salad',
            ingredients: [{ name: 'egg', count: 10 }],
            recipeBonus: 0.19,
        },
        {
            name: 'sweetDrink',
            category: 'dessert',
            ingredients: [{ name: 'apple', count: 8 }],
            recipeBonus: 0.19,
        },
    ] as const;

    return {
        getRecipesByCategory: (category: string) => recipes.filter((recipe) => recipe.category === category),
    };
});

function createSettings(overrides?: Partial<CookingSimulationSettings>): CookingSimulationSettings {
    return {
        enabled: true,
        category: 'curry',
        recipeLevels: { megaStew: 50, lightSalad: 50, sweetDrink: 50 },
        basePotCapacity: 81,
        initialIngredients: { apple: 30, mushroom: 24, egg: 600 },
        ...overrides,
    };
}

describe('CookingSettingsPanel', () => {
    it('uses updated defaults for cooking settings', () => {
        const defaults = createDefaultCookingSettings();
        expect(defaults.basePotCapacity).toBe(81);
        expect(defaults.recipeLevels).toEqual({});
    });

    it('renders pot capacity as 12-99 / step 3 select and changes category via tabs', () => {
        const onChange = vi.fn();
        render(<CookingSettingsPanel settings={createSettings()} onChange={onChange} />);

        const potSelect = screen.getByTestId('cooking-pot-capacity-select') as HTMLSelectElement;
        const optionValues = Array.from(potSelect.querySelectorAll('option')).map((option) => Number(option.value));
        expect(optionValues[0]).toBe(12);
        expect(optionValues[optionValues.length - 1]).toBe(99);
        expect(optionValues.every((value) => value % 3 === 0)).toBe(true);

        fireEvent.change(potSelect, { target: { value: '30' } });
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ basePotCapacity: 30 }));

        fireEvent.click(screen.getByTestId('cooking-category-tab-salad'));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'salad' }));
    });

    it('shows "料理" label and initializes recipe defaults to 50', () => {
        render(<CookingSettingsPanel settings={createSettings({ recipeLevels: {} })} onChange={vi.fn()} />);

        expect(screen.getByText('料理:')).toBeDefined();
        expect((screen.getByTestId('cooking-batch-level-input') as HTMLInputElement).value).toBe('50');
        expect((screen.getByTestId('recipe-level-input-megaStew') as HTMLInputElement).value).toBe('50');
    });

    it('allows empty recipe level input temporarily and accepts direct 65 input', () => {
        const onChange = vi.fn();
        render(<CookingSettingsPanel settings={createSettings()} onChange={onChange} />);

        const levelInput = screen.getByTestId('recipe-level-input-megaStew') as HTMLInputElement;
        fireEvent.change(levelInput, { target: { value: '' } });
        expect(levelInput.value).toBe('');

        fireEvent.change(levelInput, { target: { value: '65' } });
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            recipeLevels: expect.objectContaining({ megaStew: 65 }),
        }));
    });

    it('shows recipe ingredient summary and total initial ingredient count', () => {
        render(<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />);

        const summary = screen.getByTestId('recipe-ingredients-megaStew');
        expect(summary.textContent).toContain('食材60');
        expect(summary.textContent).toContain('[apple]30');
        expect(summary.textContent).toContain('[mushroom]30');

        expect(screen.getByTestId('cooking-initial-ingredients-total').textContent).toContain('入力値合計: 654');

        const ingredientArea = screen.getByTestId('cooking-initial-ingredients');
        expect(within(ingredientArea).queryByText('とくせんリンゴ')).toBeNull();
    });

    it('uses timeline-equivalent icon size in recipe ingredient summary', () => {
        render(<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />);

        const iconWithSize = screen.getByTestId('recipe-ingredient-icon-megaStew-apple');
        const sxText = iconWithSize.getAttribute('data-sx') ?? '';
        expect(sxText).toContain('"width":"12px"');
        expect(sxText).toContain('"height":"12px"');
    });
});
