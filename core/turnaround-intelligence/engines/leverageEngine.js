/**
 * core/turnaround-intelligence/engines/leverageEngine.js
 *
 * CP6-C Leverage Engine — 杠杆检测引擎
 *
 * 回答："翻身靠什么？"
 *
 * 数据来源（三源融合）:
 *   1. 正向 Evidence 标签 → Leverage
 *   2. 正向 Pattern（strength < 0.3 但匹配成功的）→ Leverage
 *   3. Profile 优势 → Leverage
 *
 * 输出: Top 3 Leverage
 *
 * 禁止 AI 自由生成杠杆名称
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

const {
  LEVERAGE_CATALOG, TAG_TO_LEVERAGE, STRENGTH_TO_LEVERAGE, createLeverageOutput,
} = require('../contracts/leverage')

/**
 * run — 从 LeverageInput 生成 LeverageOutput
 *
 * @param {Object} input — { patterns, evidence, profile }
 * @returns {Object} LeverageOutput (Top 3)
 */
function run(input) {
  const evidences = (input.evidence || {}).evidences || []
  const patterns = (input.patterns || {}).patterns || []
  const profile = input.profile || {}

  const levMap = new Map()

  // ========== 来源 1: 正向 Evidence ==========
  for (const ev of evidences) {
    if (ev.direction !== 'positive') continue

    for (const tag of ev.tags) {
      const levCode = TAG_TO_LEVERAGE[tag]
      if (!levCode) continue

      const def = LEVERAGE_CATALOG[levCode]
      if (!def) continue

      const existing = levMap.get(levCode)
      const strength = Math.round(75 * (0.7 + 0.3 * ev.importance))
      if (!existing || strength > existing.strength) {
        levMap.set(levCode, {
          code: levCode,
          strength,
          confidence: ev.weight,
          reason: `${def.description}（来自：${ev.questionId}）`,
          evidenceRefs: [ev.id],
        })
      }
    }
  }

  // ========== 来源 2: Profile 优势 ==========
  for (const s of (profile.strengths || [])) {
    const levCode = STRENGTH_TO_LEVERAGE[s.code]
    if (!levCode) continue

    const def = LEVERAGE_CATALOG[levCode]
    if (!def) continue

    const existing = levMap.get(levCode)
    const strength = Math.round(70 * 0.85)
    if (!existing || strength > existing.strength) {
      levMap.set(levCode, {
        code: levCode,
        strength,
        confidence: 0.75,
        reason: `${def.description}（画像优势识别）`,
        evidenceRefs: s.evidenceRefs || [],
      })
    }
  }

  // ========== 来源 3: 正向 Pattern（strength 低但匹配成功） ==========
  const LEVERAGE_PATTERNS = {
    'LEARNING_SPEED': ['HIGH_INPUT_LOW_OUTPUT', 'LOW_MONETIZATION'],
    'CONSISTENCY': ['SINGLE_INCOME_DEPENDENCY'],
  }

  for (const [levCode, patternCodes] of Object.entries(LEVERAGE_PATTERNS)) {
    for (const pattern of patterns) {
      if (!patternCodes.includes(pattern.code)) continue

      const def = LEVERAGE_CATALOG[levCode]
      if (!def) continue

      const existing = levMap.get(levCode)
      const strength = Math.round(65 * (0.7 + 0.3 * pattern.confidence))
      if (!existing || strength > existing.strength) {
        levMap.set(levCode, {
          code: levCode,
          strength,
          confidence: pattern.confidence,
          reason: `${def.description}（模式：${pattern.name}）`,
          evidenceRefs: pattern.evidenceRefs || [],
        })
      }
    }
  }

  // ========== 排序 & Top 3 ==========
  const leverages = [...levMap.values()]
  leverages.sort((a, b) => b.strength - a.strength)

  const topLeverages = leverages.slice(0, 3).map((l, i) => ({
    ...l,
    strength: clamp(Math.round(l.strength), 0, 100),
    priority: i + 1,
    evidenceRefs: l.evidenceRefs.slice(0, 5),
  }))

  let totalLeverageScore = 0
  if (topLeverages.length > 0) {
    totalLeverageScore = Math.round(
      topLeverages.reduce((s, l, i) => s + l.strength / (i + 1), 0) /
      topLeverages.reduce((s, _, i) => s + 1 / (i + 1), 0)
    )
  }

  return createLeverageOutput({
    version: '6.1.0',
    topLeverages,
    totalLeverageScore,
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
module.exports = { run }
