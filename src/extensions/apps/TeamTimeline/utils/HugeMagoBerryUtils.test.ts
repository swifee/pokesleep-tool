import { describe, expect, it } from "vitest";
import pokemons, { type PokemonData } from "../../../../data/pokemons";
import {
	createDefaultHugeMagoBerrySettings,
	type HugeMagoBerryProvisionalSettings,
} from "../types/ProvisionalSettingsTypes";
import {
	getHugeMagoBerryEnergyMultiplier,
	getHugeMagoBerryPickupRate,
	getHugeMagoBerryPickupTier,
} from "./HugeMagoBerryUtils";

function findPokemon(name: string): PokemonData {
	const pokemon = pokemons.find((candidate) => candidate.name === name);
	if (!pokemon) {
		throw new Error(`${name} not found`);
	}
	return pokemon;
}

function createSettings(
	overrides: Partial<HugeMagoBerryProvisionalSettings> = {},
): HugeMagoBerryProvisionalSettings {
	return {
		...createDefaultHugeMagoBerrySettings(),
		enabled: true,
		energyMultiplier: 3,
		legendaryPickupRatePercent: 30,
		psychicPickupRatePercent: 20,
		otherPickupRatePercent: 10,
		...overrides,
	};
}

describe("getHugeMagoBerryPickupTier", () => {
	it("ミュウとミュウツーは最上位区分になる", () => {
		expect(getHugeMagoBerryPickupTier(findPokemon("Mew"))).toBe("legendary");
		expect(getHugeMagoBerryPickupTier(findPokemon("Mewtwo"))).toBe("legendary");
	});

	it("その他のエスパータイプはエスパー区分になる", () => {
		expect(getHugeMagoBerryPickupTier(findPokemon("Natu"))).toBe("psychic");
	});

	it("エスパー以外はその他区分になる", () => {
		expect(getHugeMagoBerryPickupTier(findPokemon("Pikachu"))).toBe("other");
	});
});

describe("getHugeMagoBerryPickupRate", () => {
	it("区分ごとの確率を 0〜1 で返す", () => {
		const settings = createSettings();
		expect(getHugeMagoBerryPickupRate(findPokemon("Mewtwo"), settings)).toBe(
			0.3,
		);
		expect(getHugeMagoBerryPickupRate(findPokemon("Natu"), settings)).toBe(0.2);
		expect(getHugeMagoBerryPickupRate(findPokemon("Pikachu"), settings)).toBe(
			0.1,
		);
	});

	it("仮設定が無効なら 0 を返す", () => {
		const settings = createSettings({ enabled: false });
		expect(getHugeMagoBerryPickupRate(findPokemon("Mewtwo"), settings)).toBe(0);
	});

	it("設定自体が無いときも 0 を返す", () => {
		expect(getHugeMagoBerryPickupRate(findPokemon("Mewtwo"), undefined)).toBe(
			0,
		);
	});

	it("100%を超える値は 1 に丸める", () => {
		const settings = createSettings({ otherPickupRatePercent: 150 });
		expect(getHugeMagoBerryPickupRate(findPokemon("Pikachu"), settings)).toBe(
			1,
		);
	});
});

describe("getHugeMagoBerryEnergyMultiplier", () => {
	it("有効なら設定値を返す", () => {
		expect(getHugeMagoBerryEnergyMultiplier(createSettings())).toBe(3);
	});

	it("無効なら 0 を返す", () => {
		expect(
			getHugeMagoBerryEnergyMultiplier(createSettings({ enabled: false })),
		).toBe(0);
		expect(getHugeMagoBerryEnergyMultiplier(undefined)).toBe(0);
	});

	it("負の値は 0 に丸める", () => {
		expect(
			getHugeMagoBerryEnergyMultiplier(
				createSettings({ energyMultiplier: -1 }),
			),
		).toBe(0);
	});
});
