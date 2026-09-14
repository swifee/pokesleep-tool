import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import InitialIngredientsEditor from "./InitialIngredientsEditor";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
	}),
}));

vi.mock("../../../../ui/IvCalc/IngredientIcon", () => ({
	default: ({ name }: { name: string }) => <span>[{name}]</span>,
}));

describe("InitialIngredientsEditor", () => {
	it("renders the current counts and their total", () => {
		render(
			<InitialIngredientsEditor
				settings={{
					...createDefaultCookingSettings(),
					initialIngredients: { apple: 30, honey: 12 },
				}}
				onChange={vi.fn()}
			/>,
		);

		expect(
			screen.getByTestId("ingredient-input-apple").querySelector("input")
				?.value,
		).toBe("30");
		expect(
			screen.getByTestId("cooking-initial-ingredients-total").textContent,
		).toContain("入力値合計: 42");
	});

	it("steps counts by five and never below zero", () => {
		const onChange = vi.fn();
		const settings = {
			...createDefaultCookingSettings(),
			initialIngredients: { apple: 3 },
		};
		render(
			<InitialIngredientsEditor settings={settings} onChange={onChange} />,
		);

		fireEvent.click(screen.getByTestId("ingredient-increment-apple"));
		expect(onChange).toHaveBeenLastCalledWith({
			...settings,
			initialIngredients: { apple: 8 },
		});

		fireEvent.click(screen.getByTestId("ingredient-decrement-apple"));
		expect(onChange).toHaveBeenLastCalledWith({
			...settings,
			initialIngredients: { apple: 0 },
		});
	});

	it("accepts typed counts and toggles the extra-ingredient lock", () => {
		const onChange = vi.fn();
		const settings = createDefaultCookingSettings();
		render(
			<InitialIngredientsEditor settings={settings} onChange={onChange} />,
		);

		const input = screen
			.getByTestId("ingredient-input-honey")
			.querySelector("input");
		if (!input) {
			throw new Error("input not found");
		}
		fireEvent.change(input, { target: { value: "17" } });
		expect(onChange).toHaveBeenLastCalledWith({
			...settings,
			initialIngredients: { honey: 17 },
		});

		fireEvent.click(screen.getByTestId("ingredient-extra-lock-toggle-honey"));
		expect(onChange).toHaveBeenLastCalledWith({
			...settings,
			disabledExtraIngredients: { honey: true },
		});
	});

	it("allows clearing a count while typing and treats it as 0", () => {
		const onChange = vi.fn();
		const settings = {
			...createDefaultCookingSettings(),
			initialIngredients: { honey: 66 },
		};
		render(
			<InitialIngredientsEditor settings={settings} onChange={onChange} />,
		);

		const input = screen
			.getByTestId("ingredient-input-honey")
			.querySelector("input");
		if (!input) {
			throw new Error("input not found");
		}
		fireEvent.change(input, { target: { value: "" } });
		expect(input.value).toBe("");
		expect(onChange).toHaveBeenLastCalledWith({
			...settings,
			initialIngredients: { honey: 0 },
		});

		fireEvent.blur(input);
		expect(input.value).toBe("66");
	});

	it("hides the title when asked", () => {
		render(
			<InitialIngredientsEditor
				settings={createDefaultCookingSettings()}
				onChange={vi.fn()}
				showTitle={false}
			/>,
		);
		expect(screen.queryByText("初期食材")).toBeNull();
	});
});
