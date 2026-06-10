import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
	Box,
	IconButton,
	Link,
	Slider,
	Tooltip,
	Typography,
} from "@mui/material";
import type { SliderValueLabelProps } from "@mui/material/Slider";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TrialSummary } from "../types/MultiTrialTypes";
import EpValue from "./EpValue";

export interface TrialResultSelectorProps {
	results: readonly TrialSummary[];
	selectedIndex: number;
	onSelect: (index: number) => void;
}

const MIN_HISTOGRAM_BINS = 6;
const MAX_HISTOGRAM_BINS = 120;
const HISTOGRAM_BIN_GROWTH_RATE = 1.6;
const MIN_HISTOGRAM_BAR_HEIGHT_PERCENT = 2;
const HISTOGRAM_BAR_OVERLAP_PX = 1;
const DISTRIBUTION_CHART_HEIGHT_PX = 50;
const DISTRIBUTION_VISIBILITY_STORAGE_KEY =
	"PstTeamTimelineDistributionVisible";
const EDGE_AWARE_TOOLTIP_PADDING_PX = 8;
const EDGE_AWARE_TOOLTIP_OFFSET_Y_PX = 8;
const SLIDER_ARROW_ICON_VERTICAL_OFFSET_PX = -2;
const COPY_SEED_ICON_SIZE_PX = 12;

const EdgeAwareSliderValueLabel = React.memo(
	({ children, open, value }: SliderValueLabelProps) => (
		<Tooltip
			open={open}
			placement="top"
			title={value}
			disableFocusListener
			disableHoverListener
			disableTouchListener
			slotProps={{
				popper: {
					modifiers: [
						{
							name: "flip",
							enabled: true,
							options: {
								padding: EDGE_AWARE_TOOLTIP_PADDING_PX,
								rootBoundary: "viewport",
							},
						},
						{
							name: "preventOverflow",
							enabled: true,
							options: {
								padding: EDGE_AWARE_TOOLTIP_PADDING_PX,
								rootBoundary: "viewport",
							},
						},
						{
							name: "offset",
							options: {
								offset: [0, EDGE_AWARE_TOOLTIP_OFFSET_Y_PX],
							},
						},
					],
				},
				tooltip: {
					sx: {
						maxWidth: "min(220px, calc(100vw - 16px))",
						whiteSpace: "nowrap",
					},
				},
			}}
		>
			{children}
		</Tooltip>
	),
);

EdgeAwareSliderValueLabel.displayName = "EdgeAwareSliderValueLabel";

function resolveHistogramBinIndex(
	value: number,
	minValue: number,
	range: number,
	binCount: number,
): number {
	if (binCount <= 1 || range <= 0) {
		return 0;
	}

	const normalized = (value - minValue) / range;
	const rawIndex = Math.floor(normalized * (binCount - 1));
	return Math.max(0, Math.min(binCount - 1, rawIndex));
}

function resolveHistogramBinCount(trialCount: number): number {
	if (trialCount <= 1) {
		return 1;
	}

	const scaledBinCount = Math.round(
		Math.sqrt(trialCount) * HISTOGRAM_BIN_GROWTH_RATE,
	);
	const clampedBinCount = Math.max(
		MIN_HISTOGRAM_BINS,
		Math.min(MAX_HISTOGRAM_BINS, scaledBinCount),
	);
	return Math.min(trialCount, clampedBinCount);
}

function resolveDisplaySliderValue(
	selectedIndex: number,
	maxIndex: number,
): number {
	return Math.max(0, Math.min(maxIndex, maxIndex - selectedIndex));
}

function resolveSelectedIndexFromSliderValue(
	sliderValue: number,
	maxIndex: number,
): number {
	return Math.max(0, Math.min(maxIndex, maxIndex - sliderValue));
}

function normalizeSingleSliderValue(value: number | number[]): number {
	if (Array.isArray(value)) {
		return value[0] ?? 0;
	}
	return value;
}

function loadDistributionVisibilityFromStorage(): boolean {
	try {
		const raw = window.localStorage.getItem(
			DISTRIBUTION_VISIBILITY_STORAGE_KEY,
		);
		if (raw === null) {
			return true;
		}
		return raw === "1";
	} catch {
		return true;
	}
}

function saveDistributionVisibilityToStorage(isVisible: boolean): void {
	try {
		window.localStorage.setItem(
			DISTRIBUTION_VISIBILITY_STORAGE_KEY,
			isVisible ? "1" : "0",
		);
	} catch {
		// Ignore storage errors and keep in-memory behavior.
	}
}

const TrialResultSelector = React.memo(
	({ results, selectedIndex, onSelect }: TrialResultSelectorProps) => {
		const { t } = useTranslation();
		const maxIndex = Math.max(results.length - 1, 0);
		const [localSliderValue, setLocalSliderValue] = useState<number>(() =>
			resolveDisplaySliderValue(selectedIndex, maxIndex),
		);
		const [showDistribution, setShowDistribution] = useState<boolean>(() =>
			loadDistributionVisibilityFromStorage(),
		);
		const trialSeedLabel = t("TeamTimeline.trial seed label", "シード");

		useEffect(() => {
			setLocalSliderValue(resolveDisplaySliderValue(selectedIndex, maxIndex));
		}, [selectedIndex, maxIndex]);

		const clampedSliderValue = Math.max(
			0,
			Math.min(localSliderValue, maxIndex),
		);
		const selectedTrialIndex = resolveSelectedIndexFromSliderValue(
			clampedSliderValue,
			maxIndex,
		);
		const selectedRank = selectedIndex + 1;
		const selectedSeed = results[selectedIndex]?.seed;

		const histogram = useMemo(() => {
			if (results.length === 0) {
				return {
					bins: [0],
					maxBinCount: 0,
					minEp: 0,
					range: 0,
				};
			}

			const binCount = resolveHistogramBinCount(results.length);
			const bins = Array.from({ length: binCount }, () => 0);
			const epValues = results.map((result) => result.grandTotalEP);

			const minEp = Math.min(...epValues);
			const maxEp = Math.max(...epValues);
			const range = maxEp - minEp;

			epValues.forEach((ep) => {
				const binIndex = resolveHistogramBinIndex(ep, minEp, range, binCount);
				bins[binIndex] += 1;
			});

			const maxBinCount = bins.reduce(
				(currentMax, count) => Math.max(currentMax, count),
				0,
			);
			return {
				bins,
				maxBinCount,
				minEp,
				range,
			};
		}, [results]);

		const selectedEp = results[selectedTrialIndex]?.grandTotalEP;
		const selectedBinIndex =
			selectedEp === undefined
				? -1
				: resolveHistogramBinIndex(
						selectedEp,
						histogram.minEp,
						histogram.range,
						histogram.bins.length,
					);

		if (results.length <= 1) {
			return null;
		}

		const handlePrev = () => {
			if (selectedIndex >= maxIndex) {
				return;
			}
			const nextIndex = selectedIndex + 1;
			setLocalSliderValue(resolveDisplaySliderValue(nextIndex, maxIndex));
			onSelect(nextIndex);
		};

		const handleNext = () => {
			if (selectedIndex <= 0) {
				return;
			}
			const nextIndex = selectedIndex - 1;
			setLocalSliderValue(resolveDisplaySliderValue(nextIndex, maxIndex));
			onSelect(nextIndex);
		};

		const handleSliderChange = (_event: Event, value: number | number[]) => {
			setLocalSliderValue(normalizeSingleSliderValue(value));
		};

		const handleSliderCommitted = (
			_event: React.SyntheticEvent | Event,
			value: number | number[],
		) => {
			const sliderValue = normalizeSingleSliderValue(value);
			setLocalSliderValue(sliderValue);
			onSelect(resolveSelectedIndexFromSliderValue(sliderValue, maxIndex));
		};

		const handleToggleDistribution = () => {
			setShowDistribution((previous) => {
				const next = !previous;
				saveDistributionVisibilityToStorage(next);
				return next;
			});
		};

		const handleCopySeed = () => {
			if (selectedSeed === undefined || !navigator.clipboard?.writeText) {
				return;
			}
			void navigator.clipboard
				.writeText(String(selectedSeed))
				.catch(() => undefined);
		};

		return (
			<Box sx={{ mb: "10px", width: "100%" }}>
				<Box
					data-testid="trial-status-row"
					sx={{
						display: "flex",
						alignItems: "flex-end",
						color: "#000",
						fontSize: "10px",
						lineHeight: "13px",
						letterSpacing: "-0.5px",
						mb: "2px",
					}}
				>
					<Typography
						component="span"
						sx={{ fontSize: "inherit", lineHeight: "inherit" }}
					>
						{t("TeamTimeline.trial rank prefix", "{{count}}回中、", {
							count: results.length,
						})}
					</Typography>
					<Typography
						component="span"
						sx={{
							fontSize: "13px",
							fontWeight: 700,
							lineHeight: "13px",
							letterSpacing: "-0.65px",
							minWidth: "20px",
							textAlign: "center",
							transform: "translateY(-1px)",
						}}
					>
						{t("TeamTimeline.trial rank label", "{{rank}}位", {
							rank: selectedRank,
						})}
					</Typography>
					<Typography
						component="span"
						sx={{ fontSize: "inherit", lineHeight: "inherit" }}
					>
						{t("TeamTimeline.trial rank suffix", "の結果を表示中")}
					</Typography>
					{selectedSeed !== undefined && (
						<Box
							component="span"
							sx={{ display: "inline-flex", alignItems: "center", ml: "6px" }}
						>
							<Typography
								component="span"
								sx={{ fontSize: "inherit", lineHeight: "inherit" }}
							>
								{`(${trialSeedLabel}: ${selectedSeed}`}
							</Typography>
							<Tooltip
								title={t("TeamTimeline.copy trial seed", "シードをコピー")}
							>
								<IconButton
									size="small"
									aria-label={t(
										"TeamTimeline.copy trial seed",
										"シードをコピー",
									)}
									onClick={handleCopySeed}
									sx={{ p: 0, ml: "2px", transform: "translateY(-1px)" }}
								>
									<ContentCopyIcon
										sx={{ fontSize: `${COPY_SEED_ICON_SIZE_PX}px` }}
									/>
								</IconButton>
							</Tooltip>
							<Typography
								component="span"
								sx={{ fontSize: "inherit", lineHeight: "inherit" }}
							>
								)
							</Typography>
						</Box>
					)}
					<Link
						component="button"
						type="button"
						underline="always"
						onClick={handleToggleDistribution}
						sx={{
							ml: "6px",
							fontSize: "inherit",
							lineHeight: "inherit",
							verticalAlign: "baseline",
						}}
					>
						{showDistribution
							? t("TeamTimeline.hide distribution", "分布を閉じる")
							: t("TeamTimeline.show distribution", "分布を表示")}
					</Link>
				</Box>
				{showDistribution && (
					<Box
						data-testid="trial-distribution-chart"
						sx={{
							height: `${DISTRIBUTION_CHART_HEIGHT_PX}px`,
							display: "flex",
							alignItems: "flex-end",
							gap: 0,
							border: "1px solid #d0d0d0",
							borderRadius: "4px",
							px: "4px",
							py: "4px",
							mb: "6px",
							backgroundColor: "#f5f5f5",
						}}
					>
						{histogram.bins.map((count, index) => {
							const heightPercent =
								histogram.maxBinCount > 0
									? (count / histogram.maxBinCount) * 100
									: 0;
							const binStart =
								histogram.minEp +
								(histogram.range * index) / histogram.bins.length;
							const binEnd =
								index === histogram.bins.length - 1
									? histogram.minEp + histogram.range
									: histogram.minEp +
										(histogram.range * (index + 1)) / histogram.bins.length;
							return (
								<Box
									// Highlight the selected slider position's bin while keeping the whole distribution visible.
									key={`trial-distribution-${binStart}-${binEnd}`}
									data-testid={`trial-distribution-bar-${index}`}
									data-active={index === selectedBinIndex ? "true" : "false"}
									sx={{
										flex: 1,
										minWidth: 0,
										ml: index === 0 ? 0 : `-${HISTOGRAM_BAR_OVERLAP_PX}px`,
										height:
											count > 0
												? `${Math.max(heightPercent, MIN_HISTOGRAM_BAR_HEIGHT_PERCENT)}%`
												: "0%",
										backgroundColor:
											index === selectedBinIndex ? "#1976d2" : "#9e9e9e",
										borderRadius: 0,
										position: "relative",
										zIndex: index === selectedBinIndex ? 1 : 0,
										transition: "background-color 120ms linear",
									}}
								/>
							);
						})}
					</Box>
				)}
				<Box
					data-testid="trial-slider-controls"
					sx={{ display: "flex", alignItems: "center" }}
				>
					<IconButton
						size="small"
						aria-label="previous-trial"
						onClick={handlePrev}
						disabled={selectedIndex >= maxIndex}
						sx={{ p: 0, mx: "2px" }}
					>
						<NavigateBeforeIcon
							sx={{
								fontSize: "16px",
								transform: `translateY(${SLIDER_ARROW_ICON_VERTICAL_OFFSET_PX}px)`,
							}}
						/>
					</IconButton>
					<Box sx={{ px: "5px", flex: 1 }}>
						<Slider
							value={clampedSliderValue}
							min={0}
							max={maxIndex}
							step={1}
							onChange={handleSliderChange}
							onChangeCommitted={handleSliderCommitted}
							slots={{ valueLabel: EdgeAwareSliderValueLabel }}
							valueLabelDisplay="auto"
							valueLabelFormat={(value) => {
								const selectedTrialIndexFromSlider =
									resolveSelectedIndexFromSliderValue(value, maxIndex);
								const rankLabel = t(
									"TeamTimeline.trial rank label",
									"{{rank}}位",
									{
										rank: selectedTrialIndexFromSlider + 1,
									},
								);
								const ep = results[selectedTrialIndexFromSlider]?.grandTotalEP;
								if (ep === undefined) {
									return rankLabel;
								}
								return (
									<>
										{rankLabel}
										{": "}
										<EpValue value={Math.round(ep).toLocaleString()} />
									</>
								);
							}}
						/>
					</Box>
					<IconButton
						size="small"
						aria-label="next-trial"
						onClick={handleNext}
						disabled={selectedIndex <= 0}
						sx={{ p: 0, mx: "2px" }}
					>
						<NavigateNextIcon
							sx={{
								fontSize: "16px",
								transform: `translateY(${SLIDER_ARROW_ICON_VERTICAL_OFFSET_PX}px)`,
							}}
						/>
					</IconButton>
				</Box>
			</Box>
		);
	},
);

TrialResultSelector.displayName = "TrialResultSelector";

export default TrialResultSelector;
