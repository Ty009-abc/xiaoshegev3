/**
 * acquisitionEngine.js — 获客主引擎（第六册 Part 5）
 *
 * 职责：
 *   1. 记录获客事件 (source / contentId / channel)
 *   2. CAC 计算
 *   3. Activation Rate / Paid Conversion Rate
 *   4. 渠道级 / 内容级 LTV
 *   5. Budget Optimizer 投放建议
 *
 * 核心公式：
 *   CAC = 渠道花费 / 新增用户
 *   LTV/CAC > 4 = 商业健康
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)

// ── 渠道定义 ──
const ACQUISITION_SOURCES = [
  { key: 'douyin',        label: '抖音',          type: 'social',   cost: true  },
  { key: 'wechat',        label: '微信',          type: 'social',   cost: false },
  { key: 'video_account', label: '视频号',        type: 'social',   cost: false },
  { key: 'xiaohongshu',   label: '小红书',        type: 'social',   cost: true  },
  { key: 'organic',       label: '自然流量',      type: 'organic',  cost: false },
  { key: 'referral',      label: '裂变邀请',      type: 'referral', cost: false },
  { key: 'paid_ads',      label: '付费广告',      type: 'paid',     cost: true  },
]

// ── KPI 目标 ──
const CAC_TARGETS = {
  douyin:      20,   // < 20
  referral:    5,    // < 5
  organic:     0,    // ≈ 0
  xiaohongshu: 15,
  paid_ads:    25,
  default:     25,
}
const LTV_TARGET = 80 // LTV 目标 > 80
const HEALTH_RATIO = 4 // LTV/CAC > 4 健康

// ═══════════════════════════
// recordAcquisition — 记录获客
// ═══════════════════════════

async function recordAcquisition(db, { openid, source, channel, contentId, campaignId, cost, ip, deviceInfo }) {
  const ts = now()
  if (!openid) return { error: '缺少 openid' }

  try {
    // 已有记录则跳过
    const exist = await db.collection('acquisition_metrics')
      .where({ openid })
      .count().then(r => r.total).catch(() => 0)
    if (exist > 0) return { success: true, note: 'already_recorded' }

    await db.collection('acquisition_metrics').add({
      data: {
        openid,
        source: source || 'organic',
        channel: channel || 'unknown',
        contentId: contentId || null,
        campaignId: campaignId || null,
        cost: cost || 0,
        activated: false,
        paid: false,
        ltv: 0,
        firstTouchAt: ts,
        deviceInfo: deviceInfo || null,
        createdAt: ts,
      },
    })

    // 记录 growth_events（与 growthTracker 联动）
    try {
      await db.collection('growth_events').add({
        data: {
          openid,
          event: 'user_acquired',
          source: source || 'organic',
          contentId: contentId || null,
          campaignId: campaignId || null,
          date: _todayKey(ts),
          createdAt: ts,
        },
      }).catch(() => {})
    } catch (_) {}

    return { success: true, source: source || 'organic' }
  } catch (err) {
    console.error('[acquisitionEngine] recordAcquisition 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// markActivated — 标记激活（完成 challenge_start）
// ═══════════════════════════

async function markActivated(db, openid) {
  const ts = now()
  try {
    const acq = await db.collection('acquisition_metrics')
      .where({ openid, activated: false })
      .limit(1).get().then(r => r.data[0]).catch(() => null)
    if (!acq) return { success: true, note: 'no_record_or_already_activated' }

    await db.collection('acquisition_metrics').doc(acq._id).update({
      data: { activated: true, activatedAt: ts },
    })
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// markPaid — 标记付费 + 更新 LTV
// ═══════════════════════════

async function markPaid(db, openid, amount) {
  const ts = now()
  try {
    const acq = await db.collection('acquisition_metrics')
      .where({ openid })
      .limit(1).get().then(r => r.data[0]).catch(() => null)
    if (!acq) return { success: true, note: 'no_acq_record' }

    const newLtv = (acq.ltv || 0) + amount
    await db.collection('acquisition_metrics').doc(acq._id).update({
      data: { paid: true, ltv: newLtv, lastPaidAt: ts },
    })
    return { success: true, ltv: newLtv }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getCAC — CAC 计算
// ═══════════════════════════

async function getCAC(db) {
  const ts = now()
  const results = {}

  try {
    const all = await db.collection('acquisition_metrics').get().catch(() => ({ data: [] }))
    const sourceMap = {}
    all.data.forEach(a => {
      const s = a.source || 'organic'
      if (!sourceMap[s]) sourceMap[s] = { count: 0, totalCost: 0 }
      sourceMap[s].count++
      sourceMap[s].totalCost += (a.cost || 0)
    })

    for (const [source, data] of Object.entries(sourceMap)) {
      const cac = data.count > 0
        ? Math.round((data.totalCost / data.count) * 100) / 100
        : 0
      results[source] = {
        acquired: data.count,
        totalCost: data.totalCost,
        cac,
        target: CAC_TARGETS[source] || CAC_TARGETS.default,
        status: cac <= (CAC_TARGETS[source] || CAC_TARGETS.default) ? 'within_target' : 'over_budget',
      }
    }

    return { cacBySource: results, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getActivationRate — 激活率
// ═══════════════════════════

async function getActivationRate(db) {
  const ts = now()
  try {
    const all = await db.collection('acquisition_metrics').get().catch(() => ({ data: [] }))
    const sourceMap = {}

    all.data.forEach(a => {
      const s = a.source || 'organic'
      if (!sourceMap[s]) sourceMap[s] = { acquired: 0, activated: 0 }
      sourceMap[s].acquired++
      if (a.activated) sourceMap[s].activated++
    })

    const bySource = {}
    for (const [source, d] of Object.entries(sourceMap)) {
      bySource[source] = {
        acquired: d.acquired,
        activated: d.activated,
        activationRate: d.acquired > 0 ? Math.round((d.activated / d.acquired) * 10000) / 100 : 0,
      }
    }

    return { activationBySource: bySource, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getPaidConversionRate — 付费转化率
// ═══════════════════════════

async function getPaidConversionRate(db) {
  const ts = now()
  try {
    const all = await db.collection('acquisition_metrics').get().catch(() => ({ data: [] }))
    const sourceMap = {}

    all.data.forEach(a => {
      const s = a.source || 'organic'
      if (!sourceMap[s]) sourceMap[s] = { acquired: 0, paid: 0 }
      sourceMap[s].acquired++
      if (a.paid) sourceMap[s].paid++
    })

    const bySource = {}
    for (const [source, d] of Object.entries(sourceMap)) {
      bySource[source] = {
        acquired: d.acquired,
        paid: d.paid,
        paidConversionRate: d.acquired > 0 ? Math.round((d.paid / d.acquired) * 10000) / 100 : 0,
      }
    }

    return { paidConversionBySource: bySource, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getLTVBySource — LTV 按来源
// ═══════════════════════════

async function getLTVBySource(db) {
  const ts = now()
  try {
    const all = await db.collection('acquisition_metrics').get().catch(() => ({ data: [] }))
    const sourceMap = {}

    all.data.forEach(a => {
      const s = a.source || 'organic'
      if (!sourceMap[s]) sourceMap[s] = { users: 0, totalLtv: 0, paidUsers: 0 }
      sourceMap[s].users++
      sourceMap[s].totalLtv += (a.ltv || 0)
      if (a.paid) sourceMap[s].paidUsers++
    })

    const bySource = {}
    for (const [source, d] of Object.entries(sourceMap)) {
      const avgLtv = d.users > 0 ? Math.round((d.totalLtv / d.users) * 100) / 100 : 0
      const cac = CAC_TARGETS[source] || CAC_TARGETS.default
      bySource[source] = {
        users: d.users,
        paidUsers: d.paidUsers,
        averageLtv: avgLtv,
        ltvCacRatio: cac > 0 ? Math.round((avgLtv / cac) * 100) / 100 : (avgLtv > 0 ? 999 : 0),
        health: avgLtv / Math.max(cac, 1) > HEALTH_RATIO ? 'healthy' : avgLtv / Math.max(cac, 1) > 2 ? 'ok' : 'weak',
      }
    }

    // 写入 ltv_by_source
    try {
      const today = _todayKey(ts)
      await db.collection('ltv_by_source').add({
        data: { date: today, ...bySource, createdAt: ts },
      }).catch(() => {})
    } catch (_) {}

    return { ltvBySource: bySource, target: LTV_TARGET, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getContentROI — 内容 ROI 计算
// ═══════════════════════════

async function getContentROI(db) {
  const ts = now()
  try {
    const all = await db.collection('acquisition_metrics')
      .where({ contentId: db.command.neq(null) })
      .get().catch(() => ({ data: [] }))

    const contentMap = {}
    all.data.forEach(a => {
      const cid = a.contentId
      if (!cid) return
      if (!contentMap[cid]) contentMap[cid] = { users: 0, totalLtv: 0, cost: 0, source: a.source }
      contentMap[cid].users++
      contentMap[cid].totalLtv += (a.ltv || 0)
      contentMap[cid].cost += (a.cost || 0)
    })

    const contentROI = Object.entries(contentMap).map(([cid, d]) => ({
      contentId: cid,
      source: d.source,
      users: d.users,
      totalLtv: d.totalLtv,
      cost: d.cost,
      roi: d.cost > 0 ? Math.round((d.totalLtv / d.cost) * 100) / 100 : (d.totalLtv > 0 ? 999 : 0),
      roiLabel: d.totalLtv > 0 && d.cost === 0 ? '🔥 零成本' : d.totalLtv / Math.max(d.cost, 1) > 10 ? '💎 超高回报' : d.totalLtv / Math.max(d.cost, 1) > 3 ? '✅ 正回报' : '⚠️ 需优化',
    })).sort((a, b) => b.roi - a.roi)

    // 写入 content_roi
    try {
      const today = _todayKey(ts)
      const exist = await db.collection('content_roi').where({ date: today }).limit(1).get()
      if (exist.data.length > 0) {
        await db.collection('content_roi').doc(exist.data[0]._id).update({
          data: { contentROI, updatedAt: ts },
        })
      } else {
        await db.collection('content_roi').add({ data: { date: today, contentROI, createdAt: ts } })
      }
    } catch (_) {}

    return { contentROI, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getHighValueSegments — 高价值人群发现
// ═══════════════════════════

async function getHighValueSegments(db) {
  const ts = now()
  try {
    const all = await db.collection('acquisition_metrics').get().catch(() => ({ data: [] }))

    // 按 source × content 组合分析
    const segMap = {}
    all.data.forEach(a => {
      const key = `${a.source || 'unknown'}_${a.contentId ? 'content' : 'general'}`
      if (!segMap[key]) segMap[key] = { users: 0, paid: 0, totalLtv: 0, source: a.source }
      segMap[key].users++
      segMap[key].totalLtv += (a.ltv || 0)
      if (a.paid) segMap[key].paid++
    })

    const segments = Object.entries(segMap).map(([key, d]) => ({
      key,
      source: d.source,
      users: d.users,
      paid: d.paid,
      avgLtv: d.users > 0 ? Math.round((d.totalLtv / d.users) * 100) / 100 : 0,
      paidRate: d.users > 0 ? Math.round((d.paid / d.users) * 10000) / 100 : 0,
      score: d.users > 0 ? Math.round((d.totalLtv / d.users) * (d.paid / Math.max(d.users, 1))) * 100 : 0,
    })).sort((a, b) => b.avgLtv - a.avgLtv)

    return {
      bestSegment: segments.length > 0 ? segments[0].key : null,
      bestSource: segments.length > 0 ? segments.filter(s => s.avgLtv > 0).sort((a,b) => b.avgLtv - a.avgLtv)[0]?.source : null,
      segments,
      insight: _generateInsight(segments),
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getBudgetOptimizer — 投放建议
// ═══════════════════════════

async function getBudgetOptimizer(db) {
  const ts = now()
  try {
    const ltvData = await getLTVBySource(db)
    const cacData = await getCAC(db)
    const convData = await getPaidConversionRate(db)

    const recommendations = []
    const allSources = Object.keys(ltvData.ltvBySource || {})

    for (const source of allSources) {
      const ltv = ltvData.ltvBySource[source]
      const cac = cacData.cacBySource[source]
      const conv = convData.paidConversionBySource[source]

      const ratio = ltv?.ltvCacRatio || 0
      const paidRate = conv?.paidConversionRate || 0

      if (ratio > 5 && paidRate > 5) {
        recommendations.push({ source, action: 'increase', reason: `LTV/CAC=${ratio}, 付费率=${paidRate}% — 高价值渠道`, confidence: 'high' })
      } else if (ratio > 3 && paidRate > 3) {
        recommendations.push({ source, action: 'maintain', reason: `LTV/CAC=${ratio} — 持续投入`, confidence: 'medium' })
      } else if (ratio < 2 && paidRate < 2) {
        recommendations.push({ source, action: 'reduce', reason: `LTV/CAC=${ratio}, 付费率=${paidRate}% — 低效渠道`, confidence: 'high' })
      } else if (ratio < 1) {
        recommendations.push({ source, action: 'pause', reason: `LTV/CAC=${ratio} — 亏损渠道`, confidence: 'high' })
      } else {
        recommendations.push({ source, action: 'optimize', reason: `LTV/CAC=${ratio} — 需要优化转化`, confidence: 'low' })
      }
    }

    // 总结
    const increases = recommendations.filter(r => r.action === 'increase').map(r => r.source)
    const reduces = recommendations.filter(r => r.action === 'reduce' || r.action === 'pause').map(r => r.source)

    return {
      summary: increases.length > 0
        ? `建议增加 ${increases.join('、')} 投放；减少 ${reduces.length > 0 ? reduces.join('、') : '无'} 投入`
        : '当前数据不足，继续收集',
      recommendations,
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getAcquisitionSummary — 获客总览
// ═══════════════════════════

async function getAcquisitionSummary(db) {
  const ts = now()
  const today = _todayKey(ts)

  try {
    const all = await db.collection('acquisition_metrics').get().catch(() => ({ data: [] }))
    const todayAcq = all.data.filter(a => _todayKey(a.createdAt) === today)

    // 今日新增
    const sources = {}
    todayAcq.forEach(a => {
      const s = a.source || 'organic'
      sources[s] = (sources[s] || 0) + 1
    })

    const totalAcquired = all.data.length
    const totalActivated = all.data.filter(a => a.activated).length
    const totalPaid = all.data.filter(a => a.paid).length
    const totalLtv = all.data.reduce((s, a) => s + (a.ltv || 0), 0)
    const totalCost = all.data.reduce((s, a) => s + (a.cost || 0), 0)

    return {
      date: today,
      todayNew: todayAcq.length,
      todayBySource: sources,
      totalAcquired,
      totalActivated,
      totalPaid,
      overallActivationRate: totalAcquired > 0 ? Math.round((totalActivated / totalAcquired) * 10000) / 100 : 0,
      overallPaidRate: totalAcquired > 0 ? Math.round((totalPaid / totalAcquired) * 10000) / 100 : 0,
      averageLtv: totalAcquired > 0 ? Math.round((totalLtv / totalAcquired) * 100) / 100 : 0,
      totalCost,
      overallCAC: totalAcquired > 0 ? Math.round((totalCost / totalAcquired) * 100) / 100 : 0,
      ltvCacRatio: totalCost > 0 ? Math.round((totalLtv / Math.max(totalCost, 1)) * 100) / 100 : 0,
      healthStatus: (totalLtv / Math.max(totalCost, 1)) > HEALTH_RATIO ? 'healthy' : 'needs_improvement',
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _generateInsight(segments) {
  if (segments.length === 0) return '数据不足'

  const best = segments[0]
  const worst = segments[segments.length - 1]

  let insight = `最高价值来源: ${best.source}(avgLtv=${best.avgLtv})。`
  if (worst.avgLtv < best.avgLtv / 3) {
    insight += ` ${worst.source} 渠道用户 LTV 显著偏低，建议减少投入。`
  }
  return insight
}

module.exports = {
  ACQUISITION_SOURCES,
  CAC_TARGETS,
  LTV_TARGET,
  HEALTH_RATIO,
  recordAcquisition,
  markActivated,
  markPaid,
  getCAC,
  getActivationRate,
  getPaidConversionRate,
  getLTVBySource,
  getContentROI,
  getHighValueSegments,
  getBudgetOptimizer,
  getAcquisitionSummary,
}
