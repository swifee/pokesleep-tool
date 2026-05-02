import { Box, Button, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import PokemonIcon from "../../../../ui/IvCalc/PokemonIcon";
import type { SwapSupplementSequence } from "../utils/SwapSupplementUtils";

export interface SwapSupplementBarProps {
	swapCount: number;
	swapSequences: SwapSupplementSequence[];
	onClear: () => void;
}

function formatMetric(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPercentMetric(value: number): string {
	return String(Math.round(value));
}

const SwapSupplementBar = React.memo(
	({ swapCount, swapSequences, onClear }: SwapSupplementBarProps) => {
		const { t } = useTranslation();

		if (swapCount <= 0) {
			return null;
		}

		return (
			<Box
				data-testid="swap-supplement-bar"
				sx={{
					display: "flex",
					flexDirection: "column",
					alignItems: "stretch",
					gap: "2px",
					width: "100%",
					minHeight: "30px",
					px: "8px",
					py: "5px",
					boxSizing: "border-box",
					mb: "13px",
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "flex-start",
						flexWrap: "wrap",
						gap: "4px",
					}}
				>
					<Typography
						sx={{
							fontSize: "12px",
							lineHeight: "15px",
							letterSpacing: "-0.48px",
							color: "#1976d2",
						}}
					>
						{t(
							"TeamTimeline.swap configured notice",
							"途中でのポケモン入れ替えが設定されています。",
						)}
					</Typography>
					<Button
						variant="outlined"
						data-testid="swap-supplement-delete-button"
						onClick={onClear}
						sx={{
							minWidth: "40px",
							height: "18px",
							borderRadius: "8px",
							px: "8px",
							borderColor: "#1976d2",
							backgroundColor: "#fff",
							color: "#1976d2",
							fontSize: "10px",
							lineHeight: "12px",
							letterSpacing: "-0.48px",
							fontWeight: 400,
							flexShrink: 0,
							"&:hover": {
								borderColor: "#1976d2",
								backgroundColor: "#f4f8ff",
							},
						}}
					>
						{t("TeamTimeline.reset", "リセット")}
					</Button>
				</Box>
				{swapSequences.length > 0 && (
					<Box
						sx={{
							display: "flex",
							flexWrap: "wrap",
							gap: "3px 9px",
							alignItems: "flex-start",
							minHeight: "22px",
						}}
					>
						{swapSequences.map((sequence) => (
							<Box
								key={`swap-sequence-${sequence.teamSlotIndex}`}
								data-testid="swap-supplement-sequence"
								sx={{
									display: "inline-flex",
									flexWrap: "nowrap",
									alignItems: "flex-start",
									gap: "0px",
								}}
							>
								{sequence.entries.map((entry, index) => {
									const duplicateCount = sequence.entries
										.slice(0, index)
										.filter(
											(candidate) =>
												candidate.pokemonId === entry.pokemonId &&
												candidate.activeMinutes === entry.activeMinutes &&
												candidate.activeRatioPercent ===
													entry.activeRatioPercent,
										).length;
									const entryKey = [
										sequence.teamSlotIndex,
										entry.pokemonId,
										entry.activeMinutes,
										entry.activeRatioPercent,
										duplicateCount,
									].join("-");
									return (
										<React.Fragment key={entryKey}>
											<Box
												data-testid="swap-supplement-icon"
												sx={{
													width: "28px",
													display: "inline-flex",
													flexDirection: "column",
													alignItems: "center",
													gap: "0.5px",
												}}
											>
												<Box
													sx={{
														width: "22px",
														height: "22px",
														borderRadius: "4px",
														overflow: "hidden",
														border: "1px solid #d0e0ff",
														backgroundColor: "#fff",
														display: "inline-flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<PokemonIcon idForm={entry.pokemonIdForm} size={20} />
												</Box>
												<Typography
													data-testid="swap-supplement-hours"
													sx={{
														fontSize: "8px",
														lineHeight: "10px",
														letterSpacing: "-0.32px",
														color: "#000",
														whiteSpace: "nowrap",
													}}
												>
													{`${formatMetric(entry.activeMinutes / 60)}H`}
												</Typography>
												<Typography
													data-testid="swap-supplement-percent"
													sx={{
														fontSize: "8px",
														lineHeight: "10px",
														letterSpacing: "-0.32px",
														color: "#000",
														whiteSpace: "nowrap",
													}}
												>
													{`(${formatPercentMetric(entry.activeRatioPercent)}%)`}
												</Typography>
											</Box>
											{index < sequence.entries.length - 1 && (
												<Typography
													data-testid="swap-supplement-arrow"
													sx={{
														mt: 0,
														mx: "-3px",
														minWidth: "6px",
														height: "22px",
														display: "inline-flex",
														alignItems: "center",
														justifyContent: "center",
														fontSize: "7px",
														lineHeight: "7px",
														color: "#9e9e9e",
													}}
												>
													{"▶"}
												</Typography>
											)}
										</React.Fragment>
									);
								})}
							</Box>
						))}
					</Box>
				)}
			</Box>
		);
	},
);

SwapSupplementBar.displayName = "SwapSupplementBar";

export default SwapSupplementBar;
