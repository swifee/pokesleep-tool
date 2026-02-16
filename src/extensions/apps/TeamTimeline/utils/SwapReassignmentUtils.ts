import { PokemonBoxItem } from '../../../../util/PokemonBox';
import { PokemonSwap, SWAP_NONE_POKEMON_ID, TimeSlot } from '../types/TimeSlotTypes';
import { buildExpandedTimeline } from './TimelineDayExpansion';

interface SwapReassignmentInput {
    team: readonly (PokemonBoxItem | null)[];
    timeSlots: readonly TimeSlot[];
    simulationDays: number;
    swaps: readonly PokemonSwap[];
    pendingPokemonId: number | null;
    targetSlotId: string | null;
    targetDayIndex: number | null;
}

function buildSwapEventsBySlot(swaps: readonly PokemonSwap[]): Map<string, PokemonSwap[]> {
    const swapsBySlot = new Map<string, PokemonSwap[]>();

    const addSwapEvent = (swap: PokemonSwap): void => {
        const dayIndex = typeof swap.dayIndex === 'number' ? swap.dayIndex : 0;
        const key = `${dayIndex}:${swap.slotId}`;
        const list = swapsBySlot.get(key) ?? [];
        list.push(swap);
        swapsBySlot.set(key, list);
    };

    swaps.forEach(addSwapEvent);

    swaps.forEach((swap) => {
        if (!swap.endSlotId || swap.endDayIndex === undefined || swap.revertPokemonId === undefined) {
            return;
        }
        addSwapEvent({
            dayIndex: swap.endDayIndex,
            slotId: swap.endSlotId,
            teamSlotIndex: swap.teamSlotIndex,
            newPokemonId: swap.revertPokemonId,
            initialEnergy: 0,
        });
    });

    return swapsBySlot;
}

export function isSwapReassignment(input: SwapReassignmentInput): boolean {
    const {
        team,
        timeSlots,
        simulationDays,
        swaps,
        pendingPokemonId,
        targetSlotId,
        targetDayIndex,
    } = input;

    if (
        pendingPokemonId === null ||
        pendingPokemonId === SWAP_NONE_POKEMON_ID ||
        targetSlotId === null ||
        targetDayIndex === null
    ) {
        return false;
    }

    const normalizedTargetSlotId = targetSlotId.replace(/__day\d+$/, '');
    const expandedTimeline = buildExpandedTimeline([...timeSlots], simulationDays);
    const targetIndex = expandedTimeline.expandedSlots.findIndex(
        expandedSlot =>
            expandedSlot.dayIndex === targetDayIndex &&
            expandedSlot.originalSlotId === normalizedTargetSlotId
    );
    if (targetIndex < 0) {
        return false;
    }

    const currentTeamBySlot = team.map(member => member?.id ?? SWAP_NONE_POKEMON_ID);
    let hasBeenAssigned = currentTeamBySlot.includes(pendingPokemonId);
    const swapsBySlot = buildSwapEventsBySlot(swaps);

    for (let i = 0; i < targetIndex; i += 1) {
        const expandedSlot = expandedTimeline.expandedSlots[i];
        const slotSwaps = swapsBySlot.get(`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`) ?? [];
        slotSwaps.forEach((swap) => {
            currentTeamBySlot[swap.teamSlotIndex] = swap.newPokemonId;
            if (swap.newPokemonId === pendingPokemonId) {
                hasBeenAssigned = true;
            }
        });
    }

    const isAssignedImmediatelyBeforeSwap = currentTeamBySlot.includes(pendingPokemonId);
    return hasBeenAssigned && !isAssignedImmediatelyBeforeSwap;
}
