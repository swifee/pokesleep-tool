import React, { useMemo } from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import { TimeSlot, SimulationResult, PokemonSwap } from '../types/TimeSlotTypes';
import TimelineRow from './TimelineRow';
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
  onHeaderSlotClick?: (index: number) => void;
  showSummaryRows?: boolean;
  compactEmptyCells?: boolean;
  alwaysShowSwapButton?: boolean;
}

const TimelineTable = React.memo(({
  team,
  timeSlots,
  simulationDays,
  result,
  swaps,
  box,
  onSwapClick,
  onHeaderSlotClick,
  showSummaryRows = true,
  compactEmptyCells = false,
  alwaysShowSwapButton = false,
}: TimelineTableProps) => {
  const { t } = useTranslation();

  const expandedTimeline = useMemo(
    () => buildExpandedTimeline(timeSlots, simulationDays),
    [timeSlots, simulationDays]
  );

  const dayBandBySlotId = useMemo(() => {
    const entries = expandedTimeline.dayBands.map(band => [band.afterDisplaySlotId, band.dayNumber] as const);
    return new Map<string, number>(entries);
  }, [expandedTimeline.dayBands]);
  const shouldShowFirstDayBand = simulationDays >= 2 && expandedTimeline.expandedSlots.length > 0;

  return (
    <TableContainer>
      <HeaderRow>
        <CornerHeaderCell aria-hidden="true" data-testid="timeline-corner-header-cell" />
        {team.map((pokemon, index) => (
          <PokemonHeaderCell key={index}>
            {onHeaderSlotClick ? (
              <HeaderSlotButton
                type="button"
                onClick={() => onHeaderSlotClick(index)}
                data-testid={`timeline-header-slot-button-${index}`}
                title={pokemon?.filledNickname(t)}
              >
                {pokemon ? (
                  <>
                    <PokemonIconBox>
                      <PokemonIcon idForm={pokemon.iv.idForm} size={30} />
                    </PokemonIconBox>
                    <PokemonHeaderText>
                      <span className="name">{pokemon.filledNickname(t)}</span>
                      <span className="level-label">Lv.</span>
                      <span className="level-value">{pokemon.iv.level}</span>
                    </PokemonHeaderText>
                  </>
                ) : (
                  <EmptySlot>-</EmptySlot>
                )}
              </HeaderSlotButton>
            ) : (
              <>
                {pokemon ? (
                  <>
                    <PokemonIconBox>
                      <PokemonIcon idForm={pokemon.iv.idForm} size={30} />
                    </PokemonIconBox>
                    <PokemonHeaderText>
                      <span className="name">{pokemon.filledNickname(t)}</span>
                      <span className="level-label">Lv.</span>
                      <span className="level-value">{pokemon.iv.level}</span>
                    </PokemonHeaderText>
                  </>
                ) : (
                  <EmptySlot>-</EmptySlot>
                )}
              </>
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
                results={slotResults}
                team={team}
                swaps={swaps}
                box={box}
                onSwapClick={onSwapClick}
                isFirstSlot={expandedSlot.slotIndexInDay === 0}
                compactEmptyCells={compactEmptyCells}
                alwaysShowSwapButton={alwaysShowSwapButton}
                isFirstTimelineSlot={isFirstTimelineSlot}
              />
              {dayBandNumber !== undefined && (
                <DayBandRow>
                  {t('TeamTimeline.day label', '{{day}}日目', { day: dayBandNumber })}
                </DayBandRow>
              )}
            </React.Fragment>
          );
        })}
      </DataSection>

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

const TableContainer = styled('div')({
  width: 'max-content',
  minWidth: '540px',
  maxWidth: 'none',
  backgroundColor: 'transparent',
  borderRadius: '6px',
  padding: '0',
  overflow: 'visible',
});

const HeaderRow = styled('div')({
  display: 'flex',
  alignItems: 'stretch',
  backgroundColor: '#fff',
  borderRadius: '6px 6px 0 0',
  overflow: 'hidden',
});

const CornerHeaderCell = styled('div')({
  width: '40px',
  minWidth: '40px',
  flexShrink: 0,
  boxSizing: 'border-box',
  padding: '3px',
  borderRight: '0.5px solid #e2e2e2',
  fontFamily: '"M PLUS 1p", sans-serif',
  color: '#000',
});

const PokemonHeaderCell = styled('div')({
  width: '100px',
  minWidth: '100px',
  flexShrink: 0,
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
});

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
  width: '30px',
  height: '30px',
  borderRadius: '6px',
  overflow: 'hidden',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const PokemonHeaderText = styled('div')({
  width: '93px',
  height: '15px',
  position: 'relative',
  fontFamily: '"M PLUS 1p", sans-serif',
  '& .name': {
    position: 'absolute',
    left: 0,
    top: 0,
    maxWidth: '62px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '12px',
    lineHeight: '15px',
    fontWeight: 700,
  },
  '& .level-label': {
    position: 'absolute',
    left: '63.5px',
    top: '2px',
    color: '#62d540',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
  },
  '& .level-value': {
    position: 'absolute',
    left: '76.5px',
    top: '2px',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
  },
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

export default TimelineTable;
