import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import type { TeamSetState } from "../types/TeamTimelineTypes";
import { SWAP_NONE_POKEMON_ID } from "../types/TimeSlotTypes";
import TeamSetToolbar from "./TeamSetToolbar";

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
			return defaultValue.replace("{{count}}", String(options?.count ?? ""));
		},
	}),
}));

vi.mock("../../../../ui/IvCalc/PokemonIcon", () => ({
	default: ({ idForm, size }: { idForm: number; size: number }) => (
		<span data-testid={`pokemon-icon-${idForm}-${size}`} />
	),
}));

function createMember(id: number, idForm: number): PokemonBoxItem {
	return {
		id,
		iv: { idForm },
		filledNickname: () => `pokemon-${id}`,
	} as unknown as PokemonBoxItem;
}

function createTeamSets(): TeamSetState[] {
	return [
		{
			id: "set-1",
			name: "チームA",
			team: [createMember(1, 25), createMember(2, 149), null, null, null],
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-1",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 1,
					slotId: "slot-1",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 2,
					slotId: "slot-2",
					teamSlotIndex: 2,
					newPokemonId: SWAP_NONE_POKEMON_ID,
					initialEnergy: 0,
				},
			],
			noCollectCells: [],
			lastSimulationSnapshot: {
				averageTotalEP: 12345,
				settingsHash: "hash-current",
			},
			saveCookingSettings: true,
			saveFieldSettings: false,
			savedCookingSettings: {
				enabled: true,
				category: "dessert",
			},
			savedFieldSettings: null,
		},
		{
			id: "set-2",
			name: "チームB",
			team: [null, null, null, null, null],
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-1",
					teamSlotIndex: 0,
					newPokemonId: 200,
					initialEnergy: 90,
				},
				{
					dayIndex: 0,
					slotId: "slot-3",
					teamSlotIndex: 1,
					newPokemonId: 201,
					initialEnergy: 90,
				},
			],
			noCollectCells: [],
			lastSimulationSnapshot: {
				averageTotalEP: 7777,
				settingsHash: "hash-stale",
			},
			saveCookingSettings: false,
			saveFieldSettings: true,
			savedCookingSettings: null,
			savedFieldSettings: {
				fieldIndex: 2,
				favoriteType: ["fire", "water", "grass"],
			},
		},
		{
			id: "set-3",
			name: "チームC",
			team: [null, null, null, null, null],
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-1",
					teamSlotIndex: 0,
					newPokemonId: SWAP_NONE_POKEMON_ID,
					initialEnergy: 0,
				},
			],
			noCollectCells: [],
			lastSimulationSnapshot: null,
			saveCookingSettings: false,
			saveFieldSettings: false,
			savedCookingSettings: null,
			savedFieldSettings: null,
		},
	];
}

describe("TeamSetToolbar", () => {
	it("opens team save settings dialog and saves name with options", () => {
		const onSaveSettings = vi.fn();

		render(
			<TeamSetToolbar
				teamSets={createTeamSets()}
				activeTeamSetIndex={0}
				currentSimulationContextHash="hash-current"
				onSaveSettings={onSaveSettings}
				onCreate={vi.fn()}
				onDuplicateAt={vi.fn()}
				onDeleteAt={vi.fn()}
				onSelect={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByTestId("team-set-edit-name-button"));
		const dialog = screen.getByTestId("team-set-name-dialog");
		expect(within(dialog).getByText("チーム保存設定")).toBeDefined();
		expect(
			(
				within(dialog).getByRole("checkbox", {
					name: "料理",
				}) as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				within(dialog).getByRole("checkbox", {
					name: "フィールド",
				}) as HTMLInputElement
			).checked,
		).toBe(false);
		fireEvent.change(
			within(dialog).getByRole("textbox", { name: "チーム名" }),
			{ target: { value: "きのみ特化" } },
		);
		fireEvent.click(
			within(dialog).getByRole("checkbox", { name: "フィールド" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "保存" }));
		expect(onSaveSettings).toHaveBeenCalledWith("きのみ特化", true, true);
	});

	it("renders menu details and fires select/duplicate/delete/create handlers", () => {
		const onSelect = vi.fn();
		const onCreate = vi.fn();
		const onDuplicateAt = vi.fn();
		const onDeleteAt = vi.fn();

		render(
			<TeamSetToolbar
				teamSets={createTeamSets()}
				activeTeamSetIndex={0}
				currentSimulationContextHash="hash-current"
				onSaveSettings={vi.fn()}
				onCreate={onCreate}
				onDuplicateAt={onDuplicateAt}
				onDeleteAt={onDeleteAt}
				onSelect={onSelect}
			/>,
		);

		expect(screen.queryByText("+1")).toBeNull();
		expect(screen.queryByText("+0")).toBeNull();

		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "チームセット選択" }),
		);

		const firstItem = screen.getByTestId("team-set-menu-item-0");
		expect(within(firstItem).getByText("チームA")).toBeDefined();
		expect(within(firstItem).getByText("+1")).toBeDefined();
		expect(within(firstItem).getByTestId("team-set-icon-0-0")).toBeDefined();
		expect(within(firstItem).getByTestId("team-set-icon-0-4")).toBeDefined();
		expect(
			within(firstItem)
				.getByTestId("team-set-icon-0-0")
				.getAttribute("style") ?? "",
		).toContain("border-radius: 4px");

		const secondItem = screen.getByTestId("team-set-menu-item-1");
		expect(within(secondItem).getByText("+2")).toBeDefined();
		const secondItemEmptySlot = within(secondItem).getByTestId(
			"team-set-empty-slot-1-0",
		);
		expect(secondItemEmptySlot.getAttribute("style") ?? "").toContain(
			"display: block",
		);
		expect(secondItemEmptySlot.getAttribute("style") ?? "").toContain(
			"border-radius: 4px",
		);
		expect(
			within(firstItem).getByTestId("team-set-average-ep-0").textContent,
		).toBe("12,345 EP");
		expect(
			within(firstItem)
				.getByTestId("team-set-average-ep-0")
				.getAttribute("data-stale"),
		).toBe("false");
		expect(
			within(secondItem).getByTestId("team-set-average-ep-1").textContent,
		).toBe("7,777 EP");
		expect(
			within(secondItem)
				.getByTestId("team-set-average-ep-1")
				.getAttribute("data-stale"),
		).toBe("true");

		const thirdItem = screen.getByTestId("team-set-menu-item-2");
		expect(within(thirdItem).queryByText("+0")).toBeNull();
		expect(
			within(thirdItem).getByTestId("team-set-average-ep-2").textContent,
		).toBe("");

		fireEvent.click(
			within(firstItem).getByTestId("team-set-duplicate-button-0"),
		);
		fireEvent.click(within(secondItem).getByTestId("team-set-delete-button-1"));
		expect(onDuplicateAt).toHaveBeenCalledWith(0);
		expect(onDeleteAt).toHaveBeenCalledWith(1);

		fireEvent.click(secondItem);
		expect(onSelect).toHaveBeenCalledWith(1);

		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "チームセット選択" }),
		);
		fireEvent.click(screen.getByTestId("team-set-create-menu-item"));
		expect(onCreate).toHaveBeenCalledTimes(1);
	});
});
