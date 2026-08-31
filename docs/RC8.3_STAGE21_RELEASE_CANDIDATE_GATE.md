# RC8.3 Stage21 — Release Candidate Gate Design (FREEZE)

> **Status:** DESIGN FREEZE (governance-only). No PRIMARY implementation. No runtime
> change. No Gate-B change. No deploy. No merge canonical.
>
> This document designs the gate through which World Model V2.1 may — after
> independent authorization, in a future controlled rollout — move from `SHADOW`
> toward controlled `PRIMARY`. It is a plan, not an authorization.

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
- `lib/engine/worldModel/v2_1/primaryDecisionEngineV21.js` — already implements the
  categorical decision surface `PRIMARY_ALLOWED | FOLLOW_UP_REQUIRED |
  NO_PRIMARY_DEFICIT | INSUFFICIENT_EVIDENCE`, but is invoked only under the
  shadow runtime path; it does not, by itself, route to a user-visible primary
  report.
- `lib/engine/worldModel/legacyDiagnosisAdapter.js` — legacy business adapter that
  must remain intact (no V2.1 → legacy contamination, and no loss of legacy
  rendering on rollback).
- `lib/report/reportContractV4.js` + `lib/prompt-v4/reportGuardV4.js` — report
  contract + `LOCKED_PATHS` already enforce that AI may not rewrite diagnostic
  authority fields. The Stage21 design re-affirms this boundary for V2.1.

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

Each transition carries an explicit 5-part definition:

| Transition | ENTRY | EXIT | ABORT | ROLLBACK | AUTHORITY |
|---|---|---|---|---|---|
| SHADOW → RC_READY | §2 gates A–J all PASS | RC_READY frozen + manifest minted | any §2 gate regresses | re-enter SHADOW (no-op) | independent design review + release owner |
| RC_READY → SELECTIVE_PRIMARY | §5 Stage A allowlist verified; real-device smoke PASS | Stage A cohort live, shadow still recording | §7 abort | rollback → SHADOW | release owner + independent audit |
| SELECTIVE_PRIMARY → EXPANDED_PRIMARY | Stage A/B metrics within threshold (evidence-required) | Stage C/D cohort live | §7 abort | rollback → SHADOW | release owner + independent audit |
| EXPANDED_PRIMARY → PRIMARY | Stage D full-cohort metrics within threshold; all rollback paths verified | full PRIMARY | §7 abort | rollback → legacy_rc8 | release owner + independent audit |

---

## 2. RC Entry Gates (`RC_READY`)

`RC_READY` requires **all** of the following to be independently verified PASS:

- **A. Gate-B PASS** — Gate-B collection reaches `TARGET_N=100` eligible schema-v2
  records and passes the frozen 19 hard metrics (or terminates under the frozen
  protocol with a verdict that the release owner accepts as sufficient).
- **B. Harness P0 ACCEPTED** — `2a5f606` accepted (already true).
- **C. Production regression PASS** — full relevant RC8.3 regression green,
  `INFERENCE_OUTPUT_DIFF_COUNT = 0`.
- **D. Inference determinism PASS** — `DETERMINISM_MISMATCH = 0` on the release
  candidate.
- **E. World Model contract PASS** — questionnaire/validity/dimension/blindspot/
  primary/follow-up contracts pass.
- **F. Legacy adapter PASS** — legacy RC8 diagnosis path byte-for-byte behavior
  preserved (no contamination).
- **G. User-visible report integration PASS** — V2.1 primary report renders via
  the report contract without field leakage.
- **H. AI-expression authority boundary PASS** — AI may `rewrite / explain /
  compress / expand` presentation only; it may **not** change `blindSpot`,
  `archetype`, `strategy`, or scenario semantic conclusion (enforced by
  `reportGuardV4` `LOCKED_PATHS`).
- **I. Fallback PASS** — the `legacy_rc8` fallback path is exercised and confirmed
  reachable.
- **J. Rollback mechanism verified** — one-click rollback (§6) tested end-to-end.

**Hard rule:** while Gate-B is not PASS, `RC_READY` is `BLOCKED_BY_GATE_B`.

---

## 3. End-to-End Release Test Matrix

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

AI-path states to cover: `AI success`, `AI timeout`, `AI malformed`, `AI unavailable`.

**AI authority boundary (frozen):** AI may `rewrite / explain / compress / expand`
presentation only. AI must **never** change:
`blindSpot`, `archetype`, `strategy`, or `scenario semantic conclusion`.

---

## 4. Legacy Business Regression Matrix

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

## 5. Selective PRIMARY Design (future rollout, not implemented)

No direct `ALL PRIMARY`. Staged:

- **Stage A** — internal / explicit allowlist (deterministic, auditable).
- **Stage B** — small production cohort.
- **Stage C** — expanded cohort.
- **Stage D** — full PRIMARY.

Cohort selection must be: **deterministic, auditable, reversible,
non-identity-exporting**.

---

## 6. Rollback Design

| Field | Value |
|---|---|
| `WORLD_MODEL_ENGINE_VERSION` | `legacy_rc8` (or equivalent safe fallback) |
| `ROLLBACK_TRIGGER` | any §7 abort condition |
| `ROLLBACK_OWNER` | release owner |
| `ROLLBACK_TIME_OBJECTIVE` | sub-N-minute (threshold requires evidence) |
| `POST_ROLLBACK_VERIFICATION` | legacy regression PASS + no V2.1 shadow evidence deleted + no historical data modified + no client re-release required |

Rollback must: not require client re-release; not modify history; not break
already-generated reports; not delete V2.1 shadow evidence.

---

## 7. Release Abort Conditions (frozen)

- unexpected user-visible shadow
- engine exception rate breach
- contract validation failure
- AI modifies diagnostic authority
- legacy adapter failure
- report rendering failure
- poster generation regression
- history incompatibility
- payment/login/member regression
- unexpected DB side effects
- identity/privacy leakage
- rollback unavailable

**Threshold rule:** any condition requiring a numeric threshold is marked
`THRESHOLD_REQUIRES_EVIDENCE` — no threshold is set without supporting evidence.

---

## 8. Real-Device Test Minimization

Harness (P0 ACCEPTED) covers synthetic structural/contract/determinism. Real-device
smoke retains only what the harness cannot cover:

- WeChat context
- OPENID / auth
- cloud invocation
- real UI rendering
- Canvas / poster
- album save permission
- share
- payment / member / login integration

**Minimum real-device smoke suite:** 1–3 complete questionnaire journeys (not
dozens). Aim to avoid re-filling 18Q manually at scale.

---

## 9. Release Manifest Schema (schema only, no fake data)

```text
canonicalSha
candidateSha
deployedSha
harnessSha
gateBResult
gateBProtocolHash
regressionResult
realDeviceResult
rolloutMode
rollbackTarget
knownDebts
releaseOwner
releaseTimestamp
```

---

## 10. Governance Boundary

```text
Harness PASS            !=  Gate-B PASS
Gate-B PASS             !=  PRIMARY authorization
RC_READY                !=  FULL PRIMARY
SELECTIVE_PRIMARY PASS  !=  FULL PRIMARY
```

Every state transition requires independent authorization. 009 (implementer) is
not the independent auditor/authorizer.

---

## 11. Current Debt Treatment

Existing RC8.3 debt, classified for release risk. **Rule:** do not auto-promote
C4 P2 debt to release-blocker; upgrade only on clear release-risk evidence.

| Debt (source) | Severity | Classification | Rationale |
|---|---|---|---|
| `EXTERNAL_CONSTRAINT_GUARD_NOT_EXECUTED` (C4-002) | P1 | **BLOCKS_SELECTIVE_PRIMARY** | safety boundary (C1 external constraints) not executed by C3 inference; 5/10 adversarial cases → cognitive diagnosis; clear release-risk |
| `AMBIGUITY_THRESHOLD_CALIBRATION_GAP` (C4-002) | P2 | NON_BLOCKING (upgrade only w/ accuracy evidence) | 13 AMB→INS calibration gap; no demonstrated safety breach |
| `SIGNAL_FIDELITY_HEURISTIC` (C4-002) | P2 | NON_BLOCKING | heuristic, no release-risk evidence |
| `SUPPRESSION_PENALTY_HEURISTIC` (C4-002) | P2 | NON_BLOCKING | heuristic, no release-risk evidence |
| `FAMILY_AMBIGUITY_THRESHOLD_HEURISTIC` (C4-002) | P2 | NON_BLOCKING | heuristic, no release-risk evidence |
| `SERENDIPITOUS_PATH_DISCOVERY` (C4-002) | P2 | NON_BLOCKING | suppression gap; single structured trigger remains; no demonstrated release-risk |
| `GOLDEN_GOVERNANCE_DISPUTES` (C4-002) | P3 | NON_BLOCKING | 4 cases; governance wording, not release |
| `C1 PM.NC2 / LMG.NC2 wording ambiguity` (C4-002) | P3 | NON_BLOCKING | wording |
| C2 register 3 debts (`TEXT_RULE_PARSER_DEBT` P1, `INSUFFICIENT_SCORE_HALVING` P2, `SERENDIPITOUS_PATH_DISCOVERY_CONTRADICTION_GAP` P2) | P1/P2 | **STATUS_REQUIRES_CONFIRMATION** | register marks them `BLOCKING_FOR_C3`; C3/C4 ADRs already exist → resolution status ambiguous; must be confirmed during independent design review before any classification upgrade |

---

## 12. Artifact

This document = `docs/RC8.3_STAGE21_RELEASE_CANDIDATE_GATE.md`, authored on an
isolated design branch (not merged to canonical). Canonical remains untouched
while Gate-B is ACTIVE.

---

## 13. Report Boundary

This is a **design freeze**, not an authorization and not an independent audit.
`CURRENT_RC_READY = BLOCKED_BY_GATE_B`; `CURRENT_SELECTIVE_PRIMARY_READY = NO`;
`CURRENT_FULL_PRIMARY_READY = NO`.
