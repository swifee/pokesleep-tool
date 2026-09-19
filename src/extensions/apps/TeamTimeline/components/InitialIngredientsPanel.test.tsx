import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	createDefaultInitialIngredientsSettings,
	type InitialIngredientsSettings,
} from "../types/CookingTypes";
import InitialIngredientsPanel from "./InitialIngredientsPanel";

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

vi.mock("./InitialIngredientsEditor", () => ({
	default: ({
		settings,
		onChange,
	}: {
		settings: InitialIngredientsSettings;
		onChange: (settings: InitialIngredientsSettings) => void;
	}) => (
		<button
			type="button"
			data-testid="initial-ingredients-editor"
			data-apple={String(settings.initialIngredients.apple ?? 0)}
			onClick={() =>
				onChange({
					initialIngredients: { apple: 5 },
					disabledExtraIngredients: settings.disabledExtraIngredients,
				})
			}
		>
			editor
		</button>
	),
}));

function renderPanel(
	overrides: Partial<React.ComponentProps<typeof InitialIngredientsPanel>> = {},
) {
	const onChange = vi.fn();
	const onOpenCookingSettings = vi.fn();
	const onCopyToOtherSim = vi.fn();
	render(
		<InitialIngredientsPanel
			settings={{
				...createDefaultInitialIngredientsSettings(),
				initialIngredients: { apple: 30, honey: 12 },
			}}
			onChange={onChange}
			onOpenCookingSettings={onOpenCookingSettings}
			copyButtonLabel="自動シミュに反映"
			copyConfirmMessage="置き換えます。よろしいですか？"
			onCopyToOtherSim={onCopyToOtherSim}
			testIdPrefix="detailed-sim"
			{...overrides}
		/>,
	);
	return { onChange, onOpenCookingSettings, onCopyToOtherSim };
}

describe("InitialIngredientsPanel", () => {
	it("shows the total collapsed and expands to the editor", () => {
		const { onChange } = renderPanel();

		expect(
			screen.getByTestId("detailed-sim-initial-ingredients-summary")
				.textContent,
		).toBe("（合計 42）");
		expect(screen.queryByTestId("initial-ingredients-editor")).toBeNull();

		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-toggle"),
		);
		const editor = screen.getByTestId("initial-ingredients-editor");
		expect(editor.getAttribute("data-apple")).toBe("30");

		fireEvent.click(editor);
		expect(onChange).toHaveBeenCalledWith({
			initialIngredients: { apple: 5 },
			disabledExtraIngredients: {},
		});
	});

	it("opens the cooking settings from the gear button", () => {
		const { onOpenCookingSettings } = renderPanel();

		fireEvent.click(screen.getByTestId("detailed-sim-open-cooking-settings"));
		expect(onOpenCookingSettings).toHaveBeenCalledTimes(1);
	});

	it("shows the copy button only while expanded and asks for confirmation", () => {
		const { onCopyToOtherSim } = renderPanel();

		expect(
			screen.queryByTestId("detailed-sim-initial-ingredients-copy"),
		).toBeNull();
		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-toggle"),
		);
		const copyButton = screen.getByTestId(
			"detailed-sim-initial-ingredients-copy",
		);
		expect(copyButton.textContent).toBe("自動シミュに反映");
		expect(
			screen.queryByTestId("detailed-sim-initial-ingredients-copy-confirm"),
		).toBeNull();

		fireEvent.click(copyButton);
		expect(screen.getByText("置き換えます。よろしいですか？")).toBeDefined();
		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-copy-cancel"),
		);
		expect(onCopyToOtherSim).not.toHaveBeenCalled();

		fireEvent.click(copyButton);
		fireEvent.click(
			screen.getByTestId("detailed-sim-initial-ingredients-copy-confirm"),
		);
		expect(onCopyToOtherSim).toHaveBeenCalledTimes(1);
	});
});
