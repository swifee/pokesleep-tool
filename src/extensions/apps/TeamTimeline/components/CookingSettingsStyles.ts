/**
 * 料理設定パネルと初期食材エディタで共有する数値入力・ステップボタンのスタイル
 */

export const NUMERIC_INPUT_WIDTH = "5ch";

export const NUMERIC_TEXT_FIELD_SX = {
	width: NUMERIC_INPUT_WIDTH,
	"& .MuiInputBase-input": {
		textAlign: "center",
	},
	"& input[type=number]": {
		MozAppearance: "textfield",
	},
	"& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button":
		{
			WebkitAppearance: "none",
			margin: 0,
		},
};

export const STEP_BUTTON_SX = {
	minWidth: "1.5rem",
	width: "1.5rem",
	height: "1.5rem",
	px: 0,
	lineHeight: 1,
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	border: "none",
	boxShadow: "none",
	backgroundColor: "transparent",
	color: "inherit",
	"& .step-button-circle": {
		width: "1.2rem",
		height: "1.2rem",
		borderRadius: "50%",
		backgroundColor: "#b3b3b3",
		color: "#fff",
		fontWeight: 700,
		fontSize: "0.95rem",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
	"&:hover": {
		border: "none",
		boxShadow: "none",
		backgroundColor: "transparent",
	},
	"&:hover .step-button-circle": {
		backgroundColor: "#999999",
	},
};

export const STEP_BUTTON_SYMBOL_SX = {
	display: "block",
	lineHeight: 1,
	transform: "translate(0.4px, -0.6px)",
};

export const LOCK_ICON_ON_COLOR = "#e89a00";
export const LOCK_ICON_OFF_COLOR = "#c8c8c8";

export const LOCK_TOGGLE_BUTTON_SX = {
	minWidth: "1.5rem",
	width: "1.5rem",
	height: "1.5rem",
	p: 0,
	border: "none",
	boxShadow: "none",
	backgroundColor: "transparent",
	lineHeight: 1,
	"&:hover": {
		border: "none",
		boxShadow: "none",
		backgroundColor: "transparent",
	},
};
