#!/usr/bin/env bash
# rc814-staging/staging-infra/deploy-probe-staging.sh — RC8_14 Part 四
# Deploys the STAGING-ONLY stagingIdentityProbe to the staging env exclusively.
# Never touches production; never deploys any payment function.
set -euo pipefail
cd "$(dirname "$0")/../.."

PROD_ENV="fanshex-d2g0adgv7dfbc9bdc"
TARGET_ENV="${STAGING_ENV_ID:-}"
ALLOWLIST="${STAGING_ALLOWLIST:-}"
FN="stagingIdentityProbe"

fail() { echo "[deploy-probe] FAIL: $*" >&2; exit 1; }

[ -n "$TARGET_ENV" ] || fail "STAGING_ENV_ID unset (implicit default forbidden)"
[ "$TARGET_ENV" != "$PROD_ENV" ] || fail "refusing to deploy to PRODUCTION"
case "$TARGET_ENV" in *"$PROD_ENV"*) fail "target sneaks PRODUCTION id";; esac
[ -n "$ALLOWLIST" ] || fail "STAGING_ALLOWLIST unset"
case ",$ALLOWLIST," in *",$TARGET_ENV,"*) ;; *) fail "target not in allowlist";; esac

# base preflight: env reachable + staging marker present (fail-closed)
bash rc814-staging/staging-infra/preflight.sh

echo "[deploy-probe] deploying $FN to $TARGET_ENV"
tcb fn deploy "$FN" -e "$TARGET_ENV"

mkdir -p rc814-staging/staging-infra/deploy-manifest
sha256sum "cloudfunctions/$FN/index.js" > "rc814-staging/staging-infra/deploy-manifest/$FN.local.sha256"
tcb fn detail "$FN" -e "$TARGET_ENV" > "rc814-staging/staging-infra/deploy-manifest/$FN.remote.json" 2>&1 || true
echo "[deploy-probe] done — manifest: deploy-manifest/$FN.local.sha256"
