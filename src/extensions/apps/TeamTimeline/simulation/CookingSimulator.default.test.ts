import { describe, expect, it } from 'vitest';
import { createIngredientBag, selectBestRecipe } from './CookingSimulator';

describe('CookingSimulator defaults', () => {
    it('uses recipe level 50 when recipeLevels is unset', () => {
        const bag = createIngredientBag({ apple: 7 });
        const byDefault = selectBestRecipe('curry', bag, 7, {}, 0, 0);
        const byExplicitLevel = selectBestRecipe('curry', bag, 7, { specialAppleCurry: 50 }, 0, 0);

        expect(byDefault?.recipe.name).toBe('specialAppleCurry');
        expect(byDefault?.eDisplay).toBe(byExplicitLevel?.eDisplay);
    });
});
