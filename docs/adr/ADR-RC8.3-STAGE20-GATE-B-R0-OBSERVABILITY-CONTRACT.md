# ADR — RC8.3 Stage20 Gate-B R0：观测性合同（Observability Contract）

- 状态：FROZEN（合同/设计，未实现、未部署、未改语义）
- 权威序：Gate-B R0 > R6-R0 > R6-R3
- 日期：2026-08-30
- 类型：OBSERVABILITY CONTRACT（Gate-B 采集前的隐私安全观测性最小合同）

## 0. 前置事实

| 项 | 值 |
|---|---|
| Canonical SHA | `e9c099f95c7212fe3171f22369b2c19a78f0d2a4` |
| 当前状态 | ENGINEERING_GATE_A=PASS、SEMANTIC_GATE_A=PASS、Gate-A 5/5 冻结、V2/V2.1=SHADOW、HOME=V1、PRIMARY=禁止 |
| Gate-A 主要关注 | shadow 记录未持久化足够 question/evidence/display-position 溯源，无法做完整证据级语义审计 |

**观测性缺口已定位（纯持久化缺口，非推理缺口）**：normalizer / signalExtractor / responseValidity 在内存中已计算全部溯源，但 `buildShadowRecordV21` 丢弃了它们。

---

## 1. 非目标（冻结，不得改变）

观测性修复**不得**改变任何推理行为：

18 题 / 65 选项 / 题文 / 选项文 / optionId / questionId / 原子证据定义 / 信号抽取 / distortionType / orientation / state / candidate 状态 / A5A eligibility / primary 选择 / follow-up 行为 / response-validity 公式。

```
INFERENCE_BEHAVIOR_CHANGE_ALLOWED = NO
```

---

## 2. 最小审计 trace（冻结）

### 2.1 最小提交答案 trace（每题 1 条，共 18 条）

```json
{ "questionId": "SC_DEC_01", "optionId": "A", "displayPosition": 2 }
```

三者皆必需，且均**不可安全派生**（questionId 是题、optionId 是语义选择、displayPosition 是渲染位置）。

### 2.2 最小证据溯源 trace（每条命中证据 1 行）

normalizer 已计算并返回，当前被丢弃：

```json
{ "evidenceId": "FB_AS_THREAT", "direction": "D", "distortionType": "feedback-as-threat",
  "matchedQuestionIds": ["SC_FB_02"], "matchedOptionIds": ["SC_FB_02:B"] }
```

- `evidenceId` + `matchedQuestionIds` + `matchedOptionIds` = **不可派生**的溯源（哪道题实际命中哪条证据）。
- `direction` / `distortionType` / `construct` / `signalId` 均可由 evidenceId + 冻结 catalog 确定性派生 → 为自包含审计可一并持久化 direction + distortionType（体积可忽略），但**不重复持久化** construct/signalId（已有 signal 级 `evidenceTraceSummary` 覆盖）。

```
MINIMUM_PERSISTED_ANSWER_TRACE   = [{ questionId, optionId, displayPosition }] × 18
MINIMUM_PERSISTED_EVIDENCE_TRACE = [{ evidenceId, direction, distortionType, matchedQuestionIds, matchedOptionIds }]
```

---

## 2A. 实现歧义显式消解（009 四阻塞，冻结）

### A. 证据 trace 字段集（精确五字段）

```
evidenceTrace row = { evidenceId, direction, distortionType, matchedQuestionIds, matchedOptionIds }
```

- **不持久化** `semanticProposition`（属服务端 catalog，非审计所需）。
- **不重复持久化** `construct` / `sourceQuestionIds`（均可由 `evidenceId` + 冻结 catalog 确定性派生，且已有 `evidenceTraceSummary` 覆盖 signal 级）。

### B. Validity trace 形状（精确四字段）

```
validityTrace = { status, reasons, counts, observedSignals }
```

- **不持久化** 内部逐步 `trace`（无显式审计需要）。
- **省略** `deferredSignals`（非冻结 Gate-B 指标所需）。
- 无 score / confidence / probability。

### C. Answer trace 位置（冻结）

三者均落在 **V2.1 shadow payload 对象内**，非文档顶层，且不复制文档级身份元数据：

```
shadowWorldModelV21.answerTrace    = [{ questionId, optionId, displayPosition }] × 18
shadowWorldModelV21.evidenceTrace  = [{ evidenceId, direction, distortionType, matchedQuestionIds, matchedOptionIds }]
shadowWorldModelV21.validityTrace  = { status, reasons, counts, observedSignals }
```

（即 `buildShadowRecordV21` 组装的对象 `shadowWorldModelV21` 内部，与现有 `dimensionSummary` / `evidenceTraceSummary` / `primaryBlindSpotId` 等字段并列。）

### D. 旧摘要 + 新 trace（冻结）

- 现有 `evidenceTraceSummary`（signal 级）**保留**，用于向后兼容 / Gate-A 连续性。
- 新 `evidenceTrace`（evidence 级）为**增量添加**。
- schema-v2 **不替换、不删除** `evidenceTraceSummary`。

---

## 3. 隐私边界（冻结）

```
NEW_PII_FIELDS = 0
```

不新增：name / phone / email / 原始 profile 字段 / device fingerprint / 自由文本。
`openid` 已存在于文档级作用域（后端去重用），**不复制进每个 trace 行**。

---

## 4. Display Position 溯源（冻结）

持久化的 `displayPosition` 必须是**客户端提交的零基渲染位置**（Response Validity 所用的同一输入）：

```
DISPLAY_POSITION_SOURCE = CLIENT_SUBMITTED_DISPLAY_POSITION
```

禁止从 optionId / canonical option order / evidenceId / semantic position 重建；无 fallback。

---

## 5. Validity trace（冻结）

持久化 response-validity 审计对象（只持久化**已实际计算**的字段，不发明分数）：

```json
{ "status": "RESPONSE_VALID", "reasons": ["NO_MECHANICAL_PATTERN"],
  "counts": { "n": 18, "positionValidCount": 18, "positionMissingCount": 0, "positionInvalidCount": 0 },
  "observedSignals": [ { "signal": "SAME_POSITION_RATE", "value": 0.4, "status": "OBSERVED" } ] }
```

`VALIDITY_TRACE_REQUIRED = YES`（当前只持久化了 status + 首个 reason，丢弃了 reasons 全集、counts、observedSignals）。

---

## 6. Cognition trace（冻结）

hSupport/dSupport/nSupport/orientation/state 已在 `dimensionSummary`；证据级 matchedQuestionIds 由 §2.2 证据 trace 覆盖。故**无需**再往 dimensionSummary 加 questionId（可从证据 trace 确定性重建维度计数）。

禁止数值排名、禁止隐藏打分。

---

## 7. Follow-up trace（冻结）

Gate-B 仍为 base 问卷观测。若 A5A 返回 `FOLLOW_UP_REQUIRED`，只持久化 pair 元数据（`followUpRequired` + `followUpPair`），不执行合成 follow-up、无真实 follow-up UI 则无 A5B2。

---

## 8. Schema 版本（冻结）

```
SCHEMA_VERSION_CURRENT  = 1
SCHEMA_VERSION_PROPOSED = 2
V1_RECORD_BACKWARD_COMPATIBLE = YES（v1 记录不可变、可读，无迁移/重写）
```

### schema-v2 增量持久化形状（确定性实现契约）

```
shadowWorldModelV21 = {
  schemaVersion: "2",               // 1 → 2
  // ── 现有字段全部保留 ──
  diagnosticVersion, responseValidityStatus, responseValidityReason,
  cognitionExecuted, cognitionTerminalStatus, primaryBlindSpotId, primaryConstruct,
  followUpRequired, followUpPair, dimensionSummary, evidenceTraceSummary, errorCode, requestId,
  // ── schema-v2 新增（增量，不替换任何现有字段）──
  answerTrace:   [{ questionId, optionId, displayPosition }] × 18,
  evidenceTrace: [{ evidenceId, direction, distortionType, matchedQuestionIds, matchedOptionIds }],
  validityTrace: { status, reasons, counts, observedSignals },
}
```

schema-v1 记录不变、不迁移。

---

## 9. 记录体积 / 成本（估算）

| 组件 | 估算字节 |
|---|---|
| 18 条答案 tuple | ~700 B |
| ≤48 条证据 trace | ~4.3 KB |
| validity 审计对象 | ~400 B |
| **合计新增（最坏）** | **~5.4 KB** |

远低于 CloudBase 文档 16 MB 限制。

```
ESTIMATED_MAX_ADDED_BYTES = ~5.4 KB
```

---

## 10. 失败隔离（冻结）

观测性序列化/写入失败**不得**影响：response validity 结果 / cognition 结果 / 生产响应 / V1/V2 行为。V2.1 保持 SHADOW。写入失败仅记日志，绝不影响用户响应。

---

## 11. Gate-B cohort 定义（冻结）

```
GATE_B_TARGET_DEFINITION = 20 个 RESPONSE_VALID 真人唯一提交（schema v2 新记录）
GATE_B_NEW_SCHEMA_V2_HUMANS_REQUIRED = 20
GATE_A_RECORDS_INCLUDED_IN_GATE_B_SEMANTIC_REVIEW = NO
```

- Gate A 保留为**独立的冻结 5 人门**（schema v1）。
- Gate B 的**证据级语义复核只用 schema-v2 新记录**（v1 缺溯源）。
- 若需聚合指标参考，v1 的 5 人可作**仅聚合**贡献（validity/terminal 分布），但**不进入**证据级复核分母。

---

## 12. 无选择偏差（冻结）

```
NO_RETRY_SELECTION_BIAS_RULE = 一人最多一个 cohort 席位；首次合法完成即权威；
  不得通过重试把 LOW/INSUFFICIENT_RESPONSE_QUALITY 刷成 RESPONSE_VALID；
  无效质量结果仍是产品观测；Gate-B 分母与替换测试者单独报告。
```

---

## 13. Gate-B 指标（冻结）

- response-validity 分布 / cognition 执行率 / A5A terminal 分布 / eligible-primary-count 分布 / primary construct 分布 / dimension orientation-state 分布 / per-question option 分布 / per-question displayPosition 分布 / evidence 频率 / distortionType 频率。

校准 watch：LEVERAGE/TIME 集中、IDENTITY/OPPORTUNITY 欠代表、多构念 D+D 集中、DECISION↔PROBABILITY 歧义、RISK↔IDENTITY 歧义。采集期间**不调阈值**。

```
GATE_B_REQUIRED_METRICS = 上述 10 类 + 5 项校准 watch
```

---

## 14. 硬回滚条件（冻结，含观测性专项）

沿用 R6-R0 硬回滚条件 + 新增：

- persisted optionId ≠ 实际推理输入
- persisted displayPosition ≠ validity 输入
- schema-v2 成功记录却缺 trace
- trace 序列化改变推理
- PII 泄漏
- schema-v2 写损坏用户响应

```
OBSERVABILITY_HARD_ROLLBACK_CONDITIONS = 上述 6 条 + R6-R0 11 条
```

---

## 15. 验收测试合同（冻结）

未来实现测试必须证明：观测性补丁前后**同一输入**产出**完全一致**的 responseValidity / signals / dimensions / candidates / A5A terminal / primary 结果。

```
INFERENCE_OUTPUT_DIFF_COUNT = 0
```

另测：18 tuple 精确持久化 / questionId·optionId·displayPosition 精确 / evidenceId 溯源精确 / 无 optionId→position fallback / schema v1 读兼容 / schema v2 写 / 无 openid 行内重复 / 无用户可见字段新增。

---

## 16. 部署顺序（冻结）

```
contract → implementation → independent audit → canonical publication
→ deploy code while V2.1 SHADOW → authenticated real-device trace smoke
→ DB readback → start Gate-B collection
```

无 home 迁移、无 primary。

```
DEPLOYMENT_SEQUENCE_FROZEN = 上述 8 步
```

---

## 17. 最终门

```
OBSERVABILITY_FIX_REQUIRED_BEFORE_GATE_B = YES
INFERENCE_BEHAVIOR_CHANGE_ALLOWED        = NO
NEW_PII_FIELDS                           = 0
DISPLAY_POSITION_SOURCE                  = CLIENT_SUBMITTED_DISPLAY_POSITION
SCHEMA_VERSION_CURRENT / PROPOSED        = 1 / 2
V1_RECORD_BACKWARD_COMPATIBLE            = YES
ESTIMATED_MAX_ADDED_BYTES                = ~5.4 KB

IMPLEMENTATION_EXPECTED_FILES = MODIFY runtimeShadowAdapterV21.js（增 answerTrace/evidenceTrace/validityTrace 持久化 + schemaVersion=2）；MODIFY 测试；ADD 1 观测性测试
READY_FOR_OBSERVABILITY_IMPLEMENTATION   = YES
READY_FOR_GATE_B_COLLECTION              = NO（待实现+审计+部署）
READY_FOR_HOME_MIGRATION                 = NO
READY_FOR_PRIMARY                        = NO

RESULT = GATE_B_R0_OBSERVABILITY_CONTRACT_FROZEN
```
