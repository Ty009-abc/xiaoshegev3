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

// ═══════════════════════════════════════════════════════════════════════════
// RC8_11_STAGE2D — structured internal actionAdvice.
// The model appends ONE hidden, HTML-comment-delimited JSON block AFTER the
// user-visible prose. The server schema-validates it, strips the block (never
// reaches the UI), and feeds it into the SAME follow-up engine. Absent/invalid
// → the existing deterministic extraction / scenario / bank chain is used.
// ═══════════════════════════════════════════════════════════════════════════
const ADV_OPEN = '<!--ADV:'
const ADV_CLOSE = '-->'
const ADV_MAX = 60
const ADV_FIELDS = ['primaryAction', 'expectedOutcome', 'blockingConstraint', 'missingEvidence', 'cheapestValidation', 'unresolvedDecision']

/** Instruction appended to the coaching system prompt (structured field request). */
function adviceInstruction () {
  return [
    '',
    '═══ 内部结构化字段（用户不可见，不计入正文） ═══',
    '正文写完后，另起一行，追加且仅追加一个 HTML 注释形式的 JSON：',
    ADV_OPEN + '{"primaryAction":"","expectedOutcome":"","blockingConstraint":"","missingEvidence":"","cheapestValidation":"","unresolvedDecision":""}' + ADV_CLOSE,
    '规则：primaryAction=本轮最该做的一步；blockingConstraint=最可能的真实卡点；cheapestValidation=最小成本验证方式；每项<=24字；无信息留空；该 JSON 必须单行合法；不要在正文里解释这个块。',
  ].join('\n')
}

/** Strict schema validation. Returns normalized advice or null (never throws). */
function validateAdvice (obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const out = {}
  for (const f of ADV_FIELDS) {
    const v = obj[f]
    if (v === undefined || v === null) { out[f] = ''; continue }
    if (typeof v !== 'string') return null
    if (v.length > ADV_MAX) return null
    out[f] = v.trim()
  }
  if (!out.primaryAction && !out.blockingConstraint && !out.cheapestValidation) return null
  return out
}

/**
 * Parse an LLM answer into { advice, prose, hadBlock, valid }.
 * `prose` is ALWAYS safe to show (the hidden block is removed).
 */
function parseActionAdvice (rawText) {
  const text = typeof rawText === 'string' ? rawText : ''
  let prose = text
  let advice = null
  let hadBlock = false
  let valid = false
  const start = text.indexOf(ADV_OPEN)
  if (start !== -1) {
    const end = text.indexOf(ADV_CLOSE, start + ADV_OPEN.length)
    if (end !== -1) {
      hadBlock = true
      const jsonStr = text.slice(start + ADV_OPEN.length, end).trim()
      prose = (text.slice(0, start) + text.slice(end + ADV_CLOSE.length)).trim()
      try { advice = validateAdvice(JSON.parse(jsonStr)); valid = !!advice } catch (_) { advice = null; valid = false }
    }
  }
  return { advice, prose, hadBlock, valid }
}

const FOCUS_MAP = [
  [/技术|编程|代码|开发|工程师|程序员|运维|测试/i, '技术'],
  [/厨|菜|餐饮|面点|小吃/, '手艺'],
  [/外卖|骑手|配送|跑腿|网约车|司机/, '时间'],
  [/销售|成交|客户开发|中介/, '销售'],
  [/宝妈|带娃|育儿|全职妈妈/, '时间'],
  [/AI|人工智能|大模型|提示词|自动化/i, 'AI'],
  [/现金流|门店|生意|个体|开店|利润/, '生意'],
  [/内容|创作|短视频|写作|自媒体|博主|视频号/, '内容'],
  [/学生|应届|职业|毕业|选专业/, '方向'],
]
const GAP_MAP = [
  [/需求/, '不会找需求'],
  [/客户|客源|订单|接单/, '不会找客户'],
  [/流量|曝光|涨粉/, '没有稳定流量'],
  [/资金|本金|没钱|启动/, '没有启动资金'],
  [/时间|精力/, '没有整块时间'],
  [/定价|报价/, '不敢定价'],
  [/渠道/, '没有渠道'],
  [/信任|背书/, '没有信任背书'],
  [/定位/, '定位太宽'],
]

function _focusWord (text, fb) {
  const t = _clean(text)
  for (const [re, w] of FOCUS_MAP) if (re.test(t)) return w
  return fb || '现有'
}
function _gapWord (text) {
  const t = _clean(text)
  for (const [re, w] of GAP_MAP) if (re.test(t)) return w
  return ''
}
function _validWord (text) {
  let t = _clean(text).replace(/^[7七]\s*天|^一周|^1\s*周/, '')
  t = t.split(/[，,。；;！!\n]/)[0]
  return t.slice(0, 12)
}
function _topicAnchorId (occ, focus) {
  const s = _clean(occ) + '|' + _clean(focus)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return 'ta_' + h.toString(36)
}

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
  const scenario = _clean(opts.scenario)
  const occ = _occupation(raw6Q, opts.profile || {}, message, answer)
  const focus = _firstAttr(message + ' ' + answer, FOCUS_PHRASES) || _firstAttr(answer, TOPIC_TOKENS) || ''
  const anxiety = _clean(raw6Q.anxiety)
  const income = _clean(raw6Q.income)
  const adv = opts.actionAdvice || null

  const out = []

  // ── RC8_11_STAGE2D — structured actionAdvice drives a SAME-thread trio ──
  if (adv && (adv.primaryAction || adv.blockingConstraint || adv.cheapestValidation)) {
    const occText = occ || ''
    const F = _focusWord(adv.primaryAction || focus || occText, _focusWord(focus || occText, '现有'))
    const G = _gapWord(adv.blockingConstraint)
    const V = _validWord(adv.cheapestValidation)
    // Q1 action_entry — what to do first
    _dedupePush(out, `我现在哪项${F}能力最值得先卖？`)
    // Q2 cognitive_gap — refine Q1's path, expose the constraint
    _dedupePush(out, G ? `我一直没做成，真正卡在${G}吗？` : `我一直没做成，真正卡在哪？`)
    // Q3 validation_loop — validate Q2's finding at lowest cost
    _dedupePush(out, V ? `7天内${V}，怎样判断值得继续？` : `7天内怎样最低成本验证？`)
    return out
  }

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
  const focus = _firstAttr(message + ' ' + answer, FOCUS_PHRASES) || ''
  // RC8_11_STAGE2D — structured advice (pre-validated) takes PRIMARY priority.
  const adv = validateAdvice(a.actionAdvice)

  let source = 'FALLBACK'
  let list = []

  if (adv) {
    source = 'PRIMARY'
    list = _contextual(Object.assign({}, a, { actionAdvice: adv }))
  } else if (answer.length >= 8 && (message || hasRaw6Q || occ)) {
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
  const topicAnchorId = _topicAnchorId(occ, focus)
  const actionAdviceSource = adv ? 'structured' : ((message || hasRaw6Q) ? 'deterministic' : 'none')
  return {
    followUps: followUps.slice(0, 3),
    source,
    count: Math.min(3, followUps.length),
    topicAnchorId,
    actionAdviceSource,
  }
}

/** Standalone fallback (used for the AI-chat empty state / no-context). */
function fallbackFollowUps (excludeTexts, n) {
  return pickQuestions(n || 3, excludeTexts || []).map((q) => ({ icon: q.icon, text: q.text }))
}

/**
 * buildPaywallSummary — ≤3 concise facts for the quota-exhausted paywall.
 * Derived from active RAW_6Q (primary) + the current conversation (current ask).
 * Privacy-safe: only the user's own already-authorized facts.
 */
function buildPaywallSummary (opts) {
  const a = opts || {}
  const raw6Q = a.raw6Q || {}
  const profile = a.profile || {}
  const facts = []
  const job = _clean(raw6Q.job) || _clean(profile.occupation || profile.job)
  const income = _clean(raw6Q.income)
  const anxiety = _clean(raw6Q.anxiety)
  const rootCause = _clean(raw6Q.rootCause)
  if (job) facts.push('职业：' + job)
  if (income) facts.push('月收入：' + income)
  if (anxiety) facts.push('当前最焦虑：' + anxiety)
  else if (rootCause) facts.push('卡点：' + rootCause)
  if (facts.length < 3) {
    const occ = _occupation(raw6Q, profile, a.message || '', '')
    const focus = _firstAttr(_clean(a.message), FOCUS_PHRASES)
    if (occ && focus && facts.length < 3) facts.push('近期关注：' + focus)
  }
  return facts.slice(0, 3)
}

module.exports = {
  buildFollowUps, fallbackFollowUps, buildPaywallSummary, _occupation,
  // RC8_11_STAGE2D
  adviceInstruction, parseActionAdvice, validateAdvice,
}
