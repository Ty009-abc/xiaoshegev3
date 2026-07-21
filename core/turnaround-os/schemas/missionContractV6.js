/**
 * core/turnaround-os/schemas/missionContractV6.js
 *
 * V6 单条 Mission 数据契约（冻结）
 * MissionDefinition — 不可变。不包含 status / progress / completedAt 等运行态字段。
 * 运行态字段见 MissionExecution 契约。
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

// ═══════════════════════════════════════
// FALLBACK_TYPES
// ═══════════════════════════════════════

const FALLBACK_TYPES = {
  RETRY: 'RETRY',
  ALTERNATE_MISSION: 'ALTERNATE_MISSION',
  ESCALATE: 'ESCALATE',
  SKIP: 'SKIP',
  REASSESS: 'REASSESS',
}

/**
 * createFallback — 结构化 fallback 对象
 *
 * @param {Object} params
 * @param {string} params.type — FALLBACK_TYPES 枚举
 * @param {string} params.trigger — 触发条件描述
 * @param {string} [params.targetMissionId] — ALTERNATE_MISSION 时的目标 missionId
 * @param {string} [params.targetCategory] — ALTERNATE_MISSION 时的目标类别
 * @param {string} params.instruction — 具体操作指引
 * @returns {Object}
 */
function createFallback(params = {}) {
  var type = Object.values(FALLBACK_TYPES).indexOf(params.type) >= 0 ? params.type : FALLBACK_TYPES.REASSESS
  return {
    type: type,
    trigger: String(params.trigger || ''),
    targetMissionId: params.targetMissionId ? String(params.targetMissionId) : null,
    targetCategory: params.targetCategory ? String(params.targetCategory) : null,
    instruction: String(params.instruction || ''),
  }
}

/**
 * 创建单条 MissionDefinition（冻结字段，不可变）
 *
 * 不包含：status, progress, completedAt, startedAt, actualMinutes,
 *   assignedTo, executionLog 等运行态字段。
 * 运行态使用独立的 MissionExecution 对象。
 *
 * @param {Object} params
 * @returns {Object} MissionDefinition（深冻结）
 */
function createMission(params = {}) {
  var fallback = params.fallback
  var fallbackObj
  if (fallback && typeof fallback === 'object' && fallback.type) {
    fallbackObj = createFallback(fallback)
  } else if (typeof fallback === 'string' && fallback.length > 0) {
    fallbackObj = createFallback({
      type: FALLBACK_TYPES.REASSESS,
      trigger: '任务执行失败',
      instruction: fallback,
    })
  } else {
    fallbackObj = createFallback()
  }

  var mission = Object.freeze({
    missionId: String(params.missionId || ''),
    phase: Object.values(MISSION_PHASES).indexOf(params.phase) >= 0 ? params.phase : MISSION_PHASES.DAY_7,
    category: CATEGORIES.indexOf(params.category) >= 0 ? params.category : MISSION_CATEGORIES_V6.REVIEW_AND_DECIDE,
    title: String(params.title || ''),
    instruction: String(params.instruction || ''),
    whyNow: String(params.whyNow || ''),
    strategicPurpose: String(params.strategicPurpose || ''),
    validatesAssumption: String(params.validatesAssumption || ''),
    linkedLeverage: String(params.linkedLeverage || ''),
    linkedWrongGame: String(params.linkedWrongGame || ''),
    sourceEvidence: Array.isArray(params.sourceEvidence) ? Object.freeze(params.sourceEvidence.slice()) : Object.freeze([]),
    prerequisites: Array.isArray(params.prerequisites) ? Object.freeze(params.prerequisites.slice()) : Object.freeze([]),
    estimatedMinutes: clampInt(params.estimatedMinutes, 30, 1, 1440),
    estimatedCostLevel: COSTS.indexOf(params.estimatedCostLevel) >= 0 ? params.estimatedCostLevel : COST_LEVELS.NONE,
    riskLevel: RISKS.indexOf(params.riskLevel) >= 0 ? params.riskLevel : RISK_LEVELS.LOW,
    difficulty: DIFFICULTIES.indexOf(params.difficulty) >= 0 ? params.difficulty : DIFFICULTY_LEVELS.MODERATE,
    expectedOutput: String(params.expectedOutput || ''),
    proofOfCompletion: Array.isArray(params.proofOfCompletion) ? Object.freeze(params.proofOfCompletion.slice()) : Object.freeze([]),
    successCriteria: Array.isArray(params.successCriteria) ? Object.freeze(params.successCriteria.slice()) : Object.freeze([]),
    failureSignals: Array.isArray(params.failureSignals) ? Object.freeze(params.failureSignals.slice()) : Object.freeze([]),
    fallback: fallbackObj,
    nextMissionIds: Array.isArray(params.nextMissionIds) ? Object.freeze(params.nextMissionIds.slice()) : Object.freeze([]),
    priorityScore: clampInt(params.priorityScore, 0, 0, 100),
    confidence: clampInt(params.confidence, 0, 0, 100),
  })

  return mission
}

function clampInt(val, defaultVal, min, max) {
  if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return defaultVal
  var n = Number(val)
  if (isNaN(n)) return defaultVal
  return Math.max(min, Math.min(max, Math.round(n)))
}

module.exports = {
  FALLBACK_TYPES,
  createFallback,
  createMission,
}
