# RC8_14 — Acceptance Marker Contract (canonical)

- status: CANONICAL (single source of truth for the staging acceptance marker)
- target env: `fanshen002-d9g0rjr3b6e313af5` (staging ONLY). Production never uses this marker.

## Canonical contract

| field | value |
|---|---|
| collection | `staging` |
| `_id` | `staging` |
| `staging` | `true` (must be boolean true — guard asserts `=== true`) |
| `envId` | must equal the target envId (`fanshen002-d9g0rjr3b6e313af5`) |
| `createdAt` | ISO create time |
| `purpose` | `"RC8_14 staging isolation marker (synthetic; not a business collection)"` |

Guard rule: preflight PASSES only if the doc exists **and** `staging===true` **and** `envId===target`.
Missing doc / unparseable CLI output / `staging!==true` / `envId`≠target → **FAIL closed (exit!=0)**.

## Why it changed from the original draft (`__staging__`)

The original D0/D3/D4 draft named a `__staging__` **collection** as the isolation marker. Problems found:

1. `preflight.sh` queried it with an invalid aggregate-count escape (`\$count`) that the `tcb` CLI rejected
   (`命令参数 JSON 解析失败: Bad escaped character`), and the command was wrapped `2>/dev/null || true`,
   so `$MARKER` was always empty → the check **could never pass** and **swallowed the error** (fail-open).
2. A "collection is non-empty" test is weak: it cannot assert *which* environment the marker belongs to.
3. A dunder-prefixed collection name is ambiguous at the platform layer and easy to mistype.

Owner accepted consolidation to a **single explicit fixed doc** under collection `staging`, `_id` `staging`.
Benefits: (a) named doc → guard can assert `staging===true` **and** `envId===target`, not just "non-empty";
(b) one contract, one place to change; (c) no dunder name; (d) insert is a plain `add`/`insert` (no aggregate escape).

## Consistency (all live components use the canonical contract)

- `preflight.sh` — reads collection `staging`, doc `staging`; asserts staging===true + envId match. ✅
- `deploy-guard.sh` — calls `preflight.sh` as the final gate. ✅
- `init-marker.sh` — creates the fixed doc (conflict-stop: refuses to overwrite a mismatching doc). ✅
- `guard-selftest.sh` — stub `tcb` scenarios cover PASS + missing/wrongEnvId/staging=false/CLI-fail/parse-fail/prod (14/14). ✅
- `d3-smoke-test.js` — updated to collection `staging`/doc `staging` + staging===true + envId. ✅

## No second marker set

- Verified live: collection `staging` = **1 doc** (`_id:"staging"`); collection `__staging__` = **0 docs** (never created).
- Legacy `__staging__` strings survive **only** in historical D0/D3/D4/r1-r2/r3 reports (records of the prior
  state). They are documentation, not live guards. No code path creates a `__staging__` marker.
