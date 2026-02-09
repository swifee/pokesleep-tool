import React, { useEffect, useState } from 'react';
import { Box, IconButton, Slider, Typography } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from 'react-i18next';
import { TrialSummary } from '../types/MultiTrialTypes';

export interface TrialResultSelectorProps {
  results: readonly TrialSummary[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const TrialResultSelector = React.memo(({ results, selectedIndex, onSelect }: TrialResultSelectorProps) => {
  const { t } = useTranslation();
  const [localSliderValue, setLocalSliderValue] = useState<number>(selectedIndex);

  useEffect(() => {
    setLocalSliderValue(selectedIndex);
  }, [selectedIndex]);

  if (results.length <= 1) {
    return null;
  }

  const maxIndex = results.length - 1;

  const handlePrev = () => {
    if (selectedIndex <= 0) {
      return;
    }
    const nextIndex = selectedIndex - 1;
    setLocalSliderValue(nextIndex);
    onSelect(nextIndex);
  };

  const handleNext = () => {
    if (selectedIndex >= maxIndex) {
      return;
    }
    const nextIndex = selectedIndex + 1;
    setLocalSliderValue(nextIndex);
    onSelect(nextIndex);
  };

  const handleSliderChange = (_event: Event, value: number | number[]) => {
    setLocalSliderValue(value as number);
  };

  const handleSliderCommitted = (_event: React.SyntheticEvent | Event, value: number | number[]) => {
    onSelect(value as number);
  };

  return (
    <Box sx={{ mb: '10px', width: 'min(540px, 100%)' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: '#000',
          fontSize: '10px',
          lineHeight: '13px',
          letterSpacing: '-0.5px',
          mb: '2px',
        }}
      >
        <Typography component="span" sx={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
          {t('TeamTimeline.trial count prefix', '{{count}}回中、上から', {
            count: results.length,
          })}
        </Typography>
        <IconButton size="small" onClick={handlePrev} disabled={selectedIndex <= 0} sx={{ p: 0, mx: '2px' }}>
          <NavigateBeforeIcon sx={{ fontSize: '16px' }} />
        </IconButton>
        <Typography
          component="span"
          sx={{
            fontSize: '13px',
            fontWeight: 700,
            lineHeight: '13px',
            letterSpacing: '-0.65px',
            minWidth: '20px',
            textAlign: 'center',
          }}
        >
          {selectedIndex + 1}
        </Typography>
        <IconButton size="small" onClick={handleNext} disabled={selectedIndex >= maxIndex} sx={{ p: 0, mx: '2px' }}>
          <NavigateNextIcon sx={{ fontSize: '16px' }} />
        </IconButton>
        <Typography component="span" sx={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
          {t('TeamTimeline.trial count suffix', '番目の結果を表示中')}
        </Typography>
      </Box>
      <Slider
        value={localSliderValue}
        min={0}
        max={maxIndex}
        step={1}
        onChange={handleSliderChange}
        onChangeCommitted={handleSliderCommitted}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => {
          const ep = results[value]?.grandTotalEP;
          if (ep === undefined) {
            return `${value + 1}`;
          }
          return `${value + 1}: ${Math.round(ep).toLocaleString()}EP`;
        }}
      />
    </Box>
  );
});

TrialResultSelector.displayName = 'TrialResultSelector';

export default TrialResultSelector;
