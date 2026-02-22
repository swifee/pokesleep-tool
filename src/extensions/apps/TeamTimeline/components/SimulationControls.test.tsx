import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SimulationControls from './SimulationControls';

interface ChildrenProps {
    children?: React.ReactNode;
}

interface ButtonProps extends ChildrenProps {
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    sx?: unknown;
    ['aria-valuenow']?: number;
    ['aria-valuemin']?: number;
    ['aria-valuemax']?: number;
    ['data-testid']?: string;
}

interface CheckboxProps {
    checked?: boolean;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    disabled?: boolean;
    ['aria-label']?: string;
    inputProps?: Record<string, string>;
}

interface FormControlLabelProps {
    control?: React.ReactNode;
    label?: React.ReactNode;
}

interface TextFieldProps {
    type?: string;
    value?: string | number;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    disabled?: boolean;
}

interface SelectProps extends ChildrenProps {
    value?: string | number;
    onChange?: React.ChangeEventHandler<HTMLSelectElement>;
    renderValue?: (value: unknown) => React.ReactNode;
    disabled?: boolean;
    ['data-testid']?: string;
}

interface MenuItemProps extends ChildrenProps {
    value?: string | number;
}

vi.mock('@mui/material', () => ({
    Box: ({ children }: ChildrenProps) => <div>{children}</div>,
    Typography: ({ children }: ChildrenProps) => <span>{children}</span>,
    Button: ({ children, onClick, disabled, sx, ...rest }: ButtonProps) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            data-sx={sx ? JSON.stringify(sx) : undefined}
            {...rest}
        >
            {children}
        </button>
    ),
    IconButton: ({ children, onClick, disabled, ...rest }: ButtonProps) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            {...rest}
        >
            {children}
        </button>
    ),
    Checkbox: ({ checked, onChange, disabled }: CheckboxProps) => (
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} aria-label="seed-checkbox" />
    ),
    Switch: ({ checked, onChange, disabled, inputProps, ...rest }: CheckboxProps) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            aria-label={inputProps?.['aria-label']}
            {...rest}
        />
    ),
    FormControlLabel: ({ control, label }: FormControlLabelProps) => (
        <label>{control}{label}</label>
    ),
    TextField: ({ type, value, onChange, disabled }: TextFieldProps) => (
        <input type={type ?? 'text'} value={value} onChange={onChange} disabled={disabled} aria-label="seed-input" />
    ),
    Select: ({ value, onChange, children, renderValue, disabled, ...rest }: SelectProps) => {
        void renderValue;
        return <select value={value} onChange={onChange} disabled={disabled} {...rest}>{children}</select>;
    },
    MenuItem: ({ value, children }: MenuItemProps) => (
        <option value={value}>{children}</option>
    ),
}));

vi.mock('@mui/icons-material/Settings', () => ({
    default: () => <span>settings</span>,
}));

vi.mock('../../../../data/fields', () => ({
    default: [
        { index: 0, name: 'Greengrass Isle', emoji: '🏝️' },
        { index: 1, name: 'Cyan Beach', emoji: '🏖️' },
    ],
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string, options?: Record<string, unknown>) => {
            if (!defaultValue) {
                return _key;
            }
            return defaultValue.replace('{{count}}', String(options?.count ?? ''));
        },
    }),
}));

function renderControls(overrides?: Partial<React.ComponentProps<typeof SimulationControls>>) {
    const props: React.ComponentProps<typeof SimulationControls> = {
        fieldIndex: 0,
        isGoodCampTicketSet: false,
        cookingSimEnabled: false,
        cookingCategory: 'curry',
        eventName: 'none',
        seedMode: 'random',
        seed: 123,
        simulationDays: 1,
        multiTrialCount: 100,
        simulationLoading: false,
        simulationProgress: 0,
        isTeamEmpty: false,
        onFieldIndexChange: vi.fn(),
        onGoodCampTicketChange: vi.fn(),
        onCookingSimEnabledChange: vi.fn(),
        onCookingCategoryChange: vi.fn(),
        onOpenSettingsTab: vi.fn(),
        onSeedModeChange: vi.fn(),
        onSeedChange: vi.fn(),
        onSimulationDaysChange: vi.fn(),
        onTrialCountChange: vi.fn(),
        onRunSimulation: vi.fn(),
        ...overrides,
    };

    const view = render(<SimulationControls {...props} />);
    return { ...view, props };
}

describe('SimulationControls', () => {
    it('disables cooking category select when cooking simulation is off', () => {
        const { rerender } = renderControls({ cookingSimEnabled: false });
        expect((screen.getByTestId('cooking-category-select') as HTMLSelectElement).disabled).toBe(true);

        rerender(
            <SimulationControls
                fieldIndex={0}
                isGoodCampTicketSet={false}
                cookingSimEnabled
                cookingCategory="curry"
                eventName="none"
                seedMode="random"
                seed={123}
                simulationDays={1}
                multiTrialCount={100}
                simulationLoading={false}
                simulationProgress={0}
                isTeamEmpty={false}
                onFieldIndexChange={vi.fn()}
                onGoodCampTicketChange={vi.fn()}
                onCookingSimEnabledChange={vi.fn()}
                onCookingCategoryChange={vi.fn()}
                onOpenSettingsTab={vi.fn()}
                onSeedModeChange={vi.fn()}
                onSeedChange={vi.fn()}
                onSimulationDaysChange={vi.fn()}
                onTrialCountChange={vi.fn()}
                onRunSimulation={vi.fn()}
            />
        );
        expect((screen.getByTestId('cooking-category-select') as HTMLSelectElement).disabled).toBe(false);
    });

    it('updates field/camp/cooking settings and opens settings tab', () => {
        const { props } = renderControls({ cookingSimEnabled: true });

        fireEvent.change(screen.getByTestId('field-select'), { target: { value: '1' } });
        fireEvent.click(screen.getByLabelText('キャンプチケット'));
        fireEvent.click(screen.getByLabelText('料理'));
        fireEvent.change(screen.getByTestId('cooking-category-select'), { target: { value: 'salad' } });
        fireEvent.click(screen.getByTestId('event-settings-button'));

        expect(props.onFieldIndexChange).toHaveBeenCalledWith(1);
        expect(props.onGoodCampTicketChange).toHaveBeenCalledWith(true);
        expect(props.onCookingSimEnabledChange).toHaveBeenCalledWith(false);
        expect(props.onCookingCategoryChange).toHaveBeenCalledWith('salad');
        expect(props.onOpenSettingsTab).toHaveBeenCalledTimes(1);
    });

    it('toggles seed mode to fixed', () => {
        const { props } = renderControls();

        fireEvent.click(screen.getByLabelText('seed-checkbox'));

        expect(props.onSeedModeChange).toHaveBeenCalledWith('fixed');
    });

    it('updates seed, period, and trial count', () => {
        const { props } = renderControls();

        fireEvent.change(screen.getByLabelText('seed-input'), { target: { value: '999' } });
        fireEvent.change(screen.getByTestId('simulation-days-select'), { target: { value: '3' } });
        fireEvent.change(screen.getByTestId('trial-count-select'), { target: { value: '1000' } });

        expect(props.onSeedChange).toHaveBeenCalledWith(999);
        expect(props.onSimulationDaysChange).toHaveBeenCalledWith(3);
        expect(props.onTrialCountChange).toHaveBeenCalledWith(1000);
    });

    it('keeps run button enabled while loading and disables only when team is empty', () => {
        const { rerender } = render(
            <SimulationControls
                fieldIndex={0}
                isGoodCampTicketSet={false}
                cookingSimEnabled={false}
                cookingCategory="curry"
                eventName="none"
                seedMode="random"
                seed={123}
                simulationDays={1}
                multiTrialCount={100}
                simulationLoading={false}
                simulationProgress={0}
                isTeamEmpty={false}
                onFieldIndexChange={vi.fn()}
                onGoodCampTicketChange={vi.fn()}
                onCookingSimEnabledChange={vi.fn()}
                onCookingCategoryChange={vi.fn()}
                onOpenSettingsTab={vi.fn()}
                onSeedModeChange={vi.fn()}
                onSeedChange={vi.fn()}
                onSimulationDaysChange={vi.fn()}
                onTrialCountChange={vi.fn()}
                onRunSimulation={vi.fn()}
            />
        );

        expect((screen.getByRole('button', { name: 'シミュレーション' }) as HTMLButtonElement).disabled).toBe(false);

        rerender(
            <SimulationControls
                fieldIndex={0}
                isGoodCampTicketSet={false}
                cookingSimEnabled={false}
                cookingCategory="curry"
                eventName="none"
                seedMode="random"
                seed={123}
                simulationDays={1}
                multiTrialCount={100}
                simulationLoading
                simulationProgress={40}
                isTeamEmpty={false}
                onFieldIndexChange={vi.fn()}
                onGoodCampTicketChange={vi.fn()}
                onCookingSimEnabledChange={vi.fn()}
                onCookingCategoryChange={vi.fn()}
                onOpenSettingsTab={vi.fn()}
                onSeedModeChange={vi.fn()}
                onSeedChange={vi.fn()}
                onSimulationDaysChange={vi.fn()}
                onTrialCountChange={vi.fn()}
                onRunSimulation={vi.fn()}
            />
        );
        expect((screen.getByRole('button', { name: 'シミュレーション' }) as HTMLButtonElement).disabled).toBe(false);

        rerender(
            <SimulationControls
                fieldIndex={0}
                isGoodCampTicketSet={false}
                cookingSimEnabled={false}
                cookingCategory="curry"
                eventName="none"
                seedMode="random"
                seed={123}
                simulationDays={1}
                multiTrialCount={100}
                simulationLoading={false}
                simulationProgress={100}
                isTeamEmpty
                onFieldIndexChange={vi.fn()}
                onGoodCampTicketChange={vi.fn()}
                onCookingSimEnabledChange={vi.fn()}
                onCookingCategoryChange={vi.fn()}
                onOpenSettingsTab={vi.fn()}
                onSeedModeChange={vi.fn()}
                onSeedChange={vi.fn()}
                onSimulationDaysChange={vi.fn()}
                onTrialCountChange={vi.fn()}
                onRunSimulation={vi.fn()}
            />
        );
        expect((screen.getByRole('button', { name: 'シミュレーション' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('passes progress value to run button while loading', () => {
        renderControls({
            simulationLoading: true,
            simulationProgress: 65,
        });

        expect(screen.getByRole('button', { name: 'シミュレーション' }).getAttribute('aria-valuenow')).toBe('65');
    });

    it('uses lighter progress track color while loading', () => {
        renderControls({
            simulationLoading: true,
            simulationProgress: 40,
        });

        expect(screen.getByRole('button', { name: 'シミュレーション' }).getAttribute('data-sx')).toContain('"background":"#94bffc"');
    });
});
