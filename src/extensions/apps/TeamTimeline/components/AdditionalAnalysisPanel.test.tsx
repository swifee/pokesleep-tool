import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PokemonIv from '../../../../util/PokemonIv';
import { PokemonBoxItem } from '../../../../util/PokemonBox';
import pokemons from '../../../../data/pokemons';
import AdditionalAnalysisPanel from './AdditionalAnalysisPanel';
import { EnergySkillContributionTarget } from '../types/AdditionalAnalysisTypes';

interface ChildrenProps {
    children?: React.ReactNode;
}

interface ButtonLikeProps extends ChildrenProps {
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    type?: string;
    id?: string;
    ['aria-controls']?: string;
}

interface SwitchProps {
    checked?: boolean;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
}

interface FormControlLabelProps {
    control?: React.ReactNode;
    label?: React.ReactNode;
}

interface AccordionProps extends ChildrenProps {
    defaultExpanded?: boolean;
}

vi.mock('@mui/icons-material/ExpandMore', () => ({
    default: () => <span>expand</span>,
}));

vi.mock('@mui/material', async () => {
    const ReactModule = await import('react');
    const { useState } = ReactModule;
    return {
        Box: ({ children }: ChildrenProps) => <div>{children}</div>,
        Typography: ({ children }: ChildrenProps) => <span>{children}</span>,
        Button: ({ children, onClick, disabled }: ButtonLikeProps) => (
            <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
        ),
        Switch: ({ checked, onChange }: SwitchProps) => (
            <input
                type="checkbox"
                aria-label="quick-mode-switch"
                checked={checked}
                onChange={(event) => onChange?.(event, event.target.checked)}
            />
        ),
        FormControlLabel: ({ control, label }: FormControlLabelProps) => (
            <label>{control}{label}</label>
        ),
        Accordion: ({ children, defaultExpanded = false }: AccordionProps) => {
            const [expanded, setExpanded] = useState(defaultExpanded);
            return (
                <div data-testid="mock-accordion" data-expanded={expanded ? 'true' : 'false'}>
                    {React.Children.map(children, (child) => {
                        if (!React.isValidElement(child)) {
                            return child;
                        }
                        return React.cloneElement(child as React.ReactElement<{ expanded?: boolean; onToggle?: () => void }>, {
                            expanded,
                            onToggle: () => setExpanded(value => !value),
                        });
                    })}
                </div>
            );
        },
        AccordionSummary: ({ children, onToggle }: ChildrenProps & { onToggle?: () => void }) => (
            <button type="button" onClick={onToggle}>{children}</button>
        ),
        AccordionDetails: ({ children, expanded }: ChildrenProps & { expanded?: boolean }) => (
            expanded ? <div>{children}</div> : null
        ),
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key,
    }),
}));

function createPokemonBySkill(skillName: string): PokemonBoxItem {
    const pokemon = pokemons.find(entry => entry.skill === skillName);
    if (!pokemon) {
        throw new Error(`Pokemon with skill ${skillName} not found`);
    }
    return new PokemonBoxItem(new PokemonIv({
        pokemonName: pokemon.name,
        skillLevel: 5,
    }));
}

function renderPanel(overrides?: Partial<React.ComponentProps<typeof AdditionalAnalysisPanel>>) {
    const member1 = createPokemonBySkill('Charge Energy S');
    const member2 = createPokemonBySkill('Energy for Everyone S');
    const energyTargets: EnergySkillContributionTarget[] = [
        {
            pokemonId: member1.id,
            pokemonName: member1.iv.pokemonName,
            skillName: member1.iv.pokemon.skill,
            category: 'self',
        },
        {
            pokemonId: member2.id,
            pokemonName: member2.iv.pokemonName,
            skillName: member2.iv.pokemon.skill,
            category: 'team',
        },
    ];

    const props: React.ComponentProps<typeof AdditionalAnalysisPanel> = {
        quickModeEnabled: true,
        onQuickModeChange: vi.fn(),
        simulationDays: 1,
        valueMode: 'periodTotal',
        contributionMembers: [member1, member2],
        contributionResults: new Map(),
        contributionLoadingIds: new Set<number>(),
        contributionBatchLoading: false,
        contributionBatchProgress: 0,
        contributionProgressById: new Map<number, number>(),
        onRunContribution: vi.fn(),
        onRunContributionAll: vi.fn(),
        energySkillTargets: energyTargets,
        energySkillResults: new Map(),
        energySkillLoadingIds: new Set<number>(),
        energySkillBatchLoading: false,
        energySkillBatchProgress: 0,
        energySkillProgressById: new Map<number, number>(),
        onRunEnergySkill: vi.fn(),
        onRunEnergySkillAll: vi.fn(),
        hasEnergyRecoveryBonusMember: true,
        energyRecoveryBonusResult: null,
        energyRecoveryBonusLoading: false,
        energyRecoveryBonusProgress: 0,
        onRunEnergyRecoveryBonus: vi.fn(),
        errorMessage: null,
        ...overrides,
    };

    render(<AdditionalAnalysisPanel {...props} />);
    return { props, member1, member2 };
}

describe('AdditionalAnalysisPanel', () => {
    it('is collapsed by default', () => {
        renderPanel();
        expect(screen.queryByText('貢献EP')).toBeNull();
    });

    it('shows sections after expanding accordion', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect((screen.getByLabelText('quick-mode-switch') as HTMLInputElement).checked).toBe(true);
        expect(screen.queryByText('高速簡易計算')).not.toBeNull();
        expect(screen.queryByText('貢献EP')).not.toBeNull();
        expect(screen.queryByText('げんき変動スキル貢献度')).not.toBeNull();
        expect(screen.queryByText('げんき回復ボーナス貢献度')).not.toBeNull();
    });

    it('toggles quick mode switch', () => {
        const { props } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        fireEvent.click(screen.getByLabelText('quick-mode-switch'));
        expect(props.onQuickModeChange).toHaveBeenCalledWith(false);
    });

    it('runs each callback from buttons', () => {
        const { props } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        fireEvent.click(screen.getAllByRole('button', { name: '一括計算' })[0]);
        const candidateButtons = screen.getAllByRole('button').filter((button) => (
            !['追加分析', '一括計算', '計算'].includes(button.textContent ?? '')
        ));
        fireEvent.click(candidateButtons[0]);
        fireEvent.click(screen.getAllByRole('button', { name: '一括計算' })[1]);
        fireEvent.click(screen.getByRole('button', { name: '計算' }));

        expect(props.onRunContributionAll).toHaveBeenCalledTimes(1);
        expect(props.onRunContribution).toHaveBeenCalledTimes(1);
        expect(props.onRunEnergySkillAll).toHaveBeenCalledTimes(1);
        expect(props.onRunEnergyRecoveryBonus).toHaveBeenCalledTimes(1);
    });

    it('keeps buttons enabled while loading so users can cancel', () => {
        const member1 = createPokemonBySkill('Charge Energy S');
        const member2 = createPokemonBySkill('Energy for Everyone S');
        renderPanel({
            contributionBatchLoading: true,
            contributionLoadingIds: new Set([member1.id]),
            energySkillBatchLoading: true,
            energySkillLoadingIds: new Set([member2.id]),
            energyRecoveryBonusLoading: true,
            hasEnergyRecoveryBonusMember: true,
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const runAllButtons = screen.getAllByRole('button', { name: '一括計算' });
        expect((runAllButtons[0] as HTMLButtonElement).disabled).toBe(false);
        expect((runAllButtons[1] as HTMLButtonElement).disabled).toBe(false);
        expect((screen.getByRole('button', { name: '計算' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('converts EP display when value mode is daily average', () => {
        const member1 = createPokemonBySkill('Charge Energy S');
        const member2 = createPokemonBySkill('Energy for Everyone S');
        const energyTargets: EnergySkillContributionTarget[] = [
            {
                pokemonId: member1.id,
                pokemonName: member1.iv.pokemonName,
                skillName: member1.iv.pokemon.skill,
                category: 'self',
            },
            {
                pokemonId: member2.id,
                pokemonName: member2.iv.pokemonName,
                skillName: member2.iv.pokemon.skill,
                category: 'team',
            },
        ];

        renderPanel({
            simulationDays: 4,
            valueMode: 'dailyAverage',
            contributionMembers: [member1, member2],
            energySkillTargets: energyTargets,
            contributionResults: new Map([
                [member1.id, {
                    pokemonId: member1.id,
                    pokemonName: member1.iv.pokemonName,
                    baseTeamEP: 2000,
                    scenarioTeamEP: 1600,
                    deltaEP: -400,
                    deltaPercent: -20,
                }],
            ]),
            energySkillResults: new Map([
                [member2.id, {
                    pokemonId: member2.id,
                    pokemonName: member2.iv.pokemonName,
                    skillName: member2.iv.pokemon.skill,
                    category: 'team',
                    baseSelfEP: 800,
                    scenarioSelfEP: 600,
                    selfDeltaEP: -200,
                    selfDeltaPercent: -25,
                    baseTeamEP: 2000,
                    scenarioTeamEP: 1600,
                    teamDeltaEP: -400,
                    teamDeltaPercent: -20,
                    baseSelfHelpCount: 100,
                    scenarioSelfHelpCount: 90,
                    baseTeamHelpCount: 500,
                    scenarioTeamHelpCount: 450,
                }],
            ]),
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect(screen.getByText('100 EP (20%)')).toBeDefined();
        expect(screen.getByText('自身: 50 EP (25%)')).toBeDefined();
        expect(screen.getByText('チーム: 100 EP (20%)')).toBeDefined();
    });

    it('renders energy skill label without derived/base suffix parentheses', () => {
        const member = createPokemonBySkill('Energy for Everyone S (Berry Juice)');
        const energyTargets: EnergySkillContributionTarget[] = [{
            pokemonId: member.id,
            pokemonName: member.iv.pokemonName,
            skillName: member.iv.pokemon.skill,
            category: 'team',
        }];

        renderPanel({
            contributionMembers: [member],
            energySkillTargets: energyTargets,
            energySkillResults: new Map([
                [member.id, {
                    pokemonId: member.id,
                    pokemonName: member.iv.pokemonName,
                    skillName: member.iv.pokemon.skill,
                    category: 'team',
                    baseSelfEP: 500,
                    scenarioSelfEP: 400,
                    selfDeltaEP: -100,
                    selfDeltaPercent: -20,
                    baseTeamEP: 1000,
                    scenarioTeamEP: 800,
                    teamDeltaEP: -200,
                    teamDeltaPercent: -20,
                    baseSelfHelpCount: 50,
                    scenarioSelfHelpCount: 40,
                    baseTeamHelpCount: 200,
                    scenarioTeamHelpCount: 160,
                }],
            ]),
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect(screen.getByText('Energy for Everyone S')).toBeDefined();
        expect(screen.queryByText('Energy for Everyone S (Berry Juice)')).toBeNull();
    });

    it('shows empty target message and disables run-all button when no energy skill target exists', () => {
        renderPanel({
            energySkillTargets: [],
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const runAllButtons = screen.getAllByRole('button', { name: '一括計算' });
        expect((runAllButtons[1] as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('げんき変動スキルを持つメンバーがいません')).toBeDefined();
    });

    it('disables energy recovery bonus button when no target exists', () => {
        renderPanel({
            hasEnergyRecoveryBonusMember: false,
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect((screen.getByRole('button', { name: '計算' }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('げんき回復ボーナスを持つメンバーがいません')).toBeDefined();
    });
});
