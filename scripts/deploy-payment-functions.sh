#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy-payment-functions.sh — secret/payment-safe deploy wrapper.
#
# PAYMENT_STAGE2_SIGNING_AND_VERIFICATION_FOUNDATION.
#
# WHY THIS EXISTS:
#   `tcb fn deploy` MATERIALIZES cloudbaserc.json `functions[].envVariables`
#   into the cloud. SCF replaces `Environment.Variables` WHOLESALE. A committed
#   placeholder therefore OVERWRITES the live production secret.
#
#   For payment SIGNING functions this is doubly critical: a placeholder/
#   non-PEM WXPAY_PRIVATE_KEY or a malformed WXPAY_SERIAL_NO makes merchant
#   request signing impossible, and a partial env block would DELETE the live
#   APIv3 key / private key.
#
#   This wrapper runs BOTH guards (generic secret-clobber + payment-signing
#   value-shape) BEFORE any cloud side-effect. It prints key NAMES only and
#   never prints secret values.
#
# USAGE:
#   bash scripts/deploy-payment-functions.sh                # guard + deploy all
#   bash scripts/deploy-payment-functions.sh createOrder    # one function
#   bash scripts/deploy-payment-functions.sh --verify-only  # guards only
#
# EXIT: non-zero if any guard blocks. Never deploys a clobbering config.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

ENV_ID="fanshex-d2g0adgv7dfbc9bdc"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Payment signing functions deployed by this wrapper (order matters).
PAYMENT_FNS=(createOrder verifyPayment payCallback)

VERIFY_ONLY=false
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --verify-only) VERIFY_ONLY=true ;;
    -*) echo "未知参数: $arg" >&2; exit 2 ;;
    *) TARGET="$arg" ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
fail() { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }

FN_LIST=("${PAYMENT_FNS[@]}")
[ -n "$TARGET" ] && FN_LIST=("$TARGET")

# ── 1. SECRET GUARDS (fail-closed, before any cloud side-effect) ──
for fn in "${FN_LIST[@]}"; do
  echo "→ secret-guard: scanning cloudbaserc.json for function [$fn]"
  if ! node "$SCRIPT_DIR/check-secrets.js" --fn "$fn"; then
    fail "SECRET-GUARD BLOCKED deploy of $fn (placeholder/committed/partial secret)"
  fi
  echo "→ payment-signing-guard: validating merchant signing material for [$fn]"
  if ! node "$SCRIPT_DIR/check-payment-signing.js" --fn "$fn"; then
    fail "PAYMENT-SIGNING GUARD BLOCKED deploy of $fn (bad private key / serial)"
  fi
  ok "$fn guards passed"
done

if $VERIFY_ONLY; then
  ok "verify-only: secret + payment-signing preconditions PASS (no deploy performed)"
  exit 0
fi

# ── 2. Deploy ──
if ! command -v tcb >/dev/null 2>&1; then
  fail "tcb CLI not found — install: npm i -g @cloudbase/cli && tcb login"
fi
for fn in "${FN_LIST[@]}"; do
  echo "→ deploying $fn (env $ENV_ID)"
  ( cd "$PROJECT_DIR" && tcb fn deploy "$fn" --envId "$ENV_ID" --force ) \
    || fail "deploy failed: $fn"
  ok "$fn deployed (env preserved: config carries no secret block)"
done
