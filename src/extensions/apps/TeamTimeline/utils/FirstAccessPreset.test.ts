import { beforeEach, describe, expect, it } from 'vitest';
import PokemonIv from '../../../../util/PokemonIv';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import { STORAGE_KEY } from '../types/TeamTimelineTypes';
import {
    applyFirstAccessPresetIfNeeded,
    createTimelineRuntimeBox,
    FIRST_ACCESS_PRESET_MARKER_KEY,
    TEAM_TIMELINE_SWAPS_STORAGE_KEY,
} from './FirstAccessPreset';

const PIKACHU_SERIALIZED = 'kQEAj0QA43wf';
const DRAGONITE_SERIALIZED = 'UQkAjwg5KH0f';
const SLOWBRO_SERIALIZED = 'AQUAjxT5-38f';
const PSYDUCK_SERIALIZED = 'YQMADxhhp3wf';
const RATTATA_SERIALIZED = 'MQEArwAB43wf';
const JOLTEON_SERIALIZED = 'cQgADxhhB34f';

describe('FirstAccessPreset', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('seeds first access team and swaps when related storages are empty', () => {
        applyFirstAccessPresetIfNeeded();

        const teamRaw = localStorage.getItem(STORAGE_KEY);
        const swapsRaw = localStorage.getItem(TEAM_TIMELINE_SWAPS_STORAGE_KEY);
        const marker = localStorage.getItem(FIRST_ACCESS_PRESET_MARKER_KEY);

        expect(teamRaw).not.toBeNull();
        expect(swapsRaw).not.toBeNull();
        expect(marker).toBe('1');

        expect(JSON.parse(teamRaw!)).toEqual([
            PIKACHU_SERIALIZED,
            DRAGONITE_SERIALIZED,
            SLOWBRO_SERIALIZED,
            null,
            PSYDUCK_SERIALIZED,
        ]);
        expect(JSON.parse(swapsRaw!)).toEqual([
            {
                dayIndex: 0,
                slotId: 'slot-1',
                teamSlotIndex: 3,
                newPokemonId: 1000005,
                newPokemonSerialized: RATTATA_SERIALIZED,
                initialEnergy: 100,
            },
            {
                dayIndex: 0,
                slotId: 'slot-2',
                teamSlotIndex: 3,
                newPokemonId: 1000006,
                newPokemonSerialized: JOLTEON_SERIALIZED,
                initialEnergy: 100,
            },
        ]);
    });

    it('does not overwrite existing team storage', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(['existing-team']));

        applyFirstAccessPresetIfNeeded();

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['existing-team']);
        expect(localStorage.getItem(TEAM_TIMELINE_SWAPS_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(FIRST_ACCESS_PRESET_MARKER_KEY)).toBeNull();
    });

    it('does not seed when marker already exists', () => {
        localStorage.setItem(FIRST_ACCESS_PRESET_MARKER_KEY, '1');

        applyFirstAccessPresetIfNeeded();

        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(TEAM_TIMELINE_SWAPS_STORAGE_KEY)).toBeNull();
    });

    it('builds runtime box with user entries + hidden preset entries', () => {
        const userItem = new PokemonBoxItem(PokemonIv.deserialize(PIKACHU_SERIALIZED));
        const userBox = new PokemonBox([userItem]);

        const runtimeBox = createTimelineRuntimeBox(userBox);

        expect(userBox.items).toHaveLength(1);
        expect(runtimeBox.items).toHaveLength(7);
        expect(runtimeBox.getById(userItem.id)).toBe(userItem);
        expect(runtimeBox.getById(1000001)).not.toBeNull();
        expect(runtimeBox.getById(1000002)).not.toBeNull();
        expect(runtimeBox.getById(1000003)).not.toBeNull();
        expect(runtimeBox.getById(1000004)).not.toBeNull();
        expect(runtimeBox.getById(1000005)).not.toBeNull();
        expect(runtimeBox.getById(1000006)).not.toBeNull();
    });
});
