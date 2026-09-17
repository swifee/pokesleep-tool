import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import {
	DEFAULT_QUICK_SIM_USAGE_MODE,
	isQuickSimUsageMode,
	type QuickSimMember,
	type QuickSimSettings,
	type QuickSimUsageMode,
	STORAGE_KEY_QUICK_SIM,
} from "../types/QuickSimTypes";
import type { PokemonSwap, TimeSlot } from "../types/TimeSlotTypes";
import {
	collectAppearingTimelineMembers,
	collectTimelineDurationSummaryByPokemon,
} from "./AdditionalAnalysisUtils";
import { resolveDistinctBoxItems } from "./BoxItemMatchingUtils";
import { clampQuickSimUsagePercent } from "./QuickSimScheduler";

/**
 * 保存形式。ボックスのIDは読み込みのたびに振り直されるため、
 * 入れ替え設定と同じくシリアライズ文字列で保存する。
 */
interface SerializedQuickSimMember {
	serialized: string;
	usagePercent: number;
	/** 起用方法。省略時は均等（旧形式との互換） */
	usageMode?: QuickSimUsageMode;
}

interface SerializedQuickSimSettings {
	members: SerializedQuickSimMember[];
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
			usageMode: member.usageMode,
		});
	}
	const payload: SerializedQuickSimSettings = { members };
	localStorage.setItem(STORAGE_KEY_QUICK_SIM, JSON.stringify(payload));
}

function isSerializedQuickSimMember(
	value: unknown,
): value is SerializedQuickSimMember {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Partial<SerializedQuickSimMember>;
	return (
		typeof candidate.serialized === "string" &&
		typeof candidate.usagePercent === "number"
	);
}

/**
 * 簡易シミュ設定を localStorage から読み込む。
 * 未保存なら null。完全一致で見つからないメンバー（個体値計算機で編集された等）は
 * 一致度で探し直し、それでも見つからなければ除いて返す。
 * @param fuzzyCandidates 一致度で探し直すときの候補。省略時はボックスの全アイテム。
 */
export function loadQuickSimSettingsFromStorage(
	box: PokemonBox,
	fuzzyCandidates?: readonly PokemonBoxItem[],
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
		const rawMembers = parsed.members.filter(isSerializedQuickSimMember);
		const resolvedItems = resolveDistinctBoxItems(
			rawMembers.map((rawMember) => rawMember.serialized),
			box,
			{ fuzzyCandidates },
		);
		const members: QuickSimMember[] = [];
		rawMembers.forEach((rawMember, index) => {
			const item = resolvedItems[index];
			if (!item) {
				return;
			}
			members.push({
				pokemonId: item.id,
				usagePercent: clampQuickSimUsagePercent(rawMember.usagePercent),
				usageMode: isQuickSimUsageMode(rawMember.usageMode)
					? rawMember.usageMode
					: DEFAULT_QUICK_SIM_USAGE_MODE,
			});
		});
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
			usageMode: DEFAULT_QUICK_SIM_USAGE_MODE,
		};
	});
}
