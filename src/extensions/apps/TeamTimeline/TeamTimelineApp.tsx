import {
	Box,
	Fade,
	FormControlLabel,
	Slider,
	Switch,
	Tab,
	Tabs,
	Typography,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import type React from "react";
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import PokemonBox, { type PokemonBoxItem } from "../../../util/PokemonBox";
import AdditionalAnalysisPanel from "./components/AdditionalAnalysisPanel";
import BoxSelectDialog from "./components/BoxSelectDialog";
import CookingSettingsPanel from "./components/CookingSettingsPanel";
import DailySummaryRow from "./components/DailySummaryRow";
import NoCollectSupplementBar from "./components/NoCollectSupplementBar";
import type { ResimulationDeltaSummary } from "./components/ResimulationNoticeBar";
import ResimulationNoticeBar from "./components/ResimulationNoticeBar";
import SimulationControls from "./components/SimulationControls";
import SummaryValueModeToggle from "./components/SummaryValueModeToggle";
import { SwapEnergyDialog } from "./components/SwapEnergyDialog";
import SwapRemoveConfirmDialog from "./components/SwapRemoveConfirmDialog";
import SwapSupplementBar from "./components/SwapSupplementBar";
import TeamSetToolbar from "./components/TeamSetToolbar";
import TeamSummaryRow from "./components/TeamSummaryRow";
import TimelineBonusSettingsPanel from "./components/TimelineBonusSettingsPanel";
import type { TimelineDisplayMode } from "./components/TimelineCell";
import TimelineHeader from "./components/TimelineHeader";
import TimelineTable from "./components/TimelineTable";
import TimeSlotEditor from "./components/TimeSlotEditor";
import TrialResultSelector from "./components/TrialResultSelector";
import WipeReveal from "./components/WipeReveal";
import { runMultiTrialSimulationWithProgress } from "./simulation/MultiTrialSimulator";
import { runSimulation } from "./simulation/TimelineSimulator";
import {
	createInitialState,
	loadBonusSettingsFromStorage,
	loadConfigFromStorage,
	loadLeftoverIncludeExtraUsageFromStorage,
	loadSeedModeFromStorage,
	loadSummaryValueModeFromStorage,
	loadSyncWithIvParameterFromStorage,
	loadTeamSetsFromStorage,
	loadTimeSlotsFromStorage,
	loadTrialCountFromStorage,
	saveBonusSettingsToStorage,
	saveConfigToStorage,
	saveLeftoverIncludeExtraUsageToStorage,
	saveSeedModeToStorage,
	saveSummaryValueModeToStorage,
	saveSyncWithIvParameterToStorage,
	saveTeamSetsToStorage,
	saveTimeSlotsToStorage,
	saveTrialCountToStorage,
	teamTimelineReducer,
} from "./TeamTimelineState";
import type {
	ContributionEpAnalysisResult,
	EnergyRecoveryBonusContributionResult,
	EnergySkillContributionResult,
	EnergySkillContributionTarget,
	EnergySkillTeamContributionResult,
	HelpingBonusContributionResult,
} from "./types/AdditionalAnalysisTypes";
import type {
	AverageCookingSummary,
	CookingSimulationSettings,
} from "./types/CookingTypes";
import type { TrialSummary } from "./types/MultiTrialTypes";
import type {
	TeamSetSimulationSnapshot,
	TeamSetState,
} from "./types/TeamTimelineTypes";
import type { TimelineBonusSettings } from "./types/TimelineBonusSettingsTypes";
import {
	type DailySummary,
	type NoCollectCellSetting,
	type PokemonSwap,
	type SimulationConfig,
	type SimulationResult,
	SWAP_NONE_POKEMON_ID,
	type TeamSummary,
	type TimeSlot,
} from "./types/TimeSlotTypes";
import {
	buildEnergySkillContributionTargets,
	calculateDeltaPercent,
	collectAppearingTimelineMembers,
	collectAverageEnergyRecoveryBonusMemberCountByDuration,
	collectAverageHelpingBonusMemberCountByDuration,
	collectTimelineDurationSummaryByPokemon,
	collectWakeErbMemberCountRange,
} from "./utils/AdditionalAnalysisUtils";
import {
	type AnalysisBaseMetricsCache,
	resolvePrecomputedBaseAverageMetrics,
} from "./utils/AnalysisBaseMetricsUtils";
import {
	loadCookingSettingsFromStorage,
	saveCookingSettingsToStorage,
} from "./utils/CookingSettingsStorage";
import {
	applyFirstAccessPresetIfNeeded,
	createTimelineRuntimeBox,
} from "./utils/FirstAccessPreset";
import {
	buildNoCollectSupplementEntries,
	countActiveNoCollectCells,
} from "./utils/NoCollectSupplementUtils";
import { buildSimulationContextHash } from "./utils/SimulationContextHash";
import type { SummaryValueMode } from "./utils/SummaryValueModeUtils";
import {
	hydrateSwapsWithSerializedPokemon,
	normalizeLoadedSwapsWithBox,
} from "./utils/SwapPersistenceUtils";
import { isSwapReassignment } from "./utils/SwapReassignmentUtils";
import { buildSwapSupplementSequences } from "./utils/SwapSupplementUtils";
import {
	shouldShowAdditionalAnalysisPanel,
	shouldSkipTeamResultEntryAnimation,
} from "./utils/TeamTimelineDisplayUtils";
import {
	IV_PARAMETER_STORAGE_KEY,
	loadTimelineBonusSettingsFromIvStorage,
	normalizeTimelineBonusSettings,
	saveTimelineBonusSettingsToIvStorage,
} from "./utils/TimelineBonusSettingsBridge";

interface TeamNormalizationResult {
	normalizedTeam: (PokemonBoxItem | null)[];
	idRemap: Map<number, number>;
}

interface AnalysisAverageMetrics {
	averageTeamEP: number;
	averageTeamHelpCount: number;
	averageEPByPokemonId: Map<number, number>;
	averageHelpByPokemonId: Map<number, number>;
	trialCount: number;
}

interface PendingSwapRemoval {
	slotId: string;
	teamIndex: number;
	dayIndex: number;
	pokemonId: number;
	hasFutureRepeat: boolean;
}

interface ResimulationMetricSummary {
	totalEP: number;
	berryEP: number;
	skillEP: number;
	cookingEP: number;
}

interface ResimulationUndoSnapshot {
	team: (PokemonBoxItem | null)[];
	swaps: PokemonSwap[];
	noCollectCells: NoCollectCellSetting[];
	simulationResult: SimulationResult;
	multiTrialResults: TrialSummary[] | null;
	multiTrialSelectedIndex: number | null;
	multiTrialAverageDailySummaries: DailySummary[] | null;
	multiTrialAverageTeamSummary: TeamSummary | null;
	multiTrialAverageCookingSummary: AverageCookingSummary | null;
	simulationSeed: number;
	teamSetSimulationSnapshot: TeamSetSimulationSnapshot | null;
}

interface SimulationExecutionResult {
	averageSummary: ResimulationMetricSummary;
	undoSnapshot: ResimulationUndoSnapshot;
}

const ANALYSIS_PROGRESS_UPDATE_INTERVAL_MS = 200;
const ABORT_ERROR_NAME = "AbortError";
const TIMELINE_WIPE_REVEAL_DURATION_MS = 800;
const TIMELINE_WIPE_REVEAL_EASING_IN_QUAD =
	"cubic-bezier(0.55, 0.085, 0.68, 0.53)";
const TIMELINE_WIPE_REVEAL_EASING_OUT_QUAD =
	"cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const TIMELINE_DETAILS_FADE_DURATION_MS = 450;
const TIMELINE_PAGE_BOTTOM_PADDING = "3em";
const TEAM_TIMELINE_CONTENT_WIDTH_PX = 540;
const TIME_SLOT_SETTINGS_SECTION_ID = "team-timeline-time-slot-settings";
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

function toResimulationMetricSummary(
	teamSummary: TeamSummary,
): ResimulationMetricSummary {
	return {
		totalEP: teamSummary.grandTotalEP,
		berryEP: teamSummary.totalBerryEP,
		skillEP: teamSummary.totalSkillEP,
		cookingEP: teamSummary.totalCookingEP ?? 0,
	};
}

function toResimulationDeltaSummary(
	baseline: ResimulationMetricSummary,
	next: ResimulationMetricSummary,
): ResimulationDeltaSummary {
	return {
		averageTotalEP: next.totalEP,
		totalDeltaEP: next.totalEP - baseline.totalEP,
		berryDeltaEP: next.berryEP - baseline.berryEP,
		skillDeltaEP: next.skillEP - baseline.skillEP,
		cookingDeltaEP: next.cookingEP - baseline.cookingEP,
	};
}

function resolveResimulationSummaryFromSnapshot(
	snapshot: ResimulationUndoSnapshot,
): ResimulationMetricSummary {
	if (snapshot.multiTrialAverageTeamSummary !== null) {
		return toResimulationMetricSummary(snapshot.multiTrialAverageTeamSummary);
	}
	return toResimulationMetricSummary(snapshot.simulationResult.teamSummary);
}

function buildAverageMetricsFromSummaries(
	teamEP: number,
	dailySummaries: readonly {
		pokemonId: number;
		totalHelpCount: number;
		totalEP: number;
	}[],
	trialCount: number,
): AnalysisAverageMetrics {
	const averageEPByPokemonId = new Map<number, number>();
	const averageHelpByPokemonId = new Map<number, number>();
	let averageTeamHelpCount = 0;

	dailySummaries.forEach((summary) => {
		averageEPByPokemonId.set(summary.pokemonId, summary.totalEP);
		averageHelpByPokemonId.set(summary.pokemonId, summary.totalHelpCount);
		averageTeamHelpCount += summary.totalHelpCount;
	});

	return {
		averageTeamEP: teamEP,
		averageTeamHelpCount,
		averageEPByPokemonId,
		averageHelpByPokemonId,
		trialCount,
	};
}

function pickEveryTenthSeeds(sortedSeeds: readonly number[]): number[] {
	const picked = sortedSeeds.filter((_, index) => (index + 1) % 10 === 0);
	if (picked.length > 0) {
		return picked;
	}
	return [...sortedSeeds];
}

function normalizeTeamWithBoxItems(
	loadedTeam: (PokemonBoxItem | null)[],
	boxItems: readonly PokemonBoxItem[],
): TeamNormalizationResult {
	const bucket = new Map<string, PokemonBoxItem[]>();
	boxItems.forEach((item) => {
		const key = item.serialize();
		const list = bucket.get(key) ?? [];
		list.push(item);
		bucket.set(key, list);
	});

	const idRemap = new Map<number, number>();
	const normalizedTeam = loadedTeam.map((member) => {
		if (member === null) {
			return null;
		}
		const key = member.serialize();
		const candidates = bucket.get(key);
		if (!candidates || candidates.length === 0) {
			return member;
		}
		const matched = candidates.shift();
		if (matched === undefined) {
			return member;
		}
		idRemap.set(member.id, matched.id);
		return matched;
	});

	return { normalizedTeam, idRemap };
}

function normalizeTeamSetWithRuntimeBox(
	teamSet: TeamSetState,
	runtimeBox: PokemonBox,
): TeamSetState {
	const { normalizedTeam, idRemap } = normalizeTeamWithBoxItems(
		teamSet.team,
		runtimeBox.items,
	);
	return {
		...teamSet,
		team: normalizedTeam,
		swaps: normalizeLoadedSwapsWithBox(teamSet.swaps, runtimeBox, idRemap),
		noCollectCells: [...teamSet.noCollectCells],
	};
}

function createSwapSignature(swaps: readonly PokemonSwap[]): string {
	return swaps
		.map(
			(swap) =>
				`${swap.dayIndex}:${swap.slotId}:${swap.teamSlotIndex}:${swap.newPokemonId}:${swap.initialEnergy}`,
		)
		.join("|");
}

function createNoCollectSignature(
	noCollectCells: readonly NoCollectCellSetting[],
): string {
	return noCollectCells
		.map((cell) => `${cell.dayIndex}:${cell.slotId}:${cell.teamSlotIndex}`)
		.join("|");
}

function createTeamSignature(team: readonly (PokemonBoxItem | null)[]): string {
	return team
		.map((member, index) => `${index}:${member?.id ?? "null"}`)
		.join("|");
}

function areFavoriteTypesEqual(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function createTeamSetId(): string {
	return `team-set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * チームタイムラインアプリのメインコンポーネント
 */
export default function TeamTimelineApp() {
	const { t } = useTranslation();
	const theme = useTheme();
	const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
	const teamScale = isDesktop ? 1.5 : 1;
	const [state, dispatch] = useReducer(
		teamTimelineReducer,
		undefined,
		createInitialState,
	);

	// 初期ロード完了フラグ
	const [isInitialized, setIsInitialized] = useState(false);
	const [summaryValueMode, setSummaryValueMode] =
		useState<SummaryValueMode>("periodTotal");
	const [leftoverIncludeExtraUsage, setLeftoverIncludeExtraUsage] =
		useState(false);
	const [simulationProgress, setSimulationProgress] = useState(0);
	const [showResimulationNotice, setShowResimulationNotice] = useState(false);
	const [resimulationDeltaSummary, setResimulationDeltaSummary] =
		useState<ResimulationDeltaSummary | null>(null);
	const [resimulationUndoSnapshot, setResimulationUndoSnapshot] =
		useState<ResimulationUndoSnapshot | null>(null);
	const [pendingSwapRemoval, setPendingSwapRemoval] =
		useState<PendingSwapRemoval | null>(null);
	const [removeFutureRepeatChecked, setRemoveFutureRepeatChecked] =
		useState(false);
	const [analysisQuickModeEnabled, setAnalysisQuickModeEnabled] =
		useState(true);
	const [timelineDisplayMode, setTimelineDisplayMode] =
		useState<TimelineDisplayMode>("detailed");
	const [analysisError, setAnalysisError] = useState<string | null>(null);
	const [baseAverageMetricsCache, setBaseAverageMetricsCache] =
		useState<AnalysisBaseMetricsCache<AnalysisAverageMetrics> | null>(null);
	const [contributionResults, setContributionResults] = useState<
		Map<number, ContributionEpAnalysisResult>
	>(new Map());
	const [energySkillResults, setEnergySkillResults] = useState<
		Map<number, EnergySkillContributionResult>
	>(new Map());
	const [energySkillTeamResult, setEnergySkillTeamResult] =
		useState<EnergySkillTeamContributionResult | null>(null);
	const [helpingBonusResult, setHelpingBonusResult] =
		useState<HelpingBonusContributionResult | null>(null);
	const [energyRecoveryBonusResult, setEnergyRecoveryBonusResult] =
		useState<EnergyRecoveryBonusContributionResult | null>(null);
	const [contributionLoadingIds, setContributionLoadingIds] = useState<
		Set<number>
	>(new Set());
	const [energySkillLoadingIds, setEnergySkillLoadingIds] = useState<
		Set<number>
	>(new Set());
	const [contributionBatchLoading, setContributionBatchLoading] =
		useState(false);
	const [energySkillBatchLoading, setEnergySkillBatchLoading] = useState(false);
	const [energySkillTeamLoading, setEnergySkillTeamLoading] = useState(false);
	const [helpingBonusLoading, setHelpingBonusLoading] = useState(false);
	const [energyRecoveryBonusLoading, setEnergyRecoveryBonusLoading] =
		useState(false);
	const [contributionProgressById, setContributionProgressById] = useState<
		Map<number, number>
	>(new Map());
	const [energySkillProgressById, setEnergySkillProgressById] = useState<
		Map<number, number>
	>(new Map());
	const [contributionBatchProgress, setContributionBatchProgress] = useState(0);
	const [energySkillBatchProgress, setEnergySkillBatchProgress] = useState(0);
	const [energySkillTeamProgress, setEnergySkillTeamProgress] = useState(0);
	const [helpingBonusProgress, setHelpingBonusProgress] = useState(0);
	const [energyRecoveryBonusProgress, setEnergyRecoveryBonusProgress] =
		useState(0);
	const simulationAbortControllerRef = useRef<AbortController | null>(null);
	const suppressResimulationNoticeRef = useRef(false);
	const lastSimulatedSnapshotRef = useRef<ResimulationUndoSnapshot | null>(
		null,
	);
	const analysisRunVersionRef = useRef(0);
	const previousActiveTabRef = useRef(state.activeTab);

	const resetAdditionalAnalysisState = useCallback(() => {
		analysisRunVersionRef.current += 1;
		setAnalysisError(null);
		setBaseAverageMetricsCache(null);
		setContributionResults(new Map());
		setEnergySkillResults(new Map());
		setEnergySkillTeamResult(null);
		setHelpingBonusResult(null);
		setEnergyRecoveryBonusResult(null);
		setContributionLoadingIds(new Set());
		setEnergySkillLoadingIds(new Set());
		setContributionBatchLoading(false);
		setEnergySkillBatchLoading(false);
		setEnergySkillTeamLoading(false);
		setHelpingBonusLoading(false);
		setEnergyRecoveryBonusLoading(false);
		setContributionProgressById(new Map());
		setEnergySkillProgressById(new Map());
		setContributionBatchProgress(0);
		setEnergySkillBatchProgress(0);
		setEnergySkillTeamProgress(0);
		setHelpingBonusProgress(0);
		setEnergyRecoveryBonusProgress(0);
	}, []);

	const cancelRunningAnalysisIfAny = useCallback((): boolean => {
		const hasRunningAnalysis =
			contributionLoadingIds.size > 0 ||
			energySkillLoadingIds.size > 0 ||
			contributionBatchLoading ||
			energySkillBatchLoading ||
			energySkillTeamLoading ||
			helpingBonusLoading ||
			energyRecoveryBonusLoading;
		if (!hasRunningAnalysis) {
			return false;
		}
		resetAdditionalAnalysisState();
		return true;
	}, [
		contributionLoadingIds,
		energySkillLoadingIds,
		contributionBatchLoading,
		energySkillBatchLoading,
		energySkillTeamLoading,
		helpingBonusLoading,
		energyRecoveryBonusLoading,
		resetAdditionalAnalysisState,
	]);

	// ボックスのロード（初回のみ）
	const userBoxRef = useRef<PokemonBox | null>(null);
	const timelineRuntimeBoxRef = useRef<PokemonBox | null>(null);
	if (userBoxRef.current === null || timelineRuntimeBoxRef.current === null) {
		const loadedUserBox = new PokemonBox();
		loadedUserBox.load();
		userBoxRef.current = loadedUserBox;
		timelineRuntimeBoxRef.current = createTimelineRuntimeBox(loadedUserBox);
		applyFirstAccessPresetIfNeeded();
	}
	const userBox = userBoxRef.current;
	const timelineRuntimeBox = timelineRuntimeBoxRef.current;
	if (userBox === null || timelineRuntimeBox === null) {
		throw new Error("Timeline runtime boxes must be initialized");
	}
	const currentSimulationContextHash = useMemo(
		() =>
			buildSimulationContextHash({
				bonusSettings: state.bonusSettings,
				cookingSettings: state.cookingSettings,
				initialEnergy: state.simulationConfig.initialEnergy,
				simulationDays: state.simulationConfig.simulationDays,
				timeSlots: state.timeSlots,
			}),
		[
			state.bonusSettings,
			state.cookingSettings,
			state.simulationConfig.initialEnergy,
			state.simulationConfig.simulationDays,
			state.timeSlots,
		],
	);

	// 初回マウント時にデータをロード
	useEffect(() => {
		const runtimeBox = timelineRuntimeBoxRef.current;
		if (!runtimeBox) {
			return;
		}

		const loadedTeamSets = loadTeamSetsFromStorage(runtimeBox);
		if (loadedTeamSets) {
			const normalizedTeamSets = loadedTeamSets.teamSets.map((teamSet) =>
				normalizeTeamSetWithRuntimeBox(teamSet, runtimeBox),
			);
			dispatch({
				type: "loadTeamSets",
				teamSets: normalizedTeamSets,
				activeIndex: loadedTeamSets.activeTeamSetIndex,
			});
		}

		const savedSlots = loadTimeSlotsFromStorage();
		dispatch({ type: "loadTimeSlots", slots: savedSlots });

		const savedConfig = loadConfigFromStorage();
		dispatch({ type: "loadSimulationConfig", config: savedConfig });
		dispatch({ type: "setSeedMode", mode: loadSeedModeFromStorage() });
		dispatch({
			type: "setMultiTrialCount",
			count: loadTrialCountFromStorage(),
		});
		setSummaryValueMode(loadSummaryValueModeFromStorage());
		setLeftoverIncludeExtraUsage(loadLeftoverIncludeExtraUsageFromStorage());
		const savedBonusSettings = loadBonusSettingsFromStorage();
		dispatch({ type: "loadBonusSettings", settings: savedBonusSettings });
		const syncWithIvParameter = loadSyncWithIvParameterFromStorage();
		dispatch({ type: "loadSyncWithIvParameter", enabled: syncWithIvParameter });
		if (syncWithIvParameter) {
			dispatch({
				type: "loadBonusSettings",
				settings: loadTimelineBonusSettingsFromIvStorage(),
			});
		}

		const cookingSettings = loadCookingSettingsFromStorage();
		dispatch({ type: "loadCookingSettings", settings: cookingSettings });

		// ロード完了をマーク
		setIsInitialized(true);
	}, []); // 依存配列を空に

	// チームセットを永続化（初期化完了後のみ）
	useEffect(() => {
		if (!isInitialized) return;
		const hydratedTeamSets = state.teamSets.map((teamSet) => ({
			...teamSet,
			swaps: hydrateSwapsWithSerializedPokemon(
				teamSet.swaps,
				timelineRuntimeBoxRef.current ?? undefined,
			),
		}));
		saveTeamSetsToStorage(hydratedTeamSets, state.activeTeamSetIndex);
	}, [state.teamSets, state.activeTeamSetIndex, isInitialized]);

	// 時間帯設定の永続化（初期化完了後のみ）
	useEffect(() => {
		if (!isInitialized) return;
		saveTimeSlotsToStorage(state.timeSlots);
	}, [state.timeSlots, isInitialized]);

	// シミュレーション設定の永続化（初期化完了後のみ）
	useEffect(() => {
		if (!isInitialized) return;
		saveConfigToStorage(state.simulationConfig);
	}, [state.simulationConfig, isInitialized]);

	// ボーナス設定の永続化（初期化完了後のみ）
	useEffect(() => {
		if (!isInitialized) return;
		saveBonusSettingsToStorage(state.bonusSettings);
	}, [state.bonusSettings, isInitialized]);

	// 料理設定の永続化（初期化完了後のみ）
	useEffect(() => {
		if (!isInitialized) return;
		saveCookingSettingsToStorage(state.cookingSettings);
	}, [state.cookingSettings, isInitialized]);

	// 個体値計算機連動フラグの永続化（初期化完了後のみ）
	useEffect(() => {
		if (!isInitialized) return;
		saveSyncWithIvParameterToStorage(state.syncWithIvParameter);
	}, [state.syncWithIvParameter, isInitialized]);

	const previousSwapSignatureRef = useRef<string | null>(null);
	useEffect(() => {
		const signature = createSwapSignature(state.swaps);
		if (!isInitialized) {
			previousSwapSignatureRef.current = signature;
			return;
		}

		const previousSignature = previousSwapSignatureRef.current;
		previousSwapSignatureRef.current = signature;
		if (previousSignature === null || previousSignature === signature) {
			return;
		}
		if (suppressResimulationNoticeRef.current) {
			return;
		}
		if (state.simulationResult === null) {
			return;
		}
		setResimulationDeltaSummary(null);
		setResimulationUndoSnapshot(null);
		setShowResimulationNotice(true);
	}, [state.swaps, state.simulationResult, isInitialized]);

	const previousNoCollectSignatureRef = useRef<string | null>(null);
	useEffect(() => {
		const signature = createNoCollectSignature(state.noCollectCells);
		if (!isInitialized) {
			previousNoCollectSignatureRef.current = signature;
			return;
		}

		const previousSignature = previousNoCollectSignatureRef.current;
		previousNoCollectSignatureRef.current = signature;
		if (previousSignature === null || previousSignature === signature) {
			return;
		}
		if (suppressResimulationNoticeRef.current) {
			return;
		}
		if (state.simulationResult === null) {
			return;
		}
		setResimulationDeltaSummary(null);
		setResimulationUndoSnapshot(null);
		setShowResimulationNotice(true);
	}, [state.noCollectCells, state.simulationResult, isInitialized]);

	const previousTeamSignatureRef = useRef<string | null>(null);
	useEffect(() => {
		const signature = createTeamSignature(state.team);
		if (!isInitialized) {
			previousTeamSignatureRef.current = signature;
			return;
		}

		const previousSignature = previousTeamSignatureRef.current;
		previousTeamSignatureRef.current = signature;
		if (previousSignature === null || previousSignature === signature) {
			return;
		}
		if (suppressResimulationNoticeRef.current) {
			return;
		}
		if (state.simulationResult === null) {
			return;
		}
		setResimulationDeltaSummary(null);
		setResimulationUndoSnapshot(null);
		setShowResimulationNotice(true);
	}, [state.team, state.simulationResult, isInitialized]);

	useEffect(() => {
		if (state.simulationConfig.simulationDays < 2) {
			setSummaryValueMode("periodTotal");
		}
	}, [state.simulationConfig.simulationDays]);

	useEffect(() => {
		if (!isInitialized) return;
		saveSummaryValueModeToStorage(summaryValueMode);
	}, [summaryValueMode, isInitialized]);

	useEffect(() => {
		if (!isInitialized) return;
		saveLeftoverIncludeExtraUsageToStorage(leftoverIncludeExtraUsage);
	}, [leftoverIncludeExtraUsage, isInitialized]);

	useEffect(() => {
		if (!isInitialized) return;
		saveSeedModeToStorage(state.seedMode);
	}, [state.seedMode, isInitialized]);

	useEffect(() => {
		if (!isInitialized) return;
		saveTrialCountToStorage(state.multiTrialCount);
	}, [state.multiTrialCount, isInitialized]);

	// 連動ON中は個体値計算機パラメーターの外部更新を取り込む
	useEffect(() => {
		if (!state.syncWithIvParameter) {
			return undefined;
		}
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== IV_PARAMETER_STORAGE_KEY) {
				return;
			}
			dispatch({
				type: "setBonusSettings",
				settings: loadTimelineBonusSettingsFromIvStorage(),
			});
		};
		window.addEventListener("storage", handleStorage);
		return () => {
			window.removeEventListener("storage", handleStorage);
		};
	}, [state.syncWithIvParameter]);

	useEffect(
		() => () => {
			simulationAbortControllerRef.current?.abort();
			analysisRunVersionRef.current += 1;
		},
		[],
	);

	useEffect(() => {
		previousActiveTabRef.current = state.activeTab;
	}, [state.activeTab]);

	// スロットクリック時のハンドラ
	const handleSlotClick = useCallback((index: number) => {
		dispatch({ type: "openSlotDialog", index });
	}, []);

	// ポケモン削除時のハンドラ
	const handleRemoveClick = useCallback((index: number) => {
		dispatch({ type: "removePokemon", index });
	}, []);

	// ダイアログを閉じる
	const handleDialogClose = useCallback(() => {
		dispatch({ type: "closeSlotDialog" });
	}, []);

	// ポケモン選択時のハンドラ
	const { selectedSlotIndex } = state;
	const handlePokemonSelect = useCallback(
		(item: PokemonBoxItem) => {
			if (selectedSlotIndex !== null) {
				dispatch({ type: "selectPokemon", index: selectedSlotIndex, item });
			}
		},
		[selectedSlotIndex],
	);

	const runSingleSimulationWithSeed = useCallback(
		(seed: number): SimulationExecutionResult => {
			const result = runSimulation({
				team: state.team,
				timeSlots: state.timeSlots,
				config: {
					seed,
					initialEnergy: state.simulationConfig.initialEnergy,
					simulationDays: state.simulationConfig.simulationDays,
				},
				bonusSettings: state.bonusSettings,
				swaps: state.swaps,
				noCollectCells: state.noCollectCells,
				box: timelineRuntimeBoxRef.current || undefined,
				cookingSettings: state.cookingSettings,
			});
			dispatch({ type: "setSimulationResult", result });
			dispatch({
				type: "setActiveTeamSetSimulationSnapshot",
				snapshot: {
					averageTotalEP: result.teamSummary.grandTotalEP,
					settingsHash: currentSimulationContextHash,
				},
			});
			dispatch({ type: "updateSimulationConfig", config: { seed } });
			const teamSetSimulationSnapshot: TeamSetSimulationSnapshot = {
				averageTotalEP: result.teamSummary.grandTotalEP,
				settingsHash: currentSimulationContextHash,
			};
			return {
				averageSummary: toResimulationMetricSummary(result.teamSummary),
				undoSnapshot: {
					team: [...state.team],
					swaps: [...state.swaps],
					noCollectCells: [...state.noCollectCells],
					simulationResult: result,
					multiTrialResults: null,
					multiTrialSelectedIndex: null,
					multiTrialAverageDailySummaries: null,
					multiTrialAverageTeamSummary: null,
					multiTrialAverageCookingSummary: null,
					simulationSeed: seed,
					teamSetSimulationSnapshot,
				},
			};
		},
		[
			state.team,
			state.timeSlots,
			state.simulationConfig.initialEnergy,
			state.simulationConfig.simulationDays,
			state.bonusSettings,
			state.swaps,
			state.noCollectCells,
			state.cookingSettings,
			currentSimulationContextHash,
		],
	);

	const runMultiTrialWithSeed = useCallback(
		async (
			initialSeed?: number,
			preferredSeed?: number,
			abortSignal?: AbortSignal,
		): Promise<SimulationExecutionResult> => {
			let hasShownFirstTrialPreview = false;
			const multiResult = await runMultiTrialSimulationWithProgress({
				team: state.team,
				timeSlots: state.timeSlots,
				config: {
					initialEnergy: state.simulationConfig.initialEnergy,
					simulationDays: state.simulationConfig.simulationDays,
				},
				bonusSettings: state.bonusSettings,
				cookingSettings: state.cookingSettings,
				swaps: state.swaps,
				noCollectCells: state.noCollectCells,
				box: timelineRuntimeBoxRef.current || undefined,
				trialCount: state.multiTrialCount,
				initialSeed,
				onProgress: (progress) => {
					setSimulationProgress(progress);
				},
				onTrialComplete: ({ index, trialCount, seed, result }) => {
					if (abortSignal?.aborted) {
						return;
					}
					if (trialCount < 2 || index !== 0 || hasShownFirstTrialPreview) {
						return;
					}
					hasShownFirstTrialPreview = true;
					dispatch({ type: "setSimulationPreviewResult", result });
					dispatch({ type: "updateSimulationConfig", config: { seed } });
				},
				shouldAbort: () => abortSignal?.aborted === true,
			});

			if (multiResult.trials.length === 0) {
				throw new Error("シミュレーション結果がありません");
			}

			let selectedIndex = multiResult.medianIndex;
			if (preferredSeed !== undefined) {
				const preferredIndex = multiResult.trials.findIndex(
					(trial) => trial.seed === preferredSeed,
				);
				if (preferredIndex >= 0) {
					selectedIndex = preferredIndex;
				}
			}

			dispatch({
				type: "setMultiTrialResults",
				results: [...multiResult.trials],
				medianIndex: selectedIndex,
				averageDailySummaries: multiResult.averageDailySummaries,
				averageTeamSummary: multiResult.averageTeamSummary,
				averageCookingSummary: multiResult.averageCookingSummary,
			});

			const selectedSeed = multiResult.trials[selectedIndex].seed;
			const fullResult = runSimulation({
				team: state.team,
				timeSlots: state.timeSlots,
				config: {
					seed: selectedSeed,
					initialEnergy: state.simulationConfig.initialEnergy,
					simulationDays: state.simulationConfig.simulationDays,
				},
				bonusSettings: state.bonusSettings,
				swaps: state.swaps,
				noCollectCells: state.noCollectCells,
				box: timelineRuntimeBoxRef.current || undefined,
				cookingSettings: state.cookingSettings,
			});
			dispatch({ type: "setSimulationResult", result: fullResult });
			dispatch({
				type: "setActiveTeamSetSimulationSnapshot",
				snapshot: {
					averageTotalEP: multiResult.averageTeamSummary.grandTotalEP,
					settingsHash: currentSimulationContextHash,
				},
			});
			const teamSetSimulationSnapshot: TeamSetSimulationSnapshot = {
				averageTotalEP: multiResult.averageTeamSummary.grandTotalEP,
				settingsHash: currentSimulationContextHash,
			};
			return {
				averageSummary: toResimulationMetricSummary(
					multiResult.averageTeamSummary,
				),
				undoSnapshot: {
					team: [...state.team],
					swaps: [...state.swaps],
					noCollectCells: [...state.noCollectCells],
					simulationResult: fullResult,
					multiTrialResults: [...multiResult.trials],
					multiTrialSelectedIndex: selectedIndex,
					multiTrialAverageDailySummaries: [
						...multiResult.averageDailySummaries,
					],
					multiTrialAverageTeamSummary: multiResult.averageTeamSummary,
					multiTrialAverageCookingSummary: multiResult.averageCookingSummary,
					simulationSeed: state.simulationConfig.seed,
					teamSetSimulationSnapshot,
				},
			};
		},
		[
			state.team,
			state.timeSlots,
			state.simulationConfig.initialEnergy,
			state.simulationConfig.simulationDays,
			state.simulationConfig.seed,
			state.bonusSettings,
			state.swaps,
			state.noCollectCells,
			state.multiTrialCount,
			state.cookingSettings,
			currentSimulationContextHash,
		],
	);

	const executeSimulation = useCallback(
		async (options?: {
			forcedInitialSeed?: number;
			preferredSeed?: number;
			forceMultiTrial?: boolean;
			abortSignal?: AbortSignal;
		}): Promise<SimulationExecutionResult | null> => {
			const validTeam = state.team.filter((p) => p !== null);
			if (validTeam.length === 0) {
				throw new Error("チームにポケモンを追加してください");
			}

			const forceMultiTrial = options?.forceMultiTrial === true;
			if (
				!forceMultiTrial &&
				state.seedMode === "fixed" &&
				state.multiTrialCount === 1
			) {
				if (options?.abortSignal?.aborted) {
					return null;
				}
				setSimulationProgress(30);
				const singleResult = runSingleSimulationWithSeed(
					state.simulationConfig.seed,
				);
				setSimulationProgress(100);
				return singleResult;
			}

			const initialSeed =
				options?.forcedInitialSeed ??
				(forceMultiTrial || state.seedMode === "fixed"
					? state.simulationConfig.seed
					: undefined);
			const multiResult = await runMultiTrialWithSeed(
				initialSeed,
				options?.preferredSeed,
				options?.abortSignal,
			);
			setSimulationProgress(100);
			return multiResult;
		},
		[
			state.team,
			state.seedMode,
			state.multiTrialCount,
			state.simulationConfig.seed,
			runSingleSimulationWithSeed,
			runMultiTrialWithSeed,
		],
	);

	const buildSnapshotFromCurrentState =
		useCallback((): ResimulationUndoSnapshot | null => {
			if (state.simulationResult === null) {
				return null;
			}
			return {
				team: [...state.team],
				swaps: [...state.swaps],
				noCollectCells: [...state.noCollectCells],
				simulationResult: state.simulationResult,
				multiTrialResults: state.multiTrialResults
					? [...state.multiTrialResults]
					: null,
				multiTrialSelectedIndex: state.multiTrialSelectedIndex,
				multiTrialAverageDailySummaries: state.multiTrialAverageDailySummaries
					? [...state.multiTrialAverageDailySummaries]
					: null,
				multiTrialAverageTeamSummary: state.multiTrialAverageTeamSummary,
				multiTrialAverageCookingSummary: state.multiTrialAverageCookingSummary,
				simulationSeed: state.simulationConfig.seed,
				teamSetSimulationSnapshot:
					state.teamSets[state.activeTeamSetIndex]?.lastSimulationSnapshot ??
					null,
			};
		}, [
			state.activeTeamSetIndex,
			state.multiTrialAverageCookingSummary,
			state.multiTrialAverageDailySummaries,
			state.multiTrialAverageTeamSummary,
			state.multiTrialResults,
			state.multiTrialSelectedIndex,
			state.noCollectCells,
			state.simulationConfig.seed,
			state.simulationResult,
			state.swaps,
			state.team,
			state.teamSets,
		]);

	useEffect(() => {
		if (lastSimulatedSnapshotRef.current !== null) {
			return;
		}
		const currentSnapshot = buildSnapshotFromCurrentState();
		if (currentSnapshot !== null) {
			lastSimulatedSnapshotRef.current = currentSnapshot;
		}
	}, [buildSnapshotFromCurrentState]);

	// シミュレーション実行ハンドラー（統合）
	const handleRunSimulation = useCallback(
		(options?: { showResimulationDelta?: boolean }) => {
			if (state.simulationLoading) {
				simulationAbortControllerRef.current?.abort();
				resetAdditionalAnalysisState();
				return;
			}

			const shouldShowResimulationDelta =
				options?.showResimulationDelta === true;
			const baselineUndoSnapshot = shouldShowResimulationDelta
				? (lastSimulatedSnapshotRef.current ?? buildSnapshotFromCurrentState())
				: null;
			const baselineSummary =
				baselineUndoSnapshot !== null
					? resolveResimulationSummaryFromSnapshot(baselineUndoSnapshot)
					: null;

			setShowResimulationNotice(false);
			setResimulationDeltaSummary(null);
			setResimulationUndoSnapshot(null);
			resetAdditionalAnalysisState();
			setSimulationProgress(0);
			dispatch({ type: "startSimulation" });
			const abortController = new AbortController();
			simulationAbortControllerRef.current = abortController;

			// Use setTimeout to allow React to render loading state before heavy computation
			setTimeout(() => {
				void executeSimulation({ abortSignal: abortController.signal })
					.then((simulationExecutionResult) => {
						if (
							!shouldShowResimulationDelta ||
							baselineSummary === null ||
							baselineUndoSnapshot === null ||
							simulationExecutionResult === null
						) {
							if (simulationExecutionResult !== null) {
								lastSimulatedSnapshotRef.current =
									simulationExecutionResult.undoSnapshot;
							}
							return;
						}
						lastSimulatedSnapshotRef.current =
							simulationExecutionResult.undoSnapshot;
						setResimulationUndoSnapshot(baselineUndoSnapshot);
						setResimulationDeltaSummary(
							toResimulationDeltaSummary(
								baselineSummary,
								simulationExecutionResult.averageSummary,
							),
						);
					})
					.catch((e) => {
						if (isAbortError(e)) {
							return;
						}
						dispatch({ type: "setSimulationError", error: String(e) });
						setSimulationProgress(0);
					})
					.finally(() => {
						if (simulationAbortControllerRef.current === abortController) {
							simulationAbortControllerRef.current = null;
						}
					});
			}, 0);
		},
		[
			executeSimulation,
			buildSnapshotFromCurrentState,
			resetAdditionalAnalysisState,
			state.simulationLoading,
		],
	);

	const handleRunResimulation = useCallback(() => {
		handleRunSimulation({ showResimulationDelta: true });
	}, [handleRunSimulation]);

	const handleResimulationResultClose = useCallback(() => {
		setResimulationDeltaSummary(null);
		setResimulationUndoSnapshot(null);
	}, []);

	const handleResimulationUndo = useCallback(() => {
		if (resimulationUndoSnapshot === null) {
			setResimulationDeltaSummary(null);
			return;
		}

		suppressResimulationNoticeRef.current = true;
		dispatch({ type: "loadTeam", team: [...resimulationUndoSnapshot.team] });
		dispatch({ type: "loadSwaps", swaps: [...resimulationUndoSnapshot.swaps] });
		dispatch({
			type: "loadNoCollectCells",
			noCollectCells: [...resimulationUndoSnapshot.noCollectCells],
		});

		const multiTrialResults = resimulationUndoSnapshot.multiTrialResults;
		const averageDailySummaries =
			resimulationUndoSnapshot.multiTrialAverageDailySummaries;
		const averageTeamSummary =
			resimulationUndoSnapshot.multiTrialAverageTeamSummary;

		if (
			multiTrialResults !== null &&
			averageDailySummaries !== null &&
			averageTeamSummary !== null
		) {
			const restoredSelectedIndex =
				resimulationUndoSnapshot.multiTrialSelectedIndex ??
				Math.floor((multiTrialResults.length - 1) / 2);
			dispatch({
				type: "setMultiTrialResults",
				results: [...multiTrialResults],
				medianIndex: restoredSelectedIndex,
				averageDailySummaries: [...averageDailySummaries],
				averageTeamSummary,
				averageCookingSummary:
					resimulationUndoSnapshot.multiTrialAverageCookingSummary,
			});
		} else {
			dispatch({ type: "clearMultiTrialResults" });
		}

		dispatch({
			type: "setSimulationResult",
			result: resimulationUndoSnapshot.simulationResult,
		});
		dispatch({
			type: "updateSimulationConfig",
			config: { seed: resimulationUndoSnapshot.simulationSeed },
		});
		if (resimulationUndoSnapshot.teamSetSimulationSnapshot) {
			dispatch({
				type: "setActiveTeamSetSimulationSnapshot",
				snapshot: { ...resimulationUndoSnapshot.teamSetSimulationSnapshot },
			});
		}

		setShowResimulationNotice(false);
		setResimulationDeltaSummary(null);
		setResimulationUndoSnapshot(null);
		lastSimulatedSnapshotRef.current = resimulationUndoSnapshot;
		window.setTimeout(() => {
			suppressResimulationNoticeRef.current = false;
		}, 0);
	}, [resimulationUndoSnapshot]);

	// スライダー変更ハンドラー（結果切り替え）
	const handleSliderChange = useCallback(
		(index: number) => {
			if (
				!state.multiTrialResults ||
				index < 0 ||
				index >= state.multiTrialResults.length
			)
				return;
			dispatch({ type: "setMultiTrialSelectedIndex", index });

			const trial = state.multiTrialResults[index];
			try {
				const result = runSimulation({
					team: state.team,
					timeSlots: state.timeSlots,
					config: {
						seed: trial.seed,
						initialEnergy: state.simulationConfig.initialEnergy,
						simulationDays: state.simulationConfig.simulationDays,
					},
					bonusSettings: state.bonusSettings,
					swaps: state.swaps,
					noCollectCells: state.noCollectCells,
					box: timelineRuntimeBoxRef.current || undefined,
					cookingSettings: state.cookingSettings,
				});
				dispatch({ type: "setSimulationResult", result });
			} catch (e) {
				dispatch({ type: "setSimulationError", error: String(e) });
			}
		},
		[
			state.multiTrialResults,
			state.team,
			state.timeSlots,
			state.simulationConfig.initialEnergy,
			state.simulationConfig.simulationDays,
			state.bonusSettings,
			state.swaps,
			state.noCollectCells,
			state.cookingSettings,
		],
	);

	// シードモード変更ハンドラー
	const handleSeedModeChange = useCallback((mode: "random" | "fixed") => {
		dispatch({ type: "setSeedMode", mode });
	}, []);

	// 試行回数変更ハンドラー
	const handleTrialCountChange = useCallback((count: number) => {
		dispatch({ type: "setMultiTrialCount", count });
	}, []);

	// シード値変更ハンドラー
	const handleSeedChange = useCallback((seed: number) => {
		dispatch({ type: "updateSimulationConfig", config: { seed } });
	}, []);

	const handleSimulationDaysChange = useCallback((simulationDays: number) => {
		dispatch({ type: "updateSimulationConfig", config: { simulationDays } });
	}, []);
	const handleSummaryValueModeChange = useCallback((mode: SummaryValueMode) => {
		setSummaryValueMode(mode);
	}, []);
	const handleTimelineDisplayModeChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setTimelineDisplayMode(event.target.checked ? "simple" : "detailed");
		},
		[],
	);

	// タブ切り替えハンドラー
	const handleTabChange = useCallback(
		(_: React.SyntheticEvent, newValue: "team" | "settings" | "cooking") => {
			dispatch({ type: "selectTab", tab: newValue });
		},
		[],
	);

	const createDefaultTeamSetName = useCallback(
		(index: number) =>
			`${t("TeamTimeline.team set default name", "チーム")}${index}`,
		[t],
	);

	const handleTeamSetSaveSettings = useCallback(
		(
			name: string,
			saveCookingSettings: boolean,
			saveFieldSettings: boolean,
		) => {
			dispatch({
				type: "updateActiveTeamSetSaveSettings",
				name,
				saveCookingSettings,
				saveFieldSettings,
			});
		},
		[],
	);

	const handleTeamSetCreate = useCallback(() => {
		dispatch({
			type: "createTeamSet",
			id: createTeamSetId(),
			name: createDefaultTeamSetName(state.teamSets.length + 1),
		});
	}, [createDefaultTeamSetName, state.teamSets.length]);

	const handleTeamSetDuplicateAt = useCallback(
		(index: number) => {
			const safeIndex = Math.max(0, Math.min(index, state.teamSets.length - 1));
			if (safeIndex !== state.activeTeamSetIndex) {
				dispatch({ type: "selectTeamSet", index: safeIndex });
			}
			const sourceName =
				state.teamSets[safeIndex]?.name ??
				createDefaultTeamSetName(safeIndex + 1);
			const duplicateSuffix = t(
				"TeamTimeline.team set duplicate suffix",
				"コピー",
			);
			dispatch({
				type: "duplicateTeamSet",
				id: createTeamSetId(),
				name: `${sourceName} ${duplicateSuffix}`,
			});
		},
		[createDefaultTeamSetName, state.activeTeamSetIndex, state.teamSets, t],
	);

	const handleTeamSetDeleteAt = useCallback(
		(index: number) => {
			const safeIndex = Math.max(0, Math.min(index, state.teamSets.length - 1));
			if (safeIndex !== state.activeTeamSetIndex) {
				dispatch({ type: "selectTeamSet", index: safeIndex });
			}
			dispatch({
				type: "deleteTeamSet",
				fallbackId: createTeamSetId(),
				fallbackName: createDefaultTeamSetName(1),
			});
		},
		[createDefaultTeamSetName, state.activeTeamSetIndex, state.teamSets.length],
	);

	const handleTeamSetSelect = useCallback((index: number) => {
		dispatch({ type: "selectTeamSet", index });
	}, []);

	useEffect(() => {
		if (!isInitialized) {
			return;
		}
		const activeTeamSet = state.teamSets[state.activeTeamSetIndex];
		if (!activeTeamSet) {
			return;
		}

		if (
			activeTeamSet.saveCookingSettings &&
			activeTeamSet.savedCookingSettings
		) {
			const shouldRestoreCooking =
				state.cookingSettings.enabled !==
					activeTeamSet.savedCookingSettings.enabled ||
				state.cookingSettings.category !==
					activeTeamSet.savedCookingSettings.category;
			if (shouldRestoreCooking) {
				dispatch({
					type: "setCookingSettings",
					settings: {
						...state.cookingSettings,
						enabled: activeTeamSet.savedCookingSettings.enabled,
						category: activeTeamSet.savedCookingSettings.category,
					},
				});
			}
		}

		if (activeTeamSet.saveFieldSettings && activeTeamSet.savedFieldSettings) {
			const shouldRestoreField =
				state.bonusSettings.fieldIndex !==
					activeTeamSet.savedFieldSettings.fieldIndex ||
				!areFavoriteTypesEqual(
					state.bonusSettings.favoriteType,
					activeTeamSet.savedFieldSettings.favoriteType,
				);
			if (shouldRestoreField) {
				dispatch({
					type: "setBonusSettings",
					settings: normalizeTimelineBonusSettings({
						...state.bonusSettings,
						fieldIndex: activeTeamSet.savedFieldSettings.fieldIndex,
						favoriteType: activeTeamSet.savedFieldSettings.favoriteType,
					}),
				});
			}
		}
	}, [
		isInitialized,
		state.activeTeamSetIndex,
		state.bonusSettings,
		state.cookingSettings,
		state.teamSets,
	]);

	const handleOpenTimeSlotSettings = useCallback(() => {
		dispatch({ type: "selectTab", tab: "settings" });
		window.setTimeout(() => {
			const timeSlotSection = document.getElementById(
				TIME_SLOT_SETTINGS_SECTION_ID,
			);
			timeSlotSection?.scrollIntoView?.({ behavior: "smooth", block: "start" });
		}, 0);
	}, []);

	// 時間帯操作ハンドラー
	const handleAddTimeSlot = useCallback((slot: TimeSlot) => {
		dispatch({ type: "addTimeSlot", slot });
	}, []);

	const handleUpdateTimeSlot = useCallback((index: number, slot: TimeSlot) => {
		dispatch({ type: "updateTimeSlot", index, slot });
	}, []);

	const handleRemoveTimeSlot = useCallback((index: number) => {
		dispatch({ type: "removeTimeSlot", index });
	}, []);

	const handleResetTimeSlots = useCallback(() => {
		dispatch({ type: "resetTimeSlots" });
	}, []);

	const handleConfigChange = useCallback(
		(config: Partial<SimulationConfig>) => {
			dispatch({ type: "updateSimulationConfig", config });
		},
		[],
	);

	const handleBonusSettingsChange = useCallback(
		(settings: TimelineBonusSettings) => {
			dispatch({ type: "setBonusSettings", settings });
			if (state.syncWithIvParameter) {
				saveTimelineBonusSettingsToIvStorage(settings);
			}
		},
		[state.syncWithIvParameter],
	);

	const handleCookingSettingsChange = useCallback(
		(settings: CookingSimulationSettings) => {
			dispatch({ type: "setCookingSettings", settings });
		},
		[],
	);

	const handleFieldIndexChange = useCallback(
		(fieldIndex: number) => {
			handleBonusSettingsChange(
				normalizeTimelineBonusSettings({
					...state.bonusSettings,
					fieldIndex,
				}),
			);
		},
		[handleBonusSettingsChange, state.bonusSettings],
	);

	const handleGoodCampTicketChange = useCallback(
		(enabled: boolean) => {
			handleBonusSettingsChange(
				normalizeTimelineBonusSettings({
					...state.bonusSettings,
					isGoodCampTicketSet: enabled,
				}),
			);
		},
		[handleBonusSettingsChange, state.bonusSettings],
	);

	const handleCookingSimEnabledChange = useCallback(
		(enabled: boolean) => {
			handleCookingSettingsChange({
				...state.cookingSettings,
				enabled,
			});
		},
		[handleCookingSettingsChange, state.cookingSettings],
	);

	const handleCookingCategoryChange = useCallback(
		(category: CookingSimulationSettings["category"]) => {
			handleCookingSettingsChange({
				...state.cookingSettings,
				category,
			});
		},
		[handleCookingSettingsChange, state.cookingSettings],
	);

	const handleOpenSettingsTab = useCallback(() => {
		dispatch({ type: "selectTab", tab: "settings" });
	}, []);

	const handleSyncWithIvParameterChange = useCallback((enabled: boolean) => {
		dispatch({ type: "setSyncWithIvParameter", enabled });
		if (enabled) {
			dispatch({
				type: "setBonusSettings",
				settings: loadTimelineBonusSettingsFromIvStorage(),
			});
		}
	}, []);

	// ポケモン入れ替えハンドラー
	const handleSwapClick = useCallback(
		(slotId: string, teamIndex: number, dayIndex: number) => {
			dispatch({ type: "openSwapDialog", slotId, teamIndex, dayIndex });
		},
		[],
	);

	const handleNoCollectToggle = useCallback(
		(slotId: string, teamIndex: number, dayIndex: number) => {
			dispatch({ type: "toggleNoCollectCell", slotId, teamIndex, dayIndex });
		},
		[],
	);

	const handleSwapSeriesMove = useCallback(
		(
			fromSlotId: string,
			fromTeamIndex: number,
			fromDayIndex: number,
			toSlotId: string,
			toTeamIndex: number,
			toDayIndex: number,
		) => {
			dispatch({
				type: "moveSwapSeries",
				fromSlotId,
				fromTeamIndex,
				fromDayIndex,
				toSlotId,
				toTeamIndex,
				toDayIndex,
			});
		},
		[],
	);

	const handleSwapRemoveRequest = useCallback(
		(
			slotId: string,
			teamIndex: number,
			dayIndex: number,
			pokemonId: number,
		) => {
			const hasFutureRepeat = state.swaps.some(
				(swap) =>
					swap.slotId === slotId &&
					swap.teamSlotIndex === teamIndex &&
					swap.newPokemonId === pokemonId &&
					swap.dayIndex === dayIndex + 1,
			);
			setPendingSwapRemoval({
				slotId,
				teamIndex,
				dayIndex,
				pokemonId,
				hasFutureRepeat,
			});
			setRemoveFutureRepeatChecked(hasFutureRepeat);
		},
		[state.swaps],
	);

	const handleSwapRemoveCancel = useCallback(() => {
		setPendingSwapRemoval(null);
		setRemoveFutureRepeatChecked(false);
	}, []);

	const handleSwapRemoveConfirm = useCallback(() => {
		if (!pendingSwapRemoval) {
			return;
		}

		dispatch({
			type: "removeSwap",
			slotId: pendingSwapRemoval.slotId,
			teamIndex: pendingSwapRemoval.teamIndex,
			dayIndex: pendingSwapRemoval.dayIndex,
			removeFutureRepeats:
				pendingSwapRemoval.hasFutureRepeat && removeFutureRepeatChecked,
			pokemonId: pendingSwapRemoval.pokemonId,
		});
		setPendingSwapRemoval(null);
		setRemoveFutureRepeatChecked(false);
	}, [pendingSwapRemoval, removeFutureRepeatChecked]);

	const handleSwapPokemonSelect = useCallback((item: PokemonBoxItem) => {
		dispatch({ type: "setPendingSwap", pokemonId: item.id });
	}, []);

	const handleEnergyConfirm = useCallback(
		(energy: number, repeat?: boolean) => {
			dispatch({ type: "confirmSwap", initialEnergy: energy, repeat });
		},
		[],
	);

	const handleEnergyCancel = useCallback(() => {
		dispatch({ type: "closeSwapDialog" });
	}, []);

	// 「なし」: ポケモンなしのswapを直接確定（エネルギーダイアログなし）
	const handleSwapSelectNone = useCallback(() => {
		dispatch({
			type: "confirmSwapDirect",
			pokemonId: SWAP_NONE_POKEMON_ID,
			initialEnergy: 0,
		});
	}, []);

	const handleClearSwaps = useCallback(() => {
		dispatch({ type: "clearSwaps" });
	}, []);

	const handleClearNoCollectCells = useCallback(() => {
		dispatch({ type: "loadNoCollectCells", noCollectCells: [] });
	}, []);

	// ヘルパー関数: 入れ替え対象ポケモンの名前を取得
	const getPendingPokemonName = useCallback((): string => {
		if (!state.pendingSwapPokemonId) return "";
		const pokemon = userBoxRef.current?.items.find(
			(item) => item.id === state.pendingSwapPokemonId,
		);
		return pokemon?.filledNickname(t) || "";
	}, [state.pendingSwapPokemonId, t]);

	// ヘルパー関数: 入れ替え対象ポケモンのidFormを取得
	const getPendingPokemonIdForm = useCallback((): number | undefined => {
		if (!state.pendingSwapPokemonId) return undefined;
		const pokemon = userBoxRef.current?.items.find(
			(item: PokemonBoxItem) => item.id === state.pendingSwapPokemonId,
		);
		if (!pokemon) return undefined;
		return pokemon.iv.idForm;
	}, [state.pendingSwapPokemonId]);

	const disableSwapEnergySetting = useMemo(
		() =>
			isSwapReassignment({
				team: state.team,
				timeSlots: state.timeSlots,
				simulationDays: state.simulationConfig.simulationDays,
				swaps: state.swaps,
				pendingPokemonId: state.pendingSwapPokemonId,
				targetSlotId: state.swapTargetSlotId,
				targetDayIndex: state.swapTargetDayIndex,
			}),
		[
			state.team,
			state.timeSlots,
			state.simulationConfig.simulationDays,
			state.swaps,
			state.pendingSwapPokemonId,
			state.swapTargetSlotId,
			state.swapTargetDayIndex,
		],
	);

	const hasConfiguredSwap = state.swaps.length > 0;

	const appearingTimelineMembers = useMemo(() => {
		if (!timelineRuntimeBoxRef.current) {
			return [];
		}
		return collectAppearingTimelineMembers(
			state.team,
			state.swaps,
			timelineRuntimeBoxRef.current,
		);
	}, [state.team, state.swaps]);

	const timelineDurationSummary = useMemo(
		() =>
			collectTimelineDurationSummaryByPokemon(
				state.team,
				state.timeSlots,
				state.simulationConfig.simulationDays,
				state.swaps,
				timelineRuntimeBoxRef.current ?? undefined,
			),
		[
			state.team,
			state.timeSlots,
			state.simulationConfig.simulationDays,
			state.swaps,
		],
	);
	const swapSupplementSequences = useMemo(
		() =>
			buildSwapSupplementSequences({
				team: state.team,
				swaps: state.swaps,
				timeSlots: state.timeSlots,
				durationSummary: timelineDurationSummary,
				box: timelineRuntimeBoxRef.current ?? undefined,
			}),
		[state.team, state.swaps, state.timeSlots, timelineDurationSummary],
	);
	const activeNoCollectCount = useMemo(
		() => countActiveNoCollectCells(state.noCollectCells, state.swaps),
		[state.noCollectCells, state.swaps],
	);
	const noCollectSupplementEntries = useMemo(
		() =>
			buildNoCollectSupplementEntries({
				team: state.team,
				swaps: state.swaps,
				noCollectCells: state.noCollectCells,
				timeSlots: state.timeSlots,
				simulationDays: state.simulationConfig.simulationDays,
				box: timelineRuntimeBoxRef.current ?? undefined,
			}),
		[
			state.team,
			state.swaps,
			state.noCollectCells,
			state.timeSlots,
			state.simulationConfig.simulationDays,
		],
	);

	const baseSortedSeeds = useMemo(() => {
		if (state.multiTrialResults && state.multiTrialResults.length > 0) {
			return state.multiTrialResults.map((trial) => trial.seed);
		}
		return [state.simulationConfig.seed];
	}, [state.multiTrialResults, state.simulationConfig.seed]);

	const analysisSeeds = useMemo(
		() =>
			analysisQuickModeEnabled
				? pickEveryTenthSeeds(baseSortedSeeds)
				: [...baseSortedSeeds],
		[analysisQuickModeEnabled, baseSortedSeeds],
	);

	const memberDisplayNameById = useMemo(() => {
		const map = new Map<number, string>();
		appearingTimelineMembers.forEach((member) => {
			map.set(member.id, member.filledNickname(t));
		});
		return map;
	}, [appearingTimelineMembers, t]);

	const energySkillTargets = useMemo(
		() =>
			buildEnergySkillContributionTargets(appearingTimelineMembers, {
				team: state.team,
				timeSlots: state.timeSlots,
				simulationDays: state.simulationConfig.simulationDays,
				swaps: state.swaps,
				box: timelineRuntimeBoxRef.current ?? undefined,
			}).map((target) => ({
				...target,
				pokemonName:
					memberDisplayNameById.get(target.pokemonId) ?? target.pokemonName,
			})),
		[
			appearingTimelineMembers,
			memberDisplayNameById,
			state.team,
			state.timeSlots,
			state.simulationConfig.simulationDays,
			state.swaps,
		],
	);

	const hasHelpingBonusMember = useMemo(
		() =>
			appearingTimelineMembers.some((member) =>
				member.iv.activeSubSkills.some(
					(subSkill) => subSkill.name === "Helping Bonus",
				),
			),
		[appearingTimelineMembers],
	);

	const hasEnergyRecoveryBonusMember = useMemo(
		() =>
			appearingTimelineMembers.some((member) =>
				member.iv.activeSubSkills.some(
					(subSkill) => subSkill.name === "Energy Recovery Bonus",
				),
			),
		[appearingTimelineMembers],
	);

	const averageHelpingBonusMemberCount = useMemo(
		() =>
			collectAverageHelpingBonusMemberCountByDuration(
				state.team,
				state.timeSlots,
				state.simulationConfig.simulationDays,
				state.swaps,
				timelineRuntimeBoxRef.current ?? undefined,
			),
		[
			state.team,
			state.timeSlots,
			state.simulationConfig.simulationDays,
			state.swaps,
		],
	);

	const averageEnergyRecoveryBonusMemberCount = useMemo(
		() =>
			collectAverageEnergyRecoveryBonusMemberCountByDuration(
				state.team,
				state.timeSlots,
				state.simulationConfig.simulationDays,
				state.swaps,
				timelineRuntimeBoxRef.current ?? undefined,
			),
		[
			state.team,
			state.timeSlots,
			state.simulationConfig.simulationDays,
			state.swaps,
		],
	);

	const wakeErbMemberCountRange = useMemo(
		() =>
			collectWakeErbMemberCountRange(
				state.team,
				state.timeSlots,
				state.simulationConfig.simulationDays,
				state.swaps,
				timelineRuntimeBoxRef.current ?? undefined,
			),
		[
			state.team,
			state.timeSlots,
			state.simulationConfig.simulationDays,
			state.swaps,
		],
	);

	const baseAverageMetricsFromSimulation =
		useMemo<AnalysisAverageMetrics | null>(() => {
			if (!state.simulationResult) {
				return null;
			}
			if (
				state.multiTrialResults !== null &&
				state.multiTrialResults.length > 0 &&
				state.multiTrialAverageDailySummaries !== null &&
				state.multiTrialAverageTeamSummary !== null
			) {
				return buildAverageMetricsFromSummaries(
					state.multiTrialAverageTeamSummary.grandTotalEP,
					state.multiTrialAverageDailySummaries,
					state.multiTrialResults.length,
				);
			}
			return buildAverageMetricsFromSummaries(
				state.simulationResult.teamSummary.grandTotalEP,
				state.simulationResult.dailySummaries,
				1,
			);
		}, [
			state.simulationResult,
			state.multiTrialResults,
			state.multiTrialAverageDailySummaries,
			state.multiTrialAverageTeamSummary,
		]);

	const baseAverageMetrics = useMemo(
		() =>
			resolvePrecomputedBaseAverageMetrics(
				baseAverageMetricsCache,
				analysisQuickModeEnabled,
				baseAverageMetricsFromSimulation,
			),
		[
			analysisQuickModeEnabled,
			baseAverageMetricsCache,
			baseAverageMetricsFromSimulation,
		],
	);
	const hasResolvedBaseMetrics = baseAverageMetrics !== null;

	const runAverageMetricsWithSeeds = useCallback(
		async (
			options: {
				disabledPokemonIds?: readonly number[];
				suppressEnergyDeltaSkillPokemonIds?: readonly number[];
				disableEnergyRecoveryBonus?: boolean;
				disableHelpingBonus?: boolean;
			},
			onProgress?: (progress: number) => void,
			shouldAbort?: () => boolean,
		): Promise<AnalysisAverageMetrics> => {
			const totalEPByPokemonId = new Map<number, number>();
			const totalHelpByPokemonId = new Map<number, number>();
			let totalTeamEP = 0;
			let totalTeamHelpCount = 0;
			let lastProgressUpdateAt = 0;
			let lastEmittedProgress = 0;
			const throwIfAborted = (): void => {
				if (shouldAbort?.()) {
					throw createAbortError();
				}
			};

			const emitProgress = async (
				progress: number,
				force = false,
			): Promise<void> => {
				throwIfAborted();
				if (!onProgress) {
					return;
				}
				const normalizedProgress = Math.max(
					lastEmittedProgress,
					Math.max(0, Math.min(100, progress)),
				);
				const now = Date.now();
				if (
					!force &&
					now - lastProgressUpdateAt < ANALYSIS_PROGRESS_UPDATE_INTERVAL_MS
				) {
					return;
				}
				onProgress(normalizedProgress);
				lastEmittedProgress = normalizedProgress;
				lastProgressUpdateAt = now;
				// Yield only when we actually update progress UI.
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
				throwIfAborted();
			};

			throwIfAborted();
			const trialCount = Math.max(analysisSeeds.length, 1);
			for (let index = 0; index < analysisSeeds.length; index += 1) {
				throwIfAborted();
				const seed = analysisSeeds[index];
				const result = runSimulation({
					team: state.team,
					timeSlots: state.timeSlots,
					config: {
						seed,
						initialEnergy: state.simulationConfig.initialEnergy,
						simulationDays: state.simulationConfig.simulationDays,
					},
					bonusSettings: state.bonusSettings,
					swaps: state.swaps,
					noCollectCells: state.noCollectCells,
					box: timelineRuntimeBoxRef.current || undefined,
					cookingSettings: state.cookingSettings,
					analysisOptions: {
						disabledPokemonIds: options.disabledPokemonIds,
						keepDisabledPokemonTargetable: true,
						suppressEnergyDeltaSkillPokemonIds:
							options.suppressEnergyDeltaSkillPokemonIds,
						disableEnergyRecoveryBonus: options.disableEnergyRecoveryBonus,
						disableHelpingBonus: options.disableHelpingBonus,
					},
				});

				totalTeamEP += result.teamSummary.grandTotalEP;
				let trialTeamHelpCount = 0;
				result.dailySummaries.forEach((summary) => {
					totalEPByPokemonId.set(
						summary.pokemonId,
						(totalEPByPokemonId.get(summary.pokemonId) ?? 0) + summary.totalEP,
					);
					trialTeamHelpCount += summary.totalHelpCount;
					totalHelpByPokemonId.set(
						summary.pokemonId,
						(totalHelpByPokemonId.get(summary.pokemonId) ?? 0) +
							summary.totalHelpCount,
					);
				});
				totalTeamHelpCount += trialTeamHelpCount;
				await emitProgress(
					((index + 1) / trialCount) * 100,
					index + 1 === analysisSeeds.length,
				);
			}

			throwIfAborted();
			if (analysisSeeds.length === 0) {
				await emitProgress(100, true);
			}

			const divisor = trialCount;
			const averageEPByPokemonId = new Map<number, number>();
			totalEPByPokemonId.forEach((total, pokemonId) => {
				averageEPByPokemonId.set(pokemonId, total / divisor);
			});
			const averageHelpByPokemonId = new Map<number, number>();
			totalHelpByPokemonId.forEach((total, pokemonId) => {
				averageHelpByPokemonId.set(pokemonId, total / divisor);
			});
			throwIfAborted();

			return {
				averageTeamEP: totalTeamEP / divisor,
				averageTeamHelpCount: totalTeamHelpCount / divisor,
				averageEPByPokemonId,
				averageHelpByPokemonId,
				trialCount: divisor,
			};
		},
		[
			analysisSeeds,
			state.team,
			state.timeSlots,
			state.simulationConfig.initialEnergy,
			state.simulationConfig.simulationDays,
			state.bonusSettings,
			state.swaps,
			state.noCollectCells,
			state.cookingSettings,
		],
	);

	const resolveBaseAverageMetrics = useCallback(
		async (
			onProgress?: (progress: number) => void,
			shouldAbort?: () => boolean,
		): Promise<AnalysisAverageMetrics> => {
			if (shouldAbort?.()) {
				throw createAbortError();
			}
			if (baseAverageMetrics) {
				onProgress?.(100);
				return baseAverageMetrics;
			}
			const computed = await runAverageMetricsWithSeeds(
				{},
				onProgress,
				shouldAbort,
			);
			if (shouldAbort?.()) {
				throw createAbortError();
			}
			setBaseAverageMetricsCache({
				quickModeEnabled: analysisQuickModeEnabled,
				metrics: computed,
			});
			return computed;
		},
		[analysisQuickModeEnabled, baseAverageMetrics, runAverageMetricsWithSeeds],
	);

	const runContributionAnalysis = useCallback(
		(pokemon: PokemonBoxItem) => {
			if (!state.simulationResult) {
				return;
			}
			if (cancelRunningAnalysisIfAny()) {
				return;
			}
			const runVersion = analysisRunVersionRef.current;
			const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
			setAnalysisError(null);
			setContributionLoadingIds((prev) => {
				const next = new Set(prev);
				next.add(pokemon.id);
				return next;
			});
			setContributionProgressById((prev) => {
				const next = new Map(prev);
				next.set(pokemon.id, 0);
				return next;
			});
			setTimeout(() => {
				void (async () => {
					const seedUnitCount = Math.max(analysisSeeds.length, 1);
					const hasBaseMetrics = hasResolvedBaseMetrics;
					const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
					let processedUnits = 0;
					const updateContributionProgress = (nextProgress: number): void => {
						const clamped = Math.max(0, Math.min(100, nextProgress));
						setContributionProgressById((prev) => {
							const current = prev.get(pokemon.id) ?? 0;
							if (clamped <= current) {
								return prev;
							}
							const next = new Map(prev);
							next.set(pokemon.id, clamped);
							return next;
						});
					};
					try {
						const baseMetrics = await resolveBaseAverageMetrics(
							hasBaseMetrics
								? undefined
								: (baseProgress) => {
										if (shouldAbort()) {
											return;
										}
										updateContributionProgress(
											(((baseProgress / 100) * seedUnitCount) / totalUnits) *
												100,
										);
									},
							shouldAbort,
						);
						if (shouldAbort()) {
							throw createAbortError();
						}
						if (!hasBaseMetrics) {
							processedUnits += seedUnitCount;
						}
						const scenarioMetrics = await runAverageMetricsWithSeeds(
							{
								disabledPokemonIds: [pokemon.id],
							},
							(scenarioProgress) => {
								if (shouldAbort()) {
									return;
								}
								const progress =
									((processedUnits + (scenarioProgress / 100) * seedUnitCount) /
										totalUnits) *
									100;
								updateContributionProgress(progress);
							},
							shouldAbort,
						);
						if (shouldAbort()) {
							throw createAbortError();
						}
						const analysisResult: ContributionEpAnalysisResult = {
							pokemonId: pokemon.id,
							pokemonName: pokemon.filledNickname(t),
							baseTeamEP: baseMetrics.averageTeamEP,
							scenarioTeamEP: scenarioMetrics.averageTeamEP,
							deltaEP:
								scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
							deltaPercent: calculateDeltaPercent(
								baseMetrics.averageTeamEP,
								scenarioMetrics.averageTeamEP,
							),
						};
						setContributionResults((prev) => {
							const next = new Map(prev);
							next.set(pokemon.id, analysisResult);
							return next;
						});
					} catch (e) {
						if (!isAbortError(e)) {
							setAnalysisError(String(e));
						}
					} finally {
						if (!shouldAbort()) {
							setContributionLoadingIds((prev) => {
								const next = new Set(prev);
								next.delete(pokemon.id);
								return next;
							});
							setContributionProgressById((prev) => {
								const next = new Map(prev);
								next.set(pokemon.id, 100);
								return next;
							});
						}
					}
				})();
			}, 0);
		},
		[
			cancelRunningAnalysisIfAny,
			analysisSeeds.length,
			hasResolvedBaseMetrics,
			resolveBaseAverageMetrics,
			runAverageMetricsWithSeeds,
			state.simulationResult,
			t,
		],
	);

	const runContributionAnalysisAll = useCallback(() => {
		if (!state.simulationResult || appearingTimelineMembers.length === 0) {
			return;
		}
		if (cancelRunningAnalysisIfAny()) {
			return;
		}
		const runVersion = analysisRunVersionRef.current;
		const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
		setAnalysisError(null);
		setContributionBatchLoading(true);
		setContributionBatchProgress(0);
		setContributionProgressById(new Map());
		setTimeout(() => {
			void (async () => {
				const seedUnitCount = Math.max(analysisSeeds.length, 1);
				const hasBaseMetrics = hasResolvedBaseMetrics;
				const totalUnits =
					seedUnitCount *
					(appearingTimelineMembers.length + (hasBaseMetrics ? 0 : 1));
				let processedUnits = 0;
				const updateBatchProgress = (nextProgress: number): void => {
					const clamped = Math.max(0, Math.min(100, nextProgress));
					setContributionBatchProgress((prev) => Math.max(prev, clamped));
				};
				const updateMemberProgress = (
					pokemonId: number,
					nextProgress: number,
				): void => {
					const clamped = Math.max(0, Math.min(100, nextProgress));
					setContributionProgressById((prev) => {
						const current = prev.get(pokemonId) ?? 0;
						if (clamped <= current) {
							return prev;
						}
						const next = new Map(prev);
						next.set(pokemonId, clamped);
						return next;
					});
				};
				try {
					const baseMetrics = await resolveBaseAverageMetrics(
						hasBaseMetrics
							? undefined
							: (baseProgress) => {
									if (shouldAbort()) {
										return;
									}
									const progress =
										(((baseProgress / 100) * seedUnitCount) / totalUnits) * 100;
									updateBatchProgress(progress);
								},
						shouldAbort,
					);
					if (shouldAbort()) {
						throw createAbortError();
					}
					if (!hasBaseMetrics) {
						processedUnits += seedUnitCount;
					}
					for (
						let index = 0;
						index < appearingTimelineMembers.length;
						index += 1
					) {
						if (shouldAbort()) {
							throw createAbortError();
						}
						const pokemon = appearingTimelineMembers[index];
						updateMemberProgress(pokemon.id, 1);
						const scenarioMetrics = await runAverageMetricsWithSeeds(
							{
								disabledPokemonIds: [pokemon.id],
							},
							(scenarioProgress) => {
								if (shouldAbort()) {
									return;
								}
								const progress =
									((processedUnits + (scenarioProgress / 100) * seedUnitCount) /
										totalUnits) *
									100;
								updateBatchProgress(progress);
								updateMemberProgress(pokemon.id, Math.max(1, scenarioProgress));
							},
							shouldAbort,
						);
						if (shouldAbort()) {
							throw createAbortError();
						}
						const nextResult: ContributionEpAnalysisResult = {
							pokemonId: pokemon.id,
							pokemonName: pokemon.filledNickname(t),
							baseTeamEP: baseMetrics.averageTeamEP,
							scenarioTeamEP: scenarioMetrics.averageTeamEP,
							deltaEP:
								scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
							deltaPercent: calculateDeltaPercent(
								baseMetrics.averageTeamEP,
								scenarioMetrics.averageTeamEP,
							),
						};
						setContributionResults((prev) => {
							const next = new Map(prev);
							next.set(pokemon.id, nextResult);
							return next;
						});
						updateMemberProgress(pokemon.id, 100);
						processedUnits += seedUnitCount;
					}
				} catch (e) {
					if (!isAbortError(e)) {
						setAnalysisError(String(e));
					}
				} finally {
					if (!shouldAbort()) {
						setContributionBatchLoading(false);
						setContributionBatchProgress(0);
					}
				}
			})();
		}, 0);
	}, [
		cancelRunningAnalysisIfAny,
		analysisSeeds.length,
		hasResolvedBaseMetrics,
		appearingTimelineMembers,
		resolveBaseAverageMetrics,
		runAverageMetricsWithSeeds,
		state.simulationResult,
		t,
	]);

	const runEnergySkillAnalysis = useCallback(
		(target: EnergySkillContributionTarget) => {
			if (!state.simulationResult) {
				return;
			}
			if (cancelRunningAnalysisIfAny()) {
				return;
			}
			const runVersion = analysisRunVersionRef.current;
			const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
			setAnalysisError(null);
			setEnergySkillLoadingIds((prev) => {
				const next = new Set(prev);
				next.add(target.pokemonId);
				return next;
			});
			setEnergySkillProgressById((prev) => {
				const next = new Map(prev);
				next.set(target.pokemonId, 0);
				return next;
			});
			setTimeout(() => {
				void (async () => {
					const seedUnitCount = Math.max(analysisSeeds.length, 1);
					const hasBaseMetrics = hasResolvedBaseMetrics;
					const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
					let processedUnits = 0;
					const updateEnergySkillProgress = (nextProgress: number): void => {
						const clamped = Math.max(0, Math.min(100, nextProgress));
						setEnergySkillProgressById((prev) => {
							const current = prev.get(target.pokemonId) ?? 0;
							if (clamped <= current) {
								return prev;
							}
							const next = new Map(prev);
							next.set(target.pokemonId, clamped);
							return next;
						});
					};
					try {
						const baseMetrics = await resolveBaseAverageMetrics(
							hasBaseMetrics
								? undefined
								: (baseProgress) => {
										if (shouldAbort()) {
											return;
										}
										updateEnergySkillProgress(
											(((baseProgress / 100) * seedUnitCount) / totalUnits) *
												100,
										);
									},
							shouldAbort,
						);
						if (shouldAbort()) {
							throw createAbortError();
						}
						if (!hasBaseMetrics) {
							processedUnits += seedUnitCount;
						}
						const scenarioMetrics = await runAverageMetricsWithSeeds(
							{
								suppressEnergyDeltaSkillPokemonIds: [target.pokemonId],
							},
							(scenarioProgress) => {
								if (shouldAbort()) {
									return;
								}
								const progress =
									((processedUnits + (scenarioProgress / 100) * seedUnitCount) /
										totalUnits) *
									100;
								updateEnergySkillProgress(progress);
							},
							shouldAbort,
						);
						if (shouldAbort()) {
							throw createAbortError();
						}
						const baseSelfEP =
							baseMetrics.averageEPByPokemonId.get(target.pokemonId) ?? 0;
						const scenarioSelfEP =
							scenarioMetrics.averageEPByPokemonId.get(target.pokemonId) ?? 0;
						const baseSelfHelpCount =
							baseMetrics.averageHelpByPokemonId.get(target.pokemonId) ?? 0;
						const scenarioSelfHelpCount =
							scenarioMetrics.averageHelpByPokemonId.get(target.pokemonId) ?? 0;
						const analysisResult: EnergySkillContributionResult = {
							pokemonId: target.pokemonId,
							pokemonName: target.pokemonName,
							skillName: target.skillName,
							category: target.category,
							baseSelfEP,
							scenarioSelfEP,
							selfDeltaEP: scenarioSelfEP - baseSelfEP,
							selfDeltaPercent: calculateDeltaPercent(
								baseSelfEP,
								scenarioSelfEP,
							),
							baseTeamEP: baseMetrics.averageTeamEP,
							scenarioTeamEP: scenarioMetrics.averageTeamEP,
							teamDeltaEP:
								scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
							teamDeltaPercent: calculateDeltaPercent(
								baseMetrics.averageTeamEP,
								scenarioMetrics.averageTeamEP,
							),
							baseSelfHelpCount,
							scenarioSelfHelpCount,
							baseTeamHelpCount: baseMetrics.averageTeamHelpCount,
							scenarioTeamHelpCount: scenarioMetrics.averageTeamHelpCount,
						};
						setEnergySkillResults((prev) => {
							const next = new Map(prev);
							next.set(target.pokemonId, analysisResult);
							return next;
						});
					} catch (e) {
						if (!isAbortError(e)) {
							setAnalysisError(String(e));
						}
					} finally {
						if (!shouldAbort()) {
							setEnergySkillLoadingIds((prev) => {
								const next = new Set(prev);
								next.delete(target.pokemonId);
								return next;
							});
							setEnergySkillProgressById((prev) => {
								const next = new Map(prev);
								next.set(target.pokemonId, 100);
								return next;
							});
						}
					}
				})();
			}, 0);
		},
		[
			cancelRunningAnalysisIfAny,
			analysisSeeds.length,
			hasResolvedBaseMetrics,
			resolveBaseAverageMetrics,
			runAverageMetricsWithSeeds,
			state.simulationResult,
		],
	);

	const runEnergySkillAnalysisAll = useCallback(() => {
		if (!state.simulationResult || energySkillTargets.length === 0) {
			return;
		}
		if (cancelRunningAnalysisIfAny()) {
			return;
		}
		const runVersion = analysisRunVersionRef.current;
		const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
		setAnalysisError(null);
		setEnergySkillBatchLoading(true);
		setEnergySkillBatchProgress(0);
		setEnergySkillProgressById(new Map());
		const shouldRunTeamOverall = energySkillTargets.length >= 2;
		if (shouldRunTeamOverall) {
			setEnergySkillTeamResult(null);
			setEnergySkillTeamLoading(true);
			setEnergySkillTeamProgress(0);
		}
		setTimeout(() => {
			void (async () => {
				const seedUnitCount = Math.max(analysisSeeds.length, 1);
				const hasBaseMetrics = hasResolvedBaseMetrics;
				const scenarioUnitCount =
					energySkillTargets.length + (shouldRunTeamOverall ? 1 : 0);
				const totalUnits =
					seedUnitCount * (scenarioUnitCount + (hasBaseMetrics ? 0 : 1));
				let processedUnits = 0;
				const updateBatchProgress = (nextProgress: number): void => {
					const clamped = Math.max(0, Math.min(100, nextProgress));
					setEnergySkillBatchProgress((prev) => Math.max(prev, clamped));
				};
				const updateTeamProgress = (nextProgress: number): void => {
					if (!shouldRunTeamOverall) {
						return;
					}
					const clamped = Math.max(0, Math.min(100, nextProgress));
					setEnergySkillTeamProgress((prev) => Math.max(prev, clamped));
				};
				const updateMemberProgress = (
					pokemonId: number,
					nextProgress: number,
				): void => {
					const clamped = Math.max(0, Math.min(100, nextProgress));
					setEnergySkillProgressById((prev) => {
						const current = prev.get(pokemonId) ?? 0;
						if (clamped <= current) {
							return prev;
						}
						const next = new Map(prev);
						next.set(pokemonId, clamped);
						return next;
					});
				};
				try {
					const baseMetrics = await resolveBaseAverageMetrics(
						hasBaseMetrics
							? undefined
							: (baseProgress) => {
									if (shouldAbort()) {
										return;
									}
									const progress =
										(((baseProgress / 100) * seedUnitCount) / totalUnits) * 100;
									updateBatchProgress(progress);
								},
						shouldAbort,
					);
					if (shouldAbort()) {
						throw createAbortError();
					}
					if (!hasBaseMetrics) {
						processedUnits += seedUnitCount;
					}
					for (let index = 0; index < energySkillTargets.length; index += 1) {
						if (shouldAbort()) {
							throw createAbortError();
						}
						const target = energySkillTargets[index];
						updateMemberProgress(target.pokemonId, 1);
						const scenarioMetrics = await runAverageMetricsWithSeeds(
							{
								suppressEnergyDeltaSkillPokemonIds: [target.pokemonId],
							},
							(scenarioProgress) => {
								if (shouldAbort()) {
									return;
								}
								const progress =
									((processedUnits + (scenarioProgress / 100) * seedUnitCount) /
										totalUnits) *
									100;
								updateBatchProgress(progress);
								updateMemberProgress(
									target.pokemonId,
									Math.max(1, scenarioProgress),
								);
							},
							shouldAbort,
						);
						if (shouldAbort()) {
							throw createAbortError();
						}
						const baseSelfEP =
							baseMetrics.averageEPByPokemonId.get(target.pokemonId) ?? 0;
						const scenarioSelfEP =
							scenarioMetrics.averageEPByPokemonId.get(target.pokemonId) ?? 0;
						const baseSelfHelpCount =
							baseMetrics.averageHelpByPokemonId.get(target.pokemonId) ?? 0;
						const scenarioSelfHelpCount =
							scenarioMetrics.averageHelpByPokemonId.get(target.pokemonId) ?? 0;
						const nextResult: EnergySkillContributionResult = {
							pokemonId: target.pokemonId,
							pokemonName: target.pokemonName,
							skillName: target.skillName,
							category: target.category,
							baseSelfEP,
							scenarioSelfEP,
							selfDeltaEP: scenarioSelfEP - baseSelfEP,
							selfDeltaPercent: calculateDeltaPercent(
								baseSelfEP,
								scenarioSelfEP,
							),
							baseTeamEP: baseMetrics.averageTeamEP,
							scenarioTeamEP: scenarioMetrics.averageTeamEP,
							teamDeltaEP:
								scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
							teamDeltaPercent: calculateDeltaPercent(
								baseMetrics.averageTeamEP,
								scenarioMetrics.averageTeamEP,
							),
							baseSelfHelpCount,
							scenarioSelfHelpCount,
							baseTeamHelpCount: baseMetrics.averageTeamHelpCount,
							scenarioTeamHelpCount: scenarioMetrics.averageTeamHelpCount,
						};
						setEnergySkillResults((prev) => {
							const next = new Map(prev);
							next.set(target.pokemonId, nextResult);
							return next;
						});
						updateMemberProgress(target.pokemonId, 100);
						processedUnits += seedUnitCount;
					}
					if (shouldRunTeamOverall) {
						const allEnergySkillIds = energySkillTargets.map(
							(target) => target.pokemonId,
						);
						const scenarioMetrics = await runAverageMetricsWithSeeds(
							{
								suppressEnergyDeltaSkillPokemonIds: allEnergySkillIds,
							},
							(scenarioProgress) => {
								if (shouldAbort()) {
									return;
								}
								const progress =
									((processedUnits + (scenarioProgress / 100) * seedUnitCount) /
										totalUnits) *
									100;
								updateBatchProgress(progress);
								updateTeamProgress(scenarioProgress);
							},
							shouldAbort,
						);
						if (shouldAbort()) {
							throw createAbortError();
						}
						setEnergySkillTeamResult({
							baseTeamEP: baseMetrics.averageTeamEP,
							scenarioTeamEP: scenarioMetrics.averageTeamEP,
							teamDeltaEP:
								scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
							teamDeltaPercent: calculateDeltaPercent(
								baseMetrics.averageTeamEP,
								scenarioMetrics.averageTeamEP,
							),
						});
						updateTeamProgress(100);
						processedUnits += seedUnitCount;
					}
				} catch (e) {
					if (!isAbortError(e)) {
						setAnalysisError(String(e));
					}
				} finally {
					if (!shouldAbort()) {
						setEnergySkillBatchLoading(false);
						setEnergySkillBatchProgress(0);
						if (shouldRunTeamOverall) {
							setEnergySkillTeamLoading(false);
							setEnergySkillTeamProgress(0);
						}
					}
				}
			})();
		}, 0);
	}, [
		cancelRunningAnalysisIfAny,
		analysisSeeds.length,
		hasResolvedBaseMetrics,
		energySkillTargets,
		resolveBaseAverageMetrics,
		runAverageMetricsWithSeeds,
		state.simulationResult,
	]);

	const runEnergySkillTeamAnalysis = useCallback(() => {
		if (!state.simulationResult || energySkillTargets.length < 2) {
			return;
		}
		if (cancelRunningAnalysisIfAny()) {
			return;
		}
		const runVersion = analysisRunVersionRef.current;
		const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
		setAnalysisError(null);
		setEnergySkillTeamLoading(true);
		setEnergySkillTeamProgress(0);
		setTimeout(() => {
			void (async () => {
				const seedUnitCount = Math.max(analysisSeeds.length, 1);
				const hasBaseMetrics = hasResolvedBaseMetrics;
				const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
				let processedUnits = 0;
				const updateTeamProgress = (nextProgress: number): void => {
					const clamped = Math.max(0, Math.min(100, nextProgress));
					setEnergySkillTeamProgress((prev) => Math.max(prev, clamped));
				};
				try {
					const baseMetrics = await resolveBaseAverageMetrics(
						hasBaseMetrics
							? undefined
							: (baseProgress) => {
									if (shouldAbort()) {
										return;
									}
									updateTeamProgress(
										(((baseProgress / 100) * seedUnitCount) / totalUnits) * 100,
									);
								},
						shouldAbort,
					);
					if (shouldAbort()) {
						throw createAbortError();
					}
					if (!hasBaseMetrics) {
						processedUnits += seedUnitCount;
					}
					const scenarioMetrics = await runAverageMetricsWithSeeds(
						{
							suppressEnergyDeltaSkillPokemonIds: energySkillTargets.map(
								(target) => target.pokemonId,
							),
						},
						(scenarioProgress) => {
							if (shouldAbort()) {
								return;
							}
							const progress =
								((processedUnits + (scenarioProgress / 100) * seedUnitCount) /
									totalUnits) *
								100;
							updateTeamProgress(progress);
						},
						shouldAbort,
					);
					if (shouldAbort()) {
						throw createAbortError();
					}
					setEnergySkillTeamResult({
						baseTeamEP: baseMetrics.averageTeamEP,
						scenarioTeamEP: scenarioMetrics.averageTeamEP,
						teamDeltaEP:
							scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
						teamDeltaPercent: calculateDeltaPercent(
							baseMetrics.averageTeamEP,
							scenarioMetrics.averageTeamEP,
						),
					});
				} catch (e) {
					if (!isAbortError(e)) {
						setAnalysisError(String(e));
					}
				} finally {
					if (!shouldAbort()) {
						setEnergySkillTeamLoading(false);
						setEnergySkillTeamProgress(0);
					}
				}
			})();
		}, 0);
	}, [
		cancelRunningAnalysisIfAny,
		analysisSeeds.length,
		hasResolvedBaseMetrics,
		energySkillTargets,
		resolveBaseAverageMetrics,
		runAverageMetricsWithSeeds,
		state.simulationResult,
	]);

	const runHelpingBonusAnalysis = useCallback(() => {
		if (!state.simulationResult || !hasHelpingBonusMember) {
			return;
		}
		if (cancelRunningAnalysisIfAny()) {
			return;
		}
		const runVersion = analysisRunVersionRef.current;
		const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
		setAnalysisError(null);
		setHelpingBonusLoading(true);
		setHelpingBonusProgress(0);
		setTimeout(() => {
			void (async () => {
				const seedUnitCount = Math.max(analysisSeeds.length, 1);
				const hasBaseMetrics = hasResolvedBaseMetrics;
				const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
				let processedUnits = 0;
				const updateHelpingBonusProgress = (nextProgress: number): void => {
					const clamped = Math.max(0, Math.min(100, nextProgress));
					setHelpingBonusProgress((prev) => Math.max(prev, clamped));
				};
				try {
					const baseMetrics = await resolveBaseAverageMetrics(
						hasBaseMetrics
							? undefined
							: (baseProgress) => {
									if (shouldAbort()) {
										return;
									}
									updateHelpingBonusProgress(
										(((baseProgress / 100) * seedUnitCount) / totalUnits) * 100,
									);
								},
						shouldAbort,
					);
					if (shouldAbort()) {
						throw createAbortError();
					}
					if (!hasBaseMetrics) {
						processedUnits += seedUnitCount;
					}
					const scenarioMetrics = await runAverageMetricsWithSeeds(
						{
							disableHelpingBonus: true,
						},
						(scenarioProgress) => {
							if (shouldAbort()) {
								return;
							}
							const progress =
								((processedUnits + (scenarioProgress / 100) * seedUnitCount) /
									totalUnits) *
								100;
							updateHelpingBonusProgress(progress);
						},
						shouldAbort,
					);
					if (shouldAbort()) {
						throw createAbortError();
					}
					setHelpingBonusResult({
						baseTeamEP: baseMetrics.averageTeamEP,
						scenarioTeamEP: scenarioMetrics.averageTeamEP,
						teamDeltaEP:
							scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
						teamDeltaPercent: calculateDeltaPercent(
							baseMetrics.averageTeamEP,
							scenarioMetrics.averageTeamEP,
						),
					});
				} catch (e) {
					if (!isAbortError(e)) {
						setAnalysisError(String(e));
					}
				} finally {
					if (!shouldAbort()) {
						setHelpingBonusLoading(false);
						setHelpingBonusProgress(0);
					}
				}
			})();
		}, 0);
	}, [
		cancelRunningAnalysisIfAny,
		analysisSeeds.length,
		hasResolvedBaseMetrics,
		hasHelpingBonusMember,
		resolveBaseAverageMetrics,
		runAverageMetricsWithSeeds,
		state.simulationResult,
	]);

	const runEnergyRecoveryBonusAnalysis = useCallback(() => {
		if (!state.simulationResult || !hasEnergyRecoveryBonusMember) {
			return;
		}
		if (cancelRunningAnalysisIfAny()) {
			return;
		}
		const runVersion = analysisRunVersionRef.current;
		const shouldAbort = () => analysisRunVersionRef.current !== runVersion;
		setAnalysisError(null);
		setEnergyRecoveryBonusLoading(true);
		setEnergyRecoveryBonusProgress(0);
		setTimeout(() => {
			void (async () => {
				const seedUnitCount = Math.max(analysisSeeds.length, 1);
				const hasBaseMetrics = hasResolvedBaseMetrics;
				const totalUnits = seedUnitCount * (hasBaseMetrics ? 1 : 2);
				let processedUnits = 0;
				const updateErbProgress = (nextProgress: number): void => {
					const clamped = Math.max(0, Math.min(100, nextProgress));
					setEnergyRecoveryBonusProgress((prev) => Math.max(prev, clamped));
				};
				try {
					const baseMetrics = await resolveBaseAverageMetrics(
						hasBaseMetrics
							? undefined
							: (baseProgress) => {
									if (shouldAbort()) {
										return;
									}
									updateErbProgress(
										(((baseProgress / 100) * seedUnitCount) / totalUnits) * 100,
									);
								},
						shouldAbort,
					);
					if (shouldAbort()) {
						throw createAbortError();
					}
					if (!hasBaseMetrics) {
						processedUnits += seedUnitCount;
					}
					const scenarioMetrics = await runAverageMetricsWithSeeds(
						{
							disableEnergyRecoveryBonus: true,
						},
						(scenarioProgress) => {
							if (shouldAbort()) {
								return;
							}
							const progress =
								((processedUnits + (scenarioProgress / 100) * seedUnitCount) /
									totalUnits) *
								100;
							updateErbProgress(progress);
						},
						shouldAbort,
					);
					if (shouldAbort()) {
						throw createAbortError();
					}
					setEnergyRecoveryBonusResult({
						baseTeamEP: baseMetrics.averageTeamEP,
						scenarioTeamEP: scenarioMetrics.averageTeamEP,
						teamDeltaEP:
							scenarioMetrics.averageTeamEP - baseMetrics.averageTeamEP,
						teamDeltaPercent: calculateDeltaPercent(
							baseMetrics.averageTeamEP,
							scenarioMetrics.averageTeamEP,
						),
						wakeErbMemberCountMin: wakeErbMemberCountRange.minCount,
						wakeErbMemberCountMax: wakeErbMemberCountRange.maxCount,
						wakeSlotCount: wakeErbMemberCountRange.slotCount,
					});
				} catch (e) {
					if (!isAbortError(e)) {
						setAnalysisError(String(e));
					}
				} finally {
					if (!shouldAbort()) {
						setEnergyRecoveryBonusLoading(false);
						setEnergyRecoveryBonusProgress(0);
					}
				}
			})();
		}, 0);
	}, [
		cancelRunningAnalysisIfAny,
		analysisSeeds.length,
		hasResolvedBaseMetrics,
		hasEnergyRecoveryBonusMember,
		resolveBaseAverageMetrics,
		runAverageMetricsWithSeeds,
		state.simulationResult,
		wakeErbMemberCountRange,
	]);

	useEffect(() => {
		resetAdditionalAnalysisState();
	}, [resetAdditionalAnalysisState]);

	const showSummaryValueToggle = state.simulationConfig.simulationDays >= 2;
	const showAdditionalAnalysis = shouldShowAdditionalAnalysisPanel(
		state.simulationResult,
		state.simulationLoading,
	);
	const skipTeamResultEntryAnimation = shouldSkipTeamResultEntryAnimation(
		previousActiveTabRef.current,
		state.activeTab,
	);
	const showSimulationDetails = state.simulationResult !== null;
	const showPreSimulationTimeline = state.simulationResult === null;
	const simulationResult = state.simulationResult;
	const averageDailySummaries = state.multiTrialAverageDailySummaries;
	const averageTeamSummary = state.multiTrialAverageTeamSummary;
	const showAverageSection = useMemo(
		() =>
			state.multiTrialResults !== null &&
			state.multiTrialResults.length > 1 &&
			state.multiTrialAverageDailySummaries !== null &&
			state.multiTrialAverageTeamSummary !== null,
		[
			state.multiTrialResults,
			state.multiTrialAverageDailySummaries,
			state.multiTrialAverageTeamSummary,
		],
	);
	const showPostSimulationInsights =
		showAverageSection || showAdditionalAnalysis;

	return (
		<div
			style={{
				margin: "0 0.5rem",
				paddingBottom: TIMELINE_PAGE_BOTTOM_PADDING,
			}}
		>
			{/* タブUI */}
			<Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
				<Tabs value={state.activeTab} onChange={handleTabChange}>
					<Tab
						label={t("TeamTimeline.tab simulation", "シミュレーション")}
						value="team"
					/>
					<Tab
						label={t("TeamTimeline.tab basic settings", "基本設定")}
						value="settings"
					/>
					<Tab
						label={t("TeamTimeline.tab cooking settings", "料理設定")}
						value="cooking"
					/>
				</Tabs>
			</Box>

			{/* チームタブ */}
			{state.activeTab === "team" && (
				<Box
					sx={{
						width: "100%",
						maxWidth: `${TEAM_TIMELINE_CONTENT_WIDTH_PX}px`,
					}}
				>
					<Box
						sx={{
							transform: `scale(${teamScale})`,
							transformOrigin: "top left",
							width: "100%",
						}}
					>
						<TeamSetToolbar
							teamSets={state.teamSets}
							activeTeamSetIndex={state.activeTeamSetIndex}
							currentSimulationContextHash={currentSimulationContextHash}
							onSaveSettings={handleTeamSetSaveSettings}
							onCreate={handleTeamSetCreate}
							onDuplicateAt={handleTeamSetDuplicateAt}
							onDeleteAt={handleTeamSetDeleteAt}
							onSelect={handleTeamSetSelect}
						/>
						<TimelineHeader
							team={state.team}
							onSlotClick={handleSlotClick}
							onRemoveClick={handleRemoveClick}
						/>

						<SwapSupplementBar
							swapCount={state.swaps.length}
							swapSequences={swapSupplementSequences}
							onClear={handleClearSwaps}
						/>
						<NoCollectSupplementBar
							noCollectCount={activeNoCollectCount}
							entries={noCollectSupplementEntries}
							onClear={handleClearNoCollectCells}
						/>

						{/* シミュレーション実行コントロール */}
						<SimulationControls
							bonusSettings={state.bonusSettings}
							fieldIndex={state.bonusSettings.fieldIndex}
							isGoodCampTicketSet={state.bonusSettings.isGoodCampTicketSet}
							cookingSimEnabled={state.cookingSettings.enabled}
							cookingCategory={state.cookingSettings.category}
							eventName={state.bonusSettings.event}
							seedMode={state.seedMode}
							seed={state.simulationConfig.seed}
							simulationDays={state.simulationConfig.simulationDays}
							multiTrialCount={state.multiTrialCount}
							simulationLoading={state.simulationLoading}
							simulationProgress={simulationProgress}
							isTeamEmpty={state.team.every((p) => p === null)}
							onFieldIndexChange={handleFieldIndexChange}
							onGoodCampTicketChange={handleGoodCampTicketChange}
							onCookingSimEnabledChange={handleCookingSimEnabledChange}
							onCookingCategoryChange={handleCookingCategoryChange}
							onOpenSettingsTab={handleOpenSettingsTab}
							onSeedModeChange={handleSeedModeChange}
							onSeedChange={handleSeedChange}
							onSimulationDaysChange={handleSimulationDaysChange}
							onTrialCountChange={handleTrialCountChange}
							onRunSimulation={handleRunSimulation}
						/>

						{/* エラー表示 */}
						{state.simulationError && (
							<Box sx={{ color: "error.main", mt: 1, mb: 1 }}>
								{state.simulationError}
							</Box>
						)}

						<WipeReveal
							show={showPostSimulationInsights}
							durationMs={
								skipTeamResultEntryAnimation
									? 0
									: TIMELINE_WIPE_REVEAL_DURATION_MS
							}
							appear={!skipTeamResultEntryAnimation}
							enterEasing={TIMELINE_WIPE_REVEAL_EASING_IN_QUAD}
							exitEasing={TIMELINE_WIPE_REVEAL_EASING_OUT_QUAD}
							testId="team-timeline-post-simulation-wipe"
						>
							{showAverageSection &&
								averageDailySummaries !== null &&
								averageTeamSummary !== null && (
									<Box sx={{ mt: "18px" }}>
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
											<Typography
												sx={{
													fontSize: "14px",
													fontWeight: 700,
													lineHeight: "18px",
													letterSpacing: "0.4px",
												}}
											>
												{t(
													"TeamTimeline.simulation average",
													"シミュレーション結果(平均)",
												)}
											</Typography>
											{showSummaryValueToggle && (
												<SummaryValueModeToggle
													value={summaryValueMode}
													onChange={handleSummaryValueModeChange}
													simulationDays={state.simulationConfig.simulationDays}
													orientation="horizontal"
												/>
											)}
										</Box>
										<TeamSummaryRow
											teamSummary={averageTeamSummary}
											layoutMode="average"
											simulationDays={state.simulationConfig.simulationDays}
											valueMode={summaryValueMode}
											averageCookingSummary={
												state.multiTrialAverageCookingSummary
											}
											showLeftoverIncludeExtraUsageToggle
											leftoverIncludeExtraUsage={leftoverIncludeExtraUsage}
											onLeftoverIncludeExtraUsageChange={
												setLeftoverIncludeExtraUsage
											}
										/>
										<DailySummaryRow
											dailySummaries={averageDailySummaries}
											box={timelineRuntimeBox}
											layoutMode="average"
											simulationDays={state.simulationConfig.simulationDays}
											valueMode={summaryValueMode}
											showTimelineDurationShare={hasConfiguredSwap}
											timelineDurationByPokemonId={
												timelineDurationSummary.activeMinutesByPokemonId
											}
											totalTimelineDurationMinutes={
												timelineDurationSummary.totalTimelineMinutes
											}
										/>
									</Box>
								)}

							{showAdditionalAnalysis && (
								<AdditionalAnalysisPanel
									quickModeEnabled={analysisQuickModeEnabled}
									onQuickModeChange={setAnalysisQuickModeEnabled}
									simulationDays={state.simulationConfig.simulationDays}
									valueMode={summaryValueMode}
									contributionMembers={appearingTimelineMembers}
									contributionResults={contributionResults}
									contributionActiveMinutesByPokemonId={
										timelineDurationSummary.activeMinutesByPokemonId
									}
									contributionLoadingIds={contributionLoadingIds}
									contributionBatchLoading={contributionBatchLoading}
									contributionBatchProgress={contributionBatchProgress}
									contributionProgressById={contributionProgressById}
									onRunContribution={runContributionAnalysis}
									onRunContributionAll={runContributionAnalysisAll}
									energySkillTargets={energySkillTargets}
									energySkillResults={energySkillResults}
									energySkillLoadingIds={energySkillLoadingIds}
									energySkillBatchLoading={energySkillBatchLoading}
									energySkillBatchProgress={energySkillBatchProgress}
									energySkillProgressById={energySkillProgressById}
									energySkillTeamResult={energySkillTeamResult}
									energySkillTeamLoading={energySkillTeamLoading}
									energySkillTeamProgress={energySkillTeamProgress}
									onRunEnergySkill={runEnergySkillAnalysis}
									onRunEnergySkillAll={runEnergySkillAnalysisAll}
									onRunEnergySkillTeam={runEnergySkillTeamAnalysis}
									hasHelpingBonusMember={hasHelpingBonusMember}
									helpingBonusResult={helpingBonusResult}
									helpingBonusLoading={helpingBonusLoading}
									helpingBonusProgress={helpingBonusProgress}
									onRunHelpingBonus={runHelpingBonusAnalysis}
									averageHelpingBonusMemberCount={
										averageHelpingBonusMemberCount
									}
									hasConfiguredSwap={hasConfiguredSwap}
									averageEnergyRecoveryBonusMemberCount={
										averageEnergyRecoveryBonusMemberCount
									}
									hasEnergyRecoveryBonusMember={hasEnergyRecoveryBonusMember}
									energyRecoveryBonusResult={energyRecoveryBonusResult}
									energyRecoveryBonusLoading={energyRecoveryBonusLoading}
									energyRecoveryBonusProgress={energyRecoveryBonusProgress}
									onRunEnergyRecoveryBonus={runEnergyRecoveryBonusAnalysis}
									errorMessage={analysisError}
								/>
							)}
						</WipeReveal>

						{showPreSimulationTimeline && (
							<Box
								sx={{ mt: "18px" }}
								data-testid="team-timeline-pre-simulation-table"
							>
								<Box
									data-testid="team-timeline-pre-simulation-scroll-container"
									data-scroll-overflow-x="hidden"
									sx={{
										width: "100%",
										maxWidth: "100%",
										overflowX: "hidden",
										overflowY: "hidden",
										WebkitOverflowScrolling: "touch",
									}}
								>
									<TimelineTable
										team={state.team}
										timeSlots={state.timeSlots}
										simulationDays={state.simulationConfig.simulationDays}
										result={EMPTY_SIMULATION_RESULT}
										swaps={state.swaps}
										noCollectCells={state.noCollectCells}
										box={timelineRuntimeBox}
										bonusSettings={state.bonusSettings}
										onSwapClick={handleSwapClick}
										onNoCollectToggle={handleNoCollectToggle}
										onSwapSeriesMove={handleSwapSeriesMove}
										onSwapRemoveClick={handleSwapRemoveRequest}
										onHeaderSlotClick={handleSlotClick}
										onOpenTimeSlotSettings={handleOpenTimeSlotSettings}
										showSummaryRows={false}
										compactEmptyCells
										alwaysShowSwapButton
									/>
								</Box>
							</Box>
						)}

						<Fade
							in={showSimulationDetails}
							timeout={
								skipTeamResultEntryAnimation
									? 0
									: TIMELINE_DETAILS_FADE_DURATION_MS
							}
							appear={!skipTeamResultEntryAnimation}
							mountOnEnter
							unmountOnExit
						>
							<Box data-testid="team-timeline-details-fade">
								{showSimulationDetails && simulationResult !== null && (
									<Box sx={{ mt: "18px" }}>
										<Typography
											sx={{
												fontSize: "14px",
												fontWeight: 700,
												lineHeight: "18px",
												letterSpacing: "0.4px",
												mb: "5px",
											}}
										>
											{t(
												"TeamTimeline.simulation details",
												"シミュレーション詳細",
											)}
										</Typography>
										{state.multiTrialResults &&
											state.multiTrialSelectedIndex !== null && (
												<TrialResultSelector
													results={state.multiTrialResults}
													selectedIndex={state.multiTrialSelectedIndex}
													onSelect={handleSliderChange}
												/>
											)}
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
													{t(
														"TeamTimeline.timeline simple view",
														"シンプル表示",
													)}
												</Typography>
											}
										/>
										<Box
											data-testid="team-timeline-post-simulation-scroll-container"
											data-scroll-overflow-x={
												timelineDisplayMode === "detailed" ? "auto" : "hidden"
											}
											sx={{
												width: "100%",
												maxWidth: "100%",
												overflowX:
													timelineDisplayMode === "detailed"
														? "auto"
														: "hidden",
												overflowY: "hidden",
												WebkitOverflowScrolling: "touch",
											}}
										>
											<TimelineTable
												team={state.team}
												timeSlots={state.timeSlots}
												simulationDays={state.simulationConfig.simulationDays}
												result={simulationResult}
												swaps={state.swaps}
												noCollectCells={state.noCollectCells}
												box={timelineRuntimeBox}
												bonusSettings={state.bonusSettings}
												onSwapClick={handleSwapClick}
												onNoCollectToggle={handleNoCollectToggle}
												onSwapSeriesMove={handleSwapSeriesMove}
												onSwapRemoveClick={handleSwapRemoveRequest}
												onHeaderSlotClick={handleSlotClick}
												onOpenTimeSlotSettings={handleOpenTimeSlotSettings}
												showSummaryRows={false}
												displayMode={timelineDisplayMode}
											/>
										</Box>
										<TeamSummaryRow
											teamSummary={simulationResult.teamSummary}
											layoutMode="details"
											simulationDays={state.simulationConfig.simulationDays}
											valueMode={summaryValueMode}
											showValueModeToggle={showSummaryValueToggle}
											onValueModeChange={handleSummaryValueModeChange}
											cookingResult={simulationResult.cookingResult}
											showLeftoverIncludeExtraUsageToggle
											leftoverIncludeExtraUsage={leftoverIncludeExtraUsage}
											onLeftoverIncludeExtraUsageChange={
												setLeftoverIncludeExtraUsage
											}
										/>
										<DailySummaryRow
											dailySummaries={simulationResult.dailySummaries}
											box={timelineRuntimeBox}
											layoutMode="details"
											simulationDays={state.simulationConfig.simulationDays}
											valueMode={summaryValueMode}
											showTimelineDurationShare={hasConfiguredSwap}
											timelineDurationByPokemonId={
												timelineDurationSummary.activeMinutesByPokemonId
											}
											totalTimelineDurationMinutes={
												timelineDurationSummary.totalTimelineMinutes
											}
										/>
									</Box>
								)}
							</Box>
						</Fade>
					</Box>
				</Box>
			)}

			{/* 設定タブ */}
			{state.activeTab === "settings" && (
				<Box
					sx={{
						width: "100%",
						maxWidth: `${TEAM_TIMELINE_CONTENT_WIDTH_PX}px`,
					}}
				>
					<TimelineBonusSettingsPanel
						settings={state.bonusSettings}
						syncWithIvParameter={state.syncWithIvParameter}
						onSyncChange={handleSyncWithIvParameterChange}
						onSettingsChange={handleBonusSettingsChange}
						cookingSimEnabled={state.cookingSettings.enabled}
					/>
					{/* 就寝時げんき設定 */}
					<Box sx={{ mb: 3, p: 2 }}>
						<Typography variant="subtitle2" gutterBottom>
							{t("TeamTimeline.sleep energy", "就寝時げんき")}
						</Typography>
						<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
							<Slider
								value={state.simulationConfig.initialEnergy}
								onChange={(_, value) =>
									handleConfigChange({ initialEnergy: value as number })
								}
								min={0}
								max={100}
								valueLabelDisplay="auto"
								sx={{ flexGrow: 1 }}
							/>
							<Typography
								data-testid="team-timeline-sleep-energy-value"
								variant="body2"
								sx={{ minWidth: "32px", textAlign: "right", fontWeight: 700 }}
							>
								{state.simulationConfig.initialEnergy}
							</Typography>
						</Box>
					</Box>
					<Box id={TIME_SLOT_SETTINGS_SECTION_ID}>
						<TimeSlotEditor
							timeSlots={state.timeSlots}
							onAdd={handleAddTimeSlot}
							onUpdate={handleUpdateTimeSlot}
							onRemove={handleRemoveTimeSlot}
							onReset={handleResetTimeSlots}
						/>
					</Box>
				</Box>
			)}

			{/* 料理タブ */}
			{state.activeTab === "cooking" && (
				<Box
					sx={{
						width: "100%",
						maxWidth: `${TEAM_TIMELINE_CONTENT_WIDTH_PX}px`,
					}}
				>
					<CookingSettingsPanel
						settings={state.cookingSettings}
						onChange={handleCookingSettingsChange}
					/>
				</Box>
			)}

			{/* 既存: ボックス選択ダイアログ（チーム編成用） */}
			<BoxSelectDialog
				open={state.boxSelectDialogOpen}
				box={userBox}
				onSelect={handlePokemonSelect}
				onClose={handleDialogClose}
			/>

			{/* 入れ替え用ポケモン選択ダイアログ */}
			<BoxSelectDialog
				open={state.swapDialogOpen}
				box={userBox}
				onSelect={handleSwapPokemonSelect}
				onClose={() => dispatch({ type: "closeSwapDialog" })}
				onSelectNone={handleSwapSelectNone}
			/>

			{/* げんき設定ダイアログ */}
			<SwapEnergyDialog
				open={state.energyDialogOpen}
				pokemonName={getPendingPokemonName()}
				pokemonIdForm={getPendingPokemonIdForm()}
				defaultEnergy={100}
				disableEnergySetting={disableSwapEnergySetting}
				onConfirm={handleEnergyConfirm}
				onCancel={handleEnergyCancel}
			/>
			<SwapRemoveConfirmDialog
				open={pendingSwapRemoval !== null}
				showRepeatOption={pendingSwapRemoval?.hasFutureRepeat ?? false}
				repeatChecked={removeFutureRepeatChecked}
				onRepeatCheckedChange={setRemoveFutureRepeatChecked}
				onCancel={handleSwapRemoveCancel}
				onConfirm={handleSwapRemoveConfirm}
			/>
			<ResimulationNoticeBar
				open={showResimulationNotice || resimulationDeltaSummary !== null}
				mode={resimulationDeltaSummary !== null ? "result" : "notice"}
				deltaSummary={resimulationDeltaSummary}
				onResimulate={handleRunResimulation}
				onUndo={handleResimulationUndo}
				onClose={handleResimulationResultClose}
			/>
		</div>
	);
}
