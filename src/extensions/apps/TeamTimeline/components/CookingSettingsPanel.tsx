import React, { useState, useCallback } from 'react';
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
import {
    CookingSimulationSettings,
    CookingCategory,
    DEFAULT_RECIPE_LEVEL,
} from '../types/CookingTypes';
import { getRecipesByCategory } from '../data/RecipeData';
import { IngredientNames, IngredientName } from '../../../../data/pokemons';
import IngredientIcon from '../../../../ui/IvCalc/IngredientIcon';

interface CookingSettingsPanelProps {
    settings: CookingSimulationSettings;
    onChange: (settings: CookingSimulationSettings) => void;
}

const MIN_POT_CAPACITY = 12;
const MAX_POT_CAPACITY = 99;
const POT_CAPACITY_STEP = 3;
const MIN_RECIPE_LEVEL = 1;
const MAX_RECIPE_LEVEL = 65;

const POT_CAPACITY_OPTIONS = Array.from(
    { length: ((MAX_POT_CAPACITY - MIN_POT_CAPACITY) / POT_CAPACITY_STEP) + 1 },
    (_, index) => MIN_POT_CAPACITY + (index * POT_CAPACITY_STEP),
);

function normalizePotCapacity(value: number): number {
    const clamped = Math.max(MIN_POT_CAPACITY, Math.min(MAX_POT_CAPACITY, Math.floor(value)));
    return clamped - (clamped % POT_CAPACITY_STEP);
}

function formatRecipeIngredientSummary(recipe: ReturnType<typeof getRecipesByCategory>[number]): string {
    const total = recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.count, 0);
    return `食材${total}`;
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

    const recipes = getRecipesByCategory(settings.category);
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
                        <label style={{ marginRight: '0.5rem' }}>
                            {t('TeamTimeline.cooking category short', '料理')}:
                        </label>
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
                            variant="outlined"
                            value={batchLevel}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!Number.isNaN(v)) {
                                    setBatchLevel(Math.max(MIN_RECIPE_LEVEL, Math.min(MAX_RECIPE_LEVEL, v)));
                                }
                            }}
                            inputProps={{ min: MIN_RECIPE_LEVEL, max: MAX_RECIPE_LEVEL }}
                            sx={{ width: '5rem' }}
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                        {recipes.map((recipe) => (
                            <Box
                                key={recipe.name}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '0.85rem',
                                }}
                                data-testid={`recipe-row-${recipe.name}`}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: 0.5,
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
                                            {formatRecipeIngredientSummary(recipe)}
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
                                    sx={{ width: '4rem', ml: 1 }}
                                    data-testid={`recipe-level-input-${recipe.name}`}
                                />
                            </Box>
                        ))}
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    {/* 5. Initial ingredients section */}
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t('TeamTimeline.cooking initial ingredients', '初期食材')}
                    </Typography>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                            gap: 0.5,
                        }}
                        data-testid="cooking-initial-ingredients"
                    >
                        {IngredientNames.map((ingredientName) => (
                            <Box
                                key={ingredientName}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '0.85rem',
                                }}
                            >
                                <Box
                                    sx={{ display: 'inline-flex', alignItems: 'center' }}
                                    data-testid={`ingredient-icon-${ingredientName}`}
                                    title={ingredientName}
                                >
                                    <IngredientIcon name={ingredientName} />
                                </Box>
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
                                    sx={{ width: '4rem', ml: 1 }}
                                    data-testid={`ingredient-input-${ingredientName}`}
                                />
                            </Box>
                        ))}
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{ mt: 1, display: 'block', color: '#666' }}
                        data-testid="cooking-initial-ingredients-total"
                    >
                        入力値合計: {initialIngredientTotal.toLocaleString()}
                    </Typography>
                </Box>
            )}
        </Box>
    );
});

CookingSettingsPanel.displayName = 'CookingSettingsPanel';

export default CookingSettingsPanel;
