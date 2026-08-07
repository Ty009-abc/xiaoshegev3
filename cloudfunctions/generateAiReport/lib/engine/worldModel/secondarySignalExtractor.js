/**
 * engine/worldModel/secondarySignalExtractor.js
 *
 * RC8.3 C3-001B — Secondary Signal Extractor (Predicate AST Execution).
 *
 * Pure function: normalized evidence + primary signals → secondary signal states.
 *
 * EXECUTES predicate AST — NO legacy free-text parsing.
 * 0 regex execution. 0 substring execution. 0 natural-language triggers.
 *
 * P2 DEBT RESOLVED:
 *   Score = actual evidence strength (NOT halved for INSUFFICIENT).
 *   State = derived from predicate evaluation, independent of score.
 *
 * Responsibility boundary:
 *   Evidence → Secondary Signal State (23 signals)
 *   DOES NOT: Secondary Signal → Blind Spot
 *
 * ARCHITECTURE GUARD (HARD):
 * - Does NOT import blind spot inference engine
 * - Does NOT import strategy engine
 * - Does NOT return blindSpotId, archetypeId, or strategyId
 * - Does NOT choose final diagnosis
 * - Does NOT modify runtime state
 *
 * DETERMINISM:
 *   Same input → same output every time (no timestamps, no random numbers).
 *
 * @version world_model_v3
 * @sprint c3-001b
 */

const {
  SECONDARY_SIGNAL_EVIDENCE_MAP,
  getAllEvidenceContractIds,
} = require('./secondarySignalEvidenceMap')

const {
  evaluatePredicate,
  createContext,
  findMatchingEvidence,
  markContradictionMatches,
} = require('./predicateEvaluator')

// ═══════════════════════════════════════════════════════════════
// SIGNAL STATES
// ═══════════════════════════════════════════════════════════════

const SIGNAL_STATE = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUPPRESSED: 'SUPPRESSED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
})

const ACTIVATION_MODE = Object.freeze({
  TWO_SUPPORTING: 'TWO_SUPPORTING',
  STRONG_PLUS_CONTEXT: 'STRONG_PLUS_CONTEXT',
})

// ═══════════════════════════════════════════════════════════════
// EVIDENCE MATCHING ENGINE (preserved for populating evaluator context)
// ═══════════════════════════════════════════════════════════════

function getEvidenceOrigin(item) {
  if (item.originId) return item.originId
  var st = (item.sourceType || item.type) || ''
  var ref = (item.reference || item.id || item.signalId || item.field || item.pattern) || ''
  return st + '::' + ref
}

function evidenceItemMatchesContract(contractRef, item) {
  var itemSourceType = item.sourceType || item.type || ''
  if (itemSourceType !== contractRef.sourceType) return false

  var itemRef = item.reference || item.id || item.signalId || item.field || item.pattern || ''
  if (itemRef !== contractRef.reference) return false

  if (contractRef.sourceType === 'PRIMARY_SIGNAL') {
    var itemConfidence = typeof item.confidence === 'number' ? item.confidence : 0.5
    var itemDetected = item.detected !== false

    var condLow = contractRef.condition.toLowerCase()
    var confMatch = condLow.match(/confidence\s*[≥>=]\s*([\d.]+)/)
    if (confMatch) {
      var requiredConf = parseFloat(confMatch[1])
      if (itemConfidence < requiredConf) return false
    }

    var hasNotDetected = /not[\s-]?detected/i.test(condLow)
    var hasStandaloneDetected = /\bdetected\b/i.test(condLow.replace(/not[\s-]?detected/gi, ''))
    var hasOrLinking = hasNotDetected && hasStandaloneDetected && /\bor\b/i.test(condLow)

    if (hasOrLinking) {
      // "detected or not-detected" — either state OK
    } else if (hasNotDetected) {
      if (itemDetected) return false
    } else if (hasStandaloneDetected) {
      if (!itemDetected) return false
    }
  }

  return true
}

function matchEvidenceList(contractRefs, inputItems) {
  var matched = []
  var origins = new Set()

  for (var i = 0; i < contractRefs.length; i++) {
    var contractRef = contractRefs[i]
    for (var j = 0; j < inputItems.length; j++) {
      var item = inputItems[j]
      if (evidenceItemMatchesContract(contractRef, item)) {
        matched.push({
          contractRef: {
            sourceType: contractRef.sourceType,
            reference: contractRef.reference,
          },
          item: item,
        })
        origins.add(getEvidenceOrigin(item))
        break
      }
    }
  }

  return { matched: matched, origins: origins }
}

// ═══════════════════════════════════════════════════════════════
// SCORE CALCULATION (P2 RESOLVED: no halving)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculates evidence strength score.
 * Score = actual evidence strength, independent of state.
 * Range: 0.0 – 100.0
 */
function calculateScore(params) {
  var requiredMatched = params.requiredMatched || 0
  var contextualMatched = params.contextualMatched || 0
  var strongMatched = params.strongMatched || 0
  var uniqueOrigins = params.uniqueOrigins || 0
  var contradictionCount = params.contradictionCount || 0

  var base = (requiredMatched * 25) + (contextualMatched * 15) + (strongMatched * 35)
  var independenceBonus = Math.max(0, (uniqueOrigins - 1) * 10)
  var contradictionPenalty = contradictionCount * 20

  return Math.max(0, Math.min(100, Math.round(base + independenceBonus - contradictionPenalty)))
}

function areEvidenceIndependent(itemA, itemB) {
  // Unwrap {item: ...} wrappers if present (from matchEvidenceList results)
  var a = (itemA && itemA.item) ? itemA.item : itemA
  var b = (itemB && itemB.item) ? itemB.item : itemB
  return getEvidenceOrigin(a) !== getEvidenceOrigin(b)
}

/**
 * Determines activation mode from evidence matches.
 * TWO_SUPPORTING: 2+ independent supporting items (required or contextual)
 * STRONG_PLUS_CONTEXT: 1 strong + 1 contextual/required from independent origins
 */
function determineActivationMode(requiredMatched, contextualMatched, strongMatched, uniqueOrigins) {
  var totalSupporting = requiredMatched + contextualMatched

  if (totalSupporting >= 2 && uniqueOrigins >= 2) {
    return ACTIVATION_MODE.TWO_SUPPORTING
  }

  if (strongMatched >= 1 && (contextualMatched >= 1 || requiredMatched >= 1) && uniqueOrigins >= 2) {
    return ACTIVATION_MODE.STRONG_PLUS_CONTEXT
  }

  return null
}

/**
 * Calculates confidence based on evidence completeness and reliability.
 * Range: 0.0 – 1.0
 */
function calculateConfidence(params) {
  var uniqueOrigins = params.uniqueOrigins || 0
  var strongMatched = params.strongMatched || 0
  var contextualMatched = params.contextualMatched || 0
  var contradictionCount = params.contradictionCount || 0
  var minEvidence = params.minEvidence || 2

  if (uniqueOrigins === 0) return 0

  var originRatio = Math.min(uniqueOrigins / Math.max(minEvidence, 2), 1.5)
  var confidence = originRatio * 0.4 // up to 0.6 from quantity/independence
  confidence += Math.min(strongMatched, 3) * 0.1 // up to 0.3
  confidence += Math.min(contextualMatched, 2) * 0.05 // up to 0.1
  confidence -= Math.min(contradictionCount, 3) * 0.15

  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100))
}

// ═══════════════════════════════════════════════════════════════
// MISSING EVIDENCE DETECTION
// ═══════════════════════════════════════════════════════════════

function determineMissingEvidence(contract, requiredMatched, contextualMatched, strongMatched, uniqueOrigins) {
  var needed = []
  var minEvidence = contract.minimumEvidence || 2

  if (uniqueOrigins < minEvidence) {
    var gap = minEvidence - uniqueOrigins
    needed.push('Need ' + gap + ' more independent evidence item(s)')
  }

  if (requiredMatched + contextualMatched === 0 && strongMatched === 0) {
    needed.push('No supporting evidence found')
  } else if (uniqueOrigins < minEvidence) {
    if (strongMatched >= 1 && contextualMatched === 0) {
      needed.push('Strong evidence present but no contextual — need contextual for Mode B')
    } else if (requiredMatched >= 1 && contextualMatched === 0 && strongMatched === 0) {
      needed.push('Single evidence item — need 2 independent supporting OR 1 strong + 1 contextual')
    }
  }

  if (needed.length === 0) {
    needed.push('Cannot determine missing evidence')
  }

  return needed
}

// ═══════════════════════════════════════════════════════════════
// MAIN: EVALUATE SINGLE SIGNAL (AST EXECUTION)
// ═══════════════════════════════════════════════════════════════

function evaluateSignal(signalId, input) {
  if (!input) input = {}

  var contract = SECONDARY_SIGNAL_EVIDENCE_MAP[signalId]
  if (!contract) {
    return {
      id: signalId,
      state: SIGNAL_STATE.INSUFFICIENT_EVIDENCE,
      score: 0,
      confidence: 0,
      supportingEvidenceIds: [],
      contextualEvidenceIds: [],
      strongEvidenceIds: [],
      contradictingEvidenceIds: [],
      activationMode: null,
      suppressionReason: 'UNKNOWN_SIGNAL',
      insufficientEvidence: true,
      missingEvidenceNeeded: ['Signal contract not found'],
      trace: { requiredMatched: 0, contextualMatched: 0, strongMatched: 0, contradictionMatched: 0 },
    }
  }

  var evidence = input.evidence || []
  var primarySignals = input.primarySignals || []
  var allInputItems = evidence.concat(primarySignals)

  // ── Evidence matching (populates context for predicate evaluation) ──

  var reqResult = matchEvidenceList(contract.requiredEvidence, allInputItems)
  var ctxResult = matchEvidenceList(contract.contextualEvidence, allInputItems)
  var strResult = matchEvidenceList(contract.strongEvidence, allInputItems)
  var ctrResult = matchEvidenceList(contract.contradictoryEvidence, allInputItems)

  // Collect evidence IDs
  var supportingEvidenceIds = []
  var contextualEvidenceIds = []
  var strongEvidenceIds = []
  var contradictingEvidenceIds = []

  reqResult.matched.forEach(function (m) {
    supportingEvidenceIds.push(m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference)
  })
  ctxResult.matched.forEach(function (m) {
    contextualEvidenceIds.push(m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference)
  })
  strResult.matched.forEach(function (m) {
    strongEvidenceIds.push(m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference)
  })
  ctrResult.matched.forEach(function (m) {
    contradictingEvidenceIds.push(m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference)
  })

  // All supporting origins
  var allSupportOrigins = new Set()
  reqResult.origins.forEach(function (o) { allSupportOrigins.add(o) })
  ctxResult.origins.forEach(function (o) { allSupportOrigins.add(o) })
  strResult.origins.forEach(function (o) { allSupportOrigins.add(o) })

  // ── Create evaluator context with matched evidence ──

  var evalCtx = createContext(evidence, primarySignals)

  // Populate _matchedEvidence from matches
  function addMatchesToCtx(matches) {
    matches.forEach(function (m) {
      var eid = m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference
      evalCtx._matchedEvidence.add({
        origin: getEvidenceOrigin(m.item),
        evidenceId: eid,
      })
    })
  }

  addMatchesToCtx(reqResult.matched)
  addMatchesToCtx(ctxResult.matched)
  addMatchesToCtx(strResult.matched)

  // Mark contradiction matches separately
  var ctrMatchesForCtx = []
  ctrResult.matched.forEach(function (m) {
    ctrMatchesForCtx.push({
      origin: getEvidenceOrigin(m.item),
      evidenceId: m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference,
    })
  })
  markContradictionMatches(evalCtx, ctrMatchesForCtx)

  // ── Evaluate suppression first (contradiction-first) ──

  var suppressionResult = evaluatePredicate(contract.suppressionRule.predicate, evalCtx)

  if (suppressionResult.result) {
    return {
      id: signalId,
      state: SIGNAL_STATE.SUPPRESSED,
      score: Math.max(0, calculateScore({
        requiredMatched: reqResult.matched.length,
        contextualMatched: ctxResult.matched.length,
        strongMatched: strResult.matched.length,
        uniqueOrigins: allSupportOrigins.size,
        contradictionCount: ctrResult.matched.length,
      }) - 40),
      confidence: 0,
      supportingEvidenceIds: supportingEvidenceIds,
      contextualEvidenceIds: contextualEvidenceIds,
      strongEvidenceIds: strongEvidenceIds,
      contradictingEvidenceIds: contradictingEvidenceIds,
      activationMode: null,
      suppressionReason: suppressionResult.reason,
      insufficientEvidence: false,
      missingEvidenceNeeded: [],
      trace: {
        requiredMatched: reqResult.matched.length,
        contextualMatched: ctxResult.matched.length,
        strongMatched: strResult.matched.length,
        contradictionMatched: ctrResult.matched.length,
      },
    }
  }

  // ── Evaluate activation ──

  var activationResult = evaluatePredicate(contract.activationRule.predicate, evalCtx)

  if (activationResult.result) {
    return {
      id: signalId,
      state: SIGNAL_STATE.ACTIVE,
      score: calculateScore({
        requiredMatched: reqResult.matched.length,
        contextualMatched: ctxResult.matched.length,
        strongMatched: strResult.matched.length,
        uniqueOrigins: allSupportOrigins.size,
        contradictionCount: ctrResult.matched.length,
      }),
      confidence: calculateConfidence({
        requiredMatched: reqResult.matched.length,
        contextualMatched: ctxResult.matched.length,
        strongMatched: strResult.matched.length,
        contradictionCount: ctrResult.matched.length,
        uniqueOrigins: allSupportOrigins.size,
        minEvidence: contract.minimumEvidence || 2,
      }),
      supportingEvidenceIds: supportingEvidenceIds,
      contextualEvidenceIds: contextualEvidenceIds,
      strongEvidenceIds: strongEvidenceIds,
      contradictingEvidenceIds: contradictingEvidenceIds,
      activationMode: determineActivationMode(
        reqResult.matched.length,
        ctxResult.matched.length,
        strResult.matched.length,
        allSupportOrigins.size,
      ),
      suppressionReason: null,
      insufficientEvidence: false,
      missingEvidenceNeeded: [],
      trace: {
        requiredMatched: reqResult.matched.length,
        contextualMatched: ctxResult.matched.length,
        strongMatched: strResult.matched.length,
        contradictionMatched: ctrResult.matched.length,
      },
    }
  }

  // ── Insufficient evidence ──

  var missing = determineMissingEvidence(
    contract,
    reqResult.matched.length,
    ctxResult.matched.length,
    strResult.matched.length,
    allSupportOrigins.size,
  )

  return {
    id: signalId,
    state: SIGNAL_STATE.INSUFFICIENT_EVIDENCE,
    score: calculateScore({  // P2: actual evidence strength, NOT halved
      requiredMatched: reqResult.matched.length,
      contextualMatched: ctxResult.matched.length,
      strongMatched: strResult.matched.length,
      uniqueOrigins: allSupportOrigins.size,
      contradictionCount: ctrResult.matched.length,
    }),
    confidence: calculateConfidence({
      requiredMatched: reqResult.matched.length,
      contextualMatched: ctxResult.matched.length,
      strongMatched: strResult.matched.length,
      contradictionCount: ctrResult.matched.length,
      uniqueOrigins: allSupportOrigins.size,
      minEvidence: contract.minimumEvidence || 2,
    }),
    supportingEvidenceIds: supportingEvidenceIds,
    contextualEvidenceIds: contextualEvidenceIds,
    strongEvidenceIds: strongEvidenceIds,
    contradictingEvidenceIds: contradictingEvidenceIds,
    activationMode: null,
    suppressionReason: null,
    insufficientEvidence: true,
    missingEvidenceNeeded: missing,
    trace: {
      requiredMatched: reqResult.matched.length,
      contextualMatched: ctxResult.matched.length,
      strongMatched: strResult.matched.length,
      contradictionMatched: ctrResult.matched.length,
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINTS
// ═══════════════════════════════════════════════════════════════

function evaluateAllSignals(input) {
  if (!input) input = {}
  var evidence = input.evidence || []
  var primarySignals = input.primarySignals || []

  var allSignalIds = getAllEvidenceContractIds()
  var signals = allSignalIds.map(function (signalId) {
    return evaluateSignal(signalId, { evidence: evidence, primarySignals: primarySignals })
  })

  var active = signals.filter(function (s) { return s.state === SIGNAL_STATE.ACTIVE }).length
  var suppressed = signals.filter(function (s) { return s.state === SIGNAL_STATE.SUPPRESSED }).length
  var insufficient = signals.filter(function (s) { return s.state === SIGNAL_STATE.INSUFFICIENT_EVIDENCE }).length

  return {
    signals: signals,
    summary: {
      active: active,
      suppressed: suppressed,
      insufficient: insufficient,
      total: signals.length,
    },
    meta: {
      timestamp: null,
      deterministic: true,
      evidenceVersion: (input.context && input.context.evidenceVersion) || 'world_model_v3',
    },
  }
}

function evaluateSignalById(signalId, input) {
  return evaluateSignal(signalId, input)
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  evaluateAllSignals,
  evaluateSignalById,
  SIGNAL_STATE,
  ACTIVATION_MODE,

  // Internal (exported for tests)
  evidenceItemMatchesContract,
  matchEvidenceList,
  getEvidenceOrigin,
  areEvidenceIndependent,
  calculateScore,
  calculateConfidence,
}
