import React, { useMemo, useState } from 'react';
import { Popover, styled } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AverageCookingRecipeSummary } from '../types/CookingTypes';
import { formatSummaryEp } from '../utils/SummaryValueModeUtils';
import { formatAverageRecipeCount } from '../utils/CookingDisplayUtils';

interface CookingRecipeOthersPopoverProps {
    recipes: readonly AverageCookingRecipeSummary[];
    totalCount: number;
}

const CookingRecipeOthersPopover = React.memo(({
    recipes,
    totalCount,
}: CookingRecipeOthersPopoverProps) => {
    const { t } = useTranslation();
    const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(null);

    const sortedRecipes = useMemo(
        () => [...recipes].sort((a, b) => {
            if (b.eBase !== a.eBase) {
                return b.eBase - a.eBase;
            }
            return a.recipeName.localeCompare(b.recipeName);
        }),
        [recipes],
    );

    if (sortedRecipes.length === 0 || totalCount <= 0) {
        return null;
    }

    const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorElement(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorElement(null);
    };

    const open = anchorElement !== null;

    return (
        <>
            <TriggerButton type="button" onClick={handleOpen}>
                他 {formatAverageRecipeCount(totalCount)}回
            </TriggerButton>
            <Popover
                open={open}
                anchorEl={anchorElement}
                onClose={handleClose}
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
                            minWidth: '200px',
                        },
                    },
                }}
            >
                <PopoverBody>
                    {sortedRecipes.map((recipe) => (
                        <PopoverItem key={recipe.recipeName}>
                            {t(`TeamTimeline.recipe ${recipe.recipeName}`, recipe.recipeName)}
                            {' : '}
                            平均{formatSummaryEp(recipe.averageCookingEP)}EP × {formatAverageRecipeCount(recipe.averageCount)}回
                        </PopoverItem>
                    ))}
                </PopoverBody>
            </Popover>
        </>
    );
});

const TriggerButton = styled('button')({
    border: 0,
    background: 'transparent',
    padding: 0,
    margin: 0,
    marginTop: 0,
    color: '#333',
    font: 'inherit',
    lineHeight: 'inherit',
    textDecoration: 'underline',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    textAlign: 'left',
});

const PopoverBody = styled('div')({
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '-0.44px',
});

const PopoverItem = styled('div')({
    color: '#222',
});

export default CookingRecipeOthersPopover;
