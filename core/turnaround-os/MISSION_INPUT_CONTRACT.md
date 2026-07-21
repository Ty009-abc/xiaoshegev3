# MISSION_INPUT_CONTRACT.md

## Mission Engine 输入契约

**版本**: 6.0  
**状态**: FROZEN  
**生效**: CHECKPOINT_4 开始前

---

## 允许的输入

Mission Engine **仅允许**以下三种输入：

```js
missionEngine.generateMissionPlan({
  profile,       // identityEngineV6.buildIdentity() 的输出
  strategy,      // turnaroundEngineV6.generateStrategy() 的输出
  projection,    // destinyProjectionEngineV6.projectDestiny() 的输出
})
```

---

## 禁止的操作

Mission Engine **禁止调用**以下任何上游 Engine：

| ❌ 禁止 | 原因 |
|--------|------|
| `buildIdentity()` | 已在 profile 中 |
| `detectWrongGame()` | 已在 strategy.wrongGame 中 |
| `determineLeverage()` | 已在 strategy.primaryStrategy.primaryLeverage 中 |
| `generateStrategy()` | strategy 本身就是事实源 |
| `projectDestiny()` | projection 本身就是事实源 |

**原则**: Mission Engine 是消费者，不是生产者。它消费上游推导的结论，不重新推导。

---

## 从哪里读取什么

### 从 `profile` 读取

| 字段 | 用途 |
|------|------|
| `profile.wealthStage` | 阶段 → 任务预算、风险限制 |
| `profile.wealthStageLabel` | 阶段标签 |
| `profile.strategyReadinessScore` | 翻身准备度 → 任务密度 |
| `profile.reality.safetyMonths` | 安全月数 → 安全修复优先级 |
| `profile.reality.availableHoursPerWeek` | 可支配时间 → 时预算 |
| `profile.reality.monthlyIncome` | 收入 → 成本限制 |
| `profile.reality.debt` | 债务 → 风险限制 |
| `profile.capabilities.{*} ` | 各项能力 → 任务类型决策 |
| `profile.psychology.{*} ` | 心理指标 → 高焦虑 = 更多短反馈任务 |
| `profile.assets.{*} ` | 资产 → 资源基础 |
| `profile.constraints.{*} ` | 约束 → 压力缓解 |

### 从 `strategy` 读取

| 字段 | 用途 |
|------|------|
| `strategy.verdict.confidence` | Mission 置信度 |
| `strategy.verdict.headline` | 战略标题 → Mission 主题 |
| `strategy.verdict.coreJudgment` | 核心判断 |
| `strategy.verdict.biggestEnemy` | 最大敌人 → 任务对治 |
| `strategy.verdict.biggestOpportunity` | 最大机会 → 任务聚焦 |
| `strategy.verdict.limitingFactors` | 限制因素 → 任务排期约束 |
| `strategy.verdict.assumptions` | 假设 → Mission 前提 |
| `strategy.identitySummary.{*} ` | 身份摘要 |
| `strategy.wrongGame.gameType` | 错误游戏类型 → 任务主线 |
| `strategy.wrongGame.exitCondition` | 退出条件 → 战略目标 |
| `strategy.primaryStrategy.primaryLeverage` | 主杠杆 → 任务分类选择 |
| `strategy.primaryStrategy.strategicGoal` | 战略目标 → 任务目 align |
| `strategy.primaryStrategy.whatNotToDo` | 不应做的事 → 拒绝规则 |
| `strategy.primaryStrategy.successCondition` | 成功条件 → 验收标准 |
| `strategy.primaryStrategy.failureRisks` | 失败风险 → fallback 设计 |

### 从 `projection` 读取

| 字段 | 用途 |
|------|------|
| `projection.decisionNodes` | 决策节点 → 关键里程碑 |
| `projection.comparison.biggestGap` | 最大差距 → why 来源 |
| `projection.comparison.biggestOpportunity` | 最大机会 |
| `projection.comparison.biggestRisk` | 最大风险 |
| `projection.limitingFactors` | 限制因素 → 补充 strategy 的 |
| `projection.assumptions` | 推演假设 → Mission 依赖 |

---

## 事实链

```
Identity (buildIdentity)
    ↓
WrongGame (detectWrongGame)
    ↓
Leverage (determineLeverage)
    ↓
Strategy (generateStrategy)  ← 唯一事实源
    ↓
Projection (projectDestiny)
    ↓
Mission (consume only)       ← 本接口
    ↓
Coach (future)
    ↓
Adapter (future)
```

**所有下游模块不得重新推导上游结论。**
