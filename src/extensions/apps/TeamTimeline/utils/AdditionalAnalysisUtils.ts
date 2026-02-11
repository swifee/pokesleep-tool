import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import {
    SimulationResult,
    PokemonSwap,
    SWAP_NONE_POKEMON_ID,
    TimeSlot,
    getDisplayLabel,
} from '../types/TimeSlotTypes';
import { buildExpandedTimeline } from './TimelineDayExpansion';
import { calculateDuration } from './TimeSlotUtils';
import {
    ContributionEpAnalysisResult,
    EnergyRecoveryBonusContributionResult,
    EnergySkillContributionCategory,
    EnergySkillContributionResult,
    EnergySkillContributionTarget,
} from '../types/AdditionalAnalysisTypes';

const SELF_ENERGY_SKILLS = new Set<string>([
    'Charge Energy S',
    'Charge Energy S (Moonlight)',
]);
const TEAM_ENERGY_SKILLS = new Set<string>([
    'Energizing Cheer S',
    'Energizing Cheer S (Nuzzle)',
    'Energy for Everyone S',
    'Energy for Everyone S (Lunar Blessing)',
    'Energy for Everyone S (Berry Juice)',
]);
const NIGHTMARE_SKILLS = new Set<string>([
    'Charge Strength M (Bad Dreams)',
]);
const PLUS_MINUS_SKILLS = new Set<string>([
    'Ingredient Magnet S (Plus)',
    'Cooking Power-Up S (Minus)',
]);
const ENERGY_RECOVERY_BONUS_SUBSKILL = 'Energy Recovery Bonus';
const HELPING_BONUS_SUBSKILL = 'Helping Bonus';

export interface WakeErbMemberCountRange {
    minCount: number;
    maxCount: number;
    slotCount: number;
}

export interface TimelineDurationSummary {
    totalTimelineMinutes: number;
    activeMinutesByPokemonId: Map<number, number>;
}

export function collectAppearingTimelineMembers(
    team: readonly (PokemonBoxItem | null)[],
    swaps: readonly PokemonSwap[],
    box?: PokemonBox
): PokemonBoxItem[] {
    const seen = new Set<number>();
    const members: PokemonBoxItem[] = [];

    const appendMember = (member: PokemonBoxItem | null | undefined): void => {
        if (!member || seen.has(member.id)) {
            return;
        }
        seen.add(member.id);
        members.push(member);
    };

    team.forEach(member => appendMember(member));

    if (!box) {
        return members;
    }

    swaps.forEach((swap) => {
        if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
            return;
        }
        appendMember(box.getById(swap.newPokemonId));
    });

    return members;
}

export function hasAnyPlusOrMinusSkill(members: readonly PokemonBoxItem[]): boolean {
    return members.some(member => PLUS_MINUS_SKILLS.has(member.iv.pokemon.skill));
}

function isPlusOrMinusSkill(skillName: string): boolean {
    return PLUS_MINUS_SKILLS.has(skillName);
}

function isCookingMinusSkill(skillName: string): boolean {
    return skillName === 'Cooking Power-Up S (Minus)';
}

interface EnergySkillContributionTargetBuildContext {
    team: readonly (PokemonBoxItem | null)[];
    timeSlots: readonly TimeSlot[];
    simulationDays: number;
    swaps: readonly PokemonSwap[];
    box?: PokemonBox;
}

function collectCookingMinusEligibleIdsByTimeline(
    context: EnergySkillContributionTargetBuildContext
): Set<number> {
    const expandedTimeline = buildExpandedTimeline([...context.timeSlots], context.simulationDays);
    const currentTeam: (PokemonBoxItem | null)[] = [...context.team];
    const swapsBySlot = new Map<string, PokemonSwap[]>();
    const eligibleMinusIds = new Set<number>();

    const inspectCurrentTeam = (): void => {
        const plusMinusMembers = currentTeam.filter((member): member is PokemonBoxItem => (
            member !== null && isPlusOrMinusSkill(member.iv.pokemon.skill)
        ));
        if (plusMinusMembers.length < 2) {
            return;
        }
        plusMinusMembers.forEach((member) => {
            if (isCookingMinusSkill(member.iv.pokemon.skill)) {
                eligibleMinusIds.add(member.id);
            }
        });
    };

    context.swaps.forEach((swap) => {
        const dayIndex = typeof swap.dayIndex === 'number' ? swap.dayIndex : 0;
        const key = `${dayIndex}:${swap.slotId}`;
        const list = swapsBySlot.get(key) ?? [];
        list.push(swap);
        swapsBySlot.set(key, list);
    });

    expandedTimeline.expandedSlots.forEach((expandedSlot) => {
        inspectCurrentTeam();

        const slotSwaps = swapsBySlot.get(`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`) ?? [];
        slotSwaps.forEach((swap) => {
            if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
                currentTeam[swap.teamSlotIndex] = null;
                return;
            }
            const nextMember = context.box?.getById(swap.newPokemonId) ?? null;
            if (nextMember) {
                currentTeam[swap.teamSlotIndex] = nextMember;
            }
        });
    });

    if (expandedTimeline.expandedSlots.length === 0) {
        inspectCurrentTeam();
    }

    return eligibleMinusIds;
}

export function classifyEnergyDeltaSkill(
    skillName: string,
    includeCookingMinus: boolean
): EnergySkillContributionCategory | null {
    if (SELF_ENERGY_SKILLS.has(skillName)) {
        return 'self';
    }
    if (TEAM_ENERGY_SKILLS.has(skillName)) {
        return 'team';
    }
    if (skillName === 'Cooking Power-Up S (Minus)' && includeCookingMinus) {
        return 'team';
    }
    if (NIGHTMARE_SKILLS.has(skillName)) {
        return 'nightmare';
    }
    return null;
}

export function buildEnergySkillContributionTargets(
    members: readonly PokemonBoxItem[],
    context?: EnergySkillContributionTargetBuildContext
): EnergySkillContributionTarget[] {
    const includeCookingMinus = hasAnyPlusOrMinusSkill(members);
    const cookingMinusEligibleIds = context
        ? collectCookingMinusEligibleIdsByTimeline(context)
        : null;
    const targets: EnergySkillContributionTarget[] = [];
    members.forEach((member) => {
        const category = classifyEnergyDeltaSkill(
            member.iv.pokemon.skill,
            isCookingMinusSkill(member.iv.pokemon.skill)
                ? (cookingMinusEligibleIds?.has(member.id) ?? includeCookingMinus)
                : includeCookingMinus
        );
        if (!category) {
            return;
        }
        targets.push({
            pokemonId: member.id,
            pokemonName: member.nickname || member.iv.pokemonName,
            skillName: member.iv.pokemon.skill,
            category,
        });
    });
    return targets;
}

export function getTeamHelpCount(result: SimulationResult): number {
    return result.dailySummaries.reduce((sum, summary) => sum + summary.totalHelpCount, 0);
}

export function getPokemonHelpCount(result: SimulationResult, pokemonId: number): number {
    return result.dailySummaries.find(summary => summary.pokemonId === pokemonId)?.totalHelpCount ?? 0;
}

export function getPokemonTotalEP(result: SimulationResult, pokemonId: number): number {
    return result.dailySummaries.find(summary => summary.pokemonId === pokemonId)?.totalEP ?? 0;
}

export function getTeamGrandTotalEP(result: SimulationResult): number {
    return result.teamSummary.grandTotalEP;
}

export function calculateDeltaPercent(baseValue: number, scenarioValue: number): number | null {
    if (baseValue === 0) {
        return null;
    }
    return ((scenarioValue - baseValue) / baseValue) * 100;
}

function hasEnergyRecoveryBonusSubSkill(member: PokemonBoxItem): boolean {
    return member.iv.activeSubSkills.some(subSkill => subSkill.name === ENERGY_RECOVERY_BONUS_SUBSKILL);
}

function hasHelpingBonusSubSkill(member: PokemonBoxItem): boolean {
    return member.iv.activeSubSkills.some(subSkill => subSkill.name === HELPING_BONUS_SUBSKILL);
}

/**
 * 起床スロット時点での Energy Recovery Bonus 保持メンバー編成数を集計する。
 * 注: スワップはスロット処理「後」に適用される仕様なので、各スロットの判定は適用前編成で行う。
 */
export function collectWakeErbMemberCountRange(
    team: readonly (PokemonBoxItem | null)[],
    timeSlots: readonly TimeSlot[],
    simulationDays: number,
    swaps: readonly PokemonSwap[],
    box?: PokemonBox
): WakeErbMemberCountRange {
    const expandedTimeline = buildExpandedTimeline([...timeSlots], simulationDays);
    const currentTeam: (PokemonBoxItem | null)[] = [...team];
    const counts: number[] = [];
    const swapsBySlot = new Map<string, PokemonSwap[]>();

    swaps.forEach((swap) => {
        const dayIndex = typeof swap.dayIndex === 'number' ? swap.dayIndex : 0;
        const key = `${dayIndex}:${swap.slotId}`;
        const list = swapsBySlot.get(key) ?? [];
        list.push(swap);
        swapsBySlot.set(key, list);
    });

    expandedTimeline.expandedSlots.forEach((expandedSlot) => {
        if (getDisplayLabel(expandedSlot.slot) === 'wake') {
            const erbCount = currentTeam.filter((member): member is PokemonBoxItem => (
                member !== null && hasEnergyRecoveryBonusSubSkill(member)
            )).length;
            counts.push(erbCount);
        }

        const slotSwaps = swapsBySlot.get(`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`) ?? [];
        slotSwaps.forEach((swap) => {
            if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
                currentTeam[swap.teamSlotIndex] = null;
                return;
            }

            const nextMember = box?.getById(swap.newPokemonId) ?? null;
            if (nextMember) {
                currentTeam[swap.teamSlotIndex] = nextMember;
            }
        });
    });

    if (counts.length === 0) {
        return { minCount: 0, maxCount: 0, slotCount: 0 };
    }

    return {
        minCount: Math.min(...counts),
        maxCount: Math.max(...counts),
        slotCount: counts.length,
    };
}

/**
 * タイムライン全体での「Helping Bonus保持メンバー平均編成数」を時間加重で算出する。
 * 注: スワップはスロット処理「後」に適用される仕様なので、各スロットは適用前編成を採用する。
 */
export function collectAverageHelpingBonusMemberCountByDuration(
    team: readonly (PokemonBoxItem | null)[],
    timeSlots: readonly TimeSlot[],
    simulationDays: number,
    swaps: readonly PokemonSwap[],
    box?: PokemonBox
): number {
    const expandedTimeline = buildExpandedTimeline([...timeSlots], simulationDays);
    if (expandedTimeline.expandedSlots.length === 0) {
        return 0;
    }

    const currentTeam: (PokemonBoxItem | null)[] = [...team];
    const swapsBySlot = new Map<string, PokemonSwap[]>();
    let weightedHelpingBonusMemberMinutes = 0;
    let totalDurationMinutes = 0;

    swaps.forEach((swap) => {
        const dayIndex = typeof swap.dayIndex === 'number' ? swap.dayIndex : 0;
        const key = `${dayIndex}:${swap.slotId}`;
        const list = swapsBySlot.get(key) ?? [];
        list.push(swap);
        swapsBySlot.set(key, list);
    });

    expandedTimeline.expandedSlots.forEach((expandedSlot, index) => {
        const prevSlot = index > 0 ? expandedTimeline.expandedSlots[index - 1].slot : null;
        const durationMinutes = prevSlot
            ? calculateDuration(prevSlot.time, expandedSlot.slot.time)
            : 0;
        const helpingBonusMemberCount = currentTeam.filter((member): member is PokemonBoxItem => (
            member !== null && hasHelpingBonusSubSkill(member)
        )).length;
        weightedHelpingBonusMemberMinutes += helpingBonusMemberCount * durationMinutes;
        totalDurationMinutes += durationMinutes;

        const slotSwaps = swapsBySlot.get(`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`) ?? [];
        slotSwaps.forEach((swap) => {
            if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
                currentTeam[swap.teamSlotIndex] = null;
                return;
            }
            const nextMember = box?.getById(swap.newPokemonId) ?? null;
            if (nextMember) {
                currentTeam[swap.teamSlotIndex] = nextMember;
            }
        });
    });

    if (totalDurationMinutes <= 0) {
        return 0;
    }
    return weightedHelpingBonusMemberMinutes / totalDurationMinutes;
}

/**
 * 各起床時点での Energy Recovery Bonus 保持メンバー編成数を、
 * 直前就寝から起床までの睡眠時間で重み付けして平均化する。
 * 注: スワップはスロット処理「後」に適用される仕様なので、起床時判定は適用前編成で行う。
 */
export function collectAverageEnergyRecoveryBonusMemberCountByDuration(
    team: readonly (PokemonBoxItem | null)[],
    timeSlots: readonly TimeSlot[],
    simulationDays: number,
    swaps: readonly PokemonSwap[],
    box?: PokemonBox
): number {
    const expandedTimeline = buildExpandedTimeline([...timeSlots], simulationDays);
    if (expandedTimeline.expandedSlots.length === 0) {
        return 0;
    }

    const currentTeam: (PokemonBoxItem | null)[] = [...team];
    const swapsBySlot = new Map<string, PokemonSwap[]>();
    let weightedErbMemberMinutes = 0;
    let totalSleepMinutes = 0;
    let latestSleepSlot: TimeSlot | null = null;

    swaps.forEach((swap) => {
        const dayIndex = typeof swap.dayIndex === 'number' ? swap.dayIndex : 0;
        const key = `${dayIndex}:${swap.slotId}`;
        const list = swapsBySlot.get(key) ?? [];
        list.push(swap);
        swapsBySlot.set(key, list);
    });

    expandedTimeline.expandedSlots.forEach((expandedSlot) => {
        const label = getDisplayLabel(expandedSlot.slot);
        if (label === 'sleep') {
            latestSleepSlot = expandedSlot.slot;
        } else if (label === 'wake' && latestSleepSlot !== null) {
            const sleepMinutes = calculateDuration(latestSleepSlot.time, expandedSlot.slot.time);
            const erbMemberCount = currentTeam.filter((member): member is PokemonBoxItem => (
                member !== null && hasEnergyRecoveryBonusSubSkill(member)
            )).length;
            weightedErbMemberMinutes += erbMemberCount * sleepMinutes;
            totalSleepMinutes += sleepMinutes;
        }

        const slotSwaps = swapsBySlot.get(`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`) ?? [];
        slotSwaps.forEach((swap) => {
            if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
                currentTeam[swap.teamSlotIndex] = null;
                return;
            }
            const nextMember = box?.getById(swap.newPokemonId) ?? null;
            if (nextMember) {
                currentTeam[swap.teamSlotIndex] = nextMember;
            }
        });
    });

    if (totalSleepMinutes <= 0) {
        return 0;
    }
    return weightedErbMemberMinutes / totalSleepMinutes;
}

/**
 * タイムライン全体での各ポケモン編成時間と総経過時間を集計する。
 * 注: スワップはスロット処理「後」に適用される仕様なので、各区間は適用前編成で加算する。
 */
export function collectTimelineDurationSummaryByPokemon(
    team: readonly (PokemonBoxItem | null)[],
    timeSlots: readonly TimeSlot[],
    simulationDays: number,
    swaps: readonly PokemonSwap[],
    box?: PokemonBox
): TimelineDurationSummary {
    const expandedTimeline = buildExpandedTimeline([...timeSlots], simulationDays);
    if (expandedTimeline.expandedSlots.length === 0) {
        return {
            totalTimelineMinutes: 0,
            activeMinutesByPokemonId: new Map<number, number>(),
        };
    }

    const currentTeam: (PokemonBoxItem | null)[] = [...team];
    const swapsBySlot = new Map<string, PokemonSwap[]>();
    const activeMinutesByPokemonId = new Map<number, number>();
    let totalTimelineMinutes = 0;

    swaps.forEach((swap) => {
        const dayIndex = typeof swap.dayIndex === 'number' ? swap.dayIndex : 0;
        const key = `${dayIndex}:${swap.slotId}`;
        const list = swapsBySlot.get(key) ?? [];
        list.push(swap);
        swapsBySlot.set(key, list);
    });

    expandedTimeline.expandedSlots.forEach((expandedSlot, index) => {
        const prevSlot = index > 0 ? expandedTimeline.expandedSlots[index - 1].slot : null;
        const durationMinutes = prevSlot
            ? calculateDuration(prevSlot.time, expandedSlot.slot.time)
            : 0;
        totalTimelineMinutes += durationMinutes;

        if (durationMinutes > 0) {
            currentTeam.forEach((member) => {
                if (!member) {
                    return;
                }
                activeMinutesByPokemonId.set(
                    member.id,
                    (activeMinutesByPokemonId.get(member.id) ?? 0) + durationMinutes
                );
            });
        }

        const slotSwaps = swapsBySlot.get(`${expandedSlot.dayIndex}:${expandedSlot.originalSlotId}`) ?? [];
        slotSwaps.forEach((swap) => {
            if (swap.newPokemonId === SWAP_NONE_POKEMON_ID) {
                currentTeam[swap.teamSlotIndex] = null;
                return;
            }
            const nextMember = box?.getById(swap.newPokemonId) ?? null;
            if (nextMember) {
                currentTeam[swap.teamSlotIndex] = nextMember;
            }
        });
    });

    return {
        totalTimelineMinutes,
        activeMinutesByPokemonId,
    };
}

export function formatSignedPercent(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
        return '-';
    }
    const fixed = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
    return `${value > 0 ? '+' : ''}${fixed}%`;
}

export function formatSignedNumber(value: number): string {
    const abs = Math.abs(value).toLocaleString();
    return `${value > 0 ? '+' : value < 0 ? '-' : ''}${abs}`;
}

export function buildContributionEpAnalysisResult(
    pokemon: PokemonBoxItem,
    baseResult: SimulationResult,
    scenarioResult: SimulationResult
): ContributionEpAnalysisResult {
    const baseTeamEP = getTeamGrandTotalEP(baseResult);
    const scenarioTeamEP = getTeamGrandTotalEP(scenarioResult);
    return {
        pokemonId: pokemon.id,
        pokemonName: pokemon.nickname || pokemon.iv.pokemonName,
        baseTeamEP,
        scenarioTeamEP,
        deltaEP: scenarioTeamEP - baseTeamEP,
        deltaPercent: calculateDeltaPercent(baseTeamEP, scenarioTeamEP),
    };
}

export function buildEnergySkillContributionResult(
    target: EnergySkillContributionTarget,
    baseResult: SimulationResult,
    scenarioResult: SimulationResult
): EnergySkillContributionResult {
    const baseSelfEP = getPokemonTotalEP(baseResult, target.pokemonId);
    const scenarioSelfEP = getPokemonTotalEP(scenarioResult, target.pokemonId);
    const baseTeamEP = getTeamGrandTotalEP(baseResult);
    const scenarioTeamEP = getTeamGrandTotalEP(scenarioResult);
    const baseSelfHelpCount = getPokemonHelpCount(baseResult, target.pokemonId);
    const scenarioSelfHelpCount = getPokemonHelpCount(scenarioResult, target.pokemonId);
    const baseTeamHelpCount = getTeamHelpCount(baseResult);
    const scenarioTeamHelpCount = getTeamHelpCount(scenarioResult);

    return {
        pokemonId: target.pokemonId,
        pokemonName: target.pokemonName,
        skillName: target.skillName,
        category: target.category,
        baseSelfEP,
        scenarioSelfEP,
        selfDeltaEP: scenarioSelfEP - baseSelfEP,
        selfDeltaPercent: calculateDeltaPercent(baseSelfEP, scenarioSelfEP),
        baseTeamEP,
        scenarioTeamEP,
        teamDeltaEP: scenarioTeamEP - baseTeamEP,
        teamDeltaPercent: calculateDeltaPercent(baseTeamEP, scenarioTeamEP),
        baseSelfHelpCount,
        scenarioSelfHelpCount,
        baseTeamHelpCount,
        scenarioTeamHelpCount,
    };
}

export function buildEnergyRecoveryBonusContributionResult(
    baseResult: SimulationResult,
    scenarioResult: SimulationResult,
    wakeErbMemberCountRange: WakeErbMemberCountRange
): EnergyRecoveryBonusContributionResult {
    const baseTeamEP = getTeamGrandTotalEP(baseResult);
    const scenarioTeamEP = getTeamGrandTotalEP(scenarioResult);
    return {
        baseTeamEP,
        scenarioTeamEP,
        teamDeltaEP: scenarioTeamEP - baseTeamEP,
        teamDeltaPercent: calculateDeltaPercent(baseTeamEP, scenarioTeamEP),
        wakeErbMemberCountMin: wakeErbMemberCountRange.minCount,
        wakeErbMemberCountMax: wakeErbMemberCountRange.maxCount,
        wakeSlotCount: wakeErbMemberCountRange.slotCount,
    };
}
