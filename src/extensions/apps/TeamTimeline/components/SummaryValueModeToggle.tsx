import { styled } from "@mui/system";
import React from "react";
import { useTranslation } from "react-i18next";
import type { SummaryValueMode } from "../utils/SummaryValueModeUtils";

interface SummaryValueModeToggleProps {
	value: SummaryValueMode;
	onChange: (value: SummaryValueMode) => void;
	simulationDays?: number;
	orientation?: "horizontal" | "vertical" | "responsive";
}

const SummaryValueModeToggle = React.memo(
	({
		value,
		onChange,
		simulationDays = 1,
		orientation = "horizontal",
	}: SummaryValueModeToggleProps) => {
		const { t } = useTranslation();
		const safeSimulationDays = Math.max(Math.floor(simulationDays), 1);
		const periodTotalLabel = t(
			"TeamTimeline.value mode period total days",
			"{{days}}日",
			{ days: safeSimulationDays },
		);
		const dailyAverageLabel = t(
			"TeamTimeline.value mode daily average day",
			"1日",
		);

		return (
			<Container data-orientation={orientation}>
				<ModeButton
					type="button"
					data-active={value === "periodTotal"}
					onClick={() => onChange("periodTotal")}
				>
					{periodTotalLabel}
				</ModeButton>
				<ModeButton
					type="button"
					data-active={value === "dailyAverage"}
					onClick={() => onChange("dailyAverage")}
				>
					{dailyAverageLabel}
				</ModeButton>
			</Container>
		);
	},
);

const Container = styled("div")({
	display: "inline-flex",
	alignItems: "stretch",
	border: "1px solid #a7b7d9",
	borderRadius: "999px",
	overflow: "hidden",
	backgroundColor: "#fff",
	'&[data-orientation="vertical"]': {
		flexDirection: "column",
		borderRadius: "8px",
		"& > button + button": {
			borderTop: "1px solid #a7b7d9",
			borderLeft: "none",
		},
	},
	'&[data-orientation="responsive"]': {
		flexDirection: "column",
		borderRadius: "8px",
		"& > button + button": {
			borderTop: "1px solid #a7b7d9",
			borderLeft: "none",
		},
		"@media (max-width: 540px)": {
			flexDirection: "row",
			borderRadius: "999px",
			"& > button + button": {
				borderTop: "none",
				borderLeft: "1px solid #a7b7d9",
			},
		},
	},
});

const ModeButton = styled("button")({
	border: "none",
	borderLeft: "1px solid #a7b7d9",
	backgroundColor: "#fff",
	color: "#234",
	fontSize: "10px",
	lineHeight: "13px",
	letterSpacing: "-0.5px",
	padding: "3px 8px",
	cursor: "pointer",
	whiteSpace: "nowrap",
	"&:first-of-type": {
		borderLeft: "none",
	},
	'&[data-active="true"]': {
		backgroundColor: "#176eee",
		color: "#fff",
		fontWeight: 700,
	},
});

SummaryValueModeToggle.displayName = "SummaryValueModeToggle";

export default SummaryValueModeToggle;
