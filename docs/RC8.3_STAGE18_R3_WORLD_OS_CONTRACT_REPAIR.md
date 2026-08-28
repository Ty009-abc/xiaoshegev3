# RC8.3 Stage 18-R3 — World OS Contract Repair & Shadow Implementation Gate

Status: DESIGN / OFFLINE CALIBRATION (未改 production/client/cloud function，未 deploy，未切 MODE)
Date: 2026-08-28
Base: docs/RC8.3_STAGE18_R1_WORLD_OS_QUESTIONNAIRE_CONTRACT.md · docs/RC8.3_STAGE18_R2_WORLD_OS_CALIBRATION.md
Harness: /tmp/wmtest/stage18r3_data.js + stage18r3_run.js（离线，未入库，未接 runtime）

---

## A. Corrected Stage Gate（阶段门禁修正）

R2 暴露了一个逻辑死结：要求「先拿到真人新 18Q 数据才能实现新问卷」。这不成立——未实现就无法产生数据。修正为四段门：

```
DESIGN VALIDATION → SHADOW IMPLEMENTATION → REAL SHADOW CALIBRATION → PRIMARY READINESS
```

| 门 | 要求 | 是否要求真人新 18Q 数据 |
|---|---|---|
| **READY_FOR_SHADOW_IMPLEMENTATION** | 问卷/证据/推理结构冻结；provisional 阈值安全 fail-closed；uncertainty 路径完整；response-validity 路径完整；report contract 冻结；离线 fixtures 通过 | **否** |
| **READY_FOR_PRIMARY** | 真实新问卷 shadow 数据；阈值真实校准；response-quality/construct 分布观察；follow-up 频率观察；false-certainty 审计；产品语义 review | **是** |

本轮 R3 修复通过 → `READY_FOR_SHADOW_IMPLEMENTATION = YES`；`READY_FOR_PRIMARY = NO`；`SHADOW_CALIBRATION_REQUIRED = YES`。

---

## B. Response Validity Layer（独立于认知）

新增独立 `RESPONSE_VALIDITY_LAYER`，与认知证据链**并行**，`responseValidity` **绝不映射到任何 cognition dimension**。

```
answers ──┬── response validity assessment ──▶ RESPONSE_VALID / RESPONSE_QUALITY_LOW / INSUFFICIENT_RESPONSE_QUALITY
          └── cognitive evidence ──▶ typed signals ──▶ dimension state ──▶ blindSpot
```

**Signal set**（每个单独都不判 invalid，必须组合）：
- `SAME_POSITION_RATE`（同字母占比）
- `ANSWER_ENTROPY`（字母香农熵）
- `SEMANTIC_CONTRADICTION_RATE`（同 construct 内 H+D）
- `COMPLETION_TIME_ANOMALY`（实现期接入）
- `DUPLICATE_SCENARIO_INCONSISTENCY`（实现期接入）

**组合判定**（结构化机械模式，非单字母启发）：
- `straightline-all-same`（全同字母，entropy=0）
- `straightline-alternating`（ABAB…）
- `straightline-sequential`（ABCD…）
- `n < 4` → INSUFFICIENT_RESPONSE_QUALITY
- `n == 0` → INSUFFICIENT_RESPONSE_QUALITY

命中任一条 → `NO_PRIMARY` + `RETAKE_RECOMMENDED`，**绝不产出 primaryBlindSpot**。

> **R2 缺陷修复**：all-A 机械作答（LEV_01:A / LEV_02:A 恰为失真项）曾误诊 `LEVERAGE_MODEL_GAP`。现在 all-A 在认知之前就被 `straightline-all-same` 拦截 → NO_PRIMARY。`LOW_RESPONSE_QUALITY` 不映射到 LEVERAGE/RISK/任何认知维度。

---

## C. Answer Position Bias Audit（位置偏差审计）

对 65 个 option-命题按字母位置统计健康/失真/中性分布：

| 位置 | H(健康) | D(失真) | N(中性) | 合计 |
|---|---|---|---|---|
| **A** | **14** | 4 | 0 | 18 |
| **B** | 5 | **12** | 1 | 18 |
| **C** | 3 | **15** | 0 | 18 |
| **D** | 1 | **9** | 1 | 11 |

**结论：`OPTION_POSITION_BIAS = YES`（系统性）**。健康选项显著集中在 A（14/18 健康在 A），失真选项集中在 B/C/D（36/47 失真在 B/C/D）。这正是 R2 all-A 误诊的结构性根因——all-A ≈ 「全健康 + 恰好撞上 LEV_01:A/LEV_02:A 两个失真项」。

**DISPLAY_ORDER_POLICY = RANDOMIZATION_REQUIRED**：
- `optionId`（语义稳定 ID）与 `displayPosition`（展示位置）解耦。
- 运行时展示顺序 shuffle（如 C A D B），上传仍传 `semanticOptionId`。
- 推理契约只读 `semanticOptionId`，shuffle 不改变 inference。
- 若当前小程序 UX 暂不支持即时随机化 → 契约冻结 `POSITION_BALANCING_REQUIRED = YES`（实现期至少保证每 construct 的 H/D 位置均衡，或用随机化）。

---

## D. Atomic Evidence Normalization（原子证据归一化）

### 归一化原则
1. 语义等价 → 合并（同一潜隐假设的 supporting/counter variant 不重复计权）。
2. 同一潜隐假设在不同题重复出现 → 合并为同一 atomic evidence。
3. 真正不可再分的机制 → 拆分保留。
4. **数量由语义决定**，不人为保持 18 / 65 / 72。

### 归一化结果

| 项 | 值 |
|---|---|
| OPTION_PROPOSITION_COUNT | **65** |
| NORMALIZED_ATOMIC_EVIDENCE_COUNT | **48** |

### Merge / Split Rationale（按 construct）

- **Merge（65→48，共减 17）**：
  - 跨题同机制合并：如 FEEDBACK 的 `dismiss`(SC_FB_02:C) + `trust-self`(SC_FB_01:B) 都是「外部反馈无信息量」→ `FB_AS_NOISE`；RISK 的 `all-equal` + `never-distinguished` 都是「可逆性未区分」→ `RISK_REVERSIBILITY_BLIND`；PROBABILITY 的 `trust-anecdote` + `copy-survivor` 都是「幸存者偏差」→ `PROB_SURVIVOR_BIAS`；LEVERAGE 的 `no-distinction` + `never-considered` 都是「杠杆盲」→ `LEV_BLIND`。
  - 健康态合并：每 construct 的健康选项表达同一底层健康假设，合并为 1–2 个 H evidence（如 IDENTITY 的 learnable/collaborate/capability/adaptable 都是「身份可更新」→ `ID_UPDATEABLE`）。
- **Split（保留细分）**：
  - DECISION 的 `require-certainty`(确定性门) 与 `plan-exhaustively`(分析瘫痪) 机制不同 → 分别 `DEC_CERTAINTY_GATE` / `DEC_ANALYSIS_PARALYSIS`。
  - FEEDBACK 的 `attribute-other`(防御=反馈是威胁) 与 `dismiss`(反馈是噪声) 机制不同 → 分别 `FB_AS_THREAT` / `FB_AS_NOISE`。

### 48 Atomic Evidence（含 construct / direction / distortionType / 命题）

| evidenceId | construct | dir | distortionType | semanticProposition |
|---|---|---|---|---|
| DEC_ACTION_LEARNS | DECISION | H | — | 行动本身制造信息 |
| DEC_INFO_VALUED | DECISION | H | — | 增量信息值得等待/寻求 |
| DEC_CERTAINTY_GATE | DECISION | D | certainty-gate | 决策必须先有确定性 |
| DEC_ANALYSIS_PARALYSIS | DECISION | D | analysis-paralysis | 决策必须先穷尽风险 |
| DEC_SOCIAL_PROOF | DECISION | D | social-proof | 他人确认优先于自有信息 |
| DEC_INFO_BLIND | DECISION | D | info-blind | 没意识到信息会改变判断 |
| FB_PROCESSING | FEEDBACK | H | — | 反馈是信息，值得采集裁决 |
| FB_AS_THREAT | FEEDBACK | D | feedback-as-threat | 反馈是对自我的威胁（防御） |
| FB_AS_NOISE | FEEDBACK | D | feedback-as-noise | 外部反馈无信息量（信自己） |
| FB_INERT | FEEDBACK | D | feedback-inert | 记下反馈但不据此改变 |
| FB_SYMPATHY | FEEDBACK | D | sympathy-seeking | 只寻求顺耳的反馈 |
| PROB_BASE_RATE | PROBABILITY | H | — | 主动查基础率/失败案例 |
| PROB_UPDATABLE | PROBABILITY | H | — | 概率可随新信息更新 |
| PROB_SURVIVOR_BIAS | PROBABILITY | D | survivor-bias | 采信/复制幸存者个例 |
| PROB_BINARY_FIXED | PROBABILITY | D | fixed-prob | 概率固定，不更新 |
| PROB_NO_RANGE | PROBABILITY | D | no-range | 无区间语言，凭感觉 |
| PROB_NO_AWARENESS | PROBABILITY | D | no-awareness | 无概率意识 |
| RISK_ASYMMETRY_AWARE | RISK | H | — | 感知风险不对称（赔率） |
| RISK_REVERSIBILITY_AWARE | RISK | H | — | 可逆性进入决策 |
| RISK_LOSS_AVERSION | RISK | D | loss-aversion | 只看到下行（过度回避） |
| RISK_UPSIDE_BLIND | RISK | D | upside-blind | 只看到上行（鲁莽） |
| RISK_BLIND | RISK | D | risk-blind | 无不对称意识 |
| RISK_REVERSIBILITY_BLIND | RISK | D | reversibility-blind | 把一切风险当作不可逆 |
| LEV_DECOUPLED | LEVERAGE | H | — | 价值可与个人时间解耦 |
| LEV_LINEAR_EFFORT | LEVERAGE | D | linear-effort | 一次性线性交付 |
| LEV_TIME_COUPLED | LEVERAGE | D | time-coupled | 产出停手即停（时间耦合） |
| LEV_BLIND | LEVERAGE | D | leverage-blind | 从未想过放大/复用 |
| TIME_COMPOUNDING_PROTECTED | TIME | H | — | 保护复利时间 |
| TIME_COMPOUNDING_UNPROTECTED | TIME | D | compounding-unprotected | 长期时间被即时/忙碌挤压 |
| TIME_DIRECTION_PERSISTENT | TIME | H | — | 方向持续投入 |
| TIME_DIRECTION_UNSTABLE | TIME | D | direction-unstable | 方向频繁切换/漂移 |
| ID_UPDATEABLE | IDENTITY | H | — | 身份可更新（能力/越界） |
| ID_BOUNDARY_FIXED | IDENTITY | D | boundary-fixed | 身份是固定边界（不像我） |
| ID_ABILITY_FIXED | IDENTITY | D | ability-fixed | 能力固化（我可能做不好） |
| ID_ROLE_FIXED | IDENTITY | D | role-fixed | 角色框架（我是 XX 职业） |
| ID_CONTEXTUAL | IDENTITY | N | — | 情境框架（看对方） |
| OPP_DIVERSE | OPPORTUNITY | H | — | 多样化暴露带来机会 |
| OPP_NARROW | OPPORTUNITY | D | narrow-exposure | 接触面窄（熟悉/罕见） |
| OPP_PASSIVE | OPPORTUNITY | D | passive | 被动等待机会 |
| OPP_HOMOGENEOUS | OPPORTUNITY | D | homogeneous | 接触人群同质化 |
| OPP_SOME | OPPORTUNITY | N | — | 接触多样性中等 |
| SYS_SYSTEM_CAUSALITY | SYSTEMS | H | — | 结构/情境因果观 |
| SYS_PERSON | SYSTEMS | D | person-attribution | 人事归因（是人不行） |
| SYS_EVENT | SYSTEMS | D | event-attribution | 事件归因（每次都不同） |
| SYS_METHOD | SYSTEMS | D | method-attribution | 方法归因（方法有漏洞） |
| SYS_LUCK | SYSTEMS | D | luck-attribution | 运气归因 |
| SYS_BRUTE_RETRY | SYSTEMS | D | brute-retry | 蛮力重试（不换方法） |
| SYS_BLIND | SYSTEMS | D | attribution-blind | 无归因意识 |

---

## E. Distortion Type Preservation（失真类型保留）

**禁止** `nominal option → distorted=1 → aggregate score`，因为会丢 `WHY distorted`。

FEEDBACK 的 4 种失真（不可压缩为 `FEEDBACK_BAD=1`）：
- `FB_AS_THREAT` — 反馈是对自我的威胁（防御）
- `FB_AS_NOISE` — 外部反馈无信息量
- `FB_INERT` — 记下但不改
- `FB_SYMPATHY` — 只找顺耳反馈

冻结 `typed signal` 结构：
```
signal = {
  signalId, construct, signalType,
  supportingEvidenceIds[], counterEvidenceIds[],
  strength, consistency,
  dominantDistortionType, mechanismHint
}
```
`Card02` 由 `dominantDistortionType` / `mechanismHint` 解释机制（e.g.「你的反馈模型把负面反馈当作对自我的威胁，因此会防御而非更新」）。

---

## F. Signal / Dimension Layer Non-Collapse（9 条完整链）

逐 construct 证明「answer→proposition→atomic evidence→typed signal→dimension state→blindSpot」每层语义变化，非数值转传：

| construct | 示例链 |
|---|---|
| DECISION | SC_DEC_01.B「等更确定再动」→ "决策需确定性" → DEC_CERTAINTY_GATE[D:certainty-gate] → signal{STRONG, dominantType=certainty-gate} → DECISION_INERTIA |
| FEEDBACK | SC_FB_01.D「记下但不改」→ "反馈不驱动改变" → FB_INERT[D:feedback-inert] → signal{STRONG, feedback-inert} → FEEDBACK_LOOP_GAP |
| PROBABILITY | SC_PROB_01.B「他靠谱值得信」→ "采信幸存个例" → PROB_SURVIVOR_BIAS[D:survivor-bias] → signal{STRONG} → PROBABILITY_MISJUDGMENT |
| RISK | SC_RISK_01.B「只看到会亏」→ "只看到下行" → RISK_LOSS_AVERSION[D:loss-aversion] → signal{STRONG} → RISK_MODEL_DISTORTION |
| LEVERAGE | SC_LEV_01.A「直接解决这一次」→ "线性交付" → LEV_LINEAR_EFFORT[D:linear-effort] → signal{STRONG} → LEVERAGE_MODEL_GAP |
| TIME | SC_TIME_01.A「先做立刻见效」→ "复利被挤压" → TIME_COMPOUNDING_UNPROTECTED[D] → signal{STRONG} → TIME_HORIZON_TRAP |
| IDENTITY | SC_ID_01.B「不是我的领域」→ "边界固定" → ID_BOUNDARY_FIXED[D:boundary-fixed] → signal{STRONG} → IDENTITY_CONSTRAINT |
| OPPORTUNITY | SC_OPP_01.C「熟悉圈子里」→ "接触面窄" → OPP_NARROW[D:narrow-exposure] → signal{STRONG} → OPPORTUNITY_BLINDNESS |
| SYSTEMS | SC_SYS_01.B「是人不行」→ "人事归因" → SYS_PERSON[D:person-attribution] → signal{STRONG} → SYSTEM_THINKING_GAP |

**INFERENCE_LAYER_COLLAPSE = NO**。evidence（命题）≠ signal（跨 evidence 聚合 + 类型）≠ dimension state（STRONG/MODERATE/WEAK/UNKNOWN）。

---

## G. Provisional Threshold Policy

| 阈值 | 值 | 状态 |
|---|---|---|
| PRIMARY_SEPARATION_PROVISIONAL | **0.5**（primary 至少领先第二半档） | **PROVISIONAL_SHADOW** |
| PRIMARY_SUFFICIENCY_PROVISIONAL | **2**（primary 需 2 条独立证据） | **PROVISIONAL_SHADOW** |

- 非 validated；实现后行为偏保守：borderline → FOLLOW_UP；仍不清 → INSUFFICIENT_EVIDENCE。
- **false uncertainty 优于 false certainty**。
- 尺度说明：R1 的 0.08/0.25 是旧 ordinal 遗留；归一化后 nominal 尺度 gap∈{0,0.5,1}，等价阈值为 0.5/2。若后续归一化改变了尺度，需重新离线校准。

---

## H. Straightline / Gaming Re-run（10 个 response-quality fixtures）

| fixture | validity | decision |
|---|---|---|
| ALL_A / ALL_B / ALL_C / ALL_D | RESPONSE_QUALITY_LOW | NO_PRIMARY |
| ABAB / ABCD | RESPONSE_QUALITY_LOW | NO_PRIMARY |
| fast_completion_sim（=all-A 模拟） | RESPONSE_QUALITY_LOW | NO_PRIMARY |
| random_1 | RESPONSE_VALID | ONE_PRIMARY（LEVERAGE，合法诊断） |
| random_2 | RESPONSE_VALID | FOLLOW_UP |
| idealized_doctrine（全健康） | RESPONSE_VALID | NO_PRIMARY_DEFICIT |

**RESPONSE_PATTERN_FALSE_BLINDSPOT_COUNT = 0**（无任何 response pattern 直接产生认知 deficit）。

---

## I. Re-run Semantic Suite（归一化契约上重跑）

| 指标 | 值 |
|---|---|
| POSITIVE_PRIMARY | **9/9** |
| near-neighbor 明确左/右 | 10/10 正确 |
| near-neighbor 真模糊 | 5/5 → FOLLOW_UP |
| FALSE_CERTAINTY_COUNT | **0** |
| CONTRADICTION_DETECTED | **3/3** |
| MISSINGNESS_FALSE_DEFICIT | **0** |
| FORCED_DEFICIT | **0** |
| RESPONSE_PATTERN_FALSE_BLINDSPOT | **0** |

（全部由 `stage18r3_run.js` 离线跑出，非沿用旧报告数字。）

---

## J. Report Contract Check（六卡仍可由 typed evidence 生成）

六卡均能从 typed evidence 生成，Card02 不因 atomic normalization 丢失机制：
- CARD01 primary bottleneck + evidenceIds（typed）
- CARD02 current world model + **dominantDistortionType/mechanismHint**
- CARD03 scenario simulation（禁命运/伪概率）
- CARD04 ONE strategy
- CARD05 falsifiable experiment + falsifyingOutcome
- CARD06 oldModel → newModel

`SIX_CARD_SEMANTIC_PASS = PASS`。

---

## K. Version Policy（不覆盖 world_model_v2）

| 项 | 值 |
|---|---|
| QUESTIONNAIRE VERSION | `world_model_v2_1` |
| ENGINE | `world_model_v2_1` |
| RECORD TYPE（shadow） | `diagnostic_world_model_v2_1_shadow` |
| RECORD TYPE（future primary） | `diagnostic_world_model_v2_1` |

- V2 历史记录 **read-only**。
- V2.1 与 V2 的 cache / record / diagnosticVersion / engineVersion **全部隔离**。
- **不得** migrate 旧 V2 answers 到 V2.1 inference（题目语义已变）。

---

## L. Implementation Scope Freeze（本轮不实现）

V2.1 **SHADOW ONLY**，禁止 SELECTIVE_PRIMARY / PRIMARY / production release。

需实现（供 009，本轮不写 production code）：
- 服务端：`questionnaireV21` / `responseValidityV21` / `evidenceNormalizerV21` / `signalExtractorV21` / `dimensionEngineV21` / `blindSpotEngineV21` / `followupEngineV21` / `strategyEngineV21` / `reportContractV21` / `adapterV21` / `pipelineV21`
- 客户端：V2.1 内部测试问卷 + adaptive followup UI + six-card V2.1 shadow 预览/内部审查
- legacy wealth 字段（scoreCard.cashflow / wealthProbability / potentialIndex / wealthPath）**不得在 V2.1 UI 展示**。

---

## M. Shadow Calibration Plan（实现后真人 shadow 观察）

Stage 1 real shadow 目标是**发现结构缺陷，不是证明统计普适性**（不设硬样本量当"科学有效性"）：

| 观察项 |
|---|
| REAL_RESPONSE_COUNT / UNIQUE_USERS |
| QUESTION_OPTION_DISTRIBUTION / POSITION_BIAS |
| RESPONSE_VALIDITY_DISTRIBUTION |
| FOLLOWUP_TRIGGER_RATE / FOLLOWUP_RESOLUTION_RATE / INSUFFICIENT_RATE |
| PRIMARY_DISTRIBUTION / SECONDARY_DISTRIBUTION / SEPARATION_DISTRIBUTION |
| EVIDENCE_CONSISTENCY |
| BLINDSPOT_COLLAPSE / FALSE_CERTAINTY_REVIEW / SEMANTIC_COHERENCE |

---

## N. Final Gate

| 门禁 | 值 |
|---|---|
| ATOMIC_EVIDENCE_NORMALIZED | **YES**（65→48） |
| DISTORTION_TYPE_PRESERVED | **YES** |
| RESPONSE_VALIDITY_SEPARATED | **YES** |
| RESPONSE_PATTERN_FALSE_BLINDSPOT_COUNT | **0** |
| INFERENCE_LAYER_COLLAPSE | **NO** |
| POSITIVE_PRIMARY | **9/9** |
| FALSE_CERTAINTY | **0** |
| CONTRADICTION_DETECTED | **3/3** |
| MISSINGNESS_FALSE_DEFICIT | **0** |
| SIX_CARD_SEMANTIC_PASS | **PASS** |

**→ QUESTIONNAIRE_CONTRACT = FROZEN；EVIDENCE_CONTRACT = FROZEN；INFERENCE_STRUCTURE = FROZEN；REPORT_CONTRACT = FROZEN。**

**READY_FOR_SHADOW_IMPLEMENTATION = YES**
**THRESHOLD_STATUS = PROVISIONAL_SHADOW**
**SHADOW_CALIBRATION_REQUIRED = YES**
**READY_FOR_PRIMARY = NO**

**STOP。** 未改 production/client/cloud function，未 deploy，未切 MODE，未改 DB。
