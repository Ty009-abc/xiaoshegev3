/**
 * core/turnaround-os/validators/validateActionPlanV6.js
 *
 * V6 Action Plan 校验器 — CHECKPOINT_5
 *
 * @version 6.0.0
 * @status CHECKPOINT_5
 */

var C = require('../constants')
var { getAllowedTransitions } = require('../state/actionStateMachineV6')
var PHASES = ['DAY_7', 'DAY_30', 'DAY_90']
var COSTS = Object.values(C.COST_LEVELS)
var RISKS = Object.values(C.RISK_LEVELS)
var DIFFS = Object.values(C.DIFFICULTY_LEVELS)

/**
 * validateActionPlanV6
 */
function validateActionPlanV6(plan) {
  var errors = []
  var warnings = []

  if (!plan || typeof plan !== 'object') {
    errors.push('Action Plan is null or not an object')
    return { valid: false, errors, warnings }
  }

  if (plan.engineVersion !== '6.0.0') {
    errors.push('engineVersion must be 6.0.0, got: ' + plan.engineVersion)
  }

  if (plan.schemaVersion !== 'action-plan/1.0') {
    errors.push('schemaVersion must be action-plan/1.0, got: ' + plan.schemaVersion)
  }

  if (!plan.planId || typeof plan.planId !== 'string') {
    errors.push('planId is required')
  }

  if (!Array.isArray(plan.actions)) {
    errors.push('actions must be an array')
  } else {
    for (var i = 0; i < plan.actions.length; i++) {
      var results = validateActionDefinition(plan.actions[i])
      if (!results.valid) {
        errors.push('actions[' + i + ']: ' + results.errors.join('; '))
      }
    }
  }

  // dependencies
  if (!plan.dependencies || typeof plan.dependencies !== 'object') {
    errors.push('dependencies must be an object')
  } else {
    if (!Array.isArray(plan.dependencies.edges)) errors.push('dependencies.edges must be array')
    if (!Array.isArray(plan.dependencies.criticalPaths)) errors.push('dependencies.criticalPaths must be array')
    if (!Array.isArray(plan.dependencies.warnings)) errors.push('dependencies.warnings must be array')
  }

  // executionRules
  if (!plan.executionRules || typeof plan.executionRules !== 'object') {
    errors.push('executionRules missing')
  }

  // confidence
  if (typeof plan.confidence !== 'number' || plan.confidence < 0 || plan.confidence > 100) {
    errors.push('confidence must be 0-100, got: ' + plan.confidence)
  }

  // evidence
  if (!plan.evidence || typeof plan.evidence !== 'object') {
    warnings.push('evidence missing')
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings }
}

/**
 * validateActionDefinition
 */
function validateActionDefinition(action) {
  var errors = []

  if (!action || typeof action !== 'object') {
    errors.push('action is null or not an object')
    return { valid: false, errors: errors }
  }

  if (!action.actionId || typeof action.actionId !== 'string') {
    errors.push('actionId is required')
  }

  if (PHASES.indexOf(action.phase) < 0) {
    errors.push('invalid phase: ' + action.phase)
  }

  // must be frozen
  if (!Object.isFrozen(action)) {
    errors.push('ActionDefinition must be frozen (immutable)')
  }

  if (typeof action.estimatedMinutes !== 'number' || action.estimatedMinutes < 5 || action.estimatedMinutes > 480) {
    errors.push('estimatedMinutes must be 5-480, got: ' + action.estimatedMinutes)
  }

  if (COSTS.indexOf(action.estimatedCostLevel) < 0) {
    errors.push('invalid estimatedCostLevel: ' + action.estimatedCostLevel)
  }

  if (RISKS.indexOf(action.riskLevel) < 0) {
    errors.push('invalid riskLevel: ' + action.riskLevel)
  }

  if (DIFFS.indexOf(action.difficulty) < 0) {
    errors.push('invalid difficulty: ' + action.difficulty)
  }

  if (typeof action.priorityScore !== 'number' || action.priorityScore < 0 || action.priorityScore > 100) {
    errors.push('priorityScore must be 0-100, got: ' + action.priorityScore)
  }

  if (typeof action.scheduledDay !== 'number' || action.scheduledDay < 1 || action.scheduledDay > 90) {
    errors.push('scheduledDay must be 1-90, got: ' + action.scheduledDay)
  }

  if (typeof action.sequence !== 'number' || action.sequence < 0) {
    errors.push('sequence must be >= 0, got: ' + action.sequence)
  }

  // must not have status/progress/completedAt — these belong to ActionExecution
  if ('status' in action) {
    errors.push('ActionDefinition must not contain "status" field (belongs to ActionExecution)')
  }
  if ('progress' in action) {
    errors.push('ActionDefinition must not contain "progress" field (belongs to ActionExecution)')
  }
  if ('completedAt' in action) {
    errors.push('ActionDefinition must not contain "completedAt" field (belongs to ActionExecution)')
  }
  if ('startedAt' in action) {
    errors.push('ActionDefinition must not contain "startedAt" field (belongs to ActionExecution)')
  }

  return { valid: errors.length === 0, errors: errors }
}

/**
 * validateActionExecution
 */
function validateActionExecution(execution) {
  var errors = []

  if (!execution || typeof execution !== 'object') {
    errors.push('execution is null or not an object')
    return { valid: false, errors: errors }
  }

  if (!execution.actionId || typeof execution.actionId !== 'string') {
    errors.push('actionId is required')
  }

  var validStatuses = ['TODO', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED']
  if (validStatuses.indexOf(execution.status) < 0) {
    errors.push('invalid status: ' + execution.status)
  }

  if (typeof execution.progress !== 'number' || execution.progress < 0 || execution.progress > 100) {
    errors.push('progress must be 0-100, got: ' + execution.progress)
  }

  if (typeof execution.attemptCount !== 'number' || execution.attemptCount < 0) {
    errors.push('attemptCount must be >= 0, got: ' + execution.attemptCount)
  }

  return { valid: errors.length === 0, errors: errors }
}

module.exports = {
  validateActionPlanV6,
  validateActionDefinition,
  validateActionExecution,
}
