import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { ButtonBase, IconButton } from "@mui/material";
import { styled } from "@mui/system";
import React from "react";
import { useTranslation } from "react-i18next";
import PokemonIcon from "../../../../ui/IvCalc/PokemonIcon";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";

interface TeamSlotProps {
	item: PokemonBoxItem | null;
	onClick: () => void;
	onRemove: () => void;
}

const TeamSlot = React.memo(({ item, onClick, onRemove }: TeamSlotProps) => {
	const { t } = useTranslation();

	if (item === null) {
		return (
			<StyledSlot>
				<ButtonBase className="slot-button empty" onClick={onClick}>
					<span className="lv-placeholder">&nbsp;</span>
					<span className="icon-placeholder">
						<AddIcon sx={{ fontSize: 16, color: "#fff" }} />
					</span>
					<span className="name-placeholder">&nbsp;</span>
				</ButtonBase>
			</StyledSlot>
		);
	}

	return (
		<StyledSlot>
			<ButtonBase
				className="slot-button"
				onClick={onClick}
				title={item.filledNickname(t)}
			>
				<span className="level-line">
					<span className="lv">Lv.</span>
					<span>{item.iv.level}</span>
				</span>
				<span className="icon-area">
					<PokemonIcon idForm={item.iv.idForm} size={30} />
				</span>
				<span className="name-line">{item.filledNickname(t)}</span>
			</ButtonBase>
			<IconButton
				className="remove-button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				size="small"
				title={t("delete")}
			>
				<CloseIcon sx={{ fontSize: 12 }} />
			</IconButton>
		</StyledSlot>
	);
});

const StyledSlot = styled("div")({
	position: "relative",
	width: "55px",
	minWidth: "55px",
	height: "62px",
	"& .slot-button": {
		width: "100%",
		height: "100%",
		borderRadius: "6px",
		backgroundColor: "#fff",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		gap: "1px",
		padding: "2px 1px",
		border: "1px solid #ededed",
		fontFamily: '"M PLUS 1p", sans-serif',
		"&:hover": {
			backgroundColor: "#f8fbff",
		},
	},
	"& .slot-button.empty": {
		"& .icon-placeholder": {
			width: "32px",
			height: "32px",
			borderRadius: "6px",
			backgroundColor: "#d9d9d9",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			fontSize: "15px",
			color: "#fff",
		},
	},
	"& .level-line": {
		width: "100%",
		display: "flex",
		justifyContent: "center",
		gap: "1px",
		fontSize: "10px",
		lineHeight: "13px",
		letterSpacing: "-0.5px",
	},
	"& .lv": {
		color: "#62d540",
	},
	"& .icon-area": {
		width: "32px",
		height: "32px",
		borderRadius: "6px",
		overflow: "visible",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
	"& .name-line": {
		width: "100%",
		fontSize: "10px",
		lineHeight: "13px",
		letterSpacing: "-0.5px",
		color: "#000",
		textAlign: "center",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	"& .remove-button": {
		position: "absolute",
		right: "-6px",
		top: "-6px",
		width: "16px",
		height: "16px",
		padding: 0,
		color: "#fff",
		backgroundColor: "#ec6a5f",
		opacity: 0,
		transition: "opacity 0.12s ease",
		"&:hover": {
			backgroundColor: "#df584d",
		},
	},
	"&:hover .remove-button": {
		opacity: 1,
	},
	"& .lv-placeholder, & .name-placeholder": {
		display: "block",
		width: "100%",
		height: "13px",
	},
});

export default TeamSlot;
