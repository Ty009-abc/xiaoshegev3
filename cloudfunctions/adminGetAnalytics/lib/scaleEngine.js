/**
 * scaleEngine.js — 规模化增长引擎（第六册 Part 6）
 *
 * 能力：
 *   1. 增长阶段检测（0-1k / 1k-10k / 10k-100k / 100k+）
 *   2. 内容规模化三层（原创20% / AI辅助60% / 团队编辑20%）
 *   3. 账号矩阵管理（5 账号）
 *   4. 投流规则（LTV/CAC > 3 才放量）
 *   5. 规模化 KPI 追踪
 *
 * 核心哲学：
 *   Founder Driven → System Driven
 *   "天花板不在AI能力，在内容矩阵规模"
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

// ── 增长阶段定义 ──
const GROWTH_PHASES = [
  { phase: 'validation',   label: '验证期',  range: [0, 1000],     bottleneck: '流量',   strategy: '个人IP + 内容验证',   metric: 'DAU/首付率/留存' },
  { phase: 'flywheel',     label: '飞轮期',  range: [1000, 10000], bottleneck: '转化',   strategy: '内容矩阵 + 裂变',       metric: 'K-factor/分享率' },
  { phase: 'scaling',      label: '规模化',  range: [10000, 100000],bottleneck: '留存', strategy: '渠道复制 + 自动化运营',  metric: 'DAU/MAU/Revenue' },
  { phase: 'brand',        label: '品牌化',  range: [100000, Infinity],bottleneck: '组织效率',strategy:'矩阵化 + 投流',         metric: '品牌指数/MRR' },
]

// ── 内容生产分层 ──
const CONTENT_LAYERS = [
  { layer: 1, type: 'original',  label: '本人原创',    share: 20, description: '最高价值，不可替代' },
  { layer: 2, type: 'ai_assist', label: 'AI辅助内容',  share: 60, description: '批量生产主力' },
  { layer: 3, type: 'team_edit', label: '团队编辑',    share: 20, description: '优化剪辑分发' },
]

// ── 账号矩阵 ──
const ACCOUNT_MATRIX = [
  { id: 'main',        name: '珠澳小事哥',   role: 'IP',       contentFocus: 'casino+cognition', goal: '品牌信任' },
  { id: 'casino_leak', name: '赌场内幕号',    role: '爆流量',   contentFocus: 'casino',           goal: '低成本获客' },
  { id: 'cog_shock',   name: '认知暴击号',    role: '强传播',   contentFocus: 'cognition',        goal: '高分享率' },
  { id: 'ai_upgrade',  name: 'AI翻身号',     role: '强转化',   contentFocus: 'ai',               goal: '付费转化' },
  { id: 'film_talk',   name: '影视解说号',    role: '第二增长线',contentFocus: 'trending',        goal: '泛流量入口' },
]

// ── 投流规则 ──
const PAID_RULES = {
  minLtvCacRatio: 3,     // LTV/CAC > 3 才放量
  maxDailyBudget: 50000, // 日预算上限 500元
  channels: ['douyin_feed', 'video_account_ad', 'kol_collab'],
}

// ═══════════════════════════
// detectPhase — 检测当前增长阶段
// ═══════════════════════════

async function detectPhase(db) {
  const ts = now()
  try {
    // 获取总用户数
    const totalUsers = await db.collection('users').count().then(r => r.total).catch(() => 0)

    // 获取 DAU
    const today = _todayKey(ts)
    const dau = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: today })
      .count().then(r => r.total).catch(() => 0)

    // 获取 MAU (30天活跃用户)
    const thirtyDaysAgo = _todayKey(ts - 30 * ONE_DAY)
    const mau = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: db.command.gte(thirtyDaysAgo) })
      .count().then(r => r.total).catch(() => 0)

    // 月新增
    const monthNew = await db.collection('users')
      .where({ createdAt: db.command.gte(ts - 30 * ONE_DAY) })
      .count().then(r => r.total).catch(() => 0)

    // Growth Rate = 月新增 / 上月总用户
    const prevMonthUsers = totalUsers - monthNew
    const growthRate = prevMonthUsers > 0 ? Math.round((monthNew / prevMonthUsers) * 10000) / 100 : 0

    // 收入增长
    let revenueGrowth = 0
    try {
      const thisMonth = await db.collection('orders')
        .where({ createdAt: db.command.gte(ts - 30 * ONE_DAY), status: 'paid' })
        .get()
        .catch(() => ({ data: [] }))
      const currentRevenue = thisMonth.data.reduce((s, o) => s + (o.amount || 0), 0)

      const lastMonth = await db.collection('orders')
        .where({ createdAt: db.command.gte(ts - 60 * ONE_DAY).and(db.command.lte(ts - 30 * ONE_DAY)), status: 'paid' })
        .get()
        .catch(() => ({ data: [] }))
      const lastRevenue = lastMonth.data.reduce((s, o) => s + (o.amount || 0), 0)

      revenueGrowth = lastRevenue > 0 ? Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 10000) / 100 : 0
    } catch (_) {}

    // 确定阶段
    const phase = GROWTH_PHASES.find(p => totalUsers >= p.range[0] && totalUsers < p.range[1]) || GROWTH_PHASES[3]
    const nextPhase = GROWTH_PHASES[GROWTH_PHASES.indexOf(phase) + 1] || null

    return {
      currentPhase: phase,
      nextPhase,
      totalUsers,
      dau,
      mau,
      monthNew,
      growthRate,
      revenueGrowth,
      dauMauRatio: mau > 0 ? Math.round((dau / mau) * 10000) / 100 : 0,
      progressToNext: nextPhase
        ? Math.round(((totalUsers - phase.range[0]) / (nextPhase.range[0] - phase.range[0])) * 10000) / 100
        : 100,
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getContentScalingPlan — 内容规模化方案
// ═══════════════════════════

function getContentScalingPlan() {
  return {
    layers: CONTENT_LAYERS,
    currentTarget: '日更 2 条',
    scaledTarget: '矩阵日更 20 条',
    breakdown: ACCOUNT_MATRIX.map(acc => ({
      account: acc.name,
      role: acc.role,
      dailyPosts: acc.id === 'main' ? 2 : acc.id === 'film_talk' ? 3 : 5,
      contentMix: acc.contentFocus,
      layers: CONTENT_LAYERS.map(l => ({
        layer: l.type,
        share: acc.id === 'main' ? [40, 50, 10] : [10, 70, 20],
      })),
    })),
    pipeline: {
      ideate: 'topicGenerator → 选题池',
      draft: 'contentEngine.assembleScript()',
      review: 'contentScorer.scoreContent() > 75 发布',
      distribute: '多账号定时发布',
      analyze: 'acquisitionEngine.getContentROI()',
    },
  }
}

// ═══════════════════════════
// getAccountMatrix — 账号矩阵
// ═══════════════════════════

function getAccountMatrix() {
  return ACCOUNT_MATRIX
}

// ═══════════════════════════
// getPaidGrowthRules — 投流规则
// ═══════════════════════════

async function getPaidGrowthRules(db) {
  const ts = now()
  try {
    const ltvAnalyzer = require('./ltvAnalyzer.js')
    const health = await ltvAnalyzer.getLtvHealth(db)

    const channels = PAID_RULES.channels.map(ch => {
      const avgHealth = health.health ? Object.values(health.health).reduce((s, h) => s + (h.ltvCacRatio || 0), 0) / Object.keys(health.health).length : 0
      return {
        channel: ch,
        allowed: avgHealth >= PAID_RULES.minLtvCacRatio,
        reason: avgHealth >= PAID_RULES.minLtvCacRatio
          ? `LTV/CAC = ${Math.round(avgHealth * 100) / 100} ≥ ${PAID_RULES.minLtvCacRatio}，允许投放`
          : `LTV/CAC = ${Math.round(avgHealth * 100) / 100} < ${PAID_RULES.minLtvCacRatio}，禁止投放`,
      }
    })

    return {
      rules: PAID_RULES,
      currentLtvCac: health.health ? Object.values(health.health).map(h => h.ltvCacRatio) : [],
      channels,
      recommendation: channels.some(c => c.allowed)
        ? '可投放渠道: ' + channels.filter(c => c.allowed).map(c => c.channel).join('、')
        : '当前所有渠道不满足投放条件，先优化 LTV/CAC',
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getScaleKPIs — 规模化 KPI 快照
// ═══════════════════════════

async function getScaleKPIs(db) {
  const ts = now()
  const today = _todayKey(ts)
  const thirtyDaysAgo = _todayKey(ts - 30 * ONE_DAY)

  try {
    // DAU
    const dau = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: today })
      .count().then(r => r.total).catch(() => 0)

    // MAU
    const mau = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: db.command.gte(thirtyDaysAgo) })
      .count().then(r => r.total).catch(() => 0)

    // 分享率
    const shares = await db.collection('share_events')
      .where({ event: 'share_click', date: today })
      .count().then(r => r.total).catch(() => 0)
    const shareRate = dau > 0 ? Math.round((shares / dau) * 10000) / 100 : 0

    // Virality (K-factor 简化为 today)
    const invitesSent = await db.collection('share_events')
      .where({ event: 'invite_sent', date: today })
      .count().then(r => r.total).catch(() => 0)
    const invitesActivated = await db.collection('share_events')
      .where({ event: 'invite_activated', date: today })
      .count().then(r => r.total).catch(() => 0)
    const avgInvitesPerUser = dau > 0 ? invitesSent / dau : 0
    const inviteRate = invitesSent > 0 ? invitesActivated / invitesSent : 0
    const kFactor = Math.round(avgInvitesPerUser * inviteRate * 100) / 100

    // Retention (简化 — 7日后活跃)
    let retention = 0
    try {
      const sevenDaysAgo = _todayKey(ts - 7 * ONE_DAY)
      const d7Users = await db.collection('growth_events')
        .where({ event: 'mini_enter', date: sevenDaysAgo })
        .distinct('openid').then(r => r?.length || 0).catch(() => 0)
      const d7Returning = d7Users > 0 ? Math.min(dau / d7Users * 100, 100) : 0
      retention = Math.round(d7Returning * 100) / 100
    } catch (_) {}

    // Revenue Growth
    let revenueGrowth = 0
    try {
      const thisMonth = await db.collection('orders')
        .where({ createdAt: db.command.gte(ts - 30 * ONE_DAY), status: 'paid' })
        .get().then(r => r.data).catch(() => [])
      const currentRevenue = thisMonth.reduce((s, o) => s + (o.amount || 0), 0)
      const lastMonth = await db.collection('orders')
        .where({ createdAt: db.command.gte(ts - 60 * ONE_DAY).and(db.command.lte(ts - 30 * ONE_DAY)), status: 'paid' })
        .get().then(r => r.data).catch(() => [])
      const lastRevenue = lastMonth.reduce((s, o) => s + (o.amount || 0), 0)
      revenueGrowth = lastRevenue > 0 ? Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 10000) / 100 : 0
    } catch (_) {}

    const metrics = {
      date: today,
      dau,
      mau,
      dauMauRatio: mau > 0 ? Math.round((dau / mau) * 10000) / 100 : 0,
      shareRate,
      kFactor,
      retention,
      revenueGrowth,
      createdAt: ts,
    }

    // 写入 scale_metrics
    try {
      const exist = await db.collection('scale_metrics').where({ date: today }).limit(1).get()
      if (exist.data.length > 0) {
        await db.collection('scale_metrics').doc(exist.data[0]._id).update({ data: { ...metrics, updatedAt: ts } })
      } else {
        await db.collection('scale_metrics').add({ data: metrics })
      }
    } catch (_) {}

    return {
      ...metrics,
      benchmarks: {
        dau: { current: dau, target: 10000, progress: dau / 100 },
        shareRate: { current: shareRate, target: 15, status: shareRate >= 15 ? 'hit' : 'below' },
        kFactor: { current: kFactor, target: 0.3, status: kFactor >= 0.3 ? 'viral' : 'needs_boost' },
        retention: { current: retention, target: 30, status: retention >= 30 ? 'good' : 'needs_improvement' },
      },
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getScalePhaseKPIs — 阶段级指标
// ═══════════════════════════

async function getScalePhaseKPIs(db, totalUsers) {
  const phase = GROWTH_PHASES.find(p => totalUsers >= p.range[0] && totalUsers < p.range[1]) || GROWTH_PHASES[3]
  const nextPhase = GROWTH_PHASES[GROWTH_PHASES.indexOf(phase) + 1] || null

  return {
    phase: phase.phase,
    phaseLabel: phase.label,
    range: `${phase.range[0].toLocaleString()} - ${phase.range[1] === Infinity ? '∞' : phase.range[1].toLocaleString()}`,
    bottleneck: phase.bottleneck,
    strategy: phase.strategy,
    keyMetric: phase.metric,
    nextPhase: nextPhase ? {
      label: nextPhase.label,
      usersNeeded: nextPhase.range[0] - totalUsers,
      bottleneck: nextPhase.bottleneck,
    } : null,
  }
}

// ═══════════════════════════
// getScaleTimeline — 规模化路线图
// ═══════════════════════════

function getScaleTimeline() {
  return [
    { phase: 'A', label: '0 → 1,000',  duration: '1-2个月',  method: '个人内容',     key: '验证产品价值' },
    { phase: 'B', label: '1,000 → 10,000', duration: '3-6个月',  method: '裂变+内容矩阵', key: '验证增长飞轮' },
    { phase: 'C', label: '10,000 → 50,000', duration: '6-12个月', method: '私域+会员',    key: '规模化系统运营' },
    { phase: 'D', label: '50,000 → 100,000+', duration: '持续',     method: '品牌+投流+矩阵', key: '品牌化' },
  ]
}

module.exports = {
  GROWTH_PHASES,
  CONTENT_LAYERS,
  ACCOUNT_MATRIX,
  PAID_RULES,
  detectPhase,
  getContentScalingPlan,
  getAccountMatrix,
  getPaidGrowthRules,
  getScaleKPIs,
  getScalePhaseKPIs,
  getScaleTimeline,
}
