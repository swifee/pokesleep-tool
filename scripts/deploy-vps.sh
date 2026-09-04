#!/usr/bin/env bash
#
# Build locally and publish `dist/` to the self-hosted VPS.
#
# The VPS runs on a 954 MB instance and cannot build this project, so the
# artifacts are always produced here and streamed over ssh with tar.
# Caddy serves the uploaded directory under /pokesleep-tool/, which must match
# `base` in vite.config.ts and the service worker path in src/index.tsx.
#
# Usage (from the repository root, Git Bash on Windows or any POSIX shell):
#   npm run deploy
#   npm run deploy -- --skip-verify
#   npm run deploy -- --dry-run
#
# Connection settings are read from scripts/deploy-vps.env (git-ignored).
# Copy scripts/deploy-vps.env.example to get started. Environment variables of
# the same name take precedence over the file.

set -euo pipefail

# Git Bash rewrites arguments that look like POSIX paths into Windows paths
# before handing them to native binaries. `git` depends on that, so the two ssh
# calls below disable it inline, for themselves only, to keep the remote paths
# intact. Exporting it for the whole script breaks `git`.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly ENV_FILE="${REPO_ROOT}/scripts/deploy-vps.env"
readonly DIST_DIR="${REPO_ROOT}/dist"
readonly PUBLIC_BASE_PATH="/pokesleep-tool/"

# Guard against wiping something like `/` or `/var`: `/var/www/pokesleep-tool`
# has three slashes, so anything shallower is rejected.
readonly MIN_REMOTE_DIR_DEPTH=3

readonly CONFIG_KEYS="DEPLOY_HOST DEPLOY_REMOTE_DIR DEPLOY_USER DEPLOY_PORT DEPLOY_SSH_KEY DEPLOY_VERIFY_URL"

skip_verify=false
dry_run=false

usage() {
	cat <<'USAGE'
Usage: npm run deploy [-- <options>]

Options:
  --skip-verify   Skip typecheck/lint/test and only run the production build.
  --dry-run       Print the deployment plan without touching the VPS.
  -h, --help      Show this help.

Configuration (scripts/deploy-vps.env, or environment variables):
  DEPLOY_HOST         Hostname or IP of the VPS.               (required)
  DEPLOY_REMOTE_DIR   Absolute directory served by Caddy.       (required)
  DEPLOY_USER         SSH user.                                 (default: ubuntu)
  DEPLOY_PORT         SSH port.                                 (default: 22)
  DEPLOY_SSH_KEY      Private key passed to ssh -i.             (optional)
  DEPLOY_VERIFY_URL   URL printed after a successful deploy.    (optional)
USAGE
}

log() {
	printf '==> %s\n' "$*"
}

die() {
	printf 'error: %s\n' "$*" >&2
	exit 1
}

parse_args() {
	while [ $# -gt 0 ]; do
		case "$1" in
			--skip-verify) skip_verify=true ;;
			--dry-run) dry_run=true ;;
			-h | --help)
				usage
				exit 0
				;;
			*) die "unknown option: $1 (try --help)" ;;
		esac
		shift
	done
}

# Reads scripts/deploy-vps.env, then applies defaults. A variable that is set in
# the environment wins over the file, including when it is set to an empty
# string, so `DEPLOY_SSH_KEY= npm run deploy` really does drop the key.
load_config() {
	local key overrides=""
	for key in $CONFIG_KEYS; do
		if [ -n "${!key+set}" ]; then
			overrides+="${key}=$(printf '%q' "${!key}")"$'\n'
		fi
	done

	if [ -f "$ENV_FILE" ]; then
		# shellcheck disable=SC1090
		. "$ENV_FILE"
	fi

	eval "$overrides"

	DEPLOY_HOST="${DEPLOY_HOST:-}"
	DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-}"
	DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
	DEPLOY_PORT="${DEPLOY_PORT:-22}"
	DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-}"
	DEPLOY_VERIFY_URL="${DEPLOY_VERIFY_URL:-}"
}

validate_config() {
	if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_REMOTE_DIR" ]; then
		die "DEPLOY_HOST and DEPLOY_REMOTE_DIR are required; see scripts/deploy-vps.env.example"
	fi

	case "$DEPLOY_REMOTE_DIR" in
		/*) ;;
		*) die "DEPLOY_REMOTE_DIR must be an absolute path: ${DEPLOY_REMOTE_DIR}" ;;
	esac
	case "$DEPLOY_REMOTE_DIR" in
		*/) die "DEPLOY_REMOTE_DIR must not end with a slash: ${DEPLOY_REMOTE_DIR}" ;;
	esac
	case "$DEPLOY_REMOTE_DIR" in
		*..* | *\'*) die "DEPLOY_REMOTE_DIR contains an unsupported character: ${DEPLOY_REMOTE_DIR}" ;;
	esac

	local depth
	depth="$(printf '%s' "$DEPLOY_REMOTE_DIR" | tr -cd '/' | wc -c)"
	if [ "$depth" -lt "$MIN_REMOTE_DIR_DEPTH" ]; then
		die "DEPLOY_REMOTE_DIR is too shallow to replace safely: ${DEPLOY_REMOTE_DIR}"
	fi
}

ssh_target() {
	printf '%s@%s' "$DEPLOY_USER" "$DEPLOY_HOST"
}

# Fills the global `ssh_opts` array shared by every ssh invocation.
build_ssh_opts() {
	ssh_opts=(-p "$DEPLOY_PORT")
	if [ -n "$DEPLOY_SSH_KEY" ]; then
		ssh_opts+=(-i "$DEPLOY_SSH_KEY")
	fi
}

report_source_revision() {
	local branch revision dirty=""
	branch="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
	revision="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
	if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
		dirty=" (working tree has uncommitted changes)"
	fi
	log "Deploying ${branch}@${revision}${dirty}"
}

build_artifacts() {
	if [ "$skip_verify" = true ]; then
		log "Building (verification skipped)"
		npm run build
		return
	fi

	log "Verifying (typecheck + lint + test + build)"
	npm run verify
}

# `npm run verify` already emits dist/, so this only guards against shipping a
# stale or wrongly based build.
check_artifacts() {
	log "Checking dist/"
	[ -f "${DIST_DIR}/index.html" ] || die "dist/index.html is missing; did the build run?"
	[ -f "${DIST_DIR}/sw.js" ] || die "dist/sw.js is missing; the service worker is required"

	if ! grep -q "$PUBLIC_BASE_PATH" "${DIST_DIR}/index.html"; then
		die "dist/index.html does not reference ${PUBLIC_BASE_PATH}; check 'base' in vite.config.ts"
	fi
}

check_remote() {
	log "Connecting to $(ssh_target)"
	MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' ssh "${ssh_opts[@]}" "$(ssh_target)" \
		"test -d '${DEPLOY_REMOTE_DIR}' && test -w '${DEPLOY_REMOTE_DIR}'" ||
		die "${DEPLOY_REMOTE_DIR} is not a writable directory on $(ssh_target)"
}

# `find -mindepth 1 -delete` replaces `rm -rf <dir>/*`: the glob leaves dotfiles
# behind and expands to nothing when the directory is already empty.
upload() {
	log "Uploading dist/ to $(ssh_target):${DEPLOY_REMOTE_DIR}"
	tar -C "$DIST_DIR" -cf - . |
		MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' ssh "${ssh_opts[@]}" "$(ssh_target)" \
			"set -e; find '${DEPLOY_REMOTE_DIR}' -mindepth 1 -delete; tar -C '${DEPLOY_REMOTE_DIR}' -xf -"
}

print_plan() {
	log "Dry run: the VPS will not be modified"
	printf '  target : %s:%s\n' "$(ssh_target)" "$DEPLOY_REMOTE_DIR"
	printf '  port   : %s\n' "$DEPLOY_PORT"
	printf '  ssh key: %s\n' "${DEPLOY_SSH_KEY:-<ssh-agent>}"
	if [ "$skip_verify" = true ]; then
		printf '  build  : npm run build\n'
	else
		printf '  build  : npm run verify\n'
	fi
	printf '  upload : tar -C dist -cf - . | ssh ... "find %s -mindepth 1 -delete; tar -C %s -xf -"\n' \
		"$DEPLOY_REMOTE_DIR" "$DEPLOY_REMOTE_DIR"
}

main() {
	parse_args "$@"
	load_config
	validate_config
	build_ssh_opts

	if [ "$dry_run" = true ]; then
		print_plan
		return 0
	fi

	report_source_revision
	build_artifacts
	check_artifacts
	check_remote
	upload

	log "Done"
	if [ -n "$DEPLOY_VERIFY_URL" ]; then
		log "Verify: ${DEPLOY_VERIFY_URL}"
	fi
}

main "$@"
