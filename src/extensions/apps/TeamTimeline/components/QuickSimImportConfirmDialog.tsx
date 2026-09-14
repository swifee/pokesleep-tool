import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface QuickSimImportConfirmDialogProps {
	open: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}

/**
 * 「詳細シミュのチームを取り込む」の確認ダイアログ。
 * 現在のメンバーと起用率を置き換えるため、実行前に確認する。
 */
const QuickSimImportConfirmDialog = React.memo(
	({ open, onCancel, onConfirm }: QuickSimImportConfirmDialogProps) => {
		const { t } = useTranslation();

		return (
			<Dialog
				open={open}
				onClose={onCancel}
				maxWidth="xs"
				fullWidth
				data-testid="quick-sim-import-confirm-dialog"
			>
				<DialogContent>
					<Typography sx={{ fontSize: "14px" }}>
						{t(
							"TeamTimeline.quick import confirm",
							"詳細シミュのチームを取り込みます。現在のメンバーと起用率は置き換えられます。よろしいですか？",
						)}
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={onCancel}
						data-testid="quick-sim-import-cancel-button"
					>
						{t("cancel")}
					</Button>
					<Button
						onClick={onConfirm}
						variant="contained"
						color="primary"
						data-testid="quick-sim-import-confirm-button"
					>
						{t("ok")}
					</Button>
				</DialogActions>
			</Dialog>
		);
	},
);

QuickSimImportConfirmDialog.displayName = "QuickSimImportConfirmDialog";

export default QuickSimImportConfirmDialog;
