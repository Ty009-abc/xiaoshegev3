/**
 * cloudfunctions/common/memoryExtractor.js — 记忆提取器
 *
 * 四册 Part 4：Memory System
 *
 * 职责：从用户输入中提取可记忆信息
 *
 * 规则引擎 + 模式匹配（快速，不依赖 LLM 调用）
 * 生产环境可升级为 LLM-based 抽取
 */

const { classifyMemoryInput, sanitizeMemoryData, shouldWriteMemory } = require('./memoryPolicy.js')

/**
 * extractFromMessage(openid, message, context)
 * 从单条用户消息中提取记忆片段
 *
 * @param {string} openid
 * @param {object} message   - { role, content, createdAt }
 * @param {object} context   - 可选，当前已有记忆上下文
 * @returns {object|null}    - 提取的记忆数据，或 null
 */
function extractFromMessage(openid, message, context = {}) {
  const { role, content, createdAt } = message

  // 只分析用户消息
  if (role !== 'user' || !content) return null

  const classification = classifyMemoryInput(content)
  if (!classification.shouldWrite) return null

  // 根据类型提取不同字段
  const extracted = {
    openid,
    memoryType: classification.type,
    source: content.slice(0, 200),  // 最多保留 200 字原文
    extractedAt: createdAt || Date.now(),
  }

  switch (classification.type) {
    case 'long_term_goal':
      extracted.data = extractGoal(content)
      break
    case 'pain_point':
      extracted.data = extractPainPoint(content)
      break
    case 'cognition_tag':
      extracted.data = extractCognitionTag(content)
      break
    case 'risk_profile':
      extracted.data = extractRiskProfile(content)
      break
    default:
      extracted.data = { raw: content.slice(0, 100) }
  }

  return sanitizeMemoryData(extracted)
}

/**
 * extractGoal(text) — 提取目标
 */
function extractGoal(text) {
  // 匹配 "想/要/计划 + 动词 + 目标"
  const goalPatterns = [
    /(?:想要|想|要|打算|计划|准备)[：:\s]*([\u4e00-\u9fa5a-zA-Z0-9，,。.！!、\s]+?)(?:$|，|。|！)/g,
  ]

  const goals = []
  for (const pattern of goalPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const g = match[1].trim()
      if (g && g.length >= 3 && g.length <= 50) goals.push(g)
    }
  }

  // 关键词提取
  const keywords = {
    earn: /赚钱|搞钱|副业|收入|财富/,
    growth: /成长|升级|进步|突破|蜕变/,
    freedom: /自由|独立|摆脱|翻身/,
    skill: /学|技能|能力|技术|编程/,
    ai: /AI|人工智能|chatgpt|copilot/,
  }

  const domains = []
  for (const [k, regex] of Object.entries(keywords)) {
    if (regex.test(text)) domains.push(k)
  }

  return { goals: goals.slice(0, 3), domains }
}

/**
 * extractPainPoint(text) — 提取痛点
 */
function extractPainPoint(text) {
  const painKeywords = ['焦虑', '迷茫', '不知道', '赚不到', '没机会', '被困', '瓶颈', '压力', '负债', '缺钱', '月光', '打工', '996', '内卷', '害怕', '恐慌']
  const found = painKeywords.filter(kw => text.includes(kw))

  // 判断严重程度
  let severity = 'medium'
  if (found.includes('负债') || found.includes('缺钱') || found.includes('恐慌')) severity = 'high'
  if (found.includes('迷茫') || found.includes('不知道')) severity = 'low'

  return { painPoints: found, severity }
}

/**
 * extractCognitionTag(text) — 提取认知标签
 */
function extractCognitionTag(text) {
  const tagMap = {
    '世界观': /世界观/,
    '概率思维': /概率/,
    '系统思维': /系统|杠杆/,
    '信息差': /信息差/,
    '风险意识': /风险/,
    '复利思维': /复利/,
    '期望值': /期望值/,
    '劳动力思维': /努力|勤劳|勤奋/,
  }

  const tags = []
  for (const [tag, regex] of Object.entries(tagMap)) {
    if (regex.test(text)) tags.push(tag)
  }

  return { tags }
}

/**
 * extractRiskProfile(text) — 提取风险偏好
 */
function extractRiskProfile(text) {
  let tolerance = 'unknown'

  if (/激[进晉]|冒险|搏一[把搏]|梭哈|一把/ .test(text)) tolerance = 'high'
  if (/保守|稳健|慢慢|稳住|安全/ .test(text)) tolerance = 'low'
  if (/风险.*收益|平衡|适当/ .test(text)) tolerance = 'medium'

  return { riskTolerance: tolerance }
}

/**
 * extractFromConversation(messages)
 * 从一轮对话中提取批量记忆
 *
 * @param {Array} messages - [{role, content, createdAt}]
 * @returns {Array} 提取的记忆片段列表
 */
function extractFromConversation(messages) {
  if (!Array.isArray(messages)) return []
  return messages
    .map(m => extractFromMessage(m._openid || 'unknown', m))
    .filter(Boolean)
}

/**
 * extractFromChallengeResult(challengeResult)
 * 从挑战结果中提取成长记忆
 */
function extractFromChallengeResult(challengeResult) {
  if (!challengeResult) return null

  return {
    memoryType: 'challenge_result',
    data: {
      eventCount: challengeResult.eventCount || 0,
      score: challengeResult.score || 0,
      summary: challengeResult.summary || '',
      strengths: challengeResult.strengths || [],
      weaknesses: challengeResult.weaknesses || [],
    },
    extractedAt: Date.now(),
  }
}

/**
 * extractFromReport(report)
 * 从 AI 报告中提取认知维度变化
 */
function extractFromReport(report) {
  if (!report) return null

  const dims = {}
  const dimKeys = ['laborMindset','probabilityMindset','systemThinking','leverageThinking','capitalThinking','riskAwareness','informationSensitivity','longTermism','decisionStability']
  for (const k of dimKeys) {
    if (typeof report[k] === 'number') dims[k] = report[k]
  }

  if (Object.keys(dims).length === 0) return null

  return {
    memoryType: 'cognition_dimension',
    data: { dimensions: dims, summary: report.summary || '' },
    extractedAt: Date.now(),
  }
}

module.exports = {
  extractFromMessage,
  extractFromConversation,
  extractFromChallengeResult,
  extractFromReport,
}
