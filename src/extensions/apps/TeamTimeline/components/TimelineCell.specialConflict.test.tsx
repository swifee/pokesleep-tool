import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimeSlotResult } from "../types/TimeSlotTypes";
import TimelineCell from "./TimelineCell";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue ?? key,
	}),
}));

/** とくべつなポケモンが重複しているセルの背景（TimelineCell と同じ値） */
const CONFLICT_BACKGROUND = "rgb(253, 232, 232)";
const SLEEPING_BACKGROUND = "rgb(245, 246, 251)";

function createResult(): TimeSlotResult {
	return {
		slotId: "slot-1",
		pokemonId: 1,
		teamIndex: 0,
		durationMinutes: 180,
		isSleeping: false,
		helpCount: 3,
		skillTriggerCount: 0,
		berryCount: 2,
		ingredients: [],
		energyStart: 100,
		energyEnd: 90,
		mealRecovery: 0,
		skillRecovery: 0,
		wakeRecovery: 0,
		energyDecay: 10,
		skillOverflowCount: 0,
		overflowIngredients: [],
		selfSkillRecovery: 0,
		directSkillEP: 0,
		moonlightGivenRecovery: 0,
		moonlightReceivedRecovery: 0,
		energizingCheerGivenRecovery: 0,
		energizingCheerReceivedRecovery: 0,
		energizingCheerEvents: [],
		nuzzleTriggeredSkillEvents: [],
		presentCandyCount: 0,
		berryJuiceCount: 0,
		supportSkillBerryCount: 0,
		supportSkillBerryEP: 0,
		supportHelpEvents: [],
		stockpileStoreCount: 0,
		stockpileSpitCount: 0,
		badDreamsHitCount: 0,
		badDreamsTotalDamageGiven: 0,
		badDreamsDamageTaken: 0,
	};
}

function cellOf(container: HTMLElement): HTMLElement {
	const cell = container.querySelector("[data-special-conflict]");
	if (!(cell instanceof HTMLElement)) {
		throw new Error("cell not found");
	}
	return cell;
}

describe("TimelineCell special Pokémon conflict", () => {
	it("is not highlighted by default", () => {
		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
			/>,
		);
		const cell = cellOf(container);
		expect(cell.getAttribute("data-special-conflict")).toBe("false");
		expect(getComputedStyle(cell).backgroundColor).toBe("rgb(255, 255, 255)");
	});

	it("colors an empty cell, a detailed cell and a simple cell when flagged", () => {
		for (const props of [
			{ result: null, displayMode: "detailed" as const },
			{ result: createResult(), displayMode: "detailed" as const },
			{ result: createResult(), displayMode: "simple" as const },
		]) {
			const { container, unmount } = render(
				<TimelineCell
					result={props.result}
					isSleeping={false}
					slotId="slot-1"
					teamIndex={0}
					displayMode={props.displayMode}
					specialConflict
				/>,
			);
			const cell = cellOf(container);
			expect(cell.getAttribute("data-special-conflict")).toBe("true");
			expect(getComputedStyle(cell).backgroundColor).toBe(CONFLICT_BACKGROUND);
			unmount();
		}
	});

	it("takes precedence over the sleeping background but not over the drag target", () => {
		const sleeping = render(
			<TimelineCell
				result={null}
				isSleeping
				slotId="slot-1"
				teamIndex={0}
				specialConflict
			/>,
		);
		expect(getComputedStyle(cellOf(sleeping.container)).backgroundColor).toBe(
			CONFLICT_BACKGROUND,
		);
		sleeping.unmount();

		const plainSleeping = render(
			<TimelineCell result={null} isSleeping slotId="slot-1" teamIndex={0} />,
		);
		expect(
			getComputedStyle(cellOf(plainSleeping.container)).backgroundColor,
		).toBe(SLEEPING_BACKGROUND);
		plainSleeping.unmount();

		const dragTarget = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				specialConflict
				swapDragState="target"
			/>,
		);
		expect(getComputedStyle(cellOf(dragTarget.container)).backgroundColor).toBe(
			"rgb(255, 244, 222)",
		);
	});
});
