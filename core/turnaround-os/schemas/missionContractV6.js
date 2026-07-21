/**
 * core/turnaround-os/schemas/missionContractV6.js
 *
 * V6 单条 Mission 数据契约（冻结）
 * 每个 Mission 可追踪、可验证、有证据、有失败处理
 *
 * @version 6.0.0
 * @status FROZEN — CHECKPOINT_4A
 */

const {
  MISSION_PHASES,
  MISSION_CATEGORIES_V6,
  COST_LEVELS,
  RISK_LEVELS,
  DIFFICULTY_LEVELS,
} = require('../constants')

const CATEGORIES = Object.values(MISSION_CATEGORIES_V6)
const COSTS = Object.values(COST_LEVELS)
const RISKS = Object.values(RISK_LEVELS)
const DIFFICULTIES = Object.values(DIFFICULTY_LEVELS)

/**
 * 创建单条 Mission（冻结字段）
 * @param {Object} params
 * @returns {Object}
 */
function createMission(params = {}) {
  return {
    missionId: String(params.missionId || ''),
    phase: Object.values(MISSION_PHASES).includes(params.phase) ? params.phase : MISSION_PHASES.DAY_7,
    category: CATEGORIES.includes(params.category) ? params.category : MISSION_CATEGORIES_V6.REVIEW_AND_DECIDE,
    title: String(params.title || ''),
    instruction: String(params.instruction || ''),
    whyNow: String(params.whyNow || ''),
    strategicPurpose: String(params.strategicPurpose || ''),
    validatesAssumption: String(params.validatesAssumption || ''),
    linkedLeverage: String(params.linkedLeverage || ''),
    linkedWrongGame: String(params.linkedWrongGame || ''),
    sourceEvidence: Array.isArray(params.sourceEvidence) ? params.sourceEvidence : [],
    prerequisites: Array.isArray(params.prerequisites) ? params.prerequisites : [],
    estimatedMinutes: clampInt(params.estimatedMinutes, 30, 1, 1440),
    estimatedCostLevel: COSTS.includes(params.estimatedCostLevel) ? params.estimatedCostLevel : COST_LEVELS.NONE,
    riskLevel: RISKS.includes(params.riskLevel) ? params.riskLevel : RISK_LEVELS.LOW,
    difficulty: DIFFICULTIES.includes(params.difficulty) ? params.difficulty : DIFFICULTY_LEVELS.MODERATE,
    expectedOutput: String(params.expectedOutput || ''),
    proofOfCompletion: Array.isArray(params.proofOfCompletion) ? params.proofOfCompletion : [],
    successCriteria: Array.isArray(params.successCriteria) ? params.successCriteria : [],
    failureSignals: Array.isArray(params.failureSignals) ? params.failureSignals : [],
    fallbackAction: String(params.fallbackAction || ''),
    nextMissionIds: Array.isArray(params.nextMissionIds) ? params.nextMissionIds : [],
    priorityScore: clampInt(params.priorityScore, 0, 0, 100),
    confidence: clampInt(params.confidence, 0, 0, 100),
  }
}

function clampInt(val, defaultVal, min, max) {
  if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return defaultVal
  const n = Number(val)
  if (isNaN(n)) return defaultVal
  return Math.max(min, Math.min(max, Math.round(n)))
}

module.exports = {
  createMission,
}
