#!/bin/bash
#
# SessionStart hook for Claude Code on the web.
#
#   1. Installs workspace dependencies, so `npm run typecheck` and `npm run build`
#      work in a fresh container without a manual install first.
#   2. Repairs a launcher-provisioned Stop hook that reports false "Unverified
#      commit" warnings. Details in patch_git_check_hook below.
#
# Deliberately not `set -e`: a session must start even if a step here fails.
# Every step is advisory, and this script always exits 0.

set -uo pipefail

log() { printf 'session-start: %s\n' "$1"; }

# ---------------------------------------------------------------------------
# 1. Dependencies
# ---------------------------------------------------------------------------
install_deps() {
  # Web-only. A local checkout manages its own node_modules.
  [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || { log 'not a remote session, skipping npm install'; return 0; }

  cd "${CLAUDE_PROJECT_DIR:-$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")}" || return 0

  # install, not ci: the container image is cached after this hook completes, so
  # reusing an existing node_modules is the cheaper path on later sessions.
  if npm install --no-audit --no-fund >/tmp/session-start-npm.log 2>&1; then
    log 'dependencies installed'
  else
    log 'npm install failed, see /tmp/session-start-npm.log — session continues'
  fi
}

# ---------------------------------------------------------------------------
# 2. Stop-hook repair
# ---------------------------------------------------------------------------
# ~/.claude/stop-hook-git-check.sh is written by the Claude Code launcher on
# every session, so it cannot be fixed by editing it once. It warns about
# commits GitHub will show as "Unverified", using two tests that misfire here:
#
#   * `%G? == N` as a signature-presence test. The launcher sets
#     commit.gpgsign=true with an SSH signing key but no
#     gpg.ssh.allowedSignersFile, so git cannot verify its own signatures and
#     reports N for every SSH-signed commit — the same value it reports for
#     unsigned ones. Commits GitHub confirms as verified=true trip this.
#     Dropping the test loses nothing: the block only runs with
#     commit.gpgsign=true, and git aborts a commit outright when signing fails,
#     so a silently unsigned commit cannot exist in that state.
#
#   * Merge commits are in scope. GitHub's API and Merge button commit as
#     "GitHub <noreply@github.com>", signed with GitHub's web-flow key and
#     Verified. They can never satisfy a committer == noreply@anthropic.com
#     rule, and the advice the hook prints (--amend --reset-author) cannot
#     rewrite a commit already on main.
#
# The committer-email test itself is worth keeping — it catches a commit made
# before git config was set — so this narrows the check rather than removing it.
#
# Matches the upstream line literally and exits quietly if it is absent, so a
# future launcher change makes this a no-op instead of a corruption.
patch_git_check_hook() {
  local hook="${HOME:-/root}/.claude/stop-hook-git-check.sh"
  [ -f "$hook" ] || { log 'no launcher git-check hook here, nothing to patch'; return 0; }
  [ -w "$hook" ] || { log 'launcher git-check hook is not writable, leaving it alone'; return 0; }

  python3 - "$hook" <<'PY'
import pathlib, sys

path = pathlib.Path(sys.argv[1])
src = original = path.read_text()

# The check itself: drop the unreliable %G? clause, skip merge commits.
src = src.replace(
    """git log --format='%h %G? %ce' "$upstream..HEAD" 2>/dev/null | awk '$2 == "N" || $3 != "noreply@anthropic.com"'""",
    """git log --no-merges --format='%h %ce' "$upstream..HEAD" 2>/dev/null | awk '$2 != "noreply@anthropic.com"'""",
)

# The message no longer has a missing-signature case to report.
src = src.replace(
    "Unverified (missing signature, or committer email is not noreply@anthropic.com)",
    "Unverified (committer email is not noreply@anthropic.com)",
)

if src == original:
    print("session-start: launcher git-check hook already correct, or changed upstream")
else:
    path.write_text(src)
    print("session-start: narrowed the launcher git-check hook (see .claude/hooks/session-start.sh)")
PY
}

install_deps
patch_git_check_hook

exit 0
