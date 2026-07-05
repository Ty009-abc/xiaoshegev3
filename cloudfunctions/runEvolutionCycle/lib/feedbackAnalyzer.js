/**
 * cloudfunctions/common/feedbackAnalyzer.js — 反馈分析器
 *
 * 四册 Part 6：Self Evolution
 *
 * 职责：
 *   1. 收集并结构化用户反馈
 *   2. 按维度聚合分析
 *   3. 识别全局薄弱点
 *   4. 输出优化优先级
 */

/**
 * analyzeFeedback(feedbackList, options)
 *
 * @param {Array} feedbackList  — [{ rating, tags[], comment, intent, strategy, responseId }]
 * @param {object} options      — { timeRange?, category? }
 * @returns {{ summary, byIntent, byStrategy, topComplaints, recommendations }}
 */
function analyzeFeedback(feedbackList, options = {}) {
  if (!feedbackList || !feedbackList.length) {
    return { summary: { total: 0, avgRating: 0 }, topComplaints: [], recommendations: [] }
  }

  const { category = null } = options

  const filtered = category
    ? feedbackList.filter(f => f.intent === category || f.strategy === category)
    : feedbackList

  // ── 总体统计 ──
  const total = filtered.length
  const ratings = filtered.map(f => f.rating || 0).filter(r => r > 0)
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0
  const poorCount = filtered.filter(f => (f.rating || 0) <= 2).length
  const goodCount = filtered.filter(f => (f.rating || 0) >= 4).length

  const summary = {
    total,
    avgRating: parseFloat(avgRating),
    poorCount,
    goodCount,
    satisfactionRate: total ? (goodCount / total * 100).toFixed(0) + '%' : 'N/A',
  }

  // ── 按 Intent 分组 ──
  const byIntent = {}
  for (const f of filtered) {
    const intent = f.intent || 'unknown'
    if (!byIntent[intent]) byIntent[intent] = { total: 0, ratings: [], avgRating: 0, poorCount: 0 }
    byIntent[intent].total++
    if (f.rating) byIntent[intent].ratings.push(f.rating)
    if (f.rating <= 2) byIntent[intent].poorCount++
  }
  for (const [intent, data] of Object.entries(byIntent)) {
    if (data.ratings.length) data.avgRating = (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1)
  }

  // ── 按 Strategy 分组 ──
  const byStrategy = {}
  for (const f of filtered) {
    const strategy = f.strategy || 'unknown'
    if (!byStrategy[strategy]) byStrategy[strategy] = { total: 0, ratings: [], avgRating: 0, poorCount: 0 }
    byStrategy[strategy].total++
    if (f.rating) byStrategy[strategy].ratings.push(f.rating)
    if (f.rating <= 2) byStrategy[strategy].poorCount++
  }
  for (const [strategy, data] of Object.entries(byStrategy)) {
    if (data.ratings.length) data.avgRating = parseFloat((data.ratings.reduce((a,b)=>a+b,0)/data.ratings.length).toFixed(1))
  }

  // ── 高频投诉标签 ──
  const tagCount = {}
  for (const f of filtered) {
    for (const tag of (f.tags || [])) {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    }
  }
  const topComplaints = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }))

  // ── 生成优化建议 ──
  const recommendations = _generateRecommendations(byIntent, byStrategy, topComplaints)

  return { summary, byIntent, byStrategy, topComplaints, recommendations }
}

function _generateRecommendations(byIntent, byStrategy, topComplaints) {
  const recs = []

  // Intent 级建议
  for (const [intent, data] of Object.entries(byIntent)) {
    if (data.poorCount >= 3 && data.avgRating < 3.5) {
      recs.push({
        priority: 'high',
        target: `intent:${intent}`,
        reason: `${intent} 类回答平均仅 ${data.avgRating} 分，${data.poorCount} 次差评`,
        action: `检查 ${intent} 对应的 Prompt，考虑增加深度或调整策略`,
      })
    }
  }

  // Strategy 级建议
  for (const [strategy, data] of Object.entries(byStrategy)) {
    if (data.poorCount >= 3 && data.avgRating < 3.5) {
      recs.push({
        priority: 'high',
        target: `strategy:${strategy}`,
        reason: `${strategy} 策略平均仅 ${data.avgRating} 分`,
        action: `审查 ${strategy} 的回答模板和输出格式`,
      })
    }
  }

  // 标签级建议
  const complaintMap = {
    too_generic: { action: '强化反常识 Hook 和赌场类比，增加具体案例', target: 'cognitive_shock_hooks' },
    too_shallow: { action: '提高复杂度≥5问题的深度标准，增加底层逻辑拆解', target: 'layered_depth' },
    too_harsh: { action: '在 coaching 和 emotional 场景降低冲击力，增加共情', target: 'emotional_balance' },
    not_actionable: { action: '在 advice 和 strategic 场景强制添加"第一步"建议', target: 'actionability' },
    boring: { action: '检查反鸡汤过滤器阈值，增加赌场型和打脸型 Hook 比例', target: 'anti_boring' },
    wrong_advice: { action: '审核对应场景的知识库准确性，增加事实核查', target: 'knowledge_accuracy' },
  }

  for (const { tag, count } of topComplaints) {
    const map = complaintMap[tag]
    if (map) {
      recs.push({
        priority: count >= 5 ? 'high' : 'medium',
        target: map.target,
        reason: `"${tag}" 被投诉 ${count} 次`,
        action: map.action,
      })
    }
  }

  return recs.sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0))
}

/**
 * collectFromUser(openid, feedbackData)
 * 标准化用户反馈数据
 */
function collectFromUser(openid, feedbackData) {
  const { rating, tags = [], comment = '', responseId, intent, strategy } = feedbackData

  return {
    openid,
    responseId: responseId || 'unknown',
    rating: Math.max(1, Math.min(5, rating || 3)),
    tags: Array.isArray(tags) ? tags : [],
    comment: (comment || '').slice(0, 200),
    intent: intent || 'unknown',
    strategy: strategy || 'unknown',
    createdAt: Date.now(),
  }
}

module.exports = {
  analyzeFeedback,
  collectFromUser,
}
