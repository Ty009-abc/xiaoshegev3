/**
 * core/turnaround-os/contracts/actionPlanContractV6.js
 *
 * V6 Action Plan 数据契约 — CHECKPOINT_5
 *
 * ActionPlan:   可变的 Daily/Weekly Schedule 容器
 * ActionDefinition: 深冻结不变 (schema/actionContractV6)
 * ActionExecution:  可变运行态 (schema/actionContractV6)
 *
 * @version 6.0.0
 * @status CHECKPOINT_5
 */

var C = require('../constants')

/**
 * createActionPlan — 空 Action Plan 骨架
 *
 * @param {Object} overrides
 * @returns {Object}
 */
function createActionPlan(overrides) {
  overrides = overrides || {}
  return {
    engineVersion: '6.0.0',
    schemaVersion: 'action-plan/1.0',
    planId: String(overrides.planId || ''),
    sourceMissionPlanVersion: String(overrides.sourceMissionPlanVersion || '6.0'),
    actions: [],
    dailySchedule: {},
    weeklySchedule: createWeeklySummary(),
    dependencies: createDependencyMap(),
    blockedActions: [],
    executionRules: createExecutionRules(),
    confidence: clampInt(overrides.confidence, 0, 0, 100),
    evidence: {
      ruleHits: [],
      sourceFields: [],
      actionLinks: [],
    },
  }
}

// ═══════════════════════════════════════
// Daily Schedule 条目
// ═══════════════════════════════════════

function createDailySlot(day, overrides) {
  overrides = overrides || {}
  return {
    dayNumber: clampInt(day, 1, 1, 90),
    actionIds: Array.isArray(overrides.actionIds) ? overrides.actionIds.slice() : [],
    estimatedTotalMinutes: clampInt(overrides.estimatedTotalMinutes, 0, 0, 720),
    theme: String(overrides.theme || ''),
  }
}

// ═══════════════════════════════════════
// Weekly Schedule 摘要
// ═══════════════════════════════════════

function createWeeklySummary(overrides) {
  overrides = overrides || {}
  return {
    weekNumber: clampInt(overrides.weekNumber, 1, 1, 13),
    startDay: clampInt(overrides.startDay, 1, 1, 90),
    endDay: clampInt(overrides.endDay, 7, 1, 90),
    totalActions: clampInt(overrides.totalActions, 0, 0, 50),
    totalMinutes: clampInt(overrides.totalMinutes, 0, 0, 7200),
    completionTarget: clampInt(overrides.completionTarget, 0, 0, 100),
    reviewDay: clampInt(overrides.reviewDay, 7, 1, 90),
    focusAreas: Array.isArray(overrides.focusAreas) ? overrides.focusAreas.slice() : [],
  }
}

// ═══════════════════════════════════════
// Dependency Map
// ═══════════════════════════════════════

function createDependencyMap(overrides) {
  overrides = overrides || {}
  return {
    edges: Array.isArray(overrides.edges) ? overrides.edges.slice().map(function(e) { return createDependencyEdge(e) }) : [],
    criticalPaths: Array.isArray(overrides.criticalPaths) ? overrides.criticalPaths.slice() : [],
    warnings: Array.isArray(overrides.warnings) ? overrides.warnings.slice() : [],
  }
}

function createDependencyEdge(overrides) {
  overrides = overrides || {}
  return {
    from: String(overrides.from || ''),
    to: String(overrides.to || ''),
    type: ['REQUIRED', 'SOFT'].indexOf(overrides.type) >= 0 ? overrides.type : 'REQUIRED',
    reason: String(overrides.reason || ''),
  }
}

// ═══════════════════════════════════════
// Execution Rules
// ═══════════════════════════════════════

function createExecutionRule(overrides) {
  overrides = overrides || {}
  return {
    ruleId: String(overrides.ruleId || ''),
    description: String(overrides.description || ''),
    appliesTo: Array.isArray(overrides.appliesTo) ? overrides.appliesTo.slice() : [],
    priority: clampInt(overrides.priority, 0, 0, 100),
  }
}

function createExecutionRules(overrides) {
  overrides = overrides || {}
  return {
    maxConcurrentActions: clampInt(overrides.maxConcurrentActions, 3, 1, 10),
    maxDailyMinutes: clampInt(overrides.maxDailyMinutes, 120, 15, 720),
    maxSingleActionMinutes: clampInt(overrides.maxSingleActionMinutes, 60, 15, 480),
    requireProof: overrides.requireProof !== false,
    enforcedRiskCeiling: ['LOW', 'MEDIUM', 'HIGH'].indexOf(overrides.enforcedRiskCeiling) >= 0
      ? overrides.enforcedRiskCeiling : 'MEDIUM',
    rules: Array.isArray(overrides.rules) ? overrides.rules.map(function(r) { return createExecutionRule(r) }) : [],
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

module.exports = {
  createActionPlan,
  createDailySlot,
  createWeeklySummary,
  createDependencyMap,
  createDependencyEdge,
  createExecutionRule,
  createExecutionRules,
}
