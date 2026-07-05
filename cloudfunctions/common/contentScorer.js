/**
 * contentScorer.js — 内容评分系统（第六册 Part 2）
 *
 * 4 维评分 0-100：
 *   CTR Potential     (0-25) — 点击潜力
 *   Virality          (0-25) — 传播力
 *   Shareability      (0-25) — 分享意愿
 *   CTA Strength       (0-25) — 导流强度
 *
 * 规则：
 *   total < 75 → 不发
 *   75-84 → 可发（优化）
 *   ≥ 85 → 高潜爆款
 */
const QUALITY_THRESHOLD = 75
const VIP_THRESHOLD = 85

// ═══════════════════════════
// scoreContent — 核心评分
// ═══════════════════════════

async function scoreContent(input) {
  const { matrix, topic, hook, format = 'script', audience = 'free' } = input

  const topicTitle = topic?.title || ''
  const hookText = typeof hook === 'string' ? hook : hook?.text || ''

  const combined = `${hookText} ${topicTitle}`

  const ctr = _scoreCTR(combined, matrix)
  const virality = _scoreVirality(combined, matrix)
  const shareability = _scoreShareability(combined, matrix)
  const ctaStrength = _scoreCTAStrength(matrix, format, audience)

  const total = ctr + virality + shareability + ctaStrength
  const approved = total >= QUALITY_THRESHOLD

  return {
    total,
    approved,
    breakdown: { ctr, virality, shareability, ctaStrength },
    quality: total >= VIP_THRESHOLD ? 'vip' : total >= QUALITY_THRESHOLD ? 'ok' : 'reject',
    threshold: QUALITY_THRESHOLD,
    suggestion: !approved ? _generateSuggestions({ ctr, virality, shareability, ctaStrength }, matrix) : null,
    scoredAt: Date.now(),
  }
}

// ═══════════════════════════
// CTR Potential (0-25)
// ═══════════════════════════

function _scoreCTR(text, matrix) {
  let score = 8 // base

  const textLower = text.toLowerCase()

  // 高CTR题材
  if (/澳门|赌场|换钱|赢钱|黑盒子|收割|内幕|暴利/.test(text)) score += 8
  if (/AI|人工智能|机器|淘汰|取代/.test(text)) score += 5
  if (/赚钱|财富|收入|穷|富人|贫穷/.test(text)) score += 5

  // 数字吸引眼球
  if (/\d+[%万个次]/.test(text)) score += 3

  // 争议性
  if (/为什么|到底|真的吗|真相|秘密/.test(text)) score += 3

  // 紧迫感
  if (/正在|马上|即将|不到|错过|最后/.test(text)) score += 2

  // 矩阵加成
  const matrixBonus = { casino: 3, trending: 2, cognition: 1, ai: 1 }
  score += (matrixBonus[matrix] || 0)

  return Math.min(25, score)
}

// ═══════════════════════════
// Virality (0-25)
// ═══════════════════════════

function _scoreVirality(text, matrix) {
  let score = 8

  // 情绪钩子
  if (/沉默|破防|崩溃|震惊|不敢|后背发凉/.test(text)) score += 6

  // 社交货币（转发显得自己牛）
  if (/认知|逻辑|底层|框架|系统|法则|版本/.test(text)) score += 5

  // 利他转发
  if (/转发|看看|知道|测|问|能不能/.test(text)) score += 3

  // 争议性
  if (/99%|大多数人|普通人|有钱人/.test(text)) score += 4

  // 矩阵加成
  const matrixBonus = { cognition: 3, shock: 2, casino: 1, ai: 1 }
  score += (matrixBonus[matrix] || 0)

  return Math.min(25, score)
}

// ═══════════════════════════
// Shareability (0-25)
// ═══════════════════════════

function _scoreShareability(text, matrix) {
  let score = 8

  // 面子驱动（转发让自己看起来"清醒"）
  if (/你从没|你不知道|不敢说|不想说|不敢承认/.test(text)) score += 5
  if (/90%的人|99%.*不懂|大多数人.*不知道/.test(text)) score += 5

  // 猎奇
  if (/揭秘|曝光|发现|没注意到|想不到/.test(text)) score += 4

  // 测试/CTA 驱动分享
  if (/测试|测|体检|诊断|概率/.test(text)) score += 4

  // 矩阵加成
  const matrixBonus = { cognition: 3, trending: 2, casino: 1, ai: 1 }
  score += (matrixBonus[matrix] || 0)

  return Math.min(25, score)
}

// ═══════════════════════════
// CTA Strength (0-25)
// ═══════════════════════════

function _scoreCTAStrength(matrix, format, audience) {
  let score = 8

  // 矩阵与CTA匹配度
  if (matrix === 'casino') score += 5    // 赌场→测试导流天然强
  if (matrix === 'ai') score += 4        // AI→认知诊断匹配好
  if (matrix === 'cognition') score += 4 // 认知→测试导流
  if (matrix === 'trending') score += 2  // 热点→导流较弱

  // 格式加成
  if (format === 'script') score += 3    // 完整脚本 CTA 更有力
  if (format === 'hook') score += 1      // 纯 Hook 导流弱

  // 受众加成
  if (audience === 'free') score += 3    // 免费用户更需要CTA引导
  if (audience === 'vip') score += 1     // VIP已经转化过

  // 结果驱动加成
  score += 3 // 所有CTA都是结果驱动的（测翻身概率/测认知漏洞）

  return Math.min(25, score)
}

// ═══════════════════════════
// 建议生成
// ═══════════════════════════

function _generateSuggestions(breakdown, matrix) {
  const suggestions = []

  if (breakdown.ctr < 15) {
    suggestions.push({ dim: 'ctr', issue: `CTR潜力偏低(${breakdown.ctr}/25)`, fix: '增加反常识/数字/紧迫感元素' })
  }
  if (breakdown.virality < 15) {
    suggestions.push({ dim: 'virality', issue: `传播力不足(${breakdown.virality}/25)`, fix: '增加情绪钩子或社交货币句式' })
  }
  if (breakdown.shareability < 15) {
    suggestions.push({ dim: 'shareability', issue: `分享意愿低(${breakdown.shareability}/25)`, fix: '增加"别人不知道"或"颠覆认知"元素' })
  }
  if (breakdown.ctaStrength < 15) {
    suggestions.push({ dim: 'cta', issue: `CTA强度不够(${breakdown.ctaStrength}/25)`, fix: '使用结果驱动CTA，如"测你的翻身概率"' })
  }

  return suggestions.length > 0 ? suggestions : [{ dim: 'overall', issue: '综合评分不达标', fix: '重新选题或更换Hook' }]
}

// ═══════════════════════════
// batchScore — 批量评分
// ═══════════════════════════

async function batchScore(contents = []) {
  const results = []
  for (const c of contents) {
    results.push(await scoreContent(c))
  }
  return results
}

// ═══════════════════════════
// getScoreThresholds
// ═══════════════════════════

function getScoreThresholds() {
  return {
    REJECT: 0,
    MIN_PUBLISH: QUALITY_THRESHOLD,
    GOOD: 80,
    VIP: VIP_THRESHOLD,
    PERFECT: 100,
    rules: [
      { range: '0-74',  action: '❌ 不发',    reason: '冲击力/传播力不达标' },
      { range: '75-84', action: '✅ 可发',    reason: '达标可发布' },
      { range: '85-100',action: '🔥 高潜爆款',reason: '大概率爆' },
    ],
  }
}

module.exports = {
  scoreContent,
  batchScore,
  getScoreThresholds,
  QUALITY_THRESHOLD,
  VIP_THRESHOLD,
}
