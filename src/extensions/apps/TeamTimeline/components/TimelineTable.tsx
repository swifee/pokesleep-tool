import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { styled } from '@mui/system';
import SettingsIcon from '@mui/icons-material/Settings';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import { TimeSlot, SimulationResult, PokemonSwap } from '../types/TimeSlotTypes';
import TimelineRow from './TimelineRow';
import type { SwapCellCoordinate, SwapLongPressStartDetail } from './TimelineCell';
import CookingResultRow from './CookingResultRow';
import DailySummaryRow from './DailySummaryRow';
import TeamSummaryRow from './TeamSummaryRow';
import { buildExpandedTimeline } from '../utils/TimelineDayExpansion';

interface TimelineTableProps {
  team: (PokemonBoxItem | null)[];
  timeSlots: TimeSlot[];
  simulationDays: number;
  result: SimulationResult;
  swaps: PokemonSwap[];
  box: PokemonBox;
  onSwapClick?: (slotId: string, teamIndex: number, dayIndex: number) => void;
  onSwapSeriesMove?: (
    fromSlotId: string,
    fromTeamIndex: number,
    fromDayIndex: number,
    toSlotId: string,
    toTeamIndex: number,
    toDayIndex: number
  ) => void;
  onSwapRemoveClick?: (slotId: string, teamIndex: number, dayIndex: number, pokemonId: number) => void;
  onHeaderSlotClick?: (index: number) => void;
  onOpenTimeSlotSettings?: () => void;
  showSummaryRows?: boolean;
  compactEmptyCells?: boolean;
  alwaysShowSwapButton?: boolean;
}

interface SwapDragPreview {
  x: number;
  y: number;
  label: string;
  width: number;
  height: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
}

const TimelineTable = React.memo(({
  team,
  timeSlots,
  simulationDays,
  result,
  swaps,
  box,
  onSwapClick,
  onSwapSeriesMove,
  onSwapRemoveClick,
  onHeaderSlotClick,
  onOpenTimeSlotSettings,
  showSummaryRows = true,
  compactEmptyCells = false,
  alwaysShowSwapButton = false,
}: TimelineTableProps) => {
  const { t } = useTranslation();
  const [swapDragSource, setSwapDragSource] = useState<SwapCellCoordinate | null>(null);
  const [swapDragTarget, setSwapDragTarget] = useState<SwapCellCoordinate | null>(null);
  const [activeSwapPointerId, setActiveSwapPointerId] = useState<number | null>(null);
  const [activeSwapPointerType, setActiveSwapPointerType] = useState<string | null>(null);
  const [swapDragPreview, setSwapDragPreview] = useState<SwapDragPreview | null>(null);
  const [swapDragLifted, setSwapDragLifted] = useState(false);
  const swapDragTargetRef = useRef<SwapCellCoordinate | null>(null);
  const swapDragPreviewRef = useRef<SwapDragPreview | null>(null);
  const swapDragLiftedRef = useRef(false);
  const swapDragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragGhostRafRef = useRef<number | null>(null);
  const dragLiftDistancePx = 10;
  const fitToViewport = compactEmptyCells;
  const tableSizingStyle = fitToViewport
    ? ({
      '--timeline-time-cell-width': '28px',
      '--timeline-team-size': String(Math.max(team.length, 1)),
    } as React.CSSProperties)
    : undefined;

  const expandedTimeline = useMemo(
    () => buildExpandedTimeline(timeSlots, simulationDays),
    [timeSlots, simulationDays]
  );
  const slotOrderById = useMemo(() => {
    const entries = expandedTimeline.baseDaySlots.map((baseSlot, index) => [baseSlot.id, index] as const);
    return new Map<string, number>(entries);
  }, [expandedTimeline.baseDaySlots]);

  const dayBandBySlotId = useMemo(() => {
    const entries = expandedTimeline.dayBands.map(band => [band.afterDisplaySlotId, band.dayNumber] as const);
    return new Map<string, number>(entries);
  }, [expandedTimeline.dayBands]);
  const shouldShowFirstDayBand = simulationDays >= 2 && expandedTimeline.expandedSlots.length > 0;

  const isSameSwapCell = useCallback((
    left: SwapCellCoordinate | null,
    right: SwapCellCoordinate | null
  ): boolean => {
    if (!left || !right) {
      return left === right;
    }
    return (
      left.slotId === right.slotId &&
      left.teamIndex === right.teamIndex &&
      left.dayIndex === right.dayIndex
    );
  }, []);

  const updateSwapDragTarget = useCallback((nextTarget: SwapCellCoordinate | null) => {
    if (isSameSwapCell(nextTarget, swapDragTargetRef.current)) {
      return;
    }
    swapDragTargetRef.current = nextTarget;
    setSwapDragTarget(nextTarget);
  }, [isSameSwapCell]);

  const flushDragGhostPosition = useCallback(() => {
    dragGhostRafRef.current = null;
    const ghostElement = swapDragGhostRef.current;
    const preview = swapDragPreviewRef.current;
    if (!ghostElement || !preview) {
      return;
    }
    const translateX = preview.x - preview.pointerOffsetX;
    const translateY = preview.y - preview.pointerOffsetY - (swapDragLiftedRef.current ? dragLiftDistancePx : 0);
    ghostElement.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${swapDragLiftedRef.current ? 1 : 0.96})`;
  }, [dragLiftDistancePx]);

  const scheduleDragGhostPositionUpdate = useCallback(() => {
    if (dragGhostRafRef.current !== null) {
      return;
    }
    dragGhostRafRef.current = requestAnimationFrame(flushDragGhostPosition);
  }, [flushDragGhostPosition]);

  const clearSwapDragSession = useCallback(() => {
    if (dragGhostRafRef.current !== null) {
      cancelAnimationFrame(dragGhostRafRef.current);
      dragGhostRafRef.current = null;
    }
    swapDragTargetRef.current = null;
    swapDragPreviewRef.current = null;
    swapDragLiftedRef.current = false;
    setSwapDragSource(null);
    setSwapDragTarget(null);
    setActiveSwapPointerId(null);
    setActiveSwapPointerType(null);
    setSwapDragPreview(null);
    setSwapDragLifted(false);
  }, []);

  const resolveSwapCellFromPoint = useCallback((clientX: number, clientY: number): SwapCellCoordinate | null => {
    const pointedElement = document.elementFromPoint(clientX, clientY);
    const swapCell = pointedElement?.closest('[data-swap-drop-enabled="true"]');
    if (!(swapCell instanceof HTMLElement)) {
      return null;
    }
    const slotId = swapCell.dataset.swapSlotId;
    const teamIndexRaw = swapCell.dataset.swapTeamIndex;
    const dayIndexRaw = swapCell.dataset.swapDayIndex;
    if (!slotId || teamIndexRaw === undefined || dayIndexRaw === undefined) {
      return null;
    }
    const teamIndex = Number.parseInt(teamIndexRaw, 10);
    const dayIndex = Number.parseInt(dayIndexRaw, 10);
    if (!Number.isFinite(teamIndex) || !Number.isFinite(dayIndex)) {
      return null;
    }
    return { slotId, teamIndex, dayIndex };
  }, []);

  const handleSwapLongPressStart = useCallback((detail: SwapLongPressStartDetail) => {
    if (activeSwapPointerId !== null) {
      return;
    }
    const sourceCell: SwapCellCoordinate = {
      slotId: detail.slotId,
      teamIndex: detail.teamIndex,
      dayIndex: detail.dayIndex,
    };
    setSwapDragSource(sourceCell);
    setActiveSwapPointerId(detail.pointerId);
    setActiveSwapPointerType(detail.pointerType ?? null);
    const initialCandidate = resolveSwapCellFromPoint(detail.clientX, detail.clientY);
    const initialTarget = isSameSwapCell(initialCandidate, sourceCell) ? null : initialCandidate;
    updateSwapDragTarget(initialTarget);
    const preview: SwapDragPreview = {
      x: detail.clientX,
      y: detail.clientY,
      label: detail.swappedPokemonName ?? t('TeamTimeline.swap moving', '移動中'),
      width: detail.previewWidth ?? 160,
      height: detail.previewHeight ?? 20,
      pointerOffsetX: detail.pointerOffsetX ?? 0,
      pointerOffsetY: detail.pointerOffsetY ?? 0,
    };
    swapDragPreviewRef.current = preview;
    setSwapDragPreview(preview);
    swapDragLiftedRef.current = true;
    setSwapDragLifted(true);
    scheduleDragGhostPositionUpdate();
  }, [activeSwapPointerId, isSameSwapCell, resolveSwapCellFromPoint, scheduleDragGhostPositionUpdate, t, updateSwapDragTarget]);

  useEffect(() => {
    swapDragPreviewRef.current = swapDragPreview;
  }, [swapDragPreview]);

  useEffect(() => {
    swapDragLiftedRef.current = swapDragLifted;
    if (swapDragPreviewRef.current) {
      scheduleDragGhostPositionUpdate();
    }
  }, [scheduleDragGhostPositionUpdate, swapDragLifted]);

  useEffect(() => {
    if (activeSwapPointerId === null || swapDragSource === null) {
      return;
    }

    const updateDragPosition = (clientX: number, clientY: number) => {
      const targetCandidate = resolveSwapCellFromPoint(clientX, clientY);
      const nextTarget = isSameSwapCell(targetCandidate, swapDragSource) ? null : targetCandidate;
      updateSwapDragTarget(nextTarget);
      const preview = swapDragPreviewRef.current;
      if (!preview) {
        return;
      }
      swapDragPreviewRef.current = {
        ...preview,
        x: clientX,
        y: clientY,
      };
      scheduleDragGhostPositionUpdate();
    };

    const commitDrop = (clientX: number, clientY: number) => {
      const finalTargetCandidate = resolveSwapCellFromPoint(clientX, clientY);
      const finalTarget = isSameSwapCell(finalTargetCandidate, swapDragSource)
        ? null
        : finalTargetCandidate;
      if (finalTarget) {
        onSwapSeriesMove?.(
          swapDragSource.slotId,
          swapDragSource.teamIndex,
          swapDragSource.dayIndex,
          finalTarget.slotId,
          finalTarget.teamIndex,
          finalTarget.dayIndex
        );
      }
      clearSwapDragSession();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeSwapPointerId) {
        return;
      }
      if (activeSwapPointerType === 'touch') {
        return;
      }
      updateDragPosition(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activeSwapPointerId) {
        return;
      }
      if (activeSwapPointerType === 'touch') {
        return;
      }
      commitDrop(event.clientX, event.clientY);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== activeSwapPointerId) {
        return;
      }
      if (activeSwapPointerType === 'touch') {
        return;
      }
      clearSwapDragSession();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (activeSwapPointerType !== 'touch') {
        return;
      }
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) {
        return;
      }
      event.preventDefault();
      updateDragPosition(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (activeSwapPointerType !== 'touch') {
        return;
      }
      const touch = event.changedTouches[0] ?? event.touches[0];
      if (!touch) {
        clearSwapDragSession();
        return;
      }
      commitDrop(touch.clientX, touch.clientY);
    };

    const handleTouchCancel = () => {
      if (activeSwapPointerType !== 'touch') {
        return;
      }
      clearSwapDragSession();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    activeSwapPointerId,
    activeSwapPointerType,
    clearSwapDragSession,
    isSameSwapCell,
    onSwapSeriesMove,
    resolveSwapCellFromPoint,
    scheduleDragGhostPositionUpdate,
    swapDragSource,
    updateSwapDragTarget,
  ]);

  useEffect(() => {
    return () => {
      if (dragGhostRafRef.current !== null) {
        cancelAnimationFrame(dragGhostRafRef.current);
      }
    };
  }, []);

  const renderHeaderSlotContent = (pokemon: PokemonBoxItem | null): React.ReactNode => {
    if (!pokemon) {
      return <EmptySlot>-</EmptySlot>;
    }

    return (
      <>
        <PokemonLevelLine>
          <span className="lv">Lv.</span>
          <span>{pokemon.iv.level}</span>
        </PokemonLevelLine>
        <PokemonIconBox>
          <PokemonIcon idForm={pokemon.iv.idForm} size={30} />
        </PokemonIconBox>
        <PokemonNameLine>{pokemon.filledNickname(t)}</PokemonNameLine>
      </>
    );
  };

  return (
    <TableContainer
      $fitToViewport={fitToViewport}
      style={tableSizingStyle}
      data-testid="timeline-table-container"
      data-fit-to-viewport={fitToViewport ? 'true' : 'false'}
    >
      <HeaderRow $fitToViewport={fitToViewport}>
        <CornerHeaderCell $fitToViewport={fitToViewport} data-testid="timeline-corner-header-cell">
          {onOpenTimeSlotSettings && (
            <CornerHeaderButton
              type="button"
              onClick={onOpenTimeSlotSettings}
              data-testid="timeline-corner-settings-button"
              title={t('TeamTimeline.open time slots', '時間帯設定へ移動')}
              aria-label={t('TeamTimeline.open time slots', '時間帯設定へ移動')}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </CornerHeaderButton>
          )}
        </CornerHeaderCell>
        {team.map((pokemon, index) => (
          <PokemonHeaderCell key={index} $fitToViewport={fitToViewport}>
            {onHeaderSlotClick ? (
              <HeaderSlotButton
                type="button"
                onClick={() => onHeaderSlotClick(index)}
                data-testid={`timeline-header-slot-button-${index}`}
                title={pokemon?.filledNickname(t)}
              >
                {renderHeaderSlotContent(pokemon)}
              </HeaderSlotButton>
            ) : (
              renderHeaderSlotContent(pokemon)
            )}
          </PokemonHeaderCell>
        ))}
      </HeaderRow>

      <DataSection>
        {shouldShowFirstDayBand && (
          <DayBandRow>
            {t('TeamTimeline.day label', '{{day}}日目', { day: 1 })}
          </DayBandRow>
        )}
        {expandedTimeline.expandedSlots.map((expandedSlot) => {
          const isFirstTimelineSlot = expandedSlot.dayIndex === 0 && expandedSlot.slotIndexInDay === 0;
          const slotResults = result.slotResults.get(expandedSlot.slot.id)
            || result.slotResults.get(expandedSlot.originalSlotId)
            || [];
          const dayBandNumber = dayBandBySlotId.get(expandedSlot.slot.id);
          return (
            <React.Fragment key={expandedSlot.slot.id}>
              <TimelineRow
                slot={expandedSlot.slot}
                originalSlotId={expandedSlot.originalSlotId}
                dayIndex={expandedSlot.dayIndex}
                slotIndexInDay={expandedSlot.slotIndexInDay}
                slotOrderById={slotOrderById}
                results={slotResults}
                team={team}
                swaps={swaps}
                box={box}
                onSwapClick={onSwapClick}
                onSwapRemoveClick={onSwapRemoveClick}
                isFirstSlot={expandedSlot.slotIndexInDay === 0}
                compactEmptyCells={compactEmptyCells}
                alwaysShowSwapButton={alwaysShowSwapButton}
                isFirstTimelineSlot={isFirstTimelineSlot}
                fitToViewport={fitToViewport}
                onSwapLongPressStart={handleSwapLongPressStart}
                swapDragSource={swapDragSource}
                swapDragTarget={swapDragTarget}
              />
              {result.cookingResult && expandedSlot.slot.hasMeal && (() => {
                  const cookingEvent = result.cookingResult!.events.find(
                      e => e.mealSlotId === expandedSlot.slot.id
                  );
                  if (!cookingEvent || (cookingEvent.recipeName == null && cookingEvent.cookingEP === 0)) {
                      return null;
                  }
                  return (
                      <CookingResultRow
                          event={cookingEvent}
                          teamSize={team.length}
                      />
                  );
              })()}
              {dayBandNumber !== undefined && (
                <DayBandRow>
                  {t('TeamTimeline.day label', '{{day}}日目', { day: dayBandNumber })}
                </DayBandRow>
              )}
            </React.Fragment>
          );
        })}
      </DataSection>

      {swapDragPreview && typeof document !== 'undefined' && document.body && createPortal(
        <SwapDragGhost
          ref={swapDragGhostRef}
          data-testid="timeline-swap-drag-ghost"
          style={{
            left: '0px',
            top: '0px',
            width: `${(swapDragPreviewRef.current ?? swapDragPreview).width}px`,
            height: `${(swapDragPreviewRef.current ?? swapDragPreview).height}px`,
            transform: `translate3d(${
              (swapDragPreviewRef.current ?? swapDragPreview).x - (swapDragPreviewRef.current ?? swapDragPreview).pointerOffsetX
            }px, ${
              (swapDragPreviewRef.current ?? swapDragPreview).y - (swapDragPreviewRef.current ?? swapDragPreview).pointerOffsetY - (swapDragLifted ? dragLiftDistancePx : 0)
            }px, 0) scale(${swapDragLifted ? 1 : 0.96})`,
          }}
        >
          <SwapHorizIcon className="swap-icon" sx={{ fontSize: 14 }} />
          <span className="swap-name">{swapDragPreview.label}</span>
          <span className="swap-remove" aria-hidden="true">
            <CloseIcon className="swap-remove-icon" sx={{ fontSize: 14 }} />
          </span>
        </SwapDragGhost>,
        document.body
      )}

      {showSummaryRows && (
        <>
          <TeamSummaryRow
            teamSummary={result.teamSummary}
            layoutMode="details"
            simulationDays={simulationDays}
          />
          <DailySummaryRow
            dailySummaries={result.dailySummaries}
            box={box}
            layoutMode="details"
            simulationDays={simulationDays}
          />
        </>
      )}
    </TableContainer>
  );
});

const TableContainer = styled('div')<{ $fitToViewport: boolean }>(({ $fitToViewport }) => ({
  width: $fitToViewport ? '100%' : 'max-content',
  minWidth: $fitToViewport ? '0' : '540px',
  maxWidth: 'none',
  backgroundColor: 'transparent',
  borderRadius: '6px',
  padding: '0',
  overflow: 'visible',
}));

const HeaderRow = styled('div')<{ $fitToViewport: boolean }>(({ $fitToViewport }) => ({
  display: 'flex',
  alignItems: 'stretch',
  width: $fitToViewport ? '100%' : 'max-content',
  backgroundColor: '#fff',
  borderRadius: '6px 6px 0 0',
  overflow: 'hidden',
}));

const CornerHeaderCell = styled('div')<{ $fitToViewport: boolean }>(({ $fitToViewport }) => ({
  width: $fitToViewport ? 'var(--timeline-time-cell-width, 28px)' : '40px',
  minWidth: $fitToViewport ? 'var(--timeline-time-cell-width, 28px)' : '40px',
  flexShrink: 0,
  boxSizing: 'border-box',
  padding: '3px',
  borderRight: '0.5px solid #e2e2e2',
  fontFamily: '"M PLUS 1p", sans-serif',
  color: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const CornerHeaderButton = styled('button')({
  width: '100%',
  height: '100%',
  border: 'none',
  padding: 0,
  margin: 0,
  backgroundColor: 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#3a4a62',
  cursor: 'pointer',
  borderRadius: '4px',
  '&:hover': {
    backgroundColor: '#f4f8ff',
    color: '#1e64d6',
  },
});

const PokemonHeaderCell = styled('div')<{ $fitToViewport: boolean }>(({ $fitToViewport }) => ({
  width: $fitToViewport
    ? 'calc((100% - var(--timeline-time-cell-width, 28px)) / var(--timeline-team-size, 5))'
    : '100px',
  minWidth: $fitToViewport ? '0' : '100px',
  flexShrink: $fitToViewport ? 1 : 0,
  flexGrow: $fitToViewport ? 1 : 0,
  flexBasis: $fitToViewport
    ? 'calc((100% - var(--timeline-time-cell-width, 28px)) / var(--timeline-team-size, 5))'
    : 'auto',
  boxSizing: 'border-box',
  borderRight: '0.5px solid #e2e2e2',
  padding: '3px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1px',
  '&:last-of-type': {
    borderRight: 'none',
  },
}));

const HeaderSlotButton = styled('button')({
  width: '100%',
  height: '100%',
  border: 'none',
  padding: 0,
  margin: 0,
  backgroundColor: 'transparent',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1px',
  cursor: 'pointer',
  fontFamily: '"M PLUS 1p", sans-serif',
  '&:hover': {
    backgroundColor: '#f8fbff',
  },
});

const PokemonIconBox = styled('div')({
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  overflow: 'visible',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const PokemonLevelLine = styled('div')({
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  gap: '1px',
  fontSize: '10px',
  lineHeight: '13px',
  letterSpacing: '-0.5px',
  fontFamily: '"M PLUS 1p", sans-serif',
  '& .lv': {
    color: '#62d540',
  },
});

const PokemonNameLine = styled('div')({
  width: '100%',
  fontSize: '10px',
  lineHeight: '13px',
  letterSpacing: '-0.5px',
  color: '#000',
  textAlign: 'center',
  fontFamily: '"M PLUS 1p", sans-serif',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const EmptySlot = styled('div')({
  fontSize: '12px',
  color: '#999',
});

const DataSection = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  marginTop: '5px',
  marginBottom: '5px',
});

const DayBandRow = styled('div')({
  margin: '0 0 1px',
  padding: '2px 8px',
  border: '1px solid #bbdefb',
  borderRadius: '6px',
  backgroundColor: '#e3f2fd',
  color: '#0d47a1',
  fontSize: '10px',
  fontWeight: 700,
  textAlign: 'center',
  lineHeight: '13px',
  letterSpacing: '-0.5px',
});

const SwapDragGhost = styled('div')({
  position: 'fixed',
  zIndex: 1300,
  pointerEvents: 'none',
  border: '1px solid #62d540',
  borderRadius: '6px',
  backgroundColor: '#f6ffef',
  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.18)',
  boxSizing: 'border-box',
  padding: '1px 0 1px 4px',
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  color: '#000',
  fontSize: '10px',
  lineHeight: '13px',
  letterSpacing: '-0.4px',
  fontFamily: '"M PLUS 1p", sans-serif',
  willChange: 'transform',
  '& .swap-icon': {
    color: '#62d540',
    flexShrink: 0,
  },
  '& .swap-name': {
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& .swap-remove': {
    width: '18px',
    height: '18px',
    margin: '0 2px 0 0',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#62d540',
    flexShrink: 0,
  },
  '& .swap-remove-icon': {
    color: '#62d540',
  },
});

export default TimelineTable;
