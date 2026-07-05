/**
 * cloudfunctions/common/evolutionEngine.js — 自进化引擎（总编排）
 *
 * 四册 Part 6：Self Evolution
 *
 * 职责：
 *   1. 统一编排：反馈收集 → 质量评估 → 漂移检测 → 弱点分析 → 优化建议
 *   2. 管理进化生命周期
 *   3. 周期性自动化报告
 *   4. Human-in-the-loop 接口
 *
 * 架构：
 *   evolutionEngine
 *     ├── feedbackAnalyzer  — 反馈聚合
 *     ├── qualityEvaluator  — 质量评估
 *     ├── driftDetector     — 漂移检测
 *     └── optimizationPlanner — 优化建议
 */

let _cloud, _db
function ensureDB() { if (!_db) { _cloud = require('wx-server-sdk'); _cloud.init({ env: _cloud.DYNAMIC_CURRENT_ENV }); _db = _cloud.database(); } }

const { analyzeFeedback, collectFromUser } = require('./feedbackAnalyzer.js')
const { evaluateQuality, batchEvaluate } = require('./qualityEvaluator.js')
const { detectDrift, batchDetectDrift, personaHealthCheck } = require('./driftDetector.js')
const { planOptimizations, createPromptEvolutionPlan } = require('./optimizationPlanner.js')

// ═══════════════════════════
// 1. 记录响应指标
// ═══════════════════════════

async function recordResponse(responseData) {
  ensureDB()
  const data = {
    responseId: responseData.responseId || `RESP_${Date.now()}`,
    openid: responseData.openid || '',
    intent: responseData.intent || 'unknown',
    strategy: responseData.strategy || 'unknown',
    model: responseData.model || 'default',
    responseScore: responseData.responseScore || 0,
    tokens: responseData.tokens || 0,
    duration: responseData.duration || 0,
    shared: responseData.shared || false,
    saved: responseData.saved || false,
    ledToPayment: responseData.ledToPayment || false,
    continuationCount: responseData.continuationCount || 0,
    createdAt: Date.now(),
  }
  try {
    await _db.collection('response_metrics').add({ data })
    await _log('record_response', data.responseId, { intent: data.intent, strategy: data.strategy })
    return { code: 0, responseId: data.responseId }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ═══════════════════════════
// 2. 收集用户反馈
// ═══════════════════════════

async function recordFeedback(openid, feedbackData) {
  ensureDB()
  const data = collectFromUser(openid, feedbackData)
  try {
    await _db.collection('response_feedback').add({ data })
    await _log('record_feedback', data.responseId, { rating: data.rating, tags: data.tags })
    return { code: 0, feedbackId: `FB_${Date.now()}` }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ═══════════════════════════
// 3. 运行进化周期
// ═══════════════════════════

async function runEvolutionCycle(options = {}) {
  ensureDB()
  const { startTime = Date.now() - 7 * 86400000, endTime = Date.now(), limit = 200 } = options

  console.log('[Evolution] 运行进化周期...')

  try {
    // ── Step 1: 拉取最近响应指标 ──
    const metricsRes = await _db.collection('response_metrics')
      .where({ createdAt: _db.command.gte(startTime).and(_db.command.lte(endTime)) })
      .orderBy('createdAt', 'desc').limit(limit).get()
    const metrics = metricsRes.data || []

    // ── Step 2: 拉取最近反馈 ──
    const feedbackRes = await _db.collection('response_feedback')
      .where({ createdAt: _db.command.gte(startTime).and(_db.command.lte(endTime)) })
      .limit(limit).get()
    const feedback = feedbackRes.data || []

    // ── Step 3: 反馈分析 ──
    const feedbackAnalysis = analyzeFeedback(feedback)

    // ── Step 4: 漂移健康检查 ──
    const responseTexts = metrics.map(m => ({ responseId: m.responseId, text: m.text || '' })).filter(r => r.text)
    let driftHealth = 'good'
    if (responseTexts.length >= 5) {
      driftHealth = personaHealthCheck(responseTexts).health
    }

    // ── Step 5: 质量评估 ──
    const qualityResults = metrics.slice(0, 50).map(m => ({
      response: { responseId: m.responseId, text: '', intent: m.intent, strategy: m.strategy, complexity: 5 },
      metrics: { shared: m.shared, saved: m.saved, ledToPayment: m.ledToPayment, continuationCount: m.continuationCount, rating: 0 },
    }))
    const avgQuality = qualityResults.length
      ? Math.round(qualityResults.reduce((s, r) => s + (r.responseScore || 0), 0) / qualityResults.length)
      : 0

    // ── Step 6: 生成优化计划 ──
    const optimizationPlan = planOptimizations(
      { avgQuality, count: qualityResults.length },
      feedbackAnalysis,
      { currentPromptVersions: {}, knowledgeStats: {}, driftHealth }
    )

    // ── Step 7: 写入进化日志 ──
    const cycleReport = {
      cycleId: `CYCLE_${Date.now()}`,
      timeRange: { startTime, endTime },
      metrics: { totalResponses: metrics.length, avgQuality },
      feedback: feedbackAnalysis.summary,
      driftHealth,
      optimizationPlan: {
        totalActions: optimizationPlan.actions.length,
        highPriorityCount: optimizationPlan.actions.filter(a => a.priority === 'critical' || a.priority === 'high').length,
      },
      createdAt: Date.now(),
    }

    await _db.collection('evolution_logs').add({ data: cycleReport })
    await _log('cycle_complete', cycleReport.cycleId, { status: 'success' })

    return {
      code: 0,
      data: {
        cycleId: cycleReport.cycleId,
        metrics: cycleReport.metrics,
        feedback: cycleReport.feedback,
        driftHealth,
        optimizationPlan: {
          totalActions: optimizationPlan.actions.length,
          topActions: optimizationPlan.actions.slice(0, 5).map(a => ({ priority: a.priority, action: a.action, reason: a.reason })),
        },
      },
    }
  } catch (e) {
    console.error('[Evolution] 进化周期异常:', e.message)
    return { code: -1, message: e.message }
  }
}

// ═══════════════════════════
// 4. 记录 Prompt 版本
// ═══════════════════════════

async function recordPromptVersion(promptKey, version, content, changelog = []) {
  ensureDB()
  try {
    await _db.collection('prompt_versions').add({
      data: {
        promptKey,
        version,
        content: (content || '').slice(0, 5000),
        changelog,
        active: true,
        createdAt: Date.now(),
      },
    })
    // 将旧版本设为 inactive
    await _db.collection('prompt_versions').where({ promptKey, active: true, version: _db.command.neq(version) }).update({
      data: { active: false },
    })
    await _log('prompt_version', promptKey, { version })
    return { code: 0, message: `Prompt ${promptKey} ${version} 已记录` }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ═══════════════════════════
// 5. 建议新增知识
// ═══════════════════════════

async function suggestKnowledgeTopic(topic, frequency = 1, reason = '') {
  ensureDB()
  try {
    const existing = await _db.collection('knowledge_suggestions').where({ topic }).get()
    if (existing.data.length > 0) {
      await _db.collection('knowledge_suggestions').doc(existing.data[0]._id).update({
        data: { frequency: _db.command.inc(frequency), updatedAt: Date.now() },
      })
    } else {
      await _db.collection('knowledge_suggestions').add({
        data: { topic, frequency, reason, suggested: false, createdAt: Date.now() },
      })
    }
    return { code: 0, message: '话题已记录' }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ═══════════════════════════
// 6. Human-in-the-loop 审核
// ═══════════════════════════

async function adminReview(responseId, review) {
  ensureDB()
  try {
    const { grade, comment, correctedText, addToKnowledge } = review

    const updateData = {
      adminReviewed: true,
      adminGrade: grade || 'none',   // excellent | average | poor
      adminComment: comment || '',
      adminReviewedAt: Date.now(),
    }

    if (correctedText) updateData.correctedText = correctedText

    await _db.collection('response_metrics').where({ responseId }).update({ data: updateData })
    await _log('admin_review', responseId, { grade, hasCorrection: !!correctedText })

    // 如果标记为加入知识库
    if (addToKnowledge && correctedText) {
      await suggestKnowledgeTopic(
        `admin_correction_${responseId.slice(0, 8)}`,
        5,
        '人工审核标记为优秀回答，建议提取为知识条目',
      )
    }

    return { code: 0, message: '审核完成' }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ═══════════════════════════
// 7. 获取进化报告
// ═══════════════════════════

async function getEvolutionReport(options = {}) {
  ensureDB()
  const { days = 7 } = options
  const since = Date.now() - days * 86400000

  try {
    const [metricsRes, feedbackRes, evoLogsRes] = await Promise.all([
      _db.collection('response_metrics').where({ createdAt: _db.command.gte(since) }).count(),
      _db.collection('response_feedback').where({ createdAt: _db.command.gte(since) }).count(),
      _db.collection('evolution_logs').orderBy('createdAt', 'desc').limit(3).get(),
    ])

    return {
      code: 0,
      data: {
        period: `${days}d`,
        totalResponses: metricsRes.total,
        totalFeedback: feedbackRes.total,
        feedbackRate: metricsRes.total ? (feedbackRes.total / metricsRes.total * 100).toFixed(1) + '%' : 'N/A',
        recentCycles: (evoLogsRes.data || []).map(l => ({
          cycleId: l.cycleId,
          createdAt: l.createdAt,
          avgQuality: l.metrics?.avgQuality,
          driftHealth: l.driftHealth,
        })),
      },
    }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

async function _log(operation, targetId, detail = {}) {
  try {
    await _db.collection('evolution_logs').add({
      data: { operation, targetId, detail, createdAt: Date.now() },
    })
  } catch (_) {}
}

module.exports = {
  recordResponse,
  recordFeedback,
  runEvolutionCycle,
  recordPromptVersion,
  suggestKnowledgeTopic,
  adminReview,
  getEvolutionReport,
}
