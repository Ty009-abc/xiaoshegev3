# RC8.4 — V6 DIAGNOSIS CONTRACT v1

- **Contract version:** `turnaround_strategy_v6_contract_v1`
  (semantic contract version — **not** a UI/report copy version)
- **Status:** DESIGN — canonical semantic contract for future V6 runtime
- **Branch:** `design/rc8.4-v6-9q-refoundation`
- **Date:** 2026-09-11
- **Upstream (accepted Stage A):**
  - `docs/RC8.4_TURNAROUND_STRATEGY_V6_9Q_REFOUNDATION_DESIGN.md`
  - `docs/RC8.4_V6_PRODUCT_GOLDEN_15_CASES.md`
  - `docs/RC8.4_V6_PRIMARY_BOTTLENECK_RULE_TABLE.md`
  - `docs/adr/ADR-RC8.4-V6-PRODUCT-FIRST-GOVERNANCE.md`
- **Nature:** design only. **No runtime code.** This is the authority for a later
  runtime implementation, which may only start on a new branch from the final
  accepted design tip.

> Contract definitions below are **derived from the 15 accepted Goldens** (rules
> from goldens). Where Stage A's rule table and the Contract differ, the Contract
> governs and the difference is logged in §20 (Contract/Stage-A discrepancy log).

---

## 1. PRIMARY AUTHORITY MODEL

Frozen authority order (evaluation sequence):

```
1. REALITY INPUT              (Q1,Q2,Q3)
2. USER BELIEF                (Q5)
3. EXECUTION STAGE            (Q6)
4. BEHAVIOR EVIDENCE          (Q7,Q8,Q9)
5. BOTTLENECK ELIGIBILITY      ← eligibility computed first
6. PRIORITY / TIE-BREAK        ← only among eligible
7. BELIEF-REALITY GAP          ← modifier
8. FIVE-CARD EXPRESSION
```

```
ELIGIBILITY_FIRST                = YES
PRIORITY_SECOND                  = YES
TIE_BREAK_THIRD                  = YES
STAGE_PRIORITY_FORCES_DIAGNOSIS  = NO
```

**Hard rule:** Stage priority must **never** override missing REQUIRED evidence.
An ineligible candidate cannot be rescued by priority or tie-break.

---

## 2. PRIMARY BOTTLENECK CONTRACT

```
DIRECTION_GAP
ACTION_GAP
CONSISTENCY_GAP
VALIDATION_GAP
REPEATABILITY_GAP
```

```
PRIMARY_BOTTLENECK_COUNT = 5
```

No additional primary bottleneck may be added without a governance revision
(ADR) **and** new Golden evidence. `REALITY_CONSTRAINT` and `BELIEF_REALITY_GAP`
are **modifiers**, never primaries (§11, §12).

---

## 3. EVIDENCE CLASSES

For every bottleneck:

- **REQUIRED_EVIDENCE** — minimum evidence that must exist before a bottleneck may
  become *eligible*. If absent → not eligible.
- **SUPPORTING_EVIDENCE** — increases explanatory fit, **cannot** independently
  create eligibility.
- **CONTRADICTING_EVIDENCE** — weakens or blocks the candidate.

No numeric score. No percentage. No probability.

---

## 4. ELIGIBILITY CONTRACT

Deterministic function per bottleneck: `eligible(bottleneck, answers) -> true|false`.

```
If REQUIRED evidence is absent: candidate NOT eligible.
Priority cannot rescue an ineligible candidate.
```

```
ELIGIBILITY_FIRST = YES
```

### 4.1 DIRECTION_GAP
- eligible iff `Q6 → stage ∈ {THINKING, RESEARCHING}`
  **AND** `Q5 ∈ {不知道该往哪走, 总在换方向}`
  **AND** `Q9 = 换个方向试试`.
- SUPPORTING: Q7 = 再等等，信息更充分再说; Q8 = 一忙起来，长期的事就先停;
  Q4 ∈ {工作看不到未来, 想转行，但不知道往哪走, 有能力，但不知道怎么变现}.
- CONTRADICTING: Q6 ∈ {开始做过，但没坚持多久, 做过产品 / 服务，但没人买单,
  已经有人愿意付钱, 已经有一点稳定结果}; Q9 ∈ {再坚持一阵, 重新检查方法和步骤}.
- `selectedRuleId` prefix: `RC84V6-DIRECTION-*`

### 4.2 ACTION_GAP
- eligible iff `Q6 → stage ∈ {THINKING, RESEARCHING, LEARNING}`
  **AND** `Q7 ∈ {再等等，信息更充分再说, 先把可能的问题都想清楚}`
  **AND** (`Q5 = 知道方向，但一直没真正行动` **OR** `Q6 = 学过东西，但没真正开始`).
- SUPPORTING: Q6 = 查过很多资料; Q8 = 一忙起来，长期的事就先停;
  Q9 = 先停下来，不再继续投入.
- CONTRADICTING: Q6 ∈ {开始做过，但没坚持多久, 做过产品 / 服务，但没人买单,
  已经有人愿意付钱, 已经有一点稳定结果}; Q7 = 先做个很小的版本试试.
- `selectedRuleId` prefix: `RC84V6-ACTION-*`

### 4.3 CONSISTENCY_GAP
- eligible iff `Q6 = 开始做过，但没坚持多久`
  **AND** (`Q9 = 换个方向试试` **OR** `Q8 = 一忙起来，长期的事就先停`).
- SUPPORTING: Q5 = 总在换方向; Q7 = 再等等，信息更充分再说.
- CONTRADICTING: Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果};
  Q8 = 会固定给长期的事留时间.
- `selectedRuleId` prefix: `RC84V6-CONSISTENCY-*`

### 4.4 VALIDATION_GAP
- eligible iff `Q6 = 做过产品 / 服务，但没人买单`
  **AND** no payment evidence (`Q6 < 已经有人愿意付钱`).
- SUPPORTING: Q7 ∈ {再等等，信息更充分再说, 先把可能的问题都想清楚};
  Q4 ∈ {想做副业，但一直没做起来, 有能力，但不知道怎么变现};
  Q5 = 能力还不够; Q9 ∈ {换个方向试试, 先停下来，不再继续投入}.
- CONTRADICTING: Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果}.
- `selectedRuleId` prefix: `RC84V6-VALIDATION-*`
- **Note:** the Q7 clause is SUPPORTING, **not** REQUIRED (§20 D-1).

### 4.5 REPEATABILITY_GAP
- eligible iff `Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果}`
  **AND** (`Q8 = 先做马上有结果的` **OR** `Q8 = 一忙起来，长期的事就先停`)
  **AND** no repeatable-process evidence.
- SUPPORTING: Q4 = 收入一直上不去; Q7 = 先做个很小的版本试试.
- CONTRADICTING: Q6 = 已经有一点稳定结果 **AND** Q8 = 会固定给长期的事留时间.
- `selectedRuleId` prefix: `RC84V6-REPEATABILITY-*`

---

## 5. PRIORITY CONTRACT

Priority applies **only among eligible candidates**.

```
THINKING         : DIRECTION_GAP > ACTION_GAP
RESEARCHING      : ACTION_GAP    > DIRECTION_GAP
LEARNING         : ACTION_GAP    > DIRECTION_GAP
STARTED          : CONSISTENCY_GAP > VALIDATION_GAP
TESTING          : VALIDATION_GAP  > CONSISTENCY_GAP
EARLY_TRACTION   : REPEATABILITY_GAP > VALIDATION_GAP
STABLE_TRACTION  : REPEATABILITY_GAP
```

Validated against all 15 accepted Goldens (§15). Validation results:

- **RESEARCHING row is not exercised by any Golden** — in G01/G07 (RESEARCHING),
  ACTION_GAP fails its REQUIRED `(Q5=知道方向但没行动 OR Q6=学过没开始)` clause, so
  only DIRECTION_GAP is eligible; DIRECTION wins **by eligibility**, not priority.
  → `PRIORITY_ROW_CONFLICT_COUNT = 0` (no ordering was overridden by a Golden).
- All other rows are consistent with the Goldens (see §15).

### 5.1 Stage tie-break when two gap types are eligible (OQ-4 approved)

```
IF both CONSISTENCY_GAP and VALIDATION_GAP are eligible:
    STARTED         → prefer CONSISTENCY_GAP
    TESTING         → prefer VALIDATION_GAP
    EARLY_TRACTION  → VALIDATION only if REPEATABILITY_GAP is not eligible

ELIGIBILITY_FIRST               = YES
STAGE_TIE_BREAK_SECOND          = YES
STAGE_PRIORITY_FORCES_DIAGNOSIS = NO
```

Stage preference applies **only after** eligibility. It may never create an otherwise
ineligible bottleneck. (By Q6-anchor construction, CONSISTENCY and VALIDATION are
mutually exclusive in v1, so this is a forward guard — `OQ4_STAGE_ANCHOR = APPROVED`.)

---

## 6. TIE-BREAK CONTRACT

If 2+ eligible candidates remain after stage priority, resolve deterministically by
evidence strength, in order:

```
A. direct execution-stage evidence   (Q6 = exact stage anchor of the candidate)
B. direct behavior evidence          (Q7/Q8/Q9)
C. userBelief consistency/contradiction (Q5)
D. primaryProblem relevance          (Q4)
```

Reality fields (Q1–Q3) may **constrain action** but must **not** fabricate the
bottleneck. **No alphabetic / ID-based tie-break.**

Note: by construction, CONSISTENCY_GAP and VALIDATION_GAP are mutually exclusive
(Q6 anchors differ), and VALIDATION_GAP / REPEATABILITY_GAP are mutually exclusive
(payment evidence differs). Residual ties are resolved by A→B→C→D only.

---

## 7. NO-PRIMARY CONTRACT

```
NO_PRIMARY_SUPPORTED = YES
```

V6 must **refuse** a primary diagnosis when:

- no candidate satisfies REQUIRED evidence,
- REQUIRED evidence is contradictory with no deterministic resolution,
- the answer combination is unsupported by the contract, or
- input is impossible / malformed.

Do not force one of five bottlenecks in every theoretical input. All 15 Goldens
resolve; the runtime contract must nonetheless remain honest and may emit
`NO_PRIMARY` with a re-focus/retake card (adversarial cases A/B/C/E/F/L exercise this).

---

## 8. REALITY CONSTRAINT CONTRACT

`REALITY_CONSTRAINT` is **not** a primary bottleneck. Sources: debt
(Q4 = 债务 / 现金流压力), zero/near-zero surplus (Q3 ∈ {基本留不下 / 经常不够,
1000元以下}), family pressure (Q5 = 家庭 / 环境牵制), age constraints (Q1).

It may affect:

```
ACTION_SIZE
TIME_HORIZON
RISK_LIMIT
PATH_FEASIBILITY
```

```
REALITY_CONSTRAINT_OVERRIDES_PRIMARY = NO   (default)
```

An override would require an explicit rule + evidence; none exists in V6.0.
Low surplus may shrink the experiment; it must **not** become the diagnosis.

---

## 9. USER BELIEF CONTRACT

Q5 = `USER_BELIEF`, **not** ground truth. Relation ∈:

```
BELIEF_MATCH
BELIEF_PARTIAL
BELIEF_REALITY_GAP
```

A divergence may be emitted **only** when evidence supports it. Relation semantics:

- `BELIEF_MATCH` — belief consistent with evidence (including a genuine reality constraint).
- `BELIEF_PARTIAL` — belief and behavior partially diverge; a real constraint and an
  amplifying behavior coexist. **Not** a hard contradiction.
- `BELIEF_REALITY_GAP` — belief explicitly contradicted by independent evidence.

```
FAKE_BELIEF_GAP_ALLOWED = NO
```

Every divergence must carry: `USER_BELIEF_SOURCE`, `CONTRADICTING_BEHAVIOR_SOURCE`,
`EXPLANATION`.

### 9.1 Gap rules (derived from Goldens)

`BELIEF_PARTIAL` = belief and behavior partially diverge (a real constraint and an
amplifying behavior can coexist) — **not** a hard contradiction. A hard
`BELIEF_REALITY_GAP` requires independent contradicting evidence (§9.2).

| Belief (Q5) | Evidence | Relation | RuleId | Golden |
|---|---|---|---|---|
| 缺钱 / 缺资源 | Q6 ∈ {主要还在想, 查过很多资料, 学过东西，但没真正开始} | GAP | `RC84V6-GAP-RESOURCE` | G12 |
| 没时间 | Q8 ∈ {先做马上有结果的, 一忙起来，长期的事就先停} **AND no independent contradiction** | **PARTIAL** | `RC84V6-TIME-PARTIAL` | G13 |
| 没时间 | Q8 = 一忙起来… **AND independent contradiction present** | GAP | `RC84V6-TIME-GAP` | (none in Goldens) |
| 能力还不够 | Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果} | GAP | `RC84V6-GAP-ABILITY-1` | G05 |
| 能力还不够 | Q6 = 做过产品 / 服务，但没人买单 **AND** (Q7 ∈ {再等等，信息更充分再说, 先把可能的问题都想清楚} **OR** Q9 = 先停下来，不再继续投入) | GAP | `RC84V6-GAP-ABILITY-2` | G14 |
| 能力还不够 | Q8 ∈ {先做马上有结果的, 一忙起来，长期的事就先停} **AND** Q9 = 再坚持一阵 | GAP | `RC84V6-GAP-ABILITY-3` | G08 |
| 做过不少尝试，但没结果 | Q6 = 已经有一点稳定结果 | GAP | `RC84V6-GAP-TRIED` | G15 |
| 不知道该往哪走 | Q9 = 换个方向试试 **AND** Q7 ∈ {再等等，信息更充分再说, 先把可能的问题都想清楚} | GAP | `RC84V6-GAP-DIRECTION` | G01 |
| (all others) | — | MATCH | — | G02,G03,G04,G06,G07,G09,G10,G11 |

Hard-gap cases: 6 (G01, G05, G08, G12, G14, G15). Partial: 1 (G13).
Total divergence (GAP ∪ PARTIAL) = 7 — reproduces the Stage A `BELIEF_GAP_CASE_COUNT = 7`.

### 9.2 TIME belief handling (OQ-1 resolved)

Three distinct concepts, never collapsed:

| Concept | Meaning | Source |
|---|---|---|
| `REALITY_TIME_CONSTRAINT` | a genuine external time load | Q2 income mode (unstable/demanding), Q3 + Q4 (debt/cashflow → heavy current-income labor), Q5 = 家庭 / 环境牵制 |
| `TIME_ALLOCATION_PATTERN` | observable failure to protect long-term work | Q8, Q6 |
| `BELIEF_REALITY_GAP` | belief contradicted by evidence | requires independent contradiction |

```
Q5 = 没时间 + Q8 = 长期事项被挤掉   →  NOT sufficient for a hard gap.
TIME_GAP_SINGLE_SIGNAL_ALLOWED = NO
TIME_BELIEF_GAP_STRENGTH       = PARTIAL (default)
```

Policy:
- **Case A — reality plausibly supports a genuine constraint** (e.g. Q3 ∈ {基本留不下 /
  经常不够}, Q4 = 债务 / 现金流压力, Q2 = 暂时没有稳定收入) → `BELIEF_MATCH`; do **not**
  attack the belief.
- **Case B — reality does not show a strong constraint** (stable income + adequate
  surplus), and behavior repeatedly shows long-term work was not protected →
  `BELIEF_PARTIAL` by default.
- **Hard `BELIEF_REALITY_GAP`** only with independent contradiction — not available from
  the 9Q time signals alone in v1.

Because the 9Q has **no direct weekly-hours question**, v1 stays conservative:
`FAKE_TIME_BELIEF_GAP_COUNT = 0`.

Copy consequence (§21): for `没时间`, hard-negation copy ("你真正的问题不是没时间") is
**forbidden** absent strong evidence. Preferred semantic direction: "时间压力可能是真的，
但你的回答也显示，长期事项一忙就会被挤掉。真正需要解决的，不只是时间多少，而是有没有
被保护的固定投入。" (semantic direction, not frozen copy.)

### 9.3 DIRECTION gap discriminator (D-3 formalized)

`RC84V6-GAP-DIRECTION` (exact, frozen from accepted Goldens):

```
Q5 = 不知道该往哪走
AND Q9 = 换个方向试试
AND Q7 ∈ {再等等，信息更充分再说, 先把可能的问题都想清楚}   ← certainty-gated
```

→ hard gap. Excludes explorer behaviors (`先问几个做过的人`, `先做个很小的版本试试`).

| Golden | Q5 | Q9 | Q7 | rule result | golden | match |
|---|---|---|---|---|---|---|
| G01 | 不知道该往哪走 | 换个方向试试 | 再等等 | GAP | GAP | ✓ |
| G07 | 不知道该往哪走 | 换个方向试试 | 先问几个做过的人 | MATCH | MATCH | ✓ |
| G09 | 不知道该往哪走 | 换个方向试试 | 先做个很小的版本试试 | MATCH | MATCH | ✓ |

```
D3_RULE         = Q5=不知道该往哪走 AND Q9=换个方向试试 AND Q7∈{再等等，先把问题都想清楚}
D3_GOLDEN_MATCH = 3/3
```

Not generalized beyond observed semantics. `Q5 = 总在换方向` is **not** covered by
`RC84V6-GAP-DIRECTION`; see §9.4.

### 9.4 总在换方向 (OQ-2 deferred)

```
NEW_DIRECTION_SWITCH_RULE_ADDED = NO
FUTURE_GOLDEN_REQUIRED          = YES
```

`Q5 = 总在换方向` may be `BELIEF_MATCH`, `BELIEF_PARTIAL`, or unresolved depending on
Q6/Q9. No special hard-coded gap rule in contract v1 — no accepted Golden evidence
currently justifies one.

---

## 10. EXECUTION STAGE CONTRACT

Exact Q6 mapping. **No inferred stage beyond Q6 in V6.0.**

| Q6 | stage |
|---|---|
| 主要还在想 | THINKING |
| 查过很多资料 | RESEARCHING |
| 学过东西，但没真正开始 | LEARNING |
| 开始做过，但没坚持多久 | STARTED |
| 做过产品 / 服务，但没人买单 | TESTING |
| 已经有人愿意付钱 | EARLY_TRACTION |
| 已经有一点稳定结果 | STABLE_TRACTION |

```
EXECUTION_STAGE_COUNT = 7
```

---

## 11. CARD AUTHORITY CONTRACT

| Card | Authority (inputs) |
|---|---|
| CARD01 致命一句话 | primary bottleneck + user belief + execution stage + selected behavior evidence |
| CARD02 核心问题 | mechanism explanation + contradiction/support evidence |
| CARD03 系统困局 | real-life causal loop |
| CARD04 翻身路径 | current stage → next productive stage |
| CARD05 现在就做 | stage + bottleneck + reality constraints |

No card may invent an unsupported diagnosis.

---

## 12. NEXT-STAGE CONTRACT

Allowed productive transitions:

```
THINKING         → RESEARCHING or STARTED
RESEARCHING      → STARTED
LEARNING         → STARTED or TESTING
STARTED          → TESTING
TESTING          → EARLY_TRACTION
EARLY_TRACTION   → STABLE_TRACTION
STABLE_TRACTION  → REPEATABLE_SYSTEM
```

No guaranteed progression. The report may prescribe a next **experiment**, not a
promised outcome.

---

## 13. ACTION CONTRACT

Card05 must satisfy:

```
FIRST_ACTION_COUNT = 1
EXECUTION_WINDOW  <= 48h
```

Constrained by reality:

| Reality trigger | Constraint |
|---|---|
| low surplus (Q3 ∈ {基本留不下 / 经常不够, 1000元以下}) | low-cost / reversible experiment |
| debt pressure (Q4 = 债务 / 现金流压力) | no high-risk capital experiment |
| EARLY_TRACTION | repeat last successful path |
| TESTING | obtain real buyer feedback |
| THINKING | create smallest external action |

Forbidden: generic 坚持 / 学习 / 提升认知.

### 13.1 Action-type enum (stage × bottleneck × constraint)
```
SHIP_FIRST_ARTIFACT
MINIMAL_REAL_EXPERIMENT
MINIMAL_DELIVERY_TO_REAL_PERSON
CASH_TODAY_MICRO_ACTION
ZERO_COST_USE_ONCE
LOCK_RECURRING_SLOT
REUSABLE_OUTPUT_SLOT
ASK_BUYERS_DEMAND_QUESTION
ASK_USERS_PAYBEHAVIOUR
QUOTE_BUYERS
REPLICATE_CLOSING_STEPS
WRITE_DELIVERY_SOP
```

---

## 14. TRACEABILITY CONTRACT

Every primary diagnosis exposes (internal, not necessarily user-visible):

```
sourceQuestionIds
sourceOptionIds
requiredEvidence
supportingEvidence
contradictingEvidence
selectedRuleId
```

Every belief gap exposes: `beliefSource`, `behaviorSource`.

Every first action exposes: `bottleneckSource`, `stageSource`, `constraintSource`.

---

## 15. 15-GOLDEN CONFORMANCE

Run manually against the 15 accepted Goldens (full table below). Result:
`GOLDEN_PRIMARY_MATCH = 15/15` · `GOLDEN_BELIEF_GAP_MATCH = 15/15` ·
`GOLDEN_ACTION_TYPE_MATCH = 15/15`.

| # | eligibleCandidates | selectedPrimary | selectionReason | beliefGap | realityConstraint | nextStage | firstActionType |
|---|---|---|---|---|---|---|---|
| G01 | DIRECTION | DIRECTION_GAP | only eligible at RESEARCHING | YES (GAP-DIRECTION) | no | STARTED | MINIMAL_REAL_EXPERIMENT |
| G02 | ACTION | ACTION_GAP | only eligible at LEARNING | NO | no | TESTING | MINIMAL_DELIVERY_TO_REAL_PERSON |
| G03 | CONSISTENCY | CONSISTENCY_GAP | only eligible at STARTED | NO | no | TESTING | LOCK_RECURRING_SLOT |
| G04 | VALIDATION | VALIDATION_GAP | only eligible at TESTING | NO | no | EARLY_TRACTION | ASK_BUYERS_DEMAND_QUESTION |
| G05 | REPEATABILITY | REPEATABILITY_GAP | only eligible at EARLY_TRACTION | YES (GAP-ABILITY-1) | no | STABLE_TRACTION | REPLICATE_CLOSING_STEPS |
| G06 | ACTION | ACTION_GAP | only eligible at LEARNING | NO | YES (debt+surplus) | STARTED | CASH_TODAY_MICRO_ACTION |
| G07 | DIRECTION | DIRECTION_GAP | only eligible at RESEARCHING | NO | no | STARTED | MINIMAL_REAL_EXPERIMENT |
| G08 | CONSISTENCY | CONSISTENCY_GAP | only eligible at STARTED | YES (GAP-ABILITY-3) | no | TESTING | REUSABLE_OUTPUT_SLOT |
| G09 | DIRECTION | DIRECTION_GAP | only eligible at THINKING | NO | YES (surplus) | STARTED | SHIP_FIRST_ARTIFACT |
| G10 | ACTION | ACTION_GAP | only eligible at LEARNING | NO | no | TESTING | MINIMAL_DELIVERY_TO_REAL_PERSON |
| G11 | VALIDATION | VALIDATION_GAP | only eligible at TESTING | NO | no | EARLY_TRACTION | ASK_USERS_PAYBEHAVIOUR |
| G12 | ACTION | ACTION_GAP | only eligible at LEARNING | YES (GAP-RESOURCE) | no | TESTING | ZERO_COST_USE_ONCE |
| G13 | CONSISTENCY | CONSISTENCY_GAP | only eligible at STARTED | PARTIAL (TIME-PARTIAL) | no | TESTING | LOCK_RECURRING_SLOT |
| G14 | VALIDATION | VALIDATION_GAP | only eligible at TESTING | YES (GAP-ABILITY-2) | no | EARLY_TRACTION | QUOTE_BUYERS |
| G15 | REPEATABILITY | REPEATABILITY_GAP | only eligible at STABLE_TRACTION | YES (GAP-TRIED) | no | REPEATABLE_SYSTEM | WRITE_DELIVERY_SOP |

---

## 16. ADVERSARIAL CASES

```
ADVERSARIAL_CASE_COUNT              = 16   (>= 16 required)
FORCED_DIAGNOSIS_COUNT             = 0
FAKE_BELIEF_GAP_COUNT              = 0
FAKE_TIME_BELIEF_GAP_COUNT         = 0
REALITY_OVERRIDE_ERROR_COUNT       = 0
STAGE_PRIORITY_OVERRIDE_ERROR_COUNT= 0
```

Full case detail: `docs/RC8.4_V6_ADVERSARIAL_CASES.md`.

---

## 17. CONTRACT VERSION

```
CONTRACT_VERSION = turnaround_strategy_v6_contract_v1
```

Refers to diagnosis semantics, not UI/report copy version.

---

## 18. IMPLEMENTATION BRANCH POLICY

Do **not** implement on `design/rc8.4-v6-9q-refoundation`.

After contract acceptance, branch from the final accepted design tip:

```
feat/rc8.4-v6-diagnosis-runtime
```

Implementation may not begin until explicit owner authorization.

---

## 19. COMPLIANCE

```
WORLD_MODEL_V21_CHANGED = NO
RUNTIME_CODE_CHANGED    = NO
```

---

## 20. CONTRACT / STAGE-A DISCREPANCY LOG

Rules are derived from goldens; where the Contract refines Stage A, it is logged:

- **D-1 (VALIDATION_GAP REQUIRED).** Stage A rule table listed
  `Q7 ∈ {再等等, 先想清楚}` inside VALIDATION_GAP REQUIRED. Golden **G11**
  (`Q7 = 先做个很小的版本试试`, `Q6 = 做过产品但没人买单`) is a VALIDATION_GAP but
  violates that clause — an internal inconsistency in Stage A. Contract moves the Q7
  clause to **SUPPORTING** (VALIDATION REQUIRED = Q6 anchor + no payment). Re-checked:
  G04, G11, G14 all still resolve VALIDATION_GAP; no other Golden is affected.
  `D1_STATUS = ACCEPTED_CORRECTION`.
- **D-2 (ACTION stage set).** Stage A ACTION_GAP REQUIRED restricted stage to
  `{THINKING, LEARNING}`. Contract widens to `{THINKING, RESEARCHING, LEARNING}` to
  make the §5 RESEARCHING priority row meaningful. No Golden changes: at RESEARCHING,
  G01/G07 fail ACTION's REQUIRED clause anyway → eligibility (not priority) selects
  DIRECTION. Stage membership alone does not create ACTION_GAP; REQUIRED evidence
  remains mandatory. `D2_STATUS = ACCEPTED_CORRECTION`.
- **D-3 (belief-gap DIRECTION discriminator).** Stage A goldens labeled G01 gap=YES,
  G07 gap=NO with otherwise near-identical Q5/Q9. Contract rule
  `RC84V6-GAP-DIRECTION` adds the Q7 discriminator to reproduce both. Formalized in
  §9.3. `D3_STATUS = ACCEPTED_CORRECTION` · `D3_GOLDEN_MATCH = 3/3`.
- **D-4 (Stage A G15 beliefGap).** Stage A `G15` = "traction but cannot repeat" with
  `Q5 = 做过不少尝试，但没结果`. Contract rule `RC84V6-GAP-TRIED` reproduces
  gap=YES as labeled.
- **D-5 (commit discipline).** Stage A was committed only after acceptance
  (SHA `6104064`) — consistent with "commit design docs only after acceptance".

All other Stage A constructs (bottlenecks, modifiers, stage mapping, gates) are
reproduced unchanged.

```
D1_STATUS = ACCEPTED_CORRECTION   (G04/G11/G14 still resolve VALIDATION_GAP)
D2_STATUS = ACCEPTED_CORRECTION   (stage membership alone does not create ACTION_GAP)
D3_STATUS = ACCEPTED_CORRECTION   (D3_GOLDEN_MATCH = 3/3)
```

---

## 21. PRODUCT INVARIANTS (CORE V6 RULE)

```
REALITY_MAY_BE_TRUE_AND_BEHAVIOR_MAY_STILL_AMPLIFY_IT = YES
```

The product must **not** force false dichotomies such as "不是现实问题，而是你自己的问题"
when both can be true. A real constraint can be present **and** a behavior can amplify
it. Card copy must reflect both, never negate one to assert the other.

### 21.1 No product blame

```
REALITY_DENIAL_ALLOWED = NO   (default)
```

Reality constraints must never be reframed as personal failure without contradictory
evidence. Forbidden patterns (unless evidence truly supports contradiction):

- "你不是没时间，只是…"
- "你不是缺资源，只是…"
- "问题根本不在环境…"

A hard `BELIEF_REALITY_GAP` requires the independent contradicting evidence defined in
§9; a genuine reality constraint defaults to `BELIEF_MATCH` / `BELIEF_PARTIAL` with
non-blaming copy.
