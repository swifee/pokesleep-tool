import { Tab, tabsClasses } from "@mui/material";
import { styled } from "@mui/system";
import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { AppType } from "../../../ui/AppConfig";
import IvCalcApp from "../../../ui/IvCalc/IvCalcApp";

/**
 * The upper tab bar (RP / Strength / Rating / Team) is the first MUI Tabs
 * rendered by IvCalcApp, so the first flex container inside the wrapper is it.
 */
const UPPER_TAB_LIST_SELECTOR = `.${tabsClasses.flexContainer}`;

// Match StyledTab in src/ui/IvCalc/IvCalcApp.tsx so the linked tab blends in.
const LinkTab = styled(Tab)({
	minHeight: "36px",
	padding: "6px 16px",
});

// Outside of <Tabs>, a Tab falls back to inherited color with reduced opacity,
// so the unselected look of the sibling tabs is reproduced explicitly.
const LINK_TAB_SX = { color: "text.secondary", opacity: 1 } as const;

interface IvCalcAppWithTimelineTabProps {
	onAppChange: (value: AppType) => void;
}

/**
 * Renders the (protected) IvCalcApp and appends a "TL" tab to its upper tab bar
 * that jumps to the TeamTimeline app, without modifying src/ui.
 */
export default function IvCalcAppWithTimelineTab({
	onAppChange,
}: IvCalcAppWithTimelineTabProps) {
	const { t } = useTranslation();
	const rootRef = React.useRef<HTMLDivElement>(null);
	const [tabList, setTabList] = React.useState<HTMLElement | null>(null);

	React.useLayoutEffect(() => {
		const root = rootRef.current;
		if (root === null) {
			return;
		}
		setTabList(root.querySelector<HTMLElement>(UPPER_TAB_LIST_SELECTOR));
	}, []);

	const onTimelineTabClick = React.useCallback(() => {
		onAppChange("TeamTimeline");
	}, [onAppChange]);

	return (
		<div ref={rootRef} style={{ display: "contents" }}>
			<IvCalcApp />
			{tabList !== null &&
				createPortal(
					<LinkTab
						label={t("TeamTimeline.tab timeline link", "TL")}
						sx={LINK_TAB_SX}
						onClick={onTimelineTabClick}
					/>,
					tabList,
				)}
		</div>
	);
}
