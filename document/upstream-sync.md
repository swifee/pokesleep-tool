# Upstream sync

How to pull `nitoyon/pokesleep-tool` into this fork.

The `.claude/` directory (including the `upstream-sync` skill and its PowerShell
script) is git-ignored, so this document is the tracked source of truth. Anyone
with a clean checkout can follow it without the local agent config.

## Remotes and branches

| Name | Repository | Role |
|---|---|---|
| `origin` | `swifee/pokesleep-tool` | This fork. |
| `upstream` | `nitoyon/pokesleep-tool` | Source project. |

- `develop` is the working branch and the base for every PR.
- `main` is release-only; never push to it directly.
- Each sync happens on a throwaway `sync/upstream-main-<YYYYMMDD>` branch that is
  merged into `develop` through a PR.

`gh` must always be told the target explicitly, per
`.claude/rules/dev-environment.md`:

```bash
gh pr create --repo swifee/pokesleep-tool --base develop ...
```

## Procedure

```bash
# 1. Start from a clean tree on an up-to-date develop.
git status --porcelain            # must be empty
git fetch origin
git fetch upstream
git switch develop
git pull --ff-only origin develop

# 2. Merge upstream onto a sync branch.
git switch -c "sync/upstream-main-$(date +%Y%m%d)"
git merge upstream/main

# 3. Resolve conflicts (see below), then verify.
npm run verify

# 4. Publish.
git push -u origin HEAD
gh pr create --repo swifee/pokesleep-tool --base develop \
  --title "sync: merge upstream/main into develop" \
  --body "Automated upstream synchronization."
```

If `git merge upstream/main` reports *Already up to date*, delete the sync branch
and stop.

Never `git reset --hard` or `git checkout --theirs` a whole file to get past a
conflict: every conflicting file below carries fork-only code that upstream does
not have.

## Files that conflict on almost every sync

These are the seams where the fork edits upstream-owned files. Keep both sides.

| File | Fork-only content |
|---|---|
| `src/i18n/{en,ja,ko,zh-CN,zh-TW}.ts` | `import legacy from "./<lang>.json"` plus `TeamTimeline: legacy.translation.TeamTimeline`. Upstream keeps splitting these barrels into `src/i18n/<lang>/*.json`, so take upstream's new imports and re-add the two fork lines. |
| `src/i18n/{en,ja,ko,zh-CN,zh-TW}.json` | Fork-only files holding the TeamTimeline strings. Upstream deleted them when it split translations; keep them. |
| `src/ui/AppConfig.ts` | `"TeamTimeline"` in the `AppType` union and a `TeamTimeline` slot in `news` (default object, `loadConfig` parsing). |
| `src/ui/App.tsx` | `TeamTimelineApp` import, the `curApp === "TeamTimeline"` render branch, and the `/pokesleep-tool/timeline/` route in `useRouter`. |
| `src/ui/ToolBar.tsx` | The `teamTimelineClick` handler and its `MenuItem`. |
| `src/ui/NewsInfo.tsx` | The early `return null` for `appType === "TeamTimeline"`. |
| `.gitignore` | The fork ignores AI tool configs (`AGENTS.md`, `CLAUDE.md`, `.claude/`, …) and `scripts/deploy-vps.env`. Upstream's `.claude/settings.local.json` entries are superseded. |
| `CLAUDE.md`, `.claude/settings.json` | Deleted in the fork on purpose. Keep them deleted. |
| `package.json` | The `deploy` script and the explicit `typescript` devDependency. |
| `CONTRIBUTING.md` | The fork's "Branch Workflow" section. |

Whole-file diffs on Markdown usually mean line endings, not content:
`.gitattributes` pins `* text=auto eol=lf` in this fork.

## Changes that merge cleanly but still break the fork

`src/extensions/apps/TeamTimeline` is built on upstream simulation code, so an
upstream refactor can pass `git merge` and still break behaviour. The heaviest
dependencies are:

- `src/util/PokemonBox`, `src/util/PokemonIv`, `src/util/PokemonStrength`,
  `src/util/PokemonRp`, `src/util/MainSkill`, `src/util/SubSkill`
- `src/data/pokemons`, `src/data/fields`, `src/data/events`, `src/data/RecipeData`
- `src/ui/IvCalc/PokemonIcon`, `src/ui/IvCalc/IngredientIcon`,
  `src/ui/IvCalc/Strength/EventConfigDialog`

Past syncs show the recurring shapes:

- Helpers move between `PokemonRp` and `PokemonIv`, or gain parameters
  (`getBaseFrequency` grew a `fieldIndex` argument). Typecheck catches these.
- New `BonusEffects` fields (`carryLimit`, `potSize`) need explicit wiring into
  `TimelineBonusSettingsBridge`; nothing fails, the numbers are just wrong.
- Constants shift (recipe level cap 65 → 70). Grep for hardcoded copies in
  `src/extensions` and move them into `src/extensions/apps/TeamTimeline/types`.
- New fields and events appear in `src/data`; check that placeholder or
  unreleased entries do not hang the simulation.

`npm run verify` is the gate, but a green build is not proof the simulation is
still right — diff `upstream/main` against the previous sync point and read the
data and simulation changes.

## After the merge

1. `npm run verify` (typecheck + lint + test + build).
2. Exercise TeamTimeline in `npm run dev`, including cooking and event bonuses.
3. Write `document/teamtimeline-upstream-impact-<YYYYMMDD>.md` recording the
   conflicts, their resolutions, and the upstream changes that affected the
   extension. See `document/teamtimeline-upstream-impact-20260902.md` for the
   expected shape.
4. Open the PR into `develop`, then deploy with `npm run deploy`
   (see `document/deploy-vps.md`).

## Notes

- Upstream's `.github/workflows/deploy.yml` is guarded by
  `github.repository_owner == 'nitoyon'`, so it never runs on this fork and needs
  no local change. `.github/workflows/ci.yml` runs `npm run verify` on every push
  and pull request and applies to the fork as-is.
- Pushing and opening a PR are outward-facing actions. Confirm before running
  step 4.
