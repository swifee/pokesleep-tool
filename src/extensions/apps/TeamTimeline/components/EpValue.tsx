import { styled } from "@mui/system";
import React from "react";

const EP_SUFFIX_TEXT = " EP";

const EpUnit = styled("span")({
	fontSize: "0.75em",
});

interface EpValueProps {
	value: number | string;
	prefix?: string;
}

const EpValue = React.memo(({ value, prefix = "" }: EpValueProps) => (
	<>
		{prefix}
		{value}
		<EpUnit>{EP_SUFFIX_TEXT}</EpUnit>
	</>
));

EpValue.displayName = "EpValue";

interface EpTextProps {
	text: string;
	keyPrefix: string;
}

export const EpText = React.memo(({ text, keyPrefix }: EpTextProps) => {
	const segments = text.split(/( EP)/g);
	if (segments.length === 1) {
		return text;
	}

	return (
		<>
			{segments.map((segment, index) => {
				const key = `${keyPrefix}-${index}`;
				if (segment === EP_SUFFIX_TEXT) {
					return <EpUnit key={key}>{EP_SUFFIX_TEXT}</EpUnit>;
				}
				return <React.Fragment key={key}>{segment}</React.Fragment>;
			})}
		</>
	);
});

EpText.displayName = "EpText";

export default EpValue;
