/**
 * cloudfunctions/common/driftDetector.js — 人格漂移检测器
 *
 * 四册 Part 6：Self Evolution
 *
 * 职责：
 *   1. 检测 AI 回答是否偏离小事哥人格
 *   2. 生成 personaDriftScore (0-100)
 *   3. >70 触发报警
 */

// ═══════════════════════════
// DRIFT SIGNALS — 漂移信号库
// ═══════════════════════════

/**
 * 负向信号：这些词出现 → 人格在漂移到"普通助手"
 */
const NEGATIVE_DRIFT_SIGNALS = [
  // 鸡汤化
  { pattern: /希望对你有帮助/g,         weight: 8,  label: '希望对你有帮助' },
  { pattern: /祝你成功/g,               weight: 8,  label: '祝你成功' },
  { pattern: /继续加油/g,               weight: 7,  label: '继续加油' },
  { pattern: /坚持下去/g,               weight: 7,  label: '坚持下去' },
  { pattern: /相信你.*可以/g,           weight: 6,  label: '相信你可以' },
  { pattern: /你一定能/g,               weight: 6,  label: '你一定能' },
  { pattern: /慢慢来/g,                 weight: 5,  label: '慢慢来' },
  { pattern: /没关系/g,                 weight: 5,  label: '没关系' },
  { pattern: /不要担心/g,               weight: 5,  label: '不要担心' },

  // 客服化
  { pattern: /如有.*问题.*随时/g,       weight: 9,  label: '如有问题随时联系' },
  { pattern: /感谢.*信任/g,             weight: 7,  label: '感谢信任' },
  { pattern: /很高兴.*帮/g,             weight: 8,  label: '很高兴帮你' },
  { pattern: /希望这.*帮到/g,           weight: 7,  label: '希望能帮到' },
  { pattern: /欢迎.*随时/g,             weight: 7,  label: '欢迎随时' },

  // 学术化/去人格化
  { pattern: /综上所述/g,               weight: 6,  label: '综上所述(学术)' },
  { pattern: /值得.*注意/g,             weight: 5,  label: '值得注意(学术)' },
  { pattern: /从.*角度.*看/g,           weight: 4,  label: '从XX角度看(学术)' },
  { pattern: /需要.*进一步/g,           weight: 5,  label: '需要进一步(学术)' },

  // 情感降温
  { pattern: /客观.*来说/g,             weight: 4,  label: '客观来说(降温)' },
  { pattern: /平衡.*来看/g,             weight: 4,  label: '平衡来看(降温)' },
  { pattern: /当然.*也/g,               weight: 3,  label: '当然也(和稀泥)' },
]

/**
 * 正向信号：这些词出现 → 人格在强化
 */
const POSITIVE_DRIFT_SIGNALS = [
  { pattern: /你以为/g,                 weight: -6, label: '你以为' },
  { pattern: /赌场/g,                   weight: -7, label: '赌场' },
  { pattern: /庄家/g,                   weight: -6, label: '庄家' },
  { pattern: /说句难听/g,               weight: -7, label: '说句难听' },
  { pattern: /你不是.*而是/g,           weight: -5, label: '你不是…而是…' },
  { pattern: /多数人/g,                 weight: -4, label: '多数人' },
  { pattern: /概率.*决定/g,             weight: -5, label: '概率决定' },
  { pattern: /负期望/g,                 weight: -6, label: '负期望' },
  { pattern: /认知暴击/g,               weight: -6, label: '认知暴击' },
  { pattern: /规则优势/g,               weight: -5, label: '规则优势' },
  { pattern: /财富.*不.*奖励/g,         weight: -5, label: '财富不奖励' },
]

/**
 * detectDrift(text, options)
 *
 * @param {string} text      - AI 回答文本
 * @param {object} options   - { strategy, personaIntensity?, responseId? }
 * @returns {{ driftScore, isDrifting, signals, alarm }}
 */
function detectDrift(text, options = {}) {
  if (!text || text.trim().length === 0) {
    return { driftScore: 0, isDrifting: false, signals: [], alarm: null }
  }

  const { strategy = 'layered', personaIntensity = 6 } = options

  let totalWeight = 0
  const signals = []

  // ── 负向信号检测 ──
  for (const { pattern, weight, label } of NEGATIVE_DRIFT_SIGNALS) {
    pattern.lastIndex = 0
    const matches = (text.match(pattern) || []).length
    if (matches > 0) {
      totalWeight += weight * matches
      signals.push({ direction: 'negative', label, count: matches, weight: weight * matches })
    }
  }

  // ── 正向信号检测 ──
  for (const { pattern, weight, label } of POSITIVE_DRIFT_SIGNALS) {
    pattern.lastIndex = 0
    const matches = (text.match(pattern) || []).length
    if (matches > 0) {
      totalWeight += weight * matches  // weight is negative
      signals.push({ direction: 'positive', label, count: matches, weight: weight * matches })
    }
  }

  // ── 计算 Drift Score (0-100) ──
  // 负向信号越多、正向信号越少 → drift score 越高
  let driftScore = 0

  // 直接累加负向权重（每个负向信号累加其 weight）
  const negativeTotal = signals
    .filter(s => s.direction === 'negative')
    .reduce((s, sig) => s + sig.weight, 0)

  // 归一化：每个负向信号 weight 5-9，累计超过 30 即严重
  driftScore = Math.min(85, negativeTotal * 2.5)

  // 正向信号抵扣（最多抵扣 40 分）
  const positiveTotal = signals
    .filter(s => s.direction === 'positive')
    .reduce((s, sig) => s + Math.abs(sig.weight), 0)
  driftScore = Math.max(0, driftScore - Math.min(positiveTotal * 2.5, 40))

  // personaIntensity 补偿：高强度人格更难漂移
  const intensityFactor = Math.max(0.5, 1 - (personaIntensity - 5) * 0.1)
  driftScore = Math.round(driftScore * intensityFactor)

  // ── 生成报警 ──
  let alarm = null
  const DRIFT_THRESHOLD = 70

  if (driftScore >= DRIFT_THRESHOLD) {
    const topNegatives = signals
      .filter(s => s.direction === 'negative')
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)

    alarm = {
      level: driftScore >= 85 ? 'critical' : 'warning',
      driftScore,
      message: `人格漂移报警 — 检测到：${topNegatives.map(s => s.label).join('、')}`,
      recommendation: '建议重新生成回答，或检查 Prompt 是否被稀释',
      threshold: DRIFT_THRESHOLD,
    }
  }

  return {
    driftScore,
    isDrifting: driftScore >= DRIFT_THRESHOLD,
    signals: signals.sort((a, b) => b.weight - a.weight),
    alarm,
  }
}

/**
 * batchDetectDrift(responses, options)
 * 批量检测 — 用于周期性分析
 *
 * @returns {{ averageDrift, alertCount, worst: [] }}
 */
function batchDetectDrift(responses, options = {}) {
  if (!responses || !responses.length) return { averageDrift: 0, alertCount: 0, worst: [] }

  const results = responses.map(r => ({
    responseId: r.responseId,
    ...detectDrift(r.text || r.content || '', options),
  }))

  const averageDrift = Math.round(results.reduce((s, r) => s + r.driftScore, 0) / results.length)
  const alertCount = results.filter(r => r.isDrifting).length
  const worst = results
    .filter(r => r.isDrifting)
    .sort((a, b) => b.driftScore - a.driftScore)
    .slice(0, 5)

  return { averageDrift, alertCount, worst }
}

/**
 * personaHealthCheck(recentResponses, options)
 * 人格健康检查 — 返回一句话评估
 */
function personaHealthCheck(recentResponses, options = {}) {
  const batch = batchDetectDrift(recentResponses, options)

  if (batch.averageDrift < 20) return { health: 'excellent', message: '人格稳定，小事哥风格鲜明' }
  if (batch.averageDrift < 40) return { health: 'good', message: '人格总体健康，偶尔微调' }
  if (batch.averageDrift < 60) return { health: 'warning', message: '人格出现轻度漂移迹象，建议检查 Prompt' }
  if (batch.averageDrift < 80) return { health: 'critical', message: '人格显著漂移！紧急检查回答策略和 Prompt' }
  return { health: 'emergency', message: '严重人格漂移！AI 正在变回普通助手，立即介入！' }
}

module.exports = {
  detectDrift,
  batchDetectDrift,
  personaHealthCheck,
  NEGATIVE_DRIFT_SIGNALS,
  POSITIVE_DRIFT_SIGNALS,
}
