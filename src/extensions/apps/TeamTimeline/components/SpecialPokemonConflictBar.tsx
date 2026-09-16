import { Box, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import PokemonIcon from "../../../../ui/IvCalc/PokemonIcon";

/** 重複しているとくべつなポケモン（表示用） */
export interface SpecialPokemonConflictEntry {
	pokemonId: number;
	pokemonIdForm: number;
	pokemonShiny: boolean;
	name: string;
}

export interface SpecialPokemonConflictBarProps {
	entries: SpecialPokemonConflictEntry[];
}

/** 重複しているセルと同じ色（TimelineCell の $specialConflict と合わせる） */
export const SPECIAL_POKEMON_CONFLICT_BACKGROUND = "#fde8e8";
export const SPECIAL_POKEMON_CONFLICT_BORDER = "#f2a3a3";
export const SPECIAL_POKEMON_CONFLICT_TEXT = "#b3261e";

/**
 * 詳細シミュで、とくべつなポケモン（伝説・幻）が同じ時間帯に 2 体以上編成されている
 * ときに、ルールと該当ポケモンを知らせるバー。
 */
const SpecialPokemonConflictBar = React.memo(
	({ entries }: SpecialPokemonConflictBarProps) => {
		const { t } = useTranslation();

		if (entries.length === 0) {
			return null;
		}

		return (
			<Box
				data-testid="special-pokemon-conflict-bar"
				sx={{
					display: "flex",
					flexDirection: "column",
					gap: "4px",
					width: "100%",
					px: "8px",
					py: "6px",
					boxSizing: "border-box",
					mb: "13px",
					border: `1px solid ${SPECIAL_POKEMON_CONFLICT_BORDER}`,
					borderRadius: "8px",
					backgroundColor: SPECIAL_POKEMON_CONFLICT_BACKGROUND,
				}}
			>
				<Typography
					sx={{
						fontSize: "12px",
						lineHeight: "15px",
						letterSpacing: "-0.48px",
						color: SPECIAL_POKEMON_CONFLICT_TEXT,
					}}
				>
					{t(
						"TeamTimeline.special pokemon conflict notice",
						"とくべつなポケモン（伝説・幻）はチームに同時に1体までです（ラティアス＋ラティオスの組み合わせは可）。色の付いた時間帯で次のポケモンが重複しています。",
					)}
				</Typography>
				<Box
					sx={{
						display: "flex",
						flexWrap: "wrap",
						gap: "3px 9px",
						alignItems: "center",
					}}
				>
					{entries.map((entry) => (
						<Box
							key={`special-pokemon-conflict-entry-${entry.pokemonId}`}
							data-testid="special-pokemon-conflict-entry"
							sx={{
								display: "inline-flex",
								alignItems: "center",
								gap: "3px",
							}}
						>
							<Box
								sx={{
									width: "22px",
									height: "22px",
									borderRadius: "4px",
									overflow: "hidden",
									border: `1px solid ${SPECIAL_POKEMON_CONFLICT_BORDER}`,
									backgroundColor: "#fff",
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<PokemonIcon
									idForm={entry.pokemonIdForm}
									shiny={entry.pokemonShiny}
									size={20}
								/>
							</Box>
							<Typography
								sx={{
									fontSize: "11px",
									lineHeight: "13px",
									letterSpacing: "-0.4px",
									color: "#000",
									whiteSpace: "nowrap",
								}}
							>
								{entry.name}
							</Typography>
						</Box>
					))}
				</Box>
			</Box>
		);
	},
);

SpecialPokemonConflictBar.displayName = "SpecialPokemonConflictBar";

export default SpecialPokemonConflictBar;
