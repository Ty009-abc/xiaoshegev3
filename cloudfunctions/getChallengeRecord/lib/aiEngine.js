/**
 * common/aiEngine.js - AI 编排引擎（核心护城河）
 *
 * 统一入口 runAI()
 *
 * 管道：
 *   Intent Router → Prompt Engine → Context Builder → Model Selector
 *   → Cost Guard → LLM Call → Response Parser → Safety Filter → Cache
 *
 * 禁止业务代码直接调 AI，全部走这里。
 */

const { routeIntent, SCENES, SCENE_NAMES } = require('./intentRouter.js')
const { buildPrompt } = require('./promptEngine.js')
const { buildContext, compressContext } = require('./contextBuilder.js')
const { getContextBudget, getMaxOutputTokens, checkBudget, calculateCost, estimateTokens } = require('./tokenBudget.js')
const { parseResponse } = require('./responseParser.js')
const { safetyFilter } = require('./safetyFilter.js')
const { callAI } = require('./ai.js')

const now = () => Date.now()

// ═══════════════════════════════════════
// Model Selector — Tier 分层
// ═══════════════════════════════════════

const MODEL_TIERS = {
  lite:     'lite',
  standard: 'standard',
  pro:      'pro',
}

/**
 * 将内部 tier 名映射为真实 API model 名
 *   lite/standard → AI_MODEL_FLASH (v4-flash)
 *   pro           → AI_MODEL_PRO   (v4-pro)
 */
function resolveModel(tier) {
  if (tier === 'pro') return process.env.AI_MODEL_PRO || 'v4-pro'
  return process.env.AI_MODEL_FLASH || 'v4-flash'
}

/**
 * 根据 scene + 会员等级 选择模型
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

/**
 * 计算缓存 key
 */
function getCacheKey(scene, openid, input) {
  const payload = `${scene}:${openid}:${typeof input === 'string' ? input : JSON.stringify(input)}`
  const crypto = typeof require === 'function' ? require('crypto') : null
  if (crypto) {
    return crypto.createHash('md5').update(payload).digest('hex')
  }
  // fallback: simple hash
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i)
    hash |= 0
  }
  return 'c_' + Math.abs(hash).toString(36)
}

/**
 * 尝试读缓存
 */
async function getCache(db, cacheKey) {
  try {
    const res = await db.collection('ai_cache').where({ cacheKey }).limit(1).get()
    const entry = res.data[0]
    if (!entry) return null
    if (entry.expiredAt && entry.expiredAt <= now()) return null
    return entry.response
  } catch (_) { return null }
}

/**
 * 写缓存
 */
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

/**
 * 检查今日 AI 总成本是否超预算
 * @returns {{ overBudget: boolean, todayCost: number, budget: number }}
 */
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
// RUN AI — 总入口
// ═══════════════════════════════════════

/**
 * @param {object}   db              - 云数据库实例
 * @param {string}   openid          - 用户 openid
 * @param {object}   input           - { scene?, message?, type?, context? }
 * @param {object}   userOverride    - 用户对象（避免重复查库）
 * @param {string}   forceModel      - 强制指定模型（调试用）
 * @returns {{ success, data, cost, model, scene, cached }}
 */
async function runAI(db, openid, input, userOverride, forceModel) {
  const ts = now()
  const stats = { scene: '', model: '', tokens: 0, costFen: 0, cached: false }

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
      // 免费用户超预算 → 强制 Lite
      forceModel = MODEL_TIERS.lite
      console.warn(`[AI Engine] ⚠️ 今日成本 ¥${(todayCost/100).toFixed(2)} 已达预算，免费用户降级 Lite`)
    }

    // 4. 模型选择
    const model = selectModel(scene, user, forceModel)
    stats.model = model

    // 5. 缓存检查
    const cacheKey = getCacheKey(scene, openid, input)
    const cached = await getCache(db, cacheKey)
    if (cached) {
      stats.cached = true
      return { success: true, data: cached, ...stats }
    }

    // 6. 构建上下文
    const ctx = await buildContext(db, openid, { includeChats: scene === SCENES.COACHING })
    const contextBudget = getContextBudget(scene)
    const serializedCtx = compressContext(ctx, contextBudget, scene)

    // 7. 构建 Prompt
    const userMessage = input.message || input.type || ''
    const { systemPrompt, userMessage: finalMessage } = buildPrompt(scene, userMessage, serializedCtx)

    // 8. Token 预算检查
    const combined = systemPrompt + '\n' + finalMessage
    const budgetCheck = checkBudget(combined, scene)
    if (!budgetCheck.withinBudget) {
      console.warn(`[AI Engine] ⚠️ Token 超预算: ${budgetCheck.estimatedTokens}/${budgetCheck.limit}`)
    }

    // 9. 调用 LLM
    const maxTokens = getMaxOutputTokens(scene)
    const aiResult = await callAI({ systemPrompt, userMessage: finalMessage, maxTokens, temperature: scene === SCENES.REPORT_GENERATION ? 0.5 : 0.7 })
    stats.tokens = aiResult.tokens || 0
    stats.costFen = calculateCost(stats.tokens, model)

    if (!aiResult.success) {
      // 记录失败日志
      try {
        await db.collection('ai_logs').add({
          data: { openid, action: scene, type: input.type || '', tokens: 0, success: false, errorMessage: aiResult.error, createdAt: ts },
        })
      } catch (_) {}
      return { success: false, error: aiResult.error, ...stats }
    }

    // 10. 解析响应
    const parsed = parseResponse(scene, aiResult.content)

    // 11. 安全过滤
    const filtered = safetyFilter(parsed)
    const finalOutput = filtered.output

    // 12. 写缓存
    await setCache(db, cacheKey, scene, finalOutput)

    // 13. 写 AI 日志
    try {
      await db.collection('ai_logs').add({
        data: {
          openid, action: scene, type: input.type || '',
          tokens: stats.tokens, success: true, errorMessage: '',
          model, flagged: filtered.flagged ? true : false,
          createdAt: ts,
        },
      })
    } catch (_) {}

    return { success: true, data: finalOutput, ...stats }
  } catch (err) {
    console.error('[AI Engine] 异常:', err)
    try {
      await db.collection('ai_logs').add({
        data: { openid, action: stats.scene || 'unknown', type: input.type || '', tokens: 0, success: false, errorMessage: err.message, createdAt: ts },
      })
    } catch (_) {}
    return { success: false, error: err.message, ...stats }
  }
}

module.exports = {
  runAI,
  selectModel,
  MODEL_TIERS,
  DAILY_AI_BUDGET_FEN,
  CACHE_TTL,
  SCENES,
  SCENE_NAMES,
}
