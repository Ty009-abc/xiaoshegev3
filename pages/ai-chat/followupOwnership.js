/**
 * pages/ai-chat/followupOwnership.js
 *
 * RC8_11_STAGE2D_FOLLOWUP_FLOW_UI_STABILITY
 * RC8_11_STAGE2D_DYNAMIC_FOLLOWUP_QUEUE
 *
 * Pure, dependency-free helpers for follow-up OWNERSHIP + a DYNAMIC QUEUE.
 *
 * Ownership: a follow-up set is NEVER page-global. Each set belongs to exactly
 * ONE assistant answer (parentAnswerId) from ONE generation (generationId), and
 * only the LATEST answer may render its set. Tapping a follow-up invalidates
 * the previous set synchronously.
 *
 * Queue: asked questions are removed permanently from the current thread and
 * tracked (text + intentKey). Replenishment refills the visible queue back to
 * TARGET_COUNT=3 from each new answer, never re-surfacing an asked question or
 * an already-present intent, and prefers moving one depth LEVEL deeper.
 *
 * No network, no LLM — deterministic.
 */

'use strict'

const TARGET_COUNT = 3
const TITLE = '接下来你可以继续问'
const LADDER_INTENTS = ['action_entry', 'cognitive_gap', 'validation_loop']
const LADDER_ORDER = ['action_entry', 'cognitive_gap', 'validation_loop']

// ── Depth progression: each generation should advance one level deeper. ──
const DEPTH_LEVELS = ['direction', 'constraint', 'validation', 'first_result', 'repeatability', 'scale']

// Intent taxonomy. Wording changes alone do NOT make a new question: two items
// with the same role/intentKey are SAME_INTENT.
//   text  → canonical intentKey
//   role: the ladder slot
//   level: depth level
const INTENT_RULES = [
  { k: 'action_entry', level: 'direction', re: /(第一步|最先|从哪(一)?步|该先|开始|先做|先卖|哪一项|哪项)/ },
  { k: 'validation', level: 'validation', re: /(验证|试一下|最低成本|7\s*天|一周|试跑|小规模|测试)/ },
  { k: 'persist_judge', level: 'validation', re: /(没结果|判断.*(值|继续|停|止损)|该不该停|要不要继续|多久没)/ },
  { k: 'constraint', level: 'constraint', re: /(凭什么|真正卡|卡在|卡点|障碍|风险|为什么没|瓶颈)/ },
  { k: 'channel_choice', level: 'direction', re: /(卖手艺|卖内容|卖服务|哪个渠道|卖什么|选品|从哪卖|哪条路)/ },
  { k: 'first_customer', level: 'first_result', re: /(第一个|首位|愿意付|付费|客户|接单|成交|变现|拿到钱)/ },
  { k: 'pricing', level: 'first_result', re: /(定价|多少钱|报价|收费|价格)/ },
  { k: 'constraint_relief', level: 'constraint', re: /(压力|焦虑|降下来|情绪|焦虑感)/ },
  { k: 'repeatability', level: 'repeatability', re: /(重复|稳定|持续|复购|第二单|下次还)/ },
  { k: 'scale', level: 'scale', re: /(放大|规模化|杠杆|团队|扩张|复制)/ },
]

// topic-independent generic fillers, ordered by depth level.
const GENERIC = {
  direction: ['那我第一步到底该从哪开始？'],
  constraint: ['我真正卡住的点，最有可能是哪一个？'],
  validation: ['我该怎么用最低成本先验证一次？'],
  first_result: ['我怎么才能拿到第一个愿意付费的结果？'],
  repeatability: ['如果第一次成了，我怎么让它稳定重复？'],
  scale: ['这件事如果要放大，我该先动哪一环？'],
}

// Deterministic, context-filtered fallback questions (NO LLM, NO network).
const FALLBACK_BANK = {
  ask: [
    '那我现在最该先做的一件事是什么？',
    '我该怎么用一周时间验证这个方向？',
    '如果一个月没有结果，我该怎么判断该不该停？',
  ],
  wealth: [
    '以我现在的收入结构，第一步该先攒钱还是先涨收入？',
    '这笔钱我该怎么分配才不会影响生活底线？',
    '我该怎么判断自己是在积累资本还是在消耗资本？',
  ],
  ai: [
    '我该先学哪一个马上能用上的 AI 能力？',
    '我怎么用最少的时间做出第一个成果？',
    '如果三个月没起色，我该怎么判断这条路对不对？',
  ],
  decision: [
    '我该怎么用最小成本先试一次？',
    '我该用什么信号判断这次该止损还是加注？',
    '如果信息不足，我该先补哪一个最关键的事实？',
  ],
}
const FILLERS = [
  '那我现在具体该从哪一步开始？',
  '我该怎么把这件事变成可执行的一周计划？',
  '我该用什么标准判断这件事值不值得继续？',
]

function dedupeKey (s) {
  return String(s === undefined || s === null ? '' : s).replace(/\s+/g, '')
}

/** Stable intent key for a question: a semantic role, not its wording. */
function intentKeyOf (text) {
  const t = String(text === undefined || text === null ? '' : text)
  for (let i = 0; i < INTENT_RULES.length; i++) {
    if (INTENT_RULES[i].re.test(t)) return INTENT_RULES[i].k
  }
  return 'generic_' + dedupeKey(t).slice(0, 12)
}

function roleLevelOf (text) {
  const k = intentKeyOf(text)
  const rule = INTENT_RULES.find(function (r) { return r.k === k })
  return rule ? rule.level : 'direction'
}

/**
 * Normalize + de-duplicate a candidate list against exclusion sets.
 * opts: { excludeTexts:[], excludeIntents:[], excludeKey:Set, selectedText }
 * Returns [{ text, intentKey, level }].
 */
function filterCandidates (list, opts) {
  const o = opts || {}
  const excludeTexts = new Set((o.excludeTexts || []).map(dedupeKey))
  const excludeIntents = new Set((o.excludeIntents || []).filter(Boolean))
  if (o.selectedText) excludeTexts.add(dedupeKey(o.selectedText))
  const seenText = new Set()
  const seenIntent = new Set()
  const out = []
  for (let i = 0; i < (list || []).length; i++) {
    const t = String(list[i] === undefined || list[i] === null ? '' : list[i]).trim()
    if (!t) continue
    const tk = dedupeKey(t)
    if (excludeTexts.has(tk) || seenText.has(tk)) continue
    const ik = intentKeyOf(t)
    if (excludeIntents.has(ik) || seenIntent.has(ik)) continue
    seenText.add(tk)
    seenIntent.add(ik)
    out.push({ text: t, intentKey: ik, level: roleLevelOf(t) })
  }
  return out
}

/** Trim, drop empties, drop the selected question, de-duplicate by text. */
function normalizeList (list, excludeText) {
  return filterCandidates(list, { selectedText: excludeText }).map(function (x) { return x.text })
}

/**
 * Refill the visible queue to TARGET_COUNT.
 *
 * Surviving items (previously visible, NOT yet asked) are RETAINED first — per
 * the contract flow (tap Q1 → keep Q2/Q3 → add a new Q4). Fresh per-answer
 * candidates (server followUps) follow; then deterministic contextual extras;
 * then depth-ordered generics + scenario bank + fillers.
 *
 * Only ASKED questions/intents are excluded. The currently visible set is kept
 * in view — it is NOT "asked".
 */
function refillQueue (opts) {
  const o = opts || {}
  const anchor = o.topicAnchorId || ''
  const scenario = o.scenario || 'ask'
  const depthLevel = Math.max(0, Math.min(DEPTH_LEVELS.length - 1, o.depthLevel || 0))
  const askedTexts = o.askedTexts || []
  const askedIntents = o.askedIntents || []
  const survivors = (o.surviving || o.pendingTexts || []).filter(Boolean)

  const seen = new Set(askedTexts.map(dedupeKey))
  const seenIntent = new Set(askedIntents.filter(Boolean))
  const picked = []

  function tryPush (text, source) {
    const t = String(text === undefined || text === null ? '' : text).trim()
    if (!t) return false
    const tk = dedupeKey(t)
    if (seen.has(tk)) return false
    const ik = intentKeyOf(t)
    if (seenIntent.has(ik)) return false
    seen.add(tk)
    seenIntent.add(ik)
    picked.push({ text: t, intentKey: ik, level: roleLevelOf(t), source: source })
    return true
  }

  // RETAIN — surviving unasked queue items (kept in place).
  for (const t of survivors) { if (picked.length >= TARGET_COUNT) break; tryPush(t, 'queue') }
  // PRIMARY — fresh server contextual items (already same-thread).
  for (const t of (o.completedRes || [])) { if (picked.length >= TARGET_COUNT) break; tryPush(t, 'primary') }
  // SECONDARY — deterministic contextual extras.
  for (const t of (o.secondary || [])) { if (picked.length >= TARGET_COUNT) break; tryPush(t, 'secondary') }

  // TERTIARY — depth-ordered levels (below current depth first), then bank, then generic.
  const levelOrder = DEPTH_LEVELS.slice(depthLevel).concat(DEPTH_LEVELS.slice(0, depthLevel))
  const bank = (FALLBACK_BANK[scenario] || FALLBACK_BANK.ask).concat(FALLBACK_BANK.ask, FILLERS)
  for (const lvl of levelOrder) {
    if (picked.length >= TARGET_COUNT) break
    const g = GENERIC[lvl] || []
    for (const t of g) { if (picked.length >= TARGET_COUNT) break; tryPush(t, 'tertiary') }
  }
  for (const t of bank) { if (picked.length >= TARGET_COUNT) break; tryPush(t, 'bank') }

  const followUps = picked.map(function (p) { return p.text }).slice(0, TARGET_COUNT)
  const freshOnly = picked.length > 0 && picked.every(function (p) { return p.source === 'primary' })
  const hasServer = (o.completedRes || []).length > 0
  let source = 'fallback'
  if (freshOnly) source = 'server'
  else if (hasServer && picked.some(function (p) { return p.source === 'queue' || p.source === 'primary' })) source = 'server+fallback'
  else if (picked.some(function (p) { return p.source === 'queue' })) source = 'queue+fallback'
  const nextDepthLevel = Math.min(DEPTH_LEVELS.length - 1, depthLevel + (o.advanceDepth ? 1 : 0))
  return {
    followUps: followUps,
    items: picked,
    followUpSource: source,
    topicAnchorId: anchor,
    depthLevel: nextDepthLevel,
    followUpLadder: picked.map(function (p, i) {
      return { intent: p.intentKey, role: LADDER_ORDER[i] || 'extra', level: p.level, topicAnchorId: anchor, text: p.text }
    }),
  }
}

/**
 * Backwards-compatible exact-count completion (used by tests + simple path).
 * Server items first, then scenario fallback, then fillers — text-dedup only.
 */
function completeFollowUps (list, opts) {
  const o = opts || {}
  const selectedText = o.selectedText || ''
  const r = refillQueue({
    completedRes: list || [],
    askedTexts: selectedText ? [selectedText] : [],
    askedIntents: [],
    surviving: [],
    scenario: o.scenario || 'ask',
    topicAnchorId: o.topicAnchorId || '',
    depthLevel: 0,
  })
  return {
    followUps: r.followUps,
    followUpSource: r.followUpSource,
    topicAnchorId: o.topicAnchorId || '',
    followUpLadder: r.followUpLadder,
  }
}

function genId (prefix) {
  return (prefix || 'gen') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function messageId (seq) {
  return 'm' + seq
}

/**
 * On tap: remove the selected question NOW (mark asked), keep the remaining
 * queue hidden during loading. Returns { setData, asked }.
 * opts: { activeFollowUps, askedFollowUps, askedIntentKeys, selected }
 */
function consumeOnTap (opts) {
  const o = opts || {}
  const active = Array.isArray(o.activeFollowUps) ? o.activeFollowUps : []
  const selected = String(o.selected || '').trim()
  const remaining = active.filter(function (q) { return q !== selected })
  const selKey = intentKeyOf(selected)
  const askedFollowUps = (o.askedFollowUps || []).concat(selected ? [selected] : [])
  const askedIntentKeys = (o.askedIntentKeys || []).concat((selected && selKey) ? [selKey] : [])
  return {
    asked: { text: selected, intentKey: selKey },
    setData: {
      activeFollowUps: [],
      pendingFollowUps: remaining,
      askedFollowUps: askedFollowUps,
      askedIntentKeys: askedIntentKeys,
      activeFollowUpParentId: '',
      activeFollowUpGenerationId: '',
      followUpAnchorId: '',
      followUpLoading: true,
      followUpVisible: false,
    },
  }
}

/**
 * Legacy invalidation (no queue state) — still used by the error/quota paths.
 */
function invalidateOnTap () {
  return {
    activeFollowUps: [],
    activeFollowUpParentId: '',
    activeFollowUpGenerationId: '',
    followUpAnchorId: '',
    followUpLoading: true,
    followUpVisible: false,
  }
}

/**
 * Stamp a completed answer's queue onto the LAST message + bind the active
 * pointer + bump the depth level.
 * data: { messages, askedFollowUps, askedIntentKeys, pendingFollowUps, depthLevel }
 * res : refillQueue() result
 */
function stampFollowUps (messages, res, generationId, data) {
  const d = data || {}
  const list = (res && res.followUps) || []
  if (!Array.isArray(messages) || messages.length === 0 || !list.length) {
    return {
      messages: messages || [],
      activeFollowUps: [],
      activeFollowUpParentId: '',
      activeFollowUpGenerationId: '',
      followUpAnchorId: '',
      followUpLoading: false,
      followUpVisible: false,
      askedFollowUps: d.askedFollowUps || [],
      askedIntentKeys: d.askedIntentKeys || [],
      pendingFollowUps: d.pendingFollowUps || [],
      depthLevel: d.depthLevel || 0,
    }
  }
  const idx = messages.length - 1
  const parentId = messages[idx].id
  const stamped = messages.slice()
  stamped[idx] = Object.assign({}, stamped[idx], {
    followUps: list.slice(0, TARGET_COUNT),
    topicAnchorId: (res && res.topicAnchorId) || '',
    generationId: generationId,
  })
  const askedTexts = (d.askedFollowUps || [])
  const askedIntents = (d.askedIntentKeys || [])
  return {
    messages: stamped,
    activeFollowUps: list.slice(0, TARGET_COUNT),
    activeFollowUpParentId: parentId,
    activeFollowUpGenerationId: generationId,
    followUpAnchorId: (res && res.topicAnchorId) || '',
    followUpLoading: false,
    followUpVisible: true,
    askedFollowUps: askedTexts,
    askedIntentKeys: askedIntents,
    pendingFollowUps: [],
    depthLevel: (res && typeof res.depthLevel === 'number') ? res.depthLevel : (d.depthLevel || 0),
  }
}

/** Latest assistant message id (by document order), or '' when none. */
function latestAssistantId (messages) {
  if (!Array.isArray(messages)) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i] && messages[i].role === 'assistant') return messages[i].id
  }
  return ''
}

/** A set may render ONLY when it belongs to the LATEST assistant message. */
function shouldRenderFollowUps (data) {
  if (!data || data.sending || data.followUpLoading) return false
  const latest = latestAssistantId(data.messages)
  if (!latest) return false
  return !!data.activeFollowUpParentId && data.activeFollowUpParentId === latest
}

/** New topic → previous thread's follow-ups become EXPIRED. Returns resets. */
function expireThread () {
  return {
    activeFollowUps: [],
    activeFollowUpParentId: '',
    activeFollowUpGenerationId: '',
    followUpAnchorId: '',
    followUpLoading: false,
    followUpVisible: false,
    askedFollowUps: [],
    askedIntentKeys: [],
    pendingFollowUps: [],
    depthLevel: 0,
  }
}

module.exports = {
  TARGET_COUNT: TARGET_COUNT,
  TITLE: TITLE,
  LADDER_INTENTS: LADDER_INTENTS,
  LADDER_ORDER: LADDER_ORDER,
  DEPTH_LEVELS: DEPTH_LEVELS,
  FALLBACK_BANK: FALLBACK_BANK,
  FILLERS: FILLERS,
  dedupeKey: dedupeKey,
  intentKeyOf: intentKeyOf,
  roleLevelOf: roleLevelOf,
  filterCandidates: filterCandidates,
  normalizeList: normalizeList,
  refillQueue: refillQueue,
  completeFollowUps: completeFollowUps,
  genId: genId,
  messageId: messageId,
  consumeOnTap: consumeOnTap,
  invalidateOnTap: invalidateOnTap,
  stampFollowUps: stampFollowUps,
  latestAssistantId: latestAssistantId,
  shouldRenderFollowUps: shouldRenderFollowUps,
  expireThread: expireThread,
}
