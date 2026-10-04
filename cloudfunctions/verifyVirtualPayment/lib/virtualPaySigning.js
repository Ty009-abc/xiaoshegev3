'use strict'
/**
 * virtualPaySigning.js — RC8_13 虚拟支付·签名与服务器 API 权威（canonical）
 *
 * 官方规则（已核 https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html#_2-5-签名详解）：
 *   支付签名 paySig    = to_hex(hmac_sha256(appKey,      uri + '&' + signData))
 *                        wx.requestVirtualPayment 时 uri 固定为 'requestVirtualPayment'
 *   用户态签名 signature = to_hex(hmac_sha256(session_key, signData))
 *   AppKey 按 env 选择：env=0 现网 AppKey；env=1 沙箱 AppKey。session_key 来自 auth.code2Session。
 *
 * 铁律：
 *   - signData 只序列化一次；返回给客户端的字符串必须与实际参与签名/发起支付的完全一致。
 *   - AppKey / session_key / access_token 绝不返回客户端、绝不落日志、绝不入库。
 *   - 任何签名失败都 fail-closed（返回 null，不抛出含密钥的异常）。
 *
 * 本文件为 canonical；三个虚拟支付云函数各持一份字节一致副本。
 */

const crypto = require('crypto')

const URI_REQUEST_VIRTUAL_PAYMENT = 'requestVirtualPayment'

// ── 环境判定（0=现网, 1=沙箱）；默认沙箱 ──
function resolveEnvFlag (env) {
  const e = env || process.env || {}
  return String(e.VIRTUAL_PAY_ENV === '0' ? 0 : 1) === '0' ? 0 : 1
}

function _nonEmpty (v) { return typeof v === 'string' && v.trim().length > 0 }

/**
 * selectAppKey — 依据 envFlag 选择 AppKey（绝不返回值本身给调用方以外的持久化/日志）。
 * @returns {string} appKey（内存中即用即弃）或 '' 缺失
 */
function selectAppKey (env, envFlag) {
  const e = env || process.env || {}
  const flag = envFlag === undefined ? resolveEnvFlag(e) : envFlag
  return flag === 0
    ? (e.VIRTUAL_PAY_PROD_APP_KEY || '')
    : (e.VIRTUAL_PAY_SANDBOX_APP_KEY || '')
}

/**
 * buildSignData — 按官方字段构造 signData 对象（模式 short_series_goods）。
 * 注意：顺序固定，序列化仅一次（见 serializeSignData）。
 */
function buildSignData (product, cfg, outTradeNo, attach) {
  return {
    offerId: String(cfg.offerId),
    buyQuantity: 1,
    env: cfg.envFlag,
    currencyType: 'CNY',
    productId: String(product.virtualProductId),
    goodsPrice: Number(product.priceFen),
    outTradeNo: String(outTradeNo),
    attach: attach == null ? '' : String(attach),
  }
}

/**
 * serializeSignData — signData 的规范化序列化（唯一权威序列化点）。
 * 采用固定字段顺序 + JSON.stringify；调用方拿到字符串后必须原样透传，
 * 绝不可再次 JSON.parse/stringify（字节不一致 → 支付签名校验失败）。
 */
function serializeSignData (signData) {
  return JSON.stringify({
    offerId: signData.offerId,
    buyQuantity: signData.buyQuantity,
    env: signData.env,
    currencyType: signData.currencyType,
    productId: signData.productId,
    goodsPrice: signData.goodsPrice,
    outTradeNo: signData.outTradeNo,
    attach: signData.attach,
  })
}

/** 支付签名：to_hex(hmac_sha256(appKey, uri + '&' + signData)) */
function calcPaySig (uri, signDataStr, appKey) {
  if (!_nonEmpty(appKey)) return ''
  return crypto.createHmac('sha256', appKey)
    .update(String(uri) + '&' + String(signDataStr), 'utf8')
    .digest('hex')
}

/** 用户态签名：to_hex(hmac_sha256(session_key, signData)) */
function calcUserSignature (signDataStr, sessionKey) {
  if (!_nonEmpty(sessionKey)) return ''
  return crypto.createHmac('sha256', sessionKey)
    .update(String(signDataStr), 'utf8')
    .digest('hex')
}



function httpsRequestJson (method, url, bodyStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url)
      const req = require('https').request({
        hostname: u.hostname, path: u.pathname + u.search, method: method,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr || '') },
      }, (res) => {
        let d = ''
        res.on('data', (c) => { d += c })
        res.on('end', () => { try { resolve(JSON.parse(d)) } catch (_) { resolve(null) } })
      })
      req.on('error', () => resolve(null))
      if (bodyStr) req.write(bodyStr)
      req.end()
    } catch (_) { resolve(null) }
  })
}

// ── 极简 HTTPS JSON 客户端（无第三方依赖） ──
function httpsGetJson (url) {
  return new Promise((resolve) => {
    try {
      require('https').get(url, (res) => {
        let d = ''
        res.on('data', (c) => { d += c })
        res.on('end', () => { try { resolve(JSON.parse(d)) } catch (_) { resolve(null) } })
      }).on('error', () => resolve(null))
    } catch (_) { resolve(null) }
  })
}

function httpsPostJson (url, bodyStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url)
      const req = require('https').request({
        hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr || '') },
      }, (res) => {
        let d = ''
        res.on('data', (c) => { d += c })
        res.on('end', () => { try { resolve(JSON.parse(d)) } catch (_) { resolve(null) } })
      })
      req.on('error', () => resolve(null))
      req.write(bodyStr || '')
      req.end()
    } catch (_) { resolve(null) }
  })
}

// ═══════════════════════ 服务器 API 依赖（access_token / session_key） ═══════════════════════

/**
 * getAccessToken — 服务器 API（如 /xpay/query_order）所需 access_token。
 * 需要环境变量 WX_APPID + WX_APPSECRET（AppSecret 仅服务端，绝不外泄/入库）。
 * 返回 '' 表示未配置（fail-closed）。
 */
async function getAccessToken (env, httpGet) {
  httpGet = httpGet || httpsGetJson
  const e = env || process.env || {}
  const appid = e.WX_APPID || ''
  const secret = e.WX_APPSECRET || ''
  if (!_nonEmpty(appid) || !_nonEmpty(secret)) return ''
  const url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential'
    + '&appid=' + encodeURIComponent(appid) + '&secret=' + encodeURIComponent(secret)
  const res = await httpGet(url)
  try {
    const j = typeof res === 'string' ? JSON.parse(res) : res
    return (j && j.access_token) || ''
  } catch (_) { return '' }
}

/**
 * getSessionKey — auth.code2Session 换取当前用户 session_key（用户态签名权威来源）。
 * 需要 WX_APPID + WX_APPSECRET；jsCode 来自客户端 wx.login()。
 * 返回 { sessionKey, openid } 或 null（fail-closed）。绝不记录 sessionKey。
 */
async function getSessionKey (env, jsCode, httpGet) {
  httpGet = httpGet || httpsGetJson
  const e = env || process.env || {}
  const appid = e.WX_APPID || ''
  const secret = e.WX_APPSECRET || ''
  if (!_nonEmpty(appid) || !_nonEmpty(secret) || !_nonEmpty(jsCode)) return null
  const url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + encodeURIComponent(appid)
    + '&secret=' + encodeURIComponent(secret) + '&js_code=' + encodeURIComponent(jsCode)
    + '&grant_type=authorization_code'
  const res = await httpGet(url)
  try {
    const j = typeof res === 'string' ? JSON.parse(res) : res
    if (!j || !j.session_key) return null
    return { sessionKey: j.session_key, openid: j.openid || '' }
  } catch (_) { return null }
}

module.exports = {
  URI_REQUEST_VIRTUAL_PAYMENT,
  resolveEnvFlag,
  selectAppKey,
  buildSignData,
  serializeSignData,
  calcPaySig,
  calcUserSignature,
  getAccessToken,
  getSessionKey,
  httpsGetJson,
  httpsPostJson,
  httpsRequestJson,
}
