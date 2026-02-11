export type AnalysisRunState = 'idle' | 'loading' | 'done' | 'error';

export type EnergySkillContributionCategory = 'self' | 'team' | 'nightmare';

export interface ContributionEpAnalysisResult {
    pokemonId: number;
    pokemonName: string;
    baseTeamEP: number;
    scenarioTeamEP: number;
    deltaEP: number;
    deltaPercent: number | null;
}

export interface EnergySkillContributionTarget {
    pokemonId: number;
    pokemonName: string;
    skillName: string;
    category: EnergySkillContributionCategory;
}

export interface EnergySkillContributionResult {
    pokemonId: number;
    pokemonName: string;
    skillName: string;
    category: EnergySkillContributionCategory;
    baseSelfEP: number;
    scenarioSelfEP: number;
    selfDeltaEP: number;
    selfDeltaPercent: number | null;
    baseTeamEP: number;
    scenarioTeamEP: number;
    teamDeltaEP: number;
    teamDeltaPercent: number | null;
    baseSelfHelpCount: number;
    scenarioSelfHelpCount: number;
    baseTeamHelpCount: number;
    scenarioTeamHelpCount: number;
}

export interface EnergyRecoveryBonusContributionResult {
    baseTeamHelpCount: number;
    scenarioTeamHelpCount: number;
    teamDeltaPercent: number | null;
}
