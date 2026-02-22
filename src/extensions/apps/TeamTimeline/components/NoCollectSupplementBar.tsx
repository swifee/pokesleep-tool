import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';
import { NoCollectSupplementEntry } from '../utils/NoCollectSupplementUtils';

export interface NoCollectSupplementBarProps {
  noCollectCount: number;
  entries: NoCollectSupplementEntry[];
  onClear: () => void;
}

const NoCollectSupplementBar = React.memo(({
  noCollectCount,
  entries,
  onClear,
}: NoCollectSupplementBarProps) => {
  const { t } = useTranslation();

  if (noCollectCount <= 0) {
    return null;
  }

  return (
    <Box
      data-testid="no-collect-supplement-bar"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '2px',
        width: '100%',
        minHeight: '30px',
        px: '8px',
        py: '5px',
        boxSizing: 'border-box',
        mb: '13px',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
          gap: '4px',
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
          {t('TeamTimeline.no collect configured notice', '食材,きのみを回収しない設定がされています。')}
        </Typography>
        <Button
          variant="outlined"
          data-testid="no-collect-supplement-delete-button"
          onClick={onClear}
          sx={{
            minWidth: '40px',
            height: '18px',
            borderRadius: '8px',
            px: '8px',
            borderColor: '#1976d2',
            backgroundColor: '#fff',
            color: '#1976d2',
            fontSize: '10px',
            lineHeight: '12px',
            letterSpacing: '-0.48px',
            fontWeight: 400,
            flexShrink: 0,
            '&:hover': {
              borderColor: '#1976d2',
              backgroundColor: '#f4f8ff',
            },
          }}
        >
          {t('TeamTimeline.reset', 'リセット')}
        </Button>
      </Box>
      {entries.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '3px 9px',
            alignItems: 'flex-start',
            minHeight: '22px',
          }}
        >
          {entries.map((entry) => (
            <Box
              key={`no-collect-supplement-entry-${entry.pokemonId}`}
              data-testid="no-collect-supplement-entry"
              sx={{
                width: '28px',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5px',
              }}
            >
              <Box
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
                <PokemonIcon idForm={entry.pokemonIdForm} size={20} />
              </Box>
              <Typography
                data-testid="no-collect-supplement-count"
                sx={{
                  fontSize: '10px',
                  lineHeight: '12px',
                  letterSpacing: '-0.4px',
                  color: '#000',
                  whiteSpace: 'nowrap',
                }}
              >
                {`${entry.count}回`}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});

NoCollectSupplementBar.displayName = 'NoCollectSupplementBar';

export default NoCollectSupplementBar;
