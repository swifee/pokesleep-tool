import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuickSimImportConfirmDialog from "./QuickSimImportConfirmDialog";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue ?? key,
	}),
}));

describe("QuickSimImportConfirmDialog", () => {
	it("renders the confirmation text and forwards the actions", () => {
		const onCancel = vi.fn();
		const onConfirm = vi.fn();
		render(
			<QuickSimImportConfirmDialog
				open
				onCancel={onCancel}
				onConfirm={onConfirm}
			/>,
		);

		expect(
			screen.getByText(
				"詳細シミュのチームを取り込みます。現在のメンバーと起用率は置き換えられます。よろしいですか？",
			),
		).toBeDefined();

		fireEvent.click(screen.getByTestId("quick-sim-import-cancel-button"));
		expect(onCancel).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByTestId("quick-sim-import-confirm-button"));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("renders nothing while closed", () => {
		render(
			<QuickSimImportConfirmDialog
				open={false}
				onCancel={vi.fn()}
				onConfirm={vi.fn()}
			/>,
		);
		expect(screen.queryByTestId("quick-sim-import-confirm-button")).toBeNull();
	});
});
