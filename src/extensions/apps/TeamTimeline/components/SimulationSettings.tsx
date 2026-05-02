import CasinoIcon from "@mui/icons-material/Casino";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Box, Button, Slider, TextField, Typography } from "@mui/material";
import { styled } from "@mui/system";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { SimulationConfig } from "../types/TimeSlotTypes";

/**
 * シミュレーション設定のProps
 */
interface SimulationSettingsProps {
	/** シミュレーション設定 */
	config: SimulationConfig;
	/** 設定変更ハンドラー */
	onConfigChange: (config: Partial<SimulationConfig>) => void;
	/** シミュレーション実行ハンドラー */
	onRunSimulation: () => void;
	/** ローディング状態 */
	loading: boolean;
	/** 無効化フラグ（チームが空の場合など） */
	disabled?: boolean;
}

// スタイル定義
const Container = styled("div")({
	padding: "16px",
});

const Section = styled("div")({
	marginBottom: "24px",
});

const SliderRow = styled("div")({
	display: "flex",
	alignItems: "center",
	gap: "16px",
});

const SeedRow = styled("div")({
	display: "flex",
	alignItems: "center",
	gap: "8px",
});

const EnergyValue = styled(Typography)({
	minWidth: "40px",
	textAlign: "right",
	fontWeight: "bold",
});

/**
 * シミュレーション設定コンポーネント
 *
 * げんき設定、乱数シード設定、シミュレーション実行ボタンを提供する。
 */
export const SimulationSettings = React.memo(function SimulationSettings({
	config,
	onConfigChange,
	onRunSimulation,
	loading,
	disabled = false,
}: SimulationSettingsProps) {
	const { t } = useTranslation();

	// げんき変更ハンドラー
	const handleEnergyChange = useCallback(
		(_event: Event, value: number | number[]) => {
			if (typeof value === "number") {
				onConfigChange({ initialEnergy: value });
			}
		},
		[onConfigChange],
	);

	// シード変更ハンドラー
	const handleSeedChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const value = parseInt(event.target.value, 10);
			if (!Number.isNaN(value) && value >= 0) {
				onConfigChange({ seed: value });
			}
		},
		[onConfigChange],
	);

	// ランダムシード生成＋シミュレーション実行ハンドラー
	const handleRandomSeedAndRun = useCallback(() => {
		const randomSeed = Math.floor(Math.random() * 100000);
		onConfigChange({ seed: randomSeed });
		// シード変更後にシミュレーションを実行
		// Note: onConfigChangeはsetStateなので次のレンダリング後に反映される
		// そのため、setTimeoutで少し遅延させて実行
		setTimeout(() => {
			onRunSimulation();
		}, 10);
	}, [onConfigChange, onRunSimulation]);

	return (
		<Container>
			{/* げんき設定セクション */}
			<Section>
				<Typography variant="subtitle2" gutterBottom>
					{t("TeamTimeline.sleep energy", "就寝時げんき")}
				</Typography>
				<SliderRow>
					<Slider
						value={config.initialEnergy}
						onChange={handleEnergyChange}
						min={0}
						max={100}
						step={1}
						disabled={disabled || loading}
						sx={{ flexGrow: 1 }}
					/>
					<EnergyValue variant="body2">{config.initialEnergy}</EnergyValue>
				</SliderRow>
			</Section>

			{/* シード設定セクション */}
			<Section>
				<Typography variant="subtitle2" gutterBottom>
					{t("TeamTimeline.seed value", "乱数シード")}
				</Typography>
				<SeedRow>
					<TextField
						type="number"
						value={config.seed}
						onChange={handleSeedChange}
						disabled={disabled || loading}
						size="small"
						inputProps={{ min: 0 }}
						sx={{ flexGrow: 1 }}
					/>
				</SeedRow>
			</Section>

			{/* ボタン配置: ランダム生成（上）→ シミュレーション実行（下） */}
			<Box display="flex" flexDirection="column" gap={1}>
				<Button
					variant="contained"
					color="secondary"
					onClick={handleRandomSeedAndRun}
					disabled={disabled || loading}
					startIcon={<CasinoIcon />}
					fullWidth
				>
					{t("TeamTimeline.random seed", "ランダム生成")}
				</Button>
				<Button
					variant="outlined"
					color="primary"
					onClick={onRunSimulation}
					disabled={disabled || loading}
					startIcon={<PlayArrowIcon />}
					fullWidth
				>
					{loading
						? t("TeamTimeline.simulating", "計算中...")
						: t("TeamTimeline.run simulation", "シミュレーション実行")}
				</Button>
			</Box>
		</Container>
	);
});

export default SimulationSettings;
