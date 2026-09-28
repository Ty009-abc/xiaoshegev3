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
  MISSING_HEADERS: 'MISSING_HEADERS', // 应答缺少 Wechatpay-* 签名头
}

// mock 交易号命名空间前缀（服务端 payment.js mock 分支写入；真实交易号不会以此开头）
const MOCK_TXN_PREFIX = 'MOCK_TXN_'

// 权威类型
const AUTHORITY_TYPE = {
  PUBLIC_KEY: 'PUBLIC_KEY',
  CERTIFICATE: 'CERTIFICATE',
}

/**
 * normalizePem — CANONICAL PEM normalizer (single runtime authority).
 *
 * Robust to how CloudBase may store a PEM env value:
 *   - normal multiline PEM
 *   - literal "\\n" (escaped) form
 *   - PEM flattened into SPACES (newlines replaced by spaces — the Stage4A defect)
 *   - CRLF line endings
 *
 * Preserves the PEM label exactly, strips whitespace ONLY from the base64 body,
 * re-wraps the body at 64 columns, and returns a valid trailing newline.
 * FAIL-CLOSED: returns '' on missing input, BEGIN/END label mismatch, malformed
 * structure, or a non-base64 body. NEVER coerces arbitrary text into a "key".
 *
 * @param {string} raw
 * @returns {string} normalized PEM or '' (fail-closed)
 */
function normalizePem(raw) {
  if (!raw || typeof raw !== 'string') return ''

  const s = raw.replace(/\\n/g, '\n').trim()

  // Whole string must be a single BEGIN…END block with a MATCHING label (\1).
  const m = s.match(/^-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----$/)
  if (!m) return ''

  const label = m[1]
  const body = m[2].replace(/\s+/g, '')

  // Body must be non-empty, well-formed base64 (no silence-coercion of junk).
  if (!body || !/^[A-Za-z0-9+/=]+$/.test(body)) return ''

  const lines = body.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

/**
 * normalizePrivateKeyPem — PEM normalization + PRIVATE KEY type guard (fail-closed).
 *
 * Requirements:
 *   - label MUST be a supported private-key label ("PRIVATE KEY" / "RSA PRIVATE KEY").
 *   - crypto.createPrivateKey(normalized) MUST succeed and be RSA.
 * Rejects PUBLIC KEY / CERTIFICATE / any non-private-key PEM → ''.
 *
 * @param {string} raw
 * @returns {string} normalized PRIVATE KEY PEM or '' (fail-closed)
 */
function normalizePrivateKeyPem(raw) {
  const pem = normalizePem(raw)
  if (!pem) return ''
  if (!/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(pem)) return ''
  try {
    const key = crypto.createPrivateKey(pem)
    if (key.asymmetricKeyType !== 'rsa') return ''
    return pem
  } catch (err) {
    return ''
  }
}

/**
 * derivePrivateKeyFingerprint — sha256 of the private key's public SPKI (DER).
 * NEVER derives from / exposes the private scalar. Fail-closed → ''.
 *
 * @param {string} pem normalized PEM (any key/cert)
 * @returns {string} lowercase hex sha256 of SPKI DER, or ''
 */
function derivePrivateKeyFingerprint(pem) {
  if (!pem) return ''
  try {
    let key = null
    try { key = crypto.createPrivateKey(pem) } catch (_) { key = crypto.createPublicKey(pem) }
    // KeyObject.export({type:'spki'}) is INVALID for a PRIVATE key object; always
    // project to the public half first (public SPKI is what we fingerprint).
    const pub = (key.type === 'private') ? crypto.createPublicKey(key) : key
    const spki = pub.export({ type: 'spki', format: 'der' })
    return crypto.createHash('sha256').update(spki).digest('hex')
  } catch (err) {
    return ''
  }
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

/**
 * isMockTransactionId — 交易号是否为 mock 命名空间
 */
function isMockTransactionId(txnId) {
  return typeof txnId === 'string' && txnId.indexOf(MOCK_TXN_PREFIX) === 0
}

/**
 * isMockPaymentResult — 查询结果是否为 mock（严禁进入 paid / entitlement 权威转换）
 */
function isMockPaymentResult(queryResult) {
  if (!queryResult || typeof queryResult !== 'object') return false
  if (queryResult._mock === true) return true
  return isMockTransactionId(queryResult.transactionId)
}

/**
 * verifyResponseSignature — 微信 API 应答/通知 的 RSA-SHA256 权威验签（与 payCallback 同一模型）
 *
 * 复用 buildAuthorities / routeAuthority / routeAuthority / verifySignature，语义不与回调漂移。
 * fail-closed：任一必需头缺失、权威未路由、验签失败 → valid:false。
 * 严禁在未验证前把应答当作支付权威（不得标记 paid / 发放权益）。
 *
 * @param {object} headers  响应头（含 Wechatpay-Timestamp/Nonce/Signature/Serial）
 * @param {string} rawBody  原始响应体字符串（不得重新序列化）
 * @param {object} [env]    环境变量对象（默认 process.env）
 * @returns {{valid:boolean, reason?:string, authorityType?:string}}
 */
function verifyResponseSignature(headers, rawBody, env) {
  const h = headers || {}
  const ts = h['Wechatpay-Timestamp'] || h['wechatpay-timestamp'] || ''
  const nonce = h['Wechatpay-Nonce'] || h['wechatpay-nonce'] || ''
  const signature = h['Wechatpay-Signature'] || h['wechatpay-signature'] || ''
  const serial = h['Wechatpay-Serial'] || h['wechatpay-serial'] || ''
  if (!ts || !nonce || !signature || !serial) {
    return { valid: false, reason: REASONS.MISSING_HEADERS }
  }
  const { authorities } = buildAuthorities(env || process.env)
  const message = ts + '\n' + nonce + '\n' + (typeof rawBody === 'string' ? rawBody : '') + '\n'
  return verifyCallback(serial, authorities, message, signature)
}

/**
 * decryptResource — AEAD_AES_256_GCM 通知资源解密（微信 v3 规范：ciphertext 为 Base64）
 *
 * 认证标签为解码后末 16 字节；必须调用 final() 以完成 GCM 认证。
 * 解密/认证失败 → null（调用方 fail-closed）。
 *
 * @param {object} resource  {algorithm, ciphertext, nonce, associated_data}
 * @param {string} apiV3Key  APIv3 对称密钥（32 字节）
 * @returns {object|null}
 */
function decryptResource(resource, apiV3Key) {
  if (!resource || !apiV3Key) return null
  try {
    const { algorithm, ciphertext, nonce, associated_data } = resource
    if (algorithm !== 'AEAD_AES_256_GCM') return null
    const buf = Buffer.from(ciphertext || '', 'base64')
    const authTag = buf.slice(buf.length - 16)
    const data = buf.slice(0, buf.length - 16)
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf8'),
      Buffer.from(nonce || '', 'utf8')
    )
    decipher.setAuthTag(authTag)
    decipher.setAAD(Buffer.from(associated_data || '', 'utf8'))
    const raw = Buffer.concat([decipher.update(data), decipher.final()])
    return JSON.parse(raw.toString('utf8'))
  } catch (err) {
    return null
  }
}

module.exports = {
  REASONS,
  MOCK_TXN_PREFIX,
  REASONS,
  AUTHORITY_TYPE,
  normalizePem,
  normalizePrivateKeyPem,
  derivePrivateKeyFingerprint,
  isSpkiPem,
  isX509Pem,
  isRsaPublicKey,
  isRsaCertificate,
  extractCertSerial,
  buildAuthorities,
  routeAuthority,
  verifySignature,
  verifyCallback,
  isMockTransactionId,
  isMockPaymentResult,
  verifyResponseSignature,
  decryptResource,
}
