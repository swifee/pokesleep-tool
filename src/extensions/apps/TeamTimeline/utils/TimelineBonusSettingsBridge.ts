import { getEventBonus, loadHelpEventBonus } from '../../../../data/events';
import fields from '../../../../data/fields';
import { PokemonType, PokemonTypes } from '../../../../data/pokemons';
import {
    createStrengthParameter,
    ExpertEffects,
    StrengthParameter,
    loadStrengthParameter,
} from '../../../../util/PokemonStrength';
import {
    TimelineBonusSettings,
    TimelineFavoriteTypes,
} from '../types/TimelineBonusSettingsTypes';

export const IV_PARAMETER_STORAGE_KEY = 'PstStrenghParam';

const DEFAULT_PARAMETER = createStrengthParameter({});
const MIN_FIELD_INDEX = -2;
const MAX_FIELD_INDEX = fields.length - 1;
const DEFAULT_BONUS_SETTINGS: TimelineBonusSettings = {
    fieldIndex: DEFAULT_PARAMETER.fieldIndex,
    favoriteType: [...DEFAULT_PARAMETER.favoriteType] as TimelineFavoriteTypes,
    expertEffect: DEFAULT_PARAMETER.expertEffect,
    fieldBonus: DEFAULT_PARAMETER.fieldBonus,
    isGoodCampTicketSet: DEFAULT_PARAMETER.isGoodCampTicketSet,
    event: DEFAULT_PARAMETER.event,
    customEventBonus: loadHelpEventBonus(DEFAULT_PARAMETER.customEventBonus),
    recipeBonus: DEFAULT_PARAMETER.recipeBonus,
    recipeLevel: DEFAULT_PARAMETER.recipeLevel,
};

const RECIPE_BONUS_OPTIONS = new Set([0, 19, 20, 21, 25, 35, 48, 61, 78]);

function isExpertEffect(value: unknown): value is ExpertEffects {
    return value === 'berry' || value === 'ing' || value === 'skill';
}

function toFavoriteTypeArray(value: unknown, fallback: TimelineFavoriteTypes): TimelineFavoriteTypes {
    if (!Array.isArray(value) || value.length !== 3) {
        return [...fallback] as TimelineFavoriteTypes;
    }
    const sanitized = value.map((type, index) => {
        if (typeof type === 'string' && PokemonTypes.includes(type as PokemonType)) {
            return type as PokemonType;
        }
        return fallback[index];
    });
    return [sanitized[0], sanitized[1], sanitized[2]];
}

function fillMissingFavoriteTypes(types: (PokemonType | null | undefined)[]): TimelineFavoriteTypes {
    const next = [...types];
    for (let i = 0; i < next.length; i += 1) {
        const cur = next[i];
        if (cur && PokemonTypes.includes(cur)) {
            continue;
        }
        next[i] = PokemonTypes.find(type => !next.includes(type)) ?? 'normal';
    }
    return [next[0]!, next[1]!, next[2]!];
}

function normalizeFavoriteTypesForEvent(settings: TimelineBonusSettings): TimelineBonusSettings {
    const eventBonus = getEventBonus(settings.event, settings.customEventBonus);
    const fixedAreas = eventBonus?.fixedAreas ?? [];
    const fixedBerries = (eventBonus?.fixedBerries ?? []) as (PokemonType | null | undefined)[];

    if (!fixedAreas.includes(settings.fieldIndex) || fixedBerries.length !== 3) {
        return settings;
    }

    const merged: (PokemonType | null | undefined)[] = [...settings.favoriteType];
    for (let i = 0; i < 3; i += 1) {
        if (fixedBerries[i] && PokemonTypes.includes(fixedBerries[i] as PokemonType)) {
            merged[i] = fixedBerries[i] as PokemonType;
        }
    }

    return {
        ...settings,
        favoriteType: fillMissingFavoriteTypes(merged),
    };
}

/**
 * StrengthParameter から TeamTimeline 用のボーナス設定を抽出する。
 */
export function strengthParameterToTimelineBonusSettings(parameter: StrengthParameter): TimelineBonusSettings {
    const settings: TimelineBonusSettings = {
        fieldIndex: parameter.fieldIndex,
        favoriteType: [...parameter.favoriteType] as TimelineFavoriteTypes,
        expertEffect: parameter.expertEffect,
        fieldBonus: parameter.fieldBonus,
        isGoodCampTicketSet: parameter.isGoodCampTicketSet,
        event: parameter.event,
        customEventBonus: loadHelpEventBonus(parameter.customEventBonus),
        recipeBonus: parameter.recipeBonus,
        recipeLevel: parameter.recipeLevel,
    };
    return normalizeTimelineBonusSettings(settings);
}

/**
 * TeamTimeline 用のボーナス設定を正規化する。
 */
export function normalizeTimelineBonusSettings(
    input: Partial<TimelineBonusSettings>
): TimelineBonusSettings {
    const normalized: TimelineBonusSettings = {
        fieldIndex: Number.isInteger(input.fieldIndex)
            ? Math.max(MIN_FIELD_INDEX, Math.min(MAX_FIELD_INDEX, input.fieldIndex as number))
            : DEFAULT_BONUS_SETTINGS.fieldIndex,
        favoriteType: toFavoriteTypeArray(input.favoriteType, DEFAULT_BONUS_SETTINGS.favoriteType),
        expertEffect: isExpertEffect(input.expertEffect) ? input.expertEffect : DEFAULT_BONUS_SETTINGS.expertEffect,
        fieldBonus: typeof input.fieldBonus === 'number'
            ? Math.min(100, Math.max(0, Math.floor(input.fieldBonus)))
            : DEFAULT_BONUS_SETTINGS.fieldBonus,
        isGoodCampTicketSet: typeof input.isGoodCampTicketSet === 'boolean'
            ? input.isGoodCampTicketSet
            : DEFAULT_BONUS_SETTINGS.isGoodCampTicketSet,
        event: typeof input.event === 'string' ? input.event : DEFAULT_BONUS_SETTINGS.event,
        customEventBonus: loadHelpEventBonus(input.customEventBonus),
        recipeBonus: typeof input.recipeBonus === 'number' && RECIPE_BONUS_OPTIONS.has(input.recipeBonus)
            ? input.recipeBonus
            : DEFAULT_BONUS_SETTINGS.recipeBonus,
        recipeLevel: typeof input.recipeLevel === 'number'
            ? Math.min(65, Math.max(1, Math.floor(input.recipeLevel)))
            : DEFAULT_BONUS_SETTINGS.recipeLevel,
    };

    return normalizeFavoriteTypesForEvent(normalized);
}

/**
 * TeamTimeline のボーナス設定を StrengthParameter へマージする。
 */
export function mergeTimelineBonusSettingsIntoStrengthParameter(
    base: StrengthParameter,
    settings: TimelineBonusSettings
): StrengthParameter {
    const normalized = normalizeTimelineBonusSettings(settings);
    return {
        ...base,
        fieldIndex: normalized.fieldIndex,
        favoriteType: [...normalized.favoriteType],
        expertEffect: normalized.expertEffect,
        fieldBonus: normalized.fieldBonus,
        isGoodCampTicketSet: normalized.isGoodCampTicketSet,
        event: normalized.event,
        customEventBonus: loadHelpEventBonus(normalized.customEventBonus),
        recipeBonus: normalized.recipeBonus,
        recipeLevel: normalized.recipeLevel,
    };
}

/**
 * TeamTimeline のボーナス設定から StrengthParameter を構築する。
 */
export function buildStrengthParameterFromTimelineBonusSettings(
    settings: TimelineBonusSettings
): StrengthParameter {
    return mergeTimelineBonusSettingsIntoStrengthParameter(
        loadStrengthParameter(),
        settings
    );
}

/**
 * TeamTimeline のデフォルトボーナス設定を取得する。
 */
export function createDefaultTimelineBonusSettings(): TimelineBonusSettings {
    return normalizeTimelineBonusSettings(DEFAULT_BONUS_SETTINGS);
}

/**
 * 個体値計算機（PstStrenghParam）から TeamTimeline 用設定を読み込む。
 */
export function loadTimelineBonusSettingsFromIvStorage(): TimelineBonusSettings {
    const parameter = loadStrengthParameter();
    return strengthParameterToTimelineBonusSettings(parameter);
}

/**
 * TeamTimeline 設定を個体値計算機（PstStrenghParam）へ即時反映する。
 * 個体値計算機の他パラメーターは保持したまま、対象項目のみ更新する。
 */
export function saveTimelineBonusSettingsToIvStorage(settings: TimelineBonusSettings): StrengthParameter {
    const currentParameter = loadStrengthParameter();
    const mergedParameter = mergeTimelineBonusSettingsIntoStrengthParameter(
        currentParameter,
        settings
    );
    localStorage.setItem(IV_PARAMETER_STORAGE_KEY, JSON.stringify(mergedParameter));
    return mergedParameter;
}
