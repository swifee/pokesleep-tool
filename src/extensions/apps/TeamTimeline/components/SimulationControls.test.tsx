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
    ['aria-valuenow']?: number;
    ['aria-valuemin']?: number;
    ['aria-valuemax']?: number;
}

interface CheckboxProps {
    checked?: boolean;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    disabled?: boolean;
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
}

interface MenuItemProps extends ChildrenProps {
    value?: string | number;
}

vi.mock('@mui/material', () => ({
    Box: ({ children }: ChildrenProps) => <div>{children}</div>,
    Typography: ({ children }: ChildrenProps) => <span>{children}</span>,
    Button: ({ children, onClick, disabled, ...rest }: ButtonProps) => (
        <button type="button" onClick={onClick} disabled={disabled} {...rest}>{children}</button>
    ),
    Checkbox: ({ checked, onChange, disabled }: CheckboxProps) => (
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} aria-label="seed-checkbox" />
    ),
    FormControlLabel: ({ control, label }: FormControlLabelProps) => (
        <label>{control}{label}</label>
    ),
    TextField: ({ type, value, onChange, disabled }: TextFieldProps) => (
        <input type={type ?? 'text'} value={value} onChange={onChange} disabled={disabled} aria-label="seed-input" />
    ),
    Select: ({ value, onChange, children }: SelectProps) => (
        <select value={value} onChange={onChange}>{children}</select>
    ),
    MenuItem: ({ value, children }: MenuItemProps) => (
        <option value={value}>{children}</option>
    ),
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
        seedMode: 'random',
        seed: 123,
        simulationDays: 1,
        multiTrialCount: 100,
        simulationLoading: false,
        simulationProgress: 0,
        isTeamEmpty: false,
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
    it('toggles seed mode to fixed', () => {
        const { props } = renderControls();

        fireEvent.click(screen.getByLabelText('seed-checkbox'));

        expect(props.onSeedModeChange).toHaveBeenCalledWith('fixed');
    });

    it('updates seed, period, and trial count', () => {
        const { props } = renderControls();

        fireEvent.change(screen.getByLabelText('seed-input'), { target: { value: '999' } });

        const selects = screen.getAllByRole('combobox');
        fireEvent.change(selects[0], { target: { value: '3' } });
        fireEvent.change(selects[1], { target: { value: '1000' } });

        expect(props.onSeedChange).toHaveBeenCalledWith(999);
        expect(props.onSimulationDaysChange).toHaveBeenCalledWith(3);
        expect(props.onTrialCountChange).toHaveBeenCalledWith(1000);
    });

    it('keeps run button enabled while loading and disables only when team is empty', () => {
        const { rerender } = render(
            <SimulationControls
                seedMode="random"
                seed={123}
                simulationDays={1}
                multiTrialCount={100}
                simulationLoading={false}
                simulationProgress={0}
                isTeamEmpty={false}
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
                seedMode="random"
                seed={123}
                simulationDays={1}
                multiTrialCount={100}
                simulationLoading
                simulationProgress={40}
                isTeamEmpty={false}
                onSeedModeChange={vi.fn()}
                onSeedChange={vi.fn()}
                onSimulationDaysChange={vi.fn()}
                onTrialCountChange={vi.fn()}
                onRunSimulation={vi.fn()}
            />
        );
        expect((screen.getByRole('button', { name: '計算中...' }) as HTMLButtonElement).disabled).toBe(false);

        rerender(
            <SimulationControls
                seedMode="random"
                seed={123}
                simulationDays={1}
                multiTrialCount={100}
                simulationLoading={false}
                simulationProgress={100}
                isTeamEmpty
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

        expect(screen.getByRole('button', { name: '計算中...' }).getAttribute('aria-valuenow')).toBe('65');
    });
});
