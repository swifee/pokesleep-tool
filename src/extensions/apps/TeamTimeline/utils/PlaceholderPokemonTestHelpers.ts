/**
 * PlaceholderPokemonTestHelpers.ts
 * データ未公開ポケモンの仮ステータスをテストするための合成データ。
 *
 * 上流はリリース前のポケモンを frequency / skillRate / carryLimit が 0 の
 * プレースホルダーで登録し、リリース時に正式値へ置き換える
 * （ミュウツーは 2026-09-14 の upstream sync で正式値になった）。
 * テストが「いま実在するどのポケモンがプレースホルダーか」に依存しないよう、
 * ここで合成したプレースホルダーをテスト中だけポケモン一覧に登録する。
 *
 * Vitest はテストファイルごとにモジュールを隔離するため、
 * 登録は同じファイル内のテストにしか影響しない。
 */

import pokemons, { type PokemonData } from "../../../../data/pokemons";

/** 合成プレースホルダーの名前（実在ポケモンと衝突しない値） */
export const PLACEHOLDER_POKEMON_NAME = "Placeholder Pokemon";

/** 合成プレースホルダーの ID（実在ポケモンと衝突しない値） */
export const PLACEHOLDER_POKEMON_ID = 99999;

/**
 * 上流がミュウツーをリリース前に登録していたのと同じ形のプレースホルダー。
 * スキルは「きのみゾーン（サイコブレイク）」のまま残し、
 * きのみゾーンのテストでもそのまま使えるようにしている。
 */
export function createPlaceholderPokemonData(): PokemonData {
	return {
		id: PLACEHOLDER_POKEMON_ID,
		name: PLACEHOLDER_POKEMON_NAME,
		arrival: "2099-01-01",
		form: undefined,
		sleepType: "snoozing",
		exp: 1080,
		type: "psychic",
		specialty: "Skills",
		skill: "Berry Zone (Psystrike)",
		fp: 30,
		frequency: 0,
		ingRate: 0,
		skillRate: 0,
		ancestor: null,
		evolutionCount: -1,
		evolutionLeft: 0,
		isFullyEvolved: true,
		carryLimit: 0,
		ing1: { name: "unknown1", c1: 1, c2: 2, c3: 4 },
		ing2: { name: "unknown2", c2: 4, c3: 0 },
		ing3: { name: "unknown3", c3: 0 },
		mythIng: undefined,
	};
}

/**
 * ポケモン一覧の末尾にプレースホルダーを登録し、解除関数を返す。
 *
 * ```ts
 * let unregister: () => void;
 * beforeAll(() => {
 *   unregister = registerPlaceholderPokemon();
 * });
 * afterAll(() => unregister());
 * ```
 */
export function registerPlaceholderPokemon(): () => void {
	const placeholder = createPlaceholderPokemonData();
	pokemons.push(placeholder);
	return () => {
		const index = pokemons.indexOf(placeholder);
		if (index >= 0) {
			pokemons.splice(index, 1);
		}
	};
}
