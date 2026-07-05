/**
 * cloudfunctions/common/conversionAnalyzer.js — 转化分析引擎（第五册 Part 4）
 *
 * 后台分析用：计算全漏斗转化率、流失分析、分段对比、趋势
 *
 * 输出供 adminGetAnalytics / funnelDashboard 使用
 */
const now = () => Date.now()
const _dayKey = (ts) => new Date(ts).toISOString().slice(0, 10)

// ═══════════════════════════
// analyzeFunnel — 全漏斗分析
// ═══════════════════════════

/**
 * @param {object}  db
 * @param {object}  options — { dateFrom, dateTo, segment }
 * @param {string}  options.dateFrom — '2026-06-01'
 * @param {string}  options.dateTo   — '2026-06-28'
 * @param {string}  options.segment  — 'all' | 'free' | 'report_buyer' | 'member' | 'premium'
 * @returns {{ summary, stages, lossPoints, recommendations }}
 */
async function analyzeFunnel(db, options = {}) {
  const { dateFrom, dateTo, segment = 'all' } = options
  const ts = now()

  try {
    // 1. 构建查询条件
    const where = {}
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date = { ...where.date, ...db.command.gte(dateFrom) }
      if (dateTo)   where.date = { ...where.date, ...db.command.lte(dateTo) }
    }

    // 2. 汇总 conversion_metrics
    const metricsRes = await db.collection('conversion_metrics')
      .where(where)
      .get()

    const totals = _sumMetrics(metricsRes.data)

    // 3. 按分段过滤（如果需要）
    if (segment && segment !== 'all') {
      const segMap = { free: 'free', report_buyer: 'free', member: 'vip', premium: 'vip' }
      const membershipLevel = segMap[segment] || 'all'

      if (membershipLevel !== 'all') {
        // 重新按 membershipLevel 查询 funnel_events
        const segWhere = { membershipLevel }
        if (dateFrom || dateTo) {
          segWhere.date = {}
          if (dateFrom) segWhere.date = { ...segWhere.date, ...db.command.gte(dateFrom) }
          if (dateTo)   segWhere.date = { ...segWhere.date, ...db.command.lte(dateTo) }
        }

        const events = await db.collection('funnel_events').where(segWhere).limit(5000).get()
        const segTotals = _countEvents(events.data)
        Object.assign(totals, segTotals)
      }
    }

    // 4. 计算各阶段转化率
    const stages = [
      { from: '首页访问', to: '暴击阅读', rate: _pct(totals.insight_read, totals.home_view),
        fromCount: totals.home_view, toCount: totals.insight_read },
      { from: '暴击阅读', to: '挑战开始', rate: _pct(totals.challenge_start, totals.insight_read),
        fromCount: totals.insight_read, toCount: totals.challenge_start },
      { from: '挑战开始', to: '挑战完成', rate: _pct(totals.challenge_finish, totals.challenge_start),
        fromCount: totals.challenge_start, toCount: totals.challenge_finish },
      { from: '挑战完成', to: '报告预览', rate: _pct(totals.report_preview, totals.challenge_finish),
        fromCount: totals.challenge_finish, toCount: totals.report_preview },
      { from: '报告预览', to: '点击解锁', rate: _pct(totals.report_unlock_click, totals.report_preview),
        fromCount: totals.report_preview, toCount: totals.report_unlock_click },
      { from: '点击解锁', to: '支付成功', rate: _pct(totals.payment_success, totals.report_unlock_click),
        fromCount: totals.report_unlock_click, toCount: totals.payment_success },
      { from: '支付成功', to: '会员购买', rate: _pct(totals.membership_purchase, totals.payment_success),
        fromCount: totals.payment_success, toCount: totals.membership_purchase },
      { from: '会员购买', to: '咨询申请', rate: _pct(totals.consult_apply, totals.membership_purchase),
        fromCount: totals.membership_purchase, toCount: totals.consult_apply },
    ]

    // 5. 找最大流失点
    const lossPoints = stages
      .map(s => ({ ...s, lossRate: _pct(s.fromCount - s.toCount, s.fromCount) }))
      .sort((a, b) => b.lossRate - a.lossRate)
      .slice(0, 3)

    // 6. 生成建议
    const recommendations = _generateRecommendations(lossPoints)

    // 7. 总体摘要
    const summary = {
      totalUV: totals.home_view,
      totalInsights: totals.insight_read,
      totalChallenges: totals.challenge_start,
      totalPayments: totals.payment_success,
      totalMemberships: totals.membership_purchase,
      totalConsults: totals.consult_apply,
      overallReportConversion: _pct(totals.payment_success, totals.home_view),
      overallMemberConversion: _pct(totals.membership_purchase, totals.home_view),
      analysedAt: ts,
    }

    return { summary, stages, lossPoints, recommendations, segment, analysedAt: ts }
  } catch (err) {
    console.error('[conversionAnalyzer] analyzeFunnel 异常:', err.message)
    return { error: err.message, analysedAt: ts }
  }
}

// ═══════════════════════════
// analyzeTrend — 趋势分析
// ═══════════════════════════

async function analyzeTrend(db, options = {}) {
  const { days = 7 } = options
  const ts = now()
  const dates = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(ts - i * 86400000)
    dates.push(d.toISOString().slice(0, 10))
  }

  try {
    const metricsRes = await db.collection('conversion_metrics')
      .where({ date: db.command.in(dates) })
      .get()

    const trend = dates.map(date => {
      const m = metricsRes.data.find(d => d.date === date) || {}
      return {
        date,
        home_view: m.home_view || 0,
        insight_read: m.insight_read || 0,
        challenge_start: m.challenge_start || 0,
        challenge_finish: m.challenge_finish || 0,
        report_preview: m.report_preview || 0,
        payment_success: m.payment_success || 0,
        membership_purchase: m.membership_purchase || 0,
        reportRate: _pct(m.payment_success, m.home_view),
        memberRate: _pct(m.membership_purchase, m.payment_success),
      }
    })

    return { trend, analysedAt: ts }
  } catch (err) {
    console.error('[conversionAnalyzer] analyzeTrend 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// analyzeSegment — 用户分层对比
// ═══════════════════════════

async function analyzeSegment(db, options = {}) {
  const ts = now()
  try {
    const segments = [
      { key: 'free',          label: '免费用户',   mLevel: 'free' },
      { key: 'report_buyer',  label: '报告购买者', mLevel: 'free' },
      { key: 'vip',           label: '会员用户',   mLevel: 'vip' },
      { key: 'yearly',        label: '年卡用户',   mLevel: 'yearly' },
    ]

    const results = await Promise.all(segments.map(async seg => {
      const memberships = await db.collection('memberships')
        .where({ level: seg.key === 'yearly' ? 'yearly' : seg.key, status: 'active' })
        .count()
        .then(r => r.total)
        .catch(() => 0)

      const payments = await db.collection('funnel_events')
        .where({ event: 'payment_success', membershipLevel: seg.mLevel })
        .count()
        .then(r => r.total)
        .catch(() => 0)

      const consults = await db.collection('funnel_events')
        .where({ event: 'consult_apply' })
        .count()
        .then(r => r.total)
        .catch(() => 0)

      return { segment: seg.key, label: seg.label, membershipCount: memberships,
        paymentCount: payments, consultCount: consults, paymentRate: memberships > 0 ? _pct(payments, memberships) : 0 }
    }))

    return { segments: results, analysedAt: ts }
  } catch (err) {
    console.error('[conversionAnalyzer] analyzeSegment 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _sumMetrics(rows) {
  return rows.reduce((acc, r) => {
    acc.home_view += (r.home_view || 0)
    acc.insight_read += (r.insight_read || 0)
    acc.challenge_start += (r.challenge_start || 0)
    acc.challenge_finish += (r.challenge_finish || 0)
    acc.report_preview += (r.report_preview || 0)
    acc.report_unlock_click += (r.report_unlock_click || 0)
    acc.payment_success += (r.payment_success || 0)
    acc.membership_view += (r.membership_view || 0)
    acc.membership_purchase += (r.membership_purchase || 0)
    acc.consult_apply += (r.consult_apply || 0)
    return acc
  }, { home_view: 0, insight_read: 0, challenge_start: 0, challenge_finish: 0,
       report_preview: 0, report_unlock_click: 0, payment_success: 0,
       membership_view: 0, membership_purchase: 0, consult_apply: 0 })
}

function _countEvents(events) {
  return events.reduce((acc, e) => {
    const key = e.event
    if (key in acc) acc[key] = (acc[key] || 0) + 1
    return acc
  }, { home_view: 0, insight_read: 0, challenge_start: 0, challenge_finish: 0,
       report_preview: 0, report_unlock_click: 0, payment_success: 0,
       membership_view: 0, membership_purchase: 0, consult_apply: 0 })
}

function _pct(n, d) {
  if (!d || d === 0) return 0
  return Math.round((n / d) * 10000) / 100
}

function _generateRecommendations(lossPoints) {
  const recs = []

  for (const lp of lossPoints) {
    if (lp.lossRate < 20) continue

    switch (lp.from) {
      case '首页访问':
        if (lp.lossRate > 50) recs.push({ stage: lp.from, issue: '首页→暴击流失过大',
          action: '强化认知冲击钩子，确保首页10秒内出现反常识句子', priority: 1 })
        break
      case '暴击阅读':
        recs.push({ stage: lp.from, issue: '暴击→挑战流失',
          action: '暴击卡片底部增加挑战入口CTA，缩短认知到行动的路径', priority: 1 })
        break
      case '挑战开始':
        recs.push({ stage: lp.from, issue: '挑战中途放弃率高',
          action: '挑战前 3 题降低难度增强信心，中途显示进度激励', priority: 2 })
        break
      case '报告预览':
        recs.push({ stage: lp.from, issue: '报告到解锁转化低',
          action: '强化4触发器：限时Countdown/社会证明数字/损失厌恶文案/原价锚定对比', priority: 1 })
        break
      case '点击解锁':
        recs.push({ stage: lp.from, issue: '点击解锁但支付流失',
          action: '检查支付流程顺畅度/价格敏感度，可增加支付安全保障提示', priority: 1 })
        break
      case '支付成功':
        recs.push({ stage: lp.from, issue: '支付到会员转化低',
          action: '支付成功后3分钟内弹出会员升级黄金窗口，展示刚解锁价值+会员额外权益', priority: 1 })
        break
      case '会员购买':
        recs.push({ stage: lp.from, issue: '会员到咨询转化低',
          action: '对高活跃会员定向推送咨询入口，增加真人案例', priority: 3 })
        break
    }
  }

  return recs
}

module.exports = { analyzeFunnel, analyzeTrend, analyzeSegment }
