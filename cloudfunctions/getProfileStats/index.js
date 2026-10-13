/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getProfileStats 云函数
 *
 * 职责：返回当前登录用户的**服务端权威**档案统计，供「我的」页消费。
 *   - reportCount           : 可查看报告数（ai_reports{openid}，按 canonical 可见性规则）
 *   - reportTotalRecords    : ai_reports 原始记录数（诊断口径，非 UI 计数）
 *   - paidReportCount       : ai_reports{openid, isPaid:true}
 *   - challengeCount        : challenge_records{openid}（全部状态）
 *   - challengeFinishedCount: challenge_records{openid, status:'finished'}
 *
 * 设计原则：
 *   RC8_13_P0_PROFILE_HISTORY_AUTHORITY_FIX
 *     - 身份一律取自 cloud.getWXContext().OPENID，绝不信任客户端传入 openid。
 *     - 只读查询，无任何写操作。
 *     - 仅按已认证 openid 查询 → 无跨用户泄漏。
 *     - 服务端权威规则与 report-history 的可见性规则一致（countPolicy.js）。
 *     - 返回 {code:0,data} 包裹，兼容既有页面响应解析。
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { countViewableReports, pagesFor } = require('./lib/countPolicy.js')

const PAGE_SIZE = 100
const MAX_PAGES = 100 // 上限保护：最多扫描 10,000 条，避免超时；超出则标记报告计数不完整

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) return fail(CODES.AUTH_FAILED)

  console.log(`[getProfileStats] openid=${openid}`)

  try {
    const aiReports = db.collection('ai_reports')
    const challengeRecords = db.collection('challenge_records')

    // 计数（按已认证 openid；只读）
    const [reportTotalRes, paidRes, challengeRes, challengeFinRes] = await Promise.all([
      aiReports.where({ openid }).count(),
      aiReports.where({ openid, isPaid: true }).count(),
      challengeRecords.where({ openid }).count(),
      challengeRecords.where({ openid, status: 'finished' }).count(),
    ])

    const reportTotalRecords = (reportTotalRes && reportTotalRes.total) || 0
    const paidReportCount = (paidRes && paidRes.total) || 0
    const challengeCount = (challengeRes && challengeRes.total) || 0
    const challengeFinishedCount = (challengeFinRes && challengeFinRes.total) || 0

    // 报告可见数 = 物化扫描 ai_reports{openid} 后按 canonical 可见性规则计数
    const pages = pagesFor(reportTotalRecords, PAGE_SIZE)
    const capped = pages > MAX_PAGES
    const scanPages = Math.min(pages, MAX_PAGES)
    let reportCount = 0
    for (let i = 0; i < scanPages; i++) {
      const pageRes = await aiReports
        .where({ openid })
        .field({ type: true, recordId: true, content: true })
        .orderBy('createdAt', 'desc')
        .skip(i * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .get()
      reportCount += countViewableReports(pageRes.data)
    }

    // 最近一次已完成挑战的 finalType（用于画像分类回退；独立容错，不影响计数）
    let latestFinishedType = ''
    try {
      const finRes = await challengeRecords
        .where({ openid, status: 'finished' })
        .orderBy('createdAt', 'desc')
        .field({ finalType: true, createdAt: true })
        .limit(1)
        .get()
      latestFinishedType = (finRes.data[0] && finRes.data[0].finalType) || ''
    } catch (e) {
      console.warn('[getProfileStats] latestFinishedType query failed:', e && e.message)
    }

    return ok({
      counts: {
        reportCount,
        reportTotalRecords,
        paidReportCount,
        challengeCount,
        challengeFinishedCount,
      },
      latestFinishedType,
      reportCountComplete: !capped,
      identity: 'server',
      now: Date.now(),
    })
  } catch (err) {
    console.error('[getProfileStats] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
