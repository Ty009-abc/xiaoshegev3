/**
 * engine/worldModel/legacyDiagnosisAdapter.js
 *
 * Adapts World Model diagnosis output to legacy RC8 format for backward
 * compatibility with existing Runtime, Poster, Cache, and History.
 *
 * CRITICAL RULES:
 * - NEVER reverse-map legacy fields back to World Model
 * - Old diagnosis fields must NOT override new World Model fields
 * - Commercial directions only as experiment carriers in legacy output
 * - EMPLOYEE must not appear as archetype in legacy output
 * - Fortune-telling must not appear in legacy output
 *
 * @version world_model_v1
 */

const { normalizePotentialIndex } = require('../../config/reportUtils')

// ═══════════════════════════════════════════════════════════════
// Archetype label mapping — World Model → Legacy
// ═══════════════════════════════════════════════════════════════

const ARCHETYPE_LABEL_MAP = {
  EXPLORER: '探索者',
  BUILDER: '构建者',
  OPERATOR: '执行者',
  STRATEGIST: '战略者',
  GUARDIAN: '守成者',
  CONNECTOR: '连接者',
  OPTIMIZER: '优化者',
}

// ═══════════════════════════════════════════════════════════════
// Blind Spot → Legacy Bottleneck mapping
// ═══════════════════════════════════════════════════════════════

const BLIND_SPOT_TO_BOTTLENECK = {
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

// ═══════════════════════════════════════════════════════════════
// Main adapter
// ═══════════════════════════════════════════════════════════════

/**
 * Adapt World Model diagnosis to legacy RC8 diagnosis format.
 * Returns BOTH: worldModelDiagnosis (original) + legacyDiagnosisAdapter.
 */
function adaptWorldModelToLegacyDiagnosis(worldModelDiagnosis) {
  if (!worldModelDiagnosis || worldModelDiagnosis.version !== 'world_model_v1') {
    return {
      worldModelDiagnosis: worldModelDiagnosis,
      legacyDiagnosisAdapter: null,
      adapterError: 'INVALID_WORLD_MODEL_VERSION',
    }
  }

  var wm = worldModelDiagnosis
  var archetype = wm.cognitiveArchetype || {}
  var blindSpot = wm.cognitiveBlindSpot || {}
  var strategy = wm.worldStrategy || {}
  var scenarios = wm.scenarioSimulation || {}
  var worldModel = wm.worldModel || {}

  // Build legacy diagnosis object
  var legacyDiagnosis = {
    engineVersion: 'RC8.3_LEGACY_ADAPTER',
    diagnosticVersion: 'v4',
    behaviorTags: buildLegacyBehaviorTags(wm.behaviorSignals || []),
    wealthProfile: buildLegacyWealthProfile(archetype),
    bottleneck: buildLegacyBottleneck(blindSpot),
    strategy: buildLegacyStrategy(strategy),
    rInc001Status: 'BACKGROUND_ONLY',
  }

  // Build legacy report format
  var legacyReport = buildLegacyReport(blindSpot, strategy, archetype, scenarios, worldModel)

  return {
    worldModelDiagnosis: worldModelDiagnosis,
    legacyDiagnosisAdapter: {
      diagnosis: legacyDiagnosis,
      report: legacyReport,
      adapterVersion: '1.0',
      adaptedAt: new Date().toISOString(),
      note: 'This is a backward-compatibility adapter. The authoritative diagnosis is worldModelDiagnosis.',
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// Legacy object builders
// ═══════════════════════════════════════════════════════════════

function buildLegacyBehaviorTags(behaviorSignals) {
  return behaviorSignals
    .filter(function(s) { return s.state === 'ACTIVE' || s.state === 'WEAK' })
    .slice(0, 10)
    .map(function(s) {
      return {
        id: s.id,
        label: s.id,
        weight: Math.round(s.score * 100),
        category: s.dimension,
        signal: s.score > 0.6 ? 'POSITIVE' : 'NEUTRAL',
      }
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
  if (!mapping) {
    return { id: blindSpot.id || 'UNKNOWN', label: blindSpot.label || '', confidence: 0.3 }
  }
  return {
    id: mapping.id,
    label: mapping.label,
    description: mapping.description,
    confidence: Math.round(blindSpot.confidence * 100) / 100,
    solution: strategyToLegacySolution(blindSpot.id),
  }
}

function buildLegacyStrategy(strategy) {
  var firstExp = strategy.firstExperiment || {}
  return {
    id: strategy.id || 'UNDETERMINED',
    strategyLabel: strategy.label || '',
    strategyTagline: strategy.label || '',
    confidence: Math.round((strategy.confidence || 0.35) * 100) / 100,
    day1Mission: firstExp.description || '开始第一步认知实验',
    milestones: [
      firstExp.description || '第一步',
      strategy.successSignal || '验证认知升级信号',
      strategy.stopCondition || '达成认知升级目标',
    ],
    duration: strategy.reviewWindow || '4周',
    tagline: strategy.cognitiveUpgrade || '',
  }
}

function buildLegacyReport(blindSpot, strategy, archetype, scenarios, worldModel) {
  var overall = Math.min(90, Math.round((blindSpot.confidence || 0.35) * 60 + 25))
  var sup = buildComputedScores(overall)
  var upgradedScenario = scenarios.upgradedModelScenario || {}
  var firstExperiment = strategy.firstExperiment || {}

  return {
    _renderSource: 'world_model_legacy_adapter',
    _version: 'RC8.3_adapter',
    headline: {
      title: (BLIND_SPOT_TO_BOTTLENECK[blindSpot.id] || {}).label || '认知诊断',
      subtitle: (ARCHETYPE_LABEL_MAP[archetype.primary] || '待识别') + ' · ' + (strategy.label || ''),
    },
    wealthStage: 'STABLE',
    fatalDiagnosis: {
      mainProblem: blindSpot.mechanism || '',
      reason: blindSpot.whyItMatters || '',
      severity: 'high',
      confidence: blindSpot.confidence || 0.35,
    },
    scoreCard: sup.scoreCard,
    wealthProbability: sup.wealthProbability,
    potentialIndex: sup.potentialIndex,
    wealthPath: [
      { name: strategy.label + '路径', recommend: 'recommended', score: Math.round((strategy.confidence || 0.35) * 100), reason: '基于世界模型诊断' },
    ],
    actionPlan: {
      day1: { goal: firstExperiment.description || '第一步行动', tasks: [firstExperiment.description || ''], checkpoint: '完成第一步' },
      day7: { goal: strategy.reviewWindow || '按计划推进', tasks: ['持续实验和复盘'], checkpoint: '验证信号' },
      day30: { goal: strategy.stopCondition || '达成认知升级', tasks: ['复盘并调整'], checkpoint: '评估升级效果' },
    },
    stopDoing: { priority: 'MEDIUM', items: ['暂停与认知盲区无关的方向探索'] },
    identityUpgrade: {
      current: ARCHETYPE_LABEL_MAP[archetype.primary] + '——当前认知模式',
      target: strategy.cognitiveUpgrade || '认知升级',
      bridge: firstExperiment.description || '',
    },
    finalStrike: strategy.successSignal || '完成认知系统升级',
    version: 'RC8.3',
    engineVersion: 'RC8.3_LEGACY_ADAPTER',
    generatedAt: new Date().toISOString(),
  }
}

function buildComputedScores(overall) {
  var base = Math.round(overall * 0.7)
  return {
    scoreCard: {
      cashflow: Math.min(90, base + 5),
      skill: Math.min(90, base + 15),
      execution: Math.min(90, base + 10),
      time: Math.min(90, base + 10),
      risk: Math.min(90, Math.round(base * 0.8)),
      overall: overall,
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

module.exports = {
  adaptWorldModelToLegacyDiagnosis,
  ARCHETYPE_LABEL_MAP,
  BLIND_SPOT_TO_BOTTLENECK,
}
