# TeamTimeline upstream impact (2026-09-02 sync)

## Status

- Fetched `upstream/main` on 2026-09-02 and created `sync/upstream-main-20260902` from `develop`.
- Merged 152 upstream commits (the fork was 73 commits ahead; merge base `4cb162f0`, the previous sync point).
- `npm run verify` passes: typecheck, lint, 1203 tests, build.

## Merge conflicts and how they were resolved

Eight files conflicted.

| File | Resolution |
|---|---|
| `CLAUDE.md`, `.claude/settings.json` | Kept deleted. The fork gitignores AI tool configs and keeps them local only. |
| `src/i18n/{en,ja,ko,zh-CN,zh-TW}.ts` | Took upstream's `IvCalcFaq` wiring and kept the fork's `TeamTimeline` legacy translations. |
| `src/ui/AppConfig.ts` | Took upstream's `tapRippleEffect` and kept the fork's `TeamTimeline` app type and news slot. |

`src/ui/App.tsx`, `src/ui/NewsInfo.tsx`, `src/ui/ToolBar.tsx`, `.gitignore` and `package.json` merged
automatically and were reviewed by hand. `package-lock.json` did not conflict: upstream left it untouched.

## Upstream changes that affect TeamTimeline

### 1. Cyan Beach (Expert)

`cbexFieldIndex = 8` is a second expert field with its own berry speed modifiers
(main +0.2 / non-favorite -0.35, versus Greengrass Isle's +0.1 / -0.15) and a +5 carry limit.

- `PokemonIv.getBaseFrequency` gained a fifth `fieldIndex` parameter, defaulting to Greengrass Isle.
  TeamTimeline now passes the simulated field through `HelpBonusContext.fieldIndex`.
- The carry limit bonus needed no work: `PokemonStrength.bonusEffects.carryLimitAdd` already folds in
  `cbexCarryLimitAdd`, and `buildPokemonBonusContext` reads that field.
- `MAX_FIELD_INDEX` in `TimelineBonusSettingsBridge` is derived from `fields.length`, so the new field
  became selectable with no change.

Note: upstream is internally inconsistent here. `PokemonStrength.bonusEffects` adds the +5 to every
Pokemon on Cyan Beach (Expert), while `FrequencyInfoPanel` only adds it for the main berry.
TeamTimeline follows `PokemonStrength`, which is the path the simulation already used.

### 2. Cooking pot size event bonus

`BonusEffects.potSize` (1 / 1.6 / 2) is new. `packed portion cooking week 1` uses 1.6 and
`week 2` uses 2. `calculateEffectivePotCapacity` now multiplies the base capacity by it alongside the
Good Camp Ticket multiplier, then adds the Cooking Power-Up bonus as before.

### 3. Recipe level limit 65 -> 70

`recipeLevelBonus` and upstream's recipe level validation now go to 70. The fork had `65` hardcoded in
six places; they now share `MIN_RECIPE_LEVEL` / `MAX_RECIPE_LEVEL` from `types/CookingTypes.ts`.

### 4. New main skills

- `Dream Shard Magnet S (Aura Sphere)` (Lucario) shares the skill value table with
  `Dream Shard Magnet S`, so `classifySkill` and `isNonEPSkill` treat it the same way.
  It was deliberately **not** added to `METRONOME_SKILL_POOL`: the pool already contains the generic
  Dream Shard Magnet S, and adding the Lucario-specific variant would double that skill's draw weight.
- `Berry Zone` / `Berry Zone (Psystrike)` ship as placeholders with no skill values upstream.
  They are now simulated through user-supplied provisional settings; see
  `document/teamtimeline-provisional-settings.md`.

### 5. Placeholder Pokemon caused an infinite loop (fixed)

Upstream adds unreleased Pokemon with `frequency: 0` and `carryLimit: 0` (Mewtwo, at the time of this
sync). `calculateHelp` divided by that frequency, produced an infinite help count and never returned,
freezing the simulation. `calculateHelp` now returns early when the effective frequency is not a
positive finite number.

### 6. Data-only changes (no code needed)

Mewtwo, Pikachu (Captain), Tinkaton, Hawlucha and their evolutions, the `Pursue Mewtwo` and
Collaboration Week events, and the Cyan Beach (Expert) field data all flow in through `src/data/*.json`
and are selectable in TeamTimeline as-is.

### 7. Upstream API change requiring a fix

`BoxSortConfigFooter` made `sx` a required prop. TeamTimeline's box select dialog passes an empty
style object because `FooterArea` already handles the spacing.

## Follow-up

- Replace the `Berry Zone` provisional parameters with upstream's values once they are published
  (see `document/teamtimeline-provisional-settings.md`).
- Re-check the Cyan Beach (Expert) carry limit rule if upstream reconciles
  `PokemonStrength.bonusEffects` with `FrequencyInfoPanel`.
