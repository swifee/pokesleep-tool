import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import { type PokemonSwap, SWAP_NONE_POKEMON_ID } from "../types/TimeSlotTypes";
import { findBestMatchingBoxItem } from "./BoxItemMatchingUtils";

function buildSerializedToIdsMap(box: PokemonBox): Map<string, number[]> {
	const map = new Map<string, number[]>();
	box.items.forEach((item) => {
		const key = item.serialize();
		const ids = map.get(key) ?? [];
		ids.push(item.id);
		map.set(key, ids);
	});
	return map;
}

/**
 * 完全一致で見つからなかったシリアライズ文字列を、一致度でボックスのポケモンに対応付ける。
 * 同じポケモンを何度も入れ替える設定（繰り返し）があるため、結果はキャッシュする。
 */
function createFuzzyIdResolver(
	box: PokemonBox,
	fuzzyCandidates: readonly PokemonBoxItem[],
): (serialized: string) => number | null {
	const cache = new Map<string, number | null>();
	return (serialized) => {
		const cached = cache.get(serialized);
		if (cached !== undefined) {
			return cached;
		}
		const reference = box.deserializeItem(serialized);
		const matched =
			reference === null
				? null
				: findBestMatchingBoxItem(reference, fuzzyCandidates);
		const resolvedId = matched?.id ?? null;
		cache.set(serialized, resolvedId);
		return resolvedId;
	};
}

function resolveSwapPokemonId(
	pokemonId: number,
	serialized: string | undefined,
	box: PokemonBox,
	serializedToIds: ReadonlyMap<string, readonly number[]>,
	teamIdRemap: ReadonlyMap<number, number>,
	resolveFuzzyId: (serialized: string) => number | null,
): number {
	if (pokemonId === SWAP_NONE_POKEMON_ID) {
		return pokemonId;
	}

	if (typeof serialized === "string") {
		const candidateIds = serializedToIds.get(serialized);
		if (candidateIds && candidateIds.length > 0) {
			if (candidateIds.includes(pokemonId)) {
				return pokemonId;
			}
			return candidateIds[0];
		}

		// 保存後に編集されたポケモンは文字列が変わっているので、一致度で探し直す
		const fuzzyId = resolveFuzzyId(serialized);
		if (fuzzyId !== null) {
			return fuzzyId;
		}
	}

	if (box.getById(pokemonId)) {
		return pokemonId;
	}

	const remappedId = teamIdRemap.get(pokemonId);
	if (remappedId !== undefined) {
		return remappedId;
	}

	return pokemonId;
}

export function hydrateSwapsWithSerializedPokemon(
	swaps: readonly PokemonSwap[],
	box?: PokemonBox,
): PokemonSwap[] {
	if (!box) {
		return [...swaps];
	}

	return swaps.map((swap) => {
		const newPokemonSerialized =
			swap.newPokemonId === SWAP_NONE_POKEMON_ID
				? undefined
				: (box.getById(swap.newPokemonId)?.serialize() ??
					swap.newPokemonSerialized);

		return {
			...swap,
			newPokemonSerialized,
		};
	});
}

/**
 * 保存された入れ替え設定のポケモン ID を、現在のボックスの ID に対応付ける。
 * @param fuzzyCandidates 一致度で探し直すときの候補。省略時はボックスの全アイテム。
 */
export function normalizeLoadedSwapsWithBox(
	swaps: PokemonSwap[],
	box: PokemonBox,
	teamIdRemap: ReadonlyMap<number, number>,
	fuzzyCandidates: readonly PokemonBoxItem[] = box.items,
): PokemonSwap[] {
	const serializedToIds = buildSerializedToIdsMap(box);
	const resolveFuzzyId = createFuzzyIdResolver(box, fuzzyCandidates);
	return swaps.map((swap) => {
		const newPokemonId = resolveSwapPokemonId(
			swap.newPokemonId,
			swap.newPokemonSerialized,
			box,
			serializedToIds,
			teamIdRemap,
			resolveFuzzyId,
		);
		return {
			...swap,
			newPokemonId,
		};
	});
}
