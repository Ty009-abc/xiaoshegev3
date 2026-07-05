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
  if (res.data.length > 0) await _db.collection(collection).doc(res.data[0]._id).update({ data: updateData })
  else await _db.collection(collection).add({ data: { openid, ...updateData, createdAt: Date.now() } })
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
  for (const col of targets) {
    try { await _db.collection(col).where({ openid }).remove() } catch (e) { console.warn(`[Memory] 清除 ${col} 失败:`, e.message) }
  }
  await _logOp(openid, 'clear_all', { collections: targets })
  return { code: 0, message: `已清除 ${targets.length} 个记忆集合` }
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
  logMemoryOperation: _logOp,
  toggleMemory,
  isMemoryEnabled,
}
