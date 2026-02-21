import React from 'react';
import { styled } from '@mui/system';
import {
    Box,
    Button,
    Collapse,
    FormControlLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Slider,
    Switch,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getActiveHelpBonus } from '../../../../data/events';
import { StrengthParameter } from '../../../../util/PokemonStrength';
import AreaControlGroup from '../../../../ui/IvCalc/Strength/AreaControlGroup';
import EventConfigDialog from '../../../../ui/IvCalc/Strength/EventConfigDialog';
import { TimelineBonusSettings } from '../types/TimelineBonusSettingsTypes';
import {
    buildStrengthParameterFromTimelineBonusSettings,
    strengthParameterToTimelineBonusSettings,
} from '../utils/TimelineBonusSettingsBridge';

interface TimelineBonusSettingsPanelProps {
    settings: TimelineBonusSettings;
    syncWithIvParameter: boolean;
    onSyncChange: (enabled: boolean) => void;
    onSettingsChange: (settings: TimelineBonusSettings) => void;
    cookingSimEnabled?: boolean;
}

const RECIPE_BONUS_OPTIONS = [0, 19, 20, 21, 25, 35, 48, 61, 78];

function toEventMenuItems(parameter: StrengthParameter, t: ReturnType<typeof useTranslation>['t']) {
    const activeEvents = getActiveHelpBonus(new Date())
        .map(event => event.name)
        .reverse();

    if (
        parameter.event !== 'none' &&
        parameter.event !== 'custom' &&
        !activeEvents.includes(parameter.event)
    ) {
        activeEvents.unshift(parameter.event);
    }

    return ['none', ...activeEvents, 'custom'].map(eventName => {
        const label = eventName === 'none'
            ? t('no event')
            : eventName === 'custom'
                ? `${t('event')}: ${t('events.advanced')}`
                : t(`events.${eventName}`);
        return (
            <MenuItem key={eventName} value={eventName} dense>
                {label}
            </MenuItem>
        );
    });
}

const TimelineBonusSettingsPanel = React.memo(({
    settings,
    syncWithIvParameter,
    onSyncChange,
    onSettingsChange,
    cookingSimEnabled,
}: TimelineBonusSettingsPanelProps) => {
    const { t } = useTranslation();
    const [eventConfigOpen, setEventConfigOpen] = React.useState(false);

    const parameter = React.useMemo(
        () => buildStrengthParameterFromTimelineBonusSettings(settings),
        [settings]
    );

    const eventMenuItems = React.useMemo(
        () => toEventMenuItems(parameter, t),
        [parameter, t]
    );

    const applyParameter = React.useCallback((next: StrengthParameter) => {
        onSettingsChange(strengthParameterToTimelineBonusSettings(next));
    }, [onSettingsChange]);

    const handleSyncChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        onSyncChange(event.target.checked);
    }, [onSyncChange]);

    const handleEventChange = React.useCallback((event: SelectChangeEvent<string>) => {
        applyParameter({
            ...parameter,
            event: event.target.value,
        });
    }, [applyParameter, parameter]);

    const handleRecipeBonusChange = React.useCallback((event: SelectChangeEvent<number>) => {
        applyParameter({
            ...parameter,
            recipeBonus: Number(event.target.value),
        });
    }, [applyParameter, parameter]);

    const handleRecipeLevelChange = React.useCallback((_: Event, value: number | number[]) => {
        const level = typeof value === 'number' ? value : value[0];
        applyParameter({
            ...parameter,
            recipeLevel: level,
        });
    }, [applyParameter, parameter]);

    return (
        <Container>
            <FormControlLabel
                control={<Switch checked={syncWithIvParameter} onChange={handleSyncChange} />}
                label={t('TeamTimeline.sync with iv settings', '個体値計算機の設定と連動')}
            />

            <SectionTitle variant="subtitle2">
                {t('TeamTimeline.bonus settings', 'ボーナス設定')}
            </SectionTitle>

            <AreaSection>
                <AreaControlGroup
                    value={parameter}
                    onChange={applyParameter}
                />
            </AreaSection>

            <SectionRow>
                <label>{t('event')}:</label>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Select
                        size="small"
                        variant="standard"
                        value={parameter.event}
                        onChange={handleEventChange}
                        sx={{ minWidth: '11rem' }}
                    >
                        {eventMenuItems}
                    </Select>
                    <Collapse in={parameter.event === 'custom'}>
                        <Button onClick={() => setEventConfigOpen(true)}>
                            {t('configure event details')}
                        </Button>
                    </Collapse>
                </Box>
            </SectionRow>

            <SectionRow>
                <label>{t('recipe bonus')}:</label>
                <Select
                    size="small"
                    variant="standard"
                    value={parameter.recipeBonus as number}
                    onChange={handleRecipeBonusChange}
                    sx={{ minWidth: '11rem' }}
                >
                    {RECIPE_BONUS_OPTIONS.map(option => (
                        <MenuItem key={option} value={option}>{option}%</MenuItem>
                    ))}
                </Select>
            </SectionRow>

            <SectionRow>
                <label>{t('average recipe level')}:</label>
                <SliderWrap>
                    <Slider
                        value={parameter.recipeLevel}
                        onChange={handleRecipeLevelChange}
                        min={1}
                        max={65}
                        step={1}
                        valueLabelDisplay="auto"
                    />
                    <Typography variant="body2">{parameter.recipeLevel}</Typography>
                </SliderWrap>
            </SectionRow>

            {cookingSimEnabled && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                    {t('TeamTimeline.cooking recipe bonus note', '※ 料理シミュレーションOFF時にのみ適用されます')}
                </Typography>
            )}

            <EventConfigDialog
                open={eventConfigOpen}
                onClose={() => setEventConfigOpen(false)}
                value={parameter}
                onChange={applyParameter}
            />
        </Container>
    );
});

const Container = styled('div')({
    border: '1px solid #e1e1e1',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '16px',
});

const SectionTitle = styled(Typography)({
    marginTop: '2px',
    marginBottom: '8px',
});

const AreaSection = styled('div')({
    '& section': {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '8px',
        fontSize: '0.9rem',
        '& > label': {
            marginRight: 'auto',
        },
    },
});

const SectionRow = styled('div')({
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '0.9rem',
    '& > label': {
        marginRight: 'auto',
    },
});

const SliderWrap = styled('div')({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '13rem',
    '& .MuiSlider-root': {
        flex: 1,
    },
});

export default TimelineBonusSettingsPanel;

