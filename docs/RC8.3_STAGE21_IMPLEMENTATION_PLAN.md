# RC8.3 Stage21 — Release Readiness Implementation Plan (P0)

> **Status:** IMPLEMENTATION PLANNING (planning-only). NOT production implementation
> authorization. No canonical merge, no deploy, no env/config mutation, no Gate-B
> mutation, no PRIMARY/rollout activation, no manufactured Gate-B traffic.
>
> Source of truth = the ACCEPTED/FROZEN Stage21 Release Readiness Design
> (`ff519be1244d5493fd73474f11d632096db2a1ba`).

---

## 0. Frozen Authorities

| Key | Value |
|---|---|
| `CANONICAL_SHA` | `0874254ede490d7fef6c20942ff663c0970a445c` |
| `STAGE21_ACCEPTED_DESIGN_SHA` | `ff519be1244d5493fd73474f11d632096db2a1ba` |
| `HARNESS_ACCEPTED_SHA` | `2a5f606b90312e509f651002cb119732bc335c85` |
| `GATE_B` | `ACTIVE / WAITING_FOR_NATURAL_EVIDENCE` |
| `V2` | `SHADOW` |
| `V21` | `SHADOW` |
| `PRIMARY` | `OFF` |

---

## 1. Implementation Workstreams (W1–W12)

### W1 — V2.1 AI Authority Guard

- **PURPOSE:** Enforce V2.1-specific immutable diagnostic fields so AI expression
  cannot rewrite engine conclusions.
- **INPUT:** V2.1 engine result (cognitiveBlindSpot / cognitiveArchetype /
  worldStrategy / scenarioSimulation semantic conclusion); AI expression input+output.
- **OUTPUT:** `AUTHORITY_VALIDATOR` (V2.1-specific) + violation result
  (`VIOLATION_RESULT` = discard AI mutation, preserve ENGINE_RESULT, deterministic
  fallback expression).
- **FILES_LIKELY_TOUCHED:** new `lib/engine/worldModel/v2_1/authorityGuardV21.js`
  (+ tests); expression/report wiring point (V2.1 primary path only — NOT yet live).
- **DEPENDENCIES:** W2 (deterministic fallback); frozen design §8.
- **TESTS:** authority-preservation unit tests (valid rewrite passes; blindSpot/
  archetype/strategy/scenario mutation rejected), determinism, regression.
- **RISK:** over-broad guard blocking legitimate presentation rewrite.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (isolated non-production branch).
- **REQUIRES_POST_GATE_B:** NO (but merge/deploy deferred).
- **REQUIRES_PRODUCTION_ACCESS:** NO.
- **REQUIRES_OWNER_AUTHORIZATION:** for merge/deploy only.

### W2 — Deterministic AI Fallback

- **PURPOSE:** Guarantee AI failure (timeout/unavailable/malformed/authority
  violation) never changes engine diagnosis.
- **INPUT:** `generateFallbackReport` current implementation + V2.1 contract.
- **OUTPUT:** classification + V2.1 adapter if needed.
- **FILES_LIKELY_TOUCHED:** `lib/prompt-v4/reportGuardV4.js` (read-only reference);
  possible new V2.1 fallback adapter (branch-only).
- **DEPENDENCIES:** W1.
- **TESTS:** fallback determinism; engine-result preservation; V2.1 contract coverage.
- **RISK:** fallback path not covering V2.1 fields.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (isolated).
- **REQUIRES_POST_GATE_B:** NO (merge/deploy deferred).
- **REQUIRES_PRODUCTION_ACCESS:** NO.
- **REQUIRES_OWNER_AUTHORIZATION:** merge/deploy only.

### W3 — Config Authority + Readback

- **PURPOSE:** Make deployed CloudBase function env the single authoritative
  runtime-mode source.
- **INPUT:** control-plane readback (deployed function env).
- **OUTPUT:** `readProductionConfig()` / `normalizeConfigForFingerprint()` /
  `compareExpectedVsLiveConfig()` (API/schema).
- **FILES_LIKELY_TOUCHED:** new tooling (non-cloudfunction), no production code.
- **DEPENDENCIES:** W4.
- **TESTS:** normalization determinism; secret/identity exclusion.
- **RISK:** accidentally treating repo config as authority.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (read-only tooling).
- **REQUIRES_POST_GATE_B:** NO.
- **REQUIRES_PRODUCTION_ACCESS:** READ-ONLY (env readback only).
- **REQUIRES_OWNER_AUTHORIZATION:** for any production read that needs credentials.

### W4 — Config Fingerprint + Drift Detection

- **PURPOSE:** Deterministic secret-free fingerprint + drift detection.
- **INPUT:** normalized config (W3).
- **OUTPUT:** fingerprint schema (canonical ordering, no secrets, no identity,
  stable serialization) + hash algorithm recommendation + verification workflow.
- **FILES_LIKELY_TOUCHED:** new tooling only.
- **DEPENDENCIES:** W3.
- **TESTS:** stability; canonical ordering; secret exclusion.
- **RISK:** unstable serialization → false drift.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES.
- **REQUIRES_POST_GATE_B:** NO.
- **REQUIRES_PRODUCTION_ACCESS:** READ-ONLY.
- **REQUIRES_OWNER_AUTHORIZATION:** read credentials.

### W5 — Code Deploy / Config Change Separation

- **PURPOSE:** Ensure CODE_DEPLOY never changes runtime mode.
- **INPUT:** current repo/tooling deploy paths.
- **OUTPUT:** `SAFE_CODE_ONLY_DEPLOY_PATH` + `UNSAFE_AUTO_CONFIG_SYNC_PATHS` inventory.
- **FILES_LIKELY_TOUCHED:** documentation + (possibly) CI guard script (branch-only).
- **DEPENDENCIES:** none (read-only investigation now).
- **TESTS:** none (analysis; later CI guard test).
- **RISK:** missing a config-syncing tool path.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (analysis + guard).
- **REQUIRES_POST_GATE_B:** NO.
- **REQUIRES_PRODUCTION_ACCESS:** NO (read-only repo/tooling).
- **REQUIRES_OWNER_AUTHORIZATION:** for any CI change.

### W6 — Selective Primary Cohort Assignment

- **PURPOSE:** Stable deterministic bucket (no OPENID freeze, no Math.random, no
  manual switching, no identity export).
- **INPUT:** frozen design §10.
- **OUTPUT:** ADR (REQUIRED) resolving subject-key privacy, salt ownership, bucket
  cardinality, rollout percentage mapping, reassignment policy, rollback behavior.
- **FILES_LIKELY_TOUCHED:** new ADR doc; future `cohortBucket.js` (branch-only).
- **DEPENDENCIES:** none.
- **TESTS:** determinism; privacy (no OPENID in artifact).
- **RISK:** privacy (OPENID leakage) if subject key frozen prematurely.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (ADR + pure function).
- **REQUIRES_POST_GATE_B:** NO.
- **REQUIRES_PRODUCTION_ACCESS:** NO.
- **REQUIRES_OWNER_AUTHORIZATION:** before any rollout activation.

### W7 — Pre-Selective Threshold Governance

- **PURPOSE:** Classify ZERO_TOLERANCE vs STATISTICAL thresholds.
- **INPUT:** frozen design §11.
- **OUTPUT:** threshold governance doc (zero-tolerance rationale for structural
  invariants; statistical → THRESHOLD_REQUIRES_EVIDENCE + future evidence sources).
- **FILES_LIKELY_TOUCHED:** doc only.
- **DEPENDENCIES:** none.
- **TESTS:** none.
- **RISK:** setting numbers without evidence.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES.
- **REQUIRES_POST_GATE_B:** NO.
- **REQUIRES_PRODUCTION_ACCESS:** NO.
- **REQUIRES_OWNER_AUTHORIZATION:** NO (planning only).

### W8 — Rollback Operational Tooling

- **PURPOSE:** Minimal rollback tools (pre-readback, authorized config mutation,
  post-readback, fingerprint verify, function health verify, legacy render verify).
- **INPUT:** frozen design §13.
- **OUTPUT:** rollback operational contract + safe-path discovery (CloudBase).
- **FILES_LIKELY_TOUCHED:** doc + (future) rollback script (branch-only).
- **DEPENDENCIES:** W3, W4.
- **TESTS:** none (no production mutation now).
- **RISK:** rollback tooling implicitly deploying code.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (design/discovery only).
- **REQUIRES_POST_GATE_B:** NO (but execution deferred).
- **REQUIRES_PRODUCTION_ACCESS:** YES (to execute rollback, not to design).
- **REQUIRES_OWNER_AUTHORIZATION:** YES for any execution.

### W9 — Release Manifest Generator

- **PURPOSE:** Machine-readable + human-auditable immutable release artifact.
- **INPUT:** frozen Stage21 manifest schema (22 fields).
- **OUTPUT:** manifest generator (no secrets, no identity).
- **FILES_LIKELY_TOUCHED:** new tooling only.
- **DEPENDENCIES:** W4 (config fingerprints feed manifest).
- **TESTS:** schema validity; secret exclusion.
- **RISK:** embedding secrets/identity in artifact.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES.
- **REQUIRES_POST_GATE_B:** NO.
- **REQUIRES_PRODUCTION_ACCESS:** READ-ONLY (config readback).
- **REQUIRES_OWNER_AUTHORIZATION:** for any production read.

### W10 — RC End-to-End Qualification Runner

- **PURPOSE:** Reuse ACCEPTED Harness + release regression + minimal real-device.
- **INPUT:** Harness (`2a5f606`) + release candidate.
- **OUTPUT:** qualification runner for RC candidate.
- **FILES_LIKELY_TOUCHED:** new tooling; reuses `tools/rc83-v21-test-harness`.
- **DEPENDENCIES:** Harness; W1/W2 (to exercise authority/fallback paths).
- **TESTS:** LOCAL_DIRECT regression; determinism; contract.
- **RISK:** interpreting Harness PASS as Gate-B PASS / diagnosis correctness.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (LOCAL_DIRECT).
- **REQUIRES_POST_GATE_B:** NO (but full RC qualification gated).
- **REQUIRES_PRODUCTION_ACCESS:** NO (LOCAL_DIRECT; later READ-ONLY).
- **REQUIRES_OWNER_AUTHORIZATION:** for any staging/production run.

### W11 — Real-Device Minimum Smoke Protocol

- **PURPOSE:** Compress real-device tests to 1–3 journeys covering harness-uncovered
  capabilities (WeChat context, auth, cloud invoke, report UI, poster/canvas, album,
  share, login/member, payment integration).
- **INPUT:** frozen design §21.
- **OUTPUT:** minimum smoke protocol doc.
- **FILES_LIKELY_TOUCHED:** doc only.
- **DEPENDENCIES:** none.
- **TESTS:** none (not executed now).
- **RISK:** scope creep → manual 18Q re-fill at scale.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (protocol design).
- **REQUIRES_POST_GATE_B:** NO (but execution deferred).
- **REQUIRES_PRODUCTION_ACCESS:** YES (real device).
- **REQUIRES_OWNER_AUTHORIZATION:** YES.

### W12 — Payment Integration Verification Discovery

- **PURPOSE:** Discover current payment test capability (sandbox/test/mock/read-only/
  safe controlled transaction).
- **INPUT:** payment code (read-only).
- **OUTPUT:** `PAYMENT_TEST_CAPABILITY` verdict.
- **FILES_LIKELY_TOUCHED:** none (read-only).
- **DEPENDENCIES:** none.
- **TESTS:** none.
- **RISK:** assuming sandbox exists.
- **GATE_B_SAFE_TO_IMPLEMENT_NOW:** YES (read-only).
- **REQUIRES_POST_GATE_B:** NO.
- **REQUIRES_PRODUCTION_ACCESS:** READ-ONLY.
- **REQUIRES_OWNER_AUTHORIZATION:** NO.

---

## 2. Gate-B Interference Classification

| Workstream | Class | Rationale |
|---|---|---|
| W1 AI Authority Guard | CLASS_B (implementable now, not mergeable) | isolated branch; V2.1 SHADOW only; no canonical/deploy |
| W2 Deterministic Fallback | CLASS_B | same |
| W3 Config Authority | CLASS_A (safe now, isolated non-production) | read-only tooling |
| W4 Config Fingerprint | CLASS_A | read-only tooling |
| W5 Deploy Separation | CLASS_A | analysis + guard |
| W6 Cohort Assignment | CLASS_A | ADR + pure function |
| W7 Threshold Governance | CLASS_A | doc only |
| W8 Rollback Tooling | CLASS_A (design/discovery) | execution = CLASS_D |
| W9 Release Manifest | CLASS_A | tooling |
| W10 RC Qualification | CLASS_A (LOCAL_DIRECT) | staging/production run = CLASS_D |
| W11 Real-Device Protocol | CLASS_A (design) | execution = CLASS_D |
| W12 Payment Discovery | CLASS_A | read-only |

**Principle (held):** while Gate-B ACTIVE, nothing that changes canonical/deployed
behavior, runtime mode, production config, or collection semantics may enter
canonical/production. All CLASS_B work lives on isolated branches and is NOT merged.

---

## 3. AI Authority Implementation Plan (W1)

Locked V2.1 diagnostic fields (minimum): `cognitiveBlindSpot`, `cognitiveArchetype`,
`worldStrategy`, `scenarioSimulation` semantic conclusion.

Components:

```text
ENGINE_SNAPSHOT        = deep-frozen copy of engine conclusions before AI expression
AI_EXPRESSION_INPUT    = ENGINE_SNAPSHOT + presentation hints
AI_EXPRESSION_OUTPUT   = AI-produced report expression
AUTHORITY_VALIDATOR    = compares AI output against ENGINE_SNAPSHOT on locked fields
VIOLATION_RESULT       = discard AI mutation; preserve ENGINE_RESULT;
                         use deterministic fallback expression
```

Constraints: MUST NOT reuse/claim `reportGuardV4` covers V2.1. May reuse generic
mechanisms, but V2.1 contract requires independent validation.

---

## 4. Deterministic Fallback Plan (W2) — Investigation Result

`generateFallbackReport(baseContract)` (in `reportGuardV4.js`) investigated read-only:

- **Deterministic:** YES — `JSON.parse(JSON.stringify(baseContract))` deep-copy;
  no AI call, no randomness, no `Date.now` affecting semantics.
- **Depends on AI:** NO.
- **Changes diagnostic semantics:** NO — copies Mapper-provided base fields verbatim,
  marks `_renderSource = 'rule_fallback'`.
- **Covers V2.1 contract:** NOT VERIFIED — it copies `baseContract.report` shape
  (V4 report). V2.1-specific immutable fields (cognitiveBlindSpot etc.) are not
  explicitly represented here.

**Classification:** `REUSABLE_WITH_ADAPTER` — needs a V2.1 fallback adapter that
carries the V2.1 engine snapshot fields unchanged and applies the same
deterministic no-AI copy semantics. NOT `REUSABLE_AS_IS` for V2.1 authority
fallback; NOT `NOT_SUITABLE`.

No production code modified.

---

## 5. Config Control Plane Plan (W3)

Authoritative source: **deployed CloudBase function / control-plane env** (NOT
`cloudbaserc.json`, NOT repo config, NOT local `.env`).

Proposed API (schema only):

```text
readProductionConfig()        → { environmentId, v2Mode, v21Mode, engineMode,
                                   cohortConfig, allowlistState }
normalizeConfigForFingerprint() → canonical-ordered, secret-free object
compareExpectedVsLiveConfig(expected, live) → { match, driftFields }
```

No config mutation executed in this phase.

---

## 6. Config Fingerprint Plan (W4)

Payload (minimum): `environmentId`, `v2Mode`, `v21Mode`, `engineMode`,
`cohortConfig`, `allowlistState`.

Requirements: canonical ordering; no secrets; no identity data; stable
serialization.

Outputs: fingerprint schema; hash algorithm recommendation (e.g. SHA-256 over
canonical JSON with key ordering); verification workflow (EXPECTED vs LIVE →
`CONFIG_DRIFT_DETECTED` on mismatch).

---

## 7. Deployment Safety Plan (W5) — Investigation Result

`cloudbaserc.json` (canonical `0874254`) `generateAiReport` env block contains:

```text
RC83_WORLD_MODEL_MODE = SELECTIVE_PRIMARY
RC83_WORLD_MODEL_ALLOWLIST = oZa463Yb2VY0k9Es_pGzdHFtigNo
```

This is a **stale/unsafe** repo config. Any deploy command that applies
`cloudbaserc.json` envVariables would set production to SELECTIVE_PRIMARY +
shrink allowlist. Verified precedent: Stage20 R1 used `tcb fn code update`
(code-only, no env) — the SAFE path.

```text
SAFE_CODE_ONLY_DEPLOY_PATH   = tcb fn code update (function code only, no env)
UNSAFE_AUTO_CONFIG_SYNC_PATHS = tcb fn deploy (applies cloudbaserc.json envVariables)
```

Deployment safety plan requires: (a) codify the safe path in release procedure;
(b) add a CI guard that blocks `tcb fn deploy` on generateAiReport unless explicit
config-change authorization exists.

---

## 8. Cohort Assignment ADR Plan (W6)

`ADR_REQUIRED = YES`. ADR must resolve: subject key privacy (not OPENID by default),
salt ownership, bucket cardinality, rollout percentage mapping, reassignment
policy, rollback behavior. Output bucket = `stableHash(subjectKey + rolloutSalt)
mod N`. Forbidden: Math.random, manual switching, identity-list export.

---

## 9. Threshold Governance Plan (W7)

ZERO_TOLERANCE_INVARIANTS (structural/safety):

```text
user-visible shadow violation        → zero-tolerance
AI authority violation               → zero-tolerance
contract validation failure          → zero-tolerance
unexpected DB side effect            → zero-tolerance
rollback unavailable                 → zero-tolerance
```

STATISTICAL_THRESHOLDS (`THRESHOLD_REQUIRES_EVIDENCE`):

```text
runtime exception rate               → evidence required (future source: Gate-B
                                       production error telemetry, read-only)
```

No numbers set now.

---

## 10. Rollback Tooling Plan (W8)

Minimal tool set: `pre-readback`, `authorized config mutation`, `post-readback`,
`fingerprint verify`, `function health verify`, `legacy render verify`.

Constraint: rollback tooling MUST NOT implicitly deploy code. Do not write
unverified CLI now; first discover current CloudBase safe config-change paths
(read-only).

---

## 11. Release Manifest Implementation Plan (W9)

Generator over frozen 22-field schema. Requirements: machine-readable,
human-auditable, immutable release artifact, no secrets, no identity. Must prove:
what code, what environment, what config, what gates, what rollout mode, what
rollback target.

---

## 12. RC Qualification Automation Plan (W10)

Reuse ACCEPTED Harness + release candidate regression + minimal real-device smoke.
Test tiers: `LOCAL_DIRECT` (harness, now), `STAGING/TEST ENV` (deferred),
`REAL PRODUCTION READONLY` (deferred), `REAL DEVICE` (deferred, owner). Harness
PASS ≠ Gate-B PASS ≠ diagnosis correctness.

---

## 13. Real Device Minimum Plan (W11)

1–3 complete journeys covering: WeChat context, auth, cloud invoke, report UI,
poster/canvas, album, share, login/member, payment integration (non-destructive).
Not executed now.

---

## 14. Payment Discovery (W12) — Investigation Result

`common/payment.js` (read-only):

- Contains `isMock: !mchid` mock path (`MOCK_PREPAY_`/`MOCK_TXN_`/`_mock:true`)
  when `WXPAY_MCHID` is unset.
- Header comment: "不再静默 fallback 到 mock 模式" — mock only when mchid absent;
  production requires `WXPAY_MCHID` + private key + apiV3Key, else explicit
  `WXPAY_PRIVATE_KEY_MISSING` failure.
- No dedicated sandbox/test-mode flag discovered; mock is a byproduct of missing
  production credentials, not an explicit test capability.

**Verdict:** `PAYMENT_TEST_CAPABILITY = PARTIAL` — mock path exists but is not a
designed sandbox; must not be treated as a verified test capability without
config confirmation. No real payment, no price change, no user transaction.

---

## 15. C4 Documentation Reconciliation

```text
C4-003A CODE_INTEGRATION_STATUS = ALREADY_INTEGRATED
   (externalConstraintGuardEvaluator present + executed in withinFamilyBlindSpotInference;
    C4-003A tip 8752167 is ancestor of canonical 0874254)
C4-003A DOCUMENTATION_STATUS = RECONCILIATION_REQUIRED
   (C4-003A/B/D ADR docs absent from canonical; C4-002 debt register still lists
    EXTERNAL_CONSTRAINT_GUARD_NOT_EXECUTED as open P1)
```

Proposed new governance debts (NOT auto-promoted to release blocker):

```text
P3_STAGE21_C4_003A_STATUS_LABEL_AMBIGUITY
C4_ADR_CANONICAL_DOCUMENTATION_GAP
```

Frozen Stage21 Accepted SHA is NOT modified.

---

## 16. Branch Plan (proposed, dependency-driven)

```text
feat/rc8.3-stage21-ai-authority          (W1 + W2)
feat/rc8.3-stage21-config-safety         (W3 + W4 + W5)
feat/rc8.3-stage21-cohort                (W6 + W7)
feat/rc8.3-stage21-release-manifest      (W8 + W9)
feat/rc8.3-stage21-qualification         (W10 + W11 + W12)
```

Plan only. No production merge created now.

---

## 17. Critical Path & Dependency DAG

```text
W1 ──▶ W2 ──▶ W10
W3 ──▶ W4 ──▶ W8 ──▶ W9
             └──▶ W10
W6 ──▶ (W7 independent)
W5  (independent)
W11, W12 (independent; W12 informs W11 payment item)
```

```text
PRE_GATE_B_SAFE_WORK        = W1,W2 (branch-only) + W3,W4,W5,W6,W7,W8,W9,W10
                              (LOCAL_DIRECT), W11,W12 (design/read-only)
POST_GATE_B_REQUIRED_WORK   = any merge to canonical; any deploy; any RC full
                              qualification against real evidence
SELECTIVE_PRIMARY_BLOCKERS  = Gate-B PASS + RC_READY (all §2 gates) + frozen
                              thresholds + cohort ADR + rollback verified +
                              external constraint guard reconciliation
FULL_PRIMARY_BLOCKERS       = SELECTIVE_PRIMARY stages A→D metrics within threshold
                              + full regression + all rollback paths verified
```

**Answer:** during Gate-B wait, we can safely complete all **planning + isolated
branch implementation + LOCAL_DIRECT qualification + read-only discovery**
(CLASS_A/CLASS_B). The furthest safe step is: implement W1–W12 on isolated
branches with LOCAL_DIRECT tests, emit machine-readable artifacts, and STOP
before any canonical merge / deploy / config mutation.

---

## 18. Implementation Authorization Boundary

```text
PLAN_COMPLETE             != IMPLEMENTATION_COMPLETE
IMPLEMENTATION_COMPLETE   != CANONICAL_MERGE_AUTHORIZATION
CANONICAL_MERGE           != PRODUCTION_DEPLOY_AUTHORIZATION
PRODUCTION_DEPLOY         != CONFIG_CHANGE_AUTHORIZATION
CONFIG_CHANGE             != PRIMARY_AUTHORIZATION
```

Each layer requires independent governance authorization.

---

## 19. Artifact

This document = `docs/RC8.3_STAGE21_IMPLEMENTATION_PLAN.md`, authored on the
isolated design branch. Canonical untouched while Gate-B ACTIVE.
