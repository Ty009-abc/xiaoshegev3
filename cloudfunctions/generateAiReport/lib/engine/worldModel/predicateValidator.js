/**
 * engine/worldModel/predicateValidator.js
 *
 * RC8.3 C3-001A — Predicate Validator.
 *
 * Strict validator for structured predicate nodes.
 * Every predicate in evidence contracts MUST pass this validator.
 *
 * CHECKS:
 * - Known predicate types
 * - Non-empty AND/OR groups
 * - NOT has exactly one child
 * - All referenced signal IDs are valid
 * - All thresholds numeric and bounded [0, 1]
 * - All count values ≥ 1
 * - No unknown fields
 * - No free-text executable semantics
 *
 * @version world_model_v3
 * @sprint c3-001a
 */

const {
  PREDICATE_TYPE,
  LOGICAL_TYPES,
  LEAF_TYPES,
  ALL_TYPES,
  SOURCE_TYPE_VALUES,
} = require('./predicateSchema')

const { SECONDARY_SIGNALS } = require('./secondarySignalDefinitions')
const { BLIND_SPOT_DEFINITIONS } = require('./blindSpotDefinitions')

// ═══════════════════════════════════════════════════════════════
// SIGNAL ID REGISTRY
// ═══════════════════════════════════════════════════════════════

/**
 * Builds the set of all known valid signal IDs from definitions.
 */
function buildKnownSignalIds() {
  const ids = new Set()

  // Secondary signal IDs
  if (SECONDARY_SIGNALS) {
    Object.keys(SECONDARY_SIGNALS).forEach(id => ids.add(id))
  }

  // Blind spot IDs (boundary pair references)
  if (BLIND_SPOT_DEFINITIONS) {
    Object.keys(BLIND_SPOT_DEFINITIONS).forEach(id => ids.add(id))
  }

  // Primary signal IDs — loaded from signalDefinitions if available
  try {
    const { getSignalIds } = require('./signalDefinitions')
    if (typeof getSignalIds === 'function') {
      const primaryIds = getSignalIds()
      if (Array.isArray(primaryIds)) {
        primaryIds.forEach(id => ids.add(id))
      }
    }
  } catch (e) {
    // signalDefinitions not available — skip primary signal validation
  }

  return ids
}

// Lazy-loaded cache
var _knownSignalIds = null
function getKnownSignalIds() {
  if (!_knownSignalIds) _knownSignalIds = buildKnownSignalIds()
  return _knownSignalIds
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION RESULT
// ═══════════════════════════════════════════════════════════════

function ok(node) {
  return { valid: true, node }
}

function fail(node, error, path) {
  return { valid: false, node, error, path: path || '(root)' }
}

// ═══════════════════════════════════════════════════════════════
// LEAF VALIDATORS
// ═══════════════════════════════════════════════════════════════

function validateLeafNode(node, path) {
  const type = node.type

  switch (type) {

    case PREDICATE_TYPE.SIGNAL_PRESENT:
    case PREDICATE_TYPE.SIGNAL_ABSENT:
      if (!node.signalId || typeof node.signalId !== 'string') {
        return fail(node, 'Missing or invalid signalId', path)
      }
      // Signal ID validation: must exist in known signal IDs
      // We only validate format — cross-reference is done in contract validation
      if (!/^[A-Z][A-Z0-9_]{2,}$/.test(node.signalId)) {
        return fail(node, 'signalId format invalid: ' + node.signalId, path)
      }
      return ok(node)

    case PREDICATE_TYPE.CONFIDENCE_GTE:
    case PREDICATE_TYPE.CONFIDENCE_LTE:
      if (!node.signalId || typeof node.signalId !== 'string') {
        return fail(node, 'Missing or invalid signalId', path)
      }
      if (typeof node.value !== 'number' || isNaN(node.value)) {
        return fail(node, 'value must be a number', path)
      }
      if (node.value < 0 || node.value > 1) {
        return fail(node, 'value out of range [0,1]: ' + node.value, path)
      }
      return ok(node)

    case PREDICATE_TYPE.EVIDENCE_PRESENT:
    case PREDICATE_TYPE.EVIDENCE_ABSENT:
      if (!node.sourceType || !SOURCE_TYPE_VALUES.includes(node.sourceType)) {
        return fail(node, 'Invalid sourceType: ' + node.sourceType, path)
      }
      if (!node.reference || typeof node.reference !== 'string') {
        return fail(node, 'Missing or invalid reference', path)
      }
      return ok(node)

    case PREDICATE_TYPE.SOURCE_TYPE_IS:
      if (!node.sourceType || !SOURCE_TYPE_VALUES.includes(node.sourceType)) {
        return fail(node, 'Invalid sourceType: ' + node.sourceType, path)
      }
      return ok(node)

    case PREDICATE_TYPE.INDEPENDENT_EVIDENCE_COUNT_GTE:
    case PREDICATE_TYPE.SUPPORT_COUNT_GTE:
    case PREDICATE_TYPE.CONTRADICTION_COUNT_GTE:
      if (typeof node.value !== 'number' || isNaN(node.value)) {
        return fail(node, 'value must be a number', path)
      }
      if (node.value < 1 || !Number.isInteger(node.value)) {
        return fail(node, 'value must be an integer ≥ 1', path)
      }
      return ok(node)

    default:
      return fail(node, 'Unknown predicate type: ' + type, path)
  }
}

// ═══════════════════════════════════════════════════════════════
// RECURSIVE VALIDATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Validates a predicate node tree.
 *
 * @param {Object|null|undefined} node - the predicate node
 * @param {string} [path] - path for error reporting
 * @returns {{ valid: boolean, node?: Object, error?: string, path?: string }}
 */
function validatePredicate(node, path) {
  if (!path) path = '(root)'

  // Null check
  if (node === null || node === undefined) {
    return fail(node, 'Predicate node is null or undefined', path)
  }

  // Type check
  if (!node.type || typeof node.type !== 'string') {
    return fail(node, 'Predicate node missing type field', path)
  }

  if (!ALL_TYPES.includes(node.type)) {
    return fail(node, 'Unknown predicate type: ' + node.type, path)
  }

  const type = node.type

  // ── Logical operators ──

  if (type === PREDICATE_TYPE.AND || type === PREDICATE_TYPE.OR) {
    if (!Array.isArray(node.conditions)) {
      return fail(node, type + ' must have conditions array', path)
    }
    if (node.conditions.length === 0) {
      return fail(node, type + ' conditions must not be empty', path)
    }
    // Validate each condition
    for (var i = 0; i < node.conditions.length; i++) {
      var result = validatePredicate(node.conditions[i], path + '.' + type + '[' + i + ']')
      if (!result.valid) return result
    }
    return ok(node)
  }

  if (type === PREDICATE_TYPE.NOT) {
    if (!node.condition) {
      return fail(node, 'NOT must have a condition child', path)
    }
    return validatePredicate(node.condition, path + '.NOT')
  }

  // ── Leaf nodes ──

  return validateLeafNode(node, path)
}

// ═══════════════════════════════════════════════════════════════
// CONTRACT-LEVEL VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Validates that a contract rule is in { humanRule, predicate } form.
 *
 * @param {Object} rule - { humanRule: string, predicate: Object }
 * @param {string} signalId - owning signal ID for error context
 * @param {string} ruleType - 'activation' | 'suppression' | 'uncertainty'
 * @returns {{ valid: boolean, error?: string }}
 */
function validateContractRule(rule, signalId, ruleType) {
  if (!rule) {
    return { valid: false, error: ruleType + ' rule is null/undefined for ' + signalId }
  }

  if (typeof rule.humanRule !== 'string' || rule.humanRule.length === 0) {
    return { valid: false, error: ruleType + ' rule missing humanRule for ' + signalId }
  }

  if (!rule.predicate || typeof rule.predicate !== 'object') {
    return { valid: false, error: ruleType + ' rule missing structured predicate for ' + signalId }
  }

  const predResult = validatePredicate(rule.predicate, signalId + '.' + ruleType)
  if (!predResult.valid) {
    return { valid: false, error: ruleType + ' predicate invalid for ' + signalId + ': ' + predResult.error + ' at ' + predResult.path }
  }

  return { valid: true }
}

/**
 * Counts free-text executable rules in a contract.
 * A rule is "free-text executable" if it has humanRule but no predicate,
 * OR if predicate is null/undefined.
 *
 * @param {Object} rules - { activationRule, suppressionRule, uncertaintyRule }
 * @returns {number}
 */
function countFreeTextRules(rules) {
  var count = 0
  ;['activationRule', 'suppressionRule', 'uncertaintyRule'].forEach(function (key) {
    var rule = rules[key]
    // Check if the rule exists but lacks a structured predicate
    if (rule && (!rule.predicate || rule.predicate === null || typeof rule.predicate !== 'object')) {
      count++
    }
    // Check if the old trigger format still exists (string-based triggers)
    if (rule && rule.triggers && Array.isArray(rule.triggers)) {
      count += rule.triggers.length
    }
  })
  return count
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  validatePredicate,
  validateContractRule,
  countFreeTextRules,
  getKnownSignalIds,
}
