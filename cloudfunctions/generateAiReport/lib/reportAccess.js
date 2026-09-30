'use strict'
/**
 * reportAccess.js — 唯一权威「完整报告查看权限」判定
 * PAYMENT_STAGE5A_R8_P0_CANONICAL_REPORT_UNLOCK
 * RC8_10_P0_PERSISTENT_REPORT_ENTITLEMENT
 *
 * 目的：消除「完整报告解锁权威分裂」（R8 forensic ROOT_CAUSE = E）。
 *   - 服务端：generateAiReport / getAiReport 在渲染 `locked` 时，必须只以本模块为准。
 *   - 客户端：report-preview 不得再用 membership-only 的
 *     checkPermission('full_report') 去二次覆盖服务端结论。
 *
 * 权威规则（fail-closed，只针对「某个具体报告实体」）：
 *   canAccessFullReport(report, vipGranted, report9_9Granted) === true 当且仅当
 *     A) report.isPaid === true                    —— 单份报告已购（最高优先级）
 *     OR
 *     B) vipGranted === true                        —— 有效会员/VIP 报告权限
 *     OR
 *     C) report9_9Granted === true                  —— 永久 report_9_9 产品权益
 *         （一次购买 · 永久解锁：owner 拥有有效 report_9_9 订单/权益后，
 *          当前与未来所有自有世界模型报告均解锁，重做 6Q 不再二次付费）
 *
 * 关键约束：
 *   - report.isPaid 绝不被 membershipLevel='free' 覆盖。
 *   - report_9_9 权益绝不被 membershipLevel='free' 覆盖。
 *   - 不得因为全局 membership-only 权限检查失败，就把已购/已权益报告判为 locked。
 *   - B/C 两条通道都只代表「报告访问」；challenge 入口另有独立权益
 *     (challenge_full)，绝不由报告权益/报告锁状态决定（见 startChallenge）。
 *   - 本模块只做「读时判定」；不写库、不改支付/权益发放/价格/SKU/商户/退款。
 *   - 与 entitlementService 的分工：entitlementService.applyReportUnlock 负责
 *     「写」（把 ai_reports.isPaid 置真 / 写 entitlements 缓存）；本模块负责「读时判定」。
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

// C) 永久 report_9_9 产品权益 —— 与 report.isPaid 等价的「一次性购买」通道。
function userHasReport9_9Authority (report9_9Granted) {
  return report9_9Granted === true
}

/**
 * canAccessFullReport — 单份报告完整查看的权威判定。
 * @param {object} report               ai_reports 实体（含 isPaid）
 * @param {boolean} vipGranted          有效会员/VIP 报告权限（如 checkVip 结果）
 * @param {boolean} report9_9Granted    永久 report_9_9 产品权益（服务端 entitlements）
 * @returns {boolean}
 */
function canAccessFullReport (report, vipGranted, report9_9Granted) {
  if (isReportPaid(report)) return true
  if (userHasReportVipAuthority(vipGranted)) return true
  if (userHasReport9_9Authority(report9_9Granted)) return true
  return false
}

/**
 * resolveReportAccess — 规范化判定结果（含来源，便于观测）。
 * @returns {{ isPaid:boolean, locked:boolean, canViewFullReport:boolean, accessSource:string }}
 */
function resolveReportAccess (report, vipGranted, report9_9Granted) {
  const paid = isReportPaid(report)
  const vip = userHasReportVipAuthority(vipGranted)
  const owned9_9 = userHasReport9_9Authority(report9_9Granted)
  const can = paid || vip || owned9_9
  return {
    isPaid: can,
    locked: !can,
    canViewFullReport: can,
    accessSource: paid
      ? 'REPORT_IS_PAID'
      : (vip ? 'VIP_AUTHORITY' : (owned9_9 ? 'REPORT_9_9_ENTITLEMENT' : 'NONE')),
  }
}

/**
 * reportAccessFields — 供 API 直接回传的三元组。
 * @returns {{ isPaid:boolean, locked:boolean, canViewFullReport:boolean }}
 */
function reportAccessFields (report, vipGranted, report9_9Granted) {
  const r = resolveReportAccess(report, vipGranted, report9_9Granted)
  return { isPaid: r.isPaid, locked: r.locked, canViewFullReport: r.canViewFullReport }
}

module.exports = {
  isReportPaid,
  userHasReportVipAuthority,
  userHasReport9_9Authority,
  canAccessFullReport,
  resolveReportAccess,
  reportAccessFields,
}
