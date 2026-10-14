#!/usr/bin/env bash
# rc814-staging/staging-infra/deploy-staging.sh — RC8_14_D0 PHASE_4 (TEMPLATE — never executed)
# Deploys the 3 challenge functions to the STAGING env only. Requires explicit target env.
set -euo pipefail
cd "$(dirname "$0")/../.."

TARGET_ENV="${STAGING_ENV_ID:-}"
[ -n "$TARGET_ENV" ] || { echo "STAGING_ENV_ID unset — refused" >&2; exit 1; }
[ "$TARGET_ENV" != "fanshex-d2g0adgv7dfbc9bdc" ] || { echo "refusing to deploy to PRODUCTION" >&2; exit 1; }

bash rc814-staging/staging-infra/preflight.sh

echo "[deploy] deploying to $TARGET_ENV"
tcb fn deploy getChallengeEvent         -e "$TARGET_ENV"
tcb fn deploy startChallenge            -e "$TARGET_ENV"
tcb fn deploy submitChallengeChoice     -e "$TARGET_ENV"

echo "[deploy] capturing hashes"
mkdir -p rc814-staging/staging-infra/deploy-manifest
for fn in getChallengeEvent startChallenge submitChallengeChoice; do
  sha256sum "cloudfunctions/$fn/index.js" > "rc814-staging/staging-infra/deploy-manifest/$fn.local.sha256"
  tcb fn detail "$fn" -e "$TARGET_ENV" > "rc814-staging/staging-infra/deploy-manifest/$fn.remote.json" 2>&1 || true
done
echo "[deploy] done — manifest under rc814-staging/staging-infra/deploy-manifest/"
