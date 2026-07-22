/**
 * core/turnaround-intelligence/engines/patternEngine.js
 *
 * CP6-C Pattern Engine — 从 Evidence 检测 Pattern
 *
 * 这是 CP6-C 最重要的一层。
 * Risk Engine 禁止直接读 Evidence — 必须通过 Pattern。
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

const { PATTERN_CATALOG, createPatternOutput, getStrengthLevel } = require('../contracts/pattern')

/**
 * run — 从 Evidence 检测 Pattern
 *
 * @param {Object} input — { evidence: EvidenceSet }
 * @returns {Object} PatternOutput { patterns[], meta }
 */
function run(input) {
  const evidences = input.evidence.evidences

  // 收集所有标签 → { tag: [evidenceId, ...] }
  const tagToEvidences = {}
  for (const ev of evidences) {
    for (const tag of ev.tags) {
      if (!tagToEvidences[tag]) tagToEvidences[tag] = []
      tagToEvidences[tag].push(ev.id)
    }
  }
  const allTags = new Set(Object.keys(tagToEvidences))

  const matched = []

  for (const [code, def] of Object.entries(PATTERN_CATALOG)) {
    const result = matchChain(def, allTags, tagToEvidences, evidences)
    if (!result) continue
    matched.push(result)
  }

  return createPatternOutput({
    version: '6.1.0',
    patterns: matched,
    meta: {
      totalMatched: matched.length,
    },
  })
}

// ═══════════════════════════════════════
// matchChain — 链式模式匹配
// ═══════════════════════════════════════

function matchChain(def, allTags, tagToEvidences, evidences) {
  const { code, chainTags } = def

  // 逐跳匹配：每一跳中至少命中一个 tag
  const hitTags = []
  for (const hop of chainTags) {
    const anyHit = hop.some(tag => allTags.has(tag))
    if (!anyHit) return null
    for (const tag of hop) {
      if (allTags.has(tag) && !hitTags.includes(tag)) {
        hitTags.push(tag)
      }
    }
  }

  if (hitTags.length < 2) return null

  // 收集 evidenceRefs
  const evidenceRefs = []
  for (const tag of hitTags) {
    for (const eid of (tagToEvidences[tag] || [])) {
      if (!evidenceRefs.includes(eid)) evidenceRefs.push(eid)
    }
  }

  // 跨题多样性
  const questions = new Set()
  for (const eid of evidenceRefs) {
    const ev = evidences.find(e => e.id === eid)
    if (ev) questions.add(ev.questionId)
  }

  // 信心计算
  const avgWeight = evidenceRefs.length > 0
    ? evidenceRefs.reduce((s, eid) => s + (evidences.find(e => e.id === eid)?.weight || 0), 0) / evidenceRefs.length
    : 0.5

  const questionDiversity = clamp(questions.size / 2, 0, 1)
  const tagCoverage = clamp(hitTags.length / (chainTags.length * 1.5), 0, 1)

  const confidence = clamp(
    0.35 * questionDiversity + 0.35 * avgWeight + 0.30 * tagCoverage,
    0.25, 0.95
  )

  // 强度
  const strength = clamp(
    0.30 * avgWeight + 0.40 * tagCoverage + 0.30 * confidence,
    0.15, 0.95
  )

  return {
    code,
    name: def.name,
    category: def.category,
    strength,
    strengthLevel: getStrengthLevel(strength),
    confidence,
    evidenceRefs,
    questionCount: questions.size,
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

module.exports = { run }
