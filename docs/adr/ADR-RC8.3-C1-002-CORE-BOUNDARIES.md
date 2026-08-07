# ADR-RC8.3-C1-002: Core Blind Spot Boundaries

**Status**: PENDING_HUMAN_REVIEW

**Date**: 2026-08-07

**Phase**: RC8.3 Phase 1C Sprint 1

**Parent**: ADR-001 World Principles

---

## Decision

为 4 个最高重叠的 Cognitive Blind Spot 建立完整认知边界定义。核心策略不是"What is it"，而是"What is it NOT"——通过明确的反证、排除条件、误判分析和推理模板，让每个边界独立可验证。

---

## Boundaries Defined

### 1. DECISION_INERTIA（决策惯性）

- **世界原则**: DECISION_CREATES_INFORMATION
- **核心问题**: 知道存在选择，但关键决策长期没有进入真实行动或实验
- **不是**: 行动后没有复盘（= FEEDBACK_LOOP_GAP）
- **不是**: 偏好短期收益（= TIME_HORIZON_TRAP）
- **不是**: 害怕风险损失（= RISK_MODEL_DISTORTION）

### 2. FEEDBACK_LOOP_GAP（反馈回路断裂）

- **世界原则**: FEEDBACK_UPDATES_MODELS
- **核心问题**: 在行动，但行动的结果没有稳定进入下一轮模型更新
- **不是**: 还没有开始行动（= DECISION_INERTIA）
- **不是**: 缺少系统思维工具（= SYSTEM_THINKING_GAP）
- **不是**: 不学习放大（= LEVERAGE_MODEL_GAP）

### 3. LEVERAGE_MODEL_GAP（杠杆模型缺失）

- **世界原则**: LEVERAGE_MULTIPLIES_VALUE
- **核心问题**: 价值交付结构高度依赖重复的个人投入，缺少可复制、可复用、可扩展的机制
- **不是**: 不愿意等待放大（= TIME_HORIZON_TRAP）
- **不是**: 看不到外部机会（= OPPORTUNITY_BLINDNESS）
- **不是**: 缺乏反馈学习（= FEEDBACK_LOOP_GAP）

### 4. TIME_HORIZON_TRAP（时间视野陷阱）

- **世界原则**: TIME_COMPOUNDS_ADVANTAGE
- **核心问题**: 决策窗口系统性过短，短期收益持续压过长期复利和选择空间
- **不是**: 不会放大价值（= LEVERAGE_MODEL_GAP）
- **不是**: 什么都不选（= DECISION_INERTIA）
- **不是**: 反馈回路缺失（= FEEDBACK_LOOP_GAP）

---

## Decision vs Feedback Distinction

**为什么容易混淆**: 两者都表现为"进展缓慢"。外观相似，机制不同。

**真正分界点**:
- DECISION_INERTIA: 不决策 → 不产生信息 → 模型不更新 → 没有进展
- FEEDBACK_LOOP_GAP: 有决策有行动 → 不反馈不学习 → 模型不更新 → 没有进展

**判 Decision Inertia**: 主要是等待、犹豫、计划但未执行 → 决策本身未发生

**判 Feedback Loop Gap**: 有持续行动证据，但行动后缺少复盘、学习和调整

**不能判任何一个**: 只有一两次行动，数据不足以判断是"没开始"还是"开始了但没学"

---

## Leverage vs Time Distinction

**为什么长期主义 ≠ 杠杆思维**: 长期主义描述时间偏好，杠杆描述价值结构。一个人可以长期专注一项线性工作——时间偏好正常但价值结构线性。

**时间跨度很长但不是 Leverage**: 如果是长期 + 线性交付 → LEVERAGE_GAP。等再久，线性不会变成非线性。

**已有 Leverage 但时间跨度短**: 如果每个短期项目中都有效率放大，但没有一个方向积累足够长 → TIME_HORIZON_TRAP。杠杆存在但不够等待。

**判 Leverage Gap**: 长期专注一件事但产出线性 — 在方法上缺少放大

**判 Time Horizon Trap**: 频繁切换方向，在任何方向上积累时间都不够 — 在时间上缺少耐心

---

## Reasoning Template Structure

每个边界都包含完整的 6 段推理模板：
1. **Observation** — 观察到的模式
2. **Explanation** — 因果机制解释
3. **Why not [最易混淆的 Blind Spot]** — 明确排除理由
4. **Why not [第二易混淆的]** — 补充排除
5. **Why not [第三易混淆的]** — 完整性
6. **Conclusion** — 结论 + 首要改善方向

---

## Self Review

### 1. 四个 Boundary 是否互斥？

是。每个边界有独立的核心问题、排除条件、和推理模板中的明确的"为什么不是你"段。互斥性通过 `necessaryConditions`（必须同时满足才能成立）和 `disqualifyingEvidence`（出现即排除）保证。

### 2. 是否存在循环定义？

否。每个边界引用独立的世界原则（非其他边界）。边界之间的"不是XX"是排除关系而非定义依赖。

### 3. 是否仍依赖职业？

否。审计扫描 0 次职业相关词汇。边界中使用的是"这个人"、"行动"、"决策"、"反馈"等认知描述词。

### 4. 是否仍依赖财富？

否。0 次"工资"、"收入"、"财富"。唯一接近的是可复用资产的"资产"——但在 World Principle 中明确定义为"工具、流程、内容、系统、网络"——认知资产而非金融资产。

### 5. 是否仍依赖商业？

否。0 次"AI"、"产品"、"流量"、"IP"（作为商业概念）、"转化率"。

### 6. 是否仍包含预测？

否。0 次"你一定会"、"你必然"、"你的命运"、"你会成功"、"你会失败"。

### 7. 是否违反开发总书？

否。这些边界描述的是心智模型如何运作、哪里可能出错——即"帮助普通人理解世界"——而不是告诉他们怎么赚钱。

---

## Files

| File | Status |
|------|--------|
| `engine/worldModel/blindSpotBoundaryDefinitions.js` | Rewritten (551 lines, 4 full boundaries) |
| `docs/adr/ADR-RC8.3-C1-002-CORE-BOUNDARIES.md` | Created (this file) |

## Runtime

| Check | Status |
|-------|--------|
| Runtime files changed | 0 |
| Feature flag changed | No |
| Cloud function modified | No |
| Prompt modified | No |
| Git staged | No |

---

## ADR_RC8_3_C1_002_COMPLETE

| Metric | Value |
|--------|-------|
| Boundaries defined | 4 |
| Decision vs Feedback distinction | Complete — mechanism-level distinction with clear decision rule |
| Leverage vs Time distinction | Complete — value-structure vs time-preference distinction with decision rule |
| Necessary conditions (per boundary) | 3 each, 12 total |
| Disqualifying evidence (per boundary) | 2 each, 8 total |
| Contradicting evidence (per boundary) | 3 each, 12 total |
| Ambiguity conditions (per boundary) | 2 each, 8 total |
| Missing evidence hints (per boundary) | 3 each, 12 total |
| Common misclassification (per boundary) | 2 each, 8 total |
| Reasoning templates | 4 (6-segment each) |
| Occupation references | 0 |
| Income references | 0 |
| Business references | 0 |
| Prediction violations | 0 |
| Runtime files changed | 0 |
| Git staged | No |
| Commit | No |
| **Result** | **PASS — awaiting human review** |
