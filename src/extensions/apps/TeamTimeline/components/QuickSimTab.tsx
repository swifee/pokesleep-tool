import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsIcon from "@mui/icons-material/Settings";
import {
	Box,
	ButtonBase,
	Collapse,
	FormControlLabel,
	IconButton,
	Switch,
	Typography,
} from "@mui/material";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import { runMultiTrialSimulationWithProgress } from "../simulation/MultiTrialSimulator";
import { runSimulation } from "../simulation/TimelineSimulator";
import type {
	AverageCookingSummary,
	CookingSimulationSettings,
} from "../types/CookingTypes";
import type { TrialSummary } from "../types/MultiTrialTypes";
import type { ProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import {
	DEFAULT_QUICK_SIM_USAGE_MODE,
	QUICK_SIM_MAX_USAGE_PERCENT,
	QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
	type QuickSimMember,
	type QuickSimSchedule,
	type QuickSimScheduleErrorType,
} from "../types/QuickSimTypes";
import type { TimelineBonusSettings } from "../types/TimelineBonusSettingsTypes";
import type {
	DailySummary,
	PokemonSwap,
	SimulationConfig,
	SimulationResult,
	TeamSummary,
	TimeSlot,
} from "../types/TimeSlotTypes";
import { collectTimelineDurationSummaryByPokemon } from "../utils/AdditionalAnalysisUtils";
import { getInitialIngredientTotal } from "../utils/InitialIngredientsUtils";
import {
	buildQuickSimSchedule,
	getQuickSimTotalUsagePercent,
} from "../utils/QuickSimScheduler";
import {
	deriveQuickSimMembersFromTimeline,
	loadQuickSimSettingsFromStorage,
	saveQuickSimSettingsToStorage,
} from "../utils/QuickSimStorage";
import {
	buildQuickSimTimeline,
	type QuickSimTimeline,
} from "../utils/QuickSimTimelineBuilder";
import type { SummaryValueMode } from "../utils/SummaryValueModeUtils";
import BoxSelectDialog from "./BoxSelectDialog";
import DailySummaryRow from "./DailySummaryRow";
import InitialIngredientsEditor from "./InitialIngredientsEditor";
import QuickSimImportConfirmDialog from "./QuickSimImportConfirmDialog";
import QuickSimMemberList from "./QuickSimMemberList";
import QuickSimOptimizerPanel from "./QuickSimOptimizerPanel";
import SummaryValueModeToggle from "./SummaryValueModeToggle";
import TeamSummaryRow from "./TeamSummaryRow";
import type { TimelineDisplayMode } from "./TimelineCell";
import TimelineTable from "./TimelineTable";
import TrialResultSelector from "./TrialResultSelector";

/** 簡易シミュ側から実行ボタン周りの状態を受け取って共通コントロールを描画する */
export interface QuickSimControlsRenderProps {
	simulationLoading: boolean;
	simulationProgress: number;
	isTeamEmpty: boolean;
	onRunSimulation: () => void;
}

interface QuickSimTabProps {
	/** ポケモン追加ダイアログに表示するユーザーのボックス */
	userBox: PokemonBox;
	/** シミュレーションと表示に使うボックス（ユーザーのボックス + プリセット） */
	runtimeBox: PokemonBox;
	/** 詳細シミュのチーム（取り込み用） */
	team: (PokemonBoxItem | null)[];
	/** 詳細シミュの入れ替え設定（取り込み用） */
	swaps: PokemonSwap[];
	timeSlots: TimeSlot[];
	simulationConfig: SimulationConfig;
	bonusSettings: TimelineBonusSettings;
	cookingSettings: CookingSimulationSettings;
	provisionalSettings: ProvisionalSettings;
	seedMode: "random" | "fixed";
	multiTrialCount: number;
	onCookingSettingsChange: (settings: CookingSimulationSettings) => void;
	/** 料理設定タブへ移動する */
	onOpenCookingSettings: () => void;
	/** 実行に使ったシード値を通知する（詳細シミュと同じくシード固定の再現に使う） */
	onSeedChange: (seed: number) => void;
	renderSimulationControls: (
		props: QuickSimControlsRenderProps,
	) => React.ReactNode;
}

interface QuickSimRunResult {
	timeline: QuickSimTimeline;
	schedule: QuickSimSchedule;
	simulationDays: number;
	simulationResult: SimulationResult;
	trials: TrialSummary[] | null;
	selectedTrialIndex: number | null;
	averageDailySummaries: DailySummary[] | null;
	averageTeamSummary: TeamSummary | null;
	averageCookingSummary: AverageCookingSummary | null;
	inputSignature: string;
}

const ABORT_ERROR_NAME = "AbortError";
const SINGLE_RUN_PROGRESS_START = 30;
const PROGRESS_COMPLETE = 100;
const SECTION_TITLE_SX = {
	fontSize: "14px",
	fontWeight: 700,
	lineHeight: "18px",
	letterSpacing: "0.4px",
};
const PANEL_SX = {
	border: "1px solid #e1e1e1",
	borderRadius: "8px",
	p: "10px 12px",
	mb: 2,
	backgroundColor: "#fff",
};
const EXPAND_ICON_TRANSITION_MS = 200;
const EMPTY_SIMULATION_RESULT: SimulationResult = {
	slotResults: new Map(),
	dailySummaries: [],
	teamSummary: {
		totalIngredients: [],
		totalBerryEP: 0,
		totalIngredientEP: 0,
		totalSkillEP: 0,
		grandTotalEP: 0,
		totalPresentCandyCount: 0,
		totalCookingPotCapacityIncrease: 0,
		totalTastyChanceIncreasePercent: 0,
		totalDreamShardCount: 0,
	},
};

function createAbortError(): Error {
	const error = new Error("Aborted");
	error.name = ABORT_ERROR_NAME;
	return error;
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === ABORT_ERROR_NAME;
}

/**
 * 結果が現在の設定に対応しているかを判定するための署名。
 * シード値は試行ごとに変わるため含めない。
 */
function buildQuickSimInputSignature(input: {
	members: readonly QuickSimMember[];
	timeSlots: readonly TimeSlot[];
	simulationConfig: SimulationConfig;
	bonusSettings: TimelineBonusSettings;
	cookingSettings: CookingSimulationSettings;
	provisionalSettings: ProvisionalSettings;
	seedMode: "random" | "fixed";
	multiTrialCount: number;
}): string {
	return JSON.stringify({
		members: input.members,
		timeSlots: input.timeSlots,
		simulationConfig: { ...input.simulationConfig, seed: 0 },
		bonusSettings: input.bonusSettings,
		cookingSettings: input.cookingSettings,
		provisionalSettings: input.provisionalSettings,
		seedMode: input.seedMode,
		multiTrialCount: input.multiTrialCount,
	});
}

/**
 * 追加するメンバーの起用率の既定値: 合計が上限に収まる範囲で最大にする
 */
function resolveDefaultUsagePercent(
	members: readonly QuickSimMember[],
): number {
	const remaining =
		QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT - getQuickSimTotalUsagePercent(members);
	return Math.max(0, Math.min(QUICK_SIM_MAX_USAGE_PERCENT, remaining));
}

/**
 * 簡易シミュタブ。
 * メンバーと起用率から入れ替えを自動生成し、詳細シミュと同じエンジンで計算する。
 */
export default function QuickSimTab({
	userBox,
	runtimeBox,
	team,
	swaps,
	timeSlots,
	simulationConfig,
	bonusSettings,
	cookingSettings,
	provisionalSettings,
	seedMode,
	multiTrialCount,
	onCookingSettingsChange,
	onOpenCookingSettings,
	onSeedChange,
	renderSimulationControls,
}: QuickSimTabProps) {
	const { t } = useTranslation();
	const [members, setMembers] = useState<QuickSimMember[]>(() => {
		const stored = loadQuickSimSettingsFromStorage(runtimeBox);
		if (stored) {
			return stored.members;
		}
		return deriveQuickSimMembersFromTimeline({
			team,
			swaps,
			timeSlots,
			simulationDays: simulationConfig.simulationDays,
			box: runtimeBox,
		});
	});
	const [boxDialogOpen, setBoxDialogOpen] = useState(false);
	/** 入れ替え対象のメンバー（null なら追加） */
	const [swapTargetId, setSwapTargetId] = useState<number | null>(null);
	const [ingredientsExpanded, setIngredientsExpanded] = useState(false);
	const [importConfirmOpen, setImportConfirmOpen] = useState(false);
	const [simulationLoading, setSimulationLoading] = useState(false);
	const [simulationProgress, setSimulationProgress] = useState(0);
	const [simulationError, setSimulationError] = useState<string | null>(null);
	const [runResult, setRunResult] = useState<QuickSimRunResult | null>(null);
	const [summaryValueMode, setSummaryValueMode] =
		useState<SummaryValueMode>("periodTotal");
	const [leftoverIncludeExtraUsage, setLeftoverIncludeExtraUsage] =
		useState(false);
	const [timelineDisplayMode, setTimelineDisplayMode] =
		useState<TimelineDisplayMode>("simple");
	const abortControllerRef = useRef<AbortController | null>(null);

	useEffect(() => {
		saveQuickSimSettingsToStorage({ members }, runtimeBox);
	}, [members, runtimeBox]);

	useEffect(
		() => () => {
			abortControllerRef.current?.abort();
		},
		[],
	);

	useEffect(() => {
		if (simulationConfig.simulationDays < 2) {
			setSummaryValueMode("periodTotal");
		}
	}, [simulationConfig.simulationDays]);

	const scheduleResult = useMemo(
		() =>
			buildQuickSimSchedule(
				members,
				timeSlots,
				simulationConfig.simulationDays,
			),
		[members, timeSlots, simulationConfig.simulationDays],
	);
	const previewTimeline = useMemo(
		() =>
			scheduleResult.ok
				? buildQuickSimTimeline(
						scheduleResult.schedule,
						timeSlots,
						simulationConfig.simulationDays,
						runtimeBox,
					)
				: null,
		[scheduleResult, timeSlots, simulationConfig.simulationDays, runtimeBox],
	);
	const inputSignature = useMemo(
		() =>
			buildQuickSimInputSignature({
				members,
				timeSlots,
				simulationConfig,
				bonusSettings,
				cookingSettings,
				provisionalSettings,
				seedMode,
				multiTrialCount,
			}),
		[
			members,
			timeSlots,
			simulationConfig,
			bonusSettings,
			cookingSettings,
			provisionalSettings,
			seedMode,
			multiTrialCount,
		],
	);
	const isResultStale =
		runResult !== null && runResult.inputSignature !== inputSignature;

	const handleAddClick = useCallback(() => {
		setSwapTargetId(null);
		setBoxDialogOpen(true);
	}, []);

	const handleSwapClick = useCallback((pokemonId: number) => {
		setSwapTargetId(pokemonId);
		setBoxDialogOpen(true);
	}, []);

	const handleBoxDialogClose = useCallback(() => {
		setBoxDialogOpen(false);
		setSwapTargetId(null);
	}, []);

	const handleMemberSelect = useCallback(
		(item: PokemonBoxItem) => {
			setMembers((previous) => {
				if (previous.some((member) => member.pokemonId === item.id)) {
					return previous;
				}
				if (swapTargetId !== null) {
					// 起用率と起用方法はそのままに、ポケモンだけ入れ替える
					return previous.map((member) =>
						member.pokemonId === swapTargetId
							? { ...member, pokemonId: item.id }
							: member,
					);
				}
				return [
					...previous,
					{
						pokemonId: item.id,
						usagePercent: resolveDefaultUsagePercent(previous),
						usageMode: DEFAULT_QUICK_SIM_USAGE_MODE,
					},
				];
			});
			setBoxDialogOpen(false);
			setSwapTargetId(null);
		},
		[swapTargetId],
	);

	const handleIngredientsToggle = useCallback(() => {
		setIngredientsExpanded((previous) => !previous);
	}, []);

	const handleOptimizerApply = useCallback(
		(percentByPokemonId: ReadonlyMap<number, number>) => {
			setMembers((previous) =>
				previous.map((member) => {
					const usagePercent = percentByPokemonId.get(member.pokemonId);
					return usagePercent === undefined
						? member
						: { ...member, usagePercent };
				}),
			);
		},
		[],
	);

	const handleImportClick = useCallback(() => {
		setImportConfirmOpen(true);
	}, []);

	const handleImportCancel = useCallback(() => {
		setImportConfirmOpen(false);
	}, []);

	const handleImportConfirm = useCallback(() => {
		setMembers(
			deriveQuickSimMembersFromTimeline({
				team,
				swaps,
				timeSlots,
				simulationDays: simulationConfig.simulationDays,
				box: runtimeBox,
			}),
		);
		setImportConfirmOpen(false);
	}, [team, swaps, timeSlots, simulationConfig.simulationDays, runtimeBox]);

	const runSelectedTrial = useCallback(
		(timeline: QuickSimTimeline, seed: number): SimulationResult =>
			runSimulation({
				team: timeline.team,
				timeSlots: timeline.timeSlots,
				config: { ...simulationConfig, seed },
				bonusSettings,
				swaps: timeline.swaps,
				noCollectCells: timeline.noCollectCells,
				box: runtimeBox,
				cookingSettings,
				provisionalSettings,
			}),
		[
			simulationConfig,
			bonusSettings,
			runtimeBox,
			cookingSettings,
			provisionalSettings,
		],
	);

	const executeSimulation = useCallback(
		async (
			schedule: QuickSimSchedule,
			timeline: QuickSimTimeline,
			abortSignal: AbortSignal,
		): Promise<QuickSimRunResult> => {
			const signature = inputSignature;
			const simulationDays = simulationConfig.simulationDays;
			const throwIfAborted = (): void => {
				if (abortSignal.aborted) {
					throw createAbortError();
				}
			};

			if (seedMode === "fixed" && multiTrialCount === 1) {
				setSimulationProgress(SINGLE_RUN_PROGRESS_START);
				const simulationResult = runSelectedTrial(
					timeline,
					simulationConfig.seed,
				);
				throwIfAborted();
				setSimulationProgress(PROGRESS_COMPLETE);
				return {
					timeline,
					schedule,
					simulationDays,
					simulationResult,
					trials: null,
					selectedTrialIndex: null,
					averageDailySummaries: null,
					averageTeamSummary: null,
					averageCookingSummary: null,
					inputSignature: signature,
				};
			}

			// 最初の試行のシードが基準シード。結果は EP 順に並び替えられるため別に控える。
			let baseSeed: number | null = null;
			const multiResult = await runMultiTrialSimulationWithProgress({
				team: timeline.team,
				timeSlots: timeline.timeSlots,
				config: simulationConfig,
				bonusSettings,
				cookingSettings,
				provisionalSettings,
				swaps: timeline.swaps,
				noCollectCells: timeline.noCollectCells,
				box: runtimeBox,
				trialCount: multiTrialCount,
				initialSeed: seedMode === "fixed" ? simulationConfig.seed : undefined,
				onProgress: (progress) => {
					setSimulationProgress(progress);
				},
				onTrialComplete: ({ index, seed }) => {
					if (index === 0) {
						baseSeed = seed;
					}
				},
				shouldAbort: () => abortSignal.aborted,
			});
			throwIfAborted();
			if (multiResult.trials.length === 0) {
				throw new Error(
					t("TeamTimeline.quick no result", "シミュレーション結果がありません"),
				);
			}
			const selectedTrialIndex = multiResult.medianIndex;
			const selectedSeed = multiResult.trials[selectedTrialIndex].seed;
			const simulationResult = runSelectedTrial(timeline, selectedSeed);
			if (baseSeed !== null) {
				onSeedChange(baseSeed);
			}
			setSimulationProgress(PROGRESS_COMPLETE);
			return {
				timeline,
				schedule,
				simulationDays,
				simulationResult,
				trials: [...multiResult.trials],
				selectedTrialIndex,
				averageDailySummaries: multiResult.averageDailySummaries,
				averageTeamSummary: multiResult.averageTeamSummary,
				averageCookingSummary: multiResult.averageCookingSummary,
				inputSignature: signature,
			};
		},
		[
			inputSignature,
			simulationConfig,
			seedMode,
			multiTrialCount,
			runSelectedTrial,
			bonusSettings,
			cookingSettings,
			provisionalSettings,
			runtimeBox,
			onSeedChange,
			t,
		],
	);

	const handleRunSimulation = useCallback(() => {
		if (simulationLoading) {
			abortControllerRef.current?.abort();
			return;
		}
		if (!scheduleResult.ok) {
			return;
		}
		const schedule = scheduleResult.schedule;
		const timeline = buildQuickSimTimeline(
			schedule,
			timeSlots,
			simulationConfig.simulationDays,
			runtimeBox,
		);
		const abortController = new AbortController();
		abortControllerRef.current = abortController;
		setSimulationError(null);
		setSimulationProgress(0);
		setSimulationLoading(true);

		// 重い計算の前に一度描画させ、実行中の表示を出す
		window.setTimeout(() => {
			void executeSimulation(schedule, timeline, abortController.signal)
				.then((result) => {
					if (abortController.signal.aborted) {
						return;
					}
					setRunResult(result);
				})
				.catch((error: unknown) => {
					if (isAbortError(error) || abortController.signal.aborted) {
						return;
					}
					setSimulationError(String(error));
					setSimulationProgress(0);
				})
				.finally(() => {
					if (abortControllerRef.current === abortController) {
						abortControllerRef.current = null;
					}
					setSimulationLoading(false);
				});
		}, 0);
	}, [
		simulationLoading,
		scheduleResult,
		timeSlots,
		simulationConfig.simulationDays,
		runtimeBox,
		executeSimulation,
	]);

	const handleTrialSelect = useCallback(
		(index: number) => {
			if (
				runResult === null ||
				runResult.trials === null ||
				index < 0 ||
				index >= runResult.trials.length
			) {
				return;
			}
			const trial = runResult.trials[index];
			try {
				const simulationResult = runSelectedTrial(
					runResult.timeline,
					trial.seed,
				);
				setRunResult({
					...runResult,
					simulationResult,
					selectedTrialIndex: index,
				});
			} catch (error) {
				setSimulationError(String(error));
			}
		},
		[runResult, runSelectedTrial],
	);

	const handleTimelineDisplayModeChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setTimelineDisplayMode(event.target.checked ? "simple" : "detailed");
		},
		[],
	);

	const scheduleErrorMessage = useMemo((): string | null => {
		if (scheduleResult.ok) {
			return null;
		}
		const messages: Record<QuickSimScheduleErrorType, string> = {
			noSleepSlot: t(
				"TeamTimeline.quick no sleep slot",
				"時間帯設定に「就寝」と「起床」を設定してください。",
			),
			noMembers: t(
				"TeamTimeline.quick no members",
				"起用率が0%より大きいメンバーを追加してください。",
			),
			usageExceeded: t(
				"TeamTimeline.quick usage exceeded",
				"合計が{{limit}}%を超えています。",
				{ limit: QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT },
			),
		};
		return messages[scheduleResult.error];
	}, [scheduleResult, t]);

	const unmetMemberNames = useMemo((): string[] => {
		if (!scheduleResult.ok) {
			return [];
		}
		return scheduleResult.schedule.unmetPokemonIds.flatMap((pokemonId) => {
			const item = runtimeBox.getById(pokemonId);
			return item ? [item.filledNickname(t)] : [];
		});
	}, [scheduleResult, runtimeBox, t]);
	const initialIngredientTotal = getInitialIngredientTotal(cookingSettings);

	const resultTimeline = runResult?.timeline ?? null;
	const resultDurationSummary = useMemo(() => {
		if (runResult === null) {
			return null;
		}
		return collectTimelineDurationSummaryByPokemon(
			runResult.timeline.team,
			runResult.timeline.timeSlots,
			runResult.simulationDays,
			runResult.timeline.swaps,
			runtimeBox,
		);
	}, [runResult, runtimeBox]);
	const showAverageSection =
		runResult !== null &&
		runResult.trials !== null &&
		runResult.trials.length > 1 &&
		runResult.averageDailySummaries !== null &&
		runResult.averageTeamSummary !== null;
	const showSummaryValueToggle = simulationConfig.simulationDays >= 2;

	return (
		<Box data-testid="quick-sim-tab">
			<Typography
				variant="body2"
				sx={{ color: "#666", mb: 1, fontSize: "12px", lineHeight: "16px" }}
				data-testid="quick-sim-description"
			>
				{t(
					"TeamTimeline.quick description",
					"チームに入れたいポケモンと起用率を選ぶだけで、入れ替えを自動設定してシミュレーションします。",
				)}
			</Typography>

			<QuickSimMemberList
				members={members}
				box={runtimeBox}
				onChange={setMembers}
				onAddClick={handleAddClick}
				onImportClick={handleImportClick}
				onSwapClick={handleSwapClick}
			/>

			<QuickSimOptimizerPanel
				members={members}
				box={runtimeBox}
				timeSlots={timeSlots}
				simulationConfig={simulationConfig}
				bonusSettings={bonusSettings}
				cookingSettings={cookingSettings}
				provisionalSettings={provisionalSettings}
				seedMode={seedMode}
				hasSleepSlot={
					scheduleResult.ok || scheduleResult.error !== "noSleepSlot"
				}
				onApply={handleOptimizerApply}
			/>

			<Box sx={PANEL_SX} data-testid="quick-sim-initial-ingredients">
				<Box sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
					<ButtonBase
						onClick={handleIngredientsToggle}
						aria-expanded={ingredientsExpanded}
						data-testid="quick-sim-initial-ingredients-toggle"
						sx={{
							display: "flex",
							alignItems: "center",
							gap: "2px",
							mr: "auto",
							borderRadius: "4px",
							px: "2px",
						}}
					>
						<Typography variant="subtitle2" component="span">
							{t("TeamTimeline.cooking initial ingredients", "初期食材")}
						</Typography>
						<Typography
							variant="caption"
							component="span"
							sx={{ color: "#666" }}
							data-testid="quick-sim-initial-ingredients-summary"
						>
							{t("TeamTimeline.quick ingredients total", "（合計 {{total}}）", {
								total: initialIngredientTotal.toLocaleString(),
							})}
						</Typography>
						<ExpandMoreIcon
							sx={{
								fontSize: "18px",
								color: "#666",
								transform: ingredientsExpanded ? "rotate(180deg)" : "none",
								transition: `transform ${EXPAND_ICON_TRANSITION_MS}ms`,
							}}
						/>
					</ButtonBase>
					<IconButton
						size="small"
						onClick={onOpenCookingSettings}
						title={t(
							"TeamTimeline.quick open cooking settings",
							"料理設定を開く",
						)}
						aria-label={t(
							"TeamTimeline.quick open cooking settings",
							"料理設定を開く",
						)}
						data-testid="quick-sim-open-cooking-settings"
						sx={{ p: "2px" }}
					>
						<SettingsIcon sx={{ fontSize: "16px" }} />
					</IconButton>
				</Box>
				<Collapse in={ingredientsExpanded} unmountOnExit>
					<Box sx={{ mt: 1 }}>
						<InitialIngredientsEditor
							settings={cookingSettings}
							onChange={onCookingSettingsChange}
							showTitle={false}
						/>
					</Box>
				</Collapse>
			</Box>

			{renderSimulationControls({
				simulationLoading,
				simulationProgress,
				isTeamEmpty: !scheduleResult.ok,
				onRunSimulation: handleRunSimulation,
			})}

			{scheduleErrorMessage !== null && (
				<Typography
					variant="body2"
					sx={{ color: "error.main", mt: 1, mb: 1 }}
					data-testid="quick-sim-schedule-error"
				>
					{scheduleErrorMessage}
				</Typography>
			)}
			{simulationError !== null && (
				<Box
					sx={{ color: "error.main", mt: 1, mb: 1 }}
					data-testid="quick-sim-simulation-error"
				>
					{simulationError}
				</Box>
			)}
			{isResultStale && (
				<Typography
					variant="body2"
					sx={{ color: "#b26a00", mt: 1, mb: 1 }}
					data-testid="quick-sim-stale-notice"
				>
					{t(
						"TeamTimeline.quick stale notice",
						"設定が変更されました。再度シミュレーションを実行してください。",
					)}
				</Typography>
			)}

			{showAverageSection &&
				runResult !== null &&
				runResult.averageDailySummaries !== null &&
				runResult.averageTeamSummary !== null &&
				resultDurationSummary !== null && (
					<Box sx={{ mt: "18px" }} data-testid="quick-sim-average-section">
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								justifyContent: "flex-start",
								gap: "8px",
								flexWrap: "wrap",
								mb: "5px",
							}}
						>
							<Typography sx={SECTION_TITLE_SX}>
								{t(
									"TeamTimeline.simulation average",
									"シミュレーション結果(平均)",
								)}
							</Typography>
							{showSummaryValueToggle && (
								<SummaryValueModeToggle
									value={summaryValueMode}
									onChange={setSummaryValueMode}
									simulationDays={runResult.simulationDays}
									orientation="horizontal"
								/>
							)}
						</Box>
						<TeamSummaryRow
							teamSummary={runResult.averageTeamSummary}
							layoutMode="average"
							simulationDays={runResult.simulationDays}
							valueMode={summaryValueMode}
							averageCookingSummary={runResult.averageCookingSummary}
							showLeftoverIncludeExtraUsageToggle
							leftoverIncludeExtraUsage={leftoverIncludeExtraUsage}
							onLeftoverIncludeExtraUsageChange={setLeftoverIncludeExtraUsage}
						/>
						<DailySummaryRow
							dailySummaries={runResult.averageDailySummaries}
							box={runtimeBox}
							layoutMode="average"
							simulationDays={runResult.simulationDays}
							valueMode={summaryValueMode}
							showTimelineDurationShare={runResult.timeline.swaps.length > 0}
							timelineDurationByPokemonId={
								resultDurationSummary.activeMinutesByPokemonId
							}
							totalTimelineDurationMinutes={
								resultDurationSummary.totalTimelineMinutes
							}
						/>
					</Box>
				)}

			<Box sx={{ mt: "18px" }} data-testid="quick-sim-schedule-section">
				<Typography sx={{ ...SECTION_TITLE_SX, mb: "5px" }}>
					{runResult !== null
						? t("TeamTimeline.simulation details", "シミュレーション詳細")
						: t(
								"TeamTimeline.quick schedule title",
								"自動入れ替えスケジュール",
							)}
				</Typography>
				<Typography
					variant="caption"
					sx={{ display: "block", color: "#666", mb: "6px" }}
					data-testid="quick-sim-schedule-note"
				>
					{t(
						"TeamTimeline.quick schedule note",
						"起用率に合わせて入れ替えを自動設定します。就寝中は入れ替えず、設定を満たせないときだけ就寝中にも入れ替えます。時間帯設定にない時刻で入れ替えるときは、その時刻に時間帯を追加し、入れ替え元のポケモンだけを回収（清算）します。",
					)}
				</Typography>
				{scheduleResult.ok && scheduleResult.schedule.usesSleepSwaps && (
					<Typography
						variant="caption"
						sx={{ display: "block", color: "#b26a00", mb: "6px" }}
						data-testid="quick-sim-sleep-swap-notice"
					>
						{t(
							"TeamTimeline.quick sleep swap notice",
							"起用率を満たすため、就寝中の入れ替えを含みます。",
						)}
					</Typography>
				)}
				{unmetMemberNames.length > 0 && (
					<Typography
						variant="caption"
						sx={{ display: "block", color: "#b26a00", mb: "6px" }}
						data-testid="quick-sim-unmet-notice"
					>
						{t(
							"TeamTimeline.quick unmet notice",
							"起用方法の指定により、次のメンバーは起用率を満たせません: {{names}}",
							{ names: unmetMemberNames.join(", ") },
						)}
					</Typography>
				)}
				{runResult !== null &&
					runResult.trials !== null &&
					runResult.selectedTrialIndex !== null && (
						<TrialResultSelector
							results={runResult.trials}
							selectedIndex={runResult.selectedTrialIndex}
							onSelect={handleTrialSelect}
						/>
					)}
				{runResult !== null && (
					<FormControlLabel
						sx={{ m: 0, mb: "4px" }}
						control={
							<Switch
								checked={timelineDisplayMode === "simple"}
								onChange={handleTimelineDisplayModeChange}
								size="small"
								sx={{ mr: "4px" }}
							/>
						}
						label={
							<Typography
								sx={{
									fontSize: "11px",
									lineHeight: "13px",
									letterSpacing: "-0.4px",
								}}
							>
								{t("TeamTimeline.timeline simple view", "シンプル表示")}
							</Typography>
						}
					/>
				)}
				{runResult !== null && resultTimeline !== null ? (
					<Box
						data-testid="quick-sim-result-scroll-container"
						sx={{
							width: "100%",
							maxWidth: "100%",
							overflowX: timelineDisplayMode === "detailed" ? "auto" : "hidden",
							overflowY: "hidden",
							WebkitOverflowScrolling: "touch",
						}}
					>
						<TimelineTable
							team={resultTimeline.team}
							timeSlots={resultTimeline.timeSlots}
							simulationDays={runResult.simulationDays}
							result={runResult.simulationResult}
							swaps={resultTimeline.swaps}
							noCollectCells={resultTimeline.noCollectCells}
							box={runtimeBox}
							bonusSettings={bonusSettings}
							showSummaryRows={false}
							displayMode={timelineDisplayMode}
							readOnly
						/>
					</Box>
				) : (
					previewTimeline !== null && (
						<Box
							data-testid="quick-sim-preview-scroll-container"
							sx={{
								width: "100%",
								maxWidth: "100%",
								overflowX: "hidden",
								overflowY: "hidden",
								WebkitOverflowScrolling: "touch",
							}}
						>
							<TimelineTable
								team={previewTimeline.team}
								timeSlots={previewTimeline.timeSlots}
								simulationDays={simulationConfig.simulationDays}
								result={EMPTY_SIMULATION_RESULT}
								swaps={previewTimeline.swaps}
								noCollectCells={previewTimeline.noCollectCells}
								box={runtimeBox}
								bonusSettings={bonusSettings}
								showSummaryRows={false}
								compactEmptyCells
								readOnly
							/>
						</Box>
					)
				)}
				{runResult !== null && resultDurationSummary !== null && (
					<>
						<TeamSummaryRow
							teamSummary={runResult.simulationResult.teamSummary}
							layoutMode="details"
							simulationDays={runResult.simulationDays}
							valueMode={summaryValueMode}
							showValueModeToggle={showSummaryValueToggle}
							onValueModeChange={setSummaryValueMode}
							cookingResult={runResult.simulationResult.cookingResult}
							showLeftoverIncludeExtraUsageToggle
							leftoverIncludeExtraUsage={leftoverIncludeExtraUsage}
							onLeftoverIncludeExtraUsageChange={setLeftoverIncludeExtraUsage}
						/>
						<DailySummaryRow
							dailySummaries={runResult.simulationResult.dailySummaries}
							box={runtimeBox}
							layoutMode="details"
							simulationDays={runResult.simulationDays}
							valueMode={summaryValueMode}
							showTimelineDurationShare={runResult.timeline.swaps.length > 0}
							timelineDurationByPokemonId={
								resultDurationSummary.activeMinutesByPokemonId
							}
							totalTimelineDurationMinutes={
								resultDurationSummary.totalTimelineMinutes
							}
						/>
					</>
				)}
			</Box>

			<BoxSelectDialog
				open={boxDialogOpen}
				box={userBox}
				onSelect={handleMemberSelect}
				onClose={handleBoxDialogClose}
			/>
			<QuickSimImportConfirmDialog
				open={importConfirmOpen}
				onCancel={handleImportCancel}
				onConfirm={handleImportConfirm}
			/>
		</Box>
	);
}
