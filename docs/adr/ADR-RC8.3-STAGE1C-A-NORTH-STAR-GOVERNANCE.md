# ADR-RC8.3-STAGE1C-A: North Star Governance Freeze

**Status**: ACCEPTED (governance freeze — no implementation)

**Date**: 2026-09-09

**Phase**: RC8.3 Stage1C-A (North Star Governance)

**Input**: RC8.3_STAGE1C_NORTH_STAR_RECONCILIATION (completed, read-only)

**Scope**: Convert the North Star reconciliation into non-drifting governance
artifacts and executable acceptance criteria. This stage DOES NOT implement the
new report. No report builder change, no UI change, no engine change, no
questionnaire change, no diagnosis contract change, no golden label change, no
deploy, no env, no Primary, no Gate-B, no payment.

---

## 1. Accepted Reconciliation (Frozen)

```
ENGINE_ALIGNMENT                      = PASS
DIAGNOSIS_SEMANTICS                   = PASS

PRIMARY_DRIFT_LAYER =
    PRESENTATION_MODEL
  + REPORT_BUILDER
  + REPORT_INFORMATION_ARCHITECTURE
  + TEST_GOVERNANCE

ENGINE_CHANGE_REQUIRED                = NO
DIAGNOSIS_CONTRACT_CHANGE_REQUIRED    = NO
ADDITIVE_PRESENTATION_MODEL_REQUIRED  = YES
```

The engine and diagnosis semantics are authoritative and correct. The drift
lives entirely in the presentation layer (how the engine truth is explained to
the user) plus missing test governance. Fixing it must be additive presentation
work, never engine/contract/golden mutation.

---

## 2. Authority Hierarchy (Frozen)

```
Tier0 = RC8.3_PHASE_1_WORLD_MODEL_ALIGNMENT_P0
Tier1 = docs/RC8.3_WORLD_MODEL_ALIGNMENT.md   (Product Constitution v1.0)
```

**Repository absence of the Tier0 taskbook does NOT demote it.** Tier0 remains
the highest authority regardless of whether its file is currently present in
the worktree. No Tier0 rewrite is permitted. A governance reference artifact
may be created only to record the hierarchy; it must not restate, reinterpret,
or supersede Tier0 content.

When Tier0 and Tier1 conflict, Tier0 wins. When any implementation (Tier3/4)
conflicts with Tier1, Tier1 wins ("最高规则" — any rule/prompt/fallback/template/
report field conflicting with the Constitution yields to the Constitution).

---

## 4. Runtime Freeze Retrospective

**Record**: R3.1 modified `cloudfunctions/generateAiReport/index.js` (added
`runWorldModelV21TestPreview` routing).

**Classification**: `GOVERNANCE_EXCEPTION_REQUIRED_RETROSPECTIVELY`.

**Do NOT revert.**

**Why the change remained isolated:**
- `TEST_PREVIEW` routing only — no change to legacy V1/V4 dispatch path.
- Primary mode unchanged.
- Gate-B unchanged.
- Legacy behavior preserved (shadow/OFF and legacy routes untouched).

**Forward rule**: Future modifications to frozen runtime files require explicit
exception approval BEFORE any code change. Frozen runtime files (per Constitution
§11) include, non-exhaustively: `generateAiReport/index.js`, `fallbackRouter.js`,
`contentSafetyGate.js`, `ai.js`, `reportUtils.js`, `reportLimits.js`,
`runtimeArchitectureTrace`, `diagnosticSnapshot`, provider routing, parse repair,
Canvas poster layout, `report-detail.js` runtime handoff.

---

## 5. Deployment Discipline

**Record**: Previous `TEST_PREVIEW` `generateAiReport` deployment is classified
`GOVERNANCE_PROCESS_DEVIATION`. No rollback required (it was preview-only, isolated,
Primary/Gate-B/payment untouched, and the deployed code is verifiable and correct).

**Forward rule — Stage1C-A through Stage1C-E: NO DEPLOY.**

Stage1C-F may request a specific `TEST_PREVIEW_DEPLOY_EXCEPTION` **only after**
all North Star gates pass (see §10 and the report-golden gate in §7).

---

## 6. North Star Report Invariants (Frozen)

Each invariant is recorded with SOURCE_CLAUSE, EXPLICIT_OR_DERIVED,
MACHINE_TESTABLE, and FAIL_CONDITION.

| ID | Invariant | SOURCE_CLAUSE | EXPLICIT/DERIVED | MACHINE_TESTABLE | FAIL_CONDITION |
|----|-----------|---------------|------------------|------------------|----------------|
| NSR-01 | USER_CURRENT_MODEL_PRESENT — report states the user's current world-model assumption, not just a label | §4 "看见问题本质" | EXPLICIT | YES | Report contains only a blind-spot label with no statement of the user's current model assumption |
| NSR-02 | WORLD_OPERATING_RULE_PRESENT — report presents the real-world operating rule that the user's model conflicts with | §9 Q2 "世界规则" | EXPLICIT | YES | No world-rule text derived from a frozen world principle is present when a primary blind spot is diagnosed |
| NSR-03 | MODEL_MISALIGNMENT_EXPLICIT — the report names the gap between user model and reality | §2 核心因果链 + §4 "发现认知漏洞" | EXPLICIT | YES | Blind spot stated without an explicit mismatch against the corresponding world rule |
| NSR-04 | USER_SPECIFIC_EVIDENCE_VISIBLE — strong conclusions expose user-specific evidence | §6.1 Signal Rules (traceable + ≥2 independent points) | EXPLICIT | YES | Primary diagnosis present with zero user-specific supporting evidence mapped from trace |
| NSR-05 | CAUSAL_CHAIN_VISIBLE — 世界模型→决策模型→行为模式→结果分布 is visible | §2 核心因果链 | EXPLICIT | YES | Report jumps from blind spot to advice with no causal/mechanism connective |
| NSR-06 | STRATEGY_CHANGES_DECISION_PROCESS — strategy changes the decision process, not just names a strategy | §9 Q4/Q5 + §6.4 | EXPLICIT | YES | Strategy card exposes label/mechanism only, omitting firstExperiment/successSignal/stopCondition |
| NSR-07 | SCENARIO_SHOWS_MODEL_SHIFT — scenario contrasts old vs upgraded model decision pattern | §6.5 + §8 双情景 | EXPLICIT | YES | Only current-model consequences rendered; upgraded-model decision pattern absent |
| NSR-08 | INTERNAL_SCHEMA_NOT_USED_AS_USER_EXPLANATION — internal enums/ontology must not substitute for user explanation | §3.3 + §6.2 | DERIVED | YES | Raw internal tokens (construct/orientation/state/archetype enum) exposed as the primary user-facing explanation |
| NSR-09 | GENERIC_SELF_HELP_CANNOT_REPLACE_EVIDENCE — no mechanism-free encouragement replaces evidence/causal explanation | §3.2 | EXPLICIT | YES | "加油/坚持/相信自己" style content present without mechanism/evidence |
| NSR-10 | NO_UNSUPPORTED_PREDICTION_OR_WEALTH_PRIMARY_PROMISE — no deterministic prediction, no wealth as primary promise | §1 + §3.1 + §6.5 + §8.3 | EXPLICIT | YES | Deterministic future/income/success/fate claim, or wealth positioned as the product's primary promise |

**NORTH_STAR_INVARIANT_COUNT = 10** (all supported; 0 NOT_SUPPORTED).

---

## 7. Report Golden Governance

**Distinction (frozen):**

- `DIAGNOSIS_GOLDEN` = engine classification authority. Answers: "Is the engine
  classification correct?" (Already exists: `tests/rc8.3-world-model-golden.test.js`,
  frozen, authoritative.)
- `REPORT_GOLDEN` = North Star explanation fidelity. Answers: "Does the report
  faithfully explain the engine truth per the North Star invariants?"

**Rules:**
- Report Golden MUST NOT alter diagnosis Golden labels.
- Define semantic assertions only; do NOT freeze exact marketing prose.
- Coverage must include:
  - 9 blind spots (each: world-rule citation correct + evidence chain non-empty +
    strategy exposes firstExperiment + scenario exposes model shift)
  - `MULTIPLE_SUPPORTED_MODELS`
  - `NO_PRIMARY_DEFICIT`
  - `INSUFFICIENT_DIRECTIONAL_EVIDENCE`
  - `CONTRADICTORY_EVIDENCE`
- Archetypes appear ONLY where they add explanatory value (per NSR-08,
  archetype is internal schema, not a primary user explanation).

---

## 8. Presentation Model Boundary (Frozen)

**Architecture:**

```
Questionnaire Evidence
  → Behavior Signals
  → World Model Engine
  → Diagnosis Contract
  → North Star Presentation Model
  → Report Builder
  → User UI
```

The Presentation Model may derive deterministic explanations from existing
trusted sources ONLY:

- `answerTrace`
- questionnaire definitions
- behavior signal trace
- `worldModel`
- `blindSpot`
- `strategy`
- `scenario`
- `worldPrinciples`

The Presentation Model MUST NOT:
- change diagnosis
- select a different blind spot
- invent evidence
- invent world rules
- override strategy
- override scenario
- perform economic inference
- perform fortune telling

---

## 10. Exit Gate (Stage1C-A)

Stage1C-A passes only if ALL of the following hold:

```
NORTH_STAR_INVARIANTS_FROZEN            = YES   (see §6)
DIMENSION_GOVERNANCE_RESOLVED           = YES   (see ADR-STAGE1C-A-DIMENSION-GOVERNANCE)
RUNTIME_EXCEPTION_DOCUMENTED            = YES   (see §4)
DEPLOYMENT_EXCEPTION_POLICY_DOCUMENTED  = YES   (see §5)
REPORT_GOLDEN_GOVERNANCE_DEFINED        = YES   (see §7)
PRESENTATION_MODEL_BOUNDARY_FROZEN      = YES   (see §8)
WORLD_PRINCIPLE_MAPPING_DESIGN_COMPLETE = YES   (see ADR-STAGE1C-A-WORLD-PRINCIPLE-MAPPING)
```

No implementation of the new report is allowed yet.
