import { describe, expect, it } from 'vitest';
import pokemons from '../../../../data/pokemons';
import PokemonIv from '../../../../util/PokemonIv';
import { PokemonBoxItem } from '../../../../util/PokemonBox';
import SeededRandom from './SeededRandom';
import { calculateHelp } from './HelpCalculator';

function createTestPokemon(): PokemonBoxItem {
    const pikachu = pokemons.find(pokemon => pokemon.name === 'Pikachu');
    if (!pikachu) {
        throw new Error('Pikachu not found');
    }
    return new PokemonBoxItem(new PokemonIv({ pokemonName: pikachu.name, level: 30, skillLevel: 1 }));
}

describe('HelpCalculator bonus behavior', () => {
    it('いいキャンプチケット有効時はおてつだい回数が増える', () => {
        const pokemon = createTestPokemon();

        const base = calculateHelp({
            pokemon,
            durationMinutes: 600,
            startEnergy: 50,
            isSleeping: false,
            random: new SeededRandom(101),
            teamHelpingBonusCount: 0,
            currentSkillStock: 0,
            maxSkillStock: 1,
            currentInventory: 0,
            maxInventory: pokemon.iv.carryLimit,
            bankedTimeSeconds: 0,
            bonusContext: {
                skillTriggerBonus: 1,
                berryBonus: 0,
                ingredientBonus: 0,
                isGoodCampTicketSet: false,
                isMainBerry: false,
                isNonFavoriteBerry: false,
            },
        });
        const withCamp = calculateHelp({
            pokemon,
            durationMinutes: 600,
            startEnergy: 50,
            isSleeping: false,
            random: new SeededRandom(101),
            teamHelpingBonusCount: 0,
            currentSkillStock: 0,
            maxSkillStock: 1,
            currentInventory: 0,
            maxInventory: pokemon.iv.carryLimit,
            bankedTimeSeconds: 0,
            bonusContext: {
                skillTriggerBonus: 1,
                berryBonus: 0,
                ingredientBonus: 0,
                isGoodCampTicketSet: true,
                isMainBerry: false,
                isNonFavoriteBerry: false,
            },
        });

        expect(withCamp.helpCount).toBeGreaterThan(base.helpCount);
    });

    it('いいキャンプチケット有効時は最大所持数が1.2倍扱いになる', () => {
        const pokemon = createTestPokemon();
        Object.defineProperty(pokemon.iv, 'ingredientRate', {
            configurable: true,
            get: () => 1,
        });
        Object.defineProperty(pokemon.iv, 'skillRate', {
            configurable: true,
            get: () => 0,
        });

        const withoutCamp = calculateHelp({
            pokemon,
            durationMinutes: 300,
            startEnergy: 50,
            isSleeping: false,
            random: new SeededRandom(202),
            teamHelpingBonusCount: 0,
            currentSkillStock: 0,
            maxSkillStock: 1,
            currentInventory: 10,
            maxInventory: 10,
            bankedTimeSeconds: 0,
            bonusContext: {
                skillTriggerBonus: 1,
                berryBonus: 0,
                ingredientBonus: 0,
                isGoodCampTicketSet: false,
                isMainBerry: false,
                isNonFavoriteBerry: false,
            },
        });
        const withCamp = calculateHelp({
            pokemon,
            durationMinutes: 300,
            startEnergy: 50,
            isSleeping: false,
            random: new SeededRandom(202),
            teamHelpingBonusCount: 0,
            currentSkillStock: 0,
            maxSkillStock: 1,
            currentInventory: 10,
            maxInventory: 10,
            bankedTimeSeconds: 0,
            bonusContext: {
                skillTriggerBonus: 1,
                berryBonus: 0,
                ingredientBonus: 0,
                isGoodCampTicketSet: true,
                isMainBerry: false,
                isNonFavoriteBerry: false,
            },
        });

        expect(withoutCamp.newInventory).toBe(10);
        expect(withoutCamp.ingredients).toEqual([]);
        expect(withCamp.newInventory).toBeGreaterThan(10);
        expect(withCamp.ingredients.length).toBeGreaterThan(0);
    });
});