/**
 * TrialBatchProtocol.ts
 * Messages exchanged between the main thread and the timeline simulation
 * worker, plus (de)serialization of the trial inputs that cross that boundary.
 *
 * Everything posted to a worker must survive structured clone: class
 * instances (PokemonBoxItem, PokemonIv inside StrengthParameter) are
 * flattened to strings here and rebuilt on the other side.
 */

import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import {
	deserializeStrengthParameter,
	serializeStrengthParameter,
} from "../../../../util/StrengthParameter";
import type { CookingSimulationSettings } from "../types/CookingTypes";
import type { TrialSummary } from "../types/MultiTrialTypes";
import type { TimelineBonusSettings } from "../types/TimelineBonusSettingsTypes";
import {
	type NoCollectCellSetting,
	type PokemonSwap,
	type SimulationConfig,
	type SimulationResult,
	SWAP_NONE_POKEMON_ID,
	type TimeSlot,
} from "../types/TimeSlotTypes";
import { buildStrengthParameterFromTimelineBonusSettings } from "../utils/TimelineBonusSettingsBridge";
import type {
	AggregationState,
	TrialSimulationInput,
} from "./MultiTrialSimulator";
import {
	resolveDefaultPokemonName,
	type SimulationAnalysisOptions,
} from "./TimelineSimulator";

/** A box item flattened for postMessage (id + PokemonBoxItem.serialize()). */
export interface SerializedBoxItem {
	id: number;
	data: string;
}

/** {@link TrialSimulationInput} in a structured-clone-safe form. */
export interface SerializedTrialSimulationInput {
	/** Team slots as box item ids (null = empty slot). */
	teamIds: (number | null)[];
	/** Every box item the simulation may touch: the team plus swap targets. */
	boxItems: SerializedBoxItem[];
	timeSlots: TimeSlot[];
	config: Omit<SimulationConfig, "seed">;
	bonusSettings: TimelineBonusSettings;
	/** Output of serializeStrengthParameter (built on the main thread). */
	strengthParameter: string;
	swaps?: PokemonSwap[];
	noCollectCells?: NoCollectCellSetting[];
	cookingSettings?: CookingSimulationSettings;
	analysisOptions?: SimulationAnalysisOptions;
	/** Display names resolved on the main thread (needs i18n), by box item id. */
	pokemonNames: [number, string][];
}

/** Main thread → worker. */
export type TrialBatchRequest =
	| {
			type: "run";
			jobId: number;
			input: SerializedTrialSimulationInput;
			seeds: number[];
			/** Post the first trial's full result as a preview. */
			previewFirstTrial: boolean;
	  }
	| {
			/** Stop after the current trial and post what has been done so far. */
			type: "stop";
			jobId: number;
	  };

/** Worker → main thread. */
export type TrialBatchResponse =
	| { type: "progress"; jobId: number; completed: number }
	| { type: "preview"; jobId: number; seed: number; result: SimulationResult }
	| {
			type: "done";
			jobId: number;
			trials: TrialSummary[];
			state: AggregationState;
	  }
	| { type: "error"; jobId: number; message: string };

/**
 * Collect every box item a trial may use: team members plus the targets of
 * swaps (looked up in the box). Deduplicated by id, team members first.
 */
function collectReferencedBoxItems(
	input: TrialSimulationInput,
): PokemonBoxItem[] {
	const items = new Map<number, PokemonBoxItem>();
	for (const pokemon of input.team) {
		if (pokemon !== null && !items.has(pokemon.id)) {
			items.set(pokemon.id, pokemon);
		}
	}
	for (const swap of input.swaps ?? []) {
		if (
			swap.newPokemonId === SWAP_NONE_POKEMON_ID ||
			items.has(swap.newPokemonId)
		) {
			continue;
		}
		const item = input.box?.getById(swap.newPokemonId);
		if (item) {
			items.set(item.id, item);
		}
	}
	return [...items.values()];
}

/**
 * Flatten a trial input for postMessage. Resolves display names and the
 * StrengthParameter here because both need main-thread-only resources
 * (i18n, localStorage).
 */
export function serializeTrialSimulationInput(
	input: TrialSimulationInput,
): SerializedTrialSimulationInput {
	const resolvePokemonName =
		input.resolvePokemonName ?? resolveDefaultPokemonName;
	const strengthParameter =
		input.strengthParameter ??
		buildStrengthParameterFromTimelineBonusSettings(input.bonusSettings);
	const boxItems = collectReferencedBoxItems(input);
	return {
		teamIds: input.team.map((pokemon) => (pokemon ? pokemon.id : null)),
		boxItems: boxItems.map((item) => ({ id: item.id, data: item.serialize() })),
		timeSlots: input.timeSlots,
		config: input.config,
		bonusSettings: input.bonusSettings,
		strengthParameter: serializeStrengthParameter(strengthParameter),
		swaps: input.swaps,
		noCollectCells: input.noCollectCells,
		cookingSettings: input.cookingSettings,
		analysisOptions: input.analysisOptions,
		pokemonNames: boxItems.map((item) => [item.id, resolvePokemonName(item)]),
	};
}

/** Rebuild a trial input (with real PokemonBoxItem instances) inside the worker. */
export function deserializeTrialSimulationInput(
	serialized: SerializedTrialSimulationInput,
): TrialSimulationInput {
	const box = new PokemonBox();
	const itemById = new Map<number, PokemonBoxItem>();
	const items: PokemonBoxItem[] = [];
	for (const { id, data } of serialized.boxItems) {
		const parsed = box.deserializeItem(data);
		if (parsed === null) {
			throw new Error(`Failed to deserialize box item ${id}`);
		}
		const item = new PokemonBoxItem(parsed.iv, parsed.nickname, id);
		itemById.set(id, item);
		items.push(item);
	}
	const pokemonNames = new Map<number, string>(serialized.pokemonNames);
	return {
		team: serialized.teamIds.map((id) =>
			id === null ? null : (itemById.get(id) ?? null),
		),
		timeSlots: serialized.timeSlots,
		config: serialized.config,
		bonusSettings: serialized.bonusSettings,
		swaps: serialized.swaps,
		noCollectCells: serialized.noCollectCells,
		box: new PokemonBox(items),
		cookingSettings: serialized.cookingSettings,
		analysisOptions: serialized.analysisOptions,
		strengthParameter: deserializeStrengthParameter(
			JSON.parse(serialized.strengthParameter),
		),
		resolvePokemonName: (pokemon) =>
			pokemonNames.get(pokemon.id) ?? resolveDefaultPokemonName(pokemon),
	};
}
