import { Popover } from "@mui/material";
import { styled } from "@mui/system";
import React from "react";
import { useTranslation } from "react-i18next";
import IngredientIcon from "../../../../ui/IvCalc/IngredientIcon";
import type PokemonBox from "../../../../util/PokemonBox";
import type { DailySummary, IngredientResult } from "../types/TimeSlotTypes";
import {
	calculateIngredientTotalCount,
	formatIngredientCount,
	groupLowDailyIngredientsForAverage,
	sortIngredientsByCountDesc,
} from "../utils/IngredientDisplayUtils";
import {
	formatSummaryEp,
	formatSummaryInteger,
	formatSummaryNumber,
	resolveSummaryValueMode,
	type SummaryValueMode,
	toSummaryModeValue,
} from "../utils/SummaryValueModeUtils";
import EpValue from "./EpValue";
import IngredientOthersPopover from "./IngredientOthersPopover";
import TeamTimelineIcon from "./TimelineIcons";

export type SummaryLayoutMode = "details" | "average";

interface DailySummaryRowProps {
	dailySummaries: DailySummary[];
	box: PokemonBox;
	label?: string;
	layoutMode?: SummaryLayoutMode;
	simulationDays?: number;
	valueMode?: SummaryValueMode;
	showTimelineDurationShare?: boolean;
	timelineDurationByPokemonId?: ReadonlyMap<number, number>;
	totalTimelineDurationMinutes?: number;
}

const SUMMARY_CARD_WIDTH = 96;

interface SkillIngredientPopoverTriggerProps {
	countLabel: string;
	ingredients: IngredientResult[];
	triggerTestId?: string;
}

const SkillIngredientPopoverTrigger = React.memo(
	({
		countLabel,
		ingredients,
		triggerTestId,
	}: SkillIngredientPopoverTriggerProps) => {
		const [anchorElement, setAnchorElement] =
			React.useState<HTMLButtonElement | null>(null);
		const sortedIngredients = React.useMemo(
			() =>
				sortIngredientsByCountDesc(
					ingredients.filter((ingredient) => ingredient.count > 0),
				),
			[ingredients],
		);

		if (sortedIngredients.length === 0) {
			return <span>{countLabel}</span>;
		}

		const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
			setAnchorElement(event.currentTarget);
		};

		const handleClose = () => {
			setAnchorElement(null);
		};

		return (
			<>
				<SkillIngredientTriggerButton
					type="button"
					onClick={handleOpen}
					data-testid={triggerTestId}
				>
					{countLabel}
				</SkillIngredientTriggerButton>
				<Popover
					open={anchorElement !== null}
					anchorEl={anchorElement}
					onClose={handleClose}
					anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
					transformOrigin={{ vertical: "top", horizontal: "left" }}
					slotProps={{
						paper: {
							sx: {
								mt: "2px",
								p: "6px 8px",
								borderRadius: "8px",
								border: "1px solid #d6d6d6",
								boxShadow: "0 4px 10px rgba(0, 0, 0, 0.14)",
								minWidth: "120px",
							},
						},
					}}
				>
					<SkillIngredientPopoverBody>
						{sortedIngredients.map((ingredient) => (
							<SkillIngredientPopoverItem key={ingredient.name}>
								<IngredientIcon name={ingredient.name} />
								<span>{formatIngredientCount(ingredient.count)}</span>
							</SkillIngredientPopoverItem>
						))}
					</SkillIngredientPopoverBody>
				</Popover>
			</>
		);
	},
);

function formatTimelineDurationMetric(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

function formatTimelineDurationShare(
	activeMinutes: number,
	totalTimelineMinutes: number,
	durationDivisor: number,
): string {
	if (totalTimelineMinutes <= 0) {
		return "";
	}
	const normalizedDivisor = durationDivisor > 0 ? durationDivisor : 1;
	const normalizedActiveMinutes = activeMinutes / normalizedDivisor;
	const normalizedTotalMinutes = totalTimelineMinutes / normalizedDivisor;
	const activeHours = normalizedActiveMinutes / 60;
	const ratioPercent =
		normalizedTotalMinutes > 0
			? (normalizedActiveMinutes / normalizedTotalMinutes) * 100
			: 0;
	return `${formatTimelineDurationMetric(activeHours)}H (${formatTimelineDurationMetric(ratioPercent)}％)`;
}

const DailySummaryRow = React.memo(
	({
		dailySummaries,
		box,
		label,
		layoutMode = "details",
		simulationDays = 1,
		valueMode = "periodTotal",
		showTimelineDurationShare = false,
		timelineDurationByPokemonId,
		totalTimelineDurationMinutes = 0,
	}: DailySummaryRowProps) => {
		const { t } = useTranslation();
		const resolvedValueMode = resolveSummaryValueMode(
			valueMode,
			simulationDays,
		);
		const convertedDayDivisor =
			resolvedValueMode === "dailyAverage" ? 1 : Math.max(simulationDays, 1);
		const timelineDurationDivisor =
			resolvedValueMode === "dailyAverage" ? Math.max(simulationDays, 1) : 1;
		const convertByMode = (value: number): number =>
			toSummaryModeValue(value, resolvedValueMode, simulationDays);
		const shouldShowTimelineDurationShare =
			showTimelineDurationShare && totalTimelineDurationMinutes > 0;

		return (
			<RowWrapper data-testid="daily-summary-row" data-layout={layoutMode}>
				{layoutMode === "details" && label && <LabelText>{label}</LabelText>}
				<GridCell data-testid="daily-summary-grid">
					{dailySummaries.map((summary) => {
						const pokemon = box.getById(summary.pokemonId);
						const pokemonName =
							pokemon?.filledNickname(t) ?? `ID: ${summary.pokemonId}`;
						const sortedIngredients = sortIngredientsByCountDesc(
							summary.totalIngredients
								.filter((i) => i.count > 0)
								.map((i) => ({ ...i, count: convertByMode(i.count) })),
						);
						const sortedSkillIngredients = sortIngredientsByCountDesc(
							(summary.totalSkillIngredients ?? [])
								.filter((i) => i.count > 0)
								.map((i) => ({ ...i, count: convertByMode(i.count) })),
						);
						const groupedAverageIngredients =
							groupLowDailyIngredientsForAverage(
								sortedIngredients,
								convertedDayDivisor,
							);
						const displayIngredients =
							layoutMode === "average"
								? groupedAverageIngredients.visibleIngredients
								: sortedIngredients;
						const overflowIngredients = sortIngredientsByCountDesc(
							summary.totalOverflowIngredients
								.filter((i) => i.count > 0)
								.map((i) => ({ ...i, count: convertByMode(i.count) })),
						);
						const ingredientTotalCount =
							calculateIngredientTotalCount(sortedIngredients);
						const totalHelpCount = convertByMode(summary.totalHelpCount);
						const totalSkillCount = convertByMode(summary.totalSkillCount);
						const totalBerryCount = convertByMode(summary.totalBerryCount);
						const totalHugeMagoBerryCount = convertByMode(
							summary.totalHugeMagoBerryCount ?? 0,
						);
						const skillEP = convertByMode(summary.skillEP);
						const berryEP = convertByMode(summary.berryEP);
						const ingredientEP = convertByMode(summary.ingredientEP);
						const totalEP = convertByMode(summary.totalEP);
						const totalSkillOverflowCount = convertByMode(
							summary.totalSkillOverflowCount,
						);
						const totalPresentCandyCount = convertByMode(
							summary.totalPresentCandyCount,
						);
						const totalCookingPotCapacityIncrease = convertByMode(
							summary.totalCookingPotCapacityIncrease,
						);
						const totalTastyChanceIncreasePercent = convertByMode(
							summary.totalTastyChanceIncreasePercent,
						);
						const totalDreamShardCount = convertByMode(
							summary.totalDreamShardCount,
						);
						const durationShareLabel = shouldShowTimelineDurationShare
							? formatTimelineDurationShare(
									timelineDurationByPokemonId?.get(summary.pokemonId) ?? 0,
									totalTimelineDurationMinutes,
									timelineDurationDivisor,
								)
							: null;
						const hasOptionLine =
							totalPresentCandyCount > 0 ||
							totalCookingPotCapacityIncrease > 0 ||
							totalTastyChanceIncreasePercent > 0 ||
							totalDreamShardCount > 0;
						return (
							<SummaryCard
								key={`${layoutMode}-${summary.pokemonId}`}
								data-testid="daily-summary-cell"
							>
								<SummaryHeader>
									<div className="top-row">
										<span className="name">{pokemonName}</span>
										{pokemon && (
											<span className="level">
												<span className="lv">Lv.</span>
												{pokemon.iv.level}
											</span>
										)}
									</div>
									{durationShareLabel && (
										<span className="duration-share">{durationShareLabel}</span>
									)}
								</SummaryHeader>

								<EPBox>
									<EPLine
										data-testid={`daily-summary-ep-berry-${summary.pokemonId}`}
									>
										<TeamTimelineIcon
											name="berry"
											data-testid={`daily-summary-ep-icon-berry-${summary.pokemonId}`}
										/>
										<EpValue value={formatSummaryEp(berryEP)} />
									</EPLine>
									<EPLine
										data-testid={`daily-summary-ep-skill-${summary.pokemonId}`}
									>
										<TeamTimelineIcon
											name="skill"
											data-testid={`daily-summary-ep-icon-skill-${summary.pokemonId}`}
										/>
										<EpValue value={formatSummaryEp(skillEP)} />
									</EPLine>
									{summary.cookingEP != null ? (
										<EPLine
											data-testid={`daily-summary-ep-cooking-${summary.pokemonId}`}
										>
											<TeamTimelineIcon
												name="cooking"
												data-testid={`daily-summary-ep-icon-cooking-${summary.pokemonId}`}
											/>
											<EpValue
												value={formatSummaryEp(
													convertByMode(summary.cookingEP),
												)}
											/>
										</EPLine>
									) : (
										<EPLine
											data-testid={`daily-summary-ep-ingredient-${summary.pokemonId}`}
										>
											<TeamTimelineIcon
												name="cooking"
												data-testid={`daily-summary-ep-icon-ingredient-${summary.pokemonId}`}
											/>
											<EpValue value={formatSummaryEp(ingredientEP)} />
										</EPLine>
									)}
									<Divider />
									<TotalLine>
										<EpValue value={formatSummaryEp(totalEP)} />
									</TotalLine>
								</EPBox>

								<MetricsArea
									data-testid={`daily-summary-metrics-${summary.pokemonId}`}
								>
									<Line
										data-testid={`daily-summary-count-help-${summary.pokemonId}`}
									>
										<TeamTimelineIcon
											name="work"
											data-testid={`daily-summary-count-icon-work-${summary.pokemonId}`}
										/>
										{formatSummaryNumber(totalHelpCount)}
									</Line>
									<Line
										data-testid={`daily-summary-count-berry-${summary.pokemonId}`}
									>
										<TeamTimelineIcon
											name="berry"
											data-testid={`daily-summary-count-icon-berry-${summary.pokemonId}`}
										/>
										{formatSummaryNumber(totalBerryCount)}
									</Line>
									{totalHugeMagoBerryCount > 0 && (
										<Line
											data-testid={`daily-summary-count-huge-mago-berry-${summary.pokemonId}`}
											title="とてもおおきなマゴのみ"
										>
											<TeamTimelineIcon
												name="berry_huge"
												data-testid={`daily-summary-count-icon-huge-mago-berry-${summary.pokemonId}`}
											/>
											{formatSummaryNumber(totalHugeMagoBerryCount)}
										</Line>
									)}
									<Line
										data-testid={`daily-summary-count-skill-${summary.pokemonId}`}
									>
										<TeamTimelineIcon
											name="skill"
											data-testid={`daily-summary-count-icon-skill-${summary.pokemonId}`}
										/>
										<SkillIngredientPopoverTrigger
											countLabel={formatSummaryNumber(totalSkillCount)}
											ingredients={sortedSkillIngredients}
											triggerTestId={`skill-ingredient-trigger-${summary.pokemonId}`}
										/>
										{totalSkillOverflowCount > 0 && (
											<SkillOverflowIcon
												data-testid={`daily-summary-count-skill-overflow-${summary.pokemonId}`}
											>
												<TeamTimelineIcon
													name="skill_none"
													data-testid={`daily-summary-count-icon-skill-overflow-${summary.pokemonId}`}
												/>
												{formatSummaryNumber(totalSkillOverflowCount)}
											</SkillOverflowIcon>
										)}
									</Line>
									<IngredientLine>
										<IngredientTotalItem>
											食材合計:{" "}
											<span className="value">
												{formatSummaryInteger(ingredientTotalCount)}
											</span>
										</IngredientTotalItem>
										{displayIngredients.map((ing) => (
											<IngredientItem key={`${summary.pokemonId}-${ing.name}`}>
												<IngredientIcon name={ing.name} />
												{formatIngredientCount(ing.count)}
											</IngredientItem>
										))}
										{layoutMode === "average" && (
											<IngredientOthersPopover
												ingredients={
													groupedAverageIngredients.groupedIngredients
												}
												totalCount={groupedAverageIngredients.groupedCount}
												withLeadingSpace
											/>
										)}
									</IngredientLine>
									<OverflowContainer
										style={{
											visibility:
												overflowIngredients.length > 0 ? "visible" : "hidden",
										}}
									>
										<OverflowBracket>(</OverflowBracket>
										{overflowIngredients.map((ing) => (
											<OverflowIngredientItem
												key={`overflow-${summary.pokemonId}-${ing.name}`}
											>
												<IngredientIcon name={ing.name} />
												<span>{formatIngredientCount(ing.count)}</span>
											</OverflowIngredientItem>
										))}
										<OverflowBracket>)</OverflowBracket>
									</OverflowContainer>

									<OptionLine
										style={{ visibility: hasOptionLine ? "visible" : "hidden" }}
									>
										{totalPresentCandyCount > 0 && (
											<span>
												🍬{formatSummaryNumber(totalPresentCandyCount)}
											</span>
										)}
										{totalCookingPotCapacityIncrease > 0 && (
											<span>
												鍋+
												{formatSummaryNumber(totalCookingPotCapacityIncrease)}
											</span>
										)}
										{totalTastyChanceIncreasePercent > 0 && (
											<span>
												料理大成功+
												{formatSummaryNumber(totalTastyChanceIncreasePercent)}%
											</span>
										)}
										{totalDreamShardCount > 0 && (
											<span>
												<TeamTimelineIcon
													name="dream"
													data-testid={`daily-summary-option-icon-dream-${summary.pokemonId}`}
												/>
												+{formatSummaryNumber(totalDreamShardCount)}
											</span>
										)}
									</OptionLine>
								</MetricsArea>
							</SummaryCard>
						);
					})}
				</GridCell>
			</RowWrapper>
		);
	},
);

const RowWrapper = styled("div")({
	width: "100%",
	display: "flex",
	flexDirection: "column",
	gap: "4px",
	marginTop: "6px",
});

const LabelText = styled("div")({
	width: "100%",
	fontSize: "10px",
	lineHeight: "13px",
	letterSpacing: "-0.5px",
	color: "#000",
	fontWeight: 700,
	whiteSpace: "pre-wrap",
});

const GridCell = styled("div")({
	display: "grid",
	gridTemplateColumns: `repeat(auto-fit, minmax(${SUMMARY_CARD_WIDTH}px, 1fr))`,
	gap: "6px 4px",
	alignItems: "stretch",
	width: "100%",
	minWidth: 0,
});

const SummaryCard = styled("div")({
	width: "100%",
	minWidth: 0,
	boxSizing: "border-box",
	backgroundColor: "#fff",
	borderRadius: "6px",
	padding: 0,
	display: "flex",
	flexDirection: "column",
	alignSelf: "stretch",
});

const SummaryHeader = styled("div")({
	width: "100%",
	minHeight: "24px",
	padding: "4px 4px 0 5px",
	boxSizing: "border-box",
	display: "flex",
	flexDirection: "column",
	gap: "1px",
	"& .top-row": {
		display: "flex",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: "2px",
		minWidth: 0,
	},
	"& .name": {
		minWidth: 0,
		flex: "1 1 auto",
		fontSize: "12px",
		lineHeight: "15px",
		letterSpacing: "-0.48px",
		whiteSpace: "nowrap",
		overflow: "hidden",
		textOverflow: "ellipsis",
	},
	"& .level": {
		flex: "0 0 auto",
		marginTop: "2px",
		display: "inline-flex",
		gap: "1px",
		fontSize: "10px",
		lineHeight: "13px",
		letterSpacing: "-0.5px",
	},
	"& .lv": {
		color: "#62d540",
	},
	"& .duration-share": {
		fontSize: "10px",
		lineHeight: "13px",
		letterSpacing: "-0.5px",
		color: "#666",
		whiteSpace: "nowrap",
	},
});

const MetricsArea = styled("div")({
	marginLeft: "4px",
});

const Line = styled("div")({
	display: "flex",
	alignItems: "center",
	gap: "1px",
	fontSize: "12px",
	lineHeight: "15px",
	letterSpacing: "-0.48px",
	whiteSpace: "nowrap",
	"& svg": {
		width: "12px",
		height: "12px",
	},
});

const SkillOverflowIcon = styled("span")({
	display: "inline-flex",
	alignItems: "center",
	fontSize: "12px",
	lineHeight: "15px",
	letterSpacing: "-0.48px",
	fontWeight: 400,
	color: "#9e9e9e",
	marginLeft: "2px",
	"& svg": {
		width: "12px",
		height: "12px",
		marginRight: "1px",
	},
});

const SkillIngredientTriggerButton = styled("button")({
	border: 0,
	background: "transparent",
	padding: 0,
	margin: 0,
	color: "inherit",
	font: "inherit",
	lineHeight: "inherit",
	textDecoration: "underline",
	cursor: "pointer",
});

const SkillIngredientPopoverBody = styled("div")({
	display: "flex",
	flexDirection: "column",
	gap: "4px",
	fontSize: "11px",
	lineHeight: "14px",
	letterSpacing: "-0.44px",
});

const SkillIngredientPopoverItem = styled("div")({
	display: "inline-flex",
	alignItems: "center",
	gap: "2px",
	"& svg": {
		width: "14px",
		height: "14px",
	},
});

const IngredientLine = styled("div")({
	display: "flex",
	alignItems: "center",
	flexWrap: "wrap",
	gap: "1px",
	minHeight: "30px",
	fontSize: "12px",
	lineHeight: "15px",
	letterSpacing: "-0.48px",
});

const IngredientItem = styled("span")({
	display: "inline-flex",
	alignItems: "center",
	gap: "1px",
	"& svg": {
		width: "14px",
		height: "14px",
	},
});

const IngredientTotalItem = styled("span")({
	flexBasis: "100%",
	fontSize: "12px",
	lineHeight: "15px",
	letterSpacing: "-0.48px",
	color: "#555",
	whiteSpace: "nowrap",
	"& .value": {
		fontWeight: 700,
	},
});

const OverflowIngredientItem = styled("span")({
	display: "inline-flex",
	alignItems: "center",
	gap: "1px",
	color: "#9e9e9e",
	fontSize: "10px",
	lineHeight: "13px",
	"& svg": {
		width: "14px",
		height: "14px",
		opacity: 0.6,
	},
});

const OverflowContainer = styled("div")({
	display: "flex",
	alignItems: "center",
	flexWrap: "wrap",
	gap: "1px",
	color: "#9e9e9e",
	fontSize: "10px",
	lineHeight: "13px",
	letterSpacing: "-0.5px",
	minHeight: "13px",
});

const OverflowBracket = styled("span")({
	color: "#9e9e9e",
});

const OptionLine = styled("div")({
	display: "flex",
	flexWrap: "wrap",
	gap: "3px",
	fontSize: "10px",
	lineHeight: "13px",
	letterSpacing: "-0.5px",
	minHeight: "13px",
	"& > span": {
		display: "inline-flex",
		alignItems: "center",
		gap: "1px",
	},
	"& svg": {
		width: "10px",
		height: "10px",
	},
});

const EPBox = styled("div")({
	width: "calc(100% - 8px)",
	boxSizing: "border-box",
	marginLeft: "4px",
	marginRight: "4px",
	marginBottom: "4px",
	borderRadius: "4px",
	backgroundColor: "#fffad5",
	padding: "4px 6px",
	display: "flex",
	flexDirection: "column",
	gap: "1px",
});

const EPLine = styled("div")({
	display: "flex",
	alignItems: "center",
	gap: "1px",
	fontSize: "12px",
	lineHeight: "15px",
	letterSpacing: "-0.48px",
	whiteSpace: "nowrap",
	"& svg": {
		width: "12px",
		height: "12px",
	},
});

const Divider = styled("div")({
	borderTop: "1px dashed #b9b9b9",
	marginTop: "1px",
	marginBottom: "1px",
});

const TotalLine = styled("div")({
	fontSize: "24px",
	lineHeight: "30px",
	fontWeight: 700,
	letterSpacing: "0",
	transform: "scale(0.5)",
	transformOrigin: "top left",
	width: "180px",
	height: "15px",
});

export default DailySummaryRow;
