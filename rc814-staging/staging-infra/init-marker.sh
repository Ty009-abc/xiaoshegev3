#!/usr/bin/env bash
# rc814-staging/staging-infra/init-marker.sh — RC8_14 staging marker initialization (staging-only)
# Creates the fixed marker doc: collection 'staging', _id 'staging',
#   { staging:true, envId:<target>, createdAt:<iso>, purpose:<text> }
# Fail-closed: explicit env + allowlist + prod rejection required BEFORE any write.
# Conflict-stop: if the doc exists with mismatched content => STOP, never overwrite.
set -euo pipefail
PROD_ENV="fanshex-d2g0adgv7dfbc9bdc"
TARGET_ENV="${STAGING_ENV_ID:-}"
ALLOWLIST="${STAGING_ALLOWLIST:-}"
MARKER_COLLECTION="${MARKER_COLLECTION:-staging}"
MARKER_ID="${MARKER_ID:-staging}"
PURPOSE="${MARKER_PURPOSE:-RC8_14 staging isolation marker (synthetic; not a business collection)}"
NOW="${MARKER_CREATED_AT:-$(date +%Y-%m-%dT%H:%M:%S%z)}"
TCB_BIN="${TCB_BIN:-tcb}"
fail() { echo "[init-marker] FAIL: $*" >&2; exit 1; }

# --- pre-write guards ---
[ -n "$TARGET_ENV" ] || fail "STAGING_ENV_ID unset"
[ "$TARGET_ENV" != "$PROD_ENV" ] || fail "target == PRODUCTION — refused"
case "$TARGET_ENV" in *"$PROD_ENV"*) fail "target sneaks PRODUCTION id";; esac
[ -n "$ALLOWLIST" ] || fail "STAGING_ALLOWLIST unset"
case ",$ALLOWLIST," in *",$TARGET_ENV,"*) ;; *) fail "target not in allowlist";; esac

# --- existence check (no swallow) ---
FIND="[{\"TableName\":\"$MARKER_COLLECTION\",\"CommandType\":\"COMMAND\",\"Command\":\"{\\\"find\\\":\\\"$MARKER_COLLECTION\\\",\\\"filter\\\":{\\\"_id\\\":\\\"$MARKER_ID\\\"},\\\"limit\\\":1}\"}]"
if ! RAW=$("$TCB_BIN" db nosql execute --command "$FIND" -e "$TARGET_ENV" 2>&1); then
  fail "existence check CLI error: $(printf '%s' "$RAW" | tail -n1)"
fi
EXISTS=$(printf '%s' "$RAW" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=s.indexOf("["),b=s.lastIndexOf("]");if(a<0||b<a){console.log("PARSE_ERROR");return}try{const j=JSON.parse(s.slice(a,b+1));console.log(Array.isArray(j)&&j.length>0?"YES":"NO")}catch(e){console.log("PARSE_ERROR")}})')
case "$EXISTS" in
  PARSE_ERROR) fail "existence check unparseable";;
  YES)
    DOC=$(printf '%s' "$RAW" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=s.indexOf("["),b=s.lastIndexOf("]");const j=JSON.parse(s.slice(a,b+1))[0];console.log(JSON.stringify({staging:j.staging,envId:j.envId}))})')
    echo "[init-marker] marker already exists: $DOC"
    echo "$DOC" | grep -q '"staging":true' || fail "existing marker staging!=true — CONFLICT, stop (no overwrite)"
    echo "$DOC" | grep -q "\"envId\":\"$TARGET_ENV\"" || fail "existing marker envId mismatch — CONFLICT, stop (no overwrite)"
    echo "[init-marker] verified existing marker matches — reuse (no write)"
    exit 0;;
  NO)
    echo "[init-marker] marker absent — creating";;
esac

# --- create (additive insert only) ---
CMD=$(node -e '
const env=process.argv[1], col=process.argv[2], id=process.argv[3], now=process.argv[4], purpose=process.argv[5];
const doc={_id:id,staging:true,envId:env,createdAt:now,purpose:purpose};
const inner=JSON.stringify({insert:col,documents:[doc]});
process.stdout.write(JSON.stringify([{TableName:col,CommandType:"COMMAND",Command:inner}]));
' "$TARGET_ENV" "$MARKER_COLLECTION" "$MARKER_ID" "$NOW" "$PURPOSE")
if ! OUT=$("$TCB_BIN" db nosql execute --command "$CMD" -e "$TARGET_ENV" 2>&1); then
  fail "insert CLI error: $(printf '%s' "$OUT" | tail -n1)"
fi
printf '%s' "$OUT" | grep -qE '"ok":|"n":|operationTime' || fail "insert result unexpected: $(printf '%s' "$OUT" | tail -n1)"
echo "[init-marker] created marker in $TARGET_ENV (collection=$MARKER_COLLECTION _id=$MARKER_ID)"

# --- verify ---
if ! V=$("$TCB_BIN" db nosql execute --command "$FIND" -e "$TARGET_ENV" 2>&1); then
  fail "verify CLI error: $(printf '%s' "$V" | tail -n1)"
fi
printf '%s' "$V" | grep -q '"staging"' || fail "verify: marker not readable"
printf '%s' "$V" | grep -q "\"envId\": \"$TARGET_ENV\"\|\"envId\":\"$TARGET_ENV\"" || fail "verify: envId mismatch"
echo "[init-marker] OK: marker verified (staging=true, envId=$TARGET_ENV)"
