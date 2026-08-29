# ADR RC8.3 — Stage19 A5 — Uncertainty / Primary-Selection Contract

- **Status:** CONTRACT (design only — no runtime, no deploy, no MODE/DB change, no commit/push)
- **Scope:** `world_model_v2_1` primary blindspot selection under uncertainty（纯合同设计，禁止实现）
- **Stage:** Stage19A5（消费 Stage19A1–A4 已冻结的 static contract / evidence / signal / dimension / candidate 层）
- **Date:** 2026-08-28
- **Base:** Stage18 R1 / R2 / R3 / R3A / R3B / R3C / R3D（canonical HEAD `231487bf13e1e6bf052ce3fd8bf295ecf86f99a2`）
- **Authority priority:** R3D > R3C > R3B > R3A > R3 > R2 > R1

---

## 0. Canonical Precheck

| 项 | 值 | 判定 |
|---|---|---|
| remote | `git@github.com:Ty009-abc/xiaoshegev3.git` | 匹配 |
| branch | `feat/rc8.3-diagnosis-accuracy` | 匹配 |
| CANONICAL_HEAD | `231487bf13e1e6bf052ce3fd8bf295ecf86f99a2` | 匹配（已 fetch + ff-merge 对齐） |
| git status | 仅未跟踪 `.workbuddy/`、`scripts/rc8.3-phase2-014-calibration.js`（非 canonical 树内） | 干净 |

**结论：canonical provenance 已建立。** 本审计基于 canonical HEAD 的六引擎文件与 Stage18 合同文档，非陈旧工作区。

---

## 1. Frozen Architecture（§2 确认，不改）

- 9 constructs → 9 blindspots **1:1**（`CONSTRUCT_TO_BLINDSPOT_V21`），无 ontology priority。
- Candidate status ∈ `{SUPPORTED, COUNTERSUPPORTED, MIXED, INSUFFICIENT}`，**仅由 dimension orientation 派生**（`resolveBlindSpotStatusV21`）：
  - `DISTORTED → SUPPORTED`
  - `HEALTHY → COUNTERSUPPORTED`
  - `MIXED → MIXED`
  - `UNKNOWN / NEUTRAL → INSUFFICIENT`
- Dimension orientation ∈ `{HEALTHY, DISTORTED, MIXED, NEUTRAL, UNKNOWN}`。
- Dimension state ∈ `{STRONG, MODERATE, WEAK, UNKNOWN}`，语义 = **construct 内证据消解/一致性状态**（R3D §2）。
- `CROSS_CONSTRUCT_STATE_COMPARABILITY = FORBIDDEN`（R3D §16.1）。**STRONG > MODERATE > WEAK 不得跨候选比较。**

每 construct 恰 2 题（`h_support + d_support + n_support ≤ 2`，R3D R2 §14.6/§15.3）。双题真值表（R3D R2 §15.3）唯一决定 state：

| (h,d,n) | orientation | state |
|---|---|---|
| (0,0,0) | UNKNOWN | UNKNOWN |
| (1,0,0) | HEALTHY | WEAK |
| (0,1,0) | DISTORTED | WEAK |
| (0,0,1) | NEUTRAL | UNKNOWN |
| (2,0,0) | HEALTHY | STRONG |
| (0,2,0) | DISTORTED | STRONG |
| (1,1,0) | MIXED | WEAK |
| (1,0,1) | HEALTHY | MODERATE（仅 IDENTITY/OPPORTUNITY） |
| (0,1,1) | DISTORTED | MODERATE（仅 IDENTITY/OPPORTUNITY） |

---

## 2. Historical Threshold Audit（§3）

### 2.1 PRIMARY_SEPARATION_PROVISIONAL = 0.5

- **A. 原始比较量**：R1 §I 的 0.08/0.25 是旧 ordinal-scoring（gap ∈ [0,1] 连续）遗留。R2 判定其尺度不兼容，改 nominal 等价尺度：**每 construct 失真分数 ∈ {0, 0.5, 1}**，`separation=0.5` = **primary 候选的「失真分数」与第二候选「失真分数」之间的 gap ≥ 0.5（领先半档）**。即：一个**数值化候选分数**的**两两差值**。
- **C. 该量当前是否仍存在**：**否**。R3D 起 `dimension.state` 为范畴枚举 `{UNKNOWN,WEAK,MODERATE,STRONG}`，非数值；candidate 无任何数值分数（A1–A4 全部禁止 numeric score / severity / confidence / probability / weight）。「失真分数 ∈ {0,0.5,1}」与「gap」两个量均不复存在。
- **D. 保留该常数是否需数值/序数/权重/跨构念**：**是**。保留 `0.5` 必然要求 (a) 数值候选分数、(b) 跨候选比较/排序以计算 gap。两者均 FORBIDDEN。

**判定：`PRIMARY_SEPARATION_PROVISIONAL_0_5` 与当前范畴架构不兼容 → RETIRE。** 不因历史 provisional 而保留。

### 2.2 PRIMARY_SUFFICIENCY_PROVISIONAL = 2

- **B. 原始计数量**：R2/R3 §G：「primary 需 **2 条独立证据**」。R3D R2 §15.7 已将「exactly-two-evidence」**REINTERPRET** 为「两个独立观测 support unit（unique matchedQuestionId）」。
- **C. 该量当前是否仍存在**：**部分存在**。「2 条独立证据」的**概念**仍存在，且被 R3D 精确化为 `directional_support == 2`（⟺ `state == STRONG`，方向纯粹）。但「数字 2」作为 primary 选择**阈值**已不再以数值形式存在。
- **D. 保留该数值常数是否需数值分数/权重**：若保留「2」作数值阈值，需把 state/evidence 转回数值 → FORBIDDEN。但「充分证据」概念可**范畴化重定义**，无需数值。

**判定：`PRIMARY_SUFFICIENCY_PROVISIONAL_2` → REDEFINE。** 数值常数 `2` 退役；「充分性」概念重定义为范畴条件（见 §4）。

---

## 3. Critical Principle（§4）— FROZEN

> **PRIMARY selection 必须基于「定性证据支配」（qualitative evidence dominance），不得发明数值评分。**

Primary 由**范畴逻辑支配关系**决定。合法输入（每项均有冻结语义基础）：

- `candidate.status`（orientation 派生）
- `dimension.orientation` / `dimension.state`（R3D）
- `supportingQuestionIds` / `counterQuestionIds` / `neutralQuestionIds`（D/H/N 观测单元）
- `supportingEvidenceIds` / `counterEvidenceIds` / `neutralEvidenceIds`（语义追溯）
- `distortionType[]`（机制，供 Card02，不参与支配判定）
- `hasContradiction`（矛盾保留）

**无任意权重。无数值分数。无 H/D 加权。**

「支配」的唯一定义：**存在唯一一个「充分」的 SUPPORTED 候选**（见 §4），且无第二个「充分」候选与之等价竞争。此即定性支配——一个候选在证据量级与方向上独占支配地位。

---

## 4. Sufficiency Contract（§5）— FROZEN

审计候选解释：

| 候选 | 判定 | 理由 |
|---|---|---|
| A. ≥2 total matchedQuestionIds | **否** | 把 N 观测计入充分性，D+N 会被误当作 D+D |
| B. ≥2 directional matchedQuestionIds | **否** | 混入 H；H 是反证不是支持 |
| C. ≥2 D-support matchedQuestionIds | **等价于正确项** | 即 d_support==2 |
| D. dimension.state == STRONG | **正确（带方向限定）** | STRONG ⟺ directional==2 ∧ 方向纯粹 ∧ n==0 |
| E. 另一显式范畴条件 | **采用** | 下述冻结定义 |

**冻结定义（SUFFICIENCY_DEFINITION）：**

```
候选「证据充分」（eligible for primary）⟺
  candidate.status == SUPPORTED
  AND candidate.dimensionState == STRONG
  ⟺ orientation == DISTORTED AND d_support == 2 AND h_support == 0 AND n_support == 0
  ⟺ D + D（两个独立 D 观测，无 H 反证，无 N 稀释）
```

**三种观测组合必须区分，绝不等同：**

| 组合 | state | 充分性 |
|---|---|---|
| D + D | STRONG | **充分**（2 个独立 D 观测） |
| D + N | MODERATE | **不充分**（1 个方向观测 + 1 中性稀释） |
| D + missing | WEAK | **不充分**（1 个方向观测，覆盖不完整） |

- `D + missing` ≠ `D + D`（missingness 诚实，不因「只有一个 D」而放大）。
- `D + N` ≠ `D + D`（N 不增加方向置信度，R3D §15.2）。
- `D + N` / `D + missing` 均为「方向性但证据不足」→ 不能独立成为 primary（见 §5 决策）。

---

## 5. Primary Without Numeric Score（§6）— 分案裁定

以下「SUPPORTED」默认指其状态；「充分」= D+D（STRONG）。

| Case | 描述 | 裁定 |
|---|---|---|
| A | 恰一个 SUPPORTED（D+D 充分），其余 COUNTERSUPPORTED/INSUFFICIENT | **PRIMARY_ALLOWED** |
| A′ | 恰一个 SUPPORTED 但 D+missing（WEAK）或 D+N（MODERATE） | **INSUFFICIENT_EVIDENCE**（单方向观测不充分） |
| B | 一个 SUPPORTED D+D，另一个 SUPPORTED D+missing | **PRIMARY_ALLOWED**（D+D 唯一充分；D+missing 为次级不充分发现，不竞争） |
| C | 两个 SUPPORTED 均 D+D | 若构成 bank 近邻对 → **FOLLOW_UP_REQUIRED**；否则 → **INSUFFICIENT_EVIDENCE** |
| D | 两个 SUPPORTED：一个 D+D、一个 D+N | **PRIMARY_ALLOWED**（D+D 唯一充分；D+N 次级不充分） |
| E | 一个 SUPPORTED（D+D）、一个 MIXED | **PRIMARY_ALLOWED**（MIXED 排除，不竞争） |
| F | 全部 COUNTERSUPPORTED / INSUFFICIENT（无 SUPPORTED、无 MIXED） | ≥1 COUNTERSUPPORTED → **NO_PRIMARY_DEFICIT**；全 INSUFFICIENT → **INSUFFICIENT_EVIDENCE** |
| G | 全部 INSUFFICIENT | **INSUFFICIENT_EVIDENCE** |
| H | 多个充分 SUPPORTED，且为近邻（bank 对） | **FOLLOW_UP_REQUIRED** |
| I | 多个充分 SUPPORTED，非近邻 | **INSUFFICIENT_EVIDENCE** |

**未强制所有 case 为 PRIMARY_ALLOWED。** 多充分候选在无判别手段时诚实返回 INSUFFICIENT_EVIDENCE，而非伪造胜者。

---

## 6. Counterevidence Contract（§7）— FROZEN

- H 证据 = **显式反证**，绝不作「弱支持」（`blindSpotCandidateEngineV21` §7：`H is explicit counterevidence, never "weak support"`）。
- 一个候选若同时有 D 支持与 H 反证 → orientation = MIXED，`hasContradiction = true`，status = **MIXED**（既非 SUPPORTED，也非 COUNTERSUPPORTED）。
- **MIXED 永不静默变 SUPPORTED。** 有 D 支持的候选在选择 primary 时**不得忽略** H 反证——只要 `h_support > 0`，orientation 即 MIXED，候选即被排除。
- **H+D → 候选排除 primary。** 无平均、无 D−H 算术。矛盾保留（`hasContradiction`），交由后续不确定性层裁决；本层裁决为「排除」。

---

## 7. State Role in Primary（§8）— FROZEN

**`STATE_USED_ONLY_AS_LOCAL_ELIGIBILITY_GATE`**

state 不跨候选排序（`CROSS_CONSTRUCT_STATE_COMPARABILITY = FORBIDDEN`），但可作**构念内本地门控**：

| 本地组合 | primary 资格 |
|---|---|
| DISTORTED + STRONG | 充分（D+D）→ eligible |
| DISTORTED + MODERATE | 不充分（D+N）→ 非 eligible |
| DISTORTED + WEAK | 不充分（D+missing）→ 非 eligible |
| MIXED（任意 state） | 排除（矛盾） |
| HEALTHY（任意 state） | COUNTERSUPPORTED，非 primary |
| NEUTRAL / UNKNOWN | INSUFFICIENT，非 primary |

**这不是 STRONG > MODERATE > WEAK 的排序**——它仅回答「该构念内部证据是否足以支撑一个 primary 盲点」。state **不得**转数值。

---

## 8. Near-Neighbor Contract（§9）

**权威来源 = R1 §H 的 5 组 adaptive discriminating question bank。**（`nearNeighborRelations` 为 A1 未决元数据，**不使用**；`nearNeighborConstructs[]`（R1 §B）为语义邻接元数据，见缺陷声明。）

**NEAR_NEIGHBOR_GROUP_COUNT = 5**：

| # | 构念对 | 盲点对 | 为何歧义 | 判别追问（R1 §H） | 各结果的语义证据（自然语义意图） |
|---|---|---|---|---|---|
| 1 | DECISION ↔ FEEDBACK | DECISION_INERTIA ↔ FEEDBACK_LOOP_GAP | 「不动」vs「动了不回头」 | 「你最近一次行动后，有没有根据结果改过做法？还是只做了、没回头？」 | 「改过做法」→ 反馈健康（H to FEEDBACK）→ FEEDBACK 降为 MIXED，**DECISION_INERTIA** 胜出；「没回头」→ 反馈失真（D to FEEDBACK）且已行动 → **FEEDBACK_LOOP_GAP** 胜出 |
| 2 | PROBABILITY ↔ RISK | PROBABILITY_MISJUDGMENT ↔ RISK_MODEL_DISTORTION | 都属「不确定误判」 | 「同样一个不确定机会，你更纠结的是『有多大概率成』还是『最坏会怎样』？」 | 「多大机会成」→ PROBABILITY 关切 → **PROBABILITY_MISJUDGMENT**；「最坏会怎样」→ RISK 关切 → **RISK_MODEL_DISTORTION** |
| 3 | RISK ↔ TIME | RISK_MODEL_DISTORTION ↔ TIME_HORIZON_TRAP | 都涉「短期偏好」 | 「一个长期方向，短期可能亏。你更在意短期损失，还是长期积累？」 | 「短期损失」→ **RISK_MODEL_DISTORTION**；「长期积累」→ **TIME_HORIZON_TRAP** |
| 4 | IDENTITY ↔ OPPORTUNITY | IDENTITY_CONSTRAINT ↔ OPPORTUNITY_BLINDNESS | 「没遇到」vs「遇到但不像我」 | 「有个跨领域机会，你是『没遇到过』还是『遇到了但觉得不是我能做的』？」 | 「没遇到过」→ **OPPORTUNITY_BLINDNESS**；「遇到但不像我」→ **IDENTITY_CONSTRAINT** |
| 5 | TIME ↔ SYSTEMS | TIME_HORIZON_TRAP ↔ SYSTEM_THINKING_GAP | 都涉「反复无果」 | 「你反复做的事没起色，你会换方向，还是先想是不是做法/条件本身有结构问题？」 | 「换方向」→ **TIME_HORIZON_TRAP**；「先想结构」→ **SYSTEM_THINKING_GAP** |

### 8.1 缺陷声明：FOLLOWUP_MAPPING_CONTRACT_DEFECT

**`FOLLOWUP_MAPPING_COMPLETE = NO`**，原因有二：

1. **形式证据映射缺失**：R1 §H 冻结了判别追问的**文本**与**自然语义判别方向**，但**未冻结**「追问答案 → 证据方向（H/D/N）/ evidenceId / construct」的形式映射。追问不在 `questionnaireV21.js` 内，无 optionId、无 `semanticPropositionRefs`、无 direction。故 follow-up 答案**无法被确定性实现**为维度状态更新以消解近邻歧义。
2. **邻接边覆盖不全**：R1 §B `nearNeighborConstructs[]` 定义 **9 条无向邻接边**，但 §H bank 仅覆盖 5 条。缺失 4 条：`DECISION↔PROBABILITY`、`FEEDBACK↔SYSTEMS`、`LEVERAGE↔TIME`、`LEVERAGE↔OPPORTUNITY`。

**裁定**：§9 要求「若合同未含足够确定性映射 → STOP with FOLLOWUP_MAPPING_CONTRACT_DEFECT」。**触发。**

- 5 组判别追问的**文本 + 语义意图**已冻结（上表），供 operator 审阅。
- 但「追问答案 → 形式证据映射」与「4 条缺失邻接边的判别题」**未冻结** → follow-up **resolution** 当前不可确定性实现。
- 缺失 4 条邻接边上的歧义，与「非近邻多充分候选」同判：**INSUFFICIENT_EVIDENCE**（无判别器）。
- **本缺陷不阻塞无 follow-up 的 primary 选择逻辑**（§5 决策表完全确定性），仅阻塞 follow-up 触发后的**消解**步骤。

---

## 9. Follow-up Limit（§10）— FROZEN

沿用 R3A，无冲突：

```
MAX_FOLLOWUP_COUNT = 1
MAX_FOLLOWUP_QUESTIONS_PER_ROUND = 2
```

一轮后必须终止。允许的终态：`PRIMARY_BLINDSPOT` / `INSUFFICIENT_EVIDENCE` / `NO_PRIMARY_DEFICIT`。**禁止递归问卷、第二轮追问、hash/priority/default 兜底猜 primary。**

---

## 10. Follow-up Triggers（§11）— FROZEN

冻结为**单一确定性触发**：

> **FOLLOW_UP 触发 ⟺ 恰有两个 SUPPORTED 候选均「充分」（D+D/STRONG）且二者构成 5 组 bank 近邻对之一。**

逐项裁定：

| 拟触发条件 | 裁定 |
|---|---|
| 多个 eligible（充分）SUPPORTED 候选 | 仅当恰为 2 个且构成 bank 近邻对 → FOLLOW_UP；否则 INSUFFICIENT_EVIDENCE |
| near-neighbor ambiguity | **唯一核心触发**（bank 近邻对） |
| MIXED contradiction | **不触发 follow-up**（无「内部矛盾消解」追问）；MIXED 排除，若再无充分候选 → INSUFFICIENT_EVIDENCE |
| low evidence coverage | **不触发 follow-up**（无「补齐观测」追问）→ INSUFFICIENT_EVIDENCE |
| contradictory evidence | 同 MIXED |
| candidate equivalence | 2 充分 bank 近邻 → FOLLOW_UP；2 充分非近邻 → INSUFFICIENT_EVIDENCE |
| numeric gap below threshold | **RETIRED**（无数值分数，PRIMARY_SEPARATION 已退役） |

---

## 11. Response Validity Interaction（§12）— FROZEN

R3B 的 response-validity 与认知**平行独立**。本层仅审计交互：

| response-validity 状态 | 认知 primary 选择 |
|---|---|
| RESPONSE_VALID | **允许**（正常执行认知链） |
| RESPONSE_QUALITY_LOW | **禁止** → `NO_PRIMARY` + `RETAKE_RECOMMENDED`，绝不产出 blindSpot |
| INSUFFICIENT_RESPONSE_QUALITY | **禁止** → 同上 |

**冻结原则**：`RESPONSE_QUALITY_LOW` 永不成为认知 deficit。response-validity 阻挡诊断时返回 `RETAKE / insufficient-quality` 结果，**非 blindspot**。response-quality 指标**不得**并入候选分数。

---

## 12. No-Deficit Outcome（§13）— FROZEN

**`NO_PRIMARY_DEFICIT` 定义（必需）：**

```
NO_PRIMARY_DEFICIT ⟺
  |SUPPORTED| == 0
  AND |MIXED| == 0
  AND |COUNTERSUPPORTED| >= 1
```

即：**无任何失真候选（无 SUPPORTED、无 MIXED），且存在健康证据（≥1 COUNTERSUPPORTED）** → 证据充分表明「没有主要认知盲点」，拒绝强制诊断。

覆盖示例：全 9 COUNTERSUPPORTED ✓；无 SUPPORTED + 部分 COUNTERSUPPORTED + 部分 INSUFFICIENT ✓；健康/中性画像 ✓。

---

## 13. Insufficient-Evidence Outcome（§14）— FROZEN

**`INSUFFICIENT_EVIDENCE` 定义（与 NO_PRIMARY_DEFICIT 分离）：**

```
INSUFFICIENT_EVIDENCE ⟺ 无法判「有/无」主要盲点，包括（任一）：
  (a) |SUPPORTED|==0 AND |MIXED|==0 AND |COUNTERSUPPORTED|==0   # 全 INSUFFICIENT，无任何方向证据
  (b) 有 SUPPORTED 但无充分候选（全部 D+missing / D+N）          # 方向性但证据不足
  (c) 有 MIXED 且无充分 SUPPORTED                              # 矛盾无法消解
  (d) 多充分候选不可判别（非 bank 近邻 / 非近邻 / ≥3 充分）        # 证据无法区分候选集
  (e) follow-up 后仍歧义                                        # 一轮未能消解
```

语义区分（冻结）：
- `NO_PRIMARY_DEFICIT` = 「没有发现主要盲点」（有健康证据背书）。
- `INSUFFICIENT_EVIDENCE` = 「证据不足，无法判断」（缺证据或歧义）。

---

## 14. Primary Wording（§15）— FROZEN

即使 `PRIMARY_ALLOWED`，产品措辞**必须保留不确定性**：

- ✅ 可接受：「当前证据最支持的核心盲点是……」「这是当前证据下最值得优先检查的一个认知盲点」。
- ❌ 禁止：「你的核心盲点就是……」（确定性身份断言）。

**冻结语义框架**：Evidence First（先证据后结论）、Explainable（可解释证据链）、Probabilistic（保留不确定性）、Single Theme（单一主题）。**无确定性身份断言。**

---

## 15. Follow-up Does Not Create Fake Certainty（§16）— FROZEN

一次追问答案**可更新证据**，但**不得自动保证 primary**。

追问后：若歧义仍存 → `INSUFFICIENT_EVIDENCE`。**无 ID_OFFSET 兜底、无 ontology priority 兜底、无任意确定性胜者。**

（注：由于 §8.1 缺陷，follow-up 消解的形式映射未冻结；在缺陷解决前，follow-up 触发的路径终点固定为 `INSUFFICIENT_EVIDENCE`，符合本原则的保守方向。）

---

## 16. Exhaustive Decision Table（§17）— COMPLETE

输入符号：`S_suf` = 充分 SUPPORTED（D+D）；`S_insuf` = 不充分 SUPPORTED（D+missing/D+N）；`M` = MIXED；`C` = COUNTERSUPPORTED；`I` = INSUFFICIENT。response-validity 非 `RESPONSE_VALID` 时先于本表返回 RETAKE。

| |S_suf| |S_insuf| | M 存在 | C 存在 | I 存在 | 终态 |
|---|---|---|---|---|---|---|---|
| 0 | 0 | 否 | 是 | 任意 | **NO_PRIMARY_DEFICIT** |
| 0 | 0 | 否 | 否 | 是（全 I） | **INSUFFICIENT_EVIDENCE** (a) |
| 0 | 0 | 是 | 任意 | 任意 | **INSUFFICIENT_EVIDENCE** (c) |
| 0 | ≥1 | 任意 | 任意 | 任意 | **INSUFFICIENT_EVIDENCE** (b) |
| 1 | 0 | 任意 | 任意 | 任意 | **PRIMARY_ALLOWED** |
| 1 | ≥1 | 任意 | 任意 | 任意 | **PRIMARY_ALLOWED**（不充分候选不竞争） |
| 2（bank 近邻对） | 任意 | 任意 | 任意 | 任意 | **FOLLOW_UP_REQUIRED** |
| 2（非 bank / 非近邻） | 任意 | 任意 | 任意 | 任意 | **INSUFFICIENT_EVIDENCE** (d) |
| ≥3 | 任意 | 任意 | 任意 | 任意 | **INSUFFICIENT_EVIDENCE** (d) |

**无未定义行。** 覆盖 0/1/2/3+ SUPPORTED 与 MIXED/COUNTERSUPPORTED/INSUFFICIENT 的全组合，及本地证据消解。

---

## 17. Adversarial Fixtures（§18）— 20 个，语义通过

| # | fixture | 语义输入 | 期望终态 |
|---|---|---|---|
| 1 | clean single blindspot | DECISION D+D，其余 INSUFFICIENT | PRIMARY_ALLOWED |
| 2 | two clear blindspots（非近邻） | DECISION D+D + SYSTEMS D+D | INSUFFICIENT_EVIDENCE |
| 3 | near-neighbor ambiguity | DECISION D+D + FEEDBACK D+D（bank 对） | FOLLOW_UP_REQUIRED |
| 4 | non-neighbor multi-blindspot | DECISION D+D + OPPORTUNITY D+D | INSUFFICIENT_EVIDENCE |
| 5 | H+D contradiction | FEEDBACK H+D（MIXED），无充分 SUPPORTED | INSUFFICIENT_EVIDENCE |
| 6 | D+missing | DECISION D+missing（WEAK），其余 INSUFFICIENT | INSUFFICIENT_EVIDENCE |
| 7 | D+N | IDENTITY D+N（MODERATE），其余 INSUFFICIENT | INSUFFICIENT_EVIDENCE |
| 8 | D+D | FEEDBACK D+D（STRONG），其余 INSUFFICIENT | PRIMARY_ALLOWED |
| 9 | all healthy | 全 COUNTERSUPPORTED | NO_PRIMARY_DEFICIT |
| 10 | all insufficient | 全 INSUFFICIENT | INSUFFICIENT_EVIDENCE |
| 11 | healthy + missing | 部分 COUNTERSUPPORTED + 部分 INSUFFICIENT | NO_PRIMARY_DEFICIT |
| 12 | low response quality | RESPONSE_QUALITY_LOW | RETAKE（无认知 primary） |
| 13 | mechanical straightline | 全 A（entropy=0） | RETAKE（R3B straightline） |
| 14 | follow-up resolves ambiguity | bank 对追问后一方降级 | PRIMARY_ALLOWED（消解后唯一候选） |
| 15 | follow-up fails to resolve | 追问后仍歧义 | INSUFFICIENT_EVIDENCE |
| 16 | same evidenceId from two questions | SC_DEC_01:A + SC_DEC_02:B → DEC_ACTION_LEARNS(H)×2 | h_support=2 → HEALTHY+STRONG → COUNTERSUPPORTED（无欠计数） |
| 17 | two candidates different state enums | 一 D+D（STRONG）+ 一 D+missing（WEAK） | PRIMARY_ALLOWED（state 仅本地门控） |
| 18 | stronger-looking label but counterevidence | 一候选 D 但含 H（MIXED） | 排除；有充分 SUPPORTED 则 PRIMARY_ALLOWED，否则 INSUFFICIENT_EVIDENCE |
| 19 | no forced deficit | 健康画像 | NO_PRIMARY_DEFICIT（不伪造） |
| 20 | no numeric score needed | 全链范畴逻辑 | PRIMARY_ALLOWED（无任何数值分数） |

**ADVERSARIAL_FIXTURE_COUNT = 20，ADVERSARIAL_FIXTURES_PASS_SEMANTIC_REVIEW = YES**（每条均由范畴逻辑推导，无数值分数介入）。

---

## 18. Numeric-Score Prohibition（§19）— FROZEN

| 项 | 裁定 |
|---|---|
| CANDIDATE_NUMERIC_SCORE | **FORBIDDEN** |
| STATE_TO_NUMBER | **FORBIDDEN** |
| D_MINUS_H_SCORE | **FORBIDDEN** |
| WEIGHTED_EVIDENCE_SCORE | **FORBIDDEN** |
| PSEUDO_PROBABILITY | **FORBIDDEN** |
| ID_OFFSET | **FORBIDDEN**（仅可作列表稳定排序，绝不作语义 primary） |
| ONTOLOGY_PRIORITY_TIEBREAK | **FORBIDDEN** |

若 primary 无法在不使用上述任何机制下选出 → 返回歧义（INSUFFICIENT_EVIDENCE / NO_PRIMARY_DEFICIT），**不伪造胜者**。

---

## 19. Threshold Disposition（§20）

| 阈值 | 处置 | 语义 |
|---|---|---|
| PRIMARY_SEPARATION_PROVISIONAL_0_5 | **RETIRE** | 数值 gap 比较，与范畴架构不兼容 |
| PRIMARY_SUFFICIENCY_PROVISIONAL_2 | **REDEFINE** | 数值常数 `2` 退役；概念重定义为范畴条件 `SUPPORTED ∧ state==STRONG`（D+D，两个独立 D 观测） |

无「无证据的数值重解释」。

---

## 20. Supersession Relationships（显式记录）

| 被取代项 | 来源 | 处置 |
|---|---|---|
| R1 §G strength 语义（≥2 evidence / MODERATE 弱中性） | R1 | 已被 R3D §10 RETIRE/REINTERPRET |
| R1 §I PRIMARY_SEPARATION_THRESHOLD 0.08 | R1 | 已被 R2/R3 归一度量取代；本 ADR RETIRE |
| R1 §I PRIMARY_SUFFICIENCY_THRESHOLD 0.25 | R1 | 同上；本 ADR RETIRE |
| R2 §选定阈值 0.5/2（PROVISIONAL_CALIBRATED） | R2 | 本 ADR RETIRE(0.5) / REDEFINE(2) |
| R3 §G PRIMARY_SEPARATION/SUFFICIENCY_PROVISIONAL（PROVISIONAL_SHADOW） | R3 | 本 ADR RETIRE(0.5) / REDEFINE(2) |
| R1 §H 4 触发（含 PRIMARY_SEPARATION 触发） | R1 | 本 ADR 冻结为单触发（bank 近邻对），PRIMARY_SEPARATION 触发退役 |
| ADR-C3-002B within-family blind spot selection（numeric rawGap/confidence/supportStrength） | C3（V1 旧层级推理） | 本 ADR 明确 V2.1 范畴路径取代 V1 数值路径 |

**历史 R1–R3D 文档原文未修改。**

---

## 21. Final Gate

```
CANONICAL_HEAD_VERIFIED                  = YES (231487bf13e1e6bf052ce3fd8bf295ecf86f99a2)
SEPARATION_0_5_DISPOSITION               = RETIRE
SUFFICIENCY_2_DISPOSITION                = REDEFINE
PRIMARY_SELECTION_MODEL                  = QUALITATIVE_DOMINANCE (categorical)
NUMERIC_SCORE_REQUIRED                   = NO
NUMERIC_SCORE_FORBIDDEN                  = YES
SUFFICIENCY_DEFINITION_FROZEN            = YES
STATE_ROLE_IN_PRIMARY                    = STATE_USED_ONLY_AS_LOCAL_ELIGIBILITY_GATE
COUNTEREVIDENCE_ROLE_FROZEN              = YES
MIXED_ROLE_FROZEN                        = YES (excluded, never silent SUPPORTED)
NO_PRIMARY_DEFICIT_DEFINED               = YES
INSUFFICIENT_EVIDENCE_DEFINED            = YES
NEAR_NEIGHBOR_GROUP_COUNT                = 5
FOLLOWUP_MAPPING_COMPLETE                = NO  (FOLLOWUP_MAPPING_CONTRACT_DEFECT)
MAX_FOLLOWUP_COUNT                       = 1
MAX_FOLLOWUP_QUESTIONS_PER_ROUND         = 2
FOLLOWUP_TRIGGER_RULES_FROZEN            = YES
FOLLOWUP_TERMINATION_RULE_FROZEN         = YES
RESPONSE_VALIDITY_INTERACTION_FROZEN     = YES
DECISION_TABLE_COMPLETE                  = YES
ADVERSARIAL_FIXTURE_COUNT                = 20
ADVERSARIAL_FIXTURES_PASS_SEMANTIC_REVIEW = YES
FORCED_DEFICIT_PATHS                     = 0
ID_OFFSET_PATHS                          = 0
ONTOLOGY_PRIORITY_TIEBREAK_PATHS         = 0
PSEUDO_PROBABILITY_PATHS                 = 0
PRIMARY_WORDING_FROZEN                   = YES

CONTRACT_AMBIGUITIES_REMAINING = FOLLOWUP_MAPPING_CONTRACT_DEFECT：
  1) 5 组判别追问文本已冻结，但「追问答案 → 形式证据方向(H/D/N)/evidenceId」映射未冻结；
  2) R1 §B nearNeighborConstructs[] 的 9 条邻接边中 4 条（DEC-PROB / FB-SYS / LEV-TIME / LEV-OPP）无判别追问。

A5_CONTRACT_READY_FOR_ACCEPTANCE          = NO   # 阻塞于 follow-up 消解映射缺陷；其余全部冻结
READY_FOR_STAGE19A5_IMPLEMENTATION        = NO

RESULT = A5_PRIMARY_SELECTION_FROZEN__FOLLOWUP_MAPPING_CONTRACT_DEFECT
```

**STOP。** 未改 runtime、未改 R1–R3D 历史文档、未 commit、未 push、未 deploy。

---

# A5.1 — Follow-up Discrimination Contract Repair（规范性增编）

> **Status:** CONTRACT REPAIR（design only）。本增编修复 A5 §8.1 报告的 `FOLLOWUP_MAPPING_CONTRACT_DEFECT`，**不改动** A5 已冻结的 primary eligibility / D+D sufficiency / state / candidate status / NO_PRIMARY_DEFICIT / INSUFFICIENT_EVIDENCE / numeric-score 禁令。
> **Authority:** A5.1 > A5 > R3D > R3C > R3B > R3A > R3 > R2 > R1（仅在 follow-up 判别映射范围内 override）。

---

## A5.1-0. Scope

本增编只解决两件事：

1. 9 条近邻边中，哪些是 **FOLLOWUP_RELEVANT**（需判别追问），哪些是 **STRUCTURAL_NEIGHBOR_ONLY**（本体邻接，不触发追问）。
2. 每条保留追问的 **答案 → 原子语义证据 → construct 方向 → 候选更新 → primary 资格重估** 的确定性形式映射。

**不重开** A5 已冻结项。**不自动为 4 条未覆盖边新增追问。**

---

## A5.1-1. Edge Classification（§2/§3 — 全部 9 条边）

分类定义：

- **FOLLOWUP_RELEVANT**：两 construct 均可独立 D+D；其同时 D+D 代表**真正的解释歧义**（同一潜在因果模型的两种可混淆表现）；且存在一个可区分因果模型的场景。
- **STRUCTURAL_NEIGHBOR_ONLY**：本体邻接（语义相关），但同时 D+D 代表**两个独立存在的真问题**，非单一模型的歧义；无判别器 → 不追问。
- **OBSOLETE/SUPERSEDED**：无。
- **CONTRACT_DEFECT**：无（本增编修复后）。

| # | A | B | 盲点 A | 盲点 B | 来源 | 为何原邻接 | 双 D+D? | 同时 eligible 真歧义? | 判别器? | 分类 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | DECISION | FEEDBACK | DECISION_INERTIA | FEEDBACK_LOOP_GAP | R1 §B/§H | 都表现为「不迭代」（不动 vs 动了不回头） | YES | YES | YES | **FOLLOWUP_RELEVANT** |
| 2 | DECISION | PROBABILITY | DECISION_INERTIA | PROBABILITY_MISJUDGMENT | R1 §B | 都属「确定性依赖」 | YES | NO（行动门槛 vs 概率估计，两个独立问题） | NO | **STRUCTURAL_NEIGHBOR_ONLY** |
| 3 | FEEDBACK | SYSTEMS | FEEDBACK_LOOP_GAP | SYSTEM_THINKING_GAP | R1 §B | 都涉「外部信息处理」 | YES | NO（反馈更新 vs 因果归因，两个独立机制） | NO | **STRUCTURAL_NEIGHBOR_ONLY** |
| 4 | PROBABILITY | RISK | PROBABILITY_MISJUDGMENT | RISK_MODEL_DISTORTION | R1 §B/§H | 都属「不确定误判」 | YES | YES（估计维度 vs 下行维度） | YES | **FOLLOWUP_RELEVANT** |
| 5 | RISK | TIME | RISK_MODEL_DISTORTION | TIME_HORIZON_TRAP | R1 §B/§H | 都表现为「短期导向」 | YES | YES（怕损失 vs 没耐心） | YES | **FOLLOWUP_RELEVANT** |
| 6 | LEVERAGE | TIME | LEVERAGE_MODEL_GAP | TIME_HORIZON_TRAP | R1 §B | 都涉「时间」 | YES | NO（价值=时间模型 vs 时间分配模型） | NO | **STRUCTURAL_NEIGHBOR_ONLY** |
| 7 | LEVERAGE | OPPORTUNITY | LEVERAGE_MODEL_GAP | OPPORTUNITY_BLINDNESS | R1 §B | 都涉「资源/机会」 | YES | NO（价值模型 vs 暴露模型） | NO | **STRUCTURAL_NEIGHBOR_ONLY** |
| 8 | IDENTITY | OPPORTUNITY | IDENTITY_CONSTRAINT | OPPORTUNITY_BLINDNESS | R1 §B/§H | 都表现为「机会缺失」（没遇到 vs 不像我） | YES | YES | YES | **FOLLOWUP_RELEVANT** |
| 9 | TIME | SYSTEMS | TIME_HORIZON_TRAP | SYSTEM_THINKING_GAP | R1 §B/§H | 都表现为「反复无果」（换方向 vs 归因） | YES | YES | YES | **FOLLOWUP_RELEVANT** |

**归一化结果：**

```
FOLLOWUP_RELEVANT_EDGE_SET = { DEC↔FB, PROB↔RISK, RISK↔TIME, ID↔OPP, TIME↔SYS }   (5)
STRUCTURAL_NEIGHBOR_EDGE_SET = { DEC↔PROB, FB↔SYS, LEV↔TIME, LEV↔OPP }            (4)
RETIRED_EDGE_SET = {}                                                               (0)
```

**primary 引擎仅用 `FOLLOWUP_RELEVANT_EDGE_SET` 触发追问。** 结构邻接不自动触发用户提问。

---

## A5.1-2. 4 条未覆盖边裁定（§14）

| 边 | 裁定 | 语义依据 |
|---|---|---|
| DECISION ↔ PROBABILITY | **FOLLOWUP_NOT_REQUIRED** | 「行动门槛」与「概率估计」是两个独立因果模型；同时 D+D = 两个独立盲点，非单一模型歧义 |
| FEEDBACK ↔ SYSTEMS | **FOLLOWUP_NOT_REQUIRED** | 「反馈更新模型」与「因果归因模型」独立；无判别器 |
| LEVERAGE ↔ TIME | **FOLLOWUP_NOT_REQUIRED** | 「价值与时间解耦」与「时间复利分配」独立；无判别器 |
| LEVERAGE ↔ OPPORTUNITY | **FOLLOWUP_NOT_REQUIRED** | 「价值创造模型」与「机会暴露模型」独立；无判别器 |

**无 NEW_FOLLOWUP_REQUIRED。无 EDGE_RETIRED。** 4 条边均保留为结构邻接，仅不触发追问。同时 D+D 时 → 见 A5.1-10（MULTIPLE_SUPPORTED_MODELS）。

---

## A5.1-3. 证据命名空间（§5）

**FOLLOWUP_EVIDENCE_NAMESPACE = DEDICATED_V2_1_FOLLOWUP_EVIDENCE**（选项 B：专用命名空间）。

理由：

- 追问场景与 18 道基础题场景**语义不同**；复用基础 evidenceId 会(a)把不同观测合并到同一 evidenceId，(b)使追问被误当作基础 support unit（违反 §6）。
- 专用命名空间从根上隔离「基础问卷观测」与「判别追问观测」。

**NEW_FOLLOWUP_EVIDENCE_COUNT = 10**（5 组 × 2 选项）。每条新证据字段：`evidenceId / construct / direction(H|D|N) / semanticProposition / distortionType(仅 D) / sourceFollowupId`。

> 注：判别追问证据的 `direction=D` 语义 = 「该答案揭示此 construct 的**失真模型为运作中模型**」，其 `distortionType` 仅在答案映射到具体失真机制时非空；维度级判别器（如「纠结概率」）`distortionType = null`。此 null 仅出现在**追问命名空间**，基础 evidenceCatalog 的 D 证据不受影响。

---

## A5.1-4. 5 组追问形式映射（§4 — 确定性）

### 组 1 — FU_DEC_FB（DECISION ↔ FEEDBACK）— REWRITTEN（supersede R1 §H 文本）

原文本缺陷（A5.1-R1 发现）：两选项「改过做法 / 没回头」均只测 FEEDBACK 维度；且「改过做法」为 `H(FEEDBACK)` → 只能通过排除 FEEDBACK 补集推断 DECISION，违反 `NOT_A_DOES_NOT_IMPLY_B`。**重写为对称 D/D 正向判别器：**

场景（重写）：「回看你最近想做但一直没推进的一件事，更接近哪种情况？」

| option | → evidenceId | construct | direction | distortionType | semanticProposition | 消解 |
|---|---|---|---|---|---|---|
| A「还没开始，因为总觉得没想清楚、没把握」 | FU_DEC_FB_CERTAINTY_GATE | DECISION | D | certainty-gate | 决策受确定性门槛阻碍，迟迟未启动 | 正向判别 DECISION → **DECISION_INERTIA** primary |
| B「开始了，但做一段就放下，没再复盘调整」 | FU_DEC_FB_NO_REVIEW | FEEDBACK | D | feedback-inert | 行动后不回顾不调整（无复盘闭环） | 正向判别 FEEDBACK → **FEEDBACK_LOOP_GAP** primary |

### 组 2 — FU_PROB_RISK（PROBABILITY ↔ RISK）— 保留 R1 §H 文本

场景：「同样一个不确定机会，你更纠结的是『有多大概率成』还是『最坏会怎样』？」

| option | → evidenceId | construct | direction | distortionType | semanticProposition | 消解 |
|---|---|---|---|---|---|---|
| A「有多大概率成」 | FU_PROB_RISK_PROB_FOCUS | PROBABILITY | D | null（维度级） | 纠结于概率大小（概率维度主导） | **PROBABILITY_MISJUDGMENT** primary |
| B「最坏会怎样」 | FU_PROB_RISK_RISK_FOCUS | RISK | D | loss-aversion | 纠结于最坏情况（下行维度主导） | **RISK_MODEL_DISTORTION** primary |

### 组 3 — FU_RISK_TIME（RISK ↔ TIME）— REWRITTEN（supersede R1 §H 文本）

原文本缺陷：第二选项「长期积累」映射**健康 TIME**，无法揭示 THT（没耐心）→ 不对称，THT 永不可解。**重写为对称判别器：**

场景（重写）：「一个长期方向，短期可能亏。你更可能？」

| option | → evidenceId | construct | direction | distortionType | semanticProposition | 消解 |
|---|---|---|---|---|---|---|
| A「怕短期亏，先观望再说」 | FU_RISK_TIME_LOSS_AVOID | RISK | D | loss-aversion | 怕短期亏损而回避（下行回避） | **RISK_MODEL_DISTORTION** primary |
| B「会开始，但短期没效果就容易换」 | FU_RISK_TIME_IMPATIENT | TIME | D | direction-unstable | 短期无果即换方向（没耐心） | **TIME_HORIZON_TRAP** primary |

### 组 4 — FU_ID_OPP（IDENTITY ↔ OPPORTUNITY）— 保留 R1 §H 文本

场景：「有个跨领域机会，你是『没遇到过』还是『遇到了但觉得不是我能做的』？」

| option | → evidenceId | construct | direction | distortionType | semanticProposition | 消解 |
|---|---|---|---|---|---|---|
| A「没遇到过」 | FU_ID_OPP_NO_ENCOUNTER | OPPORTUNITY | D | narrow-exposure | 从未遇到跨领域机会（接触面窄） | **OPPORTUNITY_BLINDNESS** primary |
| B「遇到了但觉得不是我能做的」 | FU_ID_OPP_NOT_ME | IDENTITY | D | boundary-fixed | 遇到但觉得不像自己能做（边界固定） | **IDENTITY_CONSTRAINT** primary |

### 组 5 — FU_TIME_SYS（TIME ↔ SYSTEMS）— REWRITTEN（supersede R1 §H 文本）

原文本缺陷：第二选项「先想结构」映射**健康 SYSTEMS**，无法揭示 STG（人事/事件归因）→ 不对称，STG 永不可解。**重写为对称判别器：**

场景（重写）：「你反复做的事没起色，你更可能？」

| option | → evidenceId | construct | direction | distortionType | semanticProposition | 消解 |
|---|---|---|---|---|---|---|
| A「换个方向试试」 | FU_TIME_SYS_SWITCH | TIME | D | direction-unstable | 无果即换方向（方向不稳定） | **TIME_HORIZON_TRAP** primary |
| B「觉得主要是执行的人的问题」 | FU_TIME_SYS_PERSON | SYSTEMS | D | person-attribution | 归因于执行的人（人事归因） | **SYSTEM_THINKING_GAP** primary |

**映射链（冻结）：** 追问答案 → 专用原子证据 → construct 方向 → 候选更新 → primary 资格重估。**禁止** 答案 → 胜者直连。**DIRECT_OPTION_TO_WINNER_EDGES = 0。**

---

## A5.1-5. 判别 vs 充分性（§6 — FROZEN）

**FOLLOWUP_IS_DISCRIMINATOR_NOT_SUFFICIENCY_INFLATOR = YES**

追问证据的角色（§6 选项 C + D）：

- **仅作「已 eligible 候选之间的判别器」**（§6 C）。
- **不得**把 `D + missing` 提升为 `D + D` primary eligible（§6 反例）。
- **不得**把 `D + N` 提升为 `D + D`。
- **不得**把 MIXED 变为 eligible。
- primary eligibility 仍基于冻结的基础问卷 D+D 规则；追问证据**绝不**计入基础 support unit。

**FOLLOWUP_INDEPENDENT_SUPPORT_UNIT = unique followupQuestionId**（§10）。一个追问答案即使语义影响两 construct，仍是**一个观测**，不计为两个独立支持观测。

---

## A5.1-6. 双 eligible 前置 + 3+ 终态（§7 — FROZEN）

```
ELIGIBLE_COUNT == 0  → A5 基础终态规则（NO_PRIMARY_DEFICIT / INSUFFICIENT_EVIDENCE）
ELIGIBLE_COUNT == 1  → PRIMARY_ALLOWED（无追问）
ELIGIBLE_COUNT == 2  AND pair ∈ FOLLOWUP_RELEVANT_EDGE_SET → FOLLOW_UP_REQUIRED
ELIGIBLE_COUNT == 2  AND pair ∉ FOLLOWUP_RELEVANT_EDGE_SET → INSUFFICIENT_EVIDENCE（MULTIPLE_SUPPORTED_MODELS）
ELIGIBLE_COUNT >= 3  → INSUFFICIENT_EVIDENCE（一轮 ≤2 题无法诚实消解全局歧义；无 tournament ranking）
```

**3+ eligible 保守默认 = INSUFFICIENT_EVIDENCE**，除非 ≤2 题判别覆盖被形式证明（当前未证明 → 不证明）。

---

## A5.1-7. 消解语义（§8 — FROZEN）

追问前：A eligible，B eligible。

追问后允许的消解（三值）：

```
A_PRIMARY
B_PRIMARY
UNRESOLVED
```

`BOTH_REMAIN_PLAUSIBLE` 归一化为 `UNRESOLVED` → `INSUFFICIENT_EVIDENCE`。

**无 A=0.7 / B=0.3 式分数。无概率。无 tie-break。**

形式消解规则（A5.1-R1 修正 — 正向判别，无补集推断）：

```
option → e(construct=C, direction=d)
  d == D  → 正向判别 C 的失真模型为运作中模型 → primary = C
  d == H  → 仅消除 C，不自动确立 other(C) → UNRESOLVED → INSUFFICIENT_EVIDENCE
  d == N 或 无映射（missing answer）→ UNRESOLVED → INSUFFICIENT_EVIDENCE
```

> 注：A5.1-R1 已将所有 10 个选项归一为 `D`（正向判别）；当前无 `H` 选项。`d == H` 分支保留为语义护栏——**H 仅消除一个解释，绝不自动确立其对立面**（`NOT_A_DOES_NOT_IMPLY_B = YES`）。

---

## A5.1-8. 反证角色（§9 — FROZEN）

追问答案可为**语义反证**，但**不要求人为对称**：

- 组 1–5 **全部**采用「D on A / D on B」的对称正向判别映射（每选项指一方，无补集推断）。
- 无「每一选项都必须同时 A-support + B-counter」的人为对称要求。
- 无「H(一方) → 另一方 primary」的补集推断（`NOT_A_DOES_NOT_IMPLY_B = YES`）。

---

## A5.1-9. 追问题数（§11 — FROZEN）

**MINIMAL_DISCRIMINATOR_PRINCIPLE**：每对**只用 1 题**（2 选项）——两候选成对歧义，单一强制选择场景足以揭示运作模型。

`MAX_FOLLOWUP_COUNT = 1`、`MAX_FOLLOWUP_QUESTIONS_PER_ROUND = 2` 沿用 R3A。当前设计每对 1 题，MAX=2 为安全上界（当前无可达的 2 题场景：3+ eligible → INSUFFICIENT_EVIDENCE，不再追问）。

---

## A5.1-10. 产品语义（§17 — FROZEN）

两个独立充分、非近邻的盲点**不是「歧义」**，而是「多个真实问题、无诚实唯一 primary」。

```
MULTIPLE_SUPPORTED_MODELS
→ 用户可感知终态归一化为 INSUFFICIENT_EVIDENCE（对 SINGLE-THEME 诊断）
```

不假装必须有一个胜者。

---

## A5.1-11. 追问措辞原则（§18 — FROZEN）

> 追问 UI 不得暗示「我们已经发现你有两个问题」。

**冻结措辞原则**：「目前有两种解释都得到支持，再看一个情境，帮助判断哪种解释更接近你的决策方式。」

**FOLLOWUP_WORDING_PRINCIPLE_FROZEN = YES。**

---

## A5.1-12. Gaming / 模型 vs 行为（§12/§13 — 审计）

| 组 | 选项 | gaming 风险 | 是否揭示因果模型（非仅行为） |
|---|---|---|---|
| 1（重写） | 「没把握没开始 vs 做了没复盘」 | LOW | 是（确定性门槛 vs 无复盘闭环） |
| 2 | 「概率 vs 最坏」 | LOW | 是（估计维度 vs 下行维度） |
| 3（重写） | 「怕亏观望 vs 没效果就换」 | LOW | 是（下行回避 vs 没耐心） |
| 4 | 「没遇到 vs 不像我」 | LOW | 是（暴露模型 vs 身份边界模型） |
| 5（重写） | 「换方向 vs 觉得执行的人的问题」 | **MEDIUM**（人事归因社会期许负向，措辞已收紧） | 是（方向切换 vs 人事归因） |

```
HIGH_GAMING_RISK_COUNT   = 0
MEDIUM_GAMING_RISK_COUNT = 1
```

HIGH=0 → 不阻塞验收。追问是「两 already-distorted 候选间的判别器」，gaming 仅转移 primary 归属，不制造 deficit，风险天然低于基础问卷。

---

## A5.1-13. 对抗性夹具（§19 — 20 个，语义通过）

| # | fixture | 期望终态 |
|---|---|---|
| 1 | eligible DEC+FB，追问「做了没复盘」→ 正向判别 FEEDBACK | PRIMARY_BLINDSPOT = FEEDBACK_LOOP_GAP |
| 2 | eligible DEC+FB，追问「没把握没开始」→ 正向判别 DECISION | PRIMARY_BLINDSPOT = DECISION_INERTIA |
| 3 | eligible DEC+FB，追问 missing → UNRESOLVED | INSUFFICIENT_EVIDENCE |
| 4 | eligible DEC+PROB（非 relevant 对） | INSUFFICIENT_EVIDENCE（MULTIPLE_SUPPORTED_MODELS） |
| 5 | 3 eligible（DEC+FB+PROB） | INSUFFICIENT_EVIDENCE |
| 6 | D+missing 候选不被追问提升 | INSUFFICIENT_EVIDENCE（不触发追问） |
| 7 | D+N 候选不被追问提升 | INSUFFICIENT_EVIDENCE（不触发追问） |
| 8 | MIXED 候选不因追问变 eligible | 排除（不触发追问） |
| 9 | 一追问答案语义触两 construct，仍一个观测 | 1 观测（非 2 support unit） |
| 10 | 无数值分数 | 全链范畴逻辑 |
| 11 | 无 ID_OFFSET | ID_OFFSET_PATHS=0 |
| 12 | 无 ontology priority | ONTOLOGY_PRIORITY_PATHS=0 |
| 13 | 无第二轮追问 | 一轮终止 |
| 14 | 全 healthy | NO_PRIMARY_DEFICIT（不追问） |
| 15 | 全 insufficient | INSUFFICIENT_EVIDENCE（不追问） |
| 16 | 1 eligible | PRIMARY_ALLOWED（不追问） |
| 17 | response-quality-low | RETAKE（无认知追问） |
| 18 | 追问答案 missing | INSUFFICIENT_EVIDENCE |
| 19 | display order 不变 | COGNITIVE_INFERENCE_DIFF=0 |
| 20 | semantic option order 不变 | 消解结果不变 |

**ADVERSARIAL_FIXTURE_COUNT = 20，ADVERSARIAL_FIXTURE_PASS = YES。**

---

## A5.1-14. Supersession（本增编新增）

| 被取代项 | 来源 | 处置 |
|---|---|---|
| R1 §H 组 DECISION↔FEEDBACK 追问文本「行动后有没有改过做法？」 | R1 §H | **REWRITE**（A5.1-R1：单向 FEEDBACK 判别 + H(FB)→DEC 补集推断，违反 NOT_A_DOES_NOT_IMPLY_B） |
| R1 §H 组 RISK↔TIME 追问文本「更在意短期损失，还是长期积累？」 | R1 §H | **REWRITE**（不对称缺陷：无法揭示 THT） |
| R1 §H 组 TIME↔SYSTEMS 追问文本「换方向，还是先想结构问题？」 | R1 §H | **REWRITE**（不对称缺陷：无法揭示 STG） |
| A5 §8.1 `FOLLOWUP_MAPPING_COMPLETE = NO` | A5 | **SUPERSEDED** → A5.1 置 YES |
| A5 §21 `A5_CONTRACT_READY_FOR_ACCEPTANCE = NO` | A5 | **SUPERSEDED** → A5.1 置 YES |
| A5.1-7 消解规则「d==H → other(C) primary」 | A5.1 | **SUPERSEDED**（A5.1-R1：H 仅消除，不自动确立对立面） |

R1–R3D 历史文档原文未修改（追问文本重写仅记录于本增编）。

---

## A5.1-15. Final Gate

```
CANONICAL_HEAD                            = 231487bf13e1e6bf052ce3fd8bf295ecf86f99a2

ORIGINAL_NEAR_NEIGHBOR_EDGE_COUNT         = 9
FOLLOWUP_RELEVANT_EDGE_COUNT              = 5
STRUCTURAL_NEIGHBOR_ONLY_EDGE_COUNT       = 4
RETIRED_EDGE_COUNT                        = 0

UNCOVERED_EDGE_DECISION_PROBABILITY       = FOLLOWUP_NOT_REQUIRED (STRUCTURAL_NEIGHBOR_ONLY)
UNCOVERED_EDGE_FEEDBACK_SYSTEMS           = FOLLOWUP_NOT_REQUIRED (STRUCTURAL_NEIGHBOR_ONLY)
UNCOVERED_EDGE_LEVERAGE_TIME              = FOLLOWUP_NOT_REQUIRED (STRUCTURAL_NEIGHBOR_ONLY)
UNCOVERED_EDGE_LEVERAGE_OPPORTUNITY       = FOLLOWUP_NOT_REQUIRED (STRUCTURAL_NEIGHBOR_ONLY)

EXISTING_FOLLOWUP_GROUP_COUNT             = 5
NEW_FOLLOWUP_GROUP_COUNT                  = 0
FINAL_FOLLOWUP_GROUP_COUNT                = 5

FOLLOWUP_MAPPING_COMPLETE                 = YES
FOLLOWUP_OPTION_TO_EVIDENCE_MAPPING_COMPLETE = YES

FOLLOWUP_EVIDENCE_NAMESPACE               = DEDICATED_V2_1_FOLLOWUP_EVIDENCE
NEW_FOLLOWUP_EVIDENCE_COUNT               = 10

FOLLOWUP_IS_DISCRIMINATOR_NOT_SUFFICIENCY_INFLATOR = YES
FOLLOWUP_INDEPENDENT_SUPPORT_UNIT         = unique followupQuestionId

ELIGIBLE_COUNT_0_RULE                     = A5 基础终态规则
ELIGIBLE_COUNT_1_RULE                     = PRIMARY_ALLOWED
ELIGIBLE_COUNT_2_RELEVANT_RULE            = FOLLOW_UP_REQUIRED
ELIGIBLE_COUNT_2_NONRELEVANT_RULE         = INSUFFICIENT_EVIDENCE (MULTIPLE_SUPPORTED_MODELS)
ELIGIBLE_COUNT_3PLUS_RULE                 = INSUFFICIENT_EVIDENCE

MAX_FOLLOWUP_COUNT                        = 1
MAX_FOLLOWUP_QUESTIONS_PER_ROUND          = 2

HIGH_GAMING_RISK_COUNT                    = 0
MEDIUM_GAMING_RISK_COUNT                  = 1

DIRECT_OPTION_TO_WINNER_EDGES             = 0
SUFFICIENCY_INFLATION_PATHS               = 0
NUMERIC_SCORE_PATHS                       = 0
ID_OFFSET_PATHS                           = 0
ONTOLOGY_PRIORITY_PATHS                   = 0
COMPLEMENT_INFERENCE_PATHS                = 0
H_ONLY_TO_OTHER_PRIMARY_PATHS             = 0

DECISION_TABLE_COMPLETE                   = YES
ADVERSARIAL_FIXTURE_COUNT                 = 20
ADVERSARIAL_FIXTURE_PASS                  = YES

FOLLOWUP_WORDING_PRINCIPLE_FROZEN         = YES

CONTRACT_AMBIGUITIES_REMAINING            = NONE（A5.1 范围内）

A5_CONTRACT_READY_FOR_ACCEPTANCE          = YES
READY_FOR_STAGE19A5_IMPLEMENTATION        = NO

RESULT = A5_1_FOLLOWUP_DISCRIMINATION_CONTRACT_REPAIR_FROZEN
```

> **A5.1-R1 修订声明：** 本节 A5.1-15 的 `MEDIUM_GAMING_RISK_COUNT`、`RESULT` 与消解规则已被下方 A5.1-R1（Follow-up Semantic Closure）部分取代。以 A5.1-R1 的最终门禁为准。

**STOP。** 未改 runtime、未改 R1–R3D 历史文档、未 commit、未 push、未 deploy。

---

# A5.1-R1 — Follow-up Semantic Closure（发布前最终语义审计）

> **Status:** CONTRACT SPOT AUDIT / REPAIR（design only）。
> **Authority:** A5.1-R1 > A5.1 > A5 > R3D > R3C > R3B > R3A > R3 > R2 > R1（仅在 follow-up 消解语义范围内 override）。
> **目的：** 发布前核查是否有任何追问映射错误假设「对 A 的反证 = 对 B 的正证」。

---

## A5.1-R1-1. Critical Rule — FROZEN

```
NOT_A_DOES_NOT_IMPLY_B = YES
```

- `H(A)` 只意味着「对 A 的反证」，**不等于**「B 的正证」。
- `H(A)` 只有在**同一选项的语义命题独立提供了有利于 B 的判别证据**时，才可消解向 B。
- 同理 `H(B)` 不自动推出 A。
- 仅消除一个解释的选项 → `UNRESOLVED` → `INSUFFICIENT_EVIDENCE`。

```
FOLLOWUP_RESOLUTION_REQUIRES_POSITIVE_DISCRIMINATION = YES
```

**合法消解：**

```
A_PRIMARY  ⟺ 追问语义正向判别「A 模型」为运作中模型（不只是 B 收到 H）
B_PRIMARY  ⟺ 追问语义正向判别「B 模型」为运作中模型（不只是 A 收到 H）
UNRESOLVED ⟺ 任何其它情况（含仅消除一方、missing answer）
```

**非法（补集推断）：**

```
✗ option → H(B) → 因此 A_PRIMARY
✗ option → H(A) → 因此 B_PRIMARY
```

---

## A5.1-R1-2. 审计发现

**缺陷 1（阻断）：** A5.1 原组 1（FU_DEC_FB）选项 A「改过做法」映射为 `H(FEEDBACK)`，消解写为「FEEDBACK 排除 → DECISION_INERTIA primary」——这是 `H(B) → A primary` 的补集推断，违反 `NOT_A_DOES_NOT_IMPLY_B`。

**缺陷 2：** A5.1-7 消解规则「`d == H → primary = other(C)`」本身就是补集推断。

**修复：**
1. 组 1 重写为对称 D/D 正向判别器（见 A5.1-4 修订）。
2. 消解规则改为正向判别（见 A5.1-7 修订）：`d == H → UNRESOLVED`。
3. 组 5 选项 B 措辞收紧（「觉得执行的人不行，换人」→「觉得主要是执行的人的问题」），降低社会期许负向。

---

## A5.1-R1-3. 10 选项逐项审计

| followupId | optionId | semanticProposition | 对 A（首 construct） | 对 B（次 construct） | evidenceId | distortionType | RESOLUTION |
|---|---|---|---|---|---|---|---|
| FU_DEC_FB | A | 没把握没开始（确定性门槛） | D(DECISION) | NONE | FU_DEC_FB_CERTAINTY_GATE | certainty-gate | A_PRIMARY（正向判别 DECISION） |
| FU_DEC_FB | B | 做了没复盘（无复盘闭环） | NONE | D(FEEDBACK) | FU_DEC_FB_NO_REVIEW | feedback-inert | B_PRIMARY（正向判别 FEEDBACK） |
| FU_PROB_RISK | A | 纠结概率大小 | D(PROBABILITY) | NONE | FU_PROB_RISK_PROB_FOCUS | null（维度级） | A_PRIMARY |
| FU_PROB_RISK | B | 纠结最坏情况 | NONE | D(RISK) | FU_PROB_RISK_RISK_FOCUS | loss-aversion | B_PRIMARY |
| FU_RISK_TIME | A | 怕短期亏损回避 | D(RISK) | NONE | FU_RISK_TIME_LOSS_AVOID | loss-aversion | A_PRIMARY |
| FU_RISK_TIME | B | 短期无果即换方向 | NONE | D(TIME) | FU_RISK_TIME_IMPATIENT | direction-unstable | B_PRIMARY |
| FU_ID_OPP | A | 从未遇到跨领域机会 | NONE | D(OPPORTUNITY) | FU_ID_OPP_NO_ENCOUNTER | narrow-exposure | B_PRIMARY |
| FU_ID_OPP | B | 遇到但觉得不像自己能做 | D(IDENTITY) | NONE | FU_ID_OPP_NOT_ME | boundary-fixed | A_PRIMARY |
| FU_TIME_SYS | A | 无果即换方向 | D(TIME) | NONE | FU_TIME_SYS_SWITCH | direction-unstable | A_PRIMARY |
| FU_TIME_SYS | B | 归因于执行的人 | NONE | D(SYSTEMS) | FU_TIME_SYS_PERSON | person-attribution | B_PRIMARY |

**结论：**

- 全部 10 选项均为 `D`（正向判别）某单一 construct，**无 `H` 选项、无补集推断**。
- 每选项语义命题**单一声明**（单 construct、单方向、单机制）→ `ATOMIC = YES`，原子性成立。
- 每对双向可达：每对恰有一个选项正向判别 A、一个正向判别 B。

---

## A5.1-R1-4. 五对双向判别核查（§6）

| 对 | 双向判别器 | 说明 |
|---|---|---|
| DECISION ↔ FEEDBACK | **YES** | 重写后：A「没把握没开始」→D(DEC)；B「做了没复盘」→D(FB) |
| PROBABILITY ↔ RISK | **YES** | A「概率」→D(PROB)；B「最坏」→D(RISK) |
| RISK ↔ TIME | **YES** | A「怕亏」→D(RISK)；B「没效果就换」→D(TIME) |
| IDENTITY ↔ OPPORTUNITY | **YES** | A「没遇到」→D(OPP)；B「不像我」→D(ID) |
| TIME ↔ SYSTEMS | **YES** | A「换方向」→D(TIME)；B「执行的人的问题」→D(SYS) |

**五对均 `PAIR_HAS_TRUE_BIDIRECTIONAL_DISCRIMINATOR = YES`**，无依赖补集推断。

---

## A5.1-R1-5. 原子性与观测单元

```
FOLLOWUP_OPTION_COUNT        = 10
FOLLOWUP_ATOMIC_EVIDENCE_COUNT = 10
```

每选项 = 1 原子证据（单 construct、单方向、单机制命题），无「一选项隐藏两声明」的合谋。`10 == 10` 是语义结果，非对称硬凑。

```
FOLLOWUP_OBSERVATIONAL_UNIT = unique followupQuestionId
SUFFICIENCY_INFLATION_PATHS = 0
```

即使某选项语义触两 construct，仍为**一个观测**，不重复计数（当前 10 选项均单 construct，无此情形）。

---

## A5.1-R1-6. Gaming / 措辞收紧读回（§8）

| 组 | 原定级 | 收紧后 | 说明 |
|---|---|---|---|
| FU_DEC_FB | MEDIUM（「改过做法」明显健康） | **LOW** | 重写后两选项均为自曝失真（没把握没开始 / 做了没复盘），无「聪明答案」 |
| FU_TIME_SYS | MEDIUM（「觉得人不行」负向） | **MEDIUM**（保留） | 「换人」→「执行的人的问题」措辞收紧；人事归因固有社会期许负向，属语义固有，不构成 HIGH |

```
HIGH_GAMING_RISK_COUNT   = 0
MEDIUM_GAMING_RISK_COUNT = 1
```

`HIGH = 0` 满足验收硬门槛。MEDIUM 不阻塞。

---

## A5.1-R1-7. 直连胜者路径审计（§9）

```
DIRECT_OPTION_TO_WINNER_EDGES   = 0   # 无 optionId → winner 直连
H_ONLY_TO_OTHER_PRIMARY_PATHS   = 0   # 无 H(A) → B primary
COMPLEMENT_INFERENCE_PATHS      = 0   # 无补集推断
SUFFICIENCY_INFLATION_PATHS     = 0
NUMERIC_SCORE_PATHS             = 0
ID_OFFSET_PATHS                 = 0
ONTOLOGY_PRIORITY_PATHS         = 0
```

**允许链（冻结）不变：**

```
answer → semantic evidence → construct-level discriminating interpretation
       → resolution of already-eligible pair → primary / unresolved
```

---

## A5.1-R1-8. Final Gate

```
CANONICAL_HEAD = 231487bf13e1e6bf052ce3fd8bf295ecf86f99a2

NOT_A_DOES_NOT_IMPLY_B                          = YES
FOLLOWUP_RESOLUTION_REQUIRES_POSITIVE_DISCRIMINATION = YES

FOLLOWUP_OPTION_COUNT        = 10
FOLLOWUP_ATOMIC_EVIDENCE_COUNT = 10

DEC_FB_BIDIRECTIONAL_DISCRIMINATOR            = YES
PROB_RISK_BIDIRECTIONAL_DISCRIMINATOR         = YES
RISK_TIME_BIDIRECTIONAL_DISCRIMINATOR         = YES
IDENTITY_OPPORTUNITY_BIDIRECTIONAL_DISCRIMINATOR = YES
TIME_SYSTEMS_BIDIRECTIONAL_DISCRIMINATOR      = YES

OPTIONS_RESOLVING_A_COUNT   = 5
OPTIONS_RESOLVING_B_COUNT   = 5
OPTIONS_UNRESOLVED_COUNT    = 0

H_ONLY_TO_OTHER_PRIMARY_PATHS = 0
COMPLEMENT_INFERENCE_PATHS    = 0
DIRECT_OPTION_TO_WINNER_EDGES = 0
SUFFICIENCY_INFLATION_PATHS   = 0

HIGH_GAMING_RISK_COUNT       = 0
MEDIUM_GAMING_RISK_COUNT     = 1

FOLLOWUP_MAPPING_COMPLETE    = YES
CONTRACT_AMBIGUITIES_REMAINING = NONE（A5.1 范围内）

A5_CONTRACT_READY_FOR_ACCEPTANCE      = YES
READY_FOR_A5_CONTRACT_PUBLICATION     = YES
READY_FOR_STAGE19A5_IMPLEMENTATION    = NO

RESULT = A5_1_R1_FOLLOWUP_SEMANTIC_CLOSURE_FROZEN
```

**STOP。** 未改 runtime、未改 R1–R3D 历史文档、未 commit、未 push、未 deploy。
