#!/usr/bin/env bash
# rc814-staging/staging-infra/deploy-guard.sh — RC8_14_D4 PHASE_3 (TEMPLATE — never executed)
# Single gate that ALL staging deploy/import commands must pass. Fails closed.
# Guards: explicit staging envId, deny prod envId, deny implicit default, deny payment fns,
#         deny prod callbacks, deny prod secrets, validate dry-run.
set -euo pipefail

PROD_ENV="fanshex-d2g0adgv7dfbc9bdc"
STAGING_ENV="${STAGING_ENV_ID:-}"
STAGING_ALLOWLIST="${STAGING_ALLOWLIST:-}"
CMD="${1:-}"

fail() { echo "[deploy-guard] FAIL: $*" >&2; exit 1; }

# 1) explicit staging envId required (deny implicit CLI default)
[ -n "$STAGING_ENV" ] || fail "STAGING_ENV_ID unset (implicit default forbidden)"
# 1b) explicit allowlist required (no built-in default)
[ -n "$STAGING_ALLOWLIST" ] || fail "STAGING_ALLOWLIST unset (fail-closed)"

# 2) deny production envId — check the env var AND any inherited -e/--env-id
[ "$STAGING_ENV" != "$PROD_ENV" ] || fail "target == PRODUCTION"
case " $* " in *"$PROD_ENV"*) fail "command references PRODUCTION envId";; esac
case "$STAGING_ENV" in *"${PROD_ENV}"*) fail "STAGING_ENV_ID sneaks PRODUCTION";; esac

# 3) allowlist
case ",$STAGING_ALLOWLIST," in *",$STAGING_ENV,"*) ;; *) fail "target not in allowlist";; esac

# 4) deny inherited production environment variables / secrets
for v in PRODUCTION_ENV_ID PROD_SECRET AI_API_KEY PAYMENT_KEY WX_PAY_KEY SECRET_ID SECRET_KEY; do
  if [ -n "${!v:-}" ]; then fail "production-grade env var $v is set in the staging shell"; fi
done

# 5) deny payment function deploy
for fn in createVirtualOrder virtualPayCallback verifyVirtualPayment createOrder verifyPayment; do
  case "$CMD" in *"$fn"*) fail "refusing to deploy/config payment function $fn";; esac
done

# 6) deny production callback endpoints in command text
case "$CMD" in *"api.weixin.qq.com/pay"*|*"callback"*"fanshex"*) fail "production callback endpoint referenced";; esac

# 7) run the base preflight (env reachable + staging marker present)
bash "$(dirname "$0")/preflight.sh"

# 8) dry-run validation: print the exact plan; require DEPLOY_CONFIRM=<env> to actually run
echo "[deploy-guard] OK: target=$STAGING_ENV (isolated). Command: $CMD"
echo "[deploy-guard] dry-run only. To execute, set DEPLOY_CONFIRM=$STAGING_ENV and re-run the real command."
[ "${DEPLOY_CONFIRM:-}" = "$STAGING_ENV" ] || { echo "[deploy-guard] no DEPLOY_CONFIRM — stopping before mutation"; exit 0; }
echo "[deploy-guard] confirmed — proceeding (caller runs the mutation)"
