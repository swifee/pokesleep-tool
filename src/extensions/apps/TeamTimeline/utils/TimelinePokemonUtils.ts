import { PokemonBoxItem } from '../../../../util/PokemonBox';
import { MainSkillName } from '../../../../util/MainSkill';
import PokemonIv from '../../../../util/PokemonIv';
import { StrengthParameter } from '../../../../util/PokemonStrength';

function getMewSkillRate(
    versatileSkill: MainSkillName,
    mew: StrengthParameter['mew']
): number {
    if (versatileSkill === 'Charge Strength S (Random)' || versatileSkill === 'Charge Energy S') {
        return mew.skill1;
    }
    if (versatileSkill === 'Energy for Everyone S' || versatileSkill === 'Berry Burst') {
        return mew.skill3;
    }
    return mew.skill2;
}

function toPokemonIv(source: PokemonIv | PokemonBoxItem): PokemonIv {
    return source instanceof PokemonBoxItem ? source.iv : source;
}

export function getEffectiveMainSkillName(source: PokemonIv | PokemonBoxItem): MainSkillName {
    const iv = toPokemonIv(source);
    const rawSkill = iv.pokemon?.skill ?? iv.versatileSkill ?? 'unknown';
    return rawSkill === 'Versatile' ? iv.versatileSkill : rawSkill;
}

export function normalizeTimelinePokemonIv(
    iv: PokemonIv,
    strengthParameter: StrengthParameter
): PokemonIv {
    if (iv.pokemon.name !== 'Mew') {
        return iv;
    }

    return iv.clone({
        baseIngRate: strengthParameter.mew.ing,
        baseSkillRate: getMewSkillRate(iv.versatileSkill, strengthParameter.mew),
    });
}

export function normalizeTimelinePokemon(
    pokemon: PokemonBoxItem,
    strengthParameter: StrengthParameter
): PokemonBoxItem {
    const normalizedIv = normalizeTimelinePokemonIv(pokemon.iv, strengthParameter);
    if (normalizedIv === pokemon.iv) {
        return pokemon;
    }

    return new PokemonBoxItem(normalizedIv, pokemon.nickname, pokemon.id);
}
