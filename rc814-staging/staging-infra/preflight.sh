#!/usr/bin/env bash
# rc814-staging/staging-infra/preflight.sh — RC8_14 (HARDENED, fail-closed)
# Proves the mutation target is an isolated STAGING env and NOT production.
# No swallow: CLI failure, parse failure, or missing/invalid marker => non-zero exit.
#
# Marker contract (single fixed doc):
#   collection : <MARKER_COLLECTION>
#   _id        : "staging"
#   staging    : true          (boolean)
#   envId      : <staging envId>   (must equal the target env)
set -euo pipefail

PROD_ENV="fanshex-d2g0adgv7dfbc9bdc"
STAGING_ALLOWLIST="${STAGING_ALLOWLIST:-}"
TARGET_ENV="${STAGING_ENV_ID:-}"
MARKER_COLLECTION="${MARKER_COLLECTION:-staging}"
MARKER_ID="${MARKER_ID:-staging}"
TCB_BIN="${TCB_BIN:-tcb}"

fail() { echo "[preflight] FAIL: $*" >&2; exit 1; }

# 1) explicit target env required (deny implicit CLI default)
[ -n "$TARGET_ENV" ] || fail "STAGING_ENV_ID unset (fail-closed)"
# 2) deny production env
[ "$TARGET_ENV" != "$PROD_ENV" ] || fail "target env == PRODUCTION ($PROD_ENV) — refused"
case "$TARGET_ENV" in *"$PROD_ENV"*) fail "target env sneaks PRODUCTION id";; esac
# 3) allowlist required AND must contain target
[ -n "$STAGING_ALLOWLIST" ] || fail "STAGING_ALLOWLIST unset (fail-closed)"
case ",$STAGING_ALLOWLIST," in *",$TARGET_ENV,"*) ;; *) fail "target env not in allowlist: $TARGET_ENV";; esac

# 4) CLI reachable — must succeed (no swallow)
if ! "$TCB_BIN" env list --json >/dev/null 2>&1; then
  fail "CloudBase CLI unreachable / not authenticated"
fi

# 5) marker doc: fetch _id=$MARKER_ID from collection $MARKER_COLLECTION
CMD="[{\"TableName\":\"$MARKER_COLLECTION\",\"CommandType\":\"COMMAND\",\"Command\":\"{\\\"find\\\":\\\"$MARKER_COLLECTION\\\",\\\"filter\\\":{\\\"_id\\\":\\\"$MARKER_ID\\\"},\\\"limit\\\":1}\"}]"
if ! RAW=$("$TCB_BIN" db nosql execute --command "$CMD" -e "$TARGET_ENV" 2>&1); then
  fail "marker query CLI error: $(printf '%s' "$RAW" | tail -n1)"
fi

# parse: require a JSON array, exactly present, staging===true, envId===target
RES=$(printf '%s' "$RAW" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=s.indexOf("["), b=s.lastIndexOf("]");
  if(a<0||b<0||b<a){console.log("PARSE_ERROR");return}
  let arr;try{arr=JSON.parse(s.slice(a,b+1))}catch(e){console.log("PARSE_ERROR");return}
  if(!Array.isArray(arr)){console.log("PARSE_ERROR");return}
  if(arr.length===0){console.log("MISSING");return}
  const d=arr[0]||{};
  const staged=(d.staging===true||d.staging==="true");
  console.log((staged?"STAGED_TRUE":"STAGED_FALSE")+"|"+(d.envId==null?"":String(d.envId)));
})')
[ -n "$RES" ] || fail "marker query produced no parseable result (CLI/parse failure)"

case "$RES" in
  PARSE_ERROR) fail "marker query unparseable (CLI/parse failure) in $TARGET_ENV";;
  MISSING)     fail "staging marker _id=$MARKER_ID not found in $TARGET_ENV";;
  STAGED_FALSE*) fail "marker staging != true in $TARGET_ENV (found: $RES)";;
  STAGED_TRUE*)
    ENVID="${RES#STAGED_TRUE|}"
    [ "$ENVID" = "$TARGET_ENV" ] || fail "marker envId ($ENVID) != target env ($TARGET_ENV)"
    ;;
  *) fail "marker check unexpected result: $RES";;
esac

# 6) dependency manifest check (READ-ONLY) — enabled with DEPS_PREFLIGHT=1
if [ "${DEPS_PREFLIGHT:-0}" = "1" ]; then
  if ! STAGING_ENV_ID="$TARGET_ENV" STAGING_ALLOWLIST="$STAGING_ALLOWLIST" TCB_BIN="$TCB_BIN" \
       node "$(dirname "$0")/deps-preflight.js"; then
    fail "dependency manifest unmet in $TARGET_ENV (see deps-preflight output above)"
  fi
fi

echo "[preflight] OK: $TARGET_ENV is isolated staging (marker _id=$MARKER_ID, staging=true, envId match${DEPS_PREFLIGHT:+, deps-verified})"
