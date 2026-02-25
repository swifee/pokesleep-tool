import React from 'react';
import { styled } from '@mui/system';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { TimeSlotResult } from '../types/TimeSlotTypes';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';
import { formatIngredientCount, sortIngredientsByCountDesc } from '../utils/IngredientDisplayUtils';
import TeamTimelineIcon from './TimelineIcons';
import EpValue, { EpText } from './EpValue';

export type SwapDragState = 'idle' | 'source' | 'target';
export type TimelineDisplayMode = 'detailed' | 'simple';

export interface SwapCellCoordinate {
    slotId: string;
    teamIndex: number;
    dayIndex: number;
}

export interface SwapLongPressStartDetail extends SwapCellCoordinate {
    pointerId: number;
    pointerType?: string;
    clientX: number;
    clientY: number;
    swappedPokemonName?: string;
    previewWidth?: number;
    previewHeight?: number;
    pointerOffsetX?: number;
    pointerOffsetY?: number;
}

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
    fitToViewport?: boolean;
    swapSlotId?: string;             // Original (non-day-suffixed) slot ID used for swap operations
    dayIndex?: number;               // Current day index in expanded timeline
    swapDraggable?: boolean;         // Drag handle enabled only for direct swap rows
    onSwapLongPressStart?: (detail: SwapLongPressStartDetail) => void;
    swapDragState?: SwapDragState;
    displayMode?: TimelineDisplayMode;
    noCollectEnabled?: boolean;
    onNoCollectToggle?: () => void;
}

/**
 * Display simulation results for 1 Pokemon x 1 time slot
 */
const TimelineCell = React.memo((props: TimelineCellProps) => {
    const {
        result,
        isSleeping,
        teamIndex,
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
        fitToViewport = false,
        swapSlotId,
        dayIndex,
        swapDraggable = false,
        onSwapLongPressStart,
        swapDragState = 'idle',
        displayMode = 'detailed',
        noCollectEnabled = false,
        onNoCollectToggle,
    } = props;
    const { t } = useTranslation();
    const swapButtonTitle = t('TeamTimeline.swap pokemon');
    const removeSwapButtonTitle = t('TeamTimeline.swap remove', '入れ替え設定を解除');
    const noCollectButtonTitle = t('TeamTimeline.no collect toggle', '回収しない');
    const hasSwapInfo = !disableSwapUi && Boolean(hasSwap && swappedPokemonName);
    const showSwapButton = !disableSwapUi && Boolean(onSwapClick) && !hasSwapInfo;
    const showNoCollectButton = !disableSwapUi && !hasSwapInfo && !hasSwap && Boolean(onNoCollectToggle);
    const isSimpleMode = displayMode === 'simple';
    const shouldAlwaysShowSwapButton = alwaysShowSwapButton || isSimpleMode;
    const shouldAlwaysShowNoCollectButton = shouldAlwaysShowSwapButton;
    const isCompactEmptyCell = compactEmpty && result === null;
    const isCompactLayout = isCompactEmptyCell || compactFirstSlot || isSimpleMode;
    const isNarrowSwapInfoLayout = fitToViewport;
    const isLongPressEnabled =
        hasSwapInfo &&
        swapDraggable &&
        onSwapLongPressStart !== undefined &&
        swapSlotId !== undefined &&
        dayIndex !== undefined;
    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragPointerIdRef = React.useRef<number | null>(null);
    const dragPointerTypeRef = React.useRef<string | null>(null);
    const dragStartPointRef = React.useRef<{ x: number; y: number } | null>(null);
    const longPressTriggeredRef = React.useRef(false);
    const suppressNextActionClickRef = React.useRef(false);
    const longPressDelayMs = 175;

    const handleSwapButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onSwapClick?.();
    };

    const handleSwapInfoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (suppressNextActionClickRef.current) {
            suppressNextActionClickRef.current = false;
            event.preventDefault();
            return;
        }
        if (!onSwapClick) {
            return;
        }
        onSwapClick?.();
    };

    const handleSwapRemoveButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (suppressNextActionClickRef.current) {
            suppressNextActionClickRef.current = false;
            event.preventDefault();
            return;
        }
        onRemoveSwapClick?.();
    };

    const handleNoCollectButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onNoCollectToggle?.();
    };

    const clearLongPressTimer = React.useCallback(() => {
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const resetLongPressSession = React.useCallback(() => {
        clearLongPressTimer();
        dragPointerIdRef.current = null;
        dragPointerTypeRef.current = null;
        dragStartPointRef.current = null;
        longPressTriggeredRef.current = false;
    }, [clearLongPressTimer]);

    React.useEffect(() => {
        return () => {
            clearLongPressTimer();
        };
    }, [clearLongPressTimer]);

    const handleSwapInfoPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!isLongPressEnabled || !swapSlotId || dayIndex === undefined || !onSwapLongPressStart) {
            return;
        }
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
            event.preventDefault();
        }

        suppressNextActionClickRef.current = false;
        resetLongPressSession();
        const pointerId = event.pointerId;
        const pointerX = event.clientX;
        const pointerY = event.clientY;
        const previewElement = event.currentTarget.parentElement instanceof HTMLElement
            ? event.currentTarget.parentElement
            : event.currentTarget;
        const previewRect = previewElement.getBoundingClientRect();
        const pointerOffsetX = pointerX - previewRect.left;
        const pointerOffsetY = pointerY - previewRect.top;
        dragPointerIdRef.current = event.pointerId;
        dragPointerTypeRef.current = event.pointerType;
        dragStartPointRef.current = { x: event.clientX, y: event.clientY };
        if (event.pointerType === 'mouse') {
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                void 0;
            }
        }
        longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            suppressNextActionClickRef.current = true;
            onSwapLongPressStart({
                slotId: swapSlotId,
                teamIndex,
                dayIndex,
                pointerId,
                pointerType: event.pointerType,
                clientX: pointerX,
                clientY: pointerY,
                swappedPokemonName,
                previewWidth: previewRect.width,
                previewHeight: previewRect.height,
                pointerOffsetX,
                pointerOffsetY,
            });
        }, longPressDelayMs);
    };

    const handleSwapInfoPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (dragPointerIdRef.current !== event.pointerId || longPressTriggeredRef.current) {
            return;
        }
        const startPoint = dragStartPointRef.current;
        if (!startPoint) {
            return;
        }
        const movedDistance = Math.hypot(
            event.clientX - startPoint.x,
            event.clientY - startPoint.y
        );
        if (movedDistance > 8) {
            resetLongPressSession();
        }
    };

    const handleSwapInfoPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) {
            return;
        }
        if (dragPointerTypeRef.current === 'mouse') {
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
                void 0;
            }
        }
        resetLongPressSession();
    };

    const handleSwapInfoContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!isLongPressEnabled) {
            return;
        }
        event.preventDefault();
    };

    const handleSwapInfoPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) {
            return;
        }
        resetLongPressSession();
    };

    const renderSwapControl = () => {
        if (!showSwapButton) {
            return null;
        }

        return (
            <SwapIconButton
                type="button"
                className="swap-trigger"
                data-always-visible={shouldAlwaysShowSwapButton ? 'true' : 'false'}
                data-testid="timeline-cell-swap-toggle"
                onClick={handleSwapButtonClick}
                title={swapButtonTitle}
            >
                <TeamTimelineIcon
                    name="change"
                    className="swap-icon"
                    data-testid="timeline-cell-swap-icon"
                    data-icon-name="change"
                />
            </SwapIconButton>
        );
    };

    const renderNoCollectControl = () => {
        if (!showNoCollectButton) {
            return null;
        }

        return (
            <NoCollectIconButton
                type="button"
                className="no-collect-trigger"
                data-always-visible={shouldAlwaysShowNoCollectButton ? 'true' : 'false'}
                data-enabled={noCollectEnabled ? 'true' : 'false'}
                data-testid="timeline-cell-no-collect-toggle"
                onClick={handleNoCollectButtonClick}
                title={noCollectButtonTitle}
                aria-label={noCollectButtonTitle}
                style={{
                    right: showSwapButton ? '24px' : '2px',
                }}
            >
                <TeamTimelineIcon
                    name={noCollectEnabled ? 'pickup_none' : 'pickup'}
                    className="no-collect-icon"
                    data-testid="timeline-cell-no-collect-icon"
                    data-icon-name={noCollectEnabled ? 'pickup_none' : 'pickup'}
                />
            </NoCollectIconButton>
        );
    };

    const renderSwapInfo = () => {
        if (!hasSwapInfo || !swappedPokemonName) {
            return null;
        }
        return (
            <SwapInfoContainer
                $dragState={swapDragState}
                data-swap-drag-state={swapDragState}
            >
                <SwapInfoMainButton
                    $compactSwapLabel={isNarrowSwapInfoLayout}
                    type="button"
                    className="swap-info"
                    onClick={onSwapClick ? handleSwapInfoClick : undefined}
                    onPointerDown={isLongPressEnabled ? handleSwapInfoPointerDown : undefined}
                    onPointerMove={isLongPressEnabled ? handleSwapInfoPointerMove : undefined}
                    onPointerUp={isLongPressEnabled ? handleSwapInfoPointerUp : undefined}
                    onPointerCancel={isLongPressEnabled ? handleSwapInfoPointerCancel : undefined}
                    onContextMenu={isLongPressEnabled ? handleSwapInfoContextMenu : undefined}
                    title={swapButtonTitle}
                >
                    {!isNarrowSwapInfoLayout && (
                        <TeamTimelineIcon
                            name="change"
                            className="swap-icon"
                            data-testid="timeline-cell-swap-info-icon"
                            data-icon-name="change"
                        />
                    )}
                    <span
                        className="swap-name"
                        data-compact-swap-name={isNarrowSwapInfoLayout ? 'true' : 'false'}
                    >
                        {swappedPokemonName}
                    </span>
                </SwapInfoMainButton>
                {onRemoveSwapClick && (
                    <SwapRemoveButton
                        type="button"
                        className="swap-remove-trigger"
                        onClick={handleSwapRemoveButtonClick}
                        onPointerDown={isLongPressEnabled ? handleSwapInfoPointerDown : undefined}
                        onPointerMove={isLongPressEnabled ? handleSwapInfoPointerMove : undefined}
                        onPointerUp={isLongPressEnabled ? handleSwapInfoPointerUp : undefined}
                        onPointerCancel={isLongPressEnabled ? handleSwapInfoPointerCancel : undefined}
                        onContextMenu={isLongPressEnabled ? handleSwapInfoContextMenu : undefined}
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
            parts.push(`料理大成功+${Math.round(event.tastyChanceIncreasePercent ?? 0)}%`);
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
            <PokemonIconFrame data-testid="timeline-cell-pokemon-icon">
                <PokemonIcon idForm={pokemonIdForm} size={14} />
            </PokemonIconFrame>
        );
    };

    if (result === null) {
        return (
            <StyledCell
                $isSleeping={isSleeping}
                $hasSwap={hasSwap}
                $showSwapButton={showSwapButton}
                $showNoCollectButton={showNoCollectButton}
                $alwaysShowSwapButton={shouldAlwaysShowSwapButton}
                $compact={isCompactLayout}
                $simple={false}
                $fitToViewport={fitToViewport}
                $swapDragState={swapDragState}
                data-compact-layout={isCompactLayout ? 'true' : 'false'}
                data-swap-slot-id={swapSlotId}
                data-swap-team-index={teamIndex}
                data-swap-day-index={dayIndex}
                data-swap-drop-enabled={!disableSwapUi && swapSlotId !== undefined && dayIndex !== undefined ? 'true' : 'false'}
            >
                <EmptyContent>
                    {renderPokemonIcon()}
                </EmptyContent>
                {renderSwapInfo()}
                {renderNoCollectControl()}
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
    const simpleCookingCount = result.ingredients.reduce((sum, ingredient) => sum + ingredient.count, 0);

    if (displayMode === 'simple') {
        return (
            <StyledCell
                $isSleeping={isSleeping}
                $hasSwap={hasSwap}
                $showSwapButton={showSwapButton}
                $showNoCollectButton={showNoCollectButton}
                $alwaysShowSwapButton={shouldAlwaysShowSwapButton}
                $compact={isCompactLayout}
                $simple={true}
                $fitToViewport={fitToViewport}
                $swapDragState={swapDragState}
                data-compact-layout={isCompactLayout ? 'true' : 'false'}
                data-swap-slot-id={swapSlotId}
                data-swap-team-index={teamIndex}
                data-swap-day-index={dayIndex}
                data-swap-drop-enabled={!disableSwapUi && swapSlotId !== undefined && dayIndex !== undefined ? 'true' : 'false'}
                data-display-mode="simple"
            >
                <SimpleLayout>
                    {renderPokemonIcon()}
                    <SimpleRightArea>
                        <SimpleEnergyBarTrack>
                            <EnergyBarFill style={{ width: `${energyBarWidth}%` }} />
                        </SimpleEnergyBarTrack>
                        <SimpleMetricsLine>
                            <SimpleMetricBadge data-testid="timeline-cell-simple-berry">
                                <TeamTimelineIcon name="berry" />
                                {result.berryCount}
                            </SimpleMetricBadge>
                            <SimpleMetricBadge data-testid="timeline-cell-simple-cooking">
                                <TeamTimelineIcon name="cooking" />
                                {simpleCookingCount}
                            </SimpleMetricBadge>
                            {(result.skillTriggerCount > 0 || result.skillOverflowCount > 0) && (
                                <SimpleSkillIconStack>
                                    {result.skillTriggerCount > 0 && (
                                        <SimpleSkillIconItem data-testid="timeline-cell-simple-skill">
                                            <TeamTimelineIcon name="skill" data-simple-skill-icon="true" />
                                        </SimpleSkillIconItem>
                                    )}
                                    {result.skillOverflowCount > 0 && (
                                        <SimpleSkillIconItem
                                            data-testid="timeline-cell-simple-skill-none"
                                            data-skill-overflow="true"
                                        >
                                            <TeamTimelineIcon name="skill_none" data-simple-skill-icon="true" />
                                        </SimpleSkillIconItem>
                                    )}
                                </SimpleSkillIconStack>
                            )}
                        </SimpleMetricsLine>
                    </SimpleRightArea>
                </SimpleLayout>
                {renderSwapInfo()}
                {renderNoCollectControl()}
                {renderSwapControl()}
            </StyledCell>
        );
    }

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
    const tastyChanceDetail = (result.tastyChanceIncreasePercent ?? 0) > 0
        ? `料理大成功+${Math.round(result.tastyChanceIncreasePercent ?? 0)}%`
        : null;
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
        if (tastyChanceDetail && !hasProxyEventStyle) {
            skillDetailLines.push(
                <SkillDetailLine key="tasty-chance-extra">
                    {renderTextWithHealIcon(tastyChanceDetail, 'tasty-chance-extra')}
                </SkillDetailLine>
            );
        }
    } else if (result.skillTriggerCount > 0 || aggregateDetailParts.length > 0 || tastyChanceDetail) {
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
            if (tastyChanceDetail) {
                skillDetailLines.push(
                    <SkillDetailLine key="helper-boost-tasty-chance">
                        {renderTextWithHealIcon(tastyChanceDetail, 'helper-boost-tasty-chance')}
                    </SkillDetailLine>
                );
            }
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
            if (tastyChanceDetail) {
                skillDetailLines.push(
                    <SkillDetailLine key="aggregate-tasty-chance">
                        {renderTextWithHealIcon(tastyChanceDetail, 'aggregate-tasty-chance')}
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
            $showNoCollectButton={showNoCollectButton}
            $alwaysShowSwapButton={shouldAlwaysShowSwapButton}
            $compact={isCompactLayout}
            $simple={false}
            $fitToViewport={fitToViewport}
            $swapDragState={swapDragState}
            data-compact-layout={isCompactLayout ? 'true' : 'false'}
            data-swap-slot-id={swapSlotId}
            data-swap-team-index={teamIndex}
            data-swap-day-index={dayIndex}
            data-swap-drop-enabled={!disableSwapUi && swapSlotId !== undefined && dayIndex !== undefined ? 'true' : 'false'}
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
            {renderNoCollectControl()}
            {renderSwapControl()}
        </StyledCell>
    );
});

const StyledCell = styled('div')<{
    $isSleeping: boolean;
    $hasSwap?: boolean;
    $showSwapButton: boolean;
    $showNoCollectButton: boolean;
    $alwaysShowSwapButton: boolean;
    $compact: boolean;
    $simple: boolean;
    $fitToViewport: boolean;
    $swapDragState: SwapDragState;
}>(
    ({
        $isSleeping,
        $showSwapButton,
        $showNoCollectButton,
        $alwaysShowSwapButton,
        $compact,
        $simple,
        $fitToViewport,
        $swapDragState,
    }) => ({
    position: 'relative',
    width: $fitToViewport
        ? 'calc((100% - var(--timeline-time-cell-width, 40px)) / var(--timeline-team-size, 5))'
        : '100px',
    minWidth: $fitToViewport ? '0' : '100px',
    flexBasis: $fitToViewport
        ? 'calc((100% - var(--timeline-time-cell-width, 40px)) / var(--timeline-team-size, 5))'
        : 'auto',
    flexShrink: 0,
    boxSizing: 'border-box',
    minHeight: ($simple || $compact) ? '34px' : '109px',
    padding: $simple
        ? '2px'
        : $compact
            ? `2px 2px ${
                $showSwapButton || $showNoCollectButton
                    ? ($showSwapButton && $showNoCollectButton ? '42px' : '22px')
                    : '2px'
            }`
            : `3px 3px ${
                $showSwapButton || $showNoCollectButton
                    ? ($showSwapButton && $showNoCollectButton ? '46px' : '26px')
                    : '3px'
            }`,
    borderLeft: '0.5px solid #e2e2e2',
    backgroundColor: $swapDragState === 'target'
        ? '#fff4de'
        : ($isSleeping ? '#f5f6fb' : '#fff'),
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
    '& .no-collect-trigger': {
        opacity: $alwaysShowSwapButton ? 1 : 0,
        pointerEvents: $alwaysShowSwapButton ? 'auto' : 'none',
    },
    ...(!$alwaysShowSwapButton ? {
        '&:hover .swap-trigger, &:focus-within .swap-trigger, &:hover .no-collect-trigger, &:focus-within .no-collect-trigger': {
            opacity: 1,
            pointerEvents: 'auto',
        },
    } : {}),
    '@media (hover: none), (pointer: coarse)': {
        '& .swap-trigger': {
            opacity: 1,
            pointerEvents: 'auto',
        },
        '& .no-collect-trigger': {
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

const PokemonIconFrame = styled('span')({
    width: '14px',
    height: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    border: '0.5px solid #c8c8c8',
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    '& > *': {
        width: '100%',
        height: '100%',
        flexShrink: 0,
    },
    '& > div': {
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        border: 'none',
        borderRadius: '0',
        overflow: 'hidden',
    },
    '& img, & svg': {
        width: '100%',
        height: '100%',
        display: 'block',
    },
});

const EnergySummary = styled('div')({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
});

const SimpleLayout = styled('div')({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '3px',
    minHeight: '14px',
});

const SimpleRightArea = styled('div')({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
});

const SimpleEnergyBarTrack = styled('div')({
    width: '100%',
    height: '2px',
    borderRadius: '999px',
    backgroundColor: '#d5ead0',
    overflow: 'hidden',
});

const SimpleMetricsLine = styled('div')({
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    minHeight: '10px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
});

const SimpleMetricBadge = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    fontSize: '8px',
    lineHeight: '10px',
    letterSpacing: '-0.4px',
    color: '#111',
    '& svg': {
        width: '9px',
        height: '9px',
    },
});

const SimpleSkillIconStack = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
});

const SimpleSkillIconItem = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '8px',
    height: '8px',
    marginRight: '-2px',
    '&:last-of-type': {
        marginRight: '0',
    },
    '& svg': {
        width: '8px',
        height: '8px',
    },
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

const NoCollectIconButton = styled('button')({
    position: 'absolute',
    bottom: '2px',
    width: '20px',
    height: '20px',
    padding: 0,
    margin: 0,
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
    '&:hover': {
        backgroundColor: 'transparent',
    },
    '& .no-collect-icon': {
        width: '20px',
        height: '20px',
    },
});

const SwapIconButton = styled('button')({
    position: 'absolute',
    right: '2px',
    bottom: '2px',
    width: '20px',
    height: '20px',
    padding: 0,
    margin: 0,
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
    transition: 'opacity 120ms ease',
    '&:hover': {
        backgroundColor: 'transparent',
    },
    '& .swap-icon': {
        width: '20px',
        height: '20px',
    },
});

const SwapInfoContainer = styled('div')<{ $dragState: SwapDragState }>(({ $dragState }) => ({
    border: '1px solid #62d540',
    marginTop: 'auto',
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
    ...($dragState === 'source' ? {
        borderColor: '#1e64d6',
        backgroundColor: '#edf4ff',
    } : {}),
    ...($dragState === 'target' ? {
        borderColor: '#f59e0b',
        backgroundColor: '#fff4de',
    } : {}),
}));

const SwapInfoMainButton = styled('button')<{
    $compactSwapLabel: boolean;
}>(({ $compactSwapLabel }) => ({
    border: 'none',
    padding: $compactSwapLabel ? '1px 0 1px 2px' : '1px 0 1px 4px',
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
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    touchAction: 'none',
    '&:hover': {
        backgroundColor: '#edffe0',
    },
    '& .swap-icon': {
        width: '12px',
        height: '12px',
        flexShrink: 0,
    },
    '& .swap-name': {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        fontSize: $compactSwapLabel ? '9px' : '10px',
        lineHeight: $compactSwapLabel ? '11px' : '13px',
    },
}));

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
