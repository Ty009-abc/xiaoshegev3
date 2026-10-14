/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getChallengeRecords 云函数 — RC8_13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX
 *
 * 职责：返回当前登录用户的**服务端权威**挑战记录列表，供「挑战记录」页消费。
 *
 * 设计原则：
 *   - 身份一律取自 cloud.getWXContext().OPENID，绝不信任客户端传入 openid。
 *   - 只读查询，无任何写操作。
 *   - 仅按已认证 openid 查询 → 无跨用户泄漏。
 *   - total 与 profile 的 challengeCount 使用同一 owner 口径，二者恒等。
 *   - finishedTotal 单独统计（status==='finished'）。
 *   - 字段投影最小化，仅返回列表/详情导航所需字段。
 *   - 查询失败 fail-closed（DB_ERROR），绝不静默返回空列表伪装「暂无记录」。
 *
 * 请求：{ pageToken?: string, pageSize?: number }
 * 响应：{ code, message, data: { items, total, finishedTotal, nextCursor, countComplete } }
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const {
  CHALLENGE_STATUS, isListableChallenge, statusKind, statusLabel, displayDay,
} = require('./lib/challengeListability.js')

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100
const MAX_PAGES = 100 // 上限保护：最多扫描 10,000 条，避免超时

function clampPageSize (n) {
  const v = Number(n)
  if (!v || v <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(Math.floor(v), MAX_PAGE_SIZE)
}

function encodeCursor (skip) {
  if (!skip || skip <= 0) return null
  return Buffer.from(JSON.stringify({ s: skip })).toString('base64')
}

function decodeCursor (pageToken) {
  if (!pageToken || typeof pageToken !== 'string') return 0
  try {
    const o = JSON.parse(Buffer.from(pageToken, 'base64').toString('utf8'))
    const s = Number(o && o.s)
    return (s && s > 0) ? Math.floor(s) : 0
  } catch (_) { return 0 }
}

/** 单条原始记录 → 列表项（最小投影；无详情渲染用不到的字段）。 */
function toItem (r) {
  const kind = statusKind(r.status)
  const day = displayDay(r.currentDay, r.status)
  return {
    recordId: r.recordId || '',
    status: kind,                       // 归一化闭集：processing | finished | unknown
    statusText: statusLabel(r.status),  // 中文字面量（进行中/已完成/未知）
    day: day,                           // 0 = 不展示（已完成或缺失）；上限 30
    finalType: r.finalType || '',
    // 导航目标（客户端据此路由；服务端权威决定可动作性）
    action: kind === CHALLENGE_STATUS.PROCESSING ? 'resume'
      : (kind === CHALLENGE_STATUS.FINISHED ? 'detail' : 'none'),
    startedAt: r.startedAt || r.createdAt || 0,
    finishedAt: r.finishedAt || 0,
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) return fail(CODES.AUTH_FAILED)

  const e = event || {}
  const pageSize = clampPageSize(e.pageSize)
  const skip = decodeCursor(e.pageToken)

  console.log(`[getChallengeRecords] openid=${openid} pageSize=${pageSize} skip=${skip}`)

  try {
    const col = db.collection('challenge_records')

    // 权威总数（owner 口径，与 profile challengeCount 同源）
    const totalRes = await col.where({ openid }).count()
    const total = (totalRes && totalRes.total) || 0

    const finishedRes = await col.where({ openid, status: 'finished' }).count()
    const finishedTotal = (finishedRes && finishedRes.total) || 0

    // 稳定排序：createdAt desc（平局以 recordId asc 兜底，避免跨页重复）
    const pageRes = await col
      .where({ openid })
      .orderBy('createdAt', 'desc')
      .orderBy('recordId', 'asc')
      .skip(skip)
      .limit(pageSize)
      .field({
        recordId: true, status: true, currentDay: true, finalType: true,
        startedAt: true, finishedAt: true, createdAt: true,
      })
      .get()

    const rows = (pageRes.data || []).filter(isListableChallenge)
    const items = rows.map(toItem)

    const nextSkip = skip + (pageRes.data || []).length
    const hasMore = (pageRes.data || []).length === pageSize && nextSkip < total
    const nextCursor = hasMore ? encodeCursor(nextSkip) : null

    // countComplete：仅当返回完整集合（未翻页到尽头即为 false）
    const countComplete = !hasMore && (skip + items.length >= total)

    return ok({
      items,
      total,
      finishedTotal,
      nextCursor,
      countComplete,
      pageSize,
      identity: 'server',
      now: Date.now(),
    })
  } catch (err) {
    // fail-closed：绝不把查询失败伪装成空列表
    console.error('[getChallengeRecords] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
