import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeamTimelineTabs from "./TeamTimelineTabs";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue ?? key,
	}),
}));

describe("TeamTimelineTabs", () => {
	it("switches tabs through onTabChange", () => {
		const onTabChange = vi.fn();
		render(
			<TeamTimelineTabs
				activeTab="team"
				onTabChange={onTabChange}
				onNavigateToBox={() => undefined}
			/>,
		);

		fireEvent.click(screen.getByRole("tab", { name: "料理設定" }));

		expect(onTabChange).toHaveBeenCalledWith("cooking");
	});

	it("shows the box tab at the right end and navigates instead of switching tabs", () => {
		const onTabChange = vi.fn();
		const onNavigateToBox = vi.fn();
		render(
			<TeamTimelineTabs
				activeTab="team"
				onTabChange={onTabChange}
				onNavigateToBox={onNavigateToBox}
			/>,
		);

		const tabs = screen.getAllByRole("tab");
		expect(tabs[tabs.length - 1].textContent).toBe("ボックス");

		fireEvent.click(screen.getByRole("tab", { name: "ボックス" }));

		expect(onNavigateToBox).toHaveBeenCalledTimes(1);
		expect(onTabChange).not.toHaveBeenCalled();
	});

	it("hides the box tab when navigation is not available", () => {
		render(<TeamTimelineTabs activeTab="team" onTabChange={() => undefined} />);

		expect(screen.queryByRole("tab", { name: "ボックス" })).toBeNull();
		expect(screen.getAllByRole("tab")).toHaveLength(4);
	});

	it("shows the auto simulation tab first and the detailed one second", () => {
		const onTabChange = vi.fn();
		render(<TeamTimelineTabs activeTab="team" onTabChange={onTabChange} />);

		expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
			"自動シミュ",
			"詳細シミュ",
			"基本設定",
			"料理設定",
		]);

		fireEvent.click(screen.getByRole("tab", { name: "自動シミュ" }));

		expect(onTabChange).toHaveBeenCalledWith("quick");
	});
});
