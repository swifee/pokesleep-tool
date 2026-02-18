import React from 'react';
import { styled } from '@mui/system';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloseIcon from '@mui/icons-material/Close';
import { IconButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { TimeSlotResult } from '../types/TimeSlotTypes';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';
import { formatIngredientCount, sortIngredientsByCountDesc } from '../utils/IngredientDisplayUtils';
import TeamTimelineIcon from './TimelineIcons';
import EpValue, { EpText } from './EpValue';

interface TimelineCellProps {
    result: TimeSlotResult | null;
    isSleeping: boolean;
    slotId: string;                  // Time slot ID (e.g., "06:00-12:00")
    teamIndex: number;               // Team slot index (0-4)
    onSwapClick?: () => void;        // Callback for swap button click
    onRemoveSwapClick?: () => void;  // Callback for swap removal button click
    hasSwap?: boolean;               // Whether this position has a swap
    swappedPokemonName?: string;     // Name of the swapped Pokemon
    isFirstSlot?: boolean;           // Whether this is the first time slot (duration 0)
    compactEmpty?: boolean;          // Use compact layout for empty cell
    compactFirstSlot?: boolean;      // Use compact layout for first timeline slot
    alwaysShowSwapButton?: boolean;  // Show swap button without hover
    disableSwapUi?: boolean;         // Hide swap UI entirely for this cell
    pokemonIdForm?: number;
}

/**
 * Display simulation results for 1 Pokemon x 1 time slot
 */
const TimelineCell = React.memo((props: TimelineCellProps) => {
    const {
        result,
        isSleeping,
        onSwapClick,
        onRemoveSwapClick,
        hasSwap,
        swappedPokemonName,
        isFirstSlot,
        compactEmpty = false,
        compactFirstSlot = false,
        alwaysShowSwapButton = false,
        disableSwapUi = false,
        pokemonIdForm,
    } = props;
    const { t } = useTranslation();
    const swapButtonTitle = t('TeamTimeline.swap pokemon');
    const removeSwapButtonTitle = t('TeamTimeline.swap remove', '入れ替え設定を解除');
    const hasSwapInfo = !disableSwapUi && Boolean(hasSwap && swappedPokemonName);
    const showSwapButton = !disableSwapUi && Boolean(onSwapClick) && !hasSwapInfo;
    const isCompactEmptyCell = compactEmpty && result === null;
    const isCompactLayout = isCompactEmptyCell || compactFirstSlot;

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

    const handleSwapRemoveButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onRemoveSwapClick?.();
    };

    const renderSwapControl = () => {
        if (!showSwapButton) {
            return null;
        }

        return (
            <SwapIconButton
                type="button"
                className="swap-trigger"
                data-always-visible={alwaysShowSwapButton ? 'true' : 'false'}
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
            <SwapInfoContainer>
                <SwapInfoMainButton
                    type="button"
                    className="swap-info"
                    onClick={onSwapClick ? handleSwapInfoClick : undefined}
                    title={swapButtonTitle}
                >
                    <SwapHorizIcon className="swap-icon" sx={{ fontSize: 14 }} />
                    <span className="swap-name">{swappedPokemonName}</span>
                </SwapInfoMainButton>
                {onRemoveSwapClick && (
                    <SwapRemoveButton
                        type="button"
                        className="swap-remove-trigger"
                        onClick={handleSwapRemoveButtonClick}
                        title={removeSwapButtonTitle}
                        aria-label={removeSwapButtonTitle}
                    >
                        <CloseIcon className="swap-remove-icon" sx={{ fontSize: 12 }} />
                    </SwapRemoveButton>
                )}
            </SwapInfoContainer>
        );
    };
    const stripDerivedSuffix = (skillLabel: string): string => skillLabel.replace(/\s*\([^)]*\)\s*$/, '');
    const SkillPrefixIcons = React.useCallback(({ count = 1, testId }: { count?: number; testId?: string }) => {
        const normalizedCount = Math.max(1, Math.round(count));
        return (
            <span
                className="skill-prefix-icons"
                data-testid={testId}
                data-skill-prefix-count={normalizedCount}
            >
                {Array.from({ length: normalizedCount }).map((_, index) => (
                    <TeamTimelineIcon
                        key={index}
                        name="skill"
                        className="skill-prefix-icon"
                        data-skill-prefix-icon="true"
                    />
                ))}
            </span>
        );
    }, []);
    const renderTextWithHealIcon = React.useCallback((text: string, keyPrefix: string): React.ReactNode => {
        const chunks = text.split('❇️');
        if (chunks.length === 1) {
            return <EpText text={text} keyPrefix={keyPrefix} />;
        }
        return chunks.map((chunk, index) => (
            <React.Fragment key={`${keyPrefix}-${index}`}>
                {index > 0 && (
                    <TeamTimelineIcon
                        name="heal"
                        className="heal-inline-icon"
                        data-heal-icon="true"
                    />
                )}
                <EpText text={chunk} keyPrefix={`${keyPrefix}-ep-${index}`} />
            </React.Fragment>
        ));
    }, []);
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
            parts.push(`+${Math.round(event.supportSkillBerryEP ?? 0).toLocaleString()} EP`);
        } else if ((event.directEP ?? 0) > 0) {
            parts.push(`+${Math.round(event.directEP ?? 0).toLocaleString()} EP`);
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
    const renderPokemonIcon = () => {
        if (pokemonIdForm === undefined) {
            return null;
        }
        return (
            <PokemonIconAnchor data-testid="timeline-cell-pokemon-icon">
                <PokemonIcon idForm={pokemonIdForm} size={14} />
            </PokemonIconAnchor>
        );
    };

    if (result === null) {
        return (
            <StyledCell
                $isSleeping={isSleeping}
                $hasSwap={hasSwap}
                $showSwapButton={showSwapButton}
                $alwaysShowSwapButton={alwaysShowSwapButton}
                $compact={isCompactLayout}
                data-compact-layout={isCompactLayout ? 'true' : 'false'}
            >
                <EmptyContent>
                    {renderPokemonIcon()}
                </EmptyContent>
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
        aggregateDetailParts.push(`+${Math.round(result.supportSkillBerryEP).toLocaleString()} EP`);
    } else if (result.directSkillEP > 0 && result.supportHelpEvents.length === 0) {
        aggregateDetailParts.push(`+${result.directSkillEP.toLocaleString()} EP`);
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
                        <SkillPrefixIcons />
                        {renderTextWithHealIcon(`→${event.targetPokemonName}❇️+${Math.round(event.recovery)}`, `cheer-${index}`)}
                    </SkillDetailLine>
                );
            });
            moonlightEvents.forEach((event, index) => {
                skillDetailLines.push(
                    <SkillDetailLine key={`moonlight-${index}-${event.targetPokemonId}`}>
                        <SkillPrefixIcons />
                        {renderTextWithHealIcon(`→${event.targetPokemonName}❇️+${Math.round(event.recovery)}`, `moonlight-${index}`)}
                    </SkillDetailLine>
                );
            });
            result.supportHelpEvents.forEach((event, eventIndex) => {
                const ingredients = sortIngredientsByCountDesc(event.ingredients.filter(ingredient => ingredient.count > 0));
                skillDetailLines.push(
                    <SkillDetailLine key={`support-${eventIndex}-${event.targetPokemonId}`}>
                        <SkillPrefixIcons />
                        →{event.targetPokemonName}{' '}
                        <SupportBerryEPBadge>
                            <TeamTimelineIcon name="berry" />
                            <EpValue value={Math.round(event.berryEP).toLocaleString()} />
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
                        <SkillPrefixIcons />
                        {renderTextWithHealIcon(`→${event.targetPokemonName}❇️+${Math.round(event.recovery)}`, `cooking-minus-${index}`)}
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
                    <SkillPrefixIcons />
                    {displaySkillLabel}
                    {detailParts.length > 0 &&
                        renderTextWithHealIcon(
                            `${displaySkillLabel ? ' ' : ''}${detailParts.join(' ')}`,
                            `proxy-detail-${index}`
                        )}
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
                    <SkillPrefixIcons />
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
                    <SkillPrefixIcons />
                    {renderTextWithHealIcon(aggregateDetailParts.join(' '), 'aggregate-extra')}
                </SkillDetailLine>
            );
        }
    } else if (result.skillTriggerCount > 0 || aggregateDetailParts.length > 0) {
        if (isHelperBoostOnlySupportEvents) {
            const triggerCount = result.skillTriggerCount > 0 ? result.skillTriggerCount : 1;
            skillDetailLines.push(
                <SkillDetailLine key="helper-boost-aggregate">
                    <SkillPrefixIcons count={triggerCount} testId="timeline-cell-skill-prefix-helper-boost" />
                    {aggregateDetailParts.length > 0 &&
                        renderTextWithHealIcon(` ${aggregateDetailParts.join(' ')}`, 'helper-boost-aggregate')}
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
                const triggerCount = result.skillTriggerCount > 0 ? result.skillTriggerCount : 1;
                skillDetailLines.push(
                    <SkillDetailLine key="skill-ingredients-aggregate">
                        <SkillPrefixIcons count={triggerCount} testId="timeline-cell-skill-prefix-ingredients" />
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
                const triggerCount = result.skillTriggerCount > 0 ? result.skillTriggerCount : 1;
                skillDetailLines.push(
                <SkillDetailLine key="aggregate">
                    <SkillPrefixIcons count={triggerCount} testId="timeline-cell-skill-prefix-aggregate" />
                    {aggregateDetailParts.length > 0
                        ? renderTextWithHealIcon(` ${aggregateDetailParts.join(' ')}`, 'aggregate')
                        : ''}
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
            $alwaysShowSwapButton={alwaysShowSwapButton}
            $compact={isCompactLayout}
            data-compact-layout={isCompactLayout ? 'true' : 'false'}
        >
            <TopEnergyArea>
                {renderPokemonIcon()}
                <EnergySummary>
                    {/* Line 1: Energy Value */}
                    <EnergyLine>
                        げんき{Math.round(result.energyEnd)}
                    </EnergyLine>
                    <EnergyBarTrack>
                        <EnergyBarFill style={{ width: `${energyBarWidth}%` }} />
                    </EnergyBarTrack>
                </EnergySummary>
            </TopEnergyArea>
            {/* Line 2: Energy Details */}
            {(result.energyDecay > 0 || result.wakeRecovery > 0 || result.mealRecovery > 0 || totalSkillRecoveryInEnergyLine > 0 || result.badDreamsDamageTaken > 0) && (
                <RecoveryInfoLine>
                    {result.energyDecay > 0 && `⌛-${Math.round(result.energyDecay)}`}
                    {result.energyDecay > 0 && (result.wakeRecovery > 0 || result.mealRecovery > 0 || totalSkillRecoveryInEnergyLine > 0 || result.badDreamsDamageTaken > 0) && ' '}
                    {result.wakeRecovery > 0 && (
                        <>
                            <TeamTimelineIcon name="sleep" data-testid="timeline-cell-recovery-icon-sleep" />
                            +{result.wakeRecovery}
                        </>
                    )}
                    {result.wakeRecovery > 0 && (result.mealRecovery > 0 || totalSkillRecoveryInEnergyLine > 0 || result.badDreamsDamageTaken > 0) && ' '}
                    {result.mealRecovery > 0 && (
                        <>
                            <TeamTimelineIcon name="cooking" data-testid="timeline-cell-recovery-icon-cooking" />
                            +{result.mealRecovery}
                        </>
                    )}
                    {result.mealRecovery > 0 && (totalSkillRecoveryInEnergyLine > 0 || result.badDreamsDamageTaken > 0) && ' '}
                    {totalSkillRecoveryInEnergyLine > 0 && (
                        <>
                            <TeamTimelineIcon name="heal" data-testid="timeline-cell-recovery-icon-heal" data-heal-icon="true" />
                            +{totalSkillRecoveryInEnergyLine}
                        </>
                    )}
                    {totalSkillRecoveryInEnergyLine > 0 && result.badDreamsDamageTaken > 0 && ' '}
                    {result.badDreamsDamageTaken > 0 && `🖤-${Math.round(result.badDreamsDamageTaken)}`}
                </RecoveryInfoLine>
            )}

            {/* Line 3: Help count & Berries */}
            <ResourceLine>
                {!(isFirstSlot && result.helpCount === 0) && (
                    <HelpLine>
                        <TeamTimelineIcon name="work" data-testid="timeline-cell-help-icon-work" />
                        {result.helpCount}
                    </HelpLine>
                )}
                {result.berryCount > 0 && (
                    <BerryBadge>
                        <TeamTimelineIcon name="berry" />
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
                    {result.skillOverflowCount > 0 && (
                        <SkillOverflowLine>
                            <TeamTimelineIcon name="skill_none" data-testid="timeline-cell-skill-overflow-icon" />
                        </SkillOverflowLine>
                    )}
                </SkillLine>
            )}

            {renderSwapInfo()}
            {renderSwapControl()}
        </StyledCell>
    );
});

const StyledCell = styled('div')<{
    $isSleeping: boolean;
    $hasSwap?: boolean;
    $showSwapButton: boolean;
    $alwaysShowSwapButton: boolean;
    $compact: boolean;
}>(
    ({ $isSleeping, $showSwapButton, $alwaysShowSwapButton, $compact }) => ({
    position: 'relative',
    width: '100px',
    minWidth: '100px',
    flexShrink: 0,
    boxSizing: 'border-box',
    minHeight: $compact ? '34px' : '109px',
    padding: $compact
        ? `2px 2px ${$showSwapButton ? '22px' : '2px'}`
        : `3px 3px ${$showSwapButton ? '26px' : '3px'}`,
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
        opacity: $alwaysShowSwapButton ? 1 : 0,
        pointerEvents: $alwaysShowSwapButton ? 'auto' : 'none',
    },
    ...(!$alwaysShowSwapButton ? {
        '&:hover .swap-trigger, &:focus-within .swap-trigger': {
            opacity: 1,
            pointerEvents: 'auto',
        },
    } : {}),
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
    minHeight: 0,
    alignItems: 'flex-start',
});

const TopEnergyArea = styled('div')({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '3px',
});

const PokemonIconAnchor = styled('span')({
    width: '14px',
    height: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
});

const EnergySummary = styled('div')({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
});

const HelpLine = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    fontWeight: 600,
    fontSize: '12px',
    lineHeight: '15px',
    letterSpacing: '-0.48px',
    '& svg': {
        width: '12px',
        height: '12px',
    },
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
    '& svg': {
        width: '12px',
        height: '12px',
    },
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
    '& .skill-prefix-icons': {
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
    },
    '& .skill-prefix-icon': {
        width: '10px',
        height: '10px',
    },
    '& .skill-prefix-icon + .skill-prefix-icon': {
        marginLeft: '-3px',
    },
    '& .heal-inline-icon': {
        width: '10px',
        height: '10px',
        marginInline: '1px',
    },
});

const SkillOverflowLine = styled('div')({
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '10px',
    color: '#9e9e9e',
    fontWeight: 600,
    '& svg': {
        width: '10px',
        height: '10px',
    },
});

const SupportBerryEPBadge = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    '& svg': {
        width: '12px',
        height: '12px',
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
    marginTop: '-1px',
});

const RecoveryInfoLine = styled('div')({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    gap: '1px',
    fontSize: '7px',
    color: '#000',
    lineHeight: '13px',
    letterSpacing: '-0.35px',
    whiteSpace: 'nowrap',
    marginTop: '-1px',
    '& svg': {
        width: '7px',
        height: '7px',
    },
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

const SwapInfoContainer = styled('div')({
    border: '1px solid #62d540',
    marginTop: '2px',
    marginLeft: '0',
    marginRight: '0',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '18px',
    borderRadius: '6px',
    backgroundColor: '#f6ffef',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
});

const SwapInfoMainButton = styled('button')({
    border: 'none',
    padding: '1px 0 1px 4px',
    margin: 0,
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
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

const SwapRemoveButton = styled('button')({
    border: 'none',
    width: '18px',
    height: '18px',
    padding: 0,
    margin: '0 2px 0 0',
    borderRadius: '999px',
    backgroundColor: 'transparent',
    color: '#62d540',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    '&:hover': {
        backgroundColor: '#e5f9d9',
    },
    '& .swap-remove-icon': {
        color: '#62d540',
    },
});

const EnergyBarTrack = styled('div')({
    width: '100%',
    height: '3px',
    marginTop: '-1px',
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
