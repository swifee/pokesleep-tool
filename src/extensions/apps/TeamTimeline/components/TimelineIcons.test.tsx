import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamTimelineIcon, { type TeamTimelineIconName } from "./TimelineIcons";

const ICON_NAMES: readonly TeamTimelineIconName[] = [
	"bag",
	"berry",
	"berry_huge",
	"berry_zone",
	"change",
	"cooking",
	"dream",
	"heal",
	"pickup",
	"pickup_none",
	"skill",
	"skill_none",
	"sleep",
	"wakeup",
	"work",
];

describe("TeamTimelineIcon", () => {
	ICON_NAMES.forEach((name) => {
		it(`renders ${name} icon`, () => {
			render(
				<TeamTimelineIcon name={name} data-testid={`timeline-icon-${name}`} />,
			);
			const icon = screen.getByTestId(`timeline-icon-${name}`);
			expect(icon.tagName.toLowerCase()).toBe("svg");
			expect(icon.querySelector("path, circle, rect, ellipse")).not.toBeNull();
		});
	});

	it("renders berry_zone as a curved diamond above a zone ellipse", () => {
		render(
			<TeamTimelineIcon name="berry_zone" data-testid="timeline-icon-zone" />,
		);
		const icon = screen.getByTestId("timeline-icon-zone");
		const ellipse = icon.querySelector("ellipse");
		const diamond = icon.querySelector("path");
		expect(ellipse).not.toBeNull();
		expect(diamond).not.toBeNull();
		// ひし形はカーブした辺（Q コマンド）で描く
		expect(diamond?.getAttribute("d")).toContain("Q");
		// 楕円はひし形の下側に置く
		const ellipseCenterY = Number(ellipse?.getAttribute("cy"));
		const diamondTopY = Number(
			diamond?.getAttribute("d")?.match(/^M\s*\d+\s+(\d+)/)?.[1],
		);
		expect(ellipseCenterY).toBeGreaterThan(diamondTopY);
	});

	it("renders skill_none with transparent interior", () => {
		render(
			<TeamTimelineIcon
				name="skill_none"
				data-testid="timeline-icon-skill-none-transparent"
			/>,
		);
		const icon = screen.getByTestId("timeline-icon-skill-none-transparent");
		expect(icon.querySelector("path")?.getAttribute("fill")).toBe("none");
		expect(icon.querySelector("circle")?.getAttribute("fill")).toBe("none");
	});
});
