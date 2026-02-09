import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PokemonSwap } from '../types/TimeSlotTypes';
import { useSwapAutoRerun } from './useSwapAutoRerun';

const SWAP_A: PokemonSwap = {
    dayIndex: 0,
    slotId: 'slot-1',
    teamSlotIndex: 0,
    newPokemonId: 101,
    initialEnergy: 80,
};

const SWAP_B: PokemonSwap = {
    dayIndex: 0,
    slotId: 'slot-2',
    teamSlotIndex: 1,
    newPokemonId: 202,
    initialEnergy: 65,
};

describe('useSwapAutoRerun', () => {
    it('does not rerun on initial render', () => {
        const onAutoRerun = vi.fn();

        renderHook((props: {
            swaps: readonly PokemonSwap[];
            isInitialized: boolean;
            hasSimulationResult: boolean;
            simulationLoading: boolean;
            currentSeed: number;
            onAutoRerun: (seed: number) => void;
        }) => useSwapAutoRerun(props), {
            initialProps: {
                swaps: [SWAP_A],
                isInitialized: true,
                hasSimulationResult: true,
                simulationLoading: false,
                currentSeed: 12345,
                onAutoRerun,
            },
        });

        expect(onAutoRerun).not.toHaveBeenCalled();
    });

    it('reruns once when swaps change', () => {
        const onAutoRerun = vi.fn();

        const { rerender } = renderHook((props: {
            swaps: readonly PokemonSwap[];
            isInitialized: boolean;
            hasSimulationResult: boolean;
            simulationLoading: boolean;
            currentSeed: number;
            onAutoRerun: (seed: number) => void;
        }) => useSwapAutoRerun(props), {
            initialProps: {
                swaps: [SWAP_A],
                isInitialized: true,
                hasSimulationResult: true,
                simulationLoading: false,
                currentSeed: 24680,
                onAutoRerun,
            },
        });

        rerender({
            swaps: [SWAP_A, SWAP_B],
            isInitialized: true,
            hasSimulationResult: true,
            simulationLoading: false,
            currentSeed: 24680,
            onAutoRerun,
        });

        expect(onAutoRerun).toHaveBeenCalledTimes(1);
        expect(onAutoRerun).toHaveBeenCalledWith(24680);
    });

    it('does not rerun when simulation result is missing', () => {
        const onAutoRerun = vi.fn();

        const { rerender } = renderHook((props: {
            swaps: readonly PokemonSwap[];
            isInitialized: boolean;
            hasSimulationResult: boolean;
            simulationLoading: boolean;
            currentSeed: number;
            onAutoRerun: (seed: number) => void;
        }) => useSwapAutoRerun(props), {
            initialProps: {
                swaps: [SWAP_A],
                isInitialized: true,
                hasSimulationResult: false,
                simulationLoading: false,
                currentSeed: 13579,
                onAutoRerun,
            },
        });

        rerender({
            swaps: [SWAP_B],
            isInitialized: true,
            hasSimulationResult: false,
            simulationLoading: false,
            currentSeed: 13579,
            onAutoRerun,
        });

        expect(onAutoRerun).not.toHaveBeenCalled();
    });

    it('does not rerun when only seed changes and swaps stay the same', () => {
        const onAutoRerun = vi.fn();

        const { rerender } = renderHook((props: {
            swaps: readonly PokemonSwap[];
            isInitialized: boolean;
            hasSimulationResult: boolean;
            simulationLoading: boolean;
            currentSeed: number;
            onAutoRerun: (seed: number) => void;
        }) => useSwapAutoRerun(props), {
            initialProps: {
                swaps: [SWAP_A],
                isInitialized: true,
                hasSimulationResult: true,
                simulationLoading: false,
                currentSeed: 11111,
                onAutoRerun,
            },
        });

        rerender({
            swaps: [SWAP_A],
            isInitialized: true,
            hasSimulationResult: true,
            simulationLoading: false,
            currentSeed: 22222,
            onAutoRerun,
        });

        expect(onAutoRerun).not.toHaveBeenCalled();
    });

    it('reruns when only dayIndex changes', () => {
        const onAutoRerun = vi.fn();

        const { rerender } = renderHook((props: {
            swaps: readonly PokemonSwap[];
            isInitialized: boolean;
            hasSimulationResult: boolean;
            simulationLoading: boolean;
            currentSeed: number;
            onAutoRerun: (seed: number) => void;
        }) => useSwapAutoRerun(props), {
            initialProps: {
                swaps: [SWAP_A],
                isInitialized: true,
                hasSimulationResult: true,
                simulationLoading: false,
                currentSeed: 33333,
                onAutoRerun,
            },
        });

        rerender({
            swaps: [{ ...SWAP_A, dayIndex: 1 }],
            isInitialized: true,
            hasSimulationResult: true,
            simulationLoading: false,
            currentSeed: 33333,
            onAutoRerun,
        });

        expect(onAutoRerun).toHaveBeenCalledTimes(1);
        expect(onAutoRerun).toHaveBeenCalledWith(33333);
    });
});
