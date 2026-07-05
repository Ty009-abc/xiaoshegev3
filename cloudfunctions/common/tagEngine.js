/**
 * tagEngine.js — 用户标签引擎（第六册 Part 4）
 *
 * 标签体系：
 *   兴趣标签: casino / ai / wealth
 *   价值标签: low_value / high_value
 *   付费标签: free / report / vip / consult
 *   行为标签: high_engagement / high_churn
 *
 * 能力：
 *   1. 自动打标签（规则引擎）
 *   2. 手动打标签
 *   3. 按标签查询
 *   4. 标签统计
 */
const now = () => Date.now()

// ── 标签体系 ──
const TAG_CATEGORIES = {
  interest: {
    label: '兴趣标签',
    values: ['casino', 'ai', 'wealth', 'cognition', 'growth'],
  },
  value: {
    label: '价值标签',
    values: ['low_value', 'medium_value', 'high_value'],
  },
  payment: {
    label: '付费标签',
    values: ['free', 'report', 'vip', 'consult'],
  },
  behavior: {
    label: '行为标签',
    values: ['high_engagement', 'high_churn', 'active_challenger', 'lurker', 'sharer', 'inviter'],
  },
}

// ── 自动打标签规则 ──
const AUTO_TAG_RULES = [
  // 兴趣标签
  {
    name: 'casino_interest',
    condition: (profile) => (profile.casinoTopics || 0) > 3,
    tag: 'casino',
    category: 'interest',
  },
  {
    name: 'ai_interest',
    condition: (profile) => (profile.aiTopics || 0) > 3 || (profile.aiChats || 0) > 2,
    tag: 'ai',
    category: 'interest',
  },
  {
    name: 'wealth_interest',
    condition: (profile) => (profile.wealthTopics || 0) > 2,
    tag: 'wealth',
    category: 'interest',
  },
  {
    name: 'cognition_growth',
    condition: (profile) => (profile.cv || 0) > 100,
    tag: 'growth',
    category: 'interest',
  },
  // 价值标签
  {
    name: 'high_value',
    condition: (profile) => (profile.cv || 0) > 200 || (profile.totalPaid || 0) > 0,
    tag: 'high_value',
    category: 'value',
  },
  {
    name: 'medium_value',
    condition: (profile) => (profile.cv || 0) > 80 && (profile.cv || 0) <= 200 && (profile.totalPaid || 0) === 0,
    tag: 'medium_value',
    category: 'value',
  },
  {
    name: 'low_value',
    condition: (profile) => (profile.cv || 0) <= 80 && (profile.totalPaid || 0) === 0,
    tag: 'low_value',
    category: 'value',
  },
  // 付费标签
  {
    name: 'consult_payment',
    condition: (profile) => (profile.segment || '') === 'consult' || (profile.purchasedConsult || false),
    tag: 'consult',
    category: 'payment',
  },
  {
    name: 'vip_payment',
    condition: (profile) => (profile.segment || '') === 'vip' || (profile.membershipType || '') === 'yearly' || (profile.membershipType || '') === 'quarterly',
    tag: 'vip',
    category: 'payment',
  },
  {
    name: 'report_payment',
    condition: (profile) => (profile.segment || '') === 'report' || (profile.hasReport || false),
    tag: 'report',
    category: 'payment',
  },
  {
    name: 'free_user',
    condition: (profile) => !profile.hasReport && !profile.membershipType,
    tag: 'free',
    category: 'payment',
  },
  // 行为标签
  {
    name: 'high_engagement',
    condition: (profile) => (profile.streakDays || 0) >= 7 && (profile.dailyActiveMinutes || 0) > 5,
    tag: 'high_engagement',
    category: 'behavior',
  },
  {
    name: 'high_churn',
    condition: (profile) => {
      const daysSinceLastActive = profile.daysSinceLastActive || 999
      return daysSinceLastActive > 14 && (profile.cv || 0) < 100
    },
    tag: 'high_churn',
    category: 'behavior',
  },
  {
    name: 'sharer',
    condition: (profile) => (profile.totalShares || 0) > 3,
    tag: 'sharer',
    category: 'behavior',
  },
  {
    name: 'inviter',
    condition: (profile) => (profile.totalInvites || 0) > 1,
    tag: 'inviter',
    category: 'behavior',
  },
  {
    name: 'active_challenger',
    condition: (profile) => (profile.challengesCompleted || 0) > 5,
    tag: 'active_challenger',
    category: 'behavior',
  },
]

// ═══════════════════════════
// autoTag — 自动打标签（规则引擎）
// ═══════════════════════════

async function autoTag(db, openid, profile) {
  const ts = now()

  try {
    // 收集命中的标签
    const matchedTags = []
    for (const rule of AUTO_TAG_RULES) {
      try {
        if (rule.condition(profile)) {
          matchedTags.push(rule.tag)
        }
      } catch (_) {}
    }

    if (matchedTags.length === 0) return { success: true, tags: [], note: 'no_tags_matched' }

    // 更新 crm_contacts
    try {
      const existing = await db.collection('crm_contacts')
        .where({ openid })
        .limit(1)
        .get()
        .catch(() => ({ data: [] }))

      if (existing.data.length > 0) {
        const doc = existing.data[0]
        const merged = [...new Set([...(doc.tags || []), ...matchedTags])]
        await db.collection('crm_contacts').doc(doc._id).update({
          data: { tags: merged, updatedAt: ts },
        })
      } else {
        // 自动创建 CRM 记录
        const crmEngine = require('./crmEngine.js')
        await crmEngine.upsertContact(db, {
          openid,
          segment: profile.segment || 'free',
          source: 'auto_tag',
          tags: matchedTags,
        })
      }
    } catch (_) {}

    return { success: true, tags: matchedTags, count: matchedTags.length }
  } catch (err) {
    console.error('[tagEngine] autoTag 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// manualTag — 手动打标签
// ═══════════════════════════

async function manualTag(db, openid, { addTags, removeTags }) {
  const ts = now()
  try {
    const existing = await db.collection('crm_contacts')
      .where({ openid })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    let currentTags = []
    if (existing.data.length > 0) {
      currentTags = existing.data[0].tags || []
    }

    // 添加
    if (addTags && addTags.length > 0) {
      currentTags = [...new Set([...currentTags, ...addTags])]
    }
    // 移除
    if (removeTags && removeTags.length > 0) {
      currentTags = currentTags.filter(t => !removeTags.includes(t))
    }

    if (existing.data.length > 0) {
      await db.collection('crm_contacts').doc(existing.data[0]._id).update({
        data: { tags: currentTags, updatedAt: ts },
      })
    } else {
      await db.collection('crm_contacts').add({
        data: { openid, tags: currentTags, segment: 'free', source: 'manual_tag', lastContactAt: ts, contactStatus: 'cold', createdAt: ts },
      })
    }

    return { success: true, tags: currentTags }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getContactsByTag — 按标签查询
// ═══════════════════════════

async function getContactsByTag(db, tag, limit = 50) {
  try {
    const list = await db.collection('crm_contacts')
      .where({ tags: db.command.all([tag]) })
      .limit(limit)
      .get()
      .catch(() => ({ data: [] }))

    return list.data.map(c => ({
      openid: c.openid,
      segment: c.segment,
      tags: c.tags,
      status: c.contactStatus,
    }))
  } catch (_) {
    return []
  }
}

// ═══════════════════════════
// getTagStats — 标签统计
// ═══════════════════════════

async function getTagStats(db) {
  try {
    const all = await db.collection('crm_contacts').get().catch(() => ({ data: [] }))
    const tagCounts = {}
    let totalTagged = 0

    all.data.forEach(c => {
      if (c.tags && c.tags.length > 0) {
        totalTagged++
        c.tags.forEach(t => {
          tagCounts[t] = (tagCounts[t] || 0) + 1
        })
      }
    })

    const byCategory = {}
    for (const [cat, def] of Object.entries(TAG_CATEGORIES)) {
      byCategory[cat] = {}
      def.values.forEach(v => {
        byCategory[cat][v] = tagCounts[v] || 0
      })
    }

    return {
      totalContacts: all.data.length,
      totalTagged,
      tagRate: all.data.length > 0 ? Math.round((totalTagged / all.data.length) * 10000) / 100 : 0,
      tagCounts,
      byCategory,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getTagCategories — 获取标签体系
// ═══════════════════════════

function getTagCategories() {
  return TAG_CATEGORIES
}

module.exports = {
  TAG_CATEGORIES,
  AUTO_TAG_RULES,
  autoTag,
  manualTag,
  getContactsByTag,
  getTagStats,
  getTagCategories,
}
