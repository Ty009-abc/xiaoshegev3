#!/usr/bin/env bash
# rc814-staging/staging-infra/run-guarded-deploy.sh — RC8_14 R-1 (staging-only)
# Runs preflight + deploy-guard, then deploys ONLY the 3 challenge functions to STAGING.
# Requires DEPLOY_CONFIRM=<staging env> to perform the real mutation.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
cd "$ROOT"

ENV_ID="${STAGING_ENV_ID:-}"
[ -n "$ENV_ID" ] || { echo "[run-guarded] STAGING_ENV_ID unset — refused" >&2; exit 1; }

FNS=(getChallengeEvent startChallenge submitChallengeChoice)

echo "[run-guarded] preflight"
bash "$DIR/preflight.sh"
echo "[run-guarded] deploy-guard"
bash "$DIR/deploy-guard.sh" "tcb fn deploy getChallengeEvent -e $ENV_ID"

if [ "${DEPLOY_CONFIRM:-}" != "$ENV_ID" ]; then
  echo "[run-guarded] DEPLOY_CONFIRM != $ENV_ID — refusing real deploy (dry-run)." >&2
  exit 3
fi

mkdir -p "$DIR/deploy-manifest"
for fn in "${FNS[@]}"; do
  echo "[run-guarded] deploying $fn -> $ENV_ID"
  tcb fn deploy "$fn" -e "$ENV_ID"
  sha256sum "cloudfunctions/$fn/index.js" > "$DIR/deploy-manifest/$fn.local.sha256"
done
echo "[run-guarded] done"
