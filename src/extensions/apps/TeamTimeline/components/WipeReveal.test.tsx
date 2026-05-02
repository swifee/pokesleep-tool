import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import WipeReveal from "./WipeReveal";

interface CollapseProps {
	in?: boolean;
	timeout?: number;
	appear?: boolean;
	children?: React.ReactNode;
	style?: React.CSSProperties;
}

interface BoxProps {
	children?: React.ReactNode;
	sx?: unknown;
	className?: string;
	"data-testid"?: string;
}

vi.mock("@mui/material", () => ({
	Collapse: ({ in: open, timeout, appear, style, children }: CollapseProps) =>
		open ? (
			<div
				data-testid="mock-collapse"
				data-timeout={timeout}
				data-appear={appear ? "true" : "false"}
				data-style={JSON.stringify(style ?? {})}
			>
				{children}
			</div>
		) : null,
	Box: ({ children, sx, ...rest }: BoxProps) => (
		<div data-sx={sx ? JSON.stringify(sx) : undefined} {...rest}>
			{children}
		</div>
	),
}));

describe("WipeReveal", () => {
	it("does not render content when show is false", () => {
		render(
			<WipeReveal show={false}>
				<span>hidden content</span>
			</WipeReveal>,
		);

		expect(screen.queryByText("hidden content")).toBeNull();
	});

	it("renders content and passes duration and delay when show is true", () => {
		render(
			<WipeReveal show durationMs={320} delayMs={80} testId="wipe-reveal">
				<span>visible content</span>
			</WipeReveal>,
		);

		expect(screen.queryByText("visible content")).not.toBeNull();

		const collapse = screen.getByTestId("mock-collapse");
		expect(collapse.getAttribute("data-timeout")).toBe("320");
		expect(collapse.getAttribute("data-appear")).toBe("true");
		expect(collapse.getAttribute("data-style")).toContain(
			'"transitionDelay":"80ms"',
		);
	});

	it("disables appear animation when appear is false", () => {
		render(
			<WipeReveal show appear={false}>
				<span>visible content</span>
			</WipeReveal>,
		);

		const collapse = screen.getByTestId("mock-collapse");
		expect(collapse.getAttribute("data-appear")).toBe("false");
	});
});
