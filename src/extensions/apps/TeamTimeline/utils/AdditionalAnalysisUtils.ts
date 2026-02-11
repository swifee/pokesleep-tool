import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import { SimulationResult, PokemonSwap, SWAP_NONE_POKEMON_ID } from '../types/TimeSlotTypes';
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
    members: readonly PokemonBoxItem[]
): EnergySkillContributionTarget[] {
    const includeCookingMinus = hasAnyPlusOrMinusSkill(members);
    const targets: EnergySkillContributionTarget[] = [];
    members.forEach((member) => {
        const category = classifyEnergyDeltaSkill(member.iv.pokemon.skill, includeCookingMinus);
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
    scenarioResult: SimulationResult
): EnergyRecoveryBonusContributionResult {
    const baseTeamHelpCount = getTeamHelpCount(baseResult);
    const scenarioTeamHelpCount = getTeamHelpCount(scenarioResult);
    return {
        baseTeamHelpCount,
        scenarioTeamHelpCount,
        teamDeltaPercent: calculateDeltaPercent(baseTeamHelpCount, scenarioTeamHelpCount),
    };
}
