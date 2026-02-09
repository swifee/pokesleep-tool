import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface SwapSupplementBarProps {
  swapCount: number;
  onClear: () => void;
}

const CONTROL_BLOCK_WIDTH = 352;

const SwapSupplementBar = React.memo(({ swapCount, onClear }: SwapSupplementBarProps) => {
  const { t } = useTranslation();

  if (swapCount <= 0) {
    return null;
  }

  return (
    <Box
      data-testid="swap-supplement-bar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        }}
      >
        {t('TeamTimeline.delete', '削除')}
      </Button>
    </Box>
  );
});

SwapSupplementBar.displayName = 'SwapSupplementBar';

export default SwapSupplementBar;
