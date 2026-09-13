import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import {
	type QuickSimMember,
	type QuickSimSettings,
	STORAGE_KEY_QUICK_SIM,
} from "../types/QuickSimTypes";
import type { PokemonSwap, TimeSlot } from "../types/TimeSlotTypes";
import {
	collectAppearingTimelineMembers,
	collectTimelineDurationSummaryByPokemon,
} from "./AdditionalAnalysisUtils";
import { clampQuickSimUsagePercent } from "./QuickSimScheduler";

/**
 * 保存形式。ボックスのIDは読み込みのたびに振り直されるため、
 * 入れ替え設定と同じくシリアライズ文字列で保存する。
 */
interface SerializedQuickSimMember {
	serialized: string;
	usagePercent: number;
}

interface SerializedQuickSimSettings {
	members: SerializedQuickSimMember[];
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
 * 簡易シミュ設定を localStorage に保存する。
 * ボックスに存在しないメンバーは保存しない。
 */
export function saveQuickSimSettingsToStorage(
	settings: QuickSimSettings,
	box: PokemonBox,
): void {
	const members: SerializedQuickSimMember[] = [];
	for (const member of settings.members) {
		const item = box.getById(member.pokemonId);
		if (!item) {
			continue;
		}
		members.push({
			serialized: item.serialize(),
			usagePercent: clampQuickSimUsagePercent(member.usagePercent),
		});
	}
	const payload: SerializedQuickSimSettings = { members };
	localStorage.setItem(STORAGE_KEY_QUICK_SIM, JSON.stringify(payload));
}

/**
 * 簡易シミュ設定を localStorage から読み込む。
 * 未保存なら null。ボックスから消えたメンバーは除いて返す。
 */
export function loadQuickSimSettingsFromStorage(
	box: PokemonBox,
): QuickSimSettings | null {
	const raw = localStorage.getItem(STORAGE_KEY_QUICK_SIM);
	if (raw === null) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<SerializedQuickSimSettings>;
		if (!Array.isArray(parsed.members)) {
			return null;
		}
		const serializedToItems = buildSerializedToItemsMap(box);
		const usedIds = new Set<number>();
		const members: QuickSimMember[] = [];
		for (const rawMember of parsed.members) {
			if (
				!rawMember ||
				typeof rawMember !== "object" ||
				typeof rawMember.serialized !== "string" ||
				typeof rawMember.usagePercent !== "number"
			) {
				continue;
			}
			const candidates = serializedToItems.get(rawMember.serialized) ?? [];
			const item = candidates.find((candidate) => !usedIds.has(candidate.id));
			if (!item) {
				continue;
			}
			usedIds.add(item.id);
			members.push({
				pokemonId: item.id,
				usagePercent: clampQuickSimUsagePercent(rawMember.usagePercent),
			});
		}
		return { members };
	} catch {
		return null;
	}
}

export interface DeriveQuickSimMembersInput {
	team: readonly (PokemonBoxItem | null)[];
	swaps: readonly PokemonSwap[];
	timeSlots: readonly TimeSlot[];
	simulationDays: number;
	box: PokemonBox;
}

/**
 * 詳細シミュのチーム編成（初期チーム + 入れ替え）から、
 * 各ポケモンの実際の編成時間の割合を起用率としたメンバー設定を作る。
 */
export function deriveQuickSimMembersFromTimeline(
	input: DeriveQuickSimMembersInput,
): QuickSimMember[] {
	const members = collectAppearingTimelineMembers(
		input.team,
		input.swaps,
		input.box,
	);
	const durationSummary = collectTimelineDurationSummaryByPokemon(
		input.team,
		input.timeSlots,
		input.simulationDays,
		input.swaps,
		input.box,
	);
	const totalMinutes = durationSummary.totalTimelineMinutes;
	return members.map((member) => {
		const activeMinutes =
			durationSummary.activeMinutesByPokemonId.get(member.id) ?? 0;
		const usagePercent =
			totalMinutes > 0 ? (activeMinutes / totalMinutes) * 100 : 0;
		return {
			pokemonId: member.id,
			usagePercent: clampQuickSimUsagePercent(usagePercent),
		};
	});
}
