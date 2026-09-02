/**
 * ProvisionalSettingsTypes.ts
 * 公式に数値が公開されていない要素を、ユーザーが仮の値でシミュレートするための設定。
 *
 * 上流（nitoyon/pokesleep-tool）にデータが入るまでの暫定措置であり、
 * ここに入る項目は正式な数値が判明した時点で削除・置き換えできるようにしておく。
 */

import {
	getMaxSkillLevel,
	type MainSkillName,
} from "../../../../util/MainSkill";

/** きのみゾーンを展開するメインスキル */
export const BERRY_ZONE_SKILL_NAMES: readonly MainSkillName[] = [
	"Berry Zone",
	"Berry Zone (Psystrike)",
];

/** きのみゾーンのスキルレベル上限 */
export const BERRY_ZONE_MAX_SKILL_LEVEL = getMaxSkillLevel(
	"Berry Zone (Psystrike)",
);

/** きのみゾーンの重ねがけ数の上限として設定できる最大値 */
export const BERRY_ZONE_MAX_STACK_LIMIT = 20;

/** 1重ねがけあたりのきのみエナジー上昇率(%)として設定できる最大値 */
export const BERRY_ZONE_MAX_BONUS_PERCENT = 500;

/** 発動1回あたりのカビゴンエナジーとして設定できる最大値 */
export const BERRY_ZONE_MAX_SNORLAX_ENERGY = 999999;

/** 仮ステータスのおてつだいスピード(秒)の範囲 */
export const PLACEHOLDER_MIN_FREQUENCY_SECONDS = 300;
export const PLACEHOLDER_MAX_FREQUENCY_SECONDS = 7200;

/** 仮ステータスのメインスキル発動率(%)の上限 */
export const PLACEHOLDER_MAX_SKILL_RATE_PERCENT = 100;

/** 仮ステータスの最大所持数の上限 */
export const PLACEHOLDER_MAX_CARRY_LIMIT = 200;

/**
 * きのみゾーン（サイコブレイク）の仮パラメータ。
 *
 * 公式説明:
 * - カビゴンのエナジーを増やしつつ、フィールドに「きのみゾーン」を展開する
 * - 展開中はマゴのみ（エスパータイプ）から得られるエナジーがUPする
 * - 発動のたびに上限まで重ねがけされ、フィールドを移動するまで効果が持続する
 */
export interface BerryZoneProvisionalSettings {
	/** 仮パラメータを使ってシミュレートする */
	enabled: boolean;
	/** シミュレーション開始時点で展開済みとみなす重ねがけ数 */
	initialStackCount: number;
	/** 重ねがけ数の上限 */
	maxStackCount: number;
	/** 1重ねがけあたりのマゴのみエナジー上昇率(%) */
	berryEnergyBonusPercent: number;
	/** 発動1回あたりのカビゴンエナジー（スキルレベル1〜6） */
	snorlaxEnergyByLevel: number[];
}

/** とてもおおきなマゴのみのエナジー倍率として設定できる最大値 */
export const HUGE_MAGO_BERRY_MAX_ENERGY_MULTIPLIER = 50;

/** とてもおおきなマゴのみの取得確率(%)の上限 */
export const HUGE_MAGO_BERRY_MAX_PICKUP_RATE_PERCENT = 100;

/**
 * 「とてもおおきなマゴのみ」の仮パラメータ。
 *
 * 公式説明（2026-09-14 / 09-21 の週のイベント）:
 * - すべてのおてつだいポケモンが、通常のおてつだいで追加で拾ってくることがある
 * - 通常より高いエナジーを持った特別なマゴのみ
 * - 拾ってくる数（＝本ツールでは確率として扱う）は
 *   ミュウ/ミュウツー ＞ エスパータイプ ＞ その他 の順に多い
 * - サブスキル「きのみの数S」は適用されない
 * - 「いつのまに育成」でカビゴンにあげられない（所持数が満タンなら拾えない）
 *
 * 「秘境の奥へと進むにつれて多く見つかる」点は再現せず、一律の確率として扱う。
 */
export interface HugeMagoBerryProvisionalSettings {
	/** 仮パラメータを使ってシミュレートする */
	enabled: boolean;
	/** 通常のマゴのみ1個に対するエナジー倍率 */
	energyMultiplier: number;
	/** ミュウ / ミュウツーがおてつだい1回で拾ってくる確率(%) */
	legendaryPickupRatePercent: number;
	/** エスパータイプのおてつだいポケモンが拾ってくる確率(%) */
	psychicPickupRatePercent: number;
	/** その他のおてつだいポケモンが拾ってくる確率(%) */
	otherPickupRatePercent: number;
}

/**
 * データ未公開ポケモンの仮ステータス。
 *
 * 上流はリリース前のポケモンを `frequency: 0` などのプレースホルダーで追加するため、
 * そのままではおてつだいもスキル発動も発生しない。
 */
export interface PlaceholderPokemonProvisionalSettings {
	/** 仮ステータスを使ってシミュレートする */
	enabled: boolean;
	/** 種族のおてつだいスピード(秒) */
	helpingFrequencySeconds: number;
	/** メインスキル発動率(%) */
	skillRatePercent: number;
	/** 最大所持数（種族値相当） */
	carryLimit: number;
}

/** TeamTimeline の仮設定 */
export interface ProvisionalSettings {
	berryZone: BerryZoneProvisionalSettings;
	hugeMagoBerry: HugeMagoBerryProvisionalSettings;
	placeholderPokemon: PlaceholderPokemonProvisionalSettings;
}

/** きのみゾーンの仮パラメータの初期値（すべて仮の目安値） */
export function createDefaultBerryZoneSettings(): BerryZoneProvisionalSettings {
	return {
		enabled: false,
		initialStackCount: 0,
		maxStackCount: 5,
		berryEnergyBonusPercent: 20,
		snorlaxEnergyByLevel: [400, 569, 785, 1083, 1496, 2066],
	};
}

/** とてもおおきなマゴのみの仮パラメータの初期値（すべて仮の目安値） */
export function createDefaultHugeMagoBerrySettings(): HugeMagoBerryProvisionalSettings {
	return {
		enabled: false,
		energyMultiplier: 3,
		legendaryPickupRatePercent: 30,
		psychicPickupRatePercent: 20,
		otherPickupRatePercent: 10,
	};
}

/** データ未公開ポケモンの仮ステータスの初期値（すべて仮の目安値） */
export function createDefaultPlaceholderPokemonSettings(): PlaceholderPokemonProvisionalSettings {
	return {
		enabled: false,
		helpingFrequencySeconds: 2700,
		skillRatePercent: 2,
		carryLimit: 20,
	};
}

/** 仮設定の初期値 */
export function createDefaultProvisionalSettings(): ProvisionalSettings {
	return {
		berryZone: createDefaultBerryZoneSettings(),
		hugeMagoBerry: createDefaultHugeMagoBerrySettings(),
		placeholderPokemon: createDefaultPlaceholderPokemonSettings(),
	};
}
