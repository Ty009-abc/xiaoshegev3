/**
 * engine/worldModel/v2/signalExtractorV2.js
 *
 * World Model v2 — 18 frozen behavior signals, each aggregating atomic
 * evidence. No missingness proxy. No `|| 0.3` / `|| 0.5` fallbacks.
 * No implicit English-key aliases. Fully deterministic.
 *
 * @version world_model_v2
 */

const { aggregateStrengthV2, clamp } = require('./evidenceNormalizerV2')

// 18 signals (frozen). Each maps supporting / contradicting evidence ids.
// direction: 'healthy' = high is good; 'deficit' = high is a gap.
const SIGNAL_DEFINITIONS_V2 = Object.freeze([
  { id: 'SIG_ACTION_LATENCY',      semantic: '决策延迟', supporting: ['E_DEC_LATENCY'],    contradicting: ['E_DEC_EXPERIMENT'], direction: 'deficit' },
  { id: 'SIG_EXPERIMENTATION',     semantic: '实验倾向', supporting: ['E_DEC_EXPERIMENT'], contradicting: ['E_DEC_LATENCY'],    direction: 'healthy' },
  { id: 'SIG_POST_REVIEW',         semantic: '复盘习惯', supporting: ['E_FB_REVIEW'],      contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_FEEDBACK_SEEKING',    semantic: '反馈采集', supporting: ['E_FB_SEEK'],        contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_PROBABILISTIC',       semantic: '概率思维', supporting: ['E_PROB_RANGE'],     contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_BASE_RATE_USAGE',     semantic: 'base-rate 使用', supporting: ['E_PROB_BASERATE'], contradicting: [],               direction: 'healthy' },
  { id: 'SIG_REVERSIBILITY',       semantic: '可逆性意识', supporting: ['E_RISK_REVERSIBLE'], contradicting: [],                 direction: 'healthy' },
  { id: 'SIG_DOWNSIDE_CALC',       semantic: '下行计算', supporting: ['E_RISK_DOWNSIDE'],  contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_REPEATABLE_VALUE',    semantic: '可复用产出', supporting: ['E_LEV_REPEAT'],     contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_SYSTEM_LEVERAGE',     semantic: '系统杠杆', supporting: ['E_LEV_SYSTEM'],     contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_COMPOUNDING',         semantic: '复利配置', supporting: ['E_TIME_COMPOUND'],  contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_DIRECTION_PERSIST',   semantic: '方向持续', supporting: ['E_TIME_PERSIST'],   contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_CAPABILITY_FRAMING',  semantic: '能力框架', supporting: ['E_ID_CAPABILITY'],  contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_BOUNDARY_CROSSING',   semantic: '身份越界', supporting: ['E_ID_CROSS'],       contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_EXPOSURE_BREADTH',    semantic: '接触面广度', supporting: ['E_OPP_EXPOSURE'],   contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_NETWORK_DIVERSITY',   semantic: '网络多样性', supporting: ['E_OPP_NETWORK'],    contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_SYSTEM_FRAMING',      semantic: '系统框架', supporting: ['E_SYS_FRAMING'],    contradicting: [],                   direction: 'healthy' },
  { id: 'SIG_ROOT_CAUSE',          semantic: '根因分析', supporting: ['E_SYS_ROOTCAUSE'],  contradicting: [],                   direction: 'healthy' },
])

/**
 * Compute 18 signal scores from v2 evidence.
 * score = clamp(avg(supporting) - 0.3 * avg(contradicting), 0, 1)
 * A signal with NO supporting evidence is UNKNOWN (score=null, confidence=0),
 * NOT deficit. Missingness never produces a cognitive signal.
 */
function extractSignalsV2(normalizedEvidence) {
  var byTag = normalizedEvidence.evidenceByTag || {}
  var signals = {}

  SIGNAL_DEFINITIONS_V2.forEach(function (def) {
    var hasSupport = (def.supporting || []).some(function (id) {
      return (byTag[id] || []).length > 0
    })

    if (!hasSupport) {
      signals[def.id] = {
        id: def.id,
        semantic: def.semantic,
        direction: def.direction,
        score: null,      // UNKNOWN — no evidence, not deficit
        confidence: 0,
        supportingEvidence: def.supporting.slice(),
        contradictingEvidence: def.contradicting.slice(),
      }
      return
    }

    var sup = aggregateStrengthV2(byTag, def.supporting)
    var con = aggregateStrengthV2(byTag, def.contradicting)
    var score = clamp(sup - 0.3 * con)

    signals[def.id] = {
      id: def.id,
      semantic: def.semantic,
      direction: def.direction,
      score: score,
      confidence: 1,
      supportingEvidence: def.supporting.slice(),
      contradictingEvidence: def.contradicting.slice(),
    }
  })

  return signals
}

module.exports = {
  extractSignalsV2,
  SIGNAL_DEFINITIONS_V2,
}
