import React from 'react';
import { Box, Button, Slide, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ResimulationNoticeBarProps {
    open: boolean;
    onResimulate: () => void;
}

const ResimulationNoticeBar = React.memo(({ open, onResimulate }: ResimulationNoticeBarProps) => {
    const { t } = useTranslation();

    return (
        <Slide direction="up" in={open} mountOnEnter unmountOnExit>
            <Box
                data-testid="resimulation-notice-bar"
                sx={{
                    position: 'fixed',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    px: '10px',
                    pb: '10px',
                    zIndex: 1300,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }}
            >
                <Box
                    sx={{
                        width: 'min(680px, calc(100% - 8px))',
                        border: '2px solid #176eee',
                        borderRadius: '10px',
                        backgroundColor: '#fff',
                        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.14)',
                        px: '10px',
                        py: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        pointerEvents: 'auto',
                    }}
                >
                    <Typography sx={{ fontSize: '12px', lineHeight: '15px', letterSpacing: '-0.48px' }}>
                        {t('TeamTimeline.resimulation changed notice', 'メンバー編成が変更されました。')}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={onResimulate}
                        sx={{
                            minWidth: '124px',
                            height: '28px',
                            borderRadius: '8px',
                            px: '10px',
                            py: 0,
                            fontSize: '12px',
                            lineHeight: '15px',
                            letterSpacing: '-0.48px',
                            whiteSpace: 'nowrap',
                            background: 'linear-gradient(180deg, #4e8ce8 0%, #176eee 100%)',
                        }}
                    >
                        {t('TeamTimeline.resimulate', '再シミュレーション')}
                    </Button>
                </Box>
            </Box>
        </Slide>
    );
});

ResimulationNoticeBar.displayName = 'ResimulationNoticeBar';

export default ResimulationNoticeBar;
