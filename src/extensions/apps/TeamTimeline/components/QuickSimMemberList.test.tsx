import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
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

function renderList(
	members: QuickSimMember[],
	onChange = vi.fn(),
	memberBox: PokemonBox = box,
) {
	const onAddClick = vi.fn();
	const onImportClick = vi.fn();
	const onSwapClick = vi.fn();
	render(
		<QuickSimMemberList
			members={members}
			box={memberBox}
			onChange={onChange}
			onAddClick={onAddClick}
			onImportClick={onImportClick}
			onSwapClick={onSwapClick}
		/>,
	);
	return { onChange, onAddClick, onImportClick, onSwapClick };
}

function member(
	pokemonId: number,
	usagePercent: number,
	usageMode: QuickSimMember["usageMode"] = "even",
): QuickSimMember {
	return { pokemonId, usagePercent, usageMode };
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
		renderList([member(pikachu.id, 100), member(eevee.id, 25)]);

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
				members={items.map((item) => member(item.id, 100))}
				box={new PokemonBox(items)}
				onChange={vi.fn()}
				onAddClick={vi.fn()}
				onImportClick={vi.fn()}
				onSwapClick={vi.fn()}
			/>,
		);
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toContain(
			"合計が500%を超えています。",
		);
	});

	it("steps usage with the buttons and clamps to 0-100", () => {
		const { onChange } = renderList([
			member(pikachu.id, 98),
			member(eevee.id, 3),
		]);

		fireEvent.click(screen.getByTestId("quick-sim-member-increment-1"));
		expect(onChange).toHaveBeenLastCalledWith([
			member(pikachu.id, 100),
			member(eevee.id, 3),
		]);

		fireEvent.click(screen.getByTestId("quick-sim-member-decrement-2"));
		expect(onChange).toHaveBeenLastCalledWith([
			member(pikachu.id, 98),
			member(eevee.id, 0),
		]);
	});

	it("accepts typed usage values, treats an empty field as 0 and ignores non-digits", () => {
		const { onChange } = renderList([member(pikachu.id, 50)]);
		const input = screen
			.getByTestId("quick-sim-member-input-1")
			.querySelector("input");
		if (!input) {
			throw new Error("input not found");
		}

		fireEvent.change(input, { target: { value: "150" } });
		expect(onChange).toHaveBeenLastCalledWith([member(pikachu.id, 100)]);

		// Deleting every digit is allowed while typing; the value becomes 0.
		onChange.mockClear();
		fireEvent.change(input, { target: { value: "" } });
		expect(onChange).toHaveBeenLastCalledWith([member(pikachu.id, 0)]);
		expect(input.value).toBe("");

		onChange.mockClear();
		fireEvent.change(input, { target: { value: "abc" } });
		expect(onChange).not.toHaveBeenCalled();

		// Leaving the field shows the committed value again.
		fireEvent.blur(input);
		expect(input.value).toBe("50");
	});

	it("always shows the usage mode dropdown, fades it at 0% and 100%, and changes the mode", () => {
		const items = [pikachu, eevee, createItem("Bulbasaur", 3)];
		const { onChange } = renderList(
			[member(pikachu.id, 100), member(eevee.id, 40), member(3, 0)],
			vi.fn(),
			new PokemonBox(items),
		);

		const fullTime = screen.getByTestId("quick-sim-member-mode-1");
		const partial = screen.getByTestId("quick-sim-member-mode-2");
		const unused = screen.getByTestId("quick-sim-member-mode-3");
		expect(fullTime.getAttribute("data-inactive")).toBe("true");
		expect(partial.getAttribute("data-inactive")).toBe("false");
		expect(unused.getAttribute("data-inactive")).toBe("true");
		expect(partial.textContent).toContain("均等");

		fireEvent.mouseDown(within(partial).getByRole("combobox"));
		expect(
			screen.getAllByRole("option").map((option) => option.textContent),
		).toEqual(["均等", "前半", "後半", "睡眠", "日中", "空き"]);
		fireEvent.click(screen.getByRole("option", { name: "睡眠" }));
		expect(onChange).toHaveBeenLastCalledWith([
			member(pikachu.id, 100),
			member(eevee.id, 40, "sleep"),
			member(3, 0),
		]);

		// The remainder mode is selectable like any other.
		fireEvent.mouseDown(within(partial).getByRole("combobox"));
		fireEvent.click(screen.getByRole("option", { name: "空き" }));
		expect(onChange).toHaveBeenLastCalledWith([
			member(pikachu.id, 100),
			member(eevee.id, 40, "remainder"),
			member(3, 0),
		]);

		// The faded dropdown of a 100% member still accepts a new mode.
		fireEvent.mouseDown(within(fullTime).getByRole("combobox"));
		fireEvent.click(screen.getByRole("option", { name: "前半" }));
		expect(onChange).toHaveBeenLastCalledWith([
			member(pikachu.id, 100, "firstHalf"),
			member(eevee.id, 40),
			member(3, 0),
		]);
	});

	it("shows the usage help only while hovering with a mouse or after a tap", async () => {
		renderList([member(pikachu.id, 40)]);
		const button = screen.getByTestId("quick-sim-usage-help-button");
		const helpText = /100% = 1枠を1日中占有/;

		expect(screen.queryByText(helpText)).toBeNull();
		expect(button.getAttribute("aria-pressed")).toBe("false");

		fireEvent.pointerEnter(button, { pointerType: "mouse" });
		expect(screen.getByText(helpText)).toBeDefined();
		expect(button.getAttribute("aria-pressed")).toBe("true");
		// Clicking right after hovering keeps the help open; the next click closes it.
		fireEvent.click(button);
		expect(button.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(button);
		expect(button.getAttribute("aria-pressed")).toBe("false");
		fireEvent.pointerLeave(button, { pointerType: "mouse" });
		expect(button.getAttribute("aria-pressed")).toBe("false");
		await waitFor(() => {
			expect(screen.queryByText(helpText)).toBeNull();
		});

		// A touch tap fires no mouse hover; the click toggles the help.
		fireEvent.pointerEnter(button, { pointerType: "touch" });
		expect(button.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(button);
		expect(screen.getByText(helpText)).toBeDefined();
		expect(button.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(button);
		expect(button.getAttribute("aria-pressed")).toBe("false");
		await waitFor(() => {
			expect(screen.queryByText(helpText)).toBeNull();
		});
	});

	it("moves the slider in 5% steps and shows a short level label", () => {
		renderList([member(pikachu.id, 40)]);
		const slider = screen
			.getByTestId("quick-sim-member-slider-1")
			.querySelector("input");
		if (!slider) {
			throw new Error("slider not found");
		}
		expect(slider.getAttribute("step")).toBe("5");
		expect(screen.getByTestId("quick-sim-member-row-1").textContent).toContain(
			"L",
		);
		expect(
			screen.getByTestId("quick-sim-member-row-1").textContent,
		).not.toContain("Lv.");
	});

	it("requests a swap when the icon is tapped", () => {
		const { onSwapClick } = renderList([member(pikachu.id, 100)]);
		fireEvent.click(screen.getByTestId("quick-sim-member-swap-1"));
		expect(onSwapClick).toHaveBeenCalledWith(pikachu.id);
	});

	it("removes a member and forwards the add/import clicks", () => {
		const { onChange, onAddClick, onImportClick } = renderList([
			member(pikachu.id, 100),
			member(eevee.id, 25),
		]);

		fireEvent.click(screen.getByTestId("quick-sim-member-remove-1"));
		expect(onChange).toHaveBeenLastCalledWith([member(eevee.id, 25)]);

		fireEvent.click(screen.getByTestId("quick-sim-add-member-button"));
		expect(onAddClick).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByTestId("quick-sim-import-team-button"));
		expect(onImportClick).toHaveBeenCalledTimes(1);
	});

	it("skips members that are missing from the box", () => {
		renderList([member(999, 40)]);
		expect(screen.queryByTestId("quick-sim-member-row-999")).toBeNull();
		expect(screen.getByTestId("quick-sim-usage-total").textContent).toBe(
			"起用率合計: 40% / 500%",
		);
	});
});
