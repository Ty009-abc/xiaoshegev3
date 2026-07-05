/**
 * nurtureEngine.js — 用户培育引擎（第六册 Part 4）
 *
 * 能力：
 *   1. 新用户培育序列（7 天）
 *   2. 高价值用户培育（VIP 专享）
 *   3. 沉默用户唤醒
 *   4. 流失预警干预
 *   5. 内容推荐策略
 *
 * 内容比例 7:2:1
 *   认知内容 70% / 案例拆解 20% / 销售CTA 10%
 */
const now = () => Date.now()

// ── 培育阶段 ──
const NURTURE_PHASES = {
  onboarding:   { name: '新用户引导',    duration: 7,  seq: 1 },
  activation:   { name: '激活互动',      duration: 14, seq: 2 },
  engagement:   { name: '深度参与',      duration: 30, seq: 3 },
  conversion:   { name: '转化阶段',      duration: 7,  seq: 4 },
  retention:    { name: '持续留存',      duration: 999,seq: 5 },
  re_activation:{ name: '沉默唤醒',      duration: 7,  seq: 6 },
  churn_alert:  { name: '流失预警',      duration: 3,  seq: 7 },
}

// ── 新用户 7 天培育序列 ──
const ONBOARDING_SEQUENCE = [
  { day: 0, key: 'welcome',          type: 'cognition', cta: 'none',     message: '欢迎来到认知操作系统' },
  { day: 1, key: 'first_challenge',  type: 'cognition', cta: 'soft',     message: '今天有一个认知挑战等你' },
  { day: 2, key: 'insight_of_day',   type: 'cognition', cta: 'none',     message: '今日认知暴击' },
  { day: 3, key: 'ai_intro',         type: 'case_study', cta: 'soft',    message: 'AI正在改变认知升级的方式' },
  { day: 4, key: 'challenge_2',      type: 'cognition', cta: 'soft',     message: '你的认知漏洞在哪里？' },
  { day: 5, key: 'report_preview',   type: 'case_study', cta: 'medium',  message: '你的第一份认知报告已生成' },
  { day: 6, key: 'membership_tease', type: 'sale',       cta: 'medium',  message: '解锁完整认知操作系统' },
]

// ── 高价值用户培育 ──
const VIP_NURTURE = [
  { period: 'weekly',  key: 'weekly_report',   type: 'cognition', message: '你的本周认知报告' },
  { period: 'monthly', key: 'monthly_review',  type: 'case_study', message: '本月认知进化复盘' },
  { period: 'monthly', key: 'vip_workshop',    type: 'cognition', message: 'VIP专属深度分析' },
  { period: 'as_needed', key: 'consult_invite',type: 'sale', message: '1对1咨询邀请' },
]

// ── 沉默唤醒序列 ──
const REACTIVATION_SEQUENCE = [
  { day: 0,  key: 'miss_you',        message: '好久不见，来看看你的认知变化' },
  { day: 3,  key: 'new_feature',     message: '新增了AI深度分析功能' },
  { day: 7,  key: 'freebie',         message: '送你一次免费认知测评' },
]

// ── 内容分配策略 7:2:1 ──
const CONTENT_MIX = {
  cognition:   70, // 认知内容
  case_study:  20, // 案例拆解
  sale:        10, // 销售CTA
}

// ═══════════════════════════
// getNurturePlan — 为指定用户生成培育计划
// ═══════════════════════════

async function getNurturePlan(db, openid) {
  const ts = now()
  try {
    // 获取用户资料
    let profile = {}
    try {
      const user = await db.collection('users').where({ openid }).limit(1).get()
        .then(r => r.data[0]).catch(() => null)
      if (user) {
        profile = {
          daysSinceJoin: user.createdAt ? Math.floor((ts - user.createdAt) / 86400000) : 0,
          cv: user.cv || 0,
          totalChallenges: user.totalChallenges || 0,
          lastActiveAt: user.lastActiveAt || user.updatedAt || ts,
          segment: user.segment || 'free',
          membershipType: user.membershipType || null,
          hasReport: user.hasReport || false,
        }
      }
    } catch (_) {}

    // 判断阶段
    const phase = _determinePhase(profile)

    // 生成内容建议
    const recommendations = _generateRecommendations(phase, profile)

    return {
      phase: phase.name,
      phaseSeq: phase.seq,
      profile: {
        daysSinceJoin: profile.daysSinceJoin || 0,
        daysSinceActive: profile.lastActiveAt
          ? Math.floor((ts - profile.lastActiveAt) / 86400000)
          : 999,
        segment: profile.segment || 'free',
      },
      contentMix: CONTENT_MIX,
      recommendations,
      generatedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getOnboardingSequence — 新用户培育序列
// ═══════════════════════════

function getOnboardingSequence() {
  return ONBOARDING_SEQUENCE
}

// ═══════════════════════════
// getVIPNurture — VIP 培育
// ═══════════════════════════

function getVIPNurture() {
  return VIP_NURTURE
}

// ═══════════════════════════
// getReactivationSequence — 沉默唤醒
// ═══════════════════════════

function getReactivationSequence() {
  return REACTIVATION_SEQUENCE
}

// ═══════════════════════════
// suggestContentType — 按 7:2:1 推荐内容类型
// ═══════════════════════════

function suggestContentType() {
  const rand = Math.random() * 100
  if (rand < 70) return { type: 'cognition',   label: '认知内容',   ctaStrength: 'soft' }
  if (rand < 90) return { type: 'case_study',   label: '案例拆解',   ctaStrength: 'medium' }
  return             { type: 'sale',            label: '销售CTA',    ctaStrength: 'strong' }
}

// ═══════════════════════════
// getPrivateMetrics — 私域指标快照
// ═══════════════════════════

async function getPrivateMetrics(db) {
  const ts = now()
  const today = new Date(ts).toISOString().slice(0, 10)

  try {
    const contacts = await db.collection('crm_contacts').get().catch(() => ({ data: [] }))
    const total = contacts.data.length

    // 进群率（简化为有CRM记录/总DAU）
    const dauEvents = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: today })
      .count().then(r => r.total).catch(() => 0)
    const joinRate = dauEvents > 0 ? Math.round((contacts.data.filter(c => c.createdAt >= ts - 86400000).length / dauEvents) * 10000) / 100 : 0

    // 互动率：warm+hot / total
    const engaged = contacts.data.filter(c => c.contactStatus === 'warm' || c.contactStatus === 'hot').length
    const engagementRate = total > 0 ? Math.round((engaged / total) * 10000) / 100 : 0

    // 转化率：converted / total
    const converted = contacts.data.filter(c => c.contactStatus === 'converted').length
    const conversionRate = total > 0 ? Math.round((converted / total) * 10000) / 100 : 0

    // 高价值线索数
    const highValue = contacts.data.filter(c => c.segment === 'vip' || c.segment === 'consult').length

    // 咨询成交率（简化：converted且consult）
    const consultConverted = contacts.data.filter(c => c.segment === 'consult' && c.contactStatus === 'converted').length
    const consultRate = contacts.data.filter(c => c.segment === 'consult').length > 0
      ? Math.round((consultConverted / contacts.data.filter(c => c.segment === 'consult').length) * 10000) / 100
      : 0

    const metrics = {
      date: today,
      totalContacts: total,
      joinRate,
      engagementRate,
      conversionRate,
      highValueLeads: highValue,
      consultConversionRate: consultRate,
      createdAt: ts,
    }

    // 写入 private_metrics
    try {
      const exist = await db.collection('private_metrics').where({ date: today }).limit(1).get()
      if (exist.data.length > 0) {
        await db.collection('private_metrics').doc(exist.data[0]._id).update({ data: { ...metrics, updatedAt: ts } })
      } else {
        await db.collection('private_metrics').add({ data: metrics })
      }
    } catch (_) {}

    return metrics
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _determinePhase(profile) {
  const daysSinceJoin = profile.daysSinceJoin || 0
  const daysSinceActive = profile.lastActiveAt
    ? Math.floor((now() - profile.lastActiveAt) / 86400000)
    : 999

  if (daysSinceActive > 30 && daysSinceJoin > 30) return NURTURE_PHASES.churn_alert
  if (daysSinceActive > 14 && daysSinceJoin > 7) return NURTURE_PHASES.re_activation
  if (daysSinceJoin <= 7) return NURTURE_PHASES.onboarding
  if (daysSinceJoin <= 21) return NURTURE_PHASES.activation
  if (profile.segment === 'vip' || profile.segment === 'consult') return NURTURE_PHASES.conversion
  if (profile.cv > 150 || profile.totalChallenges > 5) return NURTURE_PHASES.engagement
  return NURTURE_PHASES.retention
}

function _generateRecommendations(phase, profile) {
  const recs = []

  switch (phase.seq) {
    case 1: // onboarding
      recs.push({ action: 'send_welcome', priority: 'high', message: '欢迎消息 + 第一个挑战引导' })
      recs.push({ action: 'schedule_sequence', priority: 'high', sequence: 'ONBOARDING_7DAY' })
      break
    case 2: // activation
      recs.push({ action: 'prompt_challenge', priority: 'medium', message: '推动完成第一个挑战' })
      recs.push({ action: 'show_report_preview', priority: 'medium', message: '展示报告预览，引导付费' })
      break
    case 3: // engagement
      recs.push({ action: 'weekly_report', priority: 'low', message: '生成周报' })
      recs.push({ action: 'vip_upsell', priority: 'medium', message: '推荐会员升级' })
      break
    case 4: // conversion
      recs.push({ action: 'personal_consult', priority: 'high', message: '推送1对1咨询' })
      recs.push({ action: 'advanced_service', priority: 'medium', message: '推荐高阶服务' })
      break
    case 5: // retention
      recs.push({ action: 'keep_warm', priority: 'low', message: '保持日常互动' })
      break
    case 6: // re_activation
      recs.push({ action: 'reactivate_sequence', priority: 'high', sequence: 'REACTIVATION_7DAY' })
      break
    case 7: // churn_alert
      recs.push({ action: 'urgent_reachout', priority: 'critical', message: '立即推送唤醒内容' })
      break
  }

  return recs
}

module.exports = {
  NURTURE_PHASES,
  ONBOARDING_SEQUENCE,
  VIP_NURTURE,
  REACTIVATION_SEQUENCE,
  CONTENT_MIX,
  getNurturePlan,
  getOnboardingSequence,
  getVIPNurture,
  getReactivationSequence,
  suggestContentType,
  getPrivateMetrics,
}
