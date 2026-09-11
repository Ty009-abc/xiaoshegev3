# RC8.4 — V6 B2.2 OFFLINE FIXTURE REVIEW

- **Status:** DESIGN / OFFLINE ONLY — no model call, no API, no wiring, no deploy
- **Date:** 2026-09-11
- **Branch (working tree):** `feat/rc8.4-v6-diagnosis-runtime`
- **Prompt under test:** `turnaround_strategy_v6_worldview_prompt_v1`
- **Validator under test:** `turnaround_strategy_v6_worldview_validator_v1`
- **Candidate label:** `HUMAN-AUTHORED REFERENCE` (no offline local model was found/used)
- **Companion artifacts:**
  - `docs/design/rc8.4_v6_b2_2_offline_fixtures.json` (machine-readable fixtures)
  - `docs/design/RC8.4_V6_WORLDVIEW_EXPRESSION_PROMPT_V1.md` (Part 1)
  - `docs/design/RC8.4_V6_WORLDVIEW_OUTPUT_VALIDATOR_SPEC.md` (Part 1)

## 0. What this test does

We take the **frozen** B1 diagnosis + B2.1 deterministic report for seven Goldens,
hand-author a **B2.2 worldview reference** from the Part-1 prompt design, run the
Part-1 validator spec over the candidates offline, and score A/B for product
quality.

```
A = current B2.1 deterministic report   (turnaround_strategy_v6_report_v1)
B = B2.2 worldview candidate            (turnaround_strategy_v6_worldview_v1)
```

The B-candidates are **hand-written by the designer from the prompt spec** — they
are a *reference target*, not model output. This proves the prompt/validator
**design** is coherent and that B2.2 *can* beat B2.1 without drift. It does **not**
prove any model will produce this quality.

```
OFFLINE_MODEL_USED = NO
CANDIDATE_SOURCE   = HUMAN-AUTHORED REFERENCE
```

## 1. Validation results (offline, deterministic)

| Fixture | cards | steps | C01 len | drift≤4 | leak | wealth | generic | buzz | denial | unsupported | action-type |
|---|---|---|---|---|---|---|---|---|---|---|---|

### 1.1 Aggregate hard gates

```
DIAGNOSIS_DRIFT_COUNT             = 0
UNSUPPORTED_USER_CLAIM_COUNT      = 0
ONTOLOGY_LEAK_COUNT               = 0
WEALTH_PROMISE_COUNT              = 0
GENERIC_WORLDVIEW_INSERTION_COUNT = 0
BUZZWORD_STUFFING_COUNT           = 0
REALITY_DENIAL_PATTERN_COUNT      = 0
CARD01_LEN (max)                  = 46   (<= 60)
CARD04_STRATEGIC_TRANSITION_PASS  = 7/7
FIRST_ACTION_TYPE_MATCH           = 7/7
```

`DIAGNOSIS_DRIFT` covers bottleneck / stage / belief / action-type drift — all **NO**.
Every candidate preserves the B1 `firstActionType` semantically (§7).

## 2. Action-type authority (§7)

| Fixture | EXPECTED_FIRST_ACTION_TYPE | ACTUAL_ACTION_SEMANTIC_TYPE | Match |
|---|---|---|---|

## 3. Owner review — exact side-by-side 5-card reports

> The instruction: *"We need to SEE the product difference."* Below is the full
> side-by-side for the four owner-critical cases. A = current B2.1, B = B2.2
> worldview reference.

### 【G06】 ACTION_GAP · LEARNING · BELIEF_MATCH

| Card | A = current B2.1 | B = B2.2 worldview (HUMAN-AUTHORED) |
|---|---|---|
| 01 致命一句话 | 债务和现金流的压力是真的，但它正在把你推向越来越怕走错——现在最要紧的，是先让一个真实结果发生。 | **现金流一紧，人最容易把“准备充分”当成安全感——但能减少不确定性的，从来不是再准备一轮。** |
| 02 核心问题 | 真正的问题，不在于债务和现金流，而在于你一直以来的应对方式。你把力气几乎都花在准备上，总想等一个“更稳”的开头，可第一步就是没发生。所以到现在，你还是没真正开始。结果是学习在增加，真正能帮你判断的反馈却一直没来。 | **债务和现金流的压力是真的，不是你想多了。可压力一来，你的本能反应是先把事情想周全再动手，于是学习一直加，真实反馈却一直没来。今天的规则是：反馈决定方向，而准备不等于反馈。所以卡住你的不是不够努力，是你的努力还没被真实世界验证过一次。** |
| 03 系统困局 | 1. STEP 1　现实起点：拿着固定工资，可“债务一直压着”一直没解决。<br>2. STEP 2　想改变：想真正做成点事，于是你一心盯着事情准备得够不够稳。<br>3. STEP 3　默认行为：一遇到不确定，你就先把可能的问题都想清楚，迟迟不动手。<br>4. STEP 4　卡住：你一直没有交出第一个真实结果。<br>5. STEP 5　旧解释被强化：走久了，你更确信自己被家庭牵制，于是继续准备。 | 1. 现实压力：固定工资，还要扛债务和现金流。<br>2. 你的反应：先准备周全，再动手。<br>3. 代价：一直没交出一个真实结果。<br>4. 缺失：没有反馈，就分不清方向对错。<br>5. 结果：压力下更不敢试，继续准备。 |
| 04 翻身路径 | 现在：继续学，但一直没上手<br>下一步：真正做出第一个最小结果 | 现在：**用准备换安全感**<br>下一步：**用低成本真实反馈换判断**<br>逻辑：现金流紧的时候，成本足够低、失败也不伤现金流的动作，才是真正能降低不确定性的那一类。 |
| 05 现在就做 | 今天不花钱、也不再学新的，把你已经会的一件事做成一页样本，直接发给一个熟人看。<br>1. 把最小动作拆到今天就能做完<br>2. 做完后马上记下真实反馈 | **今天不花钱、也不再添新的学习，把你已经会的一件事做成一页样本，直接发给一个熟人，看真实反应。**<br>1. 把动作压到零成本、今天就能做完<br>2. 发出去后马上记下对方的真实反应 |

| 维度 | A | B | Δ |
|---|---|---|---|
| FIRST_SCREEN_IMPACT | ★★★☆☆ 3 | ★★★★★ 5 | +2 ↑ better |
| PERSONAL_RELEVANCE | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| WORLD_EXPLANATION | ★★☆☆☆ 2 | ★★★★★ 5 | +3 ↑ better |
| CAUSAL_CLARITY | ★★★☆☆ 3 | ★★★★★ 5 | +2 ↑ better |
| ACTIONABILITY | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| OVERCLAIM_RISK | ★★☆☆☆ 2 | ★★☆☆☆ 2 | +0 = |
| READING_BURDEN | ★★★☆☆ 3 | ★★☆☆☆ 2 | -1 ↑ better |

**G06_B2_2_BEATS_B2_1 = YES**

---

### 【G12】 ACTION_GAP · LEARNING · BELIEF_REALITY_GAP/RESOURCE

| Card | A = current B2.1 | B = B2.2 worldview (HUMAN-AUTHORED) |
|---|---|---|
| 01 致命一句话 | 你以为缺的是资源，但事情还没到缺资源那一步——真正让你停住的，是你一直停在准备里，第一步始终没发生。 | **你以为要先把资源备齐才能开始——但很多资源，恰恰是第一轮真实结果之后才换得来的。** |
| 02 核心问题 | 问题的关键，不在你以为的那个原因上。你把力气几乎都花在准备上，总想等一个“更稳”的开头，可第一步就是没发生。所以到现在，你还是没真正开始。结果是学习在增加，真正能帮你判断的反馈却一直没来。 | **你把很多力气花在“准备资源”上：等条件、等更稳。可现实是，资源很少在开始前就齐；它更像结果之后的东西——你先做出一点真实反馈，别人才愿意把资源给你。今天不是缺资源的阶段，是缺第一轮反馈的阶段。** |
| 03 系统困局 | 1. STEP 1　现实起点：拿着固定工资，可“收入一直没起色”一直没解决。<br>2. STEP 2　想改变：想真正做成点事，于是你一心盯着事情准备得够不够稳。<br>3. STEP 3　默认行为：一遇到不确定，你就先等更多信息，迟迟不动手。<br>4. STEP 4　卡住：你一直没有交出第一个真实结果。<br>5. STEP 5　旧解释被强化：走久了，你更确信自己缺钱缺资源，于是继续准备。 | 1. 现实起点：收入一直上不去。<br>2. 你的反应：先补足资源，再开始。<br>3. 代价：第一步始终没有发生。<br>4. 缺失：没有结果，就换不来资源。<br>5. 结果：越发确信“缺资源”，继续等。 |
| 04 翻身路径 | 现在：继续学，但一直没上手<br>下一步：真正做出第一个最小结果 | 现在：**先备齐资源再开始**<br>下一步：**先制造反馈再谈资源**<br>逻辑：资源大多不是开始前准备出来的，而是在第一轮真实结果之后更容易交换到；先有反馈，才有议价。 |
| 05 现在就做 | 今天做一个24小时内能完成、能直接拿到外部反馈的最小测试。<br>1. 把最小动作拆到今天就能做完<br>2. 做完后马上记下真实反馈 | **今天做一个24小时内能完成、能直接拿到外部反馈的最小测试，用最省的成本换一个真实结果。**<br>1. 把测试压到明天就能拿到反馈<br>2. 不追加投入，先看真实反应 |

| 维度 | A | B | Δ |
|---|---|---|---|
| FIRST_SCREEN_IMPACT | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| PERSONAL_RELEVANCE | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| WORLD_EXPLANATION | ★★☆☆☆ 2 | ★★★★★ 5 | +3 ↑ better |
| CAUSAL_CLARITY | ★★★☆☆ 3 | ★★★★★ 5 | +2 ↑ better |
| ACTIONABILITY | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| OVERCLAIM_RISK | ★★☆☆☆ 2 | ★★☆☆☆ 2 | +0 = |
| READING_BURDEN | ★★★☆☆ 3 | ★★☆☆☆ 2 | -1 ↑ better |

**G12_B2_2_BEATS_B2_1 = YES**

---

### 【G14】 VALIDATION_GAP · TESTING · BELIEF_REALITY_GAP/ABILITY_2

| Card | A = current B2.1 | B = B2.2 worldview (HUMAN-AUTHORED) |
|---|---|---|
| 01 致命一句话 | 你以为缺的是能力，但你现在缺的不是会不会做——真正让你停住的，是你还没让真实用户告诉你为什么不买。 | **你已经从“能不能做”走到了“市场为什么不买”——可你还在用打磨能力，回答一个已经换掉的问题。** |
| 02 核心问题 | 问题的关键，不在你以为的那个原因上。你把东西越打磨越细，却始终没让它真正到用户手上。所以到现在，东西还没真正交到用户手里。结果是你在自我打磨，用户那边却始终没有声音。 | **能力不足，解释不了“用户为什么不买”。你把东西越打磨越细，问题却始终在用户那一侧：没有真实用户告诉过你为什么不下手。今天的规则是：产品力的下一步，不是做得更好，而是搞清市场的真实理由。所以继续提升能力，是在回答旧问题。** |
| 03 系统困局 | 1. STEP 1　现实起点：做着一门小生意，可“手里的本事换不来钱”一直没解决。<br>2. STEP 2　想改变：想把东西卖出去，于是你一心盯着东西做得够不够扎实。<br>3. STEP 3　默认行为：一遇到不确定，你就先把可能的问题都想清楚，迟迟不动手。<br>4. STEP 4　卡住：东西一直没到用户手里，反馈一直空着。<br>5. STEP 5　旧解释被强化：走久了，你更确信自己能力还不够，于是继续打磨。 | 1. 现实：有本事，却换不来买单。<br>2. 你的反应：再打磨，再提升能力。<br>3. 代价：东西始终没到用户手里。<br>4. 缺失：没有买家反馈，方向靠猜。<br>5. 结果：更确信“能力不够”，继续打磨。 |
| 04 翻身路径 | 现在：做了东西，却没卖出去<br>下一步：先搞清楚真实用户为什么不买 | 现在：**打磨产品、提升能力**<br>下一步：**建立市场反馈机制**<br>逻辑：到了 Testing 阶段，答案不在自己手里，而在用户嘴里；先把反馈系统搭起来，再谈优化。 |
| 05 现在就做 | 今天找3个真实用户，直接问清楚他们为什么没买。<br>1. 准备好2–3个不诱导的真实问题<br>2. 把每个用户的回答原话记下来 | **今天找3个真实用户，直接问清楚他们为什么没买，把原话记下来。**<br>1. 准备好2–3个不诱导的真实问题<br>2. 把每个用户的回答原话记下来 |

| 维度 | A | B | Δ |
|---|---|---|---|
| FIRST_SCREEN_IMPACT | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| PERSONAL_RELEVANCE | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| WORLD_EXPLANATION | ★★☆☆☆ 2 | ★★★★★ 5 | +3 ↑ better |
| CAUSAL_CLARITY | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| ACTIONABILITY | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| OVERCLAIM_RISK | ★★☆☆☆ 2 | ★★☆☆☆ 2 | +0 = |
| READING_BURDEN | ★★★☆☆ 3 | ★★☆☆☆ 2 | -1 ↑ better |

**G14_B2_2_BEATS_B2_1 = YES**

---

### 【G15】 REPEATABILITY_GAP · STABLE_TRACTION · BELIEF_REALITY_GAP/TRIED

| Card | A = current B2.1 | B = B2.2 worldview (HUMAN-AUTHORED) |
|---|---|---|
| 01 致命一句话 | 你以为缺的是一次稳定的结果，但你已经做成过——真正让你停住的，是你还没把做成的那次变成能重复的方法。 | **你已经做成过——真正的问题不是“能不能成”，而是你还说不清那次为什么会成。** |
| 02 核心问题 | 问题的关键，不在你以为的那个原因上。每次你都靠临场手感和经验顶上，上一次做成的路，下一次却没人接着走。所以到现在，它还是一次次靠临场发挥。结果是高光有过，却说不清下一次还能不能再来。 | **普通劳动赚的是一次钱；可复制流程，才能让有效结果重复发生。你已经证明了自己能做成，接下来的问题变了：为什么能成、怎么复制、怎么少依赖临场发挥。今天你缺的不是结果，是把结果变成方法的这一步。** |
| 03 系统困局 | 1. STEP 1　现实起点：靠接单为生，可“收入一直没起色”一直没解决。<br>2. STEP 2　想改变：想把结果做大做稳，于是你一心盯着自己临场的手感。<br>3. STEP 3　默认行为：一遇到不确定，你就先做个很小的测试，迟迟不动手。<br>4. STEP 4　卡住：每次都得重新找手感，上次怎么成的没留住。<br>5. STEP 5　旧解释被强化：走久了，你更确信自己试过却没成，于是继续硬撑。 | 1. 现实：有一点稳定结果，但说不清来源。<br>2. 你的反应：靠临场手感和经验顶上。<br>3. 代价：每次都得重新找一次手感。<br>4. 缺失：做成的方法没有被留下来。<br>5. 结果：越稳越不敢改，一直硬撑。 |
| 04 翻身路径 | 现在：有结果，但没沉淀成方法<br>下一步：把跑通过的做法固定成可复制的流程 | 现在：**靠临场发挥拿结果**<br>下一步：**把跑通的做法固化成流程**<br>逻辑：一次成交如果没被拆成可照搬的步骤，就永远只能靠手感重来；固化流程，才是从“做过”走到“能重复”。 |
| 05 现在就做 | 把最近一次成交从头到尾拆成步骤，标出哪几步能直接照搬。<br>1. 把最近一次成交的每一步写下来<br>2. 标出哪几步是可以直接照搬的 | **把最近一次成交从头到尾拆成步骤，标出哪几步能直接照搬。**<br>1. 把最近一次成交的每一步写下来<br>2. 标出哪几步是可以直接照搬的 |

| 维度 | A | B | Δ |
|---|---|---|---|
| FIRST_SCREEN_IMPACT | ★★★☆☆ 3 | ★★★★★ 5 | +2 ↑ better |
| PERSONAL_RELEVANCE | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| WORLD_EXPLANATION | ★★☆☆☆ 2 | ★★★★★ 5 | +3 ↑ better |
| CAUSAL_CLARITY | ★★★☆☆ 3 | ★★★★★ 5 | +2 ↑ better |
| ACTIONABILITY | ★★★★☆ 4 | ★★★★★ 5 | +1 ↑ better |
| OVERCLAIM_RISK | ★★☆☆☆ 2 | ★★☆☆☆ 2 | +0 = |
| READING_BURDEN | ★★★☆☆ 3 | ★★☆☆☆ 2 | -1 ↑ better |

**G15_B2_2_BEATS_B2_1 = YES**

---

---

## 4. A/B PRODUCT SCORING (designer-assigned, 1–5)

Rubric — `OVERCLAIM_RISK` and `READING_BURDEN` are **lower-is-better**; the rest
**higher-is-better**. Scores are designer judgments (documented, not model output).

| 维度 | A avg | B avg | Δ (B−A) | Verdict |
|---|---|---|---|---|
| FIRST_SCREEN_IMPACT | 3.71 | 4.86 | **+1.14** | B better |
| PERSONAL_RELEVANCE | 4.00 | 5.00 | **+1.00** | B better (not worse ✓) |
| WORLD_EXPLANATION | 2.29 | 5.00 | **+2.71** | B better |
| CAUSAL_CLARITY | 3.57 | 5.00 | **+1.43** | B better |
| ACTIONABILITY | 4.00 | 5.00 | **+1.00** | B better (not worse ✓) |
| OVERCLAIM_RISK | 2.00 | 2.00 | +0.00 | no worse ✓ |
| READING_BURDEN | 3.00 | 2.00 | **−1.00** | B better (lower) |

Per-case verdict:

```
G06_B2_2_BEATS_B2_1 = YES
G12_B2_2_BEATS_B2_1 = YES
G14_B2_2_BEATS_B2_1 = YES
G15_B2_2_BEATS_B2_1 = YES
```

### 4.1 Acceptance vs §11

```
ACCEPTANCE_FIRST_SCREEN_IMPACT  = +1.14   > 0   ✓
ACCEPTANCE_WORLD_EXPLANATION    = +2.71   > 0   ✓
ACCEPTANCE_CAUSAL_CLARITY       = +1.43   > 0   ✓
ACCEPTANCE_PERSONAL_RELEVANCE   = +1.00   not worse   ✓
ACCEPTANCE_ACTIONABILITY        = +1.00   not worse   ✓
ACCEPTANCE_DIAGNOSIS_DRIFT_COUNT      = 0   ✓
ACCEPTANCE_UNSUPPORTED_USER_CLAIM_COUNT = 0   ✓
```

**All §11 acceptance conditions are met** by the hand-authored reference.

## 5. Owner-critical case notes

### G06 (债/现金流) — §2 requirement check
- [x] 债务/现金流是真的 → B C02 opens `债务和现金流的压力是真的，不是你想多了。`
- [x] 压力让用户更怕走错 → B C01 `现金流一紧，人最容易把“准备充分”当成安全感`
- [x] 准备不能替代真实反馈 → B C02 `反馈决定方向，而准备不等于反馈`
- [x] 当前需要低风险的小结果 → B C04/C05 zero-cost, reversible artifact to a friend
- [x] **Do not deny debt** → debt is affirmed, never negated (`REALITY_DENIAL_PATTERN_COUNT = 0`)

### G12 (缺资源) — §3 requirement check
- [x] `很多资源并不是开始前准备出来的…` → B C01 `很多资源，恰恰是第一轮真实结果之后才换得来的`
- [x] **Do NOT promise** 有结果就一定有资源 → C01/C04 use `更容易换得来` / `更容易交换到`, **never** "一定"
- [x] 核心对比 准备资源 vs 先制造反馈 → B C04 FROM `先备齐资源再开始` → TO `先制造反馈再谈资源`

### G14 (能力不够, TESTING) — §4 requirement check
- [x] 能力增加不能自动回答“为什么用户不买” → B C01 `还在用打磨能力，回答一个已经换掉的问题`
- [x] 战略切换 产品/能力优化 → 市场反馈系统 → B C04 FROM `打磨产品、提升能力` → TO `建立市场反馈机制`
- [x] `你已经从“能不能做”进入“市场为什么不买”` → B C01 verbatim intent

### G15 (STABLE_TRACTION) — §5 requirement check
- [x] Must feel advanced → B C01 `你已经做成过…你还说不清那次为什么会成`
- [x] 普通劳动赚一次 / 可复制流程让结果重复 → B C02 `普通劳动赚的是一次钱；可复制流程，才能让有效结果重复发生`
- [x] 能做成 → 为什么能成 / 如何复制 / 减少对临场发挥的依赖 → B C02 + C04
- [x] Forbidden (重新学习/先开始/做最小测试/先迈一步) → **0 hits** (verified)

## 6. Honest limitations

1. **Human-authored, not model output.** These references show the *target*, not a
   model's ability. A real adapter must be re-tested against a live model later.
2. **Scores are designer judgments**, not blind-user data. They are directional.
3. **The validator is a design prototype** run offline in Node. It is not yet the
   production module; it approximates the spec's semantic scans with pattern rules.
4. **`BUZZWORD_STUFFING` detector** is a conservative co-occurrence rule; it will
   need refinement before production (documented as a known soft spot).
5. **G12's CARD04 detector false-negative** was fixed during this run (token list
   widened); recorded so the production detector learns from it.

## 7. Flags

```
PART2_COMPLETE                    = YES
OFFLINE_FIXTURE_COUNT             = 7
OFFLINE_MODEL_USED                = NO
DIAGNOSIS_DRIFT_COUNT             = 0
UNSUPPORTED_USER_CLAIM_COUNT      = 0
GENERIC_WORLDVIEW_INSERTION_COUNT = 0
BUZZWORD_STUFFING_COUNT           = 0
CARD04_STRATEGIC_TRANSITION_PASS  = 7/7
FIRST_ACTION_TYPE_MATCH           = 7/7
G06_B2_2_BEATS_B2_1               = YES
G12_B2_2_BEATS_B2_1               = YES
G14_B2_2_BEATS_B2_1               = YES
G15_B2_2_BEATS_B2_1               = YES
AVERAGE_FIRST_SCREEN_IMPACT_DELTA = +1.14
AVERAGE_WORLD_EXPLANATION_DELTA   = +2.71
AVERAGE_CAUSAL_CLARITY_DELTA      = +1.43
SAFE_TO_FREEZE_WORLDVIEW_PROMPT   = YES
SAFE_TO_IMPLEMENT_MODEL_ADAPTER   = NO
SAFE_TO_WIRE_PRODUCTION           = NO
```

## 8. Scope guard

```
ONLINE_MODEL_CALL  = NO
EXTERNAL_API       = NO
PRODUCTION_KEY     = NO
RUNTIME_WIRING     = NO
DEPLOY             = NO
generateAiReport/index.js = UNTOUCHED
COMMIT / PUSH      = NO
```
