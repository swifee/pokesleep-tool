import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';

export interface SwapSupplementBarProps {
  swapCount: number;
  swappedPokemonIdForms: number[];
  onClear: () => void;
}

const CONTROL_BLOCK_WIDTH = 352;

const SwapSupplementBar = React.memo(({
  swapCount,
  swappedPokemonIdForms,
  onClear,
}: SwapSupplementBarProps) => {
  const { t } = useTranslation();

  if (swapCount <= 0) {
    return null;
  }

  return (
    <Box
      data-testid="swap-supplement-bar"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '6px',
        width: `${CONTROL_BLOCK_WIDTH}px`,
        minHeight: '30px',
        px: '8px',
        py: '5px',
        boxSizing: 'border-box',
        border: '2px solid #1976d2',
        borderRadius: '6px',
        backgroundColor: '#fff',
        mb: '13px',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <Typography
          sx={{
            fontSize: '12px',
            lineHeight: '15px',
            letterSpacing: '-0.48px',
            color: '#1976d2',
          }}
        >
          {t('TeamTimeline.swap configured notice', '途中でのポケモン入れ替えが設定されています。')}
        </Typography>
        <Button
          variant="contained"
          data-testid="swap-supplement-delete-button"
          onClick={onClear}
          sx={{
            minWidth: '44px',
            height: '22px',
            borderRadius: '8px',
            px: '10px',
            background: 'linear-gradient(180deg, #4e8ce8 0%, #176eee 100%)',
            fontSize: '12px',
            lineHeight: '15px',
            letterSpacing: '-0.48px',
            fontWeight: 400,
            flexShrink: 0,
          }}
        >
          {t('TeamTimeline.reset', 'リセット')}
        </Button>
      </Box>
      {swappedPokemonIdForms.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            alignItems: 'center',
            minHeight: '18px',
          }}
        >
          {swappedPokemonIdForms.map((idForm) => (
            <Box
              key={idForm}
              data-testid="swap-supplement-icon"
              sx={{
                width: '22px',
                height: '22px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #d0e0ff',
                backgroundColor: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PokemonIcon idForm={idForm} size={20} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});

SwapSupplementBar.displayName = 'SwapSupplementBar';

export default SwapSupplementBar;
