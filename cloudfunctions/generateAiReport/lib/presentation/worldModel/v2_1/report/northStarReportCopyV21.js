/**
 * presentation/worldModel/v2_1/report/northStarReportCopyV21.js
 *
 * RC8.3 Stage1C-C — North Star Report Copy Table.
 *
 * DETERMINISTIC Chinese localization of the FROZEN canonical semantic atoms
 * (blindSpotDefinitions / worldPrinciples / strategyDefinitions /
 * archetypeDefinitions / scenarioDefinitions).
 *
 * This is a pure static data table. It contains NO inference, NO engine calls,
 * NO final-prose assembly (that is northStarReportBuilderV21). Every string here
 * is a faithful, deterministic translation of a frozen English canonical atom —
 * NOT a new persuasive paragraph, NOT chicken soup, NOT fortune telling.
 *
 * Copy governance (frozen by ADR-RC8.3-STAGE1C-A §7 / Stage1C-C §16):
 *   - all user-visible copy is Chinese
 *   - no raw enum tokens in user copy (IDs live only in provenance)
 *   - no English library paragraphs
 *   - no prediction / wealth promise / percentage / destiny language
 *
 * @version north_star_report_v1
 */

'use strict'

// ── §6 COGNITIVE VERDICT (person-specific, causal, per blind spot) ────────
const BLIND_SPOT_VERDICT_COPY = Object.freeze({
  OPPORTUNITY_BLINDNESS:
    '你不是没有能力，而是你的注意力被限制在熟悉的圈子和已知的路径里，看不到圈子之外本已存在的机会。',
  FEEDBACK_LOOP_GAP:
    '你不是不努力，而是行动之后缺少有效的外部反馈，一直在用未经检验的假设做决定，进步因此被卡住。',
  DECISION_INERTIA:
    '你不是不想行动，而是习惯性地等条件更成熟、信息更充分，结果把做决定的时间一再推迟，行动本身能带来的信息也迟迟拿不到。',
  RISK_MODEL_DISTORTION:
    '你对风险大小的感知与现实存在系统性偏差——要么把风险看得过大而错过机会，要么忽视下行而过度集中。',
  PROBABILITY_MISJUDGMENT:
    '你习惯用「成或不成」的二元眼光看结果，而现实中的大多数结果是一个概率范围，这让你容易高估个例、低估基础概率。',
  IDENTITY_CONSTRAINT:
    '你把「我是谁」锁定在某个固定的职业或角色上，于是那些不符合这个身份的机会，即使客观存在，也会被你的自我认知自动过滤掉。',
  LEVERAGE_MODEL_GAP:
    '你的产出高度依赖个人时间和精力的直接投入，一份时间换一份结果，因此增长迟早会撞上个人能力的上限。',
  SYSTEM_THINKING_GAP:
    '你不是解决不了问题，而是更容易解决问题的表面，却没有持续追踪制造问题的那个系统——所以同样的问题会换张面孔反复出现。',
  TIME_HORIZON_TRAP:
    '你被紧急的事推着走，把时间和注意力都给了立刻见效的事，而那些需要长期积累才会复利的重要事项被一再搁置。',
})

// ── §7 CURRENT WORLD MODEL (how the user default-thinks about this) ───────
const BLIND_SPOT_CURRENT_MODEL_COPY = Object.freeze({
  OPPORTUNITY_BLINDNESS:
    '你默认只能看到当前职业和社交圈里已经显现的路径，圈子之外的可能性被自动过滤掉了。',
  FEEDBACK_LOOP_GAP:
    '你默认凭自己的判断和假设行动，很少主动收集和消化外部反馈，于是行动再多，内心的模型也没有被校准。',
  DECISION_INERTIA:
    '你默认要等信息足够充分、条件足够成熟才行动，把「确定性」当成了行动的前提。',
  RISK_MODEL_DISTORTION:
    '你默认用「安全还是危险」的单一尺度看待风险，而不是评估风险的大小、可逆性和上行空间。',
  PROBABILITY_MISJUDGMENT:
    '你默认用「能成还是不能成」来判断一件事，很少去想这件事在不同条件下成与不成各有多大可能。',
  IDENTITY_CONSTRAINT:
    '你默认用「我是做什么的」来定义自己，而不是用「我拥有什么能力」来定义自己。',
  LEVERAGE_MODEL_GAP:
    '你默认一份时间换一份产出，没有把「可复用、可放大」纳入对价值的理解。',
  SYSTEM_THINKING_GAP:
    '你默认把问题当作一件件独立的事件来处理，很少去想事件背后那个持续制造问题的系统结构。',
  TIME_HORIZON_TRAP:
    '你默认优先处理立刻见效的事，把长期才见效、但会持续复利的事排在后面。',
})

// ── §8 WORLD OPERATING RULE (world principle, keyed by principleId) ───────
const WORLD_RULE_STATEMENT_COPY = Object.freeze({
  DECISION_CREATES_INFORMATION:
    '每一个与世界互动的决定，都会产生此前不存在的全新信息；不做决定，就永远得不到这些信息。',
  FEEDBACK_UPDATES_MODELS:
    '行动如果不系统采集并消化反馈，内心的模型就不会更新——决定产生的信息只有被捕获、解读、融入后续决定，才有价值。',
  PROBABILITY_GOVERNS_OUTCOMES:
    '复杂系统里的大多数结果由概率分布支配，而不是二元的成与败；世界是在「区间」里运行，而不是在「点」上运行。',
  RISK_IS_ASYMMETRICAL:
    '风险不是均匀的，每个决定都有不对称的盈亏结构；下行和上行很少对等。',
  LEVERAGE_MULTIPLIES_VALUE:
    '一对一交付的价值无法超越个人的时间与精力；杠杆是让产出脱离个人投入的机制。',
  TIME_COMPOUNDS_ADVANTAGE:
    '会复利的活动——知识、关系、声誉、系统、资产——产生非线性结果，长期的小投入能带来短期优化无法企及的回报。',
  IDENTITY_CONSTRAINS_CHOICES:
    '一个人认为自己是谁，会像过滤器一样决定他能看到哪些选择；僵化、绑定角色的身份会过滤掉不符合自我认知的选项。',
  OPPORTUNITY_EMERGES_THROUGH_EXPOSURE:
    '机会并非对所有观察者同等可见，它来自一个人「暴露面」与「识别能力」的交集；暴露面窄的人，机会集合也窄。',
  SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR:
    '复杂系统——经济、组织、社交网络、职业——产生的结果，无法靠单独分析各个部件来预测；线性因果思维无法建模这类系统。',
})

const WORLD_RULE_CONSEQUENCE_COPY = Object.freeze({
  DECISION_CREATES_INFORMATION:
    '迟迟不做决定的人，内心的模型停止了接收新数据，模型逐渐过时，预测越来越不准，与现实的差距越拉越大。',
  FEEDBACK_UPDATES_MODELS:
    '频繁行动却从不系统复盘结果的人，可能无限重复同样的错误——模型不是因缺乏行动而冻结，而是因缺乏反馈整合而冻结。',
  PROBABILITY_GOVERNS_OUTCOMES:
    '二元思维的人要么过度押注「确定」的路径，要么因为「不够确定」而放弃机会；两种错误来自同一个缺陷——不会概率化思考。',
  RISK_IS_ASYMMETRICAL:
    '把风险一概当作危险的人，会错过正向不对称的机会；忽视下行的人，会承担负向不对称的风险。',
  LEVERAGE_MULTIPLIES_VALUE:
    '只靠个人直接付出的人会撞上硬天花板，因为他们从不寻找放大机制。',
  TIME_COMPOUNDS_ADVANTAGE:
    '系统性地优先即时回报而非复利投入的人，会被起步更晚但复利更久的人超越；差距不在努力，而在时间视野。',
  IDENTITY_CONSTRAINS_CHOICES:
    '身份僵化的人即使信息与资源齐备，也可能不走某条路，因为那条路不符合他的自我认知；这不是知识缺口，而是身份缺口。',
  OPPORTUNITY_EMERGES_THROUGH_EXPOSURE:
    '高能力但暴露面窄的人，看到的机会少于能力一般但暴露面广的人；瓶颈不在技能，而在于他接触世界的表面积。',
  SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR:
    '用线性因果思考的人会持续误诊复杂系统中的问题，套用只在简单系统里有效的方案，并被副作用和意外结果反复惊到。',
})

const WORLD_RULE_MECHANISM_COPY = Object.freeze({
  DECISION_CREATES_INFORMATION:
    '人做出选择并行动时，世界会回应；这个回应里藏着信号——什么行得通、什么行不通、世界奖励什么、惩罚什么。每个决定都是一次实验，每次实验都会更新内心的模型。',
  FEEDBACK_UPDATES_MODELS:
    '世界一直在发信号，但信号只有被观察、记录、处理后，才变成信息。行动却不复盘的人，是在制造不断蒸发的原始数据，内心的模型原地不动。',
  PROBABILITY_GOVERNS_OUTCOMES:
    '任何结果不确定的决定，都对应着一个可能结果的分布：有些结果更可能，有些更不可能。理性的做法是比较期望值、评估风险收益的不对称，再据此行动。',
  RISK_IS_ASYMMETRICAL:
    '在大多数现实决定里，最坏情形和最好情形并非镜像。许多机会下行有限、上行巨大；许多危险上行有限、下行却是灾难性的。功能健全的风险模型能区分这两者。',
  LEVERAGE_MULTIPLIES_VALUE:
    '杠杆有多种形式：可复用的资产（代码、内容、工具）、系统（无需创造者也能运行的流程）、网络（触达多人的分发）、资本（睡眠时也在工作的钱）。没有杠杆，产出就被个人能力死死封顶。',
  TIME_COMPOUNDS_ADVANTAGE:
    '复利之所以有效，是因为每一期的收益都成为下一期的基数。多年积累的技能复利成专业，多年积累的关系复利成信任网络。短期优化牺牲了这种复利。',
  IDENTITY_CONSTRAINS_CHOICES:
    '身份不只是描述，更是一套约束系统：每说一句「我是 X」，同时也隐含了「我不是 Y」。这套隐含的否定可以很大且对自己不可见。定义得窄，选择集就窄；定义得宽，选择集就宽。',
  OPPORTUNITY_EMERGES_THROUGH_EXPOSURE:
    '机会识别是暴露表面积的函数：输入（人、领域、问题、工具）越多维，大脑能匹配出的模式就越多。只和单一领域、同一群人打交道的人，只能看到那个领域内可见的机会。',
  SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR:
    '在带反馈回路、延迟和非线性关系的系统里，因果不一定在时间上相近，方向也不一定明显：小输入可能产生大输出，大输入可能毫无结果。理解系统需要想环路、存量、流量和延迟，而不是简单的如果-那么链条。',
})

// §8 MISALIGNMENT — the specific gap between user model and world rule.
const MISALIGNMENT_COPY = Object.freeze({
  DECISION_CREATES_INFORMATION:
    '你的模型把「确定性」当成行动的前提；而世界规则是——行动本身才会产生确定性所需的信息。错位点在于：你等待的，是行动之前根本不存在的东西。',
  FEEDBACK_UPDATES_MODELS:
    '你的模型凭自己的假设行动；而世界规则是——不采集反馈，假设就不会被校准。错位点在于：你缺的不是行动，而是行动之后的反馈闭环。',
  PROBABILITY_GOVERNS_OUTCOMES:
    '你的模型用「成或不成」看结果；而世界规则是——结果是一段概率区间。错位点在于：你把一段区间压缩成了一个点。',
  RISK_IS_ASYMMETRICAL:
    '你的模型把风险一概当作「安全还是危险」；而世界规则是——风险不对称、有赔率。错位点在于：你没有看到风险的形状。',
  LEVERAGE_MULTIPLIES_VALUE:
    '你的模型是一份时间换一份产出；而世界规则是——产出可以脱离个人投入被放大。错位点在于：你的价值没有乘数。',
  TIME_COMPOUNDS_ADVANTAGE:
    '你的模型优先即时回报；而世界规则是——价值会随时间复利。错位点在于：你牺牲了长期积累，来换取短期结果。',
  IDENTITY_CONSTRAINS_CHOICES:
    '你的模型用「我是做什么的」定义自己；而世界规则是——身份会过滤掉选项。错位点在于：你被自我认知收窄了选择集。',
  OPPORTUNITY_EMERGES_THROUGH_EXPOSURE:
    '你的模型只在熟悉圈子里找机会；而世界规则是——机会来自暴露面。错位点在于：你的接触面太窄，机会集也随之变窄。',
  SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR:
    '你的模型把问题当作独立事件处理；而世界规则是——系统会产生涌现行为。错位点在于：你在治症状，而不是改结构。',
})

// ── §11/§12 STRATEGY (keyed by strategyId) ────────────────────────────────
const STRATEGY_MECHANISM_COPY = Object.freeze({
  BUILD_FEEDBACK_LOOP:
    '升级反馈模型——把与外部反馈的关系，从被动接收或回避，转变为主动寻求与系统化处理。',
  EXPAND_OPTIONALITY:
    '升级机会模型——同时培育多个并行选项，等有更多信息后再选择，而不是过早锁定单一路径。',
  INCREASE_EXPERIMENT_RATE:
    '升级决策模型——用快速、低成本的实验取代大赌注或拖延式决策，通过行动而非分析来学习。',
  REFRAME_RISK_MODEL:
    '升级风险模型——纠正风险感知中的系统性偏差，学会校准过的风险评估，而非一味回避或集中。',
  UPGRADE_PROBABILITY_THINKING:
    '升级概率模型——从成败二元的框架，转向概率化思维：理解区间、可能性与期望值。',
  EXPAND_IDENTITY_BOUNDARY:
    '升级身份模型——通过在新领域创造有效性的证据，把自我认知从固定角色中解放出来。',
  BUILD_LEVERAGE_MODEL:
    '升级杠杆模型——看清并运用杠杆，从线性的时间换价值，走向通过系统、知识、分发放大产出。',
  BUILD_DECISION_SYSTEM:
    '升级决策模型与系统思维——从孤立的事件级思考，转向带反馈、校准和复利的系统性决策。',
  EXTEND_TIME_HORIZON:
    '升级时间模型——通过为「重要但不紧急」的复利事项留出受保护时间，打破紧迫感陷阱。',
})

const STRATEGY_EXPERIMENT_COPY = Object.freeze({
  BUILD_FEEDBACK_LOOP: [
    {
      name: '市场信号测试',
      description: '把一个已有的技能或产出放到真实市场信号前（报价、方案、提案），观察反应——目的不是成交，而是学习。',
    },
    {
      name: '行动后复盘',
      description: '每次重要行动后写下：预期什么、实际发生什么、学到什么。连续做 5 次。',
    },
    {
      name: '主动求反馈',
      description: '请 3 个非亲友的人，就某个具体产出或决定给出真实反馈。',
    },
  ],
  EXPAND_OPTIONALITY: [
    {
      name: '技能资源盘点',
      description: '列出所有技能、资源、关系，并为每一项找出至少一个当前圈子之外的替代用途。',
    },
    {
      name: '低成本路径测试',
      description: '识别 3 个可能方向，各花最少的时间/金钱去测试（不投入）。2 周后评估哪个信号最强。',
    },
    {
      name: '网络扩展',
      description: '结识 5 个当前圈子之外的人，问问他们看到了世界上的哪些机会。',
    },
  ],
  INCREASE_EXPERIMENT_RATE: [
    {
      name: '一天实验',
      description: '挑一个假设，在一天内设计并完成一次测试。目标是学习，不是结果。',
    },
    {
      name: '决策日志',
      description: '一周内记下每个重要决定：决定了什么、为什么、预期什么。一周后复盘。',
    },
    {
      name: '可逆性审计',
      description: '对每个待定决定问：「如果搞砸了，能撤销吗？代价多大？」优先对可逆的决定立即行动。',
    },
  ],
  REFRAME_RISK_MODEL: [
    {
      name: '风险绘图',
      description: '画出当前的风险：可能出什么问题、概率、影响、可逆性。识别哪些被高估、哪些被低估。',
    },
    {
      name: '受控暴露',
      description: '对一个此前回避的小而可逆的风险，设一个明确的下行上限，试一次，观察结果与情绪反应。',
    },
    {
      name: '下行计算',
      description: '对下一个机会明确计算：最好、最坏、最可能三种情形，并对比最坏情形与自己的恢复能力。',
    },
  ],
  UPGRADE_PROBABILITY_THINKING: [
    {
      name: '概率校准',
      description: '对 5 件即将发生的事给出概率（而非是/否），用 2 周追踪准确度。',
    },
    {
      name: '基础率调查',
      description: '对一个重大决定调研：「在类似情况下，成功/失败的人占多大比例？」并与自己的估计对比。',
    },
    {
      name: '期望值框架',
      description: '用期望值重述一个待定决定：(成功概率 × 成功价值) + (失败概率 × 失败代价)。',
    },
  ],
  EXPAND_IDENTITY_BOUNDARY: [
    {
      name: '身份实验',
      description: '做一个当前职业身份之外的小项目。重点不是质量，而是证明「我能做点不一样的」。',
    },
    {
      name: '技能迁移映射',
      description: '列出当前技能，为每项找出 3 个适用的新场景，选一个去试。',
    },
    {
      name: '角色叙事重写',
      description: '把自我介绍从「基于角色」改成「基于能力」，并讲给 3 个人听。',
    },
  ],
  BUILD_LEVERAGE_MODEL: [
    {
      name: '杠杆审计',
      description: '审计当前工作：有多大比例是线性的（一份时间=一份产出）？找出最高杠杆的活动并提高它的占比。',
    },
    {
      name: '可复用产出',
      description: '创造一件能用不止一次的产出（模板、指南、录播、流程），观察它的乘数效应。',
    },
    {
      name: '委派自动化测试',
      description: '找出一个重复性任务，要么自动化要么委派出去，测量省下的时间与产出质量。',
    },
  ],
  BUILD_DECISION_SYSTEM: [
    {
      name: '决策流程设计',
      description: '写下你当前的决策流程，找出最弱的一环，设计一个改进并在接下来 3 个决定上测试。',
    },
    {
      name: '系统绘图',
      description: '把一个反复出现的问题画成系统：输入、过程、输出、反馈回路，找出最高杠杆的干预点。',
    },
    {
      name: '复利审计',
      description: '审计时间分配：有多大比例花在会复利的活动上，多大比例是一次性回报？把 5% 移向复利。',
    },
  ],
  EXTEND_TIME_HORIZON: [
    {
      name: '时间审计',
      description: '连续 3 天记录时间，按「紧急 × 重要」四象限归类每项活动，识别模式。',
    },
    {
      name: '受保护时间块',
      description: '每周安排并守住一个 2 小时的块，专门做「重要但不紧急」的事，坚持 3 周。',
    },
    {
      name: '长期下注',
      description: '找一件会随年份复利增值的事，每周对它投入一小块稳定的时间。',
    },
  ],
})

const STRATEGY_SUCCESS_SIGNAL_COPY = Object.freeze({
  BUILD_FEEDBACK_LOOP: '能在复盘窗口内，说出一个因外部反馈而被修正的具体信念。',
  EXPAND_OPTIONALITY: '能列出 3 个以上可行的备选路径，且每个都有初步证据。',
  INCREASE_EXPERIMENT_RATE: '在复盘窗口内完成 3 个以上低成本实验，并能说出从每个实验学到什么。',
  REFRAME_RISK_MODEL: '能对一个真实决定给出有概率依据的、校准过的风险评估，且有证据支撑。',
  UPGRADE_PROBABILITY_THINKING: '能用概率化语言表达一个真实决定，并明确说出关于概率的假设。',
  EXPAND_IDENTITY_BOUNDARY: '用能力和价值观、而非单一角色或职业来描述自己。',
  BUILD_LEVERAGE_MODEL: '能识别并说出工作中至少一个杠杆点，并已对它采取行动。',
  BUILD_DECISION_SYSTEM: '能描述自己的决策系统，并有系统化校准带来决策质量提升的证据。',
  EXTEND_TIME_HORIZON: '有一个反复出现的、用于复利活动的受保护时间块，并能在长期目标上看到进展。',
})

const STRATEGY_STOP_CONDITION_COPY = Object.freeze({
  BUILD_FEEDBACK_LOOP: '反馈回路已能持续产出校准数据，不再凭未经检验的假设行动。',
  EXPAND_OPTIONALITY: '拥有真实的可选择性——多条可行路径，证据真实而非想象。',
  INCREASE_EXPERIMENT_RATE: '默认用测试而非纠结来做决定，实验节奏无需外部督促也能持续。',
  REFRAME_RISK_MODEL: '基于期望值和可逆性做风险决策，而非恐惧或过度自信。',
  UPGRADE_PROBABILITY_THINKING: '习惯用可能性与期望值思考，而非二元结果。',
  EXPAND_IDENTITY_BOUNDARY: '在至少一个原本身份框架之外的领域，有有效性的证据。',
  BUILD_LEVERAGE_MODEL: '在日常工作中主动寻找并运用杠杆，而非默认线性付出。',
  BUILD_DECISION_SYSTEM: '拥有一个可重复的、能产生复利改进的决策流程。',
  EXTEND_TIME_HORIZON: '习惯按重要性而非紧迫性分配时间，长期项目有持续进展。',
})

const STRATEGY_REVIEW_WINDOW_COPY = Object.freeze({
  BUILD_FEEDBACK_LOOP: '2 周',
  EXPAND_OPTIONALITY: '4 周',
  INCREASE_EXPERIMENT_RATE: '2 周',
  REFRAME_RISK_MODEL: '3 周',
  UPGRADE_PROBABILITY_THINKING: '3 周',
  EXPAND_IDENTITY_BOUNDARY: '4 周',
  BUILD_LEVERAGE_MODEL: '3 周',
  BUILD_DECISION_SYSTEM: '4 周',
  EXTEND_TIME_HORIZON: '4 周',
})

// ── §13 SCENARIO PATTERN LOCALIZATION (pure English→Chinese string table) ──
//
// AUTHORITY BOUNDARY (frozen by Stage1C-C2 §2/§3):
//   These are LOCALIZATION entries keyed by the EXACT frozen English
//   `likelyDecisionPattern` strings that arrive inside
//   `presentation.scenarioContrast.currentModel/upgradedModel.likelyDecisionPattern`.
//
//   This table does NOT decide blindSpot→dimensionModel, does NOT decide
//   blindSpot→scenario authority. It is a pure display translation of the
//   strings the presentation model already resolved. No shadow inference.
const SCENARIO_PATTERN_LOCALIZATION = Object.freeze({
  // DECISION_MODEL
  'Decision quality varies with emotional state': '决策质量随情绪状态波动',
  'Large commitments made without incremental testing': '在没有小步验证的情况下做出大的投入',
  'Decisions delayed waiting for perfect information': '为了等待完美信息而一再推迟决定',
  'Small, reversible experiments before large commitments': '在大投入之前先做小的、可逆的实验',
  'Decisions made with explicit assumptions that can be tested': '带着可以被检验的明确假设做决定',
  'Faster action with embedded learning mechanisms': '更快行动，并把学习机制嵌入其中',
  // RISK_MODEL
  'Avoidance of any situation with uncertain outcome': '回避任何结果不确定的情形',
  'Concentration of resources without diversification awareness': '资源集中而缺乏分散意识',
  'Overestimation of downside, underestimation of ability to recover': '高估下行、低估自己的恢复能力',
  'Risk decisions based on expected value and reversibility': '基于期望值和可逆性做风险决策',
  'Portfolio approach — small bets across multiple directions': '组合式下注——在多个方向分散小注',
  'Explicit downside calculation: "What is the worst that can happen? Can I recover?"': '明确计算下行：「最坏会怎样？我能不能恢复？」',
  // PROBABILITY_MODEL
  'Binary success/failure framing of complex situations': '用成/败的二元框架看待复杂局面',
  'Conclusions drawn from one or two examples': '从一两个例子就下结论',
  'Focus on vivid success stories, ignoring base rates': '关注生动的成功故事，忽视基础概率',
  'Decisions evaluated by expected value, not binary outcome': '用期望值而非二元结果来评估决策',
  'Understanding that most outcomes fall in a range, not a point': '理解大多数结果落在一个区间、而非一个点',
  'Seeking base rates before evaluating specific cases': '在评估具体个案前先查基础率',
  // FEEDBACK_MODEL
  'Actions taken without systematic outcome review': '行动之后没有系统地复盘结果',
  'Assumptions held without market or external testing': '假设未经市场或外部检验就被持有',
  'Feedback avoided or received only through unreliable channels': '回避反馈，或只通过不可靠渠道接收',
  'Tight feedback loops — act, measure, adjust, repeat': '紧密的反馈回路——行动、测量、调整、重复',
  'Assumptions explicitly tested against market or external evidence': '假设主动对照市场或外部证据进行检验',
  'Active seeking of feedback from diverse, unbiased sources': '主动从多元、无偏的来源寻求反馈',
  // OPPORTUNITY_MODEL
  'Single path pursued without developing alternatives': '只走单一路径，不培育备选',
  'Limited awareness of what is possible outside current context': '对当前圈子之外的可能性感知有限',
  'Current skills seen only in their original application': '现有技能只被看作其原始用途',
  'Multiple parallel paths with real evidence for each': '多条并行的路径，且各有真实证据',
  'Broader network bringing diverse opportunity awareness': '更广的网络带来多元的机会感知',
  'Creative recombination of existing skills for new applications': '对现有技能进行创造性的重新组合，用于新用途',
  // LEVERAGE_MODEL
  'Linear time-for-money exchange without multiplier': '线性的一对一时间换钱，没有乘数',
  'No systems, automation, or delegation in work process': '工作流程中没有系统、自动化或委派',
  'Unable to see how to scale beyond personal capacity': '看不到如何超越个人能力去扩展',
  'Creating repeatable outputs that generate value beyond time invested': '创造可复用的产出，其价值超出投入的时间',
  'Building systems and processes that multiply personal output': '建立放大个人产出的系统和流程',
  'Identifying and deploying leverage points in daily work': '在日常工作中识别并运用杠杆点',
  // IDENTITY_MODEL
  'Self-concept locked into a single professional role': '自我认知被锁定在单一职业角色',
  'Perceived capability limited by current job title': '对能力的认知被当前职位头衔所限',
  'Identity derived from employer or occupation rather than capabilities': '身份来自雇主或职业，而非能力',
  'Identity based on capabilities and values, not roles': '身份建立在能力和价值观之上，而非角色',
  'Evidence of effectiveness in multiple domains': '在多个领域有有效性的证据',
  'Self-concept that expands with new experiences': '自我认知随新经历而扩展',
  // TIME_MODEL
  'Driven by urgency — reactive rather than proactive': '被紧迫感驱动——被动反应而非主动规划',
  'Time fragmented across many small, non-compounding activities': '时间被切成许多小的、不复利的碎片',
  'Important-but-not-urgent work perpetually delayed': '重要但不紧急的事被无限推迟',
  'Protected blocks for compounding-return activities': '为复利型活动留出受保护的时间块',
  'Decision to invest in long-term capabilities, not just immediate tasks': '决定投资长期能力，而非只处理眼前任务',
  'Time allocated by importance, not urgency': '按重要性而非紧迫性分配时间',
})

// ── §15 DIMENSION LABELS (collapsed secondary context) ───────────────────
const CONSTRUCT_LABEL_COPY = Object.freeze({
  DECISION: '决策方式',
  FEEDBACK: '反馈处理',
  PROBABILITY: '概率判断',
  RISK: '风险感知',
  LEVERAGE: '杠杆意识',
  TIME: '时间分配',
  IDENTITY: '身份认知',
  OPPORTUNITY: '机会识别',
  SYSTEMS: '系统思维',
})

const ORIENTATION_LABEL_COPY = Object.freeze({
  DISTORTED: '存在偏差',
  HEALTHY: '健康',
  MIXED: '混合',
  NEUTRAL: '中性',
  UNKNOWN: '未知',
})

const STATE_LABEL_COPY = Object.freeze({
  STRONG: '显著',
  MODERATE: '中等',
  WEAK: '轻微',
  UNKNOWN: '未知',
})

// ── §14 ARCHETYPE DESCRIPTION (collapsed secondary context) ───────────────
const ARCHETYPE_DESCRIPTION_COPY = Object.freeze({
  EXPLORER: '由好奇心与探索驱动，广泛探索后再聚焦。',
  BUILDER: '通过构建和创造来学习与验证，先做出来再说。',
  OPERATOR: '执行可靠，通过反复实践打磨与优化既有方法。',
  STRATEGIST: '看全局、找杠杆点，为长远布局。',
  GUARDIAN: '重视稳定与安全，先守成再谈增长。',
  CONNECTOR: '通过连接人与资源创造价值。',
  OPTIMIZER: '测量、改进、重复，持续优化既有系统。',
})

// ── Getters ────────────────────────────────────────────────────────────────
function getBlindSpotVerdict(blindSpotId) {
  return BLIND_SPOT_VERDICT_COPY[blindSpotId] || null
}
function getBlindSpotCurrentModel(blindSpotId) {
  return BLIND_SPOT_CURRENT_MODEL_COPY[blindSpotId] || null
}
function getWorldRuleStatement(principleId) {
  return WORLD_RULE_STATEMENT_COPY[principleId] || null
}
function getWorldRuleConsequence(principleId) {
  return WORLD_RULE_CONSEQUENCE_COPY[principleId] || null
}
function getWorldRuleMechanism(principleId) {
  return WORLD_RULE_MECHANISM_COPY[principleId] || null
}
function getMisalignment(principleId) {
  return MISALIGNMENT_COPY[principleId] || null
}
function getStrategyMechanism(strategyId) {
  return STRATEGY_MECHANISM_COPY[strategyId] || null
}
function getStrategyExperiments(strategyId) {
  return STRATEGY_EXPERIMENT_COPY[strategyId] || []
}
function getStrategySuccessSignal(strategyId) {
  return STRATEGY_SUCCESS_SIGNAL_COPY[strategyId] || null
}
function getStrategyStopCondition(strategyId) {
  return STRATEGY_STOP_CONDITION_COPY[strategyId] || null
}
function getStrategyReviewWindow(strategyId) {
  return STRATEGY_REVIEW_WINDOW_COPY[strategyId] || null
}
function getScenarioPatternLocalization(englishString) {
  return SCENARIO_PATTERN_LOCALIZATION[englishString] || null
}
function getArchetypeDescription(archetypeId) {
  return ARCHETYPE_DESCRIPTION_COPY[archetypeId] || null
}
function getConstructLabel(construct) {
  return CONSTRUCT_LABEL_COPY[construct] || null
}
function getOrientationLabel(orientation) {
  return ORIENTATION_LABEL_COPY[orientation] || null
}
function getStateLabel(state) {
  return STATE_LABEL_COPY[state] || null
}

module.exports = {
  BLIND_SPOT_VERDICT_COPY,
  BLIND_SPOT_CURRENT_MODEL_COPY,
  WORLD_RULE_STATEMENT_COPY,
  WORLD_RULE_CONSEQUENCE_COPY,
  WORLD_RULE_MECHANISM_COPY,
  MISALIGNMENT_COPY,
  STRATEGY_MECHANISM_COPY,
  STRATEGY_EXPERIMENT_COPY,
  STRATEGY_SUCCESS_SIGNAL_COPY,
  STRATEGY_STOP_CONDITION_COPY,
  STRATEGY_REVIEW_WINDOW_COPY,
  SCENARIO_PATTERN_LOCALIZATION,
  ARCHETYPE_DESCRIPTION_COPY,
  CONSTRUCT_LABEL_COPY,
  ORIENTATION_LABEL_COPY,
  STATE_LABEL_COPY,
  getConstructLabel,
  getOrientationLabel,
  getStateLabel,
  getBlindSpotVerdict,
  getBlindSpotCurrentModel,
  getWorldRuleStatement,
  getWorldRuleConsequence,
  getWorldRuleMechanism,
  getMisalignment,
  getStrategyMechanism,
  getStrategyExperiments,
  getStrategySuccessSignal,
  getStrategyStopCondition,
  getStrategyReviewWindow,
  getScenarioPatternLocalization,
  getArchetypeDescription,
}
