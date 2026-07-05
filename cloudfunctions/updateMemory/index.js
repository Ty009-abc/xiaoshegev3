const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const { updateUserMemory, updateBehaviorMemory, recordGrowthEvent, appendConversation } = require('./lib/memoryEngine.js')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const openid = event.openid || OPENID
  if (!openid) return { code: -1, message: '未获取到 openid' }

  const { action = 'updateProfile', data = {}, collection } = event

  try {
    switch (action) {
      case 'updateProfile':
        return await updateUserMemory(openid, { ...data, collection: collection || 'user_memory' })

      case 'updateBehavior':
        return await updateBehaviorMemory(openid, data.behaviorType, data.delta || 1)

      case 'recordGrowth':
        return await recordGrowthEvent(openid, data)

      case 'appendChat':
        return await appendConversation(openid, {
          role: data.role || 'user',
          content: data.content || '',
          createdAt: data.createdAt || Date.now(),
        })

      default:
        return { code: -1, message: `未知操作: ${action}` }
    }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
