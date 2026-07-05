const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const { clearUserMemory } = require('./lib/memoryEngine.js')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const openid = event.openid || OPENID
  if (!openid) return { code: -1, message: '未获取到 openid' }

  const { collections = null } = event // null = 全部清除

  try {
    return await clearUserMemory(openid, collections)
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
