import PokemonBox from '../../../../util/PokemonBox';
import { PokemonSwap, SWAP_NONE_POKEMON_ID } from '../types/TimeSlotTypes';

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

function resolveSwapPokemonId(
    pokemonId: number,
    serialized: string | undefined,
    box: PokemonBox,
    serializedToIds: ReadonlyMap<string, readonly number[]>,
    teamIdRemap: ReadonlyMap<number, number>,
): number {
    if (pokemonId === SWAP_NONE_POKEMON_ID) {
        return pokemonId;
    }

    if (typeof serialized === 'string') {
        const candidateIds = serializedToIds.get(serialized);
        if (candidateIds && candidateIds.length > 0) {
            if (candidateIds.includes(pokemonId)) {
                return pokemonId;
            }
            return candidateIds[0];
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
        const newPokemonSerialized = swap.newPokemonId === SWAP_NONE_POKEMON_ID
            ? undefined
            : box.getById(swap.newPokemonId)?.serialize() ?? swap.newPokemonSerialized;

        return {
            ...swap,
            newPokemonSerialized,
        };
    });
}

export function normalizeLoadedSwapsWithBox(
    swaps: PokemonSwap[],
    box: PokemonBox,
    teamIdRemap: ReadonlyMap<number, number>,
): PokemonSwap[] {
    const serializedToIds = buildSerializedToIdsMap(box);
    return swaps.map((swap) => {
        const newPokemonId = resolveSwapPokemonId(
            swap.newPokemonId,
            swap.newPokemonSerialized,
            box,
            serializedToIds,
            teamIdRemap,
        );
        return {
            ...swap,
            newPokemonId,
        };
    });
}
