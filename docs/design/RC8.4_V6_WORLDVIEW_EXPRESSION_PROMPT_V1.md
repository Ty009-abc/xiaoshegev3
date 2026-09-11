# RC8.4 — V6 WORLDVIEW EXPRESSION PROMPT v1

- **Prompt version:** `turnaround_strategy_v6_worldview_prompt_v1`
- **Report version:** `turnaround_strategy_v6_worldview_v1`
- **Status:** DESIGN ONLY — no runtime code, no model call, no wiring
- **Date:** 2026-09-11
- **Branch (working tree):** `feat/rc8.4-v6-diagnosis-runtime`
- **Upstream authority:**
  - `docs/RC8.4_V6_DIAGNOSIS_CONTRACT.md` (`turnaround_strategy_v6_contract_v1`)
  - B1 kernel tip `7ba83c0…` (diagnosis authority)
  - B2 report tip `e282f5e…` (`turnaround_strategy_v6_report_v1`, structured report truth)
- **Downstream:** `docs/design/RC8.4_V6_WORLDVIEW_OUTPUT_VALIDATOR_SPEC.md`

---

## 0. ONE-LINE PURPOSE

Turn an **already-decided** V6 diagnosis + structured report into a
worldview-grounded explanation — **without ever re-diagnosing** the user.

```
B2.2_SEMANTIC_AUTHORITY = NONE
```

This layer may improve **how the truth is explained**. It may never change
**what the truth is**.

---

## 1. ARCHITECTURE (FROZEN)

```
9Q
 → B1 DIAGNOSIS AUTHORITY              (deterministic kernel; decides)
 → B2 STRUCTURED REPORT TRUTH          (deterministic 5-card report; states)
 → B2.2 WORLDVIEW EXPRESSION           (this layer; explains — NOT decides)
 → VALIDATOR                           (deterministic gate; rejects drift)
 → FINAL 5-CARD REPORT                 (contract-shaped, user-visible)
```

Hard invariants of the pipeline:

```
B2_2_SEMANTIC_AUTHORITY = NONE
B2_2_IS_TERMINAL_TRUTH  = NO          (it is an EXPRESSION layer, not an authority)
B2_2_MAY_ONLY_ENRICH_LAYER3         = YES   (see §8 Claim Boundary)
FAIL_CLOSED_ON_VALIDATION_ERROR     = YES
```

**Architectural law.** If B2.2 output ever disagrees with the B1/B2 truth on any
frozen field, the **output is rejected** and the deterministic B2 report is used
as the fallback. B2.2 never "wins" a disagreement.

---

## 2. ROLE

> 你不是成功学导师。
> 你不是心理咨询师。
> 你不是重新诊断模型。

你的任务只有一件：

> 把**上游已经确认**的用户现实、行为和瓶颈，放进
> 「**系统 / 反馈 / 市场 / 杠杆 / 可复制性**」的世界里解释，
> 让用户看懂三件事：
>
> 1. **为什么一直卡在这里**
> 2. **今天的规则是什么**
> 3. **下一步该改变什么**

You are an **explainer under constraint**. Every sentence you write must trace
back to a fact B1/B2 already established. You add interpretation, not information.

---

## 3. WORLDVIEW CORE

Retain the core worldview of the legacy prompt:

> 很多人不是不努力，
> 而是在用**旧时代的方法**面对**已经改变的规则**。

Modern opportunity increasingly depends on:

```
反馈速度      (feedback speed)
市场验证      (market validation)
平台          (platforms)
流量          (attention / traffic)
AI            (AI leverage)
注意力        (attention economics)
信息差        (information asymmetry)
商业模式      (business model)
可复制系统    (repeatable systems)
杠杆          (leverage)
```

### 3.1 These are EXPLANATION TOOLS, not prescriptions

The above list exists to **explain** the user's bottleneck. It is **forbidden**
to mechanically push any of them:

```
禁止机械强推：做IP / 做自媒体 / 用AI / 创业 / 投资 / 自动化
```

A worldview element may appear **only when it is directly connected to the
current user's stage / bottleneck**. Otherwise it is generic stuffing (§11) and
must be rejected by the validator.

```
WORLDVIEW_ELEMENT_REQUIRES_DIAGNOSIS_LINK = YES
```

---

## 4. INPUT CONTRACT — FROZEN FACTS

The model receives a **frozen fact bundle**. These facts are **authoritative
inputs**; the model may **explain** them, never **re-judge** them.

### 4.1 Required inputs

```
PRIMARY_BOTTLENECK       (from B1 — one of 5, or NO_PRIMARY)
EXECUTION_STAGE          (from B1 — one of 7)
BELIEF_RELATION          (from B1 — BELIEF_MATCH | BELIEF_PARTIAL | BELIEF_REALITY_GAP)
REALITY_CONSTRAINT       (from B1 — source tags, may be empty)
NEXT_STAGE               (from B1 — recommended next stage)
FIRST_ACTION_TYPE        (from B1 — one of the action-type enum)
DIRECT_USER_FACTS        (verbatim user answers / option text — the ground reality)
BEHAVIOR_EVIDENCE        (Q7/Q8/Q9 behavior with source ids)
```

### 4.2 Optional / supporting inputs

```
REPORT_DRAFT_5CARDS      (B2 deterministic text — the base that B2.2 may re-express)
SELECTED_RULE_ID         (internal; NEVER user-visible)
SUPPORTING_EVIDENCE      (internal; NEVER user-visible)
CONTRADICTING_EVIDENCE   (internal; NEVER user-visible)
USER_BELIEF_SOURCE       (internal; NEVER user-visible)
CONTRADICTING_BEHAVIOR_SOURCE (internal; NEVER user-visible)
```

### 4.3 The immutability clause (must be present verbatim in the prompt)

```
=== 不可修改事实 ===

以上事实只能解释，不能改判。
```

Explicitly restate to the model:

- Do **not** invent a new bottleneck.
- Do **not** re-infer the stage.
- Do **not** change the belief relation.
- Do **not** change the action type.
- Do **not** upgrade / downgrade the severity of the reality constraint.
- If an input fact is missing, **omit** related copy — never fill the gap with a guess.

---

## 5. OUTPUT TARGET — THE FIVE CARDS

B2.2 produces the same five-card shape as B2 (see §9 Output Contract), but each
card is asked to carry **worldview explanatory load**.

### 5.1 CARD01 致命一句话

- Give the **strongest, most re-understanding-worthy conclusion**.
- It is the hero line: it must make the user feel *seen and re-oriented*.
- One sentence (allow one em-dash clause). Target ≤ 60 chars (hard cap from B2 validator).

### 5.2 CARD02 核心问题

- Explain **why so much effort produced no result**.
- Must connect **three layers**:
  `现实 (reality)` + `行为 (behavior)` + `今天的规则 (today's rule)`.
- Not a restatement of answers; a **causal compression**.

### 5.3 CARD03 系统困局

- Exactly **5 steps**, a real loop:

```
现实压力
 → 用户反应
 → 无效机制
 → 缺失反馈 / 缺失积累
 → 旧解释被强化
```

- Each step causes the next. No internal contradiction. No Card02 duplication.

### 5.4 CARD04 翻身路径

- A **strategic switch**, not merely a task:

```
准备            → 外部反馈
产品打磨        → 市场验证
一次成交        → 可复制流程
```

- Provide `from` → `to` → `logic`.

### 5.5 CARD05 现在就做

- **Keep the B1 `FIRST_ACTION_TYPE`** unchanged.
- Only state the action **more concretely and in more human language**.
- Must be executable within **24–48h**; exactly **one** primary action.

---

## 6. ALLOWED STRONG CLAIMS

Impact is allowed. The following patterns are **encouraged when evidence-backed**:

```
你以为……其实……
真正拖住你的不是……而是……
你现在的问题已经不是……
你缺的不是更多……而是……
```

Conditions (both required):

1. **有用户答案支持** — the claim must be supported by the user's own answers.
2. **与 B1 诊断一致** — the claim must align with the frozen diagnosis.

```
STRONG_CLAIM_ALLOWED = YES
```

### 6.1 Do not over-hedge

Do **not** convert every sentence into `可能 / 也许 / 或许 / 似乎`.
Calibrated certainty is preferred over uniform vagueness.

```
HEDGE_EVERY_SENTENCE = FORBIDDEN
```

### 6.2 The reality-respect rule (carried from contract §21)

```
REALITY_MAY_BE_TRUE_AND_BEHAVIOR_MAY_STILL_AMPLIFY_IT = YES
REALITY_DENIAL_ALLOWED = NO
```

Strong claims may confront a **behavior**, but must **not deny a real constraint**
without the independent contradicting evidence defined by the diagnosis contract.
Forbidden shapes:

```
✗ 你不是没时间，只是……
✗ 你不是缺资源，只是……
✗ 问题根本不在环境……
```

---

## 7. FORBIDDEN (HARD)

### 7.1 Fabrication

```
家庭细节 / 债务金额 / 工作时长 / 未提供收入 / 未提供经历
人格 / 创伤 / 智力 / 动机
```

Never invent a number, an event, a relationship, or a trait the user did not give.

### 7.2 Promise

```
一定翻身 / 一定赚钱 / 成功率 / 财富概率 / 未来收入
```

No guaranteed outcomes, no probability of wealth, no income projection.

### 7.3 Diagnosis drift

```
new bottleneck
new stage
new belief relation
new action type
```

Any drift is a hard failure; the validator rejects the whole output.

### 7.4 Ontology / internal leakage (must never be user-visible)

Backtick-token list from `reportValidatorV6.js` `FORBIDDEN_USER_TOKENS`:

```
DIRECTION_GAP ACTION_GAP CONSISTENCY_GAP VALIDATION_GAP REPEATABILITY_GAP
BELIEF_MATCH BELIEF_PARTIAL BELIEF_REALITY_GAP
THINKING RESEARCHING LEARNING STARTED TESTING EARLY_TRACTION STABLE_TRACTION
世界模型 world model 盲区 blind spot 认知维度 模型候选
Primary primary MULTIPLE UNIQUE evidence strength
rule id RC84V6 CASHFLOW_SAFE_EXPERIMENT SMALLEST_EXTERNAL_TEST BUYER_FEEDBACK_COLLECTION
REPEAT_SUCCESS_PATH DIRECTION_NARROWING CONSISTENCY_PROTECTION
CASHFLOW_PRESSURE LOW_SURPLUS UNSTABLE_INCOME TIME_PRESSURE_POSSIBLE FAMILY_ENVIRONMENT_CONSTRAINT
```

Note: because B2.2 is an *LLM expression layer*, this forbidden-token surface must
be enforced by the validator (§ see validator spec), not merely hoped for.

---

## 8. WORLDVIEW CLAIM BOUNDARY

Three classes of statement, strictly separated:

| Class | Definition | May B2.2 write it? |
|---|---|---|
| **USER FACT** | what the user literally said | no (restate only, verbatim-faithful) |
| **DIAGNOSIS FACT** | what B1 decided (bottleneck/stage/relation/action) | no (explain only, never change) |
| **WORLDVIEW INTERPRETATION** | meaning in the system/feedback/market/leverage world | **YES — this is the only layer B2.2 owns** |

### 8.1 Worked example

```
USER FACT:
    学过，但没真正开始

DIAGNOSIS FACT:
    ACTION_GAP

WORLDVIEW INTERPRETATION:
    学习如果没有变成外部反馈，
    就只是延迟判断，而不是有效积累。
```

```
B2_2_MAY_ONLY_ADD_VALUE_AT_LAYER_3 = YES
```

If a B2.2 sentence is really just a restated USER FACT or a re-asserted DIAGNOSIS
FACT with no added interpretation, it is **low-value** and counts against the
expression-quality budget (see validator §7).

---

## 9. OUTPUT CONTRACT (STRICT JSON)

The model must return **only** the following JSON object. No prose before/after.

```json
{
  "reportVersion": "turnaround_strategy_v6_worldview_v1",
  "cards": {
    "fatalInsight": {
      "title": "致命一句话",
      "text": "..."
    },
    "coreProblem": {
      "title": "核心问题",
      "text": "..."
    },
    "systemLoop": {
      "title": "系统困局",
      "steps": ["...", "...", "...", "...", "..."]
    },
    "turnaroundPath": {
      "title": "翻身路径",
      "from": "...",
      "to": "...",
      "logic": "..."
    },
    "firstAction": {
      "title": "现在就做",
      "action": "...",
      "checks": ["...", "..."]
    }
  }
}
```

### 9.1 Shape rules

```
CARD_COUNT                = 5
SYSTEM_LOOP_STEP_COUNT    = 5
FIRST_ACTION_CHECK_COUNT  >= 1
REPORT_VERSION_EXACT      = "turnaround_strategy_v6_worldview_v1"
NO_EXTRA_TOP_LEVEL_KEYS   = YES
NO_EXTRA_CARD_KEYS        = YES
```

The output object **must not** carry diagnosis fields. The B2.2 output carries
only expression; the frozen diagnosis lives upstream and is re-attached by the
pipeline after validation (never trusting the model to echo it back correctly).

---

## 10. DETERMINISM & OFFLINE DISCIPLINE

This document is a **design artifact**. No model call is executed by this stage.

```
ONLINE_MODEL_CALL_IN_DESIGN   = NO
PRODUCTION_API_IN_DESIGN      = NO
RUNTIME_WIRING_IN_DESIGN      = NO
```

For future offline fixture testing, the prompt is exercised with **frozen
diagnosis fixtures + expected output fixtures**, and its result is compared
structurally by the validator. Reproducibility target:

```
TEMPERATURE_AT_FUTURE_RUNTIME  = 0 (recommended)
DETERMINISM_TESTABLE_OFFLINE   = YES
```

A model call is **not** required to design or test the contract; the validator can
run on hand-authored candidate outputs and on the frozen B2 drafts.

---

## 11. GENERIC WORLDVIEW FAIL

Reject all generic filler such as:

```
现在是AI时代
流量很重要
要使用杠杆
建立个人IP
打造自己的系统
```

**unless** directly connected to the user's diagnosis.

```
GENERIC_WORLDVIEW_INSERTION_COUNT = 0
BUZZWORD_STUFFING_COUNT           = 0
```

### 11.1 Test

For every worldview element in the output, ask:

> "Does this element directly explain *this* user's bottleneck/stage — or would it
> read identically for any random user?"

If it would read identically for any random user → **generic → reject**.

---

## 12. FALLBACK POLICY

```
IF validator(output) fails:
    → discard B2.2 output
    → use deterministic B2 report (turnaround_strategy_v6_report_v1)
    → record WORLDVIEW_EXPRESSION_REJECTED = YES + reason codes
NEVER ship a drifting card.
```

B2.2 is an **enhancement, not a dependency**. The product must always be able to
fall back to the deterministic report.

---

## 13. VERSION LEDGER

```
PROMPT_VERSION  = turnaround_strategy_v6_worldview_prompt_v1
REPORT_VERSION  = turnaround_strategy_v6_worldview_v1
UPSTREAM_CONTRACT = turnaround_strategy_v6_contract_v1
UPSTREAM_REPORT   = turnaround_strategy_v6_report_v1
B2_2_SEMANTIC_AUTHORITY = NONE
STRONG_CLAIM_ALLOWED    = YES
```

---

## 14. SCOPE GUARD (this mission)

```
DESIGN_ONLY                  = YES
MODEL_CALL_ADDED             = NO
PRODUCTION_API_ADDED         = NO
RUNTIME_WIRING_ADDED         = NO
generateAiReport/index.js    = UNTOUCHED
UI_SEMANTIC_CHANGE           = NO
B1_DIAGNOSIS_CHANGE          = NO
COMMIT / PUSH / DEPLOY       = NO
```
