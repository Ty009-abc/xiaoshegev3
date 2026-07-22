/**
 * core/turnaround-os/schemas/actionContractV6.js
 *
 * V6 Action Contract — ActionDefinition（不变） + ActionExecution（可变）
 *
 * ActionDefinition:  深冻结，不可变。不含 status/progress/completedAt。
 * ActionExecution:   独立可变运行态对象。
 *
 * @version 6.0.0
 * @status CHECKPOINT_5
 */

var C = require('../constants')
var PHASES = ['DAY_7', 'DAY_30', 'DAY_90']
var COSTS = Object.values(C.COST_LEVELS)
var RISKS = Object.values(C.RISK_LEVELS)
var DIFFS = Object.values(C.DIFFICULTY_LEVELS)

// ═══════════════════════════════════════
// Action Status 枚举
// ═══════════════════════════════════════

var ACTION_STATUS = {
  TODO: 'TODO',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  CANCELLED: 'CANCELLED',
}

// ═══════════════════════════════════════
// Category whitelist (static alias for CATS)
// ═══════════════════════════════════════

var CATS = Object.values(C.MISSION_CATEGORIES_V6)

// ═══════════════════════════════════════
// 合法状态迁移表
// ═══════════════════════════════════════

var VALID_TRANSITIONS = {}
VALID_TRANSITIONS[ACTION_STATUS.TODO] = [ACTION_STATUS.READY, ACTION_STATUS.IN_PROGRESS, ACTION_STATUS.SKIPPED, ACTION_STATUS.CANCELLED]
VALID_TRANSITIONS[ACTION_STATUS.READY] = [ACTION_STATUS.IN_PROGRESS, ACTION_STATUS.SKIPPED, ACTION_STATUS.CANCELLED]
VALID_TRANSITIONS[ACTION_STATUS.IN_PROGRESS] = [ACTION_STATUS.COMPLETED, ACTION_STATUS.BLOCKED, ACTION_STATUS.FAILED, ACTION_STATUS.CANCELLED]
VALID_TRANSITIONS[ACTION_STATUS.BLOCKED] = [ACTION_STATUS.READY, ACTION_STATUS.CANCELLED]
VALID_TRANSITIONS[ACTION_STATUS.FAILED] = [ACTION_STATUS.READY, ACTION_STATUS.SKIPPED, ACTION_STATUS.CANCELLED]
VALID_TRANSITIONS[ACTION_STATUS.COMPLETED] = []          // 终态
VALID_TRANSITIONS[ACTION_STATUS.SKIPPED] = [ACTION_STATUS.READY, ACTION_STATUS.CANCELLED]
VALID_TRANSITIONS[ACTION_STATUS.CANCELLED] = []           // 终态

// ═══════════════════════════════════════
// ActionDefinition（深冻结，不可变）
// ═══════════════════════════════════════

/**
 * createActionDefinition — 从 Mission 创建 ActionDefinition
 *
 * 不包含 status/progress/completedAt/startedAt/attemptCount/lastFailureReason
 * 这些字段属于 ActionExecution。
 *
 * @param {Object} params
 * @returns {Object} ActionDefinition（深冻结）
 */
function createActionDefinition(params) {
  params = params || {}
  var phase = PHASES.indexOf(params.phase) >= 0 ? params.phase : 'DAY_7'
  var category = CATS.indexOf(params.category) >= 0 ? params.category : ''
  var seq = params.sequence !== undefined ? params.sequence : 0

  var def = {
    actionId: String(params.actionId || ''),
    missionId: String(params.missionId || ''),
    phase: phase,
    sequence: clampInt(seq, 1, 0, 99),
    category: category,
    title: String(params.title || ''),
    instruction: String(params.instruction || ''),
    estimatedMinutes: clampInt(params.estimatedMinutes, 15, 5, 480),
    estimatedCostLevel: COSTS.indexOf(params.estimatedCostLevel) >= 0 ? params.estimatedCostLevel : C.COST_LEVELS.NONE,
    riskLevel: RISKS.indexOf(params.riskLevel) >= 0 ? params.riskLevel : C.RISK_LEVELS.LOW,
    difficulty: DIFFS.indexOf(params.difficulty) >= 0 ? params.difficulty : C.DIFFICULTY_LEVELS.MODERATE,
    priorityScore: clampInt(params.priorityScore, 0, 0, 100),
    scheduledDay: clampInt(params.scheduledDay, 1, 1, 90),
    proofRequirement: Array.isArray(params.proofRequirement) ? params.proofRequirement.slice() : [],
    successCriteria: Array.isArray(params.successCriteria) ? params.successCriteria.slice() : [],
    failureSignals: Array.isArray(params.failureSignals) ? params.failureSignals.slice() : [],
    dependencies: Array.isArray(params.dependencies) ? params.dependencies.slice() : [],
    fallback: params.fallback && typeof params.fallback === 'object'
      ? buildActionFallback(params.fallback)
      : buildActionFallback({ type: 'RETRY' }),
    tags: Array.isArray(params.tags) ? params.tags.slice() : [],
    linkedLeverage: String(params.linkedLeverage || ''),
    linkedWrongGame: String(params.linkedWrongGame || ''),
  }

  // ID 覆盖：category 4-letter code
  if (!params.actionId) {
    def.actionId = makeActionId(phase, category, seq)
  }

  return deepFreeze(def)
}

// ═══════════════════════════════════════
// ActionExecution（可变运行态）
// ═══════════════════════════════════════

/**
 * createActionExecution
 *
 * @param {Object} actionDefinition — ActionDefinition
 * @returns {Object} ActionExecution
 */
function createActionExecution(actionDefinition) {
  return {
    actionId: (actionDefinition && actionDefinition.actionId) || '',
    missionId: (actionDefinition && actionDefinition.missionId) || '',
    phase: (actionDefinition && actionDefinition.phase) || 'DAY_7',
    status: ACTION_STATUS.TODO,
    progress: 0,
    startedAt: null,
    completedAt: null,
    submittedProof: [],
    attemptCount: 0,
    lastFailureReason: null,
    nextEligibleAt: null,
    maxAttempts: 3,
  }
}

// ═══════════════════════════════════════
// ID: 稳定编码，不截断
// ═══════════════════════════════════════

function makeActionId(phase, category, sequence) {
  var catCode = (C.MISSION_CATEGORY_CODES && C.MISSION_CATEGORY_CODES[category]) || category.slice(0, 4).toUpperCase()
  var prefix = 'ACT_' + phase.replace('DAY_', 'D') + '_' + catCode
  var padded = ''
  var s = '' + sequence
  if (s.length < 3) padded = ('00' + s).slice(-3)
  else padded = s
  return prefix + '_' + padded
}

// ═══════════════════════════════════════
// Action Fallback（结构化失败恢复）
// ═══════════════════════════════════════

function buildActionFallback(params) {
  params = params || {}
  return {
    type: ['RETRY', 'ALTERNATE_ACTION', 'REASSESS', 'REGENERATE'].indexOf(params.type) >= 0
      ? params.type : 'RETRY',
    trigger: String(params.trigger || 'action_failed'),
    targetActionId: params.targetActionId ? String(params.targetActionId) : null,
    ruleCode: String(params.ruleCode || ''),
    instruction: String(params.instruction || ''),
  }
}

// ═══════════════════════════════════════
// helpers
// ═══════════════════════════════════════

function clampInt(val, defaultVal, min, max) {
  if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return defaultVal
  var n = Number(val)
  if (isNaN(n)) return defaultVal
  return Math.max(min, Math.min(max, Math.round(n)))
}

function deepFreeze(obj) {
  var propNames = Object.getOwnPropertyNames(obj)
  for (var i = 0; i < propNames.length; i++) {
    var val = obj[propNames[i]]
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }
  return Object.freeze(obj)
}

module.exports = {
  ACTION_STATUS,
  VALID_TRANSITIONS,
  createActionDefinition,
  createActionExecution,
  makeActionId,
  buildActionFallback,
}
