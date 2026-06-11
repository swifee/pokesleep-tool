import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ToolBar from "../../../ui/ToolBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("../../../ui/Dialog/AboutDialog", () => ({
	default: () => null,
}));

vi.mock("../../../ui/Dialog/HowToDialog", () => ({
	default: () => null,
}));

vi.mock("../../../ui/Dialog/SettingsDialog", () => ({
	default: () => null,
}));

describe("ToolBar TeamTimeline menu link", () => {
	it("navigates to TeamTimeline from the more menu", async () => {
		const onAppChange = vi.fn();

		render(
			<ToolBar
				app="IvCalc"
				onAppChange={onAppChange}
				onAppConfigChange={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "actions" }));
		fireEvent.click(await screen.findByText("TeamTimeline.short title"));

		expect(onAppChange).toHaveBeenCalledWith("TeamTimeline");
	});
});
