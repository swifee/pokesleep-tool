import { describe, expect, it } from 'vitest';
import PokemonIv from '../../../../util/PokemonIv';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import { PokemonSwap } from '../types/TimeSlotTypes';
import {
    hydrateSwapsWithSerializedPokemon,
    normalizeLoadedSwapsWithBox,
} from './SwapPersistenceUtils';

function createItem(pokemonName: string, id: number, nickname = ''): PokemonBoxItem {
    return new PokemonBoxItem(new PokemonIv({ pokemonName }), nickname, id);
}

describe('SwapPersistenceUtils', () => {
    it('hydrates swap records with serialized pokemon strings', () => {
        const memberA = createItem('Bulbasaur', 10, 'A');
        const memberB = createItem('Charmander', 20, 'B');
        const box = new PokemonBox([memberA, memberB]);
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-1',
                teamSlotIndex: 0,
                newPokemonId: memberB.id,
                initialEnergy: 80,
                revertPokemonId: memberA.id,
            },
        ];

        const hydrated = hydrateSwapsWithSerializedPokemon(swaps, box);

        expect(hydrated[0].newPokemonSerialized).toBe(memberB.serialize());
        expect(hydrated[0].revertPokemonSerialized).toBe(memberA.serialize());
    });

    it('normalizes stale pokemon ids by serialized fallback', () => {
        const memberA = createItem('Squirtle', 11, 'A');
        const memberB = createItem('Pikachu', 22, 'B');
        const box = new PokemonBox([memberA, memberB]);
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-1',
                teamSlotIndex: 0,
                newPokemonId: memberB.id,
                newPokemonSerialized: memberA.serialize(),
                initialEnergy: 100,
                revertPokemonId: memberA.id,
                revertPokemonSerialized: memberB.serialize(),
            },
        ];

        const normalized = normalizeLoadedSwapsWithBox(swaps, box, new Map());

        expect(normalized[0].newPokemonId).toBe(memberA.id);
        expect(normalized[0].revertPokemonId).toBe(memberB.id);
    });

    it('keeps legacy ids when serialized fallback is unavailable', () => {
        const memberA = createItem('Eevee', 101);
        const box = new PokemonBox([memberA]);
        const swaps: PokemonSwap[] = [
            {
                dayIndex: 0,
                slotId: 'slot-1',
                teamSlotIndex: 0,
                newPokemonId: memberA.id,
                initialEnergy: 50,
            },
        ];

        const normalized = normalizeLoadedSwapsWithBox(swaps, box, new Map());

        expect(normalized[0].newPokemonId).toBe(memberA.id);
    });
});
