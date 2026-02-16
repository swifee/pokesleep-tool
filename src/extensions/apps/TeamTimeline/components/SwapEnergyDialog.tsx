import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Slider,
    Box,
    Typography,
    Select,
    MenuItem,
    FormControl,
    FormControlLabel,
    Checkbox,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';

interface SwapEnergyDialogProps {
    open: boolean;
    pokemonName: string;
    pokemonIdForm?: number;
    defaultEnergy?: number;
    disableEnergySetting?: boolean;
    onConfirm: (energy: number, endSlotId?: string, endDayIndex?: number, repeat?: boolean) => void;
    onCancel: () => void;
    /** Available time slots for the "until" dropdown. Each slot has an original slotId, dayIndex, and display time. */
    availableEndSlots?: { slotId: string; dayIndex: number; time: string }[];
    /** The day index of the swap start (used to calculate relative day labels) */
    swapDayIndex?: number;
    /** Total simulation days */
    simulationDays?: number;
}

export const SwapEnergyDialog: React.FC<SwapEnergyDialogProps> = ({
    open,
    pokemonName,
    pokemonIdForm,
    defaultEnergy = 100,
    disableEnergySetting = false,
    onConfirm,
    onCancel,
    availableEndSlots = [],
    swapDayIndex = 0,
}) => {
    const { t } = useTranslation();
    const [energy, setEnergy] = useState(defaultEnergy);
    const [endSlotValue, setEndSlotValue] = useState<string>('');
    const [repeat, setRepeat] = useState(false);

    useEffect(() => {
        if (open) {
            setEnergy(defaultEnergy);
            setEndSlotValue('');
            setRepeat(false);
        }
    }, [open, defaultEnergy]);

    const handleSliderChange = (_: Event, newValue: number | number[]) => {
        setEnergy(newValue as number);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setEnergy(Math.max(0, Math.min(150, value)));
        }
    };

    // Determine whether the repeat checkbox should be enabled.
    // Enabled when "until" is not set OR the selected end slot is within ~24 hours (dayDiff <= 1).
    const isRepeatEnabled = (() => {
        if (!endSlotValue) return true;
        const parts = endSlotValue.split('__');
        const endDayIndex = parseInt(parts[1], 10);
        const dayDiff = endDayIndex - swapDayIndex;
        return dayDiff <= 1;
    })();

    // When repeat becomes disabled, uncheck it
    useEffect(() => {
        if (!isRepeatEnabled) {
            setRepeat(false);
        }
    }, [isRepeatEnabled]);

    const handleConfirm = () => {
        let endSlotId: string | undefined;
        let endDayIndex: number | undefined;
        if (endSlotValue) {
            const parts = endSlotValue.split('__');
            endSlotId = parts[0];
            endDayIndex = parseInt(parts[1], 10);
        }
        onConfirm(energy, endSlotId, endDayIndex, repeat || undefined);
    };

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>{t('TeamTimeline.swap settings', '入れ替え設定')}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: 1 }}>
                    {pokemonIdForm !== undefined && (
                        <PokemonIcon idForm={pokemonIdForm} size={64} />
                    )}
                    <Typography variant="subtitle1">{pokemonName}</Typography>

                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography>{t('TeamTimeline.energy')}:</Typography>
                        <TextField
                            value={energy}
                            onChange={handleInputChange}
                            type="number"
                            size="small"
                            disabled={disableEnergySetting}
                            inputProps={{ min: 0, max: 150, style: { width: 60 } }}
                        />
                    </Box>

                    <Slider
                        value={energy}
                        onChange={handleSliderChange}
                        disabled={disableEnergySetting}
                        min={0}
                        max={150}
                        marks={[
                            { value: 0, label: '0' },
                            { value: 100, label: '100' },
                            { value: 150, label: '150' },
                        ]}
                        sx={{ width: '90%' }}
                    />

                    {/* "Until" dropdown */}
                    {availableEndSlots.length > 0 && (
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FormControl size="small" sx={{ minWidth: 160, flex: 1 }}>
                                <Select
                                    value={endSlotValue}
                                    onChange={(e) => setEndSlotValue(e.target.value as string)}
                                    displayEmpty
                                    size="small"
                                    renderValue={(value) => {
                                        if (!value) {
                                            return t('TeamTimeline.swap until not set');
                                        }
                                        const parts = (value as string).split('__');
                                        const slotId = parts[0];
                                        const dayIndex = parseInt(parts[1], 10);
                                        const dayDiff = dayIndex - swapDayIndex;
                                        const slot = availableEndSlots.find(
                                            s => s.slotId === slotId && s.dayIndex === dayIndex
                                        );
                                        const time = slot?.time ?? '';
                                        if (dayDiff === 0) {
                                            return time;
                                        }
                                        return `${t('TeamTimeline.swap next day prefix', { count: dayDiff })}${time}`;
                                    }}
                                >
                                    <MenuItem value="">
                                        {t('TeamTimeline.swap until not set')}
                                    </MenuItem>
                                    {availableEndSlots.map((slot) => {
                                        const dayDiff = slot.dayIndex - swapDayIndex;
                                        const encodedValue = `${slot.slotId}__${slot.dayIndex}`;
                                        const label = dayDiff === 0
                                            ? slot.time
                                            : `${t('TeamTimeline.swap next day prefix', { count: dayDiff })}${slot.time}`;
                                        return (
                                            <MenuItem key={encodedValue} value={encodedValue}>
                                                {label}
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                            <Typography variant="body2">
                                {t('TeamTimeline.swap until suffix')}
                            </Typography>
                        </Box>
                    )}

                    {/* "Repeat" checkbox */}
                    {availableEndSlots.length > 0 && (
                        <Box sx={{ width: '100%' }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={repeat}
                                        onChange={(e) => setRepeat(e.target.checked)}
                                        disabled={!isRepeatEnabled}
                                        size="small"
                                    />
                                }
                                label={t('TeamTimeline.swap repeat')}
                            />
                        </Box>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{t('cancel')}</Button>
                <Button onClick={handleConfirm} variant="contained" color="primary">
                    {t('TeamTimeline.confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
