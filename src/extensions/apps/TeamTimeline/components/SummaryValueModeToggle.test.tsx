import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SummaryValueModeToggle from "./SummaryValueModeToggle";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string, options?: { days?: number }) => {
			if (defaultValue) {
				return defaultValue.replace("{{days}}", String(options?.days ?? ""));
			}
			return key;
		},
	}),
}));

describe("SummaryValueModeToggle", () => {
	it("shows simulation day count for period total and 1 day for daily average", () => {
		render(
			<SummaryValueModeToggle
				value="periodTotal"
				simulationDays={7}
				onChange={() => undefined}
			/>,
		);

		expect(screen.getByRole("button", { name: "7日" })).toBeDefined();
		expect(screen.getByRole("button", { name: "1日" })).toBeDefined();
	});

	it("clamps period total day label to at least 1 day", () => {
		render(
			<SummaryValueModeToggle
				value="periodTotal"
				simulationDays={0}
				onChange={() => undefined}
			/>,
		);

		const buttons = screen.getAllByRole("button", { name: "1日" });
		expect(buttons.length).toBe(2);
	});

	it("calls onChange with dailyAverage when second button is clicked", () => {
		const handleChange = vi.fn();
		render(
			<SummaryValueModeToggle
				value="periodTotal"
				simulationDays={7}
				onChange={handleChange}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "1日" }));
		expect(handleChange).toHaveBeenCalledWith("dailyAverage");
	});
});
