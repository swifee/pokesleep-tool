import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import {
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Box,
	FormControlLabel,
	Switch,
	TextField,
	Typography,
} from "@mui/material";
import { styled } from "@mui/system";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import pokemons from "../../../../data/pokemons";
import {
	BERRY_ZONE_MAX_BONUS_PERCENT,
	BERRY_ZONE_MAX_SKILL_LEVEL,
	BERRY_ZONE_MAX_SNORLAX_ENERGY,
	BERRY_ZONE_MAX_STACK_LIMIT,
	type BerryZoneProvisionalSettings,
	HUGE_MAGO_BERRY_MAX_ENERGY_MULTIPLIER,
	HUGE_MAGO_BERRY_MAX_PICKUP_RATE_PERCENT,
	type HugeMagoBerryProvisionalSettings,
	PLACEHOLDER_MAX_CARRY_LIMIT,
	PLACEHOLDER_MAX_FREQUENCY_SECONDS,
	PLACEHOLDER_MAX_SKILL_RATE_PERCENT,
	PLACEHOLDER_MIN_FREQUENCY_SECONDS,
	type PlaceholderPokemonProvisionalSettings,
	type ProvisionalSettings,
} from "../types/ProvisionalSettingsTypes";
import { getBerryZoneBerryMultiplier } from "../utils/BerryZoneUtils";
import { normalizeProvisionalSettings } from "../utils/ProvisionalSettingsStorage";
import { isPlaceholderPokemonData } from "../utils/TimelinePokemonUtils";

interface ProvisionalSettingsPanelProps {
	settings: ProvisionalSettings;
	onChange: (settings: ProvisionalSettings) => void;
}

const NUMERIC_TEXT_FIELD_SX = {
	width: "8ch",
	"& .MuiInputBase-input": {
		textAlign: "right",
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

const Container = styled("div")({
	padding: "16px",
});

const SettingRow = styled("div")({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
	padding: "4px 0",
});

/** カビゴンエナジーを入力するスキルレベルの一覧 */
const BERRY_ZONE_SKILL_LEVELS = Array.from(
	{ length: BERRY_ZONE_MAX_SKILL_LEVEL },
	(_, index) => index + 1,
);

const LevelGrid = styled("div")({
	display: "flex",
	flexWrap: "wrap",
	gap: "8px",
	paddingTop: "4px",
});

interface NumberFieldProps {
	label: string;
	testId: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	disabled?: boolean;
	onCommit: (value: number) => void;
}

/**
 * 入力中は文字列を保持し、確定時のみ数値としてコミットする入力欄。
 * 入力途中の値が丸められて編集しづらくなるのを防ぐ。
 */
const NumberField = React.memo(function NumberField({
	label,
	testId,
	value,
	min,
	max,
	step = 1,
	disabled = false,
	onCommit,
}: NumberFieldProps) {
	const [draft, setDraft] = useState(String(value));

	useEffect(() => {
		setDraft(String(value));
	}, [value]);

	const commit = useCallback(() => {
		const parsed = Number.parseFloat(draft);
		if (!Number.isFinite(parsed)) {
			setDraft(String(value));
			return;
		}
		const clamped = Math.max(min, Math.min(max, parsed));
		setDraft(String(clamped));
		if (clamped !== value) {
			onCommit(clamped);
		}
	}, [draft, max, min, onCommit, value]);

	return (
		<TextField
			label={label}
			type="number"
			size="small"
			variant="standard"
			disabled={disabled}
			value={draft}
			slotProps={{ htmlInput: { min, max, step, "data-testid": testId } }}
			sx={NUMERIC_TEXT_FIELD_SX}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					commit();
				}
			}}
		/>
	);
});

/**
 * 仮設定パネル
 *
 * 公式に数値が公開されていない要素を、任意の値でシミュレートするための設定。
 * 正式な数値が判明した項目はここから取り除いていく。
 */
const ProvisionalSettingsPanel = React.memo(function ProvisionalSettingsPanel({
	settings,
	onChange,
}: ProvisionalSettingsPanelProps) {
	const { t } = useTranslation();
	const { berryZone, hugeMagoBerry, placeholderPokemon } = settings;

	const applyBerryZone = useCallback(
		(patch: Partial<BerryZoneProvisionalSettings>) => {
			onChange(
				normalizeProvisionalSettings({
					...settings,
					berryZone: { ...berryZone, ...patch },
				}),
			);
		},
		[berryZone, onChange, settings],
	);

	const applyHugeMagoBerry = useCallback(
		(patch: Partial<HugeMagoBerryProvisionalSettings>) => {
			onChange(
				normalizeProvisionalSettings({
					...settings,
					hugeMagoBerry: { ...hugeMagoBerry, ...patch },
				}),
			);
		},
		[hugeMagoBerry, onChange, settings],
	);

	const applyPlaceholderPokemon = useCallback(
		(patch: Partial<PlaceholderPokemonProvisionalSettings>) => {
			onChange(
				normalizeProvisionalSettings({
					...settings,
					placeholderPokemon: { ...placeholderPokemon, ...patch },
				}),
			);
		},
		[onChange, placeholderPokemon, settings],
	);

	const handleSnorlaxEnergyChange = useCallback(
		(levelIndex: number, energy: number) => {
			const snorlaxEnergyByLevel = berryZone.snorlaxEnergyByLevel.map(
				(current, index) => (index === levelIndex ? energy : current),
			);
			applyBerryZone({ snorlaxEnergyByLevel });
		},
		[applyBerryZone, berryZone.snorlaxEnergyByLevel],
	);

	const maxBerryMultiplier = useMemo(
		() =>
			getBerryZoneBerryMultiplier(
				{ ...berryZone, enabled: true },
				berryZone.maxStackCount,
			),
		[berryZone],
	);

	const placeholderPokemonNames = useMemo(
		() =>
			pokemons
				.filter((pokemon) => isPlaceholderPokemonData(pokemon))
				.map((pokemon) => t(`pokemons.${pokemon.name}`))
				.join(", "),
		[t],
	);

	return (
		<Container>
			<Typography variant="subtitle2" gutterBottom>
				<ScienceOutlinedIcon
					fontSize="inherit"
					sx={{ verticalAlign: "middle", mr: 0.5 }}
				/>
				{t("TeamTimeline.provisional settings", "仮設定（未確定パラメータ）")}
			</Typography>
			<Typography variant="caption" color="text.secondary" component="p">
				{t(
					"TeamTimeline.provisional settings description",
					"公式に数値が公開されていない要素を、好きな値でシミュレートするための設定です。正式な数値が判明したら差し替えます。",
				)}
			</Typography>

			<Accordion defaultExpanded disableGutters sx={{ mt: 1 }}>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography variant="body2">
						{t(
							"TeamTimeline.provisional berry zone",
							"サイコブレイク（きのみゾーン）",
						)}
					</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<FormControlLabel
						control={
							<Switch
								checked={berryZone.enabled}
								onChange={(event) =>
									applyBerryZone({ enabled: event.target.checked })
								}
							/>
						}
						label={t(
							"TeamTimeline.provisional use berry zone values",
							"きのみゾーンの仮パラメータでシミュレートする",
						)}
					/>

					<Typography variant="caption" color="text.secondary" component="p">
						{t(
							"TeamTimeline.provisional berry zone snorlax energy",
							"発動1回あたりのカビゴンエナジー（スキルレベル別）",
						)}
					</Typography>
					<LevelGrid>
						{BERRY_ZONE_SKILL_LEVELS.map((level) => (
							<NumberField
								key={`berry-zone-energy-lv${level}`}
								label={`Lv${level}`}
								testId={`provisional-berry-zone-energy-${level}`}
								value={berryZone.snorlaxEnergyByLevel[level - 1] ?? 0}
								min={0}
								max={BERRY_ZONE_MAX_SNORLAX_ENERGY}
								step={10}
								disabled={!berryZone.enabled}
								onCommit={(value) =>
									handleSnorlaxEnergyChange(level - 1, value)
								}
							/>
						))}
					</LevelGrid>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional berry zone bonus percent",
								"1重ねがけあたりのマゴのみエナジー上昇率(%)",
							)}
						</Typography>
						<NumberField
							label="%"
							testId="provisional-berry-zone-bonus-percent"
							value={berryZone.berryEnergyBonusPercent}
							min={0}
							max={BERRY_ZONE_MAX_BONUS_PERCENT}
							disabled={!berryZone.enabled}
							onCommit={(value) =>
								applyBerryZone({ berryEnergyBonusPercent: value })
							}
						/>
					</SettingRow>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional berry zone max stack",
								"重ねがけの上限回数",
							)}
						</Typography>
						<NumberField
							label={t("TeamTimeline.provisional stack unit", "回")}
							testId="provisional-berry-zone-max-stack"
							value={berryZone.maxStackCount}
							min={1}
							max={BERRY_ZONE_MAX_STACK_LIMIT}
							disabled={!berryZone.enabled}
							onCommit={(value) => applyBerryZone({ maxStackCount: value })}
						/>
					</SettingRow>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional berry zone initial stack",
								"開始時点で展開済みの重ねがけ数",
							)}
						</Typography>
						<NumberField
							label={t("TeamTimeline.provisional stack unit", "回")}
							testId="provisional-berry-zone-initial-stack"
							value={berryZone.initialStackCount}
							min={0}
							max={berryZone.maxStackCount}
							disabled={!berryZone.enabled}
							onCommit={(value) => applyBerryZone({ initialStackCount: value })}
						/>
					</SettingRow>

					<Box sx={{ pt: 1 }}>
						<Typography
							variant="caption"
							color="text.secondary"
							component="p"
							data-testid="provisional-berry-zone-max-multiplier"
						>
							{t(
								"TeamTimeline.provisional berry zone max multiplier",
								"上限まで重ねたときのマゴのみエナジー倍率",
							)}
							: ×{maxBerryMultiplier.toFixed(2)}
						</Typography>
						<Typography variant="caption" color="text.secondary" component="p">
							{t(
								"TeamTimeline.provisional berry zone note",
								"効果はマゴのみ（エスパータイプ）のきのみエナジーにのみ適用されます。展開したゾーンはシミュレーション中ずっと持続し、ミュウツーをチームから外しても消えません。",
							)}
						</Typography>
					</Box>
				</AccordionDetails>
			</Accordion>

			<Accordion disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography variant="body2">
						{t(
							"TeamTimeline.provisional huge mago berry",
							"とてもおおきなマゴのみ（イベント）",
						)}
					</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<FormControlLabel
						control={
							<Switch
								checked={hugeMagoBerry.enabled}
								onChange={(event) =>
									applyHugeMagoBerry({ enabled: event.target.checked })
								}
							/>
						}
						label={t(
							"TeamTimeline.provisional use huge mago berry",
							"とてもおおきなマゴのみをシミュレートする",
						)}
					/>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional huge mago berry energy multiplier",
								"通常のマゴのみに対するエナジー倍率",
							)}
						</Typography>
						<NumberField
							label="×"
							testId="provisional-huge-mago-energy-multiplier"
							value={hugeMagoBerry.energyMultiplier}
							min={0}
							max={HUGE_MAGO_BERRY_MAX_ENERGY_MULTIPLIER}
							step={0.5}
							disabled={!hugeMagoBerry.enabled}
							onCommit={(value) =>
								applyHugeMagoBerry({ energyMultiplier: value })
							}
						/>
					</SettingRow>

					<Typography variant="caption" color="text.secondary" component="p">
						{t(
							"TeamTimeline.provisional huge mago berry pickup rate",
							"おてつだい1回あたりに拾ってくる確率(%)",
						)}
					</Typography>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional huge mago berry legendary",
								"ミュウ / ミュウツー",
							)}
						</Typography>
						<NumberField
							label="%"
							testId="provisional-huge-mago-rate-legendary"
							value={hugeMagoBerry.legendaryPickupRatePercent}
							min={0}
							max={HUGE_MAGO_BERRY_MAX_PICKUP_RATE_PERCENT}
							step={1}
							disabled={!hugeMagoBerry.enabled}
							onCommit={(value) =>
								applyHugeMagoBerry({ legendaryPickupRatePercent: value })
							}
						/>
					</SettingRow>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional huge mago berry psychic",
								"エスパータイプ",
							)}
						</Typography>
						<NumberField
							label="%"
							testId="provisional-huge-mago-rate-psychic"
							value={hugeMagoBerry.psychicPickupRatePercent}
							min={0}
							max={HUGE_MAGO_BERRY_MAX_PICKUP_RATE_PERCENT}
							step={1}
							disabled={!hugeMagoBerry.enabled}
							onCommit={(value) =>
								applyHugeMagoBerry({ psychicPickupRatePercent: value })
							}
						/>
					</SettingRow>

					<SettingRow>
						<Typography variant="body2">
							{t("TeamTimeline.provisional huge mago berry other", "その他")}
						</Typography>
						<NumberField
							label="%"
							testId="provisional-huge-mago-rate-other"
							value={hugeMagoBerry.otherPickupRatePercent}
							min={0}
							max={HUGE_MAGO_BERRY_MAX_PICKUP_RATE_PERCENT}
							step={1}
							disabled={!hugeMagoBerry.enabled}
							onCommit={(value) =>
								applyHugeMagoBerry({ otherPickupRatePercent: value })
							}
						/>
					</SettingRow>

					<Typography variant="caption" color="text.secondary" component="p">
						{t(
							"TeamTimeline.provisional huge mago berry note",
							"サブスキル「きのみの数S」やイベントのきのみ追加数は適用されず、1回につき1個拾います。所持数が満タンのときは拾えません（「いつのまに育成」でカビゴンに渡せないため、溢れても回収されません）。きのみゾーン展開中はエナジーが上昇します。「秘境の奥へ進むほど多く見つかる」効果は再現していません。",
						)}
					</Typography>
				</AccordionDetails>
			</Accordion>

			<Accordion disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography variant="body2">
						{t(
							"TeamTimeline.provisional placeholder pokemon",
							"データ未公開ポケモンの仮ステータス",
						)}
					</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<FormControlLabel
						control={
							<Switch
								checked={placeholderPokemon.enabled}
								onChange={(event) =>
									applyPlaceholderPokemon({ enabled: event.target.checked })
								}
							/>
						}
						label={t(
							"TeamTimeline.provisional use placeholder stats",
							"仮ステータスでシミュレートする",
						)}
					/>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional placeholder frequency",
								"おてつだいスピード(秒)",
							)}
						</Typography>
						<NumberField
							label={t("TeamTimeline.provisional second unit", "秒")}
							testId="provisional-placeholder-frequency"
							value={placeholderPokemon.helpingFrequencySeconds}
							min={PLACEHOLDER_MIN_FREQUENCY_SECONDS}
							max={PLACEHOLDER_MAX_FREQUENCY_SECONDS}
							step={100}
							disabled={!placeholderPokemon.enabled}
							onCommit={(value) =>
								applyPlaceholderPokemon({ helpingFrequencySeconds: value })
							}
						/>
					</SettingRow>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional placeholder skill rate",
								"メインスキル発動率(%)",
							)}
						</Typography>
						<NumberField
							label="%"
							testId="provisional-placeholder-skill-rate"
							value={placeholderPokemon.skillRatePercent}
							min={0}
							max={PLACEHOLDER_MAX_SKILL_RATE_PERCENT}
							step={0.1}
							disabled={!placeholderPokemon.enabled}
							onCommit={(value) =>
								applyPlaceholderPokemon({ skillRatePercent: value })
							}
						/>
					</SettingRow>

					<SettingRow>
						<Typography variant="body2">
							{t(
								"TeamTimeline.provisional placeholder carry limit",
								"最大所持数",
							)}
						</Typography>
						<NumberField
							label={t("TeamTimeline.provisional count unit", "個")}
							testId="provisional-placeholder-carry-limit"
							value={placeholderPokemon.carryLimit}
							min={0}
							max={PLACEHOLDER_MAX_CARRY_LIMIT}
							disabled={!placeholderPokemon.enabled}
							onCommit={(value) =>
								applyPlaceholderPokemon({ carryLimit: value })
							}
						/>
					</SettingRow>

					<Typography
						variant="caption"
						color="text.secondary"
						component="p"
						data-testid="provisional-placeholder-targets"
					>
						{t("TeamTimeline.provisional placeholder targets", "対象")}:{" "}
						{placeholderPokemonNames}
					</Typography>
					<Typography variant="caption" color="text.secondary" component="p">
						{t(
							"TeamTimeline.provisional placeholder note",
							"上流のデータが未公開のポケモンにのみ適用されます。食材は未公開のため、きのみのみを集めるものとして計算します。",
						)}
					</Typography>
				</AccordionDetails>
			</Accordion>
		</Container>
	);
});

export default ProvisionalSettingsPanel;
