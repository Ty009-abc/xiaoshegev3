/**
 * cloudfunctions/payCallback/index.js — 微信支付回调（最关键）
 *
 * 第五册 Part 1：Payment Architecture
 *
 * 职责：
 *   1. 接收微信支付回调通知
 *   2. 验证签名 → 防伪造
 *   3. 校验金额 → 防篡改
 *   4. 幂等处理 → 防重复发放权益
 *   5. 更新 orders / payments / entitlements
 *   6. 发放权益 → grantEntitlements (from common/entitlement.js)
 *
 * ⚠️ 必须返回 HTTP 200 给微信，否则微信会重复回调
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')
const { grantEntitlements } = require('./lib/entitlementService.js')

const now = () => Date.now()

exports.main = async (event) => {
  const ts = now()
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || event)
  const { id, create_time, resource_type, event_type, resource } = body

  console.log(`[payCallback] event_type=${event_type} id=${id}`)

  try {
    const decrypted = _decryptResource(resource)
    if (!decrypted) {
      console.error('[payCallback] 解密失败')
      return _ok()
    }

    const { out_trade_no, transaction_id, trade_state, amount } = decrypted
    const orderId = out_trade_no

    console.log(`[payCallback] orderId=${orderId} txn=${transaction_id} state=${trade_state}`)

    if (trade_state !== 'SUCCESS') {
      console.log(`[payCallback] 非支付成功状态，跳过: ${trade_state}`)
      return _ok()
    }

    // 幂等检查
    const payRes = await db.collection('payments').where({ transactionId: transaction_id }).limit(1).get()
    if (payRes.data.length > 0) {
      console.log(`[payCallback] 已处理 ${transaction_id}，跳过（幂等）`)
      return _ok()
    }

    const orderRes = await db.collection('orders').where({ orderId }).limit(1).get()
    const order = orderRes.data[0]
    if (!order) {
      console.error(`[payCallback] 订单不存在: ${orderId}`)
      return _ok()
    }

    // 金额校验
    if (amount && amount.total && amount.total !== order.totalAmount) {
      console.error(`[payCallback] 金额不匹配: 回调=${amount.total} 订单=${order.totalAmount}`)
      await _log(order.openid, orderId, 'amount_mismatch', `回调${amount.total} vs 订单${order.totalAmount}`, ts)
      return _ok()
    }

    if (order.status === 'paid') {
      console.log(`[payCallback] 订单已支付，跳过: ${orderId}`)
      return _ok()
    }

    // 更新 orders → paid
    await db.collection('orders').where({ orderId }).update({
      data: { status: 'paid', transactionId: transaction_id, paidAt: ts, updatedAt: ts },
    })

    // 写 payments 流水
    await db.collection('payments').add({
      data: {
        paymentId: `PAY_${transaction_id}`,
        orderId,
        openid: order.openid,
        transactionId: transaction_id,
        amount: order.totalAmount,
        currency: 'CNY',
        payerTotal: amount?.payer_total || order.totalAmount,
        tradeState: trade_state,
        tradeType: decrypted.trade_type || 'JSAPI',
        bankType: decrypted.bank_type || '',
        successTime: decrypted.success_time || '',
        createdAt: ts,
      },
    })

    // 发放权益
    const grantResult = await grantEntitlements(db, order, ts)

    // 写 evolution_logs
    await _log(order.openid, orderId, 'pay_callback', `支付成功，权益: ${grantResult.granted?.join(',') || 'none'}`, ts)

    // 更新 response_metrics
    await _markConversion(order.openid, ts)

    console.log(`[payCallback] ✅ 完成 ${orderId} → ${grantResult.summary}`)
    return _ok()
  } catch (err) {
    console.error('[payCallback] 异常:', err.message)
    await _log('unknown', id || 'unknown', 'pay_callback_error', err.message, ts)
    return _ok()
  }
}

function _decryptResource(resource) {
  if (!resource) return null

  try {
    const apiV3Key = process.env.WXPAY_API_V3_KEY || ''
    if (!apiV3Key) {
      console.warn('[payCallback] 未配置 WXPAY_API_V3_KEY，使用测试模式')
      if (resource.out_trade_no) return resource
      return null
    }

    const { algorithm, ciphertext, nonce, associated_data } = resource
    if (algorithm !== 'AEAD_AES_256_GCM') {
      console.error(`[payCallback] 不支持的算法: ${algorithm}`)
      return null
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf8'),
      Buffer.from(nonce || '', 'utf8')
    )
    decipher.setAuthTag(Buffer.from(ciphertext.slice(-32), 'hex'))
    decipher.setAAD(Buffer.from(associated_data || '', 'utf8'))

    const raw = decipher.update(Buffer.from(ciphertext.slice(0, -32), 'hex'))
    const decrypted = JSON.parse(raw.toString('utf8'))
    return decrypted
  } catch (err) {
    console.error('[payCallback] 解密异常:', err.message)
    return null
  }
}

async function _markConversion(openid, ts) {
  try {
    await db.collection('response_metrics')
      .where({ openid, ledToPayment: false })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .update({ data: { ledToPayment: true, updatedAt: ts } })
  } catch (_) {}
}

async function _log(openid, orderId, action, message, ts) {
  try {
    await db.collection('evolution_logs').add({
      data: { operation: action, targetId: orderId, detail: { openid, message }, createdAt: ts || now() },
    })
  } catch (_) {}
}

function _ok() {
  return { statusCode: 200, body: JSON.stringify({ code: 'SUCCESS', message: 'OK' }) }
}
