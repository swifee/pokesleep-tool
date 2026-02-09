import React from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { TeamSummary } from '../types/TimeSlotTypes';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import type { SummaryLayoutMode } from './DailySummaryRow';
import IngredientOthersPopover from './IngredientOthersPopover';
import {
  calculateIngredientTotalCount,
  formatIngredientCount,
  formatIngredientIntegerCount,
  groupLowDailyIngredientsForAverage,
  MEALS_PER_DAY,
  sortIngredientsByCountDesc,
} from '../utils/IngredientDisplayUtils';

interface TeamSummaryRowProps {
  teamSummary: TeamSummary;
  label?: string;
  layoutMode?: SummaryLayoutMode;
  simulationDays?: number;
}

const TeamSummaryRow = React.memo(({
  teamSummary,
  label,
  layoutMode = 'details',
  simulationDays = 1,
}: TeamSummaryRowProps) => {
  const { t } = useTranslation();
  const defaultLabel = layoutMode === 'average'
    ? t('TeamTimeline.team average', 'チーム平均')
    : t('TeamTimeline.total summary', '合計');
  const sortedIngredients = sortIngredientsByCountDesc(teamSummary.totalIngredients.filter(i => i.count > 0));
  const groupedAverageIngredients = groupLowDailyIngredientsForAverage(sortedIngredients, simulationDays);
  const displayIngredients = layoutMode === 'average'
    ? groupedAverageIngredients.visibleIngredients
    : sortedIngredients;
  const ingredientTotalCount = calculateIngredientTotalCount(sortedIngredients);
  const mealDenominator = Math.max(simulationDays, 1) * MEALS_PER_DAY;
  const ingredientPerMeal = ingredientTotalCount / mealDenominator;
  const hasOtherMeta =
    teamSummary.totalPresentCandyCount > 0
    || teamSummary.totalCookingPotCapacityIncrease > 0
    || teamSummary.totalDreamShardCount > 0
    || teamSummary.totalTastyChanceIncreasePercent > 0;

  return (
    <Wrapper data-layout={layoutMode}>
      {layoutMode === 'details' && <LabelCell>{label ?? defaultLabel}</LabelCell>}
      <ContentCell>
        <EPPanel>
          <EPLine>
            きのみ : {teamSummary.totalBerryEP.toLocaleString()}EP
            <span className="sep" />
            食材 : {teamSummary.totalIngredientEP.toLocaleString()}EP
            <span className="sep" />
            スキル : {teamSummary.totalSkillEP.toLocaleString()}EP
          </EPLine>
          <TotalLine>total {teamSummary.grandTotalEP.toLocaleString()}EP</TotalLine>
        </EPPanel>

        <IngredientSection>
          <MetaItem>
            食材合計: <span className="value">{formatIngredientIntegerCount(ingredientTotalCount)}</span>
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
          {teamSummary.totalPresentCandyCount > 0 && <MetaItem>🍬{teamSummary.totalPresentCandyCount}</MetaItem>}
          {teamSummary.totalCookingPotCapacityIncrease > 0 && <MetaItem>鍋容量 : +{teamSummary.totalCookingPotCapacityIncrease}</MetaItem>}
          {teamSummary.totalDreamShardCount > 0 && <MetaItem>ゆめのかけら : +{teamSummary.totalDreamShardCount}</MetaItem>}
          {teamSummary.totalTastyChanceIncreasePercent > 0 && <MetaItem>料理チャンス : +{teamSummary.totalTastyChanceIncreasePercent}%</MetaItem>}
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
  '@media (max-width: 540px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
});

const LabelCell = styled('div')({
  width: '40px',
  minWidth: '40px',
  padding: '3px',
  fontSize: '10px',
  lineHeight: '13px',
  letterSpacing: '-0.5px',
  color: '#000',
  whiteSpace: 'pre-wrap',
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
