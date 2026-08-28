# ADR RC8.3 — Stage18 R3D — Dimension-State Determination Contract Addendum

- **Status:** FROZEN (design only — no runtime, no deploy, no MODE/DB change)
- **Scope:** `world_model_v2_1` dimension-state 判定合同（纯合同设计）
- **Stage:** Stage18 → unblocks Stage19A3 implementation
- **Date:** 2026-08-28
- **Base model:** `world_model_v1` → supersedes R1 §G strength semantics
- **Amendment:** R3D R1 — Evidence Independence Repair（本增编已被 R1 修订，见 §13）

> **Authority priority after publication:**
> `R3D > R3C > R3B > R3A > R3 > R2 > R1`

> ⚠️ **R3D R1 修订声明（supersede）**：本文件 §3 原以「unique evidenceId count」作为 state 输入。R3D R1 已判定该计数存在**单答案多证据膨胀**缺陷，并**正式废止**该措辞，改由「independent support unit count」（§13）决定 state 强度。§6/§7 规则本身不变，仅输入口径从 raw evidenceId 换为 support unit。

---

## 1. Problem to Resolve

Stage19A3 implementation STOPPED on three ambiguities. Each is resolved by this contract:

| # | Ambiguity | Resolution |
|---|-----------|------------|
| A | `h>=2,d=0,n=0` 全健康 evidence 无 state | 冻结为 `STRONG`（pure + zero neutral noise） |
| B | N evidence 参与方式未定义 | 冻结为 context-only：N 永不充当 H/D；`directional=0` 时 `state=UNKNOWN`、`orientation=NEUTRAL`（见 §5） |
| C | MODERATE 仍依赖旧 18-evidence / strength semantics | 冻结为 normalized counts 判定（见 §6），彻底移除 strengthClass 依赖 |

---

## 2. State Semantics

`dimension.state ∈ { STRONG, MODERATE, WEAK, UNKNOWN }`

**state 的语义冻结为：EVIDENCE RESOLUTION / CONSISTENCY STATE（证据消解/一致性状态）。**

state **不是**以下任何一项：

- ✗ good/bad score
- ✗ severity
- ✗ deficit level
- ✗ wealth potential
- ✗ probability

各 state 的精确定义（resolution 语义）：

| state | 语义（resolution/consistency） |
|-------|-------------------------------|
| STRONG | 高消解、高一致：多个独立方向支持一致指向单一方向，且无中性稀释 |
| MODERATE | 方向清晰但有稀释：多个独立方向支持一致指向单一方向，但存在中性证据 |
| WEAK | 低消解：方向支持单薄（仅 1 个独立支持），或方向矛盾（H 与 D 并存） |
| UNKNOWN | 无消解：方向支持为零 |

`dimension.orientation ∈ { HEALTHY, DISTORTED, MIXED, NEUTRAL, UNKNOWN }`

**orientation 与 state 正交。** 合法组合示例（全部由 §4/§6 规则唯一推导，无需人工标注）：

```
STRONG  + HEALTHY
STRONG  + DISTORTED
MODERATE + HEALTHY
MODERATE + DISTORTED
WEAK    + HEALTHY
WEAK    + DISTORTED
WEAK    + MIXED
UNKNOWN + NEUTRAL
UNKNOWN + UNKNOWN
```

由 §4/§6 规则构造性可达的 state×orientation 组合共 **7 种**：

| state | orientation | 触发条件（support unit 口径） |
|-------|-------------|----------|
| UNKNOWN | UNKNOWN | `directional_support=0, n_support=0` |
| UNKNOWN | NEUTRAL | `directional_support=0, n_support>0` |
| WEAK | HEALTHY | `h_support=1, d_support=0` |
| WEAK | DISTORTED | `d_support=1, h_support=0` |
| WEAK | MIXED | `h_support>0, d_support>0` |
| MODERATE | HEALTHY | `h_support>=2, d_support=0, n_support>0` |
| MODERATE | DISTORTED | `d_support>=2, h_support=0, n_support>0` |
| STRONG | HEALTHY | `h_support>=2, d_support=0, n_support=0` |
| STRONG | DISTORTED | `d_support>=2, h_support=0, n_support=0` |

其余 11 种组合（如 `STRONG+MIXED`、`UNKNOWN+HEALTHY`、`WEAK+NEUTRAL`）为**构造性不可达**，非错误、非禁用。

---

## 3. Count Definitions（R3D R1 修订后）

**本条已由 §13 取代。** 保留原语义供追溯：

~~h = unique H evidenceId count / d = unique D evidenceId count / n = unique N evidenceId count~~

**现行口径（R3D R1）：**

```
h_support = unique sourceQuestionId（独立支持单元）中贡献 H 方向的数量
d_support = unique sourceQuestionId 中贡献 D 方向的数量
n_support = unique sourceQuestionId 中仅贡献 N（无 H/D）的数量
directional_support = h_support + d_support

（原子证据列表仍保留，供语义追溯：
 healthyEvidenceIds / distortedEvidenceIds / neutralEvidenceIds）
```

冻结规则：

- **state 强度由 support unit 决定，不由 atomic evidenceId 决定。**
- atomic evidence 只承担语义追溯，不自动决定支持强度。
- neutral 永不伪装成 H 或 D。
- H/D/N 的归类由上游 ontology / R3A 层定义，R3D 只消费 support 计数。

---

## 4. Orientation Contract — FROZEN

```
if h_support == 0 and d_support == 0:
    orientation = NEUTRAL if n_support > 0 else UNKNOWN
elif d_support == 0:          # h_support > 0
    orientation = HEALTHY
elif h_support == 0:          # d_support > 0
    orientation = DISTORTED
else:                         # h_support > 0 and d_support > 0
    orientation = MIXED
```

唯一、确定性、完备。与用户建议一致，确认冻结，无修订（仅输入口径换成 support unit）。

---

## 5. Neutral Evidence Contract — FROZEN

N evidence：

- 永远独立记录
- 不计入 `h_support`
- 不计入 `d_support`
- 不制造 deficit
- 不作为 HEALTHY evidence
- 不直接决定 HEALTHY/DISTORTED orientation

方向归属（已由 §4 保证）：

- 纯 N → `orientation = NEUTRAL`，`state = UNKNOWN`（N 只提供上下文，无方向消解）
- N + H → orientation 仍由 H 决定（`HEALTHY`）
- N + D → orientation 仍由 D 决定（`DISTORTED`）
- H + D + N → `orientation = MIXED`

**N 是否影响 state 强度 — 明确冻结：**

> N **不提高** directional confidence；且 N 仅在 `directional_support>=2 且方向纯粹` 时，将 state 从 STRONG 降为 MODERATE（作为"中性稀释"）。N 对 UNKNOWN/WEAK/MIXED 的 state **无任何影响**，对 orientation 的**唯一**影响是 `h_support=d_support=0` 时的 `NEUTRAL`。

语义依据：N 是"观测到的上下文"，不是方向性消解。多条方向支持 + 存在中性噪声 ⇒ 方向清晰但一致性未满 ⇒ MODERATE；多条方向支持 + 零中性噪声 ⇒ 完全一致 ⇒ STRONG。

---

## 6. State Contract — Normalized Scale — FROZEN

**禁止使用：**

- ✗ strengthClass
- ✗ HIGH/MODERATE evidence weight
- ✗ old "exactly 2 evidence" assumption
- ✗ numeric pseudo-confidence

**确定性 normalized 规则（输入为 support unit 口径）：**

```
directional_support = h_support + d_support

if directional_support == 0:
    state = UNKNOWN
elif h_support > 0 and d_support > 0:
    state = WEAK            # 方向矛盾
elif directional_support == 1:
    state = WEAK            # 单一方向支持
elif n_support == 0:
    state = STRONG          # directional_support>=2, 方向纯粹, 零中性噪声
else:
    state = MODERATE        # directional_support>=2, 方向纯粹, 存在中性噪声
```

各 state 的精确条件：

| state | 条件 |
|-------|------|
| UNKNOWN | `directional_support == 0`（含纯 N；纯 N 明确为 UNKNOWN，非 WEAK） |
| WEAK | `directional_support == 1` **OR** `(h_support > 0 AND d_support > 0)` |
| MODERATE | `directional_support >= 2` **AND** 方向纯粹 `(h_support==0 XOR d_support==0)` **AND** `n_support > 0` |
| STRONG | `directional_support >= 2` **AND** 方向纯粹 `(h_support==0 XOR d_support==0)` **AND** `n_support == 0` |

**满足约束：**

- MODERATE 独立、可达到、不依赖 strengthClass，**非 dead state**（`(3,0,1)`、`(0,3,1)`、`(2,0,1)`… 可达）。
- STRONG 的 "sufficiently consistent" 精确定义为 `n_support == 0`（零中性稀释），"dominant direction" 由 `(h_support==0 XOR d_support==0)` 保证。
- state 完全由 `(h_support,d_support,n_support)` 确定，`n_support` 仅在 STRONG↔MODERATE 边界起作用，绝不改变 orientation（除 `h_support=d_support=0` 的 NEUTRAL）。

---

## 7. Full Truth Table（support unit 口径重表达）

| (h_support,d_support,n_support) | orientation | state | reason |
|---------|-------------|-------|--------|
| (0,0,0) | UNKNOWN | UNKNOWN | directional_support=0，无任何观测 |
| (0,0,1) | NEUTRAL | UNKNOWN | directional_support=0；N 提供上下文但无方向消解 |
| (1,0,0) | HEALTHY | WEAK | directional_support=1，单一 H 支持 |
| (0,1,0) | DISTORTED | WEAK | directional_support=1，单一 D 支持 |
| (1,0,1) | HEALTHY | WEAK | directional_support=1；N 仅添加上下文 |
| (0,1,1) | DISTORTED | WEAK | directional_support=1；N 仅添加上下文 |
| (2,0,0) | HEALTHY | STRONG | 2 独立 H 支持且零中性噪声 |
| (0,2,0) | DISTORTED | STRONG | 2 独立 D 支持且零中性噪声 |
| (1,1,0) | MIXED | WEAK | H 与 D 支持并存，方向矛盾 |
| (1,1,1) | MIXED | WEAK | H 与 D 支持并存，方向矛盾 |
| (2,1,0) | MIXED | WEAK | H 与 D 支持并存，方向矛盾 |
| (1,2,0) | MIXED | WEAK | H 与 D 支持并存，方向矛盾 |
| (2,2,0) | MIXED | WEAK | 矛盾支持量大但方向未消解 |
| (3,0,1) | HEALTHY | MODERATE | 3 独立 H 支持但 n_support=1 稀释一致性 |
| (0,3,1) | DISTORTED | MODERATE | 3 独立 D 支持但 n_support=1 稀释一致性 |

---

## 8. Monotonicity / Invariants — FROZEN

- missing evidence never becomes deficit（缺失答案 → 不产生证据，绝不反向计为 deficit）
- adding N alone cannot make orientation DISTORTED（N 永不触碰 h_support/d_support）
- adding H cannot increase distortion orientation
- adding D cannot increase healthy orientation
- input order invariant（counts 可交换）
- duplicate **sourceQuestionId** invariant（按 unique sourceQuestionId 去重）
- displayPosition irrelevant
- no ontology priority
- no ID_OFFSET
- no random tie breaking（规则无并列分支，`(h_support,d_support,n_support)` 唯一映射）

---

## 9. Blindspot Boundary — FROZEN

dimension state / orientation **不得**直接选择 primary blindspot。

blindspot ranking / separation / follow-up 仍属后续层。

R3D 不得引入：

- ✗ PRIMARY_SEPARATION 0.5
- ✗ PRIMARY_SUFFICIENCY 2
- ✗ blindspot argmax
- ✗ tie breaker

---

## 10. Migration from R1 §G

| R1 §G state | Verdict | 说明 |
|-------------|---------|------|
| STRONG | **REINTERPRET** | 保留 label；语义从 strengthClass/score 改为 `directional_support>=2 AND pure AND n_support==0` |
| MODERATE | **REINTERPRET** | 保留 label；旧 strengthClass 依赖的 MODERATE 语义 **RETIRE**；新语义 `directional_support>=2 AND pure AND n_support>0` |
| WEAK | **REINTERPRET** | 保留 label；语义改为 `directional_support==1 OR (h_support>0 AND d_support>0)` |
| UNKNOWN | **RETAIN** | 核心语义不变：`directional_support==0` |

**正式 RETIRE：**

1. **R1 strengthClass-dependent MODERATE** → RETIRE（与 48 evidence ontology 不兼容）
2. **R1 exact-two-evidence assumption**（`minSupportingPieces=2` / `minEvidence=2`）→ RETIRE（被 `directional_support>=2` + 方向纯粹/矛盾区分取代）
3. **R1 HIGH/MODERATE evidence weight buckets** → RETIRE
4. **R1 numeric pseudo-confidence**（0-1 score → state）→ RETIRE

---

## 11. Fixtures（support unit 口径）

9 个 construct 示例，覆盖全部四态。

| # | construct | (h_support,d_support,n_support) | orientation | state |
|---|-----------|---------|-------------|-------|
| 1 | 纯 healthy | (3,0,0) | HEALTHY | STRONG |
| 2 | 纯 distorted | (0,3,0) | DISTORTED | STRONG |
| 3 | pure neutral | (0,0,2) | NEUTRAL | UNKNOWN |
| 4 | single directional support | (1,0,0) | HEALTHY | WEAK |
| 5 | H+D contradiction | (2,2,0) | MIXED | WEAK |
| 6 | N+H | (2,0,1) | HEALTHY | MODERATE |
| 7 | N+D | (0,2,1) | DISTORTED | MODERATE |
| 8 | multiple H | (3,0,0) | HEALTHY | STRONG |
| 9 | multiple D | (0,3,0) | DISTORTED | STRONG |

可达性验证：

```
UNKNOWN_REACHABLE  = YES   # (0,0,0), (0,0,1)
WEAK_REACHABLE     = YES   # (1,0,0), (0,1,0), (2,2,0)
MODERATE_REACHABLE = YES   # (2,0,1), (0,2,1), (3,0,1), (0,3,1)
STRONG_REACHABLE   = YES   # (2,0,0), (0,2,0), (3,0,0), (0,3,0)
```

四态全部可达，无 dead state，未触发 STATE_MODEL_DEFECT。

---

## 12. Final Gate（R3D R1 修订后）

```
DIMENSION_STATE_SEMANTICS_FROZEN             = YES
ORIENTATION_SEMANTICS_FROZEN                 = YES
NEUTRAL_POLICY_FROZEN                        = YES
NORMALIZED_STATE_RULE_FROZEN                 = YES   # 以 support unit 为输入口径
FULL_TRUTH_TABLE_COMPLETE                    = YES   # 15/15 行唯一结果
ALL_FOUR_STATES_REACHABLE                    = YES
R1_STRENGTH_DEPENDENCY_RETIRED               = YES
R1_EXACT_TWO_EVIDENCE_ASSUMPTION_RETIRED     = YES
RAW_EVIDENCE_COUNTING_SUPERSEDED             = YES   # R3D R1 废止 raw evidenceId 计数

CONTRACT_AMBIGUITIES_REMAINING               = A1 静态合同文件在本仓库缺失（见 §13）
READY_TO_PUBLISH_R3D                         = NO    # 未 commit/push，且 A1 前置未在本仓库解决
READY_FOR_STAGE19A3_IMPLEMENTATION           = NO    # 阻塞于 A1 文件缺失

RESULT = R3D_R1_INDEPENDENCE_REPAIR_FROZEN__PUBLICATION_BLOCKED_ON_A1

STOP.
```

---

## 13. R3D R1 — Evidence Independence Repair

> ⚠️ **SUPERSEDED_BY_CANONICAL_V21_REAUDIT**：本节（13.1–13.7）的审计基于**非 canonical 工作区**的 `world_model_v1` 测量（如 `MAX_EVIDENCE_PER_SINGLE_ANSWER=4`、`decisionStyle→4 证据`）。canonical V2.1 re-audit（§14）已证明这些结论**不适用于 world_model_v2_1**——V2.1 中单答案→单证据，不存在 V1 式原子化膨胀。V1 结论仅作为历史记录保留，**不得用于冻结任何 V2.1 规则**。以 §14 为准。

### 13.1 Audit 首要发现（阻断项）

本任务要求「读取已发布的 A1 静态合同实现：`questionnaireV21.js`、`evidenceCatalogV21.js` 并返回精确计数」。

**审计结论：这两个文件在本仓库（工作树 + 全部分支 + 全部 tag）不存在。**

同时以下术语全仓零命中：`semantic option`、`atomic evidence.direction ∈ {H,D,N}`、`typed signals`、`sourceQuestionId`、`matchedQuestionId`、`independenceGroup`、`48 atomic evidence`、`9 constructs`。

因此：

- `A1_HDN_DIRECTION_ALREADY_FROZEN = NO`（本仓库内不存在该链路实现）
- 精确的「atomic evidence count / unique source question count / max evidence per answer」**无法从 A1 文件取得**，故不予臆造。

**现有模型（`world_model_v1` / `evidenceNormalizer.js`）实测证实缺陷存在：**

- 唯一溯源字段是 `questionId`（非 `sourceQuestionId`）。
- 单一答案可发射多条原子证据：`decisionStyle` → 4 条（`evidenceBased`/`intuitionDominant`/`securityFirst`/`optionPreserving`），`failureResponse`/`pastAttemptStage`/`incomeStructure`/`weeklyTime` → 各 3 条，`safetyMonths` → 2 条。
- ⇒ `MAX_EVIDENCE_PER_SINGLE_ANSWER = 4`（现有 v1 模型实测）。

### 13.2 冻结原则

**SEMANTIC_ATOMICITY != OBSERVATIONAL_INDEPENDENCE**

dimension state 强度不得仅因「一个语义观测被分解为多条原子命题」而增加。单条已回答问题自身不得满足「multiple independent support」条件，除非被本合同的 independence 规则明确授权。

### 13.3 INDEPENDENT_SUPPORT_UNIT — FROZEN

候选优先级（按任务 §4）：

1. frozen `independenceGroup` —— **本仓库不存在**，跳过；
2. unique `sourceQuestionId` / `matchedQuestionId` —— **采用**。

**冻结：INDEPENDENT_SUPPORT_UNIT = unique sourceQuestionId（当前模型对应 `questionId`）。**

理由：sourceQuestionId 是「一次真实观测（一个已回答问题）」的溯源单元，其粒度在所有 construct 间一致，不受「某观测被原子化得粗细」影响；而 evidenceId 是「语义命题」粒度，同一观测可膨胀出多条 evidenceId，直接导致状态虚高。故 sourceQuestionId 比 evidenceId 更真实地代表独立观测。

### 13.4 支持计数与聚合规则 — FROZEN

对每 construct：

```
healthyEvidenceIds   —— 原子证据列表（语义追溯，不决定强度）
distortedEvidenceIds
neutralEvidenceIds

h_support = |{ q : q 的原子证据中含 H 方向 }|
d_support = |{ q : q 的原子证据中含 D 方向 }|
n_support = |{ q : q 的原子证据中仅含 N（无 H 无 D）}|
```

聚合（deterministic，防膨胀核心）：**每个 sourceQuestionId 对每个 construct 每个方向最多贡献 1 个 support unit。**

- 单答案 → 2 条 D 证据 ⇒ `d_support += 1`（不是 2）
- 单答案 → 2 条 H 证据 ⇒ `h_support += 1`（不是 2）
- 单答案 → 仅 N ⇒ `n_support += 1`
- 单答案 → H + N 并存 ⇒ 仅 `h_support += 1`（H 主导，N 被吸收，不额外计 n_support）
- 单答案 → D + N 并存 ⇒ 仅 `d_support += 1`
- 单答案 → H + D 并存 ⇒ `h_support += 1` 且 `d_support += 1`（内部矛盾 → MIXED/WEAK；该情形是否可出现，取决于 A1 分类，见 §13.7）

### 13.5 单答案膨胀硬门禁 — 验证

fixture：单答案 Q1 → 2 条 D 证据（E1,E2）

- 旧口径：`d=2` → 误判 STRONG（缺陷）
- 新口径：`d_support=1` → WEAK（正确）

**`ONE_ANSWER_MULTI_EVIDENCE_STRONG_INFLATION = 0`**（修复后无任一 fixture 因单答案多证据而 STRONG）。

### 13.6 跨 construct 公平性

原则冻结：**不要求 atomic count 相等，要求 state 语义可比。**

support unit = sourceQuestionId 的粒度对所有 construct 一致（都是"一个已回答问题"），因此原子化粗细不再影响 state 可达性。精确的 per-construct atomic count 与 capacity 需待 A1 catalog 出现后才能实测（当前 `CROSS_CONSTRUCT_ATOMIZATION_BIAS = NOT_AUDITABLE`，但修复机制已在合同层消除该偏置来源）。

### 13.7 中性稀释 — 有意设计（非原子计数副作用）

明确确认以下为**有意合同属性**：

```
2 H support + 0 N → STRONG
2 H support + 1 N → MODERATE
（D 方向对称同理）
纯 N：orientation = NEUTRAL，state = UNKNOWN
```

`NEUTRAL_DILUTION_INTENTIONAL = YES`。

### 13.8 待解决歧义（诚实声明）

1. **A1 文件缺失**：H/D/N 分类器、9-construct catalog、`independenceGroup` 是否存在的最终确认，均阻塞于本仓库无 A1 实现。
2. **单答案内部多方向聚合**：`H + D 并存` 是否可由单一 sourceQuestionId 产生，取决于 A1 的 atomic→direction 映射，待 A1 确认。

上述两点为 A1 范畴，非 R3D 内部规则歧义；R3D 的 support-unit 判定规则已就给定 `(h_support,d_support,n_support)` 完全冻结。

---

## 附：契约规格（pseudocode — 供 Stage19A3 参照，非 runtime 代码）

```
// 输入：每 construct 的原子证据列表（含 sourceQuestionId 与 direction∈{H,D,N}）
// 第 1 步：聚合为 support unit（每个 question 每方向最多 1）
function aggregateSupport(evidenceList) {
  const h = new Set(), d = new Set(), n = new Set()
  evidenceList.forEach(e => {
    if (e.direction === 'H') h.add(e.sourceQuestionId)
    else if (e.direction === 'D') d.add(e.sourceQuestionId)
    else n.add(e.sourceQuestionId)   // N
  })
  // 吸收：含 H 或 D 的 question 不计入 n
  const hIds = h, dIds = d
  const nIds = new Set([...n].filter(q => !h.has(q) && !d.has(q)))
  return { h_support: hIds.size, d_support: dIds.size, n_support: nIds.size,
           healthyEvidenceIds: [], distortedEvidenceIds: [], neutralEvidenceIds: [] }
}

// 第 2 步：R3D state/orientation 判定（规则与 §4/§6 完全一致，仅输入为 support unit）
function resolveDimensionState(h_support, d_support, n_support) {
  const directional = h_support + d_support
  let orientation
  if (h_support === 0 && d_support === 0) {
    orientation = (n_support > 0) ? 'NEUTRAL' : 'UNKNOWN'
  } else if (d_support === 0) {
    orientation = 'HEALTHY'
  } else if (h_support === 0) {
    orientation = 'DISTORTED'
  } else {
    orientation = 'MIXED'
  }
  let state
  if (directional === 0) {
    state = 'UNKNOWN'
  } else if (h_support > 0 && d_support > 0) {
    state = 'WEAK'
  } else if (directional === 1) {
    state = 'WEAK'
  } else if (n_support === 0) {
    state = 'STRONG'
  } else {
    state = 'MODERATE'
  }
  return { state, orientation }
}
```

---

## 14. R3D R1 — Canonical V2.1 Re-audit（canonical 工作区实测）

### 14.1 Provenance（已验证）

- canonical remote：`git@github.com:Ty009-abc/xiaoshegev3.git` ✓
- canonical branch：`feat/rc8.3-diagnosis-accuracy` ✓
- canonical HEAD：`031e5d7622b6dd9ebb4d871638dc1b0db6ab627f`（= Stage19A2）✓
- Stage19A1 commit `bab8001c77f8c1854b783748386140619dfa62ba` 是 A2 的祖先 ✓
- 审计在**干净独立 worktree** `/Users/lvjianfang/WorkBuddy/claw-v21-canonical-audit`（detached @ 031e5d7）执行，未改动原工作区 git 状态。

### 14.2 冻结常量与方向（代码实测）

```
QUESTION_COUNT          = 18
CONSTRUCT_COUNT         = 9
OPTION_PROPOSITION_COUNT = 65
ATOMIC_EVIDENCE_COUNT   = 48
direction 分布：H=13, D=33, N=2
```

evidence.direction 值域 = { H, D, N }（A1 已冻结，H/N 的 distortionType 恒为 null，D 保 catalog distortionType）。

### 14.3 独立性与映射（代码实测，决定性）

- **每个 optionId 恰好映射 1 条证据**：`MAX_REF_PER_OPTION = 1`，`OPTION_CAN_MAP_MULTIPLE_EVIDENCE = NO`。
- **单答案 → 单证据 → 单方向**：`MAX_EVIDENCE_PER_SINGLE_ANSWER = 1`，`MAX_DIRECTIONAL_EVIDENCE_PER_SINGLE_ANSWER = 1`。
- 单答案多方向全部为假：
  - `SINGLE_ANSWER_MULTI_H = NO`
  - `SINGLE_ANSWER_MULTI_D = NO`
  - `SINGLE_ANSWER_H_PLUS_D = NO`
  - `SINGLE_ANSWER_H_PLUS_N = NO`
  - `SINGLE_ANSWER_D_PLUS_N = NO`
- **independenceGroup 字段存在**（48/48 全部 resolved，0 unresolved），但其值 = construct 码（DEC/FB/...），是**语义分组**，**不是**观测独立性分组，不可作 support unit。

### 14.4 真正的独立性缺陷（与 V1 相反：去重欠计数，非膨胀）

V2.1 中**多条不同问题可映射到同一条证据**（如 `DEC_ACTION_LEARNS` ← SC_DEC_01:A 与 SC_DEC_02:B；`ID_UPDATEABLE` ← 4 个 option）。normalizer 按 evidenceId 去重但保留 `matchedQuestionIds`。

因此「unique evidenceId count」在 V2.1 会**欠计数**（两个独立观测→同一证据→计为 1），而非 V1 式的膨胀。

### 14.5 INDEPENDENT_SUPPORT_UNIT — FROZEN

**INDEPENDENT_SUPPORT_UNIT = unique matchedQuestionId**（运行时实际作答的问题，即 `matchedQuestionIds` 的基数）。

- 单答案→单证据→单方向 ⇒ 无膨胀（一个 question 每方向最多贡献 1）。
- 多问题→同证据 ⇒ matchedQuestionId 正确计为多个观测，不欠计数。
- 输出字段精确名：`sourceQuestionIds`（catalog 静态潜在源）、`matchedQuestionIds`（运行时实际命中）、`matchedOptionIds`（`questionId:optionId` 串）。

支持计数（每 construct）：

```
h_support = |{ 作答问题 : 其证据 direction==H }|
d_support = |{ 作答问题 : 其证据 direction==D }|
n_support = |{ 作答问题 : 其证据 direction==N }|
（三者互斥，因为单答案→单方向；和为作答问题数）
```

### 14.6 R3D 规则与 V2.1 兼容性 — STATE_MODEL_DEFECT

**每个 construct 恰好 2 个问题**（18 题 / 9 constructs）。因此 `h_support + d_support + n_support ≤ 2`。

冻结的 MODERATE 规则要求：`directional_support >= 2 AND 方向纯粹 AND n_support > 0`。这需要 ≥3 个作答问题（2 方向 + 1 中性），但每 construct 只有 2 题 ⇒ **矛盾，MODERATE 不可达**。

四态可达性实测：

```
UNKNOWN_REACHABLE  = YES   # (0,0,0)：construct 内无作答
WEAK_REACHABLE     = YES   # (1,0,0)/(0,1,0) 单方向；或 (1,1,0) 混合
STRONG_REACHABLE   = YES   # (2,0,0)/(0,2,0)：两题同方向
MODERATE_REACHABLE = NO    # 需 3 题，但只有 2 题 → dead state
```

**结论：`ALL_FOUR_STATES_REACHABLE = NO`，`R3D_RULES_COMPATIBLE_WITH_ACTUAL_V21 = NO`，触发 `STATE_MODEL_DEFECT`。**

`ONE_ANSWER_MULTI_EVIDENCE_STRONG_INFLATION = 0`（单答案→单证据→WEAK，永不为 STRONG；该指标达标，但 MODERATE 缺陷独立存在）。

### 14.7 测试回读

```
A1 = 7/7 PASS   (tests/rc8.3-stage19a1-v21-static-contract.test.js)
A2 = 19/19 PASS (tests/rc8.3-stage19a2-v21-evidence-signal.test.js)
```

### 14.8 结论

> ⚠️ 本节「R3D 不发布」结论已被 §15（R3D R2 修复）**SUPERSEDED**——R2 已修复 MODERATE dead-state 缺陷，四态全部可达，§15.9/§16.4 标记 READY。本节保留仅作缺陷发现的历史记录，不具备 normative authority。

R3D R1 结论：MODERATE 状态在 frozen V2.1（每 construct 2 题）下不可达，需在 R3D 层与 V2.1 问卷粒度之间重新裁定 state 模型。该裁定已在 §15 完成。

---

## 15. R3D R2 — Two-Question State Model Repair

### 15.1 Retire 缺陷规则

~~`directional>=2 AND 方向纯粹 AND n>0 → MODERATE`~~ → **RETIRE**（每 construct 仅 2 题，该规则需 ≥3 support unit，不可达；见 §14.6）。

### 15.2 修复后的四态规则 — FROZEN

```
directional = h_support + d_support
observed    = h_support + d_support + n_support

A. directional == 0                        → UNKNOWN
B. h_support > 0 AND d_support > 0         → WEAK     # 方向矛盾
C. directional == 1 AND n_support == 0     → WEAK     # 单一方向观测
D. directional == 1 AND n_support >= 1     → MODERATE # 1 方向 + 1 中性
E. directional == 2 AND orientation∈{HEALTHY,DISTORTED} → STRONG
```

语义陈述（冻结）：

```
N 不增加方向置信度，只增加观测覆盖。

1 H + missing → WEAK + HEALTHY
1 H + N       → MODERATE + HEALTHY
2 H           → STRONG + HEALTHY

1 D + missing → WEAK + DISTORTED
1 D + N       → MODERATE + DISTORTED
2 D           → STRONG + DISTORTED

H + D         → WEAK + MIXED
```

### 15.3 完整双题真值表（确定性）

| (h,d,n) | orientation | state | 全局可达 |
|---------|-------------|-------|----------|
| (0,0,0) | UNKNOWN | UNKNOWN | YES（无作答） |
| (1,0,0) | HEALTHY | WEAK | YES |
| (0,1,0) | DISTORTED | WEAK | YES |
| (0,0,1) | NEUTRAL | UNKNOWN | 仅 IDENTITY/OPPORTUNITY |
| (2,0,0) | HEALTHY | STRONG | YES |
| (0,2,0) | DISTORTED | STRONG | YES |
| (0,0,2) | NEUTRAL | UNKNOWN | 无（无 construct 有 2 个 N 题） |
| (1,1,0) | MIXED | WEAK | YES |
| (1,0,1) | HEALTHY | MODERATE | 仅 IDENTITY/OPPORTUNITY |
| (0,1,1) | DISTORTED | MODERATE | 仅 IDENTITY/OPPORTUNITY |

(0,0,2) 语义确定但无实际夹具——不臆造 N 证据补齐。

### 15.4 支持计数与去重硬夹具

`INDEPENDENT_SUPPORT_UNIT = unique matchedQuestionId`（冻结，§14.5）。

实测（canonical V2.1）：

- `SC_DEC_01:A + SC_DEC_02:B` → 去重后 1 行证据 `DEC_ACTION_LEARNS`，但 `matchedQuestionIds=[SC_DEC_01,SC_DEC_02]`，support h=2 ⇒ **无欠计数**。
- `SC_ID_01:A + SC_ID_02:C` → 1 行 `ID_UPDATEABLE`，matchedQuestionIds=2。
- `SC_ID_01:A + SC_ID_02:D` → h=1,n=1 ⇒ MODERATE+HEALTHY ✓。

**`EVIDENCE_DEDUP_SUPPORT_UNDERCOUNT = 0`，`ONE_ANSWER_MULTI_EVIDENCE_STRONG_INFLATION = 0`**（Stage19A3 硬性实现要求）。

### 15.5 Construct 容量审计

每 construct 恰好 2 题，方向容量：

| construct | 题方向容量 | MODERATE 可达 |
|-----------|-----------|---------------|
| DECISION | [DH],[DH] | NO |
| FEEDBACK | [DH],[DH] | NO |
| PROBABILITY | [DH],[DH] | NO |
| RISK | [DH],[DH] | NO |
| LEVERAGE | [DH],[DH] | NO |
| TIME | [DH],[DH] | NO |
| IDENTITY | [DH],[DHN] | YES（H+N / D+N） |
| OPPORTUNITY | [DH],[DHN] | YES（H+N / D+N） |
| SYSTEMS | [DH],[DH] | NO |

- N 原子证据全局仅 2 条：`ID_CONTEXTUAL`（IDENTITY, SC_ID_02:D）、`OPP_SOME`（OPPORTUNITY, SC_OPP_02:B）。
- **MODERATE 全局合法，但仅 IDENTITY / OPPORTUNITY 可自然产生**（H+N 或 D+N）。7 个 construct 因 frozen option ontology 无 N 选项，不可产生 MODERATE/NEUTRAL——这是可接受的构造性差异，不臆造 N 证据拉平。

### 15.6 MODERATE 枚举语义判定

新 MODERATE = 「1 方向支持 + 1 中性观测」= 「观测覆盖完整、但方向消解部分」。在 evidence resolution / consistency 语义下，介于 WEAK（覆盖不完整）与 STRONG（覆盖完整且方向一致）之间，语义自洽。

**`MODERATE_ENUM_SEMANTIC_VALID = YES`**（不改名，不报 ENUM_SEMANTIC_DEFECT）。

### 15.7 R1 迁移（归一化 V2.1 解释）

- R1 strengthClass 依赖：**RETIRED**
- R1 exactly-two-evidence 实现语义：**REINTERPRETED**（不再是"恰好两条证据"，而是"两个独立观测 support unit"）

概念意图保留：

| state | V2.1 归一化语义 |
|-------|-----------------|
| UNKNOWN | 无方向结论 |
| WEAK | 方向证据有限（单一）或矛盾 |
| MODERATE | 两个观测、部分方向性（1 方向 + 1 中性） |
| STRONG | 两个独立观测、方向一致 |

### 15.8 安全不变量（冻结）

missingness 不产生 H/D/N；无证据→UNKNOWN；纯 N 永不 HEALTHY/DISTORTED/STRONG；单方向观测加 N → WEAK→MODERATE 但 orientation 不变；同方向加证据 → STRONG；反方向加证据 → MIXED+WEAK；输入/证据顺序不变；displayPosition 无关；重复 evidenceId 不变；无 ID_OFFSET；无 ontology priority；无随机 tie-break。

### 15.9 Final Gate（R3D R2）

```
R3D_RULES_COMPATIBLE_WITH_ACTUAL_V21 = YES   # 修复后四态全部可达
ALL_FOUR_STATES_REACHABLE            = YES   # MODERATE 修复（H+N / D+N）
R3D_ADR_READY_FOR_ACCEPTANCE         = YES   # 待 operator 验收；本轮不 push
READY_FOR_STAGE19A3_IMPLEMENTATION   = NO    # 禁 Stage19A3（本任务边界）
RESULT = R3D_R2_TWO_QUESTION_STATE_MODEL_REPAIR_FROZEN
STOP.
```

---

## 16. R3D R2 Acceptance Patch — Contract Semantic Guard

### 16.1 跨 construct 可比性 — FORBIDDEN

```
CROSS_CONSTRUCT_STATE_COMPARABILITY = FORBIDDEN
```

`dimension.state ∈ { UNKNOWN, WEAK, MODERATE, STRONG }` 只能解释为：

> 该 construct 内部，当前观测证据的覆盖度与方向一致性状态。

禁止解释为：

- ✗ cognitive quality score
- ✗ maturity level
- ✗ severity rank
- ✗ probability
- ✗ confidence percentage
- ✗ cross-construct comparable scale

### 16.2 联合解释 — FROZEN

`IDENTITY=MODERATE` 与 `DECISION=WEAK` **不能**推出：

- IDENTITY > DECISION
- IDENTITY 比 DECISION 更健康、更成熟、更可靠

`orientation` 才负责表达 `HEALTHY / DISTORTED / MIXED / NEUTRAL / UNKNOWN`。**state 与 orientation 必须联合解释**，二者均不单独构成跨 construct 排序依据。

### 16.3 MODERATE 构造性可达 — FROZEN

```
MODERATE_CONSTRUCT_REACHABILITY = IDENTITY, OPPORTUNITY

NON_MODERATE_CONSTRUCTS = DECISION, FEEDBACK, PROBABILITY, RISK,
                          LEVERAGE, TIME, SYSTEMS
```

这是 **questionnaire ontology 的构造性差异**，不是用户认知差异。

不得为了"统一量表"：

- ✗ 人工制造 N evidence
- ✗ 修改 frozen questionnaire
- ✗ 添加 hidden weights
- ✗ 把 WEAK/MODERATE/STRONG 映射成 numeric score

### 16.4 Final Gate（R3D R2 Acceptance Patch）

```
CROSS_CONSTRUCT_STATE_COMPARABILITY_FORBIDDEN = YES
STATE_ORIENTATION_JOINT_INTERPRETATION_FROZEN = YES
R3D_ADR_READY_FOR_PUBLICATION                 = YES   # 内容就绪；待 operator 发布授权，不 push
STOP.
```
