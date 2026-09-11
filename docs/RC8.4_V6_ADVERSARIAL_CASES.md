# RC8.4 — V6 ADVERSARIAL DESIGN CASES

- **Contract version:** `turnaround_strategy_v6_contract_v1`
- **Status:** DESIGN — adversarial (NOT product Goldens)
- **Branch:** `design/rc8.4-v6-9q-refoundation`
- **Date:** 2026-09-11
- **Upstream:** `docs/RC8.4_V6_DIAGNOSIS_CONTRACT.md`

> Purpose: prove **stage priority does not force a diagnosis**, and that the
> contract refuses a primary rather than manufacture one. These are synthetic
> stress cases, not consumer fixtures. Card copy is intentionally out of scope.

Legend: `eligible` = passes REQUIRED (§4 of contract) · `NO_PRIMARY` = contract
voluntarily refuses a primary · `gap` = belief-reality gap · `RC` = reality constraint.

---

## CASE A — THINKING but clear direction + strong action intent
**答:** Q1 `25–30` · Q2 `自由职业 / 接单` · Q3 `1000–5000元` ·
Q4 `想做副业，但一直没做起来` · Q5 `知道方向，但一直没真正行动` · Q6 `主要还在想` ·
Q7 `先做个很小的版本试试` · Q8 `两边都会安排` · Q9 `再坚持一阵`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| none | **NO_PRIMARY** | DIRECTION: stage ✓ but Q5 ∉ {不知道该往哪走, 总在换方向} ✗ · ACTION: Q7 = 先做很小版本 ∉ required set ✗ | NO | no | — | — |

**Proves:** a THINKING user is not auto-assigned DIRECTION/ACTION. Belief (knows
direction) + behavior (tries small versions) are mutually inconsistent with both
eligible sets → honest refusal.

---

## CASE B — LEARNING but no ACTION_GAP required evidence
**答:** Q1 `31–40` · Q2 `固定工资` · Q3 `1000–5000元` · Q4 `收入一直上不去` ·
Q5 `做过不少尝试，但没结果` · Q6 `学过东西，但没真正开始` · Q7 `先做个很小的版本试试` ·
Q8 `两边都会安排` · Q9 `重新检查方法和步骤`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| none | **NO_PRIMARY** | DIRECTION: stage ∉ {THINKING,RESEARCHING} ✗ · ACTION: Q7 ∉ required set ✗ | NO | no | — | — |

**Proves:** LEARNING does not force ACTION_GAP; without the Q7 gate there is no
eligible candidate.

---

## CASE C — STARTED but strong validation behavior
**答:** Q1 `31–40` · Q2 `生意 / 个体经营` · Q3 `5000–10000元` · Q4 `收入一直上不去` ·
Q5 `能力还不够` · Q6 `开始做过，但没坚持多久` · Q7 `先做个很小的版本试试` ·
Q8 `会固定给长期的事留时间` · Q9 `重新检查方法和步骤`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| none | **NO_PRIMARY** | CONSISTENCY: Q6 ✓ but (Q9=换方向 OR Q8=一忙就停) ✗ · VALIDATION: Q6 anchor ✗ | NO | no | — | — |

**Proves:** active method-rechecking + protected long-term time means neither
CONSISTENCY nor VALIDATION is supported; the contract does not force STARTED→gap.

---

## CASE D — TESTING with strong feedback behavior but poor consistency
**答:** Q1 `25–30` · Q2 `自由职业 / 接单` · Q3 `1000–5000元` · Q4 `收入一直上不去` ·
Q5 `做过不少尝试，但没结果` · Q6 `做过产品 / 服务，但没人买单` · Q7 `先做个很小的版本试试` ·
Q8 `一忙起来，长期的事就先停` · Q9 `换个方向试试`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| VALIDATION | **VALIDATION_GAP** | Q6 = 做过产品但没人买单 ✓, no payment ✓ · CONSISTENCY: Q6 anchor ✗ | NO | no | EARLY_TRACTION | ASK_BUYERS_DEMAND_QUESTION |

**Proves:** CONSISTENCY-flavored behaviors (Q8/Q9) do **not** hijack a TESTING-anchored
case. Stage anchor (Q6) decides eligibility; behavior only supports/suppresses.

---

## CASE E — EARLY_TRACTION with repeatability already present
**答:** Q1 `25–30` · Q2 `自由职业 / 接单` · Q3 `5000–10000元` · Q4 `收入一直上不去` ·
Q5 `做过不少尝试，但没结果` · Q6 `已经有人愿意付钱` · Q7 `先做个很小的版本试试` ·
Q8 `会固定给长期的事留时间` · Q9 `再坚持一阵`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| none | **NO_PRIMARY** | REPEATABILITY: Q6 ✓ but Q8 ∉ {先做马上, 一忙就停} ✗ · VALIDATION: Q6 anchor ✗ | NO | no | — | — |

**Proves:** paying traction **plus** a protected long-term habit → repeatability
gap not established → maintenance/re-engagement card, not a forced diagnosis.

---

## CASE F — STABLE_TRACTION with no obvious gap
**答:** Q1 `41–50` · Q2 `生意 / 个体经营` · Q3 `5000–10000元` · Q4 `工作看不到未来` ·
Q5 `做过不少尝试，但没结果` · Q6 `已经有一点稳定结果` · Q7 `先做个很小的版本试试` ·
Q8 `会固定给长期的事留时间` · Q9 `再坚持一阵`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| none | **NO_PRIMARY** | REPEATABILITY: Q6 ✓ but Q8 = 会固定给长期的事留时间 ✗ (contradicting) | NO | no | — | — |

**Proves:** STABLE_TRACTION does not automatically mean REPEATABILITY_GAP.

---

## CASE G — user says 缺资源 **but behavior supports it** (no fake gap)
**答:** Q1 `31–40` · Q2 `生意 / 个体经营` · Q3 `基本留不下 / 经常不够` ·
Q4 `债务 / 现金流压力` · Q5 `缺钱 / 缺资源` · Q6 `做过产品 / 服务，但没人买单` ·
Q7 `先做个很小的版本试试` · Q8 `会固定给长期的事留时间` · Q9 `重新检查方法和步骤`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| VALIDATION | **VALIDATION_GAP** | Q6 anchor ✓ · GAP-RESOURCE NOT matched (Q6 ∉ {还在想,查资料,学过没开始}) | **NO** | YES (debt+surplus) | EARLY_TRACTION | ASK_BUYERS_DEMAND_QUESTION |

**Proves:** when the belief is genuinely supported by evidence, **no gap** is emitted
(no false "you're not really short on resources").

---

## CASE H — user says 没时间 and Q8 shows long-term time dropped (re-run post-OQ-1)
**答:** Q1 `25–30` · Q2 `固定工资` · Q3 `1000–5000元` · Q4 `事情很多，一直无法聚焦` ·
Q5 `没时间` · Q6 `开始做过，但没坚持多久` · Q7 `再等等，信息更充分再说` ·
Q8 `一忙起来，长期的事就先停` · Q9 `换个方向试试`

| eligible | selectedPrimary | reason | beliefRelation | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| CONSISTENCY | **CONSISTENCY_GAP** | Q6 = 开始做过但没坚持多久 ✓ AND Q9 = 换个方向试试 ✓ | **PARTIAL** (`TIME-PARTIAL`) | no | TESTING | LOCK_RECURRING_SLOT |

**Exact selection reasoning:**
- `REALITY_TIME_CONSTRAINT = POSSIBLE` — Q2 stable salary, Q3 = 1000–5000元
  (not severe), Q4 = 事情很多 (not debt/cashflow). Reality does **not** strongly
  support a genuine external constraint, but does not rule one out either (no weekly-hours
  question).
- `TIME_ALLOCATION_PATTERN = PRESENT` — Q8 = 一忙起来，长期的事就先停; Q6 = started
  but did not persist.
- `BELIEF_RELATION = PARTIAL` (`RC84V6-TIME-PARTIAL`).
- `BELIEF_REALITY_GAP = NO (hard)` — single time signal (Q5 + Q8) is NOT sufficient
  (§9.2: `TIME_GAP_SINGLE_SIGNAL_ALLOWED = NO`).
- Copy must not claim "你不是没时间": a real time load may exist, and behavior may
  amplify it (`REALITY_MAY_BE_TRUE_AND_BEHAVIOR_MAY_STILL_AMPLIFY_IT = YES`).

**Proves:** reality and behavior can coexist; the contract no longer forces a false
dichotomy.

---

## CASE H1 — genuinely time-poor (paired)
**答:** Q1 `31–40` · Q2 `自由职业 / 接单` · Q3 `基本留不下 / 经常不够` ·
Q4 `债务 / 现金流压力` · Q5 `没时间` · Q6 `学过东西，但没真正开始` ·
Q7 `再等等，信息更充分再说` · Q8 `一忙起来，长期的事就先停` · Q9 `先停下来，不再继续投入`

| eligible | selectedPrimary | reason | beliefRelation | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| ACTION | **ACTION_GAP** | stage LEARNING ✓ AND Q7 ∈ {再等等, 先想清楚} ✓ AND Q6 = 学过没开始 ✓ | **MATCH** | **YES** (debt+surplus) | STARTED | CASH_TODAY_MICRO_ACTION |

**Exact reasoning:** `REALITY_TIME_CONSTRAINT = SUPPORTED` — Q2 unstable/variable
income, Q3 = 基本留不下, Q4 = 债务 / 现金流压力 → genuine heavy current-income load.
Therefore `BELIEF_MATCH`; **no** time gap; reality constraint caps action size
(cash-today, no capital risk). Primary remains the execution bottleneck (ACTION_GAP),
not the debt.

**Proves:** a real time constraint is honored, not reframed as a personal failing, and
reality never becomes the primary bottleneck.

---

## CASE H2 — relatively unconstrained reality (paired)
**答:** Q1 `31–40` · Q2 `固定工资` · Q3 `5000–10000元` · Q4 `事情很多，一直无法聚焦` ·
Q5 `没时间` · Q6 `开始做过，但没坚持多久` · Q7 `再等等，信息更充分再说` ·
Q8 `一忙起来，长期的事就先停` · Q9 `换个方向试试`

| eligible | selectedPrimary | reason | beliefRelation | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| CONSISTENCY | **CONSISTENCY_GAP** | Q6 = 开始做过但没坚持多久 ✓ AND Q9 = 换个方向试试 ✓ | **PARTIAL** (`TIME-PARTIAL`) | no | TESTING | LOCK_RECURRING_SLOT |

**Exact reasoning:** `REALITY_TIME_CONSTRAINT = NOT SUPPORTED` — stable income,
adequate surplus (5000–10000元), no debt/cashflow pressure. Behavior repeatedly shows
non-protection of long-term work. Per §9.2 Case B → `BELIEF_PARTIAL` by default; a hard
`BELIEF_REALITY_GAP` is **not** emitted because no independent contradictory evidence
exists.

**Proves:** H1 vs H2 — same belief (没时间) and same Q8, different reality → different
`beliefRelation` (MATCH vs PARTIAL). Reality and behavior can coexist; no forced hard gap.

---

## CASE I — user says 能力不够 but already has paying users
**答:** Q1 `25–30` · Q2 `自由职业 / 接单` · Q3 `5000–10000元` · Q4 `收入一直上不去` ·
Q5 `能力还不够` · Q6 `已经有人愿意付钱` · Q7 `再等等，信息更充分再说` ·
Q8 `先做马上有结果的` · Q9 `再坚持一阵`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| REPEATABILITY | **REPEATABILITY_GAP** | Q6 ∈ {付钱} ✓ AND Q8 = 先做马上有结果的 ✓ | **YES** (`GAP-ABILITY-1`) | no | STABLE_TRACTION | REPLICATE_CLOSING_STEPS |

**Proves:** an ability belief is directly contradicted by payment evidence.

---

## CASE J — debt pressure + strong execution
**答:** Q1 `31–40` · Q2 `生意 / 个体经营` · Q3 `基本留不下 / 经常不够` ·
Q4 `债务 / 现金流压力` · Q5 `做过不少尝试，但没结果` · Q6 `做过产品 / 服务，但没人买单` ·
Q7 `先做个很小的版本试试` · Q8 `会固定给长期的事留时间` · Q9 `重新检查方法和步骤`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| VALIDATION | **VALIDATION_GAP** | Q6 anchor ✓ | NO | YES (debt+surplus) | EARLY_TRACTION | ASK_BUYERS_DEMAND_QUESTION |

**Proves:** debt does **not** override the primary; strong execution does not change
a validation-stage diagnosis either.

---

## CASE K — high surplus + severe action gap
**答:** Q1 `31–40` · Q2 `固定工资` · Q3 `1万元以上` · Q4 `工作看不到未来` ·
Q5 `知道方向，但一直没真正行动` · Q6 `学过东西，但没真正开始` ·
Q7 `先把可能的问题都想清楚` · Q8 `一忙起来，长期的事就先停` · Q9 `再坚持一阵`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| ACTION | **ACTION_GAP** | stage ✓ AND Q7 ∈ {再等等, 先想清楚} ✓ AND Q5 = 知道方向但没行动 ✓ | NO | no | TESTING | MINIMAL_DELIVERY_TO_REAL_PERSON |

**Proves:** affluence does not prevent ACTION_GAP; surplus is not a diagnosis.

---

## CASE L — contradictory Q7/Q8/Q9 combination
**答:** Q1 `31–40` · Q2 `固定工资` · Q3 `1000–5000元` · Q4 `工作看不到未来` ·
Q5 `不知道该往哪走` · Q6 `查过很多资料` · Q7 `先做个很小的版本试试` ·
Q8 `会固定给长期的事留时间` · Q9 `重新检查方法和步骤`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| none | **NO_PRIMARY** | DIRECTION: Q9 ✗ (重新检查方法) · ACTION: Q7 ✗ (先做很小版本) | NO | no | — | — |

**Proves:** claimed direction-uncertainty is contradicted by experienced execution
behavior (tries small, protects time, rechecks) → refusal, not a manufactured primary.

---

## CASE M — DIRECTION variant: "总在换方向" (belief form not covered by gap rule)
**答:** Q1 `18–24` · Q2 `暂时没有稳定收入` · Q3 `1000元以下` ·
Q4 `想转行，但不知道往哪走` · Q5 `总在换方向` · Q6 `主要还在想` ·
Q7 `再等等，信息更充分再说` · Q8 `先做马上有结果的` · Q9 `换个方向试试`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| DIRECTION | **DIRECTION_GAP** | stage THINKING ✓ AND Q5 = 总在换方向 ✓ AND Q9 = 换个方向试试 ✓ | **NO** (GAP-DIRECTION requires Q5 = 不知道该往哪走) | YES (surplus) | STARTED | SHIP_FIRST_ARTIFACT |

**Proves / flags:** DIRECTION can be primary without a gap; `GAP-DIRECTION` does not
cover the `总在换方向` belief form → see **OQ-2**.

---

## CASE N — EARLY_TRACTION with no eligible candidate
**答:** Q1 `31–40` · Q2 `自由职业 / 接单` · Q3 `5000–10000元` · Q4 `收入一直上不去` ·
Q5 `能力还不够` · Q6 `已经有人愿意付钱` · Q7 `再等等，信息更充分再说` ·
Q8 `会固定给长期的事留时间` · Q9 `换个方向试试`

| eligible | selectedPrimary | reason | gap | RC | nextStage | actionType |
|---|---|---|---|---|---|---|
| none | **NO_PRIMARY** | REPEATABILITY: Q6 ✓ but Q8 ✗ · VALIDATION: Q6 anchor ✗ | NO | no | — | — |

**Proves:** even the highest-traction stage does not force a diagnosis.

---

## ACCEPTANCE (§20)

```
ADVERSARIAL_CASE_COUNT              = 16   (>= 16 required; 14 + H1/H2)
FORCED_DIAGNOSIS_COUNT             = 0    (A,B,C,E,F,L,N correctly refuse)
FAKE_BELIEF_GAP_COUNT              = 0
FAKE_TIME_BELIEF_GAP_COUNT         = 0    (H,H2 emit PARTIAL, not a hard gap)
REALITY_OVERRIDE_ERROR_COUNT       = 0    (G,H1,J,K: reality never became the primary)
STAGE_PRIORITY_OVERRIDE_ERROR_COUNT= 0    (no ineligible candidate rescued by priority)
```

Hard-gap adversarial cases: I → 1. Partial: H, H2 → 2. Gap-refusing: A,B,C,E,F,G,H1,
J,K,L,M,N → 12.

---

## OPEN QUESTIONS (status)

- **OQ-1 (GAP-TIME over-fire) — RESOLVED.** Time belief now splits
  `REALITY_TIME_CONSTRAINT` / `TIME_ALLOCATION_PATTERN` / `BELIEF_REALITY_GAP`
  (contract §9.2). Q5=没时间 + Q8=长期被挤掉 alone → `BELIEF_PARTIAL`, never a hard
  gap. `TIME_GAP_SINGLE_SIGNAL_ALLOWED = NO`. New rule `RC84V6-TIME-PARTIAL`.
- **OQ-2 (belief 总在换方向) — DEFERRED_PENDING_GOLDEN.** No new rule in v1
  (`NEW_DIRECTION_SWITCH_RULE_ADDED = NO`; `FUTURE_GOLDEN_REQUIRED = YES`).
- **OQ-3 (RESEARCHING priority row) — OPEN.** No Golden exercises
  `RESEARCHING: ACTION > DIRECTION`; the row is contract-theoretic until a real fixture
  disagrees.
- **OQ-4 (CONSISTENCY vs VALIDATION) — APPROVED.** Stage anchor after eligibility
  (contract §5.1). `ELIGIBILITY_FIRST = YES` · `STAGE_TIE_BREAK_SECOND = YES`.

---

## PRODUCT INVARIANTS

```
REALITY_MAY_BE_TRUE_AND_BEHAVIOR_MAY_STILL_AMPLIFY_IT = YES
REALITY_DENIAL_ALLOWED                                = NO   (default)
```

Reality constraints must never be reframed as personal failure without contradictory
evidence (contract §21).
