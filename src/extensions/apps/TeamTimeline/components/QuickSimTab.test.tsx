import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import type { SimulationInput } from "../simulation/TimelineSimulator";
import type { ParallelMultiTrialInput } from "../simulation/TrialBatchRunner";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import { createDefaultProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import { STORAGE_KEY_QUICK_SIM } from "../types/QuickSimTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
	type SimulationResult,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { QUICK_SIM_SLOT_ID_PREFIX } from "../utils/QuickSimTimelineBuilder";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import QuickSimTab, { type QuickSimControlsRenderProps } from "./QuickSimTab";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (
			_key: string,
			defaultValue?: string,
			options?: Record<string, unknown>,
		) => {
			if (!defaultValue) {
				return _key;
			}
			return defaultValue.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
				String(options?.[name] ?? ""),
			);
		},
	}),
}));

vi.mock("../../../../ui/IvCalc/PokemonIcon", () => ({
	default: ({ idForm }: { idForm: number }) => (
		<span data-testid={`pokemon-icon-${idForm}`} />
	),
}));

vi.mock("./InitialIngredientsEditor", () => ({
	default: () => <div data-testid="initial-ingredients-editor" />,
}));

vi.mock("./BoxSelectDialog", () => ({
	default: ({
		open,
		box,
		onSelect,
	}: {
		open: boolean;
		box: PokemonBox;
		onSelect: (item: PokemonBoxItem) => void;
	}) => (
		<div data-testid="box-select-dialog" data-open={open ? "true" : "false"}>
			{box.items.map((item) => (
				<button
					key={item.id}
					type="button"
					data-testid={`box-select-item-${item.id}`}
					onClick={() => onSelect(item)}
				>
					{item.id}
				</button>
			))}
		</div>
	),
}));

vi.mock("./TimelineTable", () => ({
	default: ({
		team,
		timeSlots,
		swaps,
		noCollectCells,
		readOnly,
		compactEmptyCells,
		startDayOfWeek,
	}: {
		team: Array<{ id: number } | null>;
		timeSlots: TimeSlot[];
		startDayOfWeek?: number;
		swaps: Array<{
			dayIndex: number;
			slotId: string;
			teamSlotIndex: number;
			newPokemonId: number;
		}>;
		noCollectCells?: Array<{ slotId: string }>;
		readOnly?: boolean;
		compactEmptyCells?: boolean;
	}) => (
		<div
			data-testid="timeline-table"
			data-read-only={readOnly ? "true" : "false"}
			data-compact={compactEmptyCells ? "true" : "false"}
			data-start-day-of-week={String(startDayOfWeek ?? "")}
			data-team={team.map((member) => member?.id ?? "null").join("|")}
			data-slot-ids={timeSlots.map((slot) => slot.id).join("|")}
			data-swaps={swaps
				.map(
					(swap) =>
						`${swap.dayIndex}:${swap.slotId}:${swap.teamSlotIndex}:${swap.newPokemonId}`,
				)
				.join("|")}
			data-no-collect-count={String(noCollectCells?.length ?? 0)}
		/>
	),
}));

vi.mock("./TeamSummaryRow", () => ({
	default: ({ layoutMode }: { layoutMode?: string }) => (
		<div data-testid={`team-summary-row-${layoutMode ?? "details"}`} />
	),
}));

vi.mock("./DailySummaryRow", () => ({
	default: ({
		layoutMode,
		showTimelineDurationShare,
	}: {
		layoutMode?: string;
		showTimelineDurationShare?: boolean;
	}) => (
		<div
			data-testid={`daily-summary-row-${layoutMode ?? "details"}`}
			data-duration-share={showTimelineDurationShare ? "true" : "false"}
		/>
	),
}));

vi.mock("./QuickSimOptimizerPanel", () => ({
	default: ({
		members,
		hasSleepSlot,
		onApply,
		onApplyIngredients,
	}: {
		members: Array<{ pokemonId: number }>;
		hasSleepSlot: boolean;
		onApply: (percentByPokemonId: ReadonlyMap<number, number>) => void;
		onApplyIngredients: (
			initialIngredients: Partial<Record<string, number>>,
		) => void;
	}) => (
		<div
			data-testid="quick-sim-optimizer-panel"
			data-member-count={String(members.length)}
			data-has-sleep-slot={hasSleepSlot ? "true" : "false"}
		>
			<button
				type="button"
				data-testid="quick-sim-optimizer-apply-stub"
				onClick={() =>
					onApply(
						new Map(
							members.map((member, index) => [
								member.pokemonId,
								index === 0 ? 60 : 40,
							]),
						),
					)
				}
			>
				apply
			</button>
			<button
				type="button"
				data-testid="quick-sim-optimizer-apply-ingredients-stub"
				onClick={() => onApplyIngredients({ apple: 90, milk: 0, tomato: 60 })}
			>
				apply ingredients
			</button>
		</div>
	),
}));

vi.mock("./TrialResultSelector", () => ({
	default: ({
		selectedIndex,
		onSelect,
	}: {
		selectedIndex: number;
		onSelect: (index: number) => void;
	}) => (
		<button
			type="button"
			data-testid="trial-result-selector"
			data-selected-index={String(selectedIndex)}
			onClick={() => onSelect(0)}
		>
			select-first-trial
		</button>
	),
}));

const WAIT_FOR_TIMEOUT_MS = 5000;
const runSimulationMock = vi.fn();
const runMultiTrialMock = vi.fn();

vi.mock("../simulation/TimelineSimulator", () => ({
	runSimulation: (input: SimulationInput) => runSimulationMock(input),
}));

vi.mock("../simulation/TrialBatchRunner", () => ({
	runMultiTrialSimulationParallel: (input: ParallelMultiTrialInput) =>
		runMultiTrialMock(input),
}));

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName }), "", id);
}

function createSimulationResult(grandTotalEP: number): SimulationResult {
	return {
		slotResults: new Map(),
		dailySummaries: [],
		teamSummary: {
			totalIngredients: [],
			totalBerryEP: grandTotalEP,
			totalIngredientEP: 0,
			totalSkillEP: 0,
			grandTotalEP,
			totalPresentCandyCount: 0,
			totalCookingPotCapacityIncrease: 0,
			totalTastyChanceIncreasePercent: 0,
			totalDreamShardCount: 0,
		},
	};
}

const pikachu = createItem("Pikachu", 1);
const eevee = createItem("Eevee", 2);
const bulbasaur = createItem("Bulbasaur", 3);
const userBox = new PokemonBox([pikachu, eevee, bulbasaur]);
const runtimeBox = new PokemonBox([pikachu, eevee, bulbasaur]);

function renderTab(
	overrides: Partial<React.ComponentProps<typeof QuickSimTab>> = {},
) {
	const onSeedChange = vi.fn();
	const onInitialIngredientsChange = vi.fn();
	const onCopyInitialIngredientsToDetailedSim = vi.fn();
	const onOpenCookingSettings = vi.fn();
	const renderSimulationControls = ({
		simulationLoading,
		simulationProgress,
		isTeamEmpty,
		onRunSimulation,
	}: QuickSimControlsRenderProps) => (
		<button
			type="button"
			data-testid="run-button"
			data-loading={simulationLoading ? "true" : "false"}
			data-progress={String(simulationProgress)}
			data-team-empty={isTeamEmpty ? "true" : "false"}
			onClick={onRunSimulation}
		>
			run
		</button>
	);
	render(
		<QuickSimTab
			userBox={userBox}
			runtimeBox={runtimeBox}
			team={[pikachu, null, null, null, null]}
			swaps={[]}
			timeSlots={DEFAULT_TIME_SLOTS}
			simulationConfig={{ ...DEFAULT_SIMULATION_CONFIG }}
			bonusSettings={createDefaultTimelineBonusSettings()}
			cookingSettings={createDefaultCookingSettings()}
			provisionalSettings={createDefaultProvisionalSettings()}
			seedMode="random"
			multiTrialCount={3}
			onInitialIngredientsChange={onInitialIngredientsChange}
			onCopyInitialIngredientsToDetailedSim={
				onCopyInitialIngredientsToDetailedSim
			}
			onOpenCookingSettings={onOpenCookingSettings}
			onSeedChange={onSeedChange}
			renderSimulationControls={renderSimulationControls}
			{...overrides}
		/>,
	);
	return {
		onSeedChange,
		onInitialIngredientsChange,
		onCopyInitialIngredientsToDetailedSim,
		onOpenCookingSettings,
	};
}

describe("QuickSimTab", () => {
	beforeEach(() => {
		localStorage.clear();
		runSimulationMock.mockReset();
		runMultiTrialMock.mockReset();
		runSimulationMock.mockImplementation(() => createSimulationResult(100));
		runMultiTrialMock.mockImplementation(
			async (input: ParallelMultiTrialInput) => {
				input.onProgress?.(100);
				return {
					trials: [
						{ seed: 778, grandTotalEP: 120 },
						{ seed: 777, grandTotalEP: 90 },
						{ seed: 779, grandTotalEP: 60 },
					],
					medianIndex: 1,
					averageDailySummaries: [],
					averageTeamSummary: createSimulationResult(90).teamSummary,
					averageCookingSummary: null,
					baseSeed: 777,
					aborted: false,
				};
			},
		);
	});

	it("derives members from the detailed team when nothing is stored", () => {
		renderTab();

		expect(screen.getByTestId("quick-sim-member-row-1")).toBeDefined();
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 100% / 500%",
		);
		expect(
			screen.getByTestId("run-button").getAttribute("data-team-empty"),
		).toBe("false");
		expect(localStorage.getItem(STORAGE_KEY_QUICK_SIM)).toContain(
			pikachu.serialize(),
		);
	});

	it("applies the optimizer result to the member usage rates", () => {
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [
					{
						serialized: pikachu.serialize(),
						usagePercent: 100,
						usageMode: "even",
					},
					{
						serialized: eevee.serialize(),
						usagePercent: 100,
						usageMode: "sleep",
					},
				],
			}),
		);
		renderTab();

		const panel = screen.getByTestId("quick-sim-optimizer-panel");
		expect(panel.getAttribute("data-member-count")).toBe("2");
		expect(panel.getAttribute("data-has-sleep-slot")).toBe("true");

		fireEvent.click(screen.getByTestId("quick-sim-optimizer-apply-stub"));

		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 100% / 500%",
		);
		expect(screen.getByTestId("quick-sim-member-mode-2").textContent).toContain(
			"睡眠",
		);
		expect(localStorage.getItem(STORAGE_KEY_QUICK_SIM)).toContain(
			'"usagePercent":60',
		);
	});

	it("applies optimized initial ingredients while keeping the extra-ingredient locks", () => {
		const cookingSettings = {
			...createDefaultCookingSettings(),
			enabled: true,
			category: "salad" as const,
			basePotCapacity: 57,
			initialIngredients: { honey: 15 },
			disabledExtraIngredients: { tail: true },
		};
		const { onInitialIngredientsChange } = renderTab({ cookingSettings });

		fireEvent.click(
			screen.getByTestId("quick-sim-optimizer-apply-ingredients-stub"),
		);

		expect(onInitialIngredientsChange).toHaveBeenCalledTimes(1);
		expect(onInitialIngredientsChange).toHaveBeenCalledWith({
			initialIngredients: { apple: 90, milk: 0, tomato: 60 },
			disabledExtraIngredients: { tail: true },
		});
	});

	it("renders the initial ingredients panel above the optimizer panel", () => {
		renderTab();

		const ingredients = screen.getByTestId("quick-sim-initial-ingredients");
		const optimizer = screen.getByTestId("quick-sim-optimizer-panel");
		expect(
			ingredients.compareDocumentPosition(optimizer) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("collapses the initial ingredients by default and opens the cooking settings", () => {
		const { onOpenCookingSettings } = renderTab({
			cookingSettings: {
				...createDefaultCookingSettings(),
				initialIngredients: { apple: 30, honey: 12 },
			},
		});

		expect(screen.queryByTestId("initial-ingredients-editor")).toBeNull();
		expect(
			screen.getByTestId("quick-sim-initial-ingredients-summary").textContent,
		).toBe("（合計 42）");

		fireEvent.click(screen.getByTestId("quick-sim-initial-ingredients-toggle"));
		expect(screen.getByTestId("initial-ingredients-editor")).toBeDefined();

		fireEvent.click(screen.getByTestId("quick-sim-open-cooking-settings"));
		expect(onOpenCookingSettings).toHaveBeenCalledTimes(1);
	});

	it("copies the initial ingredients to the detailed sim only after confirmation", () => {
		const { onCopyInitialIngredientsToDetailedSim } = renderTab();

		expect(
			screen.queryByTestId("quick-sim-initial-ingredients-copy"),
		).toBeNull();
		fireEvent.click(screen.getByTestId("quick-sim-initial-ingredients-toggle"));
		const copyButton = screen.getByTestId("quick-sim-initial-ingredients-copy");
		expect(copyButton.textContent).toBe("詳細シミュに反映");

		fireEvent.click(copyButton);
		fireEvent.click(
			screen.getByTestId("quick-sim-initial-ingredients-copy-cancel"),
		);
		expect(onCopyInitialIngredientsToDetailedSim).not.toHaveBeenCalled();

		fireEvent.click(copyButton);
		fireEvent.click(
			screen.getByTestId("quick-sim-initial-ingredients-copy-confirm"),
		);
		expect(onCopyInitialIngredientsToDetailedSim).toHaveBeenCalledTimes(1);
	});

	it("restores the stored usage mode", () => {
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [
					{
						serialized: eevee.serialize(),
						usagePercent: 40,
						usageMode: "sleep",
					},
				],
			}),
		);

		renderTab();

		expect(screen.getByTestId("quick-sim-member-mode-2").textContent).toContain(
			"睡眠",
		);
		expect(localStorage.getItem(STORAGE_KEY_QUICK_SIM)).toContain(
			'"usageMode":"sleep"',
		);
	});

	it("swaps a member from the icon while keeping its usage and mode", () => {
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [
					{
						serialized: pikachu.serialize(),
						usagePercent: 40,
						usageMode: "daytime",
					},
					{ serialized: eevee.serialize(), usagePercent: 30 },
				],
			}),
		);
		renderTab();

		fireEvent.click(screen.getByTestId("quick-sim-member-swap-1"));
		expect(
			screen.getByTestId("box-select-dialog").getAttribute("data-open"),
		).toBe("true");

		// Picking a Pokémon that is already a member changes nothing.
		fireEvent.click(screen.getByTestId("box-select-item-2"));
		expect(screen.getByTestId("quick-sim-member-row-1")).toBeDefined();

		fireEvent.click(screen.getByTestId("quick-sim-member-swap-1"));
		fireEvent.click(screen.getByTestId("box-select-item-3"));

		expect(screen.queryByTestId("quick-sim-member-row-1")).toBeNull();
		const rows = screen.getAllByTestId(/^quick-sim-member-row-/);
		expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
			"quick-sim-member-row-3",
			"quick-sim-member-row-2",
		]);
		expect(screen.getByTestId("quick-sim-member-mode-3").textContent).toContain(
			"日中",
		);
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 70% / 500%",
		);
	});

	it("warns about members whose usage the fixed modes cannot satisfy", () => {
		const items = Array.from({ length: 6 }, (_, index) =>
			createItem("Pikachu", 100 + index),
		);
		const box = new PokemonBox(items);
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: items.map((item, index) => ({
					serialized: item.serialize(),
					usagePercent: index < 5 ? 50 : 60,
					usageMode: index < 5 ? "firstHalf" : "even",
				})),
			}),
		);

		renderTab({
			userBox: box,
			runtimeBox: box,
			simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, simulationDays: 2 },
		});

		expect(screen.getByTestId("quick-sim-unmet-notice").textContent).toContain(
			"起用率を満たせません",
		);
		expect(
			screen.getByTestId("run-button").getAttribute("data-team-empty"),
		).toBe("false");
	});

	it("keeps two special Pokémon apart and explains the rule", () => {
		const mewtwo = createItem("Mewtwo", 100);
		const darkrai = createItem("Darkrai", 101);
		const normals = Array.from({ length: 4 }, (_, index) =>
			createItem("Pikachu", 200 + index),
		);
		const box = new PokemonBox([mewtwo, darkrai, ...normals]);
		const usageByPokemonId = new Map<number, number>([
			[mewtwo.id, 100],
			[darkrai.id, 20],
		]);
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: box.items.map((item) => ({
					serialized: item.serialize(),
					usagePercent: usageByPokemonId.get(item.id) ?? 95,
					usageMode: "even",
				})),
			}),
		);

		renderTab({ userBox: box, runtimeBox: box });

		expect(
			screen.getByTestId("quick-sim-special-pokemon-note").textContent,
		).toContain("同時に1体まで");
		// ミュウツーが 100% なのでダークライは一度も編成に入れない
		const notice = screen.getByTestId("quick-sim-unmet-notice").textContent;
		expect(notice).toContain("とくべつなポケモンの制限");
		expect(notice).toContain("pokemons.Darkrai");
		expect(notice).not.toContain("pokemons.Mewtwo");
	});

	it("does not show the special Pokémon note without conflicting members", () => {
		renderTab();
		expect(screen.queryByTestId("quick-sim-special-pokemon-note")).toBeNull();
	});

	it("restores stored members instead of the detailed team", () => {
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [{ serialized: eevee.serialize(), usagePercent: 40 }],
			}),
		);

		renderTab();

		expect(screen.queryByTestId("quick-sim-member-row-1")).toBeNull();
		expect(screen.getByTestId("quick-sim-member-row-2")).toBeDefined();
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 40% / 500%",
		);
	});

	it("shows the schedule preview as a read-only timeline with generated swaps", () => {
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [
					{ serialized: pikachu.serialize(), usagePercent: 100 },
					{ serialized: eevee.serialize(), usagePercent: 70 },
					{ serialized: bulbasaur.serialize(), usagePercent: 30 },
				],
			}),
		);

		renderTab();

		const table = screen.getByTestId("timeline-table");
		expect(table.getAttribute("data-read-only")).toBe("true");
		expect(table.getAttribute("data-compact")).toBe("true");
		// 日曜の最後の食事の就寝直前への移動を表示にも反映するため開始曜日を渡す
		expect(table.getAttribute("data-start-day-of-week")).toBe(
			String(DEFAULT_SIMULATION_CONFIG.startDayOfWeek),
		);
		expect(table.getAttribute("data-team")).toBe("1|2|null|null|null");
		// Eevee (1008min) leaves at 23:00 + 1008min = 15:48, where Bulbasaur enters.
		const insertedSlotId = `${QUICK_SIM_SLOT_ID_PREFIX}1548`;
		expect(table.getAttribute("data-slot-ids")).toContain(insertedSlotId);
		expect(table.getAttribute("data-swaps")).toBe(`0:${insertedSlotId}:1:3`);
		expect(table.getAttribute("data-no-collect-count")).toBe("5");
		expect(screen.queryByTestId("quick-sim-sleep-swap-notice")).toBeNull();
		expect(screen.queryByTestId("quick-sim-schedule-error")).toBeNull();
	});

	it("reports a schedule error and disables the run button without a sleep slot", () => {
		renderTab({
			timeSlots: [
				{ id: "a", time: "07:00", sleepState: "none", hasMeal: true },
			],
		});

		expect(screen.getByTestId("quick-sim-schedule-error").textContent).toBe(
			"時間帯設定に「就寝」と「起床」を設定してください。",
		);
		expect(
			screen.getByTestId("run-button").getAttribute("data-team-empty"),
		).toBe("true");
		expect(screen.queryByTestId("timeline-table")).toBeNull();
	});

	it("runs a multi-trial simulation with the generated timeline and shows results", async () => {
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [
					{ serialized: pikachu.serialize(), usagePercent: 100 },
					{ serialized: eevee.serialize(), usagePercent: 70 },
					{ serialized: bulbasaur.serialize(), usagePercent: 30 },
				],
			}),
		);
		const { onSeedChange } = renderTab();

		fireEvent.click(screen.getByTestId("run-button"));

		await waitFor(
			() => {
				expect(screen.getByTestId("quick-sim-average-section")).toBeDefined();
			},
			{ timeout: WAIT_FOR_TIMEOUT_MS },
		);

		expect(runMultiTrialMock).toHaveBeenCalledTimes(1);
		const multiInput = runMultiTrialMock.mock
			.calls[0][0] as ParallelMultiTrialInput;
		expect(multiInput.trialCount).toBe(3);
		expect(multiInput.initialSeed).toBeUndefined();
		expect(multiInput.team?.map((member) => member?.id ?? null)).toEqual([
			1,
			2,
			null,
			null,
			null,
		]);
		expect(multiInput.swaps).toEqual([
			{
				dayIndex: 0,
				slotId: `${QUICK_SIM_SLOT_ID_PREFIX}1548`,
				teamSlotIndex: 1,
				newPokemonId: 3,
				initialEnergy: 100,
			},
		]);
		expect(multiInput.noCollectCells).toHaveLength(5);
		expect(multiInput.timeSlots.map((slot) => slot.id)).toContain(
			`${QUICK_SIM_SLOT_ID_PREFIX}1548`,
		);

		// The median trial is re-run in full and the base seed is reported.
		expect(runSimulationMock).toHaveBeenCalledTimes(1);
		expect(
			(runSimulationMock.mock.calls[0][0] as SimulationInput).config.seed,
		).toBe(777);
		expect(onSeedChange).toHaveBeenCalledWith(777);

		expect(screen.getByTestId("team-summary-row-average")).toBeDefined();
		expect(
			screen
				.getByTestId("daily-summary-row-average")
				.getAttribute("data-duration-share"),
		).toBe("true");
		expect(screen.getByTestId("team-summary-row-details")).toBeDefined();
		expect(
			screen
				.getByTestId("trial-result-selector")
				.getAttribute("data-selected-index"),
		).toBe("1");
		expect(
			screen.getByTestId("timeline-table").getAttribute("data-compact"),
		).toBe("false");
		expect(
			screen
				.getByTestId("timeline-table")
				.getAttribute("data-start-day-of-week"),
		).toBe(String(DEFAULT_SIMULATION_CONFIG.startDayOfWeek));
		expect(screen.queryByTestId("quick-sim-stale-notice")).toBeNull();
		expect(screen.getByTestId("run-button").getAttribute("data-loading")).toBe(
			"false",
		);
	});

	it("re-runs the selected trial when another trial is chosen", async () => {
		renderTab();
		fireEvent.click(screen.getByTestId("run-button"));
		await waitFor(
			() => {
				expect(screen.getByTestId("trial-result-selector")).toBeDefined();
			},
			{ timeout: WAIT_FOR_TIMEOUT_MS },
		);
		runSimulationMock.mockClear();

		fireEvent.click(screen.getByTestId("trial-result-selector"));

		expect(runSimulationMock).toHaveBeenCalledTimes(1);
		expect(
			(runSimulationMock.mock.calls[0][0] as SimulationInput).config.seed,
		).toBe(778);
		expect(
			screen
				.getByTestId("trial-result-selector")
				.getAttribute("data-selected-index"),
		).toBe("0");
	});

	it("runs a single simulation with the fixed seed when the trial count is 1", async () => {
		const { onSeedChange } = renderTab({
			seedMode: "fixed",
			multiTrialCount: 1,
			simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, seed: 4242 },
		});

		fireEvent.click(screen.getByTestId("run-button"));

		await waitFor(
			() => {
				expect(screen.getByTestId("team-summary-row-details")).toBeDefined();
			},
			{ timeout: WAIT_FOR_TIMEOUT_MS },
		);
		expect(runMultiTrialMock).not.toHaveBeenCalled();
		expect(runSimulationMock).toHaveBeenCalledTimes(1);
		expect(
			(runSimulationMock.mock.calls[0][0] as SimulationInput).config.seed,
		).toBe(4242);
		expect(onSeedChange).not.toHaveBeenCalled();
		expect(screen.queryByTestId("quick-sim-average-section")).toBeNull();
		expect(screen.queryByTestId("trial-result-selector")).toBeNull();
	});

	it("marks the result as stale after the members change", async () => {
		renderTab();
		fireEvent.click(screen.getByTestId("run-button"));
		await waitFor(
			() => {
				expect(screen.getByTestId("team-summary-row-details")).toBeDefined();
			},
			{ timeout: WAIT_FOR_TIMEOUT_MS },
		);
		expect(screen.queryByTestId("quick-sim-stale-notice")).toBeNull();

		fireEvent.click(screen.getByTestId("quick-sim-member-decrement-1"));

		expect(screen.getByTestId("quick-sim-stale-notice")).toBeDefined();
		expect(screen.getByTestId("team-summary-row-details")).toBeDefined();
	});

	it("adds a member from the box dialog with the remaining usage as default", () => {
		renderTab();
		expect(
			screen.getByTestId("box-select-dialog").getAttribute("data-open"),
		).toBe("false");

		fireEvent.click(screen.getByTestId("quick-sim-add-member-button"));
		expect(
			screen.getByTestId("box-select-dialog").getAttribute("data-open"),
		).toBe("true");

		fireEvent.click(screen.getByTestId("box-select-item-2"));

		expect(
			screen.getByTestId("box-select-dialog").getAttribute("data-open"),
		).toBe("false");
		expect(screen.getByTestId("quick-sim-member-row-2")).toBeDefined();
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 200% / 500%",
		);

		// Selecting the same Pokemon again does not duplicate it.
		fireEvent.click(screen.getByTestId("quick-sim-add-member-button"));
		fireEvent.click(screen.getByTestId("box-select-item-2"));
		expect(screen.getAllByTestId("quick-sim-member-row-2")).toHaveLength(1);
	});

	it("imports the detailed team again only after confirming", async () => {
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: [{ serialized: eevee.serialize(), usagePercent: 40 }],
			}),
		);
		renderTab();
		expect(screen.queryByTestId("quick-sim-member-row-1")).toBeNull();

		// Cancelling keeps the current members.
		fireEvent.click(screen.getByTestId("quick-sim-import-team-button"));
		fireEvent.click(screen.getByTestId("quick-sim-import-cancel-button"));
		expect(screen.queryByTestId("quick-sim-member-row-1")).toBeNull();
		expect(screen.getByTestId("quick-sim-member-row-2")).toBeDefined();

		fireEvent.click(screen.getByTestId("quick-sim-import-team-button"));
		fireEvent.click(screen.getByTestId("quick-sim-import-confirm-button"));

		expect(screen.getByTestId("quick-sim-member-row-1")).toBeDefined();
		expect(screen.queryByTestId("quick-sim-member-row-2")).toBeNull();
		await waitFor(() => {
			expect(
				screen.queryByTestId("quick-sim-import-confirm-button"),
			).toBeNull();
		});
	});

	it("shows the sleep swap notice when the usage cannot be met while asleep", () => {
		// Six members above the awake time cannot all get a full night in five slots.
		const items = Array.from({ length: 6 }, (_, index) =>
			createItem("Pikachu", 100 + index),
		);
		const box = new PokemonBox(items);
		localStorage.setItem(
			STORAGE_KEY_QUICK_SIM,
			JSON.stringify({
				members: items.map((item) => ({
					serialized: item.serialize(),
					usagePercent: 70,
				})),
			}),
		);

		renderTab({ userBox: box, runtimeBox: box });

		expect(screen.getByTestId("quick-sim-sleep-swap-notice")).toBeDefined();
		expect(
			screen.getByTestId("run-button").getAttribute("data-team-empty"),
		).toBe("false");
	});
});
