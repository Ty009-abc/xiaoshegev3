'use strict'
/**
 * lib/context/coachingContextRuntime.js
 *
 * RC8_10A — ONE grounded coaching turn.
 *
 *   buildUserContext  (L0 6Q → L1 profile → L2 challenge → L3 report →
 *                      L4 memory [gated] → L5 current message)
 *        ↓
 *   composeScenarioPrompt
 *        ↓
 *   callAI (ONE call)
 *        ↓
 *   validateScenarioResponse → on fail, ONE regeneration with feedback
 *
 * The validator is deterministic and only ever REGENERATES (MAX_RETRY = 1); it
 * never blocks delivery of the response (best-effort accept after one retry).
 * Everything is scoped to the authenticated openid passed by the caller.
 */

const ucb = require('./userContextBuilder.js')

/**
 * @returns {Promise<{ok, aiResult, ctx, attempts, validation}>}
 */
async function runCoachingTurn (args) {
  const a = args || {}
  const scenario = a.scenario || 'ask'
  const message = a.message || ''
  const maxTokens = a.maxTokens || 2048
  const temperature = a.temperature != null ? a.temperature : 0.7

  const ctx = await ucb.buildUserContext(a.db, a.openid, {
    scenario, message,
    memoryEnabled: a.memoryEnabled !== false,
    memories: a.memories || [],
  })

  const built = ucb.composeScenarioPrompt(scenario, ctx)
  let systemPrompt = built.systemPrompt
  const userMessage = built.userMessage
  // Persona flavour only (cosmetic) — never overrides grounded facts.
  if (a.personality) systemPrompt += '\n\n本次分析视角：' + (a.personalityEmoji || '') + ' ' + a.personality

  let aiResult = await a.callAI({ systemPrompt, userMessage, maxTokens, temperature })
  if (!aiResult || !aiResult.success) {
    return { ok: false, aiResult: aiResult || null, ctx, attempts: 1, validation: null }
  }

  let validation = ucb.validateScenarioResponse(aiResult.content, ctx)
  let attempts = 1
  if (!validation.ok) {
    attempts = 2
    const feedback = '\n\n【自检未通过，请修正后重新回答】必须满足：' + validation.errors.join('、') +
      '。禁止编造用户未提供的技能/收入/经历/资源；禁止与用户职业明显无关的建议；禁止无依据的收益承诺。'
    const retry = await a.callAI({ systemPrompt: systemPrompt + feedback, userMessage, maxTokens, temperature })
    if (retry && retry.success && retry.content) {
      const v2 = ucb.validateScenarioResponse(retry.content, ctx)
      if (v2.ok) { aiResult = retry; validation = v2 }
    }
  }

  return { ok: true, aiResult, ctx, attempts, validation, systemPrompt }
}

module.exports = { runCoachingTurn }
