'use strict'
/**
 * createOrder/lib/entitlementGuard.js
 *
 * 下单前的「已拥有权益」服务端前置校验 —— 防止对一次性解锁类商品重复扣款。
 *
 * 适用范围（仅一次性解锁类）：
 *   challenge_39_9 → challenge_records（recordId=relatedId, openid）已解锁
 *   report_9_9     → ai_reports（reportId=relatedId, openid）已 isPaid
 *
 * 不拦截会员类商品（vip_*）—— 会员为时长制，重复购买视为续费；
 * 其「同订单不重复叠加」由支付 finalizer 的 orderId 幂等保证。
 *
 * 权威来源：服务端实体状态（trialMode===false / unlocked===true / isPaid===true），
 * 绝不凭客户端声明。校验异常时降级放行（避免因前置校验故障阻断正常下单），
 * 不会产生假阻断。
 */

const ONE_TIME_UNLOCK = {
  challenge_39_9: 'challenge',
  report_9_9: 'report',
}

/**
 * checkAlreadyEntitled(db, openid, productId, relatedId)
 * @returns {{entitled: boolean, message?: string, source?: string}}
 */
async function checkAlreadyEntitled (db, openid, productId, relatedId) {
  const kind = ONE_TIME_UNLOCK[productId]
  if (!kind || !relatedId) return { entitled: false }

  try {
    if (kind === 'challenge') {
      const r = await db.collection('challenge_records')
        .where({ recordId: relatedId, openid, trialMode: false })
        .limit(1)
        .get()
      if (r.data && r.data.length > 0) {
        return { entitled: true, message: '该挑战已解锁，无需重复购买', source: 'challenge.trialMode' }
      }
      const r2 = await db.collection('challenge_records')
        .where({ recordId: relatedId, openid, unlocked: true })
        .limit(1)
        .get()
      if (r2.data && r2.data.length > 0) {
        return { entitled: true, message: '该挑战已解锁，无需重复购买', source: 'challenge.unlocked' }
      }
    }

    if (kind === 'report') {
      const r = await db.collection('ai_reports')
        .where({ reportId: relatedId, openid, isPaid: true })
        .limit(1)
        .get()
      if (r.data && r.data.length > 0) {
        return { entitled: true, message: '该报告已解锁，无需重复购买', source: 'report.isPaid' }
      }
    }

    return { entitled: false }
  } catch (e) {
    console.error('[entitlementGuard] 校验异常（降级放行）:', e.message)
    return { entitled: false }
  }
}

module.exports = { checkAlreadyEntitled, ONE_TIME_UNLOCK }
