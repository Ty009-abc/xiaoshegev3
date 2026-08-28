# RC8.3 Stage 18-R3A — Follow-up Limit Addendum

Status: CONTRACT ADDENDUM (DESIGN ONLY). 未改 production/client/cloud function，未 deploy，未切 MODE。
Date: 2026-08-28
Base: docs/RC8.3_STAGE18_R1_WORLD_OS_QUESTIONNAIRE_CONTRACT.md §H（follow-up bank + 触发条件）
Authority priority: **R3B > R3A > R3 > R2 > R1**（本文件仅覆盖 MAX_FOLLOWUP_COUNT 一个明确范围）

---

## 1. 缺口

R1 §H 冻结了 follow-up 的 **触发条件** 与 **判别追问 bank**（5 对 near-neighbor，每对 1 道判别追问），但 **未冻结追问次数上限**（MAX_FOLLOWUP_COUNT）。Stage19 要求该值按 frozen contract 执行，故本 addendum 冻结它，不修改任何其他 contract。

## 2. Frozen Value

```
MAX_FOLLOWUP_COUNT = 1
```

**语义**：一次完整的追问轮（single follow-up round），terminal。追问轮结束后必须终止，不得循环追问。

**每轮内问题数**：

```
MAX_FOLLOWUP_QUESTIONS_PER_ROUND = 2
```

- 一轮内最多问 2 道判别追问。
- 依据：R1 §B 每个 construct 的 `nearNeighborConstructs[]` 至多含 2 个邻近 construct（IDENTITY/OPPORTUNITY 为 1 个，其余为 2 个），故一个 primary 候选至多与 2 个 near-neighbor 存在歧义，至多需要 2 道判别追问（每道来自 §H bank 的对应 pair）。

## 3. Follow-up 终止决策（单轮后）

```
follow-up round
  ↓
resolved（判别证据可区分）        → ONE_PRIMARY
not resolved（仍不可区分/证据仍不足） → INSUFFICIENT_EVIDENCE
```

- **禁止**：第二轮追问、追问循环、hash/priority/default 兜底猜 primary。
- 判别追问**只增加 evidence**，绝不直接指定 blindSpot（沿用 R1 §H）。

## 4. Rationale（为什么是 1）

1. **用户负担**：18 题 + 至多 2 道追问已是可接受上限；无限制追问退化为二次问卷，违背「最小充分问卷」原则。
2. **单主题承诺**：一轮追问足以打破「证据充分但两候选邻近不可分」的歧义；若一轮后仍不可分，说明**信息量本身不足**（而非「再问一轮就能好」），诚实输出 INSUFFICIENT_EVIDENCE 而非硬猜。
3. **false uncertainty 优于 false certainty**（沿用 R3 §G）：追问未决 → INSUFFICIENT_EVIDENCE，是保守且正确的降级。
4. **可终止性**：MAX_FOLLOWUP_COUNT=1 保证 pipeline 严格有界，杜绝无界交互。

## 5. 与现有 contract 的一致性

- R1 §H 的 4 个触发条件（EVIDENCE_INSUFFICIENT / PRIMARY_SEPARATION / EVIDENCE_CONTRADICTORY / NEAR_NEIGHBOR_AMBIGUITY）**不变**。
- R1 §H 的 5 题判别追问 bank **不变**。
- R3 §G 的 3 分支 single-primary（ONE_PRIMARY / FOLLOW_UP / INSUFFICIENT_EVIDENCE）**不变**。
- 本 addendum 仅新增「追问轮次上限」这一个冻结值。

**STOP。** 未改 production/client/cloud function，未 deploy，未切 MODE，未改 DB。
