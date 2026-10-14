# RC8.14 Staging Guards — tracked tooling

Fail-closed guards for staging-only mutations (deploy / import) to
`fanshen002-d9g0rjr3b6e313af5`. Production `fanshex-d2g0adgv7dfbc9bdc` is hard-denied.

## Files
| file | role |
|---|---|
| `preflight.sh` | proves target is isolated staging via the fixed marker doc; fails closed |
| `deploy-guard.sh` | gate for every deploy/import command (env, allowlist, payment, secrets) |
| `guard-selftest.sh` | local validation of all guard scenarios (stub `tcb`, no cloud writes) |
| `cloudbaserc.staging.json` | staging function config (envId `${STAGING_ENV_ID}`) |

## Marker contract (single fixed doc)
- collection `staging`, `_id` = `staging`
- `staging: true` (boolean)
- `envId` = the target staging envId (must match)

## Fail-closed rules (no swallow)
CLI failure, unparseable result, missing marker, `staging !== true`, envId mismatch,
production target, missing allowlist, or non-allowlisted target → **non-zero exit**.

## Usage
```bash
export STAGING_ENV_ID=fanshen002-d9g0rjr3b6e313af5
export STAGING_ALLOWLIST=fanshen002-d9g0rjr3b6e313af5
bash preflight.sh
bash deploy-guard.sh "tcb fn deploy getChallengeEvent -e $STAGING_ENV_ID"   # dry-run
# real mutation requires DEPLOY_CONFIRM=<env> in the deploy wrapper

# local guard validation (no cloud writes):
bash guard-selftest.sh     # expect: pass=N fail=0
```

## Collection names (unified)
Source + this round's import/test/check scripts all reference:
- events bank: `challenge_events`
- records: `challenge_records`
- marker: `staging` (staging-only, not a business collection)
No duplicate/parallel collections are created.
