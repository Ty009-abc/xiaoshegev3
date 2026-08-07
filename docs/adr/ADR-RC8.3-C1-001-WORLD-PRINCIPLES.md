# ADR-RC8.3-C1-001: World Principles

**Status**: PENDING_HUMAN_REVIEW

**Date**: 2026-08-07

**Phase**: RC8.3 C1 Architecture

---

## Decision

定义 9 条世界运行规律作为所有 Cognitive Blind Spot 的认知基础。每条原则独立于职业、收入、商业语境而成立。

---

## Principles Defined

### 1. DECISION_CREATES_INFORMATION（决策产生信息）

行动不是"执行问题"，而是"获得新信息的方式"。每一个决策与世界交互，都会生成决策前不存在的新信息。未决策的选项产生零信息。延迟决策延迟信息的到达。

### 2. FEEDBACK_UPDATES_MODELS（反馈更新模型）

未经系统反馈采集的行动不会更新内部模型。反馈只有在被观察、记录、处理之后才成为信息。行动但不复盘的人，等于在生成从未被使用的原始数据。

### 3. PROBABILITY_GOVERNS_OUTCOMES（概率支配结果）

复杂系统中的多数结果由概率分布支配，而非二元确定。以"会成功/会失败"进行思考是模型错误——世界以区间运作，而非点估计。

### 4. RISK_IS_ASYMMETRICAL（风险是不对称的）

每个决策都有不对称的回报结构——下行与上行很少对等。将所有风险视为对称危险，会导致过度谨慎（错过不对称上行）和鲁莽（忽视灾难性下行）。

### 5. LEVERAGE_MULTIPLIES_VALUE（杠杆倍增价值）

以一对一比例交付的价值（一单位输入→一单位输出）无法超越个人的时间和精力。杠杆是任何将产出与个人输入解耦的机制。

### 6. TIME_COMPOUNDS_ADVANTAGE（时间复利优势）

价值复利的活动——知识、关系、声誉、系统、资产——会产生非线性结果。长期小额持续投入能产生短期优化无法匹敌的结果。

### 7. IDENTITY_CONSTRAINS_CHOICES（身份约束选择）

一个人对"自己是谁"的认知会过滤其认为可用的选项。刚性、角色绑定的身份会滤除与自我概念不匹配的选项，即便这些选项客观上可用。

### 8. OPPORTUNITY_EMERGES_THROUGH_EXPOSURE（机会通过暴露涌现）

机会并非对所有观察者同样可见。当一个人的接触面——与不同人、思想、环境、问题的交互——与其模式识别能力交汇时，机会才会涌现。

### 9. SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR（系统产生涌现行为）

复杂系统——经济、组织、社会网络——会产生无法通过孤立分析单个组件来预测的结果。线性因果思维无法建模这些系统。

---

## Architecture Decision Rationale

### 为什么是 9 条而非 8 条？

ADR-001 要求 8 类原则，但 SYSTEM_THINKING_GAP 是已有 Blind Spot，没有对应的世界原则会导致该 Blind Spot 无法在架构中落地。因此单独为 SYSTEMS 新增第 9 条原则。

### 为什么每条原则包含 falsifiable？

为了让每条原则可证伪——如果出现反例，就能识别出是哪个模型环节出了问题。这支持未来 Scenario Simulation：模型可以在"如果 X 原则不成立会怎样"的前提下运行模拟。

### 为什么禁止业务语义？

World Model 描述的是"人的世界模型如何运作"——这是一组认知规律。职业、收入、商业方向属于 Diagnosis Adapter 层，不应污染 ontology。

---

## Acceptance Answers

### 1. 8条世界规律是否脱离职业仍成立？

是。每一条描述的是认知机制，而非职业行为。决策延迟、反馈缺失、概率误判、风险感受偏差——这些在任何职业中都会出现。

### 2. 是否脱离财富仍成立？

是。时间复利、杠杆倍增、机会暴露——这些规律在知识、关系、技能领域同样成立，不限于财富。

### 3. 是否可以解释行为，而非评价人格？

是。每条原则用 `mechanism` 和 `consequence` 描述因果链条，不做人格判断。

### 4. 是否支持未来 Scenario Simulation？

是。每条原则的 `mechanism` 和 `falsifiable` 可为模拟引擎提供"假设该原则未被遵循时世界会如何演化"的逻辑。

### 5. 是否存在确定性预测？

否。0 条"你一定会/你必然/你的命运"等表述。

### 6. 是否存在鸡汤、玄学或商业建议？

否。0 条"要相信自己/你能行/心态决定一切"。

---

## Files

| File | Status |
|------|--------|
| `engine/worldModel/worldPrinciples.js` | Created (277 lines, 9 principles) |
| `docs/adr/ADR-RC8.3-C1-001-WORLD-PRINCIPLES.md` | Created (this file) |

## Runtime

| Check | Status |
|-------|--------|
| Runtime files changed | 0 |
| Feature flag changed | No |
| Git staged | No |

---

## ADR_RC8_3_C1_001_COMPLETE

| Metric | Value |
|--------|-------|
| World principles | 9 |
| Business semantics violations | 0 |
| Occupation references | 0 |
| Prediction violations | 0 |
| Mission alignment | Full — describes how the world works, not what to do |
| Files created | 2 (worldPrinciples.js + ADR doc) |
| Runtime files changed | 0 |
| Git staged | No |
| Commit | No |
| **Result** | **PASS — awaiting human review** |
