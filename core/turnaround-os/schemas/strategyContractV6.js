/**
 * core/turnaround-os/schemas/strategyContractV6.js
 *
 * V6 翻身战略契约
 * 完整战略判断链的最终输出结构
 *
 * @version 6.0.0
 */

const { PROBABILITY_TYPE, SCORE_RANGE } = require('../constants')

/**
 * 创建默认 strategy contract
 * @returns {Object}
 */
function createDefault() {
  return {
    version: '6.0',
    generatedAt: '',

    verdict: {
      turnaroundProbability: 0,
      probabilityType: PROBABILITY_TYPE,
      confidence: 0,
      headline: '',
      coreJudgment: '',
      biggestEnemy: '',
      biggestOpportunity: '',
    },

    identitySummary: {
      title: '',
      subtitle: '',
      currentStage: '',
      currentGame: '',
      strongestAsset: '',
      weakestLink: '',
    },

    wrongGame: {
      type: '',
      title: '',
      evidence: [],
      hiddenCost: '',
      threeYearConsequence: '',
      exitCondition: '',
    },

    cognitiveStrike: {
      headline: '',
      explanation: '',
      reverseLogic: '',
      evidence: [],
    },

    primaryStrategy: {
      strategyName: '',
      strategicGoal: '',
      primaryLeverage: {},
      whyThisPath: '',
      whatNotToDo: [],
      successCondition: [],
      failureRisks: [],
    },

    roadmap: {
      first7Days: [],
      first30Days: [],
      first90Days: [],
      first365Days: [],
    },

    futureProjection: {
      currentPath: {},
      turnaroundPath: {},
      keyDifference: '',
    },

    dailySystem: {
      dailyMinimumAction: '',
      weeklyOutput: '',
      monthlyProof: '',
      trackingMetrics: [],
    },

    finalJudgment: {
      statement: '',
      nextAction: '',
      commitmentQuestion: '',
    },

    evidence: {
      ruleHits: [],
      sourceFields: [],
      confidence: 0,
    },
  }
}

/**
 * 清洗 strategy contract
 * 保证所有字段非 null/undefined
 * @param {Object} raw
 * @returns {Object}
 */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return createDefault()

  const def = createDefault()
  const result = {}

  result.version = '6.0'
  result.generatedAt = String(raw.generatedAt || def.generatedAt)

  // verdict
  result.verdict = {
    turnaroundProbability: clamp(raw.verdict && raw.verdict.turnaroundProbability, 0),
    probabilityType: String(raw.verdict && raw.verdict.probabilityType || PROBABILITY_TYPE),
    confidence: clamp(raw.verdict && raw.verdict.confidence, 0),
    headline: String(raw.verdict && raw.verdict.headline || ''),
    coreJudgment: String(raw.verdict && raw.verdict.coreJudgment || ''),
    biggestEnemy: String(raw.verdict && raw.verdict.biggestEnemy || ''),
    biggestOpportunity: String(raw.verdict && raw.verdict.biggestOpportunity || ''),
  }

  // identitySummary
  result.identitySummary = stringSection(raw.identitySummary, def.identitySummary)

  // wrongGame
  result.wrongGame = {
    type: String(raw.wrongGame && raw.wrongGame.type || ''),
    title: String(raw.wrongGame && raw.wrongGame.title || ''),
    evidence: arr(raw.wrongGame && raw.wrongGame.evidence),
    hiddenCost: String(raw.wrongGame && raw.wrongGame.hiddenCost || ''),
    threeYearConsequence: String(raw.wrongGame && raw.wrongGame.threeYearConsequence || ''),
    exitCondition: String(raw.wrongGame && raw.wrongGame.exitCondition || ''),
  }

  // cognitiveStrike
  result.cognitiveStrike = {
    headline: String(raw.cognitiveStrike && raw.cognitiveStrike.headline || ''),
    explanation: String(raw.cognitiveStrike && raw.cognitiveStrike.explanation || ''),
    reverseLogic: String(raw.cognitiveStrike && raw.cognitiveStrike.reverseLogic || ''),
    evidence: arr(raw.cognitiveStrike && raw.cognitiveStrike.evidence),
  }

  // primaryStrategy
  const ps = raw.primaryStrategy || {}
  result.primaryStrategy = {
    strategyName: String(ps.strategyName || ''),
    strategicGoal: String(ps.strategicGoal || ''),
    primaryLeverage: ps.primaryLeverage || {},
    whyThisPath: String(ps.whyThisPath || ''),
    whatNotToDo: arr(ps.whatNotToDo),
    successCondition: arr(ps.successCondition),
    failureRisks: arr(ps.failureRisks),
  }

  // roadmap
  result.roadmap = {
    first7Days: arr(raw.roadmap && raw.roadmap.first7Days),
    first30Days: arr(raw.roadmap && raw.roadmap.first30Days),
    first90Days: arr(raw.roadmap && raw.roadmap.first90Days),
    first365Days: arr(raw.roadmap && raw.roadmap.first365Days),
  }

  // futureProjection
  result.futureProjection = {
    currentPath: raw.futureProjection && raw.futureProjection.currentPath || {},
    turnaroundPath: raw.futureProjection && raw.futureProjection.turnaroundPath || {},
    keyDifference: String(raw.futureProjection && raw.futureProjection.keyDifference || ''),
  }

  // dailySystem
  result.dailySystem = {
    dailyMinimumAction: String(raw.dailySystem && raw.dailySystem.dailyMinimumAction || ''),
    weeklyOutput: String(raw.dailySystem && raw.dailySystem.weeklyOutput || ''),
    monthlyProof: String(raw.dailySystem && raw.dailySystem.monthlyProof || ''),
    trackingMetrics: arr(raw.dailySystem && raw.dailySystem.trackingMetrics),
  }

  // finalJudgment
  result.finalJudgment = {
    statement: String(raw.finalJudgment && raw.finalJudgment.statement || ''),
    nextAction: String(raw.finalJudgment && raw.finalJudgment.nextAction || ''),
    commitmentQuestion: String(raw.finalJudgment && raw.finalJudgment.commitmentQuestion || ''),
  }

  // evidence
  result.evidence = {
    ruleHits: arr(raw.evidence && raw.evidence.ruleHits),
    sourceFields: arr(raw.evidence && raw.evidence.sourceFields),
    confidence: clamp(raw.evidence && raw.evidence.confidence, def.evidence.confidence),
  }

  return result
}

function arr(input) {
  if (!Array.isArray(input)) return []
  return input.filter(v => v !== null && v !== undefined).map(String)
}

function clamp(val, def) {
  if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return def
  const n = Number(val)
  if (isNaN(n)) return def
  return Math.max(SCORE_RANGE.MIN, Math.min(SCORE_RANGE.MAX, Math.round(n)))
}

function stringSection(raw, def) {
  const result = {}
  for (const key of Object.keys(def)) {
    result[key] = String((raw && raw[key]) || '')
  }
  return result
}

module.exports = {
  createDefault,
  normalize,
}
