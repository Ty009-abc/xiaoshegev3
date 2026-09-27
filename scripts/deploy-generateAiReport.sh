#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy-generateAiReport.sh — secret-safe deploy wrapper.
#
# RC8.9B_P0_SECRET_CLOBBER_GUARD.
#
# WHY THIS EXISTS (11:04 incident):
#   `tcb fn deploy` MATERIALIZES cloudbaserc.json `functions[].envVariables`
#   into the cloud. SCF replaces `Environment.Variables` WHOLESALE. A committed
#   placeholder (<YOUR_AI_API_KEY>) therefore OVERWROTE the live production AI
#   key → every 6Q model call returned HTTP 401.
#
#   This wrapper REFUSES to deploy if the config declares a placeholder /
#   committed / partial secret block for the target function. It prints key
#   NAMES only and never prints secret values.
#
# USAGE:
#   bash scripts/deploy-generateAiReport.sh              # guard + deploy
#   bash scripts/deploy-generateAiReport.sh --verify-only
#
# EXIT: non-zero if the guard blocks. Never deploys a secret-clobbering config.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

FN_NAME="${FN_NAME:-generateAiReport}"
ENV_ID="fanshex-d2g0adgv7dfbc9bdc"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VERIFY_ONLY=false
[ "${1:-}" = "--verify-only" ] && VERIFY_ONLY=true

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
fail() { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }

# ── 1. SECRET GUARD (fail-closed, before any cloud side-effect) ──
echo "→ secret-guard: scanning cloudbaserc.json for function [$FN_NAME]"
if ! node "$SCRIPT_DIR/check-secrets.js" --fn "$FN_NAME"; then
  fail "SECRET-GUARD BLOCKED deploy of $FN_NAME (placeholder/committed/partial secret)"
fi
ok "secret-guard passed"

if $VERIFY_ONLY; then
  ok "verify-only: secret-guard preconditions PASS (no deploy performed)"
  exit 0
fi

# ── 2. Deploy ──
if ! command -v tcb >/dev/null 2>&1; then
  fail "tcb CLI not found — install: npm i -g @cloudbase/cli && tcb login"
fi
echo "→ deploying $FN_NAME (env $ENV_ID)"
( cd "$PROJECT_DIR" && tcb fn deploy "$FN_NAME" --envId "$ENV_ID" --force ) \
  || fail "deploy failed"
ok "$FN_NAME deployed (env preserved: config carries no secret block)"
