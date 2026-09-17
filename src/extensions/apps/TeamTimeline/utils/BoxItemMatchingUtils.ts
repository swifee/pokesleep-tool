/**
 * BoxItemMatchingUtils.ts
 * ボックスのポケモンを見失ったときに、一致度から同じ個体を探し直すためのユーティリティ。
 *
 * チームタイムラインはボックスのポケモンをシリアライズ文字列で保存しているため、
 * 個体値計算機側でレベルやサブスキルを編集すると文字列が変わり、完全一致では
 * 見つからなくなる。ボックスを全消去して再インポートした場合も同様。
 * そこで、同じ進化系統のポケモンを候補にして、変わりにくい属性ほど重く採点し、
 * しきい値を超えた最良の候補を同じ個体とみなして取得し直す。
 *
 * 採点は「判断材料になる属性」だけで正規化する。たとえば両方ともニックネームが
 * 未設定なら、その属性は分母にも分子にも入れない。
 */

import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import type PokemonIv from "../../../../util/PokemonIv";
import type SubSkill from "../../../../util/SubSkill";

/** 一致度の採点に使う、保存時のポケモン情報 */
export interface BoxItemMatchReference {
	iv: PokemonIv;
	nickname: string;
}

/**
 * 属性ごとの重み（合計 100）。
 * 通常は変わらない属性ほど重く、頻繁に変わる属性は同点時の判定用に軽くする。
 */
const MATCH_WEIGHTS = {
	/** ニックネーム: 途中で変えることは稀 */
	nickname: 22,
	/** せいかく: 入力ミスの訂正以外では変わらない */
	nature: 22,
	/** 食材: 入力ミスの訂正以外では変わらない */
	ingredient: 18,
	/** サブスキル: 強化・訂正・後から埋める操作はあるが概ね固定 */
	subSkills: 25,
	/** 色違い: 訂正以外では変わらない */
	shiny: 3,
	/** 一緒に眠った時間: 頻度は低いが上がる */
	ribbon: 2,
	/** レベル: 頻繁に上下するので同点時の判定用 */
	level: 3,
	/** メインスキルのレベル: 上がるので同点時の判定用 */
	skillLevel: 2,
	/** 種族: 同じ進化系統の中で、進化していなければ加点 */
	species: 2,
	/** メインスキル: 種族ごとに固定なので、変更できるミュウだけ判断材料にする */
	mainSkill: 1,
} as const;

/** この一致度（0〜100）以上の候補だけを同じ個体とみなす */
export const BOX_ITEM_MATCH_THRESHOLD = 60;

/** ニックネームが片方だけ設定されているときの判断材料としての強さ（後から付けた可能性） */
const NICKNAME_ONE_SIDE_EVIDENCE = 0.5;
/** 両方とも色違いでないときの判断材料としての強さ（色違いでないのが普通） */
const NON_SHINY_EVIDENCE = 0.5;
/** サブスキルが同系統で強さだけ違うときの一致度（S→M の強化や訂正） */
const SUB_SKILL_SAME_FAMILY_SIMILARITY = 0.75;
/** 進化系統は同じだが種族が違う（進化した）ときの一致度 */
const EVOLVED_SPECIES_SIMILARITY = 0.5;
/** リボンが増えているときの一致度（一緒に眠った時間は増える方向にしか進まない） */
const RIBBON_INCREASED_SIMILARITY = 0.75;
/** リボンが減っているときの一致度（訂正の可能性） */
const RIBBON_DECREASED_SIMILARITY = 0.25;
/** レベル差を一致度に換算するときの分母（Lv1〜100） */
const LEVEL_RANGE = 99;
/** メインスキルレベル差を一致度に換算するときの分母（Lv1〜8） */
const SKILL_LEVEL_RANGE = 7;
/** メインスキルを変更できる種族のスキル名 */
const VERSATILE_SKILL_NAME = "Versatile";

/**
 * 属性 1 つ分の採点結果。
 * evidence は「この属性がどれだけ判断材料になるか」（0〜1）で、
 * 両方未設定など比較できないときは 0 にして正規化から外す。
 */
interface AttributeScore {
	weight: number;
	evidence: number;
	similarity: number;
}

const NO_EVIDENCE: Pick<AttributeScore, "evidence" | "similarity"> = {
	evidence: 0,
	similarity: 0,
};

function equalityScore(
	isEqual: boolean,
): Pick<AttributeScore, "evidence" | "similarity"> {
	return { evidence: 1, similarity: isEqual ? 1 : 0 };
}

type SubSkillFamily =
	| "helpingSpeed"
	| "ingredientFinder"
	| "inventory"
	| "skillTrigger"
	| "skillLevelUp";

/** S / M / L のように強さだけが違うサブスキルの系統 */
function getSubSkillFamily(subSkill: SubSkill): SubSkillFamily | null {
	if (subSkill.helpingSpeed > 0) {
		return "helpingSpeed";
	}
	if (subSkill.ingredientFinder > 0) {
		return "ingredientFinder";
	}
	if (subSkill.inventory > 0) {
		return "inventory";
	}
	if (subSkill.skillTrigger > 0) {
		return "skillTrigger";
	}
	if (subSkill.skillLevelUp > 0) {
		return "skillLevelUp";
	}
	return null;
}

function scoreSubSkillSlot(
	reference: SubSkill | null,
	candidate: SubSkill | null,
): Pick<AttributeScore, "evidence" | "similarity"> {
	// 未入力の枠は判断材料にしない（後から全て埋めるケース）
	if (reference === null || candidate === null) {
		return NO_EVIDENCE;
	}
	if (reference.name === candidate.name) {
		return { evidence: 1, similarity: 1 };
	}
	const referenceFamily = getSubSkillFamily(reference);
	if (
		referenceFamily !== null &&
		referenceFamily === getSubSkillFamily(candidate)
	) {
		return { evidence: 1, similarity: SUB_SKILL_SAME_FAMILY_SIMILARITY };
	}
	return { evidence: 1, similarity: 0 };
}

/** 5 枠の平均。埋まっている枠が多いほど判断材料として強くなる */
function scoreSubSkills(
	reference: PokemonIv,
	candidate: PokemonIv,
): Pick<AttributeScore, "evidence" | "similarity"> {
	const referenceSlots = reference.subSkills.toProps();
	const candidateSlots = candidate.subSkills.toProps();
	const slotScores = [
		scoreSubSkillSlot(referenceSlots.lv10, candidateSlots.lv10),
		scoreSubSkillSlot(referenceSlots.lv25, candidateSlots.lv25),
		scoreSubSkillSlot(referenceSlots.lv50, candidateSlots.lv50),
		scoreSubSkillSlot(referenceSlots.lv70, candidateSlots.lv70),
		scoreSubSkillSlot(referenceSlots.lv80, candidateSlots.lv80),
	];
	return averageScores(slotScores);
}

function averageScores(
	scores: readonly Pick<AttributeScore, "evidence" | "similarity">[],
): Pick<AttributeScore, "evidence" | "similarity"> {
	const evidence = scores.reduce((sum, score) => sum + score.evidence, 0);
	if (evidence === 0) {
		return NO_EVIDENCE;
	}
	const similarity =
		scores.reduce((sum, score) => sum + score.evidence * score.similarity, 0) /
		evidence;
	return { evidence: evidence / scores.length, similarity };
}

function scoreNickname(
	reference: string,
	candidate: string,
): Pick<AttributeScore, "evidence" | "similarity"> {
	if (reference === "" && candidate === "") {
		return NO_EVIDENCE;
	}
	if (reference === "" || candidate === "") {
		return { evidence: NICKNAME_ONE_SIDE_EVIDENCE, similarity: 0 };
	}
	return equalityScore(reference === candidate);
}

function scoreMythicalIngredientSlot(
	reference: string,
	candidate: string,
): Pick<AttributeScore, "evidence" | "similarity"> {
	if (reference === "unknown" && candidate === "unknown") {
		return NO_EVIDENCE;
	}
	return equalityScore(reference === candidate);
}

function scoreIngredients(
	reference: PokemonIv,
	candidate: PokemonIv,
): Pick<AttributeScore, "evidence" | "similarity"> {
	// 幻のポケモンは食材の組み合わせ（AAA など）ではなく、選んだ食材そのものを比べる
	if (reference.isMythical && candidate.isMythical) {
		return averageScores([
			scoreMythicalIngredientSlot(reference.mythIng1, candidate.mythIng1),
			scoreMythicalIngredientSlot(reference.mythIng2, candidate.mythIng2),
			scoreMythicalIngredientSlot(reference.mythIng3, candidate.mythIng3),
		]);
	}
	return equalityScore(reference.ingredient === candidate.ingredient);
}

function scoreShiny(
	reference: PokemonIv,
	candidate: PokemonIv,
): Pick<AttributeScore, "evidence" | "similarity"> {
	if (!reference.shiny && !candidate.shiny) {
		return { evidence: NON_SHINY_EVIDENCE, similarity: 1 };
	}
	return equalityScore(reference.shiny === candidate.shiny);
}

function scoreRibbon(
	reference: PokemonIv,
	candidate: PokemonIv,
): Pick<AttributeScore, "evidence" | "similarity"> {
	if (reference.ribbon === candidate.ribbon) {
		return { evidence: 1, similarity: 1 };
	}
	return {
		evidence: 1,
		similarity:
			candidate.ribbon > reference.ribbon
				? RIBBON_INCREASED_SIMILARITY
				: RIBBON_DECREASED_SIMILARITY,
	};
}

function scoreDistance(
	difference: number,
	range: number,
): Pick<AttributeScore, "evidence" | "similarity"> {
	return {
		evidence: 1,
		similarity: Math.max(0, 1 - Math.abs(difference) / range),
	};
}

function scoreMainSkill(
	reference: PokemonIv,
	candidate: PokemonIv,
): Pick<AttributeScore, "evidence" | "similarity"> {
	const canChangeSkill =
		reference.pokemon.skill === VERSATILE_SKILL_NAME ||
		candidate.pokemon.skill === VERSATILE_SKILL_NAME;
	if (!canChangeSkill) {
		return NO_EVIDENCE;
	}
	return equalityScore(reference.versatileSkill === candidate.versatileSkill);
}

/**
 * 2 体が同じ進化系統かどうか。
 * 種族が別のポケモンに変わることはないが、進化はあり得るので、
 * 進化前後（フォルム込み）を同じ系統として扱う。
 */
export function isSameEvolutionLine(
	reference: PokemonIv,
	candidate: PokemonIv,
): boolean {
	if (reference.pokemonName === candidate.pokemonName) {
		return true;
	}
	return reference.allDecendants.some(
		(pokemon) => pokemon.name === candidate.pokemonName,
	);
}

/**
 * 保存時の情報とボックスの候補の一致度（0〜100）を採点する。
 * 進化系統が違う候補は同じ個体になり得ないので null を返す。
 */
export function scoreBoxItemSimilarity(
	reference: BoxItemMatchReference,
	candidate: BoxItemMatchReference,
): number | null {
	const referenceIv = reference.iv;
	const candidateIv = candidate.iv;
	if (!isSameEvolutionLine(referenceIv, candidateIv)) {
		return null;
	}

	const attributeScores: AttributeScore[] = [
		{
			weight: MATCH_WEIGHTS.nickname,
			...scoreNickname(reference.nickname, candidate.nickname),
		},
		{
			weight: MATCH_WEIGHTS.nature,
			...equalityScore(referenceIv.nature.name === candidateIv.nature.name),
		},
		{
			weight: MATCH_WEIGHTS.ingredient,
			...scoreIngredients(referenceIv, candidateIv),
		},
		{
			weight: MATCH_WEIGHTS.subSkills,
			...scoreSubSkills(referenceIv, candidateIv),
		},
		{ weight: MATCH_WEIGHTS.shiny, ...scoreShiny(referenceIv, candidateIv) },
		{ weight: MATCH_WEIGHTS.ribbon, ...scoreRibbon(referenceIv, candidateIv) },
		{
			weight: MATCH_WEIGHTS.level,
			...scoreDistance(candidateIv.level - referenceIv.level, LEVEL_RANGE),
		},
		{
			weight: MATCH_WEIGHTS.skillLevel,
			...scoreDistance(
				candidateIv.skillLevel - referenceIv.skillLevel,
				SKILL_LEVEL_RANGE,
			),
		},
		{
			weight: MATCH_WEIGHTS.species,
			evidence: 1,
			similarity:
				referenceIv.pokemonName === candidateIv.pokemonName
					? 1
					: EVOLVED_SPECIES_SIMILARITY,
		},
		{
			weight: MATCH_WEIGHTS.mainSkill,
			...scoreMainSkill(referenceIv, candidateIv),
		},
	];

	const totalEvidence = attributeScores.reduce(
		(sum, score) => sum + score.weight * score.evidence,
		0,
	);
	if (totalEvidence === 0) {
		return 0;
	}
	const totalSimilarity = attributeScores.reduce(
		(sum, score) => sum + score.weight * score.evidence * score.similarity,
		0,
	);
	return (totalSimilarity / totalEvidence) * 100;
}

/**
 * 候補の中から、しきい値以上で最も一致度の高いボックスのポケモンを返す。
 * 同点なら候補の並び順（ボックスの並び順）で先のものを選ぶ。
 */
export function findBestMatchingBoxItem(
	reference: BoxItemMatchReference,
	candidates: readonly PokemonBoxItem[],
): PokemonBoxItem | null {
	let best: PokemonBoxItem | null = null;
	let bestScore = BOX_ITEM_MATCH_THRESHOLD;
	for (const candidate of candidates) {
		const score = scoreBoxItemSimilarity(reference, candidate);
		if (score === null || score < bestScore) {
			continue;
		}
		if (score === bestScore && best !== null) {
			continue;
		}
		best = candidate;
		bestScore = score;
	}
	return best;
}

export interface ResolveBoxItemsOptions {
	/**
	 * 一致度で探すときの候補。省略時はボックスの全アイテム。
	 * 初回プリセット用の隠しポケモンなど、候補にしたくないものを除くために使う。
	 */
	fuzzyCandidates?: readonly PokemonBoxItem[];
}

interface FuzzyAssignment {
	referenceIndex: number;
	candidate: PokemonBoxItem;
	score: number;
}

function buildSerializedToItemsMap(
	box: PokemonBox,
): Map<string, PokemonBoxItem[]> {
	const map = new Map<string, PokemonBoxItem[]>();
	for (const item of box.items) {
		const key = item.serialize();
		const items = map.get(key) ?? [];
		items.push(item);
		map.set(key, items);
	}
	return map;
}

/**
 * 保存されたシリアライズ文字列の並びを、ボックスのポケモンに対応付ける。
 * 1 体のポケモンは 1 つの参照にしか割り当てない（チーム枠や簡易シミュのメンバー用）。
 *
 * 1. 完全一致するものを先に割り当てる
 * 2. 残った参照を、残った候補の中から一致度の高い組み合わせ順に割り当てる
 *
 * 対応付けられなかった参照は null。
 */
export function resolveDistinctBoxItems(
	serializedReferences: readonly (string | null)[],
	box: PokemonBox,
	options: ResolveBoxItemsOptions = {},
): (PokemonBoxItem | null)[] {
	const resolved: (PokemonBoxItem | null)[] = serializedReferences.map(
		() => null,
	);
	const usedIds = new Set<number>();

	const serializedToItems = buildSerializedToItemsMap(box);
	serializedReferences.forEach((serialized, index) => {
		if (serialized === null) {
			return;
		}
		const candidates = serializedToItems.get(serialized) ?? [];
		const item = candidates.find((candidate) => !usedIds.has(candidate.id));
		if (!item) {
			return;
		}
		usedIds.add(item.id);
		resolved[index] = item;
	});

	const fuzzyCandidates = (options.fuzzyCandidates ?? box.items).filter(
		(candidate) => !usedIds.has(candidate.id),
	);
	const assignments: FuzzyAssignment[] = [];
	serializedReferences.forEach((serialized, index) => {
		if (serialized === null || resolved[index] !== null) {
			return;
		}
		const reference = box.deserializeItem(serialized);
		if (reference === null) {
			return;
		}
		for (const candidate of fuzzyCandidates) {
			const score = scoreBoxItemSimilarity(reference, candidate);
			if (score === null || score < BOX_ITEM_MATCH_THRESHOLD) {
				continue;
			}
			assignments.push({ referenceIndex: index, candidate, score });
		}
	});

	// 一致度の高い組み合わせから順に確定し、同点なら参照・候補の並び順を優先する
	const candidateOrder = new Map(
		fuzzyCandidates.map((candidate, order) => [candidate.id, order]),
	);
	assignments.sort(
		(left, right) =>
			right.score - left.score ||
			left.referenceIndex - right.referenceIndex ||
			(candidateOrder.get(left.candidate.id) ?? 0) -
				(candidateOrder.get(right.candidate.id) ?? 0),
	);
	for (const assignment of assignments) {
		if (
			resolved[assignment.referenceIndex] !== null ||
			usedIds.has(assignment.candidate.id)
		) {
			continue;
		}
		usedIds.add(assignment.candidate.id);
		resolved[assignment.referenceIndex] = assignment.candidate;
	}

	return resolved;
}
