import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import type {
	NoCollectCellSetting,
	SimulationResult,
	TimeSlot,
	TimeSlotResult,
} from "../types/TimeSlotTypes";
import TimelineTable from "./TimelineTable";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (
			key: string,
			defaultValue?: string,
			options?: Record<string, unknown>,
		) => {
			if (!defaultValue) {
				return key;
			}
			return defaultValue
				.replace("{{day}}", String(options?.day ?? ""))
				.replace("{{count}}", String(options?.count ?? ""))
				.replace("{{ep}}", String(options?.ep ?? ""));
		},
	}),
}));

vi.mock("./TimelineRow", () => ({
	default: ({
		dayIndex,
		originalSlotId,
		onSwapClick,
		onSwapLongPressStart,
		onSwapRemoveClick,
		noCollectCells,
		onNoCollectToggle,
		compactEmptyCells,
		alwaysShowSwapButton,
		displayMode,
		isFirstTimelineSlot,
		fitToViewport,
		specialConflictTeamIndexes,
	}: {
		dayIndex: number;
		originalSlotId: string;
		onSwapClick?: (slotId: string, teamIndex: number, dayIndex: number) => void;
		onSwapLongPressStart?: (detail: {
			slotId: string;
			teamIndex: number;
			dayIndex: number;
			pointerId: number;
			clientX: number;
			clientY: number;
			swappedPokemonName?: string;
			previewWidth?: number;
			previewHeight?: number;
			pointerOffsetX?: number;
			pointerOffsetY?: number;
		}) => void;
		onSwapRemoveClick?: (
			slotId: string,
			teamIndex: number,
			dayIndex: number,
			pokemonId: number,
		) => void;
		noCollectCells?: NoCollectCellSetting[];
		onNoCollectToggle?: (
			slotId: string,
			teamIndex: number,
			dayIndex: number,
		) => void;
		compactEmptyCells?: boolean;
		alwaysShowSwapButton?: boolean;
		displayMode?: "detailed" | "simple";
		isFirstTimelineSlot?: boolean;
		fitToViewport?: boolean;
		specialConflictTeamIndexes?: readonly number[];
	}) => (
		<>
			<button
				type="button"
				data-testid={`swap-${dayIndex}-${originalSlotId}`}
				data-special-conflict-team-indexes={(
					specialConflictTeamIndexes ?? []
				).join(",")}
				data-compact-empty={compactEmptyCells ? "true" : "false"}
				data-always-show-swap={alwaysShowSwapButton ? "true" : "false"}
				data-display-mode={displayMode ?? "detailed"}
				data-first-timeline-slot={isFirstTimelineSlot ? "true" : "false"}
				data-fit-to-viewport={fitToViewport ? "true" : "false"}
				data-no-collect-count={String(noCollectCells?.length ?? 0)}
				onClick={() => onSwapClick?.(originalSlotId, 0, dayIndex)}
			>
				row
			</button>
			<button
				type="button"
				data-testid={`swap-longpress-${dayIndex}-${originalSlotId}`}
				onClick={() =>
					onSwapLongPressStart?.({
						slotId: originalSlotId,
						teamIndex: 0,
						dayIndex,
						pointerId: 7,
						clientX: 10,
						clientY: 10,
						swappedPokemonName: "row",
						previewWidth: 150,
						previewHeight: 20,
						pointerOffsetX: 25,
						pointerOffsetY: 10,
					})
				}
			>
				longpress
			</button>
			<button
				type="button"
				data-testid={`swap-remove-${dayIndex}-${originalSlotId}`}
				onClick={() => onSwapRemoveClick?.(originalSlotId, 0, dayIndex, 25)}
			>
				remove
			</button>
			<button
				type="button"
				data-testid={`no-collect-toggle-${dayIndex}-${originalSlotId}`}
				onClick={() => onNoCollectToggle?.(originalSlotId, 0, dayIndex)}
			>
				no-collect
			</button>
		</>
	),
}));

vi.mock("./DailySummaryRow", () => ({
	default: () => <div data-testid="daily-summary" />,
}));

vi.mock("./TeamSummaryRow", () => ({
	default: () => <div data-testid="team-summary" />,
}));
vi.mock("../../../../ui/IvCalc/PokemonIcon", () => ({
	default: ({ idForm, size }: { idForm: number; size: number }) => (
		<span data-testid="timeline-header-pokemon-icon">{`icon-${idForm}-${size}`}</span>
	),
}));

const BASE_TIME_SLOTS: TimeSlot[] = [
	{ id: "sleep", time: "22:00", sleepState: "sleep", hasMeal: false },
	{ id: "wake", time: "07:00", sleepState: "wake", hasMeal: false },
	{ id: "night-snack", time: "03:30", sleepState: "none", hasMeal: false },
];

const EMPTY_RESULT: SimulationResult = {
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

const HEADER_TEST_POKEMON: PokemonBoxItem = new PokemonBoxItem(
	new PokemonIv({ pokemonName: "Shuckle", level: 50 }),
	"ツボツボ",
	1,
);

function createTimeSlotResult(base: Partial<TimeSlotResult>): TimeSlotResult {
	return {
		slotId: "slot-1",
		pokemonId: 1,
		teamIndex: 0,
		durationMinutes: 60,
		isSleeping: false,
		helpCount: 0,
		skillTriggerCount: 0,
		berryCount: 0,
		ingredients: [],
		skillIngredients: [],
		energyStart: 50,
		energyEnd: 50,
		mealRecovery: 0,
		skillRecovery: 0,
		wakeRecovery: 0,
		energyDecay: 0,
		skillOverflowCount: 0,
		overflowIngredients: [],
		selfSkillRecovery: 0,
		directSkillEP: 0,
		moonlightGivenRecovery: 0,
		moonlightReceivedRecovery: 0,
		energizingCheerGivenRecovery: 0,
		energizingCheerReceivedRecovery: 0,
		energizingCheerEvents: [],
		nuzzleTriggeredSkillEvents: [],
		proxySkillEvents: [],
		presentCandyCount: 0,
		berryJuiceCount: 0,
		supportSkillBerryCount: 0,
		supportSkillBerryEP: 0,
		supportHelpEvents: [],
		stockpileStoreCount: 0,
		stockpileCountAtStore: 0,
		stockpileSpitCount: 0,
		badDreamsHitCount: 0,
		badDreamsTotalDamageGiven: 0,
		badDreamsDamageTaken: 0,
		...base,
	};
}

describe("TimelineTable", () => {
	it("hides text in the top-left corner cell only", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		const corner = screen.getByTestId("timeline-corner-header-cell");
		expect(corner.textContent).toBe("");
	});

	it("calls onOpenTimeSlotSettings when corner settings button is clicked", () => {
		const onOpenTimeSlotSettings = vi.fn();

		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				onOpenTimeSlotSettings={onOpenTimeSlotSettings}
			/>,
		);

		fireEvent.click(screen.getByTestId("timeline-corner-settings-button"));

		expect(onOpenTimeSlotSettings).toHaveBeenCalledTimes(1);
	});

	it("shows day bands including day 1 when simulation days are 2 or more", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={3}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		expect(screen.getByTestId("timeline-day-band-1").textContent).toBe("1日目");
		expect(screen.getByTestId("timeline-day-band-2").textContent).toContain(
			"2日目",
		);
		expect(screen.getByTestId("timeline-day-band-2").textContent).not.toContain(
			"終了時",
		);
		expect(screen.getByTestId("timeline-day-band-3").textContent).toContain(
			"3日目",
		);
		expect(screen.getByTestId("timeline-day-band-3").textContent).not.toContain(
			"終了時",
		);
	});

	it("shows weekday labels in day bands when startDayOfWeek is given", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={3}
				startDayOfWeek={6}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		expect(screen.getByTestId("timeline-day-band-weekday-1").textContent).toBe(
			"土曜",
		);
		expect(screen.getByTestId("timeline-day-band-weekday-2").textContent).toBe(
			"日曜",
		);
		expect(screen.getByTestId("timeline-day-band-weekday-3").textContent).toBe(
			"月曜",
		);
		expect(screen.getByTestId("timeline-day-band-1").textContent).toBe(
			"1日目土曜",
		);
	});

	it("does not show weekday labels when startDayOfWeek is omitted", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={2}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		expect(screen.queryByTestId("timeline-day-band-weekday-1")).toBeNull();
		expect(screen.getByTestId("timeline-day-band-1").textContent).toBe("1日目");
	});

	it("computes actual cumulative EP for day-end bands", () => {
		const testPokemon: PokemonBoxItem = {
			id: 1,
			iv: {
				idForm: 25,
				level: 1,
				pokemon: { type: "normal" },
			},
			filledNickname: () => "テスト",
		} as unknown as PokemonBoxItem;
		// The day 2 band sits after the day 1 sleep-end slot, so every day 1 result
		// (including night-snack at 03:30) counts toward "day 1 end" while day 2
		// results do not.
		const slotResults = new Map<string, TimeSlotResult[]>();
		slotResults.set("night-snack__day0", [
			createTimeSlotResult({
				slotId: "night-snack__day0",
				pokemonId: 1,
				teamIndex: 0,
				berryCount: 3,
				directSkillEP: 16,
			}),
		]);
		slotResults.set("wake__day0", [
			createTimeSlotResult({
				slotId: "wake__day0",
				pokemonId: 1,
				teamIndex: 0,
				berryCount: 3,
				directSkillEP: 16,
			}),
		]);
		slotResults.set("wake__day1", [
			createTimeSlotResult({
				slotId: "wake__day1",
				pokemonId: 1,
				teamIndex: 0,
				berryCount: 3,
				directSkillEP: 16,
			}),
		]);
		const result: SimulationResult = {
			...EMPTY_RESULT,
			slotResults,
		};

		render(
			<TimelineTable
				team={[testPokemon, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={2}
				result={result}
				swaps={[]}
				box={new PokemonBox([testPokemon])}
			/>,
		);

		expect(screen.getByTestId("timeline-day-band-2").textContent).toContain(
			"1日目終了時: 200 EP",
		);
	});

	it("places each day band after the sleep-end row even when a slot falls between bedtime and wake", () => {
		// The quick sim inserts swap slots during sleep (e.g. 03:30); those rows
		// belong to the day that started at bedtime, so the next day's band must
		// come after that day's sleep-end row, not right after the night slot.
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={3}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		// The mocked TimelineRow renders one `swap-<dayIndex>-<slotId>` button per row.
		const container = screen.getByTestId("timeline-table-container");
		const order = Array.from(
			container.querySelectorAll(
				'[data-testid^="timeline-day-band-"], [data-testid^="swap-"]:not([data-testid^="swap-longpress-"]):not([data-testid^="swap-remove-"])',
			),
		).map((element) => element.getAttribute("data-testid"));

		expect(order).toEqual([
			"timeline-day-band-1",
			"swap-0-sleep",
			"swap-0-night-snack",
			"swap-0-wake",
			"swap-0-sleep-end",
			"timeline-day-band-2",
			"swap-1-night-snack",
			"swap-1-wake",
			"swap-1-sleep-end",
			"timeline-day-band-3",
			"swap-2-night-snack",
			"swap-2-wake",
			"swap-2-sleep-end",
		]);
	});

	it("does not show day 1 band when simulation days is 1", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		expect(screen.queryByText("1日目")).toBeNull();
	});

	it("passes dayIndex=1 when clicking a day 2 slot swap", () => {
		const onSwapClick = vi.fn();

		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={2}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				onSwapClick={onSwapClick}
			/>,
		);

		fireEvent.click(screen.getByTestId("swap-1-wake"));

		expect(onSwapClick).toHaveBeenCalledTimes(1);
		expect(onSwapClick).toHaveBeenCalledWith("wake", 0, 1);
	});

	it("calls onHeaderSlotClick when header slot button is clicked", () => {
		const onHeaderSlotClick = vi.fn();

		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				onHeaderSlotClick={onHeaderSlotClick}
			/>,
		);

		fireEvent.click(screen.getByTestId("timeline-header-slot-button-0"));

		expect(onHeaderSlotClick).toHaveBeenCalledTimes(1);
		expect(onHeaderSlotClick).toHaveBeenCalledWith(0);
	});

	it("renders header content in Lv, icon, name order", () => {
		render(
			<TimelineTable
				team={[HEADER_TEST_POKEMON, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				onHeaderSlotClick={vi.fn()}
			/>,
		);

		const button = screen.getByTestId("timeline-header-slot-button-0");
		const text = button.textContent ?? "";
		expect(text.indexOf("Lv.50")).toBeLessThan(text.indexOf("icon-213-30"));
		expect(text.indexOf("icon-213-30")).toBeLessThan(text.indexOf("ツボツボ"));
	});

	it("shows plus placeholder in empty header slots", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				onHeaderSlotClick={vi.fn()}
			/>,
		);

		expect(
			screen.getAllByTestId("timeline-header-empty-plus-icon").length,
		).toBeGreaterThan(0);
	});

	it("passes remove callback to TimelineRow", () => {
		const onSwapRemoveClick = vi.fn();

		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				onSwapRemoveClick={onSwapRemoveClick}
			/>,
		);

		fireEvent.click(screen.getByTestId("swap-remove-0-wake"));
		expect(onSwapRemoveClick).toHaveBeenCalledTimes(1);
		expect(onSwapRemoveClick).toHaveBeenCalledWith("wake", 0, 0, 25);
	});

	it("passes compact/always-show options down to TimelineRow", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				compactEmptyCells
				alwaysShowSwapButton
			/>,
		);

		const firstRow = screen.getByTestId("swap-0-sleep");
		expect(firstRow.getAttribute("data-compact-empty")).toBe("true");
		expect(firstRow.getAttribute("data-always-show-swap")).toBe("true");
	});

	it("passes no-collect cells and callback down to TimelineRow", () => {
		const onNoCollectToggle = vi.fn();
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				noCollectCells={[{ dayIndex: 0, slotId: "wake", teamSlotIndex: 0 }]}
				box={new PokemonBox([])}
				onNoCollectToggle={onNoCollectToggle}
			/>,
		);

		expect(
			screen.getByTestId("swap-0-wake").getAttribute("data-no-collect-count"),
		).toBe("1");
		fireEvent.click(screen.getByTestId("no-collect-toggle-0-wake"));
		expect(onNoCollectToggle).toHaveBeenCalledTimes(1);
		expect(onNoCollectToggle).toHaveBeenCalledWith("wake", 0, 0);
	});

	it("fits timeline width to viewport when compact mode is enabled", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				compactEmptyCells
			/>,
		);

		expect(
			screen
				.getByTestId("timeline-table-container")
				.getAttribute("data-fit-to-viewport"),
		).toBe("true");
		expect(
			screen.getByTestId("timeline-table-container").getAttribute("style"),
		).toContain("--timeline-time-cell-width: 40px");
		expect(
			screen.getByTestId("swap-0-sleep").getAttribute("data-fit-to-viewport"),
		).toBe("true");
	});

	it("passes simple display mode to rows and fits to viewport", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				displayMode="simple"
			/>,
		);

		const firstRow = screen.getByTestId("swap-0-sleep");
		expect(firstRow.getAttribute("data-display-mode")).toBe("simple");
		expect(firstRow.getAttribute("data-fit-to-viewport")).toBe("true");
		expect(
			screen
				.getByTestId("timeline-table-container")
				.getAttribute("data-fit-to-viewport"),
		).toBe("true");
		expect(
			screen.getByTestId("timeline-table-container").getAttribute("style"),
		).toContain("--timeline-time-cell-width: 40px");
	});

	it("marks only the very first row as first timeline slot", () => {
		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		expect(
			screen
				.getByTestId("swap-0-sleep")
				.getAttribute("data-first-timeline-slot"),
		).toBe("true");
		expect(
			screen
				.getByTestId("swap-0-night-snack")
				.getAttribute("data-first-timeline-slot"),
		).toBe("false");
	});

	it("calls onSwapSeriesMove on pointer up after long-press drag", () => {
		const onSwapSeriesMove = vi.fn();
		const originalElementFromPoint = (
			document as Document & {
				elementFromPoint?: (x: number, y: number) => Element | null;
			}
		).elementFromPoint;
		const sourceCell = document.createElement("div");
		sourceCell.dataset.swapDropEnabled = "true";
		sourceCell.dataset.swapSlotId = "wake";
		sourceCell.dataset.swapTeamIndex = "0";
		sourceCell.dataset.swapDayIndex = "0";
		document.body.appendChild(sourceCell);

		const targetCell = document.createElement("div");
		targetCell.dataset.swapDropEnabled = "true";
		targetCell.dataset.swapSlotId = "sleep";
		targetCell.dataset.swapTeamIndex = "1";
		targetCell.dataset.swapDayIndex = "1";
		document.body.appendChild(targetCell);

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: (x: number) => (x >= 11 ? targetCell : sourceCell),
		});

		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={2}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				onSwapSeriesMove={onSwapSeriesMove}
			/>,
		);

		fireEvent.click(screen.getByTestId("swap-longpress-0-wake"));
		fireEvent.pointerUp(window, { pointerId: 7, clientX: 11, clientY: 10 });

		expect(onSwapSeriesMove).toHaveBeenCalledTimes(1);
		expect(onSwapSeriesMove).toHaveBeenCalledWith("wake", 0, 0, "sleep", 1, 1);

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: originalElementFromPoint,
		});
		sourceCell.remove();
		targetCell.remove();
	});

	it("does not call onSwapSeriesMove when dropping on the same cell", () => {
		const onSwapSeriesMove = vi.fn();
		const originalElementFromPoint = (
			document as Document & {
				elementFromPoint?: (x: number, y: number) => Element | null;
			}
		).elementFromPoint;
		const sourceCell = document.createElement("div");
		sourceCell.dataset.swapDropEnabled = "true";
		sourceCell.dataset.swapSlotId = "wake";
		sourceCell.dataset.swapTeamIndex = "0";
		sourceCell.dataset.swapDayIndex = "0";
		document.body.appendChild(sourceCell);

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => sourceCell,
		});

		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={2}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
				onSwapSeriesMove={onSwapSeriesMove}
			/>,
		);

		fireEvent.click(screen.getByTestId("swap-longpress-0-wake"));
		fireEvent.pointerUp(window, { pointerId: 7, clientX: 10, clientY: 10 });

		expect(onSwapSeriesMove).not.toHaveBeenCalled();

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: originalElementFromPoint,
		});
		sourceCell.remove();
	});

	it("shows drag ghost during drag session and hides it after pointer up", () => {
		const originalElementFromPoint = (
			document as Document & {
				elementFromPoint?: (x: number, y: number) => Element | null;
			}
		).elementFromPoint;
		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => null,
		});

		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={2}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		fireEvent.click(screen.getByTestId("swap-longpress-0-wake"));
		expect(screen.getByTestId("timeline-swap-drag-ghost")).toBeDefined();
		expect(
			screen
				.getByTestId("timeline-swap-drag-ghost-icon")
				.getAttribute("data-icon-name"),
		).toBe("change");

		fireEvent.pointerUp(window, { pointerId: 7, clientX: 10, clientY: 10 });
		expect(screen.queryByTestId("timeline-swap-drag-ghost")).toBeNull();

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: originalElementFromPoint,
		});
	});

	it("applies lift offset immediately when drag ghost appears", () => {
		const originalElementFromPoint = (
			document as Document & {
				elementFromPoint?: (x: number, y: number) => Element | null;
			}
		).elementFromPoint;
		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => null,
		});

		render(
			<TimelineTable
				team={[null, null, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={2}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);

		fireEvent.click(screen.getByTestId("swap-longpress-0-wake"));
		const ghost = screen.getByTestId("timeline-swap-drag-ghost");
		expect((ghost as HTMLElement).style.transform).toBe(
			"translate3d(-15px, -10px, 0) scale(1)",
		);

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: originalElementFromPoint,
		});
	});
});

describe("TimelineTable special Pokémon conflict", () => {
	const createItem = (pokemonName: string, id: number): PokemonBoxItem =>
		new PokemonBoxItem(new PokemonIv({ pokemonName, level: 30 }), "", id);

	it("passes the conflicting team indexes to the rows where two special Pokémon overlap", () => {
		const mewtwo = createItem("Mewtwo", 1);
		const darkrai = createItem("Darkrai", 2);
		const pikachu = createItem("Pikachu", 3);
		render(
			<TimelineTable
				team={[mewtwo, pikachu, null, null, null]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[
					{
						dayIndex: 0,
						slotId: "wake",
						teamSlotIndex: 2,
						newPokemonId: darkrai.id,
						initialEnergy: 100,
					},
				]}
				box={new PokemonBox([mewtwo, darkrai, pikachu])}
			/>,
		);
		// 行の並び: sleep(22:00) → night-snack(03:30) → wake(07:00) → sleep-end(22:00)
		// 起床の行で入れ替えるので、その次の行（就寝の終端）だけ重複する
		const flags = ["sleep", "night-snack", "wake", "sleep-end"].map((slotId) =>
			screen
				.getByTestId(`swap-0-${slotId}`)
				.getAttribute("data-special-conflict-team-indexes"),
		);
		expect(flags).toEqual(["", "", "", "0,2"]);
	});

	it("passes no conflict for a normal team", () => {
		render(
			<TimelineTable
				team={[
					createItem("Pikachu", 1),
					createItem("Mewtwo", 2),
					null,
					null,
					null,
				]}
				timeSlots={BASE_TIME_SLOTS}
				simulationDays={1}
				result={EMPTY_RESULT}
				swaps={[]}
				box={new PokemonBox([])}
			/>,
		);
		for (const slotId of ["sleep", "night-snack", "wake", "sleep-end"]) {
			expect(
				screen
					.getByTestId(`swap-0-${slotId}`)
					.getAttribute("data-special-conflict-team-indexes"),
			).toBe("");
		}
	});
});
