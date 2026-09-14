import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DraftNumberField from "./DraftNumberField";

function renderField(value: number) {
	const onCommit = vi.fn();
	render(
		<DraftNumberField
			value={value}
			onCommit={onCommit}
			data-testid="field"
			aria-label="count"
		/>,
	);
	const input = screen.getByTestId("field").querySelector("input");
	if (!input) {
		throw new Error("input not found");
	}
	return { input, onCommit };
}

describe("DraftNumberField", () => {
	it("renders a numeric text input with the committed value", () => {
		const { input } = renderField(66);
		expect(input.value).toBe("66");
		expect(input.getAttribute("type")).toBe("text");
		expect(input.getAttribute("inputmode")).toBe("numeric");
	});

	it("commits typed digits and lets the field be emptied to 0 while typing", () => {
		const { input, onCommit } = renderField(66);

		fireEvent.change(input, { target: { value: "6" } });
		expect(onCommit).toHaveBeenLastCalledWith(6);

		fireEvent.change(input, { target: { value: "" } });
		expect(onCommit).toHaveBeenLastCalledWith(0);
		expect(input.value).toBe("");

		fireEvent.change(input, { target: { value: "8" } });
		expect(onCommit).toHaveBeenLastCalledWith(8);
	});

	it("ignores non-digit input and restores the value on blur", () => {
		const { input, onCommit } = renderField(12);

		fireEvent.change(input, { target: { value: "1a" } });
		expect(onCommit).not.toHaveBeenCalled();
		expect(input.value).toBe("12");

		fireEvent.change(input, { target: { value: "" } });
		fireEvent.blur(input);
		expect(input.value).toBe("12");
	});
});
