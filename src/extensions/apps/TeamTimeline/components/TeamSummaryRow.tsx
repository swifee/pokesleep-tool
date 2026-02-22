import React from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { TeamSummary } from '../types/TimeSlotTypes';
import { AverageCookingSummary, CookingSimulationResult } from '../types/CookingTypes';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import { IngredientName } from '../../../../data/pokemons';
import type { SummaryLayoutMode } from './DailySummaryRow';
import IngredientOthersPopover from './IngredientOthersPopover';
import CookingRecipeOthersPopover from './CookingRecipeOthersPopover';
import SummaryValueModeToggle from './SummaryValueModeToggle';
import TeamTimelineIcon from './TimelineIcons';
import EpValue from './EpValue';
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
import {
  formatAverageRecipeCount,
  groupAverageCookingRecipes,
} from '../utils/CookingDisplayUtils';

const MEALS_PER_DAY = 3;

function buildExtraIngredientUsageTotals(
  events: readonly NonNullable<CookingSimulationResult['events'][number]>[],
): Partial<Record<IngredientName, number>> {
  const totals: Partial<Record<IngredientName, number>> = {};
  for (const event of events) {
    for (const usage of event.extraIngredientsUsed ?? []) {
      totals[usage.name] = (totals[usage.name] ?? 0) + usage.count;
    }
  }
  return totals;
}

function computePostExtraLeftoverTotals(
  fixedTotals: Readonly<Partial<Record<IngredientName, number>>>,
  events: readonly NonNullable<CookingSimulationResult['events'][number]>[],
): Partial<Record<IngredientName, number>> {
  const extraUsageTotals = buildExtraIngredientUsageTotals(events);
  const result: Partial<Record<IngredientName, number>> = {};
  for (const [name, fixedCount] of Object.entries(fixedTotals)) {
    const ingredientName = name as IngredientName;
    const baseCount = fixedCount ?? 0;
    if (baseCount <= 0) {
      continue;
    }
    result[ingredientName] = Math.max(0, baseCount - (extraUsageTotals[ingredientName] ?? 0));
  }
  return result;
}

interface TeamSummaryRowProps {
  teamSummary: TeamSummary;
  label?: string;
  layoutMode?: SummaryLayoutMode;
  simulationDays?: number;
  valueMode?: SummaryValueMode;
  showValueModeToggle?: boolean;
  onValueModeChange?: (value: SummaryValueMode) => void;
  cookingResult?: CookingSimulationResult;
  averageCookingSummary?: AverageCookingSummary | null;
  leftoverIncludeExtraUsage?: boolean;
  onLeftoverIncludeExtraUsageChange?: (checked: boolean) => void;
  showLeftoverIncludeExtraUsageToggle?: boolean;
}

const TeamSummaryRow = React.memo(({
  teamSummary,
  label,
  layoutMode = 'details',
  simulationDays = 1,
  valueMode = 'periodTotal',
  showValueModeToggle = false,
  onValueModeChange,
  cookingResult,
  averageCookingSummary,
  leftoverIncludeExtraUsage,
  onLeftoverIncludeExtraUsageChange,
  showLeftoverIncludeExtraUsageToggle = false,
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
  const sortedAverageCookingRecipes = averageCookingSummary
    ? [...averageCookingSummary.recipes].sort((a, b) => {
      if (b.eBase !== a.eBase) {
        return b.eBase - a.eBase;
      }
      return a.recipeName.localeCompare(b.recipeName);
    })
    : [];
  const groupedAverageCookingRecipes = groupAverageCookingRecipes(sortedAverageCookingRecipes);
  const summaryEpValue = formatSummaryEp(
    teamSummary.totalCookingEP != null
      ? convertByMode(teamSummary.totalCookingEP)
      : totalIngredientEP
  );
  const includeExtraUsage = leftoverIncludeExtraUsage ?? true;
  const detailsLeftoverTotals = cookingResult
    ? (includeExtraUsage
      ? cookingResult.leftoverIngredients.total
      : computePostExtraLeftoverTotals(cookingResult.leftoverIngredients.total, cookingResult.events))
    : {};
  const hasDetailsLeftoverIngredients = Object.values(detailsLeftoverTotals)
    .some((count) => (count ?? 0) > 0);
  const averageLeftoverIngredients = averageCookingSummary
    ? (includeExtraUsage
      ? averageCookingSummary.leftoverIngredients
      : (averageCookingSummary.leftoverIngredientsAfterExtra ?? averageCookingSummary.leftoverIngredients))
    : [];
  const shouldShowLeftoverToggle = showLeftoverIncludeExtraUsageToggle
    && (layoutMode === 'details' ? Boolean(cookingResult) : Boolean(averageCookingSummary));

  return (
    <Wrapper data-layout={layoutMode}>
      {layoutMode === 'details' && (
        <SummaryHeadingRow>
          <SummaryHeadingLabel>{label ?? defaultLabel}</SummaryHeadingLabel>
          {canShowToggle && (
            <SummaryValueModeToggle
              value={resolvedValueMode}
              onChange={onValueModeChange}
              simulationDays={simulationDays}
              orientation="horizontal"
            />
          )}
        </SummaryHeadingRow>
      )}
      <ContentCell>
        <EPPanel>
          <EPLine>
            <EPItem data-testid="team-summary-ep-item-berry">
              <TeamTimelineIcon name="berry" data-testid="team-summary-ep-icon-berry" />
              <EpValue value={formatSummaryEp(totalBerryEP)} />
            </EPItem>
            <EPItem data-testid="team-summary-ep-item-skill">
              <TeamTimelineIcon name="skill" data-testid="team-summary-ep-icon-skill" />
              <EpValue value={formatSummaryEp(totalSkillEP)} />
            </EPItem>
            <EPItem data-testid={`team-summary-ep-item-${teamSummary.totalCookingEP != null ? 'cooking' : 'ingredient'}`}>
              <TeamTimelineIcon name="cooking" data-testid="team-summary-ep-icon-cooking" />
              <EpValue value={summaryEpValue} />
            </EPItem>
          </EPLine>
          <TotalLine>
            total <EpValue value={formatSummaryEp(grandTotalEP)} />
          </TotalLine>
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
          {totalDreamShardCount > 0 && (
            <MetaItem>
              <TeamTimelineIcon name="dream" data-testid="team-summary-meta-icon-dream" />
              +{formatSummaryNumber(totalDreamShardCount)}
            </MetaItem>
          )}
          {totalTastyChanceIncreasePercent > 0 && <MetaItem>料理チャンス : +{formatSummaryNumber(totalTastyChanceIncreasePercent)}%</MetaItem>}
        </IngredientSection>
        {layoutMode === 'details' && cookingResult && (
            <CookingSection>
                <MetaLineBreak aria-hidden />
                <CookingHeader>料理結果</CookingHeader>
                {cookingResult.dailySummaries.map((daySummary, dayIndex) => (
                    <DayCookingGroup key={dayIndex}>
                        {cookingResult.dailySummaries.length > 1 && (
                            <DayCookingLabel>{dayIndex + 1}日目</DayCookingLabel>
                        )}
                        {daySummary.events.map((event, eventIndex) => (
                            <CookingEventLine key={`${dayIndex}-${eventIndex}`}>
                                {event.isGreatSuccess && <GreatSuccessMark>&#x2757;</GreatSuccessMark>}
                                <span className="recipe-name">
                                    {event.recipeName == null
                                        ? 'スキップ'
                                        : t(`TeamTimeline.recipe ${event.recipeName}`, event.recipeName)}
                                </span>
                                <span className="cooking-ep">
                                    {event.cookingEP > 0 ? <EpValue value={Math.round(event.cookingEP).toLocaleString()} /> : '-'}
                                </span>
                                {event.remainingPotCapacity > 0 && (
                                    <span className="pot-remaining">
                                        鍋空き{event.remainingPotCapacity}
                                    </span>
                                )}
                            </CookingEventLine>
                        ))}
                    </DayCookingGroup>
                ))}
                {/* あまり食材 */}
                {hasDetailsLeftoverIngredients && (
                    <LeftoverSection>
                        <LeftoverLabel>あまり食材</LeftoverLabel>
                        <LeftoverIngredientList>
                            {Object.entries(detailsLeftoverTotals)
                                .filter(([, count]) => count != null && count > 0)
                                .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                                .map(([name, count]) => (
                                    <IngredientItem key={name}>
                                        <IngredientIcon name={name as IngredientName} />
                                        <span>{formatIngredientCount(count ?? 0)}</span>
                                    </IngredientItem>
                                ))}
                        </LeftoverIngredientList>
                    </LeftoverSection>
                )}
                {shouldShowLeftoverToggle && (
                    <LeftoverToggleLabel>
                        <LeftoverToggleInput
                            type="checkbox"
                            checked={includeExtraUsage}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                onLeftoverIncludeExtraUsageChange?.(event.target.checked);
                            }}
                            aria-label={t('TeamTimeline.cooking include extra usage in leftover', '追加食材使用分を含む')}
                            data-testid={`leftover-extra-usage-toggle-${layoutMode}`}
                        />
                        <span>{t('TeamTimeline.cooking include extra usage in leftover', '追加食材使用分を含む')}</span>
                    </LeftoverToggleLabel>
                )}
                <InitialIngredientEpLine>
                    {t('TeamTimeline.cooking initial ingredient ep total', '初期食材由来EP合計')}
                    {' : '}
                    <EpValue value={formatSummaryEp(convertByMode(cookingResult.totalInitialIngredientEP ?? 0))} />
                </InitialIngredientEpLine>
            </CookingSection>
        )}
        {layoutMode === 'average'
            && averageCookingSummary
            && (
              groupedAverageCookingRecipes.visibleRecipes.length > 0
              || groupedAverageCookingRecipes.groupedRecipes.length > 0
              || averageLeftoverIngredients.length > 0
            ) && (
            <CookingSection>
                <MetaLineBreak aria-hidden />
                <CookingHeader>料理結果</CookingHeader>
                {groupedAverageCookingRecipes.visibleRecipes.map((recipe) => (
                    <AverageCookingRecipeLine key={recipe.recipeName}>
                        <span className="recipe-text">
                            {t(`TeamTimeline.recipe ${recipe.recipeName}`, recipe.recipeName)}
                            {' : '}
                            平均<EpValue value={formatSummaryEp(recipe.averageCookingEP)} /> × {formatAverageRecipeCount(recipe.averageCount)}回
                        </span>
                    </AverageCookingRecipeLine>
                ))}
                <AverageCookingRecipeLine>
                    <CookingRecipeOthersPopover
                        recipes={groupedAverageCookingRecipes.groupedRecipes}
                        totalCount={groupedAverageCookingRecipes.groupedCount}
                    />
                </AverageCookingRecipeLine>
                {averageLeftoverIngredients.length > 0 && (
                    <LeftoverSection>
                        <LeftoverLabel>あまり食材平均</LeftoverLabel>
                        <LeftoverIngredientList>
                            {averageLeftoverIngredients.map((ingredient) => (
                                <IngredientItem key={ingredient.name}>
                                    <IngredientIcon name={ingredient.name} />
                                    <span>{formatIngredientCount(ingredient.count)}</span>
                                </IngredientItem>
                            ))}
                        </LeftoverIngredientList>
                    </LeftoverSection>
                )}
                {shouldShowLeftoverToggle && (
                    <LeftoverToggleLabel>
                        <LeftoverToggleInput
                            type="checkbox"
                            checked={includeExtraUsage}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                onLeftoverIncludeExtraUsageChange?.(event.target.checked);
                            }}
                            aria-label={t('TeamTimeline.cooking include extra usage in leftover', '追加食材使用分を含む')}
                            data-testid={`leftover-extra-usage-toggle-${layoutMode}`}
                        />
                        <span>{t('TeamTimeline.cooking include extra usage in leftover', '追加食材使用分を含む')}</span>
                    </LeftoverToggleLabel>
                )}
                <InitialIngredientEpLine>
                    {t('TeamTimeline.cooking initial ingredient ep total', '初期食材由来EP合計')}
                    {' : '}
                    <EpValue value={formatSummaryEp(convertByMode(averageCookingSummary.averageInitialIngredientEP ?? 0))} />
                </InitialIngredientEpLine>
            </CookingSection>
        )}
      </ContentCell>
    </Wrapper>
  );
});

const Wrapper = styled('div')({
  width: '100%',
  marginTop: '5px',
});

const SummaryHeadingRow = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '8px',
  flexWrap: 'nowrap',
  marginBottom: '5px',
});

const SummaryHeadingLabel = styled('span')({
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: '18px',
  letterSpacing: '0.4px',
  whiteSpace: 'nowrap',
  color: '#000',
});

const ContentCell = styled('div')({
  width: '100%',
  minWidth: 0,
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
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1px',
  fontSize: '12px',
  lineHeight: '15px',
  letterSpacing: '-0.48px',
  '& svg': {
    width: '12px',
    height: '12px',
  },
  '& .value': {
    fontWeight: 700,
  },
});

const LeftoverToggleLabel = styled('label')({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  lineHeight: '15px',
  letterSpacing: '-0.48px',
  cursor: 'pointer',
});

const LeftoverToggleInput = styled('input')({
  margin: 0,
  width: '12px',
  height: '12px',
  cursor: 'pointer',
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
  gap: '6px',
  fontSize: '12px',
  lineHeight: '15px',
  letterSpacing: '-0.48px',
});

const EPItem = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1px',
  '& svg': {
    width: '12px',
    height: '12px',
  },
});

const TotalLine = styled('div')({
  fontSize: '12px',
  lineHeight: '15px',
  fontWeight: 700,
});

const CookingSection = styled('div')({
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '4px',
    paddingTop: '4px',
    borderTop: '1px dashed #d6d6d6',
});

const CookingHeader = styled('div')({
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: '15px',
    letterSpacing: '-0.48px',
});

const DayCookingGroup = styled('div')({
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
});

const DayCookingLabel = styled('div')({
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    color: '#888',
    fontWeight: 600,
});

const CookingEventLine = styled('div')({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '-0.44px',
    '& .recipe-name': {
        fontWeight: 500,
    },
    '& .cooking-ep': {
        fontWeight: 700,
    },
    '& .pot-remaining': {
        color: '#888',
        fontSize: '10px',
    },
});

const AverageCookingRecipeLine = styled('div')({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '-0.44px',
    '& .recipe-text': {
        fontWeight: 500,
    },
});

const GreatSuccessMark = styled('span')({
    color: '#ff6b00',
    fontWeight: 700,
});

const LeftoverSection = styled('div')({
    marginTop: '4px',
    paddingTop: '4px',
    borderTop: '1px dashed #e0e0e0',
});

const LeftoverLabel = styled('div')({
    fontSize: '11px',
    lineHeight: '14px',
    fontWeight: 600,
    color: '#666',
    marginBottom: '2px',
});

const LeftoverIngredientList = styled('div')({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'center',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '-0.44px',
});

const InitialIngredientEpLine = styled('div')({
    marginTop: '4px',
    paddingTop: '4px',
    borderTop: '1px dashed #e0e0e0',
    fontSize: '11px',
    lineHeight: '14px',
    fontWeight: 600,
    color: '#555',
});

export default TeamSummaryRow;
