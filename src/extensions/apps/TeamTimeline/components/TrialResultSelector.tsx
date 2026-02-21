import React, { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Link, Slider, Tooltip, Typography } from '@mui/material';
import type { SliderValueLabelProps } from '@mui/material/Slider';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from 'react-i18next';
import { TrialSummary } from '../types/MultiTrialTypes';
import EpValue from './EpValue';

export interface TrialResultSelectorProps {
  results: readonly TrialSummary[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const MIN_HISTOGRAM_BINS = 6;
const MAX_HISTOGRAM_BINS = 120;
const HISTOGRAM_BIN_GROWTH_RATE = 1.6;
const MIN_HISTOGRAM_BAR_HEIGHT_PERCENT = 2;
const HISTOGRAM_BAR_OVERLAP_PX = 1;
const DISTRIBUTION_CHART_HEIGHT_PX = 50;
const DISTRIBUTION_VISIBILITY_STORAGE_KEY = 'PstTeamTimelineDistributionVisible';
const EDGE_AWARE_TOOLTIP_PADDING_PX = 8;
const EDGE_AWARE_TOOLTIP_OFFSET_Y_PX = 8;

const EdgeAwareSliderValueLabel = React.memo(({ children, open, value }: SliderValueLabelProps) => (
  <Tooltip
    open={open}
    placement="top"
    title={value}
    disableFocusListener
    disableHoverListener
    disableTouchListener
    slotProps={{
      popper: {
        modifiers: [
          {
            name: 'flip',
            enabled: true,
            options: {
              padding: EDGE_AWARE_TOOLTIP_PADDING_PX,
              rootBoundary: 'viewport',
            },
          },
          {
            name: 'preventOverflow',
            enabled: true,
            options: {
              padding: EDGE_AWARE_TOOLTIP_PADDING_PX,
              rootBoundary: 'viewport',
            },
          },
          {
            name: 'offset',
            options: {
              offset: [0, EDGE_AWARE_TOOLTIP_OFFSET_Y_PX],
            },
          },
        ],
      },
      tooltip: {
        sx: {
          maxWidth: 'min(220px, calc(100vw - 16px))',
          whiteSpace: 'nowrap',
        },
      },
    }}
  >
    {children}
  </Tooltip>
));

EdgeAwareSliderValueLabel.displayName = 'EdgeAwareSliderValueLabel';

function resolveHistogramBinIndex(value: number, minValue: number, range: number, binCount: number): number {
  if (binCount <= 1 || range <= 0) {
    return 0;
  }

  const normalized = (value - minValue) / range;
  const rawIndex = Math.floor(normalized * (binCount - 1));
  return Math.max(0, Math.min(binCount - 1, rawIndex));
}

function resolveHistogramBinCount(trialCount: number): number {
  if (trialCount <= 1) {
    return 1;
  }

  const scaledBinCount = Math.round(Math.sqrt(trialCount) * HISTOGRAM_BIN_GROWTH_RATE);
  const clampedBinCount = Math.max(MIN_HISTOGRAM_BINS, Math.min(MAX_HISTOGRAM_BINS, scaledBinCount));
  return Math.min(trialCount, clampedBinCount);
}

function toDisplayBinIndex(rawBinIndex: number, binCount: number): number {
  return (binCount - 1) - rawBinIndex;
}

function loadDistributionVisibilityFromStorage(): boolean {
  try {
    const raw = window.localStorage.getItem(DISTRIBUTION_VISIBILITY_STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === '1';
  } catch {
    return true;
  }
}

function saveDistributionVisibilityToStorage(isVisible: boolean): void {
  try {
    window.localStorage.setItem(DISTRIBUTION_VISIBILITY_STORAGE_KEY, isVisible ? '1' : '0');
  } catch {
    // Ignore storage errors and keep in-memory behavior.
  }
}

const TrialResultSelector = React.memo(({ results, selectedIndex, onSelect }: TrialResultSelectorProps) => {
  const { t } = useTranslation();
  const [localSliderValue, setLocalSliderValue] = useState<number>(selectedIndex);
  const [showDistribution, setShowDistribution] = useState<boolean>(() => loadDistributionVisibilityFromStorage());

  useEffect(() => {
    setLocalSliderValue(selectedIndex);
  }, [selectedIndex]);

  const maxIndex = Math.max(results.length - 1, 0);
  const clampedSliderValue = Math.max(0, Math.min(localSliderValue, maxIndex));

  const histogram = useMemo(() => {
    if (results.length === 0) {
      return {
        bins: [0],
        maxBinCount: 0,
        minEp: 0,
        range: 0,
      };
    }

    const binCount = resolveHistogramBinCount(results.length);
    const bins = new Array<number>(binCount).fill(0);
    const epValues = results.map((result) => result.grandTotalEP);

    const minEp = Math.min(...epValues);
    const maxEp = Math.max(...epValues);
    const range = maxEp - minEp;

    epValues.forEach((ep) => {
      const rawBinIndex = resolveHistogramBinIndex(ep, minEp, range, binCount);
      const displayBinIndex = toDisplayBinIndex(rawBinIndex, binCount);
      bins[displayBinIndex] += 1;
    });

    const maxBinCount = bins.reduce((currentMax, count) => Math.max(currentMax, count), 0);
    return {
      bins,
      maxBinCount,
      minEp,
      range,
    };
  }, [results]);

  const selectedEp = results[clampedSliderValue]?.grandTotalEP;
  const selectedBinIndex = selectedEp === undefined
    ? -1
    : toDisplayBinIndex(
      resolveHistogramBinIndex(selectedEp, histogram.minEp, histogram.range, histogram.bins.length),
      histogram.bins.length
    );

  if (results.length <= 1) {
    return null;
  }

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

  const handleToggleDistribution = () => {
    setShowDistribution((previous) => {
      const next = !previous;
      saveDistributionVisibilityToStorage(next);
      return next;
    });
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
        <IconButton
          size="small"
          aria-label="previous-trial"
          onClick={handlePrev}
          disabled={selectedIndex <= 0}
          sx={{ p: 0, mx: '2px' }}
        >
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
        <IconButton
          size="small"
          aria-label="next-trial"
          onClick={handleNext}
          disabled={selectedIndex >= maxIndex}
          sx={{ p: 0, mx: '2px' }}
        >
          <NavigateNextIcon sx={{ fontSize: '16px' }} />
        </IconButton>
        <Typography component="span" sx={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
          {t('TeamTimeline.trial count suffix', '番目の結果を表示中')}
        </Typography>
        <Link
          component="button"
          type="button"
          underline="always"
          onClick={handleToggleDistribution}
          sx={{ ml: '6px', fontSize: 'inherit', lineHeight: 'inherit', verticalAlign: 'baseline' }}
        >
          {showDistribution
            ? t('TeamTimeline.hide distribution', '分布を閉じる')
            : t('TeamTimeline.show distribution', '分布を表示')}
        </Link>
      </Box>
      {showDistribution && (
        <Box
          data-testid="trial-distribution-chart"
          sx={{
            height: `${DISTRIBUTION_CHART_HEIGHT_PX}px`,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 0,
            border: '1px solid #d0d0d0',
            borderRadius: '4px',
            px: '4px',
            py: '4px',
            mb: '6px',
            backgroundColor: '#f5f5f5',
          }}
        >
          {histogram.bins.map((count, index) => {
            const heightPercent = histogram.maxBinCount > 0 ? (count / histogram.maxBinCount) * 100 : 0;
            return (
              <Box
                // Highlight the selected slider position's bin while keeping the whole distribution visible.
                key={`trial-distribution-${index}`}
                data-testid={`trial-distribution-bar-${index}`}
                data-active={index === selectedBinIndex ? 'true' : 'false'}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  ml: index === 0 ? 0 : `-${HISTOGRAM_BAR_OVERLAP_PX}px`,
                  height: count > 0 ? `${Math.max(heightPercent, MIN_HISTOGRAM_BAR_HEIGHT_PERCENT)}%` : '0%',
                  backgroundColor: index === selectedBinIndex ? '#1976d2' : '#9e9e9e',
                  borderRadius: 0,
                  position: 'relative',
                  zIndex: index === selectedBinIndex ? 1 : 0,
                  transition: 'background-color 120ms linear',
                }}
              />
            );
          })}
        </Box>
      )}
      <Box sx={{ px: '5px' }}>
        <Slider
          value={clampedSliderValue}
          min={0}
          max={maxIndex}
          step={1}
          onChange={handleSliderChange}
          onChangeCommitted={handleSliderCommitted}
          slots={{ valueLabel: EdgeAwareSliderValueLabel }}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => {
            const ep = results[value]?.grandTotalEP;
            if (ep === undefined) {
              return `${value + 1}`;
            }
            return (
              <>
                {value + 1}
                {': '}
                <EpValue value={Math.round(ep).toLocaleString()} />
              </>
            );
          }}
        />
      </Box>
    </Box>
  );
});

TrialResultSelector.displayName = 'TrialResultSelector';

export default TrialResultSelector;
