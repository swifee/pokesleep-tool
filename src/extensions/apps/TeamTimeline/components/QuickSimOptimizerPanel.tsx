import { Box, Button, LinearProgress, Typography } from "@mui/material";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PokemonIcon from "../../../../ui/IvCalc/PokemonIcon";
import type PokemonBox from "../../../../util/PokemonBox";
import type { QuickSimEvaluatorContext } from "../simulation/QuickSimEvaluator";
import {
	createQuickSimOptimizerEvaluator,
	type QuickSimOptimizerEvaluatorHandle,
} from "../simulation/QuickSimOptimizerWorkerPool";
import type { CookingSimulationSettings } from "../types/CookingTypes";
import type { ProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import {
	isQuickSimOptimizerMemberCountSupported,
	QUICK_SIM_OPTIMIZER_FINAL_TRIALS,
	QUICK_SIM_OPTIMIZER_MAX_MEMBERS,
	QUICK_SIM_OPTIMIZER_MIN_MEMBERS,
	QUICK_SIM_OPTIMIZER_RESULT_COUNT,
	QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
	QUICK_SIM_OPTIMIZER_STEP_PERCENT,
	type QuickSimOptimizerMember,
	type QuickSimOptimizerOptions,
	type QuickSimOptimizerPhase,
	type QuickSimOptimizerProgress,
	type QuickSimOptimizerResult,
	type QuickSimOptimizerResultEntry,
} from "../types/QuickSimOptimizerTypes";
import {
	QUICK_SIM_MAX_USAGE_PERCENT,
	QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
	type QuickSimMember,
} from "../types/QuickSimTypes";
import type { TimelineBonusSettings } from "../types/TimelineBonusSettingsTypes";
import type { SimulationConfig, TimeSlot } from "../types/TimeSlotTypes";
import {
	isQuickSimOptimizerAbortError,
	runQuickSimOptimization,
} from "../utils/QuickSimOptimizerSearch";
import { buildSpecialPokemonExclusiveGroups } from "../utils/SpecialPokemonUtils";
import { buildStrengthParameterFromTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";

interface QuickSimOptimizerPanelProps {
	members: QuickSimMember[];
	box: PokemonBox;
	timeSlots: TimeSlot[];
	simulationConfig: SimulationConfig;
	bonusSettings: TimelineBonusSettings;
	cookingSettings: CookingSimulationSettings;
	provisionalSettings: ProvisionalSettings;
	seedMode: "random" | "fixed";
	/** 時間帯設定に就寝と起床があり、スケジュールを作れるか */
	hasSleepSlot: boolean;
	/** 結果の配分を適用する（ポケモンID → 起用率%） */
	onApply: (percentByPokemonId: ReadonlyMap<number, number>) => void;
}

const PANEL_SX = {
	border: "1px solid #e1e1e1",
	borderRadius: "8px",
	p: "10px 12px",
	mb: 2,
	backgroundColor: "#fff",
};
const NOTE_SX = {
	display: "block",
	color: "#666",
	fontSize: "11px",
	lineHeight: "15px",
};
const WARNING_SX = {
	display: "block",
	color: "#b26a00",
	fontSize: "11px",
	lineHeight: "15px",
	mt: "4px",
};
const ROW_BACKGROUND = "#fff";
/** 「現在」行だけ薄い背景にして候補の行と区別する */
const CURRENT_ROW_BACKGROUND = "#f5f5f5";
const TABLE_CELL_SX = {
	fontSize: "11px",
	lineHeight: "14px",
	padding: "3px 4px",
	textAlign: "center" as const,
	whiteSpace: "nowrap" as const,
	borderBottom: "1px solid #eee",
};
/** 先頭列（順位）は横スクロールしても見えるように固定する */
const STICKY_CELL_SX = {
	...TABLE_CELL_SX,
	position: "sticky" as const,
	left: 0,
	backgroundColor: ROW_BACKGROUND,
	zIndex: 1,
};
const HEADER_ICON_SIZE_PX = 22;
/** ポケモン列はアイコン幅に合わせて詰める（左右の余白は 2px ずつ） */
const USAGE_CELL_SX = {
	...TABLE_CELL_SX,
	padding: "3px 2px",
	width: `${HEADER_ICON_SIZE_PX}px`,
};
/** 起用率セルの背景に描く棒グラフの色 */
const USAGE_BAR_COLOR = "#d0e0ff";
const RANDOM_SEED_RANGE = 1_000_000;
/** 就寝中の入れ替えが必要な候補は深夜に操作できないので常に除外する */
const OPTIMIZER_OPTIONS: QuickSimOptimizerOptions = { excludeSleepSwaps: true };

const PHASE_LABELS: Readonly<
	Record<QuickSimOptimizerPhase, { key: string; defaultValue: string }>
> = {
	solo: {
		key: "TeamTimeline.quick optimizer phase solo",
		defaultValue: "単体評価",
	},
	screening: {
		key: "TeamTimeline.quick optimizer phase screening",
		defaultValue: "候補の絞り込み",
	},
	racing: {
		key: "TeamTimeline.quick optimizer phase racing",
		defaultValue: "候補の比較",
	},
	localSearch: {
		key: "TeamTimeline.quick optimizer phase local search",
		defaultValue: "近傍探索",
	},
	final: {
		key: "TeamTimeline.quick optimizer phase final",
		defaultValue: "最終確認",
	},
};

function resolveBaseSeed(
	seedMode: "random" | "fixed",
	configSeed: number,
): number {
	if (seedMode === "fixed") {
		return configSeed;
	}
	return Math.floor(Math.random() * RANDOM_SEED_RANGE);
}

/**
 * 結果が現在の設定に対応しているかを判定するための署名。
 * 起用率そのものは含めない（適用しても結果は古くならない）。
 */
function buildOptimizerSignature(input: {
	members: readonly QuickSimOptimizerMember[];
	timeSlots: readonly TimeSlot[];
	simulationConfig: SimulationConfig;
	bonusSettings: TimelineBonusSettings;
	cookingSettings: CookingSimulationSettings;
	provisionalSettings: ProvisionalSettings;
}): string {
	return JSON.stringify({
		members: input.members,
		timeSlots: input.timeSlots,
		simulationConfig: { ...input.simulationConfig, seed: 0 },
		bonusSettings: input.bonusSettings,
		cookingSettings: input.cookingSettings,
		provisionalSettings: input.provisionalSettings,
	});
}

function formatPercentDelta(meanEP: number, baseEP: number): string {
	if (baseEP <= 0) {
		return "-";
	}
	const delta = ((meanEP - baseEP) / baseEP) * 100;
	const rounded = Math.round(delta * 10) / 10;
	const sign = rounded > 0 ? "+" : "";
	return `${sign}${rounded.toFixed(1)}%`;
}

/**
 * 起用率セルの style。セルの高さを 100% とした縦棒グラフを背景に描く。
 */
function buildUsageCellStyle(percent: number): React.CSSProperties {
	if (percent <= 0) {
		return USAGE_CELL_SX;
	}
	const barPercent = Math.min(percent, QUICK_SIM_MAX_USAGE_PERCENT);
	return {
		...USAGE_CELL_SX,
		backgroundImage: `linear-gradient(to top, ${USAGE_BAR_COLOR} ${barPercent}%, transparent ${barPercent}%)`,
	};
}

/**
 * 簡易シミュの起用率を自動で最適化するパネル。
 * メンバーの起用方法は固定し、20% 刻み・合計 500% の配分から平均 EP が高い
 * 上位を探して表示する。就寝中の入れ替えが必要な候補は常に除外する。
 */
export default function QuickSimOptimizerPanel({
	members,
	box,
	timeSlots,
	simulationConfig,
	bonusSettings,
	cookingSettings,
	provisionalSettings,
	seedMode,
	hasSleepSlot,
	onApply,
}: QuickSimOptimizerPanelProps) {
	const { t } = useTranslation();
	const [running, setRunning] = useState(false);
	const [progress, setProgress] = useState<QuickSimOptimizerProgress | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{
		value: QuickSimOptimizerResult;
		signature: string;
	} | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const evaluatorHandleRef = useRef<QuickSimOptimizerEvaluatorHandle | null>(
		null,
	);

	const optimizerMembers = useMemo<QuickSimOptimizerMember[]>(() => {
		const seen = new Set<number>();
		return members.flatMap((member) => {
			if (seen.has(member.pokemonId) || !box.getById(member.pokemonId)) {
				return [];
			}
			seen.add(member.pokemonId);
			return [{ pokemonId: member.pokemonId, usageMode: member.usageMode }];
		});
	}, [members, box]);
	const memberCount = optimizerMembers.length;
	// とくべつなポケモン（伝説・幻）は同時に 1 体まで（ラティアス＋ラティオスは可）
	const exclusiveGroups = useMemo(
		() =>
			buildSpecialPokemonExclusiveGroups(
				optimizerMembers.map((member) => box.getById(member.pokemonId)),
			),
		[optimizerMembers, box],
	);
	const signature = useMemo(
		() =>
			buildOptimizerSignature({
				members: optimizerMembers,
				timeSlots,
				simulationConfig,
				bonusSettings,
				cookingSettings,
				provisionalSettings,
			}),
		[
			optimizerMembers,
			timeSlots,
			simulationConfig,
			bonusSettings,
			cookingSettings,
			provisionalSettings,
		],
	);

	const disabledReason = useMemo((): string | null => {
		if (!hasSleepSlot) {
			return t(
				"TeamTimeline.quick no sleep slot",
				"時間帯設定に「就寝」と「起床」を設定してください。",
			);
		}
		if (!isQuickSimOptimizerMemberCountSupported(memberCount)) {
			return t(
				"TeamTimeline.quick optimizer member count",
				"最適化はメンバーが{{min}}〜{{max}}匹のときに使えます。",
				{
					min: QUICK_SIM_OPTIMIZER_MIN_MEMBERS,
					max: QUICK_SIM_OPTIMIZER_MAX_MEMBERS,
				},
			);
		}
		return null;
	}, [hasSleepSlot, memberCount, t]);

	const stopRun = useCallback(() => {
		abortControllerRef.current?.abort();
		abortControllerRef.current = null;
		evaluatorHandleRef.current?.dispose();
		evaluatorHandleRef.current = null;
	}, []);

	useEffect(() => () => stopRun(), [stopRun]);

	const handleRun = useCallback(() => {
		if (running || disabledReason !== null) {
			return;
		}
		const runSignature = signature;
		const context: QuickSimEvaluatorContext = {
			box,
			members: optimizerMembers,
			timeSlots,
			simulationConfig,
			bonusSettings,
			cookingSettings,
			provisionalSettings,
			strengthParameter:
				buildStrengthParameterFromTimelineBonusSettings(bonusSettings),
		};
		const currentPercents = optimizerMembers.map(
			(member) =>
				members.find((candidate) => candidate.pokemonId === member.pokemonId)
					?.usagePercent ?? 0,
		);
		const abortController = new AbortController();
		abortControllerRef.current = abortController;
		setRunning(true);
		setError(null);
		setProgress({ phase: "solo", percent: 0, completed: 0, total: 0 });

		void (async () => {
			let handle: QuickSimOptimizerEvaluatorHandle | null = null;
			try {
				handle = await createQuickSimOptimizerEvaluator(context);
				if (abortController.signal.aborted) {
					handle.dispose();
					return;
				}
				evaluatorHandleRef.current = handle;
				const value = await runQuickSimOptimization({
					members: optimizerMembers,
					currentPercents,
					evaluator: handle.evaluator,
					options: OPTIMIZER_OPTIONS,
					exclusiveGroups,
					baseSeed: resolveBaseSeed(seedMode, simulationConfig.seed),
					signal: abortController.signal,
					onProgress: (next) => {
						if (!abortController.signal.aborted) {
							setProgress(next);
						}
					},
				});
				if (abortController.signal.aborted) {
					return;
				}
				setResult({ value, signature: runSignature });
			} catch (caught: unknown) {
				if (
					isQuickSimOptimizerAbortError(caught) ||
					abortController.signal.aborted
				) {
					return;
				}
				setError(String(caught));
			} finally {
				if (evaluatorHandleRef.current === handle) {
					evaluatorHandleRef.current = null;
				}
				handle?.dispose();
				if (abortControllerRef.current === abortController) {
					abortControllerRef.current = null;
				}
				setRunning(false);
				setProgress(null);
			}
		})();
	}, [
		running,
		disabledReason,
		signature,
		box,
		optimizerMembers,
		members,
		timeSlots,
		simulationConfig,
		bonusSettings,
		cookingSettings,
		provisionalSettings,
		exclusiveGroups,
		seedMode,
	]);

	const handleCancel = useCallback(() => {
		stopRun();
		setRunning(false);
		setProgress(null);
	}, [stopRun]);

	const handleApply = useCallback(
		(entry: QuickSimOptimizerResultEntry) => {
			if (result === null) {
				return;
			}
			const percentByPokemonId = new Map<number, number>();
			result.value.members.forEach((member, index) => {
				percentByPokemonId.set(member.pokemonId, entry.percents[index] ?? 0);
			});
			onApply(percentByPokemonId);
		},
		[result, onApply],
	);

	const isResultStale = result !== null && result.signature !== signature;
	const phaseLabel =
		progress !== null
			? t(
					PHASE_LABELS[progress.phase].key,
					PHASE_LABELS[progress.phase].defaultValue,
				)
			: "";

	const renderEntryRow = (
		entry: QuickSimOptimizerResultEntry,
		resultValue: QuickSimOptimizerResult,
		label: string,
		testId: string,
		isCurrent: boolean,
	) => {
		const unmetNames = entry.unmetPokemonIds.flatMap((pokemonId) => {
			const item = box.getById(pokemonId);
			return item ? [item.filledNickname(t)] : [];
		});
		const warnings: string[] = [];
		if (unmetNames.length > 0) {
			warnings.push(
				t(
					"TeamTimeline.quick unmet notice",
					"起用方法の指定により、次のメンバーは起用率を満たせません: {{names}}",
					{ names: unmetNames.join(", ") },
				),
			);
		}
		if (entry.usesSleepSwaps) {
			warnings.push(
				t(
					"TeamTimeline.quick sleep swap notice",
					"起用率を満たすため、就寝中の入れ替えを含みます。",
				),
			);
		}
		const baseEP = resultValue.current?.meanEP ?? 0;
		const rowBackground = isCurrent ? CURRENT_ROW_BACKGROUND : ROW_BACKGROUND;
		return (
			<tr
				key={testId}
				data-testid={testId}
				style={{ backgroundColor: rowBackground }}
			>
				<td
					style={{
						...STICKY_CELL_SX,
						fontWeight: 700,
						backgroundColor: rowBackground,
					}}
				>
					{label}
					{warnings.length > 0 && (
						<span
							role="img"
							title={warnings.join("\n")}
							aria-label={warnings.join(" ")}
							data-testid={`${testId}-warning`}
							style={{ color: "#b26a00", marginLeft: "2px" }}
						>
							!
						</span>
					)}
				</td>
				{resultValue.members.map((member, index) => {
					const percent = entry.percents[index] ?? 0;
					return (
						<td
							key={member.pokemonId}
							style={buildUsageCellStyle(percent)}
							data-testid={`${testId}-percent-${member.pokemonId}`}
						>
							{percent > 0 ? percent : "-"}
						</td>
					);
				})}
				<td
					style={{ ...TABLE_CELL_SX, textAlign: "right" }}
					data-testid={`${testId}-ep`}
				>
					{Math.round(entry.meanEP).toLocaleString()}
				</td>
				<td
					style={{ ...TABLE_CELL_SX, textAlign: "right" }}
					data-testid={`${testId}-delta`}
				>
					{isCurrent ? "-" : formatPercentDelta(entry.meanEP, baseEP)}
				</td>
				<td style={TABLE_CELL_SX} data-testid={`${testId}-swaps`}>
					{entry.swapsPerDay.toLocaleString()}
				</td>
				<td style={TABLE_CELL_SX}>
					{!isCurrent && (
						<Button
							size="small"
							variant="text"
							onClick={() => handleApply(entry)}
							data-testid={`${testId}-apply`}
							sx={{ minWidth: 0, p: "0 6px", fontSize: "11px" }}
						>
							{t("TeamTimeline.quick optimizer apply", "適用")}
						</Button>
					)}
				</td>
			</tr>
		);
	};

	return (
		<Box sx={PANEL_SX} data-testid="quick-sim-optimizer">
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					flexWrap: "wrap",
					gap: 1,
					mb: "4px",
				}}
			>
				<Typography variant="subtitle2" sx={{ mr: "auto" }}>
					{t("TeamTimeline.quick optimizer title", "起用率の最適化")}
				</Typography>
				{running ? (
					<Button
						variant="outlined"
						size="small"
						color="inherit"
						onClick={handleCancel}
						data-testid="quick-sim-optimizer-cancel"
					>
						{t("TeamTimeline.quick optimizer cancel", "中止")}
					</Button>
				) : (
					<Button
						variant="outlined"
						size="small"
						onClick={handleRun}
						disabled={disabledReason !== null}
						data-testid="quick-sim-optimizer-run"
					>
						{t("TeamTimeline.quick optimizer run", "最適化を実行")}
					</Button>
				)}
			</Box>
			<Typography
				variant="caption"
				sx={NOTE_SX}
				data-testid="quick-sim-optimizer-note"
			>
				{t(
					"TeamTimeline.quick optimizer note",
					"起用方法はそのままに、{{step}}%刻みで合計{{limit}}%になる起用率の組み合わせから平均EPが高い上位{{count}}件を探します。探索は{{searchTrials}}試行、結果は{{finalTrials}}試行の平均です。",
					{
						step: QUICK_SIM_OPTIMIZER_STEP_PERCENT,
						limit: QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
						count: QUICK_SIM_OPTIMIZER_RESULT_COUNT,
						searchTrials: QUICK_SIM_OPTIMIZER_SEARCH_TRIALS,
						finalTrials: QUICK_SIM_OPTIMIZER_FINAL_TRIALS.toLocaleString(),
					},
				)}
			</Typography>
			{disabledReason !== null && (
				<Typography
					variant="caption"
					sx={WARNING_SX}
					data-testid="quick-sim-optimizer-disabled-reason"
				>
					{disabledReason}
				</Typography>
			)}
			{running && progress !== null && (
				<Box sx={{ mt: 1 }} data-testid="quick-sim-optimizer-progress">
					<LinearProgress
						variant="determinate"
						value={progress.percent}
						sx={{ height: "6px", borderRadius: "3px" }}
					/>
					<Typography
						variant="caption"
						sx={NOTE_SX}
						data-testid="quick-sim-optimizer-progress-label"
					>
						{progress.total > 0
							? `${phaseLabel} ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()} (${progress.percent}%)`
							: `${phaseLabel} (${progress.percent}%)`}
					</Typography>
				</Box>
			)}
			{error !== null && (
				<Typography
					variant="body2"
					sx={{ color: "error.main", mt: 1 }}
					data-testid="quick-sim-optimizer-error"
				>
					{error}
				</Typography>
			)}
			{isResultStale && (
				<Typography
					variant="caption"
					sx={WARNING_SX}
					data-testid="quick-sim-optimizer-stale-notice"
				>
					{t(
						"TeamTimeline.quick optimizer stale notice",
						"設定が変更されました。再度最適化を実行してください。",
					)}
				</Typography>
			)}
			{result !== null && (
				<Box
					sx={{ mt: 1, overflowX: "auto", WebkitOverflowScrolling: "touch" }}
					data-testid="quick-sim-optimizer-result"
				>
					{result.value.entries.length === 0 ? (
						<Typography variant="caption" sx={WARNING_SX}>
							{t(
								"TeamTimeline.quick optimizer no candidates",
								"条件を満たす組み合わせが見つかりませんでした。",
							)}
						</Typography>
					) : (
						<table
							style={{ borderCollapse: "collapse", minWidth: "100%" }}
							data-testid="quick-sim-optimizer-table"
						>
							<thead>
								<tr>
									<th style={STICKY_CELL_SX}>#</th>
									{result.value.members.map((member) => {
										const item = box.getById(member.pokemonId);
										return (
											<th
												key={member.pokemonId}
												style={USAGE_CELL_SX}
												title={item?.filledNickname(t)}
												data-testid={`quick-sim-optimizer-header-${member.pokemonId}`}
											>
												{item ? (
													<PokemonIcon
														idForm={item.iv.idForm}
														shiny={item.iv.shiny}
														size={HEADER_ICON_SIZE_PX}
													/>
												) : (
													member.pokemonId
												)}
											</th>
										);
									})}
									<th style={TABLE_CELL_SX}>
										{t("TeamTimeline.quick optimizer mean ep", "平均EP")}
									</th>
									<th style={TABLE_CELL_SX}>
										{t("TeamTimeline.quick optimizer delta", "現在比")}
									</th>
									<th style={TABLE_CELL_SX}>
										{t("TeamTimeline.quick optimizer swaps per day", "入替/日")}
									</th>
									<th style={TABLE_CELL_SX} />
								</tr>
							</thead>
							<tbody>
								{result.value.current !== null &&
									renderEntryRow(
										result.value.current,
										result.value,
										t("TeamTimeline.quick optimizer current", "現在"),
										"quick-sim-optimizer-row-current",
										true,
									)}
								{result.value.entries.map((entry, index) =>
									renderEntryRow(
										entry,
										result.value,
										String(index + 1),
										`quick-sim-optimizer-row-${index + 1}`,
										false,
									),
								)}
							</tbody>
						</table>
					)}
				</Box>
			)}
		</Box>
	);
}
