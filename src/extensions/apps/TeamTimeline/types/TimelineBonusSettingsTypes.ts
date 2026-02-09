import { HelpEventBonus } from '../../../../data/events';
import { PokemonType } from '../../../../data/pokemons';
import { ExpertEffects } from '../../../../util/PokemonStrength';

export type TimelineFavoriteTypes = [PokemonType, PokemonType, PokemonType];

/**
 * TeamTimeline 向けのボーナス設定。
 * 個体値計算機パラメーターのうち、TeamTimeline で利用する項目のみ保持する。
 */
export interface TimelineBonusSettings {
    fieldIndex: number;
    favoriteType: TimelineFavoriteTypes;
    expertEffect: ExpertEffects;
    fieldBonus: number;
    isGoodCampTicketSet: boolean;
    event: string;
    customEventBonus: HelpEventBonus;
    recipeBonus: number;
    recipeLevel: number;
}

