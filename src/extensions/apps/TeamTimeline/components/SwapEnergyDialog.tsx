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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';

interface SwapEnergyDialogProps {
    open: boolean;
    pokemonName: string;
    pokemonIdForm?: number;
    defaultEnergy?: number;
    onConfirm: (energy: number) => void;
    onCancel: () => void;
}

export const SwapEnergyDialog: React.FC<SwapEnergyDialogProps> = ({
    open,
    pokemonName,
    pokemonIdForm,
    defaultEnergy = 100,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const [energy, setEnergy] = useState(defaultEnergy);

    useEffect(() => {
        if (open) {
            setEnergy(defaultEnergy);
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

    const handleConfirm = () => {
        onConfirm(energy);
    };

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>{t('TeamTimeline.set initial energy')}</DialogTitle>
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
                            inputProps={{ min: 0, max: 150, style: { width: 60 } }}
                        />
                    </Box>

                    <Slider
                        value={energy}
                        onChange={handleSliderChange}
                        min={0}
                        max={150}
                        marks={[
                            { value: 0, label: '0' },
                            { value: 100, label: '100' },
                            { value: 150, label: '150' },
                        ]}
                        sx={{ width: '90%' }}
                    />
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
