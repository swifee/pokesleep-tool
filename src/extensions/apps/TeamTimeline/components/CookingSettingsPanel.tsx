import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    TextField,
    Select,
    MenuItem,
    Tabs,
    Tab,
    Switch,
    FormControlLabel,
    Button,
    Divider,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
    CookingSimulationSettings,
    CookingCategory,
    DEFAULT_RECIPE_LEVEL,
} from '../types/CookingTypes';
import { getRecipesByCategory } from '../data/RecipeData';
import { ingredientStrength } from '../../../../util/PokemonRp';
import { IngredientNames, IngredientName } from '../../../../data/pokemons';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';
import TeamTimelineIcon from './TimelineIcons';

interface CookingSettingsPanelProps {
    settings: CookingSimulationSettings;
    onChange: (settings: CookingSimulationSettings) => void;
}

const MIN_POT_CAPACITY = 12;
const MAX_POT_CAPACITY = 99;
const POT_CAPACITY_STEP = 3;
const MIN_RECIPE_LEVEL = 1;
const MAX_RECIPE_LEVEL = 65;
const LEVEL_INPUT_STEP = 1;
const INGREDIENT_INPUT_STEP = 5;
const NUMERIC_INPUT_WIDTH = '5ch';
const NUMERIC_TEXT_FIELD_SX = {
    width: NUMERIC_INPUT_WIDTH,
    '& .MuiInputBase-input': {
        textAlign: 'center',
    },
    '& input[type=number]': {
        MozAppearance: 'textfield',
    },
    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
        WebkitAppearance: 'none',
        margin: 0,
    },
};
const STEP_BUTTON_SX = {
    minWidth: '1.5rem',
    width: '1.5rem',
    height: '1.5rem',
    px: 0,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    border: 'none',
    boxShadow: 'none',
    backgroundColor: 'transparent',
    color: 'inherit',
    '& .step-button-circle': {
        width: '1.2rem',
        height: '1.2rem',
        borderRadius: '50%',
        backgroundColor: '#b3b3b3',
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.95rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    '&:hover': {
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
    },
    '&:hover .step-button-circle': {
        backgroundColor: '#999999',
    },
};
const STEP_BUTTON_SYMBOL_SX = {
    display: 'block',
    lineHeight: 1,
    transform: 'translate(0.4px, -0.6px)',
};
const LOCK_ICON_ON_COLOR = '#e89a00';
const LOCK_ICON_OFF_COLOR = '#c8c8c8';
const LOCK_TOGGLE_BUTTON_SX = {
    minWidth: '1.5rem',
    width: '1.5rem',
    height: '1.5rem',
    p: 0,
    border: 'none',
    boxShadow: 'none',
    backgroundColor: 'transparent',
    lineHeight: 1,
    '&:hover': {
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
    },
};

const POT_CAPACITY_OPTIONS = Array.from(
    { length: ((MAX_POT_CAPACITY - MIN_POT_CAPACITY) / POT_CAPACITY_STEP) + 1 },
    (_, index) => MIN_POT_CAPACITY + (index * POT_CAPACITY_STEP),
);

function normalizePotCapacity(value: number): number {
    const clamped = Math.max(MIN_POT_CAPACITY, Math.min(MAX_POT_CAPACITY, Math.floor(value)));
    return clamped - (clamped % POT_CAPACITY_STEP);
}

function getRecipeIngredientTotal(recipe: ReturnType<typeof getRecipesByCategory>[number]): number {
    return recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.count, 0);
}

function getRecipeLevel1BaseEnergy(recipe: ReturnType<typeof getRecipesByCategory>[number]): number {
    const rawStrength = recipe.ingredients.reduce((sum, ingredient) => {
        return sum + (ingredientStrength[ingredient.name] * ingredient.count);
    }, 0);
    return Math.round(rawStrength * (1 + recipe.recipeBonus));
}

const RECIPE_ICON_SIZE_PX = 12;

const CookingSettingsPanel = React.memo(({ settings, onChange }: CookingSettingsPanelProps) => {
    const { t } = useTranslation();
    const [batchLevel, setBatchLevel] = useState<number>(DEFAULT_RECIPE_LEVEL);
    const [recipeLevelDrafts, setRecipeLevelDrafts] = useState<Record<string, string>>({});

    const handleEnabledChange = useCallback((_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        onChange({ ...settings, enabled: checked });
    }, [settings, onChange]);

    const handleCategoryChange = useCallback((_: React.SyntheticEvent, value: CookingCategory) => {
        onChange({ ...settings, category: value });
    }, [settings, onChange]);

    const handlePotCapacityChange = useCallback((event: { target: { value: unknown } }) => {
        const value = parseInt(String(event.target.value), 10);
        if (Number.isNaN(value)) return;
        onChange({ ...settings, basePotCapacity: normalizePotCapacity(value) });
    }, [settings, onChange]);

    const handleRecipeLevelChange = useCallback((recipeName: string, level: number) => {
        const clamped = Math.max(MIN_RECIPE_LEVEL, Math.min(MAX_RECIPE_LEVEL, level));
        onChange({
            ...settings,
            recipeLevels: { ...settings.recipeLevels, [recipeName]: clamped },
        });
    }, [settings, onChange]);

    const handleRecipeLevelInputChange = useCallback((recipeName: string, rawValue: string) => {
        setRecipeLevelDrafts((prev) => ({ ...prev, [recipeName]: rawValue }));
        if (rawValue.trim() === '') {
            return;
        }
        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) {
            return;
        }
        handleRecipeLevelChange(recipeName, parsed);
    }, [handleRecipeLevelChange]);

    const handleRecipeLevelInputBlur = useCallback((recipeName: string) => {
        setRecipeLevelDrafts((prev) => {
            const rawValue = prev[recipeName];
            if (rawValue == null) {
                return prev;
            }

            if (rawValue.trim() !== '') {
                const parsed = Number.parseInt(rawValue, 10);
                if (!Number.isNaN(parsed)) {
                    handleRecipeLevelChange(recipeName, parsed);
                }
            }

            const rest = { ...prev };
            delete rest[recipeName];
            return rest;
        });
    }, [handleRecipeLevelChange]);

    const handleRecipeLevelStep = useCallback((recipeName: string, delta: number) => {
        const draftValue = recipeLevelDrafts[recipeName];
        const draftParsed = draftValue == null || draftValue.trim() === ''
            ? Number.NaN
            : Number.parseInt(draftValue, 10);
        const current = Number.isNaN(draftParsed)
            ? (settings.recipeLevels[recipeName] ?? DEFAULT_RECIPE_LEVEL)
            : draftParsed;

        handleRecipeLevelChange(recipeName, current + delta);
        setRecipeLevelDrafts((prev) => {
            if (prev[recipeName] == null) {
                return prev;
            }
            const rest = { ...prev };
            delete rest[recipeName];
            return rest;
        });
    }, [handleRecipeLevelChange, recipeLevelDrafts, settings.recipeLevels]);

    const handleBatchSet = useCallback(() => {
        const recipes = getRecipesByCategory(settings.category);
        const newLevels = { ...settings.recipeLevels };
        for (const recipe of recipes) {
            newLevels[recipe.name] = Math.max(MIN_RECIPE_LEVEL, Math.min(MAX_RECIPE_LEVEL, batchLevel));
        }
        onChange({ ...settings, recipeLevels: newLevels });
    }, [settings, onChange, batchLevel]);

    const handleIngredientChange = useCallback((ingredientName: IngredientName, count: number) => {
        const clamped = Math.max(0, Math.floor(count));
        onChange({
            ...settings,
            initialIngredients: { ...settings.initialIngredients, [ingredientName]: clamped },
        });
    }, [settings, onChange]);

    const handleIngredientStep = useCallback((ingredientName: IngredientName, delta: number) => {
        const current = settings.initialIngredients[ingredientName] ?? 0;
        handleIngredientChange(ingredientName, current + delta);
    }, [handleIngredientChange, settings.initialIngredients]);

    const handleRecipeDisabledToggle = useCallback((recipeName: string) => {
        const nextDisabledRecipes = {
            ...settings.disabledRecipes,
            [recipeName]: !(settings.disabledRecipes[recipeName] === true),
        };
        onChange({
            ...settings,
            disabledRecipes: nextDisabledRecipes,
        });
    }, [settings, onChange]);

    const handleExtraIngredientDisabledToggle = useCallback((ingredientName: IngredientName) => {
        const nextDisabledExtraIngredients = {
            ...settings.disabledExtraIngredients,
            [ingredientName]: !(settings.disabledExtraIngredients[ingredientName] === true),
        };
        onChange({
            ...settings,
            disabledExtraIngredients: nextDisabledExtraIngredients,
        });
    }, [settings, onChange]);

    const recipes = useMemo(() => {
        return [...getRecipesByCategory(settings.category)].sort((a, b) => {
            const baseEnergyDiff = getRecipeLevel1BaseEnergy(b) - getRecipeLevel1BaseEnergy(a);
            if (baseEnergyDiff !== 0) {
                return baseEnergyDiff;
            }
            return a.name.localeCompare(b.name);
        });
    }, [settings.category]);
    const initialIngredientTotal = IngredientNames.reduce((sum, ingredientName) => {
        return sum + (settings.initialIngredients[ingredientName] ?? 0);
    }, 0);

    return (
        <Box
            data-testid="cooking-settings-panel"
            sx={{
                border: '1px solid #e1e1e1',
                borderRadius: '8px',
                p: '10px 12px',
                mb: 2,
            }}
        >
            {/* 1. Cooking simulation toggle */}
            <FormControlLabel
                control={
                    <Switch
                        checked={settings.enabled}
                        onChange={handleEnabledChange}
                        data-testid="cooking-enabled-toggle"
                    />
                }
                label={t('TeamTimeline.cooking simulate', '料理をシミュレート')}
            />

            {settings.enabled && (
                <Box sx={{ mt: 1 }}>
                    {/* 2. Base pot capacity */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, fontSize: '0.9rem' }}>
                        <label style={{ marginRight: 'auto' }}>
                            {t('TeamTimeline.cooking pot capacity', '鍋の基礎容量')}:
                        </label>
                        <Select
                            size="small"
                            variant="standard"
                            value={settings.basePotCapacity}
                            onChange={handlePotCapacityChange}
                            sx={{ minWidth: '6rem' }}
                            data-testid="cooking-pot-capacity-select"
                        >
                            {POT_CAPACITY_OPTIONS.map((capacity) => (
                                <MenuItem key={capacity} value={capacity}>{capacity}</MenuItem>
                            ))}
                        </Select>
                    </Box>

                    {/* 3. Cooking category selector */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, fontSize: '0.9rem' }}>
                        <Tabs
                            value={settings.category}
                            onChange={handleCategoryChange}
                            sx={{ minHeight: '32px' }}
                            data-testid="cooking-category-tabs"
                        >
                            <Tab
                                label={t('TeamTimeline.cooking curry', 'カレー・シチュー')}
                                value="curry"
                                sx={{ minHeight: '32px', minWidth: '64px', px: 1.5 }}
                                data-testid="cooking-category-tab-curry"
                            />
                            <Tab
                                label={t('TeamTimeline.cooking salad', 'サラダ')}
                                value="salad"
                                sx={{ minHeight: '32px', minWidth: '64px', px: 1.5 }}
                                data-testid="cooking-category-tab-salad"
                            />
                            <Tab
                                label={t('TeamTimeline.cooking dessert', 'デザート・ドリンク')}
                                value="dessert"
                                sx={{ minHeight: '32px', minWidth: '64px', px: 1.5 }}
                                data-testid="cooking-category-tab-dessert"
                            />
                        </Tabs>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    {/* 4. Recipe levels section */}
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t('TeamTimeline.cooking recipe levels', 'レシピレベル')}
                    </Typography>

                    {/* Batch set */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <TextField
                            type="number"
                            size="small"
                            variant="standard"
                            value={batchLevel}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!Number.isNaN(v)) {
                                    setBatchLevel(Math.max(MIN_RECIPE_LEVEL, Math.min(MAX_RECIPE_LEVEL, v)));
                                }
                            }}
                            inputProps={{ min: MIN_RECIPE_LEVEL, max: MAX_RECIPE_LEVEL }}
                            sx={NUMERIC_TEXT_FIELD_SX}
                            data-testid="cooking-batch-level-input"
                        />
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleBatchSet}
                            data-testid="cooking-batch-set-button"
                        >
                            {t('TeamTimeline.cooking batch set', '一括設定')}
                        </Button>
                    </Box>

                    {/* Recipe list */}
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            mb: 1.5,
                            width: 'fit-content',
                            maxWidth: '100%',
                        }}
                        data-testid="recipe-level-list"
                    >
                        {recipes.map((recipe) => {
                            const isRecipeDisabled = settings.disabledRecipes[recipe.name] === true;
                            return (
                            <Box
                                key={recipe.name}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                                    alignItems: 'center',
                                    columnGap: 0.35,
                                    rowGap: 0.15,
                                    fontSize: '0.85rem',
                                    width: '100%',
                                }}
                                data-testid={`recipe-row-${recipe.name}`}
                            >
                                <Box sx={{ minWidth: 0, maxWidth: 'min(100%, 22rem)' }}>
                                    <Box
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            columnGap: 0.4,
                                            rowGap: 0.05,
                                            lineHeight: 1.1,
                                        }}
                                    >
                                        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '15rem' }}>
                                            {t(`TeamTimeline.recipe ${recipe.name}`, recipe.name)}
                                        </Box>
                                        <Box
                                            component="span"
                                            sx={{ color: '#666', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
                                            data-testid={`recipe-ingredients-${recipe.name}`}
                                        >
                                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.15 }}>
                                                <TeamTimelineIcon
                                                    name="cooking"
                                                    sx={{
                                                        fontSize: `${RECIPE_ICON_SIZE_PX}px`,
                                                        color: 'inherit',
                                                        '& path, & rect': {
                                                            fill: 'currentColor',
                                                        },
                                                    }}
                                                    data-testid={`recipe-ingredients-cooking-icon-${recipe.name}`}
                                                />
                                                <Box component="span">{getRecipeIngredientTotal(recipe)}</Box>
                                            </Box>
                                            <Box component="span">(</Box>
                                            {recipe.ingredients.map((ingredient) => (
                                                <Box
                                                    key={`${recipe.name}-${ingredient.name}`}
                                                    component="span"
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.2,
                                                        '& svg': {
                                                            width: `${RECIPE_ICON_SIZE_PX}px`,
                                                            height: `${RECIPE_ICON_SIZE_PX}px`,
                                                        },
                                                    }}
                                                    data-testid={`recipe-ingredient-icon-${recipe.name}-${ingredient.name}`}
                                                >
                                                    <IngredientIcon name={ingredient.name} />
                                                    {ingredient.count}
                                                </Box>
                                            ))}
                                            <Box component="span">)</Box>
                                        </Box>
                                    </Box>
                                </Box>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'auto auto auto auto',
                                        alignItems: 'center',
                                        columnGap: 0.35,
                                    }}
                                    data-testid={`recipe-level-controls-${recipe.name}`}
                                >
                                    <Button
                                        variant="text"
                                        size="small"
                                        disableElevation
                                        sx={{
                                            ...LOCK_TOGGLE_BUTTON_SX,
                                            color: isRecipeDisabled ? LOCK_ICON_ON_COLOR : LOCK_ICON_OFF_COLOR,
                                        }}
                                        onClick={() => handleRecipeDisabledToggle(recipe.name)}
                                        data-testid={`recipe-lock-toggle-${recipe.name}`}
                                        title={t('TeamTimeline.cooking recipe lock', 'この料理を作成しない')}
                                        aria-label={t('TeamTimeline.cooking recipe lock', 'この料理を作成しない')}
                                    >
                                        <LockOutlinedIcon sx={{ fontSize: '1.1rem' }} />
                                    </Button>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        disableElevation
                                        sx={STEP_BUTTON_SX}
                                        onClick={() => handleRecipeLevelStep(recipe.name, -LEVEL_INPUT_STEP)}
                                        data-testid={`recipe-level-decrement-${recipe.name}`}
                                    >
                                        <Box component="span" className="step-button-circle">
                                            <Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>-</Box>
                                        </Box>
                                    </Button>
                                    <TextField
                                        type="number"
                                        size="small"
                                        variant="standard"
                                        value={recipeLevelDrafts[recipe.name] ?? String(settings.recipeLevels[recipe.name] ?? DEFAULT_RECIPE_LEVEL)}
                                        onChange={(e) => {
                                            handleRecipeLevelInputChange(recipe.name, e.target.value);
                                        }}
                                        onBlur={() => handleRecipeLevelInputBlur(recipe.name)}
                                        inputProps={{ min: MIN_RECIPE_LEVEL, max: MAX_RECIPE_LEVEL }}
                                        sx={NUMERIC_TEXT_FIELD_SX}
                                        data-testid={`recipe-level-input-${recipe.name}`}
                                    />
                                    <Button
                                        variant="contained"
                                        size="small"
                                        disableElevation
                                        sx={STEP_BUTTON_SX}
                                        onClick={() => handleRecipeLevelStep(recipe.name, LEVEL_INPUT_STEP)}
                                        data-testid={`recipe-level-increment-${recipe.name}`}
                                    >
                                        <Box component="span" className="step-button-circle">
                                            <Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>+</Box>
                                        </Box>
                                    </Button>
                                </Box>
                            </Box>
                            );
                        })}
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.2, color: '#666' }}
                        data-testid="cooking-recipe-lock-note"
                    >
                        <LockOutlinedIcon
                            sx={{ fontSize: '1.1rem', color: LOCK_ICON_ON_COLOR }}
                            data-testid="cooking-recipe-lock-note-icon"
                        />
                        ：その料理を作成しないようにする
                    </Typography>

                    <Divider sx={{ my: 1.5 }} />

                    {/* 5. Initial ingredients section */}
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t('TeamTimeline.cooking initial ingredients', '初期食材')}
                    </Typography>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                            gap: 0.5,
                        }}
                        data-testid="cooking-initial-ingredients"
                    >
                        {IngredientNames.map((ingredientName) => {
                            const isExtraIngredientDisabled = settings.disabledExtraIngredients[ingredientName] === true;
                            return (
                            <Box
                                key={ingredientName}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '0.85rem',
                                }}
                            >
                                <Button
                                    variant="text"
                                    size="small"
                                    disableElevation
                                    sx={{
                                        ...LOCK_TOGGLE_BUTTON_SX,
                                        color: isExtraIngredientDisabled ? LOCK_ICON_ON_COLOR : LOCK_ICON_OFF_COLOR,
                                        mr: 0.3,
                                    }}
                                    onClick={() => handleExtraIngredientDisabledToggle(ingredientName)}
                                    data-testid={`ingredient-extra-lock-toggle-${ingredientName}`}
                                    title={t('TeamTimeline.cooking ingredient extra lock', '追加食材として使わない')}
                                    aria-label={t('TeamTimeline.cooking ingredient extra lock', '追加食材として使わない')}
                                >
                                    <LockOutlinedIcon sx={{ fontSize: '1.1rem' }} />
                                </Button>
                                <Box
                                    sx={{ display: 'inline-flex', alignItems: 'center' }}
                                    data-testid={`ingredient-icon-${ingredientName}`}
                                    title={ingredientName}
                                >
                                    <IngredientIcon name={ingredientName} />
                                </Box>
                                <Button
                                    variant="contained"
                                    size="small"
                                    disableElevation
                                    sx={{ ...STEP_BUTTON_SX, ml: 0.5 }}
                                    onClick={() => handleIngredientStep(ingredientName, -INGREDIENT_INPUT_STEP)}
                                    data-testid={`ingredient-decrement-${ingredientName}`}
                                >
                                    <Box component="span" className="step-button-circle">
                                        <Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>-</Box>
                                    </Box>
                                </Button>
                                <TextField
                                    type="number"
                                    size="small"
                                    variant="standard"
                                    value={settings.initialIngredients[ingredientName] ?? 0}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        if (!Number.isNaN(v)) {
                                            handleIngredientChange(ingredientName, v);
                                        }
                                    }}
                                    inputProps={{ min: 0 }}
                                    sx={NUMERIC_TEXT_FIELD_SX}
                                    data-testid={`ingredient-input-${ingredientName}`}
                                />
                                <Button
                                    variant="contained"
                                    size="small"
                                    disableElevation
                                    sx={STEP_BUTTON_SX}
                                    onClick={() => handleIngredientStep(ingredientName, INGREDIENT_INPUT_STEP)}
                                    data-testid={`ingredient-increment-${ingredientName}`}
                                >
                                    <Box component="span" className="step-button-circle">
                                        <Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>+</Box>
                                    </Box>
                                </Button>
                            </Box>
                            );
                        })}
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{ mt: 1, display: 'block', color: '#666' }}
                        data-testid="cooking-initial-ingredients-total"
                    >
                        入力値合計: {initialIngredientTotal.toLocaleString()}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.2, color: '#666' }}
                        data-testid="cooking-extra-ingredient-lock-note"
                    >
                        <LockOutlinedIcon
                            sx={{ fontSize: '1.1rem', color: LOCK_ICON_ON_COLOR }}
                            data-testid="cooking-extra-ingredient-lock-note-icon"
                        />
                        ：追加食材として使用しないようにする
                    </Typography>
                </Box>
            )}
        </Box>
    );
});

CookingSettingsPanel.displayName = 'CookingSettingsPanel';

export default CookingSettingsPanel;
