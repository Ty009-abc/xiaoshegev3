/**
 * engine/worldModel/predicateSchema.js
 *
 * RC8.3 C3-001A — Predicate AST v1.
 *
 * Closed-executable-vocabulary for evidence contract rules.
 *
 * DESIGN:
 * - All executable logic uses this schema exclusively.
 * - 0 free-form executable strings.
 * - 0 regex-required executable semantics.
 * - 0 substring-required executable semantics.
 * - Human-readable explanations are ALWAYS separate from predicates.
 *
 * PREDICATE TYPES (12):
 *   LOGICAL:  AND, OR, NOT
 *   SIGNAL:   SIGNAL_PRESENT, SIGNAL_ABSENT
 *   CONFIDENCE: CONFIDENCE_GTE, CONFIDENCE_LTE
 *   EVIDENCE: EVIDENCE_PRESENT, EVIDENCE_ABSENT, SOURCE_TYPE_IS
 *   COUNT:    INDEPENDENT_EVIDENCE_COUNT_GTE, SUPPORT_COUNT_GTE, CONTRADICTION_COUNT_GTE
 *
 * @version world_model_v3
 * @sprint c3-001a
 */

// ═══════════════════════════════════════════════════════════════
// PREDICATE TYPE CONSTANTS
// ═══════════════════════════════════════════════════════════════

const PREDICATE_TYPE = Object.freeze({
  // Logical operators
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',

  // Signal presence/absence
  SIGNAL_PRESENT: 'SIGNAL_PRESENT',
  SIGNAL_ABSENT: 'SIGNAL_ABSENT',

  // Confidence thresholds
  CONFIDENCE_GTE: 'CONFIDENCE_GTE',
  CONFIDENCE_LTE: 'CONFIDENCE_LTE',

  // Evidence presence/absence
  EVIDENCE_PRESENT: 'EVIDENCE_PRESENT',
  EVIDENCE_ABSENT: 'EVIDENCE_ABSENT',

  // Evidence source type
  SOURCE_TYPE_IS: 'SOURCE_TYPE_IS',

  // Count-based predicates
  INDEPENDENT_EVIDENCE_COUNT_GTE: 'INDEPENDENT_EVIDENCE_COUNT_GTE',
  SUPPORT_COUNT_GTE: 'SUPPORT_COUNT_GTE',
  CONTRADICTION_COUNT_GTE: 'CONTRADICTION_COUNT_GTE',
})

// ═══════════════════════════════════════════════════════════════
// PREDICATE VALIDATABLE TYPES (for validation)
// ═══════════════════════════════════════════════════════════════

const LOGICAL_TYPES = [PREDICATE_TYPE.AND, PREDICATE_TYPE.OR, PREDICATE_TYPE.NOT]
const LEAF_TYPES = [
  PREDICATE_TYPE.SIGNAL_PRESENT, PREDICATE_TYPE.SIGNAL_ABSENT,
  PREDICATE_TYPE.CONFIDENCE_GTE, PREDICATE_TYPE.CONFIDENCE_LTE,
  PREDICATE_TYPE.EVIDENCE_PRESENT, PREDICATE_TYPE.EVIDENCE_ABSENT,
  PREDICATE_TYPE.SOURCE_TYPE_IS,
  PREDICATE_TYPE.INDEPENDENT_EVIDENCE_COUNT_GTE,
  PREDICATE_TYPE.SUPPORT_COUNT_GTE, PREDICATE_TYPE.CONTRADICTION_COUNT_GTE,
]

const ALL_TYPES = [...LOGICAL_TYPES, ...LEAF_TYPES]

const SOURCE_TYPE_VALUES = Object.freeze([
  'PRIMARY_SIGNAL', 'QUESTIONNAIRE', 'BEHAVIORAL',
])

// ═══════════════════════════════════════════════════════════════
// PREDICATE CONSTRUCTORS (FACTORY FUNCTIONS)
// ═══════════════════════════════════════════════════════════════

/**
 * Logical AND — all conditions must be true.
 * @param {Array<Object>} conditions - non-empty array of predicate nodes
 * @returns {Object}
 */
function and(conditions) {
  return Object.freeze({ type: PREDICATE_TYPE.AND, conditions: Object.freeze([...conditions]) })
}

/**
 * Logical OR — at least one condition must be true.
 * @param {Array<Object>} conditions - non-empty array of predicate nodes
 * @returns {Object}
 */
function or(conditions) {
  return Object.freeze({ type: PREDICATE_TYPE.OR, conditions: Object.freeze([...conditions]) })
}

/**
 * Logical NOT — negates a single condition.
 * @param {Object} condition - a single predicate node
 * @returns {Object}
 */
function not(condition) {
  return Object.freeze({ type: PREDICATE_TYPE.NOT, condition: Object.freeze(condition) })
}

/**
 * Signal is present (detected = true).
 * @param {string} signalId - e.g. "DECISION_STABILITY"
 * @returns {Object}
 */
function signalPresent(signalId) {
  return Object.freeze({ type: PREDICATE_TYPE.SIGNAL_PRESENT, signalId })
}

/**
 * Signal is absent (detected = false).
 * @param {string} signalId
 * @returns {Object}
 */
function signalAbsent(signalId) {
  return Object.freeze({ type: PREDICATE_TYPE.SIGNAL_ABSENT, signalId })
}

/**
 * Signal confidence ≥ threshold.
 * @param {string} signalId
 * @param {number} value - 0.0 to 1.0
 * @returns {Object}
 */
function confidenceGte(signalId, value) {
  return Object.freeze({ type: PREDICATE_TYPE.CONFIDENCE_GTE, signalId, value })
}

/**
 * Signal confidence ≤ threshold.
 * @param {string} signalId
 * @param {number} value - 0.0 to 1.0
 * @returns {Object}
 */
function confidenceLte(signalId, value) {
  return Object.freeze({ type: PREDICATE_TYPE.CONFIDENCE_LTE, signalId, value })
}

/**
 * Evidence item with given reference is present in the input.
 * @param {string} sourceType - 'PRIMARY_SIGNAL' | 'QUESTIONNAIRE' | 'BEHAVIORAL'
 * @param {string} reference - the signal ID, field name, or pattern name
 * @returns {Object}
 */
function evidencePresent(sourceType, reference) {
  return Object.freeze({ type: PREDICATE_TYPE.EVIDENCE_PRESENT, sourceType, reference })
}

/**
 * Evidence item with given reference is absent from the input.
 * @param {string} sourceType
 * @param {string} reference
 * @returns {Object}
 */
function evidenceAbsent(sourceType, reference) {
  return Object.freeze({ type: PREDICATE_TYPE.EVIDENCE_ABSENT, sourceType, reference })
}

/**
 * Evidence item has the given source type.
 * @param {string} sourceType - 'PRIMARY_SIGNAL' | 'QUESTIONNAIRE' | 'BEHAVIORAL'
 * @returns {Object}
 */
function sourceTypeIs(sourceType) {
  return Object.freeze({ type: PREDICATE_TYPE.SOURCE_TYPE_IS, sourceType })
}

/**
 * Independent evidence count ≥ threshold.
 * @param {number} value - integer ≥ 1
 * @returns {Object}
 */
function independentEvidenceCountGte(value) {
  return Object.freeze({ type: PREDICATE_TYPE.INDEPENDENT_EVIDENCE_COUNT_GTE, value })
}

/**
 * Supporting evidence count ≥ threshold.
 * @param {number} value - integer ≥ 1
 * @returns {Object}
 */
function supportCountGte(value) {
  return Object.freeze({ type: PREDICATE_TYPE.SUPPORT_COUNT_GTE, value })
}

/**
 * Contradiction evidence count ≥ threshold.
 * @param {number} value - integer ≥ 1
 * @returns {Object}
 */
function contradictionCountGte(value) {
  return Object.freeze({ type: PREDICATE_TYPE.CONTRADICTION_COUNT_GTE, value })
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE COMBINATORS
// ═══════════════════════════════════════════════════════════════

/**
 * "signal is present AND confidence ≥ threshold"
 */
function signalPresentWithConfidenceGte(signalId, value) {
  return and([signalPresent(signalId), confidenceGte(signalId, value)])
}

/**
 * "signal is absent OR signal is present with confidence ≤ threshold"
 */
function signalAbsentOrBelowThreshold(signalId, value) {
  return or([signalAbsent(signalId), and([signalPresent(signalId), confidenceLte(signalId, value)])])
}

/**
 * "count ≥ N independent supporting evidence items"
 * Combining EVIDENCE_PRESENT checks with INDEPENDENT_EVIDENCE_COUNT_GTE
 */
function independentSupportCountGte(value) {
  return and([
    independentEvidenceCountGte(value),
    supportCountGte(value),
  ])
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Constants
  PREDICATE_TYPE,
  LOGICAL_TYPES,
  LEAF_TYPES,
  ALL_TYPES,
  SOURCE_TYPE_VALUES,

  // Logical
  and, or, not,

  // Signal
  signalPresent, signalAbsent,

  // Confidence
  confidenceGte, confidenceLte,

  // Evidence
  evidencePresent, evidenceAbsent,
  sourceTypeIs,

  // Count
  independentEvidenceCountGte, supportCountGte, contradictionCountGte,

  // Combinators
  signalPresentWithConfidenceGte,
  signalAbsentOrBelowThreshold,
  independentSupportCountGte,
}
