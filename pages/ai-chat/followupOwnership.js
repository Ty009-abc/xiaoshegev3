/**
 * pages/ai-chat/followupOwnership.js
 *
 * RC8_11_STAGE2D_FOLLOWUP_FLOW_UI_STABILITY
 *
 * Pure, dependency-free helpers for follow-up OWNERSHIP + EXACT-3 stability.
 *
 * A follow-up set is NEVER page-global. Each set is stamped onto exactly ONE
 * assistant message (parentMessageId) that came from ONE generation
 * (generationId), and only the LATEST assistant message may render its set.
 * Tapping any follow-up invalidates the previous set synchronously.
 *
 * No network, no LLM. Deterministic fallback guarantees the rendered count is
 * always exactly 3 with no duplicate intent and a shared topicAnchor where one
 * was provided by the server.
 */

'use strict'

const TARGET_COUNT = 3
const TITLE = '接下来你可以继续问'
const LADDER_INTENTS = ['action_entry', 'cognitive_gap', 'validation_loop']

// Deterministic, context-filtered fallback questions (NO LLM, NO network).
// These are generic-but-safe stand-ins for the SAME decision thread; they are
// only used to top up when the server returns < 3 usable items.
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

/** Trim, drop empties, drop the selected question itself, de-duplicate by intent-text. */
function normalizeList (list, excludeText) {
  if (!Array.isArray(list)) return []
  const ex = excludeText ? dedupeKey(excludeText) : ''
  const seen = new Set()
  const out = []
  for (let i = 0; i < list.length; i++) {
    const t = String(list[i] === undefined || list[i] === null ? '' : list[i]).trim()
    if (!t) continue
    const k = dedupeKey(t)
    if (ex && k === ex) continue
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

/**
 * Guarantee EXACTLY TARGET_COUNT follow-ups: server items first, then the
 * scenario fallback, then deterministic fillers. No duplicates, never the
 * selected question. Returns the shared topicAnchor + per-item ladder intents.
 */
function completeFollowUps (list, opts) {
  const o = opts || {}
  const scenario = o.scenario || 'ask'
  const anchor = o.topicAnchorId || ''
  const selectedText = o.selectedText || ''
  const primary = normalizeList(list, selectedText)
  const bank = (FALLBACK_BANK[scenario] || FALLBACK_BANK.ask).concat(FALLBACK_BANK.ask, FILLERS)
  const ex = selectedText ? dedupeKey(selectedText) : ''
  const seen = new Set(primary.map(dedupeKey))
  const out = primary.slice(0, TARGET_COUNT)
  for (let i = 0; i < bank.length && out.length < TARGET_COUNT; i++) {
    const k = dedupeKey(bank[i])
    if (seen.has(k) || (ex && k === ex)) continue
    seen.add(k)
    out.push(bank[i])
  }
  const serverCount = primary.length
  const source = serverCount >= TARGET_COUNT
    ? 'server'
    : (serverCount > 0 ? 'server+fallback' : 'fallback')
  const followUps = out.slice(0, TARGET_COUNT)
  return {
    followUps: followUps,
    followUpSource: source,
    topicAnchorId: anchor,
    followUpLadder: followUps.map(function (text, i) {
      return { intent: LADDER_INTENTS[i] || 'extra', topicAnchorId: anchor, text: text }
    }),
  }
}

function genId (prefix) {
  return (prefix || 'gen') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function messageId (seq) {
  return 'm' + seq
}

/**
 * Stamp a completed set onto the LAST message (the new assistant answer) and
 * bind the active pointer. Returns a setData payload. If there is no answer or
 * no set, EVERYTHING is cleared (never leak a stale set).
 */
function stampFollowUps (messages, res, generationId) {
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
  return {
    messages: stamped,
    activeFollowUps: list.slice(0, TARGET_COUNT),
    activeFollowUpParentId: parentId,
    activeFollowUpGenerationId: generationId,
    followUpAnchorId: (res && res.topicAnchorId) || '',
    followUpLoading: false,
    followUpVisible: true,
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

/** On tap: invalidate the previous set immediately + show a loading state. */
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

module.exports = {
  TARGET_COUNT: TARGET_COUNT,
  TITLE: TITLE,
  LADDER_INTENTS: LADDER_INTENTS,
  FALLBACK_BANK: FALLBACK_BANK,
  FILLERS: FILLERS,
  normalizeList: normalizeList,
  completeFollowUps: completeFollowUps,
  genId: genId,
  messageId: messageId,
  stampFollowUps: stampFollowUps,
  latestAssistantId: latestAssistantId,
  shouldRenderFollowUps: shouldRenderFollowUps,
  invalidateOnTap: invalidateOnTap,
}
