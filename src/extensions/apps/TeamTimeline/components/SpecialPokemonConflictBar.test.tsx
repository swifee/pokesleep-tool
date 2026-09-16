import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SpecialPokemonConflictBar from "./SpecialPokemonConflictBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
	}),
}));

vi.mock("../../../../ui/IvCalc/PokemonIcon", () => ({
	default: ({ idForm }: { idForm: number }) => (
		<span data-testid={`pokemon-icon-${idForm}`} />
	),
}));

describe("SpecialPokemonConflictBar", () => {
	it("renders nothing without conflicts", () => {
		const { container } = render(<SpecialPokemonConflictBar entries={[]} />);
		expect(container.firstChild).toBeNull();
	});

	it("shows the rule and every conflicting Pokémon", () => {
		render(
			<SpecialPokemonConflictBar
				entries={[
					{
						pokemonId: 10,
						pokemonIdForm: 150,
						pokemonShiny: false,
						name: "ミュウツー",
					},
					{
						pokemonId: 11,
						pokemonIdForm: 491,
						pokemonShiny: true,
						name: "ダークライ",
					},
				]}
			/>,
		);
		const bar = screen.getByTestId("special-pokemon-conflict-bar");
		expect(bar.textContent).toContain("同時に1体まで");
		expect(bar.textContent).toContain("ラティアス＋ラティオス");
		const entries = screen.getAllByTestId("special-pokemon-conflict-entry");
		expect(entries).toHaveLength(2);
		expect(entries[0].textContent).toBe("ミュウツー");
		expect(entries[1].textContent).toBe("ダークライ");
		expect(screen.getByTestId("pokemon-icon-150")).not.toBeNull();
		expect(screen.getByTestId("pokemon-icon-491")).not.toBeNull();
	});
});
