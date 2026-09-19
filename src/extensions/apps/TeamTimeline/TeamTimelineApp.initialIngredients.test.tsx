import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamTimelineApp from "./TeamTimelineApp";
import type {
	CookingSimulationSettings,
	InitialIngredientsSettings,
} from "./types/CookingTypes";
import {
	STORAGE_KEY_COOKING_SETTINGS,
	STORAGE_KEY_QUICK_SIM_INITIAL_INGREDIENTS,
} from "./utils/CookingSettingsStorage";

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

vi.mock("./components/TimelineHeader", () => ({
	default: () => <div data-testid="timeline-header" />,
}));

vi.mock("./components/TeamSetToolbar", () => ({
	default: () => <div data-testid="team-set-toolbar" />,
}));

vi.mock("./components/SwapSupplementBar", () => ({
	default: () => null,
}));

vi.mock("./components/SimulationControls", () => ({
	default: () => <div data-testid="simulation-controls" />,
}));

/** 自動シミュ側は、受け取った初期食材とコールバックだけを露出する */
vi.mock("./components/QuickSimTab", () => ({
	default: ({
		cookingSettings,
		onInitialIngredientsChange,
		onCopyInitialIngredientsToDetailedSim,
	}: {
		cookingSettings: CookingSimulationSettings;
		onInitialIngredientsChange: (settings: InitialIngredientsSettings) => void;
		onCopyInitialIngredientsToDetailedSim: () => void;
	}) => (
		<div
			data-testid="quick-sim-tab"
			data-apple={String(cookingSettings.initialIngredients.apple ?? 0)}
			data-honey-locked={String(
				cookingSettings.disabledExtraIngredients.honey === true,
			)}
			data-pot-capacity={String(cookingSettings.basePotCapacity)}
		>
			<button
				type="button"
				data-testid="quick-sim-set-apple-30"
				onClick={() =>
					onInitialIngredientsChange({
						initialIngredients: { apple: 30 },
						disabledExtraIngredients: { honey: true },
					})
				}
			>
				set
			</button>
			<button
				type="button"
				data-testid="quick-sim-copy-to-detailed"
				onClick={onCopyInitialIngredientsToDetailedSim}
			>
				copy
			</button>
		</div>
	),
}));

vi.mock("./components/TimeSlotEditor", () => ({
	default: () => <div data-testid="time-slot-editor" />,
}));

vi.mock("./components/TimelineBonusSettingsPanel", () => ({
	default: () => <div data-testid="bonus-settings-panel" />,
}));

vi.mock("./components/TrialResultSelector", () => ({
	default: () => null,
}));

vi.mock("./components/AdditionalAnalysisPanel", () => ({
	default: () => null,
}));

vi.mock("./components/TeamSummaryRow", () => ({
	default: () => null,
}));

vi.mock("./components/DailySummaryRow", () => ({
	default: () => null,
}));

vi.mock("./components/ResimulationNoticeBar", () => ({
	default: () => null,
}));

vi.mock("./components/WipeReveal", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/SwapEnergyDialog", () => ({
	SwapEnergyDialog: () => null,
}));

vi.mock("./components/BoxSelectDialog", () => ({
	default: () => null,
}));

vi.mock("./components/TimelineTable", () => ({
	default: () => <div data-testid="timeline-table" />,
}));

vi.mock("../../../ui/IvCalc/IngredientIcon", () => ({
	default: ({ name }: { name: string }) => <span>[{name}]</span>,
}));

function openDetailedTab() {
	fireEvent.click(screen.getByRole("tab", { name: "詳細シミュ" }));
}

function openQuickTab() {
	fireEvent.click(screen.getByRole("tab", { name: "自動シミュ" }));
}

function detailedSummary(): string {
	return (
		screen.getByTestId("detailed-sim-initial-ingredients-summary")
			.textContent ?? ""
	);
}

describe("TeamTimelineApp initial ingredients", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("keeps the auto sim and detailed sim initial ingredients separate", () => {
		render(<TeamTimelineApp />);

		fireEvent.click(screen.getByTestId("quick-sim-set-apple-30"));
		expect(screen.getByTestId("quick-sim-tab").getAttribute("data-apple")).toBe(
			"30",
		);

		openDetailedTab();
		expect(detailedSummary()).toBe("（合計 0）");

		// 詳細シミュ側を編集しても自動シミュ側は変わらない
		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-toggle"),
		);
		fireEvent.click(screen.getByTestId("ingredient-increment-honey"));
		expect(detailedSummary()).toBe("（合計 5）");

		openQuickTab();
		expect(screen.getByTestId("quick-sim-tab").getAttribute("data-apple")).toBe(
			"30",
		);

		// 永続化先も別々
		expect(
			JSON.parse(
				localStorage.getItem(STORAGE_KEY_QUICK_SIM_INITIAL_INGREDIENTS) ?? "",
			),
		).toEqual({
			initialIngredients: { apple: 30 },
			disabledExtraIngredients: { honey: true },
		});
		expect(
			JSON.parse(localStorage.getItem(STORAGE_KEY_COOKING_SETTINGS) ?? "")
				.initialIngredients,
		).toEqual({ honey: 5 });
	});

	it("copies the auto sim initial ingredients to the detailed sim", () => {
		render(<TeamTimelineApp />);

		fireEvent.click(screen.getByTestId("quick-sim-set-apple-30"));
		fireEvent.click(screen.getByTestId("quick-sim-copy-to-detailed"));

		openDetailedTab();
		expect(detailedSummary()).toBe("（合計 30）");
		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-toggle"),
		);
		expect(
			screen.getByTestId("ingredient-input-apple").querySelector("input")
				?.value,
		).toBe("30");
	});

	it("copies the detailed sim initial ingredients to the auto sim after confirmation", async () => {
		render(<TeamTimelineApp />);

		openDetailedTab();
		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-toggle"),
		);
		fireEvent.click(screen.getByTestId("ingredient-increment-apple"));
		fireEvent.click(screen.getByTestId("ingredient-extra-lock-toggle-honey"));
		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-copy"),
		);
		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-copy-confirm"),
		);
		// ダイアログが閉じきる（aria-hidden が外れる）まで待ってからタブを切り替える
		await waitFor(() => {
			expect(
				screen.queryByTestId("detailed-sim-initial-ingredients-copy-dialog"),
			).toBeNull();
		});

		openQuickTab();
		const quickTab = screen.getByTestId("quick-sim-tab");
		expect(quickTab.getAttribute("data-apple")).toBe("5");
		expect(quickTab.getAttribute("data-honey-locked")).toBe("true");
	});

	it("starts the auto sim from the stored cooking settings when nothing is saved for it yet", () => {
		localStorage.setItem(
			STORAGE_KEY_COOKING_SETTINGS,
			JSON.stringify({
				enabled: true,
				basePotCapacity: 57,
				initialIngredients: { apple: 12 },
				disabledExtraIngredients: { honey: true },
			}),
		);

		render(<TeamTimelineApp />);

		const quickTab = screen.getByTestId("quick-sim-tab");
		expect(quickTab.getAttribute("data-apple")).toBe("12");
		expect(quickTab.getAttribute("data-honey-locked")).toBe("true");
		// 料理設定そのものは共有される
		expect(quickTab.getAttribute("data-pot-capacity")).toBe("57");

		openDetailedTab();
		expect(detailedSummary()).toBe("（合計 12）");
	});

	it("no longer shows the initial ingredients in the cooking settings tab", () => {
		localStorage.setItem(
			STORAGE_KEY_COOKING_SETTINGS,
			JSON.stringify({ enabled: true }),
		);
		render(<TeamTimelineApp />);

		fireEvent.click(screen.getByRole("tab", { name: "料理設定" }));
		expect(screen.getByTestId("cooking-settings-panel")).toBeDefined();
		expect(screen.queryByTestId("cooking-initial-ingredients")).toBeNull();
		expect(screen.queryByText("初期食材")).toBeNull();
	});
});
