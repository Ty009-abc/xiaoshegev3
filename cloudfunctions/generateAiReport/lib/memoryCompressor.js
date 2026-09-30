/**
 * cloudfunctions/common/memoryCompressor.js — 对话压缩器
 *
 * 四册 Part 4：Memory System
 *
 * 职责：
 *   1. 保留最近 10 轮对话完整内容
 *   2. 超过 10 轮的自动压缩为长期摘要
 *   3. 合并新旧摘要
 *
 * 压缩策略：
 *   - 提取每轮对话的关键信息
 *   - 去重相似内容
 *   - 按主题聚合
 *   - 保留关键数字/目标/痛点
 */

const { extractFromConversation } = require('./memoryExtractor.js')

const MAX_RECENT_MESSAGES = 10  // 最近完整保留轮数

/**
 * compressConversation(recentMessages, existingSummary)
 *
 * @param {Array}  recentMessages   - 最近的消息列表 [{role, content, createdAt}]
 * @param {string} existingSummary  - 已有长期摘要
 * @returns {{ newRecent: Array, newSummary: string, discarded: number }}
 */
function compressConversation(recentMessages, existingSummary = '') {
  if (!Array.isArray(recentMessages) || recentMessages.length <= MAX_RECENT_MESSAGES) {
    return {
      newRecent: recentMessages || [],
      newSummary: existingSummary || '',
      discarded: 0,
    }
  }

  // 分离：前部分压缩，后部分保留
  const toCompress = recentMessages.slice(0, recentMessages.length - MAX_RECENT_MESSAGES)
  const newRecent = recentMessages.slice(-MAX_RECENT_MESSAGES)

  // 提取可记忆信息
  const extracted = extractFromConversation(toCompress.filter(m => m.role === 'user'))

  // 生成压缩摘要
  const compressedSummary = buildCompressedSummary(extracted)

  // 合并新旧摘要
  const mergedSummary = mergeSummaries(existingSummary, compressedSummary)

  return {
    newRecent,
    newSummary: mergedSummary,
    discarded: toCompress.length,
  }
}

/**
 * buildCompressedSummary(extracted) — 基于提取的记忆生成摘要
 */
function buildCompressedSummary(extracted) {
  if (!extracted || !extracted.length) return ''

  const parts = []

  // 收集目标
  const goals = extracted
    .filter(e => e.memoryType === 'long_term_goal')
    .flatMap(e => (e.data && e.data.goals) || [])

  const painPoints = extracted
    .filter(e => e.memoryType === 'pain_point')
    .flatMap(e => (e.data && e.data.painPoints) || [])

  const tags = extracted
    .filter(e => e.memoryType === 'cognition_tag')
    .flatMap(e => (e.data && e.data.tags) || [])

  const risks = extracted
    .filter(e => e.memoryType === 'risk_profile')
    .map(e => e.data && e.data.riskTolerance)
    .filter(Boolean)

  if (goals.length) {
    parts.push(`用户关注：${[...new Set(goals)].slice(0, 5).join('、')}`)
  }
  if (painPoints.length) {
    parts.push(`近期痛点：${[...new Set(painPoints)].slice(0, 5).join('、')}`)
  }
  if (tags.length) {
    parts.push(`认知标签：${[...new Set(tags)].slice(0, 5).join('、')}`)
  }
  if (risks.length) {
    const riskProfile = risks[risks.length - 1] // 最新
    parts.push(`风险偏好：${riskProfile}`)
  }

  if (parts.length === 0) {
    parts.push('用户进行了日常对话，未提取到新的长期信息。')
  }

  return parts.join('。') + '。'
}

/**
 * mergeSummaries(oldSummary, newSummary) — 合并摘要
 * 策略：旧摘要保留，新摘要接在末尾。如果摘要过长，裁剪最旧的部分。
 */
function mergeSummaries(oldSummary, newSummary) {
  if (!oldSummary || !oldSummary.trim()) return newSummary
  if (!newSummary || !newSummary.trim()) return oldSummary

  const combined = `${oldSummary.trim()} ${newSummary.trim()}`

  // 限制摘要总长度（字符数）
  const MAX_SUMMARY_LENGTH = 800
  if (combined.length <= MAX_SUMMARY_LENGTH) return combined

  // 过长 → 保留后半段
  return '...(早期对话) ' + combined.slice(combined.length - MAX_SUMMARY_LENGTH + 10)
}

/**
 * estimateMemorySize(recentMessages, summary) — 估算内存占用
 * @returns {{ recentChars: number, summaryChars: number, totalChars: number }}
 */
function estimateMemorySize(recentMessages, summary) {
  const recentChars = (recentMessages || []).reduce((s, m) => s + (m.content || '').length, 0)
  const summaryChars = (summary || '').length
  return { recentChars, summaryChars, totalChars: recentChars + summaryChars }
}

module.exports = {
  MAX_RECENT_MESSAGES,
  compressConversation,
  buildCompressedSummary,
  mergeSummaries,
  estimateMemorySize,
}
