const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const { getUserMemory, isMemoryEnabled } = require('./lib/memoryEngine.js')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const openid = event.openid || OPENID

  if (!openid) return { code: -1, message: '未获取到 openid' }

  try {
    const enabled = await isMemoryEnabled(openid)
    if (!enabled) {
      return { code: 0, data: { memoryEnabled: false, message: '记忆功能已关闭' } }
    }

    const memory = await getUserMemory(openid)

    return {
      code: 0,
      data: {
        memoryEnabled: true,
        userMemory: { coreGoals: memory.userMemory.coreGoals, riskFlags: memory.userMemory.riskFlags, stableTraits: memory.userMemory.stableTraits },
        cognitionMemory: { dimensions: memory.cognitionMemory.dimensions, history: (memory.cognitionMemory.history || []).slice(-5) },
        behaviorMemory: { dailyInsightReadCount: memory.behaviorMemory.dailyInsightReadCount, challengeFinishedCount: memory.behaviorMemory.challengeFinishedCount, reportGeneratedCount: memory.behaviorMemory.reportGeneratedCount, paymentCount: memory.behaviorMemory.paymentCount, shareCount: memory.behaviorMemory.shareCount, favoriteModules: memory.behaviorMemory.favoriteModules },
        conversationMemory: { recentCount: (memory.conversationMemory.recentMessages || []).length, longTermSummary: memory.conversationMemory.longTermSummary },
        growthMemory: { milestones: (memory.growthMemory.milestones || []).slice(-10), streakHistory: (memory.growthMemory.streakHistory || []).slice(-30), cvHistory: (memory.growthMemory.cvHistory || []).slice(-30) },
      },
    }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
