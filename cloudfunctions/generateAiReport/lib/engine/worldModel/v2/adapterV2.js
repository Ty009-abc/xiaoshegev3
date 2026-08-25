/**
 * engine/worldModel/v2/adapterV2.js
 *
 * World Model v2 — client-contract adapter + Chinese localization.
 * All user-visible natural language is Chinese. Old v1 report fields that
 * carry master-spec-incompatible semantics are produced as compatibility-only
 * (they never feed back into v2 inference).
 *
 * @version world_model_v2
 */

const { BLIND_SPOT_DEFINITIONS_V2 } = require('./blindSpotEngineV2')
const { getStrategyById } = require('../strategyDefinitions')

// Chinese strategy localization (frozen). Mirrors the master-spec semantics.
const STRATEGY_ZH_V2 = Object.freeze({
  BUILD_FEEDBACK_LOOP: { label: '建立反馈回路', first: '选一个最近做的决策，找三个不依赖自我判断的外部信息源来检验依据是否站得住脚', success: '你的核心决策中至少有一个关键假设被外部真实反馈修正过', stop: '反馈回路开始持续产生校准数据，不再依赖未经检验的假设' },
  INCREASE_EXPERIMENT_RATE: { label: '提高实验密度', first: '找一个想了很久但没动手的方向，一周内完成两次最小版本实验', success: '面对不确定的事，你的第一反应是"先做个小实验看反馈"', stop: '实验节奏已内化为习惯，不再需要外部督促' },
  BUILD_DECISION_SYSTEM: { label: '建立决策系统', first: '为接下来一周的主要决策建一个简单记录，一周后对照真实结果', success: '你的决策有可追溯的思考记录，判断模式在持续改善', stop: '拥有可重复的决策流程，持续产生复利式改善' },
  BUILD_LEVERAGE_MODEL: { label: '建立杠杆意识', first: '盘点过去一个月的产出，把可复用的部分整理成模板或流程', success: '同样的时间投入，成果可以在多个场景被重复利用', stop: '日常工作中主动寻找和运用杠杆，而非默认线性投入' },
  EXPAND_OPTIONALITY: { label: '扩展可选择性', first: '写下一个选择，强迫自己写出五个原本没想到的替代方案', success: '面对问题时能想到多个不同方向的解决方案', stop: '同时持有多个有实际证据支持的可选路径' },
  REFRAME_RISK_MODEL: { label: '重构风险认知', first: '列出三个因为"有风险"而没做的事，分析可逆性和最坏情况', success: '能清晰区分可逆和不可逆风险，并据此行动', stop: '基于期望值和可逆性做风险决策，而非恐惧或过度自信' },
  EXPAND_IDENTITY_BOUNDARY: { label: '扩展身份边界', first: '在当前身份之外做一件小的输出，体验"我也可以做不同的事"', success: '你能自然地用能力描述自己，而非仅用职业称谓', stop: '在原有身份框架之外有了实际的有效性证据' },
  EXTEND_TIME_HORIZON: { label: '延伸时间视野', first: '每天拿出一小时，只做一件对三个月后的自己有明确价值的事', success: '每天优先安排对长期有价值的事情，而非被紧急事务填满', stop: '按重要性而非紧急性分配时间成为习惯' },
  UPGRADE_PROBABILITY_THINKING: { label: '升级概率思维', first: '下一次面对选择时，写下三个可能走向和各自概率，再做一个周末小实验', success: '做决策时不再只问成不成，会自然地评估可能性和期望值', stop: '习惯性地用可能性和期望值思考，而非二元结果' },
})

const BLIND_SPOT_ZH_V2 = Object.freeze({
  DECISION_INERTIA: '决策惯性',
  FEEDBACK_LOOP_GAP: '反馈回路断裂',
  OPPORTUNITY_BLINDNESS: '机会盲区',
  RISK_MODEL_DISTORTION: '风险模型失真',
  PROBABILITY_MISJUDGMENT: '概率误判',
  IDENTITY_CONSTRAINT: '身份锁定',
  LEVERAGE_MODEL_GAP: '杠杆模型缺失',
  SYSTEM_THINKING_GAP: '系统思维缺失',
  TIME_HORIZON_TRAP: '时间视野陷阱',
})

function adaptWorldModelToLegacyV2(diagnosis) {
  var blindSpot = diagnosis.cognitiveBlindSpot || {}
  var strategy = diagnosis.worldStrategy || {}
  var bsId = blindSpot.id || ''
  var strategyId = strategy.id || ''
  var bsLabel = BLIND_SPOT_ZH_V2[bsId] || '认知盲区'
  var stratZh = STRATEGY_ZH_V2[strategyId] || {}
  var stratLabel = stratZh.label || strategy.label || ''
  var upgrade = strategy.cognitiveUpgrade || ''
  var first = stratZh.first || (strategy.firstExperiment && strategy.firstExperiment.description) || ''
  var success = stratZh.success || strategy.successSignal || ''
  var stop = stratZh.stop || strategy.stopCondition || ''
  var dims = diagnosis.worldModel || {}

  // scoreCard (compatibility-only, derived from dimension health, never fed back)
  var scoreCard = {}
  var dimTotal = 0
  var dimCount = 0
  Object.keys(dims).forEach(function (k) {
    dimTotal += dims[k].score || 0
    dimCount++
  })
  var overall = dimCount > 0 ? Math.round((dimTotal / dimCount) * 100) : 50
  scoreCard = {
    cashflow: Math.min(90, overall + 5), skill: Math.min(90, overall + 15), execution: Math.min(90, overall + 10),
    time: Math.min(90, overall + 10), risk: Math.min(90, overall - 10), overall: overall,
  }
  function potentialIndex() { return { today: overall - 10, after30: overall, after90: overall + 10, after365: overall + 20 } }

  return {
    _renderSource: 'world_model_v2',
    _version: 'world_model_v2',
    headline: { title: bsLabel, subtitle: bsLabel + ' · ' + stratLabel },
    fatalDiagnosis: { mainProblem: bsLabel, reason: '你的世界模型在「' + bsLabel + '」这个维度存在结构性盲区', severity: 'high', confidence: blindSpot.confidence || 0.5 },
    scoreCard: scoreCard,
    wealthProbability: potentialIndex(),
    potentialIndex: potentialIndex(),
    wealthPath: [{ name: stratLabel + '路径', recommend: 'recommended', score: overall, reason: '基于世界模型诊断的推荐方向' }],
    actionPlan: {
      day1: { goal: first || '完成第一步认知实验', tasks: [first || '第一步实验'], checkpoint: '完成第一步' },
      day7: { goal: '在真实环境中验证第一步实验的反馈', tasks: ['收集并分析反馈'], checkpoint: '收到至少一条有效反馈' },
      day30: { goal: stop || '建立新的认知习惯', tasks: ['复盘实验历程', '固化有效行为模式'], checkpoint: '评估认知升级效果' },
    },
    stopDoing: { priority: 'MEDIUM', items: ['暂停与当前认知盲区修复无关的方向探索'] },
    identityUpgrade: { current: bsLabel + '——当前认知模式', target: upgrade || '认知系统升级', bridge: first || '迈出第一步实验' },
    finalStrike: success || '你已经迈出了认知升级的关键一步',
    fatalRules: [{ ruleId: bsId, title: bsLabel, description: '当前世界模型在「' + bsLabel + '」维度存在可修复的结构性盲区', weight: Math.round((blindSpot.confidence || 0.5) * 100), why: '识别并修复这一盲区是认知升级的最高优先级' }],
    advantageRules: [],
    opportunityRules: [{ area: '认知升级', reason: '完成第一步实验后，你的认知模型将获得第一个外部数据驱动的校准点', sourceRuleId: strategyId }],
    destinySimulator: {
      currentModelContinues: { label: '维持当前认知模型的长期推演', description: '当前盲区会持续过滤掉不符合既有认知的可能性', signalTrend: 'stable', confidence: 0.3 },
      worldModelUpgraded: { label: '完成认知升级后的可能性空间', description: '突破「' + bsLabel + '」后，新的认知框架会打开之前不可见的选择空间', signalTrend: 'improving', confidence: 0.5 },
      note: '这不是预测——这是两种认知模型下的行为推演。你今天的每一个实验都在改变推演结果。',
    },
    cognitiveVerdict: { summary: '你的主要认知升级方向是突破「' + bsLabel + '」', recommendedStrategy: stratLabel, confidence: blindSpot.confidence || 0.5, note: '此判断基于世界模型对当前行为证据的确定性分析，不包含预测成分' },
    version: 'world_model_v2',
    engineVersion: 'WORLD_MODEL_V2',
    generatedAt: new Date().toISOString(),
  }
}

module.exports = {
  adaptWorldModelToLegacyV2,
  STRATEGY_ZH_V2,
  BLIND_SPOT_ZH_V2,
}
