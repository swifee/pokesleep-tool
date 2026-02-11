import React from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { TimeSlot, TimeSlotResult, PokemonSwap, SWAP_NONE_POKEMON_ID } from '../types/TimeSlotTypes';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import TimelineCell from './TimelineCell';

interface TimelineRowProps {
    slot: TimeSlot;
    originalSlotId: string;
    dayIndex: number;
    results: TimeSlotResult[];
    team: (PokemonBoxItem | null)[];
    swaps: PokemonSwap[];
    box: PokemonBox;
    onSwapClick?: (slotId: string, teamIndex: number, dayIndex: number) => void;
    isFirstSlot?: boolean;
    compactEmptyCells?: boolean;
    alwaysShowSwapButton?: boolean;
    isFirstTimelineSlot?: boolean;
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
    results,
    team,
    swaps,
    box,
    onSwapClick,
    isFirstSlot,
    compactEmptyCells = false,
    alwaysShowSwapButton = false,
    isFirstTimelineSlot = false,
}: TimelineRowProps) => {
    const { t } = useTranslation();

    const isSleeping = results.length > 0 ? results[0].isSleeping : false;
    const durationMinutes = results.length > 0 ? results[0].durationMinutes : 0;

    const getLabelText = (): string => {
        if (slot.sleepState === 'wake') {
            return slot.hasMeal ? '⏰🍴' : '⏰';
        }
        if (slot.sleepState === 'sleep') {
            return '🛌';
        }
        if (slot.hasMeal) {
            return '🍴';
        }
        return slot.customLabel || '';
    };

    const resultMap = new Map<number, TimeSlotResult>();
    results.forEach((result) => {
        resultMap.set(result.teamIndex, result);
    });

    const getSwapInfo = (slotId: string, teamIndex: number) => {
        const swap = swaps.find(
            s => s.dayIndex === dayIndex && s.slotId === slotId && s.teamSlotIndex === teamIndex
        );
        if (!swap) return { hasSwap: false, swappedPokemonName: undefined };

        if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
            return { hasSwap: true, swappedPokemonName: t('TeamTimeline.swap none') };
        }

        const pokemon = box.items.find((item: PokemonBoxItem) => item.id === swap.newPokemonId);
        return {
            hasSwap: true,
            swappedPokemonName: pokemon?.filledNickname(t) || `ID: ${swap.newPokemonId}`,
        };
    };

    return (
        <StyledRow>
            <TimeInfoCell>
                <div className="time">{slot.time}</div>
                {durationMinutes > 0 && (
                    <div className="duration">{formatDuration(durationMinutes)}</div>
                )}
                <div className="label">{getLabelText()}</div>
            </TimeInfoCell>

            {team.map((item, index) => {
                const result = resultMap.get(index) ?? null;
                const { hasSwap, swappedPokemonName } = getSwapInfo(originalSlotId, index);

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
                        isFirstSlot={isFirstSlot}
                        compactEmpty={compactEmptyCells}
                        alwaysShowSwapButton={alwaysShowSwapButton}
                        compactFirstSlot={isFirstTimelineSlot}
                        disableSwapUi={isFirstTimelineSlot}
                    />
                );
            })}
        </StyledRow>
    );
});

const StyledRow = styled('div')({
    display: 'flex',
    minWidth: '540px',
    width: 'max-content',
    backgroundColor: '#fff',
    borderRadius: '6px',
    overflow: 'hidden',
});

const TimeInfoCell = styled('div')({
    width: '40px',
    minWidth: '40px',
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
    },
});

export default TimelineRow;
