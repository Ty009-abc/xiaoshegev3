# RC8.4 — V6 WORLDVIEW OUTPUT VALIDATOR SPEC

- **Spec version:** `turnaround_strategy_v6_worldview_validator_v1`
- **Report version under validation:** `turnaround_strategy_v6_worldview_v1`
- **Prompt under validation:** `turnaround_strategy_v6_worldview_prompt_v1`
- **Status:** DESIGN ONLY — spec only, no runtime code
- **Date:** 2026-09-11
- **Branch (working tree):** `feat/rc8.4-v6-diagnosis-runtime`
- **Companion:** `docs/design/RC8.4_V6_WORLDVIEW_EXPRESSION_PROMPT_V1.md`
- **Extends:** `cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/report/reportValidatorV6.js`

---

## 0. PURPOSE

The B2.2 expression layer is produced by a language model. This validator is the
**deterministic gate** that stands between the model output and the user-visible
report. Its job:

1. Confirm **shape** (the JSON is exactly the contract shape).
2. Confirm **no diagnosis drift** (B1 facts unchanged).
3. Confirm **no fabrication / no promise / no ontology leak**.
4. Confirm **no generic worldview stuffing**.
5. On any hard failure → **reject and fall back** to the deterministic B2 report.

```
VALIDATOR_IS_DETERMINISTIC       = YES
VALIDATOR_PLACEMENT              = AFTER B2.2, BEFORE final render
FAIL_CLOSED                      = YES
```

---

## 1. INPUTS

```
worldviewOutput : the raw parsed JSON from the B2.2 model call
diagnosis       : frozen B1 output (authoritative)
b2Report        : deterministic B2 report (fallback + comparison base)
```

The validator compares `worldviewOutput` against `diagnosis` and `b2Report`.
It never trusts the model's own echo of diagnosis fields.

---

## 2. VALIDATION SEQUENCE

```
V-1  JSON shape
V-2  Card completeness (5 cards)
V-3  Frozen diagnosis integrity (no drift)
V-4  Unsupported user claim scan (fabrication)
V-5  Wealth / outcome promise scan
V-6  Ontology / internal-token leak scan
V-7  Generic worldview insertion scan
V-8  Buzzword stuffing scan
V-9  Card03 == exactly 5 steps
V-10 Card01 length cap
V-11 Forbidden reality-denial pattern scan
V-12 Expression-quality budget (low-value restatement)
```

Any HARD gate failure short-circuits to **REJECT**.

---

## 3. V-1 JSON SHAPE

Required top-level keys **exactly**:

```
reportVersion, cards
```

`reportVersion` must equal `"turnaround_strategy_v6_worldview_v1"`.

Required card keys **exactly**:

```
fatalInsight, coreProblem, systemLoop, turnaroundPath, firstAction
```

Per-card required fields:

```
fatalInsight      : title, text
coreProblem       : title, text
systemLoop        : title, steps[5]
turnaroundPath    : title, from, to, logic
firstAction       : title, action, checks[>=1]
```

```
EXTRA_TOP_LEVEL_KEYS_COUNT = 0        (hard)
EXTRA_CARD_KEYS_COUNT      = 0        (hard)
MISSING_REQUIRED_FIELD     = 0        (hard)
TITLE_MISMATCH_COUNT       = 0        (hard)  titles must be the frozen five
```

Frozen titles:

```
致命一句话 / 核心问题 / 系统困局 / 翻身路径 / 现在就做
```

If JSON parse fails → `JSON_PARSE_OK = NO` → REJECT.

---

## 4. V-2 CARD COMPLETENESS

```
CARD_COUNT = 5
```

Every card non-empty; `systemLoop.steps` has exactly 5 non-empty strings;
`firstAction.checks` ≥ 1.

```
CARD_COUNT                       = 5     (hard)
SYSTEM_LOOP_STEP_COUNT           = 5     (hard)
FIRST_ACTION_CHECK_COUNT         >= 1    (hard)
EMPTY_CARD_TEXT_COUNT            = 0     (hard)
```

---

## 5. V-3 FROZEN DIAGNOSIS INTEGRITY (NO DRIFT)

The B2.2 output must not carry any diagnosis field at all (§9 of prompt spec), and
the validator independently confirms the pipeline's frozen facts are untouched
(diagnosis identity is established by the pipeline, not the model). Compare the
pipeline-attached diagnosis against the pre-call diagnosis snapshot:

```
PRIMARY_BOTTLENECK_CHANGED   = NO    (hard)
EXECUTION_STAGE_CHANGED      = NO    (hard)
BELIEF_RELATION_CHANGED      = NO    (hard)
REALITY_CONSTRAINT_CHANGED   = NO    (hard)
NEXT_STAGE_CHANGED           = NO    (hard)
FIRST_ACTION_TYPE_CHANGED    = NO    (hard)
```

Additionally, scan the worldview text for **drift signals** — a card must not
contradict the frozen facts semantically:

```
NEW_BOTTLENECK_CLAIM_COUNT       = 0  (hard, semantic scan)
NEW_STAGE_CLAIM_COUNT            = 0  (hard, semantic scan)
NEW_BELIEF_RELATION_CLAIM_COUNT  = 0  (hard, semantic scan)
NEW_ACTION_TYPE_CLAIM_COUNT      = 0  (hard, semantic scan)
```

Semantic scan method: deterministic keyword/pattern rules against the frozen
`primaryBottleneck/stage/relation/actionType` allowed vocabulary. The frozen
action type stated in Card05 must match `FIRST_ACTION_TYPE` intent (see §5.1).

### 5.1 Action-preservation check (Card05)

Card05 must **preserve the B1 action type** and only make it more concrete.

```
CARD05_ACTION_TYPE_PRESERVED = YES   (hard)
```

Test: the action must remain consistent with the B2 `firstAction` intent under the
same `FIRST_ACTION_TYPE`. If the model substituted a different action category
(e.g. replaced a zero-cost experiment with "go learn more"), REJECT.

---

## 6. V-4 / V-5 / V-6 CONTENT SCANS

### 6.1 V-4 Unsupported user claim

Detect invented specifics not present in `DIRECT_USER_FACTS`:

- invented numbers (债务金额 / 收入 / 工作时长 / 金额)
- invented entities (家庭成员、公司名、具体职业经历)
- invented traits (人格 / 创伤 / 智力 / 动机)

```
UNSUPPORTED_USER_CLAIM_COUNT = 0    (hard)
```

Method: every numeric token and every proper-noun-like entity in the output must
be traceable to `DIRECT_USER_FACTS`. Any untraceable specific → REJECT.

### 6.2 V-5 Wealth / outcome promise

Forbidden promise vocabulary:

```
一定翻身 / 一定赚钱 / 成功率 / 财富概率 / 未来收入
保证 / 必然 / 百分之… / 稳赚 / 包你
```

```
WEALTH_PROMISE_COUNT = 0            (hard)
FUTURE_INCOME_CLAIM_COUNT = 0       (hard)
```

### 6.3 V-6 Ontology / internal-token leak

Reuse the B2 `FORBIDDEN_USER_TOKENS` list verbatim (source of truth:
`reportValidatorV6.js`). Additionally scan for the new B2.2 internal tokens:

```
ONTOLOGY_LEAK_COUNT = 0             (hard)
```

The scan runs over **all** user-visible text of every card.

---

## 7. V-7 / V-8 GENERIC WORLDVIEW STUFFING

### 7.1 V-7 Generic insertion

Reject generic filler unless directly connected to `PRIMARY_BOTTLENECK` /
`EXECUTION_STAGE`:

```
现在是AI时代 / 流量很重要 / 要使用杠杆 / 建立个人IP / 打造自己的系统
风口 / 时代变了 / 普通人逆袭 / 认知升级 / 底层逻辑
```

```
GENERIC_WORLDVIEW_INSERTION_COUNT = 0   (hard)
```

**Connection test (deterministic approximation):** a worldview keyword is
acceptable only if the same card also contains a token directly tied to the
frozen bottleneck/stage vocabulary or the user's own facts. Otherwise it is
generic filler.

### 7.2 V-8 Buzzword stuffing

Keyword-density guard: if worldview keywords appear **without** being load-bearing
for the diagnosis (keyword present but no diagnosis-link token in the same card),
each occurrence counts as stuffing.

```
BUZZWORD_STUFFING_COUNT = 0             (hard)
```

---

## 8. V-9 / V-10 / V-11 STRUCTURAL + SAFETY

### 8.1 V-9 Card03 loop shape

```
SYSTEM_LOOP_STEP_COUNT = 5              (hard)
CARD03_INTERNAL_CONTRADICTION_COUNT = 0 (hard)
CARD03_STEP_CAUSAL_CHAIN = YES          (hard; each step references/advances the prior)
```

### 8.2 V-10 Card01 length

```
CARD01_LEN <= 60                        (hard, from B2 validator)
CARD01_LEN <= 60 preferred target       (see B2 CARD01_MAX_CHARS)
```

### 8.3 V-11 Reality-denial pattern

```
REALITY_DENIAL_PATTERN_COUNT = 0        (hard)
REALITY_DENIAL_ALLOWED = NO             (default)
```

Forbidden shapes (unless independent contradicting evidence exists per contract
§9; if it exists, still require non-blaming phrasing):

```
✗ 你不是没时间，只是……
✗ 你不是缺资源，只是……
✗ 问题根本不在环境……
```

---

## 9. V-12 EXPRESSION-QUALITY BUDGET (SOFT)

Detect low-value cards that merely restate USER FACT or re-assert DIAGNOSIS FACT
with no LAYER-3 interpretation. This is a **soft** signal, used to compare B2.2
output vs the deterministic B2 draft:

```
LAYER3_INTERPRETATION_PRESENT       = YES   (soft target)
LOW_VALUE_RESTATEMENT_COUNT         (soft; report only)
```

If the B2.2 output scores **worse** than the B2 draft on this budget while adding
no LAYER-3 value, prefer the B2 draft (fallback).

---

## 10. REQUIRED HARD GATES (AGGREGATE)

```
PRIMARY_BOTTLENECK_CHANGED   = NO
EXECUTION_STAGE_CHANGED      = NO
BELIEF_RELATION_CHANGED      = NO
FIRST_ACTION_TYPE_CHANGED    = NO
UNSUPPORTED_USER_CLAIM_COUNT = 0
```

Plus the full hard set:

```
JSON_PARSE_OK                       = YES
CARD_COUNT                          = 5
SYSTEM_LOOP_STEP_COUNT              = 5
ONTOLOGY_LEAK_COUNT                 = 0
WEALTH_PROMISE_COUNT                = 0
GENERIC_WORLDVIEW_INSERTION_COUNT   = 0
BUZZWORD_STUFFING_COUNT             = 0
REALITY_DENIAL_PATTERN_COUNT        = 0
CARD01_LEN                          <= 60
```

If **any** hard gate fails:

```
VALIDATION_RESULT = REJECT
FALLBACK_USED     = YES   (deterministic B2 report)
```

---

## 11. FALLBACK CONTRACT

```
ON_REJECT:
    finalReport = b2Report            (turnaround_strategy_v6_report_v1)
    record WORLDVIEW_EXPRESSION_REJECTED = YES
    record REJECT_REASON_CODES = [...]
ON_PASS:
    finalReport = worldviewOutput
    record WORLDVIEW_EXPRESSION_ACCEPTED = YES
```

The product must remain fully functional with B2.2 rejected every time. B2.2 is an
enhancement layer, never a dependency.

```
B2_2_OPTIONAL                    = YES
PRODUCT_WORKS_WITHOUT_B2_2       = YES
```

---

## 12. VALIDATOR OUTPUT (FINDINGS OBJECT)

Design of the findings contract (deterministic, mirror of B2's `findings`):

```
{
  "valid": true|false,
  "result": "PASS"|"REJECT",
  "hardFailures": [ "PRIMARY_BOTTLENECK_CHANGED", ... ],
  "counters": {
    "unsupportedUserClaim": 0,
    "wealthPromise": 0,
    "ontologyLeak": 0,
    "genericWorldviewInsertion": 0,
    "buzzwordStuffing": 0,
    "realityDenial": 0,
    "card03InternalContradiction": 0,
    "jsonParseOk": true,
    "cardCount": 5,
    "systemLoopStepCount": 5,
    "card01Len": 0
  },
  "softSignals": {
    "lowValueRestatement": 0,
    "layer3InterpretationPresent": true
  },
  "reasonCodes": []
}
```

---

## 13. TESTABILITY (OFFLINE, DESIGN-LEVEL)

The validator is testable **without any model call**:

- Feed the **frozen B2 drafts** (re-shaped into the worldview output schema) → must PASS shape + drift gates (they are diagnosis-consistent), but may show low LAYER-3 value.
- Feed **hand-authored adversarial candidates** → must REJECT:

```
ADV-A  changes primary bottleneck         → PRIMARY_BOTTLENECK_CHANGED
ADV-B  invents debt amount                → UNSUPPORTED_USER_CLAIM_COUNT
ADV-C  promises 成功率                    → WEALTH_PROMISE_COUNT
ADV-D  leaks "ACTION_GAP"                 → ONTOLOGY_LEAK_COUNT
ADV-E  stuffs "现在是AI时代"              → GENERIC_WORLDVIEW_INSERTION_COUNT
ADV-F  Card03 with 4 steps                → SYSTEM_LOOP_STEP_COUNT
ADV-G  changes firstActionType intent     → FIRST_ACTION_TYPE_CHANGED
ADV-H  "你不是没时间，只是…"              → REALITY_DENIAL_PATTERN_COUNT
```

`SAFE_TO_START_OFFLINE_FIXTURE_TEST = YES` (design-level; no model call, no wiring).

---

## 14. SCOPE GUARD (this mission)

```
DESIGN_ONLY                 = YES
RUNTIME_CODE_ADDED          = NO
MODEL_CALL_ADDED            = NO
PRODUCTION_API_ADDED        = NO
generateAiReport/index.js   = UNTOUCHED
B1_DIAGNOSIS_CHANGE         = NO
UI_SEMANTIC_CHANGE          = NO
COMMIT / PUSH / DEPLOY      = NO
```

---

## 15. VERSION LEDGER

```
VALIDATOR_VERSION = turnaround_strategy_v6_worldview_validator_v1
TARGET_REPORT     = turnaround_strategy_v6_worldview_v1
TARGET_PROMPT     = turnaround_strategy_v6_worldview_prompt_v1
UPSTREAM_REPORT   = turnaround_strategy_v6_report_v1
UPSTREAM_CONTRACT = turnaround_strategy_v6_contract_v1
```
