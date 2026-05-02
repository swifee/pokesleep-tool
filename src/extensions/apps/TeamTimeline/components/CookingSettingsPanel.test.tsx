import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
	type CookingSimulationSettings,
	createDefaultCookingSettings,
} from "../types/CookingTypes";
import CookingSettingsPanel from "./CookingSettingsPanel";

interface ChildrenProps {
	children?: React.ReactNode;
	[key: string]: unknown;
}

interface TextFieldProps extends ChildrenProps {
	type?: string;
	value?: string | number;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
	onBlur?: React.FocusEventHandler<HTMLInputElement>;
	inputProps?: Record<string, unknown>;
	size?: string;
	variant?: string;
	sx?: unknown;
}

interface SelectProps extends ChildrenProps {
	value?: string | number;
	onChange?: React.ChangeEventHandler<HTMLSelectElement>;
	size?: string;
	variant?: string;
	sx?: unknown;
}

interface MenuItemProps extends ChildrenProps {
	value?: string | number;
}

interface TabsProps extends ChildrenProps {
	value?: string | number;
	onChange?: (event: React.SyntheticEvent, value: unknown) => void;
	sx?: unknown;
}

interface TabProps extends ChildrenProps {
	value?: string | number;
	label?: React.ReactNode;
	onSelect?: (value: unknown) => void;
	selected?: boolean;
	sx?: unknown;
}

interface SwitchProps extends ChildrenProps {
	checked?: boolean;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

interface FormControlLabelProps extends ChildrenProps {
	control?: React.ReactNode;
	label?: React.ReactNode;
}

interface ButtonProps extends ChildrenProps {
	sx?: unknown;
	variant?: string;
	disableElevation?: boolean;
}

vi.mock("@mui/material", () => ({
	Box: ({ children, sx, ...rest }: ChildrenProps & { sx?: unknown }) => {
		const sxText =
			typeof sx === "object" && sx != null ? JSON.stringify(sx) : undefined;
		return (
			<div data-sx={sxText} {...rest}>
				{children}
			</div>
		);
	},
	Typography: ({ children, ...rest }: ChildrenProps) => (
		<span {...rest}>{children}</span>
	),
	TextField: ({
		type,
		value,
		onChange,
		onBlur,
		inputProps,
		size,
		variant,
		sx,
		...rest
	}: TextFieldProps) => {
		void inputProps;
		const sxText =
			typeof sx === "object" && sx != null ? JSON.stringify(sx) : undefined;
		return (
			<input
				type={type ?? "text"}
				value={value}
				onChange={onChange}
				onBlur={onBlur}
				data-size={size}
				data-variant={variant}
				data-sx={sxText}
				{...rest}
			/>
		);
	},
	Select: ({
		value,
		onChange,
		size,
		variant,
		sx,
		children,
		...rest
	}: SelectProps) => {
		void size;
		void variant;
		void sx;
		return (
			<select value={value} onChange={onChange} {...rest}>
				{children}
			</select>
		);
	},
	MenuItem: ({ value, children }: MenuItemProps) => (
		<option value={value}>{children}</option>
	),
	Tabs: ({ value, onChange, sx, children, ...rest }: TabsProps) => {
		void sx;
		return (
			<div {...rest}>
				{React.Children.map(children, (child) => {
					if (!React.isValidElement<TabProps>(child)) {
						return child;
					}
					return React.cloneElement(child, {
						selected: child.props.value === value,
						onSelect: (nextValue: unknown) =>
							onChange?.({} as React.SyntheticEvent, nextValue),
					});
				})}
			</div>
		);
	},
	Tab: ({ value, label, onSelect, selected, sx, ...rest }: TabProps) => {
		void sx;
		return (
			<button
				type="button"
				aria-pressed={selected}
				onClick={() => onSelect?.(value)}
				{...rest}
			>
				{label}
			</button>
		);
	},
	Switch: ({ checked, onChange, ...rest }: SwitchProps) => (
		<input type="checkbox" checked={checked} onChange={onChange} {...rest} />
	),
	FormControlLabel: ({ control, label }: FormControlLabelProps) => (
		<div>
			{control}
			{label}
		</div>
	),
	Button: ({
		children,
		sx,
		variant,
		disableElevation,
		...rest
	}: ButtonProps) => {
		void disableElevation;
		const sxText =
			typeof sx === "object" && sx != null ? JSON.stringify(sx) : undefined;
		return (
			<button type="button" data-sx={sxText} data-variant={variant} {...rest}>
				{children}
			</button>
		);
	},
	Divider: () => <hr />,
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
	}),
}));

vi.mock("../../../../ui/IvCalc/IngredientIcon", () => ({
	default: ({ name }: { name: string }) => <span>[{name}]</span>,
}));

vi.mock("./TimelineIcons", () => ({
	default: ({
		name,
		sx,
		...rest
	}: {
		name: string;
		sx?: unknown;
		[key: string]: unknown;
	}) => {
		void sx;
		return <span {...rest}>[{name}]</span>;
	},
}));

vi.mock("../../../../util/PokemonRp", () => ({
	ingredientStrength: {
		apple: 10,
		mushroom: 20,
		egg: 30,
	},
}));

vi.mock("../../../../data/pokemons", async () => {
	const actual = await vi.importActual<
		typeof import("../../../../data/pokemons")
	>("../../../../data/pokemons");
	return {
		...actual,
		IngredientNames: ["apple", "mushroom", "egg"],
	};
});

vi.mock("../data/RecipeData", () => {
	const recipes = [
		{
			name: "starterSoup",
			category: "curry",
			ingredients: [{ name: "apple", count: 10 }],
			recipeBonus: 0.19,
		},
		{
			name: "megaStew",
			category: "curry",
			ingredients: [
				{ name: "apple", count: 30 },
				{ name: "mushroom", count: 30 },
			],
			recipeBonus: 0.19,
		},
		{
			name: "legendStew",
			category: "curry",
			ingredients: [{ name: "egg", count: 50 }],
			recipeBonus: 0.19,
		},
		{
			name: "lightSalad",
			category: "salad",
			ingredients: [{ name: "egg", count: 10 }],
			recipeBonus: 0.19,
		},
		{
			name: "sweetDrink",
			category: "dessert",
			ingredients: [{ name: "apple", count: 8 }],
			recipeBonus: 0.19,
		},
	] as const;

	return {
		getRecipesByCategory: (category: string) =>
			recipes.filter((recipe) => recipe.category === category),
	};
});

function createSettings(
	overrides?: Partial<CookingSimulationSettings>,
): CookingSimulationSettings {
	return {
		enabled: true,
		category: "curry",
		recipeLevels: {
			starterSoup: 50,
			megaStew: 50,
			legendStew: 50,
			lightSalad: 50,
			sweetDrink: 50,
		},
		basePotCapacity: 81,
		initialIngredients: { apple: 30, mushroom: 24, egg: 600 },
		disabledRecipes: {},
		disabledExtraIngredients: {},
		...overrides,
	};
}

describe("CookingSettingsPanel", () => {
	it("uses updated defaults for cooking settings", () => {
		const defaults = createDefaultCookingSettings();
		expect(defaults.basePotCapacity).toBe(81);
		expect(defaults.recipeLevels).toEqual({});
		expect(defaults.disabledRecipes).toEqual({});
		expect(defaults.disabledExtraIngredients).toEqual({});
	});

	it("renders pot capacity as 12-99 / step 3 select and changes tab display only", () => {
		const onChange = vi.fn();
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={onChange} />,
		);

		const potSelect = screen.getByTestId(
			"cooking-pot-capacity-select",
		) as HTMLSelectElement;
		const optionValues = Array.from(potSelect.querySelectorAll("option")).map(
			(option) => Number(option.value),
		);
		expect(optionValues[0]).toBe(12);
		expect(optionValues[optionValues.length - 1]).toBe(99);
		expect(optionValues.every((value) => value % 3 === 0)).toBe(true);

		fireEvent.change(potSelect, { target: { value: "30" } });
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ basePotCapacity: 30 }),
		);

		onChange.mockClear();
		fireEvent.click(screen.getByTestId("cooking-category-tab-salad"));
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId("recipe-row-lightSalad")).toBeDefined();
		expect(screen.queryByTestId("recipe-row-megaStew")).toBeNull();
	});

	it("uses simulation-selected category as initial active tab", () => {
		render(
			<CookingSettingsPanel
				settings={createSettings({ category: "dessert" })}
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByTestId("recipe-row-sweetDrink")).toBeDefined();
		expect(screen.queryByTestId("recipe-row-megaStew")).toBeNull();
	});

	it("sorts recipes by level-1 base energy in descending order", () => {
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />,
		);

		const highEnergyRecipe = screen.getByTestId("recipe-row-legendStew");
		const midEnergyRecipe = screen.getByTestId("recipe-row-megaStew");
		const lowEnergyRecipe = screen.getByTestId("recipe-row-starterSoup");

		expect(
			highEnergyRecipe.compareDocumentPosition(midEnergyRecipe) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).not.toBe(0);
		expect(
			midEnergyRecipe.compareDocumentPosition(lowEnergyRecipe) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).not.toBe(0);
	});

	it("initializes recipe defaults to 50 and does not show category label prefix", () => {
		render(
			<CookingSettingsPanel
				settings={createSettings({ recipeLevels: {} })}
				onChange={vi.fn()}
			/>,
		);

		expect(screen.queryByText("料理:")).toBeNull();
		expect(
			(screen.getByTestId("cooking-batch-level-input") as HTMLInputElement)
				.value,
		).toBe("50");
		expect(
			(screen.getByTestId("recipe-level-input-megaStew") as HTMLInputElement)
				.value,
		).toBe("50");
	});

	it("allows empty recipe level input temporarily and accepts direct 65 input", () => {
		const onChange = vi.fn();
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={onChange} />,
		);

		const levelInput = screen.getByTestId(
			"recipe-level-input-megaStew",
		) as HTMLInputElement;
		fireEvent.change(levelInput, { target: { value: "" } });
		expect(levelInput.value).toBe("");

		fireEvent.change(levelInput, { target: { value: "65" } });
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				recipeLevels: expect.objectContaining({ megaStew: 65 }),
			}),
		);
	});

	it("steps recipe level by 1 using minus/plus buttons", () => {
		const onChange = vi.fn();
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={onChange} />,
		);

		fireEvent.click(screen.getByTestId("recipe-level-decrement-megaStew"));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				recipeLevels: expect.objectContaining({ megaStew: 49 }),
			}),
		);

		fireEvent.click(screen.getByTestId("recipe-level-increment-megaStew"));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				recipeLevels: expect.objectContaining({ megaStew: 51 }),
			}),
		);
	});

	it("toggles recipe lock via lock icon button", () => {
		const onChange = vi.fn();
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={onChange} />,
		);

		fireEvent.click(screen.getByTestId("recipe-lock-toggle-megaStew"));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				disabledRecipes: expect.objectContaining({ megaStew: true }),
			}),
		);
	});

	it("steps initial ingredient count by 5 using minus/plus buttons", () => {
		const onChange = vi.fn();
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={onChange} />,
		);

		fireEvent.click(screen.getByTestId("ingredient-decrement-apple"));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				initialIngredients: expect.objectContaining({ apple: 25 }),
			}),
		);

		fireEvent.click(screen.getByTestId("ingredient-increment-apple"));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				initialIngredients: expect.objectContaining({ apple: 35 }),
			}),
		);
	});

	it("toggles extra ingredient lock via lock icon button", () => {
		const onChange = vi.fn();
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={onChange} />,
		);

		fireEvent.click(screen.getByTestId("ingredient-extra-lock-toggle-apple"));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				disabledExtraIngredients: expect.objectContaining({ apple: true }),
			}),
		);
	});

	it("uses the same text field style for batch level and recipe level input", () => {
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />,
		);

		const batchInput = screen.getByTestId("cooking-batch-level-input");
		const recipeInput = screen.getByTestId("recipe-level-input-megaStew");

		expect(batchInput.getAttribute("data-variant")).toBe(
			recipeInput.getAttribute("data-variant"),
		);
		expect(batchInput.getAttribute("data-size")).toBe(
			recipeInput.getAttribute("data-size"),
		);
	});

	it("aligns recipe level controls on a fixed grid columns layout", () => {
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />,
		);

		const recipeListSx =
			screen.getByTestId("recipe-level-list").getAttribute("data-sx") ?? "";
		const recipeRowSx =
			screen.getByTestId("recipe-row-megaStew").getAttribute("data-sx") ?? "";
		const recipeControlsSx =
			screen
				.getByTestId("recipe-level-controls-megaStew")
				.getAttribute("data-sx") ?? "";

		expect(recipeListSx).toContain('"width":"fit-content"');
		expect(recipeListSx).toContain('"maxWidth":"100%"');
		expect(recipeRowSx).toContain('"display":"grid"');
		expect(recipeRowSx).toContain(
			'"gridTemplateColumns":"minmax(0, 1fr) auto"',
		);
		expect(recipeControlsSx).toContain(
			'"gridTemplateColumns":"auto auto auto auto"',
		);
	});

	it("centers numeric text input values", () => {
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />,
		);

		const batchInputSx =
			screen.getByTestId("cooking-batch-level-input").getAttribute("data-sx") ??
			"";
		const recipeInputSx =
			screen
				.getByTestId("recipe-level-input-megaStew")
				.getAttribute("data-sx") ?? "";
		const ingredientInputSx =
			screen.getByTestId("ingredient-input-apple").getAttribute("data-sx") ??
			"";

		expect(batchInputSx).toContain('"textAlign":"center"');
		expect(batchInputSx).toContain('"WebkitAppearance":"none"');
		expect(batchInputSx).toContain('"MozAppearance":"textfield"');
		expect(recipeInputSx).toContain('"textAlign":"center"');
		expect(ingredientInputSx).toContain('"textAlign":"center"');
	});

	it("renders step buttons as contained circular gray style", () => {
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />,
		);

		const recipeMinusButton = screen.getByTestId(
			"recipe-level-decrement-megaStew",
		);
		const sxText = recipeMinusButton.getAttribute("data-sx") ?? "";

		expect(recipeMinusButton.getAttribute("data-variant")).toBe("contained");
		expect(sxText).toContain('"backgroundColor":"transparent"');
		expect(sxText).toContain("step-button-circle");
		expect(sxText).toContain('"width":"1.2rem"');
		expect(sxText).toContain('"height":"1.2rem"');
		expect(sxText).toContain('"borderRadius":"50%"');
	});

	it("shows recipe ingredient summary and total initial ingredient count", () => {
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />,
		);

		const summary = screen.getByTestId("recipe-ingredients-megaStew");
		expect(summary.textContent).toContain("[cooking]60");
		expect(summary.textContent).not.toContain("食材60");
		expect(
			screen.getByTestId("recipe-ingredients-cooking-icon-megaStew")
				.textContent,
		).toContain("[cooking]");
		expect(summary.textContent).toContain("[apple]30");
		expect(summary.textContent).toContain("[mushroom]30");

		expect(
			screen.getByTestId("cooking-initial-ingredients-total").textContent,
		).toContain("入力値合計: 654");

		const ingredientArea = screen.getByTestId("cooking-initial-ingredients");
		expect(within(ingredientArea).queryByText("とくせんリンゴ")).toBeNull();
	});

	it("shows lock icon description notes under recipe list and initial ingredient total", () => {
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />,
		);

		const recipeList = screen.getByTestId("recipe-level-list");
		const recipeLockNote = screen.getByTestId("cooking-recipe-lock-note");
		const recipeLockNoteIcon = screen.getByTestId(
			"cooking-recipe-lock-note-icon",
		);
		const initialIngredientTotal = screen.getByTestId(
			"cooking-initial-ingredients-total",
		);
		const extraIngredientLockNote = screen.getByTestId(
			"cooking-extra-ingredient-lock-note",
		);
		const extraIngredientLockNoteIcon = screen.getByTestId(
			"cooking-extra-ingredient-lock-note-icon",
		);

		expect(recipeLockNote.textContent).toContain(
			"：その料理を作成しないようにする",
		);
		expect(extraIngredientLockNote.textContent).toContain(
			"：追加食材として使用しないようにする",
		);
		expect(recipeLockNoteIcon.tagName.toLowerCase()).toBe("svg");
		expect(extraIngredientLockNoteIcon.tagName.toLowerCase()).toBe("svg");
		expect(
			recipeList.compareDocumentPosition(recipeLockNote) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).not.toBe(0);
		expect(
			initialIngredientTotal.compareDocumentPosition(extraIngredientLockNote) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).not.toBe(0);
	});

	it("uses timeline-equivalent icon size in recipe ingredient summary", () => {
		render(
			<CookingSettingsPanel settings={createSettings()} onChange={vi.fn()} />,
		);

		const iconWithSize = screen.getByTestId(
			"recipe-ingredient-icon-megaStew-apple",
		);
		const sxText = iconWithSize.getAttribute("data-sx") ?? "";
		expect(sxText).toContain('"width":"12px"');
		expect(sxText).toContain('"height":"12px"');
	});
});
