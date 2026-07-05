const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const { toggleMemory } = require('./lib/memoryEngine.js')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const openid = event.openid || OPENID
  if (!openid) return { code: -1, message: '未获取到 openid' }

  const { enabled = true } = event

  try {
    return await toggleMemory(openid, enabled)
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
