import React, { useMemo, useState } from 'react';
import { Popover, styled } from '@mui/material';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import { IngredientResult } from '../types/TimeSlotTypes';
import { formatIngredientCount, sortIngredientsByCountDesc } from '../utils/IngredientDisplayUtils';

interface IngredientOthersPopoverProps {
    ingredients: IngredientResult[];
    totalCount: number;
    withLeadingSpace?: boolean;
}

const IngredientOthersPopover = React.memo(({
    ingredients,
    totalCount,
    withLeadingSpace = false,
}: IngredientOthersPopoverProps) => {
    const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(null);
    const sortedIngredients = useMemo(
        () => sortIngredientsByCountDesc(ingredients),
        [ingredients]
    );

    if (sortedIngredients.length === 0 || totalCount <= 0) {
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
            {withLeadingSpace && <LeadingSpace aria-hidden>{' '}</LeadingSpace>}
            <TriggerButton type="button" onClick={handleOpen}>
                他 {formatIngredientCount(totalCount)}
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
                            minWidth: '120px',
                        },
                    },
                }}
            >
                <PopoverBody>
                    {sortedIngredients.map((ingredient) => (
                        <PopoverItem key={ingredient.name}>
                            <IngredientIcon name={ingredient.name} />
                            <span>{formatIngredientCount(ingredient.count)}</span>
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
    color: '#333',
    font: 'inherit',
    lineHeight: 'inherit',
    textDecoration: 'underline',
    cursor: 'pointer',
});

const LeadingSpace = styled('span')({
    whiteSpace: 'pre',
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
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    '& svg': {
        width: '14px',
        height: '14px',
    },
});

export default IngredientOthersPopover;
