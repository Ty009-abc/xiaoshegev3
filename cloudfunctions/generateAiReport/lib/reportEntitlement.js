'use strict'
/**
 * reportEntitlement.js — RC8_10_P0_PERSISTENT_REPORT_ENTITLEMENT
 *
 * 权威判定「该 openid 是否持有永久 report_9_9 产品权益」。
 *
 * 为什么不能用 hasPermission('full_report')：
 *   challenge_39_9 与 report_9_9 都会写入 'full_report' / 'report_history'
 *   权限字符串（见 common/permissionEngine.PRODUCT_PERMISSIONS）。因此
 *   'full_report' 无法区分「买了报告」与「只买了挑战」——用它判定报告访问
 *   会把仅购买挑战的用户错误放行。
 *
 * 权威来源：entitlements.sources[]（支付 finalizer 写入、且从未移除）。
 *   - 命中条件：sources 中存在 productId === 'report_9_9' 且未过期
 *     （expiresAt 为 0 / 缺省 或 > now 视为「永久 / 有效」）。
 *   - 只读；不写库、不改支付/权益/价格/SKU/退款。
 *   - 与 report.isPaid 相互独立，任一成立即解锁（见 reportAccess.js）。
 *
 * fail-closed：查询异常/无记录 → false（不误放行）。
 */

const REPORT_9_9_PRODUCT = 'report_9_9'

function _sourceActive (src, ts) {
  if (!src) return false
  const exp = src.expiresAt
  // expiresAt 0 / 缺省 → 永久有效；否则必须晚于当前时间
  if (exp === undefined || exp === null || exp === 0) return true
  return Number(exp) > ts
}

async function hasReport9_9Entitlement (db, openid) {
  if (!openid) return false
  const ts = Date.now()
  try {
    const res = await db.collection('entitlements').where({ openid }).limit(1).get()
    const ent = res && res.data && res.data[0]
    if (!ent) return false
    const sources = Array.isArray(ent.sources) ? ent.sources : []
    return sources.some((s) => s && s.productId === REPORT_9_9_PRODUCT && _sourceActive(s, ts))
  } catch (_) {
    return false
  }
}

module.exports = { REPORT_9_9_PRODUCT, hasReport9_9Entitlement }
