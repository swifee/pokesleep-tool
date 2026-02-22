import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import {
    NoCollectCellSetting,
    PokemonSwap,
    SWAP_NONE_POKEMON_ID,
    TimeSlot,
} from '../types/TimeSlotTypes';
import { buildExpandedTimeline } from './TimelineDayExpansion';

export interface NoCollectSupplementEntry {
    pokemonId: number;
    pokemonIdForm: number;
    count: number;
}

interface BuildNoCollectSupplementEntriesInput {
    team: readonly (PokemonBoxItem | null)[];
    swaps: readonly PokemonSwap[];
    noCollectCells: readonly NoCollectCellSetting[];
    timeSlots: readonly TimeSlot[];
    simulationDays: number;
    box?: PokemonBox;
}

function toCellKey(dayIndex: number, slotId: string, teamSlotIndex: number): string {
    return `${dayIndex}:${slotId}:${teamSlotIndex}`;
}

function toSlotKey(dayIndex: number, slotId: string): string {
    return `${dayIndex}:${slotId}`;
}

function resolvePokemonIdForm(
    pokemonId: number,
    team: readonly (PokemonBoxItem | null)[],
    box?: PokemonBox
): number | null {
    const fromBox = box?.getById(pokemonId);
    if (fromBox) {
        return fromBox.iv.idForm;
    }
    const fromTeam = team.find((member) => member?.id === pokemonId) ?? null;
    return fromTeam?.iv.idForm ?? null;
}

function buildSwapCellKeySet(swaps: readonly PokemonSwap[]): Set<string> {
    const keySet = new Set<string>();
    swaps.forEach((swap) => {
        const dayIndex = Number.isFinite(swap.dayIndex) ? swap.dayIndex : 0;
        keySet.add(toCellKey(dayIndex, swap.slotId, swap.teamSlotIndex));
    });
    return keySet;
}

export function countActiveNoCollectCells(
    noCollectCells: readonly NoCollectCellSetting[],
    swaps: readonly PokemonSwap[],
): number {
    if (noCollectCells.length === 0) {
        return 0;
    }

    const swapCellKeySet = buildSwapCellKeySet(swaps);
    return noCollectCells.filter(
        (cell) => !swapCellKeySet.has(toCellKey(cell.dayIndex, cell.slotId, cell.teamSlotIndex))
    ).length;
}

export function buildNoCollectSupplementEntries(input: BuildNoCollectSupplementEntriesInput): NoCollectSupplementEntry[] {
    const {
        team,
        swaps,
        noCollectCells,
        timeSlots,
        simulationDays,
        box,
    } = input;

    if (noCollectCells.length === 0) {
        return [];
    }

    const swapCellKeySet = buildSwapCellKeySet(swaps);
    const noCollectCellsBySlot = new Map<string, NoCollectCellSetting[]>();
    noCollectCells.forEach((cell) => {
        if (swapCellKeySet.has(toCellKey(cell.dayIndex, cell.slotId, cell.teamSlotIndex))) {
            return;
        }
        const key = toSlotKey(cell.dayIndex, cell.slotId);
        const list = noCollectCellsBySlot.get(key) ?? [];
        list.push(cell);
        noCollectCellsBySlot.set(key, list);
    });
    if (noCollectCellsBySlot.size === 0) {
        return [];
    }

    const swapsBySlot = new Map<string, PokemonSwap[]>();
    swaps.forEach((swap) => {
        const dayIndex = Number.isFinite(swap.dayIndex) ? swap.dayIndex : 0;
        const key = toSlotKey(dayIndex, swap.slotId);
        const list = swapsBySlot.get(key) ?? [];
        list.push(swap);
        swapsBySlot.set(key, list);
    });

    const currentTeamBySlot = team.map((member) => member?.id ?? SWAP_NONE_POKEMON_ID);
    const countByPokemonId = new Map<number, number>();
    const orderedPokemonIds: number[] = [];
    const expandedTimeline = buildExpandedTimeline([...timeSlots], simulationDays);

    expandedTimeline.expandedSlots.forEach((expandedSlot) => {
        const slotKey = toSlotKey(expandedSlot.dayIndex, expandedSlot.originalSlotId);

        const slotSwaps = swapsBySlot.get(slotKey) ?? [];
        slotSwaps.forEach((swap) => {
            if (swap.teamSlotIndex < 0 || swap.teamSlotIndex >= currentTeamBySlot.length) {
                return;
            }
            currentTeamBySlot[swap.teamSlotIndex] = swap.newPokemonId;
        });

        const slotNoCollectCells = noCollectCellsBySlot.get(slotKey);
        if (!slotNoCollectCells || slotNoCollectCells.length === 0) {
            return;
        }

        [...slotNoCollectCells]
            .sort((left, right) => left.teamSlotIndex - right.teamSlotIndex)
            .forEach((cell) => {
                if (cell.teamSlotIndex < 0 || cell.teamSlotIndex >= currentTeamBySlot.length) {
                    return;
                }
                const pokemonId = currentTeamBySlot[cell.teamSlotIndex];
                if (pokemonId === undefined || pokemonId === SWAP_NONE_POKEMON_ID) {
                    return;
                }
                if (!countByPokemonId.has(pokemonId)) {
                    orderedPokemonIds.push(pokemonId);
                }
                countByPokemonId.set(pokemonId, (countByPokemonId.get(pokemonId) ?? 0) + 1);
            });
    });

    return orderedPokemonIds
        .map((pokemonId): NoCollectSupplementEntry | null => {
            const pokemonIdForm = resolvePokemonIdForm(pokemonId, team, box);
            if (pokemonIdForm === null) {
                return null;
            }
            return {
                pokemonId,
                pokemonIdForm,
                count: countByPokemonId.get(pokemonId) ?? 0,
            };
        })
        .filter((entry): entry is NoCollectSupplementEntry => entry !== null);
}
