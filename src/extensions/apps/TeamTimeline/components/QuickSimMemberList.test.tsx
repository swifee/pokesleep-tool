import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import type { QuickSimMember } from "../types/QuickSimTypes";
import QuickSimMemberList, {
	formatUsageHoursPerDay,
} from "./QuickSimMemberList";

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

function createItem(pokemonName: string, id: number): PokemonBoxItem {
	return new PokemonBoxItem(new PokemonIv({ pokemonName }), "", id);
}

const pikachu = createItem("Pikachu", 1);
const eevee = createItem("Eevee", 2);
const box = new PokemonBox([pikachu, eevee]);

function renderList(members: QuickSimMember[], onChange = vi.fn()) {
	const onAddClick = vi.fn();
	const onImportClick = vi.fn();
	render(
		<QuickSimMemberList
			members={members}
			box={box}
			onChange={onChange}
			onAddClick={onAddClick}
			onImportClick={onImportClick}
		/>,
	);
	return { onChange, onAddClick, onImportClick };
}

describe("formatUsageHoursPerDay", () => {
	it("formats hours per day with at most one decimal", () => {
		expect(formatUsageHoursPerDay(100)).toBe("24h");
		expect(formatUsageHoursPerDay(50)).toBe("12h");
		expect(formatUsageHoursPerDay(46)).toBe("11h");
		expect(formatUsageHoursPerDay(21)).toBe("5h");
		expect(formatUsageHoursPerDay(0)).toBe("0h");
	});
});

describe("QuickSimMemberList", () => {
	it("renders members with usage, hours per day and the total", () => {
		renderList([
			{ pokemonId: pikachu.id, usagePercent: 100 },
			{ pokemonId: eevee.id, usagePercent: 25 },
		]);

		expect(screen.getByTestId("quick-sim-member-name-1").textContent).toContain(
			"Pikachu",
		);
		expect(screen.getByTestId("quick-sim-member-hours-2").textContent).toBe(
			"6h/日",
		);
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 125% / 500%",
		);
		expect(screen.queryByTestId("quick-sim-member-empty")).toBeNull();
	});

	it("shows the empty message when there are no members", () => {
		renderList([]);
		expect(screen.getByTestId("quick-sim-member-empty")).toBeDefined();
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 0% / 500%",
		);
	});

	it("warns when the total exceeds 500%", () => {
		const items = Array.from({ length: 6 }, (_, index) =>
			createItem("Pikachu", 100 + index),
		);
		render(
			<QuickSimMemberList
				members={items.map((item) => ({
					pokemonId: item.id,
					usagePercent: 100,
				}))}
				box={new PokemonBox(items)}
				onChange={vi.fn()}
				onAddClick={vi.fn()}
				onImportClick={vi.fn()}
			/>,
		);
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toContain(
			"合計が500%を超えています。",
		);
	});

	it("steps usage with the buttons and clamps to 0-100", () => {
		const { onChange } = renderList([
			{ pokemonId: pikachu.id, usagePercent: 98 },
			{ pokemonId: eevee.id, usagePercent: 3 },
		]);

		fireEvent.click(screen.getByTestId("quick-sim-member-increment-1"));
		expect(onChange).toHaveBeenLastCalledWith([
			{ pokemonId: pikachu.id, usagePercent: 100 },
			{ pokemonId: eevee.id, usagePercent: 3 },
		]);

		fireEvent.click(screen.getByTestId("quick-sim-member-decrement-2"));
		expect(onChange).toHaveBeenLastCalledWith([
			{ pokemonId: pikachu.id, usagePercent: 98 },
			{ pokemonId: eevee.id, usagePercent: 0 },
		]);
	});

	it("accepts typed usage values and ignores invalid input", () => {
		const { onChange } = renderList([
			{ pokemonId: pikachu.id, usagePercent: 50 },
		]);
		const input = screen
			.getByTestId("quick-sim-member-input-1")
			.querySelector("input");
		if (!input) {
			throw new Error("input not found");
		}

		fireEvent.change(input, { target: { value: "150" } });
		expect(onChange).toHaveBeenLastCalledWith([
			{ pokemonId: pikachu.id, usagePercent: 100 },
		]);

		onChange.mockClear();
		fireEvent.change(input, { target: { value: "" } });
		expect(onChange).not.toHaveBeenCalled();
	});

	it("removes a member and forwards the add/import clicks", () => {
		const { onChange, onAddClick, onImportClick } = renderList([
			{ pokemonId: pikachu.id, usagePercent: 100 },
			{ pokemonId: eevee.id, usagePercent: 25 },
		]);

		fireEvent.click(screen.getByTestId("quick-sim-member-remove-1"));
		expect(onChange).toHaveBeenLastCalledWith([
			{ pokemonId: eevee.id, usagePercent: 25 },
		]);

		fireEvent.click(screen.getByTestId("quick-sim-add-member-button"));
		expect(onAddClick).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByTestId("quick-sim-import-team-button"));
		expect(onImportClick).toHaveBeenCalledTimes(1);
	});

	it("skips members that are missing from the box", () => {
		renderList([{ pokemonId: 999, usagePercent: 40 }]);
		expect(screen.queryByTestId("quick-sim-member-row-999")).toBeNull();
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 40% / 500%",
		);
	});
});
