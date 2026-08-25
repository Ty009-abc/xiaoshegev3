/**
 * engine/worldModel/v2/evidenceNormalizerV2.js
 *
 * World Model v2 — maps frozen { questionId, optionId } answers to atomic
 * EVIDENCE. Never maps answer → blindSpot / strategy / archetype.
 * Never derives cognitive evidence from context / occupation / income / age.
 * Never uses field-missingness as evidence.
 *
 * @version world_model_v2
 */

const { OPTIONS_V2 } = require('./questionnaireV2')

// 20 atomic evidence definitions (frozen). strength is clamped [0,1]; 0 is a
// legal value. Every evidence id has exactly one semantic direction.
const EVIDENCE_DEFINITIONS_V2 = Object.freeze({
  E_DEC_LATENCY:      { definition: '决策→行动延迟（高=慢）', direction: 'high=inertia' },
  E_DEC_EXPERIMENT:   { definition: '低成本实验倾向（高=实验）', direction: 'high=healthy' },
  E_FB_REVIEW:        { definition: '行动后复盘（高=复盘）', direction: 'high=healthy' },
  E_FB_SEEK:          { definition: '外部反馈采集（高=寻求）', direction: 'high=healthy' },
  E_FB_UPDATE:        { definition: '反馈后更新模型（高=更新）', direction: 'high=healthy' },
  E_PROB_RANGE:       { definition: '概率区间思维（高=概率）', direction: 'high=healthy' },
  E_PROB_BASERATE:    { definition: 'base-rate 使用（高=查比例）', direction: 'high=healthy' },
  E_RISK_REVERSIBLE:  { definition: '可逆性意识（高=区分）', direction: 'high=healthy' },
  E_RISK_DOWNSIDE:    { definition: '下行计算（高=算最坏）', direction: 'high=healthy' },
  E_RISK_ASYMMETRY:   { definition: '不对称感知（高=看到不对称）', direction: 'high=healthy' },
  E_LEV_REPEAT:       { definition: '可复用产出（高=复用）', direction: 'high=healthy' },
  E_LEV_SYSTEM:       { definition: '系统杠杆（高=用系统）', direction: 'high=healthy' },
  E_TIME_COMPOUND:    { definition: '复利时间配置（高=留长期）', direction: 'high=healthy' },
  E_TIME_PERSIST:     { definition: '方向持续（高=持续）', direction: 'high=healthy' },
  E_ID_CAPABILITY:    { definition: '能力框架（高=能力）', direction: 'high=healthy' },
  E_ID_CROSS:         { definition: '身份越界（高=越界）', direction: 'high=healthy' },
  E_OPP_EXPOSURE:     { definition: '接触面广度（高=广）', direction: 'high=healthy' },
  E_OPP_NETWORK:      { definition: '网络多样性（高=多样）', direction: 'high=healthy' },
  E_SYS_FRAMING:      { definition: '系统框架（高=系统）', direction: 'high=healthy' },
  E_SYS_ROOTCAUSE:    { definition: '根因分析（高=根因）', direction: 'high=healthy' },
})

// Build optionId -> evidence lookup (optionId is the primary key, NOT text)
var OPTION_INDEX = {}
OPTIONS_V2.forEach(function (opt) {
  OPTION_INDEX[opt.optionId] = opt
  // also index by composite questionId+optionId for convenience
  OPTION_INDEX[opt.questionId + ':' + opt.optionId] = opt
})

function clamp(v) {
  if (typeof v !== 'number' || isNaN(v)) return 0
  return Math.max(0, Math.min(1, v))
}

/**
 * Normalize v2 answers into atomic evidence.
 * @param {Object} answers — { [questionId]: optionId }
 *   e.g. { Q_DEC_01: 'A', Q_DEC_02: 'B', ... }
 *   Optionally { [questionId]: 'Q_DEC_01:A' } is also accepted.
 * @returns {{ evidence: Array, evidenceByTag: Object, coverageRatio: number }}
 */
function normalizeEvidenceV2(answers) {
  var evidence = []
  var byTag = {}
  var answeredCount = 0
  var totalQuestions = 0

  var questionIds = Object.keys(answers || {})
  // We accept both `Q_DEC_01: 'A'` and `Q_DEC_01: 'Q_DEC_01:A'` forms.
  totalQuestions = questionIds.length

  questionIds.forEach(function (qid) {
    var raw = answers[qid]
    if (raw === undefined || raw === null || raw === '') return

    var opt = OPTION_INDEX[qid + ':' + raw] || OPTION_INDEX[raw]
    if (!opt) return // unknown optionId silently ignored (no evidence)

    answeredCount++
    ;(opt.evidence || []).forEach(function (pair) {
      var evId = pair[0]
      var strength = clamp(pair[1])
      var item = { evidenceId: evId, strength: strength, questionId: opt.questionId, optionId: opt.optionId }
      evidence.push(item)
      if (!byTag[evId]) byTag[evId] = []
      byTag[evId].push(item)
    })
  })

  return {
    evidence: evidence,
    evidenceByTag: byTag,
    answeredCount: answeredCount,
    coverageRatio: Math.min(1, answeredCount / 18),
  }
}

/**
 * Aggregate strength of a set of evidence ids (average; 0 if none).
 */
function aggregateStrengthV2(evidenceByTag, evIds) {
  var vals = []
  ;(evIds || []).forEach(function (id) {
    var items = evidenceByTag[id] || []
    items.forEach(function (it) { vals.push(it.strength) })
  })
  if (vals.length === 0) return 0
  var sum = 0
  vals.forEach(function (v) { sum += v })
  return clamp(sum / vals.length)
}

module.exports = {
  normalizeEvidenceV2,
  aggregateStrengthV2,
  EVIDENCE_DEFINITIONS_V2,
  clamp,
}
