/**
 * common/intentRouter.js - AI 意图路由器
 *
 * 判断用户请求属于什么 AI 场景
 */

const SCENES = {
  AI_CHAT:             'ai_chat',
  DAILY_INSIGHT:       'daily_insight',
  REPORT_GENERATION:   'report_generation',
  WORLD_MODEL_ANALYSIS:'world_model_analysis',
  CHALLENGE_SUMMARY:   'challenge_summary',
  COACHING:            'coaching',
}

// 场景预估 token 消耗（用于成本预警）
const SCENE_TOKEN_ESTIMATE = {
  ai_chat:              2000,
  daily_insight:         800,
  report_generation:    8000,
  world_model_analysis: 3000,
  challenge_summary:    6000,
  coaching:             3000,
}

// 场景中文名
const SCENE_NAMES = {
  ai_chat:              'AI 对话',
  daily_insight:        '认知暴击解读',
  report_generation:    '深度报告生成',
  world_model_analysis: '世界模型分析',
  challenge_summary:    '挑战总结',
  coaching:             'AI 教练',
}

/**
 * 快速路由：根据 scene 字段为主，关键词为辅助
 * @param {object} input - { scene?, message?, type? }
 * @returns {string} scene
 */
function routeIntent(input = {}) {
  const { scene, message, type } = input

  // 1. 显式指定 scene → 直接透传
  if (scene && SCENES[scene.toUpperCase()]) {
    return SCENES[scene.toUpperCase()]
  }

  // 2. 根据 type 字段归类
  if (type) {
    if (type === 'challenge_final' || type === 'deep_turnaround') return SCENES.REPORT_GENERATION
    if (type === 'basic_profile') return SCENES.WORLD_MODEL_ANALYSIS
    if (type === 'vip_monthly_review') return SCENES.COACHING
  }

  // 3. 关键词匹配
  const msg = (message || '').toLowerCase()
  if (!msg) return SCENES.AI_CHAT

  // 教练 / 成长
  if (/\b(翻身|突破|改变|规划|未来|指导|建议)\b/.test(msg)) {
    return SCENES.COACHING
  }

  // 世界模型 / 分析
  if (/\b(分析|诊断|为什么|原因|问题|评估)\b/.test(msg)) {
    return SCENES.WORLD_MODEL_ANALYSIS
  }

  // 报告
  if (/\b(报告|总结|复盘|回顾)\b/.test(msg)) {
    return SCENES.REPORT_GENERATION
  }

  // 暴击
  if (/\b(认知暴击|每日|今天|解释|什么意思)\b/.test(msg)) {
    return SCENES.DAILY_INSIGHT
  }

  // 挑战
  if (/\b(挑战|答题|选择|决定|决策)\b/.test(msg)) {
    return SCENES.CHALLENGE_SUMMARY
  }

  return SCENES.AI_CHAT
}

/**
 * 获取场景对应的 token 估算
 */
function getSceneTokenEstimate(scene) {
  return SCENE_TOKEN_ESTIMATE[scene] || 2000
}

module.exports = {
  SCENES,
  SCENE_TOKEN_ESTIMATE,
  SCENE_NAMES,
  routeIntent,
  getSceneTokenEstimate,
}
