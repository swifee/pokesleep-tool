import { styled } from "@mui/system";
import React from "react";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import TeamSlot from "./TeamSlot";

interface TimelineHeaderProps {
	team: (PokemonBoxItem | null)[];
	onSlotClick: (index: number) => void;
	onRemoveClick: (index: number) => void;
}

const TEAM_SLOT_KEYS = [
	"slot-1",
	"slot-2",
	"slot-3",
	"slot-4",
	"slot-5",
] as const;

function resolveTeamSlotKey(index: number): string {
	return TEAM_SLOT_KEYS[index] ?? `slot-${index + 1}`;
}

const TimelineHeader = React.memo(
	({ team, onSlotClick, onRemoveClick }: TimelineHeaderProps) => {
		return (
			<StyledHeader>
				{team.map((item, index) => (
					<TeamSlot
						key={resolveTeamSlotKey(index)}
						item={item}
						onClick={() => onSlotClick(index)}
						onRemove={() => onRemoveClick(index)}
					/>
				))}
			</StyledHeader>
		);
	},
);

const StyledHeader = styled("div")({
	display: "flex",
	alignItems: "center",
	gap: "4px",
	marginBottom: "8px",
});

export default TimelineHeader;
