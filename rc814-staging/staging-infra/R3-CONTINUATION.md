# RC8_14 Part 三 — R-3 continuation: C1–C10 with real WeChat identity

- date 2026-10-14 · staging `fanshen002-d9g0rjr3b6e313af5` · PREPARE + evidence only; production untouched.

## 7) Does trusted WeChat context actually reach the function? — NO (server-side call path)
Fresh invoke evidence (staging, 3 functions, payload includes a fake `openid`):
| fn | RequestId | RetMsg |
|---|---|---|
| getChallengeEvent | `75b2ac92-542c-4ff0-904c-0634a8911b12` | `{"code":401,"message":"登录态失效，请重新登录"}` |
| startChallenge | `40f8df30-2a23-4cd4-b967-ab077f0a2545` | `{"code":401,...}` |
| submitChallengeChoice | `ee91ce76-a762-44e6-b1f6-66da8b1488dd` | `{"code":401,...}` |

- All 3 fns derive identity **only** from `cloud.getWXContext().OPENID`. A server-side `tcb fn invoke`
  carries **no** WeChat context → `wxContext.OPENID` is empty → `fail(CODES.AUTH_FAILED)` = 401.
- The payload `openid` is **ignored** (no payload openid path). No self-supplied header identity path exists.
- Staging HTTP routes: **empty** (`tcb routes list` → 路由列表为空) → no HTTP identity passthrough either.
- ⇒ **Trusted WeChat context reaches the function ONLY via a bound mini-program client** (`wx.cloud.callFunction`).
  Until staging is bound (Part 二.5), the real-identity path cannot be exercised. **No HTTP identity bypass added.**

## 7b) Fixture → real-identity mapping (staging test data only)
- Tooling: `staging-infra/map-identity.js` — rewrites `openid` on the **9 enumerated synthetic fixtures only**
  (`STG-REC-01/02`, `STG-UNREC-01/02`, `STG-FIN-01/02`, `STG-CONC-01/02`, `STG-EXP-01`) from
  `test-openid-N@staging.local` → the tester's real openid (obtained from a genuine `login` call in the test client).
- Guards: refuses unless env set / != prod / in allowlist / `MAP_CONFIRM==env`; refuses any non-fixture `_id`;
  idempotent; never clears/creates/deletes. Real openid is **never** written to Git (fingerprint only, in a
  git-ignored `test-client/local/` file).
- **Status: PREPARED, not yet executed** — requires the real openid, which requires a bound client (Part 二.5).

## 8) C1–C10 (per the D4 plan) — real evidence status
Runner: `staging-infra/test-client/lib/c1-c10-runner.js` + `pages/runner` — drives the 3 fns through
`wx.cloud.callFunction` (server-derived identity), records PASS/FAIL/BLOCKED + identifiers.

| # | test | status | reason |
|---|---|---|---|
| C1 | conditional-update atomicity (10 concurrent GET) | **BLOCKED** | needs bound client → real OPENID; server-side invoke = 401 |
| C2 | parallel getChallengeEvent | **BLOCKED** | same |
| C3 | parallel submit idempotency (5 same submits) | **BLOCKED** | same |
| C4 | legacy record recovery (STG-REC-01/02) | **BLOCKED** | same |
| C5 | 30-day unique plan | **BLOCKED** | same |
| C6 | Day30 completion | **BLOCKED** | same |
| C7 | Day31 rejection (no re-serve) | **BLOCKED** | same |
| C8 | eventBankVersion expansion → plan unchanged (before/after) | **BLOCKED** | same; compares served eventId before/after expansion |
| C9 | expired-membership rights unchanged (STG-EXP-01) | **BLOCKED** | same |
| C10 | unrecoverable legacy → `LEGACY_PLAN_UNRECOVERABLE` | **BLOCKED** | same |

- **PASS 0 / FAIL 0 / BLOCKED 10.** No mocks substituted. Real cloud evidence requires the Part 二.5 binding.
- C8's before/after comparison logic is implemented (served eventId must not change across a bank expansion);
  it will produce real evidence the moment the runner can authenticate.

## 9) Remote changes / open issues
- **Remote writes this round:** NONE to production. Staging: only the **synthetic backups** (read-only dumps)
  written to the local repo; no staging collection mutation performed this turn.
- **Open (owner action required):** bind staging to the mini-program (`wxd441fbf3b9f10aa3`) via 微信公众平台/
  腾讯云控制台 → then run the test client + `map-identity.js` → then run C1–C10. **PAUSE on any
  rebind/换绑/销毁重建/新增付费.**
- No HTTP identity bypass; no real payment; no production release.
