import { describe, expect, it } from 'vitest';
import { createDefaultCookingSettings } from '../types/CookingTypes';
import { DEFAULT_TIME_SLOTS } from '../types/TimeSlotTypes';
import { createDefaultTimelineBonusSettings } from './TimelineBonusSettingsBridge';
import { buildSimulationContextHash } from './SimulationContextHash';

describe('buildSimulationContextHash', () => {
    it('returns the same hash for the same context', () => {
        const hash1 = buildSimulationContextHash({
            bonusSettings: createDefaultTimelineBonusSettings(),
            cookingSettings: createDefaultCookingSettings(),
            initialEnergy: 50,
            simulationDays: 3,
            timeSlots: DEFAULT_TIME_SLOTS,
        });
        const hash2 = buildSimulationContextHash({
            bonusSettings: createDefaultTimelineBonusSettings(),
            cookingSettings: createDefaultCookingSettings(),
            initialEnergy: 50,
            simulationDays: 3,
            timeSlots: DEFAULT_TIME_SLOTS,
        });

        expect(hash1).toBe(hash2);
    });

    it('changes when simulationDays changes', () => {
        const baseContext = {
            bonusSettings: createDefaultTimelineBonusSettings(),
            cookingSettings: createDefaultCookingSettings(),
            initialEnergy: 50,
            timeSlots: DEFAULT_TIME_SLOTS,
        };
        const hash1 = buildSimulationContextHash({
            ...baseContext,
            simulationDays: 3,
        });
        const hash2 = buildSimulationContextHash({
            ...baseContext,
            simulationDays: 4,
        });

        expect(hash1).not.toBe(hash2);
    });

    it('changes when cooking settings changes', () => {
        const baseCooking = createDefaultCookingSettings();
        const hash1 = buildSimulationContextHash({
            bonusSettings: createDefaultTimelineBonusSettings(),
            cookingSettings: baseCooking,
            initialEnergy: 50,
            simulationDays: 3,
            timeSlots: DEFAULT_TIME_SLOTS,
        });
        const hash2 = buildSimulationContextHash({
            bonusSettings: createDefaultTimelineBonusSettings(),
            cookingSettings: {
                ...baseCooking,
                basePotCapacity: baseCooking.basePotCapacity + 1,
            },
            initialEnergy: 50,
            simulationDays: 3,
            timeSlots: DEFAULT_TIME_SLOTS,
        });

        expect(hash1).not.toBe(hash2);
    });

    it('keeps the same hash even if object key order differs', () => {
        const bonusSettings = createDefaultTimelineBonusSettings();
        const cookingSettingsA = {
            ...createDefaultCookingSettings(),
            recipeLevels: { recipeA: 55, recipeB: 12 },
            disabledRecipes: { recipeA: true, recipeB: false },
        };
        const cookingSettingsB = {
            ...createDefaultCookingSettings(),
            recipeLevels: { recipeB: 12, recipeA: 55 },
            disabledRecipes: { recipeB: false, recipeA: true },
        };
        const hash1 = buildSimulationContextHash({
            bonusSettings,
            cookingSettings: cookingSettingsA,
            initialEnergy: 50,
            simulationDays: 3,
            timeSlots: DEFAULT_TIME_SLOTS,
        });
        const hash2 = buildSimulationContextHash({
            bonusSettings,
            cookingSettings: cookingSettingsB,
            initialEnergy: 50,
            simulationDays: 3,
            timeSlots: DEFAULT_TIME_SLOTS,
        });

        expect(hash1).toBe(hash2);
    });
});

