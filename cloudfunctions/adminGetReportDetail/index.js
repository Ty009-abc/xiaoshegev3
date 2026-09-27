/**
 * cloudfunctions/adminGetReportDetail/index.js — RC8.9B 报告详情（只读快照）
 *
 * 按 reportId 读取 ai_reports 的历史快照并返回安全字段。
 * - 服务端管理员鉴权（users:detail 或 analytics/report 查看权限）
 * - 绝不重新推理 / 不调用 AI / 不按当前规则重算
 * - 只返回安全快照字段（不含 secret / prompt / 内部模型字段）
 * - 非管理员 / 伪造角色 一律 DENIED
 *
 * @version RC8.9B
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok, fail, CODES } = require('./lib/response.js')
const adminAuth = require('./lib/adminAuth.js')

// 允许查看报告详情的权限（任一即可）：用户详情 / 分析 / 支付
const VIEW_PERMS = ['users:detail', 'analytics:view', 'payments:view']

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const adminOpenid = wxContext.OPENID
  if (!adminOpenid) return fail(CODES.AUTH_FAILED)

  const reportId = event && event.reportId
  if (!reportId) return fail(CODES.PARAM_ERROR, '缺少 reportId')

  // 服务端权限权威（UI 隐藏不构成安全）
  let admin
  try {
    admin = await adminAuth.resolveAdmin(db, adminOpenid)
  } catch (err) {
    return fail(CODES.DB_ERROR, err.message)
  }
  if (!admin || !VIEW_PERMS.some(p => adminAuth.hasPermission(admin, p))) {
    return fail(CODES.PERMISSION_DENIED)
  }

  let doc
  try {
    const r = await db.collection('ai_reports').where({ reportId }).limit(1).get()
    doc = r.data && r.data[0]
  } catch (err) {
    return fail(CODES.DB_ERROR, err.message)
  }
  if (!doc) return fail(CODES.NOT_FOUND, '报告不存在')

  // 审计：查看报告实体
  try {
    await db.collection('admin_audit_logs').add({ data: {
      adminOpenid, action: 'REPORT_DETAIL_VIEWED', targetType: 'report', targetId: reportId,
      before: {}, after: {}, timestamp: Date.now(),
    } })
  } catch (_) {}

  // 只返回安全快照字段（不返回 rawPrompt / rawScores / secret / 内部字段）
  return ok({
    reportId: doc.reportId,
    reportType: doc.reportType || doc.type || '',
    diagnosticVersion: doc.diagnosticVersion || '',
    renderSource: doc.renderSource || '',
    createdAt: doc.createdAt || 0,
    updatedAt: doc.updatedAt || 0,
    schemaVersion: doc.schemaVersion || 0,
    // 用户侧实际收到的 5 卡片快照（原样返回，不重算）
    content: doc.content || null,
  })
}
