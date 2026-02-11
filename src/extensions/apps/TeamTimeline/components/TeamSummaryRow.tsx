import React from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { TeamSummary } from '../types/TimeSlotTypes';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import type { SummaryLayoutMode } from './DailySummaryRow';
import IngredientOthersPopover from './IngredientOthersPopover';
import SummaryValueModeToggle from './SummaryValueModeToggle';
import {
  calculateIngredientTotalCount,
  formatIngredientCount,
  groupLowDailyIngredientsForAverage,
  sortIngredientsByCountDesc,
} from '../utils/IngredientDisplayUtils';
import {
  formatSummaryEp,
  formatSummaryInteger,
  formatSummaryNumber,
  resolveSummaryValueMode,
  SummaryValueMode,
  toSummaryModeValue,
} from '../utils/SummaryValueModeUtils';

const MEALS_PER_DAY = 3;

interface TeamSummaryRowProps {
  teamSummary: TeamSummary;
  label?: string;
  layoutMode?: SummaryLayoutMode;
  simulationDays?: number;
  valueMode?: SummaryValueMode;
  showValueModeToggle?: boolean;
  onValueModeChange?: (value: SummaryValueMode) => void;
}

const TeamSummaryRow = React.memo(({
  teamSummary,
  label,
  layoutMode = 'details',
  simulationDays = 1,
  valueMode = 'periodTotal',
  showValueModeToggle = false,
  onValueModeChange,
}: TeamSummaryRowProps) => {
  const { t } = useTranslation();
  const defaultLabel = layoutMode === 'average'
    ? t('TeamTimeline.team average', 'チーム平均')
    : t('TeamTimeline.total summary', '合計');
  const resolvedValueMode = resolveSummaryValueMode(valueMode, simulationDays);
  const convertedDayDivisor = resolvedValueMode === 'dailyAverage' ? 1 : Math.max(simulationDays, 1);
  const convertByMode = (value: number): number => (
    toSummaryModeValue(value, resolvedValueMode, simulationDays)
  );

  const sortedIngredients = sortIngredientsByCountDesc(
    teamSummary.totalIngredients
      .filter(i => i.count > 0)
      .map(i => ({ ...i, count: convertByMode(i.count) })),
  );
  const groupedAverageIngredients = groupLowDailyIngredientsForAverage(sortedIngredients, convertedDayDivisor);
  const displayIngredients = layoutMode === 'average'
    ? groupedAverageIngredients.visibleIngredients
    : sortedIngredients;
  const ingredientTotalCount = calculateIngredientTotalCount(sortedIngredients);
  const mealDenominator = convertedDayDivisor * MEALS_PER_DAY;
  const ingredientPerMeal = ingredientTotalCount / mealDenominator;

  const totalBerryEP = convertByMode(teamSummary.totalBerryEP);
  const totalIngredientEP = convertByMode(teamSummary.totalIngredientEP);
  const totalSkillEP = convertByMode(teamSummary.totalSkillEP);
  const grandTotalEP = convertByMode(teamSummary.grandTotalEP);
  const totalPresentCandyCount = convertByMode(teamSummary.totalPresentCandyCount);
  const totalCookingPotCapacityIncrease = convertByMode(teamSummary.totalCookingPotCapacityIncrease);
  const totalDreamShardCount = convertByMode(teamSummary.totalDreamShardCount);
  const totalTastyChanceIncreasePercent = convertByMode(teamSummary.totalTastyChanceIncreasePercent);
  const hasOtherMeta =
    totalPresentCandyCount > 0
    || totalCookingPotCapacityIncrease > 0
    || totalDreamShardCount > 0
    || totalTastyChanceIncreasePercent > 0;
  const canShowToggle = layoutMode === 'details' && showValueModeToggle && onValueModeChange;

  return (
    <Wrapper data-layout={layoutMode} data-has-toggle={canShowToggle}>
      {layoutMode === 'details' && (
        <LabelCell>
          <span className="label-text">{label ?? defaultLabel}</span>
          {canShowToggle && (
            <span className="toggle-wrap">
              <SummaryValueModeToggle
                value={resolvedValueMode}
                onChange={onValueModeChange}
                simulationDays={simulationDays}
                orientation="responsive"
              />
            </span>
          )}
        </LabelCell>
      )}
      <ContentCell>
        <EPPanel>
          <EPLine>
            きのみ : {formatSummaryEp(totalBerryEP)}EP
            <span className="sep" />
            食材 : {formatSummaryEp(totalIngredientEP)}EP
            <span className="sep" />
            スキル : {formatSummaryEp(totalSkillEP)}EP
          </EPLine>
          <TotalLine>total {formatSummaryEp(grandTotalEP)}EP</TotalLine>
        </EPPanel>

        <IngredientSection>
          <MetaItem>
            食材合計: <span className="value">{formatSummaryInteger(ingredientTotalCount)}</span>
          </MetaItem>
          <MetaItem>
            1食平均 : <span className="value">{formatIngredientCount(ingredientPerMeal)}</span>
          </MetaItem>
          <MetaLineBreak aria-hidden />
          {displayIngredients.map((ing) => (
            <IngredientItem key={ing.name}>
              <IngredientIcon name={ing.name} />
              <span>{formatIngredientCount(ing.count)}</span>
            </IngredientItem>
          ))}
          {layoutMode === 'average' && (
            <IngredientOthersPopover
              ingredients={groupedAverageIngredients.groupedIngredients}
              totalCount={groupedAverageIngredients.groupedCount}
            />
          )}
          {hasOtherMeta && <MetaLineBreak aria-hidden />}
          {totalPresentCandyCount > 0 && <MetaItem>🍬{formatSummaryNumber(totalPresentCandyCount)}</MetaItem>}
          {totalCookingPotCapacityIncrease > 0 && <MetaItem>鍋容量 : +{formatSummaryNumber(totalCookingPotCapacityIncrease)}</MetaItem>}
          {totalDreamShardCount > 0 && <MetaItem>ゆめのかけら : +{formatSummaryNumber(totalDreamShardCount)}</MetaItem>}
          {totalTastyChanceIncreasePercent > 0 && <MetaItem>料理チャンス : +{formatSummaryNumber(totalTastyChanceIncreasePercent)}%</MetaItem>}
        </IngredientSection>
      </ContentCell>
    </Wrapper>
  );
});

const Wrapper = styled('div')({
  display: 'grid',
  gridTemplateColumns: '40px minmax(0, 1fr)',
  columnGap: 0,
  rowGap: '4px',
  alignItems: 'start',
  marginTop: '5px',
  '&[data-layout="average"]': {
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
  '&[data-has-toggle="true"]': {
    gridTemplateColumns: '132px minmax(0, 1fr)',
  },
  '@media (max-width: 540px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    '&[data-has-toggle="true"]': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
});

const LabelCell = styled('div')({
  width: '100%',
  padding: '3px',
  fontSize: '10px',
  lineHeight: '13px',
  letterSpacing: '-0.5px',
  color: '#000',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  '& .label-text': {
    whiteSpace: 'pre-wrap',
  },
  '& .toggle-wrap': {
    display: 'inline-flex',
  },
});

const ContentCell = styled('div')({
  width: 'calc(100% - 4px)',
  maxWidth: '496px',
  minWidth: 0,
  marginRight: '4px',
  boxSizing: 'border-box',
  borderRadius: '6px',
  backgroundColor: '#fff',
  padding: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
});

const IngredientSection = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  lineHeight: '15px',
  letterSpacing: '-0.48px',
});

const IngredientItem = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1px',
  '& svg': {
    width: '14px',
    height: '14px',
  },
});

const MetaItem = styled('span')({
  fontSize: '12px',
  lineHeight: '15px',
  letterSpacing: '-0.48px',
  '& .value': {
    fontWeight: 700,
  },
});

const MetaLineBreak = styled('span')({
  flexBasis: '100%',
  width: 0,
  height: 0,
});

const EPPanel = styled('div')({
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '5px',
  backgroundColor: '#fffad5',
  padding: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

const EPLine = styled('div')({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '2px',
  fontSize: '12px',
  lineHeight: '15px',
  letterSpacing: '-0.48px',
  '& .sep': {
    width: '6px',
  },
});

const TotalLine = styled('div')({
  fontSize: '12px',
  lineHeight: '15px',
  fontWeight: 700,
});

export default TeamSummaryRow;
