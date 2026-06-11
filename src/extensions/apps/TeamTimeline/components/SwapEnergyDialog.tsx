import {
	Box,
	Button,
	Checkbox,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControlLabel,
	Slider,
	TextField,
	Typography,
} from "@mui/material";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PokemonIcon from "../../../../ui/IvCalc/PokemonIcon";

interface SwapEnergyDialogProps {
	open: boolean;
	pokemonName: string;
	pokemonIdForm?: number;
	pokemonShiny?: boolean;
	defaultEnergy?: number;
	disableEnergySetting?: boolean;
	onConfirm: (energy: number, repeat?: boolean) => void;
	onCancel: () => void;
}

export const SwapEnergyDialog: React.FC<SwapEnergyDialogProps> = ({
	open,
	pokemonName,
	pokemonIdForm,
	pokemonShiny = false,
	defaultEnergy = 100,
	disableEnergySetting = false,
	onConfirm,
	onCancel,
}) => {
	const { t } = useTranslation();
	const [energy, setEnergy] = useState(defaultEnergy);
	const [repeat, setRepeat] = useState(false);

	useEffect(() => {
		if (open) {
			setEnergy(defaultEnergy);
			setRepeat(false);
		}
	}, [open, defaultEnergy]);

	const handleSliderChange = (_: Event, newValue: number | number[]) => {
		setEnergy(newValue as number);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseInt(e.target.value, 10);
		if (!Number.isNaN(value)) {
			setEnergy(Math.max(0, Math.min(150, value)));
		}
	};

	const handleConfirm = () => {
		onConfirm(energy, repeat || undefined);
	};

	return (
		<Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
			<DialogTitle>
				{t("TeamTimeline.swap settings", "入れ替え設定")}
			</DialogTitle>
			<DialogContent>
				<Box
					sx={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 2,
						pt: 1,
					}}
				>
					{pokemonIdForm !== undefined && (
						<PokemonIcon
							idForm={pokemonIdForm}
							shiny={pokemonShiny}
							size={64}
						/>
					)}
					<Typography variant="subtitle1">{pokemonName}</Typography>

					<Box
						sx={{
							width: "100%",
							display: "flex",
							alignItems: "center",
							gap: 2,
						}}
					>
						<Typography>{t("TeamTimeline.energy")}:</Typography>
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
							{ value: 0, label: "0" },
							{ value: 100, label: "100" },
							{ value: 150, label: "150" },
						]}
						sx={{ width: "90%" }}
					/>

					<Box sx={{ width: "100%" }}>
						<FormControlLabel
							control={
								<Checkbox
									checked={repeat}
									onChange={(e) => setRepeat(e.target.checked)}
									size="small"
								/>
							}
							label={t("TeamTimeline.swap repeat")}
						/>
					</Box>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={onCancel}>{t("cancel")}</Button>
				<Button onClick={handleConfirm} variant="contained" color="primary">
					{t("TeamTimeline.confirm")}
				</Button>
			</DialogActions>
		</Dialog>
	);
};
