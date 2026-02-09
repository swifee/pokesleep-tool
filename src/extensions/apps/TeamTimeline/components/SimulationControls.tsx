import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { TRIAL_COUNT_OPTIONS } from '../types/MultiTrialTypes';

interface SimulationControlsProps {
  seedMode: 'random' | 'fixed';
  seed: number;
  simulationDays: number;
  multiTrialCount: number;
  simulationLoading: boolean;
  isTeamEmpty: boolean;
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

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  seedMode,
  seed,
  simulationDays,
  multiTrialCount,
  simulationLoading,
  isTeamEmpty,
  onSeedModeChange,
  onSeedChange,
  onSimulationDaysChange,
  onTrialCountChange,
  onRunSimulation,
}) => {
  const { t } = useTranslation();

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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '6px',
        mb: '8px',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '72px' }}>
        <Typography sx={CONTROL_LABEL_STYLE}>
          {t('TeamTimeline.simulation days', '集計期間')}
        </Typography>
        <Select
          value={simulationDays}
          onChange={handleSimulationDaysChange}
          size="small"
          sx={{
            width: '70px',
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
          size="small"
          sx={{
            width: '70px',
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
          label={
            <Typography sx={CONTROL_LABEL_STYLE}>
              {t('TeamTimeline.seed fixed', 'シード値')}
            </Typography>
          }
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
              borderRadius: '6px',
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
        disabled={simulationLoading || isTeamEmpty}
        sx={{
          minWidth: '120px',
          height: '34px',
          borderRadius: '6px',
          fontSize: '12px',
          lineHeight: '15px',
          fontWeight: 700,
          background: 'linear-gradient(180deg, #4e8ce8 0%, #176eee 100%)',
        }}
      >
        {simulationLoading
          ? t('TeamTimeline.simulating', '計算中...')
          : t('TeamTimeline.run simulation', 'シミュレーション')}
      </Button>
    </Box>
  );
};

export default SimulationControls;
