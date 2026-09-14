import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuickSimControlsRenderProps } from "./components/QuickSimTab";
import TeamTimelineApp from "./TeamTimelineApp";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
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
	default: ({
		simulationLoading,
		simulationProgress,
		isTeamEmpty,
		simulationDays,
		onRunSimulation,
	}: {
		simulationLoading: boolean;
		simulationProgress: number;
		isTeamEmpty: boolean;
		simulationDays: number;
		onRunSimulation: () => void;
	}) => (
		<button
			type="button"
			data-testid="simulation-controls"
			data-loading={simulationLoading ? "true" : "false"}
			data-progress={String(simulationProgress)}
			data-team-empty={isTeamEmpty ? "true" : "false"}
			data-simulation-days={String(simulationDays)}
			onClick={onRunSimulation}
		>
			run
		</button>
	),
}));

vi.mock("./components/QuickSimTab", () => ({
	default: ({
		team,
		multiTrialCount,
		renderSimulationControls,
	}: {
		team: Array<{ iv: { pokemonName: string } } | null>;
		multiTrialCount: number;
		renderSimulationControls: (
			props: QuickSimControlsRenderProps,
		) => React.ReactNode;
	}) => (
		<div
			data-testid="quick-sim-tab"
			data-team={team
				.map((member) => member?.iv.pokemonName ?? "null")
				.join("|")}
			data-trial-count={String(multiTrialCount)}
		>
			{renderSimulationControls({
				simulationLoading: true,
				simulationProgress: 42,
				isTeamEmpty: true,
				onRunSimulation: () => undefined,
			})}
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

describe("TeamTimelineApp quick simulation tab", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("shows the quick tab first and keeps the detailed tab selected by default", () => {
		render(<TeamTimelineApp />);

		const tabs = screen.getAllByRole("tab");
		expect(tabs.map((tab) => tab.textContent)).toEqual([
			"簡易シミュ",
			"詳細シミュ",
			"基本設定",
			"料理設定",
		]);
		expect(tabs[1].getAttribute("aria-selected")).toBe("true");
		expect(screen.queryByTestId("quick-sim-tab")).toBeNull();
		expect(screen.getByTestId("timeline-table")).toBeDefined();
	});

	it("renders the quick tab with the active team and shared controls", () => {
		render(<TeamTimelineApp />);

		fireEvent.click(screen.getByRole("tab", { name: "簡易シミュ" }));

		const quickTab = screen.getByTestId("quick-sim-tab");
		expect(quickTab.getAttribute("data-team")).toBe(
			"Pikachu|Dragonite|Slowbro|null|Psyduck",
		);
		expect(quickTab.getAttribute("data-trial-count")).toBe("1000");
		expect(screen.queryByTestId("timeline-table")).toBeNull();

		// The shared controls receive the quick tab's own run state.
		const controls = screen.getByTestId("simulation-controls");
		expect(controls.getAttribute("data-loading")).toBe("true");
		expect(controls.getAttribute("data-progress")).toBe("42");
		expect(controls.getAttribute("data-team-empty")).toBe("true");
		expect(controls.getAttribute("data-simulation-days")).toBe("1");

		fireEvent.click(screen.getByRole("tab", { name: "詳細シミュ" }));
		expect(screen.queryByTestId("quick-sim-tab")).toBeNull();
		expect(screen.getByTestId("timeline-table")).toBeDefined();
	});
});
