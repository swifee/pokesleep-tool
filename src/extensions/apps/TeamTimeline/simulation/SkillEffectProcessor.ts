/**
 * SkillEffectProcessor.ts
 * スキル効果処理モジュール（Charge Energy S, Moonlight, Charge Strength系, E4E系, Ingredient Magnet系）
 */

import {
    MainSkillName,
    getSkillValue,
    getMaxSkillLevel,
    getSkillRandomRange,
    getSkillSubValue,
    getLunarBlessingBerryCount,
    presentCandyRate,
    superLuckIngRate,
    superLuckShardRate,
    superLuckShard5Rate,
    hyperCutterSuccess,
} from '../../../../util/MainSkill';
import { PokemonBoxItem } from '../../../../util/PokemonBox';
import { IngredientNames, IngredientName, PokemonType } from '../../../../data/pokemons';
import { IngredientResult } from '../types/TimeSlotTypes';
import PokemonRp from '../../../../util/PokemonRp';
import SeededRandom from './SeededRandom';
import { MAX_ENERGY } from './EnergyCalculator';
import { getIngredientForHelp } from './HelpCalculator';

/**
 * Moonlightチームメイト回復値（スキルレベル1-6ごと）
 * getSkillSubValueでは提供されないため、ここで定義
 */
const MOONLIGHT_TEAMMATE_VALUES: readonly number[] = [6, 8, 11, 14, 17, 21];

/**
 * Moonlightチームメイト回復発動確率
 */
const MOONLIGHT_TEAMMATE_PROBABILITY = 0.5;
const INGREDIENT_MAGNET_PICK_COUNT = 3;
const STOCKPILE_MAX_COUNT = 10;
const STOCKPILE_RATE = 0.735;
const STOCKPILE_EP_TABLE: readonly (readonly number[])[] = [
    [600, 1020, 1500, 2040, 2640, 3300, 4020, 4920, 6480, 8880, 12120],
    [853, 1450, 2132, 2900, 3753, 4691, 5715, 6995, 9213, 12625, 17231],
    [1177, 2001, 2943, 4002, 5179, 6464, 7886, 9652, 12712, 17420, 23776],
    [1625, 2763, 4063, 5526, 7151, 8939, 10889, 13327, 17552, 24052, 32827],
    [2243, 3813, 5607, 7626, 9869, 12336, 15028, 18393, 24225, 33197, 45309],
    [3099, 5268, 7747, 10536, 13635, 17040, 20763, 25412, 33469, 45865, 62600],
    [4502, 7653, 11255, 15307, 19809, 24761, 30163, 36916, 48621, 66629, 90940],
];
const INGREDIENT_MAGNET_CANDIDATES: readonly IngredientName[] = IngredientNames.filter(
    ingredient => !ingredient.startsWith('unknown')
);
const BAD_DREAMS_DAMAGE_PER_HIT = 12;
const NUZZLE_MAX_CHAIN_TRIGGERS = 20;
const BERRY_JUICE_RATE = 0.2;
const BERRY_BURST_DISGUISE_SUCCESS_RATE = 0.18;
const BERRY_STRENGTH_BY_TYPE: Record<PokemonType, number> = {
    normal: 28,
    fire: 27,
    water: 31,
    electric: 25,
    grass: 30,
    ice: 32,
    fighting: 27,
    poison: 32,
    ground: 29,
    flying: 24,
    psychic: 26,
    bug: 24,
    rock: 30,
    ghost: 26,
    dragon: 35,
    dark: 31,
    steel: 33,
    fairy: 26,
};
const PLUS_TRIGGER_SKILLS = new Set<MainSkillName>([
    'Ingredient Magnet S (Plus)',
    'Cooking Power-Up S (Minus)',
]);
const PROXY_SKILLS = new Set<MainSkillName>([
    'Metronome',
    'Skill Copy',
    'Skill Copy (Transform)',
    'Skill Copy (Mimic)',
]);
const SKILL_COPY_FALLBACK_SKILL: MainSkillName = 'Charge Strength S';
const METRONOME_SKILL_POOL: readonly MainSkillName[] = [
    'Ingredient Magnet S',
    'Ingredient Magnet S (Plus)',
    'Ingredient Magnet S (Present)',
    'Charge Energy S',
    'Charge Energy S (Moonlight)',
    'Charge Strength S',
    'Charge Strength S (Random)',
    'Charge Strength S (Stockpile)',
    'Charge Strength M',
    'Energizing Cheer S',
    'Energizing Cheer S (Nuzzle)',
    'Energy for Everyone S',
    'Energy for Everyone S (Lunar Blessing)',
    'Energy for Everyone S (Berry Juice)',
    'Extra Helpful S',
    'Helper Boost',
    'Cooking Power-Up S',
    'Cooking Power-Up S (Minus)',
    'Tasty Chance S',
    'Dream Shard Magnet S',
    'Dream Shard Magnet S (Random)',
    'Berry Burst',
];

export interface PokemonSkillBonusContext {
    skillTriggerBonus: number;
    skillLevelBonus: number;
    ingredientMagnetMultiplier: number;
    ingredientDrawMultiplier: number;
    skillIngredientMultiplier: number;
    dreamShardMultiplier: number;
    berryBurstMultiplier: number;
    berryStrengthBonus: number;
}

export interface TeamSkillBonusContext {
    fieldBonus: number;
    byPokemonId: ReadonlyMap<number, PokemonSkillBonusContext>;
}

export interface SkillAnalysisContext {
    activeTeamMemberIds?: ReadonlySet<number>;
    targetableTeamMembers?: readonly PokemonBoxItem[];
    disabledPokemonIds?: ReadonlySet<number>;
    suppressEnergyDelta?: boolean;
}

function calculateBerryStrength(type: PokemonType, level: number): number {
    const baseStrength = BERRY_STRENGTH_BY_TYPE[type];
    return Math.max(baseStrength + level - 1, Math.round(Math.pow(1.025, level - 1) * baseStrength));
}

function calculateBerryEpWithBonus(
    type: PokemonType,
    level: number,
    berryCount: number,
    fieldBonus: number,
    berryStrengthBonus: number
): number {
    if (berryCount <= 0) {
        return 0;
    }
    const rawStrength = calculateBerryStrength(type, level);
    const areaApplied = Math.ceil(rawStrength * (1 + fieldBonus / 100));
    const perBerry = Math.ceil(areaApplied * berryStrengthBonus);
    return perBerry * berryCount;
}

function addIngredientCount(
    ingredientMap: Map<IngredientName, number>,
    ingredientName: IngredientName,
    count: number
): void {
    if (count <= 0) return;
    ingredientMap.set(ingredientName, (ingredientMap.get(ingredientName) ?? 0) + count);
}

function addNumberToMap(map: Map<number, number>, key: number, value: number): void {
    if (value <= 0) return;
    map.set(key, (map.get(key) ?? 0) + value);
}

function calculateDistributedBerryEp(
    activeTeam: readonly PokemonBoxItem[],
    selfPokemonId: number,
    selfBerryCount: number,
    otherBerryCount: number,
    triggerCount: number,
    multiplier: number = 1,
    bonusContext?: TeamSkillBonusContext,
): number {
    if (triggerCount <= 0 || multiplier <= 0 || activeTeam.length === 0) {
        return 0;
    }

    let totalEp = 0;
    for (let i = 0; i < triggerCount; i++) {
        for (const member of activeTeam) {
            const berryCount = member.id === selfPokemonId ? selfBerryCount : otherBerryCount;
            if (berryCount <= 0) continue;
            const pokemonBonus = bonusContext?.byPokemonId.get(member.id);
            const berryStrengthBonus = pokemonBonus?.berryStrengthBonus ?? 1;
            const fieldBonus = bonusContext?.fieldBonus ?? 0;
            totalEp += calculateBerryEpWithBonus(
                member.iv.pokemon.type,
                member.iv.level,
                berryCount * multiplier,
                fieldBonus,
                berryStrengthBonus
            );
        }
    }
    return totalEp;
}

export interface TargetRecoveryEvent {
    targetPokemonId: number;
    recovery: number;
    source: 'cheer' | 'nuzzle';
}

export interface NuzzleTriggeredSkillEvent {
    targetPokemonId: number;
    triggeredSkillName: MainSkillName;
}

export interface SupportHelpEvent {
    source: 'extraHelpful' | 'helperBoost';
    targetPokemonId: number;
    helpCount: number;
    berryCount: number;
    berryEP: number;
    ingredients: IngredientResult[];
}

export interface CookingMinusRecoveryEvent {
    targetPokemonId: number;
    recovery: number;
}

export interface ProxySkillEvent {
    source: 'metronome' | 'skillCopy';
    triggeredSkillName: MainSkillName;
    resolvedSkillName: MainSkillName;
    resolvedSkillLevel: number;
    copiedFromPokemonId?: number;
    selfEnergyRecovery?: number;
    teamEnergyRecoveryPerMember?: number;
    teamEnergyRecoveryTargetCount?: number;
    directEP?: number;
    skillIngredients?: IngredientResult[];
    presentCandyCount?: number;
    berryJuiceCount?: number;
    supportSkillBerryEP?: number;
    cookingPotCapacityIncrease?: number;
    tastyChanceIncreasePercent?: number;
    dreamShardCount?: number;
    stockpileStoreCount?: number;
    stockpileCountAtStore?: number;
    stockpileSpitCount?: number;
    stockpileCountAtSpit?: number;
    badDreamsHitCount?: number;
    berryBurstGreatSuccessCount?: number;
    ingredientDrawGreatSuccessCount?: number;
}

/**
 * スキルトリガー処理結果（1ポケモン×1時間帯分）
 */
export interface SkillEffectResult {
    /** 自己げんき回復合計（Charge Energy S, Moonlight自己回復） - トリガーごとに上限適用済み */
    selfEnergyRecovery: number;
    /** 自己回復後のげんき値 */
    energyAfterSelfRecovery: number;
    /** 直接獲得EP合計（Charge Strength S/M/Random） */
    directEP: number;
    /** チームげんき回復（1人あたり）（E4E系） */
    teamEnergyRecoveryPerMember: number;
    /** スキル由来で獲得した食材（Ingredient Magnet S） */
    skillIngredients: IngredientResult[];
    /** Ingredient Magnet S (Present) で得たアメ数 */
    presentCandyCount: number;
    /** Energy for Everyone S (Berry Juice) で得たジュース数 */
    berryJuiceCount: number;
    /** Extra Helpful S / Helper Boost で得たきのみ個数 */
    supportSkillBerryCount: number;
    /** Extra Helpful S / Helper Boost で得たきのみEP */
    supportSkillBerryEP: number;
    /** Extra Helpful S / Helper Boost のイベント（時系列） */
    supportHelpEvents: SupportHelpEvent[];
    /** Cooking Power-Up S系: 鍋容量増加量合計 */
    cookingPotCapacityIncrease: number;
    /** Tasty Chance S: 料理チャンス上昇率合計（%） */
    tastyChanceIncreasePercent: number;
    /** Dream Shard Magnet S系: ゆめのかけら獲得量合計 */
    dreamShardCount: number;
    /** Ingredient Draw S (Hyper Cutter): 大成功回数 */
    ingredientDrawGreatSuccessCount: number;
    /** Cooking Power-Up S (Minus): 対象回復量 */
    cookingMinusTargets: Map<number, number>;
    /** Cooking Power-Up S (Minus): 対象回復イベント（時系列） */
    cookingMinusEvents: CookingMinusRecoveryEvent[];
    /** Berry Burst (Disguise): 大成功回数 */
    berryBurstGreatSuccessCount: number;
    /** Berry Burst (Disguise): 処理後の大成功ロック状態 */
    berryBurstDisguiseLockedAfter: boolean;
    /** Charge Strength S (Stockpile): 時間帯終了時の蓄積数 */
    stockpileCountAfter: number;
    /** Charge Strength S (Stockpile): たくわえる回数 */
    stockpileStoreCount: number;
    /** Charge Strength S (Stockpile): この時間帯で最後にたくわえた直後の蓄積数 */
    stockpileCountAtStore: number;
    /** Charge Strength S (Stockpile): はきだす回数 */
    stockpileSpitCount: number;
    /** Charge Strength S (Stockpile): この時間帯で最後にはきだした直前の蓄積数 */
    stockpileCountAtSpit: number;
    /** Charge Strength M (Bad Dreams): 対象1匹あたりの減少量 */
    badDreamsDamagePerTarget: number;
    /** Charge Strength M (Bad Dreams): ヒット回数（-12の回数） */
    badDreamsHitCount: number;
    /** Charge Strength M (Bad Dreams): 与えた減少量合計 */
    badDreamsTotalDamage: number;
    /** Moonlightチームメイトターゲット: Map<pokemonId, 回復量> */
    moonlightTargets: Map<number, number>;
    /** Energizing Cheer Sターゲット: Map<pokemonId, 回復量> */
    energizingCheerTargets: Map<number, number>;
    /** Nuzzle由来を含む対象回復イベント（時系列） */
    energizingCheerEvents: TargetRecoveryEvent[];
    /** Nuzzleで追加発動したスキルイベント（時系列） */
    nuzzleTriggeredSkillEvents: NuzzleTriggeredSkillEvent[];
    /** Metronome/Skill Copy で追加発動したスキルイベント（時系列） */
    proxySkillEvents: ProxySkillEvent[];
    /** 追加発動で発生した個別対象回復（self系など） */
    additionalRecoveryTargets: Map<number, number>;
}

/**
 * スキルを効果カテゴリに分類
 * @param skillName スキル名
 * @returns カテゴリ:
 *   'selfEnergy' | 'targetEnergy' | 'directEP' | 'teamEnergy' | 'ingredientMagnet' | 'none'
 */
export function classifySkill(
    skillName: string
): 'selfEnergy' | 'targetEnergy' | 'directEP' | 'teamEnergy' | 'ingredientMagnet' | 'ingredientDraw' | 'helpSupport' | 'cookingSupport' | 'dreamShard' | 'proxySkill' | 'none' {
    // 自己げんき回復系
    if (skillName === 'Charge Energy S' || skillName === 'Charge Energy S (Moonlight)') {
        return 'selfEnergy';
    }
    if (skillName === 'Energizing Cheer S' || skillName === 'Energizing Cheer S (Nuzzle)') {
        return 'targetEnergy';
    }

    // 直接EP獲得系
    if (
        skillName === 'Charge Strength S' ||
        skillName === 'Charge Strength M' ||
        skillName === 'Charge Strength M (Bad Dreams)' ||
        skillName === 'Charge Strength S (Random)' ||
        skillName === 'Charge Strength S (Stockpile)' ||
        skillName === 'Berry Burst' ||
        skillName === 'Berry Burst (Disguise)'
    ) {
        return 'directEP';
    }

    // チームげんき回復系
    if (
        skillName === 'Energy for Everyone S' ||
        skillName === 'Energy for Everyone S (Lunar Blessing)' ||
        skillName === 'Energy for Everyone S (Berry Juice)'
    ) {
        return 'teamEnergy';
    }

    if (
        skillName === 'Ingredient Magnet S' ||
        skillName === 'Ingredient Magnet S (Plus)' ||
        skillName === 'Ingredient Magnet S (Present)'
    ) {
        return 'ingredientMagnet';
    }
    if (
        skillName === 'Ingredient Draw S' ||
        skillName === 'Ingredient Draw S (Super Luck)' ||
        skillName === 'Ingredient Draw S (Hyper Cutter)'
    ) {
        return 'ingredientDraw';
    }
    if (skillName === 'Extra Helpful S' || skillName === 'Helper Boost') {
        return 'helpSupport';
    }
    if (
        skillName === 'Cooking Power-Up S' ||
        skillName === 'Cooking Power-Up S (Minus)' ||
        skillName === 'Tasty Chance S'
    ) {
        return 'cookingSupport';
    }
    if (
        skillName === 'Dream Shard Magnet S' ||
        skillName === 'Dream Shard Magnet S (Random)'
    ) {
        return 'dreamShard';
    }
    if (PROXY_SKILLS.has(skillName as MainSkillName)) {
        return 'proxySkill';
    }

    return 'none';
}

/**
 * 直接EP獲得スキルかどうか判定
 * @param skillName スキル名
 * @returns 直接EP獲得スキルならtrue
 */
export function isDirectEPSkill(skillName: string): boolean {
    const category = classifySkill(skillName);
    return category === 'directEP' || category === 'helpSupport';
}

export function isProxySkill(skillName: string): boolean {
    return classifySkill(skillName) === 'proxySkill';
}

export function isNonEPSkill(skillName: string): boolean {
    return skillName === 'Cooking Power-Up S' ||
        skillName === 'Cooking Power-Up S (Minus)' ||
        skillName === 'Tasty Chance S' ||
        skillName === 'Dream Shard Magnet S' ||
        skillName === 'Dream Shard Magnet S (Random)' ||
        skillName === 'Ingredient Draw S' ||
        skillName === 'Ingredient Draw S (Super Luck)' ||
        skillName === 'Ingredient Draw S (Hyper Cutter)';
}

export function resolveSkillLevelForSkill(skill: MainSkillName, requestedLevel: number): number {
    const maxLevel = getMaxSkillLevel(skill);
    return Math.min(Math.max(Math.floor(requestedLevel), 1), maxLevel);
}

function simulateSupportHelps(
    target: PokemonBoxItem,
    helpCount: number,
    random: SeededRandom,
    bonusContext?: TeamSkillBonusContext,
    activeTeamMemberIds?: ReadonlySet<number>,
): { berryCount: number; berryEP: number; ingredients: IngredientResult[] } {
    if (helpCount <= 0) {
        return { berryCount: 0, berryEP: 0, ingredients: [] };
    }
    if (activeTeamMemberIds && !activeTeamMemberIds.has(target.id)) {
        return { berryCount: 0, berryEP: 0, ingredients: [] };
    }

    const ingredientMap = new Map<IngredientName, number>();
    const berryCountPerHelp = new PokemonRp(target.iv).berryCount;
    let totalBerryCount = 0;

    for (let i = 0; i < helpCount; i++) {
        if (random.chance(target.iv.ingredientRate)) {
            const ingredient = getIngredientForHelp(target, random);
            addIngredientCount(ingredientMap, ingredient.name, ingredient.count);
            continue;
        }
        totalBerryCount += berryCountPerHelp;
    }

    const pokemonBonus = bonusContext?.byPokemonId.get(target.id);
    const berryStrengthBonus = pokemonBonus?.berryStrengthBonus ?? 1;
    const fieldBonus = bonusContext?.fieldBonus ?? 0;
    const berryEP = calculateBerryEpWithBonus(
        target.iv.pokemon.type,
        target.iv.level,
        totalBerryCount,
        fieldBonus,
        berryStrengthBonus
    );
    const ingredients = Array.from(ingredientMap.entries()).map(([name, count]) => ({ name, count }));
    return { berryCount: totalBerryCount, berryEP, ingredients };
}

function getIngredientDrawPool(pokemon: PokemonBoxItem): IngredientName[] {
    const pool = [
        pokemon.iv.pokemon.ing1.name,
        pokemon.iv.pokemon.ing2.name,
        pokemon.iv.pokemon.ing3?.name ?? pokemon.iv.pokemon.ing1.name,
    ].filter(name => !name.startsWith('unknown'));

    if (pool.length > 0) {
        return pool;
    }
    return [pokemon.iv.pokemon.ing1.name];
}

/**
 * すべてのスキルトリガーを処理（1ポケモン×1時間帯）
 * 各トリガーは個別に処理される
 *
 * @param pokemon 対象ポケモン
 * @param skillTriggerCount スキル発動回数
 * @param currentEnergy 現在のげんき値
 * @param random 乱数生成器
 * @param teammates チームメイト配列（Moonlightターゲット選択用、自分以外）
 * @returns スキル効果処理結果
 */
export function processSkillTriggers(
    pokemon: PokemonBoxItem,
    skillTriggerCount: number,
    currentEnergy: number,
    random: SeededRandom,
    teammates: PokemonBoxItem[],
    currentStockpileCount: number = 0,
    teamMembers: PokemonBoxItem[] = [],
    nuzzleChainState?: { remaining: number },
    berryBurstDisguiseLocked: boolean = false,
    proxySkillNameOverride?: MainSkillName,
    proxySkillLevelOverride?: number,
    forceStockpileSpit: boolean = false,
    bonusContext?: TeamSkillBonusContext,
    analysisContext?: SkillAnalysisContext,
): SkillEffectResult {
    const skillName = proxySkillNameOverride ?? (pokemon.iv.pokemon.skill as MainSkillName);
    const pokemonBonus = bonusContext?.byPokemonId.get(pokemon.id);
    const skillLevel = resolveSkillLevelForSkill(
        skillName,
        proxySkillLevelOverride ?? (pokemon.iv.skillLevel + (pokemonBonus?.skillLevelBonus ?? 0))
    );
    const category = classifySkill(skillName);
    const activeNuzzleChainState = nuzzleChainState ?? { remaining: NUZZLE_MAX_CHAIN_TRIGGERS };
    const defaultTeamMembers = teamMembers.length > 0 ? teamMembers : [pokemon, ...teammates];
    const targetableTeamMembers = analysisContext?.targetableTeamMembers !== undefined
        ? [...analysisContext.targetableTeamMembers]
        : defaultTeamMembers;
    const activeTeamMemberIds = analysisContext?.activeTeamMemberIds;
    const activeTeamMembers = activeTeamMemberIds
        ? targetableTeamMembers.filter(member => activeTeamMemberIds.has(member.id))
        : targetableTeamMembers;
    const targetableTeammates = targetableTeamMembers.filter(member => member.id !== pokemon.id);
    const activeTeammates = activeTeamMembers.filter(member => member.id !== pokemon.id);
    const suppressEnergyDelta = analysisContext?.suppressEnergyDelta === true;

    let totalSelfRecovery = 0;
    let totalDirectEP = 0;
    let totalTeamRecovery = 0;
    let totalPresentCandy = 0;
    let totalBerryJuice = 0;
    let totalSupportBerryCount = 0;
    let totalSupportBerryEP = 0;
    let totalCookingPotCapacityIncrease = 0;
    let totalTastyChanceIncreasePercent = 0;
    let totalDreamShardCount = 0;
    let totalIngredientDrawGreatSuccessCount = 0;
    let totalBerryBurstGreatSuccessCount = 0;
    let berryBurstDisguiseLockedState = berryBurstDisguiseLocked;
    let stockpileCount = Math.min(Math.max(currentStockpileCount, 0), STOCKPILE_MAX_COUNT);
    let stockpileStoreCount = 0;
    let stockpileCountAtStore = 0;
    let stockpileSpitCount = 0;
    let stockpileCountAtSpit = 0;
    let badDreamsDamagePerTarget = 0;
    let badDreamsHitCount = 0;
    let badDreamsTotalDamage = 0;
    const skillIngredientMap = new Map<IngredientName, number>();
    let energy = currentEnergy;
    const moonlightTargets = new Map<number, number>();
    const energizingCheerTargets = new Map<number, number>();
    const energizingCheerEvents: TargetRecoveryEvent[] = [];
    const nuzzleTriggeredSkillEvents: NuzzleTriggeredSkillEvent[] = [];
    const proxySkillEvents: ProxySkillEvent[] = [];
    const additionalRecoveryTargets = new Map<number, number>();
    const supportHelpEvents: SupportHelpEvent[] = [];
    const cookingMinusTargets = new Map<number, number>();
    const cookingMinusEvents: CookingMinusRecoveryEvent[] = [];

    // スキル発動がない場合は即座に返す
    if (skillTriggerCount === 0) {
        return {
            selfEnergyRecovery: 0,
            energyAfterSelfRecovery: energy,
            directEP: 0,
            teamEnergyRecoveryPerMember: 0,
            skillIngredients: [],
            presentCandyCount: 0,
            berryJuiceCount: 0,
            supportSkillBerryCount: 0,
            supportSkillBerryEP: 0,
            supportHelpEvents: [],
            cookingPotCapacityIncrease: 0,
            tastyChanceIncreasePercent: 0,
            dreamShardCount: 0,
            ingredientDrawGreatSuccessCount: 0,
            cookingMinusTargets,
            cookingMinusEvents,
            berryBurstGreatSuccessCount: 0,
            berryBurstDisguiseLockedAfter: berryBurstDisguiseLockedState,
            stockpileCountAfter: stockpileCount,
            stockpileStoreCount: 0,
            stockpileCountAtStore: 0,
            stockpileSpitCount: 0,
            stockpileCountAtSpit: 0,
            badDreamsDamagePerTarget: 0,
            badDreamsHitCount: 0,
            badDreamsTotalDamage: 0,
            moonlightTargets,
            energizingCheerTargets,
            energizingCheerEvents,
            nuzzleTriggeredSkillEvents,
            proxySkillEvents,
            additionalRecoveryTargets,
        };
    }

    // カテゴリ別処理
    if (category === 'selfEnergy') {
        // Charge Energy S / Moonlight: トリガーごとに上限適用
        const recoveryPerTrigger = getSkillValue(skillName, skillLevel);

        for (let i = 0; i < skillTriggerCount; i++) {
            if (!suppressEnergyDelta) {
                const beforeRecovery = energy;
                energy = Math.min(MAX_ENERGY, energy + recoveryPerTrigger);
                const actualRecovery = energy - beforeRecovery;
                totalSelfRecovery += actualRecovery;
            }

            // Moonlightの場合、50%の確率でチームメイトを回復
            if (skillName === 'Charge Energy S (Moonlight)' && targetableTeammates.length > 0) {
                if (random.chance(MOONLIGHT_TEAMMATE_PROBABILITY)) {
                    // ランダムにチームメイトを選択
                    const targetIndex = random.nextInt(0, targetableTeammates.length - 1);
                    const targetPokemon = targetableTeammates[targetIndex];
                    const clampedLevel = Math.min(Math.max(skillLevel, 1), MOONLIGHT_TEAMMATE_VALUES.length);
                    const teammateRecovery = MOONLIGHT_TEAMMATE_VALUES[clampedLevel - 1] ?? 0;
                    if (!suppressEnergyDelta && targetPokemon) {
                        addNumberToMap(moonlightTargets, targetPokemon.id, teammateRecovery);
                    }
                }
            }
        }
    } else if (category === 'directEP') {
        // Charge Strength系: 直接EP獲得
        if (skillName === 'Charge Strength S (Stockpile)') {
            const levelIndex = Math.min(Math.max(skillLevel, 1), STOCKPILE_EP_TABLE.length) - 1;
            const epRow = STOCKPILE_EP_TABLE[levelIndex] ?? STOCKPILE_EP_TABLE[0];

            for (let i = 0; i < skillTriggerCount; i++) {
                if (forceStockpileSpit) {
                    const ep = epRow[stockpileCount] ?? epRow[0] ?? 0;
                    stockpileCountAtSpit = stockpileCount;
                    totalDirectEP += ep;
                    stockpileCount = 0;
                    stockpileSpitCount++;
                    continue;
                }
                if (random.chance(STOCKPILE_RATE)) {
                    stockpileCount = Math.min(STOCKPILE_MAX_COUNT, stockpileCount + 1);
                    stockpileStoreCount++;
                    stockpileCountAtStore = stockpileCount;
                    continue;
                }

                const ep = epRow[stockpileCount] ?? epRow[0] ?? 0;
                stockpileCountAtSpit = stockpileCount;
                totalDirectEP += ep;
                stockpileCount = 0;
                stockpileSpitCount++;
            }
        } else if (skillName === 'Charge Strength M (Bad Dreams)') {
            const epPerTrigger = getSkillValue(skillName, skillLevel);
            totalDirectEP = epPerTrigger * skillTriggerCount;

            const nonDarkCount = targetableTeamMembers.filter(member => member.iv.pokemon.type !== 'dark').length;
            if (suppressEnergyDelta) {
                badDreamsDamagePerTarget = 0;
                badDreamsHitCount = 0;
                badDreamsTotalDamage = 0;
            } else {
                badDreamsDamagePerTarget = BAD_DREAMS_DAMAGE_PER_HIT * skillTriggerCount;
                badDreamsHitCount = nonDarkCount * skillTriggerCount;
                badDreamsTotalDamage = badDreamsHitCount * BAD_DREAMS_DAMAGE_PER_HIT;
            }
        } else if (skillName === 'Charge Strength S (Random)') {
            // ランダム範囲EP
            const [minEP, maxEP] = getSkillRandomRange(skillName, skillLevel);
            for (let i = 0; i < skillTriggerCount; i++) {
                const ep = Math.round(minEP + random.next() * (maxEP - minEP));
                totalDirectEP += ep;
            }
        } else if (skillName === 'Berry Burst' || skillName === 'Berry Burst (Disguise)') {
            const activeTeam = activeTeamMembers;
            const berryBurstMultiplier = pokemonBonus?.berryBurstMultiplier ?? 1;
            const selfBerryCount = Math.ceil(getSkillValue(skillName, skillLevel) * berryBurstMultiplier);
            const otherBerryCount = Math.ceil(getSkillSubValue(skillName, skillLevel) * berryBurstMultiplier);

            for (let i = 0; i < skillTriggerCount; i++) {
                let multiplier = 1;
                if (
                    skillName === 'Berry Burst (Disguise)' &&
                    !berryBurstDisguiseLockedState &&
                    random.chance(BERRY_BURST_DISGUISE_SUCCESS_RATE)
                ) {
                    multiplier = 3;
                    berryBurstDisguiseLockedState = true;
                    totalBerryBurstGreatSuccessCount += 1;
                }

                totalDirectEP += calculateDistributedBerryEp(
                    activeTeam,
                    pokemon.id,
                    selfBerryCount,
                    otherBerryCount,
                    1,
                    multiplier,
                    bonusContext
                );
            }
        } else {
            // 固定EP（Charge Strength S / M）
            const epPerTrigger = getSkillValue(skillName, skillLevel);
            totalDirectEP = epPerTrigger * skillTriggerCount;
        }
    } else if (category === 'teamEnergy') {
        // Energy for Everyone S系: チーム全員回復（発動者含む）
        const recoveryPerTrigger = getSkillValue(skillName, skillLevel);
        totalTeamRecovery = suppressEnergyDelta ? 0 : recoveryPerTrigger * skillTriggerCount;

        if (skillName === 'Energy for Everyone S (Lunar Blessing)' && activeTeamMembers.length > 0) {
            const psychicSpeciesCount = new Set(
                activeTeamMembers
                    .filter(member => member.iv.pokemon.type === 'psychic')
                    .map(member => member.iv.pokemonName)
            ).size;

            if (psychicSpeciesCount > 0) {
                const clampedSpeciesCount = Math.min(Math.max(psychicSpeciesCount, 1), 5);
                const { myBerryCount, othersBerryCount } = getLunarBlessingBerryCount(
                    skillLevel,
                    clampedSpeciesCount
                );
                totalDirectEP += calculateDistributedBerryEp(
                    activeTeamMembers,
                    pokemon.id,
                    myBerryCount,
                    othersBerryCount,
                    skillTriggerCount,
                    1,
                    bonusContext
                );
            }
        }

        if (skillName === 'Energy for Everyone S (Berry Juice)') {
            for (let i = 0; i < skillTriggerCount; i++) {
                if (random.chance(BERRY_JUICE_RATE)) {
                    totalBerryJuice += 1;
                }
            }
        }
    } else if (category === 'targetEnergy') {
        // Energizing Cheer S / Nuzzle: チーム内のランダム1体を回復
        const recoveryPerTrigger = getSkillValue(skillName, skillLevel);
        const activeTeam = targetableTeamMembers;
        if (activeTeam.length > 0) {
            for (let i = 0; i < skillTriggerCount; i++) {
                const targetIndex = random.nextInt(0, activeTeam.length - 1);
                const target = activeTeam[targetIndex];
                if (!target) continue;
                if (!suppressEnergyDelta) {
                    addNumberToMap(energizingCheerTargets, target.id, recoveryPerTrigger);
                }
                energizingCheerEvents.push({
                    targetPokemonId: target.id,
                    recovery: suppressEnergyDelta ? 0 : recoveryPerTrigger,
                    source: skillName === 'Energizing Cheer S (Nuzzle)' ? 'nuzzle' : 'cheer',
                });

                if (
                    skillName === 'Energizing Cheer S (Nuzzle)' &&
                    activeNuzzleChainState.remaining > 0 &&
                    (!activeTeamMemberIds || activeTeamMemberIds.has(target.id))
                ) {
                    const targetSkillTriggerBonus = bonusContext?.byPokemonId.get(target.id)?.skillTriggerBonus ?? 1;
                    const targetSkillRate = Math.min(1, target.iv.skillRate * targetSkillTriggerBonus);
                    const triggerProbability = 1 - Math.pow(1 - targetSkillRate, skillLevel);
                    if (random.chance(triggerProbability)) {
                        activeNuzzleChainState.remaining -= 1;
                        const triggeredSkillName = target.iv.pokemon.skill as MainSkillName;
                        nuzzleTriggeredSkillEvents.push({
                            targetPokemonId: target.id,
                            triggeredSkillName,
                        });

                        const nestedResult = processSkillTriggers(
                            target,
                            1,
                            currentEnergy,
                            random,
                            targetableTeamMembers.filter(member => member.id !== target.id),
                            0,
                            targetableTeamMembers,
                            activeNuzzleChainState,
                            berryBurstDisguiseLockedState,
                            undefined,
                            undefined,
                            false,
                            bonusContext,
                            analysisContext
                        );

                        totalDirectEP += nestedResult.directEP;
                        totalTeamRecovery += nestedResult.teamEnergyRecoveryPerMember;
                        totalPresentCandy += nestedResult.presentCandyCount;
                        totalBerryJuice += nestedResult.berryJuiceCount;
                        totalSupportBerryCount += nestedResult.supportSkillBerryCount;
                        totalSupportBerryEP += nestedResult.supportSkillBerryEP;
                        totalCookingPotCapacityIncrease += nestedResult.cookingPotCapacityIncrease;
                        totalTastyChanceIncreasePercent += nestedResult.tastyChanceIncreasePercent;
                        totalDreamShardCount += nestedResult.dreamShardCount;
                        totalIngredientDrawGreatSuccessCount += nestedResult.ingredientDrawGreatSuccessCount;
                        totalBerryBurstGreatSuccessCount += nestedResult.berryBurstGreatSuccessCount;
                        berryBurstDisguiseLockedState = nestedResult.berryBurstDisguiseLockedAfter;
                        stockpileStoreCount += nestedResult.stockpileStoreCount;
                        if (nestedResult.stockpileStoreCount > 0) {
                            stockpileCountAtStore = nestedResult.stockpileCountAtStore;
                        }
                        stockpileSpitCount += nestedResult.stockpileSpitCount;
                        if (nestedResult.stockpileSpitCount > 0) {
                            stockpileCountAtSpit = nestedResult.stockpileCountAtSpit;
                        }
                        badDreamsDamagePerTarget += nestedResult.badDreamsDamagePerTarget;
                        badDreamsHitCount += nestedResult.badDreamsHitCount;
                        badDreamsTotalDamage += nestedResult.badDreamsTotalDamage;

                        for (const ing of nestedResult.skillIngredients) {
                            addIngredientCount(skillIngredientMap, ing.name, ing.count);
                        }
                        for (const [targetId, recovery] of nestedResult.moonlightTargets.entries()) {
                            addNumberToMap(moonlightTargets, targetId, recovery);
                        }
                        for (const [targetId, recovery] of nestedResult.energizingCheerTargets.entries()) {
                            addNumberToMap(energizingCheerTargets, targetId, recovery);
                        }
                        for (const [targetId, recovery] of nestedResult.additionalRecoveryTargets.entries()) {
                            addNumberToMap(additionalRecoveryTargets, targetId, recovery);
                        }
                        for (const [targetId, recovery] of nestedResult.cookingMinusTargets.entries()) {
                            addNumberToMap(cookingMinusTargets, targetId, recovery);
                        }
                        supportHelpEvents.push(...nestedResult.supportHelpEvents);
                        cookingMinusEvents.push(...nestedResult.cookingMinusEvents);
                        energizingCheerEvents.push(...nestedResult.energizingCheerEvents);
                        nuzzleTriggeredSkillEvents.push(...nestedResult.nuzzleTriggeredSkillEvents);
                        proxySkillEvents.push(...nestedResult.proxySkillEvents);

                        // 追加発動の自己回復は、実効果適用先（対象自身）に積む
                        addNumberToMap(additionalRecoveryTargets, target.id, nestedResult.selfEnergyRecovery);
                    }
                }
            }
        }
    } else if (category === 'helpSupport') {
        const targetableTeam = targetableTeamMembers;
        if (targetableTeam.length > 0) {
            for (let i = 0; i < skillTriggerCount; i++) {
                if (skillName === 'Extra Helpful S') {
                    const targetIndex = random.nextInt(0, targetableTeam.length - 1);
                    const target = targetableTeam[targetIndex];
                    if (!target) continue;

                    const helpCount = getSkillValue('Extra Helpful S', skillLevel);
                    const supportResult = simulateSupportHelps(
                        target,
                        helpCount,
                        random,
                        bonusContext,
                        activeTeamMemberIds
                    );
                    totalSupportBerryCount += supportResult.berryCount;
                    totalSupportBerryEP += supportResult.berryEP;
                    totalDirectEP += supportResult.berryEP;
                    for (const ingredient of supportResult.ingredients) {
                        addIngredientCount(skillIngredientMap, ingredient.name, ingredient.count);
                    }
                    supportHelpEvents.push({
                        source: 'extraHelpful',
                        targetPokemonId: target.id,
                        helpCount,
                        berryCount: supportResult.berryCount,
                        berryEP: supportResult.berryEP,
                        ingredients: supportResult.ingredients,
                    });
                    continue;
                }

                const sameTypeSpeciesCount = new Set(
                    activeTeamMembers
                        .filter(member => member.iv.pokemon.type === pokemon.iv.pokemon.type)
                        .map(member => member.iv.pokemonName)
                ).size;
                const clampedSpeciesCount = Math.min(Math.max(sameTypeSpeciesCount, 1), 5);
                const helpCount = getSkillValue('Helper Boost', skillLevel, clampedSpeciesCount);

                for (const target of targetableTeam) {
                    const supportResult = simulateSupportHelps(
                        target,
                        helpCount,
                        random,
                        bonusContext,
                        activeTeamMemberIds
                    );
                    totalSupportBerryCount += supportResult.berryCount;
                    totalSupportBerryEP += supportResult.berryEP;
                    totalDirectEP += supportResult.berryEP;
                    for (const ingredient of supportResult.ingredients) {
                        addIngredientCount(skillIngredientMap, ingredient.name, ingredient.count);
                    }
                    supportHelpEvents.push({
                        source: 'helperBoost',
                        targetPokemonId: target.id,
                        helpCount,
                        berryCount: supportResult.berryCount,
                        berryEP: supportResult.berryEP,
                        ingredients: supportResult.ingredients,
                    });
                }
            }
        }
    } else if (category === 'ingredientMagnet') {
        const ingredientMagnetMultiplier = Math.max(
            pokemonBonus?.ingredientMagnetMultiplier ?? 1,
            pokemonBonus?.skillIngredientMultiplier ?? 1
        );
        const totalCountPerTrigger = Math.floor(getSkillValue(skillName, skillLevel) * ingredientMagnetMultiplier);
        const baseCount = Math.floor(totalCountPerTrigger / INGREDIENT_MAGNET_PICK_COUNT);
        const remainderCount = totalCountPerTrigger % INGREDIENT_MAGNET_PICK_COUNT;
        const shouldApplyPlusBonus =
            skillName === 'Ingredient Magnet S (Plus)' &&
            activeTeammates.some(teammate => PLUS_TRIGGER_SKILLS.has(teammate.iv.pokemon.skill as MainSkillName));

        let plusBonusCount = 0;
        if (shouldApplyPlusBonus) {
            try {
                plusBonusCount = getSkillSubValue(
                    'Ingredient Magnet S (Plus)',
                    skillLevel,
                    pokemon.iv.pokemon.ing1.name
                );
            } catch {
                plusBonusCount = 0;
            }
        }

        const presentCandyPerProc = skillName === 'Ingredient Magnet S (Present)'
            ? getSkillSubValue('Ingredient Magnet S (Present)', skillLevel)
            : 0;

        for (let i = 0; i < skillTriggerCount; i++) {
            const selectedIngredients = random
                .shuffle(INGREDIENT_MAGNET_CANDIDATES)
                .slice(0, INGREDIENT_MAGNET_PICK_COUNT);

            for (const ingredient of selectedIngredients) {
                addIngredientCount(skillIngredientMap, ingredient, baseCount);
            }

            if (remainderCount > 0) {
                const remainderTargets = random
                    .shuffle([0, 1, 2])
                    .slice(0, remainderCount);
                for (const targetIndex of remainderTargets) {
                    const ingredient = selectedIngredients[targetIndex];
                    if (ingredient) {
                        addIngredientCount(skillIngredientMap, ingredient, 1);
                    }
                }
            }

            if (plusBonusCount > 0) {
                addIngredientCount(skillIngredientMap, pokemon.iv.pokemon.ing1.name, plusBonusCount);
            }

            if (presentCandyPerProc > 0 && random.chance(presentCandyRate)) {
                totalPresentCandy += presentCandyPerProc;
            }
        }
    } else if (category === 'ingredientDraw') {
        const ingredientDrawMultiplier = Math.max(
            pokemonBonus?.ingredientDrawMultiplier ?? 1,
            pokemonBonus?.skillIngredientMultiplier ?? 1
        );
        const ingredientPerTrigger = Math.floor(getSkillValue(skillName, skillLevel) * ingredientDrawMultiplier);
        const ingredientDrawPool = getIngredientDrawPool(pokemon);
        const dreamShardPerOne = skillName === 'Ingredient Draw S (Super Luck)'
            ? getSkillSubValue('Ingredient Draw S (Super Luck)', skillLevel)
            : 0;

        for (let i = 0; i < skillTriggerCount; i++) {
            let shouldGrantIngredient = true;
            let ingredientMultiplier = 1;

            if (skillName === 'Ingredient Draw S (Super Luck)') {
                const roll = random.next();
                if (roll < superLuckIngRate) {
                    shouldGrantIngredient = true;
                } else if (roll < superLuckIngRate + superLuckShardRate) {
                    totalDreamShardCount += dreamShardPerOne;
                    shouldGrantIngredient = false;
                } else if (roll < superLuckIngRate + superLuckShardRate + superLuckShard5Rate) {
                    totalDreamShardCount += dreamShardPerOne * 5;
                    shouldGrantIngredient = false;
                } else {
                    shouldGrantIngredient = false;
                }
            } else if (skillName === 'Ingredient Draw S (Hyper Cutter)' && random.chance(hyperCutterSuccess)) {
                ingredientMultiplier = 2;
                totalIngredientDrawGreatSuccessCount += 1;
            }

            if (!shouldGrantIngredient) {
                continue;
            }

            const ingredientIndex = random.nextInt(0, ingredientDrawPool.length - 1);
            const selectedIngredient = ingredientDrawPool[ingredientIndex] ?? ingredientDrawPool[0];
            if (!selectedIngredient) {
                continue;
            }
            addIngredientCount(skillIngredientMap, selectedIngredient, ingredientPerTrigger * ingredientMultiplier);
        }
    } else if (category === 'cookingSupport') {
        if (skillName === 'Tasty Chance S') {
            const increasePerTrigger = getSkillValue('Tasty Chance S', skillLevel);
            totalTastyChanceIncreasePercent = increasePerTrigger * skillTriggerCount;
        } else {
            const potIncreasePerTrigger = getSkillValue(skillName, skillLevel);
            totalCookingPotCapacityIncrease = potIncreasePerTrigger * skillTriggerCount;

            if (skillName === 'Cooking Power-Up S (Minus)') {
                const targetableTeam = targetableTeamMembers;
                const hasOtherPlusMinus = activeTeamMembers.some(
                    member =>
                        member.id !== pokemon.id &&
                        PLUS_TRIGGER_SKILLS.has(member.iv.pokemon.skill as MainSkillName)
                );
                const recoveryPerTrigger = getSkillSubValue('Cooking Power-Up S (Minus)', skillLevel);

                if (hasOtherPlusMinus && recoveryPerTrigger > 0 && targetableTeam.length > 0) {
                    for (let i = 0; i < skillTriggerCount; i++) {
                        const targetIndex = random.nextInt(0, targetableTeam.length - 1);
                        const target = targetableTeam[targetIndex];
                        if (!target) continue;
                        if (!suppressEnergyDelta) {
                            addNumberToMap(cookingMinusTargets, target.id, recoveryPerTrigger);
                        }
                        cookingMinusEvents.push({
                            targetPokemonId: target.id,
                            recovery: suppressEnergyDelta ? 0 : recoveryPerTrigger,
                        });
                    }
                }
            }
        }
    } else if (category === 'dreamShard') {
        const dreamShardMultiplier = pokemonBonus?.dreamShardMultiplier ?? 1;
        if (skillName === 'Dream Shard Magnet S (Random)') {
            const [minShard, maxShard] = getSkillRandomRange('Dream Shard Magnet S (Random)', skillLevel);
            for (let i = 0; i < skillTriggerCount; i++) {
                const baseShard = Math.round(minShard + random.next() * (maxShard - minShard));
                const shard = Math.round(baseShard * dreamShardMultiplier);
                totalDreamShardCount += shard;
            }
        } else {
            const shardPerTrigger = getSkillValue('Dream Shard Magnet S', skillLevel) * dreamShardMultiplier;
            totalDreamShardCount = shardPerTrigger * skillTriggerCount;
        }
    } else if (category === 'proxySkill') {
        const activeTeam = activeTeamMembers;
        const copyCandidates = activeTeam.filter(member => member.id !== pokemon.id);

        for (let i = 0; i < skillTriggerCount; i++) {
            let triggeredSkillName: MainSkillName | null = null;
            let copiedFromPokemonId: number | undefined;
            const source: 'metronome' | 'skillCopy' =
                skillName === 'Metronome' ? 'metronome' : 'skillCopy';

            if (skillName === 'Metronome') {
                const metronomeIndex = random.nextInt(0, METRONOME_SKILL_POOL.length - 1);
                triggeredSkillName = METRONOME_SKILL_POOL[metronomeIndex] ?? null;
            } else {
                if (copyCandidates.length === 0) {
                    continue;
                }
                const copiedTarget = copyCandidates[random.nextInt(0, copyCandidates.length - 1)];
                if (!copiedTarget) {
                    continue;
                }
                copiedFromPokemonId = copiedTarget.id;
                triggeredSkillName = copiedTarget.iv.pokemon.skill as MainSkillName;
            }

            if (!triggeredSkillName) {
                continue;
            }

            let resolvedSkillName = triggeredSkillName;
            if (PROXY_SKILLS.has(resolvedSkillName)) {
                resolvedSkillName = SKILL_COPY_FALLBACK_SKILL;
            }
            const resolvedSkillLevel = resolveSkillLevelForSkill(
                resolvedSkillName,
                pokemon.iv.skillLevel + (pokemonBonus?.skillLevelBonus ?? 0)
            );

            const nestedResult = processSkillTriggers(
                pokemon,
                1,
                energy,
                random,
                targetableTeammates,
                stockpileCount,
                activeTeam,
                activeNuzzleChainState,
                berryBurstDisguiseLockedState,
                resolvedSkillName,
                resolvedSkillLevel,
                source === 'metronome' && resolvedSkillName === 'Charge Strength S (Stockpile)',
                bonusContext,
                analysisContext
            );

            proxySkillEvents.push({
                source,
                triggeredSkillName,
                resolvedSkillName,
                resolvedSkillLevel,
                copiedFromPokemonId,
                selfEnergyRecovery: nestedResult.selfEnergyRecovery,
                teamEnergyRecoveryPerMember: nestedResult.teamEnergyRecoveryPerMember,
                teamEnergyRecoveryTargetCount: activeTeam.length,
                directEP: nestedResult.directEP,
                skillIngredients: nestedResult.skillIngredients,
                presentCandyCount: nestedResult.presentCandyCount,
                berryJuiceCount: nestedResult.berryJuiceCount,
                supportSkillBerryEP: nestedResult.supportSkillBerryEP,
                cookingPotCapacityIncrease: nestedResult.cookingPotCapacityIncrease,
                tastyChanceIncreasePercent: nestedResult.tastyChanceIncreasePercent,
                dreamShardCount: nestedResult.dreamShardCount,
                stockpileStoreCount: nestedResult.stockpileStoreCount,
                stockpileCountAtStore: nestedResult.stockpileCountAtStore,
                stockpileSpitCount: nestedResult.stockpileSpitCount,
                stockpileCountAtSpit: nestedResult.stockpileCountAtSpit,
                badDreamsHitCount: nestedResult.badDreamsHitCount,
                berryBurstGreatSuccessCount: nestedResult.berryBurstGreatSuccessCount,
                ingredientDrawGreatSuccessCount: nestedResult.ingredientDrawGreatSuccessCount,
            });
            proxySkillEvents.push(...nestedResult.proxySkillEvents);

            totalSelfRecovery += nestedResult.selfEnergyRecovery;
            totalDirectEP += nestedResult.directEP;
            totalTeamRecovery += nestedResult.teamEnergyRecoveryPerMember;
            totalPresentCandy += nestedResult.presentCandyCount;
            totalBerryJuice += nestedResult.berryJuiceCount;
            totalSupportBerryCount += nestedResult.supportSkillBerryCount;
            totalSupportBerryEP += nestedResult.supportSkillBerryEP;
            totalCookingPotCapacityIncrease += nestedResult.cookingPotCapacityIncrease;
            totalTastyChanceIncreasePercent += nestedResult.tastyChanceIncreasePercent;
            totalDreamShardCount += nestedResult.dreamShardCount;
            totalIngredientDrawGreatSuccessCount += nestedResult.ingredientDrawGreatSuccessCount;
            totalBerryBurstGreatSuccessCount += nestedResult.berryBurstGreatSuccessCount;
            berryBurstDisguiseLockedState = nestedResult.berryBurstDisguiseLockedAfter;
            stockpileCount = nestedResult.stockpileCountAfter;
            stockpileStoreCount += nestedResult.stockpileStoreCount;
            if (nestedResult.stockpileStoreCount > 0) {
                stockpileCountAtStore = nestedResult.stockpileCountAtStore;
            }
            stockpileSpitCount += nestedResult.stockpileSpitCount;
            if (nestedResult.stockpileSpitCount > 0) {
                stockpileCountAtSpit = nestedResult.stockpileCountAtSpit;
            }
            badDreamsDamagePerTarget += nestedResult.badDreamsDamagePerTarget;
            badDreamsHitCount += nestedResult.badDreamsHitCount;
            badDreamsTotalDamage += nestedResult.badDreamsTotalDamage;
            energy = nestedResult.energyAfterSelfRecovery;

            for (const ing of nestedResult.skillIngredients) {
                addIngredientCount(skillIngredientMap, ing.name, ing.count);
            }
            for (const [targetId, recovery] of nestedResult.moonlightTargets.entries()) {
                addNumberToMap(moonlightTargets, targetId, recovery);
            }
            for (const [targetId, recovery] of nestedResult.energizingCheerTargets.entries()) {
                addNumberToMap(energizingCheerTargets, targetId, recovery);
            }
            for (const [targetId, recovery] of nestedResult.additionalRecoveryTargets.entries()) {
                addNumberToMap(additionalRecoveryTargets, targetId, recovery);
            }
            for (const [targetId, recovery] of nestedResult.cookingMinusTargets.entries()) {
                addNumberToMap(cookingMinusTargets, targetId, recovery);
            }
            supportHelpEvents.push(...nestedResult.supportHelpEvents);
            cookingMinusEvents.push(...nestedResult.cookingMinusEvents);
            energizingCheerEvents.push(...nestedResult.energizingCheerEvents);
            nuzzleTriggeredSkillEvents.push(...nestedResult.nuzzleTriggeredSkillEvents);
        }
    }

    const skillIngredients: IngredientResult[] = Array.from(skillIngredientMap.entries()).map(([name, count]) => ({
        name,
        count,
    }));

    return {
        selfEnergyRecovery: totalSelfRecovery,
        energyAfterSelfRecovery: energy,
        directEP: totalDirectEP,
        teamEnergyRecoveryPerMember: totalTeamRecovery,
        skillIngredients,
        presentCandyCount: totalPresentCandy,
        berryJuiceCount: totalBerryJuice,
        supportSkillBerryCount: totalSupportBerryCount,
        supportSkillBerryEP: totalSupportBerryEP,
        supportHelpEvents,
        cookingPotCapacityIncrease: totalCookingPotCapacityIncrease,
        tastyChanceIncreasePercent: totalTastyChanceIncreasePercent,
        dreamShardCount: totalDreamShardCount,
        ingredientDrawGreatSuccessCount: totalIngredientDrawGreatSuccessCount,
        cookingMinusTargets,
        cookingMinusEvents,
        berryBurstGreatSuccessCount: totalBerryBurstGreatSuccessCount,
        berryBurstDisguiseLockedAfter: berryBurstDisguiseLockedState,
        stockpileCountAfter: stockpileCount,
        stockpileStoreCount,
        stockpileCountAtStore,
        stockpileSpitCount,
        stockpileCountAtSpit,
        badDreamsDamagePerTarget,
        badDreamsHitCount,
        badDreamsTotalDamage,
        moonlightTargets,
        energizingCheerTargets,
        energizingCheerEvents,
        nuzzleTriggeredSkillEvents,
        proxySkillEvents,
        additionalRecoveryTargets,
    };
}
