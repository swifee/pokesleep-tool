import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	createDefaultProvisionalSettings,
	type ProvisionalSettings,
} from "../types/ProvisionalSettingsTypes";
import ProvisionalSettingsPanel from "./ProvisionalSettingsPanel";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue ?? key,
	}),
}));

function createSettings(
	overrides: Partial<ProvisionalSettings["berryZone"]> = {},
	placeholderOverrides: Partial<ProvisionalSettings["placeholderPokemon"]> = {},
	hugeMagoBerryOverrides: Partial<ProvisionalSettings["hugeMagoBerry"]> = {},
): ProvisionalSettings {
	const defaults = createDefaultProvisionalSettings();
	return {
		berryZone: { ...defaults.berryZone, enabled: true, ...overrides },
		hugeMagoBerry: { ...defaults.hugeMagoBerry, ...hugeMagoBerryOverrides },
		placeholderPokemon: {
			...defaults.placeholderPokemon,
			...placeholderOverrides,
		},
	};
}

function commit(testId: string, value: string) {
	const input = screen.getByTestId(testId);
	fireEvent.change(input, { target: { value } });
	fireEvent.blur(input);
}

describe("ProvisionalSettingsPanel", () => {
	it("きのみゾーンの仮パラメータを有効にできる", () => {
		const onChange = vi.fn();
		render(
			<ProvisionalSettingsPanel
				settings={createSettings({ enabled: false })}
				onChange={onChange}
			/>,
		);

		fireEvent.click(
			screen.getByLabelText("きのみゾーンの仮パラメータでシミュレートする"),
		);

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0].berryZone.enabled).toBe(true);
	});

	it("スキルレベル別のカビゴンエナジーを変更できる", () => {
		const onChange = vi.fn();
		render(
			<ProvisionalSettingsPanel
				settings={createSettings()}
				onChange={onChange}
			/>,
		);

		commit("provisional-berry-zone-energy-6", "2500");

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0].berryZone.snorlaxEnergyByLevel[5]).toBe(
			2500,
		);
	});

	it("上限まで重ねたときの倍率を表示する", () => {
		render(
			<ProvisionalSettingsPanel
				settings={createSettings({
					berryEnergyBonusPercent: 25,
					maxStackCount: 4,
				})}
				onChange={vi.fn()}
			/>,
		);

		expect(
			screen.getByTestId("provisional-berry-zone-max-multiplier").textContent,
		).toContain("×2.00");
	});

	it("重ねがけ上限を下げると開始時の重ねがけ数もクランプされる", () => {
		const onChange = vi.fn();
		render(
			<ProvisionalSettingsPanel
				settings={createSettings({ maxStackCount: 5, initialStackCount: 5 })}
				onChange={onChange}
			/>,
		);

		commit("provisional-berry-zone-max-stack", "2");

		expect(onChange.mock.calls[0][0].berryZone.maxStackCount).toBe(2);
		expect(onChange.mock.calls[0][0].berryZone.initialStackCount).toBe(2);
	});

	it("仮ステータスが無効なら入力できない", () => {
		render(
			<ProvisionalSettingsPanel
				settings={createSettings({}, { enabled: false })}
				onChange={vi.fn()}
			/>,
		);

		expect(
			(
				screen.getByTestId(
					"provisional-placeholder-frequency",
				) as HTMLInputElement
			).disabled,
		).toBe(true);
	});

	it("仮ステータスのおてつだいスピードを変更できる", () => {
		const onChange = vi.fn();
		render(
			<ProvisionalSettingsPanel
				settings={createSettings({}, { enabled: true })}
				onChange={onChange}
			/>,
		);

		commit("provisional-placeholder-frequency", "2200");

		expect(
			onChange.mock.calls[0][0].placeholderPokemon.helpingFrequencySeconds,
		).toBe(2200);
	});

	it("仮ステータスの適用対象ポケモンを表示する", () => {
		render(
			<ProvisionalSettingsPanel
				settings={createSettings()}
				onChange={vi.fn()}
			/>,
		);

		expect(
			screen.getByTestId("provisional-placeholder-targets").textContent,
		).toContain("Mewtwo");
	});
});

describe("ProvisionalSettingsPanel とてもおおきなマゴのみ", () => {
	it("仮パラメータを有効にできる", () => {
		const onChange = vi.fn();
		render(
			<ProvisionalSettingsPanel
				settings={createSettings()}
				onChange={onChange}
			/>,
		);

		fireEvent.click(
			screen.getByLabelText("とてもおおきなマゴのみをシミュレートする"),
		);

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0].hugeMagoBerry.enabled).toBe(true);
	});

	it("エナジー倍率と区分別の確率を変更できる", () => {
		const onChange = vi.fn();
		render(
			<ProvisionalSettingsPanel
				settings={createSettings({}, {}, { enabled: true })}
				onChange={onChange}
			/>,
		);

		commit("provisional-huge-mago-energy-multiplier", "4.5");
		commit("provisional-huge-mago-rate-legendary", "40");
		commit("provisional-huge-mago-rate-psychic", "25");
		commit("provisional-huge-mago-rate-other", "5");

		expect(onChange).toHaveBeenCalledTimes(4);
		expect(onChange.mock.calls[0][0].hugeMagoBerry.energyMultiplier).toBe(4.5);
		expect(
			onChange.mock.calls[1][0].hugeMagoBerry.legendaryPickupRatePercent,
		).toBe(40);
		expect(
			onChange.mock.calls[2][0].hugeMagoBerry.psychicPickupRatePercent,
		).toBe(25);
		expect(onChange.mock.calls[3][0].hugeMagoBerry.otherPickupRatePercent).toBe(
			5,
		);
	});

	it("無効なときは入力欄を操作できない", () => {
		render(
			<ProvisionalSettingsPanel
				settings={createSettings({}, {}, { enabled: false })}
				onChange={vi.fn()}
			/>,
		);

		expect(
			(
				screen.getByTestId(
					"provisional-huge-mago-rate-other",
				) as HTMLInputElement
			).disabled,
		).toBe(true);
	});
});
