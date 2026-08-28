# RC8.3 Stage 18-R3B — Response Validity Deterministic Contract

Status: CONTRACT ADDENDUM (DESIGN ONLY). 未改 production/client/cloud function，未 deploy，未切 MODE。
Date: 2026-08-28
Base: docs/RC8.3_STAGE18_R3_WORLD_OS_CONTRACT_REPAIR.md §B（Response Validity Layer）
Authority priority: **R3B > R3A > R3 > R2 > R1**（本文件仅覆盖 response-validity 的确定性实现契约）

---

## 1. 缺口

R3 §B 定义了 signal 名称与「结构化机械模式」清单，但**未冻结**以下实现必需信息，两个工程师会实现出不同结果：

1. `SAME_POSITION_RATE` / `ANSWER_ENTROPY` / `SEMANTIC_CONTRADICTION_RATE` 的精确公式。
2. `alternating` / `sequential` 的精确周期判定。
3. 检测对象是「展示位置（shuffle 后）」还是「语义 optionId 字母」。
4. signal → verdict 的确定性映射。

本 addendum 冻结这些，使 response-validity 层可被确定性、无歧义实现。

## 2. 输入定义

设用户作答的题目集为 `Q`（n = |Q|，即作答且 optionId 合法的题数）。

- **位置值** `pos(q)`：当 §C 的 display-order randomization 已实现时，为「选中选项在展示顺序中的位置索引（1-based）转字母 A/B/C/D」；**在 randomization 尚未实现的 shadow 首版中**，为「语义 optionId 字母」。
- 两个实现阶段都使用**同一套判定算法**，仅 `pos(q)` 的取值来源不同。契约保证：shuffle 改变的是 `pos(q)` 取值，不改判定规则；inference 只读语义 optionId。

设位置字母序列 `L = [pos(q) for q in Q]`（长度 n）。

## 3. Signal 公式（deterministic）

设 `freq(letter)` 为 L 中各字母出现次数。

| Signal | 公式 | 值域 |
|---|---|---|
| `SAME_POSITION_RATE` | `max(freq) / n` | [0.25, 1.0] |
| `ANSWER_ENTROPY` | `-Σ_i (freq_i/n)·log2(freq_i/n)`（Shannon，base 2） | [0, log2(k)]，k=distinct letters |
| `SEMANTIC_CONTRADICTION_RATE` | `#(constructs with ≥1 H evidence AND ≥1 D evidence) / #(constructs with ≥1 evidence)` | [0, 1] |

（H/D evidence 定义见 R3 §D/E 的 atomic evidence ontology。）

## 4. Mechanical Pattern 判定（deterministic）

`SEQ = ['A','B','C','D']`；`distinct(L)` = L 中不同字母集合。

| pattern | 精确判定 |
|---|---|
| `all_same` | n ≥ 1 AND ∀i: L[i] == L[0]（⟺ SAME_POSITION_RATE==1.0 AND ANSWER_ENTROPY==0） |
| `alternating` | n ≥ 4 AND \|distinct(L)\| == 2 AND ∀i: L[i] == L[i % 2] |
| `sequential` | n ≥ 4 AND ∀i: L[i] == SEQ[i % 4] |

## 5. Verdict 映射（deterministic decision tree）

```
1. n == 0             → INSUFFICIENT_RESPONSE_QUALITY
2. 1 ≤ n < 4          → INSUFFICIENT_RESPONSE_QUALITY
3. all_same
   OR alternating
   OR sequential      → RESPONSE_QUALITY_LOW
4. 其余               → RESPONSE_VALID
```

`RESPONSE_QUALITY_LOW` / `INSUFFICIENT_RESPONSE_QUALITY` → `NO_PRIMARY` + `RETAKE_RECOMMENDED`（沿用 R3 §B），**绝不产出 primaryBlindSpot**。

## 6. 硬约束（必须遵守）

1. **single pattern != invalid**：任何单个 signal 不单独判「无效」。`RESPONSE_QUALITY_LOW` 只由「结构化机械模式」触发，而每个机械模式都是 `SAME_POSITION_RATE` 与 `ANSWER_ENTROPY` 的**联合**条件（例如 `all_same ⟺ SAME_POSITION_RATE==1.0 AND ENTROPY==0`）。**不得**定义 `ALL_A = invalid` 或 `entropy < X = invalid` 这类单信号规则。
2. **response validity != cognition**：`responseValidity` 永不映射到任何 cognition dimension；`LOW_RESPONSE_QUALITY` ≠ LEVERAGE/RISK/任何认知 deficit。
3. **deferred signals 非 gating**：`COMPLETION_TIME_ANOMALY`、`DUPLICATE_SCENARIO_INCONSISTENCY` 是 real-runtime 信号，实现期接入；在 shadow 阶段**不得**单独触发 LOW（未经校准），只作为 review 备注。
4. **语义等价性**：`SAME_POSITION_RATE` 与 `ANSWER_ENTROPY` 均为位置字母的函数，不依赖选项文案/语义，故 shuffle 不改变判定结果（只改变 `pos(q)` 来源）。

## 7. 与 R3 §B 的一致性

- R3 §B 的 3 层判定（RESPONSE_VALID / RESPONSE_QUALITY_LOW / INSUFFICIENT_RESPONSE_QUALITY）**不变**。
- R3 §B 的「all-same / alternating / sequential / n<4 / n==0」清单**不变**（本 addendum 将其精确化，非改写）。
- R3 §B 的 `LOW_RESPONSE_QUALITY ≠ cognition` 与 `NO_PRIMARY + RETAKE_RECOMMENDED` **不变**。

**STOP。** 未改 production/client/cloud function，未 deploy，未切 MODE，未改 DB。
