# RC8.4 V6 — INTERNAL SHADOW DEPLOY PLAN (B2.6-R1)

STATUS: **DESIGN / PLAN ONLY — NOT EXECUTED.**
NO deploy. NO env change. NO SHADOW activation. NO ON activation. NO payment change.

Baseline: `b179ca586673c9a1e78383b789da8c4a92e2a6bf` (+ B2.6-R1 allowlist fix, uncommitted).

---

## 1. First activation scope

INTERNAL ALLOWLIST ONLY + SYNCHRONOUS SHADOW. Bounded extra latency is accepted
**only** for allowlisted internal testers.

```
RC84_V6_WORLDVIEW_MODE      = SHADOW
RC84_V6_SHADOW_ALLOWLIST    = <comma-separated openids>   # fail-closed; empty ⇒ nobody
```

- Authorizer: `isV6ShadowAuthorized(serverOpenid, RC84_V6_SHADOW_ALLOWLIST)`.
- `serverOpenid` = `cloud.getWXContext().OPENID` (**server-derived**). Client-supplied openid is never consulted.
- Non-allowlisted (or empty allowlist) ⇒ **exact OFF behavior**: zero V6 calls, byte-identical response.
- No hard-coded openid in source.
- `ALL_USER_SHADOW_ALLOWED = NO`.

## 2. Accepted latency (documented, internal only)

```
INTERNAL_SHADOW_MAX_ADDED_LATENCY_MS ≈ 28000   (# 2 × 14000ms attempts + overhead)
FUNCTION_TIMEOUT_MS                  = 60000   (generateAiReport, cloudbaserc.json — UNCHANGED)
```

Synchronous awaited SHADOW is kept (no unreliable post-response Promise execution).
This latency applies **only** to `turnaround_strategy_v6` requests from allowlisted
openids; no other diagnostic path is affected.

## 3. Deploy secret-order risk and the chosen safe strategy

### Root cause
`tcb fn deploy` auto-applies `functions[].envVariables` from `cloudbaserc.json`
(CloudBase CLI help + `updateFunctionConfig`, `envVarUpdateMode` default `overwrite`).
Tracked `cloudbaserc.json` carries a **placeholder** `AI_API_KEY` (`<YOUR_...>`), so a
plain `tcb fn deploy generateAiReport` would **overwrite the live runtime secret with
the placeholder** until `scripts/set-env.sh` runs → order-dependent, unsafe.

### Chosen strategy — CODE-ONLY DEPLOY (no env application)
Use `tcb fn code update` which updates the function **code only** and does not send
`Environment`:

```
# STEP A — deploy ONLY generateAiReport code (no env application)
tcb fn code update generateAiReport --envId fanshex-d2g0adgv7dfbc9bdc

# STEP B — inject real env from the approved gitignored file (operator)
cp .env.deploy.example .env.deploy      # operator fills real values (never committed)
bash scripts/set-env.sh                 # tcb fn config:update generateAiReport --envVariables {...}

# STEP C — verify presence ONLY (never print values)
tcb fn detail generateAiReport --envId fanshex-d2g0adgv7dfbc9bdc   # confirm AI_API_KEY present, non-placeholder

# STEP D — ONLY THEN set SHADOW (separate owner-authorized task; NOT here)
```

**Why this removes the placeholder risk:** `tcb fn code update generateAiReport` does
**not** apply `functions[].envVariables`, so the live `AI_API_KEY` already present in
the function env is preserved across the code deploy. The placeholder is never pushed.
**Do NOT use `tcb fn deploy generateAiReport`** for this function.

`PLACEHOLDER_SECRET_DEPLOY_RISK = NO` (with this strategy).

### Fallback mitigation (only if code-only deploy is ever unavailable)
Blank the placeholder in tracked `cloudbaserc.json` (`AI_API_KEY: ""`) so `tcb fn deploy`
cannot publish it, then `set-env.sh`. Not selected (code-only is strictly safer).

## 4. Production key hard gate

```
ROTATED_PRODUCTION_AI_KEY_READY = OWNER_ATTESTATION_REQUIRED
ROTATED_PRODUCTION_AI_KEY_PRESENT = (verify presence only, post-injection)
PRODUCTION_USES_TEST_KEY = NO          # AI_API_KEY_TEST is experiment-only, never production
```

Do NOT deploy unless the owner confirms the production model key has been safely
rotated/configured. Verify **presence only**; never print/echo values.

## 5. Deploy scope guard

Future first deployment may touch **ONLY `generateAiReport`**.

```
PAYMENT_FUNCTION_DEPLOY_COUNT = 0
```
Must NOT deploy: `createOrder`, `payCallback`, `verifyPayment`, `refundOrder`.

## 6. Observability (safe aggregate metadata only)

Record per allowlisted SHADOW request:

```
requestCount, eligiblePrimaryCount, modelAttemptCount, validatorPassCount,
retryCount, fallbackCount, providerErrorCount, timeoutCount,
modelLatencyMs (buckets), reportVersion
```

Do **NOT** log: `openid`, raw answers, raw prompt, full report, secret.

Derived: `SHADOW_VALIDATOR_PASS_RATE`, `SHADOW_RETRY_RATE`, `SHADOW_FALLBACK_RATE`,
`SHADOW_MODEL_P50_MS`, `SHADOW_MODEL_P95_MS`.

## 7. Internal SHADOW acceptance

Initial sample: **20–30 internal/test reports**.

Expansion gate:
```
VALIDATOR_PASS_RATE >= 95%
DIAGNOSIS_DRIFT = 0
UNSUPPORTED_CLAIM = 0
ONTOLOGY_LEAK = 0
WEALTH_PROMISE = 0
FUNCTION_TIMEOUT_COUNT = 0
```
Also report RETRY_RATE, FALLBACK_RATE, MODEL_P50_MS, MODEL_P95_MS.
