/**
 * engine/worldModel/legacyDiagnosisAdapter.js
 *
 * Adapts World Model diagnosis output to legacy RC8 format for backward
 * compatibility with existing Runtime, Poster, Cache, and History.
 *
 * RC8.3 010: Chinese localization + client compatibility fields.
 *
 * @version world_model_v1
 */

var { normalizePotentialIndex } = require('../../config/reportUtils')

// Archetype label mapping
var ARCHETYPE_LABEL_MAP = { EXPLORER: '探索者', BUILDER: '构建者', OPERATOR: '执行者', STRATEGIST: '战略者', GUARDIAN: '守成者', CONNECTOR: '连接者', OPTIMIZER: '优化者' }

// Blind Spot → Legacy Bottleneck
var BLIND_SPOT_TO_BOTTLENECK = {
  OPPORTUNITY_BLINDNESS: { id: 'OPPORTUNITY_BLINDNESS', label: '机会识别盲区', description: '当前认知模型限制了机会的发现和评估能力' },
  FEEDBACK_LOOP_GAP: { id: 'FEEDBACK_LOOP_GAP', label: '反馈回路断裂', description: '缺乏有效的外部反馈机制来校准决策和行动' },
  DECISION_INERTIA: { id: 'DECISION_INERTIA', label: '决策惯性', description: '在不确定条件下倾向于延迟行动而非小步实验' },
  RISK_MODEL_DISTORTION: { id: 'RISK_MODEL_DISTORTION', label: '风险认知偏差', description: '风险感知与实际概率之间存在系统性偏离' },
  PROBABILITY_MISJUDGMENT: { id: 'PROBABILITY_MISJUDGMENT', label: '概率判断偏差', description: '用二元思维评估复杂多因素系统' },
  IDENTITY_CONSTRAINT: { id: 'IDENTITY_CONSTRAINT', label: '身份边界锁定', description: '自我认知被当前角色固限，限制了可能性探索' },
  LEVERAGE_MODEL_GAP: { id: 'LEVERAGE_MODEL_GAP', label: '杠杆意识缺失', description: '产出增长过度依赖线性投入，缺乏放大机制' },
  SYSTEM_THINKING_GAP: { id: 'SYSTEM_THINKING_GAP', label: '系统思维缺口', description: '倾向于处理孤立事件而非识别底层系统结构' },
  TIME_HORIZON_TRAP: { id: 'TIME_HORIZON_TRAP', label: '时间视野局限', description: '紧急事务持续挤压重要事务的空间' },
}

// ── 010: Chinese localization tables ──

var BLIND_SPOT_MECHANISM_ZH = {
  OPPORTUNITY_BLINDNESS: '认知框架限制了对潜在机会的识别，固化的判断模式过滤掉了不符合既有认知的可能性信号',
  FEEDBACK_LOOP_GAP: '决策与行动之间缺乏有效的反馈校准机制，真实世界的信息未能及时修正认知假设',
  DECISION_INERTIA: '在信息不完整的情况下倾向于延迟决策，等待更多确定性而非通过小步实验获取真实反馈',
  RISK_MODEL_DISTORTION: '风险感知系统与实际概率分布存在偏差，放大了低概率负面事件的心理权重',
  PROBABILITY_MISJUDGMENT: '倾向于用二元对立的判断方式评估复杂的多因素系统，忽略了期望值的计算与综合评估',
  IDENTITY_CONSTRAINT: '自我认知被当前职业角色所固限，将"我能做什么"窄化为"我这个角色该做什么"',
  LEVERAGE_MODEL_GAP: '产出模式高度依赖直接的线性投入，未建立可复制、可放大的系统性价值创造机制',
  SYSTEM_THINKING_GAP: '注意力集中在孤立的事件层面，而非识别事件背后的底层系统结构和反馈回路',
  TIME_HORIZON_TRAP: '紧急事务持续压缩重要事务的空间，短期压力占据了长期价值创造的资源和注意力',
}

var BLIND_SPOT_WHY_ZH = {
  OPPORTUNITY_BLINDNESS: '因为你习惯在熟悉的框架内判断"可能"和"不可能"，但真正有意义的突破往往出现在你目前看不到的盲区内',
  FEEDBACK_LOOP_GAP: '因为你依赖自己的判断来评估决策质量，但缺少外部反馈的校准，认知偏差会持续累积',
  DECISION_INERTIA: '因为等待完美信息的成本远高于从实验中学习的成本，而最佳时机往往是"现在就开始"',
  RISK_MODEL_DISTORTION: '因为你正在用放大的恐惧感而非真实概率来评估风险，这导致许多可逆的低成本尝试被排除',
  PROBABILITY_MISJUDGMENT: '因为你把复杂的多因素系统简化成了"对还是错"，忽略了升级思维模型后可以看到的更多路径',
  IDENTITY_CONSTRAINT: '因为你把自己的可能性等同于当前的身份标签，但事实上你的能力可以跨越多个领域',
  LEVERAGE_MODEL_GAP: '因为你当前的产出公式是"更多时间等于更多结果"，而这个公式存在天然上限',
  SYSTEM_THINKING_GAP: '因为你习惯了解决眼前的问题，却没有意识到这些问题是系统的产物而非独立的偶然事件',
  TIME_HORIZON_TRAP: '因为紧急的事会一直出现，如果不主动为重要的事留出空间，它们永远不会自动排上日程',
}

var STRATEGY_LABEL_ZH = {
  // v2 keys (strategyDefinitions.js)
  EXPAND_IDENTITY_BOUNDARY: '扩展身份边界',
  UPGRADE_PROBABILITY_THINKING: '升级概率思维',
  EXTEND_TIME_HORIZON: '延伸时间视野',
  BUILD_FEEDBACK_LOOP: '建立反馈回路',
  INCREASE_EXPERIMENT_RATE: '提高实验密度',
  BUILD_DECISION_SYSTEM: '建立决策系统',
  BUILD_LEVERAGE_MODEL: '建立杠杆意识',
  EXPAND_OPTIONALITY: '扩展可选择性',
  REFRAME_RISK_MODEL: '重构风险认知',
  // v1 aliases (retained for compatibility)
  BUILD_SYSTEMATIC_EXPERIMENTATION: '建立系统化实验习惯',
  DEVELOP_FEEDBACK_LOOPS: '构建反馈回路',
  CALIBRATE_RISK_PERCEPTION: '校准风险感知',
  BROADEN_OPPORTUNITY_EXPOSURE: '拓宽机会视野',
  INCREASE_LEVERAGE_AWARENESS: '提升杠杆认知',
  STRENGTHEN_SYSTEM_THINKING: '强化系统思维',
}

var COGNITIVE_UPGRADE_ZH = {
  // v2 keys (strategyDefinitions.js)
  EXPAND_IDENTITY_BOUNDARY: '从"我是某种职业的人"升级到"我拥有这些能力，可以在多个领域创造价值"',
  UPGRADE_PROBABILITY_THINKING: '从"这个能不能做"升级到"做这件事的期望收益是多少，我愿意承担什么不确定性"',
  EXTEND_TIME_HORIZON: '从"今天必须要做"升级到"今天做一件让三个月后的自己感激的事"',
  BUILD_FEEDBACK_LOOP: '从"假设-行动-猜测结果"升级到"假设-低成本实验-真实反馈-调整假设"',
  INCREASE_EXPERIMENT_RATE: '从"准备充分再行动"升级到"用最小的成本最快的速度获得真实反馈，让行动驱动学习"',
  BUILD_DECISION_SYSTEM: '从"每次重新想怎么办"升级到"建立可复用的决策框架，让今天的决策为明天的决策创造更好的条件"',
  BUILD_LEVERAGE_MODEL: '从"一份时间换一份回报"升级到"识别并用好杠杆——系统、知识、分发——让一份投入产生多份回报"',
  EXPAND_OPTIONALITY: '从"找到一条最好的路"升级到"同时培育多个可能路径，让时间带来更多信息后再做选择"',
  REFRAME_RISK_MODEL: '从"避免所有风险"升级到"评估风险大小、可逆性和上行空间，为可逆风险果断行动"',
  // v1 aliases (retained for compatibility)
  BUILD_SYSTEMATIC_EXPERIMENTATION: '从"等想清楚再做"升级到"先做一个小实验看看真实反馈"',
  DEVELOP_FEEDBACK_LOOPS: '从"自己判断对不对"升级到"用真实世界的数据来判断对不对"',
  CALIBRATE_RISK_PERCEPTION: '从"这个有风险所以不做"升级到"这个风险是否可控，不可逆代价是什么"',
  BROADEN_OPPORTUNITY_EXPOSURE: '从"我只关注熟悉的领域"升级到"定期接触新的可能性，用真实反馈筛选"',
  INCREASE_LEVERAGE_AWARENESS: '从"我花了多少时间就得到多少结果"升级到"这个成果可以被复制和放大多少次"',
  STRENGTHEN_SYSTEM_THINKING: '从"这个问题怎么解决"升级到"这个系统为什么会产生这个问题"',
}

var FIRST_EXPERIMENT_ZH = {
  // v2 keys (strategyDefinitions.js)
  EXPAND_IDENTITY_BOUNDARY: '在当前职业身份之外做一件小的输出——写一篇短文章、录一段视频、或者提供一次无偿咨询。重点不是质量，而是体验"我也可以做不同的事"的感觉',
  UPGRADE_PROBABILITY_THINKING: '下一次面临选择时，写下三个可能的走向和每个走向发生的概率，然后做一件能用一个周末完成的小实验来获取真实反馈',
  EXTEND_TIME_HORIZON: '每天早上拿出一小时，不处理紧急事务，只做一件对三个月后的自己有明确价值的事情',
  BUILD_FEEDBACK_LOOP: '选一个最近做的决策，找三个不依赖自我判断的外部信息源——客观数据、非亲友的他人反馈、真实结果记录——来检验这个决策的依据是否站得住脚',
  INCREASE_EXPERIMENT_RATE: '找一个想了很久但没动手的方向，在接下来一周内完成两次最小版本实验——每次只需几小时，目标不是做对而是快速获取真实反馈，记录每次学到的东西',
  BUILD_DECISION_SYSTEM: '为接下来一周的主要决策建一个简单记录：写下来你要决定什么、选择理由和预期结果，一周后对照真实结果，看哪里判断准确、哪里出了偏差',
  BUILD_LEVERAGE_MODEL: '盘点过去一个月的产出，标记出可以重复使用的部分——一个模板、一个流程、一个方法论——把它整理成下一次可以零成本调用的形式，观察复用效果',
  EXPAND_OPTIONALITY: '写下当前面临的一个选择，然后强迫自己写出五个原本没想到的替代方案——质量不重要，数量优先——两周后回看是否有之前忽略的可行路径',
  REFRAME_RISK_MODEL: '列出三个因为"有风险"而一直没做的事，对每一个分析：最坏情况是什么、是否可以逆转、实际发生概率有多高，选可逆性最高的一件，一周内迈出第一步',
  // v1 aliases (retained for compatibility)
  BUILD_SYSTEMATIC_EXPERIMENTATION: '找一个想了很久但没动手的方向，在48小时内完成它的最简单版本，把它拿出来给三个人看并收集反馈',
  DEVELOP_FEEDBACK_LOOPS: '找一件你最近做的决策，不依靠自己的判断，找三个外部信息来源来验证你的决策依据是否正确',
  CALIBRATE_RISK_PERCEPTION: '列出三个你因为"有风险"而一直没做的事，对每一个分析最坏情况、是否可逆、发生概率，选风险最低的一件，一周内迈出第一步',
  BROADEN_OPPORTUNITY_EXPOSURE: '接下来两周，接触三个你完全不熟悉的领域——读一本不同行业的书、和一个不同背景的人深聊、参加一个从未去过的活动，记录三条新线索',
  INCREASE_LEVERAGE_AWARENESS: '盘点过去一个月的产出，标记哪些可以重复使用，选一个做成模板或流程，让下一次复用成本接近零',
  STRENGTHEN_SYSTEM_THINKING: '找一个反复遇到的问题，画一张系统图：问题从哪里来、驱动力量有哪些、为什么之前的方案没有持久解决',
}

var SUCCESS_SIGNAL_ZH = {
  // v2 keys (strategyDefinitions.js)
  EXPAND_IDENTITY_BOUNDARY: '你可以自然地用能力描述自己，而非仅用职业称谓',
  UPGRADE_PROBABILITY_THINKING: '做决策时不再只问成不成，会自然地评估可能性和期望值',
  EXTEND_TIME_HORIZON: '每天优先安排对长期有价值的事情，而非被紧急事务填满',
  BUILD_FEEDBACK_LOOP: '你的核心决策中至少有一个关键假设被外部真实反馈修正过',
  INCREASE_EXPERIMENT_RATE: '面对不确定的事情，你的第一反应是"先做个小实验看反馈"，而不是"等想清楚再说"',
  BUILD_DECISION_SYSTEM: '你做决策时有可追溯的思考记录，回顾时能清晰看到哪些判断模式在持续改善',
  BUILD_LEVERAGE_MODEL: '同样的时间投入，你产出的成果可以在多个场景被重复利用',
  EXPAND_OPTIONALITY: '面对问题时，你自然能想到多个不同方向的解决方案，而非只有一个',
  REFRAME_RISK_MODEL: '你能清晰区分可逆和不可逆风险，并据此做出不同的行动策略',
  // v1 aliases (retained for compatibility)
  BUILD_SYSTEMATIC_EXPERIMENTATION: '遇到不确定的事情，你的第一反应是"先试试"，而不是"先想清楚"',
  DEVELOP_FEEDBACK_LOOPS: '你的决策依据中，外部数据占比显著提高',
  CALIBRATE_RISK_PERCEPTION: '你能够清晰区分可逆风险和不可逆风险，并据此做出不同的行动策略',
  BROADEN_OPPORTUNITY_EXPOSURE: '你定期接触到以前不知道的可能性，并在其中做了有意义的尝试',
  INCREASE_LEVERAGE_AWARENESS: '你花了同样时间，但产出的价值可以被更多人重复使用',
  STRENGTHEN_SYSTEM_THINKING: '面对问题时，你首先问"这个系统出了什么问题"，而非"谁出了什么问题"',
}

var STOP_CONDITION_ZH = {
  // v2 keys (strategyDefinitions.js)
  EXPAND_IDENTITY_BOUNDARY: '你已经在至少一个非职业身份的领域做出了有市场反馈的尝试',
  UPGRADE_PROBABILITY_THINKING: '你在做决策时能自然地想到"这里有几种可能"而不只是"能不能做"',
  EXTEND_TIME_HORIZON: '你的时间分配表上，非紧急重要事务占比超过百分之四十',
  BUILD_FEEDBACK_LOOP: '你拥有至少三个稳定运转的外部反馈来源，核心决策不再依赖未经检验的假设',
  INCREASE_EXPERIMENT_RATE: '你连续四周每周至少完成两个完整的实验-反馈-调整闭环，且不需要外部推动',
  BUILD_DECISION_SYSTEM: '你的决策日志覆盖了至少四周的主要选择，复盘显示判断偏差在持续收窄',
  BUILD_LEVERAGE_MODEL: '你有一个可重复使用的产出系统，已在至少两个不同场景中被独立验证',
  EXPAND_OPTIONALITY: '你在不止一个原先陌生的领域发现了有价值的可行路径，并拥有初步的真实证据',
  REFRAME_RISK_MODEL: '你能够清晰区分面临风险中哪些是可逆的、哪些是不可逆的，并用预期价值和可逆性而非恐惧来做风险决策',
  // v1 aliases (retained for compatibility)
  BUILD_SYSTEMATIC_EXPERIMENTATION: '你连续四周每周至少有一个完整的小实验闭环',
  DEVELOP_FEEDBACK_LOOPS: '你有至少三个稳定运转的外部信息来源持续为你的核心决策提供反馈',
  CALIBRATE_RISK_PERCEPTION: '你对风险有了更细致的分类，并能区分心理恐惧与真实概率',
  BROADEN_OPPORTUNITY_EXPOSURE: '你在两个以上原先陌生的领域找到了可执行的切入点',
  INCREASE_LEVERAGE_AWARENESS: '你有一个可重复使用的产出模板，已经被至少两方独立使用过',
  STRENGTHEN_SYSTEM_THINKING: '你能清晰地画出一个困扰你很久的问题的系统循环图',
}

// ── 010: Chinese severity, stage labels ──

var SEVERITY_LABEL_ZH = { high: '高', medium: '中', low: '低' }
var WM_WEALTH_STAGE_ZH = { EXPLORER: '探索期', GUARDIAN: '稳定期', BUILDER: '建设期', STRATEGIST: '策略期', OPTIMIZER: '优化期', CONNECTOR: '连接期', OPERATOR: '执行期' }

// ═══════════════════════════════════════════════════════════════
// Main adapter
// ═══════════════════════════════════════════════════════════════

function adaptWorldModelToLegacyDiagnosis(worldModelDiagnosis) {
  if (!worldModelDiagnosis || worldModelDiagnosis.version !== 'world_model_v1') {
    return { worldModelDiagnosis: worldModelDiagnosis, legacyDiagnosisAdapter: null, adapterError: 'INVALID_WORLD_MODEL_VERSION' }
  }

  var wm = worldModelDiagnosis
  var archetype = wm.cognitiveArchetype || {}
  var blindSpot = wm.cognitiveBlindSpot || {}
  var strategy = wm.worldStrategy || {}
  var scenarios = wm.scenarioSimulation || {}
  var worldModel = wm.worldModel || {}

  var legacyDiagnosis = {
    engineVersion: 'RC8.3_LEGACY_ADAPTER',
    diagnosticVersion: 'v4',
    behaviorTags: buildLegacyBehaviorTags(wm.behaviorSignals || []),
    wealthProfile: buildLegacyWealthProfile(archetype),
    bottleneck: buildLegacyBottleneck(blindSpot),
    strategy: buildLegacyStrategy(strategy),
    rInc001Status: 'BACKGROUND_ONLY',
  }

  var legacyReport = buildLegacyReport(blindSpot, strategy, archetype, scenarios, worldModel, wm.behaviorSignals || [], wm)

  return {
    worldModelDiagnosis: worldModelDiagnosis,
    legacyDiagnosisAdapter: {
      diagnosis: legacyDiagnosis,
      report: legacyReport,
      adapterVersion: '1.1',
      adaptedAt: new Date().toISOString(),
      note: 'RC8.3 adapter with Chinese localization + client compatibility fields',
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// Legacy object builders
// ═══════════════════════════════════════════════════════════════

function buildLegacyBehaviorTags(behaviorSignals) {
  return behaviorSignals.filter(function(s) { return s.state === 'ACTIVE' || s.state === 'WEAK' }).slice(0, 10).map(function(s) {
    return { id: s.id, label: s.id, weight: Math.round(s.score * 100), category: s.dimension, signal: s.score > 0.6 ? 'POSITIVE' : 'NEUTRAL' }
  })
}

function buildLegacyWealthProfile(archetype) {
  return {
    primary: archetype.primary || 'UNDETERMINED',
    primaryTitle: ARCHETYPE_LABEL_MAP[archetype.primary] || archetype.primary || '待识别',
    secondary: archetype.secondary || 'UNDETERMINED',
    confidence: Math.round((archetype.confidence || 0.35) * 100) / 100,
    primaryTraits: archetype.primaryTraits || [],
    primaryTagline: (archetype.primaryTraits || []).slice(0, 2).join('、'),
  }
}

function buildLegacyBottleneck(blindSpot) {
  var mapping = BLIND_SPOT_TO_BOTTLENECK[blindSpot.id]
  if (!mapping) return { id: blindSpot.id || 'UNKNOWN', label: blindSpot.label || '', confidence: 0.3 }
  return { id: mapping.id, label: mapping.label, description: mapping.description, confidence: Math.round(blindSpot.confidence * 100) / 100, solution: strategyToLegacySolution(blindSpot.id) }
}

function buildLegacyStrategy(strategy) {
  var sid = strategy.id || ''
  return {
    id: sid || 'UNDETERMINED',
    strategyLabel: STRATEGY_LABEL_ZH[sid] || strategy.label || '',
    strategyTagline: STRATEGY_LABEL_ZH[sid] || strategy.label || '',
    confidence: Math.round((strategy.confidence || 0.35) * 100) / 100,
    day1Mission: FIRST_EXPERIMENT_ZH[sid] || (strategy.firstExperiment || {}).description || '开始第一步认知实验',
    milestones: [ FIRST_EXPERIMENT_ZH[sid] || '第一步', SUCCESS_SIGNAL_ZH[sid] || strategy.successSignal || '验证认知升级信号', STOP_CONDITION_ZH[sid] || strategy.stopCondition || '达成认知升级目标' ],
    duration: strategy.reviewWindow || '4周',
    tagline: COGNITIVE_UPGRADE_ZH[sid] || strategy.cognitiveUpgrade || '',
  }
}

function buildLegacyReport(blindSpot, strategy, archetype, scenarios, worldModel, behaviorSignals, wmDiagnosis) {
  var bsId = blindSpot.id || ''
  var strategyId = strategy.id || ''
  var overall = Math.min(90, Math.round((blindSpot.confidence || 0.35) * 60 + 25))
  var sup = buildComputedScores(overall)
  var firstExp = STRATEGY_LABEL_ZH[strategyId] || strategy.label || ''
  var archLabel = ARCHETYPE_LABEL_MAP[archetype.primary] || '待识别'
  var stageLabel = WM_WEALTH_STAGE_ZH[archetype.primary] || '认知期'
  var mechLabel = BLIND_SPOT_MECHANISM_ZH[bsId] || blindSpot.mechanism || ''
  var whyLabel = BLIND_SPOT_WHY_ZH[bsId] || blindSpot.whyItMatters || ''
  var stratLabel = STRATEGY_LABEL_ZH[strategyId] || strategy.label || ''
  var upgradeLabel = COGNITIVE_UPGRADE_ZH[strategyId] || strategy.cognitiveUpgrade || ''
  var day1Goal = FIRST_EXPERIMENT_ZH[strategyId] || ((strategy.firstExperiment || {}).description || '开始第一步')
  var successSignal = SUCCESS_SIGNAL_ZH[strategyId] || strategy.successSignal || ''
  var stopCond = STOP_CONDITION_ZH[strategyId] || strategy.stopCondition || ''

  return {
    _renderSource: 'world_model_legacy_adapter',
    _version: 'RC8.3_adapter_010',
    headline: { title: (BLIND_SPOT_TO_BOTTLENECK[bsId] || {}).label || '认知诊断', subtitle: archLabel + ' · ' + stratLabel },
    wealthStage: WM_WEALTH_STAGE_ZH[archetype.primary] || 'STABLE',
    fatalDiagnosis: { mainProblem: mechLabel, reason: whyLabel, severity: 'high', confidence: blindSpot.confidence || 0.35 },
    scoreCard: sup.scoreCard,
    wealthProbability: sup.wealthProbability,
    potentialIndex: sup.potentialIndex,
    wealthPath: [{ name: stratLabel + '路径', recommend: 'recommended', score: Math.round((strategy.confidence || 0.35) * 100), reason: '基于认知模型诊断的推荐方向' }],
    actionPlan: {
      day1: { goal: day1Goal, tasks: [day1Goal], checkpoint: '完成第一步认知实验' },
      day7: { goal: '在真实环境中验证第一步实验的反馈，调整行动方向', tasks: ['收集并分析反馈', '根据反馈调整下一步'], checkpoint: '收到至少一条有效反馈' },
      day30: { goal: stopCond || '建立新的认知习惯', tasks: ['复盘实验历程和数据', '固化有效的行为模式'], checkpoint: '评估认知升级效果' },
    },
    stopDoing: { priority: 'MEDIUM', items: ['暂停与当前认知盲区修复无关的方向探索', '避免在没有实验验证的情况下投入大量资源'] },
    identityUpgrade: {
      current: archLabel + '——当前认知模式',
      target: upgradeLabel || '认知系统升级',
      bridge: day1Goal || '迈出第一步实验',
    },
    finalStrike: successSignal || '你已经迈出了认知升级的关键一步',
    // ── 010: Client compatibility fields ──
    fatalRules: buildFatalRules(bsId, blindSpot),
    advantageRules: buildAdvantageRules(archetype, worldModel, behaviorSignals),
    opportunityRules: buildOpportunityRules(strategyId, worldModel, scenarios),
    destinySimulator: buildDestinySimulator(scenarios, worldModel, bsId, strategyId),
    cognitiveVerdict: buildCognitiveVerdict(bsId, strategyId, blindSpot, strategy, archetype),
    version: 'RC8.3',
    engineVersion: 'RC8.3_LEGACY_ADAPTER',
    generatedAt: new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════
// 010: Client compatibility field builders
// ═══════════════════════════════════════════════════════════════

function buildFatalRules(bsId, blindSpot) {
  var bottleneck = BLIND_SPOT_TO_BOTTLENECK[bsId]
  return [{
    ruleId: bsId || 'UNKNOWN',
    title: (bottleneck || {}).label || '认知障碍',
    description: BLIND_SPOT_MECHANISM_ZH[bsId] || blindSpot.mechanism || '',
    weight: Math.round((blindSpot.confidence || 0.35) * 100),
    why: BLIND_SPOT_WHY_ZH[bsId] || blindSpot.whyItMatters || '',
  }]
}

function buildAdvantageRules(archetype, worldModel, behaviorSignals) {
  var rules = []
  if (archetype && archetype.primary) {
    rules.push({
      ruleId: 'ADV_' + (archetype.primary || 'UNKNOWN'),
      title: ARCHETYPE_LABEL_MAP[archetype.primary] + '型认知优势',
      description: '以' + (ARCHETYPE_LABEL_MAP[archetype.primary] || '当前') + '的思维模式为基础，你拥有可被激活的认知能力储备',
      weight: Math.round((archetype.confidence || 0.35) * 100),
    })
  }
  if (worldModel) {
    var dims = worldModel
    var highest = ''
    var highestVal = 0
    for (var k in dims) { if (k !== '_meta' && typeof dims[k] === 'number' && dims[k] > highestVal) { highest = k; highestVal = dims[k] } }
    if (highest) {
      var dimLabels = { identity: '身份认知维度', feedback: '反馈敏感度', risk: '风险评估能力', opportunity: '机会识别力', leverage: '杠杆意识', time: '时间管理', probability: '概率思维', execution: '执行稳定度' }
      rules.push({ ruleId: 'ADV_DIM_' + highest, title: (dimLabels[highest] || highest) + '是当前的相对优势维度', weight: Math.round(highestVal * 100) })
    }
  }
  return rules
}

function buildOpportunityRules(strategyId, worldModel, scenarios) {
  var rules = []
  if (strategyId) {
    var exp = FIRST_EXPERIMENT_ZH[strategyId]
    if (exp) {
      rules.push({ area: '认知升级', reason: '完成第一步实验后，你的认知模型将获得第一个外部数据驱动的校准点，这是新可能性出现的前置条件', sourceRuleId: strategyId })
    }
  }
  return rules
}

function buildDestinySimulator(scenarios, worldModel, bsId, strategyId) {
  var currentScenario = scenarios.currentModelScenario || {}
  var upgradedScenario = scenarios.upgradedModelScenario || {}
  return {
    currentModelContinues: {
      label: '维持当前认知模型的长期推演',
      description: BLIND_SPOT_MECHANISM_ZH[bsId] || '当前认知模式持续运转',
      signalTrend: (currentScenario.signalTrend || 'stable'),
      confidence: (currentScenario.confidence || 0.3),
    },
    worldModelUpgraded: {
      label: '完成认知升级后的可能性空间',
      description: '当你逐步突破' + ((BLIND_SPOT_TO_BOTTLENECK[bsId] || {}).label || '当前障碍') + '，新的认知框架将为你打开之前不可见的选择空间',
      signalTrend: (upgradedScenario.signalTrend || 'improving'),
      confidence: (upgradedScenario.confidence || 0.5),
    },
    note: '这不是预测——这是两种认知模型下的行为推演。你在今天做的每一个实验都在改变推演的结果。',
  }
}

function buildCognitiveVerdict(bsId, strategyId, blindSpot, strategy, archetype) {
  var bottleneck = BLIND_SPOT_TO_BOTTLENECK[bsId] || {}
  var archLabel = ARCHETYPE_LABEL_MAP[(archetype || {}).primary] || '当前'
  var severity = SEVERITY_LABEL_ZH[(blindSpot.confidence > 0.6 ? 'high' : (blindSpot.confidence > 0.35 ? 'medium' : 'low'))] || '中'
  return {
    summary: '你当前处于' + archLabel + '型认知模式，主要认知升级方向为突破' + (bottleneck.label || '认知障碍') + '，严重程度：' + severity,
    recommendedStrategy: STRATEGY_LABEL_ZH[strategyId] || (strategy || {}).label || '定向认知升级',
    expectedOutcome: '经过第一步实验和系统化的认知练习，你的认知模型将在' + ((COGNITIVE_UPGRADE_ZH[strategyId] || '以下方面') + '获得可测量的提升'),
    confidence: (blindSpot.confidence || strategy.confidence || 0.35),
    note: '此判断基于世界模型对当前行为信号的确定性分析，不包含预测成分',
  }
}

// ═══════════════════════════════════════════════════════════════
// Score computation
// ═══════════════════════════════════════════════════════════════

function buildComputedScores(overall) {
  var base = Math.round(overall * 0.7)
  return {
    scoreCard: {
      cashflow: Math.min(90, base + 5), skill: Math.min(90, base + 15), execution: Math.min(90, base + 10),
      time: Math.min(90, base + 10), risk: Math.min(90, Math.round(base * 0.8)), overall: overall,
    },
    wealthProbability: normalizePotentialIndex({ today: overall - 10, after30: overall, after90: overall + 10, after365: overall + 20 }),
    potentialIndex: normalizePotentialIndex({ today: overall - 10, after30: overall, after90: overall + 10, after365: overall + 20 }),
  }
}

function strategyToLegacySolution(blindSpotId) {
  var solutions = {
    OPPORTUNITY_BLINDNESS: '扩展认知边界，增加对多样化可能性的接触和评估',
    FEEDBACK_LOOP_GAP: '建立从行动到反馈的最短路径，用真实世界验证假设',
    DECISION_INERTIA: '降低决策门槛，用小成本实验替代等待完美信息',
    RISK_MODEL_DISTORTION: '校准风险感知，区分可逆和不可逆风险，做出知情决策',
    PROBABILITY_MISJUDGMENT: '升级概率思维，从二元判断转向期望值评估',
    IDENTITY_CONSTRAINT: '突破身份边界，用能力而非角色定义自我',
    LEVERAGE_MODEL_GAP: '建立杠杆意识，从线性投入转向可复制的系统化产出',
    SYSTEM_THINKING_GAP: '培养系统思维，从解决症状转向优化底层结构',
    TIME_HORIZON_TRAP: '延伸时间视野，为真正重要的事分配不可侵犯的时间',
  }
  return solutions[blindSpotId] || '基于世界模型诊断的定向认知升级'
}

module.exports = { adaptWorldModelToLegacyDiagnosis, ARCHETYPE_LABEL_MAP, BLIND_SPOT_TO_BOTTLENECK }
