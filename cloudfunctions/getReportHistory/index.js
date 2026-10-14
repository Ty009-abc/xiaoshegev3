/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getReportHistory 云函数 — RC8_13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX
 *
 * 职责：返回当前登录用户的**服务端权威**可查看报告列表，供「我的报告」页消费。
 *
 * 设计原则：
 *   - 身份一律取自 cloud.getWXContext().OPENID，绝不信任客户端传入 openid。
 *   - 只读查询，无任何写操作。
 *   - 仅按已认证 openid 查询 → 绝不暴露他人报告。
 *   - 可见性谓词与 profile 的 reportCount 共用同一 canonical 源
 *     （lib/reportVisibility.js，字节一致共享产物）→ total ≡ profile.reportCount。
 *   - 每个返回项都有 canonical 详情路由（challenge_final→report-preview；
 *     legacy6q→legacy6q-report），故每个 count 项都可打开。
 *   - 最小字段投影：不上报无需的私有诊断原始载荷（仅取渲染所需 content 子字段）。
 *   - 不把会员身份当报告归属证明：归属只看 openid。
 *   - 查询失败 fail-closed（DB_ERROR），绝不静默降级为本地历史或空。
 *
 * 请求：{ pageToken?: string, pageSize?: number }
 * 响应：{ code, message, data: { items, total, nextCursor, countComplete } }
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { kindOf } = require('./lib/reportVisibility.js')

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const SCAN_PAGE_SIZE = 100
const MAX_PAGES = 100 // 上限保护：最多扫描 10,000 条

const TITLE = {
  challenge_final: '世界模型报告',
  legacy6q: '认知诊断报告',
}

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

function fmtDate (t) {
  const n = Number(t)
  if (!n || !isFinite(n)) return ''
  const d = new Date(n + 8 * 3600 * 1000) // 展示用北京时间
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

function preview (text) {
  const s = String(text || '')
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

/** 归一化 legacy6q 报告载荷（仅渲染所需 5 字段；不含 prompt/model/内部字段）。 */
function legacyPayload (content) {
  const c = content || {}
  return {
    fatal_sentence: c.fatal_sentence || '',
    core_problem: c.core_problem || '',
    system_trap: c.system_trap || '',
    strategy_path: c.strategy_path || c.turnaround_path || '',
    turnaround_path: c.turnaround_path || c.strategy_path || '',
    advice: Array.isArray(c.advice) ? c.advice : (c.advice ? [String(c.advice)] : []),
    personality: c.personality || null,
  }
}

/** 物化扫描 owner 的 ai_reports，按 canonical 可见性谓词选出可查看项，稳定倒序。 */
async function collectViewable (openid) {
  const col = db.collection('ai_reports')
  const totalRes = await col.where({ openid }).count()
  const rawTotal = (totalRes && totalRes.total) || 0
  const pages = Math.ceil(rawTotal / SCAN_PAGE_SIZE)
  const capped = pages > MAX_PAGES
  const scanPages = Math.min(pages, MAX_PAGES)

  const viewable = []
  for (let i = 0; i < scanPages; i++) {
    const pageRes = await col
      .where({ openid })
      .orderBy('createdAt', 'desc')
      .orderBy('_id', 'asc')
      .skip(i * SCAN_PAGE_SIZE)
      .limit(SCAN_PAGE_SIZE)
      .field({ type: true, recordId: true, reportId: true, _id: true, createdAt: true, content: true })
      .get()
    for (const r of (pageRes.data || [])) {
      if (kindOf(r)) viewable.push(r)
    }
  }
  return { viewable, capped }
}

function toItem (r) {
  const kind = kindOf(r)
  const id = r.reportId || r._id
  const c = r.content || {}
  const item = {
    id,                       // 稳定详情身份（reportId 优先，回退 _id）
    reportId: r.reportId || '',
    kind,                     // 'challenge_final' | 'legacy6q'
    recordId: r.recordId || '',
    dateText: fmtDate(r.createdAt),
    title: TITLE[kind] || '认知报告',
    preview: preview(c.oneSentence || c.fatal_sentence || c.core_problem || ''),
  }
  if (kind === 'legacy6q') {
    // 本地交接渲染：一次性载荷（无需二次服务端调用；无 AI/会员门槛）
    item.payload = legacyPayload(c)
    item.persona = (c.personality && c.personality.name) || ''
  }
  // challenge_final 不携带 content：详情经 report-preview（服务端生成/读取，按服务端权益）
  return item
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) return fail(CODES.AUTH_FAILED)

  const e = event || {}
  const pageSize = clampPageSize(e.pageSize)
  const skip = decodeCursor(e.pageToken)

  console.log(`[getReportHistory] openid=${openid} pageSize=${pageSize} skip=${skip}`)

  try {
    const { viewable, capped } = await collectViewable(openid)
    const total = viewable.length

    const pageRows = viewable.slice(skip, skip + pageSize)
    const items = pageRows.map(toItem)

    const nextSkip = skip + items.length
    const hasMore = items.length === pageSize && nextSkip < total
    const nextCursor = hasMore ? encodeCursor(nextSkip) : null
    const countComplete = !hasMore && (skip + items.length >= total) && !capped

    return ok({
      items,
      total,
      nextCursor,
      countComplete,
      pageSize,
      identity: 'server',
      now: Date.now(),
    })
  } catch (err) {
    // fail-closed：绝不把查询失败伪装成空列表，也绝不退回本地历史
    console.error('[getReportHistory] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
