/**
 * cloudfunctions/common/memoryEngine.js — 记忆引擎（统一入口）
 *
 * 四册 Part 4：Memory System
 *
 * 惰性加载 DB — formatMemoryForPrompt 是纯函数，可在本地测试
 */

const { sanitizeMemoryData } = require('./memoryPolicy.js')
const { extractFromMessage } = require('./memoryExtractor.js')
const { compressConversation: doCompress, MAX_RECENT_MESSAGES } = require('./memoryCompressor.js')

// ═══════════════════════
// DB 惰性加载
// ═══════════════════════
let _cloud, _db, _

function _ensureDB() {
  if (_db) return
  _cloud = require('wx-server-sdk')
  _cloud.init({ env: _cloud.DYNAMIC_CURRENT_ENV })
  _db = _cloud.database()
  _ = _db.command
}

function db() { _ensureDB(); return _db }

// 注入 prompt 的长期记忆预算（约 600 tokens）与单条上限
const MAX_MEMORY_PROMPT_CHARS = 600
const MAX_MEMORY_ITEM_CHARS = 60

// 数组字段大小上限（防无界增长）
const ARRAY_CAPS = { coreGoals: 20, riskFlags: 20, stableTraits: 20 }

// 数组去重合并（dedup）：保留已有在前，追加新且不重复的项，并裁到上限
function _dedupeArray (existing, incoming) {
  const seen = new Set()
  const out = []
  for (const v of [].concat(existing || [], incoming || [])) {
    if (v === undefined || v === null || v === '') continue
    const key = typeof v === 'string' ? v.trim() : JSON.stringify(v)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  const cap = arguments.length > 2 ? arguments[2] : null
  return cap ? out.slice(-cap) : out
}

// ═══════════════════════
// getUserMemory
// ═══════════════════════
async function getUserMemory(openid) {
  if (!openid) throw new Error('openid required')
  const [um, cm, bm, vm, gm] = await Promise.all([
    _getOrCreate('user_memory', openid),
    _getOrCreateCognition(openid),
    _getOrCreate('behavior_memory', openid),
    _getOrCreate('conversation_memory', openid),
    _getOrCreate('growth_memory', openid),
  ])
  return { userMemory: um, cognitionMemory: cm, behaviorMemory: bm, conversationMemory: vm, growthMemory: gm }
}

async function _getOrCreate(collection, openid) {
  _ensureDB()
  const res = await _db.collection(collection).where({ openid }).get()
  if (res.data.length > 0) return res.data[0]
  const def = { openid, createdAt: Date.now(), updatedAt: Date.now() }
  const doc = await _db.collection(collection).add({ data: def })
  return { ...def, _id: doc._id }
}

async function _getOrCreateCognition(openid) {
  try {
    _ensureDB()
    const res = await _db.collection('user_profiles').where({ openid }).get()
    if (res.data.length > 0) {
      const d = res.data[0]
      return { openid, dimensions: {
        laborMindset: d.laborMindset || 0, probabilityMindset: d.probabilityMindset || 0,
        systemThinking: d.systemThinking || 0, leverageThinking: d.leverageThinking || 0,
        capitalThinking: d.capitalThinking || 0, riskAwareness: d.riskAwareness || 0,
        informationSensitivity: d.informationSensitivity || 0, longTermism: d.longTermism || 0,
        decisionStability: d.decisionStability || 0,
      }, history: [], updatedAt: Date.now() }
    }
  } catch (_) {}
  return _getOrCreate('cognition_memory', openid)
}

// ═══════════════════════
// updateUserMemory
// ═══════════════════════
async function updateUserMemory(openid, data) {
  if (!openid || !data) throw new Error('openid and data required')
  const cleaned = sanitizeMemoryData(data)
  const { collection = 'user_memory', ...updateData } = cleaned
  updateData.updatedAt = Date.now()
  _ensureDB()
  const res = await _db.collection(collection).where({ openid }).get()
  if (res.data.length > 0) {
    const existing = res.data[0]
    // 去重：数组字段合并去重 + 上限（不重复写入同一 durable memory）
    for (const k of Object.keys(ARRAY_CAPS)) {
      if (Array.isArray(updateData[k])) updateData[k] = _dedupeArray(existing[k], updateData[k], ARRAY_CAPS[k])
    }
    await _db.collection(collection).doc(existing._id).update({ data: updateData })
  } else {
    for (const k of Object.keys(ARRAY_CAPS)) {
      if (Array.isArray(updateData[k])) updateData[k] = _dedupeArray([], updateData[k], ARRAY_CAPS[k])
    }
    await _db.collection(collection).add({ data: { openid, ...updateData, createdAt: Date.now() } })
  }
  await _logOp(openid, 'update', { collection, fields: Object.keys(updateData) })
  return { code: 0, message: '更新成功' }
}

// ═══════════════════════
// appendConversation
// ═══════════════════════
async function appendConversation(openid, message) {
  if (!openid || !message) throw new Error('openid and message required')
  const conv = await _getOrCreate('conversation_memory', openid)
  const recent = [...(conv.recentMessages || []), {
    role: message.role || 'user',
    content: message.content || '',
    createdAt: message.createdAt || Date.now(),
  }]
  const summary = conv.longTermSummary || ''

  if (recent.length > MAX_RECENT_MESSAGES) {
    const { newRecent, newSummary, discarded } = doCompress(recent, summary)
    _ensureDB()
    await _db.collection('conversation_memory').doc(conv._id).update({ data: { recentMessages: newRecent, longTermSummary: newSummary, updatedAt: Date.now() } })
    await _logOp(openid, 'compress', { discarded, newRecentCount: newRecent.length })
    return { code: 0, message: `压缩完成，丢弃 ${discarded} 轮旧对话` }
  }

  _ensureDB()
  await _db.collection('conversation_memory').doc(conv._id).update({ data: { recentMessages: recent, updatedAt: Date.now() } })
  await _logOp(openid, 'append', { role: message.role, contentLength: (message.content || '').length, recentCount: recent.length })
  const ext = extractFromMessage(openid, message)
  if (ext?.memoryType) await _logOp(openid, 'extract', { memoryType: ext.memoryType, data: ext.data })
  return { code: 0, message: '追加成功', compressed: false, extracted: !!ext?.memoryType }
}

// ═══════════════════════
// compressConversation
// ═══════════════════════
async function compressConversation(openid) {
  const conv = await _getOrCreate('conversation_memory', openid)
  const recent = conv.recentMessages || []
  if (recent.length <= MAX_RECENT_MESSAGES) return { code: 0, message: '对话轮数未超过阈值，无需压缩', recentCount: recent.length }
  const { newRecent, newSummary, discarded } = doCompress(recent, conv.longTermSummary || '')
  _ensureDB()
  await _db.collection('conversation_memory').doc(conv._id).update({ data: { recentMessages: newRecent, longTermSummary: newSummary, updatedAt: Date.now() } })
  await _logOp(openid, 'manual_compress', { discarded, newRecentCount: newRecent.length })
  return { code: 0, message: `手动压缩完成，丢弃 ${discarded} 轮旧对话` }
}

// ═══════════════════════
// clearUserMemory
// ═══════════════════════
async function clearUserMemory(openid, collections = null) {
  const targets = collections || ['user_memory', 'conversation_memory', 'behavior_memory', 'growth_memory', 'cognition_memory']
  _ensureDB()
  const deleted = {}
  let total = 0
  for (const col of targets) {
    try {
      const r = await _db.collection(col).where({ openid }).remove()
      const n = (r && (r.stats ? r.stats.removed : r.removed)) || 0
      deleted[col] = n
      total += n
    } catch (e) {
      console.warn(`[Memory] 清除 ${col} 失败:`, e.message)
      deleted[col] = 0
    }
  }
  await _logOp(openid, 'clear_all', { collections: targets, deleted })
  return { code: 0, message: `已清除 ${targets.length} 个记忆集合`, data: { deleted, total } }
}

// ═══════════════════════
// getRelevantMemories — 长期记忆读取路径（自带读门控 + 预算 + 空回退）
// ═══════════════════════
/**
 * 返回当前 openid 的相关长期记忆条目（禁止跨用户）。
 *  - memoryEnabled=false → 确定性空数组（绝不注入）
 *  - 预算上限；异常/空 → 空回退（绝不抛出，绝不阻断 AI）
 * @param {object|string} dbOrOpenid  - db 实例（兼容）或直接 openid
 * @param {string} openidArg
 * @param {string} scene
 * @param {object} options           - { limit }
 * @returns {Promise<Array<{type,content,importance}>>}
 */
async function getRelevantMemories(dbOrOpenid, openidArg, scene, options = {}) {
  try {
    const openid = typeof dbOrOpenid === 'string' ? dbOrOpenid : openidArg
    if (!openid) return []
    const limit = options.limit || 10

    // 读门控：关闭 → 绝不读取 / 绝不注入
    const enabled = await isMemoryEnabled(openid)
    if (!enabled) return []

    const memory = await getUserMemory(openid)   // 仅当前 openid 的记忆域
    const items = []

    const um = memory.userMemory || {}
    for (const g of (um.coreGoals || [])) items.push({ type: 'goal', content: String(g), importance: 0.9 })
    for (const t of (um.stableTraits || [])) items.push({ type: 'trait', content: String(t), importance: 0.8 })
    for (const f of (um.riskFlags || [])) items.push({ type: 'risk', content: String(f), importance: 0.6 })

    const summary = memory.conversationMemory && memory.conversationMemory.longTermSummary
    if (summary) items.push({ type: 'summary', content: String(summary), importance: 0.7 })

    const miles = (memory.growthMemory && memory.growthMemory.milestones) || []
    for (const m of miles.slice(-3)) {
      if (m && m.title) items.push({ type: 'milestone', content: String(m.title), importance: 0.5 })
    }

    // 相关度排序 + 去重 + 预算截断
    items.sort((a, b) => b.importance - a.importance)
    const seen = new Set()
    const capped = []
    let budget = MAX_MEMORY_PROMPT_CHARS
    for (const it of items) {
      if (capped.length >= limit) break
      const text = String(it.content || '').slice(0, MAX_MEMORY_ITEM_CHARS).trim()
      if (!text || seen.has(text)) continue
      if (text.length > budget) break
      seen.add(text)
      budget -= text.length
      capped.push({ type: it.type, content: text, importance: it.importance })
    }
    return capped
  } catch (e) {
    console.warn('[Memory] getRelevantMemories 回退为空:', e && e.message)
    return []
  }
}

// ═══════════════════════
// updateBehaviorMemory
// ═══════════════════════
async function updateBehaviorMemory(openid, behaviorType, delta = 1) {
  const b = await _getOrCreate('behavior_memory', openid)
  const map = { dailyInsightRead: 'dailyInsightReadCount', challengeFinished: 'challengeFinishedCount', reportGenerated: 'reportGeneratedCount', payment: 'paymentCount', share: 'shareCount' }
  const field = map[behaviorType]
  if (!field) return { code: -1, message: `未知行为类型: ${behaviorType}` }
  _ensureDB()
  await _db.collection('behavior_memory').doc(b._id).update({ data: { [field]: _.inc(delta), lastActiveAt: Date.now(), updatedAt: Date.now() } })
  await _logOp(openid, 'behavior_update', { type: behaviorType, delta })
  return { code: 0, message: '行为统计更新成功' }
}

// ═══════════════════════
// recordGrowthEvent
// ═══════════════════════
async function recordGrowthEvent(openid, event) {
  const g = await _getOrCreate('growth_memory', openid)
  const ops = {}
  if (event.type === 'cv_change' && event.cv) ops.cvHistory = _.push({ date: new Date().toISOString().slice(0,10), cv: event.cv, level: event.level||1, reason: event.reason||'认知行动', createdAt: Date.now() })
  if (event.type === 'milestone' && event.title) ops.milestones = _.push({ title: event.title, createdAt: Date.now() })
  if (event.type === 'streak' && event.streak) ops.streakHistory = _.push({ date: new Date().toISOString().slice(0,10), streak: event.streak, createdAt: Date.now() })
  if (Object.keys(ops).length > 0) {
    ops.updatedAt = Date.now()
    _ensureDB()
    await _db.collection('growth_memory').doc(g._id).update({ data: ops })
    await _logOp(openid, 'growth_event', event)
  }
  return { code: 0, message: '成长事件记录成功' }
}

// ═══════════════════════
// formatMemoryForPrompt
// ═══════════════════════
function formatMemoryForPrompt(memory) {
  if (!memory) return ''
  const parts = []

  if (memory.userMemory) {
    const um = memory.userMemory
    const goals = (um.coreGoals || []).join('、')
    const flags = (um.riskFlags || []).join('、')
    const traits = (um.stableTraits || []).join('、')
    if (goals || flags || traits) {
      parts.push('【用户长期记忆】')
      if (goals) parts.push(`核心目标：${goals}`)
      if (flags) parts.push(`风险信号：${flags}`)
      if (traits) parts.push(`稳定特征：${traits}`)
    }
  }

  if (memory.cognitionMemory?.dimensions) {
    const dims = memory.cognitionMemory.dimensions
    const s = []
    if (dims.laborMindset > 60) s.push('劳动思维较重')
    if (dims.probabilityMindset < 40) s.push('概率意识不足')
    if (dims.systemThinking < 40) s.push('系统思维较弱')
    if (dims.leverageThinking > 50) s.push('有杠杆意识')
    if (dims.riskAwareness < 40) s.push('风险意识不足')
    if (s.length) parts.push(`【认知画像】${s.join('；')}`)
  }

  if (memory.conversationMemory?.longTermSummary) {
    parts.push(`【历史对话摘要】${memory.conversationMemory.longTermSummary}`)
  }

  if (memory.growthMemory?.milestones?.length) {
    const recent = memory.growthMemory.milestones.slice(-3).map(m => m.title).join('、')
    parts.push(`【成长里程碑】${recent}`)
  }

  return parts.length ? '\n' + parts.join('\n') + '\n' : ''
}

// ═══════════════════════
// 日志 / 开关
// ═══════════════════════
async function _logOp(openid, operation, detail = {}) {
  try {
    _ensureDB()
    await _db.collection('memory_logs').add({ data: { openid, operation, detail, createdAt: Date.now() } })
  } catch (e) { console.warn('[Memory] 日志写入失败:', e.message) }
}

async function toggleMemory(openid, enabled) {
  try {
    _ensureDB()
    const res = await _db.collection('user_memory').where({ openid }).get()
    if (res.data.length > 0) await _db.collection('user_memory').doc(res.data[0]._id).update({ data: { memoryEnabled: !!enabled, updatedAt: Date.now() } })
    else await _db.collection('user_memory').add({ data: { openid, memoryEnabled: !!enabled, createdAt: Date.now(), updatedAt: Date.now() } })
    await _logOp(openid, 'toggle', { enabled: !!enabled })
    return { code: 0, message: `记忆已${enabled ? '开启' : '关闭'}` }
  } catch (e) { return { code: -1, message: e.message } }
}

async function isMemoryEnabled(openid) {
  try {
    _ensureDB()
    const res = await _db.collection('user_memory').where({ openid }).get()
    if (res.data.length === 0) return true
    return res.data[0].memoryEnabled !== false
  } catch (_) { return true }
}

module.exports = {
  getUserMemory,
  updateUserMemory,
  appendConversation,
  compressConversation,
  clearUserMemory,
  updateBehaviorMemory,
  recordGrowthEvent,
  formatMemoryForPrompt,
  getRelevantMemories,
  logMemoryOperation: _logOp,
  toggleMemory,
  isMemoryEnabled,
}
