import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Nature from "../../../util/Nature";
import { PokemonBoxItem } from "../../../util/PokemonBox";
import PokemonIv from "../../../util/PokemonIv";
import TeamTimelineApp from "./TeamTimelineApp";
import { STORAGE_KEY_TEAM_SETS } from "./TeamTimelineState";
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
vi.mock("./components/QuickSimTab", () => ({
	default: () => <div data-testid="quick-sim-tab" />,
}));

interface SerializedTeamSetPayload {
	teamSets: {
		team: (string | null)[];
		swaps: { newPokemonId: number; newPokemonSerialized?: string }[];
	}[];
}

function createSerializedItem(
	pokemonName: string,
	level: number,
	nickname: string,
	nature = "Adamant",
): string {
	return new PokemonBoxItem(
		new PokemonIv({ pokemonName, level, nature: new Nature(nature) }),
		nickname,
		0,
	).serialize();
}

function seedStorage(options: {
	box: string[];
	team: (string | null)[];
	swapSerialized: string;
}): void {
	localStorage.setItem(FIRST_ACCESS_PRESET_MARKER_KEY, "1");
	localStorage.setItem("PstPokeBox", JSON.stringify(options.box));
	localStorage.setItem(
		STORAGE_KEY_TEAM_SETS,
		JSON.stringify({
			activeTeamSetIndex: 0,
			teamSets: [
				{
					id: "set-1",
					name: "set1",
					team: options.team,
					swaps: [
						{
							dayIndex: 0,
							slotId: "slot-1",
							teamSlotIndex: 1,
							newPokemonId: 12345,
							newPokemonSerialized: options.swapSerialized,
							initialEnergy: 100,
						},
					],
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

function readSavedTeamSet(): SerializedTeamSetPayload["teamSets"][number] {
	const payload = JSON.parse(
		localStorage.getItem(STORAGE_KEY_TEAM_SETS) ?? "{}",
	) as SerializedTeamSetPayload;
	return payload.teamSets[0];
}

describe("TeamTimelineApp box re-matching", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("re-attaches team members and swaps to box Pokémon edited in the IV calculator", async () => {
		// Saved while Pikachu was Lv30 and Eevee Lv20; both were levelled up in the IV calculator since.
		const stalePikachu = createSerializedItem("Pikachu", 30, "ピカ");
		const staleEevee = createSerializedItem("Eevee", 20, "イーブイ");
		const editedPikachu = createSerializedItem("Pikachu", 45, "ピカ");
		const editedEevee = createSerializedItem("Eevee", 33, "イーブイ");
		seedStorage({
			box: [
				createSerializedItem("Bulbasaur", 10, ""),
				editedPikachu,
				editedEevee,
			],
			team: [stalePikachu, null, null, null, null],
			swapSerialized: staleEevee,
		});

		render(<TeamTimelineApp />);
		fireEvent.click(screen.getByRole("tab", { name: "詳細シミュ" }));

		// The slot shows the box entry (Lv45), not the stale snapshot (Lv30).
		const slot = await screen.findByTitle("ピカ");
		expect(slot.textContent).toContain("45");

		// Persisted data now points at the edited entries, so the next load matches exactly.
		await waitFor(() => {
			const saved = readSavedTeamSet();
			expect(saved.team[0]).toBe(editedPikachu);
			expect(saved.swaps[0].newPokemonSerialized).toBe(editedEevee);
		});
	});

	it("keeps the stale snapshot when nothing in the box is similar enough", async () => {
		const stalePikachu = createSerializedItem("Pikachu", 30, "ピカ");
		const otherPikachu = createSerializedItem(
			"Pikachu",
			30,
			"ちゅう",
			"Modest",
		);
		seedStorage({
			box: [otherPikachu],
			team: [stalePikachu, null, null, null, null],
			swapSerialized: stalePikachu,
		});

		render(<TeamTimelineApp />);
		fireEvent.click(screen.getByRole("tab", { name: "詳細シミュ" }));

		expect(await screen.findByTitle("ピカ")).toBeDefined();
		await waitFor(() => {
			const saved = readSavedTeamSet();
			expect(saved.team[0]).toBe(stalePikachu);
			expect(saved.swaps[0].newPokemonSerialized).toBe(stalePikachu);
		});
	});
});
