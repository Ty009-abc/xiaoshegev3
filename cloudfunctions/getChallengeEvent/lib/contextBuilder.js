/**
 * common/contextBuilder.js - 上下文构建器
 *
 * 从多个数据源构建 LLM 所需的上下文
 * 源：users / user_profiles / ai_reports / memberships / 最近聊天
 */

const { now: getNow } = require('./permission.js')

/**
 * 构建完整上下文
 * @param {object} db       - 云数据库实例
 * @param {string} openid   - 用户 openid
 * @param {object} options  - { includeChats?:bool, limitChats?:number }
 * @returns {object}
 */
async function buildContext(db, openid, options = {}) {
  const { includeChats = false, limitChats = 5 } = options
  const ts = getNow()

  try {
    const [
      userRes,
      profRes,
      reportRes,
      memberRes,
    ] = await Promise.all([
      db.collection('users').where({ openid }).limit(1).get(),
      db.collection('user_profiles').where({ openid }).limit(1).get(),
      db.collection('ai_reports').where({ openid }).orderBy('createdAt', 'desc').limit(1).get(),
      db.collection('memberships').where({ openid, status: 'active' }).limit(1).get(),
    ])

    const user = userRes.data[0] || {}
    const profile = profRes.data[0] || {}
    const lastReport = reportRes.data[0] || null
    const membership = memberRes.data[0] || null

    const ctx = {
      user: {
        nickname: user.nickname || '',
        cv: user.cv || 0,
        level: user.level || 1,
        membershipLevel: user.membershipLevel || 'free',
        status: user.status || 'active',
      },
      profile: {
        laborMindset:           profile.laborMindset || 50,
        probabilityMindset:     profile.probabilityMindset || 50,
        systemThinking:         profile.systemThinking || 50,
        leverageThinking:        profile.leverageThinking || 50,
        capitalThinking:        profile.capitalThinking || 50,
        riskAwareness:          profile.riskAwareness || 50,
        informationSensitivity: profile.informationSensitivity || 50,
        longTermism:            profile.longTermism || 50,
        decisionStability:      profile.decisionStability || 50,
        wealthPotentialScore:   profile.wealthPotentialScore || 0,
        turnaroundProbability:  profile.turnaroundProbability || 0,
        mainType:               profile.mainType || '',
        subType:                profile.subType || '',
        tags:                   profile.tags || [],
      },
      membership: membership ? {
        memberType: membership.memberType || '',
        expiredAt: membership.expiredAt || 0,
        permissions: membership.permissions || [],
      } : null,
      lastReport: lastReport ? {
        oneSentence:    lastReport.content?.oneSentence || '',
        worldModelType:  lastReport.content?.worldModelType || '',
        turnaroundProbability: lastReport.content?.turnaroundProbability || 0,
      } : null,
    }

    // 可选：最近聊天记录
    if (includeChats) {
      try {
        const chatRes = await db.collection('ai_chats')
          .where({ openid })
          .orderBy('createdAt', 'desc')
          .limit(limitChats)
          .get()
        ctx.recentChats = (chatRes.data || []).map(c => ({
          role: c.role,
          content: (c.content || '').slice(0, 200),
        })).reverse()
      } catch (_) {
        ctx.recentChats = []
      }
    }

    return ctx
  } catch (err) {
    console.error('[ContextBuilder] 构建失败:', err.message)
    return { user: {}, profile: {}, membership: null, lastReport: null, recentChats: [] }
  }
}

/**
 * 序列化上下文为 prompt 文本
 */
function serializeContext(ctx) {
  const parts = []

  if (ctx.user && ctx.user.membershipLevel) {
    parts.push(`[用户] ${ctx.user.nickname || '用户'} | CV:${ctx.user.cv} | 会员:${ctx.user.membershipLevel}`)
  }

  if (ctx.profile) {
    const p = ctx.profile
    parts.push(`[认知评分] 劳动:${p.laborMindset} 概率:${p.probabilityMindset} 系统:${p.systemThinking} 杠杆:${p.leverageThinking} 资本:${p.capitalThinking} 风险:${p.riskAwareness} 信息:${p.informationSensitivity} 长期:${p.longTermism} 决策:${p.decisionStability}`)
    if (p.mainType) parts.push(`[认知类型] ${p.mainType}${p.subType ? ' / ' + p.subType : ''}`)
    if (p.tags && p.tags.length) parts.push(`[标签] ${p.tags.join(', ')}`)
  }

  if (ctx.lastReport && ctx.lastReport.oneSentence) {
    parts.push(`[上次报告] ${ctx.lastReport.oneSentence} | 类型:${ctx.lastReport.worldModelType}`)
  }

  if (ctx.membership) {
    parts.push(`[会员] ${ctx.membership.memberType} | 过期:${new Date(ctx.membership.expiredAt).toISOString()}`)
  }

  if (ctx.recentChats && ctx.recentChats.length) {
    const lines = ctx.recentChats.map(c => `  ${c.role}: ${c.content}`).join('\n')
    parts.push(`[最近对话]\n${lines}`)
  }

  return parts.join('\n')
}

/**
 * 压缩上下文到 token 预算
 * @param {object} ctx    - buildContext 输出
 * @param {number} budget - 允许的字符数（≈ token/2 粗略）
 * @param {string} scene  - 场景（影响保留优先级）
 */
function compressContext(ctx, budget, scene) {
  const serialized = serializeContext(ctx)
  if (serialized.length <= budget) return serialized

  // 压缩策略：
  // 1. 先保留用户 + profile（总有）
  // 2. 再保留最近报告
  // 3. 最后是最近对话（按 budget 裁剪）

  const parts = []

  // 用户
  if (ctx.user) {
    parts.push(`[用户] CV:${ctx.user.cv || 0} 会员:${ctx.user.membershipLevel || 'free'}`)
  }

  // profile 精简
  if (ctx.profile) {
    const p = ctx.profile
    parts.push(`[评分] L${p.laborMindset} P${p.probabilityMindset} S${p.systemThinking} LV${p.leverageThinking} C${p.capitalThinking} R${p.riskAwareness} I${p.informationSensitivity} LT${p.longTermism} D${p.decisionStability}`)
  }

  // 报告摘要
  if (ctx.lastReport && ctx.lastReport.oneSentence) {
    parts.push(`[上次] ${ctx.lastReport.oneSentence}`)
  }

  let result = parts.join('\n')
  if (result.length > budget) {
    // 最终截断
    result = result.slice(0, budget - 3) + '...'
  }

  return result
}

module.exports = { buildContext, serializeContext, compressContext }
