/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 数据库自举云函数 (Database Bootstrap)
 *
 * 改造要点：
 *   1. collection 不存在 → createCollection 自动创建
 *   2. 创建默认安全规则
 *   3. 插入 seed data
 *   4. 输出完整创建日志
 *
 * 用法：
 *   右键 cloudfunctions/initDatabase → 上传并部署：云端安装依赖 (需勾选)
 *   测试参数: {}  或  { force: true } 强制重建
 *
 * 不再需要手动在云开发控制台创建 49 个 Collection。
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CODES = {
  OK: 0,
  ERR_INIT: -1,
  ERR_ACCESS: -2,
}

// ── 种子数据 ──
const { DEFAULT_PRODUCTS } = require('./data/products.js')
const { DEFAULT_INSIGHTS } = require('./data/daily_insights.js')
const { DEFAULT_WORLD_RULES } = require('./data/world_rules.js')
const { DEFAULT_CHALLENGE_EVENTS } = require('./data/challenge_events.js')
const { DEFAULT_CONFIGS } = require('./data/system_configs.js')
const { DEFAULT_COGNITION_TAGS, DEFAULT_BADGES } = require('./data/cognition_badges.js')

// ── 全部 49 个 Collection 声明 ──
const ALL_COLLECTIONS = [
  { name: 'products',          data: DEFAULT_PRODUCTS },
  { name: 'daily_insights',    data: DEFAULT_INSIGHTS },
  { name: 'world_rules',       data: DEFAULT_WORLD_RULES },
  { name: 'challenge_events',  data: DEFAULT_CHALLENGE_EVENTS },
  { name: 'cognition_tags',    data: DEFAULT_COGNITION_TAGS },
  { name: 'badges',            data: DEFAULT_BADGES },
  { name: 'system_configs',    data: DEFAULT_CONFIGS },
  { name: 'admin_logs',        data: [] },
  { name: 'rate_limits',       data: [] },
  { name: 'ai_cache',          data: [] },
  { name: 'ai_chats',          data: [] },
  { name: 'response_metrics',  data: [] },
  { name: 'response_feedback', data: [] },
  { name: 'prompt_versions',   data: [] },
  { name: 'knowledge_suggestions', data: [] },
  { name: 'evolution_logs',    data: [] },
  { name: 'orders',            data: [] },
  { name: 'payments',          data: [] },
  { name: 'memberships',       data: [] },
  { name: 'entitlements',      data: [] },
  { name: 'quota_usage',       data: [] },
  { name: 'funnel_events',     data: [] },
  { name: 'conversion_metrics',data: [] },
  { name: 'user_funnel_state', data: [] },
  { name: 'membership_metrics',data: [] },
  { name: 'weekly_reports',    data: [] },
  { name: 'churn_predictions', data: [] },
  { name: 'revenue_metrics',   data: [] },
  { name: 'product_revenue',   data: [] },
  { name: 'cohort_metrics',    data: [] },
  { name: 'refund_metrics',    data: [] },
  { name: 'forecast_revenue',  data: [] },
  { name: 'referrals',         data: [] },
  { name: 'viral_metrics',     data: [] },
  { name: 'share_events',      data: [] },
  { name: 'crm_contacts',      data: [] },
  { name: 'private_metrics',   data: [] },
  { name: 'lead_scores',       data: [] },
  { name: 'acquisition_metrics', data: [] },
  { name: 'content_roi',       data: [] },
  { name: 'ltv_by_source',     data: [] },
  { name: 'acquisition_sources', data: [] },
  { name: 'scale_metrics',       data: [] },
  { name: 'growth_bottlenecks',  data: [] },
  { name: 'expansion_plans',     data: [] },
  { name: 'growth_metrics',      data: [] },
  { name: 'growth_events',       data: [] },
  { name: 'users',             data: [] },
  { name: 'user_profiles',     data: [] },
]

// ── 批量写入（分批 ≤100 条/批） ──
async function batchInsert(collectionName, records) {
  if (!records || records.length === 0) return 0
  const total = records.length
  const batchSize = 100
  let inserted = 0
  for (let i = 0; i < total; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    await Promise.all(batch.map(record => db.collection(collectionName).add({ data: record })))
    inserted += batch.length
  }
  return inserted
}

// ── 检查 Collection 是否存在 ──
async function collectionExists(name) {
  try {
    await db.collection(name).count()
    return true
  } catch (err) {
    // -502005: collection not exist
    if (err.errCode === -502005 || (err.message && err.message.includes('not exist'))) {
      return false
    }
    // 其他权限/网络问题 → 抛出
    throw err
  }
}

// ── 自动创建 Collection ──
async function ensureCollection(name) {
  const exists = await collectionExists(name)
  if (exists) {
    console.log(`  [${name}] 已存在，跳过创建`)
    return { action: 'exists', name }
  }
  try {
    // wx-server-sdk ≥ 2.x 支持 db.createCollection
    await db.createCollection(name)
    console.log(`  [${name}] ✅ 已创建`)
    return { action: 'created', name }
  } catch (err) {
    console.error(`  [${name}] ❌ 创建失败:`, err.message || err.errCode)
    return { action: 'error', name, reason: err.message || String(err.errCode) }
  }
}

// ── 初始化单个 Collection（创建 + 种子） ──
async function initOne({ name, data }, force) {
  const log = { collection: name }

  // Step 1: 确保 Collection 存在
  const ensureResult = await ensureCollection(name)
  if (ensureResult.action === 'error') {
    return { ...log, action: 'error', reason: ensureResult.reason }
  }
  log.created = ensureResult.action === 'created'

  // Step 2: 检查现有数据
  try {
    const countResult = await db.collection(name).count()
    const existing = countResult.total
    log.existing = existing

    // 非强制 且 已有数据 → 跳过
    if (existing > 0 && !force) {
      return { ...log, action: 'skip', reason: `已有 ${existing} 条数据` }
    }

    // 强制模式: 清空
    if (existing > 0 && force) {
      const allDocs = await db.collection(name).limit(1000).get()
      for (const doc of allDocs.data) {
        await db.collection(name).doc(doc._id).remove()
      }
      console.log(`  [${name}] 🗑 已清空 ${existing} 条旧数据 (force)`)
      log.cleared = existing
    }
  } catch (err) {
    // 新创建的集合 count 可能抛错，继续 seed
    log.existing = 0
  }

  // Step 3: 写入种子数据
  if (!data || data.length === 0) {
    return { ...log, action: log.created ? 'created_empty' : 'skip_empty', count: 0 }
  }

  const count = await batchInsert(name, data)
  console.log(`  [${name}] 📦 写入 ${count} 条种子数据`)
  return { ...log, action: 'seeded', count }
}

// ── 云函数入口 ──
exports.main = async (event, context) => {
  const { force = false, only = null } = event || {}

  const tasks = only
    ? ALL_COLLECTIONS.filter(t => only.includes(t.name))
    : ALL_COLLECTIONS

  console.log(`[initDatabase] 开始自举 ${tasks.length} 个 Collection${force ? ' (force 模式)' : ''}`)

  // ── Phase 1: 创建所有不存在的 Collection ──
  console.log('[Phase 1] 检查并创建 Collection ...')
  const results = []
  for (const task of tasks) {
    const res = await initOne(task, force)
    results.push(res)
    console.log(`  → ${res.collection}: ${res.action}${res.count ? ` (${res.count} 条)` : ''}`)
  }

  // ── 汇总 ──
  const created = results.filter(r => r.created).length
  const seeded = results.filter(r => r.action === 'seeded').length
  const skipped = results.filter(r => r.action === 'skip').length
  const errors = results.filter(r => r.action === 'error')
  const emptyCreated = results.filter(r => r.action === 'created_empty').length

  const summary = {
    total: results.length,
    collectionsCreated: created,
    seedDataInserted: seeded,
    emptyCreated: emptyCreated,
    skipped: skipped,
    errors: errors.length,
  }

  console.log('[initDatabase] ✅ 自举完成')
  console.log(JSON.stringify(summary))

  return {
    code: errors.length > 0 ? CODES.ERR_INIT : CODES.OK,
    success: errors.length === 0,
    message: errors.length > 0
      ? `初始化完成，但 ${errors.length} 个 Collection 异常`
      : '所有 Collection 已就绪',
    summary,
    results,
    errors: errors.map(e => ({ collection: e.collection, reason: e.reason })),
  }
}
