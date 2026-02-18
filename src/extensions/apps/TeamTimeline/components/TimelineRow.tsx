import React from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { TimeSlot, TimeSlotResult, PokemonSwap, SWAP_NONE_POKEMON_ID } from '../types/TimeSlotTypes';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import TimelineCell from './TimelineCell';
import type { SwapCellCoordinate, SwapDragState, SwapLongPressStartDetail } from './TimelineCell';
import TeamTimelineIcon from './TimelineIcons';

interface TimelineRowProps {
    slot: TimeSlot;
    originalSlotId: string;
    dayIndex: number;
    slotIndexInDay?: number;
    slotOrderById?: ReadonlyMap<string, number>;
    results: TimeSlotResult[];
    team: (PokemonBoxItem | null)[];
    swaps: PokemonSwap[];
    box: PokemonBox;
    onSwapClick?: (slotId: string, teamIndex: number, dayIndex: number) => void;
    onSwapRemoveClick?: (slotId: string, teamIndex: number, dayIndex: number, pokemonId: number) => void;
    isFirstSlot?: boolean;
    compactEmptyCells?: boolean;
    alwaysShowSwapButton?: boolean;
    isFirstTimelineSlot?: boolean;
    fitToViewport?: boolean;
    onSwapLongPressStart?: (detail: SwapLongPressStartDetail) => void;
    swapDragSource?: SwapCellCoordinate | null;
    swapDragTarget?: SwapCellCoordinate | null;
}

function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    if (mins === 30) return `${hours}.5h`;
    return `${hours}h ${mins}m`;
}

const TimelineRow = React.memo(({
    slot,
    originalSlotId,
    dayIndex,
    slotIndexInDay,
    slotOrderById,
    results,
    team,
    swaps,
    box,
    onSwapClick,
    onSwapRemoveClick,
    isFirstSlot,
    compactEmptyCells = false,
    alwaysShowSwapButton = false,
    isFirstTimelineSlot = false,
    fitToViewport = false,
    onSwapLongPressStart,
    swapDragSource = null,
    swapDragTarget = null,
}: TimelineRowProps) => {
    const { t } = useTranslation();

    const isSleeping = results.length > 0 ? results[0].isSleeping : false;
    const durationMinutes = results.length > 0 ? results[0].durationMinutes : 0;

    const getLabelContent = (): React.ReactNode => {
        if (slot.sleepState === 'wake') {
            return (
                <span className="label-icons">
                    <TeamTimelineIcon name="wakeup" data-testid="timeline-row-label-wakeup" />
                    {slot.hasMeal && <TeamTimelineIcon name="cooking" data-testid="timeline-row-label-cooking" />}
                </span>
            );
        }
        if (slot.sleepState === 'sleep') {
            return <TeamTimelineIcon name="sleep" data-testid="timeline-row-label-sleep" />;
        }
        if (slot.hasMeal) {
            return <TeamTimelineIcon name="cooking" data-testid="timeline-row-label-cooking" />;
        }
        return slot.customLabel || '';
    };

    const resultMap = new Map<number, TimeSlotResult>();
    results.forEach((result) => {
        resultMap.set(result.teamIndex, result);
    });

    const getSwapDisplayName = (pokemonId: number): string => {
        if (pokemonId === SWAP_NONE_POKEMON_ID) {
            return t('TeamTimeline.swap none');
        }
        const pokemon = box.items.find((item: PokemonBoxItem) => item.id === pokemonId);
        return pokemon?.filledNickname(t) || `ID: ${pokemonId}`;
    };

    const getSwapInfo = (slotId: string, teamIndex: number) => {
        const directSwap = swaps.find(
            s => s.dayIndex === dayIndex && s.slotId === slotId && s.teamSlotIndex === teamIndex
        );
        if (directSwap) {
            return {
                hasSwap: true,
                swappedPokemonName: getSwapDisplayName(directSwap.newPokemonId),
                swappedPokemonId: directSwap.newPokemonId,
                removable: true,
            };
        }

        return {
            hasSwap: false,
            swappedPokemonName: undefined,
            swappedPokemonId: undefined,
            removable: false,
        };
    };

    const currentSlotOrder = slotOrderById?.get(originalSlotId) ?? slotIndexInDay;
    const getLatestPriorSwap = (teamIndex: number): PokemonSwap | undefined => {
        if (currentSlotOrder === undefined) {
            return undefined;
        }

        let latest: PokemonSwap | undefined;
        let latestDayIndex = -1;
        let latestSlotOrder = -1;

        for (const swap of swaps) {
            if (swap.teamSlotIndex !== teamIndex) {
                continue;
            }
            const swapSlotOrder = slotOrderById?.get(swap.slotId);
            if (swapSlotOrder === undefined) {
                continue;
            }
            const isBeforeCurrentSlot =
                swap.dayIndex < dayIndex ||
                (swap.dayIndex === dayIndex && swapSlotOrder < currentSlotOrder);
            if (!isBeforeCurrentSlot) {
                continue;
            }

            const isNewerSwap =
                swap.dayIndex > latestDayIndex ||
                (swap.dayIndex === latestDayIndex && swapSlotOrder > latestSlotOrder);
            if (!isNewerSwap) {
                continue;
            }

            latest = swap;
            latestDayIndex = swap.dayIndex;
            latestSlotOrder = swapSlotOrder;
        }

        return latest;
    };

    return (
        <StyledRow $fitToViewport={fitToViewport}>
            <TimeInfoCell $fitToViewport={fitToViewport}>
                <div className="time">{slot.time}</div>
                {durationMinutes > 0 && (
                    <div className="duration">{formatDuration(durationMinutes)}</div>
                )}
                <div className="label">{getLabelContent()}</div>
            </TimeInfoCell>

            {team.map((item, index) => {
                const result = resultMap.get(index) ?? null;
                const { hasSwap, swappedPokemonName, swappedPokemonId, removable } = getSwapInfo(originalSlotId, index);
                const resultPokemon = result ? box.getById(result.pokemonId) : null;
                const latestPriorSwap = getLatestPriorSwap(index);
                const priorSwapPokemonIdForm =
                    latestPriorSwap === undefined
                        ? undefined
                        : latestPriorSwap.newPokemonId === SWAP_NONE_POKEMON_ID
                            ? undefined
                            : box.getById(latestPriorSwap.newPokemonId)?.iv.idForm;
                const pokemonIdForm = resultPokemon?.iv.idForm
                    ?? (latestPriorSwap !== undefined ? priorSwapPokemonIdForm : item?.iv.idForm);
                const isDragSource =
                    swapDragSource !== null &&
                    swapDragSource.slotId === originalSlotId &&
                    swapDragSource.teamIndex === index &&
                    swapDragSource.dayIndex === dayIndex;
                const isDragTarget =
                    swapDragTarget !== null &&
                    swapDragTarget.slotId === originalSlotId &&
                    swapDragTarget.teamIndex === index &&
                    swapDragTarget.dayIndex === dayIndex;
                const swapDragState: SwapDragState = isDragSource
                    ? 'source'
                    : isDragTarget
                        ? 'target'
                        : 'idle';
                const canDragSwap = removable && swappedPokemonId !== undefined && !isFirstTimelineSlot;

                return (
                    <TimelineCell
                        key={index}
                        result={result}
                        isSleeping={isSleeping}
                        slotId={slot.id}
                        teamIndex={index}
                        hasSwap={hasSwap}
                        swappedPokemonName={swappedPokemonName}
                        onSwapClick={() => onSwapClick?.(originalSlotId, index, dayIndex)}
                        onRemoveSwapClick={removable && swappedPokemonId !== undefined
                            ? () => onSwapRemoveClick?.(originalSlotId, index, dayIndex, swappedPokemonId)
                            : undefined}
                        isFirstSlot={isFirstSlot}
                        compactEmpty={compactEmptyCells}
                        alwaysShowSwapButton={alwaysShowSwapButton}
                        compactFirstSlot={isFirstTimelineSlot}
                        disableSwapUi={isFirstTimelineSlot}
                        pokemonIdForm={pokemonIdForm}
                        fitToViewport={fitToViewport}
                        swapSlotId={originalSlotId}
                        dayIndex={dayIndex}
                        swapDraggable={canDragSwap}
                        onSwapLongPressStart={onSwapLongPressStart}
                        swapDragState={swapDragState}
                    />
                );
            })}
        </StyledRow>
    );
});

const StyledRow = styled('div')<{
    $fitToViewport: boolean;
}>(({ $fitToViewport }) => ({
    display: 'flex',
    minWidth: $fitToViewport ? '0' : '540px',
    width: $fitToViewport ? '100%' : 'max-content',
    backgroundColor: '#fff',
    borderRadius: '6px',
    overflow: 'hidden',
}));

const TimeInfoCell = styled('div')<{
    $fitToViewport: boolean;
}>(({ $fitToViewport }) => ({
    width: $fitToViewport ? 'var(--timeline-time-cell-width, 28px)' : '40px',
    minWidth: $fitToViewport ? 'var(--timeline-time-cell-width, 28px)' : '40px',
    flexShrink: 0,
    boxSizing: 'border-box',
    padding: '3px',
    fontFamily: '"M PLUS 1p", sans-serif',
    borderRight: '0.5px solid #e2e2e2',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    color: '#000',

    '& .time': {
        fontSize: '12px',
        lineHeight: '15px',
        letterSpacing: '-0.48px',
    },

    '& .duration': {
        fontSize: '10px',
        lineHeight: '13px',
        letterSpacing: '-0.5px',
    },

    '& .label': {
        fontSize: '10px',
        lineHeight: '13px',
        letterSpacing: '-0.5px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '13px',
    },
    '& .label-icons': {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1px',
    },
    '& .label svg': {
        width: '10px',
        height: '10px',
    },
}));

export default TimelineRow;
