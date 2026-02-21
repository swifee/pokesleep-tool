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
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
    onFocus?: React.FocusEventHandler<HTMLElement>;
    onBlur?: React.FocusEventHandler<HTMLElement>;
    disabled?: boolean;
    type?: string;
    id?: string;
    sx?: unknown;
    ['aria-label']?: string;
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

interface TooltipProps extends ChildrenProps {
    title?: React.ReactNode;
    open?: boolean;
}

vi.mock('@mui/icons-material/ExpandMore', () => ({
    default: () => <span>expand</span>,
}));

vi.mock('@mui/icons-material/HelpOutline', () => ({
    default: () => <span>?</span>,
}));

vi.mock('@mui/material', async () => {
    const { useState } = await import('react');
    return {
        Box: ({ children }: ChildrenProps) => <div>{children}</div>,
        Typography: ({ children }: ChildrenProps) => <span>{children}</span>,
        Button: ({ children, onClick, onMouseEnter, onMouseLeave, onFocus, onBlur, disabled, sx }: ButtonLikeProps) => (
            <button
                type="button"
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onFocus={onFocus}
                onBlur={onBlur}
                disabled={disabled}
                data-sx={sx ? JSON.stringify(sx) : undefined}
            >
                {children}
            </button>
        ),
        IconButton: ({
            children,
            onClick,
            onMouseEnter,
            onMouseLeave,
            onFocus,
            onBlur,
            disabled,
            sx,
            'aria-label': ariaLabel,
        }: ButtonLikeProps) => (
            <button
                type="button"
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onFocus={onFocus}
                onBlur={onBlur}
                disabled={disabled}
                aria-label={ariaLabel}
                data-sx={sx ? JSON.stringify(sx) : undefined}
            >
                {children}
            </button>
        ),
        Tooltip: ({ children, title, open }: TooltipProps) => {
            const content = typeof title === 'string' ? title : '';
            return (
                <span>
                    {children}
                    {open && <span role="tooltip">{content}</span>}
                </span>
            );
        },
        ClickAwayListener: ({ children, ...rest }: ChildrenProps & Record<string, unknown>) => {
            if (!React.isValidElement(children)) {
                return <>{children}</>;
            }
            return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, rest);
        },
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
        contributionActiveMinutesByPokemonId: new Map([
            [member1.id, 1440],
            [member2.id, 1440],
        ]),
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
        energySkillTeamResult: null,
        energySkillTeamLoading: false,
        energySkillTeamProgress: 0,
        onRunEnergySkill: vi.fn(),
        onRunEnergySkillAll: vi.fn(),
        onRunEnergySkillTeam: vi.fn(),
        hasHelpingBonusMember: true,
        helpingBonusResult: null,
        helpingBonusLoading: false,
        helpingBonusProgress: 0,
        onRunHelpingBonus: vi.fn(),
        averageHelpingBonusMemberCount: 2.4,
        hasConfiguredSwap: true,
        averageEnergyRecoveryBonusMemberCount: 1.8,
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
        expect(screen.queryByText('おてつだいボーナス貢献度')).not.toBeNull();
        expect(screen.queryByText('げんき回復ボーナス貢献度')).not.toBeNull();
    });

    it('toggles quick mode switch', () => {
        const { props } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        fireEvent.click(screen.getByLabelText('quick-mode-switch'));
        expect(props.onQuickModeChange).toHaveBeenCalledWith(false);
    });

    it('runs section-level callbacks from buttons', () => {
        const { props } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        fireEvent.click(screen.getAllByRole('button', { name: '一括計算' })[0]);
        fireEvent.click(screen.getAllByRole('button', { name: '一括計算' })[1]);
        const runButtons = screen.getAllByRole('button', { name: '計算' });
        fireEvent.click(runButtons[0]);
        fireEvent.click(runButtons[1]);

        expect(props.onRunContributionAll).toHaveBeenCalledTimes(1);
        expect(props.onRunEnergySkillAll).toHaveBeenCalledTimes(1);
        expect(props.onRunHelpingBonus).toHaveBeenCalledTimes(1);
        expect(props.onRunEnergyRecoveryBonus).toHaveBeenCalledTimes(1);
    });

    it('does not show energy skill team overall button', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));
        expect(screen.queryByRole('button', { name: 'チーム全体' })).toBeNull();
    });

    it('does not show energy skill team overall metric row even when result exists', () => {
        renderPanel({
            energySkillTeamResult: {
                baseTeamEP: 2000,
                scenarioTeamEP: 1500,
                teamDeltaEP: -500,
                teamDeltaPercent: -25,
            },
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));
        expect(document.body.textContent ?? '').not.toContain('チーム: 500 EP (25%)');
    });

    it('shows help tooltip on hover for each section title', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        fireEvent.mouseEnter(screen.getByRole('button', { name: '貢献EPの説明を表示' }));
        expect(screen.getByRole('tooltip').textContent).toContain('スキルやサブスキルも含めた、メンバーの貢献度合いを計算します。');
    });

    it('toggles help tooltip by tapping icon button', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const helpButton = screen.getByRole('button', { name: '貢献EPの説明を表示' });
        fireEvent.click(helpButton);
        expect(screen.queryByRole('tooltip')).not.toBeNull();

        fireEvent.click(helpButton);
        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('uses fixed width for energy skill run-all button', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const runAllButtons = screen.getAllByRole('button', { name: '一括計算' });
        expect(runAllButtons[1].getAttribute('data-sx')).toContain('"width":"110px"');
    });

    it('renders energy skill rows as text', () => {
        const { member1 } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect(screen.queryByRole('button', { name: member1.iv.pokemonName })).toBeNull();
        const content = document.body.textContent ?? '';
        expect(content).toContain(member1.iv.pokemonName);
        expect(content).toContain(member1.iv.pokemon.skill);
    });

    it('renders contribution rows as text', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect(document.body.textContent ?? '').toContain('pokemons.Rattata');
        expect(screen.queryByRole('button', { name: 'pokemons.Rattata' })).toBeNull();
    });

    it('keeps contribution run-all button enabled while loading', () => {
        const member1 = createPokemonBySkill('Charge Energy S');
        renderPanel({
            contributionMembers: [member1],
            contributionBatchLoading: true,
            contributionProgressById: new Map([[member1.id, 45]]),
            energySkillTargets: [],
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const runAllButtons = screen.getAllByRole('button', { name: '一括計算' });
        expect((runAllButtons[0] as HTMLButtonElement).disabled).toBe(false);
    });

    it('keeps buttons enabled while loading so users can cancel', () => {
        const member1 = createPokemonBySkill('Charge Energy S');
        const member2 = createPokemonBySkill('Energy for Everyone S');
        renderPanel({
            contributionBatchLoading: true,
            contributionLoadingIds: new Set([member1.id]),
            energySkillBatchLoading: true,
            energySkillLoadingIds: new Set([member2.id]),
            helpingBonusLoading: true,
            hasHelpingBonusMember: true,
            energyRecoveryBonusLoading: true,
            hasEnergyRecoveryBonusMember: true,
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const runAllButtons = screen.getAllByRole('button', { name: '一括計算' });
        const runButtons = screen.getAllByRole('button', { name: '計算' });
        expect((runAllButtons[0] as HTMLButtonElement).disabled).toBe(false);
        expect((runAllButtons[1] as HTMLButtonElement).disabled).toBe(false);
        expect((runButtons[0] as HTMLButtonElement).disabled).toBe(false);
        expect((runButtons[1] as HTMLButtonElement).disabled).toBe(false);
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
            contributionActiveMinutesByPokemonId: new Map([
                [member1.id, 1440],
                [member2.id, 2880],
            ]),
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

        const content = document.body.textContent ?? '';
        expect(content).toContain('6H');
        expect(content).toContain('100EP (20%)');
        expect(content).toContain('24H換算 400EP');
        expect(content).toContain('自身: 50 EP (25%)');
        expect(content).toContain('チーム: 100 EP (20%)');
    });

    it('shows 24H converted EP without percent', () => {
        const member1 = createPokemonBySkill('Charge Energy S');
        const member2 = createPokemonBySkill('Energy for Everyone S');
        renderPanel({
            contributionMembers: [member1, member2],
            contributionActiveMinutesByPokemonId: new Map([
                [member1.id, 360],
                [member2.id, 720],
            ]),
            contributionResults: new Map([
                [member1.id, {
                    pokemonId: member1.id,
                    pokemonName: member1.iv.pokemonName,
                    baseTeamEP: 5000,
                    scenarioTeamEP: 4700,
                    deltaEP: -300,
                    deltaPercent: -6,
                }],
                [member2.id, {
                    pokemonId: member2.id,
                    pokemonName: member2.iv.pokemonName,
                    baseTeamEP: 5000,
                    scenarioTeamEP: 4900,
                    deltaEP: -100,
                    deltaPercent: -2,
                }],
            ]),
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const content = document.body.textContent ?? '';
        expect(content).toContain('6H');
        expect(content).toContain('300EP (6%)');
        expect(content).toContain('24H換算 1,200EP');
        expect(content).not.toContain(', 24H換算');
        expect(content).toContain('12H');
        expect(content).toContain('100EP (2%)');
        expect(content).toContain('24H換算 200EP');
    });

    it('hides 24h conversion block when active minutes are zero', () => {
        const member1 = createPokemonBySkill('Charge Energy S');
        const member2 = createPokemonBySkill('Energy for Everyone S');
        renderPanel({
            contributionMembers: [member1, member2],
            contributionActiveMinutesByPokemonId: new Map([
                [member1.id, 0],
                [member2.id, 720],
            ]),
            contributionResults: new Map([
                [member1.id, {
                    pokemonId: member1.id,
                    pokemonName: member1.iv.pokemonName,
                    baseTeamEP: 4000,
                    scenarioTeamEP: 3600,
                    deltaEP: -400,
                    deltaPercent: -10,
                }],
            ]),
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const content = document.body.textContent ?? '';
        expect(content).toContain('0H');
        expect(content).toContain('400EP (10%)');
        expect(content).not.toContain('24H換算');
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

        expect(document.body.textContent ?? '').toContain('Energy for Everyone S');
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

        const runButtons = screen.getAllByRole('button', { name: '計算' });
        expect((runButtons[1] as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('げんき回復ボーナスを持つメンバーがいません')).toBeDefined();
    });

    it('disables helping bonus button when no target exists', () => {
        renderPanel({
            hasHelpingBonusMember: false,
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        const runButtons = screen.getAllByRole('button', { name: '計算' });
        expect((runButtons[0] as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('おてつだいボーナスを持つメンバーがいません')).toBeDefined();
    });

    it('shows average team member count when swap is configured', () => {
        renderPanel({
            averageHelpingBonusMemberCount: 3.375,
            averageEnergyRecoveryBonusMemberCount: 1.125,
            hasConfiguredSwap: true,
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect(screen.getByText('平均編成数: 3.4体')).toBeDefined();
        expect(screen.getByText('起床時編成数: 1.1体')).toBeDefined();
    });

    it('shows member count and omits .0 when swap is not configured', () => {
        renderPanel({
            averageHelpingBonusMemberCount: 2,
            averageEnergyRecoveryBonusMemberCount: 1,
            hasConfiguredSwap: false,
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect(screen.getByText('編成数: 2体')).toBeDefined();
        expect(screen.getByText('起床時編成数: 1体')).toBeDefined();
    });

    it('shows ERB contribution metric', () => {
        renderPanel({
            energyRecoveryBonusResult: {
                baseTeamEP: 158400,
                scenarioTeamEP: 102807,
                teamDeltaEP: -55593,
                teamDeltaPercent: -35.09659090909091,
                wakeErbMemberCountMin: 0,
                wakeErbMemberCountMax: 2,
                wakeSlotCount: 2,
            },
        });
        fireEvent.click(screen.getByRole('button', { name: '追加分析' }));

        expect(document.body.textContent ?? '').toContain('55,593 EP (35.1%)');
    });
});
