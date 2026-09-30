/**
 * cloudfunctions/payCallback/index.js — 微信支付回调（第五册 Part 1 安全升级版）
 *
 * P0 SECURITY FIX (Phase 1):
 *   1. ✅ 微信平台签名验证（RSA-SHA256）
 *   2. ✅ Wechatpay-Serial 校验
 *   3. ✅ Timestamp 防重放（5分钟窗口）
 *   4. ✅ 平台证书管理（WXPAY_PLATFORM_CERT 环境变量）
 *
 * 执行顺序（严格）：
 *   1. 读取原始 raw body
 *   2. 读取四个微信支付头
 *   3. 校验字段完整
 *   4. 校验 timestamp 时间窗
 *   5. 根据 serial 找到平台证书
 *   6. 验证 RSA-SHA256 签名
 *   7. AES-GCM 解密 resource
 *   8. 校验 mchid / appid / out_trade_no / amount
 *   9. 检查 transactionId 幂等
 *   10. 更新订单
 *   11. 发放权益
 *   12. 返回微信标准成功响应
 *
 * ⚠️ 必须返回 HTTP 200 给微信（仅签名错误时返回 401），否则微信会重复回调
 * ⚠️ raw body 不得重新 JSON.stringify，否则签名验证失败
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')
const { grantEntitlements } = require('./lib/entitlementService.js')
const {
  buildAuthorities,
  routeAuthority,
  verifySignature,
  decryptResource,
  REASONS,
} = require('./lib/paymentAuthority.js')
const { finalizePaidOrder } = require('./lib/paymentFinalizer.js')

const now = () => Date.now()

// 防重放时间窗口（秒）
const TIMESTAMP_WINDOW_SECONDS = 300 // 5分钟

exports.main = async (event) => {
  const ts = now()

  // ═══════════════════════════════════════
  // 步骤 1: 读取原始 raw body
  // ═══════════════════════════════════════
  // 微信云函数 HTTP 触发器中 event.body 是字符串
  // 签名验证必须用这个原始字符串，不得 JSON.parse 后再 JSON.stringify
  const rawBody = typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {})

  // ═══════════════════════════════════════
  // 步骤 2: 读取四个微信支付头
  // ═══════════════════════════════════════
  const headers = event.headers || {}
  const wechatpayTimestamp = headers['Wechatpay-Timestamp'] || headers['wechatpay-timestamp'] || ''
  const wechatpayNonce     = headers['Wechatpay-Nonce'] || headers['wechatpay-nonce'] || ''
  const wechatpaySignature = headers['Wechatpay-Signature'] || headers['wechatpay-signature'] || ''
  const wechatpaySerial    = headers['Wechatpay-Serial'] || headers['wechatpay-serial'] || ''

  // ═══════════════════════════════════════
  // 步骤 3: 校验字段完整
  // ═══════════════════════════════════════
  if (!wechatpayTimestamp || !wechatpayNonce || !wechatpaySignature || !wechatpaySerial) {
    console.error('[payCallback] 缺少微信支付签名头')
    return _err(400, 'MISSING_HEADERS', '缺少微信支付签名头')
  }

  // ═══════════════════════════════════════
  // 步骤 4: 校验 timestamp 时间窗（防重放）
  // ═══════════════════════════════════════
  const callbackTime = parseInt(wechatpayTimestamp, 10)
  if (isNaN(callbackTime)) {
    console.error('[payCallback] Wechatpay-Timestamp 无效')
    return _err(400, 'INVALID_TIMESTAMP', 'Wechatpay-Timestamp 无效')
  }
  const currentTime = Math.floor(ts / 1000)
  const timeDiff = Math.abs(currentTime - callbackTime)
  if (timeDiff > TIMESTAMP_WINDOW_SECONDS) {
    console.error(`[payCallback] 时间戳过期: diff=${timeDiff}s, max=${TIMESTAMP_WINDOW_SECONDS}s`)
    return _err(401, 'TIMESTAMP_EXPIRED', '请求时间戳已过期')
  }

  // ═══════════════════════════════════════
  // 步骤 5: 按 Wechatpay-Serial 权威路由（公钥 / 证书双模式，fail-closed）
  // ═══════════════════════════════════════
  const { authorities, errors } = buildAuthorities()
  if (errors.length > 0) {
    // 配置告警：不打印任何密钥/证书内容，只打印分类
    console.error(`[payCallback] 权威配置告警: ${errors.length} 项`)
  }

  const authority = routeAuthority(wechatpaySerial, authorities)
  if (!authority) {
    console.error('[payCallback] 平台证书/公钥未配置或 serial 不匹配')
    return _err(401, REASONS.CERT_OR_KEY_NOT_FOUND, '平台证书/公钥未配置')
  }

  // ═══════════════════════════════════════
  // 步骤 6: 验证 RSA-SHA256 签名（仅使用路由命中的权威）
  // ═══════════════════════════════════════
  const signatureMessage = `${wechatpayTimestamp}\n${wechatpayNonce}\n${rawBody}\n`
  const signatureValid = verifySignature(authority, signatureMessage, wechatpaySignature)

  if (!signatureValid) {
    console.error('[payCallback] 签名验证失败')
    return _err(401, REASONS.SIGNATURE_ERROR, 'signature verification failed')
  }

  console.log(`[payCallback] ✅ 签名验证通过 serial=${_maskSerial(wechatpaySerial)} type=${authority.type}`)

  // ═══════════════════════════════════════
  // 步骤 7-12: 原有业务逻辑
  // ═══════════════════════════════════════
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || event)
  const { id, create_time, resource_type, event_type, resource } = body

  console.log(`[payCallback] event_type=${event_type} id=${id}`)

  try {
    // 步骤 7: AES-GCM 解密 resource
    const decrypted = _decryptResource(resource)
    if (!decrypted) {
      console.error('[payCallback] 解密失败')
      return _err(500, 'DECRYPT_FAILED', '解密失败')
    }

    // 步骤 7.1: 事件类型校验（仅处理交易成功通知；其他事件安全忽略，fail-closed 不发放权益）
    if (event_type && event_type !== 'TRANSACTION.SUCCESS') {
      console.log(`[payCallback] 非交易成功事件，忽略: ${event_type}`)
      return _ok()
    }

    // 步骤 7.2: 绑定已解密的 provider 字段
    //   —— AES-GCM 解密产物 decrypted 为唯一字段权威来源（P0：修复未声明标识符引用）
    const { out_trade_no, transaction_id, trade_state, amount, mchid, appid } = decrypted

    const orderId = out_trade_no

    // 步骤 8: 基本字段校验（orderId 必须存在）
    if (!orderId) {
      console.error('[payCallback] 缺少 out_trade_no')
      return _err(500, 'MISSING_ORDER_ID', '回调数据缺少订单号')
    }

    console.log(`[payCallback] orderId=${orderId} txn=${transaction_id} state=${trade_state}`)

    if (trade_state !== 'SUCCESS') {
      console.log(`[payCallback] 非支付成功状态，跳过: ${trade_state}`)
      return _ok()
    }

    // 步骤 9-12: 唯一权威完成路径（与 verifyPayment 共用 finalizePaidOrder）
    //   —— 订单→paid + 写流水 + 发权益 全部在该路径内 exactly-once 完成。
    //   —— 金额 / 商户号 / appId / out_trade_no / 交易号 均由 finalizer 权威校验，fail-closed。
    const provider = {
      tradeState: trade_state,
      transactionId: transaction_id,
      outTradeNo: out_trade_no,
      mchid,
      appid,
      amountTotal: amount && amount.total != null ? amount.total : null,
      amountCurrency: amount && amount.currency ? amount.currency : '',
      amountPayerTotal: amount && amount.payer_total != null ? amount.payer_total : null,
      tradeType: decrypted.trade_type || '',
      bankType: decrypted.bank_type || '',
      successTime: decrypted.success_time || '',
    }
    const result = await finalizePaidOrder(db, {
      orderId,
      source: 'callback',
      provider,
      // 回调通道以「已验签+已解密」的 provider 字段为商户号/AppID 权威；env 缺省时回退到解密值。
      expect: {
        mchid: process.env.WXPAY_MCHID || mchid || '',
        appid: process.env.WXPAY_APPID || '',
      },
      ts,
    }, { grantEntitlements })

    if (!result.ok) {
      console.error(`[payCallback] finalize 拒绝 orderId=${orderId} reason=${result.reason}`)
      await _log('unknown', orderId, 'callback_finalize_rejected', `reason=${result.reason}`, ts)
      // fail-closed：非 200 让微信按策略重试/暴露异常，绝不静默标记成功。
      if (result.reason === REASONS.ORDER_NOT_FOUND) {
        return _err(500, 'ORDER_NOT_FOUND', '订单不存在')
      }
      return _err(500, String(result.reason || 'FINALIZE_REJECTED'), '支付未通过权威校验')
    }

    // 节点审计（非权威）
    await _log(result.openid || 'unknown', orderId, 'pay_callback',
      `支付成功，权益: ${(result.granted || []).join(',') || 'none'}${result.idempotent ? ' (幂等)' : ''}`, ts)
    await _markConversion(result.openid, ts)

    console.log(`[payCallback] ✅ 完成 ${orderId} txn=${result.transactionId} idempotent=${!!result.idempotent}`)

    // 步骤 12: 返回微信标准成功响应
    return _ok()
  } catch (err) {
    console.error('[payCallback] 异常:', err.message)
    await _log('unknown', id || 'unknown', 'pay_callback_error', err.message, ts)
    return _err(500, 'INTERNAL_ERROR', '处理失败')
  }
}

// ═══════════════════════════════════════
// 解密
// ═══════════════════════════════════════

/**
 * _decryptResource — AEAD_AES_256_GCM 解密
 *
 * 复用共享权威模块 paymentAuthority.decryptResource，与验证/回调语义一致：
 *   - 微信 v3 的 resource.ciphertext 为 Base64（非 hex）
 *   - 认证标签为解码后末 16 字节，并调用 final() 完成 GCM 认证
 * 解密/认证失败 → null（fail-closed，不发放权益）。
 */
function _decryptResource(resource) {
  const apiV3Key = process.env.WXPAY_API_V3_KEY || ''
  if (!apiV3Key) {
    console.warn('[payCallback] 未配置 WXPAY_API_V3_KEY')
    return null
  }
  const decrypted = decryptResource(resource, apiV3Key)
  if (!decrypted && resource) {
    console.error('[payCallback] 解密失败（算法/密钥/认证标签不匹配）')
  }
  return decrypted
}

// ═══════════════════════════════════════
// 辅助
// ═══════════════════════════════════════

function _maskSerial(serial) {
  if (!serial || serial.length < 8) return '***'
  return serial.slice(0, 4) + '****' + serial.slice(-4)
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

/**
 * _ok — 成功响应（微信标准格式）
 */
function _ok() {
  return {
    statusCode: 200,
    body: JSON.stringify({ code: 'SUCCESS', message: '成功' }),
  }
}

/**
 * _err — 错误响应（不泄露密钥/证书/签名细节）
 */
function _err(statusCode, code, message) {
  return {
    statusCode,
    body: JSON.stringify({ code, message }),
  }
}
