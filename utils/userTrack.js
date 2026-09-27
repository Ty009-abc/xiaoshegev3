/**
 * utils/userTrack.js — RC8.9B 用户行为埋点（best-effort）
 *
 * 目标：为运营后台提供「某个用户到底做了什么」的 user_events 时间线。
 *
 * 原则（RC8.9 §4.5）：
 *   - 绝不阻塞核心业务：本模块所有调用都是 fire-and-forget，内部 try/catch。
 *   - 上报失败静默：不 throw、不影响报告/支付/问卷主流程。
 *   - openid 以服务端 wxContext 为准（云函数校验），前端仅做页面/元数据。
 *   - 复用现有 utils/analytics.js 的队列思想，但写入独立 user_events 集合。
 *
 * 用法：
 *   const track = require('../../utils/userTrack.js')
 *   track.event('strategy_start')            // 单事件
 *   track.event('question_answered', { index: 3 })
 */

const FN_NAME = 'trackEvent'
const MAX_QUEUE = 20
const FLUSH_INTERVAL = 8000

const P0_EVENTS = new Set([
  'app_open', 'home_view', 'strategy_start', 'questionnaire_start', 'question_answered',
  'questionnaire_complete', 'report_request', 'report_success', 'report_fallback', 'report_fail',
  'report_view', 'poster_generate', 'poster_save', 'qa_open', 'qa_send', 'payment_view',
  'payment_create', 'payment_success', 'payment_fail', 'membership_view',
])

const _q = []
let _timer = null

function _app() { try { return getApp() } catch (_) { return null } }
function _sessionId() {
  const a = _app()
  if (!a) return ''
  if (!a.globalData._trackSessionId) {
    a.globalData._trackSessionId = 's_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)
  }
  return a.globalData._trackSessionId
}

function _flush() {
  if (!_q.length) return
  const batch = _q.splice(0, _q.length)
  try {
    // 云函数 best-effort：失败/未部署均静默丢弃，绝不阻塞
    wx.cloud.callFunction({ name: FN_NAME, data: { events: batch } }).catch(() => {})
  } catch (_) { /* ignore */ }
}

function _schedule() {
  if (_timer) clearTimeout(_timer)
  _timer = setTimeout(_flush, FLUSH_INTERVAL)
}

/**
 * event(name, metadata)
 * @param {string} name — P0 事件名
 * @param {object} [metadata] — 附加标量
 */
function event(name, metadata) {
  try {
    if (!name) return
    const entry = {
      eventId: 'e_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      eventName: name,
      eventVersion: 1,
      timestamp: Date.now(),
      page: _currentPage(),
      source: 'client',
      sessionId: _sessionId(),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    }
    _q.push(entry)
    if (_q.length >= MAX_QUEUE) _flush()
    else _schedule()
  } catch (_) { /* never throw into business flow */ }
}

function _currentPage() {
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1]
    return cur && cur.route ? cur.route : ''
  } catch (_) { return '' }
}

function flush() {
  try { _flush() } catch (_) {}
  if (_timer) { clearTimeout(_timer); _timer = null }
}

module.exports = { P0_EVENTS, event, flush, getQueueLength: () => _q.length }
