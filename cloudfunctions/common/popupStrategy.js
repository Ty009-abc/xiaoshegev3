/**
 * cloudfunctions/common/popupStrategy.js — 弹窗策略引擎（第五册 Part 4）
 *
 * 职责：
 *   1. 弹窗限频 — 24h ≤ 2 次营销弹窗
 *   2. 事件触发 — 不无脑弹，在正确时刻弹
 *   3. 优先级排序 — 支付提醒 > 会员升级 > 咨询推广
 *   4. 用户分层 — 不同 Segment 不同 CTA
 *   5. 4 个首单转化触发器 — 限时/损失厌恶/社会证明/价格锚定
 */

const now = () => Date.now()
const ONE_DAY = 86400000

// ═══════════════════════════
// 弹窗配置
// ═══════════════════════════

const POPUP_LIMIT_PER_DAY = 2  // 24小时内最多2次营销弹窗

const POPUP_PRIORITY = {
  payment_reminder:  3,   // 支付提醒 — 最高
  membership_upgrade: 2,  // 会员升级 — 中
  consult_promo:      1,  // 咨询推广 — 低
}

// ═══════════════════════════
// 用户分层映射
// ═══════════════════════════

const SEGMENT_CONFIG = {
  free: {
    label: '免费用户',
    targetProduct: 'REPORT_001',
    targetPrice: 990,       // ¥9.9 (分)
    ctaText: '解锁完整报告',
    ctaSubtext: '限时 ¥9.9（原价 ¥99）',
    popupTypes: ['payment_reminder'],
  },
  report_buyer: {
    label: '报告购买者',
    targetProduct: 'VIP_QUARTERLY',
    targetPrice: 19900,      // ¥199 (分)
    ctaText: '升级认知系统会员',
    ctaSubtext: '季卡 ¥199 — 90天无限体验',
    popupTypes: ['membership_upgrade'],
  },
  member: {
    label: '会员用户',
    targetProduct: 'VIP_YEARLY',
    targetPrice: 29900,      // ¥299 (分)
    ctaText: '解锁年卡专属权益',
    ctaSubtext: 'hard_truth_mode + 深度报告 + 优先AI',
    popupTypes: ['membership_upgrade', 'consult_promo'],
  },
  premium: {
    label: '高价值用户',
    targetProduct: 'CONSULT_001',
    targetPrice: 89900,      // ¥899 (分)
    ctaText: '预约1对1认知诊断',
    ctaSubtext: '每月仅限10名',
    popupTypes: ['consult_promo'],
  },
}

// ═══════════════════════════
// 事件触发规则
// ═══════════════════════════

const EVENT_TRIGGERS = [
  {
    triggerId: 'report_purchased_3min',
    event: 'payment_success',
    productId: 'REPORT_001',
    cooldownMinutes: 3,
    targetSegment: 'report_buyer',
    popupType: 'membership_upgrade',
    message: '你的报告已解锁\n90天内无限次深度分析 + 全部世界规则 + AI教练',
    priority: 2,
  },
  {
    triggerId: 'consecutive_3days',
    event: 'daily_active',
    condition: { consecutiveDays: { gte: 3 } },
    targetSegment: 'free',
    popupType: 'payment_reminder',
    message: '你已经连续3天打开小事哥\n深度认知分析正在等你 — 限时首单 ¥9.9',
    priority: 2,
  },
  {
    triggerId: 'quota_exhausted',
    event: 'quota_exhausted',
    targetSegment: 'free',
    popupType: 'payment_reminder',
    message: '今日免费AI次数已用完\n解锁无限认知升级体验 — 季卡 ¥199',
    priority: 3,
  },
  {
    triggerId: 'rule_limit_hit',
    event: 'rule_limit_reached',
    condition: { rulesViewed: { gte: 5 } },
    targetSegment: 'free',
    popupType: 'payment_reminder',
    message: '你已查看5条免费规则\n全库100+世界规则 + 每日更新，季卡 ¥199',
    priority: 2,
  },
  {
    triggerId: 'challenge_limit_hit',
    event: 'challenge_limit_reached',
    condition: { challengesDone: { gte: 10 } },
    targetSegment: 'free',
    popupType: 'payment_reminder',
    message: '10道挑战已完成\n你的完整认知能力评级已生成 — 解锁查看 ¥9.9',
    priority: 2,
  },
  {
    triggerId: 'high_engagement_vip',
    event: 'ai_chat_count',
    condition: { aiChatCount: { gte: 20 }, hasReport: true, isVip: true, cv: { gte: 300 } },
    targetSegment: 'premium',
    popupType: 'consult_promo',
    message: '你的使用深度已超越 95% 用户\n你是否准备好1对1认知诊断？',
    priority: 1,
  },
]

// ═══════════════════════════
// shouldShowPopup — 核心判断
// ═══════════════════════════

/**
 * @param {object} db
 * @param {string} openid
 * @param {object} context — { event, segment, recentEvents, states:{consecutiveDays,aiChatCount,...} }
 * @returns {{ show, popup:{type,message,productId,productPrice,ctaText} | null }}
 */
async function shouldShowPopup(db, openid, context = {}) {
  const ts = now()
  const { event, segment = 'free' } = context

  try {
    // 1. 检查 24h 限额
    const todayStart = ts - (ts % ONE_DAY)
    const popupLogs = await db.collection('funnel_events')
      .where({
        openid,
        event: 'popup_shown',
        timestamp: db.command.gte(todayStart),
      })
      .count()
      .then(r => r.total)
      .catch(() => 0)

    if (popupLogs >= POPUP_LIMIT_PER_DAY) {
      return { show: false, reason: '今日弹窗已达上限' }
    }

    // 2. 匹配事件触发规则
    const segConfig = SEGMENT_CONFIG[segment] || SEGMENT_CONFIG.free
    const matched = EVENT_TRIGGERS.filter(t => {
      if (t.targetSegment !== segment) return false
      if (t.event && t.event !== event) return false
      if (t.condition) {
        for (const [key, cond] of Object.entries(t.condition)) {
          const val = context[key]
          if (cond.gte !== undefined && val < cond.gte) return false
          if (cond.lte !== undefined && val > cond.lte) return false
        }
      }
      if (t.cooldownMinutes) {
        // 检查事件是否在 cooldown 内发生
        const eventTime = context.eventTimestamp || ts
        if (ts - eventTime < (t.cooldownMinutes * 60000)) {
          // 在冷却期 → 不弹
          return false
        }
        // 对于 payment_success，我们应该在 cooldownMinutes 后弹
        // 这里简化为：如果 cooldown 不为 0，先不弹（前端在 3min 后再调用）
        if (t.cooldownMinutes > 0) return false
      }
      return segConfig.popupTypes.includes(t.popupType)
    })

    if (matched.length === 0) {
      return { show: false, reason: '无匹配触发规则' }
    }

    // 3. 取优先级最高的
    const best = matched.sort((a, b) => (POPUP_PRIORITY[a.popupType] || 0) - (POPUP_PRIORITY[b.popupType] || 0)).pop()

    // 4. 构建弹窗数据
    const popup = {
      type: best.popupType,
      triggerId: best.triggerId,
      targetSegment: segment,
      productId: segConfig.targetProduct,
      productPrice: segConfig.targetPrice,
      title: best.message,
      ctaText: segConfig.ctaText,
      ctaSubtext: segConfig.ctaSubtext,
      // 首单转化 4 触发器
      triggers: _getConversionTriggers(segment),
      timestamp: ts,
    }

    return { show: true, popup }
  } catch (err) {
    console.error('[popupStrategy] shouldShowPopup 异常:', err.message)
    return { show: false, reason: err.message }
  }
}

// ═══════════════════════════
// recordPopupShown — 记录弹窗已展示
// ═══════════════════════════

async function recordPopupShown(db, openid, popupType) {
  try {
    await db.collection('funnel_events').add({
      data: {
        openid,
        event: 'popup_shown',
        stage: 'bottom',
        step: 0,
        membershipLevel: 'free',
        cv: 0,
        date: new Date().toISOString().slice(0, 10),
        timestamp: now(),
        extra: { popupType },
      },
    })
  } catch (_) {}
}

// ═══════════════════════════
// recordPopupAction — 记录弹窗行为
// ═══════════════════════════

async function recordPopupAction(db, openid, popupType, action) {
  try {
    await db.collection('funnel_events').add({
      data: {
        openid,
        event: 'popup_action',
        stage: 'bottom',
        step: 0,
        membershipLevel: 'free',
        cv: 0,
        date: new Date().toISOString().slice(0, 10),
        timestamp: now(),
        extra: { popupType, action },
      },
    })
  } catch (_) {}
}

// ═══════════════════════════
// getConversionTriggers — 4 个心理触发器
// ═══════════════════════════

function _getConversionTriggers(segment) {
  const triggers = []

  if (segment === 'free' || segment === 'report_buyer') {
    // Trigger 1: 限时
    triggers.push({
      type: 'urgency',
      icon: '⏳',
      text: '24小时内可享首单价，过后恢复原价',
      active: true,
    })
    // Trigger 2: 社会证明
    triggers.push({
      type: 'social_proof',
      icon: '👥',
      text: '已有 1,827 人解锁完整报告',
      active: true,
    })
    // Trigger 3: 损失厌恶
    triggers.push({
      type: 'loss_aversion',
      icon: '📦',
      text: '报告已生成，不解锁将被折叠归档',
      active: true,
    })
    // Trigger 4: 价格锚定
    triggers.push({
      type: 'price_anchor',
      icon: '💰',
      text: `原价 ¥99 → 首单 ¥9.9`,
      active: true,
    })
  }

  if (segment === 'member') {
    triggers.push({
      type: 'price_anchor',
      icon: '💎',
      text: '月卡 ¥99×12=¥1,188 → 年卡仅 ¥299',
      active: true,
    })
    triggers.push({
      type: 'social_proof',
      icon: '🔮',
      text: '三大年卡独占权益：hard_truth_mode + 深度报告 + 优先AI模型',
      active: true,
    })
  }

  return triggers
}

// ═══════════════════════════
// getSegment — 判断用户分层
// ═══════════════════════════

async function getSegment(db, openid) {
  try {
    const [entRes, ordersRes, aiRes] = await Promise.all([
      db.collection('entitlements').where({ openid }).limit(1).get(),
      db.collection('orders').where({ openid, status: 'paid' }).limit(1).get(),
      db.collection('funnel_events').where({ openid, event: 'ai_chat_count' }).limit(1).get().catch(() => ({ data: [] })),
    ])

    const perms = entRes.data[0]?.permissions || []
    const hasReport = ordersRes.data.some(o => o.productId === 'REPORT_001' && o.status === 'paid')

    // cv 从 events 推算
    const cvEvents = await db.collection('funnel_events')
      .where({ openid, event: db.command.in(['challenge_finish', 'insight_read', 'ai_chat_count']) })
      .count()
      .then(r => r.total)
      .catch(() => 0)
    const cv = cvEvents * 5  // 粗略估算

    if (perms.includes('consult_booking')) return 'premium'
    if (perms.includes('unlimited_ai')) return 'member'
    if (hasReport) return 'report_buyer'
    return 'free'
  } catch (_) {
    return 'free'
  }
}

module.exports = {
  POPUP_LIMIT_PER_DAY,
  POPUP_PRIORITY,
  SEGMENT_CONFIG,
  EVENT_TRIGGERS,
  shouldShowPopup,
  recordPopupShown,
  recordPopupAction,
  getSegment,
  getConversionTriggers: _getConversionTriggers,
}
