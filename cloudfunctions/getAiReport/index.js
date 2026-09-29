/**
 * getAiReport - 读取 AI 报告
 *
 * 仅本人可读；VIP/isPaid→完整；free→summary+locked
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { checkVip } = require('./lib/permission.js')
// PAYMENT_STAGE5A_R8_P0 — 唯一权威「完整报告查看权限」判定（report.isPaid || VIP）。
const { resolveReportAccess } = require('./lib/reportAccess.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { reportId } = event
  if (!reportId) return fail(CODES.PARAM_ERROR, '缺少 reportId')

  console.log(`[getAiReport] openid=${openid} reportId=${reportId}`)

  try {
    const res = await db.collection('ai_reports').where({ reportId, openid }).limit(1).get()
    const report = res.data[0]
    if (!report) return fail(CODES.NOT_FOUND, '报告不存在')

    // 唯一权威：report.isPaid（单份已购，最高优先）|| VIP/会员报告权限。
    // report.isPaid=true 绝不被 membershipLevel='free' 覆盖。
    const isVip = await checkVip(db, openid)
    const access = resolveReportAccess(report, isVip === true)
    if (access.canViewFullReport) {
      return ok({
        reportId: report.reportId,
        isPaid: true,
        locked: false,
        canViewFullReport: true,
        type: report.type,
        scores: report.scores,
        tags: report.tags,
        content: report.content,
        createdAt: report.createdAt,
      })
    }

    // 免费 → summary + locked
    return ok({
      reportId: report.reportId,
      isPaid: false,
      locked: true,
      canViewFullReport: false,
      type: report.type,
      summary: report.content ? {
        oneSentence: report.content.oneSentence || '',
        worldModelType: report.content.worldModelType || '',
        turnaroundProbability: report.content.turnaroundProbability || 0,
      } : {},
      preview: '完整报告需解锁认知操作系统会员或单独购买。',
      createdAt: report.createdAt,
    })
  } catch (err) {
    console.error('[getAiReport] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
