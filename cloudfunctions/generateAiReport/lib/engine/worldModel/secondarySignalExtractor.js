/**
 * engine/worldModel/secondarySignalExtractor.js
 *
 * RC8.3 C2-002B — Secondary Signal Extractor.
 *
 * Pure function: normalized evidence + primary signals → secondary signal states.
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
 * @version world_model_v2
 * @sprint c2-002b
 */

const {
  SECONDARY_SIGNAL_EVIDENCE_MAP,
  getAllEvidenceContractIds,
} = require('./secondarySignalEvidenceMap')

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
// EVIDENCE MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Extracts a unique origin identifier for an evidence item.
 * Used for independence checking — two items from the same origin
 * (e.g. same questionnaire answer, same signal) are NOT independent.
 *
 * @param {Object} item - an evidence item with { sourceType, reference, originId?, id? }
 * @returns {string} unique origin key
 */
function getEvidenceOrigin(item) {
  // If the item has an explicit originId, use it
  if (item.originId) return item.originId
  // Otherwise, the origin is the combination of sourceType + reference
  return `${item.sourceType || item.type}::${item.reference || item.id || item.signalId || ''}`
}

/**
 * Checks whether an evidence item from the input matches a contract evidence reference.
 *
 * Matching rules:
 * - PRIMARY_SIGNAL: input item's signalId/id matches contract reference, AND item confidence ≥ threshold
 * - QUESTIONNAIRE: input item's field/reference matches contract reference
 * - BEHAVIORAL: input item's pattern/reference matches contract reference
 *
 * @param {Object} contractRef - { sourceType, reference, condition } from evidence map
 * @param {Object} item - input evidence or primary signal item
 * @returns {boolean} whether this item matches the contract reference
 */
function evidenceItemMatchesContract(contractRef, item) {
  // Match on sourceType
  const itemSourceType = item.sourceType || item.type || ''
  if (itemSourceType !== contractRef.sourceType) return false

  // Match on reference
  const itemRef = item.reference || item.id || item.signalId || item.field || item.pattern || ''
  if (itemRef !== contractRef.reference) return false

  // For PRIMARY_SIGNAL, check confidence threshold if the condition mentions one
  if (contractRef.sourceType === 'PRIMARY_SIGNAL') {
    const itemConfidence = typeof item.confidence === 'number' ? item.confidence : 0.5
    const itemDetected = item.detected !== false // default to true if not specified

    // Check if the condition string mentions a confidence threshold
    const condLow = contractRef.condition.toLowerCase()
    const confMatch = condLow.match(/confidence\s*[≥>=]\s*([\d.]+)/)
    if (confMatch) {
      const requiredConf = parseFloat(confMatch[1])
      if (itemConfidence < requiredConf) return false
    }

    // Handle detected/not-detected conditions
    // "detected or not-detected" → accepts either state (either detected=true or detected=false)
    // "not-detected" (alone) → requires detected === false
    // "detected" (alone) → requires detected === true
    // Use regex to distinguish standalone "detected" from "not-detected"
    const hasNotDetected = /not[\s-]?detected/i.test(condLow)
    const hasStandaloneDetected = /\bdetected\b/i.test(condLow.replace(/not[\s-]?detected/gi, ''))

    // Check if "detected" and "not-detected" are linked by "or":
    // "detected or not-detected" → accept either state
    const hasOrLinking = hasNotDetected && hasStandaloneDetected && /\bor\b/i.test(condLow)

    if (hasOrLinking) {
      // "detected or not-detected" — either state is acceptable, no filtering
    } else if (hasNotDetected) {
      // Purely "not-detected" requirement
      if (itemDetected) return false
    } else if (hasStandaloneDetected) {
      // Purely "detected" requirement
      if (!itemDetected) return false
    }
  }

  return true
}

/**
 * Matches a list of input evidence items against a list of contract evidence references.
 * Returns both matched items and their origins for independence checking.
 *
 * @param {Array} contractRefs - array of { sourceType, reference, condition }
 * @param {Array} inputItems - array of input evidence items
 * @returns {{ matched: Array<Object>, origins: Set<string> }}
 */
function matchEvidenceList(contractRefs, inputItems) {
  const matched = []
  const origins = new Set()

  for (const contractRef of contractRefs) {
    for (const item of inputItems) {
      if (evidenceItemMatchesContract(contractRef, item)) {
        matched.push({
          contractRef: {
            sourceType: contractRef.sourceType,
            reference: contractRef.reference,
          },
          item,
        })
        origins.add(getEvidenceOrigin(item))
        break // one match per contract ref
      }
    }
  }

  return { matched, origins }
}

/**
 * Checks whether two evidence items are independent (from different origins).
 *
 * @param {Object} itemA - first matched item
 * @param {Object} itemB - second matched item
 * @returns {boolean}
 */
function areEvidenceIndependent(itemA, itemB) {
  return getEvidenceOrigin(itemA.item) !== getEvidenceOrigin(itemB.item)
}

/**
 * @param {Set<string>} origins
 * @param {number} minUnique
 * @returns {boolean}
 */
function hasEnoughUniqueOrigins(origins, minUnique) {
  return origins.size >= minUnique
}

// ═══════════════════════════════════════════════════════════════
// CONTRADICTION CHECKING
// ═══════════════════════════════════════════════════════════════

const CONTRADICTION_STRENGTH = Object.freeze({
  NONE: 0,
  WEAK: 1,
  MODERATE: 2,
  STRONG: 3,
})

/**
 * Checks if a suppression trigger condition is met by the input evidence.
 * Suppression triggers are human-readable strings in the contract.
 * We check if any evidence item matches the trigger description.
 *
 * @param {string} trigger - suppression trigger description
 * @param {Object} input - the full input object { evidence, primarySignals }
 * @returns {boolean}
 */
function isSuppressionTriggerMet(trigger, input) {
  const triggerNorm = trigger.toLowerCase()
  const allItems = [...(input.primarySignals || []), ...(input.evidence || [])]

  // Pattern: "SIGNAL_ID detected ≥ X" (with or without "with confidence")
  // Matches: "DECISION_STABILITY detected ≥ 0.8"
  // Matches: "SIGNAL detected with confidence ≥ 0.8"
  const signalConfMatch = trigger.match(/([A-Z_]{3,})\s+detected\s*(?:with\s+confidence\s*)?[≥>=]\s*([\d.]+)/i)
  if (signalConfMatch) {
    const signalId = signalConfMatch[1]
    const threshold = parseFloat(signalConfMatch[2])

    for (const item of allItems) {
      const itemId = item.signalId || item.id || item.reference || ''
      if (itemId === signalId && item.detected !== false) {
        const conf = typeof item.confidence === 'number' ? item.confidence : 0.5
        if (conf >= threshold) return true
      }
    }
  }

  // Pattern: "SIGNAL_ID detected — ..." (with em-dash or hyphen)
  const signalDetectedMatch = trigger.match(/([A-Z_]{3,})\s+detected\s*[-—–]/i)
  if (signalDetectedMatch) {
    const signalId = signalDetectedMatch[1]
    for (const item of allItems) {
      const itemId = item.signalId || item.id || item.reference || ''
      if (itemId === signalId && item.detected !== false) return true
    }
  }

  // Pattern: "SIGNAL_A detected ≥ X and SIGNAL_B detected"
  // Also: "SIGNAL_A detected AND SIGNAL_B detected"
  const multiSignalMatch = trigger.match(/([A-Z_]{3,})\s+detected\s*(?:with\s+confidence\s*[≥>=]\s*[\d.]+)?[^a-zA-Z]*and\s+([A-Z_]{3,})\s+detected/i)
  if (!multiSignalMatch) {
    // Try simpler: "SIGNAL_A detected ≥ X and SIGNAL_B detected"
    const altMatch = trigger.match(/([A-Z_]{3,})\s+detected\s*[≥>=]\s*([\d.]+)\s+and\s+([A-Z_]{3,})\s+detected/i)
    if (altMatch) {
      const a = altMatch[1], aThreshold = parseFloat(altMatch[2]), b = altMatch[3]
      let aFound = false, bFound = false
      for (const item of allItems) {
        const id = item.signalId || item.id || item.reference || ''
        if (id === a && item.detected !== false && (typeof item.confidence === 'number' ? item.confidence : 0.5) >= aThreshold) aFound = true
        if (id === b && item.detected !== false) bFound = true
      }
      return aFound && bFound
    }
  } else {
    const a = multiSignalMatch[1], b = multiSignalMatch[2]
    let aFound = false, bFound = false
    for (const item of allItems) {
      const id = item.signalId || item.id || item.reference || ''
      if (id === a && item.detected !== false) aFound = true
      if (id === b && item.detected !== false) bFound = true
    }
    return aFound && bFound
  }

  // Default: no structural match found, not triggered
  return false
}

/**
 * Evaluates contradiction evidence and suppression triggers for a signal.
 *
 * @param {Object} contract - the signal's evidence contract
 * @param {Object} input - { evidence, primarySignals }
 * @returns {{ suppressed: boolean, strength: number, reason: string|null, matchedContradictory: Array }}
 */
function evaluateContradiction(contract, input) {
  const allInputItems = [...(input.evidence || []), ...(input.primarySignals || [])]

  // 1. Check contradictory evidence matches
  const { matched: contradictoryMatch, origins: contradictoryOrigins } =
    matchEvidenceList(contract.contradictoryEvidence, allInputItems)

  let contradictionStrength = CONTRADICTION_STRENGTH.NONE
  if (contradictoryMatch.length >= 2 && contradictoryOrigins.size >= 2) {
    contradictionStrength = CONTRADICTION_STRENGTH.STRONG
  } else if (contradictoryMatch.length >= 1) {
    contradictionStrength = CONTRADICTION_STRENGTH.MODERATE
  }

  // 2. Check suppression triggers
  let suppressionReason = null
  let suppressionTriggered = false

  const triggers = contract.suppressionRule.triggers || []
  for (const trigger of triggers) {
    if (isSuppressionTriggerMet(trigger, input)) {
      suppressionTriggered = true
      suppressionReason = trigger
      break
    }
  }

  // Suppression is triggered if:
  // - A suppression rule trigger fires OR
  // - Strong contradiction exists (≥ 2 independent contradictory items)
  const suppressed = suppressionTriggered || contradictionStrength === CONTRADICTION_STRENGTH.STRONG

  if (suppressed && !suppressionReason) {
    suppressionReason = `Strong contradictory evidence (${contradictoryMatch.length} items from ${contradictoryOrigins.size} origins)`
  }

  return {
    suppressed,
    strength: contradictionStrength,
    reason: suppressionReason,
    matchedContradictory: contradictoryMatch.map(m => ({
      sourceType: m.contractRef.sourceType,
      reference: m.contractRef.reference,
      evidenceId: m.item.id || m.item.reference || m.item.signalId,
    })),
  }
}

// ═══════════════════════════════════════════════════════════════
// MISSING EVIDENCE DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Determines what evidence is missing to reach activation threshold.
 *
 * @param {Object} contract
 * @param {number} requiredMatched
 * @param {number} contextualMatched
 * @param {number} strongMatched
 * @param {Set<string>} allSupportOrigins
 * @returns {{ needed: string[], type: string }}
 */
function determineMissingEvidence(contract, requiredMatched, contextualMatched, strongMatched, allSupportOrigins) {
  const needed = []
  let type = 'UNKNOWN'

  const minEvidence = contract.minimumEvidence || 2
  const totalSupport = requiredMatched + contextualMatched
  const uniqueOrigins = allSupportOrigins.size

  if (uniqueOrigins < minEvidence) {
    const gap = minEvidence - uniqueOrigins
    needed.push(`Need ${gap} more independent evidence item(s)`)
    type = 'INSUFFICIENT_INDEPENDENT_EVIDENCE'
  } else if (strongMatched >= 1 && contextualMatched >= 1) {
    // Would satisfy Mode B but isn't activating — check why
    if (uniqueOrigins < 2) {
      needed.push('Strong and contextual evidence from same origin — independence required')
      type = 'EVIDENCE_INDEPENDENCE_FAILED'
    }
  } else if (totalSupport >= 2) {
    // Has enough total but maybe not enough independence
    needed.push('Evidence items lack independence — need items from distinct origins')
    type = 'EVIDENCE_INDEPENDENCE_FAILED'
  } else if (totalSupport === 1 && strongMatched === 0) {
    needed.push('Single evidence item cannot activate — need 2 independent supporting OR 1 strong + 1 contextual')
    type = 'SINGLE_EVIDENCE_INSUFFICIENT'
  } else if (totalSupport === 0) {
    needed.push('No supporting evidence found')
    type = 'NO_SUPPORTING_EVIDENCE'
  }

  return { needed, type }
}

// ═══════════════════════════════════════════════════════════════
// CONFIDENCE CALCULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculates confidence score based ONLY on:
 * - evidence quantity
 * - evidence independence
 * - support strength (strong > required > contextual)
 * - contradiction presence
 * - evidence completeness
 *
 * Range: 0.0 – 1.0
 *
 * @param {Object} params
 * @param {number} params.requiredMatched
 * @param {number} params.contextualMatched
 * @param {number} params.strongMatched
 * @param {number} params.contradictionCount
 * @param {number} params.uniqueOrigins
 * @param {number} params.minEvidence
 * @returns {number}
 */
function calculateConfidence({
  requiredMatched,
  contextualMatched,
  strongMatched,
  contradictionCount,
  uniqueOrigins,
  minEvidence,
}) {
  if (uniqueOrigins === 0) return 0

  // Base confidence from evidence quantity and independence
  const originRatio = Math.min(uniqueOrigins / Math.max(minEvidence, 2), 1.5)
  let confidence = originRatio * 0.4 // up to 0.6 from quantity/independence

  // Bonus for strong evidence (each strong item adds weight)
  confidence += Math.min(strongMatched, 3) * 0.1 // up to 0.3

  // Bonus for contextual evidence (capped)
  confidence += Math.min(contextualMatched, 2) * 0.05 // up to 0.1

  // Penalty for contradiction (proportional to contradiction count)
  const contradictionPenalty = Math.min(contradictionCount, 3) * 0.15
  confidence -= contradictionPenalty

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100))
}

// ═══════════════════════════════════════════════════════════════
// SCORE CALCULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculates evidence strength score for the secondary signal.
 *
 * Score represents how strongly the evidence supports this signal.
 * It is NOT a Blind Spot score, Archetype score, or Strategy score.
 *
 * Range: 0.0 – 100.0
 *
 * Scoring formula:
 *   base = (requiredMatched * 25) + (contextualMatched * 15) + (strongMatched * 35)
 *   independenceBonus = (uniqueOrigins - 1) * 10 (if uniqueOrigins >= 2)
 *   contradictionPenalty = contradictionCount * 20
 *   clamped to [0, 100]
 *
 * @param {Object} params
 * @returns {number}
 */
function calculateScore({
  requiredMatched,
  contextualMatched,
  strongMatched,
  uniqueOrigins,
  contradictionCount,
}) {
  const base = (requiredMatched * 25) + (contextualMatched * 15) + (strongMatched * 35)
  const independenceBonus = Math.max(0, (uniqueOrigins - 1) * 10)
  const contradictionPenalty = contradictionCount * 20

  const raw = base + independenceBonus - contradictionPenalty
  return Math.max(0, Math.min(100, Math.round(raw)))
}

// ═══════════════════════════════════════════════════════════════
// MAIN: EVALUATE SINGLE SIGNAL
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluates one secondary signal against the input evidence.
 *
 * @param {string} signalId - the secondary signal ID
 * @param {Object} input - { evidence: Array, primarySignals: Array, context: Object }
 * @returns {Object} secondary signal state
 */
function evaluateSignal(signalId, input) {
  // Safety: handle missing input
  if (!input) input = {}

  const contract = SECONDARY_SIGNAL_EVIDENCE_MAP[signalId]
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
      trace: {
        requiredMatched: 0,
        contextualMatched: 0,
        strongMatched: 0,
        contradictionMatched: 0,
      },
    }
  }

  const allInputItems = [...(input.evidence || []), ...(input.primarySignals || [])]

  // ── Match evidence categories ──

  const { matched: requiredMatch, origins: requiredOrigins } =
    matchEvidenceList(contract.requiredEvidence, allInputItems)
  const { matched: contextualMatch, origins: contextualOrigins } =
    matchEvidenceList(contract.contextualEvidence, allInputItems)
  const { matched: strongMatch, origins: strongOrigins } =
    matchEvidenceList(contract.strongEvidence, allInputItems)

  // All supporting origins (union of required + contextual + strong)
  const allSupportOrigins = new Set([
    ...requiredOrigins,
    ...contextualOrigins,
    ...strongOrigins,
  ])

  // ── Evidence independence check ──
  // Count independent supporting evidence items
  const totalSupporting = requiredMatch.length + contextualMatch.length
  const totalStrong = strongMatch.length

  // Collect evidence IDs
  const supportingEvidenceIds = [
    ...requiredMatch.map(m => m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference),
    ...contextualMatch.map(m => m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference),
  ]
  const strongEvidenceIds = strongMatch.map(m =>
    m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference
  )

  // ── Contradiction evaluation (FIRST) ──

  const contradiction = evaluateContradiction(contract, input)

  // If suppressed, return immediately
  if (contradiction.suppressed) {
    return {
      id: signalId,
      state: SIGNAL_STATE.SUPPRESSED,
      score: Math.max(0, calculateScore({
        requiredMatched: requiredMatch.length,
        contextualMatched: contextualMatch.length,
        strongMatched: strongMatch.length,
        uniqueOrigins: allSupportOrigins.size,
        contradictionCount: contradiction.matchedContradictory.length,
      }) - 40), // extra penalty for suppression
      confidence: 0,
      supportingEvidenceIds,
      contextualEvidenceIds: contextualMatch.map(m =>
        m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference
      ),
      strongEvidenceIds,
      contradictingEvidenceIds: contradiction.matchedContradictory.map(m => m.evidenceId),
      activationMode: null,
      suppressionReason: contradiction.reason,
      insufficientEvidence: false,
      missingEvidenceNeeded: [],
      trace: {
        requiredMatched: requiredMatch.length,
        contextualMatched: contextualMatch.length,
        strongMatched: strongMatch.length,
        contradictionMatched: contradiction.matchedContradictory.length,
      },
    }
  }

  // ── Activation check ──

  let activationMode = null
  let isActive = false

  // Mode A: 2 independent supporting evidence items
  // Supporting = required + contextual (NOT strong alone for Mode A count)
  if (totalSupporting >= 2 && allSupportOrigins.size >= 2) {
    isActive = true
    activationMode = ACTIVATION_MODE.TWO_SUPPORTING
  }

  // Mode B: 1 strong + 1 contextual, independent
  if (!isActive && totalStrong >= 1 && contextualMatch.length >= 1) {
    // Check independence: strong and contextual from different origins
    const strongOrigin = strongOrigins.size > 0 ? [...strongOrigins][0] : null
    const contextualOrigin = contextualOrigins.size > 0 ? [...contextualOrigins][0] : null
    if (strongOrigin && contextualOrigin && strongOrigin !== contextualOrigin) {
      isActive = true
      activationMode = ACTIVATION_MODE.STRONG_PLUS_CONTEXT
    }
  }

  // Mode B variant: 1 strong + 1 required, independent
  if (!isActive && totalStrong >= 1 && requiredMatch.length >= 1) {
    const strongOrigin = strongOrigins.size > 0 ? [...strongOrigins][0] : null
    const requiredOrigin = requiredOrigins.size > 0 ? [...requiredOrigins][0] : null
    if (strongOrigin && requiredOrigin && strongOrigin !== requiredOrigin) {
      isActive = true
      activationMode = ACTIVATION_MODE.STRONG_PLUS_CONTEXT
    }
  }

  // ── Build result ──

  if (isActive) {
    return {
      id: signalId,
      state: SIGNAL_STATE.ACTIVE,
      score: calculateScore({
        requiredMatched: requiredMatch.length,
        contextualMatched: contextualMatch.length,
        strongMatched: strongMatch.length,
        uniqueOrigins: allSupportOrigins.size,
        contradictionCount: contradiction.matchedContradictory.length,
      }),
      confidence: calculateConfidence({
        requiredMatched: requiredMatch.length,
        contextualMatched: contextualMatch.length,
        strongMatched: strongMatch.length,
        contradictionCount: contradiction.matchedContradictory.length,
        uniqueOrigins: allSupportOrigins.size,
        minEvidence: contract.minimumEvidence || 2,
      }),
      supportingEvidenceIds,
      contextualEvidenceIds: contextualMatch.map(m =>
        m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference
      ),
      strongEvidenceIds,
      contradictingEvidenceIds: contradiction.matchedContradictory.map(m => m.evidenceId),
      activationMode,
      suppressionReason: null,
      insufficientEvidence: false,
      missingEvidenceNeeded: [],
      trace: {
        requiredMatched: requiredMatch.length,
        contextualMatched: contextualMatch.length,
        strongMatched: strongMatch.length,
        contradictionMatched: contradiction.matchedContradictory.length,
      },
    }
  }

  // ── Insufficient evidence ──

  const missing = determineMissingEvidence(
    contract,
    requiredMatch.length,
    contextualMatch.length,
    strongMatch.length,
    allSupportOrigins,
  )

  return {
    id: signalId,
    state: SIGNAL_STATE.INSUFFICIENT_EVIDENCE,
    score: Math.max(0, Math.round(calculateScore({
      requiredMatched: requiredMatch.length,
      contextualMatched: contextualMatch.length,
      strongMatched: strongMatch.length,
      uniqueOrigins: allSupportOrigins.size,
      contradictionCount: contradiction.matchedContradictory.length,
    }) / 2)), // halved when insufficient
    confidence: calculateConfidence({
      requiredMatched: requiredMatch.length,
      contextualMatched: contextualMatch.length,
      strongMatched: strongMatch.length,
      contradictionCount: contradiction.matchedContradictory.length,
      uniqueOrigins: allSupportOrigins.size,
      minEvidence: contract.minimumEvidence || 2,
    }),
    supportingEvidenceIds,
    contextualEvidenceIds: contextualMatch.map(m =>
      m.item.id || m.item.reference || m.item.signalId || m.contractRef.reference
    ),
    strongEvidenceIds,
    contradictingEvidenceIds: contradiction.matchedContradictory.map(m => m.evidenceId),
    activationMode: null,
    suppressionReason: null,
    insufficientEvidence: true,
    missingEvidenceNeeded: missing.needed,
    trace: {
      requiredMatched: requiredMatch.length,
      contextualMatched: contextualMatch.length,
      strongMatched: strongMatch.length,
      contradictionMatched: contradiction.matchedContradictory.length,
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluates all 23 secondary signals against the input evidence.
 *
 * @param {Object} input
 * @param {Array<Object>} input.evidence - normalized evidence items
 *   Each item: { sourceType: 'QUESTIONNAIRE'|'BEHAVIORAL', reference: string, id?: string, originId?: string, ... }
 * @param {Array<Object>} input.primarySignals - primary signal detection results
 *   Each item: { signalId: string, detected: boolean, confidence: number, originId?: string, ... }
 * @param {Object} [input.context] - optional context
 * @param {string} [input.context.inputHash] - hash of original input for traceability
 * @param {string} [input.context.evidenceVersion] - evidence format version
 * @returns {{
 *   signals: Array<Object>,
 *   summary: { active: number, suppressed: number, insufficient: number, total: number },
 *   meta: { timestamp: null, deterministic: true }
 * }}
 */
function evaluateAllSignals(input) {
  // Safety: handle undefined/missing input
  if (!input) input = {}
  const evidence = input.evidence || []
  const primarySignals = input.primarySignals || []

  const allSignalIds = getAllEvidenceContractIds()
  const signals = allSignalIds.map(signalId => evaluateSignal(signalId, { evidence, primarySignals }))

  const active = signals.filter(s => s.state === SIGNAL_STATE.ACTIVE).length
  const suppressed = signals.filter(s => s.state === SIGNAL_STATE.SUPPRESSED).length
  const insufficient = signals.filter(s => s.state === SIGNAL_STATE.INSUFFICIENT_EVIDENCE).length

  return {
    signals,
    summary: {
      active,
      suppressed,
      insufficient,
      total: signals.length,
    },
    meta: {
      timestamp: null,
      deterministic: true,
      evidenceVersion: (input.context && input.context.evidenceVersion) || 'world_model_v2',
    },
  }
}

/**
 * Evaluates a single secondary signal by ID.
 *
 * @param {string} signalId
 * @param {Object} input - { evidence, primarySignals }
 * @returns {Object} secondary signal state
 */
function evaluateSignalById(signalId, input) {
  return evaluateSignal(signalId, input)
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Main API
  evaluateAllSignals,
  evaluateSignalById,

  // Constants
  SIGNAL_STATE,
  ACTIVATION_MODE,

  // Internal utilities (exported for testing)
  evidenceItemMatchesContract,
  matchEvidenceList,
  areEvidenceIndependent,
  getEvidenceOrigin,
  evaluateContradiction,
  isSuppressionTriggerMet,
  determineMissingEvidence,
  calculateConfidence,
  calculateScore,
}
