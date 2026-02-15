import React from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { CookingEventResult } from '../types/CookingTypes';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import { formatIngredientCount, sortIngredientsByCountDesc } from '../utils/IngredientDisplayUtils';

interface CookingResultRowProps {
    event: CookingEventResult;
    teamSize: number;
}

const CookingResultRow = React.memo(({ event, teamSize }: CookingResultRowProps) => {
    const { t } = useTranslation();

    if (event.recipeName == null && event.cookingEP === 0) {
        return null; // Skip display if no recipe was cooked
    }

    const localizedRecipeName = event.recipeName == null
        ? null
        : t(`TeamTimeline.recipe ${event.recipeName}`, event.recipeName);

    const usedIngredients = sortIngredientsByCountDesc(
        event.ingredientsUsed.map(u => ({ name: u.name, count: u.count }))
    );

    return (
        <RowContainer>
            <LabelCell>{'\u{1F373}'}</LabelCell>
            <ContentCell $teamSize={teamSize}>
                <CookingInfo>
                    {event.isGreatSuccess && <GreatSuccessBadge>{'\u5927\u6210\u529F\u2757'}</GreatSuccessBadge>}
                    <RecipeName>{localizedRecipeName}</RecipeName>
                    <CookingEP>{Math.round(event.cookingEP).toLocaleString()}EP</CookingEP>
                </CookingInfo>
                <IngredientInfo>
                    {usedIngredients.map((ing) => (
                        <IngredientBadge key={ing.name}>
                            <IngredientIcon name={ing.name} />
                            {formatIngredientCount(ing.count)}
                        </IngredientBadge>
                    ))}
                    <PotInfo>{'\u934B\u7A7A\u304D'}{event.remainingPotCapacity}</PotInfo>
                </IngredientInfo>
            </ContentCell>
        </RowContainer>
    );
});

const RowContainer = styled('div')({
    display: 'flex',
    width: '100%',
    borderTop: '0.5px dashed #e2e2e2',
    backgroundColor: '#fffef5',
    minHeight: '24px',
});

const LabelCell = styled('div')({
    width: '40px',
    minWidth: '40px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    borderRight: '0.5px solid #e2e2e2',
    padding: '2px',
});

const ContentCell = styled('div')<{ $teamSize: number }>(({ $teamSize }) => ({
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '3px 6px',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: `${$teamSize * 100}px`,
}));

const CookingInfo = styled('div')({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
});

const GreatSuccessBadge = styled('span')({
    fontSize: '10px',
    fontWeight: 700,
    color: '#ff6b00',
    whiteSpace: 'nowrap',
});

const RecipeName = styled('span')({
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '-0.44px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
});

const CookingEP = styled('span')({
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '-0.44px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
});

const IngredientInfo = styled('div')({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '2px',
});

const IngredientBadge = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    '& svg': {
        width: '12px',
        height: '12px',
    },
});

const PotInfo = styled('span')({
    fontSize: '10px',
    lineHeight: '13px',
    color: '#888',
    whiteSpace: 'nowrap',
});

export default CookingResultRow;
