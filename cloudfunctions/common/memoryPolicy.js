/**
 * cloudfunctions/common/memoryPolicy.js — 记忆写入规则
 *
 * 四册 Part 4：Memory System
 *
 * 决定什么应该写入记忆、什么不应该
 */

/**
 * ALLOW_LIST — 允许写入的类型
 */
const ALLOW_LIST = {
  // 长期目标
  long_term_goal: true,
  core_goal: true,
  // 稳定痛点
  pain_point: true,
  persistent_concern: true,
  // 认知标签
  cognition_tag: true,
  thinking_pattern: true,
  // 风险偏好
  risk_profile: true,
  risk_flag: true,
  // 成长记录
  growth_event: true,
  level_up: true,
  milestone: true,
  // 挑战结果
  challenge_result: true,
  challenge_summary: true,
  // 报告相关
  report_generated: true,
  cognition_dimension: true,
  // 行为统计
  behavior_count: true,
  module_preference: true,
  // 用户主动设置的
  user_setting: true,
  user_explicit: true,
}

/**
 * DENY_LIST — 禁止写入的类型
 */
const DENY_LIST = {
  // 无意义闲聊
  small_talk: true,
  casual_chat: true,
  // 一次性情绪
  temporary_emotion: true,
  passing_mood: true,
  // 敏感隐私
  sensitive_info: true,
  personal_privacy: true,
  identity_number: true,
  // 未经确认的信息
  unconfirmed_claim: true,
  hearsay: true,
  // 寒暄/问候
  greeting: true,
  farewell: true,
  // 纯疑问（不包含个人信息）
  general_question: true,
}

/**
 * shouldWriteMemory(category) — 判断某类信息是否应该写入
 * @returns {boolean}
 */
function shouldWriteMemory(category) {
  if (ALLOW_LIST[category]) return true
  if (DENY_LIST[category]) return false
  // 未知类型 → 默认不写入（安全优先）
  return false
}

/**
 * classifyMemoryInput(text) — 从用户输入分类记忆类型
 *
 * 规则引擎（快速判断，不依赖 LLM）：
 */
function classifyMemoryInput(text) {
  if (!text || typeof text !== 'string') return { type: 'unclassified', shouldWrite: false }

  const t = text.trim()

  // 无意义寒暄
  if (/^(你好|hi|hello|在吗|嗯|哦|好的|知道了|谢谢|再见|拜拜|ok|OK)\b/.test(t) || t === '你好' || t === '嗯' || t === '哦' || t === '好的' || t === '知道了' || t === '在吗' || t === '谢谢' || t === '再见' || t === '拜拜') {
    return { type: 'small_talk', shouldWrite: false }
  }

  // 敏感信息检测
  if (/\d{17}[\dXx]/.test(t) || /\d{18}/.test(t)) {
    return { type: 'identity_number', shouldWrite: false }
  }
  if (/(手机号|电话|身份证|银行卡|密码|账号).*?\d{6,}/.test(t)) {
    return { type: 'sensitive_info', shouldWrite: false }
  }

  // 目标相关
  if (/(想要|想|目标|计划|打算|准备|立志|决心).*(赚钱|副业|翻身|升级|改变|成长|突破)/.test(t)) {
    return { type: 'long_term_goal', shouldWrite: true }
  }

  // 痛点相关
  if (/(焦虑|迷茫|不知道|赚不到|没机会|被困|瓶颈|压力|负债|缺钱|月光|打工|996|内卷)/.test(t)) {
    return { type: 'pain_point', shouldWrite: true }
  }

  // 认知标签
  if (/(世界观|认知|思维|概率|系统|杠杆|信息差|风险|复利|期望值)/.test(t)) {
    return { type: 'cognition_tag', shouldWrite: true }
  }

  // 风险偏好
  if (/(赌|投机|冒险|稳妥|保守|激进|杠杆|借钱投资|梭哈|抄底).*(心态|偏好|倾向|习惯)/.test(t)) {
    return { type: 'risk_profile', shouldWrite: true }
  }

  // 默认：普通对话
  if (t.length < 8) {
    return { type: 'casual_chat', shouldWrite: false }
  }

  return { type: 'unclassified', shouldWrite: false }
}

/**
 * sanitizeMemoryData(data) — 脱敏处理
 * 移除可能的敏感字段
 */
function sanitizeMemoryData(data) {
  if (!data || typeof data !== 'object') return data

  const sensitiveKeys = ['password', 'secret', 'token', 'phone', 'idCard', 'bankCard', 'realName']
  const cleaned = { ...data }

  for (const key of Object.keys(cleaned)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      delete cleaned[key]
    }
  }

  return cleaned
}

module.exports = {
  ALLOW_LIST,
  DENY_LIST,
  shouldWriteMemory,
  classifyMemoryInput,
  sanitizeMemoryData,
}
