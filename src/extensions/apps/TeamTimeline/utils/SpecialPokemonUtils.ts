/**
 * SpecialPokemonUtils.ts
 * 「とくべつなポケモン」（伝説・幻）の編成ルール。
 *
 * ゲームの仕様: とくべつなポケモンはチームに同時に 1 体しか入れられない。
 * ただしラティアスとラティオスの組み合わせだけは同時に入れられる。
 *
 * 元データにフラグはないため、上流の `getPokemonRarity`（レベル 25 到達 EXP から
 * 伝説・幻を導出する）で判定する。
 */

import { getPokemonRarity, type PokemonData } from "../../../../data/pokemons";
import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import type { QuickSimOptimizerExclusiveGroups } from "../types/QuickSimOptimizerTypes";
import type { QuickSimExclusionMap } from "../types/QuickSimTypes";
import {
	type PokemonSwap,
	SWAP_NONE_POKEMON_ID,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { buildExpandedTimeline } from "./TimelineDayExpansion";

/** 同時に編成できる唯一のとくべつなポケモンの組み合わせ */
const LATIAS_NAME = "Latias";
const LATIOS_NAME = "Latios";

/** とくべつなポケモン（伝説・幻）かどうか */
export function isSpecialPokemon(pokemon: PokemonData): boolean {
	return getPokemonRarity(pokemon) !== "normal";
}

/**
 * 2 体を同時に編成できるか。
 * どちらかがとくべつなポケモンでなければ常に可。両方がとくべつなポケモンのときは
 * ラティアスとラティオスの組み合わせだけ可（同じ種類 2 体は不可）。
 */
export function canSpecialPokemonCoexist(
	left: PokemonData,
	right: PokemonData,
): boolean {
	if (!isSpecialPokemon(left) || !isSpecialPokemon(right)) {
		return true;
	}
	return (
		(left.name === LATIAS_NAME && right.name === LATIOS_NAME) ||
		(left.name === LATIOS_NAME && right.name === LATIAS_NAME)
	);
}

/**
 * 同時に編成しているメンバーのうち、ルールに反する組み合わせに含まれる
 * とくべつなポケモンの ID（メンバー順）。
 */
export function findSpecialPokemonConflictIds(
	members: readonly (PokemonBoxItem | null)[],
): number[] {
	const present = members.filter(
		(member): member is PokemonBoxItem => member !== null,
	);
	const conflicting: number[] = [];
	for (const member of present) {
		const hasConflict = present.some(
			(other) =>
				other.id !== member.id &&
				!canSpecialPokemonCoexist(member.iv.pokemon, other.iv.pokemon),
		);
		if (hasConflict && !conflicting.includes(member.id)) {
			conflicting.push(member.id);
		}
	}
	return conflicting;
}

/**
 * 簡易シミュのスケジューラ向けに、同時に編成できないメンバーの組を作る。
 * ポケモン ID → 同時に編成できないポケモン ID の集合（組み合わせがあるものだけ）。
 */
export function buildSpecialPokemonExclusionMap(
	items: readonly PokemonBoxItem[],
): QuickSimExclusionMap {
	const exclusions = new Map<number, Set<number>>();
	for (const item of items) {
		for (const other of items) {
			if (
				other.id === item.id ||
				canSpecialPokemonCoexist(item.iv.pokemon, other.iv.pokemon)
			) {
				continue;
			}
			const set = exclusions.get(item.id) ?? new Set<number>();
			set.add(other.id);
			exclusions.set(item.id, set);
		}
	}
	return exclusions;
}

/**
 * 起用率最適化向けに、起用率の合計が 100% を超えてはいけないメンバー index の組を作る。
 *
 * とくべつなポケモンはラティアス・ラティオス以外は互いに同時に編成できないので、
 * 「ラティアス・ラティオス以外のとくべつなポケモン ∪ ラティアス全員」と
 * 「同 ∪ ラティオス全員」がそれぞれ同時に編成できない組（極大クリーク）になる。
 * 組が 1 匹以下のときは（1 匹の上限 100% と同じなので）含めない。
 */
export function buildSpecialPokemonExclusiveGroups(
	items: readonly (PokemonBoxItem | null)[],
): QuickSimOptimizerExclusiveGroups {
	const others: number[] = [];
	const latias: number[] = [];
	const latios: number[] = [];
	items.forEach((item, index) => {
		if (item === null || !isSpecialPokemon(item.iv.pokemon)) {
			return;
		}
		if (item.iv.pokemon.name === LATIAS_NAME) {
			latias.push(index);
		} else if (item.iv.pokemon.name === LATIOS_NAME) {
			latios.push(index);
		} else {
			others.push(index);
		}
	});
	const groups: number[][] = [];
	const seen = new Set<string>();
	for (const group of [
		[...others, ...latias],
		[...others, ...latios],
	]) {
		const sorted = [...group].sort((left, right) => left - right);
		const key = sorted.join(",");
		if (sorted.length < 2 || seen.has(key)) {
			continue;
		}
		seen.add(key);
		groups.push(sorted);
	}
	return groups;
}

/** 詳細シミュのタイムラインで、とくべつなポケモンが同時に編成されている箇所 */
export interface TimelineSpecialPokemonConflicts {
	/** 展開後のスロット ID → 重複しているとくべつなポケモンのチーム枠 index */
	teamIndexesBySlotId: ReadonlyMap<string, readonly number[]>;
	/** 重複に関わるポケモン ID（登場順） */
	pokemonIds: readonly number[];
}

const NO_TIMELINE_SPECIAL_POKEMON_CONFLICTS: TimelineSpecialPokemonConflicts = {
	teamIndexesBySlotId: new Map(),
	pokemonIds: [],
};

/**
 * 初期チームと入れ替え設定から、各時間帯（行）に同時に編成されているメンバーを追い、
 * とくべつなポケモンの重複を集める。
 * 入れ替えはその時間帯の計算後に適用される仕様なので、各行は適用前の編成で判定する。
 */
export function collectTimelineSpecialPokemonConflicts(
	team: readonly (PokemonBoxItem | null)[],
	timeSlots: readonly TimeSlot[],
	simulationDays: number,
	swaps: readonly PokemonSwap[],
	box?: PokemonBox,
): TimelineSpecialPokemonConflicts {
	const hasSpecialMember =
		team.some(
			(member) => member !== null && isSpecialPokemon(member.iv.pokemon),
		) ||
		swaps.some((swap) => {
			const member = box?.getById(swap.newPokemonId) ?? null;
			return member !== null && isSpecialPokemon(member.iv.pokemon);
		});
	if (!hasSpecialMember) {
		return NO_TIMELINE_SPECIAL_POKEMON_CONFLICTS;
	}

	const expandedTimeline = buildExpandedTimeline(
		[...timeSlots],
		simulationDays,
	);
	const swapsBySlot = new Map<string, PokemonSwap[]>();
	for (const swap of swaps) {
		const dayIndex = typeof swap.dayIndex === "number" ? swap.dayIndex : 0;
		const key = `${dayIndex}:${swap.slotId}`;
		const list = swapsBySlot.get(key) ?? [];
		list.push(swap);
		swapsBySlot.set(key, list);
	}

	const currentTeam: (PokemonBoxItem | null)[] = [...team];
	const teamIndexesBySlotId = new Map<string, number[]>();
	const pokemonIds: number[] = [];
	for (const expandedSlot of expandedTimeline.expandedSlots) {
		const conflictIds = findSpecialPokemonConflictIds(currentTeam);
		if (conflictIds.length > 0) {
			const teamIndexes: number[] = [];
			currentTeam.forEach((member, teamIndex) => {
				if (member !== null && conflictIds.includes(member.id)) {
					teamIndexes.push(teamIndex);
				}
			});
			teamIndexesBySlotId.set(expandedSlot.slot.id, teamIndexes);
			for (const pokemonId of conflictIds) {
				if (!pokemonIds.includes(pokemonId)) {
					pokemonIds.push(pokemonId);
				}
			}
		}

		const slotSwaps =
			swapsBySlot.get(
				`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`,
			) ?? [];
		for (const swap of slotSwaps) {
			if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
				currentTeam[swap.teamSlotIndex] = null;
				continue;
			}
			const next = box?.getById(swap.newPokemonId) ?? null;
			if (next !== null) {
				currentTeam[swap.teamSlotIndex] = next;
			}
		}
	}
	return { teamIndexesBySlotId, pokemonIds };
}
