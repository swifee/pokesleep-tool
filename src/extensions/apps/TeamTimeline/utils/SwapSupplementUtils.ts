import type PokemonBox from "../../../../util/PokemonBox";
import type { PokemonBoxItem } from "../../../../util/PokemonBox";
import {
	type PokemonSwap,
	SWAP_NONE_POKEMON_ID,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import type { TimelineDurationSummary } from "./AdditionalAnalysisUtils";
import { buildExpandedTimeline } from "./TimelineDayExpansion";

export interface SwapSupplementPokemonEntry {
	pokemonId: number;
	pokemonIdForm: number;
	activeMinutes: number;
	activeRatioPercent: number;
}

export interface SwapSupplementSequence {
	teamSlotIndex: number;
	entries: SwapSupplementPokemonEntry[];
}

interface BuildSwapSupplementSequencesInput {
	team: readonly (PokemonBoxItem | null)[];
	swaps: readonly PokemonSwap[];
	timeSlots: readonly TimeSlot[];
	durationSummary: TimelineDurationSummary;
	box?: PokemonBox;
}

function resolvePokemonIdForm(
	pokemonId: number,
	team: readonly (PokemonBoxItem | null)[],
	box?: PokemonBox,
): number | null {
	const fromBox = box?.getById(pokemonId);
	if (fromBox) {
		return fromBox.iv.idForm;
	}
	const fromTeam = team.find((member) => member?.id === pokemonId) ?? null;
	return fromTeam?.iv.idForm ?? null;
}

export function buildSwapSupplementSequences(
	input: BuildSwapSupplementSequencesInput,
): SwapSupplementSequence[] {
	const { team, swaps, timeSlots, durationSummary, box } = input;

	if (swaps.length === 0) {
		return [];
	}

	const slotOrderById = new Map<string, number>(
		buildExpandedTimeline([...timeSlots], 1).baseDaySlots.map(
			(slot, index) => [slot.id, index] as const,
		),
	);
	const swapsByTeamSlot = new Map<number, PokemonSwap[]>();

	swaps.forEach((swap) => {
		const existing = swapsByTeamSlot.get(swap.teamSlotIndex) ?? [];
		existing.push(swap);
		swapsByTeamSlot.set(swap.teamSlotIndex, existing);
	});

	const totalTimelineMinutes = durationSummary.totalTimelineMinutes;
	const sequences: SwapSupplementSequence[] = [];

	[...swapsByTeamSlot.entries()]
		.sort(([a], [b]) => a - b)
		.forEach(([teamSlotIndex, teamSlotSwaps]) => {
			const sortedSwaps = [...teamSlotSwaps].sort((left, right) => {
				if (left.dayIndex !== right.dayIndex) {
					return left.dayIndex - right.dayIndex;
				}
				const leftSlotOrder =
					slotOrderById.get(left.slotId) ?? Number.MAX_SAFE_INTEGER;
				const rightSlotOrder =
					slotOrderById.get(right.slotId) ?? Number.MAX_SAFE_INTEGER;
				return leftSlotOrder - rightSlotOrder;
			});

			const orderedPokemonIds: number[] = [];
			const seenPokemonIds = new Set<number>();
			const appendPokemonId = (pokemonId: number | null | undefined): void => {
				if (
					pokemonId === null ||
					pokemonId === undefined ||
					pokemonId === SWAP_NONE_POKEMON_ID
				) {
					return;
				}
				if (seenPokemonIds.has(pokemonId)) {
					return;
				}
				seenPokemonIds.add(pokemonId);
				orderedPokemonIds.push(pokemonId);
			};

			appendPokemonId(team[teamSlotIndex]?.id);
			sortedSwaps.forEach((swap) => {
				appendPokemonId(swap.newPokemonId);
			});

			const entries = orderedPokemonIds
				.map((pokemonId): SwapSupplementPokemonEntry | null => {
					const pokemonIdForm = resolvePokemonIdForm(pokemonId, team, box);
					if (pokemonIdForm === null) {
						return null;
					}
					const activeMinutes =
						durationSummary.activeMinutesByPokemonId.get(pokemonId) ?? 0;
					const activeRatioPercent =
						totalTimelineMinutes > 0
							? (activeMinutes / totalTimelineMinutes) * 100
							: 0;
					return {
						pokemonId,
						pokemonIdForm,
						activeMinutes,
						activeRatioPercent,
					};
				})
				.filter((entry): entry is SwapSupplementPokemonEntry => entry !== null);

			if (entries.length > 0) {
				sequences.push({
					teamSlotIndex,
					entries,
				});
			}
		});

	return sequences;
}
