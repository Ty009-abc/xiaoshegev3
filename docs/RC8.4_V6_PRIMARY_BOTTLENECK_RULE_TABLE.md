# RC8.4 — V6 PRIMARY BOTTLENECK RULE TABLE

- **Status:** DESIGN — deterministic rule table **derived FROM** the 15 accepted Goldens
- **Branch:** `design/rc8.4-v6-9q-refoundation`
- **Date:** 2026-09-11
- **Upstream:** `docs/RC8.4_V6_PRODUCT_GOLDEN_15_CASES.md` (product goldens) ·
  `docs/RC8.4_TURNAROUND_STRATEGY_V6_9Q_REFOUNDATION_DESIGN.md` §4 (frozen 9Q)
- **Nature:** design only. No engine. No runtime code. Rules read Q1–Q9 option
  identities only.

> Derivation order enforced: **goldens first, rules second** (§2 of the Goldens doc).
> Every rule below is read off an accepted Golden report; nothing is invented to
> make the table look complete.

---

## 1. INPUTS (Q1–Q9)

| ID | Field | Group |
|---|---|---|
| Q1 | AGE_STAGE | REALITY |
| Q2 | INCOME_MODE (+ optional occupation text) | REALITY |
| Q3 | MONTHLY_SURPLUS | REALITY |
| Q4 | PRIMARY_PROBLEM | DESIRED_CHANGE |
| Q5 | USER_BELIEF | BELIEF |
| Q6 | EXECUTION_STAGE | STAGE |
| Q7 | UNCERTAINTY_BEHAVIOR | BEHAVIOR |
| Q8 | TIME_BEHAVIOR | BEHAVIOR |
| Q9 | NO_RESULT_BEHAVIOR | BEHAVIOR |

Stage mapping (Q6 → stage) is strict 1:1 (Design doc §10).

Option identities used below are the canonical Chinese option strings from the
frozen questionnaire. No scores. No weights. No percentages. No probability.

---

## 2. FIVE PRIMARY BOTTLENECKS — RULE CARDS

Legend: `REQUIRED` must all hold · `SUPPORTING` raises confidence but is not
sufficient · `CONTRADICTING` suppresses the candidate · `TIE_BREAK` resolves two
candidates that both pass REQUIRED · `NO_PRIMARY` = emit no primary (fail-closed) ·
`FALLBACK` = deterministic next candidate if REQUIRED fails.

### 2.1 DIRECTION_GAP
- **REQUIRED:** stage ∈ {THINKING, RESEARCHING} **AND** Q5 ∈ {不知道该往哪走, 总在换方向} **AND** Q9 = 换个方向试试.
- **SUPPORTING:** Q7 = 再等等，信息更充分再说; Q8 = 一忙起来，长期的事就先停; Q4 ∈ {工作看不到未来, 想转行，但不知道往哪走, 有能力，但不知道怎么变现}.
- **CONTRADICTING:** Q6 ∈ {开始做过，但没坚持多久, 做过产品 / 服务，但没人买单, 已经有人愿意付钱, 已经有一点稳定结果}; Q9 ∈ {再坚持一阵, 重新检查方法和步骤}.
- **TIE_BREAK:** vs ACTION_GAP → if Q6 = 学过东西，但没真正开始 → ACTION_GAP; else → DIRECTION_GAP.
- **NO_PRIMARY:** if stage ∈ {THINKING, RESEARCHING} but Q5 = 知道方向，但一直没真正行动 and Q9 ≠ 换个方向试试 → no DIRECTION primary (falls to ACTION_GAP).
- **FALLBACK:** partial match → ACTION_GAP.
- **Golden refs:** G01, G07, G09.

### 2.2 ACTION_GAP
- **REQUIRED:** stage ∈ {THINKING, LEARNING} **AND** Q7 ∈ {再等等，信息更充分再说, 先把可能的问题都想清楚} **AND** (Q5 = 知道方向，但一直没真正行动 **OR** Q6 = 学过东西，但没真正开始).
- **SUPPORTING:** Q6 = 查过很多资料; Q8 = 一忙起来，长期的事就先停; Q9 = 先停下来，不再继续投入.
- **CONTRADICTING:** Q6 ∈ {开始做过，但没坚持多久, 做过产品 / 服务，但没人买单, 已经有人愿意付钱, 已经有一点稳定结果}; Q7 = 先做个很小的版本试试.
- **TIE_BREAK:** vs DIRECTION_GAP → if Q5 = 不知道该往哪走 → DIRECTION_GAP; else → ACTION_GAP.
- **NO_PRIMARY:** stage ∈ {TESTING, EARLY_TRACTION, STABLE_TRACTION} → ACTION_GAP cannot be primary.
- **FALLBACK:** if Q5 = 不知道该往哪走 → DIRECTION_GAP.
- **Golden refs:** G02, G06, G10, G12.

### 2.3 CONSISTENCY_GAP
- **REQUIRED:** Q6 = 开始做过，但没坚持多久 **AND** (Q9 = 换个方向试试 **OR** Q8 = 一忙起来，长期的事就先停).
- **SUPPORTING:** Q5 = 总在换方向; Q7 = 再等等，信息更充分再说.
- **CONTRADICTING:** Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果} (→ considered later in stage order); Q8 = 会固定给长期的事留时间.
- **TIE_BREAK:** vs VALIDATION_GAP → if Q6 = 做过产品 / 服务，但没人买单 → VALIDATION_GAP; else → CONSISTENCY_GAP.
- **NO_PRIMARY:** none in its own stage; if Q6 ≠ 开始做过，但没坚持多久 → not CONSISTENCY.
- **FALLBACK:** if Q6 = 学过东西，但没真正开始 → ACTION_GAP.
- **Golden refs:** G03, G08, G13.

### 2.4 VALIDATION_GAP
- **REQUIRED:** Q6 = 做过产品 / 服务，但没人买单 **AND** Q7 ∈ {再等等，信息更充分再说, 先把可能的问题都想清楚} **AND** no payment evidence (Q6 < 已经有人愿意付钱).
- **SUPPORTING:** Q4 ∈ {想做副业，但一直没做起来, 有能力，但不知道怎么变现}; Q9 ∈ {换个方向试试, 先停下来，不再继续投入}; Q5 = 能力还不够.
- **CONTRADICTING:** Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果}; Q5 = 做过不少尝试，但没结果 with Q7 = 先做个很小的版本试试 (redirects toward method/continuity).
- **TIE_BREAK:** vs CONSISTENCY_GAP → if Q8 = 会固定给长期的事留时间 and Q7 = 先做个很小的版本试试 → VALIDATION_GAP (execution present, validation missing).
- **NO_PRIMARY:** Q6 < 做过产品 / 服务，但没人买单 → not VALIDATION.
- **FALLBACK:** if continuity is the actual break (Q9 = 换个方向试试 and Q8 = 一忙起来，长期的事就先停 and no product) → CONSISTENCY_GAP.
- **Golden refs:** G04, G11, G14.

### 2.5 REPEATABILITY_GAP
- **REQUIRED:** Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果} **AND** (Q8 = 先做马上有结果的 **OR** Q8 = 一忙起来，长期的事就先停) **AND** no repeatable-process evidence.
- **SUPPORTING:** Q4 = 收入一直上不去; Q7 = 先做个很小的版本试试 (proves trial ability, not a system).
- **CONTRADICTING:** Q6 = 已经有一点稳定结果 **AND** Q8 = 会固定给长期的事留时间 (system already present → maintenance).
- **TIE_BREAK:** vs VALIDATION_GAP → if Q6 = 已经有人愿意付钱 → REPEATABILITY_GAP (payment proven, repetition not).
- **NO_PRIMARY:** Q6 < 已经有人愿意付钱 → not REPEATABILITY.
- **FALLBACK:** if stable + systemized (Q8 = 会固定给长期的事留时间) → downgrade to **maintenance card** (see §4).
- **Golden refs:** G05, G15.

---

## 3. MODIFIERS (never primary)

### 3.1 REALITY_CONSTRAINT
- **TRIGGER:** Q3 ∈ {基本留不下 / 经常不够, 1000元以下} **OR** Q4 = 债务 / 现金流压力.
- **EFFECT:** cap Card05 cost/time; add a cashflow-stabilizing pre-step **only when stage ≥ STARTED**; never replaces the primary bottleneck.
- **Golden refs:** G06 (Q3 + Q4), G09 (Q3).

### 3.2 BELIEF_REALITY_GAP
- **TRIGGER (any):**
  - Q5 = 缺钱 / 缺资源 **AND** Q6 ∈ {主要还在想, 查过很多资料, 学过东西，但没真正开始} → G12
  - Q5 = 没时间 **AND** Q8 ∈ {先做马上有结果的, 一忙起来，长期的事就先停} → G13
  - Q5 = 能力还不够 **AND** Q6 ∈ {做过产品 / 服务，但没人买单, 已经有人愿意付钱} → G05, G14
  - Q5 = 能力还不够 **AND** Q8 = 一忙起来，长期的事就先停 **AND** (Q9 = 再坚持一阵) → G08
  - Q5 = 做过不少尝试，但没结果 **AND** Q6 = 已经有一点稳定结果 → G15
  - Q5 = 不知道该往哪走 **AND** (Q9 = 换个方向试试 **OR** Q5 = 总在换方向) → G01
- **EFFECT:** emits a contrast clause with provenance `[Q5, <behavior/systemQ>]`. Card01/Card02 must show the contradiction.
- **NOT A GAP:** belief matches behavior → `BELIEF_REALITY_GAP = NO`. Do not manufacture contrast.

---

## 4. RULE PRIORITY (stage-ordered)

Proposed priority ordering (validated against all 15 Goldens — see §4.1):

```
IF stage = STABLE_TRACTION  → consider REPEATABILITY_GAP first
ELSE IF stage = EARLY_TRACTION → consider REPEATABILITY_GAP, then VALIDATION_GAP
ELSE IF stage = TESTING     → consider VALIDATION_GAP first
ELSE IF stage = STARTED     → consider CONSISTENCY_GAP, then VALIDATION_GAP
ELSE IF stage ∈ {LEARNING, RESEARCHING} → consider ACTION_GAP, then DIRECTION_GAP
ELSE IF stage = THINKING    → consider DIRECTION_GAP, then ACTION_GAP
```

**Status: NOT FROZEN.** Validated against Goldens below.

### 4.1 Validation vs Goldens

| Golden | Stage | Priority candidate order | Resolved primary | Ambiguous? |
|---|---|---|---|---|
| G01 | RESEARCHING | ACTION → DIRECTION | DIRECTION_GAP (Q6=查资料, Q9=换方向) | no |
| G07 | RESEARCHING | ACTION → DIRECTION | DIRECTION_GAP (Q5=不知道往哪走) | no |
| G02 | LEARNING | ACTION → DIRECTION | ACTION_GAP | no |
| G06 | LEARNING | ACTION → DIRECTION | ACTION_GAP | no |
| G10 | LEARNING | ACTION → DIRECTION | ACTION_GAP | no |
| G12 | LEARNING | ACTION → DIRECTION | ACTION_GAP | no |
| G09 | THINKING | DIRECTION → ACTION | DIRECTION_GAP | no |
| G03 | STARTED | CONSISTENCY → VALIDATION | CONSISTENCY_GAP (Q6=开始过没坚持) | no |
| G08 | STARTED | CONSISTENCY → VALIDATION | CONSISTENCY_GAP | no |
| G13 | STARTED | CONSISTENCY → VALIDATION | CONSISTENCY_GAP | no |
| G04 | TESTING | VALIDATION | VALIDATION_GAP | no |
| G11 | TESTING | VALIDATION | VALIDATION_GAP | no |
| G14 | TESTING | VALIDATION | VALIDATION_GAP | no |
| G05 | EARLY_TRACTION | REPEATABILITY → VALIDATION | REPEATABILITY_GAP | no |
| G15 | STABLE_TRACTION | REPEATABILITY | REPEATABILITY_GAP | no |

```
UNCOVERED_CASE_COUNT    = 0
AMBIGUOUS_PRIMARY_COUNT = 0
RULE_PRIORITY_VALIDATED = 15/15
```

Ordering note: within {LEARNING, RESEARCHING} the doc proposes **ACTION before
DIRECTION**, yet G01/G07 resolve DIRECTION **first** — because their REQUIRED
ACTION evidence is unmet (Q5 ≠ 知道方向但没行动; Q9 ≠ 先停下来). This is intended:
**REQUIRED evidence gates ordering; ordering only breaks ties among candidates that
already pass REQUIRED.** Confirmed on 15/15 Goldens.

---

## 5. TIE-BREAK MATRIX (deterministic)

| Passes REQUIRED | vs | Resolve |
|---|---|---|
| DIRECTION & ACTION | | Q5 = 不知道该往哪走 → DIRECTION; else ACTION |
| CONSISTENCY & VALIDATION | | Q6 = 做过产品但没人买单 → VALIDATION; Q6 = 开始过没坚持 → CONSISTENCY |
| VALIDATION & REPEATABILITY | | Q6 ≥ 已经有人愿意付钱 → REPEATABILITY; else VALIDATION |
| DIRECTIONS all pass, same stage | | first by stage priority (§4), then REQUIRED-strength, then Q9 evidence |

No tie is left to chance. No hidden weighting.

---

## 6. NO_PRIMARY / FAIL-CLOSED

Emit **no primary bottleneck** (and a retake/re-focus card instead) when:
- REQUIRED evidence for every candidate in the stage is unmet, **or**
- answers are structurally contradictory with no deterministic resolution.

```
NO_PRIMARY_FAIL_CLOSED = DEFINED
```

(Response-quality / straight-lining interception remains the domain of the frozen
v2.1 response-validity layer — **secondary evidence only**, not V6 primary logic.)

---

## 7. REALITY CONSTRAINT SEPARATION (§16)

`REALITY_CONSTRAINT` is a **modifier**. It may reduce experiment size and add a
cashflow pre-step, but must not become the diagnosis.

- G06: debt pressure present, but primary = **ACTION_GAP**; the debt modifier adds
  a "cash today" pre-step, it does **not** become "you are broke".
- G09: near-zero surplus, but primary = **DIRECTION_GAP**; the modifier only caps
  Card05 cost ("不花钱或极少花钱").

```
REALITY_CONSTRAINT_OVERRIDES_PRIMARY_COUNT = 0
```

(Target 0. No Golden required an override; none is added.)

---

## 8. CARD05 STAGE×BOTTLENECK BEHAVIOUR (anti-collapse)

Card05 must vary materially by `executionStage × primaryBottleneck`:

| Stage | Bottleneck | First-action type |
|---|---|---|
| THINKING | DIRECTION_GAP | ship a first showcaseable artifact (G09) |
| RESEARCHING | DIRECTION_GAP | run one 7-day minimal bet (G01) / one 2-week real task (G07) |
| LEARNING | ACTION_GAP | one minimal delivery to one real person (G02/G10); zero-cost use-once (G12); cash-today micro-action (G06) |
| STARTED | CONSISTENCY_GAP | lock a non-negotiable recurring slot (G03/G13); reusable-output slot (G08) |
| TESTING | VALIDATION_GAP | ask 3 buyers a demand question (G04); ask 3 users pay-behaviour (G11); quote 3 buyers (G14) |
| EARLY_TRACTION | REPEATABILITY_GAP | extract + replicate the closing 3-step (G05) |
| STABLE_TRACTION | REPEATABILITY_GAP | write the delivery SOP + identify first delegable step (G15) |

```
ACTION_PLAN_TEMPLATE_COLLAPSE = NO
```

---

## 9. DERIVATION PROVENANCE

Every rule cites its Golden(s) (§2.x `Golden refs`). Rules that could not be read
off any accepted Golden were **not** added:

```
RULES_WITHOUT_GOLDEN_PROVENANCE = 0
```

## 10. STATUS

```
PRIMARY_BOTTLENECK_COUNT               = 5
MODIFIERS                              = 2 (REALITY_CONSTRAINT, BELIEF_REALITY_GAP)
RULE_PRIORITY                          = PROPOSED / VALIDATED_NOT_FROZEN
RULE_TABLE_FROZEN                      = NO  (awaiting design acceptance)
SAFE_TO_START_V6_RULE_ACCEPTANCE       = YES
SAFE_TO_START_V6_IMPLEMENTATION        = NO
```
