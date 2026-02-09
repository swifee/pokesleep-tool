import React from 'react';
import { styled } from '@mui/system';
import { PokemonBoxItem } from '../../../../util/PokemonBox';
import TeamSlot from './TeamSlot';

interface TimelineHeaderProps {
    team: (PokemonBoxItem | null)[];
    onSlotClick: (index: number) => void;
    onRemoveClick: (index: number) => void;
}

const TimelineHeader = React.memo(({ team, onSlotClick, onRemoveClick }: TimelineHeaderProps) => {
    return (
        <StyledHeader>
            {team.map((item, index) => (
                <TeamSlot
                    key={index}
                    item={item}
                    onClick={() => onSlotClick(index)}
                    onRemove={() => onRemoveClick(index)}
                />
            ))}
        </StyledHeader>
    );
});

const StyledHeader = styled('div')({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '8px',
});

export default TimelineHeader;
