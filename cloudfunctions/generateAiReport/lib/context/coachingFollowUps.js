'use strict'
/**
 * lib/context/coachingFollowUps.js
 *
 * RC8_11_STAGE2 — 3 contextual follow-up questions after each AI answer.
 *
 * PRIORITY:
 *   PRIMARY   : current question + current AI answer + extracted action advice
 *               + active RAW_6Q + current scenario → continue the SAME thread.
 *   SECONDARY : if primary insufficient → derive from active RAW_6Q + scenario.
 *   FALLBACK  : existing 100-question bank (`data/aiChatSuggestions.js`).
 *
 * RULES:
 *   - continue the same decision thread (never a random generic topic)
 *   - each question unlocks a different next step
 *   - never repeat the user's original question verbatim
 *   - deterministic (no randomness for the primary path)
 *   - privacy-safe: derived only from already-authorized context
 */

let bank = { pickQuestions: () => [], AI_CHAT_SUGGESTIONS: [] }
try { bank = require('../../../../data/aiChatSuggestions.js') } catch (_) { bank = { pickQuestions: () => [], AI_CHAT_SUGGESTIONS: [] } }
const pickQuestions = bank.pickQuestions || (() => [])

const OCCUPATION_TOKENS = [
  '个体老板', '内容创作者', '技术人员', '自由职业', '健身教练', '产品经理',
  '外卖员', '快递员', '骑手', '厨师', '宝妈', '宝爸', '学生', '白领',
  '个体户', '创业者', '老板', '自媒体', '网约车', '程序员', '工程师', '设计师',
  '教师', '老师', '护士', '医生', '会计', '律师', '主播', '剪辑', '美工',
  '维修', '店员', '导购', '服务员', '公务员', '运营', '销售', '司机', '客服', '电商',
]

const FOCUS_PHRASES = ['变现', '副业', '转行', '加薪', '跳槽', '创业', '涨粉', '流量',
  '客户', '接单', '收入', '升职', '存钱', '理财', '出海', 'AI', '选品', '开店']

const TOPIC_TOKENS = ['技术', '技能', '内容', '产品', '服务', '客户', '流量', '渠道', '资本', '团队', '认知', '决策']

function _clean (v) { return typeof v === 'string' ? v.trim() : '' }

function _firstAttr (text, list) {
  const s = _clean(text)
  for (const p of list) { if (s.indexOf(p) >= 0) return p }
  return ''
}

function _occupation (raw6Q, profile, message, answer) {
  const explicit = _clean(raw6Q && raw6Q.job) || _clean(profile && (profile.occupation || profile.job))
  if (explicit) return explicit
  const corpus = _clean(message) + ' ' + _clean(answer)
  return _firstAttr(corpus, OCCUPATION_TOKENS)
}

function _dedupePush (arr, q, max) {
  const s = _clean(q)
  if (!s) return
  if (s.length > 24) return
  if (arr.indexOf(s) >= 0) return
  arr.push(s)
}

/** Deterministic contextual trio anchored on the user's own thread. */
function _contextual (opts) {
  const raw6Q = opts.raw6Q || {}
  const message = _clean(opts.message)
  const answer = _clean(opts.answer)
  const advice = _clean(opts.advice)
  const scenario = _clean(opts.scenario)
  const occ = _occupation(raw6Q, opts.profile || {}, message, answer)
  const focus = _firstAttr(message + ' ' + answer, FOCUS_PHRASES) || _firstAttr(answer, TOPIC_TOKENS) || ''
  const anxiety = _clean(raw6Q.anxiety)
  const income = _clean(raw6Q.income)

  const out = []

  // Q1 — concrete first step, scoped to occupation / focus.
  if (occ && focus) _dedupePush(out, `作为${occ}，我${focus}的第一步该做什么？`)
  else if (occ) _dedupePush(out, `以${occ}的身份，我第一步最该从哪里开始？`)
  else if (focus) _dedupePush(out, `我想在${focus}上突破，第一步从哪里开始？`)
  else if (scenario && scenario !== 'ask') _dedupePush(out, `顺着这个方向，我第一步最该验证什么？`)
  else _dedupePush(out, `按你的建议，我第一步最该先做什么？`)

  // Q2 — validation inside the user's real constraint (time / income / energy).
  if (income) _dedupePush(out, `在我现在收入不变的前提下，怎么低成本先验证？`)
  else _dedupePush(out, `如果每天只有2小时，我第一周该怎么验证？`)

  // Q3 — the next distinct step (customer / next action / continuation).
  if (anxiety) _dedupePush(out, `怎么先把「${anxiety}」这件事的压力降下来？`)
  else if (occ) _dedupePush(out, `怎么找到第一个愿意为我付钱的${occ === '程序员' || occ.indexOf('员') >= 0 ? '客户' : '人'}？`)
  else _dedupePush(out, `这件事的下一步，最关键的验证动作是什么？`)

  return out
}

/**
 * buildFollowUps
 * @returns {{followUps:string[], source:'PRIMARY'|'SECONDARY'|'FALLBACK', count:number}}
 */
function buildFollowUps (opts) {
  const a = opts || {}
  const message = _clean(a.message)
  const answer = _clean(a.answer)
  const raw6Q = a.raw6Q || {}
  const hasRaw6Q = !!(raw6Q && (raw6Q.job || raw6Q.income || raw6Q.anxiety || raw6Q.rootCause))
  const occ = _occupation(raw6Q, a.profile || {}, message, answer)

  let source = 'FALLBACK'
  let list = []

  if (answer.length >= 8 && (message || hasRaw6Q || occ)) {
    source = 'PRIMARY'
    list = _contextual(a)
  } else if (hasRaw6Q || occ || message) {
    source = 'SECONDARY'
    list = _contextual(a)
  }

  // Ensure exactly 3, non-duplicate; fill any gap from the bank.
  const exclude = [message].concat(list)
  if (list.length < 3) {
    const extra = pickQuestions(3 - list.length, [message]).map((q) => q.text)
    for (const e of extra) { if (list.length >= 3) break; _dedupePush(list, e) }
    if (source !== 'PRIMARY' || !list.length) source = list.length ? source : 'FALLBACK'
    if (!hasRaw6Q && !message && !answer) source = 'FALLBACK'
  }
  // Final guard: never repeat the user's own question.
  const followUps = list.filter((q) => q && q !== message).slice(0, 3)
  if (followUps.length < 3) {
    const extra = pickQuestions(6, [message].concat(followUps)).map((q) => q.text)
    for (const e of extra) { if (followUps.length >= 3) break; _dedupePush(followUps, e) }
  }
  return { followUps: followUps.slice(0, 3), source, count: Math.min(3, followUps.length) }
}

/** Standalone fallback (used for the AI-chat empty state / no-context). */
function fallbackFollowUps (excludeTexts, n) {
  return pickQuestions(n || 3, excludeTexts || []).map((q) => ({ icon: q.icon, text: q.text }))
}

module.exports = { buildFollowUps, fallbackFollowUps, _occupation }
