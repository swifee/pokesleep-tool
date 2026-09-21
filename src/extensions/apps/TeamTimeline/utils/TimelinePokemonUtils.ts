import type { MainSkillName } from "../../../../util/MainSkill";
import { PokemonBoxItem } from "../../../../util/PokemonBox";
import type PokemonIv from "../../../../util/PokemonIv";

/**
 * Mew の「オールマイティ」で選択中のスキルに対応するスキル発動率（%）。
 * 上流 PokemonStrength.getMewSkillRate と同じ値。
 * ref: https://pks.raenonx.cc/en/mainskill/info/34
 */
const MEW_SKILL_RATE_BY_VERSATILE_SKILL: Partial<
	Record<MainSkillName, number>
> = {
	"Charge Strength S (Random)": 6.4,
	"Charge Energy S": 6.4,
	"Energizing Cheer S": 4.39,
	"Energy for Everyone S": 3.37,
	"Berry Burst": 2.84,
};
/** 上記以外のスキルを選択した Mew のスキル発動率（%） */
const MEW_DEFAULT_SKILL_RATE = 4;

function getMewSkillRate(versatileSkill: MainSkillName): number {
	return (
		MEW_SKILL_RATE_BY_VERSATILE_SKILL[versatileSkill] ?? MEW_DEFAULT_SKILL_RATE
	);
}

function toPokemonIv(source: PokemonIv | PokemonBoxItem): PokemonIv {
	return source instanceof PokemonBoxItem ? source.iv : source;
}

export function getEffectiveMainSkillName(
	source: PokemonIv | PokemonBoxItem,
): MainSkillName {
	const iv = toPokemonIv(source);
	const rawSkill = iv.pokemon?.skill ?? iv.versatileSkill ?? "unknown";
	return rawSkill === "Versatile" ? iv.versatileSkill : rawSkill;
}

/**
 * シミュレーション用に個体値を正規化する。
 * Mew は選択中のオールマイティスキルに応じたスキル発動率へ差し替える。
 */
export function normalizeTimelinePokemonIv(iv: PokemonIv): PokemonIv {
	if (iv.pokemon.name === "Mew") {
		return iv.clone({
			baseSkillRate: getMewSkillRate(iv.versatileSkill),
		});
	}
	return iv;
}

export function normalizeTimelinePokemon(
	pokemon: PokemonBoxItem,
): PokemonBoxItem {
	const normalizedIv = normalizeTimelinePokemonIv(pokemon.iv);
	if (normalizedIv === pokemon.iv) {
		return pokemon;
	}

	return new PokemonBoxItem(normalizedIv, pokemon.nickname, pokemon.id);
}
