/**
 * engine/worldModel/v2_1/responseValidityV21.js
 *
 * World Model v2.1 — Response Validity Gate (Stage19B-2).
 *
 * SHADOW ONLY. An independent response-validity layer that determines whether a
 * submitted response pattern is structurally usable for cognition inference.
 * This layer is a GATE, not an inference engine: it never produces cognitive
 * meaning (no blindspot / dimension / primary / probability / wealth).
 *
 * Authority:
 *   - docs/RC8.3_STAGE18_R3_WORLD_OS_CONTRACT_REPAIR.md §B (Response Validity Layer)
 *   - docs/RC8.3_STAGE18_R3B_RESPONSE_VALIDITY_ADDENDUM.md (deterministic formulas)
 *   - docs/RC8.3_STAGE18_R3C_DISPLAY_POSITION_SOURCE_ADDENDUM.md (position source)
 *   - docs/RC8.3_STAGE18_R3C_R1_RESPONSE_VALIDITY_VERDICT_CLOSURE.md (verdict closure)
 *   Authority priority: R3C-R1 > R3C > R3B > R3A > R3 > R2 > R1.
 *
 * FROZEN RULES:
 *   - Position source = DISPLAY_POSITION (R3C). displayPosition ∈ {0,1,2,3}
 *     (0-based integer). The semantic-optionId position fallback from R3B §2 is
 *     ABOLISHED for v2.1. Never infer displayPosition from optionId.
 *   - Strict data separation: optionId → cognition only; displayPosition →
 *     response-validity only. No cross-channel paths.
 *   - Verdict tree (R3C-R1 §11 precedence, deterministic):
 *       STEP 1 — STRUCTURAL SUFFICIENCY (highest priority):
 *         n == 0 | n < 4 | duplicate questionId | missing displayPosition |
 *         invalid displayPosition → INSUFFICIENT_RESPONSE_QUALITY
 *       STEP 2 — POSITION QUALITY (only if STEP 1 passes):
 *         all_same | alternating | sequential → RESPONSE_QUALITY_LOW
 *       STEP 3 — otherwise → RESPONSE_VALID
 *   - Mechanical patterns (R3B §4, applied to canonical position sequence):
 *       all_same    : n ≥ 1 AND ∀i L[i]==L[0]   (⟺ SAME_POSITION_RATE==1.0 AND ENTROPY==0)
 *       alternating : n ≥ 4 AND |distinct(L)|==2 AND ∀i L[i]==L[i%2]
 *       sequential  : n ≥ 4 AND ∀i L[i]==SEQ[i%4], SEQ=[0,1,2,3]
 *   - Single suspicious signal never auto-triggers LOW; LOW only from the
 *     frozen mechanical patterns (joint conditions), never from single-signal
 *     rules like "entropy < X".
 *   - Missing / invalid displayPosition → position-derived signals = UNKNOWN
 *     AND structural insufficiency → INSUFFICIENT_RESPONSE_QUALITY (R3C-R1
 *     fail-closed; never RESPONSE_VALID, never fabricated LOW).
 *   - Duplicate questionId → INSUFFICIENT_RESPONSE_QUALITY (R3C-R1 §8). It is
 *     NOT a cognitive signal, never silently deduplicated, never take first/last.
 *   - Deferred signals (R3B §6.3): COMPLETION_TIME_ANOMALY,
 *     DUPLICATE_SCENARIO_INCONSISTENCY, and SEMANTIC_CONTRADICTION_RATE are
 *     DEFERRED_NOT_OBSERVABLE here (need runtime timing / paired observations /
 *     semantic H+D evidence outside this layer's structural input). Never
 *     fabricated, never gating in shadow.
 *   - Order invariance: the same response set in any serialization order yields
 *     identical output (the position sequence is canonicalized by questionId).
 *
 * Output has NO cognition fields: no blindspotId, no primaryConstruct, no
 * dimensionState, no candidate score, no probability, no confidence %, no
 * wealth fields.
 *
 * @version world_model_v2_1
 */

const RESPONSE_VALIDITY_POSITION_SOURCE = 'DISPLAY_POSITION'

// Closed validity status set (R3B §5 / R3 §B).
const VALIDITY_STATUS_SET_V21 = Object.freeze([
  'RESPONSE_VALID',
  'RESPONSE_QUALITY_LOW',
  'INSUFFICIENT_RESPONSE_QUALITY',
])

// displayPosition valid values (R3C §5, 0-based integer).
const DISPLAY_POSITION_VALID_VALUES = Object.freeze([0, 1, 2, 3])
const DISPLAY_POSITION_SEQ = [0, 1, 2, 3] // sequential pattern reference

// R3B §5: minimum responses for full assessment.
const MIN_RESPONSES = 4

// ── Pure helpers ───────────────────────────────────────────────────────────
function isValidDisplayPosition(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3
}

function shannonEntropyBase2(freqs, n) {
  if (!Number.isFinite(n) || n <= 0) return 0
  let h = 0
  for (const f of freqs) {
    if (!f) continue
    const p = f / n
    h -= p * Math.log2(p)
  }
  return h
}

// ── Mechanical pattern detection (R3B §4, on canonical integer sequence) ──
function detectPatterns(L) {
  const n = L.length
  const patterns = []
  if (n >= 1 && L.every((v) => v === L[0])) {
    patterns.push('all_same')
  }
  if (n >= 4 && new Set(L).size === 2 && L.every((v, i) => v === L[i % 2])) {
    patterns.push('alternating')
  }
  if (n >= 4 && L.every((v, i) => v === DISPLAY_POSITION_SEQ[i % 4])) {
    patterns.push('sequential')
  }
  return patterns
}

/**
 * Assess structural response validity for a set of base-question responses.
 *
 * @param {Array<{questionId:string, optionId:string, displayPosition?:number}>} responses
 * @returns {object}
 *   {
 *     status,           // RESPONSE_VALID | RESPONSE_QUALITY_LOW | INSUFFICIENT_RESPONSE_QUALITY
 *     reasons,          // deterministic reason codes
 *     observedSignals,  // [{ signal, value, status }]  (R3B position signals + flags)
 *     deferredSignals,  // [{ signal, status:'DEFERRED_NOT_OBSERVABLE', reason }]
 *     counts,           // deterministic structural counts
 *     trace,            // deterministic step trace
 *   }
 */
function assessResponseValidityV21(responses) {
  const trace = [{ step: 'INPUT', kind: Array.isArray(responses) ? 'array' : typeof responses }]
  const raw = Array.isArray(responses) ? responses : []

  const reasons = []
  const flags = new Set()
  const entries = []

  let malformedCount = 0

  for (const r of raw) {
    const isAnswered =
      r && typeof r === 'object' &&
      typeof r.questionId === 'string' && r.questionId.length > 0 &&
      typeof r.optionId === 'string' && r.optionId.length > 0
    if (!isAnswered) {
      malformedCount += 1
      flags.add('MALFORMED_SUBMISSION')
      continue
    }
    entries.push({
      questionId: r.questionId,
      optionId: r.optionId,
      displayPosition: r.displayPosition,
    })
  }

  const n = entries.length

  // ── Duplicate questionId detection (R3C-R1 §8: structural insufficiency) ──
  const qCount = new Map()
  for (const e of entries) qCount.set(e.questionId, (qCount.get(e.questionId) || 0) + 1)
  const duplicateQuestionIds = [...qCount.entries()].filter(([, c]) => c > 1).map(([q]) => q)
  if (duplicateQuestionIds.length > 0) {
    flags.add('DUPLICATE_QUESTION_SUBMISSION')
  }

  // ── displayPosition classification (R3C) ────────────────────────────────
  let positionValidCount = 0
  let positionMissingCount = 0
  let positionInvalidCount = 0
  let positionUnknown = false

  for (const e of entries) {
    const p = e.displayPosition
    if (p === undefined || p === null) {
      positionMissingCount += 1
      positionUnknown = true
      flags.add('MISSING_DISPLAY_POSITION')
    } else if (!isValidDisplayPosition(p)) {
      positionInvalidCount += 1
      positionUnknown = true
      flags.add('INVALID_DISPLAY_POSITION')
    } else {
      positionValidCount += 1
    }
  }

  // ── Canonical position sequence (order-invariant: sort by questionId) ────
  const canonical = [...entries].sort((a, b) => {
    if (a.questionId < b.questionId) return -1
    if (a.questionId > b.questionId) return 1
    if (a.optionId < b.optionId) return -1
    if (a.optionId > b.optionId) return 1
    return 0
  })

  // Position-derived signals computable ONLY when every answered entry has a
  // valid displayPosition (R3C §6: else UNKNOWN).
  const L = positionUnknown ? null : canonical.map((e) => e.displayPosition)

  let samePositionRate = null
  let answerEntropy = null
  let detectedPatterns = []

  if (L !== null && L.length > 0) {
    const freq = new Map()
    for (const v of L) freq.set(v, (freq.get(v) || 0) + 1)
    const freqs = [...freq.values()]
    const maxFreq = Math.max(...freqs)
    samePositionRate = maxFreq / L.length
    answerEntropy = shannonEntropyBase2(freqs, L.length)
    detectedPatterns = detectPatterns(L)
  }

  // ── Verdict tree (R3C-R1 §11 precedence, deterministic) ────────────────
  // STEP 1 — STRUCTURAL SUFFICIENCY (highest priority).
  // STEP 2 — POSITION QUALITY (mechanical patterns).
  // STEP 3 — otherwise.
  let status
  let verdictReason

  const structuralInsufficiency =
    n === 0 ||
    n < MIN_RESPONSES ||
    duplicateQuestionIds.length > 0 ||
    positionMissingCount > 0 ||
    positionInvalidCount > 0

  if (structuralInsufficiency) {
    status = 'INSUFFICIENT_RESPONSE_QUALITY'
    if (n === 0) verdictReason = 'EMPTY_RESPONSE'
    else if (n < MIN_RESPONSES) verdictReason = 'SPARSE_RESPONSE'
    else if (duplicateQuestionIds.length > 0) verdictReason = 'DUPLICATE_QUESTION_SUBMISSION'
    else if (positionMissingCount > 0 && positionInvalidCount === 0) verdictReason = 'MISSING_DISPLAY_POSITION'
    else if (positionInvalidCount > 0 && positionMissingCount === 0) verdictReason = 'INVALID_DISPLAY_POSITION'
    else verdictReason = 'STRUCTURAL_INSUFFICIENCY'
  } else if (detectedPatterns.length > 0) {
    status = 'RESPONSE_QUALITY_LOW'
    verdictReason = detectedPatterns.includes('all_same')
      ? 'MECHANICAL_PATTERN_ALL_SAME'
      : detectedPatterns.includes('alternating')
        ? 'MECHANICAL_PATTERN_ALTERNATING'
        : 'MECHANICAL_PATTERN_SEQUENTIAL'
  } else {
    status = 'RESPONSE_VALID'
    verdictReason = 'NO_MECHANICAL_PATTERN'
  }

  reasons.push(verdictReason)
  for (const f of flags) reasons.push(f)

  // ── Observed signals ─────────────────────────────────────────────────────
  const observedSignals = []
  if (samePositionRate !== null) {
    observedSignals.push({ signal: 'SAME_POSITION_RATE', value: samePositionRate, status: 'OBSERVED' })
    observedSignals.push({ signal: 'ANSWER_ENTROPY', value: answerEntropy, status: 'OBSERVED' })
  } else {
    observedSignals.push({ signal: 'SAME_POSITION_RATE', value: null, status: 'UNKNOWN' })
    observedSignals.push({ signal: 'ANSWER_ENTROPY', value: null, status: 'UNKNOWN' })
  }
  for (const p of detectedPatterns) {
    observedSignals.push({ signal: `PATTERN_${p.toUpperCase()}`, value: true, status: 'OBSERVED' })
  }
  for (const f of flags) {
    observedSignals.push({ signal: f, value: true, status: 'OBSERVED' })
  }

  // ── Deferred signals (never fabricated, never gating in shadow) ─────────
  const deferredSignals = [
    {
      signal: 'SEMANTIC_CONTRADICTION_RATE',
      status: 'DEFERRED_NOT_OBSERVABLE',
      reason: 'requires semantic H+D evidence outside structural response input',
    },
    {
      signal: 'COMPLETION_TIME_ANOMALY',
      status: 'DEFERRED_NOT_OBSERVABLE',
      reason: 'requires runtime timing metadata',
    },
    {
      signal: 'DUPLICATE_SCENARIO_INCONSISTENCY',
      status: 'DEFERRED_NOT_OBSERVABLE',
      reason: 'requires paired-observation scenario metadata',
    },
  ]

  const counts = {
    totalEntries: raw.length,
    answered: n,
    malformedEntries: malformedCount,
    distinctQuestions: qCount.size,
    duplicateQuestionCount: duplicateQuestionIds.length,
    positionValidCount,
    positionMissingCount,
    positionInvalidCount,
    distinctPositions: L === null ? null : new Set(L).size,
  }

  trace.push({ step: 'ANSWERED_COUNT', n })
  trace.push({ step: 'POSITION_CLASSIFICATION', positionValidCount, positionMissingCount, positionInvalidCount })
  trace.push({ step: 'POSITION_SEQUENCE', canonicalized: true, positionUnknown })
  trace.push({ step: 'PATTERN_DETECTION', detectedPatterns: [...detectedPatterns] })
  trace.push({ step: 'VERDICT', status, verdictReason })

  return {
    status,
    reasons: [...new Set(reasons)],
    observedSignals,
    deferredSignals,
    counts,
    trace,
  }
}

module.exports = {
  RESPONSE_VALIDITY_POSITION_SOURCE,
  VALIDITY_STATUS_SET_V21,
  DISPLAY_POSITION_VALID_VALUES,
  MIN_RESPONSES,
  isValidDisplayPosition,
  shannonEntropyBase2,
  detectPatterns,
  assessResponseValidityV21,
}
