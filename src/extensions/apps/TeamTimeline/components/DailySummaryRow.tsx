import React from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { DailySummary } from '../types/TimeSlotTypes';
import PokemonBox from '../../../../util/PokemonBox';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import IngredientOthersPopover from './IngredientOthersPopover';
import {
    calculateIngredientTotalCount,
    formatIngredientCount,
    formatIngredientIntegerCount,
    groupLowDailyIngredientsForAverage,
    sortIngredientsByCountDesc,
} from '../utils/IngredientDisplayUtils';

export type SummaryLayoutMode = 'details' | 'average';

interface DailySummaryRowProps {
    dailySummaries: DailySummary[];
    box: PokemonBox;
    label?: string;
    layoutMode?: SummaryLayoutMode;
    simulationDays?: number;
}

const SUMMARY_CARD_WIDTH = 96;
const SUMMARY_COLUMN_GAP = 4;
const SUMMARY_GRID_MAX_WIDTH = SUMMARY_CARD_WIDTH * 5 + SUMMARY_COLUMN_GAP * 4;

const DailySummaryRow = React.memo(({
    dailySummaries,
    box,
    label,
    layoutMode = 'details',
    simulationDays = 1,
}: DailySummaryRowProps) => {
    const { t } = useTranslation();

    const defaultSingleLineLabel = t('TeamTimeline.individual results', '個別成績');
    const defaultStackedLabel = t('TeamTimeline.individual results stacked', '個別\n成績');

    return (
        <RowWrapper data-testid="daily-summary-row" data-layout={layoutMode}>
            {layoutMode === 'details' && (
                <LabelCell>
                    {label ? (
                        label
                    ) : (
                        <>
                            <span className="label-stacked">{defaultStackedLabel}</span>
                            <span className="label-inline">{defaultSingleLineLabel}</span>
                        </>
                    )}
                </LabelCell>
            )}
            <GridCell data-testid="daily-summary-grid">
                {dailySummaries.map(summary => {
                    const pokemon = box.getById(summary.pokemonId);
                    const pokemonName = pokemon?.filledNickname(t) ?? `ID: ${summary.pokemonId}`;
                    const sortedIngredients = sortIngredientsByCountDesc(summary.totalIngredients.filter(i => i.count > 0));
                    const groupedAverageIngredients = groupLowDailyIngredientsForAverage(sortedIngredients, simulationDays);
                    const displayIngredients = layoutMode === 'average'
                        ? groupedAverageIngredients.visibleIngredients
                        : sortedIngredients;
                    const overflowIngredients = sortIngredientsByCountDesc(summary.totalOverflowIngredients.filter(i => i.count > 0));
                    const ingredientTotalCount = calculateIngredientTotalCount(sortedIngredients);
                    const hasOptionLine = summary.totalPresentCandyCount > 0
                        || summary.totalCookingPotCapacityIncrease > 0
                        || summary.totalTastyChanceIncreasePercent > 0
                        || summary.totalDreamShardCount > 0;
                    return (
                        <SummaryCard key={`${layoutMode}-${summary.pokemonId}`} data-testid="daily-summary-cell">
                            <SummaryHeader>
                                <span className="name">{pokemonName}</span>
                                {pokemon && (
                                    <span className="level">
                                        <span className="lv">Lv.</span>
                                        {pokemon.iv.level}
                                    </span>
                                )}
                            </SummaryHeader>

                            <EPBox>
                                <EPLine>❗{summary.skillEP.toLocaleString()}EP</EPLine>
                                <EPLine>
                                    <LocalFireDepartmentIcon sx={{ width: 12, height: 12, color: '#ff944b' }} />
                                    {summary.berryEP.toLocaleString()}EP
                                </EPLine>
                                <EPLine>🍴{summary.ingredientEP.toLocaleString()}EP</EPLine>
                                <Divider />
                                <TotalLine>{summary.totalEP.toLocaleString()}EP</TotalLine>
                            </EPBox>

                            <Line>🔍{summary.totalHelpCount}</Line>
                            <Line>
                                ❗{summary.totalSkillCount}
                                {summary.totalSkillOverflowCount > 0 && (
                                    <SkillOverflowIcon>❕{summary.totalSkillOverflowCount}</SkillOverflowIcon>
                                )}
                            </Line>
                            <Line>
                                <LocalFireDepartmentIcon sx={{ width: 14, height: 14, color: '#ff944b' }} />
                                {summary.totalBerryCount}
                            </Line>
                            <IngredientLine>
                                <IngredientTotalItem>
                                    食材合計: <span className="value">{formatIngredientIntegerCount(ingredientTotalCount)}</span>
                                </IngredientTotalItem>
                                {displayIngredients.map((ing) => (
                                    <IngredientItem key={`${summary.pokemonId}-${ing.name}`}>
                                        <IngredientIcon name={ing.name} />
                                        {formatIngredientCount(ing.count)}
                                    </IngredientItem>
                                ))}
                                {layoutMode === 'average' && (
                                    <IngredientOthersPopover
                                        ingredients={groupedAverageIngredients.groupedIngredients}
                                        totalCount={groupedAverageIngredients.groupedCount}
                                        withLeadingSpace
                                    />
                                )}
                            </IngredientLine>
                            <OverflowContainer style={{ visibility: overflowIngredients.length > 0 ? 'visible' : 'hidden' }}>
                                <OverflowBracket>(</OverflowBracket>
                                {overflowIngredients.map((ing) => (
                                    <OverflowIngredientItem key={`overflow-${summary.pokemonId}-${ing.name}`}>
                                        <IngredientIcon name={ing.name} />
                                        <span>{formatIngredientCount(ing.count)}</span>
                                    </OverflowIngredientItem>
                                ))}
                                <OverflowBracket>)</OverflowBracket>
                            </OverflowContainer>

                            <OptionLine style={{ visibility: hasOptionLine ? 'visible' : 'hidden' }}>
                                {summary.totalPresentCandyCount > 0 && <span>🍬{summary.totalPresentCandyCount}</span>}
                                {summary.totalCookingPotCapacityIncrease > 0 && <span>鍋+{summary.totalCookingPotCapacityIncrease}</span>}
                                {summary.totalTastyChanceIncreasePercent > 0 && <span>料理チャンス+{summary.totalTastyChanceIncreasePercent}%</span>}
                                {summary.totalDreamShardCount > 0 && <span>夢+{summary.totalDreamShardCount}</span>}
                            </OptionLine>
                        </SummaryCard>
                    );
                })}
            </GridCell>
        </RowWrapper>
    );
});

const RowWrapper = styled('div')({
    display: 'grid',
    gridTemplateColumns: '40px minmax(0, 1fr)',
    columnGap: 0,
    rowGap: '4px',
    alignItems: 'start',
    marginTop: '6px',
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
    overflow: 'hidden',
    '& .label-stacked': {
        display: 'inline',
        whiteSpace: 'pre-line',
    },
    '& .label-inline': {
        display: 'none',
        whiteSpace: 'nowrap',
    },
    '@media (max-width: 540px)': {
        '& .label-stacked': {
            display: 'none',
        },
        '& .label-inline': {
            display: 'inline',
        },
    },
});

const GridCell = styled('div')({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 4px',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: `${SUMMARY_GRID_MAX_WIDTH}px`,
    minWidth: 0,
});

const SummaryCard = styled('div')({
    width: '96px',
    minWidth: '96px',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    borderRadius: '6px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'stretch',
});

const SummaryHeader = styled('div')({
    width: '96px',
    height: '24px',
    position: 'relative',
    '& .name': {
        position: 'absolute',
        left: '5px',
        top: '5px',
        fontSize: '12px',
        lineHeight: '15px',
        letterSpacing: '-0.48px',
        maxWidth: '58px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    '& .level': {
        position: 'absolute',
        right: '4px',
        top: '7px',
        display: 'inline-flex',
        gap: '1px',
        fontSize: '10px',
        lineHeight: '13px',
        letterSpacing: '-0.5px',
    },
    '& .lv': {
        color: '#62d540',
    },
});

const Line = styled('div')({
    display: 'flex',
    alignItems: 'center',
    gap: '1px',
    fontSize: '12px',
    lineHeight: '15px',
    letterSpacing: '-0.48px',
    whiteSpace: 'nowrap',
});

const SkillOverflowIcon = styled('span')({
    fontSize: '10px',
    color: '#9e9e9e',
    fontWeight: 600,
    marginLeft: '2px',
});

const IngredientLine = styled('div')({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1px',
    minHeight: '30px',
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

const IngredientTotalItem = styled('span')({
    flexBasis: '100%',
    fontSize: '12px',
    lineHeight: '15px',
    letterSpacing: '-0.48px',
    color: '#555',
    whiteSpace: 'nowrap',
    '& .value': {
        fontWeight: 700,
    },
});

const OverflowIngredientItem = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    color: '#9e9e9e',
    fontSize: '10px',
    lineHeight: '13px',
    '& svg': {
        width: '14px',
        height: '14px',
        opacity: 0.6,
    },
});

const OverflowContainer = styled('div')({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1px',
    color: '#9e9e9e',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    minHeight: '13px',
});

const OverflowBracket = styled('span')({
    color: '#9e9e9e',
});

const OptionLine = styled('div')({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '3px',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    minHeight: '13px',
});

const EPBox = styled('div')({
    width: 'calc(100% - 8px)',
    boxSizing: 'border-box',
    marginLeft: '4px',
    marginRight: '4px',
    marginBottom: '4px',
    borderRadius: '4px',
    backgroundColor: '#fffad5',
    padding: '4px 6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
});

const EPLine = styled('div')({
    display: 'flex',
    alignItems: 'center',
    gap: '1px',
    fontSize: '12px',
    lineHeight: '15px',
    letterSpacing: '-0.48px',
    whiteSpace: 'nowrap',
});

const Divider = styled('div')({
    borderTop: '1px dashed #b9b9b9',
    marginTop: '1px',
    marginBottom: '1px',
});

const TotalLine = styled('div')({
    fontSize: '24px',
    lineHeight: '30px',
    fontWeight: 700,
    letterSpacing: '0',
    transform: 'scale(0.5)',
    transformOrigin: 'top left',
    width: '180px',
    height: '15px',
});

export default DailySummaryRow;
