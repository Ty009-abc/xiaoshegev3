/**
 * cloudfunctions/trackEvent/index.js — RC8.9B 用户行为事件采集
 *
 * 职责：接收前端 best-effort 上报的行为事件，写入 user_events 集合。
 * 设计原则（RC8.9 §4.5）：
 *   - 绝不阻塞/污染核心业务：调用方 fire-and-forget，失败静默。
 *   - 本函数自身永远返回 code:0（即使写入失败），避免上报链路影响主流程判断。
 *   - 只接受白名单事件名；openid 以 wxContext 服务端身份为准，不信任客户端传参。
 *   - eventId 幂等：同 eventId 重复上报不会重复写入。
 *
 * @version RC8.9B
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok } = require('./lib/response.js')

// P0 事件白名单（RC8.9 §4.4）
const ALLOWED_EVENTS = new Set([
  'app_open',
  'home_view',
  'strategy_start',
  'questionnaire_start',
  'question_answered',
  'questionnaire_complete',
  'report_request',
  'report_success',
  'report_fallback',
  'report_fail',
  'report_view',
  'poster_generate',
  'poster_save',
  'qa_open',
  'qa_send',
  'payment_view',
  'payment_create',
  'payment_success',
  'payment_fail',
  'membership_view',
])

// 管理端事件（服务端内部写入，允许经由本函数但需显式标记）
const ADMIN_EVENTS = new Set([
  'admin_login',
  'admin_view_user',
  'admin_change_role',
  'admin_change_permission',
])

const EVENT_SCHEMA_VERSION = 1
const MAX_BATCH = 20

function sanitizeMetadata(m) {
  if (!m || typeof m !== 'object') return {}
  // 仅保留标量值，杜绝嵌套大对象污染
  const out = {}
  for (const k of Object.keys(m)) {
    const v = m[k]
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      out[k] = typeof v === 'string' ? v.slice(0, 200) : v
    }
  }
  return out
}

async function writeOne(openid, e) {
  if (!e || typeof e !== 'object') return { ok: false, reason: 'bad_event' }
  if (!ALLOWED_EVENTS.has(e.eventName) && !ADMIN_EVENTS.has(e.eventName)) {
    return { ok: false, reason: 'event_not_allowed' }
  }
  const ts = typeof e.timestamp === 'number' ? e.timestamp : Date.now()
  const doc = {
    eventId: typeof e.eventId === 'string' && e.eventId ? e.eventId : `${openid}_${e.eventName}_${ts}`,
    userId: openid,                       // RC8.9 §4.1 统一用户标识（服务端身份）
    openid,
    eventName: e.eventName,
    eventVersion: typeof e.eventVersion === 'number' ? e.eventVersion : EVENT_SCHEMA_VERSION,
    timestamp: ts,
    page: typeof e.page === 'string' ? e.page.slice(0, 80) : '',
    source: typeof e.source === 'string' ? e.source.slice(0, 40) : '',
    sessionId: typeof e.sessionId === 'string' ? e.sessionId.slice(0, 80) : '',
    metadata: sanitizeMetadata(e.metadata),
    createdAt: Date.now(),
  }
  try {
    // 幂等：同 eventId 已存在则跳过
    const dup = await db.collection('user_events').where({ eventId: doc.eventId }).limit(1).get()
    if (dup.data && dup.data.length) return { ok: true, deduped: true }
    await db.collection('user_events').add({ data: doc })
    return { ok: true }
  } catch (err) {
    // 集合缺失等异常：静默，不影响上报方
    return { ok: false, reason: err && err.message }
  }
}

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    if (!openid) return ok({ accepted: 0, note: 'no openid' })

    const events = Array.isArray(event.events) ? event.events.slice(0, MAX_BATCH) : (event.event ? [event] : [])
    let accepted = 0
    for (const e of events) {
      const r = await writeOne(openid, e)
      if (r.ok) accepted++
    }
    return ok({ accepted, total: events.length })
  } catch (err) {
    // 永远软失败：上报失败不得影响任何判断
    console.warn('[trackEvent] soft-fail:', err && err.message)
    return ok({ accepted: 0, softFail: true })
  }
}
