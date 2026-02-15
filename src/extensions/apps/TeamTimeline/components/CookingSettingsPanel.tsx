import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    TextField,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Button,
    Divider,
} from '@mui/material';
import { CookingSimulationSettings, CookingCategory } from '../types/CookingTypes';
import { getRecipesByCategory } from '../data/RecipeData';
import { IngredientNames, IngredientName } from '../../../../data/pokemons';

interface CookingSettingsPanelProps {
    settings: CookingSimulationSettings;
    onChange: (settings: CookingSimulationSettings) => void;
}

const MIN_POT_CAPACITY = 1;
const MAX_POT_CAPACITY = 999;
const MIN_RECIPE_LEVEL = 1;
const MAX_RECIPE_LEVEL = 65;

const INGREDIENT_LABELS: Partial<Record<IngredientName, string>> = {
    leek: 'ふといながねぎ',
    mushroom: 'あじわいキノコ',
    egg: 'とくせんエッグ',
    potato: 'ほっこりポテト',
    apple: 'とくせんリンゴ',
    herb: 'げきからハーブ',
    sausage: 'マメミート',
    milk: 'モーモーミルク',
    honey: 'あまいミツ',
    oil: 'ピュアなオイル',
    ginger: 'あったかジンジャー',
    tomato: 'うまみのもとトマト',
    cacao: 'リラックスカカオ',
    tail: 'おいしいシッポ',
    soy: 'ワカクサ大豆',
    corn: 'ワカクサコーン',
    coffee: 'あったかコーヒー',
    pumpkin: 'かぼちゃのみ',
    avocado: 'アボカドのみ',
};

const CookingSettingsPanel = React.memo(({ settings, onChange }: CookingSettingsPanelProps) => {
    const { t } = useTranslation();
    const [batchLevel, setBatchLevel] = useState<number>(1);

    const handleEnabledChange = useCallback((_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        onChange({ ...settings, enabled: checked });
    }, [settings, onChange]);

    const handleCategoryChange = useCallback((event: { target: { value: unknown } }) => {
        onChange({ ...settings, category: event.target.value as CookingCategory });
    }, [settings, onChange]);

    const handlePotCapacityChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value, 10);
        if (Number.isNaN(value)) return;
        const clamped = Math.max(MIN_POT_CAPACITY, Math.min(MAX_POT_CAPACITY, value));
        onChange({ ...settings, basePotCapacity: clamped });
    }, [settings, onChange]);

    const handleRecipeLevelChange = useCallback((recipeName: string, level: number) => {
        const clamped = Math.max(MIN_RECIPE_LEVEL, Math.min(MAX_RECIPE_LEVEL, level));
        onChange({
            ...settings,
            recipeLevels: { ...settings.recipeLevels, [recipeName]: clamped },
        });
    }, [settings, onChange]);

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
                    {/* 2. Cooking category selector */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, fontSize: '0.9rem' }}>
                        <label style={{ marginRight: 'auto' }}>
                            {t('TeamTimeline.cooking category', '今週の料理')}:
                        </label>
                        <Select
                            size="small"
                            variant="standard"
                            value={settings.category}
                            onChange={handleCategoryChange}
                            sx={{ minWidth: '11rem' }}
                            data-testid="cooking-category-select"
                        >
                            <MenuItem value="curry">
                                {t('TeamTimeline.cooking curry', 'カレー・シチュー')}
                            </MenuItem>
                            <MenuItem value="salad">
                                {t('TeamTimeline.cooking salad', 'サラダ')}
                            </MenuItem>
                            <MenuItem value="dessert">
                                {t('TeamTimeline.cooking dessert', 'デザート・ドリンク')}
                            </MenuItem>
                        </Select>
                    </Box>

                    {/* 3. Base pot capacity */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, fontSize: '0.9rem' }}>
                        <label style={{ marginRight: 'auto' }}>
                            {t('TeamTimeline.cooking pot capacity', '鍋の基礎容量')}:
                        </label>
                        <TextField
                            type="number"
                            size="small"
                            variant="standard"
                            value={settings.basePotCapacity}
                            onChange={handlePotCapacityChange}
                            inputProps={{ min: MIN_POT_CAPACITY, max: MAX_POT_CAPACITY }}
                            sx={{ width: '5rem' }}
                            data-testid="cooking-pot-capacity"
                        />
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
                                <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t(`TeamTimeline.recipe ${recipe.name}`, recipe.name)}
                                </Box>
                                <TextField
                                    type="number"
                                    size="small"
                                    variant="standard"
                                    value={settings.recipeLevels[recipe.name] ?? 1}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        if (!Number.isNaN(v)) {
                                            handleRecipeLevelChange(recipe.name, v);
                                        }
                                    }}
                                    inputProps={{ min: MIN_RECIPE_LEVEL, max: MAX_RECIPE_LEVEL }}
                                    sx={{ width: '4rem', ml: 1 }}
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
                            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
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
                                <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {INGREDIENT_LABELS[ingredientName] ?? ingredientName}
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
                </Box>
            )}
        </Box>
    );
});

CookingSettingsPanel.displayName = 'CookingSettingsPanel';

export default CookingSettingsPanel;
