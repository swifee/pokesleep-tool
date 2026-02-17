import { describe, expect, it } from 'vitest';
import {
    createIngredientBag,
    computeInitialIngredientAttributedEP,
    executeMealCooking,
    planExtraIngredientsByEvent,
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

    it('advances tasty chain even when no recipe is available', () => {
        const bag = createIngredientBag({});
        const random = new SeededRandom(20260216);

        const { result, newTastyChanceAccumulated } = executeMealCooking({
            bag,
            category: 'curry',
            recipeLevels: {},
            basePotCapacity: 12,
            isGoodCampTicket: false,
            cookingPowerUpBonus: 0,
            tastyChanceAccumulated: 90,
            fieldBonus: 0,
            eventBonus: 0,
            random,
            mealSlotId: 'meal-skip',
            mealType: 'dinner',
        });

        expect(result.recipeName).toBeNull();
        expect(result.cookingEP).toBe(0);
        expect(result.isGreatSuccess).toBe(true);
        expect(newTastyChanceAccumulated).toBe(0);
    });

    it('plans extra ingredients with future-time constraints', () => {
        const plan = planExtraIngredientsByEvent([
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
                        count: 8,
                        pokemonAttribution: new Map(),
                        fromInitial: 0,
                    },
                ],
                remainingPotCapacity: 5,
                effectivePotCapacity: 20,
                tastyChancePercent: 10,
                cookingPowerUpBonusUsed: 0,
                bagIngredientsBeforeCooking: [
                    { name: 'apple', count: 10 },
                ],
            },
            {
                mealSlotId: 'slot-2',
                mealType: 'lunch',
                recipeName: 'recipeB',
                isGreatSuccess: false,
                cookingEP: 100,
                eBase: 100,
                eDisplay: 100,
                eFinal: 100,
                ingredientsUsed: [
                    {
                        name: 'apple',
                        count: 2,
                        pokemonAttribution: new Map(),
                        fromInitial: 0,
                    },
                ],
                remainingPotCapacity: 5,
                effectivePotCapacity: 20,
                tastyChancePercent: 10,
                cookingPowerUpBonusUsed: 0,
                bagIngredientsBeforeCooking: [
                    { name: 'apple', count: 2 },
                ],
            },
        ]);

        expect(plan[0]).toEqual([]);
        expect(plan[1]).toEqual([]);
    });

    it('prioritizes higher base-energy ingredients for extra allocation', () => {
        const plan = planExtraIngredientsByEvent([
            {
                mealSlotId: 'slot-1',
                mealType: 'breakfast',
                recipeName: 'recipeA',
                isGreatSuccess: false,
                cookingEP: 100,
                eBase: 100,
                eDisplay: 100,
                eFinal: 100,
                ingredientsUsed: [],
                remainingPotCapacity: 3,
                effectivePotCapacity: 20,
                tastyChancePercent: 10,
                cookingPowerUpBonusUsed: 0,
                bagIngredientsBeforeCooking: [
                    { name: 'apple', count: 5 },
                    { name: 'mushroom', count: 5 },
                ],
            },
        ]);

        expect(plan[0]?.[0]?.name).toBe('mushroom');
        expect(plan[0]?.[0]?.count).toBe(3);
    });

    it('includes extra ingredients in initial ingredient attributed EP', () => {
        const totalInitialIngredientEP = computeInitialIngredientAttributedEP([
            {
                mealSlotId: 'slot-1',
                mealType: 'breakfast',
                recipeName: 'recipeA',
                isGreatSuccess: false,
                cookingEP: 120,
                eBase: 100,
                eDisplay: 100,
                eFinal: 100,
                ingredientsUsed: [
                    {
                        name: 'apple',
                        count: 10,
                        pokemonAttribution: new Map([[1, 10]]),
                        fromInitial: 0,
                    },
                ],
                extraIngredientsUsed: [
                    {
                        name: 'milk',
                        count: 10,
                        pokemonAttribution: new Map(),
                        fromInitial: 10,
                    },
                ],
                remainingPotCapacity: 0,
                effectivePotCapacity: 30,
                tastyChancePercent: 10,
                cookingPowerUpBonusUsed: 0,
            },
        ]);

        expect(totalInitialIngredientEP).toBeCloseTo(62.55, 2);
    });
});
