/**
 * TimelineSimulator.ts
 * シミュレーションを統合実行するモジュール
 */

import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import i18next from 'i18next';
import { PokemonSpecialty } from '../../../../data/pokemons';
import { isExpertField } from '../../../../data/fields';
import PokemonStrength, { StrengthParameter } from '../../../../util/PokemonStrength';
import {
    TimeSlot,
    SimulationConfig,
    TimeSlotResult,
    SimulationResult,
    MEAL_LABELS,
    PokemonSwap,
    DailySummary,
    getDisplayLabel,
    SWAP_NONE_POKEMON_ID,
} from '../types/TimeSlotTypes';
import { calculateDuration, isSleepingSlot } from '../utils/TimeSlotUtils';
import { buildExpandedTimeline } from '../utils/TimelineDayExpansion';
import SeededRandom from './SeededRandom';
import {
    calculateWakeRecovery,
    WakeRecoveryInput,
    ERB_MAX_ENERGY,
    DEFAULT_MAX_ENERGY as ENERGY_MAX_NORMAL,
    MAX_ENERGY,
} from './EnergyCalculator';
import { calculateHelp, HelpBonusContext, HelpInput } from './HelpCalculator';
import { calculateDailySummary, calculateTeamSummary, DailySummaryBonusContext } from './EnergyPointCalculator';
import {
    processSkillTriggers,
    SkillEffectResult,
    PokemonSkillBonusContext,
    TeamSkillBonusContext,
} from './SkillEffectProcessor';
import { TimelineBonusSettings } from '../types/TimelineBonusSettingsTypes';
import { buildStrengthParameterFromTimelineBonusSettings } from '../utils/TimelineBonusSettingsBridge';

/** シミュレーション入力 */
export interface SimulationInput {
    /** チーム（5スロット、nullは空きスロット） */
    team: (PokemonBoxItem | null)[];
    /** 時間帯設定 */
    timeSlots: TimeSlot[];
    /** シミュレーション設定 */
    config: SimulationConfig;
    /** ボーナス設定（フィールド/イベント/キャンチケ/レシピ） */
    bonusSettings: TimelineBonusSettings;
    /** ポケモン入れ替え設定（オプショナル） */
    swaps?: PokemonSwap[];
    /** ボックス（入れ替え時のポケモン取得用、オプショナル） */
    box?: PokemonBox;
}

/** ポケモンの状態（シミュレーション中の内部管理用） */
interface PokemonState {
    pokemon: PokemonBoxItem;
    slotIndex: number;
    currentEnergy: number;
    random: SeededRandom;
    /** 睡眠開始時刻（起床回復計算用） */
    sleepStartTime: string | null;
    /** 累積睡眠スコア（1日上限100） */
    usedSleepScore: number;

    // 新規追加
    /** 現在のスキルストック数 */
    skillStock: number;
    /** 現在の所持数（きのみ+食材の合計） */
    inventoryCount: number;
    /** おてつだい周期の余り秒数（次スロットへ持ち越し） */
    bankedTimeSeconds: number;
    /** スキルストック上限（specialtyから計算） */
    maxSkillStock: number;
    /** 最大所持数（carryLimitから計算） */
    maxInventory: number;
    /** Charge Strength S (Stockpile) の蓄積数 */
    stockpileCount: number;
    /** Berry Burst (Disguise) の大成功ロック */
    berryBurstDisguiseLocked: boolean;
}

interface PokemonBonusContext {
    help: HelpBonusContext;
    skill: PokemonSkillBonusContext;
    dailySummary: DailySummaryBonusContext;
}

/**
 * チーム内のHelping Bonus保持ポケモン数をカウント
 */
export function getTeamHelpingBonusCount(team: PokemonBoxItem[]): number {
    return team.filter(pokemon =>
        pokemon.iv.activeSubSkills.some(s => s.name === 'Helping Bonus')
    ).length;
}

/**
 * チーム内のEnergy Recovery Bonus保持ポケモン数をカウント
 */
export function getTeamEnergyRecoveryBonusCount(team: PokemonBoxItem[]): number {
    return team.filter(pokemon =>
        pokemon.iv.activeSubSkills.some(s => s.name === 'Energy Recovery Bonus')
    ).length;
}

/**
 * ポケモンがEnergy Recovery Bonusを持っているか判定
 */
function hasEnergyRecoveryBonus(pokemon: PokemonBoxItem): boolean {
    return pokemon.iv.activeSubSkills.some(s => s.name === 'Energy Recovery Bonus');
}

/**
 * とくいなものからスキルストック上限を取得
 */
function getMaxSkillStock(specialty: PokemonSpecialty): number {
    switch (specialty) {
        case 'Skills':
        case 'All':
            return 2;
        case 'Berries':
        case 'Ingredients':
        default:
            return 1;
    }
}

function buildPokemonBonusContext(
    pokemon: PokemonBoxItem,
    bonusSettings: TimelineBonusSettings,
    strengthParameter: StrengthParameter,
): PokemonBonusContext {
    const strength = new PokemonStrength(pokemon.iv, strengthParameter);
    const bonus = strength.bonusEffects;
    const isExpertMode = isExpertField(strengthParameter.fieldIndex);
    const isMainBerry = isExpertMode &&
        strengthParameter.favoriteType[0] === pokemon.iv.pokemon.type;
    const isFavoriteBerry = isExpertMode &&
        strengthParameter.favoriteType.includes(pokemon.iv.pokemon.type);

    return {
        help: {
            skillTriggerBonus: bonus.skillTrigger,
            berryBonus: bonus.berry,
            ingredientBonus: bonus.ingredient,
            isGoodCampTicketSet: bonusSettings.isGoodCampTicketSet,
            isMainBerry,
            isNonFavoriteBerry: isExpertMode && !isFavoriteBerry,
        },
        skill: {
            skillTriggerBonus: bonus.skillTrigger,
            skillLevelBonus: bonus.skillLevel,
            ingredientMagnetMultiplier: bonus.ingredientMagnet,
            ingredientDrawMultiplier: bonus.ingredientDraw,
            skillIngredientMultiplier: bonus.skillIngredient,
            dreamShardMultiplier: bonus.dreamShard,
            berryBurstMultiplier: bonus.berryBurst,
            berryStrengthBonus: strength.berryStrengthBonus,
        },
        dailySummary: {
            fieldBonus: bonusSettings.fieldBonus,
            berryStrengthBonus: strength.berryStrengthBonus,
            recipeBonus: bonusSettings.recipeBonus,
            recipeLevel: bonusSettings.recipeLevel,
            dishBonus: bonus.dish,
        },
    };
}

/**
 * シミュレーションを実行
 */
export function runSimulation(input: SimulationInput): SimulationResult {
    const { team, timeSlots, config, bonusSettings, swaps = [], box } = input;

    // 1. 有効なポケモンのみ抽出
    const validTeam: PokemonBoxItem[] = team.filter((p): p is PokemonBoxItem => p !== null);

    if (validTeam.length === 0 || timeSlots.length === 0) {
        return {
            slotResults: new Map(),
            dailySummaries: [],
            teamSummary: {
                totalIngredients: [],
                totalBerryEP: 0,
                totalIngredientEP: 0,
                totalSkillEP: 0,
                grandTotalEP: 0,
                totalPresentCandyCount: 0,
                totalCookingPotCapacityIncrease: 0,
                totalTastyChanceIncreasePercent: 0,
                totalDreamShardCount: 0,
            },
        };
    }

    const strengthParameter = buildStrengthParameterFromTimelineBonusSettings(bonusSettings);
    const bonusContextByPokemonId = new Map<number, PokemonBonusContext>();
    const getPokemonBonusContext = (pokemon: PokemonBoxItem): PokemonBonusContext => {
        const cached = bonusContextByPokemonId.get(pokemon.id);
        if (cached) {
            return cached;
        }
        const built = buildPokemonBonusContext(pokemon, bonusSettings, strengthParameter);
        bonusContextByPokemonId.set(pokemon.id, built);
        return built;
    };

    // 2. 時間帯を日数分展開（AM 4:00 基準 + 就寝スロット終端複製）
    const expandedTimeline = buildExpandedTimeline(timeSlots, config.simulationDays);
    const expandedSlots = expandedTimeline.expandedSlots;

    // 3. ポケモンごとの最終げんきを追跡（入れ替え時の引き継ぎ用）
    const pokemonLastEnergy = new Map<number, number>();

    // 4. swaps を dayIndex + slotId でグループ化
    const swapsBySlot = new Map<string, PokemonSwap[]>();
    swaps.forEach(swap => {
        const dayIndex = typeof swap.dayIndex === 'number' ? swap.dayIndex : 0;
        const key = `${dayIndex}:${swap.slotId}`;
        const list = swapsBySlot.get(key) || [];
        list.push(swap);
        swapsBySlot.set(key, list);
    });

    // 5. 現在のチームを追跡（入れ替えで変化する）
    const currentTeam: (PokemonBoxItem | null)[] = [...team];

    // 6. 各ポケモンの状態を初期化（Map に変更）
    const pokemonStates = new Map<number, PokemonState>();
    validTeam.forEach((pokemon, index) => {
        pokemonStates.set(pokemon.id, {
            pokemon,
            slotIndex: team.indexOf(pokemon),
            currentEnergy: config.initialEnergy,
            random: new SeededRandom(config.seed + index),
            sleepStartTime: null,
            usedSleepScore: 0,
            // 新規追加
            skillStock: 0,
            inventoryCount: 0,
            bankedTimeSeconds: 0,
            maxSkillStock: getMaxSkillStock(pokemon.iv.pokemon.specialty),
            maxInventory: pokemon.iv.carryLimit,
            stockpileCount: 0,
            berryBurstDisguiseLocked: false,
        });
    });

    // 7. 結果を格納するマップ
    const slotResults = new Map<string, TimeSlotResult[]>();
    const pokemonResults = new Map<number, TimeSlotResult[]>(); // pokemonId -> results

    // 8. 時間帯ループ
    let activeDayIndex = -1;
    for (let i = 0; i < expandedSlots.length; i++) {
        const expandedSlot = expandedSlots[i];
        const slot = expandedSlot.slot;
        const prevSlot = i > 0 ? expandedSlots[i - 1].slot : null;

        if (expandedSlot.dayIndex !== activeDayIndex) {
            activeDayIndex = expandedSlot.dayIndex;
            pokemonStates.forEach(state => {
                state.usedSleepScore = 0;
            });
        }

        // 8.1. この時間帯の入れ替えを適用


        // 経過時間計算
        const durationMinutes = prevSlot
            ? calculateDuration(prevSlot.time, slot.time)
            : 0; // 最初のスロット（就寝開始）は duration=0

        // フラグ判定
        const daySlots = expandedTimeline.slotsByDay[expandedSlot.dayIndex];
        const isSleeping = isSleepingSlot(slot, daySlots, expandedSlot.slotIndexInDay === 0);
        const isMealSlot = slot.hasMeal !== undefined
            ? slot.hasMeal
            : MEAL_LABELS.includes(getDisplayLabel(slot));

        // 8.2. 現在のチームからHelping Bonus保持数をカウント
        const currentValidTeam: PokemonBoxItem[] = currentTeam.filter((p): p is PokemonBoxItem => p !== null);
        const teamHelpingBonusCount = getTeamHelpingBonusCount(currentValidTeam);
        const teamSkillBonusByPokemonId = new Map<number, PokemonSkillBonusContext>();
        currentValidTeam.forEach(pokemon => {
            teamSkillBonusByPokemonId.set(
                pokemon.id,
                getPokemonBonusContext(pokemon).skill
            );
        });
        const teamSkillBonusContext: TeamSkillBonusContext = {
            fieldBonus: bonusSettings.fieldBonus,
            byPokemonId: teamSkillBonusByPokemonId,
        };

        // 睡眠開始を追跡
        if (getDisplayLabel(slot) === 'sleep') {
            for (const pokemon of currentValidTeam) {
                const state = pokemonStates.get(pokemon.id);
                if (state) {
                    state.sleepStartTime = slot.time;
                    state.berryBurstDisguiseLocked = false;
                }
            }
        }

        // Phase 1: 各ポケモンのおてつだい計算
        const helpOutputs: { state: PokemonState; helpOutput: ReturnType<typeof calculateHelp> }[] = [];

        // 現在のチームに存在するポケモンのみ処理
        for (const pokemon of currentValidTeam) {
            const state = pokemonStates.get(pokemon.id);
            if (!state) continue;

            const helpInput: HelpInput = {
                pokemon: state.pokemon,
                durationMinutes,
                startEnergy: state.currentEnergy,
                isSleeping,
                random: state.random,
                teamHelpingBonusCount,
                // 新規追加
                currentSkillStock: state.skillStock,
                maxSkillStock: state.maxSkillStock,
                currentInventory: state.inventoryCount,
                maxInventory: state.maxInventory,
                bankedTimeSeconds: state.bankedTimeSeconds,
                bonusContext: getPokemonBonusContext(state.pokemon).help,
            };

            const helpOutput = calculateHelp(helpInput);
            helpOutputs.push({ state, helpOutput });
        }

        // Phase 1.5: 時間経過減少 → 起床回復 → 食事回復（正しい順序）
        const wakeAndMealRecoveryMap = new Map<number, {
            energyAfterDecayWakeMeal: number;
            energyDecay: number;
            wakeRecoveryRaw: number;
            actualWakeRecovery: number;
            mealRecovery: number;
            selfHasErb: boolean;
        }>();

        for (const { state } of helpOutputs) {
            // Step 1: 時間経過による減少（最初に適用）
            const energyDecay = Math.round(durationMinutes * 0.1 * 10) / 10; // 1分あたり0.1減少
            let currentEnergy = Math.max(state.currentEnergy - energyDecay, 0);

            let wakeRecoveryRaw = 0;
            let actualWakeRecovery = 0;
            let mealRecovery = 0;
            let selfHasErb = false;

            // Step 2: 起床回復（減少後のげんきに適用）
            if (getDisplayLabel(slot) === 'wake' && state.sleepStartTime) {
                const sleepMinutes = calculateDuration(state.sleepStartTime, slot.time);
                selfHasErb = hasEnergyRecoveryBonus(state.pokemon);
                const teamErbCount = getTeamEnergyRecoveryBonusCount(currentValidTeam);
                const otherErbCount = selfHasErb ? teamErbCount - 1 : teamErbCount;

                const wakeInput: WakeRecoveryInput = {
                    sleepMinutes,
                    recoveryFactor: state.pokemon.iv.nature.energyRecoveryFactor,
                    hasEnergyRecoveryBonus: selfHasErb,
                    teamErbCount: otherErbCount,
                    usedSleepScore: state.usedSleepScore,
                };

                const wakeOutput = calculateWakeRecovery(wakeInput);
                wakeRecoveryRaw = wakeOutput.recoveredEnergy;
                state.usedSleepScore += wakeOutput.sleepScoreUsed;
                state.sleepStartTime = null;

                // 起床回復を適用（上限100/105）
                const wakeMaxEnergy = selfHasErb ? ERB_MAX_ENERGY : ENERGY_MAX_NORMAL;
                const energyBeforeWake = currentEnergy;
                currentEnergy = Math.min(currentEnergy + wakeRecoveryRaw, wakeMaxEnergy);
                actualWakeRecovery = currentEnergy - energyBeforeWake;
            }

            // Step 3: 食事回復（減少+起床後のげんきに適用）
            if (isMealSlot) {
                const getMealRecovery = (energy: number): number => {
                    if (energy > 80) return 1;
                    if (energy > 60) return 2;
                    if (energy > 40) return 3;
                    if (energy > 20) return 4;
                    return 5;
                };
                mealRecovery = getMealRecovery(currentEnergy);
                currentEnergy = Math.min(currentEnergy + mealRecovery, ENERGY_MAX_NORMAL);
            }

            wakeAndMealRecoveryMap.set(state.pokemon.id, {
                energyAfterDecayWakeMeal: currentEnergy,
                energyDecay,
                wakeRecoveryRaw,
                actualWakeRecovery,
                mealRecovery,
                selfHasErb,
            });
        }

        // Phase 1.6: スキル効果処理（時間減少→起床→食事回復後のげんきで実行）
        const skillResults = new Map<number, SkillEffectResult>();
        let totalTeamSkillRecovery = 0;
        const moonlightReceivedMap = new Map<number, number>(); // pokemonId -> total moonlight received
        const energizingCheerReceivedMap = new Map<number, number>(); // pokemonId -> total energizing cheer received
        const additionalRecoveryReceivedMap = new Map<number, number>(); // pokemonId -> total additional recovery (nuzzle triggered)
        const cookingMinusReceivedMap = new Map<number, number>(); // pokemonId -> total cooking minus recovery
        const badDreamsReceivedMap = new Map<number, number>(); // pokemonId -> total bad dreams damage
        const pokemonNameMap = new Map<number, string>(
            currentValidTeam.map(member => [
                member.id,
                member.nickname || i18next.t(`pokemons.${member.iv.pokemonName}`)
            ])
        );

        for (let idx = 0; idx < helpOutputs.length; idx++) {
            const { state, helpOutput } = helpOutputs[idx];
            const wakeAndMealData = wakeAndMealRecoveryMap.get(state.pokemon.id)!;

            // テームメイト配列を構築（自分を除く）
            const teammates: PokemonBoxItem[] = currentValidTeam.filter((_, i) => i !== idx);

            // 時間減少→起床→食事回復後のげんきでスキル処理
            const skillResult = processSkillTriggers(
                state.pokemon,
                helpOutput.skillTriggerCount,
                wakeAndMealData.energyAfterDecayWakeMeal,
                state.random,
                teammates,
                state.stockpileCount,
                currentValidTeam,
                undefined,
                state.berryBurstDisguiseLocked,
                undefined,
                undefined,
                false,
                teamSkillBonusContext,
            );

            skillResults.set(state.pokemon.id, skillResult);
            totalTeamSkillRecovery += skillResult.teamEnergyRecoveryPerMember;

            // Moonlightターゲット回復量を集計（pokemonId基準）
            skillResult.moonlightTargets.forEach((recovery, pokemonId) => {
                const current = moonlightReceivedMap.get(pokemonId) || 0;
                moonlightReceivedMap.set(pokemonId, current + recovery);
            });
            skillResult.energizingCheerTargets.forEach((recovery, pokemonId) => {
                const current = energizingCheerReceivedMap.get(pokemonId) || 0;
                energizingCheerReceivedMap.set(pokemonId, current + recovery);
            });
            skillResult.additionalRecoveryTargets.forEach((recovery, pokemonId) => {
                const current = additionalRecoveryReceivedMap.get(pokemonId) || 0;
                additionalRecoveryReceivedMap.set(pokemonId, current + recovery);
            });
            skillResult.cookingMinusTargets.forEach((recovery, pokemonId) => {
                const current = cookingMinusReceivedMap.get(pokemonId) || 0;
                cookingMinusReceivedMap.set(pokemonId, current + recovery);
            });

            if (skillResult.badDreamsDamagePerTarget > 0) {
                for (const targetPokemon of currentValidTeam) {
                    if (targetPokemon.iv.pokemon.type === 'dark') {
                        continue;
                    }
                    const current = badDreamsReceivedMap.get(targetPokemon.id) || 0;
                    badDreamsReceivedMap.set(
                        targetPokemon.id,
                        current + skillResult.badDreamsDamagePerTarget
                    );
                }
            }
        }

        // Phase 2: 各ポケモンのげんき更新と結果生成
        const slotResultsForThisSlot: TimeSlotResult[] = [];

        for (const { state, helpOutput } of helpOutputs) {
            const skillResult = skillResults.get(state.pokemon.id)!;
            const wakeAndMealData = wakeAndMealRecoveryMap.get(state.pokemon.id)!;
            const moonlightReceived = moonlightReceivedMap.get(state.pokemon.id) || 0;
            const energizingCheerReceived = energizingCheerReceivedMap.get(state.pokemon.id) || 0;
            const additionalRecoveryReceived = additionalRecoveryReceivedMap.get(state.pokemon.id) || 0;
            const cookingMinusReceived = cookingMinusReceivedMap.get(state.pokemon.id) || 0;
            const badDreamsReceived = badDreamsReceivedMap.get(state.pokemon.id) || 0;

            // エネルギーフロー（正しい順序）:
            // 1. state.currentEnergy (開始時)
            // 2. - time decay → floor at 0 (Phase 1.5で実行済み)
            // 3. + wake recovery → cap at 100/105 (Phase 1.5で実行済み)
            // 4. + meal recovery → cap at 100 (Phase 1.5で実行済み)
            // 5. + self skill recovery → cap at 150 (Phase 1.6で実行済み、skillResult.energyAfterSelfRecovery)
            // 6. + team skill recovery + moonlight + energizing cheer → cap at 150

            // 現在のげんき = 自己スキル回復後のげんき
            let currentEnergy = skillResult.energyAfterSelfRecovery;

            // チームスキル回復 + Moonlight受信を適用（上限150）
            const teamRecovery = totalTeamSkillRecovery +
                moonlightReceived +
                energizingCheerReceived +
                additionalRecoveryReceived +
                cookingMinusReceived;
            const energyBeforeTeamSkill = currentEnergy;
            if (teamRecovery > 0) {
                currentEnergy = Math.min(currentEnergy + teamRecovery, MAX_ENERGY);
            }
            const actualTeamSkillRecovery = currentEnergy - energyBeforeTeamSkill;

            // Bad Dreams減少を適用（下限0）
            const energyBeforeBadDreams = currentEnergy;
            if (badDreamsReceived > 0) {
                currentEnergy = Math.max(currentEnergy - badDreamsReceived, 0);
            }
            const actualBadDreamsDamage = energyBeforeBadDreams - currentEnergy;

            // 最終げんき（既に0以上が保証されている）
            const finalEnergy = currentEnergy;

            // TimeSlotResult を生成
            const result: TimeSlotResult = {
                slotId: slot.id,
                pokemonId: state.pokemon.id,
                teamIndex: state.slotIndex,
                durationMinutes,
                isSleeping,
                helpCount: helpOutput.helpCount,
                skillTriggerCount: helpOutput.skillTriggerCount,
                berryCount: helpOutput.berryCount,
                ingredients: helpOutput.ingredients,
                skillIngredients: skillResult.skillIngredients,
                energyStart: state.currentEnergy, // 開始時のげんき（時間減少前）
                energyEnd: finalEnergy,
                mealRecovery: wakeAndMealData.mealRecovery,
                skillRecovery: actualTeamSkillRecovery, // チームスキル回復の実適用量
                wakeRecovery: wakeAndMealData.actualWakeRecovery,
                energyDecay: wakeAndMealData.energyDecay, // Phase 1.5で計算済みの値を使用
                // 新規追加
                skillOverflowCount: helpOutput.skillOverflowCount,
                overflowIngredients: helpOutput.overflowIngredients,
                selfSkillRecovery: skillResult.selfEnergyRecovery,
                directSkillEP: skillResult.directEP,
                moonlightGivenRecovery: Array.from(skillResult.moonlightTargets.values()).reduce((sum, v) => sum + v, 0),
                moonlightEvents: Array.from(skillResult.moonlightTargets.entries()).map(([targetPokemonId, recovery]) => ({
                    targetPokemonId,
                    targetPokemonName: pokemonNameMap.get(targetPokemonId) ?? String(targetPokemonId),
                    recovery,
                })),
                moonlightReceivedRecovery: moonlightReceived,
                energizingCheerGivenRecovery: Array.from(skillResult.energizingCheerTargets.values())
                    .reduce((sum, v) => sum + v, 0),
                energizingCheerReceivedRecovery: energizingCheerReceived,
                energizingCheerEvents: skillResult.energizingCheerEvents.map(event => ({
                    targetPokemonId: event.targetPokemonId,
                    targetPokemonName: pokemonNameMap.get(event.targetPokemonId) ?? String(event.targetPokemonId),
                    recovery: event.recovery,
                    source: event.source,
                })),
                nuzzleTriggeredSkillEvents: skillResult.nuzzleTriggeredSkillEvents.map(event => ({
                    targetPokemonId: event.targetPokemonId,
                    targetPokemonName: pokemonNameMap.get(event.targetPokemonId) ?? String(event.targetPokemonId),
                    triggeredSkillName: event.triggeredSkillName,
                })),
                proxySkillEvents: skillResult.proxySkillEvents.map(event => ({
                    source: event.source,
                    triggeredSkillName: event.triggeredSkillName,
                    resolvedSkillName: event.resolvedSkillName,
                    resolvedSkillLevel: event.resolvedSkillLevel,
                    copiedFromPokemonId: event.copiedFromPokemonId,
                    copiedFromPokemonName: event.copiedFromPokemonId !== undefined
                        ? (pokemonNameMap.get(event.copiedFromPokemonId) ?? String(event.copiedFromPokemonId))
                        : undefined,
                    selfEnergyRecovery: event.selfEnergyRecovery,
                    teamEnergyRecoveryPerMember: event.teamEnergyRecoveryPerMember,
                    teamEnergyRecoveryTargetCount: event.teamEnergyRecoveryTargetCount,
                    directEP: event.directEP,
                    skillIngredients: event.skillIngredients,
                    presentCandyCount: event.presentCandyCount,
                    berryJuiceCount: event.berryJuiceCount,
                    supportSkillBerryEP: event.supportSkillBerryEP,
                    cookingPotCapacityIncrease: event.cookingPotCapacityIncrease,
                    tastyChanceIncreasePercent: event.tastyChanceIncreasePercent,
                    dreamShardCount: event.dreamShardCount,
                    stockpileStoreCount: event.stockpileStoreCount,
                    stockpileCountAtStore: event.stockpileCountAtStore,
                    stockpileSpitCount: event.stockpileSpitCount,
                    stockpileCountAtSpit: event.stockpileCountAtSpit,
                    badDreamsHitCount: event.badDreamsHitCount,
                    berryBurstGreatSuccessCount: event.berryBurstGreatSuccessCount,
                    ingredientDrawGreatSuccessCount: event.ingredientDrawGreatSuccessCount,
                })),
                presentCandyCount: skillResult.presentCandyCount,
                berryJuiceCount: skillResult.berryJuiceCount,
                supportSkillBerryCount: skillResult.supportSkillBerryCount,
                supportSkillBerryEP: skillResult.supportSkillBerryEP,
                supportHelpEvents: skillResult.supportHelpEvents.map(event => ({
                    source: event.source,
                    targetPokemonId: event.targetPokemonId,
                    targetPokemonName: pokemonNameMap.get(event.targetPokemonId) ?? String(event.targetPokemonId),
                    helpCount: event.helpCount,
                    berryCount: event.berryCount,
                    berryEP: event.berryEP,
                    ingredients: event.ingredients,
                })),
                cookingPotCapacityIncrease: skillResult.cookingPotCapacityIncrease,
                tastyChanceIncreasePercent: skillResult.tastyChanceIncreasePercent,
                dreamShardCount: skillResult.dreamShardCount,
                ingredientDrawGreatSuccessCount: skillResult.ingredientDrawGreatSuccessCount,
                cookingMinusEvents: skillResult.cookingMinusEvents.map(event => ({
                    targetPokemonId: event.targetPokemonId,
                    targetPokemonName: pokemonNameMap.get(event.targetPokemonId) ?? String(event.targetPokemonId),
                    recovery: event.recovery,
                })),
                berryBurstGreatSuccessCount: skillResult.berryBurstGreatSuccessCount,
                teamEnergyRecoveryGivenPerMember: skillResult.teamEnergyRecoveryPerMember,
                teamEnergyRecoveryGivenTargetCount: skillResult.teamEnergyRecoveryPerMember > 0
                    ? currentValidTeam.length
                    : 0,
                stockpileStoreCount: skillResult.stockpileStoreCount,
                stockpileCountAtStore: skillResult.stockpileCountAtStore,
                stockpileSpitCount: skillResult.stockpileSpitCount,
                stockpileCountAtSpit: skillResult.stockpileCountAtSpit,
                stockpileCountAfter: skillResult.stockpileCountAfter,
                badDreamsHitCount: skillResult.badDreamsHitCount,
                badDreamsTotalDamageGiven: skillResult.badDreamsTotalDamage,
                badDreamsDamageTaken: actualBadDreamsDamage,
            };

            slotResultsForThisSlot.push(result);

            // ポケモンごとの結果を追加
            const pokemonId = state.pokemon.id;
            if (!pokemonResults.has(pokemonId)) {
                pokemonResults.set(pokemonId, []);
            }
            pokemonResults.get(pokemonId)!.push(result);

            // 状態を最終値で更新
            state.currentEnergy = finalEnergy;
            // 新規追加: タイムスロット終了時のリセット
            state.skillStock = 0;        // スキルストックをリセット
            state.inventoryCount = 0;    // 所持数をリセット（回収扱い）
            state.bankedTimeSeconds = helpOutput.newBankedTimeSeconds;  // 持ち越し秒数を更新
            state.stockpileCount = skillResult.stockpileCountAfter;
            state.berryBurstDisguiseLocked = skillResult.berryBurstDisguiseLockedAfter;
        }

        // 8.1. この時間帯の入れ替えを適用 (計算後に移動)
        const slotSwaps = swapsBySlot.get(`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`) || [];
        for (const swap of slotSwaps) {
            const oldPokemon = currentTeam[swap.teamSlotIndex];

            // 古いポケモンの最終げんきを記録
            if (oldPokemon) {
                const oldState = pokemonStates.get(oldPokemon.id);
                if (oldState) {
                    pokemonLastEnergy.set(oldPokemon.id, oldState.currentEnergy);
                }
            }

            // Handle "none" swap: remove Pokemon from slot
            if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
                currentTeam[swap.teamSlotIndex] = null;
                continue;
            }

            // 新しいポケモンを取得
            const newPokemon = box?.items.find((item: PokemonBoxItem) => item.id === swap.newPokemonId);
            if (!newPokemon) continue; // ボックスにない場合はスキップ

            currentTeam[swap.teamSlotIndex] = newPokemon;

            // 新ポケモンの初期げんきを決定
            let startEnergy: number;
            if (pokemonLastEnergy.has(newPokemon.id)) {
                // 2回目以降: 前回の最終げんきを引き継ぐ
                startEnergy = pokemonLastEnergy.get(newPokemon.id)!;
            } else {
                // 初回: swap.initialEnergy を使用
                startEnergy = swap.initialEnergy;
            }

            // 新しいシード値で乱数を初期化
            const swapSeed = config.seed + swap.teamSlotIndex + (i * 100);

            const newState: PokemonState = {
                pokemon: newPokemon,
                slotIndex: swap.teamSlotIndex,
                currentEnergy: startEnergy,
                random: new SeededRandom(swapSeed),
                sleepStartTime: null,
                usedSleepScore: 0,
                // 新規追加
                skillStock: 0,
                inventoryCount: 0,
                bankedTimeSeconds: 0,
                maxSkillStock: getMaxSkillStock(newPokemon.iv.pokemon.specialty),
                maxInventory: newPokemon.iv.carryLimit,
                stockpileCount: 0,
                berryBurstDisguiseLocked: false,
            };

            // もし現在が就寝スロットなら、新しいポケモンも就寝状態にする
            if (getDisplayLabel(slot) === 'sleep') {
                newState.sleepStartTime = slot.time;
            }

            pokemonStates.set(newPokemon.id, newState);
        }

        slotResults.set(slot.id, slotResultsForThisSlot);
    }

    // 9. 一日合計を計算（結果が存在するポケモンのみ）
    const dailySummaries: DailySummary[] = [];
    pokemonResults.forEach((results, pokemonId) => {
        const state = pokemonStates.get(pokemonId);
        if (state && results.length > 0) {
            dailySummaries.push(
                calculateDailySummary(
                    pokemonId,
                    state.pokemon,
                    results,
                    getPokemonBonusContext(state.pokemon).dailySummary
                )
            );
        }
    });

    // 10. チーム合計を計算
    const teamSummary = calculateTeamSummary(dailySummaries);

    return {
        slotResults,
        dailySummaries,
        teamSummary,
    };
}
