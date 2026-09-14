import { TextField, type TextFieldProps } from "@mui/material";
import React, { useCallback, useState } from "react";

interface DraftNumberFieldProps {
	/** 確定済みの値 */
	value: number;
	/** 入力のたびに呼ぶ。空欄のときは 0 */
	onCommit: (value: number) => void;
	"aria-label"?: string;
	"data-testid"?: string;
	sx?: TextFieldProps["sx"];
}

const DIGITS_ONLY = /^\d*$/;

/**
 * 0 以上の整数を入力する欄。
 * 入力中は空欄にでき（その間は 0 として扱う）、フォーカスが外れると確定値を表示する。
 * type="number" は空欄にできず桁が欠けることがあるため、数字キーボード付きのテキスト入力にする。
 */
const DraftNumberField = React.memo(
	({
		value,
		onCommit,
		"aria-label": ariaLabel,
		"data-testid": dataTestId,
		sx,
	}: DraftNumberFieldProps) => {
		const [isEmpty, setIsEmpty] = useState(false);

		const handleChange = useCallback(
			(event: React.ChangeEvent<HTMLInputElement>) => {
				const raw = event.target.value;
				if (!DIGITS_ONLY.test(raw)) {
					return;
				}
				if (raw === "") {
					setIsEmpty(true);
					onCommit(0);
					return;
				}
				setIsEmpty(false);
				onCommit(Number.parseInt(raw, 10));
			},
			[onCommit],
		);

		const handleBlur = useCallback(() => {
			setIsEmpty(false);
		}, []);

		return (
			<TextField
				type="text"
				size="small"
				variant="standard"
				value={isEmpty ? "" : String(value)}
				onChange={handleChange}
				onBlur={handleBlur}
				inputProps={{
					inputMode: "numeric",
					pattern: "[0-9]*",
					"aria-label": ariaLabel,
				}}
				sx={sx}
				data-testid={dataTestId}
			/>
		);
	},
);

DraftNumberField.displayName = "DraftNumberField";

export default DraftNumberField;
