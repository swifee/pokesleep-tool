import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IvCalcAppWithTimelineTab from "./IvCalcAppWithTimelineTab";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue ?? key,
	}),
}));

// Stand-in for the protected IvCalcApp: an upper tab bar followed by a lower one,
// mirroring the DOM order in src/ui/IvCalc/IvCalcApp.tsx.
vi.mock("../../../ui/IvCalc/IvCalcApp", async () => {
	const { Tab, Tabs } = await import("@mui/material");
	return {
		default: () => (
			<>
				<Tabs value={0}>
					<Tab label="rp" />
					<Tab label="team" />
				</Tabs>
				<Tabs value={0}>
					<Tab label="pokemon" />
					<Tab label="box" />
				</Tabs>
			</>
		),
	};
});

describe("IvCalcAppWithTimelineTab", () => {
	it("appends a TL tab after the team tab in the upper tab bar", () => {
		render(<IvCalcAppWithTimelineTab onAppChange={vi.fn()} />);

		const upperTabList = screen.getAllByRole("tablist")[0];
		const labels = Array.from(
			upperTabList.querySelectorAll("[role='tab']"),
		).map((tab) => tab.textContent);

		expect(labels).toEqual(["rp", "team", "TL"]);
	});

	it("navigates to TeamTimeline when the TL tab is clicked", () => {
		const onAppChange = vi.fn();
		render(<IvCalcAppWithTimelineTab onAppChange={onAppChange} />);

		fireEvent.click(screen.getByRole("tab", { name: "TL" }));

		expect(onAppChange).toHaveBeenCalledWith("TeamTimeline");
	});
});
