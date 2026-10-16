# RC8_14_D12_R5B — Test-identity onboarding · Phase 1/3/4 evidence (staging-only)

- taskId: `RC8_14_D12_R5B_3_TEST_IDENTITY_ONBOARDING` · owner 009 · P0 · `MODE=OWNER_ASSISTED_STAGING_IDENTITY_SETUP`
- base workdir `/home/ubuntu/rc88-6q-refoundation` · branch `feature/rc8.13-virtual-payment` · HEAD `1ee5cca` (matches EXPECTED_HEAD)
- staging `fanshen002-d9g0rjr3b6e313af5` (only writable env) · production `fanshex-d2g0adgv7dfbc9bdc` (READ-ONLY, untouched)
- date 2026-10-16 · `START_CHALLENGE=false` · `CONCURRENT_START=false` · `PAYMENT_ACTIONS=false` · `ENTITLEMENT_MUTATION=false` · `PRODUCTION_MUTATION=false` · `STOP_AFTER_IDENTITY_ACCEPTANCE=true`

> Scope executed this turn: **Phase 1 (client preparation, complete) + Phase 3/4 (read-only acceptance/isolation on the
> current staging state)**. Phase 2 is an **owner device action** (real WeChat account scan), which the agent cannot
> perform. Real-identity verification therefore stays **pending owner Phase 2**, and the D12 eight-way concurrency test
> remains **prepared, not executed**.

## AUTHORIZATION compliance
| flag | required | actual |
|---|---|---|
| REAL_TEST_ACCOUNT_LOGIN | true | **not executed** (owner device, Phase 2) |
| NORMAL_LOGIN_USER_CREATION | true | armed in client (`login` only); creation happens in Phase 2 |
| START_CHALLENGE / CONCURRENT_START / PAYMENT_ACTIONS / ENTITLEMENT_MUTATION / PRODUCTION_MUTATION | false | **never invoked** |

No `startChallenge`, no `submitChallengeChoice`, no concurrency run, no payment, no entitlement/membership write, no
deploy, no Git commit/push, no production mutation were performed. Only **read-only** `tcb db nosql execute` (find)
and `tcb fn list` reads were issued.

---

## PHASE 1 — CLIENT PREPARATION (`TEST_CLIENT_READY`)

Client: `rc814-staging/staging-infra/test-client/` (independent project, NOT the official client).

| requirement | status | evidence |
|---|---|---|
| staging-bound test client | ✅ | `app.js`: `wx.cloud.init({ env: STAGING_ENV })`; `project.config.json` `miniprogramRoot`=./, appid fixed |
| exact literal staging envId | ✅ | `const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'` in `app.js` + `pages/index/index.js` |
| AppID verified | ✅ | `project.config.json` appid `wxd441fbf3b9f10aa3` == official client AppID; env-list confirms target env |
| no production fallback | ✅ | no `DYNAMIC_CURRENT_ENV`; prod envId `fanshex-…` appears **only in comments**; static tests assert no `env:` prod value |
| fresh preview QR | ✅ | `local/preview-test-client.png` (git-ignored), commit `1ee5cca`, sha256 `9bae71325621d329d5b32887ad18b1d88287fb28bd4c4a3ee7e592e7ddc3cf7f`, AppID `wxd441fbf3b9f10aa3` |
| **no** automatic `startChallenge` on login path | ✅ | v3 `app.js` `onLaunch` = identity self-check only; `login()` calls ONLY `login`; `onLogin` calls `getApp().login()`; asserts strip comments + reject any `startChallenge` |
| no automatic retries | ✅ | no `setTimeout`/`setInterval`/retry in `app.js`/`index.js`; login is single-attempt (old official `app.js` had `setTimeout(_doLogin)` retries — the test client does not) |
| test logs redact openid | ✅ | `require('./lib/preview-utils.js').redactOpenid`; full openid form `o[A-Za-z0-9_-]{20,}` → 6-char prefix + `…`; stderr edge fixed |

Client change (this turn): added normal-login onboarding — `app.js` `login()` (calls `login` only), `pages/index/index.js`
`onLogin` + state, `index.wxml` "步骤 1b · 普通登录（仅 login）" card. Identity remains server-derived; no payload openid.

### Local verification (all green)
| check | result |
|---|---|
| `node --check app.js` / `pages/index/index.js` | OK |
| `tests/d10-panel.test.js` | `D10_PANEL_TEST pass=39 fail=0` |
| `tests/d10-response-privacy.test.js` | `D10_RESPONSE_PRIVACY_TEST pass=24 fail=0` |
| `tests/d11-concurrency-panel.test.js` | `D11_CONCURRENCY_PANEL_TEST pass=34 fail=0` |
| `tests/d12-login-onboarding.test.js` (new) | `D12_LOGIN_ONBOARDING_TEST pass=25 fail=0` |
| `tests/rc8.14/run.js` (offline regression) | `RC8.14 REGRESSION SET: PASS (14/14)` |
| `bash preflight.sh` | OK (isolated staging, marker `staging`, `staging=true`, envId match) |
| `DEPS_PREFLIGHT=1 bash preflight.sh` | OK (12 collections, 8 indexes, synthetic users present) |

Deliverable package rebuilt: `dist/rc814-test-client.tar.gz` sha256 `782316eb32f880354a9032f297daecade37bd486f00f77388018036d747e49f7`
(21 files; **excludes** `local/` — no QR, no identity mapping, no secrets).

---

## PHASE 2 — OWNER DEVICE ACTION (PENDING — not executed by agent)

**Owner steps** (separate real WeChat account, distinct from the owner `oZa463…`):
1. Confirm the account binding + 「使用已有腾讯云环境」 conversion for `fanshen002-d9g0rjr3b6e313af5` (OWNER-STEPS.md, official console path).
2. 微信开发者工具 → 导入项目 → `test-client/` (appid `wxd441fbf3b9f10aa3`).
3. **Scan the fresh preview QR** (`local/preview-test-client.png`) with the **separate test WeChat account**.
4. 步骤 1 · 身份自检 → confirm openid / appid non-empty.
5. 步骤 1b · **普通登录（`login`）only** → confirm 登录成功.
6. **DO NOT** click `startChallenge`; **do not** submit challenge answers; **do not** purchase membership; **do not** invoke replay.

Return to agent: the masked/none login result (or the raw `login` response). The agent then runs Phase 3 fully against the
new test identity (and only then can REAL_TEST_IDENTITY_VERIFIED flip to YES).

---

## PHASE 3 — IDENTITY ACCEPTANCE (`MODE: READ_ONLY`)

Pre-Phase-2 state: **no independent test identity exists yet** (only the owner identity + 9 synthetic users). The identity
assertions below therefore report the honest precondition and will be re-run after Phase 2.

| check | result | evidence (read-only) |
|---|---|---|
| real `getWXContext` identity | ⏸ PENDING | `stagingIdentityProbe` reads identity ONLY from `cloud.getWXContext().OPENID`; requires real WeChat caller |
| test identity ≠ owner | ⏸ CANNOT VERIFY | no test identity yet |
| normal `users` record exists (test) | ⏸ NO (yet) | `users` real (non-synthetic) = 1 (owner only) |
| challenge_records = 0 for test identity | ⏸ N/A → will be 0 | no test-identity rows exist (count 0 by construction) |
| challenge_active = 0 for test identity | ⏸ N/A → will be 0 | `challenge_active` keyed by synthetic/owner only; no test-identity key |
| challenge_full = false | ⏸ PENDING | `entitlements` = 0, `memberships` = 0 → no `challenge_full`; a fresh free test user will be `challenge_full=false` |
| test identity has no legacy trial | ✅ by construction | no test-identity record/trial exists |
| no unexpected challenge creation | ✅ | 0 writes this turn; no `startChallenge` invoked |
| redact full openid | ✅ | probe returns `openidMasked` (4+…+3) + `openidFingerprint` (sha256[:12]); all client logs use `redactOpenid` |

Owner identity fingerprint (read-only, redacted): `oZa463…gNo`, len 28, sha256[:12] `d9cb1cb3dd98`.

---

## PHASE 4 — ISOLATION (`MODE: READ_ONLY`)

Baseline snapshot: `rc814-staging/staging-infra/baselines/pre-D12R5B-login-onboarding.json` (captured 2026-10-16T04:53:40Z).

| check | required | observed | ok |
|---|---|---|---|
| owner trial count | remains 12 | 12 (all `trialMode=true`) | ✅ |
| owner canonical idx | remains 2 | 2 (record `42eeed266ad0530d006ce9ff22048acb`, choices CE012/A + GAME015/B) | ✅ |
| owner choices/scores unchanged | unchanged | owner records hash `b6a4a981a859a464` (pre-change snapshot) | ✅ |
| existing challenge_records total | remains 21 | 21 | ✅ |
| 3 synthetic sessions unchanged | unchanged | `challenge_active` = 3 (`D12R5B1_SYNTH_UNIQ_A`, `_STALE_B`, `_STALE_C`), hash `0b24f7dac2da15de` | ✅ |
| entitlements unchanged | unchanged | `entitlements` = 0 | ✅ |
| memberships unchanged | unchanged | `memberships` = 0 | ✅ |
| production unchanged | unchanged | prod `tcb fn list` = 20 fns; no `startChallenge`/`submitChallengeChoice`/`stagingIdentityProbe` present; **0 mutations** | ✅ |

Other staging read-only counts: `challenge_events`=34 · `users`=10 (9 synthetic + 1 owner) · `user_profiles`=1 · `staging`(marker)=1 · `orders`=0.

---

## D12 eight-way concurrency test — PREPARED, NOT EXECUTED

- `challenge_active` already carries the atomic **session-claim** model (unique `_id=openid`, unique `creationId`, conditional CAS, TTL/stale-steal, READY convergence) shipped at `4c87032`/`1ee5cca`.
- Staging hosts the deployed `startChallenge` (fnId `lam-ouedpv7n`, updated 2026-10-15 22:09).
- The **eight-way** concurrent `startChallenge` run requires an authenticated real identity → **BLOCKED until Phase 2**.
- `CONCURRENT_START=false` honored: **not started**.

---

## OUTPUT_REQUIRED
```
STATUS: BLOCKED_AT_OWNER_ACTION (Phase 1 PASS · Phase 3/4 pre-change PASS · real-identity pending Phase 2 device login)
TEST_CLIENT_READY: YES
REAL_TEST_IDENTITY_VERIFIED: NO (pending owner Phase 2 scan/login)
TEST_IDENTITY_DISTINCT_FROM_OWNER: CANNOT_VERIFY (no test identity yet)
NORMAL_LOGIN_SUCCESS: NOT_EXECUTED (owner device)
TEST_USER_RECORD_EXISTS: NO (yet; re-verified after Phase 2)
TEST_CHALLENGE_RECORD_COUNT: 0 (no test-identity rows exist)
TEST_ACTIVE_SESSION_COUNT: 0 (no test-identity session)
TEST_CHALLENGE_FULL: false (no challenge_full entitlement; entitlements=0/memberships=0)
OWNER_RECORDS_UNCHANGED: YES (12 records · canonical idx 2 · hash b6a4a981a859a464)
SYNTHETIC_SESSIONS_UNCHANGED: YES (challenge_active=3 · hash 0b24f7dac2da15de · 9 synthetic records hash c1520ab8feee9ffe)
PRODUCTION_CHANGED: NO
EIGHT_WAY_TEST_ELIGIBLE: PENDING_PHASE_3 (asset-ready; needs authenticated test identity)
NEXT_GATE: OWNER_PHASE_2_DEVICE_LOGIN (scan fresh preview QR → identity self-check → login only)
```

## FORBID compliance
No startChallenge · no concurrent requests · no synthetic owner identities · no record clearing · no `challenge_active`
edit · no historical Trial deletion · no entitlement/payment change · no cloud-function deploy · no Git commit/push · no
production mutation. **STOP_AFTER_IDENTITY_ACCEPTANCE honored.**
