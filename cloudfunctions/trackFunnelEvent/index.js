/**
 * cloudfunctions/trackFunnelEvent/index.js — 漏斗事件上报云函数
 *
 * 第五册 Part 4：转化漏斗
 *
 * 接收前端批量上报的漏斗事件，写入 funnel_events + conversion_metrics
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { batchTrack } = require('./lib/funnelTracker.js')
const { recordPopupShown, recordPopupAction } = require('./lib/popupStrategy.js')

exports.main = async (event) => {
  const { events = [] } = event
  if (!events.length) return { code: 0, message: '无事件', count: 0 }

  const results = []
  for (const e of events) {
    if (e.event === 'popup_shown') {
      await recordPopupShown(db, e.openid, e.popupType)
      results.push({ event: e.event, success: true })
    } else if (e.event === 'popup_action') {
      await recordPopupAction(db, e.openid, e.popupType, e.action)
      results.push({ event: e.event, success: true })
    }
  }

  // 非 popup 事件走 batchTrack
  const nonPopup = events.filter(e => !['popup_shown', 'popup_action'].includes(e.event))
  if (nonPopup.length > 0) {
    const res = await batchTrack(db, nonPopup.map(e => ({
      openid: e.openid,
      event: e.event,
      membershipLevel: e.membershipLevel || 'free',
      cv: e.cv || 0,
      extra: e.extra || {},
    })))
    results.push(...res.results)
  }

  return { code: 0, message: 'ok', count: results.length, results }
}
