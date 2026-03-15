import React from 'react';
import { Box, Button, Slide, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import TeamTimelineIcon from './TimelineIcons';

export interface ResimulationDeltaSummary {
    averageTotalEP: number;
    totalDeltaEP: number;
    berryDeltaEP: number;
    skillDeltaEP: number;
    cookingDeltaEP: number;
}

interface ResimulationNoticeBarProps {
    open: boolean;
    mode?: 'notice' | 'result';
    deltaSummary?: ResimulationDeltaSummary | null;
    onResimulate: () => void;
    onUndo?: () => void;
    onClose?: () => void;
}

function formatSignedValue(value: number): string {
    const rounded = Math.round(value);
    const sign = rounded >= 0 ? '+' : '-';
    return `${sign}${Math.abs(rounded).toLocaleString()}`;
}

const ResimulationNoticeBar = React.memo(({
    open,
    mode = 'notice',
    deltaSummary = null,
    onResimulate,
    onUndo,
    onClose,
}: ResimulationNoticeBarProps) => {
    const { t } = useTranslation();
    const isResultMode = mode === 'result' && deltaSummary !== null;

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
                        alignItems: isResultMode ? 'flex-start' : 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        pointerEvents: 'auto',
                    }}
                >
                    {isResultMode ? (
                        <>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                    data-testid="resimulation-result-total"
                                    sx={{
                                        fontSize: '12px',
                                        lineHeight: '15px',
                                        letterSpacing: '-0.48px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {`${t('TeamTimeline.resimulation result total label', 'total')} ${
                                        Math.round(deltaSummary.averageTotalEP).toLocaleString()
                                    }EP (${formatSignedValue(deltaSummary.totalDeltaEP)})`}
                                </Typography>
                                <Typography
                                    component="div"
                                    data-testid="resimulation-result-breakdown"
                                    sx={{
                                        mt: '3px',
                                        fontSize: '11px',
                                        lineHeight: '14px',
                                        letterSpacing: '-0.45px',
                                        color: '#2f4f7f',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        flexWrap: 'wrap',
                                        '& svg': {
                                            width: '12px',
                                            height: '12px',
                                        },
                                    }}
                                >
                                    <Box
                                        component="span"
                                        sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                        data-testid="resimulation-result-item-berry"
                                    >
                                        <TeamTimelineIcon
                                            name="berry"
                                            data-testid="resimulation-result-icon-berry"
                                        />
                                        {formatSignedValue(deltaSummary.berryDeltaEP)}
                                    </Box>
                                    <Box
                                        component="span"
                                        sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                        data-testid="resimulation-result-item-skill"
                                    >
                                        <TeamTimelineIcon
                                            name="skill"
                                            data-testid="resimulation-result-icon-skill"
                                        />
                                        {formatSignedValue(deltaSummary.skillDeltaEP)}
                                    </Box>
                                    <Box
                                        component="span"
                                        sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                        data-testid="resimulation-result-item-cooking"
                                    >
                                        <TeamTimelineIcon
                                            name="cooking"
                                            data-testid="resimulation-result-icon-cooking"
                                        />
                                        {formatSignedValue(deltaSummary.cookingDeltaEP)}
                                    </Box>
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <Button
                                    variant="outlined"
                                    onClick={onUndo}
                                    sx={{
                                        minWidth: '72px',
                                        height: '28px',
                                        borderRadius: '8px',
                                        px: '10px',
                                        py: 0,
                                        fontSize: '12px',
                                        lineHeight: '15px',
                                        letterSpacing: '-0.48px',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {t('TeamTimeline.resimulation undo', '元に戻す')}
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={onClose}
                                    sx={{
                                        minWidth: '54px',
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
                                    {t('TeamTimeline.ok', 'OK')}
                                </Button>
                            </Box>
                        </>
                    ) : (
                        <>
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
                        </>
                    )}
                </Box>
            </Box>
        </Slide>
    );
});

ResimulationNoticeBar.displayName = 'ResimulationNoticeBar';

export default ResimulationNoticeBar;
