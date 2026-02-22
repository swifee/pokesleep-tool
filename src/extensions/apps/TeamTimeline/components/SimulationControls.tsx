import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import fields, { getFavoriteBerries, isExpertField } from '../../../../data/fields';
import {
  allFavoriteFieldIndex,
  noFavoriteFieldIndex,
} from '../../../../util/PokemonStrength';
import { CookingCategory } from '../types/CookingTypes';
import { TRIAL_COUNT_OPTIONS } from '../types/MultiTrialTypes';
import { TimelineBonusSettings } from '../types/TimelineBonusSettingsTypes';

interface SimulationControlsProps {
  bonusSettings: TimelineBonusSettings;
  fieldIndex: number;
  isGoodCampTicketSet: boolean;
  cookingSimEnabled: boolean;
  cookingCategory: CookingCategory;
  eventName: string;
  seedMode: 'random' | 'fixed';
  seed: number;
  simulationDays: number;
  multiTrialCount: number;
  simulationLoading: boolean;
  simulationProgress: number;
  isTeamEmpty: boolean;
  onFieldIndexChange: (fieldIndex: number) => void;
  onGoodCampTicketChange: (enabled: boolean) => void;
  onCookingSimEnabledChange: (enabled: boolean) => void;
  onCookingCategoryChange: (category: CookingCategory) => void;
  onOpenSettingsTab: () => void;
  onSeedModeChange: (mode: 'random' | 'fixed') => void;
  onSeedChange: (seed: number) => void;
  onSimulationDaysChange: (days: number) => void;
  onTrialCountChange: (count: number) => void;
  onRunSimulation: () => void;
}

const CONTROL_LABEL_STYLE = {
  fontSize: '10px',
  lineHeight: '13px',
  letterSpacing: '-0.5px',
};

const CONTROL_VALUE_STYLE = {
  fontSize: '12px',
  lineHeight: '15px',
  letterSpacing: '-0.48px',
};

const COMPACT_CONTROL_WIDTH = '70px';
const COMPACT_CONTROL_RADIUS = '6px';

const CONTROLS_PANEL_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  boxSizing: 'border-box',
  gap: '6px',
  mb: '8px',
  px: '6px',
  pt: '5px',
  pb: '8px',
  borderRadius: COMPACT_CONTROL_RADIUS,
  backgroundColor: '#fff',
};

const PROGRESS_TRACK_BACKGROUND = '#94bffc';

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  bonusSettings,
  fieldIndex,
  isGoodCampTicketSet,
  cookingSimEnabled,
  cookingCategory,
  eventName,
  seedMode,
  seed,
  simulationDays,
  multiTrialCount,
  simulationLoading,
  simulationProgress,
  isTeamEmpty,
  onCookingSimEnabledChange,
  onCookingCategoryChange,
  onOpenSettingsTab,
  onSeedModeChange,
  onSeedChange,
  onSimulationDaysChange,
  onTrialCountChange,
  onRunSimulation,
}) => {
  const { t } = useTranslation();
  const clampedProgress = Math.max(0, Math.min(100, simulationProgress));
  const eventLabel = eventName === 'none'
    ? t('no event', 'イベントなし')
    : eventName === 'custom'
      ? `${t('event', 'イベント')}: ${t('events.advanced', '詳細設定')}`
      : t(`events.${eventName}`, eventName);
  const selectedField = fieldIndex >= 0
    ? fields.find((field) => field.index === fieldIndex)
    : undefined;
  const favoriteTypeLabels = React.useMemo(() => {
    if (fieldIndex < 0) {
      return [];
    }
    const fixedBerries = getFavoriteBerries(fieldIndex);
    const favoriteTypes = fixedBerries.length === 3
      ? fixedBerries
      : bonusSettings.favoriteType;
    return favoriteTypes.map((type) => t(`types.${type}`, type));
  }, [bonusSettings.favoriteType, fieldIndex, t]);
  const expertEffectLabel = React.useMemo(() => {
    if (!isExpertField(fieldIndex)) {
      return null;
    }
    if (bonusSettings.expertEffect === 'ing') {
      return t('expert ing effect', '食材+1');
    }
    if (bonusSettings.expertEffect === 'skill') {
      return t('expert skill effect', 'スキル 1.25倍');
    }
    return t('expert berry effect', 'きのみエナジー2.4倍');
  }, [bonusSettings.expertEffect, fieldIndex, t]);
  const fieldLabel = React.useMemo(() => {
    if (fieldIndex === noFavoriteFieldIndex) {
      return t('no favorite berries', 'きのみ得意なし');
    }
    if (fieldIndex === allFavoriteFieldIndex) {
      return t('all favorite berries', '全きのみ得意');
    }
    if (!selectedField) {
      return t('research area', 'フィールド');
    }
    const details = expertEffectLabel
      ? [...favoriteTypeLabels, expertEffectLabel]
      : favoriteTypeLabels;
    const areaLabel = t(`area.${selectedField.index}`, selectedField.name);
    return details.length > 0
      ? `${areaLabel}(${details.join('/')})`
      : areaLabel;
  }, [expertEffectLabel, favoriteTypeLabels, fieldIndex, selectedField, t]);
  const campTicketLabel = `${t('good camp ticket (short)', 'キャンチケ')}${t(
    isGoodCampTicketSet ? 'on' : 'off',
    isGoodCampTicketSet ? 'ON' : 'OFF'
  )}`;

  const handleCookingSimToggle = (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    onCookingSimEnabledChange(typeof checked === 'boolean' ? checked : event.target.checked);
  };

  const handleCookingCategoryChange = (event: { target: { value: unknown } }) => {
    onCookingCategoryChange(String(event.target.value) as CookingCategory);
  };
  const renderCookingCategoryValue = (value: unknown) => {
    if (value === 'curry') {
      return t('TeamTimeline.simulation cooking category curry short', 'カレー');
    }
    if (value === 'dessert') {
      return t('TeamTimeline.simulation cooking category dessert short', 'デザート');
    }
    return t('TeamTimeline.cooking salad', 'サラダ');
  };

  const handleSeedModeToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSeedModeChange(event.target.checked ? 'fixed' : 'random');
  };

  const handleSeedInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(event.target.value, 10);
    if (!Number.isNaN(value)) {
      onSeedChange(value);
    }
  };

  const handleTrialCountChange = (event: { target: { value: unknown } }) => {
    onTrialCountChange(Number(event.target.value));
  };

  const handleSimulationDaysChange = (event: { target: { value: unknown } }) => {
    onSimulationDaysChange(Number(event.target.value));
  };

  return (
    <Box sx={CONTROLS_PANEL_STYLE} data-testid="simulation-controls-panel">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <Typography sx={{ ...CONTROL_LABEL_STYLE, whiteSpace: 'nowrap' }} data-testid="field-summary-text">
            {fieldLabel}
          </Typography>
          <Typography sx={{ ...CONTROL_LABEL_STYLE, whiteSpace: 'nowrap' }} data-testid="camp-ticket-summary-text">
            {campTicketLabel}
          </Typography>
          <Typography sx={{ ...CONTROL_LABEL_STYLE, whiteSpace: 'nowrap' }} data-testid="event-summary-text">
            {eventLabel}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onOpenSettingsTab}
          data-testid="event-settings-button"
          aria-label={t('TeamTimeline.open settings', '設定を開く')}
          sx={{ p: '2px' }}
        >
          <SettingsIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <FormControlLabel
          sx={{ m: 0 }}
          labelPlacement="start"
          control={(
            <Switch
              checked={cookingSimEnabled}
              onChange={handleCookingSimToggle}
              size="small"
              inputProps={{ 'aria-label': 'cooking-sim-switch' }}
            />
          )}
          label={(
            <Typography sx={{ ...CONTROL_LABEL_STYLE, whiteSpace: 'nowrap' }}>
              {t('TeamTimeline.simulation cooking short', '料理')}
            </Typography>
          )}
        />

        <Select
          value={cookingCategory}
          onChange={handleCookingCategoryChange}
          renderValue={renderCookingCategoryValue}
          data-testid="cooking-category-select"
          disabled={!cookingSimEnabled}
          size="small"
          sx={{
            width: COMPACT_CONTROL_WIDTH,
            height: '20px',
            '& .MuiSelect-select': {
              ...CONTROL_VALUE_STYLE,
              py: '1px',
              pl: '5px',
              pr: '18px !important',
            },
            '& .MuiSelect-icon': {
              right: '2px',
              fontSize: '18px',
            },
          }}
        >
          <MenuItem value="curry" sx={CONTROL_VALUE_STYLE}>
            {t('TeamTimeline.cooking curry', 'カレー・シチュー')}
          </MenuItem>
          <MenuItem value="salad" sx={CONTROL_VALUE_STYLE}>
            {t('TeamTimeline.cooking salad', 'サラダ')}
          </MenuItem>
          <MenuItem value="dessert" sx={CONTROL_VALUE_STYLE}>
            {t('TeamTimeline.cooking dessert', 'デザート・ドリンク')}
          </MenuItem>
        </Select>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '72px' }}>
          <Typography sx={CONTROL_LABEL_STYLE}>
            {t('TeamTimeline.simulation days', '集計期間')}
          </Typography>
          <Select
            value={simulationDays}
            onChange={handleSimulationDaysChange}
            data-testid="simulation-days-select"
            size="small"
            sx={{
              width: COMPACT_CONTROL_WIDTH,
              height: '20px',
              '& .MuiSelect-select': {
                ...CONTROL_VALUE_STYLE,
                py: '1px',
                pl: '5px',
                pr: '18px !important',
              },
              '& .MuiSelect-icon': {
                right: '2px',
                fontSize: '18px',
              },
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <MenuItem key={day} value={day} sx={CONTROL_VALUE_STYLE}>
                {t('TeamTimeline.days unit', '{{count}}日', { count: day })}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '72px' }}>
          <Typography sx={CONTROL_LABEL_STYLE}>試行回数</Typography>
          <Select
            value={multiTrialCount}
            onChange={handleTrialCountChange}
            data-testid="trial-count-select"
            size="small"
            sx={{
              width: COMPACT_CONTROL_WIDTH,
              height: '20px',
              '& .MuiSelect-select': {
                ...CONTROL_VALUE_STYLE,
                py: '1px',
                pl: '5px',
                pr: '18px !important',
              },
              '& .MuiSelect-icon': {
                right: '2px',
                fontSize: '18px',
              },
            }}
          >
            {TRIAL_COUNT_OPTIONS.map((count) => (
              <MenuItem key={count} value={count} sx={CONTROL_VALUE_STYLE}>
                {count.toLocaleString()}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '76px' }}>
          <FormControlLabel
            sx={{ m: 0, gap: '1px' }}
            labelPlacement="end"
            control={(
              <Checkbox
                checked={seedMode === 'fixed'}
                onChange={handleSeedModeToggle}
                size="small"
                sx={{ p: 0, color: '#9e9e9e', '&.Mui-checked': { color: '#62d540' } }}
              />
            )}
            label={(
              <Typography sx={CONTROL_LABEL_STYLE}>
                {t('TeamTimeline.seed fixed', 'シード値')}
              </Typography>
            )}
          />
          <TextField
            type="number"
            value={seed}
            onChange={handleSeedInputChange}
            disabled={seedMode === 'random'}
            size="small"
            sx={{
              width: '63px',
              '& .MuiInputBase-root': {
                borderRadius: COMPACT_CONTROL_RADIUS,
                height: '20px',
              },
              '& input': {
                ...CONTROL_LABEL_STYLE,
                color: '#303030',
                px: '6px',
                py: '2px',
              },
            }}
            inputProps={{ min: 0, step: 1 }}
          />
        </Box>

        <Button
          variant="contained"
          onClick={onRunSimulation}
          disabled={isTeamEmpty}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={simulationLoading ? clampedProgress : undefined}
          sx={{
            width: '136px',
            minWidth: '136px',
            height: '34px',
            borderRadius: '6px',
            fontSize: '12px',
            lineHeight: '15px',
            fontWeight: 700,
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            background: simulationLoading ? PROGRESS_TRACK_BACKGROUND : '#3c8af8',
            transition: 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: simulationLoading ? `${clampedProgress}%` : '100%',
              background: 'linear-gradient(180deg, #4e8ce8 0%, #176eee 100%)',
              transition: simulationLoading && clampedProgress > 0 ? 'width 140ms linear' : 'none',
              zIndex: 0,
            },
            '& .button-label': {
              position: 'relative',
              zIndex: 1,
              whiteSpace: 'nowrap',
            },
            '&.Mui-disabled': {
              color: '#fff',
              background: '#93afe3',
              opacity: 1,
            },
            '&.Mui-disabled::before': {
              width: simulationLoading ? `${clampedProgress}%` : '100%',
            },
          }}
        >
          <span className="button-label">
            {t('TeamTimeline.run simulation', 'シミュレーション')}
          </span>
        </Button>
      </Box>
    </Box>
  );
};

export default SimulationControls;
