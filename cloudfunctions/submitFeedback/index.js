/**
 * cloudfunctions/submitFeedback/index.js
 * 用户反馈收集云函数
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const { recordFeedback } = require('./lib/evolutionEngine.js')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const openid = event.openid || OPENID
  if (!openid) return { code: -1, message: '未获取到 openid' }

  try {
    return await recordFeedback(openid, event)
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
