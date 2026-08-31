# RC8.3 Stage21 — Release Candidate Gate Design (FREEZE)

> **Status:** DESIGN FREEZE (governance-only). No PRIMARY implementation. No runtime
> change. No Gate-B change. No deploy. No merge canonical.
>
> This document designs the gate through which World Model V2.1 may — after
> independent authorization, in a future controlled rollout — move from `SHADOW`
> toward controlled `PRIMARY`. It is a plan, not an authorization.
>
> **R1 remediation note:** this revision incorporates independent-review governance
> gaps. It is still a design freeze — NOT an implementation authorization, NOT a
> C4-003A merge authorization, NOT a config-mutation authorization, NOT PRIMARY.

---

## 0. Source of Truth (Tier-0)

| Key | Value |
|---|---|
| `CANONICAL_SHA` | `0874254ede490d7fef6c20942ff663c0970a445c` |
| `HARNESS_ACCEPTED_SHA` | `2a5f606b90312e509f651002cb119732bc335c85` |
| `HARNESS_P0_STATUS` | `ACCEPTED` |
| `GATE_B` | `ACTIVE / WAITING_FOR_NATURAL_EVIDENCE` |
| `V2` | `SHADOW` |
| `V2.1` | `SHADOW` |
| `PRIMARY` | `OFF` |

**Isolation invariant:** Gate-B (Stage20 natural-evidence collection) and Stage21
(release-candidate design) are fully independent. Stage21 design work must not
touch Gate-B protocol, counters, or the canonical/deployed control plane.

**Canonical facts the design must respect (read-only, verified in-tree):**

- `lib/config/worldModelV21Mode.js` — V2.1 mode parser is **fail-closed**; closed
  set is exactly `OFF | SHADOW`; `PRIMARY` / `SELECTIVE_PRIMARY` are **forbidden**
  and resolve to `OFF`. (Any future SELECTIVE_PRIMARY requires an explicit,
  independently-audited parser extension — out of scope for this design freeze.)
- `lib/engine/worldModel/v2_1/primaryDecisionEngineV21.js` — categorical decision
  surface `PRIMARY_ALLOWED | FOLLOW_UP_REQUIRED | NO_PRIMARY_DEFICIT |
  INSUFFICIENT_EVIDENCE`, invoked only under the shadow runtime path.
- `lib/engine/worldModel/legacyDiagnosisAdapter.js` — legacy adapter that must
  remain intact (no V2.1 → legacy contamination, no loss of legacy rendering).
- `lib/report/reportContractV4.js` + `lib/prompt-v4/reportGuardV4.js` — V4 report
  contract + V4 `LOCKED_PATHS`. **See §8: V4 guard is NOT a V2.1 authority guard.**

---

## 1. Release State Machine

```text
SHADOW ──▶ RC_READY ──▶ SELECTIVE_PRIMARY ──▶ EXPANDED_PRIMARY ──▶ PRIMARY
```

Rollback transitions (always available, always reversible):

```text
SELECTIVE_PRIMARY ──▶ SHADOW
EXPANDED_PRIMARY  ──▶ SHADOW
PRIMARY           ──▶ legacy_rc8 / safe fallback
```

**Forbidden transition:** `SHADOW → 100% PRIMARY` (direct jump). Any state
advance beyond `SELECTIVE_PRIMARY` must pass through `EXPANDED_PRIMARY`.

### 1.1 Governance state vs runtime mode (R1 §14 — separated)

The state machine above is a **governance state machine**. It is distinct from the
**runtime feature mode** (the CloudBase function env var that actually routes
traffic). Conflation is forbidden.

- `GOVERNANCE_STATE` = which release-governance stage we are in (e.g. `RC_READY`).
- `RUNTIME_MODE` = what the deployed function env actually says (`SHADOW` /
  `SELECTIVE_PRIMARY` / …), read back from the control plane (§3).

A governance rollback from `RC_READY` does **not** "re-enter SHADOW (no-op)" as a
runtime action. Correctly:

```text
GOVERNANCE_TRANSITION:  RC_READY → SHADOW_GOVERNANCE_STATE
RUNTIME_MODE:           remains SHADOW (unchanged, no config mutation)
```

Each transition carries a 5-part definition (ENTRY / EXIT / ABORT / ROLLBACK /
AUTHORITY):

| Transition | ENTRY | EXIT | ABORT | ROLLBACK | AUTHORITY |
|---|---|---|---|---|---|
| SHADOW → RC_READY | §2 gates A–J all PASS | RC_READY frozen + manifest minted | any §2 gate regresses | governance → SHADOW_GOVERNANCE_STATE (runtime stays SHADOW) | independent design review + release owner |
| RC_READY → SELECTIVE_PRIMARY | §5 Stage A allowlist verified; real-device smoke PASS; §11 thresholds frozen | Stage A cohort live, shadow still recording | §7 abort | governance → SHADOW_GOVERNANCE_STATE + runtime rollback (§13) | release owner + independent audit |
| SELECTIVE_PRIMARY → EXPANDED_PRIMARY | Stage A/B metrics within frozen threshold | Stage C/D cohort live | §7 abort | runtime rollback (§13) | release owner + independent audit |
| EXPANDED_PRIMARY → PRIMARY | Stage D full-cohort metrics within threshold; all rollback paths verified | full PRIMARY | §7 abort | runtime rollback → legacy_rc8 | release owner + independent audit |

---

## 2. RC Entry Gates (`RC_READY`)

`RC_READY` requires **all** of the following independently verified PASS:

- **A. Gate-B PASS** — Gate-B reaches `TARGET_N=100` eligible schema-v2 records and
  passes the frozen 19 hard metrics (or terminates under frozen protocol with a
  verdict the release owner accepts as sufficient).
- **B. Harness P0 ACCEPTED** — `2a5f606` accepted (already true).
- **C. Production regression PASS** — full relevant RC8.3 regression green,
  `INFERENCE_OUTPUT_DIFF_COUNT = 0`.
- **D. Inference determinism PASS** — `DETERMINISM_MISMATCH = 0` on the release
  candidate.
- **E. World Model contract PASS** — questionnaire/validity/dimension/blindspot/
  primary/follow-up contracts pass.
- **F. Legacy adapter PASS** — legacy RC8 diagnosis path byte-for-byte preserved.
- **G. User-visible report integration PASS** — V2.1 primary report renders via the
  report contract without field leakage.
- **H. AI-expression authority boundary PASS** — V2.1-specific authority guard (§8)
  verified; AI may `rewrite / explain / compress / expand` presentation only.
- **I. Fallback PASS** — `legacy_rc8` fallback + AI-failure deterministic fallback
  (§9) exercised and confirmed reachable.
- **J. Rollback mechanism verified** — rollback operational contract (§13) tested
  end-to-end.

**Hard rule:** while Gate-B is not PASS, `RC_READY` is `BLOCKED_BY_GATE_B`.

---

## 3. Production Config Authority (R1 §3 — FROZEN)

The **single authoritative source** for production runtime mode is:

```text
PRODUCTION_CONFIG_AUTHORITY = CloudBase function environment variables
                             (read back from the deployed function / control plane)
```

**Not authoritative** (do not use for release judgment):

- `cloudbaserc.json` — **IS NOT** production mode authority (may contain stale
  `SELECTIVE_PRIMARY` / allowlist config).
- repository config — **IS NOT** proof of live production mode.
- local `.env` — **IS NOT** production mode authority.

Release judgment MUST be based on deployed-function env readback (the control
plane). Current verified readback (read-only): `V2=SHADOW`, `V2.1=SHADOW`,
`V1=SHADOW`, PRIMARY absent/OFF.

---

## 4. Code Deploy ≠ Config Change (R1 §4 — FROZEN hard rule)

```text
CODE_DEPLOYMENT MUST NOT CHANGE_RUNTIME_MODE
```

Two independent operations:

```text
OPERATION_A = CODE_DEPLOY        (function code only)
OPERATION_B = CONFIG_MODE_CHANGE (env var / mode / allowlist change)
```

No release procedure may implicitly merge A+B into a single unreviewed action.

**Known risk (recorded):** `cloudbaserc.json` may contain stale `SELECTIVE_PRIMARY`
/ allowlist configuration. Therefore any deployment command/tool that would
auto-sync repository env/config is:

```text
PROHIBITED_FOR_CODE_ONLY_DEPLOY
```

unless an explicit config-change authorization exists. (Verified precedent: the
Stage20 R1 code-only deploy used `tcb fn code update`, which does not apply
`cloudbaserc.json` env, keeping production env unchanged.)

---

## 5. Config Readback Discipline (R1 §5 — FROZEN)

For every code-only deploy, record:

```text
PRE_DEPLOY_CONFIG_READBACK   { V2_MODE, V21_MODE, PRIMARY/engine mode,
                               allowlist/cohort configuration, environment identity }
POST_DEPLOY_CONFIG_READBACK  { same fields }
```

Code-only deploy MUST satisfy:

```text
PRE == POST
```

else: `ABORT` + `ROLLBACK/REVIEW`.

---

## 6. Config Fingerprint (R1 §6 — schema only)

Release manifest (§15) gains:

```text
environmentId
deployedConfigFingerprint
featureFlagState
deploymentMethod
deploymentToolVersion_or_identifier
preDeployConfigFingerprint
postDeployConfigFingerprint
```

Fingerprint MUST: exclude secrets, exclude identity data, use canonical
deterministic serialization. This stage defines the schema; no hashing code is
implemented here.

---

## 7. Config Drift Protection (R1 §7 — FROZEN)

```text
EXPECTED_CONFIG_FINGERPRINT  vs  LIVE_CONFIG_FINGERPRINT
```

Mismatch ⇒ `CONFIG_DRIFT_DETECTED`.

Check required before AND after: RC verification, code deployment,
SELECTIVE_PRIMARY transition, EXPANDED_PRIMARY transition, FULL PRIMARY transition.

Unauthorized drift ⇒ release abort.

---

## 8. AI Authority Boundary — V2.1-specific (R1 §8 — P2, FROZEN)

**Correction:** V4 `reportGuardV4` `LOCKED_PATHS` protects V4 report fields only.
It is **NOT** a V2.1 authority guard and must not be cited as one.

Stage21 implementation requirement: establish **V2.1-specific immutable diagnostic
fields**, at minimum:

```text
cognitiveBlindSpot
cognitiveArchetype
worldStrategy
scenarioSimulation semantic conclusion
```

AI expression input/output MUST pass authority-preservation validation. AI MUST
NOT modify the above engine conclusions. On violation: **discard AI mutation → use
deterministic fallback expression** (§9).

---

## 9. AI Failure Fallback (R1 §9 — P2, FROZEN)

All of the following MUST NOT change the engine diagnosis:

```text
AI timeout
AI unavailable
AI malformed
AI authority violation
```

Required behavior:

```text
ENGINE_RESULT preserved
+
DETERMINISTIC_FALLBACK_EXPRESSION
```

`generateFallbackReport` is recorded as candidate implementation evidence, but is
**NOT** declared release-ready without independent verification.

---

## 10. Selective PRIMARY Cohort Bucketing (R1 §10 — P2, FROZEN)

Cohort assignment = **stable deterministic bucket**:

```text
bucket = stableHash(non-exported stable subject key + rolloutSalt) mod N
```

This stage does **not** freeze the specific subject identifier (avoid OPENID use
before privacy review). Requirements: stable, auditable, reversible, privacy-safe,
same-subject stable assignment. Forbidden: `Math.random`, manual arbitrary
switching, exporting identity lists. Concrete hash/key/salt deferred to the
Stage21 implementation ADR.

---

## 11. Threshold Freeze (R1 §11 — P2, FROZEN)

Thresholds that MUST be frozen **before SELECTIVE_PRIMARY**:

```text
runtime exception threshold
contract validation failure threshold
AI authority violation threshold
unexpected DB side-effect threshold
rollback availability threshold
user-visible shadow violation threshold
```

Structural / safety invariants MAY be zero-tolerance. Statistical thresholds:
`THRESHOLD_REQUIRES_EVIDENCE` — no number is set without supporting evidence.

---

## 12. Payment Non-Destructive Verification (R1 §12 — P2, FROZEN)

Release gate MUST NOT require repeated real debits. Allowed future approaches:

```text
existing sandbox/test capability (if available)
+
read-only configuration verification
+
single controlled transaction (only if required)
+
payment path regression without changing business pricing
```

This stage does **not** assume a sandbox currently exists:

```text
PAYMENT_TEST_CAPABILITY_REQUIRES_DISCOVERY
```

---

## 13. Rollback Operational Contract (R1 §13 — P2, FROZEN)

Rollback operational contract fields (define only):

```text
CONFIG_AUTHORITY
AUTHORIZED_OWNER
TARGET_MODE
PRE_READBACK
CHANGE_PATH
POST_READBACK
CONFIG_FINGERPRINT_VERIFY
FUNCTION_HEALTH_VERIFY
LEGACY_RENDER_VERIFY
```

Concrete CLI command is NOT written here (unverified):

```text
IMPLEMENTATION_PHASE_REQUIRES_VERIFICATION
```

Rollback MUST: not require client re-release; not modify history; not break
already-generated reports; not delete V2.1 shadow evidence.

---

## 14. Governance State vs Runtime Mode (R1 §14 — see §1.1)

Already fixed in §1.1. `RC_READY` rollback is a governance transition to
`SHADOW_GOVERNANCE_STATE`; `RUNTIME_MODE` remains `SHADOW`. Never phrase a
governance rollback as a runtime "re-enter SHADOW (no-op)".

---

## 15. Release Manifest — Final Schema (R1 §15)

```text
canonicalSha
candidateSha
deployedSha
harnessSha

gateBResult
gateBProtocolHash

regressionResult
realDeviceResult

environmentId

rolloutMode
featureFlagState

deployedConfigFingerprint
preDeployConfigFingerprint
postDeployConfigFingerprint

deploymentMethod
deploymentToolIdentifier

rollbackTarget

knownDebts
releaseOwner
releaseTimestamp
```

Schema only. No fake data.

---

## 16. No Implementation Authorization (R1 §16 — FROZEN)

```text
R1 remediation complete   !=  implementation authorization
DESIGN_FREEZE             !=  C4-003A merge authorization
DESIGN_FREEZE             !=  config mutation authorization
DESIGN_FREEZE             !=  PRIMARY authorization
```

Gate-B continues: `ACTIVE / WAITING_FOR_NATURAL_EVIDENCE`.

---

## 17. Governance Boundary (retained from P0)

```text
Harness PASS            !=  Gate-B PASS
Gate-B PASS             !=  PRIMARY authorization
RC_READY                !=  FULL PRIMARY
SELECTIVE_PRIMARY PASS  !=  FULL PRIMARY
```

Every state transition requires independent authorization. 009 (implementer) is
not the independent auditor/authorizer.

---

## 18. Debt Reconciliation (R1 §1/§2 — FROZEN)

### 18.1 Legacy debt — EXTERNAL_CONSTRAINT_GUARD_NOT_EXECUTED

```text
LEGACY_DEBT               = EXTERNAL_CONSTRAINT_GUARD_NOT_EXECUTED
LATEST_EVIDENCE           = C4-003A external constraint guard implemented +
                            executed + independently evidenced
DEBT_STATUS               = SUPERSEDED_BY_C4_003A_IMPLEMENTATION
CANONICAL_INTEGRATION_STATUS = REQUIRES_RELEASE_RECONCILIATION
CURRENT_CANONICAL_CONTAINS_C4_003A = YES (verified, see evidence)
SELECTIVE_PRIMARY_REQUIREMENT = before SELECTIVE_PRIMARY, the final release
                            candidate MUST be shown to contain a verified external
                            constraint guard capability; the satisfaction path is
                            decided by future release reconciliation, NOT
                            pre-authorized here (no merge / cherry-pick /
                            reimplementation authorization).
```

Evidence (read-only, git ancestry + diff):

- `externalConstraintGuardDefinitions.js` + `externalConstraintGuardEvaluator.js`
  present in canonical `0874254`.
- `withinFamilyBlindSpotInference.js` `require`s and **executes**
  `evaluateExternalGuards(candidateId, secondarySignals)` before cognitive
  evaluation (guard-driven `guardState` branches).
- `tests/rc8.3-external-constraint-guard.test.js`,
  `tests/rc8.3-c4-003b-state-machine.test.js`,
  `tests/rc8.3-c4-003c-guard-state.test.js` present in canonical.
- C4-003A branch tip `8752167` is an ancestor of canonical `0874254`; canonical
  history contains `591ae09 feat(rc8.3): execute external constraint and
  false-positive guards`.

**Governance gap driving `REQUIRES_RELEASE_RECONCILIATION`:** the C4-003A/003B/003C
implementation code is in canonical, but the C4-003A/B/D ADR documents are NOT in
canonical (only C4-001/C4-002), and the C4-002 debt register still lists
`EXTERNAL_CONSTRAINT_GUARD_NOT_EXECUTED` as open P1. Reconciliation must close this
documentation/debt-register gap in a release reconciliation step.

```text
C4-003A feature evidence  !=  automatic canonical merge authorization
Gate-B ACTIVE period:       NO C4-003A CANONICAL MERGE
```

### 18.2 C2 register — 3 debts (reconciled, evidence-based)

| C2 debt | Status | Evidence (canonical `0874254`) | Release impact |
|---|---|---|---|
| `TEXT_RULE_PARSER_DEBT` | **RESOLVED** | `predicateEvaluator.js` present; `secondarySignalExtractor.js` header "EXECUTES predicate AST — NO legacy free-text parsing"; `secondarySignalEvidenceMap.js` uses structured predicates (`and/or/not/signalPresent/…CountGte`) | NON_BLOCKING |
| `INSUFFICIENT_SCORE_HALVING_HEURISTIC` | **RESOLVED** | `secondarySignalExtractor.js` line 12 "Score = actual evidence strength (NOT halved for INSUFFICIENT)"; line 413 "P2: actual evidence strength, NOT halved" | NON_BLOCKING |
| `SERENDIPITOUS_PATH_DISCOVERY_CONTRADICTION_GAP` | **PARTIALLY_RESOLVED** | structured suppression predicate now present, but `contradictoryEvidence` still holds only 1 item (`MULTIPLE_SERENDIPITOUS_DISCOVERIES_ACTED_ON`), so `contradictionCountGte(2)` path remains unreachable for this signal; only `signalPresent("OPPORTUNITY_RECOGNITION")` path fires | NON_BLOCKING (P2, no release-risk evidence) |

No C2 debt is `STILL_OPEN`. No C2 debt blocks RC_READY / SELECTIVE_PRIMARY / FULL
PRIMARY. Do not auto-promote the PARTIALLY_RESOLVED P2 to a blocker absent clear
release-risk evidence.

---

## 19. End-to-End Release Test Matrix (retained)

Full chain, exercised for at least `VALID`, `LOW`, `INSUFFICIENT` validity states:

```text
18Q (questionnaireV21)
  → normalize (evidenceNormalizerV21)
  → Behavior Signals v2 (behaviorSignalExtractorV2 / signalExtractorV21)
  → World Model (worldModelEngine / worldModelPipeline)
  → Cognitive Archetype (cognitiveArchetypeEngineV2)
  → Cognitive Blind Spot (cognitiveBlindSpotEngineV2 + family/hierarchical/within-family)
  → World Strategy (worldStrategyEngineV2)
  → Scenario Simulation (scenarioSimulationEngineV2)
  → Report Contract (reportContractV4 / reportMapperV4 / reportValidatorV4)
  → Legacy Adapter (legacyDiagnosisAdapter)
  → AI Expression (reportGuardV4 / reportMergeV4 / diagnosisReportBuilder)
  → Report UI → Poster → History → Share
```

AI-path states to cover: `AI success`, `AI timeout`, `AI malformed`,
`AI unavailable`, `AI authority violation` (§8/§9).

---

## 20. Legacy Business Regression Matrix (retained)

| Capability | Class |
|---|---|
| 首页 (home) | P0 RELEASE BLOCKER |
| 18Q (questionnaire) | P0 RELEASE BLOCKER |
| 结果页 (result page) | P0 RELEASE BLOCKER |
| 历史报告 (history) | P0 RELEASE BLOCKER |
| 海报 (poster) | P1 RELEASE BLOCKER |
| 分享 (share) | P1 RELEASE BLOCKER |
| 登录 (login) | P0 RELEASE BLOCKER |
| 会员 (membership) | P0 RELEASE BLOCKER |
| 支付 (payment) | P0 RELEASE BLOCKER |
| AI 问答 (AI Q&A) | P1 RELEASE BLOCKER |
| 咨询入口 (consult entry) | P2 NON-BLOCKER |
| storage migration | P1 RELEASE BLOCKER |
| 旧历史兼容 (legacy history compat) | P0 RELEASE BLOCKER |
| legacy report rendering | P0 RELEASE BLOCKER |

**Rule:** define only. Do not fix now.

---

## 21. Real-Device Test Minimization (retained)

Harness (P0 ACCEPTED) covers synthetic structural/contract/determinism. Real-device
smoke retains only harness-uncovered items:

- WeChat context
- OPENID / auth
- cloud invocation
- real UI rendering
- Canvas / poster
- album save permission
- share
- payment / member / login integration (see §12 non-destructive gate)

**Minimum real-device smoke suite:** 1–3 complete questionnaire journeys (not
dozens).

---

## 22. Artifact

This document = `docs/RC8.3_STAGE21_RELEASE_CANDIDATE_GATE.md`, authored on an
isolated design branch (not merged to canonical). Canonical remains untouched
while Gate-B is ACTIVE.
