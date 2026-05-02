export const DIALOG_SX = {
	"& .MuiDialog-container": {
		alignItems: "center",
	},
} as const;

export const DIALOG_PAPER_SX = {
	maxWidth: "none",
	width: {
		xs: "calc(100% - 16px)",
		sm: "min(720px, calc(100% - 24px))",
	},
	margin: {
		xs: "30px 8px",
		sm: "30px 12px",
	},
	maxHeight: "calc(100% - 60px)",
	display: "flex",
	flexDirection: "column",
	boxSizing: "border-box",
} as const;
