/**
 * QuickSimOptimizerWorkerProtocol.ts
 * 起用率最適化ワーカーとメインスレッドの間のメッセージ型と、評価器の文脈の
 * 直列化。クラスインスタンス（PokemonBox / PokemonBoxItem）は postMessage で
 * 型を失うため、ポケモンは PokemonIv の直列化文字列で送る。
 */

import PokemonBox, { PokemonBoxItem } from "../../../../util/PokemonBox";
import PokemonIv from "../../../../util/PokemonIv";
import {
	deserializeStrengthParameter,
	serializeStrengthParameter,
} from "../../../../util/StrengthParameter";
import type { CookingSimulationSettings } from "../types/CookingTypes";
import type { ProvisionalSettings } from "../types/ProvisionalSettingsTypes";
import type {
	QuickSimCandidateEvaluation,
	QuickSimOptimizerEvaluateOptions,
} from "../types/QuickSimOptimizerTypes";
import type { QuickSimUsageMode } from "../types/QuickSimTypes";
import type { TimelineBonusSettings } from "../types/TimelineBonusSettingsTypes";
import type { SimulationConfig, TimeSlot } from "../types/TimeSlotTypes";
import type { QuickSimEvaluatorContext } from "./QuickSimEvaluator";

export interface SerializedQuickSimOptimizerMember {
	pokemonId: number;
	nickname: string;
	/** PokemonIv.serialize() の文字列 */
	iv: string;
	usageMode: QuickSimUsageMode;
}

export interface SerializedQuickSimEvaluatorContext {
	members: SerializedQuickSimOptimizerMember[];
	timeSlots: TimeSlot[];
	simulationConfig: SimulationConfig;
	bonusSettings: TimelineBonusSettings;
	cookingSettings: CookingSimulationSettings;
	provisionalSettings: ProvisionalSettings;
	/** serializeStrengthParameter の JSON をパースしたもの */
	strengthParameter: unknown;
}

export type QuickSimOptimizerWorkerRequest =
	| { type: "init"; context: SerializedQuickSimEvaluatorContext }
	| {
			type: "evaluate";
			requestId: number;
			candidates: number[][];
			seeds: number[];
			options: QuickSimOptimizerEvaluateOptions;
	  };

export type QuickSimOptimizerWorkerResponse =
	| { type: "ready" }
	| { type: "progress"; requestId: number; completed: number; total: number }
	| {
			type: "result";
			requestId: number;
			evaluations: QuickSimCandidateEvaluation[];
	  }
	| { type: "error"; requestId: number | null; message: string };

/**
 * 評価器の文脈を postMessage で送れる形にする。
 * ボックスからはメンバーのポケモンだけを取り出す。
 */
export function serializeQuickSimEvaluatorContext(
	context: QuickSimEvaluatorContext,
): SerializedQuickSimEvaluatorContext {
	return {
		members: context.members.map((member) => {
			const item = context.box.getById(member.pokemonId);
			if (!item) {
				throw new Error(`Pokemon ${member.pokemonId} is not in the box`);
			}
			return {
				pokemonId: member.pokemonId,
				nickname: item.nickname,
				iv: item.iv.serialize(),
				usageMode: member.usageMode,
			};
		}),
		timeSlots: context.timeSlots.map((slot) => ({ ...slot })),
		simulationConfig: { ...context.simulationConfig },
		bonusSettings: context.bonusSettings,
		cookingSettings: context.cookingSettings,
		provisionalSettings: context.provisionalSettings,
		strengthParameter: JSON.parse(
			serializeStrengthParameter(context.strengthParameter),
		),
	};
}

/** ワーカー側で評価器の文脈を復元する */
export function deserializeQuickSimEvaluatorContext(
	serialized: SerializedQuickSimEvaluatorContext,
): QuickSimEvaluatorContext {
	const items = serialized.members.map(
		(member) =>
			new PokemonBoxItem(
				PokemonIv.deserialize(member.iv),
				member.nickname,
				member.pokemonId,
			),
	);
	return {
		box: new PokemonBox(items),
		members: serialized.members.map((member) => ({
			pokemonId: member.pokemonId,
			usageMode: member.usageMode,
		})),
		timeSlots: serialized.timeSlots,
		simulationConfig: serialized.simulationConfig,
		bonusSettings: serialized.bonusSettings,
		cookingSettings: serialized.cookingSettings,
		provisionalSettings: serialized.provisionalSettings,
		strengthParameter: deserializeStrengthParameter(
			serialized.strengthParameter,
		),
	};
}
