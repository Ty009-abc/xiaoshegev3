/**
 * crmEngine.js — CRM 联系人引擎（第六册 Part 4）
 *
 * 能力：
 *   1. 创建/更新联系人
 *   2. 分层 (segment: free / report / vip / consult)
 *   3. 联系人状态 (cold / warm / hot / converted)
 *   4. 最近联系时间追踪
 *   5. 批量查询/导出
 */
const now = () => Date.now()

// ── 分层定义 ──
const SEGMENTS = {
  free:    { label: '普通流量',  tier: 0, description: '免费用户，未付费' },
  report:  { label: '付费用户',  tier: 1, description: '购买过报告' },
  vip:     { label: '高价值会员', tier: 2, description: '年卡/季卡用户' },
  consult: { label: 'Premium',   tier: 3, description: '咨询用户' },
}

// ── 联系人状态 ──
const STATUSES = {
  cold:      { label: '冷',   description: '未互动 > 30天', color: '#95a5a6' },
  warm:      { label: '温',   description: '近期有互动',     color: '#f39c12' },
  hot:       { label: '热',   description: '活跃互动中',     color: '#e74c3c' },
  converted: { label: '已成交', description: '已完成转化',     color: '#2ecc71' },
}

// ═══════════════════════════
// upsertContact — 创建/更新联系人
// ═══════════════════════════

async function upsertContact(db, { openid, segment, source, tags, extra }) {
  const ts = now()
  if (!openid) return { error: '缺少 openid' }

  try {
    const existing = await db.collection('crm_contacts')
      .where({ openid })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    const contactData = {
      segment: segment || 'free',
      source: source || 'mini_program',
      tags: tags || [],
      lastContactAt: ts,
      contactStatus: 'warm',
      updatedAt: ts,
      ...(extra || {}),
    }

    if (existing.data.length > 0) {
      const doc = existing.data[0]
      // 合并 tags（去重）
      const mergedTags = [...new Set([...(doc.tags || []), ...(tags || [])])]
      // segment 只升不降
      const currentTier = SEGMENTS[doc.segment]?.tier || 0
      const newTier = SEGMENTS[segment]?.tier || 0
      const finalSegment = newTier >= currentTier ? segment : doc.segment
      const autoStatus = _calcStatus(doc.lastContactAt, ts)

      await db.collection('crm_contacts').doc(doc._id).update({
        data: {
          segment: finalSegment,
          tags: mergedTags,
          lastContactAt: ts,
          contactStatus: autoStatus !== 'cold' ? autoStatus : 'warm', // 互动后升温
          updatedAt: ts,
          ...(extra || {}),
        },
      })
      return { success: true, _id: doc._id, updated: true, segment: finalSegment }
    } else {
      const result = await db.collection('crm_contacts').add({
        data: { openid, ...contactData, createdAt: ts },
      })
      return { success: true, _id: result._id, updated: false }
    }
  } catch (err) {
    console.error('[crmEngine] upsertContact 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getContact — 查询单个联系人
// ═══════════════════════════

async function getContact(db, openid) {
  try {
    const c = await db.collection('crm_contacts')
      .where({ openid })
      .limit(1)
      .get()
      .then(r => r.data[0])
      .catch(() => null)

    if (!c) return null

    return {
      ...c,
      segmentLabel: SEGMENTS[c.segment]?.label || '未知',
      statusLabel: STATUSES[c.contactStatus]?.label || '未知',
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getContactsBySegment — 按分层查询
// ═══════════════════════════

async function getContactsBySegment(db, segment, limit = 50) {
  try {
    const list = await db.collection('crm_contacts')
      .where({ segment })
      .orderBy('lastContactAt', 'desc')
      .limit(limit)
      .get()
      .catch(() => ({ data: [] }))

    return list.data.map(c => ({
      openid: c.openid,
      segment: c.segment,
      status: c.contactStatus,
      tags: c.tags || [],
      lastContactAt: c.lastContactAt,
    }))
  } catch (_) {
    return []
  }
}

// ═══════════════════════════
// getCRMStats — CRM 整体统计
// ═══════════════════════════

async function getCRMStats(db) {
  const ts = now()
  const ONE_DAY = 86400000

  try {
    const all = await db.collection('crm_contacts').get().catch(() => ({ data: [] }))
    const contacts = all.data

    const stats = {
      totalContacts: contacts.length,
      bySegment: {},
      byStatus: {},
      bySource: {},
      highValueDensity: 0, // vip + consult 占比
      avgDaysSinceContact: 0,
    }

    // 分层统计
    for (const seg of Object.keys(SEGMENTS)) {
      stats.bySegment[seg] = contacts.filter(c => c.segment === seg).length
    }

    // 状态统计
    for (const st of Object.keys(STATUSES)) {
      stats.byStatus[st] = contacts.filter(c => c.contactStatus === st).length
    }

    // 来源统计
    const sources = {}
    contacts.forEach(c => {
      const src = c.source || 'unknown'
      sources[src] = (sources[src] || 0) + 1
    })
    stats.bySource = sources

    // 高价值用户密度
    const highValue = contacts.filter(c => c.segment === 'vip' || c.segment === 'consult').length
    stats.highValueDensity = contacts.length > 0
      ? Math.round((highValue / contacts.length) * 10000) / 100
      : 0

    // 平均距上次联系时间
    const now_ = now()
    const totalDays = contacts.reduce((sum, c) => {
      return sum + Math.max(0, Math.floor((now_ - (c.lastContactAt || 0)) / ONE_DAY))
    }, 0)
    stats.avgDaysSinceContact = contacts.length > 0
      ? Math.round((totalDays / contacts.length) * 10) / 10
      : 0

    return { ...stats, analysedAt: ts }
  } catch (err) {
    console.error('[crmEngine] getCRMStats 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// updateContactStatus — 批量更新状态（定时任务）
// ═══════════════════════════

async function updateContactStatus(db) {
  const ts = now()
  const ONE_DAY = 86400000
  let updated = 0

  try {
    // cold: 超过30天未联系
    const coldList = await db.collection('crm_contacts')
      .where({ lastContactAt: db.command.lte(ts - 30 * ONE_DAY), contactStatus: db.command.neq('converted') })
      .limit(500)
      .get()
      .catch(() => ({ data: [] }))

    for (const c of coldList.data) {
      await db.collection('crm_contacts').doc(c._id).update({
        data: { contactStatus: 'cold', updatedAt: ts },
      }).catch(() => {})
      updated++
    }

    return { success: true, updated, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getHighValueContacts — 高价值线索
// ═══════════════════════════

async function getHighValueContacts(db, limit = 50) {
  try {
    const list = await db.collection('crm_contacts')
      .where({ segment: db.command.in(['vip', 'consult']), contactStatus: db.command.in(['warm', 'hot']) })
      .orderBy('lastContactAt', 'desc')
      .limit(limit)
      .get()
      .catch(() => ({ data: [] }))

    return list.data.map(c => ({
      openid: c.openid,
      segment: c.segment,
      status: c.contactStatus,
      tags: c.tags || [],
      lastContactAt: c.lastContactAt,
    }))
  } catch (_) {
    return []
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _calcStatus(lastContactAt, now_) {
  if (!lastContactAt) return 'warm'
  const days = Math.floor((now_ - lastContactAt) / 86400000)
  if (days > 30) return 'cold'
  if (days > 14) return 'warm'
  return 'hot'
}

module.exports = {
  SEGMENTS,
  STATUSES,
  upsertContact,
  getContact,
  getContactsBySegment,
  getCRMStats,
  updateContactStatus,
  getHighValueContacts,
}
