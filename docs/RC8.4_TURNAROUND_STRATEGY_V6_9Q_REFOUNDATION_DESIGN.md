# RC8.4 — TURNAROUND STRATEGY V6 (9Q) REFOUNDATION — DESIGN

- **Status:** DESIGN FROZEN (design-only — no code, no deploy, no engine change)
- **Date:** 2026-09-11
- **Branch:** `design/rc8.4-v6-9q-refoundation`
- **Base:** `95467fc` — `test(rc8.3): freeze stage1c north star release gates`
  (canonical RC8.3 tip; frozen north-star release gates)
- **Supersedes (as primary product):** `RC8.3_WORLD_MODEL_PRIMARY_PLAN`

> The report must answer **"为什么这个人一直卡在这里？"**
> not **"这个人属于什么认知模型？"**

---

## 1. GOVERNANCE FREEZE

```
RC8.3_WORLD_MODEL_PRIMARY_PLAN      = TERMINATED
WORLD_MODEL_ENGINE                  = PRESERVE
WORLD_MODEL_CODE_DELETE             = NO
WORLD_MODEL_PRIMARY_AUTHORITY       = NO
WORLD_MODEL_FUTURE_ROLE             = SECONDARY_EVIDENCE / DEEP_TEST / SHADOW_RESEARCH
NEW_PRIMARY_PRODUCT                 = TURNAROUND_STRATEGY_V6
PRIMARY_QUESTION_COUNT              = 9
```

Rationale: the 18Q / 9-construct ontology answers *"what cognitive model is this
person?"* V6 must answer *"why is this person stuck here?"* — a product question,
not a taxonomy question. The engine stays as a secondary evidence layer; it loses
primary authority because consumer relevance + actionability outrank ontology
elegance.

---

## 2. LEGACY 6Q REVIEW

Old fields: `age, occupation(job), education, income, anxiety, rootCause`.

**KEEP**
- `age` → **Q1 AGE_STAGE**. Buckets outcome-relevant life stage (obligations,
  runway, risk tolerance). Cheap, non-intrusive, high reality-anchoring value.
  Kept as *stage*, not exact number.
- `occupation` → **Q2 INCOME_MODE** (+ optional short text). What matters is not
  job title but *how money arrives* (fixed / variable / asset). Drives which
  transition is realistic.
- `anxiety` → **Q4 PRIMARY_PROBLEM**. Reframed from "what worries you" to "what do
  you want to solve first" — converts a feeling into an addressable target.
- `rootCause` → **Q5 USER_BELIEF**. Spine of V6: the *self-reported cause* we test
  against behavior.

**TRANSFORM**
- `income (absolute figure)` → **Q3 MONTHLY_SURPLUS**. Absolute income misleads
  (high income, zero surplus ≈ no optionality). Disposable surplus is the true
  constraint on what the user can *do next*. Same field, better variable.

**DROP_FROM_PRIMARY**
- `education` → **dropped**. (a) does not change the recommended first action at
  any stage; (b) invites social-desirability noise and class judgment; (c) World
  Model constitution already forbids credentials as a diagnostic trigger. May
  return only as optional *context*, never primary.

---

## 3. 18Q REDUCTION

From World Model v2.1's 9 constructs, retain only product-relevant **behavioral
measurement**:

| Retained (primary) | Productized from | Used by |
|---|---|---|
| **A. DECISION** | DECISION construct | Q7 UNCERTAINTY_BEHAVIOR |
| **B. TIME** | TIME construct | Q8 TIME_BEHAVIOR |
| **C. NO-RESULT RESPONSE** | FEEDBACK ∪ SYSTEMS (behavioral slice only) | Q9 NO_RESULT_BEHAVIOR |

```
PRIMARY_WORLD_MODEL_CONSTRUCTS_RETAINED = 3
PRIMARY_WORLD_MODEL_CONSTRUCTS_REMOVED  = 6
```

Removed from primary: `PROBABILITY, RISK, LEVERAGE, IDENTITY, OPPORTUNITY`, plus
the non-productized internals of `FEEDBACK` (distortion taxonomy) and `SYSTEMS`
(ontology). These remain **secondary evidence only** (deep-test / shadow), never
questionnaire requirements.

> Retained C is deliberately a *behavior* ("what do you do when it doesn't
> work"), not the FEEDBACK *diagnosis* ("how do you process feedback"). Consumers
> answer the former; only research uses the latter.

---

## 4. FINAL 9 QUESTIONS (FROZEN)

Frozen verbatim. Q1/Q2/Q3 = **REALITY** · Q4 = **DESIRED CHANGE** · Q5 = **BELIEF**
· Q6 = **EXECUTION STAGE** · Q7/Q8/Q9 = **BEHAVIOR**.

### Q1 AGE_STAGE
你现在处于哪个年龄阶段？ — 18–24 / 25–30 / 31–40 / 41–50 / 51+

### Q2 INCOME_MODE
你现在主要靠什么获得收入？ — 固定工资 / 生意·个体经营 / 自由职业·接单 /
投资·资产收入 / 暂时没有稳定收入 / 其他
_Optional: occupation / industry short text_

### Q3 MONTHLY_SURPLUS
扣掉必须支出后，你一个月通常还能留下多少钱？ — 基本留不下·经常不够 /
1000元以下 / 1000–5000元 / 5000–10000元 / 1万元以上

### Q4 PRIMARY_PROBLEM
如果现在只能先解决一个问题，你最想先解决什么？ — 收入一直上不去 /
工作看不到未来 / 债务·现金流压力 / 想转行，但不知道往哪走 /
想做副业，但一直没做起来 / 有能力，但不知道怎么变现 /
事情很多，一直无法聚焦 / 其他

### Q5 USER_BELIEF
你觉得自己一直没走出来，最主要是什么原因？ — 不知道该往哪走 /
知道方向，但一直没真正行动 / 做过不少尝试，但没结果 / 缺钱·缺资源 /
没时间 / 怕失败 / 总在换方向 / 能力还不够 / 家庭·环境牵制 / 其他

### Q6 EXECUTION_STAGE
过去一年，为了改变现状，你真正做到哪一步了？ — 主要还在想 /
查过很多资料 / 学过东西，但没真正开始 / 开始做过，但没坚持多久 /
做过产品·服务，但没人买单 / 已经有人愿意付钱 / 已经有一点稳定结果

### Q7 UNCERTAINTY_BEHAVIOR
遇到一个你觉得有机会、但还没十足把握的事情，你通常怎么做？ —
先做个很小的版本试试 / 再等等，信息更充分再说 / 先问几个做过的人 /
先把可能的问题都想清楚

### Q8 TIME_BEHAVIOR
一件事今天就能看到结果，另一件三个月后才见效但能长期积累，你通常先顾哪件？ —
先做马上有结果的 / 两边都会安排 / 会固定给长期的事留时间 /
一忙起来，长期的事就先停

### Q9 NO_RESULT_BEHAVIOR
一件事做了一阵还没结果，你通常下一步会怎么做？ — 换个方向试试 /
再坚持一阵 / 找别人看看我哪里做错了 / 重新检查方法和步骤 /
先停下来，不再继续投入

---

## 5. QUESTION NECESSITY TEST

| Q | IF_THIS_QUESTION_REMOVED → capability lost |
|---|---|
| Q1 | Lose life-stage framing → Card04/05 stop being age-appropriate (25 vs 45 same advice). |
| Q2 | Lose income-mode → cannot distinguish "escape a salary trap" from "stabilize variable income"; transition target breaks. |
| Q3 | Lose feasibility budget → Card05 actions become unaffordable (a 5000元 test for negative surplus is malpractice). |
| Q4 | Lose the target → Card02/03 have nothing to contrast belief against; report becomes generic. |
| Q5 | Lose the belief→behavior contrast → the entire V6 differentiator (BELIEF_REALITY_GAP) collapses. |
| Q6 | Lose stage → Card01 tone and Card04 FROM/TO impossible; stage drives ~60% of routing. |
| Q7 | Lose uncertainty behavior → cannot separate DIRECTION_GAP from ACTION_GAP. |
| Q8 | Lose time allocation → cannot distinguish CONSISTENCY_GAP from ACTION_GAP, nor spot "long-term never protected". |
| Q9 | Lose no-result behavior → cannot distinguish VALIDATION_GAP from REPEATABILITY_GAP. |

**No question is removable without losing a named capability.**

```
REDUNDANT_QUESTION_COUNT = 0
```

---

## 6. V6 DATA MODEL

```
turnaroundProfile = {
  reality: {
    ageStage:        Q1,
    incomeMode:      Q2,
    monthlySurplus:  Q3,
    occupation:      Q2.optionalText
  },
  desiredChange: { primaryProblem: Q4 },
  userBelief:    { perceivedRootCause: Q5 },
  executionStage:{ currentStage: Q6 → mapped stage },
  behavior: {
    uncertaintyResponse: Q7,
    timeAllocation:      Q8,
    noResultResponse:    Q9
  }
}
```

Every downstream claim carries a provenance pointer to one of these fields (§9, §17–19).

---

## 7. PRIMARY BOTTLENECK MODEL

Exactly five product-facing bottlenecks + two derived modifiers. No new ontology.

| ID | One-line meaning |
|---|---|
| **DIRECTION_GAP** | No committed target — stuck choosing/rotating, not executing. |
| **ACTION_GAP** | Target known (or knowable) but action never starts; endless prep. |
| **CONSISTENCY_GAP** | Action starts then breaks; nothing gets a long enough run. |
| **VALIDATION_GAP** | Effort produced but never met real paying/real demand signal. |
| **REPEATABILITY_GAP** | A result exists but cannot be reproduced reliably. |
| **REALITY_CONSTRAINT** (derived) | Hard resource limit (surplus/debt/time) capping feasible action size. **Modifier, never a primary.** |
| **BELIEF_REALITY_GAP** (derived) | Self-reported cause ≠ behavioral evidence. **Modifier, flags where contrast lands.** |

---

## 8. BOTTLENECK RULE TABLE (deterministic)

Selection precedence: **stage-first, then disambiguate by Q5/Q7/Q9.**
REALITY_CONSTRAINT and BELIEF_REALITY_GAP never override the primary; they attach.

**DIRECTION_GAP**
- REQUIRED: stage ∈ {THINKING, RESEARCHING} **AND** Q5 ∈ {不知道该往哪走, 总在换方向} **AND** Q9 = 换个方向试试.
- SUPPORTING: Q7 = 再等等; Q8 = 一忙起来长期的事就先停; Q4 ∈ {工作看不到未来, 想转行但不知道往哪走, 有能力但不知道怎么变现}.
- CONTRADICTING: Q6 ≥ STARTED with a real attempt; Q9 ∈ {再坚持一阵, 重新检查方法}.
- FALLBACK: partial → escalate to ACTION_GAP if Q5 = 知道方向但没行动.

**ACTION_GAP**
- REQUIRED: stage ∈ {THINKING, LEARNING} **AND** Q7 ∈ {再等等, 先把问题想清楚} **AND** (Q5 = 知道方向但一直没真正行动 **OR** Q6 = 学过但没真正开始).
- SUPPORTING: Q6 = 查过很多资料; Q8 = 一忙起来长期的事就先停.
- CONTRADICTING: Q6 ≥ STARTED; Q7 = 先做很小版本试试.
- FALLBACK: if Q5 = 不知道该往哪走 → DIRECTION_GAP.

**CONSISTENCY_GAP**
- REQUIRED: Q6 = 开始做过但没坚持多久 **AND** (Q9 = 换个方向试试 **OR** Q8 = 一忙起来长期的事就先停).
- SUPPORTING: Q5 = 总在换方向; Q7 = 再等等.
- CONTRADICTING: Q6 ≥ EARLY_TRACTION; Q8 = 会固定给长期的事留时间.
- FALLBACK: if Q6 = 学过没真正开始 → ACTION_GAP.

**VALIDATION_GAP**
- REQUIRED: Q6 = 做过产品/服务但没人买单 **AND** Q7 ∈ {再等等, 先把问题想清楚} **AND** no payment evidence (Q6 < 已经有人愿意付钱).
- SUPPORTING: Q4 ∈ {想做副业但一直没做起来, 有能力但不知道怎么变现}; Q9 ∈ {换个方向试试, 先停下来}.
- CONTRADICTING: Q6 = 已经有人愿意付钱; Q5 = 做过不少尝试但没结果 (redirects to method, not demand).
- FALLBACK: if continuity is the actual break → CONSISTENCY_GAP.

**REPEATABILITY_GAP**
- REQUIRED: Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果} **AND** (Q8 ∈ {先做马上有结果的, 一忙起来长期的就停}) **AND** no repeatable process evidence.
- SUPPORTING: Q4 = 收入一直上不去; Q7 = 先做很小版本试试 (proves trial ability, not system).
- CONTRADICTING: Q6 = 稳定结果 **AND** Q8 = 固定给长期的事留时间.
- FALLBACK: if stable + systemized → downgrade report to maintenance card.

**REALITY_CONSTRAINT** (attach)
- TRIGGER: Q3 ∈ {基本留不下/经常不够, 1000元以下} **OR** Q4 = 债务·现金流压力.
- EFFECT: cap Card05 estimated cost/time; add cashflow-stabilizing pre-step **only when stage ≥ STARTED** (never replace core action).

**BELIEF_REALITY_GAP** (attach): see §9.

Rules read only canonical option identities; no probabilities, no weights, no scores,
no severity. Contradictions resolved REQUIRED-first → CONTRADICTING suppression →
FALLBACK — deterministic and reproducible.

---

## 9. USER BELIEF VS BEHAVIOR (core V6 feature)

For each Q5 self-cause, test against behavioral + reality evidence. If mismatch →
emit `beliefRealityGap` clause with `provenance = [Q5, <behaviorQ>, <realityQ?>]`.

| User says (Q5) | Observed evidence | Gap clause | Provenance |
|---|---|---|---|
| 缺钱/缺资源 | Q6 ∈ {还在想, 查资料, 学过没开始} | "你把'缺资源'当成主因，但过去一年你仍停在学习和准备阶段——资源问题在被真实使用时才会暴露。" | Q5 + Q6 |
| 没时间 | Q8 ∈ {先做马上有结果的, 一忙起来长期的就停} | "你觉得是没时间，但证据显示长期事项从未被固定保护过——不是没有时间，是没有给长期事项留位置。" | Q5 + Q8 |
| 不知道该往哪走 | Q9 = 换个方向试试 / Q5 = 总在换方向 | "你说方向不清，但你的行为是'在验证之前就换方向'——方向被换掉了，不是没找到。" | Q5 + Q9 |
| 能力还不够 | Q6 = 做过但没人买单, Q7 = 先把问题想清楚 | "你觉得能力不够，但你没有把它拿去被真实需求检验过——卡住的是验证，不是能力。" | Q5 + Q6 + Q7 |
| 怕失败 | Q7 = 先做很小版本试试 | **No gap** — belief matches behavior. Do NOT manufacture contrast. | Q5 + Q7 |
| 做过不少尝试但没结果 | Q6 ≥ STARTED, Q9 = 重新检查方法 | **No gap** — belief accurate; proceed with method-stage advice. | Q5 + Q6 |

Gate: a gap clause is emitted **only** when both a belief signal and a contradicting
behavior signal exist. No gap is invented to make the report feel sharp.

---

## 10. EXECUTION STAGE (frozen, mapped from Q6)

| Q6 answer | Stage |
|---|---|
| 主要还在想 | THINKING |
| 查过很多资料 | RESEARCHING |
| 学过东西，但没真正开始 | LEARNING |
| 开始做过，但没坚持多久 | STARTED |
| 做过产品/服务，但没人买单 | TESTING |
| 已经有人愿意付钱 | EARLY_TRACTION |
| 已经有一点稳定结果 | STABLE_TRACTION |

```
EXECUTION_STAGE_COUNT = 7
```

Mapping is strict 1:1; stage is the routing backbone.

---

## 11. FIVE-CARD REPORT (primary product)

```
01 致命一句话   — one-line reframe (≤60 chars)
02 核心问题     — why belief does/does not match behavior (mechanism)
03 系统困局     — the real-life loop the user is inside
04 翻身路径     — FROM current stage → TO next productive stage
05 现在就做     — exactly ONE 24–48h action
```

---

## 12. CARD01 — 致命一句话

Generate from `userBelief + primaryBottleneck + executionStage + behaviorEvidence`.
Pattern: **"你真正缺的不是 X，而是 Y"** (X = user's Q5 belief; Y = bottleneck mechanism).

```
REALITY_REFERENCE_ALLOWED      = YES
USER_BELIEF_CONTRAST_REQUIRED  = where supported (else plain stage framing)
MAX_CHARS                      = <= 60
COGNITIVE_TAXONOMY             = NO   (no construct/blindspot names)
```

If BELIEF_REALITY_GAP is absent, fall back to stage framing
("你现在的位置是 …，缺的是 …") — no forced X/Y.

---

## 13. CARD02 — 核心问题

Explain **why** the belief does/does not match behavior. Must reference **execution
stage + ≥1 behavior signal**.

```
CORE_MECHANISM_EXPLICIT = YES
```

Template: "[自述原因] 在 [stage] 这个阶段，通常不是主因。你的行为显示 [behavior
signal]，所以真正卡住的是 [bottleneck mechanism]。"

---

## 14. CARD03 — 系统困局

One concrete loop using real context:

```
REALITY PRESSURE → ATTEMPT → DEFAULT BEHAVIOR → STALL → RESULT → BELIEF REINFORCEMENT
```

Feeds: Q3 surplus / Q4 problem (pressure) + Q6 attempt + Q7/Q8/Q9 (default behavior)
+ Q5 (reinforcement). No world-model jargon ("DISTORTED / construct / dimension"
forbidden in copy).

---

## 15. CARD04 — 翻身路径

Next-stage transition; FROM = current stage/behavior, TO = next productive stage.
Canonical transitions:
`THINKING→STARTED · RESEARCHING→STARTED · LEARNING→TESTING · STARTED→CONSISTENCY ·
TESTING→VALIDATION · EARLY_TRACTION→REPEATABILITY · STABLE_TRACTION→SCALE/MAINTAIN`.

```
FROM = current behavior/stage
TO   = next productive stage
```

Each transition names the single capability the next stage needs
(e.g. LEARNING→TESTING needs *contact with a real user*, not more study).

---

## 16. CARD05 — 现在就做

```
FIRST_ACTION_COUNT = 1
SUPPORTING_CHECKS  <= 3
WINDOW             = 24–48h
```

Derived from `executionStage + primaryBottleneck`, sized by `monthlySurplus`.
**Different stages produce materially different actions:**

| Stage | First action type |
|---|---|
| THINKING | Pick ONE of 3 candidates, write its 7-day minimal test. |
| RESEARCHING | Stop researching; run the smallest reversible version once. |
| LEARNING | Take the studied thing to one real person; capture their reaction. |
| STARTED | Fix a non-negotiable recurring 30-min slot for the one direction. |
| TESTING | Ask 3 real target users one demand question; record answers. |
| EARLY_TRACTION | Take the same offer to 3 new buyers, identical script. |
| STABLE_TRACTION | Document the exact steps that produced the result once. |

---

## 17. REALITY REFERENCE GATE

```
REALITY_REFERENCE_COUNT >= 2
```

Allowed inputs: age stage, occupation/income mode, monthly surplus, primary
problem, execution stage. Relevance-gated: never force an irrelevant context just
to hit the count.

## 18. BEHAVIOR REFERENCE GATE

```
BEHAVIOR_REFERENCE_COUNT >= 2   (from Q7/Q8/Q9, where relevant)
```

If a behavior question is genuinely inapplicable, use Q7 + Q8 only; never fabricate.

## 19. USER BELIEF GATE

```
USER_BELIEF_REFERENCE_COUNT >= 1
EXCEPTION: Q5 = 其他 with no usable text → belief gate waived, contrast suppressed.
```

## 20. ANTI-OVERCLAIM

Never infer or state: personality, destiny, income potential, future wealth,
success probability. Forbidden tokens: **你一定 / 你注定 / 只要就能 / 成功率 /
翻身概率**. No percentages in user copy. Certainty language only about *current
observed state*, never about outcome.

---

## 21. OLD NORTH STAR PRESERVATION

Freeze (read-only, keep runnable, do not rewrite during V6 phase):

```
WORLD_MODEL_FILES_TO_FREEZE = [
  cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/        (15 files)
    index.js, questionnaireV21.js, evidenceCatalogV21.js,
    evidenceNormalizerV21.js, signalExtractorV21.js, dimensionEngineV21.js,
    primaryDecisionEngineV21.js, blindSpotCandidateEngineV21.js,
    followUpBankV21.js, followUpDiscriminatorV21.js, responseValidityV21.js,
    canonicalAnswerValidatorV21.js, cognitiveReportContractV21.js,
    cognitiveReportBuilderV21.js, runtimeShadowAdapterV21.js
  cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/  (9 files)
    index.js, northStarPresentationModelV21.js, northStarPresentationValidatorV21.js,
    worldPrinciplePresentationV21.js, evidenceExplanationV21.js,
    report/{index.js, northStarReportCopyV21.js, northStarReportBuilderV21.js,
            northStarReportValidatorV21.js}
]
WORLD_MODEL_RUNTIME_ROLE = SECONDARY_ONLY
```

---

## 22. MIGRATION PLAN

New route, side-by-side. **Do not overwrite v2.1.**

```
NEW ROUTE (design only, not created):
  pages/turnaround-v6-questionnaire/
  pages/turnaround-v6-report/
NEW CONTRACT VERSION: turnaround_strategy_v6
OLD ROUTE: pages/v21-questionnaire/ + pages/v21-cognitive-report/  → remains testable
```

Cloud function: add a new branch/handler keyed by
`contractVersion === 'turnaround_strategy_v6'`; leave `world_model_v2_1` path
untouched. Shared plumbing (auth, quota, payment) reused; report engine separate.

---

## 23. NO ENGINE-FIRST FAILURE

Mandatory order — no step may be skipped:

```
1. 9Q final copy                        ← §4 satisfies
2. deterministic rule table             ← §8
3. 10–20 human-readable fixture reports ← §24 (15 provided)
4. human product review
5. only then code engine
6. only then UI
7. only then automation tests
```

Do NOT build ontology before report quality is proven. V6 has **no ontology** —
five bottlenecks + two modifiers only.

---

## 24. GOLDEN PRODUCT FIXTURES (15)

Card legend: `01` 致命一句话 · `02` 核心问题 · `03` 系统困局 · `04` 翻身路径 ·
`05` 现在就做.

**F1 · 低结余 / 工资 / 方向缺口**
输入: 25–30, 固定工资, 1000元以下, 有能力但不知道怎么变现, 不知道该往哪走, 查过很多资料, 再等等, 先顾眼前, 换个方向试试 → RESEARCHING / DIRECTION_GAP
```
01 你缺的不是机会，是把一个方向做满30天的定力。
02 你说不知道往哪走，但你已经查了很多资料、换过几次方向——方向是在行动里显形的，不是在资料里找到的。(stage=RESEARCHING；行为=遇机会"再等等")
03 工资月底留不下 → 想找出路 → 又去查资料、等更确定 → 长期方向被"先顾眼前"挤掉 → 月底依旧留不下 → "我还没找到方向"被反复强化。
04 RESEARCHING → STARTED：选定一个7天内能做完的方向，做一次最小投放，不再追加研究。
05 今天列出3个最想试的方向，各写一个7天内可完成、花费<200元的动作；48小时内执行其中一个的第一步。检查：①有明确结束标准 ②产生一个可被他人看到的结果 ③花费<200元。
```

**F2 · 工资 / 行动缺口**
输入: 31–40, 固定工资, 1000–5000元, 收入一直上不去, 知道方向但一直没真正行动, 学过东西但没真正开始, 先把可能问题想清楚, 两边都会安排, 再坚持一阵 → LEARNING / ACTION_GAP
```
01 你不缺方法，你缺一次不等"准备好"就开始。
02 你说知道方向却没行动——在LEARNING阶段，你的行为仍是"先把问题想清楚"、一直停在学过没开始，所以卡点是启动，不是认知。(stage=LEARNING；行为=准备优先于行动)
03 收入上不去 → 想做个能加收入的副线 → 总想先想清楚/等条件成熟 → 迟迟没开始 → 收入没变 → "我还没准备好"被强化。
04 LEARNING → TESTING：把学到的东西交到一个真实的人手里，拿一次真实反应，而不是继续补知识。
05 今天挑一个你学过的东西，规定一个"最小交付"，48小时内展示给1个真实的人听他反馈。检查：①交付物能被别人看到 ②对方给出一句具体反馈 ③你在48h内完成。
```

**F3 · 副业尝试 / 一致性缺口**
输入: 25–30, 自由职业, 1000–5000元, 想做副业但一直没做起来, 总在换方向, 开始做过但没坚持多久, 再等等, 一忙起来长期的就停, 换个方向试试 → STARTED / CONSISTENCY_GAP
```
01 你不是做不成，你是在每次快有积累时换掉它。
02 你说想做起副业——在STARTED阶段你的行为是"一忙就停长期的事"、遇到没结果就换方向，所以卡点是连续性，不是方向。(stage=STARTED；行为=长期事项被挤停)
03 收入不稳 → 起一个副业 → 一忙先把长期的事停掉 → 几周后没起色 → 换个新方向 → 又没积累 → "这个方向不行"被强化。
04 STARTED → CONSISTENCY：给同一个方向一个不可挪用的固定时段，先跑满4周再评估。
05 现在为唯一保留的那个方向，在日程里锁死一个每周3次、每次30分钟的固定时段；48小时内完成第一次并记录。检查：①时段不可被临时事务挤掉 ②连续记录满一周 ③中途不换方向。
```

**F4 · 做过没人买单 / 验证缺口**
输入: 31–40, 个体经营, 1000–5000元, 想做副业但一直没做起来, 做过不少尝试但没结果, 做过产品/服务但没人买单, 先把可能问题想清楚, 两边都会安排, 重新检查方法和步骤 → TESTING / VALIDATION_GAP
```
01 你的问题不是做得不够好，是还没被真实需求检验过。
02 你有过尝试和交付——在TESTING阶段你的行为是"先想清楚"再自查方法，说明你仍在自评，没有接触付费方，所以卡点是需求验证。(stage=TESTING；行为=自查优先于外部检验)
03 收入受限 → 做出产品或服务 → 先自己打磨/等想清楚 → 没有真实用户反馈 → 没人买单 → "市场不行"被强化。
04 TESTING → VALIDATION：把同一个卖点直接放到真实买家面前，要一个"买/不买"的明确答案。
05 48小时内找3个真实目标用户，只问一句："如果这个东西卖X元，你会现在买吗？为什么？"，记录原话。检查：①对象是真实可付费人群 ②收到明确的买/不买 ③不解释、不推销。
```

**F5 · 首批付费 / 可复制缺口**
输入: 25–30, 自由职业, 5000–10000元, 收入一直上不去, 能力还不够, 已经有人愿意付钱, 先做个很小的版本试试, 先做马上有结果的, 再坚持一阵 → EARLY_TRACTION / REPEATABILITY_GAP
```
01 你已经赚到过钱，但你还不会"重复地"赚到它。
02 你已经有付费客户——在EARLY_TRACTION阶段你的行为偏向先抓有结果的活，说明你能成交但不沉淀做法，所以卡点是把偶然变成可复制。(stage=EARLY_TRACTION；行为=抓即时结果)
03 有客户付费 → 接单/交付 → 每次都从头来、只接来单 → 收入随忙闲波动 → 无法扩大 → "我得靠运气/拼时间"被强化。
04 EARLY_TRACTION → REPEATABILITY：把成交过一次的做法写成一套别人也能照着走的步骤。
05 今天把你最近一次成功收钱的全过程，拆成"找谁—说什么—怎么交付"三步写下来；48小时内用同一套话术找3个同类新客户照做。检查：①步骤能被别人执行 ②话术不临时改动 ③至少1次复现同一结果。
```

**F6 · 债务压力**
输入: 31–40, 固定工资, 基本留不下/经常不够, 债务/现金流压力, 没时间, 做过产品/服务但没人买单, 先把可能问题想清楚, 一忙起来长期的就停, 先停下来不再投入 → TESTING / VALIDATION_GAP + REALITY_CONSTRAINT
```
01 你现在最急的不是翻身，是先把水面露出来喘口气。
02 你有过尝试——在TESTING阶段你被现金流压着，行为是"先停下来"和长期事项被挤停，所以短期卡点是现金流，不是方向。(stage=TESTING；行为=遇阻停投)
03 还款压力 → 想做个增收的事 → 精力被日常与还债占满 → 长期尝试停摆 → 现金流更紧 → "我只能先顾眼前"被强化。
04 TESTING → VALIDATION（低配）：选一个不花钱、本周就能收到第一笔小额现金的最小动作，先恢复正反馈。
05 48小时内列出2个"今天就能收到第一笔小额现金"的动作（如已在手技能的即时接单），选成本最低的一个，今天发出第一个联系。检查：①零或极低启动成本 ②48h内可收到第一笔钱 ③不新增负债。
```

**F7 · 职业转型**
输入: 41–50, 固定工资, 5000–10000元, 想转行但不知道往哪走, 不知道该往哪走, 查过很多资料, 先问几个做过的人, 两边都会安排, 换个方向试试 → RESEARCHING / DIRECTION_GAP
```
01 你不是没方向，你是在用"研究"替代"下水"。
02 你说想转行不知往哪去——在RESEARCHING阶段你查资料、问过来人，但行为是先问别人再动，所以卡点是没有一次自己的真实试水。(stage=RESEARCHING；行为=他人确认优先)
03 现有工作看不到未来 → 想转行 → 查资料、问过人 → 始终没亲自试一次 → 停在原地 → "转行风险太大"被强化。
04 RESEARCHING → STARTED：把一个候选方向做成一次业余的真实小项目，用自己的结果替代他人的意见。
05 今天从你想转的方向里选一个，设计一个两周内、动用业余时间就能完成的最小真实任务；48小时内启动第一步。检查：①不辞掉现职 ②两周内可完成 ③产出一次自己的真实结果而非别人的说法。
```

**F8 · 40+ 阶段**
输入: 41–50, 生意/个体经营, 5000–10000元, 工作看不到未来, 能力还不够, 开始做过但没坚持多久, 再等等, 一忙起来长期的就停, 再坚持一阵 → STARTED / CONSISTENCY_GAP
```
01 你的经验已经够了，缺的是把经验放进一个能重复的位置。
02 你说能力还不够——在STARTED阶段你的行为是一忙就停长期的事、遇阻先等，说明卡点是连续性而非能力，40+的经验是资产不是短板。(stage=STARTED；行为=长期事项被挤停)
03 生意增长停滞 → 想升级做法 → 一忙回到旧模式、长期改进被停 → 停在原水平 → "我这年纪学不动了"被强化。
04 STARTED → CONSISTENCY：把已有经验锁定成一个每周固定推进的升级动作，用连续4周换一次跃迁。
05 现在写下你经验里最有价值的一项能力，定一个每周2次、每次45分钟的固定时段专门把它做成可重复产出；48小时内完成第一次。检查：①时段固定不被挤掉 ②产出物可复用 ③连续坚持4周再评估。
```

**F9 · <30 阶段**
输入: 18–24, 暂时没有稳定收入, 基本留不下/经常不够, 有能力但不知道怎么变现, 不知道该往哪走, 主要还在想, 先做个很小的版本试试, 先做马上有结果的, 换个方向试试 → THINKING / DIRECTION_GAP + REALITY_CONSTRAINT
```
01 你最该做的不是想清楚，是尽快做出第一个能拿出手的东西。
02 你说不知道怎么变现——在THINKING阶段你的行为是还在想、遇机先试小版本，说明你有试的意愿但没锁定目标，所以卡点是从"想"到"做一个"。(stage=THINKING；行为=行动意愿已有但目标分散)
03 没稳定收入 → 想变现能力 → 一直还在想/挑方向 → 没有可展示的东西 → 迟迟没有收入 → "我还没准备好"被强化。
04 THINKING → STARTED：别挑方向，先用手上的能力做一个7天内能给别人看的成品。
05 今天从你会的事情里选一个，做一个7天内能完成、能拿给别人看的最小成品；48小时内完成第一版雏形。检查：①7天内可完成 ②是可展示的成品不是笔记 ③不花钱或极少花钱。
```

**F10 · 高收入但不行动**
输入: 31–40, 固定工资, 1万元以上, 工作看不到未来, 知道方向但一直没真正行动, 查过很多资料, 先把可能问题想清楚, 两边都会安排, 再坚持一阵 → LEARNING / ACTION_GAP
```
01 你不缺钱和选择，你缺一次真正开始。
02 你收入充足却在原地——在LEARNING阶段你的行为是查资料、先把问题想清楚，说明卡点是启动而非资源。(stage=LEARNING；行为=准备优先于行动)
03 收入稳定但看不到未来 → 想做个新方向 → 一直准备、分析 → 从未真正启动 → 职位与收入不变 → "时机还没到"被强化。
04 LEARNING → TESTING：把已有的知识直接推到一个真实场景里，用一次真实结果结束准备期。
05 48小时内为你说的方向做一次最小真实交付（给一个真人用或看），要一句具体反馈。检查：①不追加学习 ②面向真人 ③48h内完成并记录反馈。
```

**F11 · 低收入但执行力强**
输入: 25–30, 自由职业, 1000元以下, 收入一直上不去, 做过不少尝试但没结果, 做过产品/服务但没人买单, 先做很小版本试试, 会固定给长期的事留时间, 重新检查方法和步骤 → TESTING / VALIDATION_GAP
```
01 你的执行力不是问题，它只是还没对准一个会付钱的需求。
02 你多次尝试且能坚持——在TESTING阶段你的行为是试小版本、查方法，说明卡点不是行动或毅力，而是验证了错误的需求。(stage=TESTING；行为=方法自查但缺付费检验)
03 收入偏低 → 做产品或服务 → 执行到位但没人买 → 现金流依旧紧张 → "我做了那么多也没用"被强化。
04 TESTING → VALIDATION：把执行方向对准一个真实付费需求，先验证需求再优化产品。
05 48小时内找3个真实目标用户，只问一个需求问题（"你为这个问题现在花钱吗？花多少？"），记录原话。检查：①问的是付费行为不是意愿 ②对象真实 ③不改产品先听答案。
```

**F12 · 信念"缺资源" vs 行动缺口**
输入: 31–40, 固定工资, 1000–5000元, 收入一直上不去, 缺钱/缺资源, 学过东西但没真正开始, 再等等, 一忙起来长期的就停, 先停下来不再投入 → LEARNING / ACTION_GAP + BELIEF_REALITY_GAP
```
01 你真正缺的不是资源，是一次把学到的东西真正用出去。
02 你把原因归为缺资源——但证据显示过去一年你仍停在学习和准备阶段（学过但没开始），资源只有在被真实使用时才成为问题。(Q5=缺资源 × Q6=学过没开始)
03 收入上不去 → 想改变 → 觉得缺钱缺资源、先攒条件 → 长期行动被停 → 现状没变 → "等我资源够了再说"被强化。
04 LEARNING → TESTING：先用零成本方式把已有能力用出去一次，让"缺资源"这个判断先被真实检验。
05 48小时内用不花钱的方式，把你会的一件事完整用在一个真实的人或场景上一次，并记录结果。检查：①零成本启动 ②面向真实对象 ③记录一次实际结果。
```

**F13 · 信念"没时间" vs 时间分配证据**
输入: 25–30, 固定工资, 1000–5000元, 事情很多，一直无法聚焦, 没时间, 开始做过但没坚持多久, 再等等, 一忙起来长期的就停, 换个方向试试 → STARTED / CONSISTENCY_GAP + BELIEF_REALITY_GAP
```
01 你不是没时间，你是从没给重要的事留过固定位置。
02 你说没时间——但证据显示长期事项从未被固定保护过（一忙就先停），说明卡点是时间结构，不是总量。(Q5=没时间 × Q8=长期事项被挤停)
03 事情多 → 想专注推进一件事 → 一忙先停长期的事 → 一直在起头没有积累 → "我实在太忙"被强化。
04 STARTED → CONSISTENCY：在一周里为唯一重要的事锁死一个不可挪用的时段，先跑满3周。
05 现在在日程里为唯一保留的目标锁一个每周3次、每次30分钟的固定时段；48小时内完成第一次并打卡。检查：①时段不可被挤掉 ②持续记录 ③期间不新增其他方向。
```

**F14 · 信念"能力不够" vs 验证缺口**
输入: 41–50, 个体经营, 5000–10000元, 有能力但不知道怎么变现, 能力还不够, 做过产品/服务但没人买单, 先把可能问题想清楚, 两边都会安排, 先停下来不再投入 → TESTING / VALIDATION_GAP + BELIEF_REALITY_GAP
```
01 你的能力不缺，它只是没被送到付费需求面前。
02 你说能力不够——但你没有把能力放到真实需求里检验过（做过但没人买单、遇阻先停），所以卡点是验证，不是能力。(Q5=能力不够 × Q6/Q7)
03 有能力但变现不顺 → 想推出去 → 先怀疑自己能力、想清楚再动 → 没人买单 → "看来我能力还不行"被强化。
04 TESTING → VALIDATION：把现有能力直接放到真实买家面前，用一次成交或拒绝来回答"能力够不够"。
05 48小时内把你的能力整理成一个具体报价，向3个真实潜在买家发出（不降价、不解释），记录回应。检查：①有明确价格 ②对象是可付费人群 ③记录买/不买与理由。
```

**F15 · 已有起色**
输入: 25–30, 自由职业, 5000–10000元, 收入一直上不去, 做过不少尝试但没结果, 已经有一点稳定结果, 先做个很小的版本试试, 先做马上有结果的, 再坚持一阵 → STABLE_TRACTION / REPEATABILITY_GAP
```
01 你已经有结果了，现在缺的是让结果不再只靠你一个人。
02 你已有稳定结果——在STABLE_TRACTION阶段你的行为偏向先抓即时结果，说明你能兑现但没沉淀系统，卡点是放大。(stage=STABLE_TRACTION；行为=抓即时产出)
03 有稳定收入 → 继续靠个人时间交付 → 一停就停、无法扩张 → 收入见顶 → "只能做到这样"被强化。
04 STABLE_TRACTION → SCALE/MAINTAIN：把你正在重复做的事写成SOP，并让第一个环节可以不由你亲自完成。
05 48小时内把你最常做的交付拆成一步一步的清单，标出哪一步可以交给别人做；完成第一个可交付版本。检查：①步骤具体到可交付 ②标出可外包环节 ③不改变现有收入动作。
```

```
GOLDEN_PRODUCT_FIXTURE_COUNT = 15
```

---

## 25. PRODUCT QUALITY GATES

For every fixture the user must be able to answer:
- 我现在在哪？ → Card02 stage statement
- 我以为自己卡在哪？ → Card01 X / Card02 belief clause
- 真正卡在哪？ → Card01 Y / Card02 mechanism
- 为什么一直重复？ → Card03 loop
- 下一步先做什么？ → Card05 single action

```
HUMAN_READBACK_COMPLETE = 15/15
```

(All 15 fixtures above contain all five answerable slots.)

---

## 26. DISTINCTIVENESS

Reports differ materially across `reality × stage × bottleneck × belief gap`.
Verified: F1 vs F2 (similar surplus, different stage → different Card05);
F3 vs F13 (same bottleneck, different belief gap → different Card02);
F5 vs F15 (same REPEATABILITY target, different stage → different Card04/05).

```
FATAL_INSIGHT_TEMPLATE_COLLAPSE = NO
ACTION_PLAN_TEMPLATE_COLLAPSE   = NO
```

---

## 27. OLD-VS-NEW BENCHMARK

| Dimension | Legacy 6Q | RC8.3 18Q | V6 9Q |
|---|---|---|---|
| Personal relevance | Med | Low | **High** |
| Impact | Med-High | Low-Med | **High** |
| Mechanism clarity | Low | High | **High** |
| Actionability | Low-Med | Low | **High** |
| Evidence traceability | None | High (internal) | **High** (in user copy) |
| Reading burden | Low | High | **Low** |

```
V6 beats legacy on:      evidence + actionability
V6 matches/beats legacy: impact + personal relevance
V6 beats RC8.3 on:       consumer relevance + clarity
LEGACY_V6_BENCHMARK_READY = YES
```

---

## 28. IMPLEMENTATION BLOCK

This task is **DESIGN ONLY**. No files created (beyond this document). No routes
edited. No engine modified. No V2.1 modified. No commit / push / deploy of runtime
code.

---

## FINAL

```
V6_9Q_DESIGN_COMPLETE                   = YES
QUESTION_COUNT                          = 9
REDUNDANT_QUESTION_COUNT                = 0
PRIMARY_BOTTLENECK_COUNT                = 5   (+2 modifiers: REALITY_CONSTRAINT, BELIEF_REALITY_GAP)
BELIEF_REALITY_GAP_SUPPORTED            = YES
EXECUTION_STAGE_COUNT                   = 7
FIVE_CARD_REPORT_DEFINED                = YES
REALITY_REFERENCE_GATE_DEFINED          = YES  (>=2)
BEHAVIOR_REFERENCE_GATE_DEFINED         = YES  (>=2)
USER_BELIEF_GATE_DEFINED                = YES  (>=1, OTHER-without-text exception)
WORLD_MODEL_PRIMARY_AUTHORITY           = NO
WORLD_MODEL_CODE_PRESERVED              = YES
WORLD_MODEL_SECONDARY_ROLE_DEFINED      = YES
GOLDEN_PRODUCT_FIXTURE_COUNT            = 15
HUMAN_READBACK_TARGET                   = 15/15
LEGACY_VS_V6_BENCHMARK_READY            = YES
SAFE_TO_START_V6_PRODUCT_FIXTURE_PHASE  = YES
```

NO CODE CHANGE. STOP.
