import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TimelineCell from "./TimelineCell";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue ?? key,
	}),
}));

describe("TimelineCell swap ui", () => {
	it("shows swap info as clickable box and hides standalone swap button when swap is configured", () => {
		const onSwapClick = vi.fn();

		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="カメックス Lv60"
				onSwapClick={onSwapClick}
			/>,
		);

		expect(container.querySelector(".swap-info")).not.toBeNull();
		fireEvent.click(screen.getByText("カメックス Lv60"));
		expect(onSwapClick).toHaveBeenCalledTimes(1);
		expect(container.querySelector(".swap-trigger")).toBeNull();
	});

	it("calls onRemoveSwapClick when x button is pressed and does not open swap selector", () => {
		const onSwapClick = vi.fn();
		const onRemoveSwapClick = vi.fn();

		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="デデンネ"
				onSwapClick={onSwapClick}
				onRemoveSwapClick={onRemoveSwapClick}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "入れ替え設定を解除" }));
		expect(onRemoveSwapClick).toHaveBeenCalledTimes(1);
		expect(onSwapClick).not.toHaveBeenCalled();
	});

	it("shows swap icon button when no swap is configured", () => {
		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				onSwapClick={vi.fn()}
			/>,
		);

		expect(container.querySelector(".swap-trigger")).not.toBeNull();
		expect(container.querySelector(".swap-info")).toBeNull();
	});

	it("uses the change icon for swap button and removes circular outer styling", () => {
		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				onSwapClick={vi.fn()}
			/>,
		);

		const swapButton = screen.getByTestId("timeline-cell-swap-toggle");
		const swapIcon = screen.getByTestId("timeline-cell-swap-icon");
		const style = getComputedStyle(swapButton);
		expect(swapIcon.getAttribute("data-icon-name")).toBe("change");
		expect(style.borderTopStyle).toBe("none");
		expect(Number.parseFloat(style.borderRadius)).toBe(0);
	});

	it("shows no-collect button in off state by default and calls toggle handler", () => {
		const onNoCollectToggle = vi.fn();

		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				onSwapClick={vi.fn()}
				onNoCollectToggle={onNoCollectToggle}
			/>,
		);

		const button = screen.getByTestId("timeline-cell-no-collect-toggle");
		const icon = screen.getByTestId("timeline-cell-no-collect-icon");
		const swapIcon = screen.getByTestId("timeline-cell-swap-icon");
		const style = getComputedStyle(button);
		const iconStyle = getComputedStyle(icon);
		const swapIconStyle = getComputedStyle(swapIcon);
		expect(button.getAttribute("data-enabled")).toBe("false");
		expect(button.getAttribute("data-always-visible")).toBe("false");
		expect(icon.getAttribute("data-icon-name")).toBe("pickup");
		expect(iconStyle.width).toBe("20px");
		expect(iconStyle.height).toBe("20px");
		expect(iconStyle.width).toBe(swapIconStyle.width);
		expect(iconStyle.height).toBe(swapIconStyle.height);
		expect(style.borderTopStyle).toBe("none");
		expect(Number.parseFloat(style.borderRadius)).toBe(0);
		fireEvent.click(button);
		expect(onNoCollectToggle).toHaveBeenCalledTimes(1);
	});

	it("shows no-collect button in on state when enabled", () => {
		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				noCollectEnabled
				onSwapClick={vi.fn()}
				onNoCollectToggle={vi.fn()}
			/>,
		);

		expect(
			screen
				.getByTestId("timeline-cell-no-collect-toggle")
				.getAttribute("data-enabled"),
		).toBe("true");
		const icon = screen.getByTestId("timeline-cell-no-collect-icon");
		const swapIcon = screen.getByTestId("timeline-cell-swap-icon");
		const iconStyle = getComputedStyle(icon);
		const swapIconStyle = getComputedStyle(swapIcon);
		expect(icon.getAttribute("data-icon-name")).toBe("pickup_none");
		expect(iconStyle.width).toBe("20px");
		expect(iconStyle.height).toBe("20px");
		expect(iconStyle.width).toBe(swapIconStyle.width);
		expect(iconStyle.height).toBe(swapIconStyle.height);
	});

	it("keeps no-collect button always visible when alwaysShowSwapButton is enabled", () => {
		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				alwaysShowSwapButton
				onNoCollectToggle={vi.fn()}
			/>,
		);

		expect(
			screen
				.getByTestId("timeline-cell-no-collect-toggle")
				.getAttribute("data-always-visible"),
		).toBe("true");
	});

	it("keeps no-collect button always visible in simple mode", () => {
		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				displayMode="simple"
				onNoCollectToggle={vi.fn()}
			/>,
		);

		expect(
			screen
				.getByTestId("timeline-cell-no-collect-toggle")
				.getAttribute("data-always-visible"),
		).toBe("true");
	});

	it("hides no-collect button when swap is configured", () => {
		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="ピカチュウ"
				onSwapClick={vi.fn()}
				onNoCollectToggle={vi.fn()}
			/>,
		);

		expect(screen.queryByTestId("timeline-cell-no-collect-toggle")).toBeNull();
	});

	it("renders empty content without placeholder dash in compact empty mode", () => {
		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				compactEmpty
				onSwapClick={vi.fn()}
			/>,
		);

		expect(container.textContent?.includes("-")).toBe(false);
	});

	it("keeps swap button always visible when alwaysShowSwapButton is enabled", () => {
		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				alwaysShowSwapButton
				onSwapClick={vi.fn()}
			/>,
		);

		const trigger = container.querySelector(
			".swap-trigger",
		) as HTMLElement | null;
		expect(trigger).not.toBeNull();
		expect(trigger?.getAttribute("data-always-visible")).toBe("true");
	});

	it("keeps swap button always visible in simple mode", () => {
		const { container } = render(
			<TimelineCell
				result={{
					slotId: "slot-1",
					pokemonId: 1,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 0,
					skillTriggerCount: 0,
					berryCount: 0,
					ingredients: [],
					skillIngredients: [],
					energyStart: 50,
					energyEnd: 50,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 0,
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
					proxySkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileCountAtStore: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				}}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				displayMode="simple"
				onSwapClick={vi.fn()}
			/>,
		);

		const trigger = container.querySelector(
			".swap-trigger",
		) as HTMLElement | null;
		expect(trigger).not.toBeNull();
		expect(trigger?.getAttribute("data-always-visible")).toBe("true");
	});

	it("uses compact layout and always-visible swap button for empty cell in simple mode", () => {
		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				displayMode="simple"
				onSwapClick={vi.fn()}
			/>,
		);

		const trigger = container.querySelector(
			".swap-trigger",
		) as HTMLElement | null;
		expect(trigger).not.toBeNull();
		expect(trigger?.getAttribute("data-always-visible")).toBe("true");
		expect(
			container.querySelector('[data-compact-layout="true"]'),
		).not.toBeNull();
	});

	it("shows swap info box even in compact empty mode", () => {
		const onSwapClick = vi.fn();
		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="ピカチュウ"
				compactEmpty
				alwaysShowSwapButton
				onSwapClick={onSwapClick}
			/>,
		);

		expect(container.querySelector(".swap-info")).not.toBeNull();
		fireEvent.click(screen.getByText("ピカチュウ"));
		expect(onSwapClick).toHaveBeenCalledTimes(1);
	});

	it("keeps swap info container bottom-aligned after simulation results", () => {
		const { container } = render(
			<TimelineCell
				result={{
					slotId: "slot-1",
					pokemonId: 1,
					teamIndex: 0,
					durationMinutes: 60,
					isSleeping: false,
					helpCount: 3,
					skillTriggerCount: 0,
					berryCount: 2,
					ingredients: [{ name: "sausage", count: 1 }],
					skillIngredients: [],
					energyStart: 50,
					energyEnd: 50,
					mealRecovery: 0,
					skillRecovery: 0,
					wakeRecovery: 0,
					energyDecay: 0,
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
					proxySkillEvents: [],
					presentCandyCount: 0,
					berryJuiceCount: 0,
					supportSkillBerryCount: 0,
					supportSkillBerryEP: 0,
					supportHelpEvents: [],
					stockpileStoreCount: 0,
					stockpileCountAtStore: 0,
					stockpileSpitCount: 0,
					badDreamsHitCount: 0,
					badDreamsTotalDamageGiven: 0,
					badDreamsDamageTaken: 0,
				}}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="サンダース"
				onSwapClick={vi.fn()}
			/>,
		);

		const swapInfoContainer = container.querySelector(
			"[data-swap-drag-state]",
		) as HTMLElement | null;
		expect(swapInfoContainer).not.toBeNull();
		expect(
			swapInfoContainer ? getComputedStyle(swapInfoContainer).marginTop : "",
		).toBe("auto");
	});

	it("hides leading swap icon and marks compact label in narrow viewport mode", () => {
		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="ラグラージ"
				fitToViewport
				onSwapClick={vi.fn()}
			/>,
		);

		expect(container.querySelector(".swap-info .swap-icon")).toBeNull();
		expect(
			screen.getByText("ラグラージ").getAttribute("data-compact-swap-name"),
		).toBe("true");
	});

	it("hides all swap UI and keeps compact layout when swap UI is disabled", () => {
		const { container } = render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				compactFirstSlot
				disableSwapUi
				onSwapClick={vi.fn()}
				hasSwap
				swappedPokemonName="フシギダネ"
			/>,
		);

		expect(container.querySelector(".swap-trigger")).toBeNull();
		expect(container.querySelector(".swap-info")).toBeNull();
		expect(
			container.querySelector('[data-compact-layout="true"]'),
		).not.toBeNull();
	});

	it("starts drag on long press and suppresses click-open right after", () => {
		vi.useFakeTimers();
		const onSwapClick = vi.fn();
		const onSwapLongPressStart = vi.fn();

		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="ピカチュウ"
				onSwapClick={onSwapClick}
				swapSlotId="slot-1"
				dayIndex={0}
				swapDraggable
				onSwapLongPressStart={onSwapLongPressStart}
			/>,
		);

		const swapInfoButton = screen.getByRole("button", { name: /ピカチュウ/i });
		fireEvent.pointerDown(swapInfoButton, {
			pointerId: 4,
			clientX: 20,
			clientY: 20,
			pointerType: "touch",
			button: 0,
		});
		vi.advanceTimersByTime(200);
		expect(onSwapLongPressStart).toHaveBeenCalledTimes(1);
		expect(onSwapLongPressStart).toHaveBeenCalledWith(
			expect.objectContaining({
				slotId: "slot-1",
				teamIndex: 0,
				dayIndex: 0,
				pointerId: 4,
				clientX: 20,
				clientY: 20,
				swappedPokemonName: "ピカチュウ",
			}),
		);
		fireEvent.pointerUp(swapInfoButton, {
			pointerId: 4,
			clientX: 20,
			clientY: 20,
			pointerType: "touch",
		});
		fireEvent.click(swapInfoButton);
		expect(onSwapClick).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it("starts drag on long press from remove button and suppresses remove click right after", () => {
		vi.useFakeTimers();
		const onSwapLongPressStart = vi.fn();
		const onRemoveSwapClick = vi.fn();

		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="ピカチュウ"
				onSwapClick={vi.fn()}
				onRemoveSwapClick={onRemoveSwapClick}
				swapSlotId="slot-1"
				dayIndex={0}
				swapDraggable
				onSwapLongPressStart={onSwapLongPressStart}
			/>,
		);

		const removeButton = screen.getByRole("button", {
			name: "入れ替え設定を解除",
		});
		fireEvent.pointerDown(removeButton, {
			pointerId: 6,
			clientX: 20,
			clientY: 20,
			pointerType: "touch",
			button: 0,
		});
		vi.advanceTimersByTime(200);
		expect(onSwapLongPressStart).toHaveBeenCalledTimes(1);
		fireEvent.pointerUp(removeButton, {
			pointerId: 6,
			clientX: 20,
			clientY: 20,
			pointerType: "touch",
		});
		fireEvent.click(removeButton);
		expect(onRemoveSwapClick).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it("suppresses context menu while long-press drag is enabled", () => {
		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="ピカチュウ"
				onSwapClick={vi.fn()}
				swapSlotId="slot-1"
				dayIndex={0}
				swapDraggable
				onSwapLongPressStart={vi.fn()}
			/>,
		);

		const swapInfoButton = screen.getByRole("button", { name: /ピカチュウ/i });
		const contextMenuEvent = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
		});
		const dispatchResult = swapInfoButton.dispatchEvent(contextMenuEvent);

		expect(dispatchResult).toBe(false);
		expect(contextMenuEvent.defaultPrevented).toBe(true);
	});

	it("keeps normal click behavior when long-press conditions are not met", () => {
		vi.useFakeTimers();
		const onSwapClick = vi.fn();
		const onSwapLongPressStart = vi.fn();

		render(
			<TimelineCell
				result={null}
				isSleeping={false}
				slotId="slot-1"
				teamIndex={0}
				hasSwap
				swappedPokemonName="カビゴン"
				onSwapClick={onSwapClick}
				swapSlotId="slot-1"
				dayIndex={0}
				swapDraggable={false}
				onSwapLongPressStart={onSwapLongPressStart}
			/>,
		);

		const swapInfoButton = screen.getByRole("button", { name: /カビゴン/i });
		fireEvent.pointerDown(swapInfoButton, {
			pointerId: 5,
			clientX: 10,
			clientY: 10,
			pointerType: "touch",
			button: 0,
		});
		vi.advanceTimersByTime(200);
		fireEvent.pointerUp(swapInfoButton, {
			pointerId: 5,
			clientX: 10,
			clientY: 10,
			pointerType: "touch",
		});
		fireEvent.click(swapInfoButton);

		expect(onSwapLongPressStart).not.toHaveBeenCalled();
		expect(onSwapClick).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});
});
