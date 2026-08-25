/**
 * engine/worldModel/v2/blindSpotEngineV2.js
 *
 * World Model v2 — 9 blind spots. Each maps 1:1 to a dimension; gap score =
 * 1 - dimension score. Normal inference is pure gap-score ranking — NO
 * ontology priority in the normal path. Tie-break is a deterministic id
 * offset used only for truly near-identical gaps.
 *
 * @version world_model_v2
 */

// 9 blind spots (frozen). dimension = source dimension; nearNeighbors for
// reporting/discrimination only (never used to force selection).
const BLIND_SPOT_DEFINITIONS_V2 = Object.freeze([
  { id: 'DECISION_INERTIA',       label: '决策惯性',   dimension: 'DECISION_MODEL',    nearNeighbors: ['FEEDBACK_LOOP_GAP'] },
  { id: 'FEEDBACK_LOOP_GAP',      label: '反馈回路断裂', dimension: 'FEEDBACK_MODEL',    nearNeighbors: ['DECISION_INERTIA'] },
  { id: 'PROBABILITY_MISJUDGMENT', label: '概率误判',  dimension: 'PROBABILITY_MODEL', nearNeighbors: ['DECISION_INERTIA'] },
  { id: 'RISK_MODEL_DISTORTION',  label: '风险模型失真', dimension: 'RISK_MODEL',        nearNeighbors: ['TIME_HORIZON_TRAP'] },
  { id: 'LEVERAGE_MODEL_GAP',     label: '杠杆模型缺失', dimension: 'LEVERAGE_MODEL',    nearNeighbors: ['TIME_HORIZON_TRAP', 'OPPORTUNITY_BLINDNESS'] },
  { id: 'TIME_HORIZON_TRAP',      label: '时间视野陷阱', dimension: 'TIME_MODEL',        nearNeighbors: ['SYSTEM_THINKING_GAP', 'LEVERAGE_MODEL_GAP'] },
  { id: 'IDENTITY_CONSTRAINT',    label: '身份锁定',   dimension: 'IDENTITY_MODEL',    nearNeighbors: ['OPPORTUNITY_BLINDNESS'] },
  { id: 'OPPORTUNITY_BLINDNESS',  label: '机会盲区',   dimension: 'OPPORTUNITY_MODEL', nearNeighbors: ['IDENTITY_CONSTRAINT'] },
  { id: 'SYSTEM_THINKING_GAP',    label: '系统思维缺失', dimension: 'SYSTEMS_MODEL',     nearNeighbors: ['TIME_HORIZON_TRAP'] },
])

function computeIdOffsetV2(id) {
  var h = 0
  for (var i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h % 100) / 1000000 // micro offset, only for true numeric ties
}

/**
 * Infer primary blind spot from dimension scores.
 * Returns full candidate list with rawScore / rawGap / confidence / tie info.
 */
function inferBlindSpotV2(dimensions, normalizedEvidence) {
  var candidates = BLIND_SPOT_DEFINITIONS_V2.map(function (bs) {
    var dim = dimensions[bs.dimension] || {}
    var score = dim.score
    var gap = (score === null || score === undefined)
      ? null // UNKNOWN — no evidence, not a blindspot
      : Math.max(0, Math.min(1, 1 - score))
    return {
      id: bs.id,
      label: bs.label,
      dimension: bs.dimension,
      dimensionScore: score,
      gapScore: gap,
      nearNeighbors: bs.nearNeighbors,
    }
  })

  // Only evidence-bearing blindspots are eligible for primary. Unknown ones
  // sort last.
  candidates.sort(function (a, b) {
    var ga = a.gapScore, gb = b.gapScore
    if (ga === null && gb === null) return 0
    if (ga === null) return 1
    if (gb === null) return -1
    if (Math.abs(ga - gb) < 1e-9) {
      return computeIdOffsetV2(a.id) - computeIdOffsetV2(b.id)
    }
    return gb - ga
  })

  var primary = candidates[0]
  var second = candidates[1]

  if (primary.gapScore === null) {
    // No evidence at all — insufficient input, no blindspot.
    return {
      id: null,
      primary: null,
      label: '证据不足',
      dimension: null,
      gapScore: null,
      confidence: 0,
      rawGap: null,
      tieDetected: false,
      tieBrokenBy: null,
      candidates: candidates,
      insufficient: true,
    }
  }

  var rawGap = (second && second.gapScore !== null) ? Math.abs(primary.gapScore - second.gapScore) : 1
  var tieDetected = rawGap < 1e-9 // only truly identical gaps
  var tieBrokenBy = tieDetected ? 'ID_OFFSET' : null

  var coverage = normalizedEvidence.coverageRatio || 0
  var confidence = Math.max(0, Math.min(0.95, primary.gapScore * 0.6 + coverage * 0.4))

  return {
    id: primary.id,
    primary: primary.id,
    label: primary.label,
    dimension: primary.dimension,
    gapScore: Math.round(primary.gapScore * 100000) / 100000,
    confidence: Math.round(confidence * 1000) / 1000,
    rawGap: Math.round(rawGap * 100000) / 100000,
    tieDetected: tieDetected,
    tieBrokenBy: tieBrokenBy,
    candidates: candidates.map(function (c) {
      return {
        id: c.id,
        gapScore: c.gapScore === null ? null : Math.round(c.gapScore * 100000) / 100000,
        dimensionScore: c.dimensionScore === null ? null : Math.round(c.dimensionScore * 100000) / 100000,
      }
    }),
  }
}

module.exports = {
  inferBlindSpotV2,
  BLIND_SPOT_DEFINITIONS_V2,
  computeIdOffsetV2,
}
