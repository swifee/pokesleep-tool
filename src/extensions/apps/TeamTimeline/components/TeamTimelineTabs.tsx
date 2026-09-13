import { Box, Tab, Tabs } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import type { TeamTimelineState } from "../types/TeamTimelineTypes";

export type TeamTimelineTab = TeamTimelineState["activeTab"];

/** Pseudo tab value that navigates to the IV calculator (box) instead of switching tabs. */
const BOX_LINK_TAB_VALUE = "box";

type TabValue = TeamTimelineTab | typeof BOX_LINK_TAB_VALUE;

interface TeamTimelineTabsProps {
	activeTab: TeamTimelineTab;
	onTabChange: (tab: TeamTimelineTab) => void;
	/** When provided, a "Box" tab is shown at the right end that jumps to the IV calculator. */
	onNavigateToBox?: () => void;
}

const TeamTimelineTabs = React.memo(
	({ activeTab, onTabChange, onNavigateToBox }: TeamTimelineTabsProps) => {
		const { t } = useTranslation();

		const handleChange = React.useCallback(
			(_: React.SyntheticEvent, newValue: TabValue) => {
				if (newValue === BOX_LINK_TAB_VALUE) {
					onNavigateToBox?.();
					return;
				}
				onTabChange(newValue);
			},
			[onTabChange, onNavigateToBox],
		);

		return (
			<Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
				<Tabs value={activeTab} onChange={handleChange}>
					<Tab
						label={t("TeamTimeline.tab simulation", "シミュレーション")}
						value="team"
					/>
					<Tab
						label={t("TeamTimeline.tab basic settings", "基本設定")}
						value="settings"
					/>
					<Tab
						label={t("TeamTimeline.tab cooking settings", "料理設定")}
						value="cooking"
					/>
					{onNavigateToBox !== undefined && (
						<Tab label={t("box", "ボックス")} value={BOX_LINK_TAB_VALUE} />
					)}
				</Tabs>
			</Box>
		);
	},
);

export default TeamTimelineTabs;
