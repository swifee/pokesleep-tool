import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    ClickAwayListener,
    FormControlLabel,
    IconButton,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PokemonBoxItem } from '../../../../util/PokemonBox';
import {
    ContributionEpAnalysisResult,
    EnergyRecoveryBonusContributionResult,
    HelpingBonusContributionResult,
    EnergySkillContributionResult,
    EnergySkillTeamContributionResult,
    EnergySkillContributionTarget,
} from '../types/AdditionalAnalysisTypes';
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
    energySkillTeamResult: EnergySkillTeamContributionResult | null;
    energySkillTeamLoading: boolean;
    energySkillTeamProgress: number;
    onRunEnergySkill: (target: EnergySkillContributionTarget) => void;
    onRunEnergySkillAll: () => void;
    onRunEnergySkillTeam: () => void;
    hasHelpingBonusMember: boolean;
    helpingBonusResult: HelpingBonusContributionResult | null;
    helpingBonusLoading: boolean;
    helpingBonusProgress: number;
    onRunHelpingBonus: () => void;
    averageHelpingBonusMemberCount: number;
    hasConfiguredSwap: boolean;
    averageEnergyRecoveryBonusMemberCount: number;
    hasEnergyRecoveryBonusMember: boolean;
    energyRecoveryBonusResult: EnergyRecoveryBonusContributionResult | null;
    energyRecoveryBonusLoading: boolean;
    energyRecoveryBonusProgress: number;
    onRunEnergyRecoveryBonus: () => void;
    errorMessage?: string | null;
}

const PROGRESS_TRACK_BACKGROUND = '#94bffc';

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

function formatAverageTeamMemberCountText(value: number): string {
    const normalized = Number.isFinite(value) ? value : 0;
    const rounded = Math.round(normalized * 10) / 10;
    const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
    return `${formatted}体`;
}

function actionButtonSx(loading: boolean, outlined: boolean, progress: number, keepFilledWhenCompleted = false) {
    const idleWidth = outlined ? '0%' : '100%';
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const shouldAnimateProgress = loading && clampedProgress > 1;
    const showFilled = loading || keepFilledWhenCompleted;
    const displayWidth = showFilled ? `${clampedProgress}%` : idleWidth;
    const baseBackground = showFilled ? PROGRESS_TRACK_BACKGROUND : (outlined ? '#fff' : '#3c8af8');
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
        background: baseBackground,
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
            background: showFilled ? PROGRESS_TRACK_BACKGROUND : (outlined ? '#f5f9ff' : '#3c8af8'),
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

function fixedActionButtonSx(
    loading: boolean,
    outlined: boolean,
    progress: number,
    keepFilledWhenCompleted = false
) {
    return {
        ...actionButtonSx(loading, outlined, progress, keepFilledWhenCompleted),
        width: '110px',
        minWidth: '110px',
        maxWidth: '110px',
        alignSelf: 'start',
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

interface AnalysisSectionTitleProps {
    title: string;
    description: string;
    helpAriaLabel: string;
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
    onToggle: () => void;
}

function AnalysisSectionTitle({
    title,
    description,
    helpAriaLabel,
    open,
    onOpen,
    onClose,
    onToggle,
}: AnalysisSectionTitleProps) {
    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                mb: '6px',
            }}
        >
            <Typography sx={{ fontSize: '13px', fontWeight: 700 }}>
                {title}
            </Typography>
            <Tooltip
                title={description}
                arrow
                open={open}
                disableFocusListener
                disableHoverListener
                disableTouchListener
                slotProps={{
                    tooltip: {
                        sx: {
                            whiteSpace: 'pre-line',
                        },
                    },
                }}
            >
                <IconButton
                    size="small"
                    aria-label={helpAriaLabel}
                    aria-pressed={open}
                    onMouseEnter={onOpen}
                    onMouseLeave={onClose}
                    onFocus={onOpen}
                    onBlur={onClose}
                    onClick={onToggle}
                    sx={{
                        p: '2px',
                        color: 'text.secondary',
                    }}
                >
                    <HelpOutlineIcon sx={{ fontSize: '16px' }} />
                </IconButton>
            </Tooltip>
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
    energySkillTeamResult,
    energySkillTeamLoading,
    energySkillTeamProgress,
    onRunEnergySkill,
    onRunEnergySkillAll,
    onRunEnergySkillTeam,
    hasHelpingBonusMember,
    helpingBonusResult,
    helpingBonusLoading,
    helpingBonusProgress,
    onRunHelpingBonus,
    averageHelpingBonusMemberCount,
    hasConfiguredSwap,
    averageEnergyRecoveryBonusMemberCount,
    hasEnergyRecoveryBonusMember,
    energyRecoveryBonusResult,
    energyRecoveryBonusLoading,
    energyRecoveryBonusProgress,
    onRunEnergyRecoveryBonus,
    errorMessage,
}: AdditionalAnalysisPanelProps) => {
    const { t } = useTranslation();
    const resolvedValueMode = resolveSummaryValueMode(valueMode, simulationDays);
    const [openHelpKey, setOpenHelpKey] = React.useState<'contribution' | 'energySkill' | 'helpingBonus' | 'erb' | null>(null);
    const closeAllHelp = React.useCallback(() => {
        setOpenHelpKey(null);
    }, []);
    const openHelp = React.useCallback((key: 'contribution' | 'energySkill' | 'helpingBonus' | 'erb') => {
        setOpenHelpKey(key);
    }, []);
    const closeHelp = React.useCallback((key: 'contribution' | 'energySkill' | 'helpingBonus' | 'erb') => {
        setOpenHelpKey(current => (current === key ? null : current));
    }, []);
    const toggleHelp = React.useCallback((key: 'contribution' | 'energySkill' | 'helpingBonus' | 'erb') => {
        setOpenHelpKey(current => (current === key ? null : key));
    }, []);
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
    const showEnergySkillTeamRow = energySkillTargets.length >= 2;
    const energySkillTeamMetric = energySkillTeamResult
        ? `${t('TeamTimeline.analysis team label', 'チーム')}: ${formatContributionMetric(
            energySkillTeamResult.teamDeltaEP,
            energySkillTeamResult.teamDeltaPercent,
            resolvedValueMode,
            simulationDays
        )}`
        : '';

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
                <ClickAwayListener onClickAway={closeAllHelp}>
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
                            <AnalysisSectionTitle
                                title={t('TeamTimeline.analysis contribution ep', '貢献EP')}
                                description={t(
                                    'TeamTimeline.analysis contribution ep description',
                                    [
                                        'スキルやサブスキルも含めた、メンバーの貢献度合いを計算します。',
                                        '[通常時の全体EP] - [メンバー1体がおてつだいをしない場合の全体EP] で算出します。',
                                        '計算の仕組み上、合計値は100％を超えます。',
                                    ].join('\n')
                                )}
                                helpAriaLabel={t(
                                    'TeamTimeline.analysis contribution ep help label',
                                    '貢献EPの説明を表示'
                                )}
                                open={openHelpKey === 'contribution'}
                                onOpen={() => openHelp('contribution')}
                                onClose={() => closeHelp('contribution')}
                                onToggle={() => toggleHelp('contribution')}
                            />
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
                            <AnalysisSectionTitle
                                title={t('TeamTimeline.analysis energy skill', 'げんき変動スキル貢献度')}
                                description={t(
                                    'TeamTimeline.analysis energy skill description',
                                    [
                                        'げんき回復スキルやげんき減少スキルの影響によって増減したEPを計算します。',
                                        '[通常時の全体EP] - [各回復スキルの効果が0だった場合の全体EP] で算出します。',
                                        '計算の仕組み上、回復スキルを複数編成していると各メンバーの数値が小さくなります。',
                                    ].join('\n')
                                )}
                                helpAriaLabel={t(
                                    'TeamTimeline.analysis energy skill help label',
                                    'げんき変動スキル貢献度の説明を表示'
                                )}
                                open={openHelpKey === 'energySkill'}
                                onOpen={() => openHelp('energySkill')}
                                onClose={() => closeHelp('energySkill')}
                                onToggle={() => toggleHelp('energySkill')}
                            />
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '110px minmax(0, 1fr)',
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
                                sx={fixedActionButtonSx(energySkillBatchLoading, false, energySkillBatchProgress)}
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
                                    gridColumn: { xs: '2', md: '2 / span 3' },
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
                                            sx={fixedActionButtonSx(isLoading, true, progress, keepFilledWhenCompleted)}
                                        >
                                            <span className="button-label">
                                                {target.pokemonName}
                                            </span>
                                        </Button>
                                        <Box
                                            sx={{
                                                gridColumn: { xs: '2', md: '2 / span 3' },
                                                minWidth: 0,
                                                display: result ? 'grid' : 'block',
                                                gridTemplateColumns: { xs: '1fr', md: 'max-content max-content max-content' },
                                                columnGap: '8px',
                                                rowGap: '2px',
                                                alignItems: 'center',
                                            }}
                                        >
                                            {result && (
                                                <>
                                                    <Typography sx={{ fontSize: '11px', lineHeight: '14px', minWidth: 0 }}>
                                                        {skillLabel}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', minWidth: 0 }}>
                                                        {selfMetric}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', minWidth: 0 }}>
                                                        {teamMetric}
                                                    </Typography>
                                                </>
                                            )}
                                        </Box>
                                    </React.Fragment>
                                );
                            })}
                            {showEnergySkillTeamRow && (
                                <React.Fragment key="energy-row-team-overall">
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={onRunEnergySkillTeam}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={energySkillTeamLoading ? energySkillTeamProgress : undefined}
                                        sx={fixedActionButtonSx(energySkillTeamLoading, true, energySkillTeamProgress)}
                                    >
                                        <span className="button-label">
                                            {t('TeamTimeline.analysis energy skill team overall', 'チーム全体')}
                                        </span>
                                    </Button>
                                    <Box
                                        sx={{
                                            gridColumn: { xs: '2', md: '2 / span 3' },
                                            minWidth: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            minHeight: '28px',
                                        }}
                                    >
                                        {energySkillTeamResult && (
                                            <Typography sx={{ fontSize: '12px', minWidth: 0 }}>
                                                {energySkillTeamMetric}
                                            </Typography>
                                        )}
                                    </Box>
                                </React.Fragment>
                            )}
                        </Box>
                        </Box>

                        <Box>
                            <AnalysisSectionTitle
                                title={t('TeamTimeline.analysis helping bonus', 'おてつだいボーナス貢献度')}
                                description={t(
                                    'TeamTimeline.analysis helping bonus description',
                                    [
                                        'おてつだいボーナスによって増えたEPを計算します。',
                                        '[通常時の全体EP] - [おてつだいボーナスが無かった場合の全体EP]で算出します。',
                                    ].join('\n')
                                )}
                                helpAriaLabel={t(
                                    'TeamTimeline.analysis helping bonus help label',
                                    'おてつだいボーナス貢献度の説明を表示'
                                )}
                                open={openHelpKey === 'helpingBonus'}
                                onOpen={() => openHelp('helpingBonus')}
                                onClose={() => closeHelp('helpingBonus')}
                                onToggle={() => toggleHelp('helpingBonus')}
                            />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Box sx={{ pl: '2px' }}>
                                <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                    {`${hasConfiguredSwap
                                        ? t('TeamTimeline.analysis average team member count', '平均編成数')
                                        : t('TeamTimeline.analysis team member count', '編成数')
                                    }: ${
                                        formatAverageTeamMemberCountText(averageHelpingBonusMemberCount)
                                    }`}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '8px', alignItems: 'center' }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={!hasHelpingBonusMember}
                                    onClick={onRunHelpingBonus}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={helpingBonusLoading ? helpingBonusProgress : undefined}
                                    sx={actionButtonSx(helpingBonusLoading, false, helpingBonusProgress)}
                                >
                                    <span className="button-label">
                                        {t('TeamTimeline.analysis run', '計算')}
                                    </span>
                                </Button>
                                <ResultCell>
                                    {!hasHelpingBonusMember && (
                                        <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                            {t(
                                                'TeamTimeline.analysis no helping bonus target',
                                                'おてつだいボーナスを持つメンバーがいません'
                                            )}
                                        </Typography>
                                    )}
                                    {helpingBonusResult && (
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {formatContributionMetric(
                                                helpingBonusResult.teamDeltaEP,
                                                helpingBonusResult.teamDeltaPercent,
                                                resolvedValueMode,
                                                simulationDays
                                            )}
                                        </Typography>
                                    )}
                                </ResultCell>
                            </Box>
                        </Box>
                        </Box>

                        <Box>
                            <AnalysisSectionTitle
                                title={t('TeamTimeline.analysis erb', 'げんき回復ボーナス貢献度')}
                                description={t(
                                    'TeamTimeline.analysis erb description',
                                    [
                                        'げんき回復ボーナスによって増えたEPを計算します。',
                                        '1回の睡眠時間が短い場合に効果を発揮しやすいです。',
                                        '[通常時の全体EP] - [げんき回復ボーナスが無かった場合の全体EP]で算出します。',
                                    ].join('\n')
                                )}
                                helpAriaLabel={t(
                                    'TeamTimeline.analysis erb help label',
                                    'げんき回復ボーナス貢献度の説明を表示'
                                )}
                                open={openHelpKey === 'erb'}
                                onOpen={() => openHelp('erb')}
                                onClose={() => closeHelp('erb')}
                                onToggle={() => toggleHelp('erb')}
                            />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Box sx={{ pl: '2px' }}>
                                <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                    {`${t('TeamTimeline.analysis wake team member count', '起床時編成数')}: ${
                                        formatAverageTeamMemberCountText(averageEnergyRecoveryBonusMemberCount)
                                    }`}
                                </Typography>
                            </Box>
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
                                            {formatContributionMetric(
                                                energyRecoveryBonusResult.teamDeltaEP,
                                                energyRecoveryBonusResult.teamDeltaPercent,
                                                resolvedValueMode,
                                                simulationDays
                                            )}
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
                </ClickAwayListener>
            </Accordion>
        </Box>
    );
});

AdditionalAnalysisPanel.displayName = 'AdditionalAnalysisPanel';

export default AdditionalAnalysisPanel;
