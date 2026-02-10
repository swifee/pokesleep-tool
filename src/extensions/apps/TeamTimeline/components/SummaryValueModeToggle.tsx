import React from 'react';
import { styled } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { SummaryValueMode } from '../utils/SummaryValueModeUtils';

interface SummaryValueModeToggleProps {
    value: SummaryValueMode;
    onChange: (value: SummaryValueMode) => void;
    orientation?: 'horizontal' | 'vertical' | 'responsive';
}

const SummaryValueModeToggle = React.memo(({
    value,
    onChange,
    orientation = 'horizontal',
}: SummaryValueModeToggleProps) => {
    const { t } = useTranslation();

    return (
        <Container data-orientation={orientation}>
            <ModeButton
                type="button"
                data-active={value === 'periodTotal'}
                onClick={() => onChange('periodTotal')}
            >
                {t('TeamTimeline.value mode period total', '期間合計')}
            </ModeButton>
            <ModeButton
                type="button"
                data-active={value === 'dailyAverage'}
                onClick={() => onChange('dailyAverage')}
            >
                {t('TeamTimeline.value mode daily average', '1日平均')}
            </ModeButton>
        </Container>
    );
});

const Container = styled('div')({
    display: 'inline-flex',
    alignItems: 'stretch',
    border: '1px solid #a7b7d9',
    borderRadius: '999px',
    overflow: 'hidden',
    backgroundColor: '#fff',
    '&[data-orientation="vertical"]': {
        flexDirection: 'column',
        borderRadius: '8px',
        '& > button + button': {
            borderTop: '1px solid #a7b7d9',
            borderLeft: 'none',
        },
    },
    '&[data-orientation="responsive"]': {
        flexDirection: 'column',
        borderRadius: '8px',
        '& > button + button': {
            borderTop: '1px solid #a7b7d9',
            borderLeft: 'none',
        },
        '@media (max-width: 540px)': {
            flexDirection: 'row',
            borderRadius: '999px',
            '& > button + button': {
                borderTop: 'none',
                borderLeft: '1px solid #a7b7d9',
            },
        },
    },
});

const ModeButton = styled('button')({
    border: 'none',
    borderLeft: '1px solid #a7b7d9',
    backgroundColor: '#fff',
    color: '#234',
    fontSize: '10px',
    lineHeight: '13px',
    letterSpacing: '-0.5px',
    padding: '3px 8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    '&:first-of-type': {
        borderLeft: 'none',
    },
    '&[data-active="true"]': {
        backgroundColor: '#176eee',
        color: '#fff',
        fontWeight: 700,
    },
});

SummaryValueModeToggle.displayName = 'SummaryValueModeToggle';

export default SummaryValueModeToggle;
