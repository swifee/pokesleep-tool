# TeamTimeline upstream impact plan

## Status

- Checked project rules and used the `$upstream-sync` workflow as far as this task requires.
- Fetched latest remotes on 2026-03-20 and created `sync/upstream-main-20260320`.
- Merged `upstream/main` into the sync branch without conflicts.

## Relevant upstream changes

The new event data is already included after the merge.

- `latias research 1st week`
  - target: `Skills`
  - effects: `skillTrigger: 1.25`, `skillLevel: 2`, `ingredient: 1`, `carryLimit: 8`
- `latias research 2nd week`
  - target: `Skills`
  - effects: `berry: 1`, `skillTrigger: 1.25`, `skillLevel: 5`, `ingredient: 1`, `carryLimit: 15`

The important upstream implementation change is that `BonusEffects.carryLimit` now exists and `PokemonStrength` returns it as a target-specific event bonus.

## What already works in TeamTimeline

- Event selection and custom event editing are shared with IV Calc through `EventConfigDialog`, so the merged branch already has the new custom `carryLimit` UI.
- Skill-type target filtering is already handled by `PokemonStrength`, so skill-only events still reach TeamTimeline on a per-Pokemon basis.
- Existing TeamTimeline paths already use event bonuses for:
  - skill trigger rate
  - skill level bonus
  - ingredient count bonus
  - berry count bonus
- `TimelineBonusSettings.customEventBonus` is normalized through `loadHelpEventBonus`, so storage and hash persistence should keep working after the merge.

## Blocking upstream compatibility fix

The sync branch does not typecheck yet because upstream moved several helpers from `PokemonRp` to `PokemonIv`.

Current errors on `npm run typecheck`:

- `HelpCalculator.ts`
  - `frequencyWithHelpingBonus` not found on `PokemonRp`
  - `ingredient1/2/3` not found on `PokemonRp`
  - `getBaseFrequency` not found on `PokemonRp`
  - `berryCount` not found on `PokemonRp`
- `SkillEffectProcessor.ts`
  - `berryCount` not found on `PokemonRp`

Required compatibility update:

- Replace these TeamTimeline calls to use `pokemon.iv` instead of `new PokemonRp(pokemon.iv)`.
- Keep `PokemonRp` only where TeamTimeline still needs RP-specific values such as ingredient strength helpers.

## Gap to fix for TeamTimeline after compatibility update

The missing part is inventory capacity handling.

### 1. Pass carry limit bonus into help simulation

Files:

- `src/extensions/apps/TeamTimeline/simulation/HelpCalculator.ts`
- `src/extensions/apps/TeamTimeline/simulation/TimelineSimulator.ts`

Current behavior:

- `HelpCalculator` only expands max inventory by Good Camp Ticket.
- `TimelineSimulator` initializes `state.maxInventory` from `pokemon.iv.carryLimit`.
- no-collect overflow cleanup also uses that fixed value.

Required update:

- Extend `HelpBonusContext` with `carryLimitBonus`.
- Compute effective inventory as:

```ts
Math.ceil((maxInventory + carryLimitBonus) * (isGoodCampTicketSet ? 1.2 : 1))
```

- Use the same formula in both:
  - `calculateHelp(...)`
  - no-collect overflow handling in `TimelineSimulator`

### 2. Propagate the new bonus from PokemonStrength

File:

- `src/extensions/apps/TeamTimeline/simulation/TimelineSimulator.ts`

Current behavior:

- `buildPokemonBonusContext()` reads `bonus.skillTrigger`, `bonus.berry`, `bonus.ingredient`, etc.
- It does not forward `bonus.carryLimit`.

Required update:

- Add `carryLimitBonus: bonus.carryLimit` to the help bonus context.

### 3. Keep the formula centralized

This update touches two places with the same effective max inventory logic.

Recommended update:

- Add a small helper in TeamTimeline simulation code, for example:
  - `getEffectiveMaxInventory(baseMaxInventory, carryLimitBonus, isGoodCampTicketSet)`

This avoids a future mismatch between:

- help calculation
- no-collect overflow cleanup

## Test updates needed

### HelpCalculator

File:

- `src/extensions/apps/TeamTimeline/simulation/HelpCalculator.test.ts`

Add cases for:

- `carryLimitBonus: 8` allows inventory growth beyond the base max.
- `carryLimitBonus` and Good Camp Ticket stack with the same formula.

### TimelineSimulator

File:

- `src/extensions/apps/TeamTimeline/simulation/TimelineSimulator.test.ts`

Add cases for:

- custom skill event with `carryLimit: 8` changes results compared with no event
- no-collect overflow threshold follows the boosted carry limit
- a non-target Pokemon does not receive the carry limit bonus during a skill-only event

## No extra TeamTimeline UI work needed

- `TimelineBonusSettingsPanel` already uses the shared `EventConfigDialog`.
- After the upstream merge, custom event editing already exposes `carry limit`.
- No TeamTimeline-specific state schema change is required.

## Nice-to-have follow-up

There is an unrelated TODO in cooking simulation:

- `src/extensions/apps/TeamTimeline/simulation/TimelineSimulator.ts`
  - `const cookingEventBonus = 0; // TODO: extract event bonus from bonusSettings`

This is not required for the Latias event, but it remains an upstream alignment gap for future dish events.

## Suggested implementation order

1. Add `carryLimitBonus` to `HelpBonusContext`.
2. Pass it from `buildPokemonBonusContext()`.
3. Replace duplicated effective max inventory math with one helper.
4. Add the new unit/integration tests.
5. Run `npm run typecheck`, `npm run test -- src/extensions/apps/TeamTimeline`, and `npm run build`.
