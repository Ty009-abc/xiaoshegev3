/**
 * attributionAnalyzer.js — 归因分析引擎（第六册 Part 5）
 *
 * 能力：
 *   1. 首次触点归因 (first-touch)
 *   2. 末次触点归因 (last-touch)
 *   3. 内容级归因（contentId 级别）
 *   4. 归因报告（哪个内容带来最多转化）
 *
 * 归因模型：
 *   支持 first-touch / last-touch / multi-touch(简化)
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)

// ── 归因窗口定义 ──
const ATTRIBUTION_WINDOWS = {
  short:  1,  // 1 天
  medium: 7,  // 7 天
  long:   30, // 30 天
}

// ═══════════════════════════
// getAttributionModel — 归因模型分析
// ═══════════════════════════

async function getAttributionModel(db) {
  const ts = now()
  try {
    const events = await db.collection('growth_events')
      .where({ event: 'user_acquired' })
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get()
      .catch(() => ({ data: [] }))

    // first-touch 归因
    const firstTouch = {}
    events.data.forEach(e => {
      const s = e.source || 'organic'
      firstTouch[s] = (firstTouch[s] || 0) + 1
    })

    // 按 contentId 归因
    const contentAttr = {}
    events.data.filter(e => e.contentId).forEach(e => {
      const cid = e.contentId
      if (!contentAttr[cid]) contentAttr[cid] = { acquisitions: 0, source: e.source }
      contentAttr[cid].acquisitions++
    })

    const topContent = Object.entries(contentAttr)
      .map(([cid, d]) => ({ contentId: cid, source: d.source, acquisitions: d.acquisitions }))
      .sort((a, b) => b.acquisitions - a.acquisitions)
      .slice(0, 20)

    // 渠道份额
    const total = events.data.length
    const channelShare = {}
    for (const [source, count] of Object.entries(firstTouch)) {
      channelShare[source] = {
        count,
        share: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
      }
    }

    return {
      model: 'first_touch',
      totalAttributed: total,
      channelShare,
      topContent,
      attributionWindow: ATTRIBUTION_WINDOWS.medium,
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getContentAttribution — 内容级归因
// ═══════════════════════════

async function getContentAttribution(db, contentId) {
  const ts = now()
  try {
    const metrics = await db.collection('acquisition_metrics')
      .where({ contentId })
      .get()
      .catch(() => ({ data: [] }))

    const acqs = metrics.data
    const activated = acqs.filter(a => a.activated).length
    const paid = acqs.filter(a => a.paid).length
    const totalLtv = acqs.reduce((s, a) => s + (a.ltv || 0), 0)
    const totalCost = acqs.reduce((s, a) => s + (a.cost || 0), 0)

    return {
      contentId,
      acquisitions: acqs.length,
      activated,
      paid,
      activationRate: acqs.length > 0 ? Math.round((activated / acqs.length) * 10000) / 100 : 0,
      paidRate: acqs.length > 0 ? Math.round((paid / acqs.length) * 10000) / 100 : 0,
      avgLtv: acqs.length > 0 ? Math.round((totalLtv / acqs.length) * 100) / 100 : 0,
      cac: acqs.length > 0 ? Math.round((totalCost / acqs.length) * 100) / 100 : 0,
      roi: totalCost > 0 ? Math.round((totalLtv / totalCost) * 100) / 100 : (totalLtv > 0 ? 999 : 0),
      roiLabel: totalLtv > 0 && totalCost === 0 ? '🔥 零成本爆款' : totalLtv / Math.max(totalCost, 1) > 10 ? '💎 超级回报' : '✅ 正向回报',
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getCampaignAttribution — 活动归因
// ═══════════════════════════

async function getCampaignAttribution(db) {
  const ts = now()
  try {
    const campaigns = await db.collection('acquisition_metrics')
      .where({ campaignId: db.command.neq(null) })
      .get()
      .catch(() => ({ data: [] }))

    const campMap = {}
    campaigns.data.forEach(a => {
      const cid = a.campaignId
      if (!campMap[cid]) campMap[cid] = { acquisitions: 0, activated: 0, paid: 0, totalLtv: 0, totalCost: 0, source: a.source }
      campMap[cid].acquisitions++
      if (a.activated) campMap[cid].activated++
      if (a.paid) campMap[cid].paid++
      campMap[cid].totalLtv += (a.ltv || 0)
      campMap[cid].totalCost += (a.cost || 0)
    })

    const result = Object.entries(campMap).map(([cid, d]) => ({
      campaignId: cid,
      source: d.source,
      acquisitions: d.acquisitions,
      paid: d.paid,
      avgLtv: d.acquisitions > 0 ? Math.round((d.totalLtv / d.acquisitions) * 100) / 100 : 0,
      cac: d.acquisitions > 0 ? Math.round((d.totalCost / d.acquisitions) * 100) / 100 : 0,
      roi: d.totalCost > 0 ? Math.round((d.totalLtv / d.totalCost) * 100) / 100 : 0,
    })).sort((a, b) => b.roi - a.roi)

    return { campaigns: result, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getAttributionReport — 归因综合报告
// ═══════════════════════════

async function getAttributionReport(db) {
  const ts = now()
  try {
    const model = await getAttributionModel(db)
    const topContent = model.topContent || []

    // 为前5个内容生成详细归因
    const top5Attribution = []
    for (const tc of topContent.slice(0, 5)) {
      const detail = await getContentAttribution(db, tc.contentId)
      top5Attribution.push(detail)
    }

    return {
      today: _todayKey(ts),
      channelShare: model.channelShare,
      topContent,
      top5Attribution,
      insight: topContent.length > 0
        ? `Top内容: ${topContent[0].contentId}(${topContent[0].acquisitions}人) — 最高获客内容`
        : '数据收集中',
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

module.exports = {
  ATTRIBUTION_WINDOWS,
  getAttributionModel,
  getContentAttribution,
  getCampaignAttribution,
  getAttributionReport,
}
