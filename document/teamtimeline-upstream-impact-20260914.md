# TeamTimeline upstream impact (2026-09-14 sync)

## Status

- Fetched `upstream/main` (`8195e59b`) on 2026-09-14 and created `sync/upstream-main-20260914` from `develop`.
- Merged 19 upstream commits (merge base `aec938d7`, the previous sync point; the fork was 117 commits ahead).
- The local `develop` used for branching was 5 commits behind `origin/develop` (the quick-sim tab,
  `TeamTimeline: Add the quick simulation tab` and its merges). `origin/develop` was merged into the sync
  branch afterwards; that merge was conflict-free and only touched `src/extensions/**`, the fork-only
  `src/i18n/*.json` files and `document/teamtimeline-quick-sim.md`.
- `npm run verify` passes: typecheck, lint, 1525 tests, build.

## Merge conflicts and how they were resolved

None. `git merge upstream/main` completed on its own. All fork seams listed in
`document/upstream-sync.md` (`src/i18n/*.ts`, `src/i18n/*.json`, `AppConfig.ts`, `App.tsx`, `ToolBar.tsx`,
`NewsInfo.tsx`, `vite.config.ts`, `.gitignore`, `package.json`) were reviewed and are intact.

## Upstream changes that affect TeamTimeline

### 1. Mewtwo received real data in `pokemon.json` (fix required)

Upstream `8195e59b IV: Add Mewtwo` replaced the pre-release placeholder (`frequency: 0`, `ingRate: 0`,
`skillRate: 0`, `carryLimit: 0`, `unknown1..3` ingredients) with the released values:
`frequency: 2300`, `ingRate: 16`, `skillRate: 2.9`, `carryLimit: 24`, ingredients soy / corn / potato
(`1/2/4`, `2/3`, `3`).

Effect on the extension:

- `isPlaceholderPokemonData(Mewtwo)` is now `false`, so the "データ未公開ポケモンの仮ステータス" provisional
  setting no longer applies to Mewtwo. Mewtwo helps and triggers its skill from the real data even when that
  setting is off. After this sync there is no placeholder Pokémon left in `pokemon.json`, so the setting's
  "対象" line in `ProvisionalSettingsPanel` is empty until upstream adds the next pre-release Pokémon.
- The merge itself was clean, but six tests in three files assumed Mewtwo was the placeholder:
  `TimelinePokemonUtils.test.ts` (4), `TimelineSimulator.berryZone.test.ts` (1),
  `ProvisionalSettingsPanel.test.tsx` (1). Resolution:
  - New `utils/PlaceholderPokemonTestHelpers.ts` builds a synthetic placeholder in the exact shape
    upstream used for Mewtwo before release (Berry Zone (Psystrike), Psychic, all rates 0) and registers it
    in the `pokemons` list for the duration of a test file (`registerPlaceholderPokemon()` in `beforeAll`,
    the returned unregister function in `afterAll`). Vitest isolates module state per test file, so the
    entry never leaks.
  - The placeholder tests now use that synthetic Pokémon. Regression tests were added asserting that Mewtwo
    is not treated as a placeholder, that provisional stats are not applied to it, and that the real-data
    Mewtwo helps and stacks Berry Zone with the provisional stat switched off.

Behavioural change for users: a Mewtwo that was being simulated with the provisional stats now uses the real
species values (2300 s base frequency, 2.9 % skill rate, carry limit 24) regardless of the provisional
setting.

### 2. Berry Zone (Psystrike) skill values published (no code change, provisional defaults are now stale)

Upstream added the released numbers to the shared helpers:

- `MainSkill.getSkillValue("Berry Zone (Psystrike)")`: `[1408, 2002, 2762, 3813, 5264, 7274]` Snorlax
  strength per trigger; `PokemonStrength` multiplies by the field bonus and rounds up, like Charge Strength.
- `MainSkill.getSkillSubValue("Berry Zone (Psystrike)")`: `[0.6, 0.8, 1, 1.2, 1.6, 2]`, the
  "きのみゾーン増加率" in percent per trigger. Upstream only accumulates this as a statistic
  (`skillBerryZone`); its IvCalc still shows the "mewtwo warning" that Berry Zone and Very Big Mago Berries
  are not simulated.
- `PokemonRp`: RP table for the skill (`[2448, 3383, 4488, 5884, 8026, 10726]`, SLv3-6 estimated), and
  `RpLabel` marks Mewtwo RP as estimated unless skill level is 2.

TeamTimeline does not call `getSkillValue` for Berry Zone; `SkillEffectProcessor` reads the Snorlax energy
from `BerryZoneProvisionalSettings.snorlaxEnergyByLevel`, whose default is still the Charge Strength S table
`[400, 569, 785, 1083, 1496, 2066]`, roughly 3.5x lower than the released values. Nothing fails, the numbers
are just provisional. The stack-count × bonus-percent model for the Mago berry multiplier remains the
fork's own assumption; upstream has not published how the increase rate maps to berry strength.

### 3. Upstream team simulation: candy and Berry Zone tracking (no impact)

`src/util/Team/**` changes: `BerryZonePsystrike` skill class wired into `SkillFactory`; `skillCandy` and
`skillBerryZone` added to `TeamMemberStrengthResult`, `MemberProgress` and `IterationResult`;
`TeamStrengthResult.total` removed (callers aggregate `members` themselves); Versatile now yields 1 candy
per trigger plus `getSkillSubValue("Versatile")` on a `versatileSuccessRate` (30 %) success; Ingredient
Magnet S (Present) yields `floor(getSkillSubValue × bonus)` candy with `presentCandyRate` (34.4 %);
`SkillCopy` now bases the copied profile on the target profile. `DailyView` shows the two new totals.

TeamTimeline does not import anything from `src/util/Team`, and its own Present / Versatile candy handling
in `SkillEffectProcessor` already uses `presentCandyRate` and `getSkillSubValue`, which did not change.

### 4. UI-only changes (no impact)

`MainSkillIcon` renders the new `BerryZoneIcon` for Berry Zone skills (`second` variant for Psystrike),
`SkillDetailDialog` / `SkillHelpDialog` show the Berry Zone strength and increase rate. TeamTimeline has its
own `TimelineIcons` and does not use `MainSkillIcon`.

### 5. Data-only changes (no code needed)

`news.json` gained the `add mewtwo` entry for IvCalc; `NewsInfo.tsx` already returns `null` for
`TeamTimeline`. `src/i18n/*/IvCalc.json` gained `berry zone increase rate` and reworded `mewtwo warning`;
the fork-only `src/i18n/*.json` files were untouched by upstream.

## Follow-up

- Replace `BerryZoneProvisionalSettings.snorlaxEnergyByLevel` with `getSkillValue("Berry Zone (Psystrike)",
  level)` (plus the field bonus, as `PokemonStrength` does) and drop the per-level input from
  `ProvisionalSettingsPanel`; keep only the stack / berry-bonus parameters provisional until upstream models
  the zone effect.
- Consider surfacing upstream's "きのみゾーン増加率" (`getSkillSubValue`) in TeamTimeline's Berry Zone
  analysis so the two apps report the same per-trigger statistic.
- `PlaceholderPokemonProvisionalSettings` currently has no target. Keep it for the next pre-release Pokémon,
  or hide the panel section when `pokemons.filter(isPlaceholderPokemonData)` is empty.
