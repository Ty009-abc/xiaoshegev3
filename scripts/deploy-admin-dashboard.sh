#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy-admin-dashboard.sh — reproducible deploy guard for a
# dependency-bearing cloud function.
#
# WHY THIS EXISTS (RC8.8 incident):
#   adminGetDashboard was deployed source-only (no node_modules), so at
#   runtime `require('wx-server-sdk')` threw and the function crashed in
#   InitFunction before main() — before any auth/DB/response logic ran.
#   `tcb fn deploy` does NOT install dependencies for you. This guard
#   forces a deterministic, lockfile-based install and verifies the
#   module resolves BEFORE the deploy is allowed to proceed.
#
# USAGE:
#   bash scripts/deploy-admin-dashboard.sh              # install + verify + deploy
#   bash scripts/deploy-admin-dashboard.sh --verify-only
#
# EXIT: non-zero if any precondition fails. Never deploys a depless bundle.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

FN_NAME="adminGetDashboard"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FN_DIR="$PROJECT_DIR/cloudfunctions/$FN_NAME"
REQUIRED_MODULE="wx-server-sdk"

VERIFY_ONLY=false
[ "${1:-}" = "--verify-only" ] && VERIFY_ONLY=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
fail() { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }

[ -d "$FN_DIR" ] || fail "function dir not found: $FN_DIR"
[ -f "$FN_DIR/package.json" ] || fail "missing package.json in $FN_NAME"

# ── 1. Deterministic install ──────────────────────────────────
if [ -f "$FN_DIR/package-lock.json" ]; then
  echo "→ npm ci --omit=dev (lockfile pinned)"
  ( cd "$FN_DIR" && npm ci --omit=dev ) || fail "npm ci failed"
else
  # Fallback only until a lockfile exists; then commit the lockfile so
  # every later deploy uses the deterministic path above.
  warn "no package-lock.json — falling back to npm install --production"
  warn "commit cloudfunctions/$FN_NAME/package-lock.json to pin versions"
  ( cd "$FN_DIR" && npm install --production ) || fail "npm install failed"
fi

# ── 2. Module resolvability ───────────────────────────────────
( cd "$FN_DIR" && node -e "require.resolve('$REQUIRED_MODULE')" ) \
  || fail "$REQUIRED_MODULE is NOT resolvable — refusing to deploy"
ok "$REQUIRED_MODULE resolvable"

# ── 3. Artifact sanity ────────────────────────────────────────
[ -f "$FN_DIR/package.json" ]      || fail "artifact missing package.json"
[ -d "$FN_DIR/node_modules/$REQUIRED_MODULE" ] \
  || fail "artifact missing node_modules/$REQUIRED_MODULE"
ok "artifact contains package.json + node_modules/$REQUIRED_MODULE"
if [ -f "$FN_DIR/package-lock.json" ]; then
  ok "artifact contains package-lock.json"
else
  warn "artifact has no package-lock.json (see step 1)"
fi
warn "bundle byte-size is SECONDARY evidence only; module presence is authority"

if $VERIFY_ONLY; then
  ok "verify-only: all deployment preconditions PASS"
  exit 0
fi

# ── 4. Deploy ─────────────────────────────────────────────────
if ! command -v tcb >/dev/null 2>&1; then
  fail "tcb CLI not found — install: npm i -g @cloudbase/cli && tcb login"
fi
echo "→ deploying $FN_NAME (env fanshex-d2g0adgv7dfbc9bdc)"
( cd "$PROJECT_DIR" && tcb fn deploy "$FN_NAME" --envId fanshex-d2g0adgv7dfbc9bdc --force ) \
  || fail "deploy failed"
ok "$FN_NAME deployed with dependencies"
