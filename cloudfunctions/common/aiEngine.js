/**
 * common/aiEngine.js - AI 编排引擎（核心护城河）
 *
 * 统一入口 runAI()
 *
 * 管道：
 *   Intent Router → Cost Guard → Model Selector → Circuit Breaker
 *   → Cache Check → Dynamic Token Budget → Context Builder
 *   → Prompt Builder → LLM Call (with retry) → Response Parser
 *   → Safety Filter → Cache Write
 *
 * v3.1 新增:
 *   - Circuit Breaker (5 fail → 30s 熔断)
 *   - Retry Policy (max 2, exponential backoff)
 *   - Dynamic Token Budget (3000 input, relevance-based trim)
 *   - Timeout Guard (12s hard / 3s soft)
 *
 * 禁止业务代码直接调 AI，全部走这里。
 */

const { routeIntent, SCENES, SCENE_NAMES } = require('./intentRouter.js')
const { buildPrompt } = require('./promptEngine.js')
const { buildContext, compressContext } = require('./contextBuilder.js')
const { getContextBudget, getMaxOutputTokens, calculateCost, estimateTokens } = require('./tokenBudget.js')
const { allocateBudget, isWithinBudget, getBudgetSummary } = require('./dynamicTokenBudget.js')
const { parseResponse } = require('./responseParser.js')
const { safetyFilter } = require('./safetyFilter.js')
const { callAI } = require('./ai.js')
const { getCircuitBreaker } = require('./circuitBreaker.js')

const now = () => Date.now()

// ═══════════════════════════════════════
// Model Selector — Tier 分层
// ═══════════════════════════════════════

// ═══ 内部 tier 名（不直接发给 API，需经 resolveModel 映射）═══
const MODEL_TIERS = {
  lite:     'lite',
  standard: 'standard',
  pro:      'pro',
}

/**
 * 根据 scene + 会员等级 选择模型
 */
/**
 * 将内部 tier 名映射为真实 API model 名
 *   lite/standard → AI_MODEL_FLASH (v4-flash)
 *   pro           → AI_MODEL_PRO   (v4-pro)
 * @param {string} tier - 内部层级 'lite'|'standard'|'pro'
 * @returns {string} 真实 API model 名
 */
function resolveModel(tier) {
  if (tier === 'pro') return process.env.AI_MODEL_PRO || 'v4-pro'
  return process.env.AI_MODEL_FLASH || 'v4-flash'
}

/**
 * 根据 scene + 会员等级 选择模型
 * @returns {string} 内部 tier 名（lite/standard/pro）
 */
function selectModel(scene, user, forceModel) {
  if (forceModel) return forceModel

  // 深度报告 → Pro
  if (scene === SCENES.REPORT_GENERATION) return MODEL_TIERS.pro
  // 挑战总结 → Pro
  if (scene === SCENES.CHALLENGE_SUMMARY) return MODEL_TIERS.pro

  // VIP/付费用户 → Standard
  if (user && user.membershipLevel && user.membershipLevel !== 'free') {
    return MODEL_TIERS.standard
  }

  // 免费用户 → Lite
  return MODEL_TIERS.lite
}

// ═══════════════════════════════════════
// AI Cache
// ═══════════════════════════════════════

const CACHE_TTL = {
  daily_insight:        86400 * 1000,       // 24h
  world_model_analysis: 7 * 86400 * 1000,   // 7d
  ai_chat:              0,                   // 不缓存
  report_generation:    365 * 86400 * 1000, // 永久（报告不变）
  challenge_summary:    365 * 86400 * 1000, // 永久
  coaching:             0,                   // 不缓存
}

function getCacheKey(scene, openid, input) {
  const payload = `${scene}:${openid}:${typeof input === 'string' ? input : JSON.stringify(input)}`
  const crypto = typeof require === 'function' ? require('crypto') : null
  if (crypto) {
    return crypto.createHash('md5').update(payload).digest('hex')
  }
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i)
    hash |= 0
  }
  return 'c_' + Math.abs(hash).toString(36)
}

async function getCache(db, cacheKey) {
  try {
    const res = await db.collection('ai_cache').where({ cacheKey }).limit(1).get()
    const entry = res.data[0]
    if (!entry) return null
    if (entry.expiredAt && entry.expiredAt <= now()) return null
    return entry.response
  } catch (_) { return null }
}

async function setCache(db, cacheKey, scene, response) {
  const ttl = CACHE_TTL[scene] || 0
  if (ttl <= 0) return
  try {
    const ts = now()
    const existing = await db.collection('ai_cache').where({ cacheKey }).limit(1).get()
    if (existing.data[0]) {
      await db.collection('ai_cache').doc(existing.data[0]._id).update({
        data: { response, expiredAt: ts + ttl, updatedAt: ts },
      })
    } else {
      await db.collection('ai_cache').add({
        data: { cacheKey, scene, response, expiredAt: ts + ttl, createdAt: ts, updatedAt: ts },
      })
    }
  } catch (_) {}
}

// ═══════════════════════════════════════
// Cost Guard — 每日成本守卫
// ═══════════════════════════════════════

const DAILY_AI_BUDGET_FEN = 50000 // ¥500 = 50000 分

async function checkCostGuard(db, openid) {
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()

  try {
    const res = await db.collection('ai_logs')
      .where({ openid, createdAt: db.command.gte(todayStart) })
      .field({ tokens: true })
      .get()

    const todayTokens = (res.data || []).reduce((s, l) => s + (l.tokens || 0), 0)
    const todayCost = calculateCost(todayTokens, resolveModel('pro')) // 按最高单价估

    return {
      overBudget: todayCost >= DAILY_AI_BUDGET_FEN,
      todayCost,
      budget: DAILY_AI_BUDGET_FEN,
    }
  } catch (_) {
    return { overBudget: false, todayCost: 0, budget: DAILY_AI_BUDGET_FEN }
  }
}

// ═══════════════════════════════════════
// Fallback Response Generator
// ═══════════════════════════════════════

/**
 * LLM 熔断时的降级响应
 */
function generateFallbackResponse(scene, userInput) {
  const msg = typeof userInput === 'string' ? userInput : (userInput?.message || userInput?.type || '')
  const safeMsg = (msg || '').slice(0, 50)

  const templates = {
    ai_chat: `抱歉，AI 引擎暂时过载，小事哥正在抢修中 🔧\n\n你可以先试试其他功能：\n- 认知挑战\n- 每日洞察\n- 世界规则\n\n问题已记录，恢复后优先处理：「${safeMsg}」`,
    coaching: `导师模式暂时不可用 📚\n\nAI 引擎正在冷却，预计 30 秒后恢复。\n换个话题试试？`,
    daily_insight: '今日洞察暂不可用\n\n数据引擎重新启动中，请稍后再试。',
    report_generation: '报告生成引擎暂时过载\n\n你的数据已保存，恢复后会自动生成。',
    challenge_summary: '挑战总结暂不可用\n\n结果已保存，稍后可在「我的」页面查看。',
    world_model_analysis: '世界模型分析暂不可用\n\n引擎冷却中，请稍后再试。',
  }

  return templates[scene] || templates.ai_chat
}

// ═══════════════════════════════════════
// Dynamic Context Builder
// ═══════════════════════════════════════

/**
 * 使用 Dynamic Token Budget 构建分层上下文
 * @returns {{ systemPrompt, userMessage, budgetSummary }}
 */
async function buildDynamicContext(db, openid, scene, userInput) {
  // 1. 构建用户上下文
  const ctx = await buildContext(db, openid, { includeChats: scene === SCENES.COACHING })
  const contextBudget = getContextBudget(scene)
  const serializedCtx = compressContext(ctx, contextBudget, scene)

  // 2. 获取 RAG 知识 (带 relevance score)
  let ragChunks = []
  try {
    const { ragSearch } = require('./ragEngine.js')
    const knowledgeResults = await ragSearch(userInput, { topK: 8 })
    ragChunks = knowledgeResults.map(k => ({
      content: k.content || k.text || String(k),
      relevanceScore: k._score || k.relevanceScore || k.score || 0.5,
    }))
  } catch (_) {}

  // 3. 获取 Memory (带 importance)
  let memoryChunks = []
  try {
    const { getRelevantMemories } = require('./memoryEngine.js')
    const memories = await getRelevantMemories(db, openid, scene, { limit: 10 })
    memoryChunks = (memories || []).map(m => ({
      content: m.content || m.text || String(m),
      importance: m.importance || m.weight || m.timestamp ? 0.5 : 0.3,
    }))
  } catch (_) {}

  // 4. 构建 system prompt
  const userMessage = userInput?.message || userInput?.type || (typeof userInput === 'string' ? userInput : '')
  const { systemPrompt, userMessage: finalMessage } = buildPrompt(scene, userMessage, serializedCtx)

  // 5. 动态分配 budget
  const allocation = allocateBudget(scene, {
    system: systemPrompt,
    rag: ragChunks,
    memory: memoryChunks,
    userContext: finalMessage,
  })

  const budgetSummary = getBudgetSummary(allocation)

  // 6. 组装最终 prompt
  const sections = []
  if (allocation.system) sections.push(allocation.system)
  if (allocation.memory) sections.push('---\n[用户记忆]\n' + allocation.memory)
  if (allocation.rag) sections.push('---\n[相关知识]\n' + allocation.rag)
  if (allocation.userContext) sections.push('---\n[当前对话]\n' + allocation.userContext)

  const fullSystemPrompt = allocation.system // 保留系统 prompt 独立
  const fullUserMessage = sections.slice(1).join('\n') // 其余合并到 user message

  // 7. 日志
  if (!isWithinBudget(allocation)) {
    const truncatedSlots = Object.entries(allocation.truncated)
      .filter(([, v]) => v)
      .map(([k]) => k)
    console.warn(`[AI Engine] ⚠️ Token 超出预算 (${budgetSummary.totalTokens}/3000), 已裁剪: ${truncatedSlots.join(', ')}`)
  }

  return {
    systemPrompt: fullSystemPrompt,
    userMessage: fullUserMessage,
    budgetSummary,
    truncated: allocation.truncated,
  }
}

// ═══════════════════════════════════════
// RUN AI — 总入口 (v3.1 updated)
// ═══════════════════════════════════════

/**
 * @param {object}   db              - 云数据库实例
 * @param {string}   openid          - 用户 openid
 * @param {object}   input           - { scene?, message?, type?, context? }
 * @param {object}   userOverride    - 用户对象（避免重复查库）
 * @param {string}   forceModel      - 强制指定模型（调试用）
 * @returns {{ success, data, cost, model, scene, cached, retriesUsed?, breakerState?, budgetSummary? }}
 */
async function runAI(db, openid, input, userOverride, forceModel) {
  const ts = now()
  const stats = {
    scene: '',
    model: '',
    tokens: 0,
    costFen: 0,
    cached: false,
    retriesUsed: 0,
    breakerState: 'CLOSED',
    budgetSummary: null,
  }

  try {
    // 1. 意图路由
    const scene = routeIntent(input)
    stats.scene = scene

    // 2. 查用户（或使用传入的）
    let user = userOverride
    if (!user) {
      const uRes = await db.collection('users').where({ openid }).limit(1).get()
      user = uRes.data[0] || {}
    }

    // 3. Cost Guard 检查
    const { overBudget, todayCost } = await checkCostGuard(db, openid)
    if (overBudget && (user.membershipLevel === 'free' || !user.membershipLevel)) {
      forceModel = MODEL_TIERS.lite
      console.warn(`[AI Engine] ⚠️ 今日成本 ¥${(todayCost/100).toFixed(2)} 已达预算，免费用户降级 Lite`)
    }

    // 4. 模型选择
    const tier = selectModel(scene, user, forceModel)
    const model = resolveModel(tier)  // tier → 真实 API model
    stats.model = model

    // 5. 缓存检查
    const cacheKey = getCacheKey(scene, openid, input)
    const cached = await getCache(db, cacheKey)
    if (cached) {
      stats.cached = true
      return { success: true, data: cached, ...stats }
    }

    // 6. 动态上下文构建 (with token budget)
    const { systemPrompt, userMessage, budgetSummary, truncated } = await buildDynamicContext(db, openid, scene, input)
    stats.budgetSummary = budgetSummary

    // 7. Circuit Breaker 保护调用
    const maxTokens = getMaxOutputTokens(scene)
    const breaker = getCircuitBreaker(model)
    stats.breakerState = breaker.state

    const aiCall = async () => {
      return await callAI({
        systemPrompt,
        userMessage,
        maxTokens,
        temperature: scene === SCENES.REPORT_GENERATION ? 0.5 : 0.7,
        forceModel: model,
      })
    }

    // 降级函数
    const fallback = async () => {
      const fallbackText = generateFallbackResponse(scene, input)
      return {
        success: true,
        content: fallbackText,
        tokens: 0,
        fallback: true,
      }
    }

    const breakerResult = await breaker.call(aiCall, fallback)
    stats.breakerState = breaker.state

    // 处理熔断拒绝
    if (breakerResult.rejected) {
      if (breakerResult.fallback) {
        stats.tokens = 0
        stats.costFen = 0
        console.warn(`[AI Engine] 🛡️ 熔断中, 使用降级响应 (scene: ${scene})`)
        await logAI({ db, openid, scene, type: input.type || '', tokens: 0, success: true, model, flagged: false, fallback: true, ts })
        return { success: true, data: breakerResult.result, fallback: true, ...stats }
      }
      // 无降级 → 返回错误
      await logAI({ db, openid, scene, type: input.type || '', tokens: 0, success: false, errorMessage: breakerResult.error || '熔断中', model, ts })
      return { success: false, error: breakerResult.error || 'AI 服务暂时不可用', ...stats }
    }

    const aiResult = breakerResult.result
    stats.retriesUsed = aiResult.retriesUsed || 0
    stats.tokens = aiResult.tokens || 0
    stats.costFen = calculateCost(stats.tokens, model)

    // 处理 AI 调用失败 (retry 耗尽后仍失败)
    if (!aiResult.success) {
      // 尝试降级
      if (breaker.state !== 'OPEN') {
        const fallbackText = generateFallbackResponse(scene, input)
        console.warn(`[AI Engine] ⚠️ AI 调用失败 (${aiResult.retriesUsed} retries), 使用降级响应`)
        await logAI({ db, openid, scene, type: input.type || '', tokens: 0, success: true, model, flagged: false, fallback: true, ts })
        return { success: true, data: fallbackText, fallback: true, ...stats }
      }
      await logAI({ db, openid, scene, type: input.type || '', tokens: 0, success: false, errorMessage: aiResult.error, model, ts })
      return { success: false, error: aiResult.error, ...stats }
    }

    // 8. 解析响应
    const parsed = parseResponse(scene, aiResult.content)

    // 9. 安全过滤
    const filtered = safetyFilter(parsed)
    const finalOutput = filtered.output

    // 10. 写缓存
    await setCache(db, cacheKey, scene, finalOutput)

    // 11. 写 AI 日志
    await logAI({
      db, openid, scene, type: input.type || '',
      tokens: stats.tokens, success: true, model,
      flagged: filtered.flagged ? true : false,
      retriesUsed: stats.retriesUsed,
      budgetSummary: stats.budgetSummary,
      ts,
    })

    return { success: true, data: finalOutput, ...stats }
  } catch (err) {
    console.error('[AI Engine] 异常:', err)
    await logAI({
      db, openid, scene: stats.scene || 'unknown', type: input.type || '',
      tokens: 0, success: false, errorMessage: err.message, model: stats.model || 'unknown', ts,
    })
    return { success: false, error: err.message, ...stats }
  }
}

// ═══════════════════════════════════════
// AI 日志统一写入
// ═══════════════════════════════════════

async function logAI(opts) {
  const { db, openid, scene, type, tokens, success, model, flagged, errorMessage, fallback, retriesUsed, budgetSummary, ts } = opts
  try {
    await db.collection('ai_logs').add({
      data: {
        openid,
        action: scene,
        type: type || '',
        tokens,
        success: !!success,
        errorMessage: errorMessage || '',
        model: model || '',
        flagged: !!flagged,
        fallback: !!fallback,
        retriesUsed: retriesUsed || 0,
        budgetTruncated: budgetSummary ? !isWithinBudget({ truncated: {}, tokenBreakdown: budgetSummary?.breakdown || {} }) : false,
        createdAt: ts,
      },
    })
  } catch (_) {}
}

module.exports = {
  runAI,
  selectModel,
  resolveModel,
  MODEL_TIERS,
  DAILY_AI_BUDGET_FEN,
  CACHE_TTL,
  SCENES,
  SCENE_NAMES,
}
