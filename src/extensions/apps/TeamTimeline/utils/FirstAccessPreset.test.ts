import { beforeEach, describe, expect, it } from 'vitest';
import PokemonIv from '../../../../util/PokemonIv';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import { STORAGE_KEY_TEAM_SETS } from '../TeamTimelineState';
import {
    applyFirstAccessPresetIfNeeded,
    createTimelineRuntimeBox,
    FIRST_ACCESS_PRESET_MARKER_KEY,
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

        const payloadRaw = localStorage.getItem(STORAGE_KEY_TEAM_SETS);
        const marker = localStorage.getItem(FIRST_ACCESS_PRESET_MARKER_KEY);

        expect(payloadRaw).not.toBeNull();
        expect(marker).toBe('1');

        const payload = JSON.parse(payloadRaw!);
        expect(payload.activeTeamSetIndex).toBe(0);
        expect(payload.teamSets).toHaveLength(1);
        expect(payload.teamSets[0].team).toEqual([
            PIKACHU_SERIALIZED,
            DRAGONITE_SERIALIZED,
            SLOWBRO_SERIALIZED,
            null,
            PSYDUCK_SERIALIZED,
        ]);
        expect(payload.teamSets[0].swaps).toEqual([
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
        expect(payload.teamSets[0].lastSimulationSnapshot).toBeNull();
    });

    it('does not overwrite existing team storage', () => {
        localStorage.setItem(STORAGE_KEY_TEAM_SETS, JSON.stringify({ activeTeamSetIndex: 0, teamSets: [] }));

        applyFirstAccessPresetIfNeeded();

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY_TEAM_SETS)!)).toEqual({ activeTeamSetIndex: 0, teamSets: [] });
        expect(localStorage.getItem(FIRST_ACCESS_PRESET_MARKER_KEY)).toBeNull();
    });

    it('does not seed when marker already exists', () => {
        localStorage.setItem(FIRST_ACCESS_PRESET_MARKER_KEY, '1');

        applyFirstAccessPresetIfNeeded();

        expect(localStorage.getItem(STORAGE_KEY_TEAM_SETS)).toBeNull();
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
