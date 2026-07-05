/**
 * viralAnalyzer.js — 裂变数据分析（第六册 Part 3）
 *
 * 指标：
 *   Share Rate / Invite Rate / Activation Rate / K-Factor / Paid Referral Rate
 *
 * 爬榜：Top Inviters / Top Sharers
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)

// ═══════════════════════════
// getViralMetrics — 裂变核心指标
// ═══════════════════════════

async function getViralMetrics(db) {
  const ts = now()
  const today = _todayKey(ts)

  try {
    const shareEvents = await db.collection('share_events')
      .where({ date: today })
      .get()
      .catch(() => ({ data: [] }))

    const totalShareClicks = shareEvents.data.filter(e => e.event === 'share_click').length
    const totalInvitesSent = shareEvents.data.filter(e => e.event === 'invite_sent').length
    const totalActivated = shareEvents.data.filter(e => e.event === 'invite_activated').length
    const totalChallengeCompleted = await db.collection('growth_events')
      .where({ event: 'challenge_complete', date: today })
      .count().then(r => r.total).catch(() => 0)

    // Share Rate = share_clicks / challenge_complete
    const shareRate = totalChallengeCompleted > 0
      ? Math.round((totalShareClicks / totalChallengeCompleted) * 10000) / 100
      : 0

    // Invite Rate = invites_sent / share_clicks
    const inviteRate = totalShareClicks > 0
      ? Math.round((totalInvitesSent / totalShareClicks) * 10000) / 100
      : 0

    // Activation Rate = activated / invites_sent
    const activationRate = totalInvitesSent > 0
      ? Math.round((totalActivated / totalInvitesSent) * 10000) / 100
      : 0

    // K-Factor = avg_invites_per_user × activation_rate
    const dau = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: today })
      .count().then(r => r.total).catch(() => 0)
    const avgInvites = dau > 0 ? totalInvitesSent / dau : 0
    const kFactor = Math.round(avgInvites * (activationRate / 100) * 100) / 100

    // Paid Referral Rate = paid referrals / total invites
    const paidReferrals = await db.collection('referrals')
      .where({ status: 'paid' })
      .count().then(r => r.total).catch(() => 0)
    const totalReferrals = await db.collection('referrals')
      .where({ inviteeOpenid: db.command.exists(true) })
      .count().then(r => r.total).catch(() => 0)
    const paidReferralRate = totalReferrals > 0
      ? Math.round((paidReferrals / totalReferrals) * 10000) / 100
      : 0

    // 写入 viral_metrics
    const metric = {
      date: today,
      shareRate,
      inviteRate,
      activationRate,
      kFactor,
      paidReferralRate,
      totalShareClicks,
      totalInvitesSent,
      totalActivated,
      totalPaidReferrals: paidReferrals,
      createdAt: ts,
    }

    try {
      const existing = await db.collection('viral_metrics').where({ date: today }).limit(1).get()
      if (existing.data.length > 0) {
        await db.collection('viral_metrics').doc(existing.data[0]._id).update({ data: { ...metric, updatedAt: ts } })
      } else {
        await db.collection('viral_metrics').add({ data: metric })
      }
    } catch (_) {}

    return {
      ...metric,
      kFactorStatus: kFactor > 1 ? 'viral' : kFactor > 0.6 ? 'growing' : kFactor > 0.3 ? 'needs_boost' : 'manual',
      benchmarks: {
        shareRate: { current: shareRate, target: 15, status: shareRate >= 15 ? 'hit' : 'below' },
        inviteRate: { current: inviteRate, target: 25, status: inviteRate >= 25 ? 'hit' : 'below' },
        kFactor:    { current: kFactor, target: 0.3, status: kFactor >= 0.3 ? 'hit' : 'below' },
      },
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[viralAnalyzer] getViralMetrics 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getViralTrend — 裂变趋势 (7日)
// ═══════════════════════════

async function getViralTrend(db) {
  const ts = now()
  const trend = []

  for (let i = 6; i >= 0; i--) {
    const d = _todayKey(ts - i * 86400000)
    const metrics = await db.collection('viral_metrics')
      .where({ date: d })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (metrics.data.length > 0) {
      trend.push({
        date: d,
        shareRate: metrics.data[0].shareRate || 0,
        kFactor: metrics.data[0].kFactor || 0,
        invites: metrics.data[0].totalInvitesSent || 0,
        activated: metrics.data[0].totalActivated || 0,
      })
    } else {
      trend.push({ date: d, shareRate: 0, kFactor: 0, invites: 0, activated: 0 })
    }
  }

  return { trend, analysedAt: ts }
}

// ═══════════════════════════
// getTopSharers — Top 分享者
// ═══════════════════════════

async function getTopSharers(db, limit = 10) {
  try {
    const top = await db.collection('referrals')
      .where({ inviterOpenid: db.command.exists(true) })
      .orderBy('activatedInvites', 'desc')
      .limit(limit)
      .get()
      .catch(() => ({ data: [] }))

    return top.data.map(r => ({
      inviterCode: r.inviterCode,
      totalInvites: r.totalInvites || 0,
      activatedInvites: r.activatedInvites || 0,
      paidInvites: r.paidInvites || 0,
      conversionRate: (r.totalInvites || 0) > 0
        ? Math.round(((r.activatedInvites || 0) / (r.totalInvites || 1)) * 10000) / 100
        : 0,
    }))
  } catch (_) {
    return []
  }
}

// ═══════════════════════════
// getReferralChain — 邀请链查询
// ═══════════════════════════

async function getReferralChain(db, openid) {
  try {
    // 找到被谁邀请
    const invitedBy = await db.collection('referrals')
      .where({ inviteeOpenid: openid, inviterCode: db.command.exists(true) })
      .limit(1)
      .get()
      .then(r => r.data[0])
      .catch(() => null)

    if (!invitedBy) return { chain: [], isRoot: true }

    const inviter = await db.collection('referrals')
      .where({ inviterCode: invitedBy.inviterCode, inviterOpenid: db.command.exists(true) })
      .limit(1)
      .get()
      .then(r => r.data[0])
      .catch(() => null)

    return {
      chain: [inviter?.inviterOpenid || invitedBy.inviterCode, openid],
      inviterCode: invitedBy.inviterCode,
      status: invitedBy.status,
      isRoot: false,
      activatedAt: invitedBy.activatedAt || null,
    }
  } catch (err) {
    return { error: err.message }
  }
}

module.exports = {
  getViralMetrics,
  getViralTrend,
  getTopSharers,
  getReferralChain,
}
