import { describe, expect, it } from "vitest";
import type { PokemonBoxItem } from "../../../util/PokemonBox";
import PokemonBox from "../../../util/PokemonBox";
import {
	createInitialState,
	loadLeftoverIncludeExtraUsageFromStorage,
	loadSeedModeFromStorage,
	loadSummaryValueModeFromStorage,
	loadSyncWithIvParameterFromStorage,
	loadTeamSetsFromStorage,
	loadTrialCountFromStorage,
	STORAGE_KEY_LEFTOVER_INCLUDE_EXTRA_USAGE,
	STORAGE_KEY_SEED_MODE,
	STORAGE_KEY_SUMMARY_VALUE_MODE,
	STORAGE_KEY_SYNC_IV_PARAMETER,
	STORAGE_KEY_TEAM_SETS,
	STORAGE_KEY_TRIAL_COUNT,
	saveLeftoverIncludeExtraUsageToStorage,
	saveSeedModeToStorage,
	saveSummaryValueModeToStorage,
	saveTeamSetsToStorage,
	saveTrialCountToStorage,
	teamTimelineReducer,
} from "./TeamTimelineState";
import type { TeamSetState } from "./types/TeamTimelineTypes";
import type { PokemonSwap, SimulationResult } from "./types/TimeSlotTypes";
import { createDefaultTimelineBonusSettings } from "./utils/TimelineBonusSettingsBridge";

function createSimulationResult(grandTotalEP: number): SimulationResult {
	return {
		slotResults: new Map(),
		dailySummaries: [],
		teamSummary: {
			totalIngredients: [],
			totalBerryEP: grandTotalEP,
			totalIngredientEP: 0,
			totalSkillEP: 0,
			grandTotalEP,
			totalPresentCandyCount: 0,
			totalCookingPotCapacityIncrease: 0,
			totalTastyChanceIncreasePercent: 0,
			totalDreamShardCount: 0,
		},
	};
}

function createStateWithSimulationData() {
	const simulationResult = createSimulationResult(2000);
	return {
		...createInitialState(),
		simulationLoading: true,
		simulationResult,
		simulationError: "error",
		multiTrialResults: [{ seed: 1, grandTotalEP: 1900 }],
		multiTrialSelectedIndex: 0,
		multiTrialAverageDailySummaries: [],
		multiTrialAverageTeamSummary: simulationResult.teamSummary,
		multiTrialAverageCookingSummary: {
			recipes: [],
			leftoverIngredients: [],
		},
	};
}

describe("teamTimelineReducer", () => {
	it("uses requested first-access defaults for simulation controls", () => {
		const state = createInitialState();

		expect(state.simulationConfig.simulationDays).toBe(1);
		expect(state.simulationConfig.initialEnergy).toBe(50);
		expect(state.simulationConfig.seed).toBe(123456);
		expect(state.seedMode).toBe("random");
		expect(state.multiTrialCount).toBe(1000);
		expect(state.noCollectCells).toEqual([]);
		expect(state.teamSets).toHaveLength(1);
		expect(state.activeTeamSetIndex).toBe(0);
		expect(state.teamSets[0].team).toEqual(state.team);
		expect(state.teamSets[0].swaps).toEqual(state.swaps);
		expect(state.teamSets[0].noCollectCells).toEqual(state.noCollectCells);
		expect(state.teamSets[0].lastSimulationSnapshot).toBeNull();
		expect(state.teamSets[0].saveCookingSettings).toBe(false);
		expect(state.teamSets[0].saveFieldSettings).toBe(false);
		expect(state.teamSets[0].savedCookingSettings).toBeNull();
		expect(state.teamSets[0].savedFieldSettings).toBeNull();
		expect(state.syncWithIvParameter).toBe(true);
		expect(state.cookingSettings.basePotCapacity).toBe(81);
		expect(state.cookingSettings.recipeLevels).toEqual({});
		expect(state.cookingSettings.disabledRecipes).toEqual({});
		expect(state.cookingSettings.disabledExtraIngredients).toEqual({});
		expect(state.timeSlots).toEqual([
			{ id: "slot-1", time: "07:00", sleepState: "wake", hasMeal: true },
			{ id: "slot-2", time: "12:00", sleepState: "none", hasMeal: true },
			{ id: "slot-3", time: "15:00", sleepState: "none", hasMeal: false },
			{ id: "slot-4", time: "18:00", sleepState: "none", hasMeal: true },
			{ id: "slot-5", time: "23:00", sleepState: "sleep", hasMeal: false },
		]);
	});

	it("keeps simulation loading state when preview result is set", () => {
		const started = teamTimelineReducer(createInitialState(), {
			type: "startSimulation",
		});
		const previewResult = createSimulationResult(1234);

		const next = teamTimelineReducer(started, {
			type: "setSimulationPreviewResult",
			result: previewResult,
		});

		expect(next.simulationLoading).toBe(true);
		expect(next.simulationResult).toEqual(previewResult);
	});

	it("keeps simulation outputs when selecting team member", () => {
		const state = createStateWithSimulationData();
		const selectedPokemon = {
			id: 999,
			iv: { idForm: 25, level: 60 },
			filledNickname: () => "ピカチュウ",
		} as unknown as PokemonBoxItem;

		const next = teamTimelineReducer(state, {
			type: "selectPokemon",
			index: 0,
			item: selectedPokemon,
		});

		expect(next.team[0]).toBe(selectedPokemon);
		expect(next.boxSelectDialogOpen).toBe(false);
		expect(next.selectedSlotIndex).toBeNull();
		expect(next.simulationLoading).toBe(state.simulationLoading);
		expect(next.simulationResult).toBe(state.simulationResult);
		expect(next.simulationError).toBe(state.simulationError);
		expect(next.multiTrialResults).toBe(state.multiTrialResults);
		expect(next.multiTrialSelectedIndex).toBe(state.multiTrialSelectedIndex);
		expect(next.multiTrialAverageDailySummaries).toBe(
			state.multiTrialAverageDailySummaries,
		);
		expect(next.multiTrialAverageTeamSummary).toBe(
			state.multiTrialAverageTeamSummary,
		);
		expect(next.multiTrialAverageCookingSummary).toBe(
			state.multiTrialAverageCookingSummary,
		);
	});

	it("keeps simulation outputs when removing team member", () => {
		const state = createStateWithSimulationData();

		const next = teamTimelineReducer(state, {
			type: "removePokemon",
			index: 0,
		});

		expect(next.team[0]).toBeNull();
		expect(next.simulationLoading).toBe(state.simulationLoading);
		expect(next.simulationResult).toBe(state.simulationResult);
		expect(next.simulationError).toBe(state.simulationError);
		expect(next.multiTrialResults).toBe(state.multiTrialResults);
		expect(next.multiTrialSelectedIndex).toBe(state.multiTrialSelectedIndex);
		expect(next.multiTrialAverageDailySummaries).toBe(
			state.multiTrialAverageDailySummaries,
		);
		expect(next.multiTrialAverageTeamSummary).toBe(
			state.multiTrialAverageTeamSummary,
		);
		expect(next.multiTrialAverageCookingSummary).toBe(
			state.multiTrialAverageCookingSummary,
		);
	});

	it("keeps simulation outputs when only swaps are changed", () => {
		const state = {
			...createStateWithSimulationData(),
			swaps: [
				{
					dayIndex: 0,
					slotId: "morning",
					teamSlotIndex: 0,
					newPokemonId: 123,
					initialEnergy: 100,
				},
			],
		};

		const next = teamTimelineReducer(state, { type: "clearSwaps" });

		expect(next.swaps).toEqual([]);
		expect(next.simulationResult).toBe(state.simulationResult);
		expect(next.multiTrialResults).toBe(state.multiTrialResults);
		expect(next.multiTrialAverageTeamSummary).toBe(
			state.multiTrialAverageTeamSummary,
		);
		expect(next.multiTrialAverageCookingSummary).toBe(
			state.multiTrialAverageCookingSummary,
		);
	});
});

describe("removeSwap behavior", () => {
	it("removeSwap without repeat option removes only the targeted day", () => {
		const state = {
			...createInitialState(),
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 1,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
			],
		};

		const next = teamTimelineReducer(state, {
			type: "removeSwap",
			slotId: "slot-2",
			teamIndex: 0,
			dayIndex: 0,
		});

		expect(next.swaps).toHaveLength(1);
		expect(next.swaps[0].dayIndex).toBe(1);
	});

	it("removeSwap with repeat option removes current and future same-pokemon swaps", () => {
		const state = {
			...createInitialState(),
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 1,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 2,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 3,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 888,
					initialEnergy: 80,
				},
				{
					dayIndex: 1,
					slotId: "slot-3",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
			],
		};

		const next = teamTimelineReducer(state, {
			type: "removeSwap",
			slotId: "slot-2",
			teamIndex: 0,
			dayIndex: 0,
			removeFutureRepeats: true,
			pokemonId: 999,
		});

		expect(next.swaps).toHaveLength(2);
		expect(next.swaps).toEqual([
			{
				dayIndex: 3,
				slotId: "slot-2",
				teamSlotIndex: 0,
				newPokemonId: 888,
				initialEnergy: 80,
			},
			{
				dayIndex: 1,
				slotId: "slot-3",
				teamSlotIndex: 0,
				newPokemonId: 999,
				initialEnergy: 80,
			},
		]);
	});
});

describe("noCollect cell behavior", () => {
	it("toggleNoCollectCell adds and removes by same coordinate", () => {
		const initial = createInitialState();
		const added = teamTimelineReducer(initial, {
			type: "toggleNoCollectCell",
			slotId: "slot-2",
			teamIndex: 1,
			dayIndex: 0,
		});

		expect(added.noCollectCells).toEqual([
			{
				dayIndex: 0,
				slotId: "slot-2",
				teamSlotIndex: 1,
			},
		]);

		const removed = teamTimelineReducer(added, {
			type: "toggleNoCollectCell",
			slotId: "slot-2",
			teamIndex: 1,
			dayIndex: 0,
		});

		expect(removed.noCollectCells).toEqual([]);
	});

	it("loadNoCollectCells replaces state value", () => {
		const next = teamTimelineReducer(createInitialState(), {
			type: "loadNoCollectCells",
			noCollectCells: [
				{ dayIndex: 0, slotId: "slot-1", teamSlotIndex: 0 },
				{ dayIndex: 1, slotId: "slot-3", teamSlotIndex: 4 },
			],
		});

		expect(next.noCollectCells).toEqual([
			{ dayIndex: 0, slotId: "slot-1", teamSlotIndex: 0 },
			{ dayIndex: 1, slotId: "slot-3", teamSlotIndex: 4 },
		]);
	});
});

describe("team set actions", () => {
	it("createTeamSet appends empty set and selects it", () => {
		const next = teamTimelineReducer(createInitialState(), {
			type: "createTeamSet",
			id: "new-set",
			name: "新規セット",
		});

		expect(next.teamSets).toHaveLength(2);
		expect(next.activeTeamSetIndex).toBe(1);
		expect(next.teamSets[1].id).toBe("new-set");
		expect(next.teamSets[1].name).toBe("新規セット");
		expect(next.teamSets[1].team).toEqual([null, null, null, null, null]);
		expect(next.team).toEqual([null, null, null, null, null]);
		expect(next.swaps).toEqual([]);
		expect(next.noCollectCells).toEqual([]);
		expect(next.teamSets[1].saveCookingSettings).toBe(false);
		expect(next.teamSets[1].saveFieldSettings).toBe(false);
		expect(next.teamSets[1].savedCookingSettings).toBeNull();
		expect(next.teamSets[1].savedFieldSettings).toBeNull();
	});

	it("updateActiveTeamSetSaveSettings updates name/flags and saves current cooking/field values", () => {
		const base = createInitialState();
		const withCooking = teamTimelineReducer(base, {
			type: "setCookingSettings",
			settings: {
				...base.cookingSettings,
				enabled: true,
				category: "dessert",
			},
		});
		const withField = teamTimelineReducer(withCooking, {
			type: "setBonusSettings",
			settings: {
				...withCooking.bonusSettings,
				fieldIndex: 5,
				favoriteType: ["fire", "water", "grass"],
			},
		});

		const updated = teamTimelineReducer(withField, {
			type: "updateActiveTeamSetSaveSettings",
			name: "保存テスト",
			saveCookingSettings: true,
			saveFieldSettings: true,
		});

		expect(updated.teamSets[0].name).toBe("保存テスト");
		expect(updated.teamSets[0].saveCookingSettings).toBe(true);
		expect(updated.teamSets[0].saveFieldSettings).toBe(true);
		expect(updated.teamSets[0].savedCookingSettings).toEqual({
			enabled: true,
			category: "dessert",
		});
		expect(updated.teamSets[0].savedFieldSettings).toEqual({
			fieldIndex: 5,
			favoriteType: ["fire", "water", "grass"],
		});

		const turnedOff = teamTimelineReducer(updated, {
			type: "updateActiveTeamSetSaveSettings",
			name: "保存テスト",
			saveCookingSettings: false,
			saveFieldSettings: false,
		});
		expect(turnedOff.teamSets[0].savedCookingSettings).toBeNull();
		expect(turnedOff.teamSets[0].savedFieldSettings).toBeNull();
	});

	it("setCookingSettings updates team set saved value only when cooking save is enabled", () => {
		const base = createInitialState();
		const withSaveEnabled = teamTimelineReducer(base, {
			type: "updateActiveTeamSetSaveSettings",
			name: "チーム1",
			saveCookingSettings: true,
			saveFieldSettings: false,
		});

		const updated = teamTimelineReducer(withSaveEnabled, {
			type: "setCookingSettings",
			settings: {
				...withSaveEnabled.cookingSettings,
				enabled: true,
				category: "salad",
			},
		});
		expect(updated.teamSets[0].savedCookingSettings).toEqual({
			enabled: true,
			category: "salad",
		});

		const withSaveDisabled = teamTimelineReducer(base, {
			type: "setCookingSettings",
			settings: {
				...base.cookingSettings,
				enabled: true,
				category: "dessert",
			},
		});
		expect(withSaveDisabled.teamSets[0].savedCookingSettings).toBeNull();
	});

	it("setBonusSettings updates team set saved value only when field save is enabled", () => {
		const base = createInitialState();
		const withSaveEnabled = teamTimelineReducer(base, {
			type: "updateActiveTeamSetSaveSettings",
			name: "チーム1",
			saveCookingSettings: false,
			saveFieldSettings: true,
		});

		const updated = teamTimelineReducer(withSaveEnabled, {
			type: "setBonusSettings",
			settings: {
				...withSaveEnabled.bonusSettings,
				fieldIndex: 4,
				favoriteType: ["rock", "ground", "steel"],
			},
		});
		expect(updated.teamSets[0].savedFieldSettings).toEqual({
			fieldIndex: 4,
			favoriteType: ["rock", "ground", "steel"],
		});

		const withSaveDisabled = teamTimelineReducer(base, {
			type: "setBonusSettings",
			settings: {
				...base.bonusSettings,
				fieldIndex: 4,
				favoriteType: ["rock", "ground", "steel"],
			},
		});
		expect(withSaveDisabled.teamSets[0].savedFieldSettings).toBeNull();
	});

	it("duplicateTeamSet clones team/swaps/noCollect and selects duplicate", () => {
		const base = createInitialState();
		const withSaveSettings = teamTimelineReducer(base, {
			type: "updateActiveTeamSetSaveSettings",
			name: "保存元",
			saveCookingSettings: true,
			saveFieldSettings: true,
		});
		const withSnapshot = teamTimelineReducer(withSaveSettings, {
			type: "setActiveTeamSetSimulationSnapshot",
			snapshot: { averageTotalEP: 4321, settingsHash: "hash-a" },
		});
		const withMember = teamTimelineReducer(withSnapshot, {
			type: "selectPokemon",
			index: 0,
			item: {
				id: 10,
				iv: { idForm: 25 },
				filledNickname: () => "P",
			} as unknown as PokemonBoxItem,
		});
		const withSwap = teamTimelineReducer(withMember, {
			type: "confirmSwapDirect",
			pokemonId: 999,
			initialEnergy: 80,
		});
		const seeded = {
			...withSwap,
			swapTargetSlotId: "slot-1",
			swapTargetTeamIndex: 0,
			swapTargetDayIndex: 0,
		};
		const withRealSwap = teamTimelineReducer(seeded, {
			type: "confirmSwapDirect",
			pokemonId: 999,
			initialEnergy: 80,
		});
		const withNoCollect = teamTimelineReducer(withRealSwap, {
			type: "toggleNoCollectCell",
			slotId: "slot-1",
			teamIndex: 0,
			dayIndex: 0,
		});

		const duplicated = teamTimelineReducer(withNoCollect, {
			type: "duplicateTeamSet",
			id: "dup-set",
			name: "コピー",
		});

		expect(duplicated.teamSets).toHaveLength(2);
		expect(duplicated.activeTeamSetIndex).toBe(1);
		expect(duplicated.teamSets[1].team).toEqual(withNoCollect.teamSets[0].team);
		expect(duplicated.teamSets[1].swaps).toEqual(
			withNoCollect.teamSets[0].swaps,
		);
		expect(duplicated.teamSets[1].noCollectCells).toEqual(
			withNoCollect.teamSets[0].noCollectCells,
		);
		expect(duplicated.teamSets[1].lastSimulationSnapshot).toBeNull();
		expect(duplicated.teamSets[1].saveCookingSettings).toBe(true);
		expect(duplicated.teamSets[1].saveFieldSettings).toBe(true);
		expect(duplicated.teamSets[1].savedCookingSettings).toEqual(
			withNoCollect.teamSets[0].savedCookingSettings,
		);
		expect(duplicated.teamSets[1].savedFieldSettings).toEqual(
			withNoCollect.teamSets[0].savedFieldSettings,
		);
	});

	it("deleteTeamSet keeps adjacent set selected", () => {
		let state = teamTimelineReducer(createInitialState(), {
			type: "createTeamSet",
			id: "set-2",
			name: "set2",
		});
		state = teamTimelineReducer(state, {
			type: "createTeamSet",
			id: "set-3",
			name: "set3",
		});
		state = teamTimelineReducer(state, { type: "selectTeamSet", index: 1 });

		const next = teamTimelineReducer(state, {
			type: "deleteTeamSet",
			fallbackId: "fallback",
			fallbackName: "fallback",
		});

		expect(next.teamSets.map((teamSet) => teamSet.id)).toEqual([
			"team-set-initial",
			"set-3",
		]);
		expect(next.activeTeamSetIndex).toBe(1);
	});

	it("deleteTeamSet recreates one empty set when last set is removed", () => {
		const next = teamTimelineReducer(createInitialState(), {
			type: "deleteTeamSet",
			fallbackId: "new-empty",
			fallbackName: "チーム1",
		});

		expect(next.teamSets).toHaveLength(1);
		expect(next.teamSets[0].id).toBe("new-empty");
		expect(next.teamSets[0].name).toBe("チーム1");
		expect(next.team).toEqual([null, null, null, null, null]);
		expect(next.swaps).toEqual([]);
		expect(next.noCollectCells).toEqual([]);
	});

	it("selectTeamSet switches team/swaps/noCollect snapshot", () => {
		let state = teamTimelineReducer(createInitialState(), {
			type: "createTeamSet",
			id: "set-2",
			name: "set2",
		});
		state = teamTimelineReducer(state, { type: "selectTeamSet", index: 0 });
		state = teamTimelineReducer(state, {
			type: "selectPokemon",
			index: 0,
			item: {
				id: 111,
				iv: { idForm: 25 },
				filledNickname: () => "A",
			} as unknown as PokemonBoxItem,
		});
		state = teamTimelineReducer(state, { type: "selectTeamSet", index: 1 });

		expect(state.team[0]).toBeNull();
		expect(state.swaps).toEqual([]);
		expect(state.noCollectCells).toEqual([]);

		const back = teamTimelineReducer(state, {
			type: "selectTeamSet",
			index: 0,
		});
		expect(back.team[0]).not.toBeNull();
	});

	it("selectPokemon/removePokemon/confirmSwap/toggleNoCollect update active team set", () => {
		const selectedPokemon = {
			id: 123,
			iv: { idForm: 25, level: 60 },
			filledNickname: () => "ピカチュウ",
		} as unknown as PokemonBoxItem;
		const selected = teamTimelineReducer(createInitialState(), {
			type: "selectPokemon",
			index: 0,
			item: selectedPokemon,
		});
		expect(selected.teamSets[0].team[0]).toBe(selectedPokemon);

		const removed = teamTimelineReducer(selected, {
			type: "removePokemon",
			index: 0,
		});
		expect(removed.teamSets[0].team[0]).toBeNull();

		const swapReady = {
			...removed,
			swapTargetSlotId: "slot-1",
			swapTargetTeamIndex: 0,
			swapTargetDayIndex: 0,
		};
		const swapped = teamTimelineReducer(swapReady, {
			type: "confirmSwapDirect",
			pokemonId: 999,
			initialEnergy: 80,
		});
		expect(swapped.teamSets[0].swaps).toHaveLength(1);

		const toggled = teamTimelineReducer(swapped, {
			type: "toggleNoCollectCell",
			slotId: "slot-1",
			teamIndex: 0,
			dayIndex: 0,
		});
		expect(toggled.teamSets[0].noCollectCells).toHaveLength(1);
	});

	it("setActiveTeamSetSimulationSnapshot updates only active team set", () => {
		let state = teamTimelineReducer(createInitialState(), {
			type: "createTeamSet",
			id: "set-2",
			name: "set2",
		});
		state = teamTimelineReducer(state, { type: "selectTeamSet", index: 0 });
		const updated = teamTimelineReducer(state, {
			type: "setActiveTeamSetSimulationSnapshot",
			snapshot: {
				averageTotalEP: 12345,
				settingsHash: "ctx-hash-1",
			},
		});

		expect(updated.teamSets[0].lastSimulationSnapshot).toEqual({
			averageTotalEP: 12345,
			settingsHash: "ctx-hash-1",
		});
		expect(updated.teamSets[1].lastSimulationSnapshot).toBeNull();
	});

	it("clears active snapshot when team/swaps/noCollect are modified", () => {
		const selectedPokemon = {
			id: 222,
			iv: { idForm: 25, level: 60 },
			filledNickname: () => "ピカチュウ",
		} as unknown as PokemonBoxItem;
		const withSnapshot = teamTimelineReducer(createInitialState(), {
			type: "setActiveTeamSetSimulationSnapshot",
			snapshot: {
				averageTotalEP: 5000,
				settingsHash: "ctx-hash-2",
			},
		});

		const afterSelect = teamTimelineReducer(withSnapshot, {
			type: "selectPokemon",
			index: 0,
			item: selectedPokemon,
		});
		expect(afterSelect.teamSets[0].lastSimulationSnapshot).toBeNull();

		const reseeded = teamTimelineReducer(afterSelect, {
			type: "setActiveTeamSetSimulationSnapshot",
			snapshot: {
				averageTotalEP: 5001,
				settingsHash: "ctx-hash-2",
			},
		});
		const swapReady = {
			...reseeded,
			swapTargetSlotId: "slot-1",
			swapTargetTeamIndex: 0,
			swapTargetDayIndex: 0,
		};
		const afterSwap = teamTimelineReducer(swapReady, {
			type: "confirmSwapDirect",
			pokemonId: 999,
			initialEnergy: 80,
		});
		expect(afterSwap.teamSets[0].lastSimulationSnapshot).toBeNull();

		const withSnapshotAgain = teamTimelineReducer(afterSwap, {
			type: "setActiveTeamSetSimulationSnapshot",
			snapshot: {
				averageTotalEP: 5002,
				settingsHash: "ctx-hash-2",
			},
		});
		const afterNoCollect = teamTimelineReducer(withSnapshotAgain, {
			type: "toggleNoCollectCell",
			slotId: "slot-1",
			teamIndex: 0,
			dayIndex: 0,
		});
		expect(afterNoCollect.teamSets[0].lastSimulationSnapshot).toBeNull();
	});
});

describe("moveSwapSeries behavior", () => {
	it("moves a single swap to another cell", () => {
		const state = {
			...createInitialState(),
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 0,
					slotId: "slot-3",
					teamSlotIndex: 4,
					newPokemonId: 777,
					initialEnergy: 70,
				},
			],
		};

		const next = teamTimelineReducer(state, {
			type: "moveSwapSeries",
			fromSlotId: "slot-2",
			fromTeamIndex: 0,
			fromDayIndex: 0,
			toSlotId: "slot-4",
			toTeamIndex: 1,
			toDayIndex: 0,
		});

		expect(next.swaps).toEqual([
			{
				dayIndex: 0,
				slotId: "slot-3",
				teamSlotIndex: 4,
				newPokemonId: 777,
				initialEnergy: 70,
			},
			{
				dayIndex: 0,
				slotId: "slot-4",
				teamSlotIndex: 1,
				newPokemonId: 999,
				initialEnergy: 80,
			},
		]);
	});

	it("moves repeat series together and keeps repeat flags", () => {
		const state = {
			...createInitialState(),
			simulationConfig: {
				...createInitialState().simulationConfig,
				simulationDays: 4,
			},
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 1,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
					isRepeatGenerated: true,
				},
				{
					dayIndex: 2,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
					isRepeatGenerated: true,
				},
			],
		};

		const next = teamTimelineReducer(state, {
			type: "moveSwapSeries",
			fromSlotId: "slot-2",
			fromTeamIndex: 0,
			fromDayIndex: 0,
			toSlotId: "slot-5",
			toTeamIndex: 2,
			toDayIndex: 1,
		});

		expect(next.swaps).toEqual([
			{
				dayIndex: 1,
				slotId: "slot-5",
				teamSlotIndex: 2,
				newPokemonId: 999,
				initialEnergy: 80,
			},
			{
				dayIndex: 2,
				slotId: "slot-5",
				teamSlotIndex: 2,
				newPokemonId: 999,
				initialEnergy: 80,
				isRepeatGenerated: true,
			},
			{
				dayIndex: 3,
				slotId: "slot-5",
				teamSlotIndex: 2,
				newPokemonId: 999,
				initialEnergy: 80,
				isRepeatGenerated: true,
			},
		]);
	});

	it("overwrites an existing destination repeat series at anchor cell", () => {
		const state = {
			...createInitialState(),
			simulationConfig: {
				...createInitialState().simulationConfig,
				simulationDays: 5,
			},
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 111,
					initialEnergy: 80,
				},
				{
					dayIndex: 1,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 111,
					initialEnergy: 80,
					isRepeatGenerated: true,
				},
				{
					dayIndex: 2,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 111,
					initialEnergy: 80,
					isRepeatGenerated: true,
				},
				{
					dayIndex: 1,
					slotId: "slot-3",
					teamSlotIndex: 1,
					newPokemonId: 222,
					initialEnergy: 50,
				},
				{
					dayIndex: 2,
					slotId: "slot-3",
					teamSlotIndex: 1,
					newPokemonId: 222,
					initialEnergy: 50,
					isRepeatGenerated: true,
				},
				{
					dayIndex: 3,
					slotId: "slot-3",
					teamSlotIndex: 1,
					newPokemonId: 222,
					initialEnergy: 50,
					isRepeatGenerated: true,
				},
			],
		};

		const next = teamTimelineReducer(state, {
			type: "moveSwapSeries",
			fromSlotId: "slot-2",
			fromTeamIndex: 0,
			fromDayIndex: 0,
			toSlotId: "slot-3",
			toTeamIndex: 1,
			toDayIndex: 1,
		});

		expect(next.swaps).toEqual([
			{
				dayIndex: 1,
				slotId: "slot-3",
				teamSlotIndex: 1,
				newPokemonId: 111,
				initialEnergy: 80,
			},
			{
				dayIndex: 2,
				slotId: "slot-3",
				teamSlotIndex: 1,
				newPokemonId: 111,
				initialEnergy: 80,
				isRepeatGenerated: true,
			},
			{
				dayIndex: 3,
				slotId: "slot-3",
				teamSlotIndex: 1,
				newPokemonId: 111,
				initialEnergy: 80,
				isRepeatGenerated: true,
			},
		]);
	});

	it("overwrites conflicts on moved series destinations even when destination anchor is empty", () => {
		const state = {
			...createInitialState(),
			simulationConfig: {
				...createInitialState().simulationConfig,
				simulationDays: 5,
			},
			swaps: [
				{
					dayIndex: 0,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
				},
				{
					dayIndex: 1,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
					isRepeatGenerated: true,
				},
				{
					dayIndex: 2,
					slotId: "slot-2",
					teamSlotIndex: 0,
					newPokemonId: 999,
					initialEnergy: 80,
					isRepeatGenerated: true,
				},
				{
					dayIndex: 2,
					slotId: "slot-4",
					teamSlotIndex: 3,
					newPokemonId: 333,
					initialEnergy: 60,
				},
				{
					dayIndex: 4,
					slotId: "slot-4",
					teamSlotIndex: 3,
					newPokemonId: 444,
					initialEnergy: 60,
				},
			],
		};

		const next = teamTimelineReducer(state, {
			type: "moveSwapSeries",
			fromSlotId: "slot-2",
			fromTeamIndex: 0,
			fromDayIndex: 0,
			toSlotId: "slot-4",
			toTeamIndex: 3,
			toDayIndex: 1,
		});

		expect(next.swaps).toEqual([
			{
				dayIndex: 4,
				slotId: "slot-4",
				teamSlotIndex: 3,
				newPokemonId: 444,
				initialEnergy: 60,
			},
			{
				dayIndex: 1,
				slotId: "slot-4",
				teamSlotIndex: 3,
				newPokemonId: 999,
				initialEnergy: 80,
			},
			{
				dayIndex: 2,
				slotId: "slot-4",
				teamSlotIndex: 3,
				newPokemonId: 999,
				initialEnergy: 80,
				isRepeatGenerated: true,
			},
			{
				dayIndex: 3,
				slotId: "slot-4",
				teamSlotIndex: 3,
				newPokemonId: 999,
				initialEnergy: 80,
				isRepeatGenerated: true,
			},
		]);
	});
});

describe("summary value mode storage", () => {
	it("saves and loads dailyAverage mode", () => {
		saveSummaryValueModeToStorage("dailyAverage");
		expect(loadSummaryValueModeFromStorage()).toBe("dailyAverage");
	});

	it("falls back to periodTotal for missing or invalid value", () => {
		localStorage.removeItem(STORAGE_KEY_SUMMARY_VALUE_MODE);
		expect(loadSummaryValueModeFromStorage()).toBe("periodTotal");

		localStorage.setItem(STORAGE_KEY_SUMMARY_VALUE_MODE, "unexpected");
		expect(loadSummaryValueModeFromStorage()).toBe("periodTotal");
	});
});

describe("leftover include extra usage storage", () => {
	it("saves and loads enabled state", () => {
		saveLeftoverIncludeExtraUsageToStorage(true);
		expect(loadLeftoverIncludeExtraUsageFromStorage()).toBe(true);
	});

	it("falls back to false for missing or invalid value", () => {
		localStorage.removeItem(STORAGE_KEY_LEFTOVER_INCLUDE_EXTRA_USAGE);
		expect(loadLeftoverIncludeExtraUsageFromStorage()).toBe(false);

		localStorage.setItem(
			STORAGE_KEY_LEFTOVER_INCLUDE_EXTRA_USAGE,
			"unexpected",
		);
		expect(loadLeftoverIncludeExtraUsageFromStorage()).toBe(false);
	});

	it("loads disabled state explicitly", () => {
		saveLeftoverIncludeExtraUsageToStorage(false);
		expect(loadLeftoverIncludeExtraUsageFromStorage()).toBe(false);
	});
});

describe("confirmSwap with repeat", () => {
	/** Helper to create a state with swap dialog targeting a specific slot */
	function createSwapReadyState(overrides?: {
		simulationDays?: number;
		pendingSwapPokemonId?: number;
		swapTargetSlotId?: string;
		swapTargetTeamIndex?: number;
		swapTargetDayIndex?: number;
		team?: (PokemonBoxItem | null)[];
		swaps?: PokemonSwap[];
	}) {
		const team = overrides?.team ?? [
			{ id: 100 } as PokemonBoxItem,
			{ id: 200 } as PokemonBoxItem,
			null,
			null,
			null,
		];
		const base = createInitialState();
		return {
			...base,
			team,
			simulationConfig: {
				...base.simulationConfig,
				simulationDays: overrides?.simulationDays ?? 1,
			},
			swapTargetSlotId: overrides?.swapTargetSlotId ?? "slot-2",
			swapTargetTeamIndex: overrides?.swapTargetTeamIndex ?? 0,
			swapTargetDayIndex: overrides?.swapTargetDayIndex ?? 0,
			swapDialogOpen: false,
			energyDialogOpen: true,
			pendingSwapPokemonId: overrides?.pendingSwapPokemonId ?? 999,
			swaps: overrides?.swaps ?? [],
		};
	}

	it("confirmSwap stores basic swap data", () => {
		const state = createSwapReadyState();

		const next = teamTimelineReducer(state, {
			type: "confirmSwap",
			initialEnergy: 80,
		});

		expect(next.swaps).toHaveLength(1);
		const swap = next.swaps[0];
		expect(swap.dayIndex).toBe(0);
		expect(swap.slotId).toBe("slot-2");
		expect(swap.teamSlotIndex).toBe(0);
		expect(swap.newPokemonId).toBe(999);
		expect(swap.initialEnergy).toBe(80);
	});

	it("confirmSwap with repeat generates swaps for subsequent days", () => {
		const state = createSwapReadyState({
			simulationDays: 3,
			swapTargetDayIndex: 0,
		});

		const next = teamTimelineReducer(state, {
			type: "confirmSwap",
			initialEnergy: 80,
			repeat: true,
		});

		expect(next.swaps).toHaveLength(3);

		// Day 0: the original swap
		expect(next.swaps[0].dayIndex).toBe(0);
		expect(next.swaps[0].isRepeatGenerated).toBeUndefined();

		// Day 1: repeat-generated
		expect(next.swaps[1].dayIndex).toBe(1);
		expect(next.swaps[1].isRepeatGenerated).toBe(true);

		// Day 2: repeat-generated
		expect(next.swaps[2].dayIndex).toBe(2);
		expect(next.swaps[2].isRepeatGenerated).toBe(true);
	});
});

describe("simulation controls storage", () => {
	it("saves and loads seed mode", () => {
		saveSeedModeToStorage("fixed");
		expect(loadSeedModeFromStorage()).toBe("fixed");
	});

	it("falls back to random seed mode for missing or invalid value", () => {
		localStorage.removeItem(STORAGE_KEY_SEED_MODE);
		expect(loadSeedModeFromStorage()).toBe("random");

		localStorage.setItem(STORAGE_KEY_SEED_MODE, "unexpected");
		expect(loadSeedModeFromStorage()).toBe("random");
	});

	it("saves and loads trial count", () => {
		saveTrialCountToStorage(1000);
		expect(loadTrialCountFromStorage()).toBe(1000);
	});

	it("falls back to default trial count for missing or invalid value", () => {
		localStorage.removeItem(STORAGE_KEY_TRIAL_COUNT);
		expect(loadTrialCountFromStorage()).toBe(1000);

		localStorage.setItem(STORAGE_KEY_TRIAL_COUNT, "999");
		expect(loadTrialCountFromStorage()).toBe(1000);
	});

	it("defaults syncWithIvParameter to true when storage is missing", () => {
		localStorage.removeItem(STORAGE_KEY_SYNC_IV_PARAMETER);
		expect(loadSyncWithIvParameterFromStorage()).toBe(true);
	});

	it("loads syncWithIvParameter from storage when explicitly set", () => {
		localStorage.setItem(STORAGE_KEY_SYNC_IV_PARAMETER, "0");
		expect(loadSyncWithIvParameterFromStorage()).toBe(false);

		localStorage.setItem(STORAGE_KEY_SYNC_IV_PARAMETER, "1");
		expect(loadSyncWithIvParameterFromStorage()).toBe(true);
	});
});

describe("team set storage", () => {
	it("saves and loads team set payload", () => {
		const teamSets: TeamSetState[] = [
			{
				id: "set-1",
				name: "チーム1",
				team: [null, null, null, null, null],
				swaps: [
					{
						dayIndex: 0,
						slotId: "slot-1",
						teamSlotIndex: 0,
						newPokemonId: 999,
						initialEnergy: 80,
					},
				],
				noCollectCells: [{ dayIndex: 0, slotId: "slot-1", teamSlotIndex: 0 }],
				lastSimulationSnapshot: {
					averageTotalEP: 24680,
					settingsHash: "ctx-storage",
				},
				saveCookingSettings: true,
				saveFieldSettings: true,
				savedCookingSettings: {
					enabled: true,
					category: "salad",
				},
				savedFieldSettings: {
					fieldIndex: 2,
					favoriteType: ["fire", "water", "grass"],
				},
			},
			{
				id: "set-2",
				name: "チーム2",
				team: [null, null, null, null, null],
				swaps: [],
				noCollectCells: [],
				lastSimulationSnapshot: null,
				saveCookingSettings: false,
				saveFieldSettings: false,
				savedCookingSettings: null,
				savedFieldSettings: null,
			},
		];

		saveTeamSetsToStorage(teamSets, 1);
		const loaded = loadTeamSetsFromStorage(new PokemonBox());

		expect(loaded).not.toBeNull();
		expect(loaded?.activeTeamSetIndex).toBe(1);
		expect(loaded?.teamSets).toHaveLength(2);
		expect(loaded?.teamSets[0].name).toBe("チーム1");
		expect(loaded?.teamSets[0].swaps).toHaveLength(1);
		expect(loaded?.teamSets[0].noCollectCells).toHaveLength(1);
		expect(loaded?.teamSets[0].lastSimulationSnapshot).toEqual({
			averageTotalEP: 24680,
			settingsHash: "ctx-storage",
		});
		expect(loaded?.teamSets[0].saveCookingSettings).toBe(true);
		expect(loaded?.teamSets[0].saveFieldSettings).toBe(true);
		expect(loaded?.teamSets[0].savedCookingSettings).toEqual({
			enabled: true,
			category: "salad",
		});
		expect(loaded?.teamSets[0].savedFieldSettings).toEqual({
			fieldIndex: 2,
			favoriteType: ["fire", "water", "grass"],
		});
	});

	it("returns null when team set storage is missing or invalid", () => {
		localStorage.removeItem(STORAGE_KEY_TEAM_SETS);
		expect(loadTeamSetsFromStorage(new PokemonBox())).toBeNull();

		localStorage.setItem(STORAGE_KEY_TEAM_SETS, '{"invalid":true}');
		expect(loadTeamSetsFromStorage(new PokemonBox())).toBeNull();
	});

	it("falls back to null when snapshot data is invalid", () => {
		localStorage.setItem(
			STORAGE_KEY_TEAM_SETS,
			JSON.stringify({
				activeTeamSetIndex: 0,
				teamSets: [
					{
						id: "set-1",
						name: "チーム1",
						team: [null, null, null, null, null],
						swaps: [],
						noCollectCells: [],
						lastSimulationSnapshot: {
							averageTotalEP: "not-number",
							settingsHash: 123,
						},
					},
				],
			}),
		);

		const loaded = loadTeamSetsFromStorage(new PokemonBox());
		expect(loaded).not.toBeNull();
		expect(loaded?.teamSets[0].lastSimulationSnapshot).toBeNull();
		expect(loaded?.teamSets[0].saveCookingSettings).toBe(false);
		expect(loaded?.teamSets[0].saveFieldSettings).toBe(false);
		expect(loaded?.teamSets[0].savedCookingSettings).toBeNull();
		expect(loaded?.teamSets[0].savedFieldSettings).toBeNull();
	});

	it("falls back to disabled flags for legacy team set payload", () => {
		localStorage.setItem(
			STORAGE_KEY_TEAM_SETS,
			JSON.stringify({
				activeTeamSetIndex: 0,
				teamSets: [
					{
						id: "set-legacy",
						name: "Legacy",
						team: [null, null, null, null, null],
						swaps: [],
						noCollectCells: [],
						lastSimulationSnapshot: null,
					},
				],
			}),
		);

		const loaded = loadTeamSetsFromStorage(new PokemonBox());
		expect(loaded).not.toBeNull();
		expect(loaded?.teamSets[0].saveCookingSettings).toBe(false);
		expect(loaded?.teamSets[0].saveFieldSettings).toBe(false);
		expect(loaded?.teamSets[0].savedCookingSettings).toBeNull();
		expect(loaded?.teamSets[0].savedFieldSettings).toBeNull();
	});

	it("falls back to default saved values when enabled flags are true but payload is invalid", () => {
		const defaultBonusSettings = createDefaultTimelineBonusSettings();
		localStorage.setItem(
			STORAGE_KEY_TEAM_SETS,
			JSON.stringify({
				activeTeamSetIndex: 0,
				teamSets: [
					{
						id: "set-invalid",
						name: "Invalid",
						team: [null, null, null, null, null],
						swaps: [],
						noCollectCells: [],
						saveCookingSettings: true,
						saveFieldSettings: true,
						savedCookingSettings: {
							enabled: "invalid",
							category: "invalid",
						},
						savedFieldSettings: {
							fieldIndex: "invalid",
							favoriteType: "invalid",
						},
					},
				],
			}),
		);

		const loaded = loadTeamSetsFromStorage(new PokemonBox());
		expect(loaded).not.toBeNull();
		expect(loaded?.teamSets[0].saveCookingSettings).toBe(true);
		expect(loaded?.teamSets[0].saveFieldSettings).toBe(true);
		expect(loaded?.teamSets[0].savedCookingSettings).toEqual({
			enabled: false,
			category: "curry",
		});
		expect(loaded?.teamSets[0].savedFieldSettings).toEqual({
			fieldIndex: defaultBonusSettings.fieldIndex,
			favoriteType: defaultBonusSettings.favoriteType,
		});
	});
});
