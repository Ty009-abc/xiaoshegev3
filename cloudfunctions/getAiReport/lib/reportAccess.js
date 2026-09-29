'use strict'
/**
 * reportAccess.js — 唯一权威「完整报告查看权限」判定
 * PAYMENT_STAGE5A_R8_P0_CANONICAL_REPORT_UNLOCK
 *
 * 目的：消除「完整报告解锁权威分裂」（R8 forensic ROOT_CAUSE = E）。
 *   - 服务端：generateAiReport / getAiReport 在渲染 `locked` 时，必须只以本模块为准。
 *   - 客户端：report-preview 不得再用 membership-only 的
 *     checkPermission('full_report') 去二次覆盖服务端结论。
 *
 * 权威规则（fail-closed，只针对「某个具体报告实体」）：
 *   canAccessFullReport(report, vipGranted) === true  当且仅当
 *     A) report.isPaid === true                    —— 单份报告已购（最高优先级）
 *     OR
 *     B) vipGranted === true                        —— 有效会员/VIP 报告权限
 *
 * 关键约束：
 *   - report.isPaid 绝不被 membershipLevel='free' 覆盖。
 *   - 不得因为全局 membership-only 权限检查失败，就把已购报告判为 locked。
 *   - 本模块只做「读时判定」；不写库、不改支付/权益发放/价格/SKU/商户/退款。
 *   - 与 entitlementService 的分工：entitlementService.applyReportUnlock 负责
 *     「写」（把 ai_reports.isPaid 置真）；本模块负责「读时判定」。
 *
 * 本文件为 canonical。generateAiReport/lib 与 getAiReport/lib 各持一份字节一致的副本。
 */

// A) 报告实体自身的付费状态 —— 最高优先级，绝不降级。
function isReportPaid (report) {
  return !!(report && report.isPaid === true)
}

// B) 会员/VIP 报告权限 —— 仅作为独立兜底通道，不参与「降级」判定。
function userHasReportVipAuthority (vipGranted) {
  return vipGranted === true
}

/**
 * canAccessFullReport — 单份报告完整查看的权威判定。
 * @param {object} report       ai_reports 实体（含 isPaid）
 * @param {boolean} vipGranted  有效会员/VIP 报告权限（如 checkVip 结果）
 * @returns {boolean}
 */
function canAccessFullReport (report, vipGranted) {
  if (isReportPaid(report)) return true
  if (userHasReportVipAuthority(vipGranted)) return true
  return false
}

/**
 * resolveReportAccess — 规范化判定结果（含来源，便于观测）。
 * @returns {{ isPaid:boolean, locked:boolean, canViewFullReport:boolean, accessSource:string }}
 */
function resolveReportAccess (report, vipGranted) {
  const paid = isReportPaid(report)
  const vip = userHasReportVipAuthority(vipGranted)
  const can = paid || vip
  return {
    isPaid: paid,
    locked: !can,
    canViewFullReport: can,
    accessSource: paid ? 'REPORT_IS_PAID' : (vip ? 'VIP_AUTHORITY' : 'NONE'),
  }
}

/**
 * reportAccessFields — 供 API 直接回传的三元组。
 * @returns {{ isPaid:boolean, locked:boolean, canViewFullReport:boolean }}
 */
function reportAccessFields (report, vipGranted) {
  const r = resolveReportAccess(report, vipGranted)
  return { isPaid: r.isPaid, locked: r.locked, canViewFullReport: r.canViewFullReport }
}

module.exports = {
  isReportPaid,
  userHasReportVipAuthority,
  canAccessFullReport,
  resolveReportAccess,
  reportAccessFields,
}
