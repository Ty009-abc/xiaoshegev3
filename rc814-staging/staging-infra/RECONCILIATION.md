# RC8_14 Part 一.2 — Collection-name & fixture-count RECONCILIATION (read-only)

- date 2026-10-15 · staging `fanshen002-d9g0rjr3b6e313af5` · production untouched · read-only (no writes).

## A) Source collection references (single source of truth)
Case-sensitive scan of the repo (excl. `node_modules`):

| reference | occurrences | where |
|---|---|---|
| **`challenge_records`** (WITH underscore) | **14** | fns + common + d3 fixtures + reports |
| `challengerecords` (no underscore) | **0** | — (never appears anywhere) |

Representative source references (file:line):
```
cloudfunctions/getChallengeEvent/index.js:  db.collection('challenge_records')   (reads/writes)
cloudfunctions/startChallenge/index.js:     db.collection('challenge_records')
cloudfunctions/submitChallengeChoice/index.js: db.collection('challenge_records')
cloudfunctions/*/lib/ensureChallengeCollections.js: creates 'challenge_records' + 'challenge_events'
```

⇒ **The records collection is `challenge_records` (underscore).** The owner's premise
“源码记录集合为 challengerecords” does **not** match the source; the import report
(`challenge_records=9`) is therefore **correct**. **No rename, no migration, no re-import.**

## B) The 9 fixtures — actual location (read-verified live)
All 9 in **`challenge_records`** (staging), ownership field `openid`, tag `_fixture`:

| _id | _fixture | openid | note |
|---|---|---|---|
| STG-REC-01 | recovery | test-openid-1@staging.local | idx 5 / day 6 |
| STG-REC-02 | recovery | test-openid-2@staging.local | idx 12 / day 13 |
| STG-UNREC-01 | unrecoverable | test-openid-3@staging.local | duplicate answered id |
| STG-UNREC-02 | unrecoverable | test-openid-4@staging.local | overflow (>planTotal) |
| STG-FIN-01 | finished | test-openid-5@staging.local | distinctServed 30 |
| STG-FIN-02 | finished | test-openid-6@staging.local | distinctServed 27 |
| STG-CONC-01 | concurrency | test-openid-7@staging.local | 10 concurrent GETs |
| STG-CONC-02 | concurrency | test-openid-8@staging.local | 5 concurrent submits |
| STG-EXP-01 | membership | test-openid-9@staging.local | membership "expired" |

Live counts (2026-10-15): `challenge_records`=**9** · `challengerecords`=**0** · `challenge_events`=**34** · `staging`=**1**.

## C) The “table vs body” contradiction — RESOLVED (it is a COUNT-OF-DIFFERENT-SETS artifact, not a data error)
Reports mention **“fixtures” in three DIFFERENT senses**; they are NOT the same set:

| # | “fixtures” sense | count | collection / artifact | example docs |
|---|---|---|---|---|
| 1 | **Synthetic acceptance fixtures** (legacy/concurrency/membership) | **9** | `challenge_records` | `d3-staging-acceptance.md`, `RESULT-R1R2R3.md`, `PART1-EVIDENCE.md` |
| 2 | **Occupation fixtures** (plan-generation perf) | **8** | in-memory only (no collection) | `local-integration-test-report.md`, `occupation-coverage-report.md`, `c2-day-semantics.md` |
| 3 | **batch1 candidate events** | **10** | `challenge_events` (candidates) | `batch1-events.json` |

- The “9” (sense 1) is the number in **`challenge_records`**; the “8” (sense 2) are **occupation tokens**
  used to exercise `buildPlan` in-memory; the “10” (sense 3) are **events**, in `challenge_events`.
- Therefore a doc citing “8 fixtures” and another citing “9 fixtures” are **both correct** and refer to
  different sets. **No contradiction in data.** ⇒ **No migration / no re-import.**

### Superseded state (temporal, not a conflict)
`rc814-batch1/r3-cloudbase-c1-c10-report.md` records `challenge_events=0 / challenge_records=0 / fns=empty`
because it was authored in the **earlier** turn (before R-1/R-2). The consolidated
`staging-infra/RESULT-R1R2R3.md` records the **later** state (`fns=3 / events=34 / records=9`).
The R-3 report is marked **SUPERSEDED (historical)** accordingly; no re-run of R-1/R-2 is implied.

## D) Conclusion
- Source truth = **`challenge_records`** (+ `challenge_events`); the 9 fixtures are correctly located.
- The apparent table/body mismatch = **different “fixture” sets** (9 acceptance vs 8 occupation vs 10 events).
- **No data migration, no re-import, no collection rename.** Historical reports annotated, not rewritten.
