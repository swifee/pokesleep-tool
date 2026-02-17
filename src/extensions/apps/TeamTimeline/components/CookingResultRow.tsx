import React from 'react';
import { styled } from '@mui/system';
import { Popover } from '@mui/material';
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
    const [anchorElement, setAnchorElement] = React.useState<HTMLButtonElement | null>(null);

    if (event.recipeName == null && event.cookingEP === 0) {
        return null; // Skip display if no recipe was cooked
    }

    const localizedRecipeName = event.recipeName == null
        ? null
        : t(`TeamTimeline.recipe ${event.recipeName}`, event.recipeName);

    const usedIngredients = sortIngredientsByCountDesc(
        event.ingredientsUsed.map(u => ({ name: u.name, count: u.count }))
    );
    const extraIngredients = sortIngredientsByCountDesc(
        (event.extraIngredientsUsed ?? []).map(u => ({ name: u.name, count: u.count }))
    );
    const bagIngredientsBeforeCooking = sortIngredientsByCountDesc(
        (event.bagIngredientsBeforeCooking ?? []).filter(ing => ing.count > 0)
    );

    const handleBagPopoverOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorElement(e.currentTarget);
    };

    const handleBagPopoverClose = () => {
        setAnchorElement(null);
    };

    return (
        <RowContainer>
            <LabelCell>
                <LabelTriggerButton
                    type="button"
                    onClick={handleBagPopoverOpen}
                    aria-label={t('TeamTimeline.cooking bag before meal', '料理直前のバッグ内食材')}
                    title={t('TeamTimeline.cooking bag before meal', '料理直前のバッグ内食材')}
                    data-testid={`cooking-bag-trigger-${event.mealSlotId}`}
                >
                    {'\u{1F373}'}
                </LabelTriggerButton>
                <Popover
                    open={anchorElement !== null}
                    anchorEl={anchorElement}
                    onClose={handleBagPopoverClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    slotProps={{
                        paper: {
                            sx: {
                                mt: '2px',
                                p: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid #d6d6d6',
                                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.14)',
                                minWidth: '128px',
                            },
                        },
                    }}
                >
                    <BagPopoverBody>
                        <BagPopoverTitle>{t('TeamTimeline.cooking bag before meal short', '料理直前バッグ')}</BagPopoverTitle>
                        {bagIngredientsBeforeCooking.length > 0 ? (
                            bagIngredientsBeforeCooking.map((ingredient) => (
                                <BagPopoverItem key={ingredient.name}>
                                    <IngredientIcon name={ingredient.name} />
                                    <span>{formatIngredientCount(ingredient.count)}</span>
                                </BagPopoverItem>
                            ))
                        ) : (
                            <BagPopoverEmpty>{t('TeamTimeline.cooking no ingredients', '食材なし')}</BagPopoverEmpty>
                        )}
                    </BagPopoverBody>
                </Popover>
            </LabelCell>
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
                    {extraIngredients.length > 0 && (
                        <ExtraIngredientsGroup>
                            <span>+</span>
                            <span>(</span>
                            {extraIngredients.map((ing) => (
                                <IngredientBadge key={`extra-${ing.name}`}>
                                    <IngredientIcon name={ing.name} />
                                    {formatIngredientCount(ing.count)}
                                </IngredientBadge>
                            ))}
                            <span>)</span>
                        </ExtraIngredientsGroup>
                    )}
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
    alignItems: 'stretch',
    justifyContent: 'center',
    borderRight: '0.5px solid #e2e2e2',
    padding: 0,
});

const LabelTriggerButton = styled('button')({
    border: 0,
    backgroundColor: 'transparent',
    width: '100%',
    height: '100%',
    padding: '2px',
    margin: 0,
    fontSize: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    '&:hover': {
        backgroundColor: '#fff7de',
    },
});

const BagPopoverBody = styled('div')({
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '-0.44px',
});

const BagPopoverTitle = styled('div')({
    color: '#666',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    fontWeight: 600,
});

const BagPopoverItem = styled('div')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    '& svg': {
        width: '14px',
        height: '14px',
    },
});

const BagPopoverEmpty = styled('div')({
    color: '#666',
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

const ExtraIngredientsGroup = styled('span')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
});

const PotInfo = styled('span')({
    fontSize: '10px',
    lineHeight: '13px',
    color: '#888',
    whiteSpace: 'nowrap',
});

export default CookingResultRow;
