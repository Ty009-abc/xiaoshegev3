/**
 * common/payment.js - 微信支付封装（JSAPI v3）
 *
 * ⚠️ 部署前必须配置以下环境变量或安全配置：
 *   - WXPAY_MCHID        商户号
 *   - WXPAY_APPID        小程序 AppID
 *   - WXPAY_SERIAL_NO    证书序列号
 *   - WXPAY_PRIVATE_KEY  商户私钥 (PEM 格式，换行用 \n)
 *   - WXPAY_API_V3_KEY   APIv3 密钥
 *   - WXPAY_NOTIFY_URL   支付回调地址
 *
 * 占位模式（当前）：createOrder 返回 TEST_MODE 提醒，不发起真实支付。
 * 正式环境请填写上述配置并设置 isMock=false。
 */

const crypto = require('crypto')
const now = () => Date.now()

// ======================== 配置读取 ========================
function getConfig() {
  return {
    isMock: !process.env.WXPAY_MCHID,
    mchid: process.env.WXPAY_MCHID || '',
    appid: process.env.WXPAY_APPID || 'REPLACE_WITH_YOUR_APPID',
    serialNo: process.env.WXPAY_SERIAL_NO || '',
    privateKey: process.env.WXPAY_PRIVATE_KEY
      ? process.env.WXPAY_PRIVATE_KEY.replace(/\\n/g, '\n')
      : '',
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

// ======================== JSAPI 下单 ========================
/**
 * JSAPI 下单
 * @param {object} params
 * @returns {{ success, prepay_id, paymentParams }}
 */
async function jsapiOrder(params) {
  const { appid, mchid, serialNo, privateKey, apiV3Key, notifyUrl, isMock } = getConfig()
  const { orderId, productName, totalAmount, openid } = params

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
    let response
    if (typeof require === 'function') {
      try {
        const axios = require('axios')
        response = await axios({
          method: 'POST',
          url: 'https://api.mch.weixin.qq.com' + path,
          headers,
          data: body,
          timeout: 15000,
        })
      } catch (_) {
        const fetch = require('node-fetch')
        response = await fetch('https://api.mch.weixin.qq.com' + path, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
        response = { data: await response.json(), status: response.status }
      }
    }

    if (response.data && response.data.prepay_id) {
      const prepayId = response.data.prepay_id
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

    console.error('[WXPAY] 下单失败:', JSON.stringify(response.data))
    return { success: false, error: response.data?.message || '下单失败' }
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
  const { mchid, serialNo, privateKey, isMock } = getConfig()

  if (isMock) {
    console.warn('[WXPAY] 沙箱查单 — 返回已支付')
    return { success: true, tradeState: 'SUCCESS', transactionId: 'MOCK_TXN_' + orderId }
  }

  const path = `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${mchid}`
  const headers = sign('GET', path, '', mchid, serialNo, privateKey)
  headers['Content-Type'] = 'application/json'

  try {
    let response
    try {
      const axios = require('axios')
      response = await axios({ method: 'GET', url: 'https://api.mch.weixin.qq.com' + path, headers, timeout: 10000 })
    } catch (_) {
      const fetch = require('node-fetch')
      response = await fetch('https://api.mch.weixin.qq.com' + path, { headers })
      response = { data: await response.json(), status: response.status }
    }

    return {
      success: true,
      tradeState: response.data?.trade_state || 'UNKNOWN',
      transactionId: response.data?.transaction_id || '',
      tradeStateDesc: response.data?.trade_state_desc || '',
    }
  } catch (err) {
    console.error('[WXPAY] 查单异常:', err.message)
    return { success: false, tradeState: 'ERROR', error: err.message }
  }
}

module.exports = { getConfig, jsapiOrder, queryOrder, now }
