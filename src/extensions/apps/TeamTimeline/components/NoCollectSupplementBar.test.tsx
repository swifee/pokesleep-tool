import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NoCollectSupplementEntry } from "../utils/NoCollectSupplementUtils";
import NoCollectSupplementBar from "./NoCollectSupplementBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
	}),
}));

vi.mock("../../../../ui/IvCalc/PokemonIcon", () => ({
	default: ({ idForm }: { idForm: number }) => <span>{idForm}</span>,
}));

describe("NoCollectSupplementBar", () => {
	it("does not render when no active no-collect cells exist", () => {
		const { container } = render(
			<NoCollectSupplementBar
				noCollectCount={0}
				entries={[]}
				onClear={vi.fn()}
			/>,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders no-collect summary and calls clear handler", () => {
		const onClear = vi.fn();
		const entries: NoCollectSupplementEntry[] = [
			{ pokemonId: 10, pokemonIdForm: 10, pokemonShiny: false, count: 2 },
			{ pokemonId: 25, pokemonIdForm: 25, pokemonShiny: true, count: 1 },
		];

		render(
			<NoCollectSupplementBar
				noCollectCount={3}
				entries={entries}
				onClear={onClear}
			/>,
		);

		const bar = screen.getByTestId("no-collect-supplement-bar");
		const barStyle = window.getComputedStyle(bar);
		const styleText = bar.getAttribute("style") ?? "";
		expect(bar).toBeDefined();
		expect(barStyle.gap).toBe("2px");
		expect(styleText).not.toContain("border:");
		expect(styleText).not.toContain("background-color:");
		const resetButton = screen.getByTestId(
			"no-collect-supplement-delete-button",
		);
		const resetButtonStyle = window.getComputedStyle(resetButton);
		expect(resetButton).toBeDefined();
		expect(resetButtonStyle.height).toBe("18px");
		expect(resetButtonStyle.fontSize).toBe("10px");
		expect(resetButtonStyle.paddingLeft).toBe("8px");
		expect(resetButtonStyle.paddingRight).toBe("8px");
		expect(
			screen.getByText("食材,きのみを回収しない設定がされています。"),
		).toBeDefined();
		expect(screen.getAllByTestId("no-collect-supplement-entry")).toHaveLength(
			2,
		);
		expect(screen.getByText("2回")).toBeDefined();
		expect(screen.getByText("1回")).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "リセット" }));
		expect(onClear).toHaveBeenCalledTimes(1);
	});
});
