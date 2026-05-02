import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResimulationNoticeBar from "./ResimulationNoticeBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
	}),
}));

describe("ResimulationNoticeBar", () => {
	it("does not render when closed", () => {
		const { queryByTestId } = render(
			<ResimulationNoticeBar open={false} onResimulate={vi.fn()} />,
		);

		expect(queryByTestId("resimulation-notice-bar")).toBeNull();
	});

	it("renders and triggers re-simulation callback", () => {
		const onResimulate = vi.fn();
		render(<ResimulationNoticeBar open onResimulate={onResimulate} />);

		expect(screen.getByText("メンバー編成が変更されました。")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "再シミュレーション" }));
		expect(onResimulate).toHaveBeenCalledTimes(1);
	});

	it("renders result summary and handles undo/close callbacks", () => {
		const onUndo = vi.fn();
		const onClose = vi.fn();
		render(
			<ResimulationNoticeBar
				open
				mode="result"
				deltaSummary={{
					averageTotalEP: 100000,
					totalDeltaEP: 10000,
					berryDeltaEP: 2000,
					skillDeltaEP: 3000,
					cookingDeltaEP: 5000,
				}}
				onResimulate={vi.fn()}
				onUndo={onUndo}
				onClose={onClose}
			/>,
		);

		expect(
			screen.getByTestId("resimulation-result-total").textContent,
		).toContain("total 100,000EP (+10,000)");
		expect(
			screen.getByTestId("resimulation-result-item-berry").textContent,
		).toContain("+2,000");
		expect(
			screen.getByTestId("resimulation-result-item-skill").textContent,
		).toContain("+3,000");
		expect(
			screen.getByTestId("resimulation-result-item-cooking").textContent,
		).toContain("+5,000");
		expect(screen.getByTestId("resimulation-result-icon-berry")).toBeDefined();
		expect(screen.getByTestId("resimulation-result-icon-skill")).toBeDefined();
		expect(
			screen.getByTestId("resimulation-result-icon-cooking"),
		).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
		fireEvent.click(screen.getByRole("button", { name: "OK" }));

		expect(onUndo).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
