# Deploying to the self-hosted VPS

This fork is published twice:

- Upstream's GitHub Pages workflow (`.github/workflows/deploy.yml`) is guarded by
  `github.repository_owner == 'nitoyon'` and never runs here.
- A private build is served from a VPS behind Tailscale, updated by
  `scripts/deploy-vps.sh`.

## Why the build is local

The VPS is an Oracle Cloud AMD micro instance with 954 MB of RAM, which is not
enough to run Vite. The build always happens on the development machine and only
the finished `dist/` is shipped, streamed over ssh with `tar` so no intermediate
archive is written.

The VPS is also unreachable from GitHub Actions: it is only exposed through
Tailscale, and its OCI security list opens port 22 alone. Deploying from CI is
therefore not an option — `npm run deploy` is always run by hand.

## The `/pokesleep-tool/` prefix is load-bearing

Caddy serves the site under `/pokesleep-tool/` via `handle_path`, and the app
assumes that prefix in two places:

- `base: "/pokesleep-tool/"` in `vite.config.ts`
- `navigator.serviceWorker.register("/pokesleep-tool/sw.js")` in `src/index.tsx`

Do not change either. The deploy script fails early if `dist/index.html` stops
referencing the prefix, or if `dist/sw.js` is missing.

## First-time setup

```bash
cp scripts/deploy-vps.env.example scripts/deploy-vps.env
```

Then edit `scripts/deploy-vps.env`. It is git-ignored: this fork is public and
the VPS address is reachable from the internet on port 22, so the connection
details stay out of the repository.

| Variable | Meaning |
|---|---|
| `DEPLOY_HOST` | Hostname or IP of the VPS. Prefer the Tailscale MagicDNS name when the machine is on the tailnet. |
| `DEPLOY_REMOTE_DIR` | Absolute directory Caddy serves. Everything below it is deleted and replaced on each deploy. |
| `DEPLOY_USER` | SSH user (default `ubuntu`). |
| `DEPLOY_PORT` | SSH port (default `22`). |
| `DEPLOY_SSH_KEY` | Key passed to `ssh -i`. Leave empty to use ssh-agent or `~/.ssh/config`. |
| `DEPLOY_VERIFY_URL` | Printed on success so the result is easy to open. |

Environment variables of the same name override the file for a single run, and
an explicitly empty value wins too:

```bash
DEPLOY_HOST=apps.tail935846.ts.net npm run deploy
DEPLOY_SSH_KEY= npm run deploy          # use ssh-agent instead of the file's key
```

## Deploying

```bash
npm run deploy
```

Run it from the repository root. On Windows this goes through Git Bash; the
script disables MSYS path conversion so the remote paths reach the VPS intact.

The script:

1. prints the branch, commit, and whether the tree is dirty;
2. runs `npm run verify` (typecheck → lint → test → build);
3. checks `dist/index.html`, `dist/sw.js`, and the `/pokesleep-tool/` prefix;
4. checks that the remote directory exists and is writable;
5. streams `dist/` over ssh, clearing the remote directory first.

Options:

```bash
npm run deploy -- --dry-run       # print the plan, touch nothing
npm run deploy -- --skip-verify   # build only, skipping typecheck/lint/test
```

`--skip-verify` is for re-uploading a build you already verified. Do not use it
to ship something that has not passed `npm run verify`.

## Notes

- The remote directory is emptied with `find <dir> -mindepth 1 -delete` rather
  than `rm -rf <dir>/*`, which would leave dotfiles behind and fail on an empty
  directory. The script refuses any remote directory shallower than three path
  segments so a misconfiguration cannot wipe `/var`.
- The upload is not atomic: the site is briefly empty between the delete and the
  extract. That is acceptable for a private, single-user deployment.
- Caddy's `Caddyfile` and the systemd units live on the VPS and are managed
  outside this repository. Nothing here touches them.
- Clients cache aggressively through the service worker. After a deploy, a hard
  reload may be needed before the new version appears.
- Each app needs its own HTML entry points in `vite.config.ts`, because the
  router in `src/ui/App.tsx` picks the app from `window.location.pathname` and
  Caddy's `file_server` only serves files that exist. `timeline/index*.html` and
  `public/timeline/` mirror `iv/` for that reason; adding another app means
  adding both.
- TeamTimeline has no artwork of its own, so `public/timeline/favicon.svg` and
  `logo192.png` are copies of the Research Calc icons. Replace them when a
  dedicated icon exists.
