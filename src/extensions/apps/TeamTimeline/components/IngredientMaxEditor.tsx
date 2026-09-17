import { Box, Button } from "@mui/material";
import React, { useCallback } from "react";
import {
	type IngredientName,
	IngredientNames,
} from "../../../../data/pokemons";
import IngredientIcon from "../../../../ui/IvCalc/IngredientIcon";
import {
	QUICK_SIM_INGREDIENT_COUNT_LIMIT,
	QUICK_SIM_INGREDIENT_STEP_COUNT,
} from "../types/QuickSimOptimizerTypes";
import {
	NUMERIC_TEXT_FIELD_SX,
	STEP_BUTTON_SX,
	STEP_BUTTON_SYMBOL_SX,
} from "./CookingSettingsStyles";
import DraftNumberField from "./DraftNumberField";

export type IngredientMaxCounts = Readonly<
	Partial<Record<IngredientName, number>>
>;

interface IngredientMaxEditorProps {
	/** 食材ごとの上限（個）。未設定は 0 */
	values: IngredientMaxCounts;
	onChange: (values: Partial<Record<IngredientName, number>>) => void;
}

/**
 * 初期食材の最適化で食材ごとの上限（個）を編集するグリッド。
 * 初期食材エディタと同じ行の並び（アイコン・−/+・数値）で、刻み（30 個）ずつ増減する。
 */
const IngredientMaxEditor = React.memo(
	({ values, onChange }: IngredientMaxEditorProps) => {
		const handleChange = useCallback(
			(ingredientName: IngredientName, count: number) => {
				const clamped = Math.max(
					0,
					Math.min(QUICK_SIM_INGREDIENT_COUNT_LIMIT, Math.floor(count)),
				);
				onChange({ ...values, [ingredientName]: clamped });
			},
			[values, onChange],
		);

		const handleStep = useCallback(
			(ingredientName: IngredientName, delta: number) => {
				handleChange(ingredientName, (values[ingredientName] ?? 0) + delta);
			},
			[handleChange, values],
		);

		return (
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
					gap: 0.5,
				}}
				data-testid="quick-sim-optimizer-ingredient-max"
			>
				{IngredientNames.map((ingredientName) => (
					<Box
						key={ingredientName}
						sx={{ display: "flex", alignItems: "center", fontSize: "0.85rem" }}
					>
						<Box
							sx={{ display: "inline-flex", alignItems: "center" }}
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
								handleStep(ingredientName, -QUICK_SIM_INGREDIENT_STEP_COUNT)
							}
							data-testid={`ingredient-max-decrement-${ingredientName}`}
						>
							<Box component="span" className="step-button-circle">
								<Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>
									-
								</Box>
							</Box>
						</Button>
						<DraftNumberField
							value={values[ingredientName] ?? 0}
							onCommit={(value) => handleChange(ingredientName, value)}
							aria-label={ingredientName}
							sx={NUMERIC_TEXT_FIELD_SX}
							data-testid={`ingredient-max-input-${ingredientName}`}
						/>
						<Button
							variant="contained"
							size="small"
							disableElevation
							sx={STEP_BUTTON_SX}
							onClick={() =>
								handleStep(ingredientName, QUICK_SIM_INGREDIENT_STEP_COUNT)
							}
							data-testid={`ingredient-max-increment-${ingredientName}`}
						>
							<Box component="span" className="step-button-circle">
								<Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>
									+
								</Box>
							</Box>
						</Button>
					</Box>
				))}
			</Box>
		);
	},
);

IngredientMaxEditor.displayName = "IngredientMaxEditor";

export default IngredientMaxEditor;
