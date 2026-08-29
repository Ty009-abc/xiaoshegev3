# RC8.3 Stage20 R0 — V2.1 Runtime Shadow Contract

- **Status:** CONTRACT / ARCHITECTURE FREEZE ONLY（不实现、不改 env、不 deploy、不 commit、不 push）
- **Date:** 2026-08-29
- **Canonical SHA:** `b5eb98208e42735b714bed2c591435795d0157c3`（已验证）
- **Authority:** Stage20-R0（V2.1 runtime shadow 接入合同）> R3C-R1 > R3C > R3B > R3（response-validity gate）> R3D > A5/A5.1/A5.1-R1（认知链语义）

---

## 0. Objective

冻结 `world_model_v2_1` 以 **SHADOW ONLY** 接入生产 runtime 的最小合同。必须保证：

1. V2.1 rollout 与旧 V2 控制面**独立**；
2. response validity **gate 认知**；
3. V2.1 **绝不**影响当前用户可见结果；
4. V2.1 失败**绝不**阻塞生产响应；
5. Stage20 **不存在** PRIMARY 能力。

---

## 1. Control Plane — FROZEN

```
V21_MODE_ENV = RC83_WORLD_MODEL_V2_1_MODE

V21_ALLOWED_MODES = { OFF, SHADOW }
V21_DEFAULT_MODE  = OFF
V21_INVALID_MODE_BEHAVIOR = OFF（fail-closed）
```

- **无 PRIMARY、无 SELECTIVE_PRIMARY、无 allowlist**。
- **不复用** `RC83_WORLD_MODEL_V2_MODE` / `RC83_WORLD_MODEL_V2_ALLOWLIST`（旧 V2 与 V2.1 控制面独立）。

```
V21_PRIMARY_MODE_DEFINED = NO
V21_ALLOWLIST_DEFINED    = NO
V2_TO_V21_MODE_COUPLING_PATHS = 0
V21_TO_V2_MODE_COUPLING_PATHS = 0
```

---

## 2. Mode Semantics — FROZEN

**OFF**：V2.1 runtime 不执行；无 V2.1 DB 写入；无延迟贡献；无用户可见影响。

**SHADOW**：在架构允许处异步/隔离执行 V2.1 shadow；永不选 renderSource；永不替换 V1/V2 结果；失败永不阻塞生产响应。

```
V21_MODE_OFF_RUNTIME_CALLS      = 0
V21_MODE_OFF_RECORD_WRITES      = 0
V21_MODE_SHADOW_USER_VISIBLE_PATHS = 0
V21_MODE_SHADOW_PRIMARY_PATHS       = 0
```

---

## 3. Response Validity Gate — FROZEN

```
submission → responseValidityV21 → status

status ∈ { RESPONSE_QUALITY_LOW, INSUFFICIENT_RESPONSE_QUALITY }
  → cognitionExecuted = false
  → 无 dimensions / blindspot candidate / primary decision / follow-up resolution
  → 仅记录 validity 结果

status == RESPONSE_VALID
  → 认知 MAY 执行
```

```
COGNITION_EXECUTION_ALLOWED_IFF = RESPONSE_VALID
```

---

## 4. Cognition Pipeline — FROZEN

仅 `RESPONSE_VALID` 时，runtime 可调用 canonical 链：

```
questionnaire/evidence normalization → signal extraction
→ dimension engine → blindspot candidates → A5A primary decision
```

A5A 返回 `FOLLOW_UP_REQUIRED` → **仅记录该 shadow 结果**；不呈现 follow-up UI、不触发用户交互。A5B2 resolver **不调用**（除非未来有单独授权的 UI 合同提供真实 follow-up 答案）。

```
V21_SHADOW_FOLLOWUP_UI_ENABLED       = NO
V21_RUNTIME_SYNTHETIC_FOLLOWUP_ANSWERS = 0
```

---

## 5. Failure Boundary — FROZEN

任何 V2.1 失败（validity 异常 / 认知异常 / 持久化异常 / malformed 输入 / 意外内部状态）**不得**导致当前生产报告生成失败。

```
V21_FAILURE_BLOCKS_PRODUCTION_RESPONSE = NO
```

V2.1 失败仅产生诊断日志。无 V2.1→V2 primary 回退；无 V2.1→任何 legacy wealth 输出回退。

---

## 6. User-Visible Isolation — FROZEN

V2.1 不得修改：`renderSource`、`wealthProbability`、`wealthPath`、`scoreCard.cashflow`、`destinySimulator` 或任何等价用户可见 legacy 报告字段。

```
V21_TO_RENDER_SOURCE_PATHS            = 0
V21_TO_LEGACY_WEALTH_FIELD_PATHS      = 0
V21_TO_CURRENT_REPORT_MUTATION_PATHS  = 0
```

---

## 7. Record Namespace — FROZEN

```
V21_SHADOW_RECORD_NAMESPACE = diagnostic_world_model_v2_1_shadow
V21_RECORD_NAMESPACE_COLLISION_COUNT = 0
```

不碰撞：`world_model_v1`、`world_model_v2`、`diagnostic_world_model_v2`、`diagnostic_world_model_v2_shadow`、`diagnostic_v4`。

---

## 8. Minimal Shadow Record Schema — FROZEN

最小字段（供 calibration）：

```
schemaVersion
diagnosticVersion          = 'world_model_v2_1'
createdAt
requestId / traceId        （若已存在）
responseValidityStatus     ∈ { RESPONSE_VALID, RESPONSE_QUALITY_LOW, INSUFFICIENT_RESPONSE_QUALITY }
responseValidityReason     （确定性 reason code）
cognitionExecuted          boolean
cognitionTerminalStatus    ∈ { PRIMARY_ALLOWED, FOLLOW_UP_REQUIRED, NO_PRIMARY_DEFICIT, INSUFFICIENT_EVIDENCE, NOT_EXECUTED }
primaryBlindSpotId         nullable
primaryConstruct           nullable
followUpRequired           boolean
followUpPair               nullable
dimensionSummary           nullable
evidenceTraceSummary
errorCode                  nullable
```

**禁止**存储：捏造的 probability/confidence 分数、legacy wealth 字段。

**blocked validity 语义（精确 null/omission）：**

```
BLOCKED_VALIDITY_COGNITION_MATERIALIZATION = 仅记录 validity 结果
  primaryBlindSpotId      = null
  dimensionSummary        = null
  cognitionTerminalStatus = NOT_EXECUTED
  cognitionExecuted       = false
  followUpRequired        = false
  followUpPair            = null
```

---

## 9. Input Contract — FROZEN

runtime 必须可访问 V2.1 payload：`questionId`、`optionId`、`displayPosition`。

- `displayPosition` 是**唯一** position source（R3C）。
- 无 optionId→position fallback。
- context 字段 cognition weight = 0。
- malformed response metadata 遵循 response-validity fail-closed 语义（R3C-R1 §11）。

---

## 10. Latency / Async Semantics — FROZEN

**CloudBase SCF 架构事实**：函数返回后实例可能被冻结/回收，**不保证** fire-and-forget 后台任务在返回后完成。因此「返回后异步执行」不可靠。

V2.1 认知链为**纯同步计算**（无 AI 调用、无网络、无 DB；B3 审计 10⁴ 用例毫秒级），延迟可忽略。

**RECOMMENDED_RUNTIME_EXECUTION_PATTERN**：

```
A. awaited inside isolated try/catch（同步 await 执行 V2.1 shadow）
   — V2.1 成功 → 记录 shadow 结果
   — V2.1 失败 → 仅诊断日志，绝不传播异常到生产响应
   — shadow 记录 DB 写入独立 try/catch（写失败仅日志）
```

「fail-open」= 生产结果在 V2.1 失败时存活；**不等于** fire-and-forget（平台生命周期无法保证完成时不得使用）。

---

## 11. Old V2 Isolation — FROZEN

生产旧 V2 现为显式 `RC83_WORLD_MODEL_V2_MODE = SHADOW`（P0B 已修复）。

Stage20 **不得**修改：`RC83_WORLD_MODEL_V2_MODE`、`RC83_WORLD_MODEL_V2_ALLOWLIST`。

V2.1 集成不得依赖旧 V2 mode。

---

## 12. Deferred Validity Signals — FROZEN

```
DEFERRED_VALIDITY_SIGNALS_STATUS = DEFERRED_NOT_OBSERVABLE
  COMPLETION_TIME_ANOMALY
  DUPLICATE_SCENARIO_INCONSISTENCY
  SEMANTIC_CONTRADICTION_RATE
```

Stage20 不实现它们。

---

## 13. Calibration Watch Item — FROZEN

```
CALIBRATION_WATCH_ITEM_STATUS = CALIBRATION_WATCH_ITEM_NOT_RUNTIME_BLOCKER
```

Monte Carlo 下 LEVERAGE / TIME primary 过度代表（选项密度 + 多模型排除机制）保持为 watch item，Stage20 不改问卷。

---

## 14. Implementation Scope Proposal（不实现）

Stage20 实现最小文件集：

```
新增：
  cloudfunctions/generateAiReport/lib/config/worldModelV21Mode.js
    — 专用 V2.1 mode parser（RC83_WORLD_MODEL_V2_1_MODE；OFF|SHADOW；fail-closed OFF）
  cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js
    — 组合 responseValidityV21 + canonical 认知链 + shadow 记录（isolated try/catch）

修改：
  cloudfunctions/generateAiReport/index.js
    — diagnostic 分支新增 diagnosticVersion === 'world_model_v2_1' 分支
      （V21_MODE=OFF → 早期返回；=SHADOW → runtimeShadowAdapterV21，fail-open）

新增：
  tests/rc8.3-stage20-v21-runtime-shadow.test.js
    — 覆盖：OFF 零调用、SHADOW gate（VALID 才认知）、失败不阻塞、记录 namespace、隔离不变量
```

---

## 15. Static Forbidden Paths — FROZEN

```
V21_PRIMARY_ROUTING_PATHS   = 0
V21_ALLOWLIST_PATHS         = 0
V21_RENDER_SOURCE_PATHS     = 0
V21_LEGACY_WEALTH_PATHS     = 0
V2_MODE_TO_V21_EXECUTION_PATHS = 0
V21_MODE_TO_V2_PRIMARY_PATHS   = 0
OPTION_ID_TO_POSITION_FALLBACK_PATHS = 0
```

---

## 16. Deployment Gate — FROZEN

```
IMPLEMENTATION_PASS  !=  DEPLOY_AUTHORIZED
```

Stage20 实现验收**不蕴含** deploy。实现后需依次：
1. Stage20 runtime static/local validation；
2. 单独部署授权。

生产 V2.1 mode 的**初始部署值**稍后单独决定。**本合同任务不设置 env。**

---

## 17. Final Report

```
CONTRACT_AUTHORITY = Stage20-R0（V2.1 runtime shadow 接入合同）

V21_MODE_ENV          = RC83_WORLD_MODEL_V2_1_MODE
V21_ALLOWED_MODES     = { OFF, SHADOW }
V21_DEFAULT_MODE      = OFF
V21_INVALID_MODE_BEHAVIOR = OFF（fail-closed）

V21_PRIMARY_MODE_DEFINED = NO
V21_ALLOWLIST_DEFINED    = NO
V2_TO_V21_MODE_COUPLING_PATHS = 0
V21_TO_V2_MODE_COUPLING_PATHS = 0

COGNITION_EXECUTION_ALLOWED_IFF = RESPONSE_VALID

V21_SHADOW_FOLLOWUP_UI_ENABLED       = NO
V21_RUNTIME_SYNTHETIC_FOLLOWUP_ANSWERS = 0

V21_FAILURE_BLOCKS_PRODUCTION_RESPONSE = NO

V21_TO_RENDER_SOURCE_PATHS            = 0
V21_TO_LEGACY_WEALTH_FIELD_PATHS      = 0
V21_TO_CURRENT_REPORT_MUTATION_PATHS  = 0

V21_SHADOW_RECORD_NAMESPACE     = diagnostic_world_model_v2_1_shadow
V21_RECORD_NAMESPACE_COLLISION_COUNT = 0

BLOCKED_VALIDITY_COGNITION_MATERIALIZATION =
  primaryBlindSpotId=null / dimensionSummary=null / cognitionTerminalStatus=NOT_EXECUTED

RECOMMENDED_RUNTIME_EXECUTION_PATTERN =
  awaited inside isolated try/catch（fail-open；非 fire-and-forget，因 SCF 不保证返回后完成）

PROPOSED_IMPLEMENTATION_FILES =
  lib/config/worldModelV21Mode.js（新增）
  lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js（新增）
  index.js（修改，diagnosticVersion==='world_model_v2_1' 分支）
  tests/rc8.3-stage20-v21-runtime-shadow.test.js（新增）

DEFERRED_VALIDITY_SIGNALS_STATUS = DEFERRED_NOT_OBSERVABLE
CALIBRATION_WATCH_ITEM_STATUS    = CALIBRATION_WATCH_ITEM_NOT_RUNTIME_BLOCKER

READY_FOR_STAGE20_RUNTIME_IMPLEMENTATION = YES
READY_FOR_STAGE20_DEPLOY = NO
READY_FOR_PRIMARY = NO

RESULT = STAGE20_R0_V21_RUNTIME_SHADOW_CONTRACT_FROZEN
```

**STOP。** 未实现、未改 env、未 deploy、未 commit、未 push。
