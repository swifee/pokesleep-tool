import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import { createDefaultProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import type {
	QuickSimOptimizerProgress,
	QuickSimOptimizerResult,
} from "../types/QuickSimOptimizerTypes";
import type { QuickSimMember } from "../types/QuickSimTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
} from "../types/TimeSlotTypes";
import type { QuickSimOptimizationInput } from "../utils/QuickSimOptimizerSearch";
import { createDefaultTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import QuickSimOptimizerPanel from "./QuickSimOptimizerPanel";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (
			_key: string,
			defaultValue?: string,
			options?: Record<string, unknown>,
		) => {
			if (!defaultValue) {
				return _key;
			}
			return defaultValue.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
				String(options?.[name] ?? ""),
			);
		},
	}),
}));

vi.mock("../../../../ui/IvCalc/PokemonIcon", () => ({
	default: ({ idForm }: { idForm: number }) => (
		<span data-testid={`pokemon-icon-${idForm}`} />
	),
}));

const disposeMock = vi.fn();
const evaluateMock = vi.fn();
vi.mock("../simulation/QuickSimOptimizerWorkerPool", () => ({
	createQuickSimOptimizerEvaluator: vi.fn(async () => ({
		evaluator: { evaluate: evaluateMock },
		dispose: disposeMock,
	})),
}));

const runOptimizationMock = vi.fn();
vi.mock("../utils/QuickSimOptimizerSearch", async () => {
	const actual = await vi.importActual<
		typeof import("../utils/QuickSimOptimizerSearch")
	>("../utils/QuickSimOptimizerSearch");
	return {
		...actual,
		runQuickSimOptimization: (input: QuickSimOptimizationInput) =>
			runOptimizationMock(input),
	};
});

const NAMES = [
	"Pikachu",
	"Eevee",
	"Bulbasaur",
	"Charmander",
	"Squirtle",
	"Gengar",
	"Absol",
];

function createBox(count: number): PokemonBox {
	return new PokemonBox(
		NAMES.slice(0, count).map(
			(name, index) =>
				new PokemonBoxItem(new PokemonIv({ pokemonName: name }), "", index + 1),
		),
	);
}

function createMembers(count: number): QuickSimMember[] {
	return Array.from({ length: count }, (_, index) => ({
		pokemonId: index + 1,
		usagePercent: index < 5 ? 100 : 0,
		usageMode: index === 2 ? "sleep" : "even",
	}));
}

function createResult(memberCount: number): QuickSimOptimizerResult {
	const members = createMembers(memberCount).map((member) => ({
		pokemonId: member.pokemonId,
		usageMode: member.usageMode,
	}));
	const base = (percents: number[]) => ({
		percents,
		trialCount: 1000,
		usesSleepSwaps: false,
		unmetPokemonIds: [],
		swapsPerDay: 2,
	});
	return {
		members,
		entries: [
			{ ...base([100, 100, 100, 100, 60, 40]), meanEP: 123456.7 },
			{
				...base([100, 100, 100, 80, 80, 40]),
				meanEP: 120000,
				unmetPokemonIds: [3],
				usesSleepSwaps: true,
			},
		],
		current: { ...base([100, 100, 100, 100, 100, 0]), meanEP: 100000 },
		baseSeed: 42,
	};
}

function renderPanel(
	memberCount: number,
	overrides: Partial<React.ComponentProps<typeof QuickSimOptimizerPanel>> = {},
) {
	const onApply = vi.fn();
	const props: React.ComponentProps<typeof QuickSimOptimizerPanel> = {
		members: createMembers(memberCount),
		box: createBox(memberCount),
		timeSlots: DEFAULT_TIME_SLOTS,
		simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, seed: 777 },
		bonusSettings: createDefaultTimelineBonusSettings(),
		cookingSettings: createDefaultCookingSettings(),
		provisionalSettings: createDefaultProvisionalSettings(),
		seedMode: "fixed",
		hasSleepSlot: true,
		onApply,
		...overrides,
	};
	const view = render(<QuickSimOptimizerPanel {...props} />);
	return { ...view, onApply, props };
}

async function renderPanelWithResult(memberCount: number) {
	runOptimizationMock.mockResolvedValue(createResult(memberCount));
	const rendered = renderPanel(memberCount);
	fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
	await waitFor(() => {
		expect(screen.queryByTestId("quick-sim-optimizer-table")).not.toBeNull();
	});
	return rendered;
}

/** jsdom は 16 進の色を rgb() に直すので、どちらの表記でも受け付ける */
function hasBackgroundColor(
	element: Element,
	hexColor: string,
	rgbColor: string,
): boolean {
	const value = (element as HTMLElement).style.backgroundColor;
	return value === hexColor || value === rgbColor;
}

describe("QuickSimOptimizerPanel", () => {
	beforeEach(() => {
		runOptimizationMock.mockReset();
		disposeMock.mockReset();
		evaluateMock.mockReset();
	});

	it("disables the run button when there are fewer than six members", () => {
		renderPanel(5);
		expect(
			(screen.getByTestId("quick-sim-optimizer-run") as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(
			screen.getByTestId("quick-sim-optimizer-disabled-reason").textContent,
		).toContain("6〜12匹");
	});

	it("disables the run button without a sleep slot", () => {
		renderPanel(6, { hasSleepSlot: false });
		expect(
			(screen.getByTestId("quick-sim-optimizer-run") as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(
			screen.getByTestId("quick-sim-optimizer-disabled-reason").textContent,
		).toContain("就寝");
	});

	it("runs the optimization and shows the ranked results", async () => {
		const result = createResult(6);
		runOptimizationMock.mockResolvedValue(result);
		const { onApply } = renderPanel(6);

		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));

		await waitFor(() => {
			expect(screen.queryByTestId("quick-sim-optimizer-table")).not.toBeNull();
		});
		expect(runOptimizationMock).toHaveBeenCalledTimes(1);
		const input = runOptimizationMock.mock
			.calls[0][0] as QuickSimOptimizationInput;
		expect(input.members).toEqual(
			createMembers(6).map((member) => ({
				pokemonId: member.pokemonId,
				usageMode: member.usageMode,
			})),
		);
		expect(input.currentPercents).toEqual([100, 100, 100, 100, 100, 0]);
		expect(input.options).toEqual({ excludeSleepSwaps: true });
		expect(input.baseSeed).toBe(777);
		expect(disposeMock).toHaveBeenCalledTimes(1);

		expect(
			screen.queryByTestId("quick-sim-optimizer-row-current"),
		).not.toBeNull();
		expect(
			screen.getByTestId("quick-sim-optimizer-row-current-ep").textContent,
		).toContain("100,000");
		expect(
			screen.getByTestId("quick-sim-optimizer-row-1-ep").textContent,
		).toContain("123,457");
		expect(
			screen.getByTestId("quick-sim-optimizer-row-1-delta").textContent,
		).toContain("+23.5%");
		expect(
			screen.getByTestId("quick-sim-optimizer-row-1-percent-5").textContent,
		).toContain("60");
		expect(
			screen.getByTestId("quick-sim-optimizer-row-current-percent-6")
				.textContent,
		).toContain("-");
		expect(
			screen.queryByTestId("quick-sim-optimizer-row-2-warning"),
		).not.toBeNull();
		expect(
			screen.queryByTestId("quick-sim-optimizer-row-1-warning"),
		).toBeNull();

		fireEvent.click(screen.getByTestId("quick-sim-optimizer-row-1-apply"));
		expect(onApply).toHaveBeenCalledTimes(1);
		const applied = onApply.mock.calls[0][0] as ReadonlyMap<number, number>;
		expect([...applied.entries()]).toEqual([
			[1, 100],
			[2, 100],
			[3, 100],
			[4, 100],
			[5, 60],
			[6, 40],
		]);
	});

	it("always excludes sleep-swap candidates and uses a random seed when requested", async () => {
		runOptimizationMock.mockResolvedValue(createResult(6));
		renderPanel(6, { seedMode: "random" });

		// There is no longer a checkbox to allow candidates that need sleep swaps.
		expect(
			screen.queryByTestId("quick-sim-optimizer-exclude-sleep-swaps"),
		).toBeNull();
		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));

		await waitFor(() => {
			expect(runOptimizationMock).toHaveBeenCalledTimes(1);
		});
		const input = runOptimizationMock.mock
			.calls[0][0] as QuickSimOptimizationInput;
		expect(input.options).toEqual({ excludeSleepSwaps: true });
		expect(input.baseSeed).not.toBe(777);
	});

	it("shows progress while running and aborts on cancel", async () => {
		const captured: {
			input: QuickSimOptimizationInput | null;
			reject: ((error: Error) => void) | null;
		} = { input: null, reject: null };
		runOptimizationMock.mockImplementation(
			(input: QuickSimOptimizationInput) =>
				new Promise<QuickSimOptimizerResult>((_, reject) => {
					captured.input = input;
					captured.reject = reject;
				}),
		);
		renderPanel(6);

		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
		await waitFor(() => {
			expect(runOptimizationMock).toHaveBeenCalledTimes(1);
		});
		const progress: QuickSimOptimizerProgress = {
			phase: "racing",
			percent: 42,
			completed: 120,
			total: 2000,
		};
		act(() => {
			captured.input?.onProgress?.(progress);
		});
		expect(
			screen.getByTestId("quick-sim-optimizer-progress-label").textContent,
		).toContain("候補の比較 120 / 2,000 (42%)");

		fireEvent.click(screen.getByTestId("quick-sim-optimizer-cancel"));
		expect(captured.input?.signal?.aborted).toBe(true);
		expect(disposeMock).toHaveBeenCalled();
		expect(screen.queryByTestId("quick-sim-optimizer-run")).not.toBeNull();
		expect(screen.queryByTestId("quick-sim-optimizer-progress")).toBeNull();

		const abortError = new Error("aborted");
		abortError.name = "AbortError";
		await act(async () => {
			captured.reject?.(abortError);
		});
		expect(screen.queryByTestId("quick-sim-optimizer-error")).toBeNull();
	});

	it("shows an error when the optimization fails", async () => {
		runOptimizationMock.mockRejectedValue(new Error("boom"));
		renderPanel(6);
		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
		await waitFor(() => {
			expect(
				screen.getByTestId("quick-sim-optimizer-error").textContent,
			).toContain("boom");
		});
		expect(
			(screen.getByTestId("quick-sim-optimizer-run") as HTMLButtonElement)
				.disabled,
		).toBe(false);
	});

	it("marks the result as stale when the settings change but not when usage changes", async () => {
		runOptimizationMock.mockResolvedValue(createResult(6));
		const { rerender, props } = renderPanel(6);
		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
		await waitFor(() => {
			expect(screen.queryByTestId("quick-sim-optimizer-table")).not.toBeNull();
		});
		expect(screen.queryByTestId("quick-sim-optimizer-stale-notice")).toBeNull();

		rerender(
			<QuickSimOptimizerPanel
				{...props}
				members={props.members.map((member) => ({
					...member,
					usagePercent: 50,
				}))}
			/>,
		);
		expect(screen.queryByTestId("quick-sim-optimizer-stale-notice")).toBeNull();

		rerender(
			<QuickSimOptimizerPanel
				{...props}
				cookingSettings={{ ...props.cookingSettings, enabled: true }}
			/>,
		);
		expect(
			screen.queryByTestId("quick-sim-optimizer-stale-notice"),
		).not.toBeNull();
	});

	it("gives only the current row a light background", async () => {
		await renderPanelWithResult(6);

		const currentRow = screen.getByTestId("quick-sim-optimizer-row-current");
		const rankedRow = screen.getByTestId("quick-sim-optimizer-row-1");
		expect(
			hasBackgroundColor(currentRow, "#f5f5f5", "rgb(245, 245, 245)"),
		).toBe(true);
		expect(hasBackgroundColor(rankedRow, "#fff", "rgb(255, 255, 255)")).toBe(
			true,
		);
		// 横スクロールしても見える固定の先頭列も行と同じ背景にする
		const currentLabelCell = currentRow.firstElementChild as Element;
		const rankedLabelCell = rankedRow.firstElementChild as Element;
		expect(
			hasBackgroundColor(currentLabelCell, "#f5f5f5", "rgb(245, 245, 245)"),
		).toBe(true);
		expect(
			hasBackgroundColor(rankedLabelCell, "#fff", "rgb(255, 255, 255)"),
		).toBe(true);
	});

	it("draws each usage rate as a bar scaled to the cell height", async () => {
		await renderPanelWithResult(6);

		const fullCell = screen.getByTestId("quick-sim-optimizer-row-1-percent-1");
		const partialCell = screen.getByTestId(
			"quick-sim-optimizer-row-1-percent-5",
		);
		const emptyCell = screen.getByTestId(
			"quick-sim-optimizer-row-current-percent-6",
		);
		expect(fullCell.style.backgroundImage).toMatch(
			/^linear-gradient\(to top, .+ 100%, transparent 100%\)$/,
		);
		expect(partialCell.style.backgroundImage).toMatch(
			/^linear-gradient\(to top, .+ 60%, transparent 60%\)$/,
		);
		expect(emptyCell.style.backgroundImage).toBe("");
		expect(emptyCell.textContent).toBe("-");
	});

	it("keeps the pokemon columns as narrow as the icons", async () => {
		await renderPanelWithResult(6);

		const header = screen.getByTestId("quick-sim-optimizer-header-1");
		const cell = screen.getByTestId("quick-sim-optimizer-row-1-percent-1");
		const epCell = screen.getByTestId("quick-sim-optimizer-row-1-ep");
		expect(header.style.width).toBe("22px");
		expect(header.style.padding).toBe("3px 2px");
		expect(cell.style.width).toBe("22px");
		expect(cell.style.padding).toBe("3px 2px");
		// 数値の列はこれまでどおりの余白のまま
		expect(epCell.style.width).toBe("");
		expect(epCell.style.padding).toBe("3px 4px");
	});

	it("passes the special Pokémon groups to the search without showing a note", async () => {
		const items = [
			"Mewtwo",
			"Pikachu",
			"Darkrai",
			"Eevee",
			"Bulbasaur",
			"Gengar",
		].map(
			(name, index) =>
				new PokemonBoxItem(new PokemonIv({ pokemonName: name }), "", index + 1),
		);
		runOptimizationMock.mockResolvedValue(createResult(6));
		renderPanel(6, { box: new PokemonBox(items) });

		// The rule is applied silently here; the schedule section explains it.
		expect(screen.queryByTestId("quick-sim-optimizer-special-note")).toBeNull();

		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
		await waitFor(() => {
			expect(runOptimizationMock).toHaveBeenCalledTimes(1);
		});
		const input = runOptimizationMock.mock
			.calls[0][0] as QuickSimOptimizationInput;
		expect(input.exclusiveGroups).toEqual([[0, 2]]);
	});
});
