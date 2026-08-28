# RC8.3 Stage 18-R2 — World OS Calibration & Contract Challenge

Status: OFFLINE CALIBRATION (DESIGN ONLY). 无 production/client/cloud/runtime 改动。
Base: docs/RC8.3_STAGE18_R1_WORLD_OS_QUESTIONNAIRE_CONTRACT.md
Harness: /tmp/wmtest/stage18r2_harness.js（离线，未接入 runtime，未入库）

---

## 核心结论

1. **阈值尺度不兼容**：R1 的 PROVISIONAL 阈值 0.08/0.25 是旧 ordinal-scoring（gap∈[0,1]连续）遗留。新 nominal 模型每 construct 失真分数只在 {0, 0.5, 1} 上取值，0.08/0.25 无意义。等价尺度为：**separation ∈ {0, 0.5}（需领先半档）**、**sufficiency ∈ {1, 2}（需 2 条独立证据）**。
2. **契约完整性缺陷（CONTRACT_DEFECT）**：18 个 evidence ID 每个其实捆绑 3–4 个不同潜隐命题（共 65 个 option-命题）。"18 atomic evidence" 并非真正 atomic；若聚合时把 nominal 值压成 binary「distorted=1」，会丢失 distortion type，导致 Card02（机制）与 follow-up（判别）无信息可用。契约须要求 signal 层**保留 distortion type**。
3. **FORCED_DEFICIT = 1**：机械直线作答（全选 A）被误诊为 LEVERAGE_MODEL_GAP。因 LEVERAGE 题的 A 选项恰为失真项。契约须增加「直线作答检测」（全同一字母 → LOW_INFORMATION，不诊断）。

---

## 实测校准结果（nominal 尺度，harness 离线跑出）

| 指标 | 值 |
|---|---|
| 9 positive fixtures | **9/9 ONE_PRIMARY 正确**（无 ID_OFFSET / priority / 顺序依赖） |
| near-neighbor 明显左/右 | 10/10 正确 |
| near-neighbor 真模糊 | 5/5 → FOLLOW_UP（FALSE_CERTAINTY=0） |
| contradictory | 3/3 → FOLLOW_UP（mixed=true） |
| insufficient | 3/3 不产 ONE_PRIMARY（MISSINGNESS_FALSE_DEFICIT=0，@suff=2） |
| gaming all-healthy / idealized | 2/3 → NO_PRIMARY_DEFICIT |
| gaming mechanical(全A) | **1/3 → 误诊 LEVERAGE（FORCED_DEFICIT=1）** |
| calibration / holdout | 15 / 15 |
| holdout semantic pass | **15/15** |

## 阈值扫描

| sep\suff | pos | falseCert | contra | missDef | forcedDef |
|---|---|---|---|---|---|
| 0 / 1 | 9/9 | 0 | 3/3 | 1/3 | 1/3 |
| 0 / 2 | 9/9 | 0 | 3/3 | 0/3 | 1/3 |
| 0.5 / 1 | 9/9 | 0 | 3/3 | 1/3 | 1/3 |
| **0.5 / 2** | **9/9** | **0** | **3/3** | **0/3** | **1/3** |

- `suff=2` 是消除 missingness 误诊的关键（`suff=1` 时 sparse 3 题被误判 ONE_PRIMARY）。
- `sep=0.5`（需领先半档）消除 tie 语义（`sep=0` 允许 tie 当 primary）。
- 两个阈值在 fixtures 上均无法把 `forcedDef` 降到 0——那是**直线作答检测**的职责，不是阈值职责。

## 选定阈值（nominal 等价尺度）

| 阈值 | 值 | 状态 |
|---|---|---|
| PRIMARY_SEPARATION | **0.5**（primary 至少领先第二半档） | PROVISIONAL_CALIBRATED |
| PRIMARY_SUFFICIENCY | **2**（primary 需 2 条独立证据） | PROVISIONAL_CALIBRATED |

## 需追加的契约修正（3 项，未实施）

1. **Straight-line detection**：全同一 option 字母 → LOW_INFORMATION，不诊断（修 FORCED_DEFICIT=1）。
2. **Signal 保留 distortion type**：signal = distortion-type profile，非 numeric score（修 atomicity 缺陷，供 Card02/follow-up）。
3. **Evidence atomic 重定义**：原子命题 = (questionId, optionId) 共 65 个，18 evidence ID 是「命题族」聚合层，非 atomic。

---

## 校准后判定

| 项 | 值 |
|---|---|
| THRESHOLD_STATUS | PROVISIONAL_CALIBRATED（仅 synthetic） |
| SHADOW_CALIBRATION_REQUIRED | **YES**（真实 shadow 数据回灌，阈值才可 FREEZE） |
| FORCED_DEFICIT_COUNT | **1**（直线作答，需契约修正） |
| READY_FOR_IMPLEMENTATION | **NO** |

> 本阶段未使用旧 shadow answer 直接当新题答案（题目语义已变），故 **NEW_18Q_REAL_VALIDATED = NO**。真实用户从未回答过新 18 题。
