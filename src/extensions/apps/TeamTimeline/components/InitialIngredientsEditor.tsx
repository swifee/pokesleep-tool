import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Button, Typography } from "@mui/material";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
	type IngredientName,
	IngredientNames,
} from "../../../../data/pokemons";
import IngredientIcon from "../../../../ui/IvCalc/IngredientIcon";
import type { CookingSimulationSettings } from "../types/CookingTypes";
import { getInitialIngredientTotal } from "../utils/InitialIngredientsUtils";
import {
	LOCK_ICON_OFF_COLOR,
	LOCK_ICON_ON_COLOR,
	LOCK_TOGGLE_BUTTON_SX,
	NUMERIC_TEXT_FIELD_SX,
	STEP_BUTTON_SX,
	STEP_BUTTON_SYMBOL_SX,
} from "./CookingSettingsStyles";
import DraftNumberField from "./DraftNumberField";

interface InitialIngredientsEditorProps {
	settings: CookingSimulationSettings;
	onChange: (settings: CookingSimulationSettings) => void;
	/** 見出し「初期食材」を表示するか（呼び出し側が見出しを持つときは false） */
	showTitle?: boolean;
}

const INGREDIENT_INPUT_STEP = 5;

/**
 * 料理シミュレーションの初期食材（ingredientName -> count）と
 * 「追加食材として使わない」設定を編集するエディタ。
 * 料理設定タブと簡易シミュタブの両方で使う。
 */
const InitialIngredientsEditor = React.memo(
	({ settings, onChange, showTitle = true }: InitialIngredientsEditorProps) => {
		const { t } = useTranslation();

		const handleIngredientChange = useCallback(
			(ingredientName: IngredientName, count: number) => {
				const clamped = Math.max(0, Math.floor(count));
				onChange({
					...settings,
					initialIngredients: {
						...settings.initialIngredients,
						[ingredientName]: clamped,
					},
				});
			},
			[settings, onChange],
		);

		const handleIngredientStep = useCallback(
			(ingredientName: IngredientName, delta: number) => {
				const current = settings.initialIngredients[ingredientName] ?? 0;
				handleIngredientChange(ingredientName, current + delta);
			},
			[handleIngredientChange, settings.initialIngredients],
		);

		const handleExtraIngredientDisabledToggle = useCallback(
			(ingredientName: IngredientName) => {
				const nextDisabledExtraIngredients = {
					...settings.disabledExtraIngredients,
					[ingredientName]: !(
						settings.disabledExtraIngredients[ingredientName] === true
					),
				};
				onChange({
					...settings,
					disabledExtraIngredients: nextDisabledExtraIngredients,
				});
			},
			[settings, onChange],
		);

		const initialIngredientTotal = getInitialIngredientTotal(settings);

		return (
			<>
				{showTitle && (
					<Typography variant="subtitle2" sx={{ mb: 1 }}>
						{t("TeamTimeline.cooking initial ingredients", "初期食材")}
					</Typography>
				)}

				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
						gap: 0.5,
					}}
					data-testid="cooking-initial-ingredients"
				>
					{IngredientNames.map((ingredientName) => {
						const isExtraIngredientDisabled =
							settings.disabledExtraIngredients[ingredientName] === true;
						return (
							<Box
								key={ingredientName}
								sx={{
									display: "flex",
									alignItems: "center",
									fontSize: "0.85rem",
								}}
							>
								<Button
									variant="text"
									size="small"
									disableElevation
									sx={{
										...LOCK_TOGGLE_BUTTON_SX,
										color: isExtraIngredientDisabled
											? LOCK_ICON_ON_COLOR
											: LOCK_ICON_OFF_COLOR,
										mr: 0.3,
									}}
									onClick={() =>
										handleExtraIngredientDisabledToggle(ingredientName)
									}
									data-testid={`ingredient-extra-lock-toggle-${ingredientName}`}
									title={t(
										"TeamTimeline.cooking ingredient extra lock",
										"追加食材として使わない",
									)}
									aria-label={t(
										"TeamTimeline.cooking ingredient extra lock",
										"追加食材として使わない",
									)}
								>
									<LockOutlinedIcon sx={{ fontSize: "1.1rem" }} />
								</Button>
								<Box
									sx={{ display: "inline-flex", alignItems: "center" }}
									data-testid={`ingredient-icon-${ingredientName}`}
									title={ingredientName}
								>
									<IngredientIcon name={ingredientName} />
								</Box>
								<Button
									variant="contained"
									size="small"
									disableElevation
									sx={{ ...STEP_BUTTON_SX, ml: 0.5 }}
									onClick={() =>
										handleIngredientStep(ingredientName, -INGREDIENT_INPUT_STEP)
									}
									data-testid={`ingredient-decrement-${ingredientName}`}
								>
									<Box component="span" className="step-button-circle">
										<Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>
											-
										</Box>
									</Box>
								</Button>
								<DraftNumberField
									value={settings.initialIngredients[ingredientName] ?? 0}
									onCommit={(value) =>
										handleIngredientChange(ingredientName, value)
									}
									aria-label={ingredientName}
									sx={NUMERIC_TEXT_FIELD_SX}
									data-testid={`ingredient-input-${ingredientName}`}
								/>
								<Button
									variant="contained"
									size="small"
									disableElevation
									sx={STEP_BUTTON_SX}
									onClick={() =>
										handleIngredientStep(ingredientName, INGREDIENT_INPUT_STEP)
									}
									data-testid={`ingredient-increment-${ingredientName}`}
								>
									<Box component="span" className="step-button-circle">
										<Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>
											+
										</Box>
									</Box>
								</Button>
							</Box>
						);
					})}
				</Box>
				<Typography
					variant="caption"
					sx={{ mt: 1, display: "block", color: "#666" }}
					data-testid="cooking-initial-ingredients-total"
				>
					入力値合計: {initialIngredientTotal.toLocaleString()}
				</Typography>
				<Typography
					variant="caption"
					sx={{
						display: "inline-flex",
						alignItems: "center",
						gap: 0.2,
						color: "#666",
					}}
					data-testid="cooking-extra-ingredient-lock-note"
				>
					<LockOutlinedIcon
						sx={{ fontSize: "1.1rem", color: LOCK_ICON_ON_COLOR }}
						data-testid="cooking-extra-ingredient-lock-note-icon"
					/>
					：追加食材として使用しないようにする
				</Typography>
			</>
		);
	},
);

InitialIngredientsEditor.displayName = "InitialIngredientsEditor";

export default InitialIngredientsEditor;
