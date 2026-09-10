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

// ── §15 BLIND SPOT LABEL (deterministic translation of frozen labels) ─────
// Keyed by the frozen blindSpotId. Used by the MULTIPLE report path, which has
// no authoritative primary and therefore no `primaryDiagnosis.blindSpotLabel`.
const BLIND_SPOT_LABEL_COPY = Object.freeze({
  OPPORTUNITY_BLINDNESS: '机会盲区',
  FEEDBACK_LOOP_GAP: '反馈回路断裂',
  DECISION_INERTIA: '决策惯性',
  RISK_MODEL_DISTORTION: '风险模型失真',
  PROBABILITY_MISJUDGMENT: '概率误判',
  IDENTITY_CONSTRAINT: '身份锁定',
  LEVERAGE_MODEL_GAP: '杠杆模型缺失',
  SYSTEM_THINKING_GAP: '系统思维缺失',
  TIME_HORIZON_TRAP: '时间视野陷阱',
})

// ── §16 MULTIPLE_SUPPORTED_MODELS (multi-direction, non-ranked) ───────────
// Deterministic, neutral copy for the MULTIPLE diagnosis state: ≥2 cognitive
// directions are equally well supported and NONE is an authoritative primary.
// The report describes each supported direction truthfully and refuses to
// rank them. All strings are Chinese, neutral, non-predictive, non-wealth.
// COUNT-NEUTRAL: the runtime eligible-model count is N (N >= 2) and is NOT
// known to this static copy. Wording must never hardcode a numeral ("两个" /
// "这两个" / "2个"); it uses neutral quantifiers ("多个" / "这些") so the copy
// stays consistent for any N. The per-model cards carry the concrete count.
const MULTIPLE_STATE_COPY = Object.freeze({
  eyebrow: '认知诊断',
  headline: '目前不是没有结论，而是有多个方向都得到了足够的证据支持。',
  summary: '目前不是没有结论，而是有多个方向都得到了足够的证据支持，这次很难简单分出主次。',
  evidenceHeading: '支持这些方向的回答',
  synthesisTitle: '综合结论',
  synthesis: '当前证据足以确认这些模式同时存在，但还不足以把其中某一个指定为唯一主因。',
  nextObservationTitle: '接下来可以留意什么',
})

// Per-candidate neutral observation (deterministic, evidence-focused, no winner).
const MULTIPLE_OBSERVATION_COPY = Object.freeze({
  DECISION_INERTIA:
    '留意自己「再等一等、把信息收集得更全再做决定」出现的时机——决定何时不再等待，往往比继续收集信息更能改变结果。',
  TIME_HORIZON_TRAP:
    '留意「先处理立刻见效的事」出现的时机——把一件长期才见效、但会持续复利的事，固定安排到不被紧急事务挤占的位置。',
})

// ── §17 F2-M2 IMPACT SUMMARY (Layer 1) — section titles ──────────────────
// NOTE: Layer-1 section titles / Layer-2 toggle labels are UI labels owned by
// the view-model TITLE table (utils/northStarReportViewModel.js), NOT report
// copy — they are presentation-neutral chrome, not diagnosis semantics.

// ── §18 F2-M2 MULTIPLE impact copy (COUNT-NEUTRAL; N >= 2) ────────────────
// The runtime eligible-model count is N (N >= 2) and is UNKNOWN to this static
// table. All wording uses neutral quantifiers («多个» / «这些») so it stays
// consistent for any N. NO numeral («两个» / «这两个» / «2个») is ever hardcoded.
const MULTIPLE_IMPACT_COPY = Object.freeze({
  tensionBroad:
    '这些方向分散在不同方面——不是同一处偏差的重复，而是你在不同决策场景里反复出现的习惯。',
  tensionFocused:
    '这些方向集中在同一类问题上，是同一种决策习惯在不同场景里的不同表现。',
  coverageLead: '目前有多个认知方向同时获得了足够的证据支持：',
  trapLead: '这些方向叠在一起，会让你在关键决策上表现出一致的倾向：',
  upgradeLead: '与其一次改掉所有方向，不如先建立同一套更稳的决策方式：',
  actionFallback: '先从上面任意一个方向挑一个最小的动作做起来，再根据结果调整。',
  noPrimaryNote: '系统目前不把其中任何一个判定为唯一主因。',
})

// Concrete, count-neutral "shared decision method" actions for the MULTIPLE
// state. These keep ACTION_PLAN within the 3-5 bullet budget for ANY N (the
// per-candidate observations cover only a subset of candidates). Not chicken
// soup: each is a concrete decision-protocol step tied to the multi-model
// tension. No numeral is hardcoded.
const MULTIPLE_ACTION_COPY = Object.freeze({
  base: [
    '把同时成立的这几个方向列出来，标清每个方向分别在什么情境下最容易出现。',
    '在这些情境里设一个固定的决策检查点：动手前先停一下，确认不是习惯在替你决定。',
    '做重要决定前，先分清这件事是在解决眼前问题，还是在积累长期结果。',
    '只挑一个方向，用两周时间做最小的改变，再用实际结果来调整下一步。',
  ],
})

// ── §19 V5 SYSTEM LOOP (Card 03) — repeated causal loop, keyed by principleId ──
// Recovers the legacy "系统困局" impact WITHOUT recovering unsupported inference.
// Each entry is a source-backed causal loop of the user's OWN recurring pattern
// (trigger → habit → response → consequence → reinforcement), expressed in plain
// user language. It is a deterministic restatement of the frozen principle's
// mechanism/consequence + the blind-spot mechanism; it invents no event, no
// outcome, no world rule. The loop names the trap (NOT a fabricated primary).
const SYSTEM_LOOP_COPY = Object.freeze({
  DECISION_CREATES_INFORMATION:
    '遇到需要拍板的事 → 你想先等信息更全、条件更成熟 → 一直不出手 → 行动本来会带来的新信息始终没有出现 → 信息越少你越不敢动，只能继续等。',
  FEEDBACK_UPDATES_MODELS:
    '做完一件事 → 你凭自己的判断认定结果，很少回头核对 → 外部信号没有被真正消化 → 心里的模型一直没被校准 → 下一次还是按老假设行动，同样的偏差再发生一次。',
  PROBABILITY_GOVERNS_OUTCOMES:
    '面对不确定的结果 → 你用「成还是不成」去判断 → 要么因为看着「一定成」而重仓押上，要么因为「不确定」而直接放弃 → 两种做法都绕开了对概率和期望值的评估 → 结果反复让你意外，你更相信运气。',
  RISK_IS_ASYMMETRICAL:
    '面对一个机会 → 你先问「安不安全」 → 把风险和「危险」画上等号 → 那些下行有限、上行不小的机会被你先排除掉 → 你只留下「看起来安全」的选项，回报空间被一起压平了。',
  LEVERAGE_MULTIPLIES_VALUE:
    '要产出结果 → 你默认自己多花时间、多使劲去做 → 产出始终绑在你一个人身上 → 一旦停下产出就归零，增长撞到个人精力的天花板 → 你更确信「只能靠自己拼」，也就更没力气去找放大机制。',
  TIME_COMPOUNDS_ADVANTAGE:
    '新的事情出现 → 你本能先处理立刻见效的那件 → 需要长期积累才复利的事被一再往后排 → 紧急的事永远做不完，重要的进度始终是零 → 你更觉得「没时间」，就更没时间投给长期。',
  IDENTITY_CONSTRAINS_CHOICES:
    '出现一个机会 → 你先问「这像是我这种身份该做的事吗」 → 不符合自我设定的选项被自动过滤 → 你能看到的路越来越窄 → 你更确信「我只能做这个」，可选的路又少了一条。',
  OPPORTUNITY_EMERGES_THROUGH_EXPOSURE:
    '寻找出路 → 你只在熟悉的圈子和已知的路径里找 → 圈子之外本已存在的机会始终没进入视野 → 你感到「没什么机会」 → 于是更少接触新领域，暴露面进一步缩小，机会也就更少。',
  SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR:
    '一个问题冒出来 → 你针对它本身直接处理 → 表面症状被暂时压下去，制造它的结构却没动 → 过一阵，同一个问题换张面孔再次出现 → 你继续处理新的症状，结构照旧不改。',
})

// ── §20 V5 MULTIPLE UNIFIED SYSTEM LOOP (Card 03 for N>=2) ────────────────
// Describes the single recurring decision loop SHARED across simultaneously
// supported directions. Per the V5 mission the state's own copy must AVOID the
// engine-meta phrasing banned in §12 (so no «分主次» / «谁更强» here). It names
// the shared habit, never ranks and never fabricates a primary. The concrete
// candidate labels are carried separately in Card 02 (which may show them).
const MULTIPLE_SYSTEM_LOOP_COPY = Object.freeze({
  broad:
    '遇到需要用判断力处理的事 → 你按最顺手的习惯先反应（等一等、按熟路走、或凭感觉下判断） → 同一个习惯被反复调用 → 它在不同场景里结出同一类结果，限制越来越明显 → 结果再次确认了你的做法，于是下次照旧。',
  focused:
    '遇到需要用判断力处理的事 → 你反复用同一个决策习惯先反应 → 这个习惯被一次次重复调用 → 它在不同场景里造成同一类结果 → 结果再次强化了这个习惯，于是下次照旧。',
  fromShort: '按最顺手的习惯自动做决定，很少先停一下确认',
  toShort: '动手前先过一遍同一套固定的决策检查，再决定',
})

// ── §20b V5 MULTIPLE UNIFIED NARRATIVE (Cards 01/02/04/05 for N>=2) ───────
// The unified impact narrative for the MULTIPLE state. USER-CENTERED and
// count-neutral (never a hardcoded numeral), with NO candidate-label list
// (labels belong to Layer 2) and NO engine-meta prose (§12). Each clause is a
// faithful synthesis of the simultaneously-supported directions and stays
// source-backed (the thesis attaches the accepted eligible candidates).
const MULTIPLE_UNIFIED_COPY = Object.freeze({
  fatalInsight: '你不是不够努力，而是几套顺手的判断习惯同时在替你做决定，把很多选择在动念时就收窄了。',
  coreProblem: '你以为每次都只是某件具体的事没处理好，其实是同一套顺手的判断习惯，在不同的事情上反复替你做主。',
  upgradeLead: '与其一次改掉所有方向，不如先建立同一套更稳的决策方式：',
  firstAction: '今天先挑一个方向，只做一件最小、可回退的一步（例如把一个反复搁置的小决定，先做出一个可以反悔的版本）。',
})

// ── §20c V5 MULTIPLE FAMILY THESIS (Cards 01–04 for the FAMILY_GAP family) ──
// When ALL eligible candidates belong to the FRAMEWORK_GAP family (pure
// «思维方式» de-risking: PROBABILITY_MISJUDGMENT / IDENTITY_CONSTRAINT /
// SYSTEM_THINKING_GAP), the shared story is «用固定的身份和直觉代替概率与
// 系统判断». Every clause is a faithful synthesis of the same accepted
// per-candidate semantics (verdict / currentModel / misalignment / strategy):
//   probability → 成或不成、低估基础概率；identity → 用固定角色定义自己；
//   systems → 把问题当独立事件处理。No ranking, no primary, no taxonomy label.
// LANGUAGE LOCK: user-centered, count-neutral, no meta tokens, no label list.
const MULTIPLE_FAMILY_COPY = Object.freeze({
  FRAMEWORK_GAP: Object.freeze({
    fatalInsight: '你不是不够聪明，而是习惯用固定的身份和「成或不成」的直觉，代替了对概率与系统运行的判断。',
    coreProblem: '你以为问题只是某一次判断不准，其实你默认遇到要看概率、看结构的事，都套用同一套身份直觉，同类误判才反复出现。',
    upgradeFrom: '凭固定身份和直觉判断，很少先估计可能性、看结构',
    upgradeTo: '遇到重要判断，先分清这是概率问题还是结构问题，再决定怎么做',
  }),
})

// ── §20e V5 MULTIPLE BREADTH THESIS (Cards 01–04 for BROAD sets) ──────────
// When the eligible candidates span MULTIPLE families, the shared story is
// «同一套顺手的默认反应，在不同广度上反复替你做决定». The breadth is derived
// DETERMINISTICALLY from the accepted synthesis (multipleSynthesis.familyGroups
// + eligibleCandidateIds) — NOT from any label and NOT from a hardcoded count:
//   FOCUSED   = all candidates share ONE family (single-domain habit)
//   NARROW    = 2 families spanned
//   SPREAD    = 3 families spanned
//   WIDE      = >=4 families, low density (candidates ≈ families)
//   PERVASIVE = >=4 families, high density (many candidates per family)
// All copy is user-centered, count-neutral (no numeral), taxonomy-free, and
// non-ranked; every clause restates accepted per-candidate semantics.
const MULTIPLE_BREADTH_COPY = Object.freeze({
  FOCUSED: Object.freeze({
    fatalInsight: '你不是不够努力，而是同一套顺手的反应，在同一类事情上反复替你做了决定。',
    coreProblem: '你以为问题只是某一件事没处理好，其实是你遇到该认真判断的时候，习惯直接交给直觉，没真正权衡一次，同类结果才反复出现。',
    loopScope: '同一类事情上',
    upgradeFrom: '在关键判断上，按最顺手的习惯自动做决定，很少先停一下确认',
    upgradeTo: '动手前先过一遍同一套固定的判断检查，再决定',
  }),
  NARROW: Object.freeze({
    fatalInsight: '你不是不够努力，而是同一套顺手的反应，在少数几个不同的方面替你做了决定。',
    coreProblem: '你以为问题只是某一件具体的事没处理好，其实在这少数几个方面，你遇到该认真判断的时候都直接交给直觉，没真正权衡一次，同类结果才反复出现。',
    loopScope: '少数几个不同的方面',
    upgradeFrom: '在少数几个关键判断上，按最顺手的习惯自动做决定，很少先停一下确认',
    upgradeTo: '动手前先过一遍同一套固定的判断检查，再决定',
  }),
  SPREAD: Object.freeze({
    fatalInsight: '你不是不够努力，而是同一套顺手的反应，在好几个不同的方面替你做了决定。',
    coreProblem: '你以为问题只是某一件具体的事没处理好，其实在这好几个方面，你遇到该认真判断的时候都直接交给直觉，没真正权衡一次，同类结果才反复出现。',
    loopScope: '好几个不同的方面',
    upgradeFrom: '在好几个不同方面，都按最顺手的习惯自动做决定',
    upgradeTo: '先在最常出现的那几个方面，各固定一条判断检查再决定',
  }),
  WIDE: Object.freeze({
    fatalInsight: '你不是不够努力，而是同一套顺手的反应，在很多不同的方面替你做了决定。',
    coreProblem: '你以为问题只是某一件具体的事没处理好，其实在这很多方面，你遇到该认真判断的时候都直接交给直觉，没真正权衡一次，同类结果才反复出现。',
    loopScope: '很多不同的方面',
    upgradeFrom: '在大多数方面，都按最顺手的习惯自动做决定',
    upgradeTo: '先在反复出问题的大多数方面，各固定一条判断检查再决定',
  }),
  PERVASIVE: Object.freeze({
    fatalInsight: '你不是不够努力，而是同一套顺手的反应，几乎在每个方面都替你做了决定。',
    coreProblem: '你以为问题只是某一件具体的事没处理好，其实在几乎所有场景，你遇到该认真判断的时候都直接交给直觉，没真正权衡一次，同类结果才反复出现。',
    loopScope: '几乎所有方面',
    upgradeFrom: '几乎在每个方面，都按最顺手的习惯自动做决定',
    upgradeTo: '把「动手前先过一遍判断检查」变成默认动作，覆盖到几乎每个方面',
  }),
})

// Broad-set system-loop template; the {SCOPE} token is filled from the breadth
// level's loopScope. FOCUSED reuses the frozen focused loop (no scope token).
const MULTIPLE_LOOP_TEMPLATE =
  '遇到需要用判断力处理的事 → 你按最顺手的习惯先反应（等一等、按熟路走、或凭感觉下判断） → 同一个习惯被反复调用 → 它在{SCOPE}结出同一类结果，限制越来越明显 → 结果再次确认了你的做法，于是下次照旧。'

// ── §M2 V5 MULTIPLE CARD 03 — CAUSAL-COMPRESSION SYSTEM_TRAP (N>=2) ───────
// Card 03 for the MULTIPLE state is ONE coherent causal loop COMPRESSED from
// the eligible candidates — NOT a concatenation of per-candidate phrases.
// Each stage fuses the present families into a single natural clause:
//   TRIGGER → JUDGMENT (the interacting habits) → ACTION → CONSEQUENCE
//   → REINFORCEMENT.
// The JUDGMENT stage names the causal layer of each PRESENT family (one terse
// descriptor per family, tiered by the family's own density) — never candidate
// names or symptoms. The REINFORCEMENT stage adds a materially-compounding
// clause ONLY from the candidates whose own mechanism seals a corrective exit.
// Count-neutral, taxonomy-free, non-ranked, no engine-meta, no numeral.
// CAUSAL COMPRESSION (M2): each stage fuses the PRESENT families into ONE
// natural clause via a terse per-family token. No candidate symptom is ever
// enumerated. N9 (extra candidates inside already-present families) is
// differentiated MATERIALLY by the density-sensitive reinforcement clause: a
// candidate whose own mechanism seals a corrective exit (feedback / exposure /
// leverage / identity) adds that sealed exit — not just a scope word.
// Count-neutral, taxonomy-free, non-ranked, no engine-meta, no numeral.
const MULTIPLE_TRAP_COPY = Object.freeze({
  triggerLead: '每当',
  triggerTail: '摆在面前',
  judgmentLead: '你几乎同时亮出老一套：',
  actionLead: '于是',
  consequenceLead: '结果是',
  consequenceTail: '，彼此加固、从不互相纠正',
  reinforceLead: '；一再「没出事」就被当成经验',
  reinforceBaseTail: '，下次照旧',
  reinforceSealedMid: '，连',
  reinforceSealedTail: '这些出口也被封死，循环越发锁死',
  // Per-family causal token for each of the 5 stages. Keyed by the FROZEN
  // familyId. Each token is a faithful compression of that family's accepted
  // candidate semantics (t trigger; h judgment/habit; a action/inaction;
  // c consequence; r reinforcement).
  familyStage: {
    EXECUTION_ADAPTATION_GAP: { t: '要拍板', h: '先想再等等', a: '没真正拍板', c: '信息没进来', r: '更不敢定' },
    RESOURCE_COMPOUNDING_GAP: { t: '要投入', h: '先顾眼前', a: '长期事没排序', c: '复利停着', r: '更没时间' },
    PERCEPTION_RISK_GAP: { t: '见机会', h: '见险先躲', a: '有风险就划掉', c: '机会被放过', r: '更怕风险' },
    FRAMEWORK_GAP: { t: '要判断', h: '老框框定死', a: '只治表面', c: '问题反复回来', r: '更信直觉' },
  },
  // The CORRECTIVE EXIT that a candidate's own mechanism seals shut
  // (source-backed by that candidate's accepted currentModel / worldRule gap).
  exitSeal: {
    FEEDBACK_LOOP_GAP: '复盘',
    OPPORTUNITY_BLINDNESS: '换路试',
    LEVERAGE_MODEL_GAP: '借外力',
    IDENTITY_CONSTRAINT: '跳出身份',
  },
})
// Deterministic presentation order (family span, then exit-seal list).
const MULTIPLE_TRAP_FAMILY_ORDER = Object.freeze([
  'EXECUTION_ADAPTATION_GAP', 'RESOURCE_COMPOUNDING_GAP', 'PERCEPTION_RISK_GAP', 'FRAMEWORK_GAP',
])
const MULTIPLE_TRAP_EXIT_ORDER = Object.freeze([
  'FEEDBACK_LOOP_GAP', 'OPPORTUNITY_BLINDNESS', 'LEVERAGE_MODEL_GAP', 'IDENTITY_CONSTRAINT',
])

/**
 * Compose the MULTIPLE Card 03 causal loop from the accepted eligible set.
 * Pure/deterministic; presentation-only; no engine call. Every stage is a
 * single COMPRESSED clause built from the present families' tokens.
 *
 * @param {object} params
 * @param {Array}  params.families             [{ familyId, count }] (present families)
 * @param {Array}  params.sealingCandidateIds  eligible candidate ids (accepted)
 * @returns {string} the 5-stage loop
 */
function composeMultipleSystemTrap({ families, sealingCandidateIds }) {
  const c = MULTIPLE_TRAP_COPY
  const fams = Array.isArray(families) ? families : []
  const present = []
  for (const fid of MULTIPLE_TRAP_FAMILY_ORDER) {
    const f = fams.find((x) => x && x.familyId === fid)
    if (f && f.count && c.familyStage[fid]) present.push(c.familyStage[fid])
  }
  if (!present.length) return ''
  const eligible = Array.isArray(sealingCandidateIds) ? sealingCandidateIds : []
  const seals = []
  for (const id of MULTIPLE_TRAP_EXIT_ORDER) {
    if (eligible.indexOf(id) !== -1 && c.exitSeal[id]) seals.push(c.exitSeal[id])
  }
  const s1 = c.triggerLead + present.map((p) => p.t).join('、') + c.triggerTail
  const s2 = c.judgmentLead + present.map((p) => p.h).join('、')
  const s3 = c.actionLead + present.map((p) => p.a).join('、')
  const s4 = c.consequenceLead + present.map((p) => p.c).join('，') + c.consequenceTail
  const s5 = present.map((p) => p.r).join('、') + c.reinforceLead
    + (seals.length >= 2 ? c.reinforceSealedMid + seals.join('、') + c.reinforceSealedTail : c.reinforceBaseTail)
  return [s1, s2, s3, s4, s5].join(' → ')
}

// ── §20d V5 UNIQUE CARD 04 — case-specific FROM (was a 9/9 placeholder) ────
// The UNIQUE model shift FROM must name THIS case's accepted userCurrentModel
// (the old decision rule), not a shared placeholder. TO stays the accepted
// upgradedModel.cognitiveUpgrade. Count-neutral, taxonomy-free, no invented
// strategy. Wording is a faithful paraphrase of BLIND_SPOT_CURRENT_MODEL_COPY.
const UNIQUE_UPGRADE_FROM_COPY = Object.freeze({
  OPPORTUNITY_BLINDNESS: '只在熟悉的圈子和已知的路径里找机会',
  FEEDBACK_LOOP_GAP: '凭自己的假设行动，很少主动收集和消化外部反馈',
  DECISION_INERTIA: '等信息足够充分、条件足够成熟才行动',
  RISK_MODEL_DISTORTION: '用「安全还是危险」的单一尺度看风险',
  PROBABILITY_MISJUDGMENT: '用「能成还是不能成」判断一件事',
  IDENTITY_CONSTRAINT: '用「我是做什么的」来定义自己',
  LEVERAGE_MODEL_GAP: '一份时间换一份产出',
  SYSTEM_THINKING_GAP: '把问题当作一件件独立的事件来处理',
  TIME_HORIZON_TRAP: '优先处理立刻见效的事',
})

// ── §21 V5 ACTION PLAN — concrete, executable (FIRST_ACTION within 24–48h) ─
// Keyed by strategyId. The FIRST step is deliberately small, bounded and doable
// within a day or two (it is the strategy's first frozen experimentTemplate,
// which is by design the minimal first action). No generic self-help, no
// numeral, no fortune telling. Supporting steps are the remaining frozen
// experiment templates of the SAME authoritative strategy.
// NOTE: the concrete per-strategy action copy reuses STRATEGY_EXPERIMENT_COPY
// (source of truth); this block only supplies the MULTIPLE state's concrete
// first action, which has no single authoritative strategy.

// Family label localization (keyed by the frozen familyId). Used by the
// MULTIPLE synthesis so the user sees a plain-language tension class.
const FAMILY_LABEL_COPY = Object.freeze({
  EXECUTION_ADAPTATION_GAP: '行动与学习',
  RESOURCE_COMPOUNDING_GAP: '资源与复利',
  PERCEPTION_RISK_GAP: '感知与风险',
  FRAMEWORK_GAP: '思维方式',
})

// ── Getters ────────────────────────────────────────────────────────────────
function getBlindSpotLabel(blindSpotId) {
  return BLIND_SPOT_LABEL_COPY[blindSpotId] || null
}
function getMultipleStateCopy() {
  return MULTIPLE_STATE_COPY
}
function getMultipleObservation(blindSpotId) {
  return MULTIPLE_OBSERVATION_COPY[blindSpotId] || null
}
function getMultipleImpactCopy() {
  return MULTIPLE_IMPACT_COPY
}
function getMultipleActionCopy() {
  return MULTIPLE_ACTION_COPY
}
function getFamilyLabel(familyId) {
  return FAMILY_LABEL_COPY[familyId] || null
}
function getSystemLoop(principleId) {
  return SYSTEM_LOOP_COPY[principleId] || null
}
function getMultipleSystemLoopCopy() {
  return MULTIPLE_SYSTEM_LOOP_COPY
}
function getMultipleUnifiedCopy() {
  return MULTIPLE_UNIFIED_COPY
}
function getMultipleFamilyCopy(familyId) {
  return MULTIPLE_FAMILY_COPY[familyId] || null
}
function getMultipleBreadthCopy(level) {
  return MULTIPLE_BREADTH_COPY[level] || null
}
function getMultipleLoopTemplate() {
  return MULTIPLE_LOOP_TEMPLATE
}
function getMultipleTrapCopy() {
  return MULTIPLE_TRAP_COPY
}
function getUniqueUpgradeFrom(blindSpotId) {
  return UNIQUE_UPGRADE_FROM_COPY[blindSpotId] || null
}
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
  BLIND_SPOT_LABEL_COPY,
  MULTIPLE_STATE_COPY,
  MULTIPLE_OBSERVATION_COPY,
  MULTIPLE_IMPACT_COPY,
  MULTIPLE_ACTION_COPY,
  SYSTEM_LOOP_COPY,
  MULTIPLE_SYSTEM_LOOP_COPY,
  MULTIPLE_UNIFIED_COPY,
  MULTIPLE_FAMILY_COPY,
  MULTIPLE_BREADTH_COPY,
  MULTIPLE_LOOP_TEMPLATE,
  MULTIPLE_TRAP_COPY,
  composeMultipleSystemTrap,
  UNIQUE_UPGRADE_FROM_COPY,
  FAMILY_LABEL_COPY,
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
  getBlindSpotLabel,
  getMultipleStateCopy,
  getMultipleObservation,
  getMultipleImpactCopy,
  getMultipleActionCopy,
  getFamilyLabel,
  getSystemLoop,
  getMultipleSystemLoopCopy,
  getMultipleUnifiedCopy,
  getMultipleFamilyCopy,
  getMultipleBreadthCopy,
  getMultipleLoopTemplate,
  getMultipleTrapCopy,
  composeMultipleSystemTrap,
  getUniqueUpgradeFrom,
}
