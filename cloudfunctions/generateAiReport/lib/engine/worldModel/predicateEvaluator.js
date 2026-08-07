/**
 * engine/worldModel/predicateEvaluator.js
 *
 * RC8.3 C3-001B — Predicate AST Evaluator.
 *
 * Deterministic evaluation of structured predicate nodes against
 * normalized evidence + primary signal input.
 *
 * ALL 13 PREDICATE TYPES:
 *   AND, OR, NOT
 *   SIGNAL_PRESENT, SIGNAL_ABSENT
 *   CONFIDENCE_GTE, CONFIDENCE_LTE
 *   EVIDENCE_PRESENT, EVIDENCE_ABSENT
 *   SOURCE_TYPE_IS
 *   INDEPENDENT_EVIDENCE_COUNT_GTE
 *   SUPPORT_COUNT_GTE, CONTRADICTION_COUNT_GTE
 *
 * NO:
 *   - Natural language parsing
 *   - Regex execution
 *   - Substring matching on executable semantics
 *   - Free-text trigger interpretation
 *
 * @version world_model_v3
 * @sprint c3-001b
 */

const { PREDICATE_TYPE, SOURCE_TYPE_VALUES } = require('./predicateSchema')

// ═══════════════════════════════════════════════════════════════
// EVIDENCE MATCHING HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Extracts a unique origin identifier from an evidence item.
 */
function getEvidenceOrigin(item) {
  if (item && item.originId) return item.originId
  var st = (item && (item.sourceType || item.type)) || ''
  var ref = (item && (item.reference || item.id || item.signalId || item.field || item.pattern)) || ''
  return st + '::' + ref
}

/**
 * Finds all evidence items matching a sourceType + reference.
 * Returns array of { item, origin }.
 */
function findMatchingEvidence(evidence, primarySignals, sourceType, reference) {
  var allItems = (evidence || []).concat(primarySignals || [])
  var matches = []

  for (var i = 0; i < allItems.length; i++) {
    var item = allItems[i]
    var itemType = item.sourceType || item.type || ''

    if (itemType !== sourceType) continue

    var itemRef = item.reference || item.id || item.signalId || item.field || item.pattern || ''
    if (itemRef === reference) {
      matches.push({
        item: item,
        origin: getEvidenceOrigin(item),
        evidenceId: item.id || item.reference || item.signalId || (sourceType + ':' + reference),
      })
    }
  }

  return matches
}

/**
 * Finds a primary signal by signalId.
 */
function findSignal(primarySignals, signalId) {
  var ps = primarySignals || []
  for (var i = 0; i < ps.length; i++) {
    var s = ps[i]
    var sId = s.signalId || s.id || ''
    if (sId === signalId) return s
  }
  // Also check evidence items for PRIMARY_SIGNAL type
  return null
}

/**
 * Finds any item (evidence or primary signal) by signalId.
 */
function findAnySignal(evidence, primarySignals, signalId) {
  var allItems = (primarySignals || []).concat(evidence || [])
  var bestMatch = null

  for (var i = 0; i < allItems.length; i++) {
    var e = allItems[i]
    var eId = e.signalId || e.id || e.reference || ''
    if (eId === signalId) {
      // Prefer detected=true items for SIGNAL_PRESENT checks
      if (e.detected !== false) return e
      if (!bestMatch) bestMatch = e
    }
  }

  return bestMatch || null
}

// ═══════════════════════════════════════════════════════════════
// TRACE BUILDER
// ═══════════════════════════════════════════════════════════════

function ok(predicateType, reason, children, evidenceIds, signalIds) {
  return {
    result: true,
    predicateType: predicateType,
    children: children || [],
    matchedEvidenceIds: evidenceIds || [],
    matchedSignalIds: signalIds || [],
    reason: reason || (predicateType + ': true'),
  }
}

function fail(predicateType, reason, children, evidenceIds, signalIds) {
  return {
    result: false,
    predicateType: predicateType,
    children: children || [],
    matchedEvidenceIds: evidenceIds || [],
    matchedSignalIds: signalIds || [],
    reason: reason || (predicateType + ': false'),
  }
}

function mergeTraces(traces) {
  var evidenceIds = []
  var signalIds = []
  var seenEv = {}
  var seenSig = {}

  traces.forEach(function (t) {
    if (t.matchedEvidenceIds) {
      t.matchedEvidenceIds.forEach(function (eid) {
        if (!seenEv[eid]) { seenEv[eid] = true; evidenceIds.push(eid) }
      })
    }
    if (t.matchedSignalIds) {
      t.matchedSignalIds.forEach(function (sid) {
        if (!seenSig[sid]) { seenSig[sid] = true; signalIds.push(sid) }
      })
    }
  })

  return { evidenceIds: evidenceIds, signalIds: signalIds }
}

// ═══════════════════════════════════════════════════════════════
// COUNTING HELPERS (for INDEPENDENT_EVIDENCE_COUNT_GTE,
// SUPPORT_COUNT_GTE, CONTRADICTION_COUNT_GTE)
// ═══════════════════════════════════════════════════════════════

/**
 * Counts independent evidence origins from a set of matches.
 */
function countIndependentOrigins(matches) {
  var origins = {}
  matches.forEach(function (m) { origins[m.origin] = true })
  return Object.keys(origins).length
}

// ═══════════════════════════════════════════════════════════════
// LEAF EVALUATORS
// ═══════════════════════════════════════════════════════════════

function evalSignalPresent(node, ctx) {
  var signal = findAnySignal(ctx.evidence, ctx.primarySignals, node.signalId)
  if (!signal) {
    return fail('SIGNAL_PRESENT', node.signalId + ' not found in input', [], [], [])
  }

  var isDetected = signal.detected !== false
  if (!isDetected) {
    return fail('SIGNAL_PRESENT', node.signalId + ' detected=false', [], [], [node.signalId])
  }

  // Accumulate match
  ctx._matchedSignals = ctx._matchedSignals || new Set()
  ctx._matchedSignals.add(node.signalId)

  return ok('SIGNAL_PRESENT', node.signalId + ' detected=true', [], [], [node.signalId])
}

function evalSignalAbsent(node, ctx) {
  var signal = findAnySignal(ctx.evidence, ctx.primarySignals, node.signalId)
  if (!signal) {
    return ok('SIGNAL_ABSENT', node.signalId + ' not present in input (absent by absence)', [], [], [])
  }

  var isDetected = signal.detected !== false
  if (isDetected) {
    return fail('SIGNAL_ABSENT', node.signalId + ' detected=true', [], [], [node.signalId])
  }

  return ok('SIGNAL_ABSENT', node.signalId + ' detected=false', [], [], [node.signalId])
}

function evalConfidenceGte(node, ctx) {
  var signal = findAnySignal(ctx.evidence, ctx.primarySignals, node.signalId)
  if (!signal) {
    return fail('CONFIDENCE_GTE', node.signalId + ' not found, cannot check confidence', [], [], [])
  }

  var conf = typeof signal.confidence === 'number' ? signal.confidence : 0.5
  if (conf >= node.value) {
    return ok('CONFIDENCE_GTE', node.signalId + ' confidence ' + conf + ' >= ' + node.value,
      [], [], [node.signalId])
  }

  return fail('CONFIDENCE_GTE', node.signalId + ' confidence ' + conf + ' < ' + node.value,
    [], [], [node.signalId])
}

function evalConfidenceLte(node, ctx) {
  var signal = findAnySignal(ctx.evidence, ctx.primarySignals, node.signalId)
  if (!signal) {
    return ok('CONFIDENCE_LTE', node.signalId + ' not found (treated as confidence 0 <= ' + node.value + ')', [], [], [])
  }

  var conf = typeof signal.confidence === 'number' ? signal.confidence : 0.5
  if (conf <= node.value) {
    return ok('CONFIDENCE_LTE', node.signalId + ' confidence ' + conf + ' <= ' + node.value,
      [], [], [node.signalId])
  }

  return fail('CONFIDENCE_LTE', node.signalId + ' confidence ' + conf + ' > ' + node.value,
    [], [], [node.signalId])
}

function evalEvidencePresent(node, ctx) {
  var matches = findMatchingEvidence(ctx.evidence, ctx.primarySignals, node.sourceType, node.reference)

  if (matches.length === 0) {
    return fail('EVIDENCE_PRESENT', node.sourceType + ':' + node.reference + ' not found', [], [], [])
  }

  var evidenceIds = matches.map(function (m) { return m.evidenceId })
  var signalIds = node.sourceType === 'PRIMARY_SIGNAL' ? [node.reference] : []

  // Accumulate
  ctx._matchedEvidence = ctx._matchedEvidence || new Set()
  matches.forEach(function (m) { ctx._matchedEvidence.add(m) })

  return ok('EVIDENCE_PRESENT', node.sourceType + ':' + node.reference + ' found (' + matches.length + ' items)',
    [], evidenceIds, signalIds)
}

function evalEvidenceAbsent(node, ctx) {
  var matches = findMatchingEvidence(ctx.evidence, ctx.primarySignals, node.sourceType, node.reference)

  if (matches.length > 0) {
    return fail('EVIDENCE_ABSENT', node.sourceType + ':' + node.reference + ' found but should be absent',
      [], matches.map(function (m) { return m.evidenceId }), [])
  }

  return ok('EVIDENCE_ABSENT', node.sourceType + ':' + node.reference + ' absent',
    [], [], [])
}

function evalSourceTypeIs(node, ctx) {
  if (SOURCE_TYPE_VALUES.indexOf(node.sourceType) !== -1) {
    return ok('SOURCE_TYPE_IS', 'sourceType ' + node.sourceType + ' is valid', [], [], [])
  }
  return fail('SOURCE_TYPE_IS', 'sourceType ' + node.sourceType + ' is invalid', [], [], [])
}

function evalIndependentEvidenceCountGte(node, ctx) {
  // Collect ALL evidence origins: supporting (_matchedEvidence) + contradiction (_contradictionMatches)
  var origins = {}
  var evidenceIds = []

  var allMatches = ctx._matchedEvidence || new Set()
  allMatches.forEach(function (m) {
    origins[m.origin] = true
    evidenceIds.push(m.evidenceId)
  })

  var ctrMatches = ctx._contradictionMatches || new Set()
  ctrMatches.forEach(function (m) {
    origins[m.origin] = true
    evidenceIds.push(m.evidenceId)
  })

  var count = Object.keys(origins).length

  if (count >= node.value) {
    return ok('INDEPENDENT_EVIDENCE_COUNT_GTE', count + ' independent origins >= ' + node.value,
      [], evidenceIds, [])
  }

  return fail('INDEPENDENT_EVIDENCE_COUNT_GTE', count + ' independent origins < ' + node.value,
    [], evidenceIds, [])
}

function evalSupportCountGte(node, ctx) {
  // Count supporting evidence items matched
  var allMatches = ctx._matchedEvidence || new Set()

  if (allMatches.size >= node.value) {
    return ok('SUPPORT_COUNT_GTE', allMatches.size + ' supporting items >= ' + node.value,
      [], [], [])
  }

  return fail('SUPPORT_COUNT_GTE', allMatches.size + ' supporting items < ' + node.value,
    [], [], [])
}

function evalContradictionCountGte(node, ctx) {
  var count = ctx._contradictionMatches ? ctx._contradictionMatches.size : 0

  if (count >= node.value) {
    return ok('CONTRADICTION_COUNT_GTE', count + ' contradiction items >= ' + node.value,
      [], [], [])
  }

  return fail('CONTRADICTION_COUNT_GTE', count + ' contradiction items < ' + node.value,
    [], [], [])
}

// ═══════════════════════════════════════════════════════════════
// LOGICAL OPERATOR EVALUATORS
// ═══════════════════════════════════════════════════════════════

function evalAnd(node, ctx) {
  var children = []
  var allTrue = true

  for (var i = 0; i < node.conditions.length; i++) {
    var child = evaluatePredicate(node.conditions[i], ctx)
    children.push(child)
    if (!child.result) {
      allTrue = false
      break // short-circuit
    }
  }

  var merged = mergeTraces(children)
  if (allTrue) {
    return ok('AND', 'all ' + children.length + ' conditions true', children,
      merged.evidenceIds, merged.signalIds)
  }
  return fail('AND', 'condition[' + (children.length - 1) + '] failed', children,
    merged.evidenceIds, merged.signalIds)
}

function evalOr(node, ctx) {
  var children = []
  var anyTrue = false

  for (var i = 0; i < node.conditions.length; i++) {
    // Each OR branch gets a fresh context for evidence counting
    // (evidence matches within one branch don't accumulate for other branches)
    var branchCtx = cloneContext(ctx)
    var child = evaluatePredicate(node.conditions[i], branchCtx)
    children.push(child)
    if (child.result) {
      anyTrue = true
      // Don't break — evaluate all for complete trace
    }
  }

  var merged = mergeTraces(children)
  if (anyTrue) {
    return ok('OR', 'at least 1 of ' + children.length + ' conditions true', children,
      merged.evidenceIds, merged.signalIds)
  }
  return fail('OR', 'all ' + children.length + ' conditions false', children,
    merged.evidenceIds, merged.signalIds)
}

function evalNot(node, ctx) {
  var child = evaluatePredicate(node.condition, ctx)

  if (child.result) {
    return fail('NOT', 'inner condition is true, NOT makes it false', [child],
      child.matchedEvidenceIds, child.matchedSignalIds)
  }
  return ok('NOT', 'inner condition is false, NOT makes it true', [child],
    child.matchedEvidenceIds, child.matchedSignalIds)
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function createContext(evidence, primarySignals) {
  return {
    evidence: evidence || [],
    primarySignals: primarySignals || [],
    _matchedEvidence: new Set(),
    _matchedSignals: new Set(),
    _contradictionMatches: new Set(),
  }
}

function cloneContext(ctx) {
  var cloned = {
    evidence: ctx.evidence,
    primarySignals: ctx.primarySignals,
    _matchedEvidence: new Set(ctx._matchedEvidence),
    _matchedSignals: new Set(ctx._matchedSignals),
    _contradictionMatches: new Set(ctx._contradictionMatches),
  }
  return cloned
}

/**
 * Marks evidence matches as contradiction evidence.
 */
function markContradictionMatches(ctx, matches) {
  if (!ctx._contradictionMatches) ctx._contradictionMatches = new Set()
  matches.forEach(function (m) { ctx._contradictionMatches.add(m) })
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluates a predicate AST node against evidence input.
 *
 * @param {Object} node - predicate node from predicateSchema
 * @param {Object} ctx - evaluation context { evidence, primarySignals, _matchedEvidence, ... }
 * @returns {Object} { result, predicateType, children, matchedEvidenceIds, matchedSignalIds, reason }
 */
function evaluatePredicate(node, ctx) {
  if (!node || !node.type) {
    return fail('UNKNOWN', 'node is null or missing type', [], [], [])
  }

  switch (node.type) {
    case PREDICATE_TYPE.AND:
      return evalAnd(node, ctx)
    case PREDICATE_TYPE.OR:
      return evalOr(node, ctx)
    case PREDICATE_TYPE.NOT:
      return evalNot(node, ctx)
    case PREDICATE_TYPE.SIGNAL_PRESENT:
      return evalSignalPresent(node, ctx)
    case PREDICATE_TYPE.SIGNAL_ABSENT:
      return evalSignalAbsent(node, ctx)
    case PREDICATE_TYPE.CONFIDENCE_GTE:
      return evalConfidenceGte(node, ctx)
    case PREDICATE_TYPE.CONFIDENCE_LTE:
      return evalConfidenceLte(node, ctx)
    case PREDICATE_TYPE.EVIDENCE_PRESENT:
      return evalEvidencePresent(node, ctx)
    case PREDICATE_TYPE.EVIDENCE_ABSENT:
      return evalEvidenceAbsent(node, ctx)
    case PREDICATE_TYPE.SOURCE_TYPE_IS:
      return evalSourceTypeIs(node, ctx)
    case PREDICATE_TYPE.INDEPENDENT_EVIDENCE_COUNT_GTE:
      return evalIndependentEvidenceCountGte(node, ctx)
    case PREDICATE_TYPE.SUPPORT_COUNT_GTE:
      return evalSupportCountGte(node, ctx)
    case PREDICATE_TYPE.CONTRADICTION_COUNT_GTE:
      return evalContradictionCountGte(node, ctx)
    default:
      return fail('UNKNOWN', 'Unknown predicate type: ' + node.type, [], [], [])
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE: FULL CONTRACT EVALUATION
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluates a contract rule's predicate against input.
 *
 * @param {Object} rule - { humanRule, predicate }
 * @param {Object} evidence
 * @param {Object} primarySignals
 * @returns {Object} trace result
 */
function evaluateContractRule(rule, evidence, primarySignals) {
  if (!rule || !rule.predicate) {
    return fail('MISSING_PREDICATE', 'rule has no predicate', [], [], [])
  }

  var ctx = createContext(evidence, primarySignals)
  return evaluatePredicate(rule.predicate, ctx)
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  evaluatePredicate,
  evaluateContractRule,
  createContext,
  cloneContext,
  findMatchingEvidence,
  findAnySignal,
  markContradictionMatches,
  getEvidenceOrigin,
}
