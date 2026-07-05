/**
 * utils/analytics.js — 埋点系统（第五册 Part 4 升级版）
 *
 * 记录完整转化漏斗：
 *   10 个 funnel events + popup 行为
 *
 * 写入 funnel_events + analytics_logs，离线缓存
 */

// ═══════════════════════
// 漏斗事件列表
// ═══════════════════════

const FUNNEL_EVENTS = [
  'home_view',            // 首页访问
  'insight_read',         // 认知暴击阅读
  'challenge_start',      // 挑战开始
  'challenge_finish',     // 挑战完成
  'report_preview',       // 报告预览
  'report_unlock_click',  // 点击解锁报告
  'payment_success',      // 支付成功
  'membership_view',      // 会员页访问
  'membership_purchase',  // 会员购买
  'consult_apply',        // 咨询申请
]

const EXTRA_EVENTS = [
  'challenge_submit',     // 挑战提交
  'report_view',          // 通用报告查看
  'report_detail_view',   // 报告详细查看
  'payment_fail',         // 支付失败
  'share',                // 分享
  'invite',               // 邀请
  'rule_view',            // 规则查看
  'ai_chat',              // AI对话
  'level_up',             // 升级
  'popup_shown',          // 弹窗展示
  'popup_action',         // 弹窗行为
  'membership_visit',     // 会员页访问（旧名）
]

const ALL_EVENTS = [...new Set([...FUNNEL_EVENTS, ...EXTRA_EVENTS])]

// ═══════════════════════
// 内部队列
// ═══════════════════════

const _q = []
const MAX_QUEUE = 20
const FLUSH_INTERVAL = 10000  // 10秒自动 flush

let _flushTimer = null

function _getApp() {
  try { return getApp() } catch (_) { return null }
}

function _bootstrapQueue() {
  if (!_q.length) return
  const app = _getApp()
  if (!app) return
  const gd = app.globalData || {}

  // 补充 openid
  for (const item of _q) {
    if (!item.openid && gd.openid) item.openid = gd.openid
    if (!item.membershipLevel && gd.userInfo) item.membershipLevel = gd.userInfo.membershipLevel || 'free'
    if (!item.cv && gd.userInfo) item.cv = gd.userInfo.cv || 0
    if (!item.level && gd.userInfo) item.level = gd.userInfo.level || 1
  }
}

function _flush() {
  if (!_q.length) return
  _bootstrapQueue()
  const batch = _q.splice(0, _q.length)

  const db = wx.cloud?.database()
  if (!db) { _q.push(...batch); return }

  const collection = db.collection('analytics_logs')
  for (const item of batch) {
    collection.add({ data: item }).catch(() => {})
  }

  // 漏斗核心事件额外写入 funnel_events 集合
  const funnelBatch = batch.filter(e => FUNNEL_EVENTS.includes(e.event))
  if (funnelBatch.length > 0) {
    wx.cloud.callFunction({
      name: 'trackFunnelEvent',
      data: { events: funnelBatch },
    }).catch(() => {})
  }
}

function _scheduleFlush() {
  if (_flushTimer) clearTimeout(_flushTimer)
  _flushTimer = setTimeout(_flush, FLUSH_INTERVAL)
}

// ═══════════════════════
// track — 核心接口
// ═══════════════════════

/**
 * track(event, extra)
 *
 * @param {string} event — 事件名
 * @param {object} extra — 附加数据
 */
function track(event, extra = {}) {
  if (!ALL_EVENTS.includes(event)) {
    // 仍然记录但标记为 custom
    extra._custom = true
  }

  try {
    const gd = _getApp()?.globalData || {}
    const entry = {
      event,
      openid: gd.openid || '',
      membershipLevel: gd.userInfo?.membershipLevel || 'free',
      level: gd.userInfo?.level || 1,
      cv: gd.userInfo?.cv || 0,
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      ...extra,
    }
    _q.push(entry)

    // 5 条 flush 一次
    if (_q.length >= 5) _flush()
    else _scheduleFlush()
  } catch (_) {}
}

/**
 * trackFunnel(event, extra)
 * 明确写入漏斗事件（用于首页/挑战/报告等核心页面）
 */
function trackFunnel(event, extra = {}) {
  if (!FUNNEL_EVENTS.includes(event)) {
    console.warn(`[analytics] trackFunnel: "${event}" 不在漏斗事件列表中`)
  }
  track(event, extra)
}

/**
 * trackPopup(popupType, action, extra)
 * 记录弹窗行为
 */
function trackPopup(popupType, action = 'shown', extra = {}) {
  if (action === 'shown') {
    track('popup_shown', { ...extra, popupType })
  } else {
    track('popup_action', { ...extra, popupType, action })
  }
}

/**
 * flush — 页面卸载时调用
 */
function flush() {
  _flush()
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null }
}

/**
 * getQueueLength — 未刷新事件数
 */
function getQueueLength() {
  return _q.length
}

module.exports = {
  FUNNEL_EVENTS,
  ALL_EVENTS,
  track,
  trackFunnel,
  trackPopup,
  flush,
  getQueueLength,
}
