/**
 * core/turnaround-os/contracts/destinyProjectionContractV6.js
 *
 * V6 命运推演契约
 * 双路径（World A / World B）+ 对比 + 决策节点 + 因果解释
 *
 * @version 6.0.0
 */

const { PROBABILITY_TYPE, SCORE_RANGE } = require('../constants')

/**
 * 创建一个空的世界快照
 */
function createWorldSnapshot() {
  return {
    status: '停滞',
    incomeTrend: '停滞',
    cashflowTrend: '停滞',
    assetTrend: '停滞',
    freedomTrend: '停滞',
    stressTrend: '停滞',
    careerTrend: '停滞',
    riskTrend: '停滞',
    overallTrajectory: '停滞',
    summary: '',
    majorEvents: [],
    majorRisks: [],
    hiddenCosts: [],
  }
}

/**
 * 创建 World A 快照（维持现状）
 */
function createWorldA() {
  return {
    label: '维持当前行为模式',
    day90: createWorldSnapshot(),
    day365: createWorldSnapshot(),
    year3: createWorldSnapshot(),
    missedOpportunities: [],
    probability: 0,
    confidence: 0,
    whyResults: [],
  }
}

/**
 * 创建 World B 快照（执行翻身战略）
 */
function createWorldB() {
  return {
    label: '执行 Turnaround OS 战略',
    day90: createWorldSnapshot(),
    day365: createWorldSnapshot(),
    year3: createWorldSnapshot(),
    expectedChanges: {
      newCashflow: '停滞',
      secondIncome: '停滞',
      assetGrowth: '停滞',
      timeFreedom: '停滞',
      aiUsage: '停滞',
      businessProgress: '停滞',
      systemLevel: '停滞',
    },
    prerequisites: [],
    probability: 0,
    confidence: 0,
    whyResults: [],
  }
}

/**
 * 创建对比模块
 */
function createComparison() {
  return {
    biggestGap: '',
    biggestRisk: '',
    biggestOpportunity: '',
    mostWorthChanging: '',
    forkPoint: '',
    irreversibleRisk: '',
    summary: '',
  }
}

/**
 * 创建决策节点
 */
function createDecisionNode(params = {}) {
  return {
    node: String(params.node || ''),
    trigger: String(params.trigger || ''),
    deadline: String(params.deadline || ''),
    cost: String(params.cost || ''),
    benefit: String(params.benefit || ''),
    risk: String(params.risk || ''),
    reversible: params.reversible !== undefined ? !!params.reversible : true,
  }
}

/**
 * 创建 Why 结果（因果解释单条）
 */
function createWhyResult(params = {}) {
  return {
    conclusion: String(params.conclusion || ''),
    ruleId: String(params.ruleId || ''),
    sourceFields: Array.isArray(params.sourceFields) ? params.sourceFields : [],
    sourceValues: Array.isArray(params.sourceValues) ? params.sourceValues : [],
    assumptions: Array.isArray(params.assumptions) ? params.assumptions : [],
    conditions: String(params.conditions || ''),
  }
}

/**
 * 创建完整的命运推演
 */
function createDefault() {
  return {
    version: '6.0',
    worldA: createWorldA(),
    worldB: createWorldB(),
    comparison: createComparison(),
    decisionNodes: [],
    projectionConfidence: 0,
    assumptions: [],
    limitingFactors: [],
    disclaimer: '本推演基于规则引擎模型，反映结构性变化趋势，不包含具体金额预测，不作为财务建议。',
  }
}

/**
 * 清洗 projection
 */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return createDefault()
  const def = createDefault()

  return {
    version: '6.0',
    worldA: normalizeWorld(raw.worldA, 'worldA'),
    worldB: normalizeWorld(raw.worldB, 'worldB'),
    comparison: raw.comparison && typeof raw.comparison === 'object'
      ? {
          biggestGap: String(raw.comparison.biggestGap || ''),
          biggestRisk: String(raw.comparison.biggestRisk || ''),
          biggestOpportunity: String(raw.comparison.biggestOpportunity || ''),
          mostWorthChanging: String(raw.comparison.mostWorthChanging || ''),
          forkPoint: String(raw.comparison.forkPoint || ''),
          irreversibleRisk: String(raw.comparison.irreversibleRisk || ''),
          summary: String(raw.comparison.summary || ''),
        }
      : def.comparison,
    decisionNodes: Array.isArray(raw.decisionNodes)
      ? raw.decisionNodes.map(d => createDecisionNode(d))
      : [],
    projectionConfidence: clamp(raw.projectionConfidence, 0),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : [],
    limitingFactors: Array.isArray(raw.limitingFactors) ? raw.limitingFactors.map(String) : [],
    disclaimer: String(raw.disclaimer || def.disclaimer),
  }
}

function normalizeWorld(raw, _label) {
  if (!raw || typeof raw !== 'object') return createWorldA()

  function cleanSnapshot(snap) {
    const ref = createWorldSnapshot()
    if (!snap || typeof snap !== 'object') return ref
    const keys = Object.keys(ref).filter(k => typeof ref[k] === 'string' && k !== 'summary')
    for (const k of keys) {
      ref[k] = String(snap[k] || ref[k])
    }
    ref.summary = String(snap.summary || '')
    ref.majorEvents = Array.isArray(snap.majorEvents) ? snap.majorEvents.map(String) : []
    ref.majorRisks = Array.isArray(snap.majorRisks) ? snap.majorRisks.map(String) : []
    ref.hiddenCosts = Array.isArray(snap.hiddenCosts) ? snap.hiddenCosts.map(String) : []
    return ref
  }

  return {
    label: String(raw.label || ''),
    day90: cleanSnapshot(raw.day90),
    day365: cleanSnapshot(raw.day365),
    year3: cleanSnapshot(raw.year3),
    missedOpportunities: Array.isArray(raw.missedOpportunities) ? raw.missedOpportunities.map(String) : [],
    probability: clamp(raw.probability, 0),
    confidence: clamp(raw.confidence, 0),
    whyResults: Array.isArray(raw.whyResults) ? raw.whyResults : [],
    expectedChanges: raw.expectedChanges && typeof raw.expectedChanges === 'object'
      ? {
          newCashflow: String(raw.expectedChanges.newCashflow || '停滞'),
          secondIncome: String(raw.expectedChanges.secondIncome || '停滞'),
          assetGrowth: String(raw.expectedChanges.assetGrowth || '停滞'),
          timeFreedom: String(raw.expectedChanges.timeFreedom || '停滞'),
          aiUsage: String(raw.expectedChanges.aiUsage || '停滞'),
          businessProgress: String(raw.expectedChanges.businessProgress || '停滞'),
          systemLevel: String(raw.expectedChanges.systemLevel || '停滞'),
        }
      : {},
    prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites.map(String) : [],
  }
}

function clamp(val, def) {
  if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return def
  const n = Number(val)
  if (isNaN(n)) return def
  return Math.max(SCORE_RANGE.MIN, Math.min(SCORE_RANGE.MAX, Math.round(n)))
}

module.exports = {
  createDefault,
  normalize,
  createWorldSnapshot,
  createWorldA,
  createWorldB,
  createComparison,
  createDecisionNode,
  createWhyResult,
}
