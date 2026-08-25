/**
 * engine/worldModel/v2/dimensionEngineV2.js
 *
 * World Model v2 — 9 independent cognitive dimensions.
 * SYSTEMS_MODEL is a standalone 9th dimension (NOT mapped onto DECISION_MODEL).
 *
 * Each dimension aggregates its frozen input signals into a "healthy" score
 * (0..1). State thresholds are frozen.
 *
 * @version world_model_v2
 */

const STATE_THRESHOLDS_V2 = Object.freeze({ WEAK: 0.3, DEVELOPING: 0.5, FUNCTIONAL: 0.7 })

// 9 dimensions. Each lists input signals with an optional 'invert' flag
// (used for deficit-direction signals such as SIG_ACTION_LATENCY).
const DIMENSION_DEFINITIONS_V2 = Object.freeze([
  { id: 'DECISION_MODEL',    label: '决策模型',     inputs: [ { signal: 'SIG_EXPERIMENTATION' },   { signal: 'SIG_ACTION_LATENCY', invert: true } ] },
  { id: 'FEEDBACK_MODEL',    label: '反馈模型',     inputs: [ { signal: 'SIG_POST_REVIEW' },        { signal: 'SIG_FEEDBACK_SEEKING' } ] },
  { id: 'PROBABILITY_MODEL', label: '概率模型',     inputs: [ { signal: 'SIG_PROBABILISTIC' },      { signal: 'SIG_BASE_RATE_USAGE' } ] },
  { id: 'RISK_MODEL',        label: '风险模型',     inputs: [ { signal: 'SIG_REVERSIBILITY' },      { signal: 'SIG_DOWNSIDE_CALC' } ] },
  { id: 'LEVERAGE_MODEL',    label: '杠杆模型',     inputs: [ { signal: 'SIG_REPEATABLE_VALUE' },   { signal: 'SIG_SYSTEM_LEVERAGE' } ] },
  { id: 'TIME_MODEL',        label: '时间配置模型', inputs: [ { signal: 'SIG_COMPOUNDING' },        { signal: 'SIG_DIRECTION_PERSIST' } ] },
  { id: 'IDENTITY_MODEL',    label: '身份模型',     inputs: [ { signal: 'SIG_CAPABILITY_FRAMING' }, { signal: 'SIG_BOUNDARY_CROSSING' } ] },
  { id: 'OPPORTUNITY_MODEL', label: '机会识别模型', inputs: [ { signal: 'SIG_EXPOSURE_BREADTH' },   { signal: 'SIG_NETWORK_DIVERSITY' } ] },
  { id: 'SYSTEMS_MODEL',     label: '系统思维模型', inputs: [ { signal: 'SIG_SYSTEM_FRAMING' },     { signal: 'SIG_ROOT_CAUSE' } ] },
])

function determineStateV2(score) {
  if (score >= STATE_THRESHOLDS_V2.FUNCTIONAL) return 'STRONG'
  if (score >= STATE_THRESHOLDS_V2.DEVELOPING) return 'FUNCTIONAL'
  if (score >= STATE_THRESHOLDS_V2.WEAK) return 'DEVELOPING'
  return 'WEAK'
}

/**
 * Build 9 dimension scores from v2 signals.
 * Signals with no evidence (score === null) are SKIPPED. If a dimension has
 * no evidence-bearing signal, its score is null (UNKNOWN) — never treated as
 * WEAK/deficit.
 */
function buildDimensionsV2(signals) {
  var dims = {}
  DIMENSION_DEFINITIONS_V2.forEach(function (dim) {
    var vals = []
    dim.inputs.forEach(function (inp) {
      var sig = signals[inp.signal]
      if (!sig || sig.score === null) return // skip unknown (no evidence)
      var v = inp.invert ? (1 - sig.score) : sig.score
      vals.push(v)
    })
    if (vals.length === 0) {
      dims[dim.id] = {
        id: dim.id,
        label: dim.label,
        score: null, // UNKNOWN — no evidence
        state: 'UNKNOWN',
        inputs: dim.inputs.map(function (i) { return i.signal }),
      }
      return
    }
    var sum = 0
    vals.forEach(function (v) { sum += v })
    var score = Math.max(0, Math.min(1, sum / vals.length))
    dims[dim.id] = {
      id: dim.id,
      label: dim.label,
      score: score,
      state: determineStateV2(score),
      inputs: dim.inputs.map(function (i) { return i.signal }),
    }
  })
  return dims
}

module.exports = {
  buildDimensionsV2,
  determineStateV2,
  STATE_THRESHOLDS_V2,
  DIMENSION_DEFINITIONS_V2,
}
