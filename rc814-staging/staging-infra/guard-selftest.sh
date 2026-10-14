#!/usr/bin/env bash
# rc814-staging/staging-infra/guard-selftest.sh — RC8_14 local validation (no cloud writes)
# Simulates the preflight/deploy-guard scenarios using a stub `tcb` (TCB_BIN override).
# Asserts: correct marker PASSES; missing marker / wrong envId / staging=false /
#          CLI failure / parse failure / production target / no allowlist / not-in-allowlist => REJECT.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PROD="fanshex-d2g0adgv7dfbc9bdc"
STG="fanshen002-d9g0rjr3b6e313af5"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
pass=0; failn=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
no()  { echo "  ✗ $1"; failn=$((failn+1)); }

# ---- stub tcb: behavior driven by env STUB_MODE ----
cat > "$TMP/tcb" <<'STUB'
#!/usr/bin/env bash
mode="${STUB_MODE:-ok}"
# env list --json
if [ "$1" = "env" ] && [ "$2" = "list" ]; then
  [ "$mode" = "cli_fail" ] && { echo "boom" >&2; exit 1; }
  echo '{"envList":[]}'; exit 0
fi
# db nosql execute --command ... -e ENV
if [ "$1" = "db" ]; then
  [ "$mode" = "cli_fail" ] && { echo "cli exploded" >&2; exit 1; }
  case "$mode" in
    parse_fail) echo 'not json at all <<<'; exit 0;;
    missing)    echo '[]'; exit 0;;
    wrongenv)   echo '[{"_id":"staging","staging":true,"envId":"some-other-env"}]'; exit 0;;
    notstaged)  echo '[{"_id":"staging","staging":false,"envId":"'"$STUB_ENV"'"}]'; exit 0;;
    *)          echo '[{"_id":"staging","staging":true,"envId":"'"$STUB_ENV"'"}]'; exit 0;;
  esac
fi
echo ""; exit 0
STUB
chmod +x "$TMP/tcb"

run() { # name expect(0=pass,1=fail) extra_env...
  local name="$1" expect="$2"; shift 2
  env -i PATH="$PATH" HOME="$HOME" TCB_BIN="$TMP/tcb" \
    STUB_ENV="$STG" "$@" bash "$DIR/preflight.sh" >/dev/null 2>&1
  local rc=$?
  if [ "$expect" = "0" ] && [ "$rc" = "0" ]; then ok "$name (exit 0)";
  elif [ "$expect" = "1" ] && [ "$rc" != "0" ]; then ok "$name (exit $rc)";
  else no "$name (exit $rc, expected expect=$expect)"; fi
}

echo "[guard-selftest] preflight scenarios"
run "correct marker PASS"        0 STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="$STG" STUB_MODE=ok
run "missing marker REJECT"      1 STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="$STG" STUB_MODE=missing
run "wrong envId REJECT"         1 STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="$STG" STUB_MODE=wrongenv
run "staging=false REJECT"       1 STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="$STG" STUB_MODE=notstaged
run "CLI failure REJECT"         1 STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="$STG" STUB_MODE=cli_fail
run "parse failure REJECT"       1 STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="$STG" STUB_MODE=parse_fail
run "production target REJECT"   1 STAGING_ENV_ID="$PROD" STAGING_ALLOWLIST="$STG" STUB_MODE=ok
run "no allowlist REJECT"        1 STAGING_ENV_ID="$STG" STUB_MODE=ok
run "not-in-allowlist REJECT"    1 STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="other-env" STUB_MODE=ok
run "unset envId REJECT"         1 STAGING_ALLOWLIST="$STG" STUB_MODE=ok

echo "[guard-selftest] deploy-guard scenarios"
dg() { # name expect cmdtext env...
  local name="$1" expect="$2" cmdtext="$3"; shift 3
  env -i PATH="$PATH" HOME="$HOME" TCB_BIN="$TMP/tcb" STUB_ENV="$STG" "$@" \
    bash "$DIR/deploy-guard.sh" "$cmdtext" >/dev/null 2>&1
  local rc=$?
  if [ "$expect" = "0" ] && [ "$rc" = "0" ]; then ok "$name (exit 0)";
  elif [ "$expect" = "1" ] && [ "$rc" != "0" ]; then ok "$name (exit $rc)";
  else no "$name (exit $rc, expected $expect)"; fi
}
dg "guard ok (dry-run) PASS" 0 "tcb fn deploy getChallengeEvent -e $STG" STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="$STG" STUB_MODE=ok
dg "guard prod env REJECT"  1 "tcb fn deploy getChallengeEvent -e $PROD" STAGING_ENV_ID="$PROD" STAGING_ALLOWLIST="$STG" STUB_MODE=ok
dg "guard no allowlist REJECT" 1 "tcb fn deploy getChallengeEvent -e $STG" STAGING_ENV_ID="$STG" STUB_MODE=ok
dg "guard prod secret REJECT" 1 "tcb fn deploy getChallengeEvent -e $STG" STAGING_ENV_ID="$STG" STAGING_ALLOWLIST="$STG" STUB_MODE=ok AI_API_KEY=sk-x

echo
echo "[guard-selftest] RESULT: pass=$pass fail=$failn"
[ "$failn" = "0" ] || exit 1
