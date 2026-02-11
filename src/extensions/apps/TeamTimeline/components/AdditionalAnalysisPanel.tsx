import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    FormControlLabel,
    Switch,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PokemonBoxItem } from '../../../../util/PokemonBox';
import {
    ContributionEpAnalysisResult,
    EnergyRecoveryBonusContributionResult,
    EnergySkillContributionResult,
    EnergySkillContributionTarget,
} from '../types/AdditionalAnalysisTypes';
import { formatSignedPercent } from '../utils/AdditionalAnalysisUtils';
import {
    resolveSummaryValueMode,
    SummaryValueMode,
    toSummaryModeValue,
} from '../utils/SummaryValueModeUtils';

interface AdditionalAnalysisPanelProps {
    quickModeEnabled: boolean;
    onQuickModeChange: (enabled: boolean) => void;
    simulationDays: number;
    valueMode: SummaryValueMode;
    contributionMembers: readonly PokemonBoxItem[];
    contributionResults: ReadonlyMap<number, ContributionEpAnalysisResult>;
    contributionLoadingIds: ReadonlySet<number>;
    contributionBatchLoading: boolean;
    contributionBatchProgress: number;
    contributionProgressById: ReadonlyMap<number, number>;
    onRunContribution: (pokemon: PokemonBoxItem) => void;
    onRunContributionAll: () => void;
    energySkillTargets: readonly EnergySkillContributionTarget[];
    energySkillResults: ReadonlyMap<number, EnergySkillContributionResult>;
    energySkillLoadingIds: ReadonlySet<number>;
    energySkillBatchLoading: boolean;
    energySkillBatchProgress: number;
    energySkillProgressById: ReadonlyMap<number, number>;
    onRunEnergySkill: (target: EnergySkillContributionTarget) => void;
    onRunEnergySkillAll: () => void;
    hasEnergyRecoveryBonusMember: boolean;
    energyRecoveryBonusResult: EnergyRecoveryBonusContributionResult | null;
    energyRecoveryBonusLoading: boolean;
    energyRecoveryBonusProgress: number;
    onRunEnergyRecoveryBonus: () => void;
    errorMessage?: string | null;
}

function formatContributionNumber(value: number): string {
    const rounded = Math.round(value);
    const sign = rounded < 0 ? '-' : '';
    return `${sign}${Math.abs(rounded).toLocaleString()}`;
}

function formatContributionPercent(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
        return '-';
    }
    const abs = Math.abs(value);
    const fixed = abs >= 100 ? abs.toFixed(0) : abs.toFixed(1);
    const normalized = fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
    return `${value < 0 ? '-' : ''}${normalized}%`;
}

function formatContributionMetric(
    deltaEP: number,
    deltaPercent: number | null,
    valueMode: SummaryValueMode,
    simulationDays: number,
): string {
    const reversedDeltaEP = -deltaEP;
    const reversedDeltaPercent = deltaPercent === null ? null : -deltaPercent;
    const modeAdjustedDeltaEP = toSummaryModeValue(reversedDeltaEP, valueMode, simulationDays);
    return `${formatContributionNumber(modeAdjustedDeltaEP)} EP (${formatContributionPercent(reversedDeltaPercent)})`;
}

function formatEnergySkillDisplayName(skillLabel: string): string {
    // Hide derived/base skill suffix such as "(Charge Energy S)".
    return skillLabel
        .replace(/\s*[(\uff08][^()\uff08\uff09]*[)\uff09]\s*$/, '')
        .trim();
}

function actionButtonSx(loading: boolean, outlined: boolean, progress: number, keepFilledWhenCompleted = false) {
    const idleWidth = outlined ? '0%' : '100%';
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const shouldAnimateProgress = loading && clampedProgress > 1;
    const showFilled = loading || keepFilledWhenCompleted;
    const displayWidth = showFilled ? `${clampedProgress}%` : idleWidth;
    return {
        minWidth: '110px',
        justifyContent: 'center',
        borderRadius: '6px',
        fontSize: '12px',
        lineHeight: '15px',
        fontWeight: 700,
        px: '10px',
        py: '2px',
        minHeight: '28px',
        color: showFilled || !outlined ? '#fff' : '#1976d2',
        borderColor: outlined ? '#7cb2f8' : 'transparent',
        background: outlined ? '#fff' : '#3c8af8',
        position: 'relative',
        overflow: 'hidden',
        transition: 'none',
        '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: displayWidth,
            background: 'linear-gradient(180deg, #4e8ce8 0%, #176eee 100%)',
            transition: shouldAnimateProgress ? 'width 140ms linear' : 'none',
            opacity: outlined && !showFilled ? 0 : 1,
            zIndex: 0,
        },
        '& .button-label': {
            position: 'relative',
            zIndex: 1,
            whiteSpace: 'nowrap',
        },
        '&:hover': {
            borderColor: outlined ? '#4e8ce8' : 'transparent',
            background: outlined ? '#f5f9ff' : '#3c8af8',
        },
        '&.Mui-disabled': {
            color: '#8893a3',
            background: '#e3e7ee',
            borderColor: '#c7ceda',
            opacity: 1,
        },
        '&.Mui-disabled::before': {
            width: '0%',
            opacity: 0,
        },
    };
}

function ResultCell({ children }: { children?: React.ReactNode }) {
    return (
        <Box
            sx={{
                minHeight: '28px',
                display: 'flex',
                alignItems: 'center',
                px: '8px',
                width: '100%',
            }}
        >
            {children}
        </Box>
    );
}

const AdditionalAnalysisPanel = React.memo(({
    quickModeEnabled,
    onQuickModeChange,
    simulationDays,
    valueMode,
    contributionMembers,
    contributionResults,
    contributionLoadingIds,
    contributionBatchLoading,
    contributionBatchProgress,
    contributionProgressById,
    onRunContribution,
    onRunContributionAll,
    energySkillTargets,
    energySkillResults,
    energySkillLoadingIds,
    energySkillBatchLoading,
    energySkillBatchProgress,
    energySkillProgressById,
    onRunEnergySkill,
    onRunEnergySkillAll,
    hasEnergyRecoveryBonusMember,
    energyRecoveryBonusResult,
    energyRecoveryBonusLoading,
    energyRecoveryBonusProgress,
    onRunEnergyRecoveryBonus,
    errorMessage,
}: AdditionalAnalysisPanelProps) => {
    const { t } = useTranslation();
    const resolvedValueMode = resolveSummaryValueMode(valueMode, simulationDays);
    const energySkillDisplayRows = React.useMemo(() => (
        energySkillTargets.map((target) => {
            const result = energySkillResults.get(target.pokemonId);
            const skillLabel = formatEnergySkillDisplayName(
                t(`skills.${target.skillName}`, target.skillName)
            );
            const showSelf = result ? result.category !== 'nightmare' : true;
            const showTeam = result ? result.category !== 'self' : true;
            const selfMetric = result && showSelf
                ? `${t('TeamTimeline.analysis self label', '自身')}: ${formatContributionMetric(
                    result.selfDeltaEP,
                    result.selfDeltaPercent,
                    resolvedValueMode,
                    simulationDays
                )}`
                : '';
            const teamMetric = result && showTeam
                ? `${t('TeamTimeline.analysis team label', 'チーム')}: ${formatContributionMetric(
                    result.teamDeltaEP,
                    result.teamDeltaPercent,
                    resolvedValueMode,
                    simulationDays
                )}`
                : '';
            return {
                target,
                result,
                skillLabel,
                selfMetric,
                teamMetric,
            };
        })
    ), [energySkillTargets, energySkillResults, t, resolvedValueMode, simulationDays]);

    return (
        <Box sx={{ mt: '18px' }} data-testid="additional-analysis-panel">
            <Accordion defaultExpanded={false}>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="additional-analysis-content"
                    id="additional-analysis-header"
                >
                    <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>
                        {t('TeamTimeline.additional analysis', '追加分析')}
                    </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <Box sx={{ mb: '2px' }}>
                        <FormControlLabel
                            control={(
                                <Switch
                                    size="small"
                                    checked={quickModeEnabled}
                                    onChange={(_, checked) => onQuickModeChange(checked)}
                                />
                            )}
                            label={t('TeamTimeline.analysis quick mode', '高速簡易計算')}
                            sx={{
                                m: 0,
                                alignItems: 'center',
                                '& .MuiFormControlLabel-label': {
                                    fontSize: '11px',
                                    lineHeight: '14px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                },
                            }}
                        />
                    </Box>

                    <Box>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, mb: '6px' }}>
                            {t('TeamTimeline.analysis contribution ep', '貢献EP')}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '8px', alignItems: 'center' }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={contributionMembers.length === 0}
                                    onClick={onRunContributionAll}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={contributionBatchLoading ? contributionBatchProgress : undefined}
                                    sx={actionButtonSx(contributionBatchLoading, false, contributionBatchProgress)}
                                >
                                    <span className="button-label">
                                        {t('TeamTimeline.analysis run all', '一括計算')}
                                    </span>
                                </Button>
                                <ResultCell />
                            </Box>
                            {contributionMembers.map((member) => {
                                const result = contributionResults.get(member.id);
                                const progress = contributionProgressById.get(member.id) ?? 0;
                                const isBatchItemLoading = contributionBatchLoading && progress > 0 && progress < 100;
                                const keepFilledWhenCompleted = contributionBatchLoading && progress >= 100;
                                const isLoading = contributionLoadingIds.has(member.id) || isBatchItemLoading;
                                return (
                                    <Box
                                        key={`contribution-row-${member.id}`}
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: 'auto 1fr',
                                            columnGap: '8px',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => onRunContribution(member)}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={isLoading ? progress : undefined}
                                            sx={actionButtonSx(isLoading, true, progress, keepFilledWhenCompleted)}
                                        >
                                            <span className="button-label">
                                                {member.filledNickname(t)}
                                            </span>
                                        </Button>
                                        <ResultCell>
                                            {result && (
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {formatContributionMetric(
                                                        result.deltaEP,
                                                        result.deltaPercent,
                                                        resolvedValueMode,
                                                        simulationDays
                                                    )}
                                                </Typography>
                                            )}
                                        </ResultCell>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>

                    <Box>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, mb: '6px' }}>
                            {t('TeamTimeline.analysis energy skill', 'げんき変動スキル貢献度')}
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    md: 'max-content max-content max-content max-content',
                                },
                                columnGap: '8px',
                                rowGap: '4px',
                                alignItems: 'center',
                            }}
                        >
                            <Button
                                variant="contained"
                                size="small"
                                disabled={energySkillTargets.length === 0}
                                onClick={onRunEnergySkillAll}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={energySkillBatchLoading ? energySkillBatchProgress : undefined}
                                sx={actionButtonSx(energySkillBatchLoading, false, energySkillBatchProgress)}
                            >
                                <span className="button-label">
                                    {t('TeamTimeline.analysis run all', '一括計算')}
                                </span>
                            </Button>
                            <Box
                                sx={{
                                    minHeight: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    px: '8px',
                                    width: '100%',
                                    gridColumn: { xs: '1', md: '2 / span 3' },
                                }}
                            >
                                {energySkillTargets.length === 0 && (
                                    <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                        {t(
                                            'TeamTimeline.analysis no energy skill target',
                                            'げんき変動スキルを持つメンバーがいません'
                                        )}
                                    </Typography>
                                )}
                            </Box>
                            {energySkillDisplayRows.map((row) => {
                                const { target, result, skillLabel, selfMetric, teamMetric } = row;
                                const progress = energySkillProgressById.get(target.pokemonId) ?? 0;
                                const isBatchItemLoading = energySkillBatchLoading && progress > 0 && progress < 100;
                                const keepFilledWhenCompleted = energySkillBatchLoading && progress >= 100;
                                const isLoading = energySkillLoadingIds.has(target.pokemonId) || isBatchItemLoading;
                                return (
                                    <React.Fragment key={`energy-row-${target.pokemonId}`}>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => onRunEnergySkill(target)}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={isLoading ? progress : undefined}
                                            sx={actionButtonSx(isLoading, true, progress, keepFilledWhenCompleted)}
                                        >
                                            <span className="button-label">
                                                {target.pokemonName}
                                            </span>
                                        </Button>
                                        {result ? (
                                            <>
                                                <Typography sx={{ fontSize: '11px', lineHeight: '14px' }}>
                                                    {skillLabel}
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {selfMetric}
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {teamMetric}
                                                </Typography>
                                            </>
                                        ) : (
                                            <>
                                                <Box />
                                                <Box />
                                                <Box />
                                            </>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </Box>
                    </Box>

                    <Box>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, mb: '6px' }}>
                            {t('TeamTimeline.analysis erb', 'げんき回復ボーナス貢献度')}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '8px', alignItems: 'center' }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={!hasEnergyRecoveryBonusMember}
                                    onClick={onRunEnergyRecoveryBonus}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={energyRecoveryBonusLoading ? energyRecoveryBonusProgress : undefined}
                                    sx={actionButtonSx(energyRecoveryBonusLoading, false, energyRecoveryBonusProgress)}
                                >
                                    <span className="button-label">
                                        {t('TeamTimeline.analysis run', '計算')}
                                    </span>
                                </Button>
                                <ResultCell>
                                    {!hasEnergyRecoveryBonusMember && (
                                        <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                            {t(
                                                'TeamTimeline.analysis no erb target',
                                                'げんき回復ボーナスを持つメンバーがいません'
                                            )}
                                        </Typography>
                                    )}
                                    {energyRecoveryBonusResult && (
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {t('TeamTimeline.analysis team change', 'チーム変動')}
                                            {' '}
                                            {formatSignedPercent(energyRecoveryBonusResult.teamDeltaPercent)}
                                        </Typography>
                                    )}
                                </ResultCell>
                            </Box>
                        </Box>
                    </Box>

                    {errorMessage && (
                        <Typography sx={{ fontSize: '12px', color: 'error.main' }}>
                            {errorMessage}
                        </Typography>
                    )}
                </AccordionDetails>
            </Accordion>
        </Box>
    );
});

AdditionalAnalysisPanel.displayName = 'AdditionalAnalysisPanel';

export default AdditionalAnalysisPanel;
