# TeamTimeline upstream impact (2026-09-13 sync)

## Status

- Fetched `upstream/main` (`aec938d7`) on 2026-09-13 and created `sync/upstream-main-20260913` from `develop`.
- Merged 52 upstream commits (the fork was 95 commits ahead; merge base `6744583d`, the previous sync point).
- `npm run verify` passes: typecheck, lint, 1385 tests, build.

Before the merge, `origin/develop` had been force-pushed with the same six fork commits under new
hashes (identical trees, messages and dates). Local `develop` was reset to `origin/develop` before
branching; nothing was lost.

## Merge conflicts and how they were resolved

None. `git merge upstream/main` completed on its own. All fork seams listed in
`document/upstream-sync.md` (`src/i18n/*.ts`, `AppConfig.ts`, `App.tsx`, `ToolBar.tsx`,
`NewsInfo.tsx`, `vite.config.ts`, `.gitignore`, `package.json`) were reviewed and are intact.

`package.json` took upstream's `typecheck` script, which now also checks the new
`tsconfig.worker.json` (upstream's team simulation Web Worker).

## Upstream changes that affect TeamTimeline

### 1. `StrengthParameter.mew` removed (fix required)

Upstream `aae9273b IV: Fix Mew's skill rate` dropped the user-editable Mew overrides
(`MewParameter`: `ing`, `skill1..3`, `success`). Mew's ingredient rate now comes straight from
`pokemon.json` (`ingRate: 20`, `rateNotFixed` removed) and the skill rate is a fixed table keyed by the
selected Versatile skill: 6.4% for Charge Strength S (Random) / Charge Energy S, 4.39% for
Energizing Cheer S, 3.37% for Energy for Everyone S, 2.84% for Berry Burst, 4% otherwise. The
Versatile candy success rate is the new constant `versatileSuccessRate = 0.3`.

The merge itself was clean, but `TimelinePokemonUtils.normalizeTimelinePokemonIv` still read
`strengthParameter.mew`, so `tsc` failed. Resolution:

- `getMewSkillRate` in `TimelinePokemonUtils.ts` now mirrors upstream's table
  (`MEW_SKILL_RATE_BY_VERSATILE_SKILL` / `MEW_DEFAULT_SKILL_RATE`).
- The `baseIngRate` override was removed; the data value is used as-is.
- `normalizeTimelinePokemonIv` / `normalizeTimelinePokemon` no longer take a `StrengthParameter`.
  The only caller (`TimelineSimulator.runSimulation`) was updated.
- Tests that asserted the stored Mew settings were carried through (`TimelinePokemonUtils.test.ts`,
  `TimelineBonusSettingsBridge.test.ts`, `TimelineSimulator.test.ts`) now assert the fixed rates.

Behavioural change for users: a Mew rate previously tuned in the IV calculator's Mew dialog is no
longer applied to TeamTimeline. Upstream removed the dialog too, so the two apps stay consistent.

### 2. `calculateBerryBurstStrength` signature extended

A fifth optional `skillName` parameter was added and missing team members now default to level 0 /
Normal type instead of throwing. TeamTimeline's existing calls pass four arguments and are unaffected.

### 3. `MainSkill` helpers

- `getSkillSubValue("Ingredient Magnet S (Plus)")` no longer throws for ingredients other than
  coffee / milk; it falls back to the coffee table (used by Skill Copy / Metronome).
- New exports `getIngredientDrawIngredientsById` and `getStockpileStrength`. Not used by the fork yet.

### 4. `Energy.getEnergyRecoveryForCook` became a module-level export

Moved out of the `Energy` class. TeamTimeline does not call it.

### 5. `NumberUtil.round1/2/3` now format negative values correctly

Previously `round1(-1.5)` produced garbage; the sign is now preserved. TeamTimeline uses these for
display only, so any negative deltas shown in analysis views will now render with a leading `-`.

### 6. Upstream team feature (no impact)

The bulk of the diff (`src/util/Team/**`, `src/ui/IvCalc/Team/**`, `useTeamSimulation`,
`teamSimulation.worker.ts`, `tsconfig.worker.json`) is upstream's new Monte Carlo team simulation
tab in the IV calculator. It is self-contained and does not touch TeamTimeline code paths. It is a
possible future source for cross-checking TeamTimeline's own simulation.

### 7. Data-only changes (no code needed)

`news.json` gained the `team` and `mew` entries for IvCalc; `NewsInfo.tsx` already returns `null`
for `TeamTimeline`, so nothing shows there.

## Follow-up

- Consider replacing TeamTimeline's private `getMewSkillRate` copy with an upstream export if
  upstream ever exposes it from `PokemonStrength`.
- Upstream's `src/util/Team` simulation covers skills TeamTimeline models independently
  (Metronome, Skill Copy, Energizing Cheer, ...). Compare results for a shared team as a regression
  check in a later sync.
