/**
 * cloudfunctions/common/responseFormatter.js — 回答格式化器
 *
 * 四册 Part 5：Response Strategy
 *
 * 职责：
 *   1. 统一输出格式：Hook + Body + Shock Ending
 *   2. Anti-Boring Filter — 检测并降分鸡汤化输出
 *   3. Post-processing：去水、分段、长度控制
 */

// ═══════════════════════════
// 1. ANTI-BORING FILTER
// ═══════════════════════════

/**
 * 无聊词库 — 如果回答中出现这些词过多 → 降分
 * 这些是"正确的废话"高频词
 */
const BORING_PATTERNS = [
  // 鸡汤高频词
  { pattern: /保持学习/g, weight: 3, label: '保持学习' },
  { pattern: /继续努力/g, weight: 3, label: '继续努力' },
  { pattern: /坚持下去/g, weight: 3, label: '坚持下去' },
  { pattern: /加油/g, weight: 3, label: '加油' },
  { pattern: /相信自己/g, weight: 3, label: '相信自己' },
  { pattern: /永不放弃/g, weight: 3, label: '永不放弃' },
  // 空洞建议
  { pattern: /只要(你)?...*就(能|会|可以)/g, weight: 2, label: '只要…就…' },
  { pattern: /一定(能|会|可以)/g, weight: 2, label: '一定能' },
  { pattern: /总会.*好/g, weight: 2, label: '总会好起来' },
  // 虚浮表态
  { pattern: /真心建议/g, weight: 2, label: '真心建议' },
  { pattern: /老实说/g, weight: 1, label: '老实说' },
  { pattern: /不得不/g, weight: 1, label: '不得不' },
  { pattern: /必须的/g, weight: 1, label: '必须的' },
  // 学术黑话（过度使用）
  { pattern: /赋能/g, weight: 2, label: '赋能' },
  { pattern: /底层逻辑/g, weight: 1, label: '底层逻辑(过度)' },
  { pattern: /认知升级/g, weight: 2, label: '认知升级(过度)' },
  { pattern: /思维模型/g, weight: 2, label: '思维模型(过度)' },
  // 情感绑架
  { pattern: /你一定(可以|能|行)/g, weight: 3, label: '你一定可以' },
  { pattern: /不怕/g, weight: 2, label: '不怕' },
  { pattern: /明天会更/g, weight: 3, label: '明天会更好' },
]

/**
 * scoreBoring(text)
 * 返回 boring score（0-100），越低越不鸡汤
 */
function scoreBoring(text) {
  if (!text) return 0

  let totalWeight = 0
  let hitCount = 0
  const hits = []

  for (const { pattern, weight, label } of BORING_PATTERNS) {
    pattern.lastIndex = 0
    const matches = (text.match(pattern) || [])
    if (matches.length > 0) {
      hits.push({ label, count: matches.length, weight: weight * matches.length })
      totalWeight += weight * matches.length
      hitCount += matches.length
    }
  }

  // 词密度 — 如果短文本中有很多无聊词，更严重
  const density = hitCount / Math.max((text.length / 100), 1)
  const densityPenalty = Math.min(density * 10, 20)

  // 总分 0-100
  return Math.min(100, totalWeight * 5 + densityPenalty)
}

/**
 * filterBoring(text, threshold = 30)
 * 如果 boring score 超过阈值，标记为需要重生成
 */
function filterBoring(text, threshold = 30) {
  const score = scoreBoring(text)
  const hits = _detectHits(text)

  return {
    boringScore: score,
    isBoring: score >= threshold,
    hits,
    recommendation: score >= threshold
      ? `回答过于鸡汤（boring score: ${score}），建议重生成。命中词：${hits.map(h => h.label).join('、')}`
      : null,
  }
}

function _detectHits(text) {
  const hits = []
  for (const { pattern, label, weight } of BORING_PATTERNS) {
    pattern.lastIndex = 0
    const matches = (text.match(pattern) || [])
    if (matches.length > 0) {
      hits.push({ label, count: matches.length, totalWeight: weight * matches.length })
    }
  }
  return hits
}

// ═══════════════════════════
// 2. RESPONSE FORMATTER
// ═══════════════════════════

/**
 * formatResponse(rawText, strategy, plan)
 *
 * 统一输出格式：
 *   Hook（如果有）
 *   空行
 *   结构化正文（按 plan.sections 分段）
 *   空行
 *   认知暴击结尾（如果有）
 *
 * @param {string} rawText        - LLM 原始输出
 * @param {string} strategy       - 策略名
 * @param {object} plan           - responsePlanner 输出的大纲
 * @returns {{ formatted, boringResult, stats }}
 */
function formatResponse(rawText, strategy, plan = {}) {
  if (!rawText) return { formatted: '', boringResult: { boringScore: 0, isBoring: false, hits: [] }, stats: {} }

  let cleaned = rawText.trim()

  // ── 后处理步骤 ──

  // 1. 移除 LLM 常见前缀
  cleaned = cleaned.replace(/^(好的|收到|明白了|理解|当然可以|没问题)[,，。.]?\s*/i, '')
  cleaned = cleaned.replace(/^(以下是|下面是).*?[：:]\s*/i, '')

  // 2. 移除尾巴
  cleaned = cleaned.replace(/(希望|祝愿|祝福).*?[！!。.]?\s*$/g, '')
  cleaned = cleaned.replace(/如果.*?随时.*?[。！]/g, '')

  // 3. 格式化分段标签
  const sectionTags = (plan.sections || []).map(s => s.tag)
  for (const tag of sectionTags) {
    // 标准化：确保【XX层】格式
    const chineseTag = tag.replace(/([^\u4e00-\u9fa5])/g, '')
    cleaned = cleaned.replace(new RegExp(`【?${tag}】?`, 'g'), `【${tag}】`)
  }

  // 4. Hook 前置（如果 LLM 没有生成 hook，插入 plan 里的 hook）
  let formatted = cleaned
  if (plan.hook && !cleaned.includes(plan.hook.slice(0, 10))) {
    formatted = `${plan.hook}\n\n${cleaned}`
  }

  // 5. Shock ending 后置
  if (plan.ending && strategy !== 'direct' && strategy !== 'coaching') {
    // 检查是否已有暴击结尾
    const hasShock = /暴击|真相|核心规则|底层法则|规则/.test(cleaned.slice(-100))
    if (!hasShock) {
      formatted = formatted.replace(/\n*$/, '\n')
    }
  }

  // 6. 长度裁剪
  if (plan.maxChars && formatted.length > plan.maxChars * 1.2) {
    formatted = formatted.slice(0, Math.floor(plan.maxChars * 1.2))
    // 在最后一个完整句子结束
    const lastPeriod = Math.max(
      formatted.lastIndexOf('。'),
      formatted.lastIndexOf('！'),
      formatted.lastIndexOf('\n'),
    )
    if (lastPeriod > formatted.length * 0.5) {
      formatted = formatted.slice(0, lastPeriod + 1)
    }
  }

  // ── Anti-Boring 检测 ──
  const boringResult = filterBoring(formatted)

  return {
    formatted: formatted.trim(),
    boringResult,
    stats: {
      charCount: formatted.length,
      strategy,
      hasHook: !!plan.hook,
      hasShockEnding: !!(plan.ending && formatted.length > 0),
    },
  }
}

/**
 * postProcessForChannel(formatted, channel)
 * 按渠道微调（Discord 不加 Markdown 表、WhatsApp 不要标题等）
 */
function postProcessForChannel(formatted, channel = 'chat') {
  let result = formatted

  if (channel === 'whatsapp' || channel === 'weixin_mini') {
    // 移除 Markdown 标题符号
    result = result.replace(/^#{1,6}\s+/gm, '')
  }

  return result
}

module.exports = {
  scoreBoring,
  filterBoring,
  formatResponse,
  postProcessForChannel,
  BORING_PATTERNS,
}
