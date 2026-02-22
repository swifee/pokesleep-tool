import PokemonIv from '../../../../util/PokemonIv';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import { SerializedTeam } from '../types/TeamTimelineTypes';
import { PokemonSwap } from '../types/TimeSlotTypes';
import { STORAGE_KEY_TEAM_SETS } from '../TeamTimelineState';

export const FIRST_ACCESS_PRESET_MARKER_KEY = 'PstTeamTimelinePresetAppliedV1';

type PresetPokemonKey =
    | 'pikachu'
    | 'dragonite'
    | 'slowbro'
    | 'psyduck'
    | 'rattata'
    | 'jolteon';

interface PresetPokemonDefinition {
    id: number;
    serializedIv: string;
}

const PRESET_POKEMON_DEFINITIONS: Record<PresetPokemonKey, PresetPokemonDefinition> = {
    pikachu: {
        id: 1000001,
        serializedIv: 'kQEAj0QA43wf',
    },
    dragonite: {
        id: 1000002,
        serializedIv: 'UQkAjwg5KH0f',
    },
    slowbro: {
        id: 1000003,
        serializedIv: 'AQUAjxT5-38f',
    },
    psyduck: {
        id: 1000004,
        serializedIv: 'YQMADxhhp3wf',
    },
    rattata: {
        id: 1000005,
        serializedIv: 'MQEArwAB43wf',
    },
    jolteon: {
        id: 1000006,
        serializedIv: 'cQgADxhhB34f',
    },
};

const PRESET_HIDDEN_POKEMON_ORDER: PresetPokemonKey[] = [
    'pikachu',
    'dragonite',
    'slowbro',
    'psyduck',
    'rattata',
    'jolteon',
];

const PRESET_INITIAL_TEAM_LAYOUT: (PresetPokemonKey | null)[] = [
    'pikachu',
    'dragonite',
    'slowbro',
    null,
    'psyduck',
];

const PRESET_INITIAL_SWAPS: Array<{
    slotId: string;
    teamSlotIndex: number;
    pokemon: PresetPokemonKey;
}> = [
    { slotId: 'slot-1', teamSlotIndex: 3, pokemon: 'rattata' },
    { slotId: 'slot-2', teamSlotIndex: 3, pokemon: 'jolteon' },
];

const PRESET_SWAP_INITIAL_ENERGY = 100;

function createPresetPokemonItem(key: PresetPokemonKey): PokemonBoxItem {
    const preset = PRESET_POKEMON_DEFINITIONS[key];
    return new PokemonBoxItem(
        PokemonIv.deserialize(preset.serializedIv),
        undefined,
        preset.id,
    );
}

function buildPresetSerializedTeam(): SerializedTeam {
    return PRESET_INITIAL_TEAM_LAYOUT.map((key) => {
        if (key === null) {
            return null;
        }
        return PRESET_POKEMON_DEFINITIONS[key].serializedIv;
    });
}

function buildPresetSwaps(): PokemonSwap[] {
    return PRESET_INITIAL_SWAPS.map((presetSwap) => {
        const presetPokemon = PRESET_POKEMON_DEFINITIONS[presetSwap.pokemon];
        return {
            dayIndex: 0,
            slotId: presetSwap.slotId,
            teamSlotIndex: presetSwap.teamSlotIndex,
            newPokemonId: presetPokemon.id,
            newPokemonSerialized: presetPokemon.serializedIv,
            initialEnergy: PRESET_SWAP_INITIAL_ENERGY,
        };
    });
}

export function createFirstAccessPresetHiddenItems(): PokemonBoxItem[] {
    return PRESET_HIDDEN_POKEMON_ORDER.map(createPresetPokemonItem);
}

export function createTimelineRuntimeBox(userBox: PokemonBox): PokemonBox {
    return new PokemonBox([
        ...userBox.items,
        ...createFirstAccessPresetHiddenItems(),
    ]);
}

export function applyFirstAccessPresetIfNeeded(): void {
    if (localStorage.getItem(FIRST_ACCESS_PRESET_MARKER_KEY) !== null) {
        return;
    }
    if (localStorage.getItem(STORAGE_KEY_TEAM_SETS) !== null) {
        return;
    }

    localStorage.setItem(STORAGE_KEY_TEAM_SETS, JSON.stringify({
        activeTeamSetIndex: 0,
        teamSets: [
            {
                id: 'team-set-preset',
                name: 'チーム1',
                team: buildPresetSerializedTeam(),
                swaps: buildPresetSwaps(),
                noCollectCells: [],
                lastSimulationSnapshot: null,
            },
        ],
    }));
    localStorage.setItem(FIRST_ACCESS_PRESET_MARKER_KEY, '1');
}
