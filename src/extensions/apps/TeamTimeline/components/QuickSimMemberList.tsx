import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import {
	Box,
	Button,
	ButtonBase,
	ClickAwayListener,
	IconButton,
	MenuItem,
	Select,
	type SelectChangeEvent,
	Slider,
	Tooltip,
	Typography,
} from "@mui/material";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PokemonIcon from "../../../../ui/IvCalc/PokemonIcon";
import type PokemonBox from "../../../../util/PokemonBox";
import {
	isQuickSimUsageMode,
	MINUTES_PER_DAY,
	QUICK_SIM_MAX_USAGE_PERCENT,
	QUICK_SIM_MIN_USAGE_PERCENT,
	QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
	QUICK_SIM_USAGE_MODES,
	QUICK_SIM_USAGE_STEP_PERCENT,
	type QuickSimMember,
	type QuickSimUsageMode,
} from "../types/QuickSimTypes";
import {
	clampQuickSimUsagePercent,
	getQuickSimTotalUsagePercent,
	isQuickSimUsageModeEffective,
	usagePercentToMinutes,
} from "../utils/QuickSimScheduler";
import {
	NUMERIC_TEXT_FIELD_SX,
	STEP_BUTTON_SX,
	STEP_BUTTON_SYMBOL_SX,
} from "./CookingSettingsStyles";
import DraftNumberField from "./DraftNumberField";

interface QuickSimMemberListProps {
	members: QuickSimMember[];
	box: PokemonBox;
	onChange: (members: QuickSimMember[]) => void;
	onAddClick: () => void;
	onImportClick: () => void;
	/** アイコンをタップしたとき（別のポケモンへ入れ替える） */
	onSwapClick: (pokemonId: number) => void;
}

const MEMBER_ICON_SIZE_PX = 30;
const MINUTES_PER_HOUR = 60;

/** 起用率の入力欄の幅。"100" が収まる最小の幅で、狭い画面でも縮めない */
const USAGE_INPUT_SX = {
	...NUMERIC_TEXT_FIELD_SX,
	width: "3.6ch",
	flexShrink: 0,
};
/** 入力欄と % の間隔を詰めた +/- ボタン */
const USAGE_STEP_BUTTON_SX = {
	...STEP_BUTTON_SX,
	minWidth: "1.2rem",
	width: "1.2rem",
};
const USAGE_UNIT_SX = { fontSize: "12px", flexShrink: 0, ml: "-2px" };
const USAGE_SLIDER_SX = {
	flexGrow: 1,
	minWidth: "36px",
	maxWidth: "110px",
	mx: "6px",
};
const USAGE_MODE_FONT_SIZE = "11px";
/**
 * ▼を出さないコンパクトなプルダウン。
 * 起用率が 0% / 100% で起用方法が配置に影響しないときは薄く表示する（変更はできる）。
 */
const USAGE_MODE_SELECT_SX = {
	flexShrink: 0,
	fontSize: USAGE_MODE_FONT_SIZE,
	lineHeight: "14px",
	border: "1px solid #c8c8c8",
	borderRadius: "4px",
	backgroundColor: "#fafafa",
	"& .MuiSelect-select": {
		p: "2px 4px",
		pr: "4px !important",
		minHeight: 0,
	},
	'&[data-inactive="true"]': {
		color: "#9e9e9e",
		borderColor: "#e0e0e0",
		backgroundColor: "#fff",
	},
};
const USAGE_MODE_MENU_ITEM_SX = {
	fontSize: USAGE_MODE_FONT_SIZE,
	minHeight: 0,
	py: "4px",
};
const REMOVE_BUTTON_SX = { p: "2px", mr: "-6px" };

const HiddenSelectIcon = (): null => null;

interface UsageHelpIconProps {
	text: string;
	ariaLabel: string;
}

/**
 * 起用率と起用方法の説明を出す ? アイコン。
 * マウスを乗せている間、またはタップで表示し、外側のタップで閉じる。
 * タッチ端末ではタップ時に疑似的な mouseenter も発生するため、ホバーの判定は
 * pointerType が mouse のときに限る。ホバーで開いた直後のクリックは閉じない。
 */
function UsageHelpIcon({ text, ariaLabel }: UsageHelpIconProps) {
	const [open, setOpen] = useState(false);
	const openedByHoverRef = useRef(false);
	const close = useCallback(() => setOpen(false), []);
	const handlePointerEnter = useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			if (event.pointerType === "mouse") {
				openedByHoverRef.current = true;
				setOpen(true);
			}
		},
		[],
	);
	const handlePointerLeave = useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			if (event.pointerType === "mouse") {
				openedByHoverRef.current = false;
				setOpen(false);
			}
		},
		[],
	);
	const handleClick = useCallback(() => {
		if (openedByHoverRef.current) {
			openedByHoverRef.current = false;
			setOpen(true);
			return;
		}
		setOpen((previous) => !previous);
	}, []);

	return (
		<ClickAwayListener onClickAway={close}>
			<Box component="span" sx={{ display: "inline-flex" }}>
				<Tooltip
					title={text}
					arrow
					open={open}
					disableFocusListener
					disableHoverListener
					disableTouchListener
					slotProps={{ tooltip: { sx: { whiteSpace: "pre-line" } } }}
				>
					<IconButton
						size="small"
						aria-label={ariaLabel}
						aria-pressed={open}
						onPointerEnter={handlePointerEnter}
						onPointerLeave={handlePointerLeave}
						onClick={handleClick}
						data-testid="quick-sim-usage-help-button"
						sx={{ p: "2px", color: "text.secondary" }}
					>
						<HelpOutlineIcon sx={{ fontSize: "16px" }} />
					</IconButton>
				</Tooltip>
			</Box>
		</ClickAwayListener>
	);
}

/** 起用方法の表示名（翻訳キーと既定の日本語） */
const USAGE_MODE_LABELS: Readonly<
	Record<QuickSimUsageMode, { key: string; defaultValue: string }>
> = {
	even: { key: "TeamTimeline.quick usage mode even", defaultValue: "均等" },
	firstHalf: {
		key: "TeamTimeline.quick usage mode first half",
		defaultValue: "前半",
	},
	secondHalf: {
		key: "TeamTimeline.quick usage mode second half",
		defaultValue: "後半",
	},
	sleep: { key: "TeamTimeline.quick usage mode sleep", defaultValue: "睡眠" },
	daytime: {
		key: "TeamTimeline.quick usage mode daytime",
		defaultValue: "日中",
	},
	remainder: {
		key: "TeamTimeline.quick usage mode remainder",
		defaultValue: "残り",
	},
};

/**
 * 1日あたりの起用時間を "6.5h" のように表示する
 */
export function formatUsageHoursPerDay(usagePercent: number): string {
	const minutes = usagePercentToMinutes(usagePercent);
	const hours = minutes / MINUTES_PER_HOUR;
	const rounded = Math.round(hours * 10) / 10;
	return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}h`;
}

/**
 * 簡易シミュのメンバー一覧と起用率の入力
 */
const QuickSimMemberList = React.memo(
	({
		members,
		box,
		onChange,
		onAddClick,
		onImportClick,
		onSwapClick,
	}: QuickSimMemberListProps) => {
		const { t } = useTranslation();
		const totalPercent = getQuickSimTotalUsagePercent(members);
		const isExceeded = totalPercent > QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT;
		const usageModeLabel = useCallback(
			(mode: QuickSimUsageMode): string =>
				t(USAGE_MODE_LABELS[mode].key, USAGE_MODE_LABELS[mode].defaultValue),
			[t],
		);

		const handleUsageChange = useCallback(
			(pokemonId: number, usagePercent: number) => {
				const clamped = clampQuickSimUsagePercent(usagePercent);
				onChange(
					members.map((member) =>
						member.pokemonId === pokemonId
							? { ...member, usagePercent: clamped }
							: member,
					),
				);
			},
			[members, onChange],
		);

		const handleUsageStep = useCallback(
			(pokemonId: number, delta: number) => {
				const current =
					members.find((member) => member.pokemonId === pokemonId)
						?.usagePercent ?? 0;
				handleUsageChange(pokemonId, current + delta);
			},
			[handleUsageChange, members],
		);

		const handleUsageModeChange = useCallback(
			(pokemonId: number, event: SelectChangeEvent<string>) => {
				const mode = event.target.value;
				if (!isQuickSimUsageMode(mode)) {
					return;
				}
				onChange(
					members.map((member) =>
						member.pokemonId === pokemonId
							? { ...member, usageMode: mode }
							: member,
					),
				);
			},
			[members, onChange],
		);

		const handleRemove = useCallback(
			(pokemonId: number) => {
				onChange(members.filter((member) => member.pokemonId !== pokemonId));
			},
			[members, onChange],
		);

		return (
			<Box
				data-testid="quick-sim-member-list"
				sx={{
					border: "1px solid #e1e1e1",
					borderRadius: "8px",
					p: "10px 12px",
					mb: 2,
					backgroundColor: "#fff",
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						flexWrap: "wrap",
						gap: 1,
						mb: 1,
					}}
				>
					<Typography variant="subtitle2" sx={{ mr: "auto" }}>
						{t("TeamTimeline.quick members", "メンバーと起用率")}
					</Typography>
					<Button
						variant="outlined"
						size="small"
						startIcon={<AddIcon />}
						onClick={onAddClick}
						data-testid="quick-sim-add-member-button"
					>
						{t("TeamTimeline.quick add member", "ポケモンを追加")}
					</Button>
					<Button
						variant="text"
						size="small"
						onClick={onImportClick}
						data-testid="quick-sim-import-team-button"
					>
						{t(
							"TeamTimeline.quick import team",
							"詳細シミュのチームを取り込む",
						)}
					</Button>
				</Box>

				{members.length === 0 ? (
					<Typography
						variant="body2"
						sx={{ color: "#666", py: 1 }}
						data-testid="quick-sim-member-empty"
					>
						{t(
							"TeamTimeline.quick members empty",
							"ポケモンを追加して、1日のうち編成に入れる割合（起用率）を設定してください。",
						)}
					</Typography>
				) : (
					<Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						{members.map((member) => {
							const item = box.getById(member.pokemonId);
							if (!item) {
								return null;
							}
							return (
								<Box
									key={member.pokemonId}
									data-testid={`quick-sim-member-row-${member.pokemonId}`}
									sx={{
										display: "grid",
										gridTemplateColumns: "auto minmax(0, 1fr) auto",
										alignItems: "center",
										columnGap: 1,
										rowGap: "2px",
									}}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: "6px",
											minWidth: 0,
										}}
									>
										<ButtonBase
											onClick={() => onSwapClick(member.pokemonId)}
											title={t(
												"TeamTimeline.quick swap member",
												"ポケモンを入れ替える",
											)}
											aria-label={t(
												"TeamTimeline.quick swap member",
												"ポケモンを入れ替える",
											)}
											data-testid={`quick-sim-member-swap-${member.pokemonId}`}
											sx={{ borderRadius: "50%", flexShrink: 0 }}
										>
											<PokemonIcon
												idForm={item.iv.idForm}
												shiny={item.iv.shiny}
												size={MEMBER_ICON_SIZE_PX}
											/>
										</ButtonBase>
										<Box sx={{ minWidth: 0 }}>
											<Typography
												sx={{
													fontSize: "12px",
													lineHeight: "15px",
													fontWeight: 700,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
													maxWidth: "9rem",
												}}
												data-testid={`quick-sim-member-name-${member.pokemonId}`}
											>
												{item.filledNickname(t)}
											</Typography>
											<Typography
												sx={{
													fontSize: "10px",
													lineHeight: "13px",
													color: "#666",
												}}
											>
												<span style={{ color: "#62d540" }}>L</span>
												{item.iv.level}
												{" / "}
												<span
													data-testid={`quick-sim-member-hours-${member.pokemonId}`}
												>
													{t(
														"TeamTimeline.quick hours per day",
														"{{hours}}/日",
														{
															hours: formatUsageHoursPerDay(
																member.usagePercent,
															),
														},
													)}
												</span>
											</Typography>
										</Box>
									</Box>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "flex-end",
											gap: "2px",
											minWidth: 0,
										}}
									>
										<Select
											value={member.usageMode}
											onChange={(event) =>
												handleUsageModeChange(member.pokemonId, event)
											}
											variant="standard"
											disableUnderline
											IconComponent={HiddenSelectIcon}
											inputProps={{
												"aria-label": t(
													"TeamTimeline.quick usage mode",
													"起用方法",
												),
											}}
											sx={USAGE_MODE_SELECT_SX}
											data-testid={`quick-sim-member-mode-${member.pokemonId}`}
											data-inactive={
												isQuickSimUsageModeEffective(member.usagePercent)
													? "false"
													: "true"
											}
										>
											{QUICK_SIM_USAGE_MODES.map((mode) => (
												<MenuItem
													key={mode}
													value={mode}
													sx={USAGE_MODE_MENU_ITEM_SX}
												>
													{usageModeLabel(mode)}
												</MenuItem>
											))}
										</Select>
										<Slider
											size="small"
											value={member.usagePercent}
											min={QUICK_SIM_MIN_USAGE_PERCENT}
											max={QUICK_SIM_MAX_USAGE_PERCENT}
											step={QUICK_SIM_USAGE_STEP_PERCENT}
											onChange={(_, value) =>
												handleUsageChange(
													member.pokemonId,
													Array.isArray(value) ? value[0] : value,
												)
											}
											aria-label={t("TeamTimeline.quick usage", "起用率")}
											data-testid={`quick-sim-member-slider-${member.pokemonId}`}
											sx={USAGE_SLIDER_SX}
										/>
										<Button
											variant="contained"
											size="small"
											disableElevation
											sx={USAGE_STEP_BUTTON_SX}
											onClick={() =>
												handleUsageStep(
													member.pokemonId,
													-QUICK_SIM_USAGE_STEP_PERCENT,
												)
											}
											data-testid={`quick-sim-member-decrement-${member.pokemonId}`}
										>
											<Box component="span" className="step-button-circle">
												<Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>
													-
												</Box>
											</Box>
										</Button>
										<DraftNumberField
											value={member.usagePercent}
											onCommit={(value) =>
												handleUsageChange(member.pokemonId, value)
											}
											aria-label={t("TeamTimeline.quick usage", "起用率")}
											sx={USAGE_INPUT_SX}
											data-testid={`quick-sim-member-input-${member.pokemonId}`}
										/>
										<Typography sx={USAGE_UNIT_SX}>%</Typography>
										<Button
											variant="contained"
											size="small"
											disableElevation
											sx={USAGE_STEP_BUTTON_SX}
											onClick={() =>
												handleUsageStep(
													member.pokemonId,
													QUICK_SIM_USAGE_STEP_PERCENT,
												)
											}
											data-testid={`quick-sim-member-increment-${member.pokemonId}`}
										>
											<Box component="span" className="step-button-circle">
												<Box component="span" sx={STEP_BUTTON_SYMBOL_SX}>
													+
												</Box>
											</Box>
										</Button>
									</Box>
									<IconButton
										size="small"
										onClick={() => handleRemove(member.pokemonId)}
										title={t("TeamTimeline.delete", "削除")}
										aria-label={t("TeamTimeline.delete", "削除")}
										data-testid={`quick-sim-member-remove-${member.pokemonId}`}
										sx={REMOVE_BUTTON_SX}
									>
										<CloseIcon sx={{ fontSize: 14 }} />
									</IconButton>
								</Box>
							);
						})}
					</Box>
				)}

				<Box
					sx={{
						mt: 1,
						display: "flex",
						alignItems: "center",
						flexWrap: "wrap",
						gap: "2px",
					}}
				>
					<Typography
						variant="caption"
						sx={{
							color: isExceeded ? "error.main" : "#666",
							fontWeight: isExceeded ? 700 : 400,
						}}
						data-testid="quick-sim-usage-total"
					>
						{t(
							"TeamTimeline.quick usage total",
							"起用率合計: {{total}}% / {{limit}}%",
							{
								total: totalPercent,
								limit: QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
							},
						)}
						{isExceeded &&
							` ${t(
								"TeamTimeline.quick usage exceeded",
								"合計が{{limit}}%を超えています。",
								{ limit: QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT },
							)}`}
					</Typography>
					<UsageHelpIcon
						text={[
							t(
								"TeamTimeline.quick usage note",
								"100% = 1枠を1日中占有（{{hours}}h）。合計は最大{{limit}}%（5枠分）です。",
								{
									hours: MINUTES_PER_DAY / MINUTES_PER_HOUR,
									limit: QUICK_SIM_TOTAL_USAGE_LIMIT_PERCENT,
								},
							),
							t(
								"TeamTimeline.quick usage mode note",
								"起用方法（1〜99%のとき）: 均等=毎日同じ時間を空き枠に配置 / 前半=期間の先頭から連続 / 後半=期間の末尾まで連続 / 睡眠=就寝中を優先 / 日中=起床後を優先 / 残り=他のメンバーを全員配置した後の空きに入れる。前半・後半・睡眠・日中の順に先に配置し、均等はその後の空きに、残りは最後に入れます。",
							),
						].join("\n")}
						ariaLabel={t(
							"TeamTimeline.quick usage help label",
							"起用率の説明を表示",
						)}
					/>
				</Box>
			</Box>
		);
	},
);

QuickSimMemberList.displayName = "QuickSimMemberList";

export default QuickSimMemberList;
