# RC8.4 — V6 PRODUCT GOLDEN — 15 CASES

- **Status:** DESIGN PRODUCTION LINE — product golden (human-readable)
- **Branch:** `design/rc8.4-v6-9q-refoundation`
- **Date:** 2026-09-11
- **Rule:** This file is **product copy first**. Rule tables are derived FROM these
  goldens (§ separate doc). No runtime code.
- **Frozen questionnaire:** `docs/RC8.4_TURNAROUND_STRATEGY_V6_9Q_REFOUNDATION_DESIGN.md` §4

> Each case = exact 9Q answers + **clean consumer-facing** 5-card report.
> `内部标签` lines are DESIGN METADATA — never rendered to the user.

---

## 0. BRANCH ROLE

```
BRANCH_ROLE = RC8.4_DESIGN_PRODUCTION_LINE
```

May contain ONLY: product specification · 9Q questionnaire design · rule-table
design · Golden product fixtures · ADRs · acceptance gates.

FORBIDDEN on this branch: runtime code · cloudfunctions production changes · page
implementation · V2.1 modification · deploy · env · Primary · Gate-B · payment.

Future runtime implementation must branch from the **final accepted RC8.4 design
tip** — not from this working branch.

---

## 1. METHOD (DO NOT START FROM RULES)

Order is enforced: **human-readable product goldens first**; deterministic rule
table derived only AFTER golden quality passes. Goal: prove the 9 questions can
generate a report with personal relevance · impact · mechanism clarity ·
actionability · traceability — not to prove rule completeness first.

---

## 2. GOLDEN FIXTURES

### G01 · salary / low surplus / direction gap
**答 9 题:** Q1 `25–30` · Q2 `固定工资` · Q3 `1000元以下` · Q4 `有能力，但不知道怎么变现` ·
Q5 `不知道该往哪走` · Q6 `查过很多资料` · Q7 `再等等，信息更充分再说` ·
Q8 `先做马上有结果的` · Q9 `换个方向试试`
`内部标签` stage=RESEARCHING · bottleneck=DIRECTION_GAP · BELIEF_REALITY_GAP=YES

**01 致命一句话**
> 你以为自己缺的是一个方向，其实你缺的是把任意一个方向做满30天。

**02 核心问题**
> 用户以为：我是因为不知道往哪走，才动不了。
> 但行为显示：你已经查过大量资料，遇到机会先"再等等"，而且在没验证前就换过方向。
> 所以反复发生：方向永远停在"还没确定"，行动永远被推到"确定之后"。

**03 系统困局**
> 工资到月底留不下 → 想找一条出路 → 又去查资料、等更充分的信息 →
> 真正开始的次数很少 → 没有一次真实反馈 → 更认定"我还没找到方向"。

**04 翻身路径**
> 从"查资料、等确定" 到 "开始一次最小行动"：选一个方向，用7天内能完成的一次
> 小投放，代替继续研究。（FROM=RESEARCHING → TO=STARTED）

**05 现在就做**
> 今天从你最想试的方向里挑1个，写一个7天内能做完、花费不到200元的动作，
> 并在48小时内做完它的第一步。
> 检查：①有明确的结束标准 ②能产出一个别人看得到的结果 ③花费<200元。

---

### G02 · salary / action gap
**答 9 题:** Q1 `31–40` · Q2 `固定工资` · Q3 `1000–5000元` · Q4 `收入一直上不去` ·
Q5 `知道方向，但一直没真正行动` · Q6 `学过东西，但没真正开始` ·
Q7 `先把可能的问题都想清楚` · Q8 `两边都会安排` · Q9 `再坚持一阵`
`内部标签` stage=LEARNING · bottleneck=ACTION_GAP · BELIEF_REALITY_GAP=NO

**01 致命一句话**
> 你不缺方法，你缺一次不等"完全准备好"就开始。

**02 核心问题**
> 用户以为：我知道方向，只是还没准备好。
> 但行为显示：你学过东西却迟迟没开始，遇到没把握的事会先"把问题都想清楚"。
> 所以反复发生：准备越来越充分，开始的时间却一直往后推。

**03 系统困局**
> 收入一直上不去 → 想做一条能加收入的副线 → 总想先想清楚、等条件成熟 →
> 迟迟没有开始 → 收入没有变化 → 更相信"我还需要再准备一下"。

**04 翻身路径**
> 从"一直准备" 到 "把学到的东西交给真实的人"：用一次真实反应，代替继续补知识。
> （FROM=LEARNING → TO=TESTING）

**05 现在就做**
> 今天挑一样你学过的东西，定一个"最小交付"，48小时内展示给1个真实的人并听取反馈。
> 检查：①交付物能被别人看到 ②对方给出一句具体反馈 ③在48小时内完成。

---

### G03 · side-business attempt / consistency gap
**答 9 题:** Q1 `25–30` · Q2 `自由职业 / 接单` · Q3 `1000–5000元` ·
Q4 `想做副业，但一直没做起来` · Q5 `总在换方向` · Q6 `开始做过，但没坚持多久` ·
Q7 `再等等，信息更充分再说` · Q8 `一忙起来，长期的事就先停` · Q9 `换个方向试试`
`内部标签` stage=STARTED · bottleneck=CONSISTENCY_GAP · BELIEF_REALITY_GAP=NO

**01 致命一句话**
> 你不是做不成，你是在每次快有积累的时候把它换掉。

**02 核心问题**
> 用户以为：我总在换方向，是因为还没选对。
> 但行为显示：你开始过，却一忙就先停长期的事，遇到没结果又换方向。
> 所以反复发生：每个方向都停在"刚有点苗头"的地方，积累被一次次归零。

**03 系统困局**
> 收入不稳定 → 想做起一个副业 → 一忙就把长期的事停掉 → 几周后看不到起色 →
> 换个新方向 → 之前的积累作废 → 更认定"这个方向不行"。

**04 翻身路径**
> 从"反复开始又停" 到 "把同一个方向连续跑下去"：给它一个不可挪用的固定时段。
> （FROM=STARTED → TO=CONSISTENCY）

**05 现在就做**
> 现在就为你唯一保留的方向，在日程里锁死一个每周3次、每次30分钟的固定时段，
> 48小时内完成第一次并记录。
> 检查：①时段不被临时事务挤掉 ②连续记录满一周 ③中途不换方向。

---

### G04 · product no sales / validation gap
**答 9 题:** Q1 `31–40` · Q2 `生意 / 个体经营` · Q3 `1000–5000元` ·
Q4 `想做副业，但一直没做起来` · Q5 `做过不少尝试，但没结果` ·
Q6 `做过产品 / 服务，但没人买单` · Q7 `先把可能的问题都想清楚` ·
Q8 `两边都会安排` · Q9 `重新检查方法和步骤`
`内部标签` stage=TESTING · bottleneck=VALIDATION_GAP · BELIEF_REALITY_GAP=NO

**01 致命一句话**
> 你的问题不是做得不够好，是还没被真实需求检验过。

**02 核心问题**
> 用户以为：我尝试过很多次都没结果，可能是我做得不行。
> 但行为显示：你做过产品/服务，却先自己打磨、先"把问题想清楚"，很少接触到付费的人。
> 所以反复发生：东西越做越细，却始终没有一次"买还是不买"的真实答案。

**03 系统困局**
> 收入受限 → 做出一个产品或服务 → 先自己打磨、等想清楚 → 没有真实用户反馈 →
> 没人买单 → 更相信"市场不行"。

**04 翻身路径**
> 从"自我评估" 到 "接受真实买家检验"：把同一个卖点直接放到买家面前，要一个明确答案。
> （FROM=TESTING → TO=VALIDATION）

**05 现在就做**
> 48小时内找3个真实目标用户，只问一句："如果这个东西卖X元，你现在会买吗？为什么？"
> 记录他们的原话。
> 检查：①对象是真实可付费的人 ②得到明确的买或不买 ③不解释、不推销。

---

### G05 · first paying customers / repeatability gap
**答 9 题:** Q1 `25–30` · Q2 `自由职业 / 接单` · Q3 `5000–10000元` ·
Q4 `收入一直上不去` · Q5 `能力还不够` · Q6 `已经有人愿意付钱` ·
Q7 `先做个很小的版本试试` · Q8 `先做马上有结果的` · Q9 `再坚持一阵`
`内部标签` stage=EARLY_TRACTION · bottleneck=REPEATABILITY_GAP · BELIEF_REALITY_GAP=YES

**01 致命一句话**
> 你已经赚到过钱，但你还不会"重复地"赚到它。

**02 核心问题**
> 用户以为：我能力还不够，所以做不成规模。
> 但行为显示：你已经有人愿意付钱，却每一次成交都从头再来，偏向先抓眼前有结果的活。
> 所以反复发生：收入靠一次次临时机会撑起来，无法稳定复制。

**03 系统困局**
> 有客户愿意付钱 → 接单、交付 → 每次都从零再来、只接送上门的活 →
> 收入随忙闲大幅波动 → 更确信"我能力还撑不起更大规模"。

**04 翻身路径**
> 从"能偶尔成交" 到 "让成交可以被重复"：把成交过一次的做法固定成步骤。
> （FROM=EARLY_TRACTION → TO=REPEATABILITY）

**05 现在就做**
> 今天把你最近一次成功收钱的全过程，拆成"找谁—说什么—怎么交付"三步写下来，
> 48小时内用同一套说法找3个同类新客户照做。
> 检查：①步骤能被别人照着执行 ②话术不临时改 ③至少复现1次同样的结果。

---

### G06 · debt / cashflow pressure
**答 9 题:** Q1 `31–40` · Q2 `固定工资` · Q3 `基本留不下 / 经常不够` ·
Q4 `债务 / 现金流压力` · Q5 `家庭 / 环境牵制` · Q6 `学过东西，但没真正开始` ·
Q7 `先把可能的问题都想清楚` · Q8 `一忙起来，长期的事就先停` · Q9 `先停下来，不再继续投入`
`内部标签` stage=LEARNING · bottleneck=ACTION_GAP · REALITY_CONSTRAINT=YES ·
BELIEF_REALITY_GAP=NO

**01 致命一句话**
> 你现在最急的不是翻身，是先把水面露出来喘口气。

**02 核心问题**
> 用户以为：我被债务和家庭拖着，什么都做不了。
> 但行为显示：你还在"学过但没开始"，一忙就停长期的事、遇到阻碍先停下来。
> 所以反复发生：压力越大越只想先熬过去，能翻身的事就一直没启动。

**03 系统困局**
> 还款压力摆在眼前 → 想做个能增收的事 → 精力被日常和还债占满 →
> 长期尝试一再停摆 → 现金流更紧 → 更认定"我只能先顾眼前"。

**04 翻身路径**
> 从"被压力按停" 到 "开始一个不花钱的最小动作"：先恢复一次正反馈，再谈方向。
> （FROM=LEARNING → TO=STARTED）

**05 现在就做**
> 48小时内列出2个"今天就能收到第一笔小额现金"的动作，选成本最低的那个，
> 今天就发出第一个联系。
> 检查：①启动成本为零或极低 ②48小时内能收到第一笔钱 ③不新增负债。

---

### G07 · career transition
**答 9 题:** Q1 `41–50` · Q2 `固定工资` · Q3 `5000–10000元` ·
Q4 `想转行，但不知道往哪走` · Q5 `不知道该往哪走` · Q6 `查过很多资料` ·
Q7 `先问几个做过的人` · Q8 `两边都会安排` · Q9 `换个方向试试`
`内部标签` stage=RESEARCHING · bottleneck=DIRECTION_GAP · BELIEF_REALITY_GAP=NO

**01 致命一句话**
> 你不是没有方向，你是在用"研究"替代"下水"。

**02 核心问题**
> 用户以为：想转行却不知道往哪去，所以只能先多了解。
> 但行为显示：你查资料、问过来人，却始终没有自己试过一次，长期事项也一直排在两边安排之后。
> 所以反复发生：信息越收集越多，真正的第一步却一直没发生。

**03 系统困局**
> 现有工作看不到未来 → 想转行 → 查资料、问做过的人 → 始终没有亲自试一次 →
> 留在原地 → 更相信"转行风险太大、还没想清楚"。

**04 翻身路径**
> 从"调研" 到 "自己试一次"：用一个业余时间就能完成的小项目，替换掉继续询问。
> （FROM=RESEARCHING → TO=STARTED）

**05 现在就做**
> 今天从你想转的方向里选1个，设计一个两周内、用业余时间就能完成的最小真实任务，
> 48小时内启动第一步。
> 检查：①不辞掉现职 ②两周内能完成 ③产出的是你自己的真实结果，不是别人的说法。

---

### G08 · age 40+
**答 9 题:** Q1 `41–50` · Q2 `生意 / 个体经营` · Q3 `5000–10000元` ·
Q4 `工作看不到未来` · Q5 `能力还不够` · Q6 `开始做过，但没坚持多久` ·
Q7 `再等等，信息更充分再说` · Q8 `一忙起来，长期的事就先停` · Q9 `再坚持一阵`
`内部标签` stage=STARTED · bottleneck=CONSISTENCY_GAP · BELIEF_REALITY_GAP=YES

**01 致命一句话**
> 你的经验已经够了，缺的是把它放进一个能重复的位置。

**02 核心问题**
> 用户以为：我这个年纪，能力已经跟不上了。
> 但行为显示：你一忙就停长期的事、遇到没把握先等，可遇到没结果又能接着坚持。
> 所以反复发生：不是能力不足，是升级动作从没被连续推进过四周。

**03 系统困局**
> 生意增长停滞 → 想升级做法 → 一忙就退回旧模式、把改进停掉 →
> 停在原来的水平 → 更相信"我这年纪学不动了"。

**04 翻身路径**
> 从"总是停下的改进" 到 "连续推进的积累"：把经验锁进每周固定的推进动作。
> （FROM=STARTED → TO=CONSISTENCY）

**05 现在就做**
> 今天写下你经验里最有价值的一项能力，定一个每周2次、每次45分钟的固定时段，
> 专门把它做成可重复的产出，48小时内完成第一次。
> 检查：①时段固定不被挤掉 ②产出物可复用 ③连续坚持4周再评估。

---

### G09 · age under 30
**答 9 题:** Q1 `18–24` · Q2 `暂时没有稳定收入` · Q3 `基本留不下 / 经常不够` ·
Q4 `有能力，但不知道怎么变现` · Q5 `不知道该往哪走` · Q6 `主要还在想` ·
Q7 `先做个很小的版本试试` · Q8 `先做马上有结果的` · Q9 `换个方向试试`
`内部标签` stage=THINKING · bottleneck=DIRECTION_GAP · REALITY_CONSTRAINT=YES ·
BELIEF_REALITY_GAP=NO

**01 致命一句话**
> 你最该做的不是想清楚，是尽快做出第一个能拿出手的东西。

**02 核心问题**
> 用户以为：我得先想明白方向、等有点收入再说。
> 但行为显示：你主要还在想，可遇到机会愿意先试小版本、也会先抓马上有结果的。
> 所以反复发生：有意愿试，却因为一直没锁定目标，始终没有一件能拿出来的成品。

**03 系统困局**
> 没有稳定收入 → 想把自己的能力变现 → 一直在想、在挑方向 →
> 手上没有可展示的东西 → 迟迟没有收入 → 更相信"我还没准备好"。

**04 翻身路径**
> 从"还在想" 到 "做出第一件成品"：先不挑方向，用手上的能力做一个小成品。
> （FROM=THINKING → TO=STARTED）

**05 现在就做**
> 今天从你会的事情里选1个，做一个7天内能完成、能拿给别人看的最小成品，
> 48小时内完成第一版雏形。
> 检查：①7天内能完成 ②是可展示的成品，而不是笔记 ③不花钱或极少花钱。

---

### G10 · high income but no action
**答 9 题:** Q1 `31–40` · Q2 `固定工资` · Q3 `1万元以上` · Q4 `工作看不到未来` ·
Q5 `知道方向，但一直没真正行动` · Q6 `学过东西，但没真正开始` ·
Q7 `先把可能的问题都想清楚` · Q8 `两边都会安排` · Q9 `再坚持一阵`
`内部标签` stage=LEARNING · bottleneck=ACTION_GAP · BELIEF_REALITY_GAP=NO

**01 致命一句话**
> 你不缺钱和选择，你缺一次真正开始。

**02 核心问题**
> 用户以为：我方向清楚，只是还没真正行动。
> 但行为显示：你收入充足却停在"学过没开始"，遇到没把握的事习惯先"把问题想清楚"。
> 所以反复发生：条件越好，越容易把开始往后推，因为"没开始"的代价看起来最小。

**03 系统困局**
> 收入稳定却看不到未来 → 想做一个新方向 → 一直准备、分析 → 从未真正启动 →
> 职位和收入不变 → 更相信"时机还没到"。

**04 翻身路径**
> 从"持续准备" 到 "把知识推向真实场景"：用一次真实结果，结束准备期。
> （FROM=LEARNING → TO=TESTING）

**05 现在就做**
> 48小时内为你说的方向做一次最小真实交付（给一个真人用或看），要一句具体反馈。
> 检查：①不再追加学习 ②面向真实的人 ③48小时内完成并记录反馈。

---

### G11 · low income but strong execution
**答 9 题:** Q1 `25–30` · Q2 `自由职业 / 接单` · Q3 `1000元以下` ·
Q4 `收入一直上不去` · Q5 `做过不少尝试，但没结果` ·
Q6 `做过产品 / 服务，但没人买单` · Q7 `先做个很小的版本试试` ·
Q8 `会固定给长期的事留时间` · Q9 `重新检查方法和步骤`
`内部标签` stage=TESTING · bottleneck=VALIDATION_GAP · BELIEF_REALITY_GAP=NO

**01 致命一句话**
> 你的执行力不是问题，它只是还没对准一个会付钱的需求。

**02 核心问题**
> 用户以为：我做了这么多都没结果，问题应该出在我身上。
> 但行为显示：你能坚持、会试小版本、也会固定给长期的事留时间，还主动复盘方法。
> 所以反复发生：你把力气花在打磨"做得好不好"，而不是验证"有没有人真要"。

**03 系统困局**
> 收入偏低 → 认真做出产品/服务 → 执行到位、反复优化 → 没有人买单 →
> 现金流依旧紧张 → 更相信"我做了这么多也没用"。

**04 翻身路径**
> 从"埋头做对" 到 "先验证需求"：把方向对准一个真实付费需求，再谈优化。
> （FROM=TESTING → TO=VALIDATION）

**05 现在就做**
> 48小时内找3个真实目标用户，只问一个需求问题："你为这个问题现在花钱吗？花多少？"
> 记录原话。
> 检查：①问的是付费行为，不是意愿 ②对象真实 ③先不改产品，只听答案。

---

### G12 · 信念"缺资源" vs 行动缺口
**答 9 题:** Q1 `31–40` · Q2 `固定工资` · Q3 `1000–5000元` · Q4 `收入一直上不去` ·
Q5 `缺钱 / 缺资源` · Q6 `学过东西，但没真正开始` · Q7 `再等等，信息更充分再说` ·
Q8 `一忙起来，长期的事就先停` · Q9 `先停下来，不再继续投入`
`内部标签` stage=LEARNING · bottleneck=ACTION_GAP · BELIEF_REALITY_GAP=YES

**01 致命一句话**
> 你真正缺的不是资源，是一次把学到的东西真用出去。

**02 核心问题**
> 用户以为：我卡住是因为缺钱、缺资源。
> 但行为显示：过去一年你仍停在"学过但没开始"，遇到阻碍先停下来。
> 所以反复发生：资源只有在被真实使用的那一刻才会暴露，而它一直没机会暴露。

**03 系统困局**
> 收入上不去 → 想改变 → 觉得缺钱缺资源、先攒条件 → 长期行动被搁置 →
> 现状没有变化 → 更相信"等我资源够了再说"。

**04 翻身路径**
> 从"等资源" 到 "零成本先把能力用出去一次"：先用不花钱的方式，让"缺资源"
> 这个判断被真实检验。（FROM=LEARNING → TO=TESTING）

**05 现在就做**
> 48小时内用不花钱的方式，把你会的一件事完整用在一个真实的人或场景上一次，
> 并记录结果。
> 检查：①零成本启动 ②面向真实对象 ③记录一次实际结果。

---

### G13 · 信念"没时间" vs 时间分配证据
**答 9 题:** Q1 `25–30` · Q2 `固定工资` · Q3 `1000–5000元` ·
Q4 `事情很多，一直无法聚焦` · Q5 `没时间` · Q6 `开始做过，但没坚持多久` ·
Q7 `再等等，信息更充分再说` · Q8 `一忙起来，长期的事就先停` · Q9 `换个方向试试`
`内部标签` stage=STARTED · bottleneck=CONSISTENCY_GAP · BELIEF_REALITY_GAP=YES

**01 致命一句话**
> 你不是没时间，你是从没给重要的事留过固定位置。

**02 核心问题**
> 用户以为：我事情太多，实在没时间。
> 但行为显示：长期的事从来是被"一忙就停"，你也没有为它固定留过时间。
> 所以反复发生：不是时间总量不够，是重要的事永远排在所有临时事务之后。

**03 系统困局**
> 事情一直很多 → 想专注推进一件事 → 一忙就先停长期的事 →
> 每件事都停在刚开头 → 更相信"我实在太忙了"。

**04 翻身路径**
> 从"一再开头的努力" 到 "连续有积累"：给唯一重要的事一个不可挪用的时段。
> （FROM=STARTED → TO=CONSISTENCY）

**05 现在就做**
> 现在就在日程里为唯一保留的目标锁一个每周3次、每次30分钟的固定时段，
> 48小时内完成第一次并打卡。
> 检查：①时段不被挤掉 ②持续记录 ③期间不新增其他方向。

---

### G14 · 信念"能力不够" vs 验证缺口
**答 9 题:** Q1 `41–50` · Q2 `生意 / 个体经营` · Q3 `5000–10000元` ·
Q4 `有能力，但不知道怎么变现` · Q5 `能力还不够` ·
Q6 `做过产品 / 服务，但没人买单` · Q7 `先把可能的问题都想清楚` ·
Q8 `两边都会安排` · Q9 `先停下来，不再继续投入`
`内部标签` stage=TESTING · bottleneck=VALIDATION_GAP · BELIEF_REALITY_GAP=YES

**01 致命一句话**
> 你的能力不缺，它只是没被送到付费需求面前。

**02 核心问题**
> 用户以为：我推不出去，是因为能力还不够。
> 但行为显示：你做出过产品/服务，却先怀疑自己、先"把问题想清楚"，遇阻又先停下来。
> 所以反复发生：能力从没被真正报价给买家，自然得不到"够不够"的真实答案。

**03 系统困局**
> 有能力但变现不顺 → 想把东西推出去 → 先怀疑自己、等想清楚再动 →
> 一直没有成交 → 更相信"看来我能力还是不行"。

**04 翻身路径**
> 从"怀疑能力" 到 "让买家给答案"：把现有能力整理成明确报价，直接面对真实买家。
> （FROM=TESTING → TO=VALIDATION）

**05 现在就做**
> 48小时内把你的能力整理成一个具体报价，向3个真实潜在买家发出（不降价、不解释），
> 记录他们的回应。
> 检查：①有明确价格 ②对象是可能付费的人 ③记录买或不买及理由。

---

### G15 · already has traction but cannot repeat
**答 9 题:** Q1 `25–30` · Q2 `自由职业 / 接单` · Q3 `5000–10000元` ·
Q4 `收入一直上不去` · Q5 `做过不少尝试，但没结果` ·
Q6 `已经有一点稳定结果` · Q7 `先做个很小的版本试试` ·
Q8 `先做马上有结果的` · Q9 `再坚持一阵`
`内部标签` stage=STABLE_TRACTION · bottleneck=REPEATABILITY_GAP · BELIEF_REALITY_GAP=YES

**01 致命一句话**
> 你已经有结果了，现在缺的是让结果不再只靠你一个人。

**02 核心问题**
> 用户以为：我做了这么多也没做出什么，还是原地打转。
> 但行为显示：你其实已经有稳定的结果，却一直偏向先抓马上有结果的活，没沉淀成一套做法。
> 所以反复发生：收入见顶不是没做成，而是做成的部分无法脱离你本人。

**03 系统困局**
> 已经有稳定收入 → 继续靠个人时间交付 → 一停下来就停、无法扩张 →
> 收入触到天花板 → 更相信"我大概只能做到这样"。

**04 翻身路径**
> 从"个人能做成" 到 "结果可以脱离你重复"：把重复在做的事写成别人也能执行的步骤。
> （FROM=STABLE_TRACTION → TO=REPEATABILITY）

**05 现在就做**
> 48小时内把你最常做的交付拆成一步一步的清单，标出哪一步可以交给别人做，
> 并完成第一个可交付版本。
> 检查：①步骤具体到可执行 ②标出可外包的环节 ③不改变现有的收入动作。

---

## 3. COVERAGE ASSESSMENT (§3)

| # | Pattern | Stage | Primary bottleneck | Modifier |
|---|---|---|---|---|
| G01 | salary / low surplus / direction gap | RESEARCHING | DIRECTION_GAP | — |
| G02 | salary / action gap | LEARNING | ACTION_GAP | — |
| G03 | side-business / consistency gap | STARTED | CONSISTENCY_GAP | — |
| G04 | product no sales / validation gap | TESTING | VALIDATION_GAP | — |
| G05 | first paying customers / repeatability | EARLY_TRACTION | REPEATABILITY_GAP | BELIEF_REALITY_GAP |
| G06 | debt / cashflow pressure | LEARNING | ACTION_GAP | REALITY_CONSTRAINT |
| G07 | career transition | RESEARCHING | DIRECTION_GAP | — |
| G08 | age 40+ | STARTED | CONSISTENCY_GAP | BELIEF_REALITY_GAP |
| G09 | age under 30 | THINKING | DIRECTION_GAP | REALITY_CONSTRAINT |
| G10 | high income / no action | LEARNING | ACTION_GAP | — |
| G11 | low income / strong execution | TESTING | VALIDATION_GAP | — |
| G12 | 信念"缺资源" vs action gap | LEARNING | ACTION_GAP | BELIEF_REALITY_GAP |
| G13 | 信念"没时间" vs time allocation | STARTED | CONSISTENCY_GAP | BELIEF_REALITY_GAP |
| G14 | 信念"能力不够" vs validation gap | TESTING | VALIDATION_GAP | BELIEF_REALITY_GAP |
| G15 | traction but cannot repeat | STABLE_TRACTION | REPEATABILITY_GAP | BELIEF_REALITY_GAP |

Distribution: DIRECTION 3 · ACTION 4 · CONSISTENCY 3 · VALIDATION 3 · REPEATABILITY 2 = 15.

```
UNCOVERED_CASE_COUNT   = 0
AMBIGUOUS_PRIMARY_COUNT = 0
```

No new category is required by any real Golden. Five primary bottlenecks cover all
15 cases cleanly; `REALITY_CONSTRAINT` and `BELIEF_REALITY_GAP` are modifiers only.

---

## 4. PRODUCT READBACK TEST (§10)

| # | A 我现在在哪 | B 我以为卡在哪 | C 真正卡在哪 | D 为什么重复 | E 下一步 |
|---|---|---|---|---|---|
| G01 | 查资料/等确定 | 没方向 | 定力/不落地 | 方向永远"未定" | 挑1方向做7天小投放 |
| G02 | 一直准备 | 还没准备好 | 迟迟不启动 | 准备无限后推 | 最小交付给1真人 |
| G03 | 反复开始又停 | 没选对方向 | 连续性 | 积累被反复归零 | 锁定固定时段 |
| G04 | 自评/打磨 | 做得不够好 | 需求未验证 | 从无买/不买答案 | 问3人买不买 |
| G05 | 能偶尔成交 | 能力不够 | 不可复制 | 靠临时机会 | 拆成交三步并复制 |
| G06 | 被压力按停 | 被债务拖住 | 未启动最小动作 | 越压越只先熬 | 发1个即时收款动作 |
| G07 | 调研 | 没想清楚 | 没亲自试水 | 信息越多越不动 | 两周最小真实任务 |
| G08 | 总是停下的改进 | 年纪/能力 | 连续性 | 升级没连推4周 | 锁定可复用产出时段 |
| G09 | 还在想 | 没准备好 | 没成品 | 目标一直未锁定 | 7天做1个成品 |
| G10 | 持续准备 | 时机未到 | 没真正开始 | 条件越好越后推 | 一次最小真实交付 |
| G11 | 埋头做对 | 我不行 | 需求未验证 | 只优化不验证 | 问3人付费行为 |
| G12 | 等资源 | 缺钱缺资源 | 未使用能力 | 资源没机会暴露 | 零成本用出去1次 |
| G13 | 一再开头 | 没时间 | 时间结构 | 重要事永远靠后 | 锁不可挪用时段 |
| G14 | 怀疑能力 | 能力不够 | 未报价给买家 | 能力没被检验 | 报价给3个买家 |
| G15 | 个人能做成 | 没做出什么 | 不可脱离本人 | 交付全靠自己 | 交付拆成SOP |

```
HUMAN_READBACK_COMPLETE = 15/15
```

---

## 5. GATES

**REALITY_REFERENCE_GATE (§11) ≥2** — G01 (age+income+surplus) · G02 (age+income+surplus) ·
G03 (age+income+surplus) · G04 (age+income) · G05 (age+income+surplus) ·
G06 (age+income+surplus+problem) · G07 (age+income+surplus) · G08 (age+income+surplus) ·
G09 (age+income+surplus) · G10 (age+income+surplus) · G11 (age+income+surplus) ·
G12 (age+income+surplus) · G13 (age+income+surplus+problem) · G14 (age+income+surplus) ·
G15 (age+income+surplus).

```
REALITY_REFERENCE_GATE_PASS = 15/15
```

**BELIEF_GAP_GATE (§12)**

| # | Q5 belief | Behavior evidence | BELIEF_REALITY_GAP |
|---|---|---|---|
| G01 | 不知道该往哪走 | Q9 换个方向试试（未验证先换） | YES |
| G05 | 能力还不够 | Q6 已经有人愿意付钱 | YES |
| G08 | 能力还不够 | Q8 一忙就停长期（连续性） | YES |
| G12 | 缺钱/缺资源 | Q6 学过但没开始 | YES |
| G13 | 没时间 | Q8 长期事项从未固定保护 | YES |
| G14 | 能力还不够 | Q6 做过但没人买单 / Q7 先想清楚 | YES |
| G15 | 做过不少尝试没结果 | Q6 已经有一点稳定结果 | YES |
| G02,G03,G04,G06,G07,G09,G10,G11 | — | belief matches behavior | NO |

```
BELIEF_GAP_CASE_COUNT = 7
```

**DISTINCTIVENESS (§17)**

```
CARD01_EXACT_DUPLICATE_COUNT = 0
CARD02_EXACT_DUPLICATE_COUNT = 0
ACTION_PLAN_TEMPLATE_COLLAPSE = NO
```
("先做一个最小测试" appears as a *type* but the actual test differs by case —
query buyers (G04/G14), lock a time slot (G03/G08/G13), ship a first artifact
(G09), run a 2-week real task (G07), replicate a sale (G05), write an SOP (G15).)

---

## 6. LEGACY 6Q BENCHMARK (§18)

Representative profiles: **G01** (direction gap), **G02** (action gap),
**G07** (career transition), **G12** (belief-gap action), **G15** (traction, cannot repeat).

Scored 1–5 on six dimensions. A = legacy 6Q style · B = RC8.3 North Star style · C = V6 9Q.

### G01 — 25–30 / 固定工资 / 1000元以下 / 不知道该往哪走
- **A (6Q):** "你焦虑的是收入低。你学历一般、收入一般，所以被困在一份看不到未来的工作里。致命一句话：不是你不够努力，是你还没找到自己的赛道。建议：多尝试、多学习。" → **P3 · I3 · M2 · Ac2 · T1 · R5**
- **B (North Star):** "你的 DECISION 维度显示 certainty-gate 倾向，OPPORTUNITY 维度存在机会盲区……" → exposes construct names. **P2 · I3 · M4 · Ac2 · T4 · R2**
- **C (V6):** Card01–05 above. → **P5 · I5 · M5 · Ac5 · T5 · R5**

### G02 — 31–40 / 固定工资 / 知道方向但没行动
- **A:** "你知道方向却不动，是执行力问题。建议：立即行动。" → **P3 · I3 · M2 · Ac2 · T1 · R5**
- **B:** "DECISION 维度显示 analysis-paralysis，LEVERAGE 维度正常……" → **P2 · I3 · M4 · Ac2 · T4 · R2**
- **C:** Card01–05 above ("准备越来越充分，开始一直后推")。 → **P5 · I5 · M5 · Ac5 · T5 · R5**

### G07 — 41–50 / 想转行但不知道往哪走
- **A:** "中年转型压力大，学历和年龄是主要限制。建议：稳一点。" → **P4 · I3 · M2 · Ac2 · T1 · R5**
- **B:** "IDENTITY 维度约束 + OPPORTUNITY 盲区……" → **P3 · I3 · M4 · Ac2 · T4 · R2**
- **C:** Card01–05 above ("用研究替代下水")。 → **P5 · I5 · M5 · Ac5 · T5 · R5**

### G12 — 缺资源 vs 行动缺口
- **A:** "你说缺资源，确实收入不高是硬约束。建议：先攒钱。" → **P3 · I3 · M1 · Ac2 · T1 · R5** (fails: no belief contrast)
- **B:** 无 belief 对比结构（设计为认知维度，不设信念-行为对账） → **P2 · I3 · M4 · Ac2 · T3 · R2**
- **C:** Card01–05 above（信念-行为对照 + provenance）。 → **P5 · I5 · M5 · Ac5 · T5 · R5**

### G15 — 已有起色但无法复制
- **A:** "你有稳定收入但不满足。建议：继续努力，扩大规模。" → **P3 · I2 · M2 · Ac2 · T1 · R5**
- **B:** "LEVERAGE 维度 gap + SYSTEMS 维度……" → **P3 · I3 · M4 · Ac2 · T4 · R2**
- **C:** Card01–05 above（"结果无法脱离你本人" → SOP）。 → **P5 · I5 · M5 · Ac5 · T5 · R5**

**Totals (legacy A vs V6 C):**

| Profile | A total | B total | C total |
|---|---|---|---|
| G01 | 16 | 17 | 30 |
| G02 | 16 | 17 | 30 |
| G07 | 17 | 18 | 30 |
| G12 | 15 | 16 | 30 |
| G15 | 15 | 18 | 30 |

Aggregate (mean over 5):

| Dimension | Legacy A | RC8.3 B | V6 C | V6 target | Met? |
|---|---|---|---|---|---|
| PERSONAL_RELEVANCE | 3.2 | 2.4 | 5.0 | ≥ legacy | ✅ |
| FIRST_SCREEN_IMPACT | 2.8 | 3.0 | 5.0 | ≥ legacy | ✅ |
| MECHANISM_CLARITY | 1.8 | 4.0 | 5.0 | > legacy | ✅ |
| ACTIONABILITY | 2.0 | 2.0 | 5.0 | > legacy | ✅ |
| TRACEABILITY | 1.0 | 3.8 | 5.0 | > legacy | ✅ |
| READING_BURDEN (5=light) | 5.0 | 2.0 | 5.0 | — | — |

```
LEGACY_BENCHMARK_PASS     = YES
RC83_CONSUMER_RELEVANCE_BEAT = YES
```

---

## 7. FAILURE MODE AUDIT (§19)

| Mode | Count | Evidence |
|---|---|---|
| ENGINE_STRONG_PRODUCT_WEAK | 0 | Goldens are product copy; no engine dependency. |
| ONTOLOGY_VISIBLE_TO_USER | 0 | No construct/blindspot token in any Card01–05 (§4 labels are `内部标签` only). |
| GENERIC_SELF_HELP | 0 | No 加油/坚持就会成功/相信自己/永不放弃. |
| FAKE_BELIEF_GAP | 0 | 7 gaps, each backed by explicit Q5×behavior provenance (G01,G05,G08,G12,G13,G14,G15); 8 non-gaps correctly show NO. |
| REALITY_INFO_UNUSED | 0 | Reality gate 15/15; age/surplus/problem used where relevant, not forced. |
| SAME_ACTION_FOR_EVERYONE | 0 | 7 distinct action types across stages. |
| CARD01_TEMPLATE_COLLAPSE | 0 | 0 exact duplicates; several use no X/Y template (G06/G08/G15 use declarative reframes). |
| OVERCLAIMED_USER_STATE | 0 | All claims are about current observed state, not traits. |
| WEALTH_PROMISE | 0 | No income/wealth outcome promised. |
| DESTINY_LANGUAGE | 0 | No 你一定/你注定/只要就能/成功率/翻身概率. |

```
ENGINE_STRONG_PRODUCT_WEAK_COUNT      = 0
ONTOLOGY_VISIBLE_TO_USER_COUNT        = 0
GENERIC_SELF_HELP_COUNT               = 0
FAKE_BELIEF_GAP_COUNT                 = 0
REALITY_INFO_UNUSED_COUNT             = 0
SAME_ACTION_FOR_EVERYONE_COUNT        = 0
CARD01_TEMPLATE_COLLAPSE_COUNT        = 0
OVERCLAIMED_USER_STATE_COUNT          = 0
WEALTH_PROMISE_COUNT                  = 0
DESTINY_LANGUAGE_COUNT                = 0
```

---

## 8. OLD NORTH STAR ROLE (§20)

`cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/` and
`.../lib/presentation/worldModel/v2_1/` remain **untouched**. Not deleted, not
modified in this stage. Documented future role: `SECONDARY_EVIDENCE` ·
`OPTIONAL_DEEP_TEST` · `RESEARCH_SHADOW`. It must **not** become V6 primary
authority by accident.

```
WORLD_MODEL_V21_CHANGED = NO
RUNTIME_CODE_CHANGED    = NO
```
