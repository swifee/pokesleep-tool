import { describe, expect, it } from 'vitest';
import {
    createIngredientBag,
    computeInitialIngredientAttributedEP,
    executeMealCooking,
} from './CookingSimulator';
import SeededRandom from './SeededRandom';

describe('CookingSimulator', () => {
    it('captures bag ingredients before cooking', () => {
        const bag = createIngredientBag({ apple: 7, egg: 4 });
        const random = new SeededRandom(12345);

        const { result } = executeMealCooking({
            bag,
            category: 'curry',
            recipeLevels: {},
            basePotCapacity: 7,
            isGoodCampTicket: false,
            cookingPowerUpBonus: 0,
            tastyChanceAccumulated: 0,
            fieldBonus: 0,
            eventBonus: 0,
            random,
            mealSlotId: 'meal-1',
            mealType: 'breakfast',
        });

        const beforeApple = result.bagIngredientsBeforeCooking?.find(ingredient => ingredient.name === 'apple');
        const beforeEgg = result.bagIngredientsBeforeCooking?.find(ingredient => ingredient.name === 'egg');

        expect(result.recipeName).toBe('specialAppleCurry');
        expect(beforeApple?.count).toBe(7);
        expect(beforeEgg?.count).toBe(4);
    });

    it('calculates initial ingredient attributed EP from cooking events', () => {
        const totalInitialIngredientEP = computeInitialIngredientAttributedEP([
            {
                mealSlotId: 'slot-1',
                mealType: 'breakfast',
                recipeName: 'recipeA',
                isGreatSuccess: false,
                cookingEP: 100,
                eBase: 100,
                eDisplay: 100,
                eFinal: 100,
                ingredientsUsed: [
                    {
                        name: 'apple',
                        count: 10,
                        pokemonAttribution: new Map(),
                        fromInitial: 4,
                    },
                ],
                remainingPotCapacity: 0,
                effectivePotCapacity: 30,
                tastyChancePercent: 10,
                cookingPowerUpBonusUsed: 0,
            },
            {
                mealSlotId: 'slot-2',
                mealType: 'lunch',
                recipeName: 'recipeB',
                isGreatSuccess: false,
                cookingEP: 300,
                eBase: 100,
                eDisplay: 100,
                eFinal: 100,
                ingredientsUsed: [
                    {
                        name: 'apple',
                        count: 6,
                        pokemonAttribution: new Map([[1, 6]]),
                        fromInitial: 0,
                    },
                ],
                remainingPotCapacity: 0,
                effectivePotCapacity: 30,
                tastyChancePercent: 10,
                cookingPowerUpBonusUsed: 0,
            },
        ]);

        expect(totalInitialIngredientEP).toBe(40);
    });
});
