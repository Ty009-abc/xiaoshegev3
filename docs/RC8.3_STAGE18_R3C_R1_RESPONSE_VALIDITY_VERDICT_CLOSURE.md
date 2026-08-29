# RC8.3 Stage 18-R3C-R1 — Response Validity Verdict Closure

- **Status:** CONTRACT ADDENDUM（DESIGN ONLY — 不修改 runtime、不修改 engine code、不修改 B2 实现、不 push、不 deploy）
- **Type:** CONTRACT REPAIR ONLY
- **Date:** 2026-08-29
- **Base:** `docs/RC8.3_STAGE18_R3B_RESPONSE_VALIDITY_ADDENDUM.md` + `docs/RC8.3_STAGE18_R3C_DISPLAY_POSITION_SOURCE_ADDENDUM.md`
- **Canonical SHA:** `42efe3b28282562a6aedda983a9b332692c40e02`（已验证，工作区 HEAD 即此）
- **Authority priority after publication:** `R3C-R1 > R3C > R3B > R3`

---

## 0. Objective

关闭 R3B → R3C 演进引入的 response-validity **verdict 缺口**：

1. **R3B** 假设 position signals 总是可观测——因为它为「randomization 尚未实现」保留了 semantic-optionId fallback。
2. **R3C** 废止该 fallback，`displayPosition` 成为**唯一** position source。
3. **但 R3C 未冻结** `displayPosition` 缺失/非法时的**整体 verdict**（R3C §4/§6 只说「signals = UNKNOWN」）。

由此产生一个对抗性绕过：

```
18 题 all-same 合法 position → RESPONSE_QUALITY_LOW
同一组答案，删除 position metadata → signals=UNKNOWN → 落入 R3B 决策树「其余」→ RESPONSE_VALID
```

即：**删除 metadata 反而把 LOW 提升为 VALID。** 本 addendum 以窄规范闭合此缺口。

---

## 1. New Authority

创建本 additive 合同（**不改写** R3B/R3C 原文）：

```
docs/RC8.3_STAGE18_R3C_R1_RESPONSE_VALIDITY_VERDICT_CLOSURE.md
```

```
R3C-R1 > R3C > R3B > R3
```

---

## 2. Preserve Existing Semantics（不改动）

以下全部**保持冻结不变**：

| 项 | 冻结值 |
|---|---|
| position source | `displayPosition` only（R3C §2） |
| valid position domain | `0 \| 1 \| 2 \| 3`（0-based，R3C §5） |
| `optionId` | cognition ONLY |
| `displayPosition` | response-validity ONLY |
| semantic-optionId fallback | 无（R3C §4 已废止） |
| `SAME_POSITION_RATE` | `max(freq)/n`（R3B §3，不变） |
| `ANSWER_ENTROPY` | Shannon base-2（R3B §3，不变） |
| `all_same` | `n≥1 AND ∀i L[i]==L[0]`（R3B §4，不变） |
| `alternating` | `n≥4 AND \|distinct(L)\|==2 AND ∀i L[i]==L[i%2]`（R3B §4，不变） |
| `sequential` | `n≥4 AND ∀i L[i]==SEQ[i%4]`（R3B §4，不变） |

**本 addendum 不改变任何公式、不改变 position source、不改变判定算法**，只冻结「输入结构不可用时的整体 verdict」。

---

## 3. Observability Principle — FROZEN

```
UNKNOWN_POSITION_SIGNAL  !=  RESPONSE_QUALITY_LOW
UNKNOWN_POSITION_SIGNAL  !=  RESPONSE_VALID
```

一个 response 只有在「冻结的 response-validity 公式所要求的**结构性 metadata** 充分可观测」时，才**允许**被声明为 `RESPONSE_VALID`。

**`RESPONSE_VALID_REQUIRES_SUFFICIENT_OBSERVABILITY = YES`**

「UNKNOWN」意味着**无法判断**，因此它既不能降级为 LOW（机械作答），也不能升级为 VALID（真实作答）——它必须落回「证据不足以评估质量」的终态。

---

## 4. Missing displayPosition — FROZEN

对一个**本已足够大**（用于 response-validity 评估）的 response 集：

> 若任一 submitted base response **缺失** `displayPosition`，position-derived validity signals 按 R3C 为 **UNKNOWN**，且**整体 verdict 必须是 `INSUFFICIENT_RESPONSE_QUALITY`**。

**不得**为：

- `RESPONSE_VALID`
- `RESPONSE_QUALITY_LOW`

理由：metadata 不足以区分「真实多样作答」与「机械作答」。

**`MISSING_DISPLAY_POSITION_VERDICT = INSUFFICIENT_RESPONSE_QUALITY`**

---

## 5. Invalid displayPosition — FROZEN

若 `displayPosition` 存在但 `∉ {0,1,2,3}`：

> 其必需 structural metadata 视为**不可用**，整体 verdict = `INSUFFICIENT_RESPONSE_QUALITY`。

**`INVALID_DISPLAY_POSITION_VERDICT = INSUFFICIENT_RESPONSE_QUALITY`**

无 coercion、无 modulo 归一、无 optionId fallback。

---

## 6. Partial Position Observability — FROZEN

对当前 18 题 base 问卷：response-validity position 分析要求**每个进入 cognition submission 的 base response** 都有合法 `displayPosition`。

因此**任何**缺失/非法 required position：

```
→ INSUFFICIENT_RESPONSE_QUALITY
```

示例：`17 valid + 1 missing` → IRQ；`17 valid + 1 invalid` → IRQ。

**`PARTIAL_POSITION_OBSERVABILITY_POLICY = FAIL_CLOSED_TO_INSUFFICIENT_RESPONSE_QUALITY`**

这是 response-quality sufficiency，**不是 cognitive deficit**（见 §12）。

---

## 7. n == 0 / Sparse — 保留 R3B

```
n == 0        → INSUFFICIENT_RESPONSE_QUALITY
1 ≤ n < 4     → INSUFFICIENT_RESPONSE_QUALITY
```

本 repair **不改变**阈值。

---

## 8. Duplicate questionId — FROZEN

明确区分：

```
duplicate questionId submission  !=  DUPLICATE_SCENARIO_INCONSISTENCY
```

- 前者 = **malformed observational structure**（一次提交中同一题出现多次，破坏「一题一观测」不变量）。
- 后者 = 同一场景不同题目的答案语义不一致（R3B §6.3 deferred signal）。

冻结：

> 单次 base cognition submission 内，每个 `questionId` **最多贡献一个 response observation**。若出现 duplicate questionId → `INSUFFICIENT_RESPONSE_QUALITY`。

理由：系统无法在不发明 precedence、不挑选某个答案的前提下，为该题建立唯一观测单元。

**禁止**：take first、take last、静默去重、排序重复项、把 duplicate 解读为认知证据。

**`DUPLICATE_QUESTION_ID_VERDICT = INSUFFICIENT_RESPONSE_QUALITY`**

**`DUPLICATE_QUESTION_IS_COGNITIVE_SIGNAL = NO`**

---

## 9. Single-Suspicious-Signal Rule — 范围澄清

R3B §6.1 的「a single suspicious pattern alone != invalid」**仅适用于** R3B 冻结的 response-quality **行为模式 signals**（即 `SAME_POSITION_RATE` 与 `ANSWER_ENTROPY` 的联合机械模式判定）。

它**不 override 结构性充分性失败**。具体地，它**不得**把以下任何一项转成 `RESPONSE_VALID`：

- missing required `displayPosition`
- invalid `displayPosition`
- duplicate `questionId`
- `n == 0`
- `n < minimum`

**`SINGLE_SIGNAL_RULE_DOES_NOT_OVERRIDE_STRUCTURE = YES`**

---

## 10. Three-Status Set Remains Closed — FROZEN

**不引入** `REVIEW_REQUIRED` / `POSITION_METADATA_UNAVAILABLE` / `INVALID_RESPONSE`。

冻结状态集**恰好**为：

```
RESPONSE_VALID
RESPONSE_QUALITY_LOW
INSUFFICIENT_RESPONSE_QUALITY
```

**`VALIDITY_STATUS_COUNT = 3`**

---

## 11. Verdict Decision Tree — FROZEN（确定性 precedence）

```
STEP 1 — STRUCTURAL SUFFICIENCY（最高优先，先于一切行为模式检测）

if  n == 0
    OR n < 4
    OR duplicate questionId present
    OR any submitted base response lacks displayPosition
    OR any submitted base response has displayPosition ∉ {0,1,2,3}

→ INSUFFICIENT_RESPONSE_QUALITY


STEP 2 — POSITION QUALITY（仅当 STEP 1 通过，即结构充分可观测）

if  all_same
    OR alternating
    OR sequential

→ RESPONSE_QUALITY_LOW


STEP 3 — 其余

→ RESPONSE_VALID
```

此 precedence **必须**防止「删除 metadata 把 LOW 变成 VALID」——missing/invalid position 在 STEP 1 即被拦截为 IRQ，绝不落到 STEP 3。

**`POSITION_METADATA_REMOVAL_BYPASS_PATHS = 0`**

---

## 12. Cognition Boundary — FROZEN

再次冻结：

```
INSUFFICIENT_RESPONSE_QUALITY 不表示：
  blindspot / deficit / distortion / dimension weakness / primary
```

response-validity verdict **只** gate「是否允许 cognition 运行」。

**`INSUFFICIENT_TO_COGNITIVE_DEFICIT_PATHS = 0`**

**`LOW_TO_COGNITIVE_DEFICIT_PATHS = 0`**

---

## 13. Deferred Signals — 保留

以下**保持 deferred**（不 gating），直到其 required observations 存在且后续合同冻结其语义：

- `SEMANTIC_CONTRADICTION_RATE`
- `COMPLETION_TIME_ANOMALY`
- `DUPLICATE_SCENARIO_INCONSISTENCY`

---

## 14. Adversarial Truth Table — FROZEN

| # | 场景 | verdict |
|---|---|---|
| A | 18 valid positions, all same | `RESPONSE_QUALITY_LOW` |
| B | 同答案，positions 全 missing | `INSUFFICIENT_RESPONSE_QUALITY` |
| C | 同答案，positions 全 invalid | `INSUFFICIENT_RESPONSE_QUALITY` |
| D | 17 valid + 1 missing | `INSUFFICIENT_RESPONSE_QUALITY` |
| E | 17 valid + 1 invalid | `INSUFFICIENT_RESPONSE_QUALITY` |
| F | 18 结构合法、多样 position | `RESPONSE_VALID` |
| G | duplicate questionId | `INSUFFICIENT_RESPONSE_QUALITY` |
| H | n == 0 | `INSUFFICIENT_RESPONSE_QUALITY` |
| I | 1 ≤ n < 4 | `INSUFFICIENT_RESPONSE_QUALITY` |
| J | 机械模式 + 结构合法 | `RESPONSE_QUALITY_LOW` |

**关键对抗验证**：A 与 B/C 是同一组答案的不同 metadata 呈现——A → LOW，B/C → IRQ，**均非 VALID**。删除 metadata 无法把 LOW 提升为 VALID（`POSITION_METADATA_REMOVAL_BYPASS_PATHS = 0`）。

---

## 15. Contract Consistency Audit — FROZEN

本 addendum 对既有合同零冲突：

| 审计项 | 结论 |
|---|---|
| R3B 公式（§3/§4） | 未改（STEP 2 沿用原判定） |
| R3C position source（§2/§3/§4/§5） | 未改（仍 displayPosition only） |
| R3D cognition 语义 | 未改（verdict 不进入 dimension/state/orientation） |
| A5/A5B primary 语义 | 未改（IRQ/LOW → NO_PRIMARY，不产出 blindspot） |

**`R3B_FORMULA_CONFLICTS = 0`**
**`R3C_SOURCE_CONFLICTS = 0`**
**`COGNITION_SEMANTIC_CONFLICTS = 0`**

---

## 16. Implementation Impact（对 unpublished df686525 的纠正方向，**本任务不实现**）

预期的后续纠正（未发布实现若存在以下偏差，需改正为）：

| 现有（缺陷） | 纠正为 |
|---|---|
| missing position → `RESPONSE_VALID` | `INSUFFICIENT_RESPONSE_QUALITY` |
| invalid position → `RESPONSE_VALID` | `INSUFFICIENT_RESPONSE_QUALITY` |
| duplicate questionId → quality-note-only / 可能 VALID | `INSUFFICIENT_RESPONSE_QUALITY` |

并**保持**：全部公式、position source、deferred signals、cognition isolation。

---

## 17. Acceptance

```
R3C_R1_VERDICT_CLOSURE_FROZEN                       = YES

RESPONSE_VALID_REQUIRES_SUFFICIENT_OBSERVABILITY    = YES

MISSING_DISPLAY_POSITION_VERDICT                    = INSUFFICIENT_RESPONSE_QUALITY
INVALID_DISPLAY_POSITION_VERDICT                    = INSUFFICIENT_RESPONSE_QUALITY
PARTIAL_POSITION_OBSERVABILITY_POLICY               = FAIL_CLOSED_TO_INSUFFICIENT_RESPONSE_QUALITY
DUPLICATE_QUESTION_ID_VERDICT                       = INSUFFICIENT_RESPONSE_QUALITY
DUPLICATE_QUESTION_IS_COGNITIVE_SIGNAL              = NO
SINGLE_SIGNAL_RULE_DOES_NOT_OVERRIDE_STRUCTURE      = YES
VALIDITY_STATUS_COUNT                               = 3
POSITION_METADATA_REMOVAL_BYPASS_PATHS              = 0

R3B_FORMULA_CONFLICTS                               = 0
R3C_SOURCE_CONFLICTS                                = 0
COGNITION_SEMANTIC_CONFLICTS                        = 0

CONTRACT_AMBIGUITIES_REMAINING                      = NONE（R3C-R1 范围内）

READY_FOR_R3C_R1_PUBLICATION                        = YES
READY_FOR_B2_CORRECTIVE_IMPLEMENTATION              = YES

RESULT = R3C_R1_RESPONSE_VALIDITY_VERDICT_CLOSURE_FROZEN
```

**STOP。** 未修改 runtime，未修改 engine code，未修改 B2 实现，未 push，未 deploy。
