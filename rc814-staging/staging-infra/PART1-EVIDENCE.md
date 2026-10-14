# RC8_14 — Part 一 Evidence Completion (records collection · marker contract · chmod)

- date 2026-10-14 · staging `fanshen002-d9g0rjr3b6e313af5` · production untouched.

## 1) Records collection name — RESOLVED (report was correct; owner premise was the typo)
Source-of-truth scan (`cloudfunctions/getChallengeEvent|startChallenge|submitChallengeChoice` + `common/`):
| name | occurrences in source | verdict |
|---|---|---|
| `challenge_records` (with underscore) | **14** | **the real collection** |
| `challengerecords` (no underscore) | **0** | never used anywhere (repo-wide grep incl. pages/ fns/md/json) |
- `ensureChallengeCollections` creates `challenge_records` + `challenge_events`.
- Live probe (staging): `challenge_records` → **9 docs** · `challengerecords` → **0 docs** · `challenge_events` → **34 docs**.
- ⇒ The import report (`challenge_records=9`) is **correct**; no misspelling, no re-import, no change required.

### 9 fixtures — actual location / structure / ownership (read-verified)
All 9 in `challenge_records`; ownership field = `openid`; fixture tag = `_fixture`.
| _id | _fixture | openid | status | notes |
|---|---|---|---|---|
| STG-REC-01 | recovery | test-openid-1@staging.local | processing | currentEventIndex 5 / currentDay 6 |
| STG-REC-02 | recovery | test-openid-2@staging.local | processing | idx 12 / day 13 |
| STG-UNREC-01 | unrecoverable | test-openid-3@staging.local | processing | duplicate answered id |
| STG-UNREC-02 | unrecoverable | test-openid-4@staging.local | processing | overflow (>planTotal) |
| STG-FIN-01 | finished | test-openid-5@staging.local | finished | distinctServed 30 |
| STG-FIN-02 | finished | test-openid-6@staging.local | finished | distinctServed 27 |
| STG-CONC-01 | concurrency | test-openid-7@staging.local | processing | 10 concurrent GETs |
| STG-CONC-02 | concurrency | test-openid-8@staging.local | (no status) | 5 concurrent same-event submits |
| STG-EXP-01 | membership | test-openid-9@staging.local | — | membership:"expired" |

## 2) Marker contract — unified to collection `staging` / doc `staging`
- Canonical contract: collection **`staging`**, `_id` **`staging`**, `{staging:true, envId:<target>, createdAt, purpose}`.
- **Change reason (from the original `__staging__` draft):** the original D0 spec named a `__staging__` marker
  collection, and `preflight.sh` queried it with an invalid aggregate-escape (`\$count`) that `tcb` rejected —
  so the check could never pass and (worse) swallowed the error. The owner accepted consolidating to a single
  explicit doc under the `staging` collection. Rationale: (a) avoids a dunder-prefixed collection name that is
  awkward/ambiguous at the platform layer; (b) a **named fixed doc** lets the guard verify `staging===true`
  **and** `envId===target` (not just "collection non-empty"); (c) one contract, one place to change.
- Alignment status:
  - `preflight.sh` — reads collection `staging`, doc `staging`; asserts staging===true + envId match. ✅
  - `deploy-guard.sh` (calls preflight) ✅ · `init-marker.sh` (creates the fixed doc) ✅ · `guard-selftest.sh` (stubs) ✅
  - `d3-smoke-test.js` — updated to collection `staging`/doc `staging` + staging===true + envId. ✅
  - **Legacy `__staging__` references remain only in historical D3/D4 docs + earlier reports** (records of the
    prior state). They are documentation, not live guards. No second marker is created anywhere.
- No second marker collection/doc exists (verified: `staging`=1 doc; `__staging__` collection never created).

## 3) "Exec failed: chmod" — RESOLVED (no such failure; chmod succeeded)
- The literal string **`Exec failed: chmod`** appears **only in the owner's message** — not in any tool output,
  session transcript, OpenClaw log, or repo file (exhaustive scan incl. `~/.openclaw/logs`, all session JSONL).
- The only exec block whose command contained `chmod` and exited non-zero:
  - **command:** `chmod +x rc814-staging/staging-infra/*.sh` (first line), then syntax checks, then `guard-selftest.sh`
  - **exit code:** block exited **1** — caused by the **last** command (`guard-selftest.sh`, my harness env-forwarding bug), **not** by `chmod`.
  - **chmod itself:** printed no error; all 6 `.sh` are now `-rwxrwxr-x` (verified `stat` + `git ls-files -s` = mode 100755).
- **Impact:** none. The exit-1 was an expected mid-development self-test signal (harness forwarding), since fixed
  (guard-selftest now **14/14**). No file was left non-executable.
- **Conclusion:** no permission repair needed; re-verified (all guard scripts executable and passing).
