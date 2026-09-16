import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PokemonBoxItem } from "../../../util/PokemonBox";
import PokemonIv from "../../../util/PokemonIv";
import TeamTimelineApp from "./TeamTimelineApp";
import { FIRST_ACCESS_PRESET_MARKER_KEY } from "./utils/FirstAccessPreset";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
	}),
}));

vi.mock("../../../ui/IvCalc/PokemonIcon", () => ({
	default: ({ idForm }: { idForm: number }) => (
		<span data-testid={`pokemon-icon-${idForm}`} />
	),
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
vi.mock("./components/NoCollectSupplementBar", () => ({
	default: () => null,
}));
vi.mock("./components/SimulationControls", () => ({
	default: () => <div data-testid="simulation-controls" />,
}));
vi.mock("./components/TimeSlotEditor", () => ({
	default: () => <div data-testid="time-slot-editor" />,
}));
vi.mock("./components/TimelineBonusSettingsPanel", () => ({
	default: () => <div data-testid="bonus-settings-panel" />,
}));
vi.mock("./components/TrialResultSelector", () => ({
	default: () => <div data-testid="trial-result-selector" />,
}));
vi.mock("./components/AdditionalAnalysisPanel", () => ({
	default: () => <div data-testid="additional-analysis-panel" />,
}));
vi.mock("./components/TeamSummaryRow", () => ({
	default: () => <div data-testid="team-summary-row" />,
}));
vi.mock("./components/DailySummaryRow", () => ({
	default: () => <div data-testid="daily-summary-row" />,
}));
vi.mock("./components/ResimulationNoticeBar", () => ({
	default: () => null,
}));
vi.mock("./components/WipeReveal", () => ({
	default: ({
		show,
		children,
	}: {
		show: boolean;
		children: React.ReactNode;
	}) => (show ? <div data-testid="wipe-reveal">{children}</div> : null),
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

function serializeItem(pokemonName: string): string {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName, level: 30 }),
		"",
		0,
	).serialize();
}

function seedTeamSet(team: (string | null)[]): void {
	localStorage.setItem(FIRST_ACCESS_PRESET_MARKER_KEY, "1");
	localStorage.setItem(
		"PstTeamTimelineTeamSetsV1",
		JSON.stringify({
			activeTeamSetIndex: 0,
			teamSets: [
				{
					id: "set-1",
					name: "set1",
					team,
					swaps: [],
					noCollectCells: [],
					lastSimulationSnapshot: null,
					saveCookingSettings: false,
					saveFieldSettings: false,
					savedCookingSettings: null,
					savedFieldSettings: null,
				},
			],
		}),
	);
}

describe("TeamTimelineApp special Pokémon conflict bar", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("shows the bar with the conflicting Pokémon when the team has two special Pokémon", () => {
		seedTeamSet([
			serializeItem("Mewtwo"),
			serializeItem("Pikachu"),
			serializeItem("Darkrai"),
			null,
			null,
		]);
		render(<TeamTimelineApp />);

		const bar = screen.getByTestId("special-pokemon-conflict-bar");
		expect(bar.textContent).toContain("同時に1体まで");
		const entries = screen.getAllByTestId("special-pokemon-conflict-entry");
		// モックの t はキーをそのまま返す
		expect(entries.map((entry) => entry.textContent)).toEqual([
			"pokemons.Mewtwo",
			"pokemons.Darkrai",
		]);
		expect(screen.getByTestId("pokemon-icon-150")).not.toBeNull();
		expect(screen.getByTestId("pokemon-icon-491")).not.toBeNull();
	});

	it("does not show the bar for Latias + Latios or a single special Pokémon", () => {
		seedTeamSet([
			serializeItem("Latias"),
			serializeItem("Latios"),
			serializeItem("Pikachu"),
			null,
			null,
		]);
		const view = render(<TeamTimelineApp />);
		expect(screen.queryByTestId("special-pokemon-conflict-bar")).toBeNull();
		view.unmount();

		localStorage.clear();
		seedTeamSet([
			serializeItem("Mewtwo"),
			serializeItem("Pikachu"),
			null,
			null,
			null,
		]);
		render(<TeamTimelineApp />);
		expect(screen.queryByTestId("special-pokemon-conflict-bar")).toBeNull();
	});
});
