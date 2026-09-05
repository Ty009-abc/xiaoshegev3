/**
 * lib/paymentAuthority.js — 微信支付回调验签权威路由（纯函数模块）
 *
 * 设计目标：
 *   - 纯函数：无 wx-server-sdk、无 DB、无网络、无环境变量写入、不打印任何密钥内容。
 *   - 双权威（可共存）：微信支付公钥（SPKI）与微信支付平台证书（X509）。
 *   - Wechatpay-Serial 为强制选择器，全程 fail-closed。
 *
 * 权威配置（环境变量，只读）：
 *
 *   A. 公钥模式（PUBLIC KEY / SPKI）
 *        WXPAY_PUBLIC_KEY_ID   公钥 ID，必须以 PUB_KEY_ID_ 开头
 *        WXPAY_PUBLIC_KEY      微信平台公钥 PEM（-----BEGIN PUBLIC KEY-----）
 *
 *   B. 平台证书模式（X509 CERTIFICATE）
 *        WXPAY_PLATFORM_CERT             平台证书 PEM（-----BEGIN CERTIFICATE-----）
 *        WXPAY_PLATFORM_CERT_SERIAL      可选；缺省时从证书本体解析序列号
 *        （兼容旧式精确多证书：WXPAY_PLATFORM_CERT_SERIAL_<SERIAL>=<PEM>）
 *
 *   ⚠️ 若 WXPAY_PLATFORM_CERT 内容为 SPKI 公钥（或任何非 X509 输入），
 *      拒绝该证书权威配置，绝不静默重解释为公钥模式（SMUGGLE 防护）。
 *
 * 路由语义（Wechatpay-Serial 强制）：
 *   - 以 PUB_KEY_ID_ 开头 → 公钥模式，要求与 WXPAY_PUBLIC_KEY_ID 完全相等，
 *     仅使用 WXPAY_PUBLIC_KEY，绝不尝试证书权威；不匹配 → fail closed。
 *   - 其余（证书序列号形式）→ 证书模式，十六进制大小写不敏感精确匹配，
 *     仅使用命中的 X509 证书，绝不尝试公钥权威；不匹配 → fail closed。
 *   - 缺失 / 未知 / 不匹配 → fail closed。
 *
 *   ❌ 禁止：try-all-keys、first-authority fallback、单权威 fallback、
 *           跨权威替换、选择器绕过。
 */

const crypto = require('crypto')

// 稳定内部错误分类
const REASONS = {
  CERT_OR_KEY_NOT_FOUND: 'CERT_OR_KEY_NOT_FOUND', // 选择器缺失/未知/不匹配/无可用权威
  SIGNATURE_ERROR: 'SIGNATURE_ERROR', // 权威已路由，但 RSA-SHA256 验签失败
  AUTHORITY_CONFIG_ERROR: 'AUTHORITY_CONFIG_ERROR', // 权威配置非法（如 SPKI 入证书槽）
}

// 权威类型
const AUTHORITY_TYPE = {
  PUBLIC_KEY: 'PUBLIC_KEY',
  CERTIFICATE: 'CERTIFICATE',
}

// 规范化 PEM：把转义的 \\n 还原为真实换行并去首尾空白
function normalizePem(s) {
  if (!s) return ''
  return s.replace(/\\n/g, '\n').trim()
}

// 是否为 SPKI 公钥 PEM
function isSpkiPem(pem) {
  return /-----BEGIN PUBLIC KEY-----/.test(pem) && /-----END PUBLIC KEY-----/.test(pem)
}

// 是否为 X509 证书 PEM
function isX509Pem(pem) {
  return /-----BEGIN CERTIFICATE-----/.test(pem) && /-----END CERTIFICATE-----/.test(pem)
}

// 公钥 PEM 是否为可用的 RSA 验签公钥（SPKI）
function isRsaPublicKey(pem) {
  if (!isSpkiPem(pem)) return false
  try {
    const key = crypto.createPublicKey(pem)
    return key.asymmetricKeyType === 'rsa'
  } catch (err) {
    return false
  }
}

// 证书 PEM 是否为可用的 RSA X509 证书
function isRsaCertificate(pem) {
  if (!isX509Pem(pem)) return false
  try {
    const cert = new crypto.X509Certificate(pem)
    return cert.publicKey && cert.publicKey.asymmetricKeyType === 'rsa'
  } catch (err) {
    return false
  }
}

// 从 X509 证书提取序列号（大写十六进制，无冒号）；失败返回空串
function extractCertSerial(pem) {
  try {
    const cert = new crypto.X509Certificate(pem)
    return (cert.serialNumber || '').trim().toUpperCase()
  } catch (err) {
    return ''
  }
}

/**
 * buildAuthorities — 从环境变量构建权威列表（+ 配置错误）
 *
 * @param {object} [env] 环境变量对象（默认 process.env，便于测试注入）
 * @returns {{
 *   authorities: Array<{type: 'PUBLIC_KEY'|'CERTIFICATE', id: string, key: string}>,
 *   errors: string[]
 * }}
 */
function buildAuthorities(env) {
  env = env || process.env
  const authorities = []
  const errors = []

  // ── A. 公钥模式 ──
  const pubKeyId = (env.WXPAY_PUBLIC_KEY_ID || '').trim()
  const pubKey = normalizePem(env.WXPAY_PUBLIC_KEY || '')
  if (pubKeyId || pubKey) {
    if (isRsaPublicKey(pubKey)) {
      if (!pubKeyId) {
        errors.push('WXPAY_PUBLIC_KEY 已配置但缺少 WXPAY_PUBLIC_KEY_ID')
      } else if (!pubKeyId.startsWith('PUB_KEY_ID_')) {
        errors.push('WXPAY_PUBLIC_KEY_ID 必须以 PUB_KEY_ID_ 开头')
      } else {
        authorities.push({ type: AUTHORITY_TYPE.PUBLIC_KEY, id: pubKeyId, key: pubKey })
      }
    } else if (pubKey) {
      errors.push('WXPAY_PUBLIC_KEY 非合法 RSA PUBLIC KEY PEM（SPKI required）')
    } else {
      errors.push('WXPAY_PUBLIC_KEY_ID 已配置但缺少 WXPAY_PUBLIC_KEY')
    }
  }

  // ── B. 证书模式 ──
  // B1. 旧式精确多证书：WXPAY_PLATFORM_CERT_SERIAL_<SERIAL>=<PEM>
  const legacyCertKeyRe = /^WXPAY_PLATFORM_CERT_SERIAL_[0-9A-Fa-f]+$/
  for (const k of Object.keys(env)) {
    if (!legacyCertKeyRe.test(k)) continue
    const pem = normalizePem(env[k] || '')
    if (!pem) continue
    if (isSpkiPem(pem)) {
      errors.push(`证书槽被写入 SPKI 公钥（已拒绝）: ${k}`)
      continue
    }
    if (isRsaCertificate(pem)) {
      const serial = k.slice('WXPAY_PLATFORM_CERT_SERIAL_'.length).toUpperCase()
      authorities.push({ type: AUTHORITY_TYPE.CERTIFICATE, id: serial, key: pem })
    } else {
      errors.push(`证书槽含非 X509 输入（已拒绝）: ${k}`)
    }
  }

  // B2. 默认单证书：WXPAY_PLATFORM_CERT（可选 WXPAY_PLATFORM_CERT_SERIAL）
  const defaultCert = normalizePem(env.WXPAY_PLATFORM_CERT || '')
  if (defaultCert) {
    if (isSpkiPem(defaultCert)) {
      // SMUGGLE 防护：严禁把 SPKI 公钥放进证书槽，绝不重解释为公钥模式
      errors.push('WXPAY_PLATFORM_CERT 含 SPKI 公钥（已拒绝，不重解释为公钥模式）')
    } else if (isRsaCertificate(defaultCert)) {
      const declared = (env.WXPAY_PLATFORM_CERT_SERIAL || '').trim()
      const serial = declared ? declared.toUpperCase() : extractCertSerial(defaultCert)
      if (!serial) {
        errors.push('WXPAY_PLATFORM_CERT 无法解析证书序列号')
      } else {
        authorities.push({ type: AUTHORITY_TYPE.CERTIFICATE, id: serial, key: defaultCert })
      }
    } else {
      errors.push('WXPAY_PLATFORM_CERT 非合法 X509 CERTIFICATE PEM（已拒绝）')
    }
  }

  return { authorities, errors }
}

/**
 * routeAuthority — 按 Wechatpay-Serial 精确路由到唯一权威（fail-closed）
 *
 * @param {string} wechatpaySerial Wechatpay-Serial 头
 * @param {Array} authorities buildAuthorities 的产物
 * @returns {object|null} 匹配的权威；无匹配返回 null（调用方 FAIL CLOSED）
 */
function routeAuthority(wechatpaySerial, authorities) {
  if (!wechatpaySerial || !Array.isArray(authorities)) return null
  const serial = String(wechatpaySerial).trim()
  if (serial.startsWith('PUB_KEY_ID_')) {
    // 公钥模式：精确相等；证书权威绝不参与
    return authorities.find((a) => a.type === AUTHORITY_TYPE.PUBLIC_KEY && a.id === serial) || null
  }
  // 证书模式：十六进制大小写不敏感精确匹配；公钥权威绝不参与
  const wanted = serial.toUpperCase()
  return authorities.find((a) => a.type === AUTHORITY_TYPE.CERTIFICATE && a.id === wanted) || null
}

/**
 * verifySignature — RSA-SHA256 验签（仅使用 routeAuthority 返回的权威）
 *
 * @param {object} authority routeAuthority 的匹配结果
 * @param {string} message timestamp\nnonce\nrawBody\n
 * @param {string} signatureBase64 Wechatpay-Signature
 * @returns {boolean}
 */
function verifySignature(authority, message, signatureBase64) {
  if (!authority || !authority.key || !signatureBase64) return false
  try {
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(message)
    verifier.end()
    return verifier.verify(authority.key, signatureBase64, 'base64')
  } catch (err) {
    return false
  }
}

/**
 * verifyCallback — 权威路由 + 验签编排（纯函数，fail-closed）
 *
 * @param {string} wechatpaySerial
 * @param {Array} authorities
 * @param {string} message
 * @param {string} signatureBase64
 * @returns {{valid: boolean, reason?: string, authorityType?: string}}
 */
function verifyCallback(wechatpaySerial, authorities, message, signatureBase64) {
  const authority = routeAuthority(wechatpaySerial, authorities)
  if (!authority) {
    return { valid: false, reason: REASONS.CERT_OR_KEY_NOT_FOUND }
  }
  if (!verifySignature(authority, message, signatureBase64)) {
    return { valid: false, reason: REASONS.SIGNATURE_ERROR }
  }
  return { valid: true, authorityType: authority.type }
}

module.exports = {
  REASONS,
  AUTHORITY_TYPE,
  normalizePem,
  isSpkiPem,
  isX509Pem,
  isRsaPublicKey,
  isRsaCertificate,
  extractCertSerial,
  buildAuthorities,
  routeAuthority,
  verifySignature,
  verifyCallback,
}
