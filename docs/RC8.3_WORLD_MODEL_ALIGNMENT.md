# RC8.3 World Model Alignment — Product Constitution

Version: v1.0
Status: PHASE_1_IN_PROGRESS
Last Updated: 2026-08-07

---

## 1. Mission

> 帮助普通人理解世界运行规则，升级自己的世界操作系统。

本产品是 **AI 认知操作系统**，不是财富建议工具。
财富是认知、决策与行为长期作用的结果，不是产品直接承诺的终点。

## 2. Product Identity

**一句话定位：** 一款帮助普通人理解世界运行规则的 AI 认知操作系统。

**帮助用户理解：**
- 理解世界
- 理解决策
- 理解财富
- 理解概率
- 理解人性

**核心因果链：**
```
世界模型 → 决策模型 → 行为模式 → 结果分布
```
财富只是结果变量之一。

## 3. What We Are Not

### 3.1 不是算命工具
禁止：运势、命中注定、一定发财、注定失败、确定性未来预测、神棍式人格判决

### 3.2 不是鸡汤工具
禁止：加油、坚持就会成功、相信自己、未来可期、你一定可以、无机制无证据的鼓励

### 3.3 不是副业推荐器或赚钱导航器
禁止把诊断直接简化成：做 AI、做副业、做短视频、做个人 IP、接外包、做产品、去创业

这些只能作为特定情景中的"实验载体"，不能成为认知诊断本身。

## 4. Core Value Proposition

1. **看见问题本质** — 从表面现象进入结构性原因
2. **发现认知漏洞** — 不只给答案，而是指出用户的世界模型哪里失真
3. **模拟决策后果** — 用情景推演呈现不同决策模式的可能后果，不做确定性预测

## 5. World Model Ontology

系统不再把职业、收入、技能类别直接当作诊断结论。这些字段只是 Evidence。

**八个核心维度：**

| Dimension | Focus |
|-----------|-------|
| DECISION_MODEL | How decisions are made |
| RISK_MODEL | How risk is perceived and managed |
| PROBABILITY_MODEL | How probability and uncertainty are understood |
| FEEDBACK_MODEL | How feedback is sought and processed |
| OPPORTUNITY_MODEL | How opportunities are recognized and evaluated |
| LEVERAGE_MODEL | How leverage is understood and deployed |
| IDENTITY_MODEL | How identity constrains or enables action |
| TIME_MODEL | How time is allocated and valued |

**Signal Contract per Dimension:**
- 至少两项支持证据，或一项强证据加一项上下文证据
- 不得仅凭单项回答下结论
- 职业不得直接触发人格
- 收入结构不得直接决定认知漏洞
- 技能类别不得直接决定策略
- 所有强结论必须允许反证

## 6. Evidence and Inference Rules

### 6.1 Signal Rules
- 信号必须可追溯到答案字段
- 强信号需要至少两个独立数据点
- 冲突信号必须记录并报告

### 6.2 Archetype Rules
- 原型描述思维与决策结构，不描述职业
- EMPLOYEE 不作为认知人格
- CREATOR 不仅由内容技能触发
- 禁止用职业标签直接映射人格
- 禁止用人格暗示命运或能力上限

### 6.3 Blind Spot Rules
- 只允许一个主要认知漏洞
- 商业现象（TRAFFIC/SELLING/PRODUCT/PRICING/SINGLE_INCOME/BUILD_IP）不作为 Blind Spot 本体
- 商业现象只作为外部表现或实验场景

### 6.4 Strategy Rules
- 策略解决认知系统，不直接推荐赚钱方向
- 产品/内容/销售/个人IP 只能作为 firstExperiment 的载体

### 6.5 Scenario Rules
- 不预测收入，不预测成功，不预测命运
- 必须使用双情景：CURRENT_MODEL_CONTINUES 和 WORLD_MODEL_UPGRADED
- 表达使用概率性语言，禁止确定性结论

## 7. Diagnosis Contract

### 7.1 World Model Output Object
```json
{
  "version": "world_model_v1",
  "behaviorSignals": [],
  "worldModel": { "decision": {}, "risk": {}, "probability": {}, "feedback": {}, "opportunity": {}, "leverage": {}, "identity": {}, "time": {} },
  "cognitiveArchetype": { "primary": {}, "secondary": {}, "scores": {}, "confidence": 0 },
  "cognitiveBlindSpot": { "id": "", "mechanism": "", "evidence": [], "counterEvidence": [], "confidence": 0, "uncertainty": "" },
  "worldStrategy": { "id": "", "mechanism": "", "firstExperiment": {}, "successSignal": "", "reviewWindow": "" },
  "scenarioSimulation": { "currentModelScenario": {}, "upgradedModelScenario": {} },
  "trace": { "evidenceIds": [], "rulesTriggered": [], "rulesSuppressed": [], "conflictResolution": [], "inputHash": "" }
}
```

## 8. Scenario Simulation Contract

### 8.1 双情景要求
- **A. CURRENT_MODEL_CONTINUES** — 如果继续保持当前认知模型
- **B. WORLD_MODEL_UPGRADED** — 如果升级某个认知维度

### 8.2 输出结构
```json
{
  "currentModelScenario": {
    "assumptions": [],
    "likelyDecisionPattern": [],
    "possibleConsequences": [],
    "uncertainty": []
  },
  "upgradedModelScenario": {
    "changedVariable": "",
    "likelyDecisionPattern": [],
    "possibleConsequences": [],
    "observableSignals": [],
    "uncertainty": []
  }
}
```

### 8.3 禁止表达
- "三年后一定……"
- "一定发财" / "必然失败"
- "成功率达到……"
- 精确收入承诺

## 9. Report Output Contract

未来报告必须依次回答：
1. **认知盲点** — 用户真正忽略了什么？
2. **世界规则** — 现实中的机制是什么？
3. **系统推演** — 当前模型持续会产生什么决策模式？
4. **认知升级** — 最值得升级的一个认知模块是什么？
5. **第一实验** — 今天如何用低成本行动验证新模型？
6. **新决策身份** — 升级后，用户会如何做不同的选择？

**保留旧版优点：** 直指问题本质、结构性洞察、系统困局、明确路径、可执行建议

**删除旧版风险：** 年龄恐吓、身体折旧羞辱、确定性未来结论、无依据收入预测、把职业当命运、过强攻击性表达

## 10. Validation Standard

### Phase 1 验收指标
| Metric | Target |
|--------|--------|
| 跨职业认知一致率 | ≥90% |
| 同职业差异识别率 | ≥85% |
| Evidence trace 覆盖率 | 100% |
| Blind Spot 唯一率 | 100% |
| Strategy 匹配率 | ≥95% |
| 确定性预测违规 | 0 |
| 玄学表达 | 0 |
| 鸡汤表达 | 0 |
| 商业方向作为主诊断 | 0 |

## 11. Runtime Freeze Boundary

**不得修改以下文件（只可添加独立 Adapter）：**
- `cloudfunctions/generateAiReport/index.js`
- `fallbackRouter.js`
- `contentSafetyGate.js`
- `ai.js`
- `reportUtils.js`
- `reportLimits.js`
- `runtimeArchitectureTrace`
- `diagnosticSnapshot`
- `provider routing`
- `parse repair`
- `Canvas poster layout`
- `report-detail.js` Runtime handoff

## 12. Migration Strategy

### Feature Flag
```
WORLD_MODEL_ENGINE_VERSION = "legacy_rc8" | "world_model_v1"
```

默认：`legacy_rc8`
仅测试与白名单：`world_model_v1`

### Adapter 策略
- 新增 `adaptWorldModelToLegacyDiagnosis()` 用于兼容现有 Runtime 和 Poster
- 旧 RC8 diagnosis 对象继续保留
- 不得让旧字段反过来覆盖新 World Model 结果

### 部署纪律
- 不得部署云函数
- 不得生成正式微信版本
- 不得合并 release
- 不得删除 legacy diagnosis
- 不得默认启用 world_model_v1

---

## 最高规则

**任何规则、Prompt、Fallback、模板、报告字段与本文件冲突时，以本文件为准。**
