/**
 * engine/worldModel/cognitiveBlindSpotEngineV2.js
 *
 * Deterministic cognitive blind spot inference from world model
 * dimensions and behavior signals.
 *
 * Blind spots describe what the user CANNOT SEE in their own world model.
 * They are structural cognitive gaps — NOT commercial phenomena.
 *
 * CRITICAL: TRAFFIC, SELLING, PRODUCT, PRICING, SINGLE_INCOME, BUILD_IP
 * are PROHIBITED as blind spot IDs.
 *
 * SCORING PRINCIPLE:
 * - rawScore = true diagnostic evidence score (NO idOffset, NO tie-break padding)
 * - rankScore = deterministic ordering score (MAY include fixed micro-offset)
 * - ambiguity = derived from rawScore gap only
 * - confidence = derived from real evidence, counter-evidence, raw gap only
 *
 * @version world_model_v1
 */

const { BLIND_SPOT_DEFINITIONS, PROHIBITED_BLIND_SPOTS } = require('./blindSpotDefinitions')
const { calculateBlindSpotConfidence, buildUncertainty } = require('./confidenceCalculator')

// ═══════════════════════════════════════════════════════════════
// Fixed ontology priority — used ONLY as last-resort tie-break
// when raw evidence cannot distinguish two blind spots.
// This is NOT evidence. It is declared as tieBrokenBy="FIXED_ONTOLOGY_PRIORITY".
// ═══════════════════════════════════════════════════════════════

const ONTOLOGY_PRIORITY = [
  'FEEDBACK_LOOP_GAP',
  'DECISION_INERTIA',
  'RISK_MODEL_DISTORTION',
  'PROBABILITY_MISJUDGMENT',
  'TIME_HORIZON_TRAP',
  'OPPORTUNITY_BLINDNESS',
  'IDENTITY_CONSTRAINT',
  'LEVERAGE_MODEL_GAP',
  'SYSTEM_THINKING_GAP',
]

function ontologyPriority(aid) {
  var idx = ONTOLOGY_PRIORITY.indexOf(aid)
  return idx >= 0 ? idx : ONTOLOGY_PRIORITY.length
}

// ═══════════════════════════════════════════════════════════════
// ID-based tie-break offset — 0.00001–0.00099 range
// Purely for deterministic sort stability. Never affects confidence.
// ═══════════════════════════════════════════════════════════════

function computeIdOffset(bid) {
  var idHash = 0
  for (var h = 0; h < bid.length; h++) {
    idHash = ((idHash << 5) - idHash) + bid.charCodeAt(h)
    idHash = idHash & idHash
  }
  return Math.abs(idHash % 100) / 100000
}

// ═══════════════════════════════════════════════════════════════
// Main engine
// ═══════════════════════════════════════════════════════════════

function inferBlindSpot(worldModel, signalResult) {
  var allSignals = signalResult.signals || []
  var signalScoreMap = {}

  allSignals.forEach(function(sig) {
    // SUPPRESSED signals still carry residual evidence weight
    var weight = sig.state === 'SUPPRESSED' ? 0.3 : 1.0
    signalScoreMap[sig.id] = sig.score * weight
  })

  var blindSpotIds = Object.keys(BLIND_SPOT_DEFINITIONS)
  var candidates = []

  blindSpotIds.forEach(function(bid) {
    if (PROHIBITED_BLIND_SPOTS.indexOf(bid) >= 0) return

    var bs = BLIND_SPOT_DEFINITIONS[bid]
    if (!bs || !bs.signalProfile) return

    var supporting = bs.signalProfile.supporting || []
    var contradicting = bs.signalProfile.contradicting || []

    var supScore = 0, supCount = 0, supSignals = []
    var conScore = 0, conCount = 0, conSignals = []

    supporting.forEach(function(sigId) {
      var s = signalScoreMap[sigId]
      if (s !== undefined && s > 0.08) { supScore += s; supCount++; supSignals.push(sigId) }
    })

    contradicting.forEach(function(sigId) {
      var s = signalScoreMap[sigId]
      if (s !== undefined && s > 0.4) { conScore += s; conCount++; conSignals.push(sigId) }
    })

    if (supCount < 1) supScore *= supCount * 0.5

    // ═══ rawScore: PURE diagnostic evidence score ═══
    var avgSupStr = supCount > 0 ? supScore / supCount : 0
    var evidenceScore = supCount === 0 ? 0
      : avgSupStr * Math.min(1, supCount / Math.max(1, supporting.length))

    var contradictionPenalty = conScore * 0.3

    // rawScore = evidenceScore / (1 + contradictionPenalty)
    // Does NOT include idOffset. Does NOT include micro-modifiers.
    // This is the truthful diagnostic signal strength.
    var rawScore = evidenceScore / (1 + contradictionPenalty)

    // evidenceScore and contradictionPenalty exposed for audit
    var relevantDim = getRelevantDimension(bs, worldModel)

    candidates.push({
      id: bid,
      label: bs.label,

      // Truthful diagnostic metrics
      rawScore: rawScore,
      evidenceScore: evidenceScore,
      contradictionPenalty: contradictionPenalty,

      // Supporting fields
      supCount: supCount,
      conCount: conCount,
      supportingSignals: supSignals,
      contradictingSignals: conSignals,
      dimensionScore: relevantDim ? relevantDim.score : 0,
    })
  })

  // ═══ Rank candidates — rawScore first, then secondary factors ═══
  // rankScore = rawScore + evidenceScore*0.01 + supCount/10000 + idOffset
  // All tie-breaks are transparently labeled

  candidates.forEach(function(c) {
    c._supRatio = c.supCount / Math.max(1,
      ((BLIND_SPOT_DEFINITIONS[c.id] || {}).signalProfile || {}).supporting
        ? ((BLIND_SPOT_DEFINITIONS[c.id] || {}).signalProfile || {}).supporting.length : 1)
    c._idOffset = computeIdOffset(c.id)

    // rankScore for deterministic ordering
    c.rankScore = c.rawScore
      + c.evidenceScore * 0.001         // evidence precision tie-break
      + (1 - c.dimensionScore) * 0.0001 // weaker dimension = slightly more likely
      + c.supCount * 0.00001            // more supporting signals = slightly stronger
      - c.conCount * 0.000005           // fewer counter signals = slightly stronger
      + c._idOffset
  })

  candidates.sort(function(a, b) {
    return b.rankScore - a.rankScore
  })

  var primary = candidates[0]
  if (!primary) return buildEmptyBlindSpot()

  // ═══ Detect ties and classify ═══
  var second = candidates[1]
  var rawGap = second ? Math.abs(primary.rawScore - second.rawScore) : Infinity
  var rankGap = second ? Math.abs(primary.rankScore - second.rankScore) : Infinity
  var rawExactTie = second && rawGap < 1e-10
  var rankExactTie = second && rankGap < 1e-10
  var tieBrokenBy = null

  if (rawExactTie) {
    tieBrokenBy = 'FIXED_ONTOLOGY_PRIORITY'
    // Fallback: use ontology priority to select primary
    if (ontologyPriority(primary.id) > ontologyPriority(second.id)) {
      // Swap — second has higher ontology priority
      var tmp = primary
      primary = second
      second = tmp
      // Re-sort candidates too
      candidates.sort(function(a, b) {
        if (a.id === primary.id && b.id !== primary.id) return -1
        if (b.id === primary.id && a.id !== primary.id) return 1
        return b.rankScore - a.rankScore
      })
    }
  } else if (rankExactTie) {
    tieBrokenBy = 'ID_OFFSET'
  }

  // ═══ Ambiguity: based on rawScore gap ONLY ═══
  var ambiguity = false
  var reCalcRawGap = second ? Math.abs(primary.rawScore - second.rawScore) : Infinity
  if (reCalcRawGap < 0.02) {
    ambiguity = true
  }

  // ═══ Confidence: based on real evidence + raw gap ONLY ═══
  var confidence = calculateBlindSpotConfidence(
    primary.supportingSignals.map(function(sid) {
      return { id: sid, confidence: signalScoreMap[sid] || 0.3 }
    }),
    primary.contradictingSignals.map(function(sid) {
      return { id: sid, confidence: signalScoreMap[sid] || 0.3 }
    }),
    primary.dimensionScore
  )

  // Strong counter-evidence suppresses confidence
  if (primary.conCount > primary.supCount) {
    confidence = Math.min(confidence, 0.25)
  }

  var bsDef = BLIND_SPOT_DEFINITIONS[primary.id]

  // ═══ Build output candidate scores ═══
  var outputCandidates = candidates.map(function(c) {
    return {
      id: c.id,
      rawScore: Math.round(c.rawScore * 100000) / 100000,
      rankScore: Math.round(c.rankScore * 100000) / 100000,
      evidenceScore: Math.round(c.evidenceScore * 100000) / 100000,
      contradictionPenalty: Math.round(c.contradictionPenalty * 100000) / 100000,
      tieBreakOffset: c._idOffset,
      supCount: c.supCount,
      conCount: c.conCount,
      dimensionScore: Math.round(c.dimensionScore * 100) / 100,
    }
  })

  return {
    id: primary.id,
    label: bsDef ? bsDef.label : primary.id,
    confidence: confidence,
    mechanism: bsDef ? bsDef.mechanism : '',
    evidence: primary.supportingSignals,
    counterEvidence: primary.contradictingSignals,
    whyItMatters: bsDef ? bsDef.questionAnswered : '',
    uncertainty: buildUncertainty(primary.supCount, primary.conCount, primary.rawScore),

    // Truthful tie/ambiguity reporting
    ambiguity: ambiguity,
    rawGap: Math.round(reCalcRawGap * 100000) / 100000,
    tieDetected: rawExactTie || rankExactTie,
    tieBrokenBy: tieBrokenBy,

    candidateScores: outputCandidates,
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function getRelevantDimension(bs, worldModel) {
  var map = {
    OPPORTUNITY_BLINDNESS: 'OPPORTUNITY_MODEL',
    FEEDBACK_LOOP_GAP: 'FEEDBACK_MODEL',
    DECISION_INERTIA: 'DECISION_MODEL',
    RISK_MODEL_DISTORTION: 'RISK_MODEL',
    PROBABILITY_MISJUDGMENT: 'PROBABILITY_MODEL',
    IDENTITY_CONSTRAINT: 'IDENTITY_MODEL',
    LEVERAGE_MODEL_GAP: 'LEVERAGE_MODEL',
    SYSTEM_THINKING_GAP: 'DECISION_MODEL',
    TIME_HORIZON_TRAP: 'TIME_MODEL',
  }
  var dimId = map[bs.id]
  if (dimId && worldModel[dimId]) return worldModel[dimId]
  return null
}

function buildEmptyBlindSpot() {
  return {
    id: 'FEEDBACK_LOOP_GAP',
    label: '反馈回路断裂',
    confidence: 0.1,
    mechanism: 'Insufficient data for confident blind spot diagnosis.',
    evidence: [],
    counterEvidence: [],
    whyItMatters: '充足的诊断数据是发现认知漏洞的前提。',
    uncertainty: '当前数据不足以确定主要认知漏洞。建议完成更多诊断问题。',
    ambiguity: true,
    rawGap: 0,
    tieDetected: false,
    tieBrokenBy: null,
    candidateScores: [],
  }
}

module.exports = {
  inferBlindSpot,
  ONTOLOGY_PRIORITY,
  computeIdOffset,
  ontologyPriority,
}
