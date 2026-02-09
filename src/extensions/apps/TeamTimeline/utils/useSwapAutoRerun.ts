import { useEffect, useRef } from 'react';
import { PokemonSwap } from '../types/TimeSlotTypes';

interface UseSwapAutoRerunInput {
    swaps: readonly PokemonSwap[];
    isInitialized: boolean;
    hasSimulationResult: boolean;
    simulationLoading: boolean;
    currentSeed: number;
    onAutoRerun: (seed: number) => void;
}

function createSwapSignature(swaps: readonly PokemonSwap[]): string {
    return swaps
        .map(
            swap => `${swap.dayIndex}:${swap.slotId}:${swap.teamSlotIndex}:${swap.newPokemonId}:${swap.initialEnergy}`
        )
        .join('|');
}

/**
 * Trigger auto rerun when swap settings are changed.
 * The first render is always ignored.
 */
export function useSwapAutoRerun(input: UseSwapAutoRerunInput): void {
    const { swaps, isInitialized, hasSimulationResult, simulationLoading, currentSeed, onAutoRerun } = input;
    const previousSignatureRef = useRef<string | null>(null);

    useEffect(() => {
        const signature = createSwapSignature(swaps);
        const previousSignature = previousSignatureRef.current;
        previousSignatureRef.current = signature;

        if (previousSignature === null || previousSignature === signature) {
            return;
        }
        if (!isInitialized || !hasSimulationResult || simulationLoading) {
            return;
        }
        onAutoRerun(currentSeed);
    }, [swaps, isInitialized, hasSimulationResult, simulationLoading, currentSeed, onAutoRerun]);
}
