import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type IngredientName,
	IngredientNames,
} from "../../../../data/pokemons";
import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import { createDefaultCookingSettings } from "../types/CookingTypes";
import type {
	QuickSimIngredientSearchSettings,
	QuickSimOptimizerProgress,
	QuickSimOptimizerResult,
	QuickSimOptimizerTarget,
} from "../types/QuickSimOptimizerTypes";
import type { QuickSimMember } from "../types/QuickSimTypes";
import {
	DEFAULT_SIMULATION_CONFIG,
	DEFAULT_TIME_SLOTS,
} from "../types/TimeSlotTypes";
import {
	initialIngredientsToStock,
	stockToInitialIngredients,
} from "../utils/QuickSimIngredientCandidates";
import type { QuickSimOptimizationInput } from "../utils/QuickSimOptimizerSearch";
import { STORAGE_KEY_QUICK_SIM_OPTIMIZER } from "../utils/QuickSimOptimizerStorage";
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

/** 19 種すべてのキーを持つ初期食材（結果の行は全置換用にすべてのキーを持つ） */
function fullStock(
	counts: Partial<Record<IngredientName, number>>,
): Partial<Record<IngredientName, number>> {
	return stockToInitialIngredients(initialIngredientsToStock(counts));
}

function createResult(
	memberCount: number,
	target: QuickSimOptimizerTarget = "usage",
): QuickSimOptimizerResult {
	const members = createMembers(memberCount).map((member) => ({
		pokemonId: member.pokemonId,
		usageMode: member.usageMode,
	}));
	const withStock = target !== "usage";
	const base = (
		percents: number[],
		stock?: Partial<Record<IngredientName, number>>,
	) => ({
		percents,
		trialCount: 1000,
		usesSleepSwaps: false,
		unmetPokemonIds: [],
		swapsPerDay: 2,
		...(withStock && stock ? { initialIngredients: fullStock(stock) } : {}),
	});
	return {
		target,
		members,
		entries: [
			{
				...base([100, 100, 100, 100, 60, 40], { apple: 90, tomato: 60 }),
				meanEP: 123456.7,
			},
			{
				...base([100, 100, 100, 80, 80, 40], { milk: 150 }),
				meanEP: 120000,
				unmetPokemonIds: [3],
				usesSleepSwaps: true,
			},
		],
		current: {
			...base([100, 100, 100, 100, 100, 0], { honey: 15 }),
			meanEP: 100000,
		},
		baseSeed: 42,
		...(withStock ? { ingredientTotalCount: 150 } : {}),
	};
}

function renderPanel(
	memberCount: number,
	overrides: Partial<React.ComponentProps<typeof QuickSimOptimizerPanel>> = {},
) {
	const onApply = vi.fn();
	const onApplyIngredients = vi.fn();
	const props: React.ComponentProps<typeof QuickSimOptimizerPanel> = {
		members: createMembers(memberCount),
		box: createBox(memberCount),
		timeSlots: DEFAULT_TIME_SLOTS,
		simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, seed: 777 },
		bonusSettings: createDefaultTimelineBonusSettings(),
		cookingSettings: createDefaultCookingSettings(),
		seedMode: "fixed",
		hasSleepSlot: true,
		onApply,
		onApplyIngredients,
		...overrides,
	};
	const view = render(<QuickSimOptimizerPanel {...props} />);
	return { ...view, onApply, onApplyIngredients, props };
}

/** 対象の Select を開いて選ぶ */
async function selectTarget(target: QuickSimOptimizerTarget) {
	const root = screen.getByTestId("quick-sim-optimizer-target");
	const combobox = root.querySelector('[role="combobox"]');
	if (!combobox) {
		throw new Error("combobox not found");
	}
	fireEvent.mouseDown(combobox);
	const option = await screen.findByTestId(
		`quick-sim-optimizer-target-${target}`,
	);
	fireEvent.click(option);
}

const ENABLED_COOKING = {
	...createDefaultCookingSettings(),
	enabled: true,
	category: "curry" as const,
	initialIngredients: { honey: 15 },
};

function seedIngredientSettings(
	settings: Partial<QuickSimIngredientSearchSettings>,
) {
	localStorage.setItem(
		STORAGE_KEY_QUICK_SIM_OPTIMIZER,
		JSON.stringify({
			totalCount: 300,
			maxCountByIngredient: { apple: 90, milk: 210 },
			...settings,
		}),
	);
}

function isDisabled(testId: string): boolean {
	return (screen.getByTestId(testId) as HTMLButtonElement).disabled;
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
		localStorage.clear();
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

	it("starts on the usage target and passes it to the search", async () => {
		runOptimizationMock.mockResolvedValue(createResult(6));
		renderPanel(6);
		expect(
			screen.queryByTestId("quick-sim-optimizer-ingredient-settings"),
		).toBeNull();
		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
		await waitFor(() => {
			expect(runOptimizationMock).toHaveBeenCalledTimes(1);
		});
		const input = runOptimizationMock.mock
			.calls[0][0] as QuickSimOptimizationInput;
		expect(input.target).toBe("usage");
		expect(input.ingredientEvaluator).toBeUndefined();
		expect(input.ingredientSettings).toBeUndefined();
	});

	it("requires the cooking simulation for the ingredient targets only", async () => {
		seedIngredientSettings({});
		renderPanel(6);
		await selectTarget("ingredients");
		expect(isDisabled("quick-sim-optimizer-run")).toBe(true);
		expect(
			screen.getByTestId("quick-sim-optimizer-disabled-reason").textContent,
		).toContain("料理シミュレーション");
		expect(
			screen.queryByTestId("quick-sim-optimizer-ingredient-settings"),
		).not.toBeNull();
		await selectTarget("usage");
		expect(isDisabled("quick-sim-optimizer-run")).toBe(false);
		expect(
			screen.queryByTestId("quick-sim-optimizer-disabled-reason"),
		).toBeNull();
	});

	it("explains when no ingredient has a limit and when the total is too small", async () => {
		renderPanel(6, { cookingSettings: ENABLED_COOKING });
		await selectTarget("ingredients");
		expect(isDisabled("quick-sim-optimizer-run")).toBe(true);
		expect(
			screen.getByTestId("quick-sim-optimizer-disabled-reason").textContent,
		).toContain("上限");
		expect(
			screen.getByTestId("quick-sim-optimizer-ingredient-settings-summary")
				.textContent,
		).toContain("対象 0 種");

		// 上限を 1 単位足すと探索できる
		fireEvent.click(
			screen.getByTestId("quick-sim-optimizer-ingredient-settings-toggle"),
		);
		fireEvent.click(screen.getByTestId("ingredient-max-increment-apple"));
		expect(
			(
				screen
					.getByTestId("ingredient-max-input-apple")
					.querySelector("input") as HTMLInputElement
			).value,
		).toBe("30");
		expect(isDisabled("quick-sim-optimizer-run")).toBe(false);
		expect(
			screen.getByTestId("quick-sim-optimizer-ingredient-settings-summary")
				.textContent,
		).toContain("対象 1 種");
		expect(localStorage.getItem(STORAGE_KEY_QUICK_SIM_OPTIMIZER)).toContain(
			'"apple":30',
		);
		// 800 個は 30 の倍数でないので、実際に配分する個数を注記する
		expect(
			screen.getByTestId("quick-sim-optimizer-ingredient-effective-total")
				.textContent,
		).toContain("30");

		// 合計を刻み未満にすると実行できない
		const totalInput = screen
			.getByTestId("quick-sim-optimizer-ingredient-total")
			.querySelector("input") as HTMLInputElement;
		fireEvent.change(totalInput, { target: { value: "20" } });
		expect(isDisabled("quick-sim-optimizer-run")).toBe(true);
		expect(
			screen.getByTestId("quick-sim-optimizer-disabled-reason").textContent,
		).toContain("合計");
	});

	it("optimizes the ingredients for any member count and applies only the stock", async () => {
		seedIngredientSettings({});
		runOptimizationMock.mockResolvedValue(createResult(3, "ingredients"));
		const { onApply, onApplyIngredients } = renderPanel(3, {
			cookingSettings: ENABLED_COOKING,
		});
		await selectTarget("ingredients");
		expect(isDisabled("quick-sim-optimizer-run")).toBe(false);
		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
		await waitFor(() => {
			expect(screen.queryByTestId("quick-sim-optimizer-table")).not.toBeNull();
		});
		const input = runOptimizationMock.mock
			.calls[0][0] as QuickSimOptimizationInput;
		expect(input.target).toBe("ingredients");
		expect(input.ingredientEvaluator).toBeDefined();
		expect(input.cookingSettings).toEqual(ENABLED_COOKING);
		expect(input.ingredientSettings).toEqual({
			totalCount: 300,
			maxCountByIngredient: { apple: 90, milk: 210 },
		});

		// 起用率の列はなく、初期食材のチップが出る
		expect(
			screen.queryByTestId("quick-sim-optimizer-row-1-percent-1"),
		).toBeNull();
		expect(screen.queryByTestId("quick-sim-optimizer-row-1-swaps")).toBeNull();
		expect(
			screen.getByTestId("quick-sim-optimizer-row-1-stock-apple").textContent,
		).toContain("90");
		expect(
			screen.getByTestId("quick-sim-optimizer-row-1-stock-tomato").textContent,
		).toContain("60");
		expect(
			screen.queryByTestId("quick-sim-optimizer-row-1-stock-milk"),
		).toBeNull();
		expect(
			screen.getByTestId("quick-sim-optimizer-row-current-stock-honey")
				.textContent,
		).toContain("15");

		fireEvent.click(screen.getByTestId("quick-sim-optimizer-row-1-apply"));
		expect(onApply).not.toHaveBeenCalled();
		expect(onApplyIngredients).toHaveBeenCalledTimes(1);
		const applied = onApplyIngredients.mock.calls[0][0] as Record<
			string,
			number
		>;
		expect(Object.keys(applied)).toHaveLength(IngredientNames.length);
		expect(applied.apple).toBe(90);
		expect(applied.tomato).toBe(60);
		expect(applied.milk).toBe(0);
	});

	it("shows usage columns and the stock for the joint target and applies both", async () => {
		seedIngredientSettings({});
		runOptimizationMock.mockResolvedValue(createResult(6, "both"));
		const { onApply, onApplyIngredients } = renderPanel(6, {
			cookingSettings: ENABLED_COOKING,
		});
		await selectTarget("both");
		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
		await waitFor(() => {
			expect(screen.queryByTestId("quick-sim-optimizer-table")).not.toBeNull();
		});
		const input = runOptimizationMock.mock
			.calls[0][0] as QuickSimOptimizationInput;
		expect(input.target).toBe("both");
		expect(
			screen.getByTestId("quick-sim-optimizer-row-1-percent-5").textContent,
		).toContain("60");
		expect(
			screen.getByTestId("quick-sim-optimizer-row-1-stock-apple").textContent,
		).toContain("90");
		expect(
			screen.queryByTestId("quick-sim-optimizer-row-1-swaps"),
		).not.toBeNull();

		fireEvent.click(screen.getByTestId("quick-sim-optimizer-row-1-apply"));
		expect(onApply).toHaveBeenCalledTimes(1);
		expect(onApplyIngredients).toHaveBeenCalledTimes(1);
	});

	it("keeps an ingredient result fresh when the stock is applied but stales it when the search settings change", async () => {
		seedIngredientSettings({});
		runOptimizationMock.mockResolvedValue(createResult(6, "ingredients"));
		const { rerender, props } = renderPanel(6, {
			cookingSettings: ENABLED_COOKING,
		});
		await selectTarget("ingredients");
		fireEvent.click(screen.getByTestId("quick-sim-optimizer-run"));
		await waitFor(() => {
			expect(screen.queryByTestId("quick-sim-optimizer-table")).not.toBeNull();
		});
		expect(screen.queryByTestId("quick-sim-optimizer-stale-notice")).toBeNull();

		rerender(
			<QuickSimOptimizerPanel
				{...props}
				cookingSettings={{
					...ENABLED_COOKING,
					initialIngredients: { apple: 90, tomato: 60 },
				}}
			/>,
		);
		expect(screen.queryByTestId("quick-sim-optimizer-stale-notice")).toBeNull();

		rerender(
			<QuickSimOptimizerPanel
				{...props}
				cookingSettings={{ ...ENABLED_COOKING, basePotCapacity: 99 }}
			/>,
		);
		expect(
			screen.queryByTestId("quick-sim-optimizer-stale-notice"),
		).not.toBeNull();

		rerender(<QuickSimOptimizerPanel {...props} />);
		expect(screen.queryByTestId("quick-sim-optimizer-stale-notice")).toBeNull();
		fireEvent.click(
			screen.getByTestId("quick-sim-optimizer-ingredient-settings-toggle"),
		);
		fireEvent.click(screen.getByTestId("ingredient-max-increment-tomato"));
		expect(
			screen.queryByTestId("quick-sim-optimizer-stale-notice"),
		).not.toBeNull();
	});
});
