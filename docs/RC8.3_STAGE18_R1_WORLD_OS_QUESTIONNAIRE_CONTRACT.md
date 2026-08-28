# RC8.3 Stage 18-R1 — World OS Questionnaire Contract Freeze

Status: CONTRACT_FREEZE (DESIGN ONLY)
Date: 2026-08-28
Authority: RC8.3_WORLD_MODEL_ALIGNMENT.md (Product Constitution) · ADR-001 · ADR-002
Scope: 测量与推理契约。禁止据此实现代码、改 production/client/cloud function、deploy、切 MODE。

---

## A. North Star

诊断对象 = **用户理解现实与做决策的潜隐模型（latent world model）**，不是职业/收入/财富/人格标签/"聪明程度"/好习惯数量。

产品转化闭环（World OS 核心）：发现潜隐假设 → 看见它如何影响决策 → 知道什么证据可推翻它 → 完成低成本现实实验 → 更新下一次决策模型。

---

## B. Nine Frozen Construct Definitions

> 每个 construct 定义为「用户对世界如何运作的隐含假设」，**绝不**定义为「是否有某个好习惯」。

### 1. DECISION
- **worldPrinciple**: DECISION_CREATES_INFORMATION（决策产生信息）
- **constructDefinition**: 用户对「决策的本质」的隐含假设——是「获取信息的途径」，还是「必须一次做对的判断」。
- **healthyWorldModel**: 可逆决策可低成本快速启动；行动制造信息；不等确定性。
- **distortedWorldModel**: 决策=考试，须有把握才敢动；把「没想清楚」当「不能做」。
- **whatItMeasures**: 启动门槛、对不确定性的容忍、是否用实验替代等待。
- **whatItMustNotMeasure**: 拖延症、执行力、行动力（行为结果，非假设）。
- **nearNeighborConstructs[]**: FEEDBACK, PROBABILITY
- **observableEvidence**: 启动门槛类型；信息价值判断（是否愿为增量信息等待）。
- **counterEvidence**: 快速可逆行动、小步实验记录。
- **minimumEvidenceRequired**: 2

### 2. FEEDBACK
- **worldPrinciple**: FEEDBACK_UPDATES_MODELS（反馈更新模型）
- **constructDefinition**: 用户是否把「外部/矛盾/负面反馈」视为更新模型的原料，还是对自我的威胁。
- **healthyWorldModel**: 反馈是信息；负面/矛盾反馈值得采集与裁决。
- **distortedWorldModel**: 反馈是评价；回避负面、采信顺耳、把矛盾反馈归因于他人。
- **whatItMeasures**: 负面反馈的归因方式；矛盾反馈的裁决方式。
- **whatItMustNotMeasure**: "是否爱请教别人"（社交习惯）。
- **nearNeighborConstructs[]**: DECISION, SYSTEMS
- **observableEvidence**: 负面反馈归因；矛盾反馈处理。
- **counterEvidence**: 主动采集反面证据、据反馈改做法。
- **minimumEvidenceRequired**: 2

### 3. PROBABILITY
- **worldPrinciple**: PROBABILITY_GOVERNS_OUTCOMES（概率支配结果）
- **constructDefinition**: 用户是否用概率/区间/期望值/基础率理解结果，还是二元「成/败」。
- **healthyWorldModel**: 区间思维、幸存者偏差意识、概率可随新信息更新。
- **distortedWorldModel**: 二元判断、把「稳」当确定性、忽视基础率、概率不可更新。
- **whatItMeasures**: 基础率/幸存者意识；概率可更新性（非数学能力）。
- **whatItMustNotMeasure**: 算术/概率计算能力（不得退化成数学考试）。
- **nearNeighborConstructs[]**: RISK, DECISION
- **observableEvidence**: 幸存者意识；对「几成把握」的可更新态度。
- **counterEvidence**: 区间语言、主动问失败率。
- **minimumEvidenceRequired**: 2

### 4. RISK
- **worldPrinciple**: RISK_IS_ASYMMETRICAL（风险不对称）
- **constructDefinition**: 用户是否感知风险的不对称结构（下行≠上行）与可逆性。
- **healthyWorldModel**: 看赔率、区分可逆/不可逆、算最坏情况。
- **distortedWorldModel**: 对称化风险——要么只看到下行（过度回避），要么只看到上行（鲁莽）。
- **whatItMeasures**: 不对称感知；可逆性是否进入决策。
- **whatItMustNotMeasure**: 风险偏好/胆量（人格标签）。
- **nearNeighborConstructs[]**: PROBABILITY, TIME
- **observableEvidence**: 不对称感知；可逆性区分。
- **counterEvidence**: 按赔率决策、对可逆风险敢试。
- **minimumEvidenceRequired**: 2

### 5. LEVERAGE
- **worldPrinciple**: LEVERAGE_MULTIPLIES_VALUE（杠杆倍增价值）
- **constructDefinition**: 用户是否理解「价值能否与个人时间解耦」（复用/分发/自动化/协调）。
- **healthyWorldModel**: 偏好结构性产出；理解复用/系统/协调。
- **distortedWorldModel**: 线性交付=唯一选项；个人时间=价值上限。
- **whatItMeasures**: 结构偏好（复用 vs 一次性）；时间解耦认知。
- **whatItMustNotMeasure**: 收入水平、赚钱能力。
- **nearNeighborConstructs[]**: TIME, OPPORTUNITY
- **observableEvidence**: 结构偏好；时间解耦认知。
- **counterEvidence**: 复用/协调/自动化的真实行为。
- **minimumEvidenceRequired**: 2

### 6. TIME
- **worldPrinciple**: TIME_COMPOUNDS_ADVANTAGE（时间复利优势）
- **constructDefinition**: 用户是否理解复利（长期小额投入的非线性回报），是否保护长期时间。
- **healthyWorldModel**: 保护复利时间、持续投入同一方向。
- **distortedWorldModel**: 短期偏好、频繁切换、长期时间被挤压。
- **whatItMeasures**: 复利时间是否被保护；方向持续性（事实）。
- **whatItMustNotMeasure**: 忙不忙、时间管理技巧。
- **nearNeighborConstructs[]**: LEVERAGE, SYSTEMS
- **observableEvidence**: 复利时间保护；方向持续性。
- **counterEvidence**: 长期投入的持续记录。
- **minimumEvidenceRequired**: 2

### 7. IDENTITY
- **worldPrinciple**: IDENTITY_CONSTRAINS_CHOICES（身份约束选择）
- **constructDefinition**: 用户是否把身份视为固定边界（"我是谁决定我能做什么"）还是可更新模型（"我能做什么在演化"）。
- **healthyWorldModel**: 能力框架、身份可更新、可越界。
- **distortedWorldModel**: 角色锁定，过滤掉「不像我」的选项。
- **whatItMeasures**: 边界模型（固定 vs 可更新）；身份框架（角色 vs 能力 vs 适应）。
- **whatItMustNotMeasure**: 职业、是否自信（人格）。
- **nearNeighborConstructs[]**: OPPORTUNITY
- **observableEvidence**: 边界模型；身份框架。
- **counterEvidence**: 跨界尝试、能力化自我描述。
- **minimumEvidenceRequired**: 2

### 8. OPPORTUNITY
- **worldPrinciple**: OPPORTUNITY_EMERGES_THROUGH_EXPOSURE（机会通过暴露涌现）
- **constructDefinition**: 用户是否理解「机会=接触面 × 模式识别」，机会通过暴露涌现。
- **healthyWorldModel**: 多样化接触、主动暴露。
- **distortedWorldModel**: 机会=运气；被动等待；接触面窄。
- **whatItMeasures**: 机会来源；接触多样性。
- **whatItMustNotMeasure**: 人脉资源（财富/资源结果）。
- **nearNeighborConstructs[]**: IDENTITY, LEVERAGE
- **observableEvidence**: 机会来源；接触多样性。
- **counterEvidence**: 多样化接触下的真实机会涌现。
- **minimumEvidenceRequired**: 2

### 9. SYSTEMS
- **worldPrinciple**: SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR（系统产生涌现行为）
- **constructDefinition**: 用户的因果观是系统性的（结构产生涌现），还是线性/单因/归因于人或运气。
- **healthyWorldModel**: 系统因果、找反复规律、情境敏感。
- **distortedWorldModel**: 线性因果、事件归因、人事归因。
- **whatItMeasures**: 因果归因方式（事件/人/线性/系统）；情境敏感度。
- **whatItMustNotMeasure**: 逻辑能力、"聪明程度"。
- **nearNeighborConstructs[]**: TIME, FEEDBACK
- **observableEvidence**: 因果归因；情境敏感度。
- **counterEvidence**: 找反复规律、区分情境条件。
- **minimumEvidenceRequired**: 2

---

## C/D. Eighteen Frozen Core Questions（scenario 版）

> 统一要求：不直接问"你是不是会 XX"；无显然道德正确/聪明人答案；所有选项现实中都有合理理由；用户必须在 trade-off 中暴露 mental model；answer 不直连 blindSpot；occupation/income/wealth 不进 cognition；wealth 不作 leverage/risk/time 默认场景。

每题的 `socialDesirabilityRisk` / `obviousCorrectAnswerRisk` / `gamingRisk` 见 §E 汇总表。

### DECISION
- **SC_DEC_01** 「你有个想了一阵子的机会，条件七成成熟但没完全确定。你更可能？」
  - A「先投一点，试出结果再说」 → 假设:行动制造信息 → E_DEC_START_GATE=act-to-learn
  - B「等更确定再动」 → 假设:决策需确定性 → E_DEC_START_GATE=require-certainty
  - C「问几个做过的人，他们说行我才敢」 → 假设:社会确认优先于自有信息 → E_DEC_START_GATE=social-proof
  - D「把能想到的风险都列清楚再决定」 → 假设:先消除不确定性 → E_DEC_START_GATE=plan-exhaustively
- **SC_DEC_02** 「有一条可能改变你判断的新信息，但要再多等一天。你更可能？」
  - A「等，信息值这一天」 → E_DEC_INFO_VALUE=info-worth-waiting
  - B「不等，先做，边做边看」 → E_DEC_INFO_VALUE=act-now
  - C「没想过信息能改变判断」 → E_DEC_INFO_VALUE=no-awareness

### FEEDBACK
- **SC_FB_01** 「你做的东西被一个你尊重的人否定了，但他的理由你不同意。你更可能？」
  - A「找他当面问清楚分歧在哪」 → E_FB_NEGATIVE_ATTRIBUTION=process-signal
  - B「先放着，按自己判断继续」 → E_FB_NEGATIVE_ATTRIBUTION=trust-self
  - C「换个更懂行的人再问问」 → E_FB_NEGATIVE_ATTRIBUTION=seek-sympathy
  - D「记下分歧，但继续不改」 → E_FB_NEGATIVE_ATTRIBUTION=defer
- **SC_FB_02** 「你的方案被否了两次，理由各不相同。你更可能认为？」
  - A「我的方案有问题，该改」 → E_FB_CONFLICT_RESOLUTION=internalize
  - B「他们没看懂，我再解释清楚」 → E_FB_CONFLICT_RESOLUTION=attribute-other
  - C「意见不统一，听谁的都一样」 → E_FB_CONFLICT_RESOLUTION=dismiss
  - D「各记一条，下次都验证」 → E_FB_CONFLICT_RESOLUTION=test-both

### PROBABILITY（重写，非数学题）
- **SC_PROB_01** 「一个朋友创业成功了，劝你也做。你更可能先想？」
  - A「像他这样成功的人里，失败的有多少」 → 幸存者/基础率意识 → E_PROB_SURVIVORSHIP=asks-base-rate
  - B「他挺靠谱，值得信」 → 采信个例 → E_PROB_SURVIVORSHIP=trust-anecdote
  - C「别人能成我也能」 → 复制幸存者 → E_PROB_SURVIVORSHIP=copy-survivor
  - D「没想过概率这回事」 → 无概率意识 → E_PROB_SURVIVORSHIP=no-awareness
- **SC_PROB_02** 「你说一件事'八成把握'，如果有人能给你一条可能推翻或增强它的信息，但要花点时间。你更可能？」
  - A「值得看，我的八成可能会变」 → 概率可更新 → E_PROB_UPDATABILITY=updates
  - B「都八成了，不用再看」 → 概率固定 → E_PROB_UPDATABILITY=fixed
  - C「我一般不说'几成'，凭感觉」 → 无区间语言 → E_PROB_UPDATABILITY=no-range

### RISK
- **SC_RISK_01** 「一个机会，最坏亏 1000（你能承受），最好赚 1 万。你更可能？」
  - A「看赔率和最坏情况再定」 → 不对称感知 → E_RISK_ASYMMETRY=sees-structure
  - B「只看到'会亏'，不想碰」 → 只看到下行 → E_RISK_ASYMMETRY=loss-only
  - C「只看到'能赚'，就上了」 → 只看到上行 → E_RISK_ASYMMETRY=gain-only
  - D「没想过最坏和最好」 → 无不对称 → E_RISK_ASYMMETRY=no-awareness
- **SC_RISK_02** 「一个失败后可退回的决定。'可退回'这一点会不会影响你的选择？」
  - A「会，可逆就敢试」 → 可逆性进入决策 → E_RISK_REVERSIBILITY=matters
  - B「不会，失败就是失败」 → 不可逆化一切 → E_RISK_REVERSIBILITY=all-equal
  - C「从没区分过可逆不可逆」 → 无区分 → E_RISK_REVERSIBILITY=never-distinguished

### LEVERAGE（去财富语境）
- **SC_LEV_01** 「你要花一周解决一个会反复出现的问题。你更倾向？」
  - A「直接解决这一次」 → 线性 → E_LEV_STRUCTURE_PREFERENCE=solve-once
  - B「先做个以后能反复用的方法/工具，哪怕这次慢」 → 复用 → E_LEV_STRUCTURE_PREFERENCE=build-reusable
  - C「拉几个人分工一起弄」 → 协调 → E_LEV_STRUCTURE_PREFERENCE=coordinate
  - D「没想过这区别」 → 无意识 → E_LEV_STRUCTURE_PREFERENCE=no-distinction
- **SC_LEV_02** 「你的产出，通常更接近？」
  - A「我停手它就停」 → 时间耦合 → E_LEV_DECOUPLING=coupled
  - B「一部分能被别人/流程接着用」 → 时间解耦 → E_LEV_DECOUPLING=decoupled
  - C「从没想过放大」 → 无意识 → E_LEV_DECOUPLING=never-considered

### TIME
- **SC_TIME_01** 「今天有件事能立刻出结果，还有件事三个月后才见效但能持续。你的时间更倾向？」
  - A「先做立刻见效的」 → 即时偏好 → E_TIME_COMPOUND_PROTECTION=immediate-first
  - B「给长期的事留固定时间」 → 保护复利 → E_TIME_COMPOUND_PROTECTION=protects
  - C「忙起来长期的就先搁置」 → 复利被挤压 → E_TIME_COMPOUND_PROTECTION=squeezed
- **SC_TIME_02**（事实题，低偏差）「过去三个月，你在同一件事上持续投入了吗？」
  - A「一直在同一方向」 → E_TIME_DIRECTION_PERSISTENCE=one-direction
  - B「换过一两次」 → E_TIME_DIRECTION_PERSISTENCE=switched
  - C「换来换去」 → E_TIME_DIRECTION_PERSISTENCE=drifting

### IDENTITY（去价值判断）
- **SC_ID_01** 「有个机会需要你做一个从没做过、和现在工作无关的事。你第一反应更接近？」
  - A「我可以学」 → 边界可更新 → E_ID_BOUNDARY_MODEL=learnable
  - B「这不是我的领域」 → 边界固定 → E_ID_BOUNDARY_MODEL=not-my-domain
  - C「我可以找会的人一起」 → 借力越界 → E_ID_BOUNDARY_MODEL=collaborate
  - D「我可能做不好」 → 能力固化 → E_ID_BOUNDARY_MODEL=likely-fail
- **SC_ID_02** 「描述你现在能做什么时，你更常从哪个角度说？」
  - A「我的职业/岗位」 → 角色框架 → E_ID_FRAMING=role
  - B「我具体做过的事」 → 能力框架 → E_ID_FRAMING=capability
  - C「我学起来挺快」 → 适应框架 → E_ID_FRAMING=adaptable
  - D「看对方是谁」 → 情境框架 → E_ID_FRAMING=audience-dependent

### OPPORTUNITY
- **SC_OPP_01** 「你最近一个新想法，最初是从哪冒出来的？」
  - A「接触了不同背景的人/信息」 → 多样暴露 → E_OPP_EXPOSURE_SOURCE=diverse
  - B「熟悉圈子里」 → 窄暴露 → E_OPP_EXPOSURE_SOURCE=familiar
  - C「很久没新想法了」 → 无暴露 → E_OPP_EXPOSURE_SOURCE=rare
  - D「主要靠等，碰上了才想」 → 被动 → E_OPP_EXPOSURE_SOURCE=passive
- **SC_OPP_02** 「你平时接触的人，多大比例和你背景/行业不同？」
  - A「不少」 → E_OPP_CONTACT_DIVERSITY=high
  - B「有一些」 → E_OPP_CONTACT_DIVERSITY=some
  - C「基本同类」 → E_OPP_CONTACT_DIVERSITY=homogeneous

### SYSTEMS（不用"系统/规律/结构"术语）
- **SC_SYS_01** 「一个团队里老出同样的问题，换了几个人还是老样子。你怎么看？」
  - A「问题在流程/环境，换人也一样」 → 结构归因 → E_SYS_ATTRIBUTION=environment
  - B「是人不行，得找对人」 → 人事归因 → E_SYS_ATTRIBUTION=person
  - C「每次原因都不一样」 → 事件归因 → E_SYS_ATTRIBUTION=per-event
  - D「没想过」 → 无意识 → E_SYS_ATTRIBUTION=no-thought
- **SC_SYS_02** 「你的方法在一个场合有效，换到另一个场合失效了。你更可能？」
  - A「场合变了，条件不同」 → 情境敏感 → E_SYS_CONTEXT_SENSITIVITY=context-aware
  - B「方法本身有漏洞」 → 方法归因 → E_SYS_CONTEXT_SENSITIVITY=method-flaw
  - C「运气成分大」 → 运气归因 → E_SYS_CONTEXT_SENSITIVITY=luck
  - D「继续用，多试几次」 → 蛮力重试 → E_SYS_CONTEXT_SENSITIVITY=brute-retry

---

## E. Social Desirability / Gaming Adversarial Test

> USER_A=真实直觉；USER_B=读过 spec 选"最聪明"；USER_C=想得最高评价。若 B/C 能轻易识别"最高分答案" → GAMING_RISK=HIGH。

| 题 | socialDesirabilityRisk | obviousCorrectAnswerRisk | gamingRisk |
|---|---|---|---|
| SC_DEC_01 | LOW | LOW（四选项各有理由） | LOW |
| SC_DEC_02 | LOW | LOW | LOW |
| SC_FB_01 | LOW（改后无"正确项"） | LOW | LOW |
| SC_FB_02 | LOW | LOW | LOW |
| SC_PROB_01 | MEDIUM（A 略"聪明"） | MEDIUM | MEDIUM |
| SC_PROB_02 | MEDIUM | MEDIUM | MEDIUM |
| SC_RISK_01 | LOW | LOW | LOW |
| SC_RISK_02 | LOW | LOW | LOW |
| SC_LEV_01 | LOW | LOW | LOW |
| SC_LEV_02 | LOW | LOW | LOW |
| SC_TIME_01 | MEDIUM（B 略"正确"） | MEDIUM | MEDIUM |
| SC_TIME_02 | LOW（事实题） | LOW | LOW |
| SC_ID_01 | LOW | LOW | LOW |
| SC_ID_02 | LOW | LOW | LOW |
| SC_OPP_01 | MEDIUM | LOW | MEDIUM |
| SC_OPP_02 | LOW | LOW | LOW |
| SC_SYS_01 | LOW | LOW | LOW |
| SC_SYS_02 | LOW | LOW | LOW |

**HIGH_GAMING_RISK_QUESTIONS = 0**（MEDIUM 4 题需在 freeze 后通过 fixture 校准措辞，但无 HIGH）。满足 `<=2`，达标。

---

## F. Atomic Evidence Catalog

> 每 evidence 为 **NOMINAL**（名义类别），非 A>B>C>D 序数。strength 表示该名义值对健康/失真模型的指示强度，非线性量。

| evidenceId | construct | semanticDefinition | sourceQuestionIds | positiveMeaning | negativeMeaning | strength | independenceGroup | contradicts[] |
|---|---|---|---|---|---|---|---|---|
| E_DEC_START_GATE | DECISION | 决策启动门槛类型 | SC_DEC_01 | act-to-learn | require-certainty / social-proof / plan-exhaustively | HIGH | DEC | — |
| E_DEC_INFO_VALUE | DECISION | 是否视信息为决策价值 | SC_DEC_02 | info-worth-waiting / act-now | no-awareness | MODERATE | DEC | — |
| E_FB_NEGATIVE_ATTRIBUTION | FEEDBACK | 负面反馈归因 | SC_FB_01 | process-signal | trust-self / seek-sympathy / defer | HIGH | FB | — |
| E_FB_CONFLICT_RESOLUTION | FEEDBACK | 矛盾反馈裁决 | SC_FB_02 | test-both / internalize | attribute-other / dismiss | MODERATE | FB | — |
| E_PROB_SURVIVORSHIP | PROBABILITY | 幸存者/基础率意识 | SC_PROB_01 | asks-base-rate | trust-anecdote / copy-survivor / no-awareness | HIGH | PROB | — |
| E_PROB_UPDATABILITY | PROBABILITY | 概率可更新性 | SC_PROB_02 | updates | fixed / no-range | MODERATE | PROB | — |
| E_RISK_ASYMMETRY | RISK | 风险不对称感知 | SC_RISK_01 | sees-structure | loss-only / gain-only / no-awareness | HIGH | RISK | — |
| E_RISK_REVERSIBILITY | RISK | 可逆性区分 | SC_RISK_02 | matters | all-equal / never-distinguished | MODERATE | RISK | — |
| E_LEV_STRUCTURE_PREFERENCE | LEVERAGE | 结构偏好 | SC_LEV_01 | build-reusable / coordinate | solve-once / no-distinction | HIGH | LEV | — |
| E_LEV_DECOUPLING | LEVERAGE | 时间解耦认知 | SC_LEV_02 | decoupled | coupled / never-considered | MODERATE | LEV | — |
| E_TIME_COMPOUND_PROTECTION | TIME | 复利时间保护 | SC_TIME_01 | protects | immediate-first / squeezed | HIGH | TIME | — |
| E_TIME_DIRECTION_PERSISTENCE | TIME | 方向持续性（事实） | SC_TIME_02 | one-direction | switched / drifting | HIGH | TIME | — |
| E_ID_BOUNDARY_MODEL | IDENTITY | 身份边界模型 | SC_ID_01 | learnable / collaborate | not-my-domain / likely-fail | HIGH | ID | — |
| E_ID_FRAMING | IDENTITY | 身份框架 | SC_ID_02 | capability / adaptable | role | MODERATE | ID | — |
| E_OPP_EXPOSURE_SOURCE | OPPORTUNITY | 机会来源 | SC_OPP_01 | diverse | familiar / rare / passive | HIGH | OPP | — |
| E_OPP_CONTACT_DIVERSITY | OPPORTUNITY | 接触多样性 | SC_OPP_02 | high | homogeneous | MODERATE | OPP | — |
| E_SYS_ATTRIBUTION | SYSTEMS | 因果归因 | SC_SYS_01 | environment | person / per-event / no-thought | HIGH | SYS | — |
| E_SYS_CONTEXT_SENSITIVITY | SYSTEMS | 情境敏感度 | SC_SYS_02 | context-aware | method-flaw / luck / brute-retry | MODERATE | SYS | — |

独立组（independenceGroup）= 9 个 construct，各 construct 内 2 个 evidence 同源但语义正交（一个测"类型"，一个测"可更新/敏感度"）。

---

## G. Inference Contract

```
answer → atomic evidence(NOMINAL) → signals → dimension state → blindSpot candidates → primary hypothesis
```

- 禁止：answer→blindSpot 直连；context→cognition；ontology priority→primary；ID_OFFSET→语义 primary。
- 每 dimension state ∈ {STRONG, MODERATE, WEAK, UNKNOWN}：
  - STRONG：≥2 evidence 一致指向同向失真 + 无矛盾 evidence。
  - MODERATE：2 evidence 方向一致但有 1 项弱/中性。
  - WEAK：仅 1 项 evidence，或 evidence 自相矛盾。
  - UNKNOWN：无 evidence。
- **missing = UNKNOWN，绝不 missing = deficit**。

---

## H. Uncertainty / Follow-up Contract

Follow-up 触发条件（任一）：
1. `EVIDENCE_INSUFFICIENT`：primary 的独立证据 < 2。
2. `PRIMARY_SEPARATION` 低于阈值（见 §I）。
3. `EVIDENCE_CONTRADICTORY`：同 construct 内 evidence 冲突。
4. `NEAR_NEIGHBOR_AMBIGUITY`：两候选盲区不可区分。

Adaptive discriminating question bank（每组 ≥1）：

| 邻近对 | 判别追问（scenario，只加 evidence，不指定 blindSpot） |
|---|---|
| DECISION ↔ FEEDBACK | 「你最近一次行动后，有没有根据结果改过做法？还是只做了、没回头？」 |
| PROBABILITY ↔ RISK | 「同样一个不确定机会，你更纠结的是『有多大概率成』还是『最坏会怎样』？」 |
| RISK ↔ TIME | 「一个长期方向，短期可能亏。你更在意短期损失，还是长期积累？」 |
| IDENTITY ↔ OPPORTUNITY | 「有个跨领域机会，你是『没遇到过』还是『遇到了但觉得不是我能做的』？」 |
| TIME ↔ SYSTEMS | 「你反复做的事没起色，你会换方向，还是先想是不是做法/条件本身有结构问题？」 |

Follow-up 只增加 evidence；绝不直接指定 blindSpot。

---

## I. Threshold Honesty（PROVISIONAL_ONLY）

| 阈值 | 值 | 状态 |
|---|---|---|
| PRIMARY_SEPARATION_THRESHOLD | 0.08 | **PROVISIONAL_ONLY** |
| PRIMARY_SUFFICIENCY_THRESHOLD | 0.25 | **PROVISIONAL_ONLY** |

**Calibration plan**（阈值未校准前不得 FREEZE 为 validated）：
1. synthetic boundary cases（人工构造 gap 恰在阈值上下）。
2. semantic fixtures（§M 的 23 fixtures）。
3. contradictory fixtures。
4. near-neighbor fixtures。
5. real shadow calibration（真实用户 shadow 数据回灌）。

---

## J. Single Primary Contract

```
IF evidence sufficient AND consistent AND primary distinguishable
  → ONE PRIMARY BLINDSPOT
ELSE IF discriminating follow-up can resolve
  → ASK FOLLOW-UP
ELSE
  → INSUFFICIENT_EVIDENCE
```

禁止「必须给结果，所以选最高分」。禁止 ID_OFFSET 决定 primary（仅作列表稳定排序）。

---

## K. Six-Card Output Contract Freeze

**CARD01 真正的问题是什么？** → `primaryBlindSpot` / `plainLanguageDiagnosis` / `sourceAnswerIds[]` / `evidenceIds[]` / `confidence`

**CARD02 为什么会形成？** → `currentWorldModel` / `mechanism` / `decisionEffect` / `evidenceTrace`（禁止编造童年/家庭/人格历史，只解释当前 evidence 支持的机制）

**CARD03 如果继续保持？** → `currentModelScenario`，统一句式「如果在类似情境中继续使用当前模型，一种更可能出现的路径是……」；禁止命中注定/一定/必然/财富百分比/伪精确 probability。

**CARD04 最值得改变的一件事？** → `ONE strategy` / `whyThisStrategy` / `mechanism`

**CARD05 现实实验（核心）** → `currentHypothesis` / `experiment` / `costBoundary` / `observation` / `supportingOutcome` / `falsifyingOutcome` / `reviewTime`

**CARD06 新的世界模型是什么？** → `oldModel` / `newModel` / `decisionRuleUpgrade`（如 OLD「行动需要先拥有正确答案」→ NEW「在可逆决策里，行动本身可以制造信息」；禁止鸡汤 identity slogan）

---

## L. Legacy Field Policy

| 字段 | 判定 |
|---|---|
| `scoreCard.cashflow` | **REMOVE_FROM_V2_PRODUCT** |
| `wealthProbability` | **REMOVE_FROM_V2_PRODUCT**（无校准的 today/30/90/365 百分比预测，禁入 V2 UI） |
| `potentialIndex` | **REMOVE_FROM_V2_PRODUCT** |
| `wealthPath` | **REMOVE_FROM_V2_PRODUCT** |
| `destinySimulator` | **REWRITE**（改名 scenarioSimulation，去伪精度 confidence，保留双情景） |

其余 V1 诊断字段 → **COMPATIBILITY_INTERNAL_ONLY**（不进 V2 用户界面，仅供旧 Poster 兼容，绝不反向污染 V2 inference）。

---

## M. Semantic Acceptance Fixtures（≥23）

> 每个 fixture 走完整链：answers → evidence → world model → blindSpot → strategy → experiment → falsification → new model。

### 9 Positive Fixtures（每 blindSpot 1）
1. **DECISION_INERTIA**：SC_DEC_01=B(等确定性)+SC_DEC_02=C(无信息意识) → "决策需确定性才敢动" → DI → INCREASE_EXPERIMENT_RATE → 实验:24h 内做一个可逆小动作 → 证伪:行动带来新信息且损失可控 → NEW:可逆决策里行动制造信息。
2. **FEEDBACK_LOOP_GAP**：SC_FB_01=D(记下不改)+SC_FB_02=B(归因他人) → "反馈是威胁/他人问题" → FLG → BUILD_FEEDBACK_LOOP → 实验:找 3 个外部来源检验一个判断 → 证伪:外部证据推翻原判断 → NEW:反馈是更新模型的原料。
3. **PROBABILITY_MISJUDGMENT**：SC_PROB_01=C(复制幸存者)+SC_PROB_02=B(概率固定) → "别人能成我也能，且概率不更新" → PM → UPGRADE_PROBABILITY_THINKING → 实验:查同类事的失败率 → 证伪:失败率高于直觉 → NEW:用区间/基础率思考。
4. **RISK_MODEL_DISTORTION**：SC_RISK_01=B(只看到下行)+SC_RISK_02=C(从不区分可逆) → "一切风险对称且可怕" → RMD → REFRAME_RISK_MODEL → 实验:列 3 件因"有风险"没做的事，算可逆性与最坏 → 证伪:最坏可承受且可逆 → NEW:按不对称和可逆性决策。
5. **LEVERAGE_MODEL_GAP**：SC_LEV_01=A(线性)+SC_LEV_02=A(时间耦合) → "价值=我的时间" → LMG → BUILD_LEVERAGE_MODEL → 实验:把一个产出做成可复用模板 → 证伪:复用被他人使用 → NEW:价值可与时间解耦。
6. **TIME_HORIZON_TRAP**：SC_TIME_01=C(复利被挤压)+SC_TIME_02=C(换来换去) → "短期优先且不持续" → THT → EXTEND_TIME_HORIZON → 实验:每天 1 小时只做长期一件事 → 证伪:长期投入开始产生复利 → NEW:按重要性而非紧急性分配时间。
7. **IDENTITY_CONSTRAINT**：SC_ID_01=B(不是我的领域)+SC_ID_02=A(角色框架) → "我是谁决定我能做什么" → IC → EXPAND_IDENTITY_BOUNDARY → 实验:身份之外做一件小事 → 证伪:做出了原本"不像我"的事 → NEW:能力在演化，身份可更新。
8. **OPPORTUNITY_BLINDNESS**：SC_OPP_01=C(很少遇到)+SC_OPP_02=C(基本同类) → "机会靠运气，接触面窄" → OB → EXPAND_OPTIONALITY → 实验:接触 3 个不同背景的人 → 证伪:新接触带来新想法 → NEW:机会通过暴露涌现。
9. **SYSTEM_THINKING_GAP**：SC_SYS_01=B(人事归因)+SC_SYS_02=D(蛮力重试) → "问题在人，多试几次" → STG → BUILD_DECISION_SYSTEM → 实验:把一个反复问题画成因果链 → 证伪:结构原因浮现 → NEW:结构产生涌现。

### 5 Near-Neighbor Fixtures
10. DI vs FLG：有行动但无复盘（FLG）vs 无行动（DI），判别追问"行动后有没有改过做法"。
11. PM vs RISK：纠结"概率"（PM）vs 纠结"最坏"（RMD），判别追问区分。
12. RMD vs THT：怕短期损失（RMD）vs 没耐心（THT）。
13. ID vs OPP：没遇到过（OB）vs 遇到但觉得不是我能做（IC）。
14. TIME vs SYSTEMS：换方向（THT）vs 先想结构（STG）。

### 3 Contradictory Fixtures
15. SC_FB_01=A(采集反馈) + SC_FB_02=B(归因他人) → 内部矛盾 → 触发 follow-up。
16. SC_DEC_01=A(行动) + SC_TIME_02=C(换来换去) → 决策健康但时间不持续。
17. SC_RISK_01=A(看赔率) + SC_RISK_02=B(不可逆化) → 不对称意识但可逆性盲区。

### 3 Insufficient-Evidence Fixtures
18. 只答 3 题 → EVIDENCE_INSUFFICIENT，不猜 primary。
19. 只答 1 个 construct 的题 → 其余 UNKNOWN，不硬凑。
20. 空提交 → INSUFFICIENT_EVIDENCE。

### 3 Gaming/Idealized Fixtures
21. USER_B 全选"最聪明"答案 → 无单一盲区可信 → 应降级为 UNKNOWN/INSUFFICIENT，非伪造高置信。
22. USER_C 全选"健康态" → 系统应识别"过度一致"（无内部矛盾、无真实 trade-off），标记低可信。
23. 全选 A（机械作答） → 应识别为 gaming/无效作答，不产出强结论。

**合计 = 23 fixtures。** 验收标准不是"代码返回标签"，而是"推理链在产品语义上成立"。

---

## N. Current V2 → Proposed V2 Migration Map

| 层 | 判定 |
|---|---|
| 9 constructs（ontology） | **REUSE**（定义已冻结于 §B，仅细化） |
| 18 questions | **REWRITE**（habit → scenario，§C/D） |
| 20 evidence（旧 habit-ordinal） | **REWRITE**（18 个 nominal scenario-evidence，§F） |
| 18 signals | **REWRITE**（跟随 evidence 语义） |
| 9 dimensions | **REUSE ontology**；aggregation 从「avg(score)」改「distortion profile → state」 |
| 9 blindspots | **REUSE**（ontology 无漂移） |
| `computeIdOffsetV2` tie-break | **RETIRE**（语义判定；仅保留列表稳定排序） |
| adapterV2 wealth 字段 | **REMOVE_FROM_V2_PRODUCT**（§L） |
| 六卡报告 | **NEW**（§K） |
| destinySimulator | **REWRITE → scenarioSimulation**（§L） |

---

## FINAL FREEZE DELIVERABLE VERDICT

| 判定 | 值 |
|---|---|
| WORLD_OS_ONTOLOGY | **FROZEN**（9 construct = 9 世界原则，无漂移） |
| QUESTIONNAIRE_CONSTRUCT_VALIDITY | **VALID**（scenario 化，测潜隐假设非习惯） |
| QUESTIONNAIRE_GAMING_RESISTANCE | **HIGH**（HIGH_GAMING_RISK=0，MEDIUM=4 待校准） |
| EVIDENCE_TRACEABILITY | **FULL**（answer→nominal evidence→signal→state→blindspot 全链可追溯） |
| NEAR_NEIGHBOR_DISCRIMINATION | **DESIGNED**（5 对 + 判别追问 bank） |
| UNCERTAINTY_HONESTY | **YES**（UNKNOWN/INSUFFICIENT/判别追问；阈值 PROVISIONAL） |
| SINGLE_THEME_COMPLIANCE | **YES**（3 分支决策，禁 ID_OFFSET 语义 primary） |
| SIX_CARD_ALIGNMENT | **FROZEN**（§K，含证伪条件） |
| LEGACY_WEALTH_CONTAMINATION | **REMOVED**（wealth 字段退出 V2 UI） |
| TRANSFORMATION_LOOP_COMPLETE | **YES**（假设→决策→证伪→实验→更新，五步闭环） |
| QUESTIONNAIRE_CONTRACT_READY | **YES**（18 题 + option 语义 + evidence 目录） |
| INFERENCE_CONTRACT_READY | **YES**（链 + state + uncertainty） |
| REPORT_CONTRACT_READY | **YES**（六卡 + legacy 政策） |
| READY_FOR_IMPLEMENTATION | **NO**（阈值仍 PROVISIONAL_ONLY，需先跑 §I 校准；禁止据此写 production code） |

**STOP。** 本文件为 DESIGN/CONTRACT FREEZE，未改 production/client/cloud function，未 deploy，未切 MODE，未改 DB。
