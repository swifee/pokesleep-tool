import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import SimulationControls from "./SimulationControls";

interface ChildrenProps {
	children?: React.ReactNode;
}

interface BoxProps extends ChildrenProps {
	sx?: unknown;
	"data-testid"?: string;
}

interface ButtonProps extends ChildrenProps {
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	disabled?: boolean;
	sx?: unknown;
	"aria-valuenow"?: number;
	"aria-valuemin"?: number;
	"aria-valuemax"?: number;
	"data-testid"?: string;
}

interface CheckboxProps {
	checked?: boolean;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
	disabled?: boolean;
	"aria-label"?: string;
	inputProps?: Record<string, string>;
}

interface FormControlLabelProps {
	control?: React.ReactNode;
	label?: React.ReactNode;
}

interface TextFieldProps {
	type?: string;
	value?: string | number;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
	disabled?: boolean;
}

interface SelectProps extends ChildrenProps {
	value?: string | number;
	onChange?: React.ChangeEventHandler<HTMLSelectElement>;
	renderValue?: (value: unknown) => React.ReactNode;
	disabled?: boolean;
	"data-testid"?: string;
}

interface MenuItemProps extends ChildrenProps {
	value?: string | number;
}

vi.mock("@mui/material", () => ({
	Box: ({ children, sx, ...rest }: BoxProps) => (
		<div data-sx={sx ? JSON.stringify(sx) : undefined} {...rest}>
			{children}
		</div>
	),
	Typography: ({ children }: ChildrenProps) => <span>{children}</span>,
	Button: ({ children, onClick, disabled, sx, ...rest }: ButtonProps) => (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			data-sx={sx ? JSON.stringify(sx) : undefined}
			{...rest}
		>
			{children}
		</button>
	),
	IconButton: ({ children, onClick, disabled, ...rest }: ButtonProps) => (
		<button type="button" onClick={onClick} disabled={disabled} {...rest}>
			{children}
		</button>
	),
	Checkbox: ({ checked, onChange, disabled }: CheckboxProps) => (
		<input
			type="checkbox"
			checked={checked}
			onChange={onChange}
			disabled={disabled}
			aria-label="seed-checkbox"
		/>
	),
	Switch: ({
		checked,
		onChange,
		disabled,
		inputProps,
		...rest
	}: CheckboxProps) => (
		<input
			type="checkbox"
			checked={checked}
			onChange={onChange}
			disabled={disabled}
			aria-label={inputProps?.["aria-label"]}
			{...rest}
		/>
	),
	FormControlLabel: ({ control, label }: FormControlLabelProps) => (
		<div>
			{control}
			{label}
		</div>
	),
	TextField: ({ type, value, onChange, disabled }: TextFieldProps) => (
		<input
			type={type ?? "text"}
			value={value}
			onChange={onChange}
			disabled={disabled}
			aria-label="seed-input"
		/>
	),
	Select: ({
		value,
		onChange,
		children,
		renderValue,
		disabled,
		...rest
	}: SelectProps) => {
		void renderValue;
		return (
			<select value={value} onChange={onChange} disabled={disabled} {...rest}>
				{children}
			</select>
		);
	},
	MenuItem: ({ value, children }: MenuItemProps) => (
		<option value={value}>{children}</option>
	),
}));

vi.mock("@mui/icons-material/Settings", () => ({
	default: () => <span>settings</span>,
}));

vi.mock("../../../../data/fields", () => ({
	default: [
		{ index: 0, name: "Greengrass Isle", emoji: "🏝️" },
		{ index: 1, name: "Cyan Beach", emoji: "🏖️" },
		{ index: 7, name: "Greengrass Isle EX", emoji: "🌱" },
	],
	getFavoriteBerries: (index: number) => {
		if (index === 1) {
			return ["water", "fairy", "flying"];
		}
		if (index === 7) {
			return ["poison", "bug", "dragon"];
		}
		return [];
	},
	isExpertField: (index: number) => index === 7,
}));

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

function renderControls(
	overrides?: Partial<React.ComponentProps<typeof SimulationControls>>,
) {
	const defaultBonusSettings = createDefaultTimelineBonusSettings();
	const props: React.ComponentProps<typeof SimulationControls> = {
		bonusSettings: {
			...defaultBonusSettings,
			fieldIndex: 0,
			isGoodCampTicketSet: false,
			event: "none",
		},
		fieldIndex: 0,
		isGoodCampTicketSet: false,
		cookingSimEnabled: false,
		cookingCategory: "curry",
		eventName: "none",
		seedMode: "random",
		seed: 123,
		simulationDays: 1,
		startDayOfWeek: 1,
		multiTrialCount: 100,
		simulationLoading: false,
		simulationProgress: 0,
		isTeamEmpty: false,
		onFieldIndexChange: vi.fn(),
		onGoodCampTicketChange: vi.fn(),
		onCookingSimEnabledChange: vi.fn(),
		onCookingCategoryChange: vi.fn(),
		onOpenSettingsTab: vi.fn(),
		onSeedModeChange: vi.fn(),
		onSeedChange: vi.fn(),
		onSimulationDaysChange: vi.fn(),
		onStartDayOfWeekChange: vi.fn(),
		onTrialCountChange: vi.fn(),
		onRunSimulation: vi.fn(),
		...overrides,
	};

	const view = render(<SimulationControls {...props} />);
	return { ...view, props };
}

describe("SimulationControls", () => {
	it("disables cooking category select when cooking simulation is off", () => {
		const { rerender } = renderControls({ cookingSimEnabled: false });
		expect(
			(screen.getByTestId("cooking-category-select") as HTMLSelectElement)
				.disabled,
		).toBe(true);

		rerender(
			<SimulationControls
				bonusSettings={createDefaultTimelineBonusSettings()}
				fieldIndex={0}
				isGoodCampTicketSet={false}
				cookingSimEnabled
				cookingCategory="curry"
				eventName="none"
				seedMode="random"
				seed={123}
				simulationDays={1}
				startDayOfWeek={1}
				multiTrialCount={100}
				simulationLoading={false}
				simulationProgress={0}
				isTeamEmpty={false}
				onFieldIndexChange={vi.fn()}
				onGoodCampTicketChange={vi.fn()}
				onCookingSimEnabledChange={vi.fn()}
				onCookingCategoryChange={vi.fn()}
				onOpenSettingsTab={vi.fn()}
				onSeedModeChange={vi.fn()}
				onSeedChange={vi.fn()}
				onSimulationDaysChange={vi.fn()}
				onStartDayOfWeekChange={vi.fn()}
				onTrialCountChange={vi.fn()}
				onRunSimulation={vi.fn()}
			/>,
		);
		expect(
			(screen.getByTestId("cooking-category-select") as HTMLSelectElement)
				.disabled,
		).toBe(false);
	});

	it("shows read-only summary text for field/camp/event and keeps settings navigation", () => {
		const base = createDefaultTimelineBonusSettings();
		const { props } = renderControls({
			fieldIndex: 7,
			bonusSettings: {
				...base,
				fieldIndex: 7,
				favoriteType: ["poison", "bug", "dragon"],
				expertEffect: "berry",
			},
		});

		expect(
			screen.getByText(
				"Greengrass Isle EX(poison/bug/dragon/きのみエナジー2.4倍)",
			),
		).toBeDefined();
		expect(screen.getByText("キャンチケOFF")).toBeDefined();
		expect(screen.getByText("イベントなし")).toBeDefined();
		expect(screen.queryByTestId("field-select")).toBeNull();
		expect(screen.queryByLabelText("good-camp-ticket-switch")).toBeNull();

		fireEvent.click(screen.getByTestId("event-settings-button"));
		expect(props.onOpenSettingsTab).toHaveBeenCalledTimes(1);
	});

	it("wraps all controls in one white rounded panel", () => {
		renderControls();
		const panel = screen.getByTestId("simulation-controls-panel");
		const panelStyle = panel.getAttribute("data-sx");

		expect(panelStyle).toContain('"width":"100%"');
		expect(panelStyle).toContain('"boxSizing":"border-box"');
		expect(panelStyle).toContain('"backgroundColor":"#fff"');
		expect(panelStyle).toContain('"borderRadius":"6px"');
	});

	it("updates cooking settings and opens settings tab", () => {
		const { props } = renderControls({ cookingSimEnabled: true });

		fireEvent.click(screen.getByLabelText("cooking-sim-switch"));
		fireEvent.change(screen.getByTestId("cooking-category-select"), {
			target: { value: "salad" },
		});
		fireEvent.click(screen.getByTestId("event-settings-button"));

		expect(props.onCookingSimEnabledChange).toHaveBeenCalledWith(false);
		expect(props.onCookingCategoryChange).toHaveBeenCalledWith("salad");
		expect(props.onFieldIndexChange).not.toHaveBeenCalled();
		expect(props.onGoodCampTicketChange).not.toHaveBeenCalled();
		expect(props.onOpenSettingsTab).toHaveBeenCalledTimes(1);
	});

	it("toggles seed mode to fixed", () => {
		const { props } = renderControls();

		fireEvent.click(screen.getByLabelText("seed-checkbox"));

		expect(props.onSeedModeChange).toHaveBeenCalledWith("fixed");
	});

	it("updates seed, period, and trial count", () => {
		const { props } = renderControls();

		fireEvent.change(screen.getByLabelText("seed-input"), {
			target: { value: "999" },
		});
		fireEvent.change(screen.getByTestId("simulation-days-select"), {
			target: { value: "3" },
		});
		fireEvent.change(screen.getByTestId("trial-count-select"), {
			target: { value: "1000" },
		});

		expect(props.onSeedChange).toHaveBeenCalledWith(999);
		expect(props.onSimulationDaysChange).toHaveBeenCalledWith(3);
		expect(props.onTrialCountChange).toHaveBeenCalledWith(1000);
	});

	it("renders start weekday select next to the period select with Monday-first options", () => {
		renderControls({ simulationDays: 3, startDayOfWeek: 3 });

		const select = screen.getByTestId(
			"start-day-of-week-select",
		) as HTMLSelectElement;
		expect(select.disabled).toBe(false);
		expect(select.value).toBe("3");
		expect(screen.getByText("開始曜日")).toBeDefined();
		expect(
			Array.from(select.options).map((option) => option.textContent),
		).toEqual(["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"]);
		expect(Array.from(select.options).map((option) => option.value)).toEqual([
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"0",
		]);
	});

	it("allows choosing any start weekday for 1 to 6 day periods", () => {
		for (const days of [1, 2, 3, 4, 5, 6]) {
			const { props, unmount } = renderControls({
				simulationDays: days,
				startDayOfWeek: 1,
			});

			const select = screen.getByTestId(
				"start-day-of-week-select",
			) as HTMLSelectElement;
			expect(select.disabled).toBe(false);

			fireEvent.change(select, { target: { value: "0" } });
			expect(props.onStartDayOfWeekChange).toHaveBeenCalledWith(0);
			unmount();
		}
	});

	it("locks start weekday to Monday and disables the select for 7 day periods", () => {
		renderControls({ simulationDays: 7, startDayOfWeek: 5 });

		const select = screen.getByTestId(
			"start-day-of-week-select",
		) as HTMLSelectElement;
		expect(select.disabled).toBe(true);
		expect(select.value).toBe("1");
	});

	it("keeps run button enabled while loading and disables only when team is empty", () => {
		const { rerender } = render(
			<SimulationControls
				bonusSettings={createDefaultTimelineBonusSettings()}
				fieldIndex={0}
				isGoodCampTicketSet={false}
				cookingSimEnabled={false}
				cookingCategory="curry"
				eventName="none"
				seedMode="random"
				seed={123}
				simulationDays={1}
				startDayOfWeek={1}
				multiTrialCount={100}
				simulationLoading={false}
				simulationProgress={0}
				isTeamEmpty={false}
				onFieldIndexChange={vi.fn()}
				onGoodCampTicketChange={vi.fn()}
				onCookingSimEnabledChange={vi.fn()}
				onCookingCategoryChange={vi.fn()}
				onOpenSettingsTab={vi.fn()}
				onSeedModeChange={vi.fn()}
				onSeedChange={vi.fn()}
				onSimulationDaysChange={vi.fn()}
				onStartDayOfWeekChange={vi.fn()}
				onTrialCountChange={vi.fn()}
				onRunSimulation={vi.fn()}
			/>,
		);

		expect(
			(
				screen.getByRole("button", {
					name: "シミュレーション",
				}) as HTMLButtonElement
			).disabled,
		).toBe(false);

		rerender(
			<SimulationControls
				bonusSettings={createDefaultTimelineBonusSettings()}
				fieldIndex={0}
				isGoodCampTicketSet={false}
				cookingSimEnabled={false}
				cookingCategory="curry"
				eventName="none"
				seedMode="random"
				seed={123}
				simulationDays={1}
				startDayOfWeek={1}
				multiTrialCount={100}
				simulationLoading
				simulationProgress={40}
				isTeamEmpty={false}
				onFieldIndexChange={vi.fn()}
				onGoodCampTicketChange={vi.fn()}
				onCookingSimEnabledChange={vi.fn()}
				onCookingCategoryChange={vi.fn()}
				onOpenSettingsTab={vi.fn()}
				onSeedModeChange={vi.fn()}
				onSeedChange={vi.fn()}
				onSimulationDaysChange={vi.fn()}
				onStartDayOfWeekChange={vi.fn()}
				onTrialCountChange={vi.fn()}
				onRunSimulation={vi.fn()}
			/>,
		);
		expect(
			(
				screen.getByRole("button", {
					name: "シミュレーション",
				}) as HTMLButtonElement
			).disabled,
		).toBe(false);

		rerender(
			<SimulationControls
				bonusSettings={createDefaultTimelineBonusSettings()}
				fieldIndex={0}
				isGoodCampTicketSet={false}
				cookingSimEnabled={false}
				cookingCategory="curry"
				eventName="none"
				seedMode="random"
				seed={123}
				simulationDays={1}
				startDayOfWeek={1}
				multiTrialCount={100}
				simulationLoading={false}
				simulationProgress={100}
				isTeamEmpty
				onFieldIndexChange={vi.fn()}
				onGoodCampTicketChange={vi.fn()}
				onCookingSimEnabledChange={vi.fn()}
				onCookingCategoryChange={vi.fn()}
				onOpenSettingsTab={vi.fn()}
				onSeedModeChange={vi.fn()}
				onSeedChange={vi.fn()}
				onSimulationDaysChange={vi.fn()}
				onStartDayOfWeekChange={vi.fn()}
				onTrialCountChange={vi.fn()}
				onRunSimulation={vi.fn()}
			/>,
		);
		expect(
			(
				screen.getByRole("button", {
					name: "シミュレーション",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
	});

	it("passes progress value to run button while loading", () => {
		renderControls({
			simulationLoading: true,
			simulationProgress: 65,
		});

		expect(
			screen
				.getByRole("button", { name: "シミュレーション" })
				.getAttribute("aria-valuenow"),
		).toBe("65");
	});

	it("uses lighter progress track color while loading", () => {
		renderControls({
			simulationLoading: true,
			simulationProgress: 40,
		});

		expect(
			screen
				.getByRole("button", { name: "シミュレーション" })
				.getAttribute("data-sx"),
		).toContain('"background":"#94bffc"');
	});
});
