import React from 'react';
import { styled } from '@mui/system';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { IconButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { TimeSlotResult } from '../types/TimeSlotTypes';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import { formatIngredientCount, sortIngredientsByCountDesc } from '../utils/IngredientDisplayUtils';

interface TimelineCellProps {
    result: TimeSlotResult | null;
    isSleeping: boolean;
    slotId: string;                  // Time slot ID (e.g., "06:00-12:00")
    teamIndex: number;               // Team slot index (0-4)
    onSwapClick?: () => void;        // Callback for swap button click
    hasSwap?: boolean;               // Whether this position has a swap
    swappedPokemonName?: string;     // Name of the swapped Pokemon
    isFirstSlot?: boolean;           // Whether this is the first time slot (duration 0)
}

/**
 * Display simulation results for 1 Pokemon x 1 time slot
 */
const TimelineCell = React.memo((props: TimelineCellProps) => {
    const { result, isSleeping, onSwapClick, hasSwap, swappedPokemonName, isFirstSlot } = props;
    const { t } = useTranslation();
    const swapButtonTitle = t('TeamTimeline.swap pokemon');
    const hasSwapInfo = Boolean(hasSwap && swappedPokemonName);
    const showSwapButton = Boolean(onSwapClick) && !hasSwapInfo;

    const handleSwapButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onSwapClick?.();
    };

    const handleSwapInfoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!onSwapClick) {
            return;
        }
        onSwapClick?.();
    };

    const renderSwapControl = () => {
        if (!showSwapButton) {
            return null;
        }

        return (
            <SwapIconButton
                type="button"
                className="swap-trigger"
                onClick={handleSwapButtonClick}
                title={swapButtonTitle}
            >
                <SwapHorizIcon className="swap-icon" sx={{ fontSize: 16 }} />
            </SwapIconButton>
        );
    };

    const renderSwapInfo = () => {
        if (!hasSwapInfo || !swappedPokemonName) {
            return null;
        }
        return (
            <SwapInfoBox
                type="button"
                className="swap-info"
                onClick={onSwapClick ? handleSwapInfoClick : undefined}
                title={swapButtonTitle}
            >
                <SwapHorizIcon className="swap-icon" sx={{ fontSize: 14 }} />
                <span className="swap-name">{swappedPokemonName}</span>
            </SwapInfoBox>
        );
    };
    const stripDerivedSuffix = (skillLabel: string): string => skillLabel.replace(/\s*\([^)]*\)\s*$/, '');
    const buildProxyDetailParts = (event: NonNullable<TimeSlotResult['proxySkillEvents']>[number]): string[] => {
        const parts: string[] = [];
        const isMetronomeStockpile =
            event.source === 'metronome' && event.resolvedSkillName === 'Charge Strength S (Stockpile)';
        if ((event.selfEnergyRecovery ?? 0) > 0) {
            parts.push(`❇️+${Math.round(event.selfEnergyRecovery ?? 0)}`);
        }
        if ((event.teamEnergyRecoveryPerMember ?? 0) > 0 && (event.teamEnergyRecoveryTargetCount ?? 0) > 0) {
            parts.push(`❇️+${Math.round(event.teamEnergyRecoveryPerMember ?? 0)}(ALL)`);
        }
        if ((event.stockpileStoreCount ?? 0) > 0 && !isMetronomeStockpile) {
            parts.push(`たくわえる(${event.stockpileCountAtStore ?? event.stockpileStoreCount})`);
        }
        if ((event.stockpileSpitCount ?? 0) > 0) {
            const spitDisplayCount = isMetronomeStockpile
                ? (event.stockpileCountAtSpit ?? 0)
                : event.stockpileSpitCount;
            parts.push(`はきだす(${spitDisplayCount})`);
        }
        if ((event.badDreamsHitCount ?? 0) > 0) {
            parts.push(`🖤-12×${event.badDreamsHitCount}`);
        }
        if ((event.supportSkillBerryEP ?? 0) > 0) {
            parts.push(`+${Math.round(event.supportSkillBerryEP ?? 0).toLocaleString()}EP`);
        } else if ((event.directEP ?? 0) > 0) {
            parts.push(`+${Math.round(event.directEP ?? 0).toLocaleString()}EP`);
        }
        const totalGreatSuccessCount =
            (event.berryBurstGreatSuccessCount ?? 0) + (event.ingredientDrawGreatSuccessCount ?? 0);
        if (totalGreatSuccessCount > 0) {
            parts.push(`大成功x${totalGreatSuccessCount}`);
        }
        if ((event.presentCandyCount ?? 0) > 0) {
            parts.push(`🍬${event.presentCandyCount}`);
        }
        if ((event.berryJuiceCount ?? 0) > 0) {
            parts.push(`🍹${event.berryJuiceCount}`);
        }
        if ((event.cookingPotCapacityIncrease ?? 0) > 0) {
            parts.push(`鍋容量+${Math.round(event.cookingPotCapacityIncrease ?? 0)}`);
        }
        if ((event.tastyChanceIncreasePercent ?? 0) > 0) {
            parts.push(`料理チャンス+${Math.round(event.tastyChanceIncreasePercent ?? 0)}%`);
        }
        if ((event.dreamShardCount ?? 0) > 0) {
            parts.push(`ゆめのかけら+${Math.round(event.dreamShardCount ?? 0).toLocaleString()}`);
        }
        return parts;
    };

    if (result === null) {
        return (
            <StyledCell
                $isSleeping={isSleeping}
                $hasSwap={hasSwap}
                $showSwapButton={showSwapButton}
            >
                <EmptyContent>-</EmptyContent>
                {renderSwapInfo()}
                {renderSwapControl()}
            </StyledCell>
        );
    }

    const totalSkillRecoveryInEnergyLine =
        Math.round(result.skillRecovery + result.selfSkillRecovery);
    const energyBarWidth = Math.max(0, Math.min(100, (result.energyEnd / 150) * 100));
    const moonlightEvents = result.moonlightEvents ?? [];
    const cookingMinusEvents = result.cookingMinusEvents ?? [];
    const proxySkillEvents = result.proxySkillEvents ?? [];
    const slotIngredients = sortIngredientsByCountDesc(result.ingredients.filter(i => i.count > 0));
    const overflowIngredients = sortIngredientsByCountDesc(result.overflowIngredients.filter(i => i.count > 0));
    const skillIngredients = sortIngredientsByCountDesc((result.skillIngredients ?? []).filter(i => i.count > 0));
    const isHelperBoostOnlySupportEvents =
        result.supportHelpEvents.length > 0 &&
        result.supportHelpEvents.every(event => event.source === 'helperBoost');
    const hasProxyEventStyle = proxySkillEvents.length > 0;
    const teamEnergyRecoveryGivenPerMember = result.teamEnergyRecoveryGivenPerMember ?? 0;
    const teamEnergyRecoveryGivenTargetCount = result.teamEnergyRecoveryGivenTargetCount ?? 0;
    const hasEventStyleSkill =
        result.energizingCheerEvents.length > 0 ||
        moonlightEvents.length > 0 ||
        (result.supportHelpEvents.length > 0 && !isHelperBoostOnlySupportEvents) ||
        cookingMinusEvents.length > 0 ||
        hasProxyEventStyle;
    const totalGreatSuccessCount =
        (result.berryBurstGreatSuccessCount ?? 0) + (result.ingredientDrawGreatSuccessCount ?? 0);

    const aggregateDetailParts: string[] = [];
    if (result.selfSkillRecovery > 0) {
        aggregateDetailParts.push(`❇️+${Math.round(result.selfSkillRecovery)}`);
    }
    if (teamEnergyRecoveryGivenPerMember > 0 && teamEnergyRecoveryGivenTargetCount > 0) {
        aggregateDetailParts.push(`❇️+${Math.round(teamEnergyRecoveryGivenPerMember)}(ALL)`);
    }
    if (result.stockpileStoreCount > 0) {
        aggregateDetailParts.push(`たくわえる(${result.stockpileCountAtStore ?? result.stockpileStoreCount})`);
    }
    if (result.stockpileSpitCount > 0) {
        aggregateDetailParts.push(`はきだす(${result.stockpileCountAtSpit ?? result.stockpileSpitCount})`);
    }
    if (result.badDreamsHitCount > 0) {
        aggregateDetailParts.push(`🖤-12×${result.badDreamsHitCount}`);
    }
    if (isHelperBoostOnlySupportEvents && result.supportSkillBerryEP > 0) {
        aggregateDetailParts.push(`+${Math.round(result.supportSkillBerryEP).toLocaleString()}EP`);
    } else if (result.directSkillEP > 0 && result.supportHelpEvents.length === 0) {
        aggregateDetailParts.push(`+${result.directSkillEP.toLocaleString()}EP`);
    }
    if (totalGreatSuccessCount > 0) {
        aggregateDetailParts.push(`大成功x${totalGreatSuccessCount}`);
    }
    if (result.berryJuiceCount > 0) {
        aggregateDetailParts.push(`🍹${result.berryJuiceCount}`);
    }
    if ((result.cookingPotCapacityIncrease ?? 0) > 0) {
        aggregateDetailParts.push(`鍋容量+${Math.round(result.cookingPotCapacityIncrease ?? 0)}`);
    }
    if ((result.tastyChanceIncreasePercent ?? 0) > 0) {
        aggregateDetailParts.push(`料理チャンス+${Math.round(result.tastyChanceIncreasePercent ?? 0)}%`);
    }
    if ((result.dreamShardCount ?? 0) > 0) {
        aggregateDetailParts.push(`ゆめのかけら+${Math.round(result.dreamShardCount ?? 0).toLocaleString()}`);
    }

    const skillDetailLines: React.ReactNode[] = [];
    if (hasEventStyleSkill) {
        if (!hasProxyEventStyle) {
            result.energizingCheerEvents.forEach((event, index) => {
                skillDetailLines.push(
                    <SkillDetailLine key={`cheer-${index}-${event.targetPokemonId}`}>
                        ❗→{event.targetPokemonName}❇️+{Math.round(event.recovery)}
                    </SkillDetailLine>
                );
            });
            moonlightEvents.forEach((event, index) => {
                skillDetailLines.push(
                    <SkillDetailLine key={`moonlight-${index}-${event.targetPokemonId}`}>
                        ❗→{event.targetPokemonName}❇️+{Math.round(event.recovery)}
                    </SkillDetailLine>
                );
            });
            result.supportHelpEvents.forEach((event, eventIndex) => {
                const ingredients = sortIngredientsByCountDesc(event.ingredients.filter(ingredient => ingredient.count > 0));
                skillDetailLines.push(
                    <SkillDetailLine key={`support-${eventIndex}-${event.targetPokemonId}`}>
                        ❗→{event.targetPokemonName}{' '}
                        <SupportBerryEPBadge>
                            <LocalFireDepartmentIcon sx={{ width: 14, height: 14, color: '#ff944b' }} />
                            {Math.round(event.berryEP).toLocaleString()}EP
                        </SupportBerryEPBadge>
                        {ingredients.map((ingredient, ingredientIndex) => (
                            <React.Fragment key={`support-ing-${eventIndex}-${ingredientIndex}-${ingredient.name}`}>
                                {' '}
                                <SupportIngredientBadge>
                                    <IngredientIcon name={ingredient.name} />
                                    {formatIngredientCount(ingredient.count)}
                                </SupportIngredientBadge>
                            </React.Fragment>
                        ))}
                    </SkillDetailLine>
                );
            });
            cookingMinusEvents.forEach((event, index) => {
                skillDetailLines.push(
                    <SkillDetailLine key={`cooking-minus-${index}-${event.targetPokemonId}`}>
                        ❗→{event.targetPokemonName}❇️+{Math.round(event.recovery)}
                    </SkillDetailLine>
                );
            });
        }
        proxySkillEvents.forEach((event, index) => {
            const resolvedSkillLabel = stripDerivedSuffix(
                t(`skills.${event.resolvedSkillName}`, event.resolvedSkillName)
            );
            const isMetronomeStockpile =
                event.source === 'metronome' && event.resolvedSkillName === 'Charge Strength S (Stockpile)';
            const displaySkillLabel = isMetronomeStockpile ? '' : resolvedSkillLabel;
            const detailParts = buildProxyDetailParts(event);
            skillDetailLines.push(
                <SkillDetailLine key={`proxy-${index}-${event.source}-${event.triggeredSkillName}`}>
                    ❗{displaySkillLabel}
                    {detailParts.length > 0 && `${displaySkillLabel ? ' ' : ''}${detailParts.join(' ')}`}
                    {sortIngredientsByCountDesc((event.skillIngredients ?? []).filter(ingredient => ingredient.count > 0)).map((ingredient, ingredientIndex) => (
                        <React.Fragment key={`proxy-ing-${index}-${ingredientIndex}-${ingredient.name}`}>
                            {' '}
                            <SupportIngredientBadge>
                                <IngredientIcon name={ingredient.name} />
                                {formatIngredientCount(ingredient.count)}
                            </SupportIngredientBadge>
                        </React.Fragment>
                    ))}
                </SkillDetailLine>
            );
        });
        if (skillIngredients.length > 0 && !hasProxyEventStyle && result.supportHelpEvents.length === 0) {
            skillDetailLines.push(
                <SkillDetailLine key="skill-ingredients">
                    ❗
                    {skillIngredients.map((ingredient, ingredientIndex) => (
                        <React.Fragment key={`skill-ing-${ingredientIndex}-${ingredient.name}`}>
                            {ingredientIndex > 0 && ' '}
                            <SupportIngredientBadge>
                                <IngredientIcon name={ingredient.name} />
                                {formatIngredientCount(ingredient.count)}
                            </SupportIngredientBadge>
                        </React.Fragment>
                    ))}
                </SkillDetailLine>
            );
        }
        if (aggregateDetailParts.length > 0 && !hasProxyEventStyle) {
            skillDetailLines.push(
                <SkillDetailLine key="aggregate-extra">
                    ❗{aggregateDetailParts.join(' ')}
                </SkillDetailLine>
            );
        }
    } else if (result.skillTriggerCount > 0 || aggregateDetailParts.length > 0) {
        if (isHelperBoostOnlySupportEvents) {
            const triggerPrefix = result.skillTriggerCount > 0 ? '❗'.repeat(result.skillTriggerCount) : '❗';
            skillDetailLines.push(
                <SkillDetailLine key="helper-boost-aggregate">
                    {triggerPrefix}
                    {aggregateDetailParts.length > 0 && ` ${aggregateDetailParts.join(' ')}`}
                    {skillIngredients.map((ingredient, ingredientIndex) => (
                        <React.Fragment key={`helper-boost-ing-${ingredientIndex}-${ingredient.name}`}>
                            {' '}
                            <SupportIngredientBadge>
                                <IngredientIcon name={ingredient.name} />
                                {formatIngredientCount(ingredient.count)}
                            </SupportIngredientBadge>
                        </React.Fragment>
                    ))}
                </SkillDetailLine>
            );
        } else {
            if (skillIngredients.length > 0) {
                const triggerPrefix = result.skillTriggerCount > 0 ? '❗'.repeat(result.skillTriggerCount) : '❗';
                skillDetailLines.push(
                    <SkillDetailLine key="skill-ingredients-aggregate">
                        {triggerPrefix}
                        {skillIngredients.map((ingredient, ingredientIndex) => (
                            <React.Fragment key={`skill-ing-aggregate-${ingredientIndex}-${ingredient.name}`}>
                                {ingredientIndex > 0 && ' '}
                                <SupportIngredientBadge>
                                    <IngredientIcon name={ingredient.name} />
                                    {formatIngredientCount(ingredient.count)}
                                </SupportIngredientBadge>
                            </React.Fragment>
                        ))}
                    </SkillDetailLine>
                );
            }
            if (aggregateDetailParts.length > 0) {
                const triggerPrefix = result.skillTriggerCount > 0 ? '❗'.repeat(result.skillTriggerCount) : '❗';
                skillDetailLines.push(
                    <SkillDetailLine key="aggregate">
                        {triggerPrefix}{aggregateDetailParts.length > 0 ? ` ${aggregateDetailParts.join(' ')}` : ''}
                    </SkillDetailLine>
                );
            }
        }
    }

    return (
        <StyledCell
            $isSleeping={isSleeping}
            $hasSwap={hasSwap}
            $showSwapButton={showSwapButton}
        >
            {/* Line 1: Energy Value */}
            <EnergyLine>
                げんき{Math.round(result.energyEnd)}
            </EnergyLine>
            <EnergyBarTrack>
                <EnergyBarFill style={{ width: `${energyBarWidth}%` }} />
            </EnergyBarTrack>

            {/* Line 2: Energy Details */}
            {(result.energyDecay > 0 || result.wakeRecovery > 0 || result.mealRecovery > 0 || totalSkillRecoveryInEnergyLine > 0 || result.badDreamsDamageTaken > 0) && (
                <RecoveryInfoLine>
                    ({result.energyDecay > 0 && `⌛-${Math.round(result.energyDecay)}`}
                    {result.energyDecay > 0 && (result.wakeRecovery > 0 || result.mealRecovery > 0 || totalSkillRecoveryInEnergyLine > 0 || result.badDreamsDamageTaken > 0) && ' '}
                    {result.wakeRecovery > 0 && `💤+${result.wakeRecovery}`}
                    {result.wakeRecovery > 0 && (result.mealRecovery > 0 || totalSkillRecoveryInEnergyLine > 0 || result.badDreamsDamageTaken > 0) && ' '}
                    {result.mealRecovery > 0 && `🍴+${result.mealRecovery}`}
                    {result.mealRecovery > 0 && (totalSkillRecoveryInEnergyLine > 0 || result.badDreamsDamageTaken > 0) && ' '}
                    {totalSkillRecoveryInEnergyLine > 0 && `❇️+${totalSkillRecoveryInEnergyLine}`}
                    {totalSkillRecoveryInEnergyLine > 0 && result.badDreamsDamageTaken > 0 && ' '}
                    {result.badDreamsDamageTaken > 0 && `🖤-${Math.round(result.badDreamsDamageTaken)}`})
                </RecoveryInfoLine>
            )}

            {/* Line 3: Help count & Berries */}
            <ResourceLine>
                {!(isFirstSlot && result.helpCount === 0) && (
                    <HelpLine>🔍{result.helpCount}</HelpLine>
                )}
                {result.berryCount > 0 && (
                    <BerryBadge>
                        <LocalFireDepartmentIcon sx={{ width: 14, height: 14, color: '#ff944b' }} />
                        {result.berryCount}
                    </BerryBadge>
                )}
            </ResourceLine>

            {/* Line 4: Ingredients */}
            {(slotIngredients.length > 0 || overflowIngredients.length > 0) && (
                <ResourceLine>
                    {slotIngredients.map((ing) => (
                        <IngredientBadge key={ing.name}>
                            <IngredientIcon name={ing.name} />
                            {formatIngredientCount(ing.count)}
                        </IngredientBadge>
                    ))}
                    {overflowIngredients.length > 0 && (
                        <OverflowContainer>
                            ({overflowIngredients.map((ing) => (
                                <OverflowIngredientBadge key={`overflow-${ing.name}`}>
                                    <IngredientIcon name={ing.name} />
                                    {formatIngredientCount(ing.count)}
                                </OverflowIngredientBadge>
                            ))})
                        </OverflowContainer>
                    )}
                </ResourceLine>
            )}

            {/* Line 5: Skills & Effects */}
            {(skillDetailLines.length > 0 || result.skillOverflowCount > 0) && (
                <SkillLine>
                    {skillDetailLines}
                    {result.skillOverflowCount > 0 && <SkillOverflowLine>❕</SkillOverflowLine>}
                </SkillLine>
            )}

            {renderSwapInfo()}
            {renderSwapControl()}
        </StyledCell>
    );
});

const StyledCell = styled('div')<{ $isSleeping: boolean; $hasSwap?: boolean; $showSwapButton: boolean }>(
    ({ $isSleeping, $showSwapButton }) => ({
    position: 'relative',
    width: '100px',
    minWidth: '100px',
    flexShrink: 0,
    boxSizing: 'border-box',
    minHeight: '109px',
    padding: `3px 3px ${$showSwapButton ? '26px' : '3px'}`,
    borderLeft: '0.5px solid #e2e2e2',
    backgroundColor: $isSleeping ? '#f5f6fb' : '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    fontSize: '10px',
    fontFamily: '"M PLUS 1p", sans-serif',
    cursor: 'default',
    WebkitTapHighlightColor: 'transparent',
    '& .swap-trigger': {
        opacity: 0,
        pointerEvents: 'none',
    },
    '&:hover .swap-trigger, &:focus-within .swap-trigger': {
        opacity: 1,
        pointerEvents: 'auto',
    },
    '@media (hover: none), (pointer: coarse)': {
        '& .swap-trigger': {
            opacity: 1,
            pointerEvents: 'auto',
        },
    },
}));

const EmptyContent = styled('div')({
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    color: '#999',
});

const HelpLine = styled('span')({
    fontWeight: 600,
    fontSize: '12px',
    lineHeight: '15px',
    letterSpacing: '-0.48px',
});

const ResourceLine = styled('div')({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2px',
    alignItems: 'center',
});

const OverflowContainer = styled('div')({
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    color: '#9e9e9e',
});

const BerryBadge = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0',
    fontSize: '12px',
    lineHeight: '15px',
    letterSpacing: '-0.48px',
});

const IngredientBadge = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    fontSize: '12px',
    lineHeight: '15px',
    letterSpacing: '-0.48px',
    '& svg': {
        width: '14px',
        height: '14px',
    },
});

const OverflowIngredientBadge = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    color: '#9e9e9e',  // グレー
    '& svg': {
        width: '14px',
        height: '14px',
        opacity: 0.6,
    },
});

const SkillLine = styled('div')({
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    alignItems: 'flex-start',
});

const SkillDetailLine = styled('div')({
    fontSize: '10px',
    color: '#222',
    fontWeight: 400,
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '2px',
});

const SkillOverflowLine = styled('div')({
    fontSize: '10px',
    color: '#9e9e9e',
    fontWeight: 600,
});

const SupportBerryEPBadge = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    '& svg': {
        width: '14px',
        height: '14px',
        color: '#ff944b',
    },
});

const SupportIngredientBadge = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    '& svg': {
        width: '14px',
        height: '14px',
    },
});

const EnergyLine = styled('div')({
    fontSize: '10px',
    color: '#000',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    minHeight: '13px',
});

const RecoveryInfoLine = styled('div')({
    fontSize: '7px',
    color: '#000',
    lineHeight: '13px',
    letterSpacing: '-0.35px',
    whiteSpace: 'nowrap',
});

const SwapIconButton = styled(IconButton)({
    position: 'absolute',
    right: '2px',
    bottom: '2px',
    width: '20px',
    height: '20px',
    padding: '0',
    border: '1px solid #62d540',
    backgroundColor: '#fff',
    color: '#62d540',
    borderRadius: '999px',
    zIndex: 2,
    transition: 'opacity 120ms ease',
    '&:hover': {
        backgroundColor: '#f7fff3',
    },
    '& .swap-icon': {
        color: '#62d540',
    },
});

const SwapInfoBox = styled('button')({
    border: '1px solid #62d540',
    marginTop: '2px',
    marginLeft: '0',
    marginRight: '0',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '18px',
    padding: '1px 4px',
    borderRadius: '6px',
    backgroundColor: '#f6ffef',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    gap: '0px',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.4px',
    fontFamily: '"M PLUS 1p", sans-serif',
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
        backgroundColor: '#edffe0',
    },
    '& .swap-icon': {
        color: '#62d540',
        flexShrink: 0,
    },
    '& .swap-name': {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
    },
});

const EnergyBarTrack = styled('div')({
    width: '94px',
    height: '3px',
    borderRadius: '999px',
    backgroundColor: '#d5ead0',
    overflow: 'hidden',
});

const EnergyBarFill = styled('div')({
    height: '100%',
    backgroundColor: '#62d540',
    borderRadius: '999px',
});

export default TimelineCell;
