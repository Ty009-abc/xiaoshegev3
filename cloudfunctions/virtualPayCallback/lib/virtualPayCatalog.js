'use strict'
/**
 * virtualPayCatalog.js — RC8_13 虚拟支付·服务端权威商品目录（canonical）
 *
 * 权威原则：
 *   - 价格 / 时长 / virtualProductId 一律以服务端目录为准，绝不接受客户端声明。
 *   - 会员直购（short_series_goods），不经代币体系（代币与会员权益体系分离）。
 *   - 环境变量只读取「是否存在」；本模块绝不返回任何 AppKey 值。
 *
 * 本文件为 canonical；createVirtualOrder / virtualPayCallback / verifyVirtualPayment
 * 各持一份字节一致的副本。
 *
 * 签名（RC8_13 Stage1 实现点，骨架阶段不实现）：
 *   signData  = 服务端序列化一次；必须与传给 wx.requestVirtualPayment 的字符串字节一致
 *               （appKey 按 env 选择：env=0 现网 AppKey，env=1 沙箱 AppKey）
 *   paySig    = to_hex(hmac_sha256(appKey,   'requestVirtualPayment' + '&' + signData))
 *   signature = to_hex(hmac_sha256(session_key, signData))
 *   绝不返回 AppKey / session_key 给客户端，绝不落盘。
 */

const CATALOG = {
  vip_month_39_9: {
    localProductId: 'vip_month_39_9',
    displayName: '认知会员月卡',
    priceFen: 3990,
    durationDays: 30,
    virtualProductId: '30',
    mode: 'short_series_goods',
  },
  vip_year_299: {
    localProductId: 'vip_year_299',
    displayName: '认知操作系统年卡',
    priceFen: 29900,
    durationDays: 365,
    virtualProductId: '365',
    mode: 'short_series_goods',
  },
}

function getCatalog (productId) {
  const e = CATALOG[productId]
  return e ? Object.assign({}, e) : null
}

// 反向查找：virtualProductId（MP 道具ID）→ 本地商品；用于发货推送/查单的商品校验。
function findByVirtualProductId (virtualProductId) {
  const vid = String(virtualProductId)
  for (const k of Object.keys(CATALOG)) {
    if (String(CATALOG[k].virtualProductId) === vid) return Object.assign({}, CATALOG[k])
  }
  return null
}

// 发售模式（服务端权威，失败闭合）：VIRTUAL_PAY_SALES_MODE==='ENABLED' 才允许新售。
function salesMode (env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {}) || {}
  return e.VIRTUAL_PAY_SALES_MODE === 'ENABLED' ? 'ENABLED' : 'DISABLED'
}
function isVirtualSaleEnabled (env) { return salesMode(env) === 'ENABLED' }

// 环境选择（0=现网, 1=沙箱）；骨架默认沙箱(1)。
function resolveEnvFlag (env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {}) || {}
  return String(e.VIRTUAL_PAY_ENV || '1') === '0' ? 0 : 1
}

function _nonEmpty (v) { return typeof v === 'string' && v.trim().length > 0 }

// offerId 规范化：非字符串一律转字符串并 trim；缺失返回 ''。
function normalizeOfferId (v) {
  if (v == null) return ''
  return (typeof v === 'string' ? v : String(v)).trim()
}

// 非法字面量哨兵（防止 String(undefined)/String(null) 落进 signData）。
const OFFER_ID_BAD = new Set(['undefined', 'null', 'NaN', 'none', '0'])

// offerId 值校验：官方 offerId 为数字字符串（如 '1450666840'）。
// 拒绝：空 / 'undefined' / 'null' / 'NaN' / 纯零 / 非数字。
function isValidOfferId (v) {
  const s = normalizeOfferId(v)
  if (!s) return false
  if (OFFER_ID_BAD.has(s)) return false
  return /^[1-9][0-9]*$/.test(s)
}

// 配置探测：返回「实际值 + 存在性布尔」。
//   - 真实业务流（createVirtualOrder）读取 offerId 实际值参与 signData。
//   - 存在性布尔保留给 selfcheck。
//   - 绝不返回任何 AppKey 值。
function resolveVirtualPayConfig (env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {}) || {}
  const offerId = normalizeOfferId(e.VIRTUAL_PAY_OFFER_ID)
  return {
    salesMode: salesMode(e),
    envFlag: resolveEnvFlag(e),
    offerId,
    offerIdPresent: offerId.length > 0,
    sandboxAppKeyPresent: _nonEmpty(e.VIRTUAL_PAY_SANDBOX_APP_KEY),
    prodAppKeyPresent: _nonEmpty(e.VIRTUAL_PAY_PROD_APP_KEY),
  }
}

// selfcheck 专用投影：仅存在性布尔 + 环境/发售（绝不外泄 offerId 实际值 / AppKey）。
function presenceOnly (cfg) {
  const c = cfg || {}
  return {
    salesMode: c.salesMode,
    envFlag: c.envFlag,
    offerIdPresent: !!c.offerIdPresent,
    sandboxAppKeyPresent: !!c.sandboxAppKeyPresent,
    prodAppKeyPresent: !!c.prodAppKeyPresent,
  }
}

module.exports = {
  CATALOG,
  getCatalog,
  findByVirtualProductId,
  salesMode,
  isVirtualSaleEnabled,
  resolveEnvFlag,
  resolveVirtualPayConfig,
  presenceOnly,
  normalizeOfferId,
  isValidOfferId,
}
