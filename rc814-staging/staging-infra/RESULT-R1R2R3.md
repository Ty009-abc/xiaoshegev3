# RC8_14 R-1 / R-2 / R-3 — Consolidated Result (staging-only)

- target env: `fanshen002-d9g0rjr3b6e313af5` (staging ONLY) · production `fanshex-d2g0adgv7dfbc9bdc` UNTOUCHED
- baseline HEAD: `9554141` (guard fix `4ccd6b7` + baseline `dfb5c6c` + marker tooling `9554141`)
- date 2026-10-14 · server-side-only (no client binding, no 环境转换, no production)

## Part 一 — Release baseline (COMPLETE)
- `preflight.sh` rewritten **fail-closed** (no swallow): rejects unset env · prod env (exact+substring) ·
  missing/non-matching allowlist · unreachable CLI · missing marker · unparseable result ·
  `staging!==true` · envId≠target.
- marker contract: collection `staging`, `_id` `staging`, `staging:true`, `envId`=target.
- `guard-selftest.sh`: **14/14** local scenarios (1 accept + 5 reject + prod/allowlist/secret rejects).
- collection names unified to source truth: `challenge_events` (bank), `challenge_records` (records);
  marker is `staging` (staging-only). No parallel collections.
- baseline committed + pushed: `4ccd6b7` → `dfb5c6c`; old baselines preserved (`staging-infra/BASELINE-HISTORY.md`).
- bundle rebuilt: **sha256 `bef3bf7472aae941744a921182e2334f9efeca8a32a20e1815de73099db5be22`** (87 entries, no self-ref, restore OK).
- the 3 business functions' source unchanged (verified).

## Part 二 — staging marker (COMPLETE)
- pre-write guards verified (explicit env + allowlist + prod rejection) BEFORE any write.
- marker absent → created via `init-marker.sh` (additive insert): `{_id:"staging",staging:true,envId:"fanshen002-d9g0rjr3b6e313af5",createdAt,purpose}`.
- re-verified by read: staging=true, envId match.
- `preflight.sh` → OK · `deploy-guard.sh` → OK (dry-run gate).

## Part 三 — R-1 Deploy (PASS)
| fn | staging fnId | runtime | status | local index.js sha256 == D4 baseline |
|---|---|---|---|---|
| getChallengeEvent | `lam-7urjq6bl` | Nodejs18.15 | 部署完成 | `8efb0c54428dedd05ee8851ebcbe80e24c11bd1d1bcab9a532da13b9c9f1a86e` ✅ |
| startChallenge | `lam-ouedpv7n` | Nodejs18.15 | 部署完成 | `3a55ce84d841d9ae93f07b7abd4fec859cf5dc4f9ee63228953909cac26bfc38` ✅ |
| submitChallengeChoice | `lam-s0d3f231` | Nodejs18.15 | 部署完成 | `3d597b81a5939f83ae61b5182fed0bd617b1eb91d8c7b296104b3805e7019077` ✅ |
- deployed with full deps (`installDependency`); reachable (invoke 3.00/4.00/5.00 ms). Payment fns NOT deployed.

## Part 三 — R-2 Import (PASS)
- pre-import: challenge_events=0, challenge_records=0, staging=0.
- imported (additive, idempotent, no drop): **challenge_events=34** (30 CE001–CE030 unchanged + 4 candidates
  GAME015/016/020/021 with `_stagingMeta.approval="PENDING_OWNER_APPROVAL"`, `approved:false`, `source:"cognitive-quiz v1.0"`),
  **challenge_records=9** synthetic fixtures (STG-REC-01/02, STG-UNREC-01/02, STG-FIN-01/02, STG-CONC-01/02, STG-EXP-01).
- verified by read: 34 distinct eventIds; candidate TEST_ONLY marking preserved; CE001/CE030 unchanged.

## Part 三 — R-3 CloudBase C1–C10 (BLOCKED — precondition unmet)
**Root cause (independent of code quality): the 3 deployed functions derive identity ONLY from
`cloud.getWXContext().OPENID` (WeChat client context). Server-side invocation cannot supply it.**

Evidence:
```
tcb fn invoke getChallengeEvent -d '{"recordId":"STG-REC-01","openid":"test-openid-1@staging.local"}'
  → {"code":401,"message":"登录态失效，请重新登录"}   (RequestId ef5cc0b1-a981-4729-a1fb-723a02b609ff)
tcb fn invoke startChallenge -d '{"openid":"test-openid-1@staging.local",...}'
  → 401-equivalent (RequestId 7ad3925c-77a5-4fba-a119-4f669a64a0b4)
```
- payload `openid` is IGNORED (identity comes only from WX context).
- no test/mock/CLI identity path in the 3 fns or `common/` (grep: none).
- staging HTTP access routes = **empty**; no domain configured → cannot use `x-wx-openid` HTTP passthrough.
- using the WeChat client / devtools path = client binding + 环境转换 → **out of scope this round**.
- the node-sdk smoke harness would additionally need a **staging service credential** (none configured; auto-copying the prod secret is forbidden).

| # | test | verdict | reason |
|---|---|---|---|
| C1 | conditional-update atomicity (10 concurrent GET) | BLOCKED | no authenticated invoke path (401) |
| C2 | parallel getChallengeEvent | BLOCKED | " |
| C3 | parallel submitChallengeChoice | BLOCKED | " |
| C4 | legacy recovery STG-REC-01/02 | BLOCKED | " (fixtures seeded, but fn unreachable) |
| C5 | 30-day unique plan | BLOCKED | " |
| C6 | Day30 completion | BLOCKED | " |
| C7 | Day31 rejection | BLOCKED | " |
| C8 | eventBankVersion expansion | BLOCKED | " |
| C9 | expired-membership rights STG-EXP-01 | BLOCKED | " |
| C10 | unrecoverable legacy STG-UNREC-01/02 | BLOCKED | " |

Total: **PASS 0 · FAIL 0 · BLOCKED 10 · SKIPPED 0**. No auth relaxation, no assertion edit, no scoring edit.
Mock (rc8.14 9/9, C2 86/0, C1 59/0) is NOT cloud evidence.

## Options to unblock R-3 (owner decision; none executed)
1. **Authorize staging HTTP access route** (enableAuth) + verify WeChat `x-wx-openid` passthrough on the default domain — env-config change + possibly a domain.
2. **Provide a staging service credential** so a node-sdk harness can call functions — still needs an identity source.
3. **Accept a client-side (devtools/真机) run** — requires 微信公众平台↔腾讯云 binding + 环境转换 (**explicitly out of scope now**).
4. **Accept offline mock as the only available evidence** and defer real atomicity proof.

## Actual remote changes this round
- staging functions: 3 deployed (was 0).
- staging DB: marker (1 doc) + 34 events + 9 records (was 0).
- production: **NONE**.
- `DEPLOYED=3 fns (staging)` · `STAGING_DB_CHANGED=YES(staging)` · `PRODUCTION_CHANGED=NO`.
- client E2E acceptance: **NOT EXECUTED**.
