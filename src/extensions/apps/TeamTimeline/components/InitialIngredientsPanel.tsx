import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsIcon from "@mui/icons-material/Settings";
import {
	Box,
	Button,
	ButtonBase,
	Collapse,
	Dialog,
	DialogActions,
	DialogContent,
	IconButton,
	Typography,
} from "@mui/material";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { InitialIngredientsSettings } from "../types/CookingTypes";
import { getInitialIngredientTotal } from "../utils/InitialIngredientsUtils";
import InitialIngredientsEditor from "./InitialIngredientsEditor";

interface InitialIngredientsPanelProps {
	settings: InitialIngredientsSettings;
	onChange: (settings: InitialIngredientsSettings) => void;
	/** 料理設定タブへ移動する */
	onOpenCookingSettings: () => void;
	/** 「もう片方のシミュに反映」ボタンのラベル */
	copyButtonLabel: string;
	/** 反映の確認ダイアログの本文 */
	copyConfirmMessage: string;
	/** 確認後に、この設定をもう片方のシミュへ反映する */
	onCopyToOtherSim: () => void;
	/** data-testid の接頭辞（例: quick-sim, detailed-sim） */
	testIdPrefix: string;
}

const PANEL_SX = {
	border: "1px solid #e1e1e1",
	borderRadius: "8px",
	p: "10px 12px",
	mb: 2,
	backgroundColor: "#fff",
};
const EXPAND_ICON_TRANSITION_MS = 200;

/**
 * 初期食材の折りたたみパネル。
 * 自動シミュと詳細シミュのそれぞれが自分の初期食材を持ち、
 * このパネルからもう片方のシミュへ値を反映できる（反映ボタンは展開中だけ表示）。
 */
const InitialIngredientsPanel = React.memo(
	({
		settings,
		onChange,
		onOpenCookingSettings,
		copyButtonLabel,
		copyConfirmMessage,
		onCopyToOtherSim,
		testIdPrefix,
	}: InitialIngredientsPanelProps) => {
		const { t } = useTranslation();
		const [expanded, setExpanded] = useState(false);
		const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);

		const handleToggle = useCallback(() => {
			setExpanded((prev) => !prev);
		}, []);

		const handleCopyClick = useCallback(() => {
			setCopyConfirmOpen(true);
		}, []);

		const handleCopyCancel = useCallback(() => {
			setCopyConfirmOpen(false);
		}, []);

		const handleCopyConfirm = useCallback(() => {
			setCopyConfirmOpen(false);
			onCopyToOtherSim();
		}, [onCopyToOtherSim]);

		const initialIngredientTotal = getInitialIngredientTotal(settings);

		return (
			<Box sx={PANEL_SX} data-testid={`${testIdPrefix}-initial-ingredients`}>
				<Box sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
					<ButtonBase
						onClick={handleToggle}
						aria-expanded={expanded}
						data-testid={`${testIdPrefix}-initial-ingredients-toggle`}
						sx={{
							display: "flex",
							alignItems: "center",
							gap: "2px",
							mr: "auto",
							borderRadius: "4px",
							px: "2px",
						}}
					>
						<Typography variant="subtitle2" component="span">
							{t("TeamTimeline.cooking initial ingredients", "初期食材")}
						</Typography>
						<Typography
							variant="caption"
							component="span"
							sx={{ color: "#666" }}
							data-testid={`${testIdPrefix}-initial-ingredients-summary`}
						>
							{t("TeamTimeline.quick ingredients total", "（合計 {{total}}）", {
								total: initialIngredientTotal.toLocaleString(),
							})}
						</Typography>
						<ExpandMoreIcon
							sx={{
								fontSize: "18px",
								color: "#666",
								transform: expanded ? "rotate(180deg)" : "none",
								transition: `transform ${EXPAND_ICON_TRANSITION_MS}ms`,
							}}
						/>
					</ButtonBase>
					<IconButton
						size="small"
						onClick={onOpenCookingSettings}
						title={t(
							"TeamTimeline.quick open cooking settings",
							"料理設定を開く",
						)}
						aria-label={t(
							"TeamTimeline.quick open cooking settings",
							"料理設定を開く",
						)}
						data-testid={`${testIdPrefix}-open-cooking-settings`}
						sx={{ p: "2px" }}
					>
						<SettingsIcon sx={{ fontSize: "16px" }} />
					</IconButton>
				</Box>
				<Collapse in={expanded} unmountOnExit>
					<Box sx={{ mt: 1 }}>
						<InitialIngredientsEditor
							settings={settings}
							onChange={onChange}
							showTitle={false}
						/>
						<Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
							<Button
								variant="outlined"
								size="small"
								onClick={handleCopyClick}
								data-testid={`${testIdPrefix}-initial-ingredients-copy`}
							>
								{copyButtonLabel}
							</Button>
						</Box>
					</Box>
				</Collapse>

				<Dialog
					open={copyConfirmOpen}
					onClose={handleCopyCancel}
					maxWidth="xs"
					fullWidth
					data-testid={`${testIdPrefix}-initial-ingredients-copy-dialog`}
				>
					<DialogContent>
						<Typography sx={{ fontSize: "14px" }}>
							{copyConfirmMessage}
						</Typography>
					</DialogContent>
					<DialogActions>
						<Button
							onClick={handleCopyCancel}
							data-testid={`${testIdPrefix}-initial-ingredients-copy-cancel`}
						>
							{t("cancel")}
						</Button>
						<Button
							onClick={handleCopyConfirm}
							variant="contained"
							color="primary"
							data-testid={`${testIdPrefix}-initial-ingredients-copy-confirm`}
						>
							{t("ok")}
						</Button>
					</DialogActions>
				</Dialog>
			</Box>
		);
	},
);

InitialIngredientsPanel.displayName = "InitialIngredientsPanel";

export default InitialIngredientsPanel;
