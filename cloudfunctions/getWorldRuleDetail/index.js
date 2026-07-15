/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getWorldRuleDetail 云函数
 *
 * 规则：
 *   unlockLevel=free  → 所有人可看
 *   unlockLevel=vip   → 需要 world_rules_unlock 权限
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const now = () => Date.now()

const VIP_LEVELS = ['vip_month', 'vip_quarter', 'vip_year', 'svip', 'lifetime']

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { ruleId } = event
  if (!ruleId) return fail(CODES.PARAM_ERROR, '缺少 ruleId 参数')

  console.log(`[getWorldRuleDetail] openid=${openid} ruleId=${ruleId}`)

  try {
    // 查询规则
    const res = await db.collection('world_rules')
      .where({ ruleId, status: 'active' })
      .limit(1)
      .get()

    const rule = res.data[0]
    if (!rule) return fail(CODES.NOT_FOUND, '规则不存在')

    // free 内容，直接返回（兼容 Season 1-4 和 Season 5+ schema）
    if (rule.unlockLevel === 'free') {
      return ok({
        ruleId: rule.ruleId,
        title: rule.title,
        category: rule.category,
        tags: rule.tags,
        // Season 1-4 字段
        rule: rule.rule || '',
        reverseLogic: rule.reverseLogic || '',
        example: rule.example || '',
        action: rule.action || '',
        // Season 5+ 字段
        worldRule: rule.worldRule || '',
        mechanism: rule.mechanism || '',
        boundary: rule.boundary || '',
        commonMistake: rule.commonMistake || '',
        realityCheck: rule.realityCheck || '',
        caseStudy: rule.caseStudy || '',
        todayAction: rule.todayAction || '',
        highLevelThinking: rule.highLevelThinking || '',
        locked: false,
      })
    }

    // vip 内容 → 校验权限
    let hasAccess = false
    const userRes = await db.collection('users').where({ openid }).limit(1).get()
    if (userRes.data[0] && VIP_LEVELS.includes(userRes.data[0].membershipLevel)) {
      // 进一步检查 memberships 表
      const ts = now()
      const memberRes = await db.collection('memberships')
        .where({ openid, status: 'active' })
        .limit(1)
        .get()

      if (memberRes.data[0] && (!memberRes.data[0].expiredAt || memberRes.data[0].expiredAt > ts)) {
        const perms = memberRes.data[0].permissions || []
        if (perms.includes('world_rules_unlock')) hasAccess = true
      }
    }

    if (!hasAccess) {
      return ok({
        ruleId: rule.ruleId,
        title: rule.title,
        locked: true,
        preview: '完整内容需解锁认知操作系统会员。',
        category: rule.category,
        unlockLevel: rule.unlockLevel,
      })
    }

    return ok({
      ruleId: rule.ruleId,
      title: rule.title,
      category: rule.category,
      tags: rule.tags,
      // Season 1-4 字段
      rule: rule.rule || '',
      reverseLogic: rule.reverseLogic || '',
      example: rule.example || '',
      action: rule.action || '',
      // Season 5+ 字段
      worldRule: rule.worldRule || '',
      mechanism: rule.mechanism || '',
      boundary: rule.boundary || '',
      commonMistake: rule.commonMistake || '',
      realityCheck: rule.realityCheck || '',
      caseStudy: rule.caseStudy || '',
      todayAction: rule.todayAction || '',
      highLevelThinking: rule.highLevelThinking || '',
      locked: false,
    })
  } catch (err) {
    console.error('[getWorldRuleDetail] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
