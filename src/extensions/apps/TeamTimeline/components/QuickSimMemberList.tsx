import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import {
	Box,
	Button,
	IconButton,
	Slider,
	TextField,
	Typography,
} from "@mui/material";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import PokemonIcon from "../../../../ui/IvCalc/PokemonIcon";
import type PokemonBox from "../../../../util/PokemonBox";
import {
	MINUTES_PER_DAY,
	QUICK_SIM_MAX_USAGE_PERCENT,
	QUICK_SIM_MIN_USAGE_PERCENT,
	QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
	QUICK_SIM_USAGE_STEP_PERCENT,
	type QuickSimMember,
} from "../types/QuickSimTypes";
import {
	clampQuickSimUsagePercent,
	getQuickSimTotalUsagePercent,
	usagePercentToMinutes,
} from "../utils/QuickSimScheduler";
import {
	NUMERIC_TEXT_FIELD_SX,
	STEP_BUTTON_SX,
	STEP_BUTTON_SYMBOL_SX,
} from "./CookingSettingsStyles";

interface QuickSimMemberListProps {
	members: QuickSimMember[];
	box: PokemonBox;
	onChange: (members: QuickSimMember[]) => void;
	onAddClick: () => void;
	onImportClick: () => void;
}

const MEMBER_ICON_SIZE_PX = 30;
const MINUTES_PER_HOUR = 60;

/**
 * 1日あたりの起用時間を "6.5h" のように表示する
 */
export function formatUsageHoursPerDay(usagePercent: number): string {
	const minutes = usagePercentToMinutes(usagePercent);
	const hours = minutes / MINUTES_PER_HOUR;
	const rounded = Math.round(hours * 10) / 10;
	return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}h`;
}

/**
 * 簡易シミュのメンバー一覧と起用率の入力
 */
const QuickSimMemberList = React.memo(
	({
		members,
		box,
		onChange,
		onAddClick,
		onImportClick,
	}: QuickSimMemberListProps) => {
		const { t } = useTranslation();
		const totalPercent = getQuickSimTotalUsagePercent(members);
		const isExceeded = totalPercent > QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT;

		const handleUsageChange = useCallback(
			(pokemonId: number, usagePercent: number) => {
				const clamped = clampQuickSimUsagePercent(usagePercent);
				onChange(
					members.map((member) =>
						member.pokemonId === pokemonId
							? { ...member, usagePercent: clamped }
							: member,
					),
				);
			},
			[members, onChange],
		);

		const handleUsageStep = useCallback(
			(pokemonId: number, delta: number) => {
				const current =
					members.find((member) => member.pokemonId === pokemonId)
						?.usagePercent ?? 0;
				handleUsageChange(pokemonId, current + delta);
			},
			[handleUsageChange, members],
		);

		const handleRemove = useCallback(
			(pokemonId: number) => {
				onChange(members.filter((member) => member.pokemonId !== pokemonId));
			},
			[members, onChange],
		);

		return (
			<Box
				data-testid="quick-sim-member-list"
				sx={{
					border: "1px solid #e1e1e1",
					borderRadius: "8px",
					p: "10px 12px",
					mb: 2,
					backgroundColor: "#fff",
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						flexWrap: "wrap",
						gap: 1,
						mb: 1,
					}}
				>
					<Typography variant="subtitle2" sx={{ mr: "auto" }}>
						{t("TeamTimeline.quick members", "メンバーと起用率")}
					</Typography>
					<Button
						variant="outlined"
						size="small"
						startIcon={<AddIcon />}
						onClick={onAddClick}
						data-testid="quick-sim-add-member-button"
					>
						{t("TeamTimeline.quick add member", "ポケモンを追加")}
					</Button>
					<Button
						variant="text"
						size="small"
						onClick={onImportClick}
						data-testid="quick-sim-import-team-button"
					>
						{t(
							"TeamTimeline.quick import team",
							"詳細シミュのチームを取り込む",
						)}
					</Button>
				</Box>

				{members.length === 0 ? (
					<Typography
						variant="body2"
						sx={{ color: "#666", py: 1 }}
						data-testid="quick-sim-member-empty"
					>
						{t(
							"TeamTimeline.quick members empty",
							"ポケモンを追加して、1日のうち編成に入れる割合（起用率）を設定してください。",
						)}
					</Typography>
				) : (
					<Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						{members.map((member) => {
							const item = box.getById(member.pokemonId);
							if (!item) {
								return null;
							}
							return (
								<Box
									key={member.pokemonId}
									data-testid={`quick-sim-member-row-${member.pokemonId}`}
									sx={{
										display: "grid",
										gridTemplateColumns: "auto minmax(0, 1fr) auto",
										alignItems: "center",
										columnGap: 1,
										rowGap: "2px",
									}}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: "6px",
											minWidth: 0,
										}}
									>
										<PokemonIcon
											idForm={item.iv.idForm}
											shiny={item.iv.shiny}
											size={MEMBER_ICON_SIZE_PX}
										/>
										<Box sx={{ minWidth: 0 }}>
											<Typography
												sx={{
													fontSize: "12px",
													lineHeight: "15px",
													fontWeight: 700,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
													maxWidth: "9rem",
												}}
												data-testid={`quick-sim-member-name-${member.pokemonId}`}
											>
												{item.filledNickname(t)}
											</Typography>
											<Typography
												sx={{
													fontSize: "10px",
													lineHeight: "13px",
													color: "#666",
												}}
											>
												<span style={{ color: "#62d540" }}>Lv.</span>
												{item.iv.level}
												{" / "}
												<span
													data-testid={`quick-sim-member-hours-${member.pokemonId}`}
												>
													{t(
														"TeamTimeline.quick hours per day",
														"{{hours}}/日",
														{
															hours: formatUsageHoursPerDay(
																member.usagePercent,
															),
														},
													)}
												</span>
											</Typography>
										</Box>
									</Box>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: "4px",
											minWidth: 0,
										}}
									>
										<Slider
											size="small"
											value={member.usagePercent}
											min={QUICK_SIM_MIN_USAGE_PERCENT}
											max={QUICK_SIM_MAX_USAGE_PERCENT}
											step={1}
											onChange={(_, value) =>
												handleUsageChange(
													member.pokemonId,
													Array.isArray(value) ? value[0] : value,
												)
											}
											aria-label={t("TeamTimeline.quick usage", "起用率")}
											data-testid={`quick-sim-member-slider-${member.pokemonId}`}
											sx={{ flexGrow: 1, minWidth: "60px", mx: "6px" }}
										/>
										<Button
											variant="contained"
											size="small"
											disableElevation
											sx={STEP_BUTTON_SX}
											onClick={() =>
												handleUsageStep(
													member.pokemonId,
													-QUICK_SIM_USAGE_STEP_PERCENT,
												)
											}
											data-testid={`quick-sim-member-decrement-${member.pokemonId}`}
										>
											<Box component="span" className="step-button-circle">
												<Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>
													-
												</Box>
											</Box>
										</Button>
										<TextField
											type="number"
											size="small"
											variant="standard"
											value={member.usagePercent}
											onChange={(event) => {
												const parsed = Number.parseInt(event.target.value, 10);
												if (!Number.isNaN(parsed)) {
													handleUsageChange(member.pokemonId, parsed);
												}
											}}
											inputProps={{
												min: QUICK_SIM_MIN_USAGE_PERCENT,
												max: QUICK_SIM_MAX_USAGE_PERCENT,
												"aria-label": t("TeamTimeline.quick usage", "起用率"),
											}}
											sx={NUMERIC_TEXT_FIELD_SX}
											data-testid={`quick-sim-member-input-${member.pokemonId}`}
										/>
										<Typography sx={{ fontSize: "12px" }}>%</Typography>
										<Button
											variant="contained"
											size="small"
											disableElevation
											sx={STEP_BUTTON_SX}
											onClick={() =>
												handleUsageStep(
													member.pokemonId,
													QUICK_SIM_USAGE_STEP_PERCENT,
												)
											}
											data-testid={`quick-sim-member-increment-${member.pokemonId}`}
										>
											<Box component="span" className="step-button-circle">
												<Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>
													+
												</Box>
											</Box>
										</Button>
									</Box>
									<IconButton
										size="small"
										onClick={() => handleRemove(member.pokemonId)}
										title={t("TeamTimeline.delete", "削除")}
										aria-label={t("TeamTimeline.delete", "削除")}
										data-testid={`quick-sim-member-remove-${member.pokemonId}`}
									>
										<CloseIcon sx={{ fontSize: 14 }} />
									</IconButton>
								</Box>
							);
						})}
					</Box>
				)}

				<Typography
					variant="caption"
					sx={{
						mt: 1,
						display: "block",
						color: isExceeded ? "error.main" : "#666",
						fontWeight: isExceeded ? 700 : 400,
					}}
					data-testid="quick-sim-usage-total"
				>
					{t(
						"TeamTimeline.quick usage total",
						"起用率合計: {{total}}% / {{limit}}%",
						{
							total: totalPercent,
							limit: QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
						},
					)}
					{isExceeded &&
						` ${t(
							"TeamTimeline.quick usage exceeded",
							"合計が{{limit}}%を超えています。",
							{ limit: QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT },
						)}`}
				</Typography>
				<Typography
					variant="caption"
					sx={{ display: "block", color: "#666" }}
					data-testid="quick-sim-usage-note"
				>
					{t(
						"TeamTimeline.quick usage note",
						"100% = 1枠を1日中占有（{{hours}}h）。合計は最大{{limit}}%（5枠分）です。",
						{
							hours: MINUTES_PER_DAY / MINUTES_PER_HOUR,
							limit: QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
						},
					)}
				</Typography>
			</Box>
		);
	},
);

QuickSimMemberList.displayName = "QuickSimMemberList";

export default QuickSimMemberList;
