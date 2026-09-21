# TeamTimeline upstream impact (2026-09-21 sync)

## Status

- Fetched `upstream/main` (`87456992`) on 2026-09-21 and created `sync/upstream-main-20260921` from `develop`
  (`013a5807`).
- Merged 25 upstream commits (merge base `8195e59b`, the previous sync point).
- `git merge upstream/main` completed without conflicts. All fork seams listed in `document/upstream-sync.md`
  were reviewed and are intact.
- `npm run verify` passes: typecheck, lint, 1799 tests (143 files), build.

## Upstream changes that affect TeamTimeline

### 1. Big berry (とてもおおきなマゴのみ) is now data-driven upstream

- `src/data/BigBerry.ts` (new): `getBigBerryRate(eventName, pokemon)` returns the per-help pickup rate and the
  number of berries per pickup. For `"mewtwo1"`: Mew / Mewtwo 12 % × 2 berries, other Psychic types 6 % × 1,
  everything else 3 % × 1. Any other event name returns 0.
- `BonusEffects.bigBerry: string` (event name, `""` when inactive) and `BonusEffects.globalCarryLimitAdd`
  (carry limit add applied to every Pokémon regardless of the event `target`). `event.json` moved the
  "ミュウツーをおいかけて" 1st / 2nd week carry-limit bonuses (+15 / +8) from `carryLimitAdd` to
  `globalCarryLimitAdd` and set `bigBerry: "mewtwo1"` on both weeks.
- `PokemonStrength.bonusEffects` (`BonusEffectsWithReason`) now exposes `bigBerryRate` / `bigBerryCount`
  resolved for the Pokémon, and folds `globalCarryLimitAdd` into `carryLimitAdd`.
- `getBerryStrength(type, level, fieldBonus, multiplier, isBig)` multiplies the raw strength by 10 for a big
  berry before the area bonus is applied. Upstream's `Help.ts` rolls the pickup once per normal help after the
  berry / ingredient outcome, only while inventory space remains, and never brings more than the remaining
  space (`min(count, carryLimitLeft)`).

Effect on the extension:

- `buildPokemonBonusContext` reads `strength.bonusEffects.carryLimitAdd`, so the event carry-limit bonus
  keeps working (it now comes from `globalCarryLimitAdd` and applies to every Pokémon, as in the game).
- The fork's provisional "とてもおおきなマゴのみ" model (user-entered rates and energy multiplier) is superseded
  by the upstream data. It was replaced in the follow-up commits on `develop` (see below).

### 2. Berry Zone (Psystrike) skill data is complete upstream

No new values in this sync beyond the previous one (`getSkillValue` `[1408, 2002, 2762, 3813, 5264, 7274]`,
`getSkillSubValue` `[0.6, 0.8, 1, 1.2, 1.6, 2]` % per trigger). Upstream still only accumulates the zone
rate as a statistic (`skillBerryZone`). The remaining unknown, the cap of the zone effect, is published as
+24 % (see `document/teamtimeline-berry-zone.md`), so the fork's provisional stack model was replaced in the
follow-up commits.

### 3. Charge Strength S (Random) Lv7 range changed (automatic)

`getSkillRandomRange("Charge Strength S (Random)", 7)` is now `[1606, 6424]` (was `[1501, 6004]`; game
version 3.2.0). `SkillEffectProcessor` calls the shared helper, so the new range is used without code changes.

### 4. Upstream team simulation refactors (no impact)

`src/util/Team/**`: `SkillMetrics.ts` centralises the per-skill result fields, `InventoryBonus` moved to its
own file (`src/util/InventoryBonus.ts`, re-exported type only), `HelpCount.ts` simplified its state to the
used inventory space and gained big berry tracking, Heal Pulse targeting fixed, `TeamView` refactored.
TeamTimeline does not import anything from `src/util/Team` and its `HelpCalculator` is independent of
`HelpCount.ts`.

### 5. UI-only changes (no impact)

`MagoBerry.tsx` icon, `BerryArticle` / `StrengthBerryIngSkillView` / `DailyView` show big berry counts,
`EventConfigDialog` gained the big berry event selector, `mewtwo warning` text updated. TeamTimeline has its
own icons and event handling.

## Follow-up (done on `develop` right after this sync)

- Removed the "仮設定（未確定パラメータ）" panel from the TeamTimeline settings screen.
  - Berry Zone: strength per trigger from `getSkillValue`, zone rate per trigger from `getSkillSubValue`,
    capped at +24 %, always on. Documented in `document/teamtimeline-berry-zone.md`.
  - とてもおおきなマゴのみ: pickup rate / count from `bonusEffects.bigBerryRate` / `bigBerryCount` (active
    only while the selected event defines `bigBerry`), energy = big berry strength (×10) of a Mago berry.
  - データ未公開ポケモンの仮ステータス: removed; no placeholder Pokémon exist in `pokemon.json`.
- `document/teamtimeline-provisional-settings.md` was replaced by `document/teamtimeline-berry-zone.md`.
