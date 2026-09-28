/**
 * common/payment.js - 微信支付封装（JSAPI v3）
 *
 * ⚠️ 部署前必须配置以下环境变量或安全配置：
 *   - WXPAY_MCHID           商户号
 *   - WXPAY_APPID           小程序 AppID
 *   - WXPAY_SERIAL_NO       证书序列号（商户 API 证书序列号，40 位十六进制）
 *   - WXPAY_PRIVATE_KEY     商户私钥 (PEM 格式，换行用 \n)
 *     - 或 WXPAY_PRIVATE_KEY_PATH 私钥文件路径（二选一）
 *   - WXPAY_API_V3_KEY      APIv3 密钥
 *   - WXPAY_NOTIFY_URL      支付回调地址
 *
 * 私钥读取优先级：
 *   1. WXPAY_PRIVATE_KEY 环境变量（PEM 原文，\n 换行）
 *   2. WXPAY_PRIVATE_KEY_PATH 文件路径
 *   3. 均未设置 → 生产环境明确失败（WXPAY_PRIVATE_KEY_MISSING）
 *
 * 生产环境必须配置 WXPAY_MCHID，否则所有支付操作失败。
 * 不再静默 fallback 到 mock 模式。
 *
 * ⚠️ 应答验签（PAYMENT_STAGE2）：商户出站请求用「商户 API 私钥 + 商户证书序列号」
 *    签名；微信应答/通知用「微信支付公钥（+公钥 ID）或平台证书」验签。两者角色不同，
 *    绝不可混用。凡作为支付权威使用的微信应答，必须先通过 verifyResponseSignature
 *    （与 payCallback 共享同一权威模块，语义不漂移）；未通过 → fail-closed，
 *    绝不标记 paid / 发放权益。
 */

const crypto = require('crypto')
const fs = require('fs')
const now = () => Date.now()
const { verifyResponseSignature } = require('./paymentAuthority.js')

// ======================== 配置读取 ========================
function getConfig() {
  const mchid = process.env.WXPAY_MCHID || ''

  // 私钥读取：优先环境变量 → 文件路径 → 明确失败
  let privateKey = ''
  if (process.env.WXPAY_PRIVATE_KEY) {
    privateKey = process.env.WXPAY_PRIVATE_KEY.replace(/\\n/g, '\n')
  } else if (process.env.WXPAY_PRIVATE_KEY_PATH) {
    try {
      privateKey = fs.readFileSync(process.env.WXPAY_PRIVATE_KEY_PATH, 'utf8')
    } catch (err) {
      console.error('[WXPAY] 读取私钥文件失败:', err.message)
      privateKey = ''
    }
  }
  // 都不存在 → privateKey 为空，生产环境会明确失败

  return {
    isMock: !mchid,
    mchid,
    appid: process.env.WXPAY_APPID || '',
    serialNo: process.env.WXPAY_SERIAL_NO || '',
    privateKey,
    privateKeyMissing: !privateKey,
    apiV3Key: process.env.WXPAY_API_V3_KEY || '',
    notifyUrl: process.env.WXPAY_NOTIFY_URL || '',
  }
}

// ======================== 签名 ========================
function sign(method, path, body, mchid, serialNo, privateKey) {
  const timestamp = Math.floor(now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || {})

  const message = [method.toUpperCase(), path, timestamp, nonce, bodyStr + '\n'].join('\n')
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(message)
    .sign(privateKey, 'base64')

  return {
    Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`,
  }
}

// ======================== 底层 HTTP（保留原始 body 与响应头以验签） ========================
function _headersToObj(h) {
  const o = {}
  if (!h) return o
  if (typeof h.forEach === 'function') {
    h.forEach((v, k) => { o[String(k).toLowerCase()] = v })
  } else {
    Object.keys(h).forEach((k) => { o[String(k).toLowerCase()] = h[k] })
  }
  return o
}

/**
 * 发请求并返回 { status, headers, rawBody }。保留原始响应体字符串，
 * 以便对微信应答做 RSA-SHA256 验签（重新序列化会导致验签失败）。
 */
async function _request(method, path, headers, body) {
  const url = 'https://api.mch.weixin.qq.com' + path
  try {
    const axios = require('axios')
    const r = await axios({
      method,
      url,
      headers,
      data: body,
      timeout: 15000,
      // 保留原始字符串，稍后自行 JSON.parse（验签必须以原文为准）
      transformResponse: [(d) => d],
      validateStatus: () => true,
    })
    return {
      status: r.status,
      headers: _headersToObj(r.headers),
      rawBody: typeof r.data === 'string' ? r.data : JSON.stringify(r.data),
    }
  } catch (e) {
    // axios 抛错但携带响应（如 4xx）时仍取回用于验签
    if (e && e.response && e.response.headers) {
      const d = e.response.data
      return {
        status: e.response.status,
        headers: _headersToObj(e.response.headers),
        rawBody: typeof d === 'string' ? d : JSON.stringify(d),
      }
    }
    // 回退 node-fetch
    const fetch = require('node-fetch')
    const r2 = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const raw = await r2.text()
    return { status: r2.status, headers: _headersToObj(r2.headers), rawBody: raw }
  }
}

/**
 * 对微信应答验签（fail-closed）。返回 { verified, reason, data }。
 * 未通过验签时 `verified=false`，调用方绝不可将其当作支付权威。
 */
function _verifyAndParse(resp) {
  const v = verifyResponseSignature(resp.headers, resp.rawBody)
  if (!v.valid) return { verified: false, reason: v.reason, data: null }
  let data = {}
  try { data = JSON.parse(resp.rawBody) } catch (_) { data = {} }
  return { verified: true, reason: null, data }
}

// ======================== JSAPI 下单 ========================
/**
 * JSAPI 下单
 * @param {object} params
 * @returns {{ success, prepay_id, paymentParams }}
 */
async function jsapiOrder(params) {
  const { appid, mchid, serialNo, privateKey, privateKeyMissing, notifyUrl, isMock } = getConfig()
  const { orderId, productName, totalAmount, openid } = params

  // 生产环境：私钥缺失 → 明确失败
  if (!isMock && privateKeyMissing) {
    console.error('[WXPAY] WXPAY_PRIVATE_KEY_MISSING — 生产环境缺少商户私钥')
    return { success: false, error: 'WXPAY_PRIVATE_KEY_MISSING' }
  }

  // 生产环境：缺少 appid → 明确失败
  if (!isMock && (!appid || appid === 'REPLACE_WITH_YOUR_APPID')) {
    console.error('[WXPAY] WXPAY_APPID 未配置或仍使用占位值')
    return { success: false, error: 'WXPAY_APPID_MISSING' }
  }

  if (isMock) {
    console.warn('[WXPAY] ⚠️ 沙箱模式 — 未配置真实商户参数')
    return {
      success: true,
      prepayId: 'MOCK_PREPAY_' + orderId,
      paymentParams: {
        timeStamp: Math.floor(now() / 1000).toString(),
        nonceStr: crypto.randomBytes(16).toString('hex'),
        package: 'prepay_id=MOCK_PREPAY_' + orderId,
        signType: 'RSA',
        paySign: 'MOCK_SIGN',
        _mock: true,
        _message: '当前为测试模式，支付参数为模拟数据。正式环境请配置 WXPAY_* 环境变量。',
      },
    }
  }

  const path = '/v3/pay/transactions/jsapi'
  const body = {
    appid,
    mchid,
    description: productName,
    out_trade_no: orderId,
    notify_url: notifyUrl,
    amount: { total: totalAmount, currency: 'CNY' },
    payer: { openid },
  }

  const headers = sign('POST', path, body, mchid, serialNo, privateKey)
  headers['Content-Type'] = 'application/json'

  try {
    const resp = await _request('POST', path, headers, body)

    // 应答验签（fail-closed）：未验证的应答不得作为下单权威
    const parsed = _verifyAndParse(resp)
    if (!parsed.verified) {
      console.error('[WXPAY] 下单应答验签失败:', parsed.reason)
      return { success: false, error: 'RESPONSE_SIGNATURE_INVALID', reason: parsed.reason }
    }

    const data = parsed.data
    if (data && data.prepay_id) {
      const prepayId = data.prepay_id
      const timeStamp = Math.floor(now() / 1000).toString()
      const nonceStr = crypto.randomBytes(16).toString('hex')
      const pkg = 'prepay_id=' + prepayId
      const paySignMessage = [appid, timeStamp, nonceStr, pkg].join('\n') + '\n'
      const paySign = crypto
        .createSign('RSA-SHA256')
        .update(paySignMessage)
        .sign(privateKey, 'base64')

      return {
        success: true,
        prepayId,
        paymentParams: { timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign },
      }
    }

    console.error('[WXPAY] 下单失败:', JSON.stringify(data))
    return { success: false, error: (data && data.message) || '下单失败' }
  } catch (err) {
    console.error('[WXPAY] 下单异常:', err.message)
    return { success: false, error: err.message }
  }
}

// ======================== 查单 ========================
/**
 * 查询订单
 * @param {string} orderId - 商户订单号
 * @returns {{ success, tradeState, transactionId }}
 */
async function queryOrder(orderId) {
  const { mchid, serialNo, privateKey, privateKeyMissing, isMock } = getConfig()

  // 生产环境：私钥缺失 → 明确失败
  if (!isMock && privateKeyMissing) {
    console.error('[WXPAY] WXPAY_PRIVATE_KEY_MISSING — 生产环境缺少商户私钥')
    return { success: false, tradeState: 'ERROR', error: 'WXPAY_PRIVATE_KEY_MISSING' }
  }

  if (isMock) {
    console.warn('[WXPAY] 沙箱查单 — 返回已支付')
    return { success: true, tradeState: 'SUCCESS', transactionId: 'MOCK_TXN_' + orderId }
  }

  const path = `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${mchid}`
  const headers = sign('GET', path, '', mchid, serialNo, privateKey)
  headers['Content-Type'] = 'application/json'

  let resp
  try {
    resp = await _request('GET', path, headers)
  } catch (err) {
    console.error('[WXPAY] 查单异常:', err.message)
    return { success: false, tradeState: 'ERROR', error: err.message }
  }

  // 应答验签（fail-closed）：未经权威验签的应答绝不可标记 paid / 发放权益
  const parsed = _verifyAndParse(resp)
  if (!parsed.verified) {
    console.error('[WXPAY] 查单应答验签失败:', parsed.reason)
    return { success: false, tradeState: 'UNVERIFIED', error: 'RESPONSE_SIGNATURE_INVALID', reason: parsed.reason }
  }

  const data = parsed.data || {}
  const amt = data.amount || {}
  return {
    success: true,
    tradeState: data.trade_state || 'UNKNOWN',
    transactionId: data.transaction_id || '',
    tradeStateDesc: data.trade_state_desc || '',
    // ── 已认证 provider 证据（供 paymentFinalizer 校验，绝不采信客户端）──
    outTradeNo: data.out_trade_no || '',
    mchid: data.mchid || '',
    appid: data.appid || '',
    amountTotal: amt.total != null ? amt.total : null,
    amountCurrency: amt.currency || '',
    amountPayerTotal: amt.payer_total != null ? amt.payer_total : null,
    tradeType: data.trade_type || '',
    bankType: data.bank_type || '',
    successTime: data.success_time || '',
  }
}

module.exports = { getConfig, jsapiOrder, queryOrder, now }
